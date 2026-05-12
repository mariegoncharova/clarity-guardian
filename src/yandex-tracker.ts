import {
  getStringArg,
  makeCliError,
  normalizeText,
  parseArgs,
  readJsonFile,
  writeJsonFile
} from './utils';

import type {
  TaskProvider,
  UnifiedTask,
  WorkItemType
} from './types';

interface TrackerEntity {
  key?: string;
  display?: string;
  name?: string;
  id?: string;
}

interface TrackerUser extends TrackerEntity {
  login?: string;
}

export interface YandexTrackerIssue {
  id?: string;
  key?: string;
  self?: string;
  summary?: string;
  description?: string;
  status?: TrackerEntity;
  assignee?: TrackerUser | null;
  createdBy?: TrackerUser | null;
  author?: TrackerUser | null;
  createdAt?: string;
  updatedAt?: string;
  type?: TrackerEntity;
  priority?: TrackerEntity;
  tags?: string[];
  components?: TrackerEntity[];
  queue?: TrackerEntity;
  project?: {
    primary?: TrackerEntity;
    secondary?: TrackerEntity[];
  };
}

export interface YandexTrackerOptions {
  token: string;
  orgId?: string;
  cloudOrgId?: string;
  project?: string;
  queue?: string;
  keys?: string[];
  query?: string;
  baseUrl: string;
  limit?: number;
}

const DEFAULT_BASE_URL = 'https://api.tracker.yandex.net';
const SEARCH_FIELDS = [
  'key',
  'summary',
  'description',
  'status',
  'assignee',
  'createdBy',
  'author',
  'createdAt',
  'updatedAt',
  'type',
  'priority',
  'tags',
  'components',
  'queue',
  'project'
].join(',');

function getEntityName(value: TrackerEntity | TrackerUser | null | undefined): string | undefined {
  const login = value && 'login' in value ? value.login : undefined;
  const name = normalizeText(value?.display || value?.name || login || value?.key || value?.id);

  return name || undefined;
}

function detectTrackerWorkItemType(issue: YandexTrackerIssue): WorkItemType {
  const text = normalizeText([
    issue.type?.key,
    issue.type?.display,
    issue.summary
  ].join(' ')).toLowerCase();

  if (/(bug|defect|ошибка|баг)/.test(text)) {
    return 'bug';
  }

  if (/(story|user story|стори|история)/.test(text)) {
    return 'story';
  }

  return 'task';
}

function getTrackerConfigFromEnv(): YandexTrackerOptions {
  const token = process.env.YANDEX_TRACKER_TOKEN;
  const orgId = process.env.YANDEX_TRACKER_ORG_ID;
  const cloudOrgId = process.env.CLOUD_ORG_ID || process.env.YANDEX_TRACKER_CLOUD_ORG_ID;
  const queue = process.env.YANDEX_TRACKER_QUEUE;
  const project = process.env.YANDEX_TRACKER_PROJECT;
  const baseUrl = process.env.YANDEX_TRACKER_BASE_URL || DEFAULT_BASE_URL;

  if (!token) {
    throw makeCliError('Не задан YANDEX_TRACKER_TOKEN');
  }

  if (!orgId && !cloudOrgId) {
    throw makeCliError('Нужно задать YANDEX_TRACKER_ORG_ID или CLOUD_ORG_ID');
  }

  return {
    token,
    orgId,
    cloudOrgId,
    project,
    queue,
    baseUrl
  };
}

function buildHeaders(options: YandexTrackerOptions): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `OAuth ${options.token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'clarity-guardian'
  };

  if (options.orgId) {
    headers['X-Org-ID'] = options.orgId;
  } else if (options.cloudOrgId) {
    headers['X-Cloud-Org-ID'] = options.cloudOrgId;
  }

  return headers;
}

function buildSearchBody(options: YandexTrackerOptions): Record<string, unknown> {
  if (options.keys && options.keys.length > 0) {
    return { keys: options.keys };
  }

  if (options.query) {
    return { query: options.query };
  }

  if (options.queue || options.project) {
    const filter: Record<string, string> = {};

    if (options.queue) {
      filter.queue = options.queue;
    }

    if (options.project) {
      filter.project = options.project;
    }

    return {
      filter,
      order: '-updatedAt'
    };
  }

  throw makeCliError('Для Yandex Tracker нужно задать project, queue, keys или query');
}

export function mapYandexTrackerIssueToTask(issue: YandexTrackerIssue): UnifiedTask {
  const key = normalizeText(issue.key || issue.id);
  const queue = getEntityName(issue.queue);
  const project = getEntityName(issue.project?.primary);
  const tags = Array.isArray(issue.tags) ? issue.tags.map(normalizeText).filter(Boolean) : [];
  const components = Array.isArray(issue.components)
    ? issue.components.map(getEntityName).filter((value): value is string => Boolean(value))
    : [];

  return {
    id: key || `tracker:${normalizeText(issue.summary)}`,
    key: key || undefined,
    source: 'yandex-tracker',
    type: 'issue',
    title: normalizeText(issue.summary),
    body: normalizeText(issue.description),
    url: issue.self,
    projectKey: project || queue,
    queue,
    status: getEntityName(issue.status),
    assignee: getEntityName(issue.assignee),
    author: getEntityName(issue.createdBy || issue.author),
    createdAt: normalizeText(issue.createdAt) || undefined,
    updatedAt: normalizeText(issue.updatedAt) || undefined,
    workItemType: detectTrackerWorkItemType(issue),
    priority: getEntityName(issue.priority),
    tags,
    components
  };
}

export async function fetchYandexTrackerIssues(
  options: YandexTrackerOptions
): Promise<YandexTrackerIssue[]> {
  const baseUrl = options.baseUrl.replace(/\/$/, '');
  const limit = options.limit || 100;
  const response = await fetch(
    `${baseUrl}/v3/issues/_search?fields=${encodeURIComponent(SEARCH_FIELDS)}`,
    {
      method: 'POST',
      headers: buildHeaders(options),
      body: JSON.stringify(buildSearchBody(options))
    }
  );
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`Yandex Tracker API search failed with ${response.status}: ${responseText}`);
  }

  const data = responseText ? JSON.parse(responseText) as unknown : [];
  const issues = Array.isArray(data) ? data : [];

  return issues
    .filter((issue): issue is YandexTrackerIssue =>
      typeof issue === 'object' && issue !== null
    )
    .slice(0, limit);
}

export class YandexTrackerProvider implements TaskProvider {
  constructor(private readonly options: YandexTrackerOptions) {}

  async listTasks(): Promise<UnifiedTask[]> {
    const issues = await fetchYandexTrackerIssues(this.options);

    return issues.map(mapYandexTrackerIssueToTask);
  }
}

export function createYandexTrackerProviderFromEnv(
  overrides: Partial<YandexTrackerOptions> = {}
): YandexTrackerProvider {
  const definedOverrides = Object.fromEntries(
    Object.entries(overrides).filter(([, value]) => value !== undefined)
  ) as Partial<YandexTrackerOptions>;

  return new YandexTrackerProvider({
    ...getTrackerConfigFromEnv(),
    ...definedOverrides
  });
}

function readMockIssues(path: string): YandexTrackerIssue[] {
  const data = readJsonFile<unknown>(path);
  const issues = Array.isArray(data)
    ? data
    : typeof data === 'object' && data !== null && Array.isArray((data as { issues?: unknown[] }).issues)
      ? (data as { issues: unknown[] }).issues
      : [];

  return issues.filter((issue): issue is YandexTrackerIssue =>
    typeof issue === 'object' && issue !== null
  );
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const outputPath = getStringArg(args, 'output') || 'yandex-tracker-tasks.json';
  const mockInputPath = getStringArg(args, 'mock-input');
  const queue = getStringArg(args, 'queue');
  const project = getStringArg(args, 'project');
  const query = getStringArg(args, 'query');
  const keys = getStringArg(args, 'keys');
  const limitArg = getStringArg(args, 'limit');
  const limit = limitArg ? Number(limitArg) : undefined;

  const tasks = mockInputPath
    ? readMockIssues(mockInputPath).map(mapYandexTrackerIssueToTask)
    : await createYandexTrackerProviderFromEnv({
      project,
      queue,
      query,
      keys: keys ? keys.split(',').map((key) => key.trim()).filter(Boolean) : undefined,
      limit
    }).listTasks();

  writeJsonFile(outputPath, tasks);
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
