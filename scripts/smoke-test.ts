import { spawn, spawnSync, type SpawnSyncReturns } from 'node:child_process';
import fs from 'node:fs';
import http, { type RequestListener } from 'node:http';
import { type AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';

interface SmokeOptions {
  env?: NodeJS.ProcessEnv;
  prefix?: string;
}

interface Remark {
  code?: string;
  section?: string;
  phrase?: string;
  level?: string;
}

interface AnalysisSmokeResult {
  hasErrors?: boolean;
  hasWarnings?: boolean;
  language?: string;
  workItemType?: string;
  shouldUpdateDescription?: boolean;
  remarks?: Remark[];
}

interface ChecklistSmokeResult {
  source?: string;
  language?: string;
  workItemType?: string;
}

interface RecordedCall {
  method: string | undefined;
  url: string | undefined;
  body: string;
}

interface AnalyzeOutput {
  result: AnalysisSmokeResult;
  comment: string;
  updatedBody: string;
}

interface ChecklistOutput {
  result: ChecklistSmokeResult;
  comment: string;
}

const rootDir = path.resolve(__dirname, '..');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clarity-smoke-'));

function fail(message: string): never {
  throw new Error(message);
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    fail(message);
  }
}

function writeJson(fileName: string, data: unknown): string {
  const filePath = path.join(tmpDir, fileName);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  return filePath;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function getRemarks(result: AnalysisSmokeResult): Remark[] {
  return Array.isArray(result.remarks) ? result.remarks : [];
}

function runNode(
  args: string[],
  options: SmokeOptions = {}
): SpawnSyncReturns<string> {
  const result = spawnSync(process.execPath, args, {
    cwd: rootDir,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...options.env
    }
  });

  if (result.status !== 0) {
    fail([
      `Command failed: node ${args.join(' ')}`,
      result.stdout,
      result.stderr
    ].filter(Boolean).join('\n'));
  }

  return result;
}

function runNodeAsync(
  args: string[],
  options: SmokeOptions = {}
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: rootDir,
      env: {
        ...process.env,
        ...options.env
      }
    });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (status) => {
      if (status !== 0) {
        reject(new Error([
          `Command failed: node ${args.join(' ')}`,
          stdout,
          stderr
        ].filter(Boolean).join('\n')));
        return;
      }

      resolve({ stdout, stderr });
    });
  });
}

function analyze(
  payload: Record<string, unknown>,
  options: SmokeOptions = {}
): AnalyzeOutput {
  const prefix = options.prefix || `analysis-${Date.now()}`;
  const inputPath = writeJson(`${prefix}-input.json`, payload);
  const resultPath = path.join(tmpDir, `${prefix}-result.json`);
  const commentPath = path.join(tmpDir, `${prefix}-comment.md`);
  const bodyPath = path.join(tmpDir, `${prefix}-body.md`);

  runNode([
    'dist/analyze.js',
    '--input',
    inputPath,
    '--json-file',
    resultPath,
    '--comment-file',
    commentPath,
    '--updated-body-file',
    bodyPath
  ], { env: options.env });

  return {
    result: readJson<AnalysisSmokeResult>(resultPath),
    comment: fs.readFileSync(commentPath, 'utf8'),
    updatedBody: fs.readFileSync(bodyPath, 'utf8')
  };
}

function checklist(
  payload: Record<string, unknown>,
  options: SmokeOptions = {}
): ChecklistOutput {
  const prefix = options.prefix || `checklist-${Date.now()}`;
  const inputPath = writeJson(`${prefix}-input.json`, payload);
  const resultPath = path.join(tmpDir, `${prefix}-result.json`);
  const commentPath = path.join(tmpDir, `${prefix}-comment.md`);

  runNode([
    'dist/generate-test-checklist.js',
    '--input',
    inputPath,
    '--json-file',
    resultPath,
    '--comment-file',
    commentPath
  ], { env: options.env });

  return {
    result: readJson<ChecklistSmokeResult>(resultPath),
    comment: fs.readFileSync(commentPath, 'utf8')
  };
}

function validRussianTask(
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    type: 'issue',
    number: 1,
    repository: 'owner/repo',
    title: 'Проверить оплату после 3DS',
    body: [
      '## Контекст',
      'Оплата картой иногда не завершалась после прохождения 3DS у пользователя в checkout.',
      '',
      '## Ожидаемый результат',
      'После успешного 3DS пользователь возвращается на экран успеха, заказ получает статус paid.',
      '',
      '## Критерии приёмки',
      '- Оплата с 3DS проходит успешно.',
      '- При ошибке банка показывается понятное сообщение.',
      '- Повторная оплата доступна.'
    ].join('\n'),
    labels: [],
    ...extra
  };
}

function validEnglishStory(
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    type: 'issue',
    number: 2,
    repository: 'owner/repo',
    title: 'Story: checkout success page',
    body: [
      '## Context',
      'Users need a clear confirmation after completing a card payment through 3DS.',
      '',
      '## User story',
      'As a buyer, I want to see a success page after payment, so that I know my order is paid.',
      '',
      '## Expected result',
      'After successful 3DS, the buyer returns to the success page and the order status is paid.',
      '',
      '## Acceptance criteria',
      '- The success page is shown after successful 3DS.',
      '- Bank errors show a clear message.',
      '- Retry payment remains available.'
    ].join('\n'),
    labels: ['story'],
    ...extra
  };
}

function smokePrepareEventPayload(): void {
  const eventPath = writeJson('github-event.json', {
    action: 'ready_for_review',
    pull_request: {
      number: 10,
      title: 'CG-123 Story: checkout success page',
      body: validEnglishStory().body,
      labels: [
        { name: 'story' },
        { name: 'ready-for-testing' }
      ],
      draft: false,
      html_url: 'https://github.com/owner/repo/pull/10',
      head: {
        ref: 'CG-123-checkout'
      },
      base: {
        ref: 'main'
      }
    },
    repository: {
      full_name: 'owner/repo'
    }
  });
  const outputPath = path.join(tmpDir, 'prepared-event.json');

  runNode([
    'dist/prepare-event-payload.js',
    '--event',
    eventPath,
    '--event-name',
    'pull_request_target',
    '--output',
    outputPath
  ]);

  const payload = readJson<Record<string, unknown>>(outputPath);

  assert(payload.type === 'pr', 'Prepared payload should detect PR type');
  assert(payload.number === 10, 'Prepared payload should keep item number');
  assert(payload.repository === 'owner/repo', 'Prepared payload should keep repository');
  assert(payload.sourceRef === 'CG-123-checkout', 'Prepared payload should keep source ref');
  assert(Array.isArray(payload.labels), 'Prepared payload should include labels');
  assert(
    (payload.labels as string[]).includes('ready-for-testing'),
    'Prepared payload should normalize label names'
  );
}

function smokeWorkflowOutputs(): void {
  const payloadPath = writeJson('workflow-payload.json', {
    ...validRussianTask(),
    type: 'pr',
    action: 'ready_for_review',
    isDraft: false,
    labels: []
  });
  const analysisPath = writeJson('workflow-analysis.json', {
    hasErrors: true
  });
  const outputPath = path.join(tmpDir, 'github-output.txt');

  runNode([
    'dist/write-workflow-outputs.js',
    '--payload',
    payloadPath,
    '--analysis',
    analysisPath,
    '--github-output',
    outputPath
  ]);

  const output = fs.readFileSync(outputPath, 'utf8');

  assert(output.includes('has_errors=true'), 'Workflow outputs should include has_errors');
  assert(output.includes('is_ready=true'), 'Workflow outputs should include is_ready');
}

async function withServer(
  handler: RequestListener,
  callback: (baseUrl: string) => Promise<void>
): Promise<void> {
  const server = http.createServer(handler);

  await new Promise<void>((resolve) => {
    server.listen({ port: 0, host: '127.0.0.1' }, () => resolve());
  });

  const address = server.address();

  if (!address || typeof address === 'string') {
    fail('Smoke test server did not return a TCP address');
  }

  const port = (address as AddressInfo).port;

  try {
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
}

async function smokeAnalyze() {
  const valid = analyze(validRussianTask(), { prefix: 'valid-ru' });
  assert(valid.result.hasErrors === false, 'Valid Russian task should not have errors');
  assert(valid.result.language === 'ru', 'Valid Russian task should be detected as ru');
  assert(valid.result.workItemType === 'task', 'Valid Russian task should be detected as task');
  assert(
    valid.updatedBody.includes('<!-- clarity-guardian:description:start -->'),
    'Updated body should include GitHub description marker'
  );

  const idempotent = analyze({
    ...validRussianTask(),
    body: valid.updatedBody
  }, { prefix: 'valid-ru-idempotent' });
  assert(
    idempotent.result.shouldUpdateDescription === false,
    'Managed body update should be idempotent'
  );

  const strictBug = analyze(validRussianTask({
    title: 'BUG: оплата не работает',
    labels: ['bug']
  }), { prefix: 'strict-bug' });
  assert(strictBug.result.hasErrors === true, 'Strict bug without bug sections should have errors');
  assert(
    getRemarks(strictBug.result).some((remark) => remark.section === 'Шаги воспроизведения'),
    'Bug rules should require reproduction steps'
  );

  const nonStrictBug = analyze(validRussianTask({
    title: 'BUG: оплата не работает',
    labels: ['bug']
  }), {
    prefix: 'non-strict-bug',
    env: { CLARITY_GUARDIAN_MODE: 'non-strict' }
  });
  assert(nonStrictBug.result.hasErrors === false, 'Non-strict bug should downgrade errors');
  assert(nonStrictBug.result.hasWarnings === true, 'Non-strict bug should keep warnings');

  const stopPhrases = analyze({
    ...validRussianTask(),
    title: 'TBD checkout уточнения',
    body: `${validRussianTask().body}\n\nПотом уточним, как-нибудь сделаем нормально.`
  }, { prefix: 'stop-phrases' });
  const codes = getRemarks(stopPhrases.result).map((remark) => remark.code);
  assert(codes.includes('deferred_context'), 'Project stop phrase should detect deferred context');
  assert(codes.includes('undefined_solution'), 'Project stop phrase should detect undefined solution');
  assert(codes.includes('vague_quality'), 'Project stop phrase should detect vague quality');

  const english = analyze({
    ...validEnglishStory(),
    body: `${validEnglishStory().body}\n\nThis is TBD and we can figure it out later.`
  }, { prefix: 'english-story' });
  assert(english.result.language === 'en', 'English story should be detected as en');
  assert(english.result.workItemType === 'story', 'English story should be detected as story');
  assert(
    getRemarks(english.result).some((remark) => remark.code === 'tbd_requirement'),
    'Uppercase TBD should be detected case-insensitively'
  );

  const englishWithoutFalsePositive = analyze({
    ...validEnglishStory(),
    body: `${validEnglishStory().body}\n\nThe getCustomer endpoint should keep returning payment status.`
  }, { prefix: 'english-no-etc-false-positive' });
  assert(
    !getRemarks(englishWithoutFalsePositive.result).some((remark) => remark.code === 'open_ended_scope'),
    'Short stop phrase "etc" should not match inside another word'
  );
}

async function smokeChecklist() {
  const generated = checklist(validEnglishStory({ labels: ['ready-for-testing', 'story'] }), {
    prefix: 'english-checklist'
  });

  assert(generated.result.source === 'fallback', 'Checklist should use fallback without OPENAI_API_KEY');
  assert(generated.result.language === 'en', 'Checklist should use English language');
  assert(generated.comment.includes('testing checklist'), 'Checklist comment should use English template');
}

async function smokeGitHubSync() {
  const payloadPath = writeJson('github-payload.json', {
    type: 'issue',
    number: 7,
    repository: 'owner/repo'
  });
  const analysisPath = writeJson('github-analysis.json', {
    shouldUpdateDescription: true,
    updatedBody: 'new issue body'
  });
  const commentPath = path.join(tmpDir, 'github-comment.md');
  const calls: RecordedCall[] = [];

  fs.writeFileSync(commentPath, '<!-- clarity-guardian:analysis -->\nnew comment', 'utf8');

  await withServer((request, response) => {
    let body = '';

    request.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });
    request.on('end', () => {
      calls.push({ method: request.method, url: request.url, body });
      response.setHeader('content-type', 'application/json');

      if (request.method === 'PATCH' && request.url === '/repos/owner/repo/issues/7') {
        response.end('{}');
        return;
      }

      if (
        request.method === 'GET' &&
        request.url === '/repos/owner/repo/issues/7/comments?per_page=100&page=1'
      ) {
        response.end(JSON.stringify([
          {
            id: 42,
            body: '<!-- clarity-guardian:analysis -->\nold comment'
          }
        ]));
        return;
      }

      if (request.method === 'PATCH' && request.url === '/repos/owner/repo/issues/comments/42') {
        response.end(JSON.stringify({ id: 42 }));
        return;
      }

      response.statusCode = 404;
      response.end(JSON.stringify({ error: request.url }));
    });
  }, async (baseUrl) => {
    await runNodeAsync([
      'dist/sync-github.js',
      '--payload',
      payloadPath,
      '--analysis',
      analysisPath,
      '--analysis-comment',
      commentPath
    ], {
      env: {
        GITHUB_TOKEN: 'test-token',
        GITHUB_API_URL: baseUrl
      }
    });
  });

  assert(
    calls.some((call) => call.method === 'PATCH' && call.url === '/repos/owner/repo/issues/7'),
    'GitHub sync should update issue body'
  );
  assert(
    calls.some((call) => call.method === 'PATCH' && call.url === '/repos/owner/repo/issues/comments/42'),
    'GitHub sync should update existing bot comment'
  );
  assert(!calls.some((call) => call.method === 'POST'), 'GitHub sync should not duplicate comments');
}

async function smokeJiraSync() {
  const payloadPath = writeJson('jira-payload.json', {
    type: 'issue',
    number: 8,
    repository: 'owner/repo',
    title: 'CG-123 checkout issue'
  });
  const analysisPath = writeJson('jira-analysis.json', {
    descriptionMarkdown: '## Clarity Guardian\n\nOK'
  });
  const commentPath = path.join(tmpDir, 'jira-comment.md');
  const calls: RecordedCall[] = [];

  fs.writeFileSync(commentPath, 'analysis comment', 'utf8');

  await withServer((request, response) => {
    let body = '';

    request.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });
    request.on('end', () => {
      calls.push({ method: request.method, url: request.url, body });
      response.setHeader('content-type', 'application/json');

      if (request.method === 'GET' && request.url === '/rest/api/3/issue/CG-123?fields=description') {
        response.end(JSON.stringify({
          key: 'CG-123',
          fields: {
            description: {
              type: 'doc',
              version: 1,
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Original description' }]
                }
              ]
            }
          }
        }));
        return;
      }

      if (request.method === 'PUT' && request.url === '/rest/api/3/issue/CG-123') {
        response.end('{}');
        return;
      }

      if (
        request.method === 'GET' &&
        request.url === '/rest/api/3/issue/CG-123/comment?startAt=0&maxResults=100'
      ) {
        response.end(JSON.stringify({
          startAt: 0,
          maxResults: 100,
          total: 1,
          comments: [
            {
              id: '55',
              body: {
                type: 'doc',
                version: 1,
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '[clarity-guardian:analysis-comment] old' }]
                  }
                ]
              }
            }
          ]
        }));
        return;
      }

      if (request.method === 'PUT' && request.url === '/rest/api/3/issue/CG-123/comment/55') {
        response.end(JSON.stringify({ id: '55' }));
        return;
      }

      response.statusCode = 404;
      response.end(JSON.stringify({ error: request.url }));
    });
  }, async (baseUrl) => {
    await runNodeAsync([
      'dist/sync-jira.js',
      '--payload',
      payloadPath,
      '--analysis',
      analysisPath,
      '--analysis-comment',
      commentPath
    ], {
      env: {
        JIRA_BASE_URL: baseUrl,
        JIRA_EMAIL: 'test@example.com',
        JIRA_API_TOKEN: 'test-token'
      }
    });
  });

  assert(
    calls.some((call) => call.method === 'PUT' && call.url === '/rest/api/3/issue/CG-123'),
    'Jira sync should update issue description'
  );
  assert(
    calls.some((call) => call.method === 'PUT' && call.url === '/rest/api/3/issue/CG-123/comment/55'),
    'Jira sync should update existing bot comment'
  );
  assert(!calls.some((call) => call.method === 'POST'), 'Jira sync should not duplicate comments');
}

async function smokeJiraSkip() {
  const payloadPath = writeJson('jira-skip-payload.json', validRussianTask());
  const result = runNode([
    'dist/sync-jira.js',
    '--skip-if-unconfigured',
    '--payload',
    payloadPath
  ], {
    env: {
      JIRA_BASE_URL: '',
      JIRA_EMAIL: '',
      JIRA_API_TOKEN: ''
    }
  });

  assert(
    result.stdout.includes('Jira sync skipped'),
    'Jira sync should skip cleanly when env vars are missing'
  );
}

(async () => {
  try {
    smokePrepareEventPayload();
    smokeWorkflowOutputs();
    await smokeAnalyze();
    await smokeChecklist();
    await smokeGitHubSync();
    await smokeJiraSync();
    await smokeJiraSkip();
    console.log('Smoke checks passed');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}); 
