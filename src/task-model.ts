import {
  detectLanguage,
  detectWorkItemType,
  loadConfig
} from './config';

import { normalizeText } from './utils';

import type {
  ResolvedConfig,
  StatusHistoryEntry,
  TaskPayload,
  TaskSource,
  UnifiedTask,
  WorkItemType
} from './types';

function normalizeList(values: unknown): string[] {
  if (typeof values === 'string') {
    return [normalizeText(values)].filter(Boolean);
  }

  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => normalizeText(value))
    .filter(Boolean);
}

function normalizeWorkItemType(value: unknown): WorkItemType | undefined {
  const normalized = normalizeText(value).toLowerCase();

  if (normalized.includes('bug') || normalized.includes('defect') || normalized.includes('ошибка')) {
    return 'bug';
  }

  if (normalized.includes('story') || normalized.includes('история')) {
    return 'story';
  }

  if (normalized.includes('research') || normalized.includes('исслед')) {
    return 'research';
  }

  if (normalized.includes('tech debt') || normalized.includes('tech_debt') || normalized.includes('техдолг')) {
    return 'tech_debt';
  }

  if (normalized.includes('task') || normalized.includes('задача')) {
    return 'task';
  }

  return undefined;
}

function normalizeNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function normalizeClarityScore(value: unknown): number | undefined {
  const score = normalizeNumber(value);

  if (score === undefined) {
    return undefined;
  }

  return Math.min(100, Math.max(0, score));
}

function normalizeStatusHistory(values: unknown): StatusHistoryEntry[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .filter((value): value is Record<string, unknown> =>
      typeof value === 'object' && value !== null
    )
    .map((value) => ({
      status: normalizeText(value.status),
      enteredAt: normalizeText(value.enteredAt ?? value.entered_at),
      leftAt: normalizeText(value.leftAt ?? value.left_at) || undefined
    }))
    .filter((entry) => entry.status && entry.enteredAt);
}

function buildUnifiedTaskBody(task: UnifiedTask, language: 'ru' | 'en'): string {
  const body = normalizeText(task.body);

  if (body) {
    return body;
  }

  const sections: string[] = [];
  const context = normalizeText(task.context);
  const expectedResult = normalizeText(task.expectedResult);
  const acceptanceCriteria = (task.acceptanceCriteria || [])
    .map((item) => normalizeText(item))
    .filter(Boolean);
  const headings = language === 'en'
    ? {
      context: '## Context',
      expectedResult: '## Expected result',
      acceptanceCriteria: '## Acceptance criteria'
    }
    : {
      context: '## Контекст',
      expectedResult: '## Ожидаемый результат',
      acceptanceCriteria: '## Критерии приёмки'
    };

  if (context) {
    sections.push([headings.context, context].join('\n'));
  }

  if (expectedResult) {
    sections.push([headings.expectedResult, expectedResult].join('\n'));
  }

  if (acceptanceCriteria.length > 0) {
    sections.push([
      headings.acceptanceCriteria,
      ...acceptanceCriteria.map((item) => `- ${item}`)
    ].join('\n'));
  }

  return sections.join('\n\n');
}

function normalizeTaskSource(value: unknown): TaskSource {
  const normalized = normalizeText(value).toLowerCase().replace(/_/g, '-');

  if (
    normalized === 'github' ||
    normalized === 'jira' ||
    normalized === 'yandex-tracker' ||
    normalized === 'demo' ||
    normalized === 'file'
  ) {
    return normalized;
  }

  return 'file';
}

export function taskPayloadToUnifiedTask(
  payload: TaskPayload,
  source: UnifiedTask['source'] = 'github'
): UnifiedTask {
  const idTaskPart = payload.number !== undefined
    ? String(payload.number)
    : normalizeText(payload.title) || 'task';
  const id = [
    source,
    payload.repository,
    idTaskPart
  ].map((part) => normalizeText(part)).filter(Boolean).join(':');

  return {
    id,
    source,
    type: payload.type || 'issue',
    key: typeof payload.number === 'number' ? String(payload.number) : undefined,
    title: normalizeText(payload.title),
    body: normalizeText(payload.body),
    url: payload.htmlUrl,
    projectKey: payload.repository,
    status: payload.isDraft ? 'Draft' : undefined,
    author: undefined,
    assignee: undefined,
    createdAt: undefined,
    updatedAt: undefined,
    workItemType: payload.workItemType,
    tags: payload.labels || [],
    components: [],
    queue: payload.repository
  };
}

export function unifiedTaskToTaskPayload(
  task: UnifiedTask,
  config: ResolvedConfig = loadConfig()
): TaskPayload {
  const title = normalizeText(task.title);
  const labels = [
    ...(task.labels || []),
    ...(task.tags || []),
    ...(task.components || []),
    task.workItemType || ''
  ].filter(Boolean);
  const language = detectLanguage({
    title,
    body: [
      task.body,
      task.context,
      task.expectedResult,
      ...(task.acceptanceCriteria || [])
    ].filter(Boolean).join('\n'),
    labels
  }, config);
  const body = buildUnifiedTaskBody(task, language);
  const draft = task.status ? /draft/i.test(task.status) : false;

  return {
    type: task.type || 'issue',
    number: Number.isFinite(Number(task.key)) ? Number(task.key) : undefined,
    title,
    body,
    labels,
    isDraft: draft,
    repository: task.projectKey || task.queue,
    htmlUrl: task.url,
    workItemType: task.workItemType || detectWorkItemType({
      title,
      body,
      labels
    }),
    language: detectLanguage({
      title,
      body,
      labels
    }, config)
  };
}

export function normalizeUnifiedTask(raw: Record<string, unknown>): UnifiedTask {
  const tags = normalizeList(raw.tags);
  const labels = normalizeList(raw.labels);
  const components = normalizeList(raw.components);
  const workItemType = normalizeWorkItemType(raw.workItemType ?? raw.taskType ?? raw.task_type ?? raw.type);
  const source = normalizeTaskSource(raw.source);
  const id = normalizeText(raw.id ?? raw.key ?? raw.title ?? `task-${Date.now()}`);

  return {
    id,
    source,
    type: raw.taskType === 'pr' || raw.type === 'pr' ? 'pr' : 'issue',
    key: normalizeText(raw.key) || undefined,
    title: normalizeText(raw.title ?? raw.summary),
    body: normalizeText(raw.body ?? raw.description),
    url: normalizeText(raw.url) || undefined,
    projectKey: normalizeText(raw.projectKey ?? raw.project) || undefined,
    queue: normalizeText(raw.queue) || undefined,
    status: normalizeText(raw.status) || undefined,
    assignee: normalizeText(raw.assignee) || undefined,
    author: normalizeText(raw.author) || undefined,
    createdAt: normalizeText(raw.createdAt ?? raw.created_at) || undefined,
    updatedAt: normalizeText(raw.updatedAt ?? raw.updated_at) || undefined,
    completedAt: normalizeText(raw.completedAt ?? raw.completed_at) || undefined,
    clarityScore: normalizeClarityScore(raw.clarityScore ?? raw.clarity_score),
    statusHistory: normalizeStatusHistory(raw.statusHistory ?? raw.status_history),
    comments: normalizeList(raw.comments),
    labels,
    context: normalizeText(raw.context) || undefined,
    expectedResult: normalizeText(raw.expectedResult ?? raw.expected_result) || undefined,
    acceptanceCriteria: normalizeList(raw.acceptanceCriteria ?? raw.acceptance_criteria),
    dependencies: normalizeList(raw.dependencies),
    workItemType,
    priority: normalizeText(raw.priority) || undefined,
    sprint: normalizeText(raw.sprint) || undefined,
    tags,
    components,
    period: raw.period === 'before' || raw.period === 'after' ? raw.period : undefined,
    metrics: typeof raw.metrics === 'object' && raw.metrics !== null
      ? raw.metrics as UnifiedTask['metrics']
      : undefined
  };
}

export function normalizeUnifiedTasks(value: unknown): UnifiedTask[] {
  const items = Array.isArray(value)
    ? value
    : typeof value === 'object' && value !== null && Array.isArray((value as { tasks?: unknown[] }).tasks)
      ? (value as { tasks: unknown[] }).tasks
      : [];

  return items
    .filter((item): item is Record<string, unknown> =>
      typeof item === 'object' && item !== null
    )
    .map(normalizeUnifiedTask)
    .filter((task) => task.title || task.body);
}
