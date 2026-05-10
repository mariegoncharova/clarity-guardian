// @ts-check

const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

/**
 * @typedef {{
 *   env?: NodeJS.ProcessEnv;
 *   prefix?: string;
 * }} SmokeOptions
 *
 * @typedef {{
 *   method: string | undefined;
 *   url: string | undefined;
 *   body: string;
 * }} RecordedCall
 *
 * @typedef {{
 *   result: any;
 *   comment: string;
 *   updatedBody: string;
 * }} AnalyzeOutput
 *
 * @typedef {{
 *   result: any;
 *   comment: string;
 * }} ChecklistOutput
 */

const rootDir = path.resolve(__dirname, '..');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clarity-smoke-'));

/**
 * @param {string} message
 * @returns {never}
 */
function fail(message) {
  throw new Error(message);
}

/**
 * @param {boolean} condition
 * @param {string} message
 */
function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

/**
 * @param {string} fileName
 * @param {unknown} data
 * @returns {string}
 */
function writeJson(fileName, data) {
  const filePath = path.join(tmpDir, fileName);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  return filePath;
}

/**
 * @param {string} filePath
 * @returns {any}
 */
function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * @param {any} result
 * @returns {{ code?: string; section?: string; phrase?: string; level?: string }[]}
 */
function getRemarks(result) {
  return Array.isArray(result.remarks) ? result.remarks : [];
}

/**
 * @param {string[]} args
 * @param {SmokeOptions} [options]
 * @returns {import('node:child_process').SpawnSyncReturns<string>}
 */
function runNode(args, options = {}) {
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

/**
 * @param {string[]} args
 * @param {SmokeOptions} [options]
 * @returns {Promise<{ stdout: string; stderr: string }>}
 */
function runNodeAsync(args, options = {}) {
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

    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
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

/**
 * @param {Record<string, unknown>} payload
 * @param {SmokeOptions} [options]
 * @returns {AnalyzeOutput}
 */
function analyze(payload, options = {}) {
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
    result: readJson(resultPath),
    comment: fs.readFileSync(commentPath, 'utf8'),
    updatedBody: fs.readFileSync(bodyPath, 'utf8')
  };
}

/**
 * @param {Record<string, unknown>} payload
 * @param {SmokeOptions} [options]
 * @returns {ChecklistOutput}
 */
function checklist(payload, options = {}) {
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
    result: readJson(resultPath),
    comment: fs.readFileSync(commentPath, 'utf8')
  };
}

/**
 * @param {Record<string, unknown>} [extra]
 * @returns {Record<string, unknown>}
 */
function validRussianTask(extra = {}) {
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

/**
 * @param {Record<string, unknown>} [extra]
 * @returns {Record<string, unknown>}
 */
function validEnglishStory(extra = {}) {
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

/**
 * @param {import('node:http').RequestListener} handler
 * @param {(baseUrl: string) => Promise<void>} callback
 * @returns {Promise<void>}
 */
async function withServer(handler, callback) {
  const server = http.createServer(handler);

  await new Promise((resolve) => {
    server.listen({ port: 0, host: '127.0.0.1' }, () => resolve(undefined));
  });

  const address = server.address();

  if (!address || typeof address === 'string') {
    fail('Smoke test server did not return a TCP address');
  }

  const port = /** @type {import('node:net').AddressInfo} */ (address).port;

  try {
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
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
  /** @type {RecordedCall[]} */
  const calls = [];

  fs.writeFileSync(commentPath, '<!-- clarity-guardian:analysis -->\nnew comment', 'utf8');

  await withServer((request, response) => {
    let body = '';

    request.on('data', (chunk) => {
      body += chunk;
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
  /** @type {RecordedCall[]} */
  const calls = [];

  fs.writeFileSync(commentPath, 'analysis comment', 'utf8');

  await withServer((request, response) => {
    let body = '';

    request.on('data', (chunk) => {
      body += chunk;
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
