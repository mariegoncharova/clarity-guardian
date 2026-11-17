import { chmodSync, mkdirSync, mkdtempSync, renameSync, rmSync } from 'node:fs';
import path from 'node:path';
import type { UnifiedTask } from './types';
import { getStringArg, makeCliError, parseArgs, writeJsonFile } from './utils';

type Named = { name: string };
type LinearIssue = {
  id: string; identifier: string; title: string; description?: string; url?: string;
  dueDate?: string; createdAt?: string; updatedAt?: string; completedAt?: string; priorityLabel?: string;
  assignee?: Named; state?: Named & { type: string }; labels?: { nodes: Named[] };
};
type LinearPage = {
  data?: { team?: { key: string; issues: {
    nodes: LinearIssue[]; pageInfo: { hasNextPage: boolean; endCursor?: string }
  } } };
  errors?: unknown[];
};
type GitLabIssue = {
  id: number; iid: number; project_id: number; title: string; description?: string; web_url?: string;
  state: 'opened' | 'closed'; assignee?: Named; author?: Named; labels?: string[];
  due_date?: string; created_at?: string; updated_at?: string; closed_at?: string;
};

const LINEAR_QUERY = `query Backlog($team: String!, $after: String) {
  team(id: $team) {
    key
    issues(first: 50, after: $after) {
      nodes {
        id identifier title description url dueDate createdAt updatedAt completedAt priorityLabel
        state { name type }
        assignee { name }
        labels { nodes { name } }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
}`;

async function request(fetcher: typeof fetch, endpoint: URL | string, init: RequestInit, provider: string) {
  const response = await fetcher(endpoint, { ...init, redirect: 'error', signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw makeCliError(`${provider} вернул HTTP ${response.status}. Проверь доступ к бэклогу.`);
  return response;
}

export async function readLinearTasks(team: string, key: string, fetcher: typeof fetch = fetch): Promise<UnifiedTask[]> {
  const tasks = new Map<string, UnifiedTask>();
  const cursors = new Set<string>();
  let after: string | undefined;

  for (;;) {
    const response = await request(fetcher, 'https://api.linear.app/graphql', {
      method: 'POST',
      headers: { Authorization: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: LINEAR_QUERY, variables: { team, after } })
    }, 'Linear');
    const page = await response.json() as LinearPage;
    const result = page?.data?.team;
    const issues = result?.issues;
    if (page?.errors?.length || !result?.key || !Array.isArray(issues?.nodes) || typeof issues.pageInfo?.hasNextPage !== 'boolean') {
      throw makeCliError('Linear не вернул полный список задач. Проверь ключ команды и доступ API.');
    }

    for (const issue of issues.nodes) {
      if (!issue?.id || !issue.identifier || !issue.title) throw makeCliError('Linear вернул задачу без идентификатора или названия.');
      tasks.set(issue.id, {
        id: issue.id, key: issue.identifier, source: 'linear', projectKey: result.key,
        title: issue.title, body: issue.description || '', url: issue.url,
        status: issue.state?.type === 'completed' ? 'Done' : issue.state?.name,
        assignee: issue.assignee?.name, labels: issue.labels?.nodes.map(({ name }) => name),
        createdAt: issue.createdAt, updatedAt: issue.updatedAt, completedAt: issue.completedAt,
        dueDate: issue.dueDate, priority: issue.priorityLabel
      });
    }

    if (!issues.pageInfo.hasNextPage) return [...tasks.values()];
    const next = issues.pageInfo.endCursor;
    if (!next || cursors.has(next)) throw makeCliError('Linear не вернул следующий курсор. Повтори выгрузку.');
    cursors.add(next);
    after = next;
  }
}

export async function readGitLabTasks(
  project: string,
  token: string,
  host = 'https://gitlab.com',
  fetcher: typeof fetch = fetch
): Promise<UnifiedTask[]> {
  const base = new URL(host);
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) {
    throw makeCliError('Укажи HTTPS-адрес GitLab без учётных данных, параметров и фрагмента.');
  }
  const endpoint = new URL(`${base.pathname.replace(/\/$/, '')}/api/v4/projects/${encodeURIComponent(project)}/issues`, base.origin);
  endpoint.search = new URLSearchParams({ scope: 'all', order_by: 'created_at', sort: 'asc', per_page: '100' }).toString();
  const tasks = new Map<string, UnifiedTask>();

  for (let page = 1; ; page += 1) {
    endpoint.searchParams.set('page', String(page));
    const response = await request(fetcher, endpoint, { headers: { 'PRIVATE-TOKEN': token } }, 'GitLab');
    const issues = await response.json() as GitLabIssue[];
    if (!Array.isArray(issues)) throw makeCliError('GitLab не вернул список задач.');
    const previousCount = tasks.size;
    for (const issue of issues) {
      if (!issue?.id || !issue.iid || !issue.project_id || !issue.title) {
        throw makeCliError('GitLab вернул задачу без идентификатора, проекта или названия.');
      }
      const id = String(issue.id);
      tasks.set(id, {
        id, key: `#${issue.iid}`, source: 'gitlab', projectKey: `${base.host}/${issue.project_id}`,
        title: issue.title, body: issue.description || '', url: issue.web_url,
        repository: issue.web_url?.split('/-/issues/')[0],
        status: issue.state, assignee: issue.assignee?.name, author: issue.author?.name, labels: issue.labels,
        createdAt: issue.created_at, updatedAt: issue.updated_at, completedAt: issue.closed_at, dueDate: issue.due_date
      });
    }
    const next = response.headers.get('x-next-page');
    if (next === '' || (!next && issues.length < 100)) return [...tasks.values()];
    if ((next && Number(next) !== page + 1) || tasks.size === previousCount) {
      throw makeCliError('GitLab не продвинулся к следующей странице. Повтори выгрузку.');
    }
  }
}

export async function loadTrackerBacklog(args: Record<string, string | boolean>): Promise<UnifiedTask[]> {
  if (args.source === 'linear') {
    const team = getStringArg(args, 'team');
    const key = process.env.LINEAR_API_KEY?.trim();
    if (!team || !key) throw makeCliError('Для Linear укажи --team и переменную LINEAR_API_KEY.');
    return readLinearTasks(team, key);
  }
  if (args.source === 'gitlab') {
    const project = getStringArg(args, 'project');
    const token = process.env.GITLAB_TOKEN?.trim();
    if (!project || !token) throw makeCliError('Для GitLab укажи --project и переменную GITLAB_TOKEN.');
    return readGitLabTasks(project, token, getStringArg(args, 'host'));
  }
  throw makeCliError('Укажи --source linear или --source gitlab.');
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const output = path.resolve(getStringArg(args, 'output') || 'data/local/tasks.json');
  const tasks = await loadTrackerBacklog(args);
  mkdirSync(path.dirname(output), { recursive: true });
  const staging = mkdtempSync(path.join(path.dirname(output), '.backlog-'));
  try {
    const draft = path.join(staging, 'tasks.json');
    writeJsonFile(draft, tasks);
    chmodSync(draft, 0o600);
    renameSync(draft, output);
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
  process.stdout.write(`Сохранено задач: ${tasks.length}. ${output}\n`);
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
