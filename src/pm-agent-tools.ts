import { buildAgentHandoffReport } from './agent-handoff';
import { analyzeUnifiedTasks } from './analytics';
import { buildChangeReview } from './change-review';
import { getTaskRows, isTaskRow, normalizeUnifiedTasks } from './task-model';
import { getAcceptanceCriteria, getContext, getExecutionDetails, getExpectedResult, getTaskId, isDoneStatus } from './task-signals';
import { makeCliError } from './utils';

const PAGE_SIZE = 10;
const FIELD_LIMIT = 1200;

const searchParameters = {
  query: { type: 'string', description: 'Exact task ID or part of a task title or project. Empty string lists all.' },
  offset: { type: 'integer', description: 'Start with 0. Use nextOffset to continue browsing.' }
};

function defineTool(name: string, description: string, properties: Record<string, object>) {
  return {
    type: 'function',
    name,
    description,
    strict: true,
    parameters: { type: 'object', properties, required: Object.keys(properties), additionalProperties: false }
  };
}

export const PM_AGENT_TOOLS = [
  defineTool('list_tasks', 'Find tracker tasks. Returns compact records with task references, status, owner and risk.', {
    ...searchParameters,
    scope: { type: 'string', enum: ['active', 'all'] }
  }),
  defineTool('inspect_task', 'Read one known task reference and its requirements, QA criteria and analysis signals.', {
    taskRef: { type: 'string' }
  }),
  defineTool('review_handoff', 'Find tasks ready for AI delegation, tasks needing clarification or human review.', {
    ...searchParameters,
    status: { type: 'string', enum: ['all', 'ready_for_agent', 'needs_clarification', 'human_review'] }
  }),
  defineTool('review_changes', 'Compare against the approved snapshot if it was supplied. Shows changed fields, new and missing tasks.', searchParameters)
];

export interface AgentSource {
  ref: string;
  id: string;
  taskId: string;
  title: string;
  source: string;
  project?: string;
  url?: string;
}

type TaskIdentity = Pick<AgentSource, 'id' | 'source' | 'project'>;

function identity(task: TaskIdentity): string {
  return JSON.stringify([task.source, task.project || '', task.id]);
}

function excerpt(value: string, limit?: number): string;
function excerpt(value: string | undefined, limit?: number): string | undefined;
function excerpt(value: string | undefined, limit = FIELD_LIMIT): string | undefined {
  return value && value.length > limit ? `${value.slice(0, limit)}… [excerpt]` : value;
}

function page<T>(items: T[], offset: number, size = PAGE_SIZE) {
  return {
    total: items.length,
    items: items.slice(offset, offset + size),
    nextOffset: offset + size < items.length ? offset + size : null
  };
}

function matches(source: AgentSource, query: string): boolean {
  return [source.ref, source.taskId, source.id, source.title, source.project]
    .some((value) => value?.toLowerCase().includes(query));
}

function describeSource(source: AgentSource) {
  return { ref: source.ref, taskId: excerpt(source.taskId), title: excerpt(source.title), project: excerpt(source.project) };
}

export function createPmAgentTools(input: unknown, baseline?: unknown) {
  const rows = getTaskRows(input);

  if (!rows) {
    throw makeCliError('Агенту нужен массив задач или объект с полем tasks.');
  }

  const tasks = normalizeUnifiedTasks(input);
  const records = analyzeUnifiedTasks(tasks);
  const handoff = buildAgentHandoffReport(records);
  const activeRecords = records.filter(({ task }) => !isDoneStatus(task.status));
  const handoffByTask = new Map(activeRecords.map(({ task }, index) => [task, handoff.items[index]]));
  const byTask = new Map(records.map((record) => [record.task, record]));
  const entries = tasks.map((task, index) => {
    const source: AgentSource = {
      ref: `T${index + 1}`,
      id: task.id,
      taskId: getTaskId(task),
      title: task.title,
      source: task.source,
      project: task.projectKey || task.queue || task.repository,
      url: task.url
    };

    return {
      source,
      task,
      record: byTask.get(task),
      handoff: handoffByTask.get(task)
    };
  });
  const active = entries.filter(({ task }) => !isDoneStatus(task.status));
  const sources = new Map(entries.map(({ source }) => [source.ref, source]));
  const byRef = new Map(entries.map((entry) => [entry.source.ref, entry]));
  const byIdentity = new Map(entries.map(({ source }) => [identity(source), source]));
  const changeReview = baseline === undefined ? undefined : buildChangeReview(baseline, input);
  const sourcesMissing = changeReview?.missing.map((task, index) => {
    const source = { ...task, ref: `B${index + 1}` };
    sources.set(source.ref, source);
    return source;
  }) || [];
  const snapshot = {
    tasks: tasks.length,
    active: active.length,
    analyzed: records.length,
    ignored: tasks.length - records.length,
    dropped: rows.length - tasks.length,
    hasBaseline: changeReview !== undefined
  };

  function call(name: string, args: unknown) {
    if (!isTaskRow(args)) {
      return { data: { error: 'Tool arguments must be a JSON object.' }, refs: [] };
    }

    if (name === 'inspect_task') {
      const ref = typeof args.taskRef === 'string' ? args.taskRef.trim() : '';
      const entry = byRef.get(ref);

      if (!entry) {
        return { data: { error: 'Unknown current task reference. Use list_tasks first.' }, refs: [] };
      }

      const { source, task, record } = entry;
      const execution = getExecutionDetails(task);
      return {
        data: {
          ...describeSource(source),
          status: excerpt(task.status),
          owner: excerpt(task.assignee),
          deadline: excerpt(task.deadline || task.dueDate),
          context: excerpt(getContext(task)),
          expectedResult: excerpt(getExpectedResult(task)),
          acceptanceCriteria: getAcceptanceCriteria(task).slice(0, 10).map((criterion) => excerpt(criterion)),
          description: excerpt(task.body),
          dependencies: (task.dependencies || []).slice(0, 10).map((dependency) => excerpt(dependency)),
          scope: excerpt(execution.scope),
          verification: excerpt(execution.verification),
          repository: excerpt(execution.repository),
          clarityScore: record?.score,
          risk: record?.riskLevel,
          issues: record?.problemCodes,
          handoffStatus: entry.handoff?.status,
          questions: entry.handoff?.questions,
          reviewReasons: entry.handoff?.reviewReasons
        },
        refs: [ref]
      };
    }

    if (typeof args.query !== 'string' || typeof args.offset !== 'number' ||
      !Number.isSafeInteger(args.offset) || args.offset < 0) {
      return { data: { error: 'Provide a search query and a non-negative integer offset.' }, refs: [] };
    }

    const query = args.query.trim().toLowerCase();
    const offset = args.offset;

    if (name === 'list_tasks' && (args.scope === 'all' || args.scope === 'active')) {
      const items = (args.scope === 'active' ? active : entries).filter(({ source }) => matches(source, query));
      const result = page(items, offset);
      return {
        data: {
          ...result,
          snapshot,
          items: result.items.map(({ source, task, record }) => ({
            ...describeSource(source), status: excerpt(task.status), owner: excerpt(task.assignee), risk: record?.riskLevel
          }))
        },
        refs: result.items.map(({ source }) => source.ref)
      };
    }

    if (name === 'review_handoff' &&
      ['all', 'ready_for_agent', 'needs_clarification', 'human_review'].includes(String(args.status))) {
      const items = active.filter(({ source, handoff: entryHandoff }) =>
        entryHandoff && matches(source, query) && (args.status === 'all' || entryHandoff.status === args.status)
      );
      const result = page(items, offset);
      return {
        data: {
          ...result,
          summary: handoff.summary,
          items: result.items.map(({ source, handoff: entryHandoff }) => ({
            ...describeSource(source), status: entryHandoff?.status, questions: entryHandoff?.questions,
            reviewReasons: entryHandoff?.reviewReasons
          }))
        },
        refs: result.items.map(({ source }) => source.ref)
      };
    }

    if (name === 'review_changes') {
      if (!changeReview) {
        return { data: { error: 'No approved snapshot was supplied. Ask the user for a baseline.' }, refs: [] };
      }

      const items = [
        ...changeReview.changed.map((task) => ({
          source: byIdentity.get(identity(task))!,
          kind: 'changed',
          changes: task.changes.map(({ field, before, after }) => ({
            field,
            before: excerpt(Array.isArray(before) ? before.join('\n') : before, 500),
            after: excerpt(Array.isArray(after) ? after.join('\n') : after, 500)
          }))
        })),
        ...changeReview.added.map((task) => ({ source: byIdentity.get(identity(task))!, kind: 'added' })),
        ...sourcesMissing.map((source) => ({ source, kind: 'missing_from_current_snapshot' }))
      ].filter(({ source }) => matches(source, query));
      const result = page(items, offset, 4);
      return {
        data: {
          ...result,
          summary: changeReview.summary,
          items: result.items.map(({ source, ...item }) => ({ ...describeSource(source), ...item }))
        },
        refs: result.items.map(({ source }) => source.ref)
      };
    }

    return { data: { error: 'Unsupported tool or filter.' }, refs: [] };
  }

  return { call, sources, snapshot, handoff, changeReview };
}
