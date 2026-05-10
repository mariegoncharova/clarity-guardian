import {
  getStringArg,
  makeCliError,
  parseArgs,
  readJsonFile,
  readTextFile
} from './utils';
 
import type {
  AnalysisResult,
  TaskPayload
} from './types';

interface GitHubComment {
  id: number;
  body?: string;
}

const ANALYSIS_MARKER = '<!-- clarity-guardian:analysis -->';
const TESTER_CHECKLIST_MARKER = '<!-- clarity-guardian:tester-checklist -->';

function getToken(): string {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

  if (!token) {
    throw makeCliError('Не задан GITHUB_TOKEN или GH_TOKEN для синхронизации с GitHub');
  }

  return token;
}

function getApiBase(): string {
  return (process.env.GITHUB_API_URL || 'https://api.github.com').replace(/\/$/, '');
}

async function githubRequest<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
  } = {}
): Promise<T> {
  const response = await fetch(`${getApiBase()}${path}`, {
    method: options.method || 'GET',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'clarity-guardian'
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`GitHub API ${options.method || 'GET'} ${path} failed with ${response.status}: ${responseText}`);
  }

  if (!responseText) {
    return undefined as T;
  }

  return JSON.parse(responseText) as T;
}

function validatePayload(payload: TaskPayload): asserts payload is TaskPayload & {
  number: number;
  repository: string;
} {
  if (!payload.repository) {
    throw makeCliError('В payload нет repository');
  }

  if (typeof payload.number !== 'number') {
    throw makeCliError('В payload нет number');
  }
}

async function listComments(repository: string, itemNumber: number): Promise<GitHubComment[]> {
  const comments: GitHubComment[] = [];

  for (let page = 1; page <= 10; page += 1) {
    const pageComments = await githubRequest<GitHubComment[]>(
      `/repos/${repository}/issues/${itemNumber}/comments?per_page=100&page=${page}`
    );

    comments.push(...pageComments);

    if (pageComments.length < 100) {
      break;
    }
  }

  return comments;
}

async function upsertComment(
  repository: string,
  itemNumber: number,
  marker: string,
  body: string
): Promise<void> {
  const comments = await listComments(repository, itemNumber);
  const existingComment = comments.find((comment) => comment.body?.includes(marker));

  if (existingComment) {
    await githubRequest(`/repos/${repository}/issues/comments/${existingComment.id}`, {
      method: 'PATCH',
      body: { body }
    });
    process.stdout.write(`Updated GitHub comment ${existingComment.id}\n`);
    return;
  }

  const created = await githubRequest<GitHubComment>(
    `/repos/${repository}/issues/${itemNumber}/comments`,
    {
      method: 'POST',
      body: { body }
    }
  );

  process.stdout.write(`Created GitHub comment ${created.id}\n`);
}

async function updateDescription(
  payload: TaskPayload & {
    number: number;
    repository: string;
  },
  analysis: AnalysisResult
): Promise<void> {
  if (!analysis.shouldUpdateDescription) {
    process.stdout.write('GitHub description is already up to date\n');
    return;
  }

  const endpoint = payload.type === 'pr'
    ? `/repos/${payload.repository}/pulls/${payload.number}`
    : `/repos/${payload.repository}/issues/${payload.number}`;

  await githubRequest(endpoint, {
    method: 'PATCH',
    body: { body: analysis.updatedBody }
  });

  process.stdout.write('Updated GitHub description\n');
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const payloadPath = getStringArg(args, 'payload');
  const analysisPath = getStringArg(args, 'analysis');
  const analysisCommentPath = getStringArg(args, 'analysis-comment');
  const checklistCommentPath = getStringArg(args, 'checklist-comment');

  if (!payloadPath) {
    throw makeCliError('Не передан аргумент --payload');
  }

  const payload = readJsonFile<TaskPayload>(payloadPath);
  validatePayload(payload);

  if (analysisPath) {
    const analysis = readJsonFile<AnalysisResult>(analysisPath);
    await updateDescription(payload, analysis);
  }

  if (analysisCommentPath) {
    await upsertComment(
      payload.repository,
      payload.number,
      ANALYSIS_MARKER,
      readTextFile(analysisCommentPath)
    );
  }

  if (checklistCommentPath) {
    await upsertComment(
      payload.repository,
      payload.number,
      TESTER_CHECKLIST_MARKER,
      readTextFile(checklistCommentPath)
    );
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
