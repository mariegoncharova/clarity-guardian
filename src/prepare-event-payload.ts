import {
  getStringArg,
  makeCliError,
  parseArgs,
  readJsonFile,
  writeJsonFile
} from './utils';

import type {
  TaskPayload,
  TaskType
} from './types';

interface GitHubLabel {
  name?: string;
}

interface GitHubIssueLike {
  number?: number;
  title?: string | null;
  body?: string | null;
  labels?: Array<string | GitHubLabel>;
  draft?: boolean;
  html_url?: string;
  head?: {
    ref?: string;
  };
  base?: {
    ref?: string;
  };
}

interface GitHubEventPayload {
  action?: string;
  issue?: GitHubIssueLike;
  pull_request?: GitHubIssueLike;
  repository?: {
    full_name?: string;
  };
}

function normalizeLabels(labels: Array<string | GitHubLabel> | undefined): string[] {
  return (labels || [])
    .map((label) => {
      if (typeof label === 'string') {
        return label;
      }

      return label.name || '';
    })
    .filter(Boolean);
}

function normalizeEventName(eventName: string | undefined): TaskType {
  if (eventName === 'pull_request_target') {
    return 'pr';
  }

  if (eventName === 'issues') {
    return 'issue';
  }

  throw makeCliError(`Unsupported event payload: ${eventName || 'unknown'}`);
}

export function buildTaskPayload(
  event: GitHubEventPayload,
  eventName: string | undefined
): TaskPayload {
  const type = normalizeEventName(eventName);
  const item = type === 'pr' ? event.pull_request : event.issue;

  if (!item) {
    throw makeCliError(`Unsupported event payload: ${eventName || 'unknown'}`);
  }

  return {
    type,
    number: item.number,
    title: item.title || '',
    body: item.body || '',
    labels: normalizeLabels(item.labels),
    isDraft: Boolean(item.draft),
    action: event.action,
    repository: event.repository?.full_name,
    htmlUrl: item.html_url,
    sourceRef: type === 'pr' ? item.head?.ref || '' : '',
    baseRef: type === 'pr' ? item.base?.ref || '' : ''
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const eventPath = getStringArg(args, 'event') || process.env.GITHUB_EVENT_PATH;
  const eventName = getStringArg(args, 'event-name') || process.env.GITHUB_EVENT_NAME;
  const outputPath = getStringArg(args, 'output') || 'clarity-event.json';

  if (!eventPath) {
    throw makeCliError('Не передан путь к GitHub event payload');
  }

  const event = readJsonFile<GitHubEventPayload>(eventPath);
  const payload = buildTaskPayload(event, eventName);

  writeJsonFile(outputPath, payload);
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
} 
