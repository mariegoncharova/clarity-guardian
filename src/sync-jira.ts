import {
  getBooleanEnv,
  getStringArg,
  makeCliError,
  normalizeText,
  parseArgs,
  readJsonFile,
  readTextFile
} from './utils';

import type {
  AnalysisResult,
  TaskPayload
} from './types';

type AdfNode = {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: AdfNode[];
};

type AdfDoc = {
  type: 'doc';
  version: 1;
  content: AdfNode[];
};

interface JiraIssue {
  key: string;
  fields?: {
    description?: AdfDoc | null;
  };
}

interface JiraComment {
  id: string;
  body?: AdfDoc;
}

interface JiraCommentsResponse {
  comments?: JiraComment[];
  startAt?: number;
  maxResults?: number;
  total?: number;
}

const ANALYSIS_START_MARKER = '[clarity-guardian:analysis:start]';
const ANALYSIS_END_MARKER = '[clarity-guardian:analysis:end]';
const ANALYSIS_COMMENT_MARKER = '[clarity-guardian:analysis-comment]';
const TESTER_CHECKLIST_MARKER = '[clarity-guardian:tester-checklist]';

function getJiraBaseUrl(): string | null {
  const baseUrl = process.env.JIRA_BASE_URL;

  if (!baseUrl) {
    return null;
  }

  return baseUrl.replace(/\/$/, '');
}

function getJiraAuthHeader(): string | null {
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;

  if (!email || !token) {
    return null;
  }

  return `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;
}

function shouldSkipIfUnconfigured(args: Record<string, string | boolean>): boolean {
  return args['skip-if-unconfigured'] === true;
}

async function jiraRequest<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
  } = {}
): Promise<T> {
  const baseUrl = getJiraBaseUrl();
  const authorization = getJiraAuthHeader();

  if (!baseUrl || !authorization) {
    throw makeCliError('Для Jira нужны JIRA_BASE_URL, JIRA_EMAIL и JIRA_API_TOKEN');
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: authorization,
      'Content-Type': 'application/json'
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`Jira API ${options.method || 'GET'} ${path} failed with ${response.status}: ${responseText}`);
  }

  if (!responseText) {
    return undefined as T;
  }

  return JSON.parse(responseText) as T;
}

function isAdfDoc(value: unknown): value is AdfDoc {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (value as AdfDoc).type === 'doc' &&
      Array.isArray((value as AdfDoc).content)
  );
}

function textNode(text: string): AdfNode {
  return {
    type: 'text',
    text
  };
}

function paragraph(text: string): AdfNode {
  return {
    type: 'paragraph',
    content: text ? [textNode(text)] : []
  };
}

function heading(text: string, level: number): AdfNode {
  return {
    type: 'heading',
    attrs: { level },
    content: text ? [textNode(text)] : []
  };
}

function bulletList(items: string[]): AdfNode {
  return {
    type: 'bulletList',
    content: items.map((item) => ({
      type: 'listItem',
      content: [paragraph(item)]
    }))
  };
}

function rule(): AdfNode {
  return { type: 'rule' };
}

function markdownToAdfNodes(markdown: string): AdfNode[] {
  const lines = normalizeText(markdown).split('\n');
  const nodes: AdfNode[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    if (trimmed === '---') {
      nodes.push(rule());
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);

    if (headingMatch) {
      nodes.push(heading(headingMatch[2], headingMatch[1].length));
      continue;
    }

    if (/^- /.test(trimmed)) {
      const items = [trimmed.replace(/^- /, '')];

      while (lines[index + 1]?.trim().match(/^- /)) {
        index += 1;
        items.push(lines[index].trim().replace(/^- /, ''));
      }

      nodes.push(bulletList(items));
      continue;
    }

    nodes.push(paragraph(trimmed));
  }

  return nodes;
}

function adfDocFromMarkdown(markdown: string): AdfDoc {
  return {
    type: 'doc',
    version: 1,
    content: markdownToAdfNodes(markdown)
  };
}

function extractTextFromAdfNode(node: AdfNode): string {
  const ownText = typeof node.text === 'string' ? node.text : '';
  const childText = (node.content || []).map(extractTextFromAdfNode).join('\n');

  return [ownText, childText].filter(Boolean).join('\n');
}

function extractTextFromAdf(doc: AdfDoc | undefined | null): string {
  if (!doc?.content) {
    return '';
  }

  return doc.content.map(extractTextFromAdfNode).join('\n');
}

function nodeIncludesText(node: AdfNode, text: string): boolean {
  return extractTextFromAdfNode(node).includes(text);
}

function withManagedDescriptionBlock(
  description: AdfDoc | undefined | null,
  markdown: string
): AdfDoc {
  const currentContent = isAdfDoc(description) ? [...description.content] : [];
  const block = markdownToAdfNodes([
    ANALYSIS_START_MARKER,
    markdown,
    ANALYSIS_END_MARKER
  ].join('\n'));
  const startIndex = currentContent.findIndex((node) =>
    nodeIncludesText(node, ANALYSIS_START_MARKER)
  );
  const endIndex = currentContent.findIndex((node, index) =>
    index >= startIndex && nodeIncludesText(node, ANALYSIS_END_MARKER)
  );

  if (startIndex >= 0 && endIndex >= startIndex) {
    currentContent.splice(startIndex, endIndex - startIndex + 1, ...block);
    return {
      type: 'doc',
      version: 1,
      content: currentContent
    };
  }

  return {
    type: 'doc',
    version: 1,
    content: [
      ...currentContent,
      ...(currentContent.length > 0 ? [rule()] : []),
      ...block
    ]
  };
}

function findIssueKey(task: TaskPayload, explicitIssueKey?: string): string | null {
  if (explicitIssueKey) {
    return explicitIssueKey;
  }

  if (process.env.JIRA_ISSUE_KEY) {
    return process.env.JIRA_ISSUE_KEY;
  }

  if (task.jiraIssueKey) {
    return task.jiraIssueKey;
  }

  const pattern = process.env.JIRA_ISSUE_KEY_PATTERN || '[A-Z][A-Z0-9]+-\\d+';
  const regex = new RegExp(pattern);
  const searchText = [
    task.title,
    task.body,
    ...(task.labels || []),
    task.htmlUrl,
    task.sourceRef,
    task.baseRef
  ].map((value) => normalizeText(value)).join('\n');
  const match = searchText.match(regex);

  return match ? match[0] : null;
}

async function getIssue(issueKey: string): Promise<JiraIssue> {
  return jiraRequest<JiraIssue>(
    `/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=description`
  );
}

async function updateIssueDescription(
  issueKey: string,
  description: AdfDoc
): Promise<void> {
  await jiraRequest(`/rest/api/3/issue/${encodeURIComponent(issueKey)}`, {
    method: 'PUT',
    body: {
      fields: {
        description
      }
    }
  });

  process.stdout.write(`Updated Jira description for ${issueKey}\n`);
}

async function listComments(issueKey: string): Promise<JiraComment[]> {
  const comments: JiraComment[] = [];
  const maxResults = 100;

  for (let startAt = 0; startAt < 1000; startAt += maxResults) {
    const result = await jiraRequest<JiraCommentsResponse>(
      `/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment?startAt=${startAt}&maxResults=${maxResults}`
    );
    const pageComments = result.comments || [];
    comments.push(...pageComments);

    if (comments.length >= (result.total || 0) || pageComments.length < maxResults) {
      break;
    }
  }

  return comments;
}

async function upsertComment(
  issueKey: string,
  marker: string,
  markdown: string
): Promise<void> {
  const comments = await listComments(issueKey);
  const body = adfDocFromMarkdown([marker, markdown].join('\n'));
  const existingComment = comments.find((comment) =>
    extractTextFromAdf(comment.body).includes(marker)
  );

  if (existingComment) {
    await jiraRequest(
      `/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment/${existingComment.id}`,
      {
        method: 'PUT',
        body: { body }
      }
    );
    process.stdout.write(`Updated Jira comment ${existingComment.id}\n`);
    return;
  }

  const created = await jiraRequest<JiraComment>(
    `/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment`,
    {
      method: 'POST',
      body: { body }
    }
  );

  process.stdout.write(`Created Jira comment ${created.id}\n`);
}

async function syncAnalysis(
  issueKey: string,
  analysis: AnalysisResult,
  analysisCommentMarkdown?: string
): Promise<void> {
  if (getBooleanEnv('JIRA_UPDATE_DESCRIPTION', true)) {
    const issue = await getIssue(issueKey);
    const updatedDescription = withManagedDescriptionBlock(
      issue.fields?.description,
      analysis.descriptionMarkdown
    );
    const currentDescriptionText = extractTextFromAdf(issue.fields?.description);
    const updatedDescriptionText = extractTextFromAdf(updatedDescription);

    if (currentDescriptionText !== updatedDescriptionText) {
      await updateIssueDescription(issueKey, updatedDescription);
    } else {
      process.stdout.write(`Jira description for ${issueKey} is already up to date\n`);
    }
  }

  if (analysisCommentMarkdown) {
    await upsertComment(issueKey, ANALYSIS_COMMENT_MARKER, analysisCommentMarkdown);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const payloadPath = getStringArg(args, 'payload');
  const analysisPath = getStringArg(args, 'analysis');
  const analysisCommentPath = getStringArg(args, 'analysis-comment');
  const checklistCommentPath = getStringArg(args, 'checklist-comment');
  const issueKeyArg = getStringArg(args, 'issue-key');

  if (shouldSkipIfUnconfigured(args) && (!getJiraBaseUrl() || !getJiraAuthHeader())) {
    process.stdout.write('Jira sync skipped: Jira env vars are not configured\n');
    return;
  }

  if (!payloadPath) {
    throw makeCliError('Не передан аргумент --payload');
  }

  const payload = readJsonFile<TaskPayload>(payloadPath);
  const issueKey = findIssueKey(payload, issueKeyArg);

  if (!issueKey) {
    if (shouldSkipIfUnconfigured(args)) {
      process.stdout.write('Jira sync skipped: issue key was not found\n');
      return;
    }

    throw makeCliError('Не найден Jira issue key. Передай --issue-key или JIRA_ISSUE_KEY');
  }

  if (analysisPath) {
    const analysis = readJsonFile<AnalysisResult>(analysisPath);
    const analysisCommentMarkdown = analysisCommentPath
      ? readTextFile(analysisCommentPath)
      : undefined;

    await syncAnalysis(issueKey, analysis, analysisCommentMarkdown);
  }

  if (checklistCommentPath) {
    await upsertComment(
      issueKey,
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
