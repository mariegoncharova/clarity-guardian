import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import type { fromJsonSchema } from '@modelcontextprotocol/server';
import { PM_AGENT_TOOLS, createPmAgentTools } from './pm-agent-tools';
import { TASK_DRAFT_SCHEMA } from './pm-task-drafts';
import { buildMeetingQueue, formatMeetingReview, listMeetings, readMeeting, recheckMeeting, type Dataset } from './pm-meeting-review';
import { formatMeetingReviewHtml, MEETING_REVIEW_HTML } from './pm-meeting-review-html';
import { writeReport } from './report-utils';
import { isTaskRow } from './task-model';
import { makeCliError, readJsonFile } from './utils';

const DATASET_SCHEMA = {
  type: 'string',
  enum: ['working', 'demo'],
  description: 'Use working for the local export. Use demo only for an explicitly requested demo.'
};
const MEETING_QUERY_LIMIT = 8;
const CANDIDATES_PER_QUERY = 2;

export const WORKSPACE_TOOLS: Array<{
  name: string;
  description: string;
  parameters: Parameters<typeof fromJsonSchema>[0];
}> = [
  ...PM_AGENT_TOOLS.map((tool) => ({
    ...tool,
    parameters: {
      ...tool.parameters,
      properties: { ...tool.parameters.properties, dataset: DATASET_SCHEMA },
      required: [...tool.parameters.required, 'dataset']
    }
  })),
  {
    name: 'prepare_meeting',
    description: 'Search the backlog in one batch using IDs and short phrases from meeting notes. Returns the top candidate cards with requirements, verification and snapshot ID for drafting.',
    parameters: {
      type: 'object',
      properties: {
        dataset: DATASET_SCHEMA,
        queries: {
          type: 'array', minItems: 1, maxItems: MEETING_QUERY_LIMIT, items: { type: 'string', minLength: 1 },
          description: 'Include mentioned task IDs and a few short phrases for distinct actions. Use the language of the backlog.'
        }
      },
      required: ['dataset', 'queries'],
      additionalProperties: false
    }
  },
  {
    name: 'list_meetings',
    description: 'Find saved meeting reviews in newest-first order, including recorded open questions. Start at offset 0.',
    parameters: {
      type: 'object',
      properties: { dataset: DATASET_SCHEMA, offset: { type: 'integer', minimum: 0 } },
      required: ['dataset', 'offset'],
      additionalProperties: false
    }
  },
  {
    name: 'recheck_drafts',
    description: 'Compare saved meeting drafts to the latest backlog before transferring them. Flags changed or missing tasks and exact title conflicts for new cards.',
    parameters: {
      type: 'object',
      properties: { dataset: DATASET_SCHEMA, meetingId: { type: 'string', description: 'Meeting ID returned by save_drafts or list_meetings.' } },
      required: ['dataset', 'meetingId'],
      additionalProperties: false
    }
  },
  {
    name: 'save_drafts',
    description: 'Validate task drafts and open questions against the notes and backlog. Saves JSON, Markdown and an interactive HTML review.',
    parameters: {
      type: 'object',
      properties: {
        dataset: DATASET_SCHEMA,
        snapshotId: { type: 'string', description: 'Snapshot ID returned by prepare_meeting or list_tasks.' },
        notes: { type: 'string', description: 'Original meeting notes. Preserve the exact text.' },
        drafts: TASK_DRAFT_SCHEMA,
        questions: {
          type: 'array',
          description: 'Questions left unresolved in the meeting, each with a verbatim excerpt. Use an empty list when none were recorded.',
          items: {
            type: 'object',
            properties: { question: { type: 'string' }, sourceQuote: { type: 'string' } },
            required: ['question', 'sourceQuote'],
            additionalProperties: false
          }
        }
      },
      required: ['dataset', 'snapshotId', 'notes', 'drafts'],
      additionalProperties: false
    }
  }
];

type Snapshot = {
  id: string;
  tools: ReturnType<typeof createPmAgentTools>;
  searched: boolean;
  retrieved: Set<string>;
};

export function createWorkspaceTools(projectDir: string) {
  const snapshots = new Map<Dataset, Snapshot>();
  const reportsDir = path.join(projectDir, 'reports', 'codex');

  function load(dataset: Dataset): Snapshot {
    const tasksPath = path.join(projectDir, 'data', dataset === 'demo' ? 'demo-tasks.json' : 'local/tasks.json');
    const baselinePath = path.join(projectDir, 'data', dataset === 'demo' ? 'demo-scope-baseline.json' : 'local/approved.json');

    if (dataset === 'working' && !existsSync(tasksPath)) {
      throw makeCliError('Положи JSON-выгрузку бэклога в data/local/tasks.json. Для примера выбери dataset=demo.');
    }

    const tasks = readJsonFile(tasksPath);
    const baseline = existsSync(baselinePath) ? readJsonFile(baselinePath) : undefined;
    const id = createHash('sha256').update(JSON.stringify([dataset, tasks, baseline])).digest('hex');
    const previous = snapshots.get(dataset);

    if (previous?.id === id) {
      return previous;
    }

    const snapshot: Snapshot = { id, tools: createPmAgentTools(tasks, baseline), searched: false, retrieved: new Set() };
    snapshots.set(dataset, snapshot);
    return snapshot;
  }

  return {
    call(name: string, args: unknown) {
      if (!isTaskRow(args) || (args.dataset !== 'working' && args.dataset !== 'demo')) {
        throw makeCliError('Укажи dataset=working или dataset=demo.');
      }

      if (name === 'list_meetings') {
        if (typeof args.offset !== 'number' || !Number.isSafeInteger(args.offset) || args.offset < 0) {
          throw makeCliError('Укажи целое неотрицательное смещение offset.');
        }
        const meetings = listMeetings(reportsDir, args.dataset, args.offset);
        return { ...meetings, items: meetings.items.map((meeting) => {
          const folder = path.join(reportsDir, meeting.meetingId);
          const html = path.join(folder, MEETING_REVIEW_HTML);
          return {
            ...meeting, reportPath: path.relative(projectDir, path.join(folder, 'meeting-review.md')),
            ...(existsSync(html) ? { reviewPath: path.relative(projectDir, html) } : {})
          };
        }) };
      }

      const snapshot = load(args.dataset);

      if (name === 'prepare_meeting') {
        if (!Array.isArray(args.queries) || !args.queries.length || args.queries.length > MEETING_QUERY_LIMIT ||
          !args.queries.every((query: unknown) => typeof query === 'string' && query.trim())) {
          throw makeCliError(`Передай от 1 до ${MEETING_QUERY_LIMIT} ключей или фраз из заметок.`);
        }
        const queries = [...new Set(args.queries.map((query: string) => query.trim().toLowerCase()))];
        const matches = queries.map((query) => {
          const { data, refs } = snapshot.tools.findTasks(query, 'all', 0);
          return { query, total: data.total, taskRefs: refs.slice(0, CANDIDATES_PER_QUERY) };
        });
        const taskRefs = [...new Set(matches.flatMap((match) => match.taskRefs))];
        const candidates = taskRefs.map((taskRef) => snapshot.tools.call('inspect_task', { taskRef }).data);
        snapshot.searched = true;
        taskRefs.forEach((taskRef) => snapshot.retrieved.add(taskRef));
        return { snapshotId: snapshot.id, hasBaseline: snapshot.tools.snapshot.hasBaseline, matches, candidates, taskRefs };
      }

      if (name === 'recheck_drafts') {
        const meeting = readMeeting(reportsDir, args.meetingId);
        if (meeting.review.dataset !== args.dataset) throw makeCliError('Разбор относится к другому набору бэклога.');
        return recheckMeeting(meeting, snapshot.tools, snapshot.id);
      }

      if (name !== 'save_drafts') {
        const result = snapshot.tools.call(name, args);

        if (!('error' in result.data)) {
          if (name === 'list_tasks') {
            snapshot.searched = true;
          }
          result.refs.forEach((ref) => snapshot.retrieved.add(ref));
        }

        return { ...result.data, snapshotId: snapshot.id, taskRefs: result.refs };
      }

      if (args.snapshotId !== snapshot.id || !snapshot.searched) {
        throw makeCliError('Нужен актуальный поиск по бэклогу. Вызови prepare_meeting или list_tasks и повтори сверку.');
      }
      if (typeof args.notes !== 'string' || !args.notes.trim()) {
        throw makeCliError('Передай исходный текст заметок.');
      }

      const queue = buildMeetingQueue({
        dataset: args.dataset, snapshotId: snapshot.id, createdAt: new Date().toISOString(),
        notes: args.notes, drafts: args.drafts, questions: args.questions
      }, snapshot.tools, snapshot.retrieved);

      mkdirSync(reportsDir, { recursive: true });
      const directory = mkdtempSync(path.join(reportsDir, 'meeting-'));
      const meetingId = path.basename(directory);
      const reportPath = path.join(directory, 'meeting-review.md');
      const reviewPath = path.join(directory, MEETING_REVIEW_HTML);
      const outputPath = path.join(directory, 'backlog-drafts.json');
      try {
        writeReport(reportPath, formatMeetingReview(queue));
        writeReport(reviewPath, formatMeetingReviewHtml(queue, { meetingId }));
        writeReport(outputPath, `${JSON.stringify(queue, null, 2)}\n`);
      } catch (error) {
        rmSync(directory, { recursive: true, force: true });
        throw error;
      }
      return {
        meetingId, path: path.relative(projectDir, outputPath), reportPath: path.relative(projectDir, reportPath),
        reviewPath: path.relative(projectDir, reviewPath), status: queue.status,
        savedDrafts: queue.drafts.length, savedQuestions: queue.review.questions.length
      };
    }
  };
}
