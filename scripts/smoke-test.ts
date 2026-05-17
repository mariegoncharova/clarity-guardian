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
  toneOfVoice?: {
    tone?: string;
    riskLevel?: string;
    categories?: string[];
  };
  clarityFixSuggestions?: {
    questions?: string[];
    draftMarkdown?: string;
    pmFriendlyRewrite?: string;
    nextActions?: string[];
  };
}

interface ChecklistSmokeResult {
  source?: string;
  language?: string;
  workItemType?: string;
}

interface DashboardSmokeResult {
  totalTasks?: number;
  averageScore?: number;
  quality?: {
    good?: number;
    medium?: number;
    poor?: number;
  };
  topProblems?: Array<{
    name?: string;
    count?: number;
  }>;
  lowestScoreTasks?: Array<{
    score?: number;
  }>;
  trendByWeek?: Array<{
    name?: string;
    count?: number;
  }>;
}

interface BeforeAfterSmokeResult {
  before?: {
    averageScore?: number;
    lowQualityTasks?: number;
  };
  after?: {
    averageScore?: number;
    lowQualityTasks?: number;
  };
  delta?: {
    averageScore?: number;
    lowQualityTasks?: number;
    missingAcceptanceCriteria?: number;
    missingContext?: number;
    qaReturns?: number;
  };
}

interface RetroTaskSmokeResult {
  taskId?: string;
  title?: string;
  clarityScore?: number;
  leadTime?: {
    days?: number;
  };
  cycleTime?: {
    days?: number;
  };
  timeInStatus?: Array<{
    status?: string;
    days?: number;
  }>;
  isReopened?: boolean;
  isStuck?: boolean;
  mainDelayReason?: string;
  bottleneckStatus?: string;
}

interface RetroSmokeReport {
  summary?: {
    totalTasksAnalyzed?: number;
    averageClarityScore?: number;
    averageLeadTimeDays?: number;
    averageCycleTimeDays?: number;
    returnedFromTesting?: number;
    stuckTasks?: number;
    mainBottleneck?: string;
    mainDelayReason?: string;
  };
  bottlenecks?: Array<{
    status?: string;
    averageDays?: number;
    stuckTaskCount?: number;
  }>;
  longest_tasks?: RetroTaskSmokeResult[];
  reopened_tasks?: RetroTaskSmokeResult[];
  delay_reasons?: Array<{
    reason?: string;
    count?: number;
  }>;
  clarity_vs_cycle_time?: Array<{
    group?: string;
    taskCount?: number;
    averageCycleTimeDays?: number;
  }>;
  task_level_analytics?: RetroTaskSmokeResult[];
}

interface RiskSmokeReport {
  summary?: {
    totalTasks?: number;
    highRiskTasks?: number;
    mediumRiskTasks?: number;
    lowRiskTasks?: number;
  };
  taskLevelAnalytics?: Array<{
    taskId?: string;
    riskLevel?: string;
    riskScore?: number;
    riskFactors?: string[];
  }>;
}

interface ReadinessSmokeReport {
  summary?: {
    totalTasks?: number;
    dorPassed?: number;
    dodPassed?: number;
  };
  taskLevelAnalytics?: Array<{
    taskId?: string;
    dor?: {
      dorPassed?: boolean;
      dorScore?: number;
      failedChecks?: string[];
    };
    dod?: {
      dodPassed?: boolean;
      dodScore?: number;
      failedChecks?: string[];
    };
  }>;
}

interface SprintHealthSmokeReport {
  sprint?: string;
  sprintHealthStatus?: string;
  summary?: {
    totalTasks?: number;
    averageClarityScore?: number;
    averageRiskScore?: number;
    readyTasksCount?: number;
    notReadyTasksCount?: number;
    readyTasksPercent?: number;
    highRiskTasksCount?: number;
    mediumRiskTasksCount?: number;
    lowRiskTasksCount?: number;
    tasksWithoutAcceptanceCriteria?: number;
    tasksWithoutExpectedResult?: number;
    tasksWithExternalDependencies?: number;
    largeScopeTasks?: number;
    reopenedTasks?: number;
    stuckTasks?: number;
  };
  riskDistribution?: {
    high?: number;
    medium?: number;
    low?: number;
  };
  recommendations?: string[];
}

interface QualityGateSmokeReport {
  passed?: boolean;
  failedChecks?: Array<{
    code?: string;
  }>;
  summary?: {
    totalTasks?: number;
    highRiskTasksPercent?: number;
    readyTasksPercent?: number;
  };
}

interface ActionPlanSmokeReport {
  totalTasks?: number;
  includedTasks?: number;
  items?: Array<{
    taskId?: string;
    priorityScore?: number;
    questions?: string[];
    nextActions?: string[];
  }>;
}

interface UnifiedTaskSmokeResult {
  id?: string;
  source?: string;
  title?: string;
  body?: string;
  status?: string;
  assignee?: string;
  author?: string;
  workItemType?: string;
  tags?: string[];
  components?: string[];
}

interface RecordedCall {
  method: string | undefined;
  url: string | undefined;
  body: string;
  headers?: http.IncomingHttpHeaders;
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

function smokeDockerConfiguration(): void {
  const dockerfile = fs.readFileSync(path.join(rootDir, 'Dockerfile'), 'utf8');
  const dockerignore = fs.readFileSync(path.join(rootDir, '.dockerignore'), 'utf8');

  assert(
    dockerfile.includes('tsconfig.build.json'),
    'Dockerfile should copy tsconfig.build.json for npm run build'
  );
  assert(
    dockerignore.includes('node_modules') && dockerignore.includes('dist'),
    '.dockerignore should exclude local install and build artifacts'
  );
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
  assert(valid.result.toneOfVoice?.tone === 'constructive', 'Valid Russian task should include constructive tone analysis');
  assert(
    valid.result.clarityFixSuggestions?.questions?.length === 0,
    'Valid Russian task should not require clarity fix questions'
  );
  assert(
    Boolean(valid.comment.includes('Clarity Fix Suggestions')),
    'Analysis comment should include clarity fix suggestions section'
  );
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
  assert(
    Boolean(stopPhrases.result.toneOfVoice?.categories?.includes('vague_wording')),
    'Tone of Voice Analyzer should detect vague wording in analysis output'
  );
  assert(stopPhrases.comment.includes('Tone of Voice Analyzer'), 'Analysis comment should include tone section');
  assert(
    Boolean(stopPhrases.result.clarityFixSuggestions?.questions?.length),
    'Unclear task should include clarity fix questions'
  );
  assert(
    Boolean(stopPhrases.result.clarityFixSuggestions?.draftMarkdown?.includes('## Контекст')),
    'Clarity fix suggestions should include draft markdown sections'
  );

  const titleOnlyStopPhrase = analyze({
    ...validRussianTask(),
    title: 'Потом уточним оплату после 3DS'
  }, { prefix: 'title-only-stop-phrase' });
  assert(
    getRemarks(titleOnlyStopPhrase.result).some((remark) => remark.code === 'deferred_context'),
    'Stop phrases should be detected in task title'
  );

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

function smokeYandexTrackerMockInput(): void {
  const rawPath = writeJson('yandex-raw.json', [
    {
      key: 'CG-301',
      summary: 'Bug: checkout payment error',
      description: '## Context\nPayment fails for buyers.\n\n## Expected result\nBuyer sees a retryable error.\n\n## Acceptance criteria\n- Error is visible.',
      status: { display: 'Open' },
      assignee: { display: 'Anna QA' },
      createdBy: { display: 'Maria PM' },
      type: { key: 'bug', display: 'Bug' },
      priority: { display: 'High' },
      tags: ['payment']
    },
    {
      key: 'CG-302',
      summary: 'Task without optional fields'
    }
  ]);
  const outputPath = path.join(tmpDir, 'yandex-tasks.json');

  runNode([
    'dist/yandex-tracker.js',
    '--mock-input',
    rawPath,
    '--output',
    outputPath
  ]);

  const tasks = readJson<UnifiedTaskSmokeResult[]>(outputPath);

  assert(tasks.length === 2, 'Yandex Tracker mock input should produce two tasks');
  assert(tasks[0].source === 'yandex-tracker', 'Yandex tasks should use tracker source');
  assert(tasks[0].workItemType === 'bug', 'Yandex adapter should map tracker issue type');
  assert(tasks[0].assignee === 'Anna QA', 'Yandex adapter should map assignee');
  assert(Array.isArray(tasks[1].tags), 'Yandex adapter should fallback missing tags to an array');
}

async function smokeYandexTrackerApi(): Promise<void> {
  const outputPath = path.join(tmpDir, 'yandex-api-tasks.json');
  const calls: RecordedCall[] = [];

  await withServer((request, response) => {
    let body = '';

    request.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });
    request.on('end', () => {
      calls.push({
        method: request.method,
        url: request.url,
        body,
        headers: request.headers
      });
      response.setHeader('content-type', 'application/json');

      if (
        request.method === 'POST' &&
        request.url?.startsWith('/v3/issues/_search?fields=')
      ) {
        response.end(JSON.stringify([
          {
            key: 'CG-401',
            summary: 'Tracker task from API',
            description: '## Context\nAPI task.\n\n## Expected result\nTask is imported.\n\n## Acceptance criteria\n- Import works.',
            queue: { key: 'CG' },
            status: { display: 'Open' }
          }
        ]));
        return;
      }

      response.statusCode = 404;
      response.end(JSON.stringify({ error: request.url }));
    });
  }, async (baseUrl) => {
    await runNodeAsync([
      'dist/yandex-tracker.js',
      '--output',
      outputPath
    ], {
      env: {
        YANDEX_TRACKER_TOKEN: 'tracker-token',
        YANDEX_TRACKER_ORG_ID: 'org-1',
        YANDEX_TRACKER_QUEUE: 'CG',
        YANDEX_TRACKER_BASE_URL: baseUrl
      }
    });
  });

  const tasks = readJson<UnifiedTaskSmokeResult[]>(outputPath);
  const searchCall = calls.find((call) => call.method === 'POST');

  assert(tasks.length === 1, 'Yandex Tracker API adapter should write fetched tasks');
  assert(searchCall?.headers?.authorization === 'OAuth tracker-token', 'Yandex request should use OAuth token');
  assert(searchCall?.headers?.['x-org-id'] === 'org-1', 'Yandex request should send organization header');
  assert(Boolean(searchCall?.body.includes('"queue":"CG"')), 'Yandex request should search by queue');
}

function smokeV2Reports(): void {
  const outDir = path.join(tmpDir, 'v2-report');

  runNode([
    'dist/v2-report.js',
    '--demo',
    '--out-dir',
    outDir,
    '--analyzed-at',
    '2026-05-12T00:00:00.000Z'
  ]);

  const dashboard = readJson<DashboardSmokeResult>(path.join(outDir, 'dashboard.json'));
  const comparison = readJson<BeforeAfterSmokeResult>(path.join(outDir, 'before-after.json'));
  const history = fs.readFileSync(path.join(outDir, 'clarity-history.jsonl'), 'utf8').trim().split('\n');
  const retro = fs.readFileSync(path.join(outDir, 'retro-report.md'), 'utf8');
  const research = fs.readFileSync(path.join(outDir, 'research-report.md'), 'utf8');
  const csv = fs.readFileSync(path.join(outDir, 'tasks.csv'), 'utf8');
  const html = fs.readFileSync(path.join(outDir, 'dashboard.html'), 'utf8');
  const taskHistory = readJson<Record<string, unknown>>(path.join(outDir, 'task-history.json'));

  assert(dashboard.totalTasks === 8, 'V2 demo dashboard should analyze demo tasks');
  assert((dashboard.averageScore || 0) > 0, 'V2 dashboard should calculate average score');
  assert((dashboard.quality?.good || 0) > 0, 'V2 dashboard should include good tasks');
  assert((dashboard.quality?.medium || 0) > 0, 'V2 dashboard should include medium tasks');
  assert((dashboard.quality?.poor || 0) > 0, 'V2 dashboard should include poor tasks');
  assert((dashboard.topProblems || []).length > 0, 'V2 dashboard should include top problems');
  assert((dashboard.trendByWeek || []).length > 0, 'V2 dashboard should include weekly trend');
  assert((comparison.delta?.averageScore || 0) > 0, 'Before/after comparison should show demo improvement');
  assert((comparison.delta?.lowQualityTasks || 0) < 0, 'Before/after comparison should reduce low-quality tasks');
  assert(history.length === 8, 'History JSONL should include one row per task');
  assert(Boolean(taskHistory['demo-before-1']), 'Task score history should be grouped by task');
  assert(retro.includes('Clarity Guardian Retro Report'), 'Retro markdown should be generated');
  assert(research.includes('может указывать на корреляцию'), 'Research report should use careful wording');
  assert(csv.startsWith('id,key,source,title'), 'CSV export should include a header row');
  assert(html.includes('Clarity Guardian Dashboard'), 'Dashboard HTML should be generated');
}

function smokeRetroAnalytics(): void {
  const jsonPath = path.join(tmpDir, 'retro-report.json');
  const markdownPath = path.join(tmpDir, 'retro-report.md');
  const csvPath = path.join(tmpDir, 'retro-report.csv');

  runNode([
    'dist/retro-report.js',
    '--input',
    'data/demo_tasks.json',
    '--output',
    jsonPath,
    '--format',
    'json'
  ]);
  runNode([
    'dist/retro-report.js',
    '--input',
    'data/demo_tasks.json',
    '--output',
    markdownPath,
    '--format',
    'markdown'
  ]);
  runNode([
    'dist/retro-report.js',
    '--input',
    'data/demo_tasks.json',
    '--output',
    csvPath,
    '--format',
    'csv'
  ]);

  const report = readJson<RetroSmokeReport>(jsonPath);
  const markdown = fs.readFileSync(markdownPath, 'utf8');
  const csv = fs.readFileSync(csvPath, 'utf8');
  const task101 = report.task_level_analytics?.find((task) => task.taskId === 'RETRO-101');
  const task105 = report.task_level_analytics?.find((task) => task.taskId === 'RETRO-105');
  const task107 = report.task_level_analytics?.find((task) => task.taskId === 'RETRO-107');
  const inProgressTime = task101?.timeInStatus?.find((entry) => entry.status === 'In Progress');
  const testingReturn = report.delay_reasons?.find((reason) => reason.reason === 'testing_return');
  const lowScoreGroup = report.clarity_vs_cycle_time?.find((group) => group.group === 'score_lt_60');
  const highScoreGroup = report.clarity_vs_cycle_time?.find((group) => group.group === 'score_gte_80');

  assert(report.summary?.totalTasksAnalyzed === 12, 'Retro report should analyze demo tasks');
  assert(report.summary?.mainBottleneck === 'In Progress', 'Retro report should detect main bottleneck status');
  assert(report.summary?.returnedFromTesting === 3, 'Retro report should count returned tasks');
  assert(report.summary?.stuckTasks === 5, 'Retro report should count stuck tasks');
  assert(task101?.leadTime?.days === 9.3, 'Retro report should calculate lead time');
  assert(task101?.cycleTime?.days === 8.3, 'Retro report should calculate cycle time');
  assert(inProgressTime?.days === 5.1, 'Retro report should calculate time in status');
  assert(task105?.isStuck === true, 'Retro report should detect stuck task');
  assert(task105?.bottleneckStatus === 'In Progress', 'Retro report should detect task bottleneck status');
  assert(task107?.isReopened === true, 'Retro report should detect returned task after Testing');
  assert(testingReturn?.count === 3, 'Retro report should classify testing return reasons');
  assert(lowScoreGroup?.averageCycleTimeDays === 8.6, 'Retro report should group low clarity cycle time');
  assert(highScoreGroup?.averageCycleTimeDays === 2.4, 'Retro report should group high clarity cycle time');
  assert(markdown.includes('Retro Report: анализ качества задач'), 'Retro markdown report should be generated');
  assert(markdown.includes('Рекомендации для следующего спринта'), 'Retro markdown should include recommendations');
  assert(csv.startsWith('task_id,title,source,assignee'), 'Retro CSV should include task-level header');

  const clarityDemoOutDir = path.join(tmpDir, 'clarity-demo-tasks-report');

  runNode([
    'dist/v2-report.js',
    '--input',
    'data/demo_tasks.json',
    '--out-dir',
    clarityDemoOutDir
  ]);

  const clarityDemoDashboard = readJson<DashboardSmokeResult>(
    path.join(clarityDemoOutDir, 'dashboard.json')
  );
  assert((clarityDemoDashboard.averageScore || 0) > 0, 'Retro demo data should produce non-zero Clarity Score');
  assert((clarityDemoDashboard.quality?.good || 0) > 0, 'Retro demo data should include good clarity tasks');
  assert((clarityDemoDashboard.quality?.poor || 0) > 0, 'Retro demo data should include low clarity tasks');

  const edgeInputPath = writeJson('retro-edge-cases.json', [
    {
      id: 'EDGE|1',
      title: 'Задача без завершения | и исполнителя',
      source: 'file',
      created_at: '2026-05-01T10:00:00Z',
      updated_at: '2026-05-03T10:00:00Z',
      clarity_score: 59,
      status_history: [
        { status: 'In Progress', entered_at: '2026-05-01T10:00:00Z', left_at: null }
      ]
    },
    {
      id: 'EDGE-2',
      title: 'Задача без истории статусов',
      source: 'file',
      created_at: 'bad-date',
      updated_at: '2026-05-02T10:00:00Z',
      clarity_score: 82,
      comments: [],
      labels: []
    }
  ]);
  const nestedMarkdownPath = path.join(tmpDir, 'nested', 'reports', 'retro-edge.md');
  const edgeJsonPath = path.join(tmpDir, 'retro-edge.json');

  runNode([
    'dist/retro-report.js',
    '--input',
    edgeInputPath,
    '--output',
    nestedMarkdownPath
  ]);
  runNode([
    'dist/retro-report.js',
    '--input',
    edgeInputPath,
    '--output',
    edgeJsonPath,
    '--format',
    'json'
  ]);

  const edgeReport = readJson<RetroSmokeReport>(edgeJsonPath);
  const edgeMarkdown = fs.readFileSync(nestedMarkdownPath, 'utf8');
  assert(edgeReport.summary?.totalTasksAnalyzed === 2, 'Retro report should handle incomplete tasks');
  assert(fs.existsSync(nestedMarkdownPath), 'Retro CLI should create nested output directory');
  assert(
    edgeMarkdown.includes('EDGE\\|1') && edgeMarkdown.includes('Задача без завершения \\| и исполнителя'),
    'Retro markdown should escape pipe characters in table cells'
  );

  const emptyInputPath = writeJson('retro-empty.json', []);
  const emptyJsonPath = path.join(tmpDir, 'retro-empty.json');

  runNode([
    'dist/retro-report.js',
    '--input',
    emptyInputPath,
    '--output',
    emptyJsonPath,
    '--format',
    'json'
  ]);

  const emptyReport = readJson<RetroSmokeReport>(emptyJsonPath);
  assert(emptyReport.summary?.totalTasksAnalyzed === 0, 'Retro report should handle empty task list');

  const invalidFormat = spawnSync(process.execPath, [
    'dist/retro-report.js',
    '--input',
    'data/demo_tasks.json',
    '--output',
    path.join(tmpDir, 'retro.xml'),
    '--format',
    'xml'
  ], {
    cwd: rootDir,
    encoding: 'utf8'
  });

  assert(invalidFormat.status !== 0, 'Retro CLI should reject unknown report format');
  assert(
    invalidFormat.stderr.includes('Неподдерживаемый формат отчёта'),
    'Retro CLI should explain unknown report format'
  );

  const invalidJsonPath = path.join(tmpDir, 'broken.json');
  fs.writeFileSync(invalidJsonPath, '{', 'utf8');
  const invalidJson = spawnSync(process.execPath, [
    'dist/retro-report.js',
    '--input',
    invalidJsonPath,
    '--output',
    path.join(tmpDir, 'broken.md')
  ], {
    cwd: rootDir,
    encoding: 'utf8'
  });

  assert(invalidJson.status !== 0, 'Retro CLI should fail on invalid JSON');
  assert(
    invalidJson.stderr.includes('Некорректный JSON'),
    'Retro CLI should explain invalid JSON'
  );
}

function smokeRiskReadinessSprintHealth(): void {
  const riskMarkdownPath = path.join(tmpDir, 'risk-report.md');
  const riskJsonPath = path.join(tmpDir, 'risk-report.json');
  const riskEqualsJsonPath = path.join(tmpDir, 'risk-report-equals.json');
  const readinessMarkdownPath = path.join(tmpDir, 'readiness-report.md');
  const readinessJsonPath = path.join(tmpDir, 'readiness-report.json');
  const sprintMarkdownPath = path.join(tmpDir, 'sprint-health.md');
  const sprintJsonPath = path.join(tmpDir, 'sprint-health.json');
  const sprintCsvPath = path.join(tmpDir, 'sprint-health.csv');

  runNode([
    'dist/risk-report.js',
    '--input',
    'data/demo_tasks.json',
    '--output',
    riskMarkdownPath
  ]);
  runNode([
    'dist/risk-report.js',
    '--input',
    'data/demo_tasks.json',
    '--output',
    riskJsonPath,
    '--format',
    'json'
  ]);
  runNode([
    'dist/risk-report.js',
    '--input=data/demo_tasks.json',
    `--output=${riskEqualsJsonPath}`,
    '--format=json'
  ]);
  runNode([
    'dist/readiness-report.js',
    '--input',
    'data/demo_tasks.json',
    '--output',
    readinessMarkdownPath
  ]);
  runNode([
    'dist/readiness-report.js',
    '--input',
    'data/demo_tasks.json',
    '--output',
    readinessJsonPath,
    '--format',
    'json'
  ]);
  runNode([
    'dist/sprint-health-report.js',
    '--input',
    'data/demo_tasks.json',
    '--output',
    sprintMarkdownPath
  ]);
  runNode([
    'dist/sprint-health-report.js',
    '--input',
    'data/demo_tasks.json',
    '--output',
    sprintJsonPath,
    '--format',
    'json'
  ]);
  runNode([
    'dist/sprint-health-report.js',
    '--input',
    'data/demo_tasks.json',
    '--output',
    sprintCsvPath,
    '--format',
    'csv'
  ]);

  const risk = readJson<RiskSmokeReport>(riskJsonPath);
  const riskFromEqualsArgs = readJson<RiskSmokeReport>(riskEqualsJsonPath);
  const readiness = readJson<ReadinessSmokeReport>(readinessJsonPath);
  const sprint = readJson<SprintHealthSmokeReport>(sprintJsonPath);
  const riskMarkdown = fs.readFileSync(riskMarkdownPath, 'utf8');
  const readinessMarkdown = fs.readFileSync(readinessMarkdownPath, 'utf8');
  const sprintMarkdown = fs.readFileSync(sprintMarkdownPath, 'utf8');
  const sprintCsv = fs.readFileSync(sprintCsvPath, 'utf8');
  const task101Risk = risk.taskLevelAnalytics?.find((task) => task.taskId === 'RETRO-101');
  const task102Risk = risk.taskLevelAnalytics?.find((task) => task.taskId === 'RETRO-102');
  const task105Readiness = readiness.taskLevelAnalytics?.find((task) => task.taskId === 'RETRO-105');
  const task102Readiness = readiness.taskLevelAnalytics?.find((task) => task.taskId === 'RETRO-102');
  const task111Readiness = readiness.taskLevelAnalytics?.find((task) => task.taskId === 'RETRO-111');

  assert(risk.summary?.totalTasks === 12, 'Risk report should analyze demo tasks');
  assert(riskFromEqualsArgs.summary?.totalTasks === 12, 'Risk CLI should accept --key=value arguments');
  assert(risk.summary?.highRiskTasks === 3, 'Risk report should count high-risk tasks');
  assert(task101Risk?.riskLevel === 'high', 'Risk detection should mark low clarity payment task as high risk');
  assert((task101Risk?.riskScore || 0) >= 61, 'Risk score should promote low clarity tasks to high risk');
  assert(task102Risk?.riskLevel === 'low', 'Risk detection should keep clear task low risk');
  assert(
    (risk.taskLevelAnalytics || []).every((task) => (task.riskScore || 0) <= 100),
    'Risk score should be capped at 100'
  );
  assert(riskMarkdown.includes('Risk Detection Report'), 'Risk markdown report should be generated');

  assert(readiness.summary?.dorPassed === 9, 'Readiness report should count DoR passed tasks');
  assert(readiness.summary?.dodPassed === 4, 'Readiness report should count DoD passed tasks');
  assert(task102Readiness?.dor?.dorPassed === true, 'Good task should pass DoR');
  assert(task105Readiness?.dor?.dorPassed === false, 'Task without acceptance criteria should fail DoR');
  assert(Boolean(task105Readiness?.dor?.failedChecks?.includes('Есть критерии приёмки')), 'DoR should explain missing acceptance criteria');
  assert(task111Readiness?.dod?.dodPassed === false, 'Done task without testing signal should fail DoD');
  assert(readinessMarkdown.includes('Definition of Ready'), 'Readiness markdown should include DoR section');

  assert(sprint.sprintHealthStatus === 'yellow', 'Sprint health should classify demo sprint as yellow');
  assert(sprint.summary?.readyTasksPercent === 75, 'Sprint health should calculate ready percent');
  assert(sprint.summary?.highRiskTasksCount === 3, 'Sprint health should count high-risk tasks');
  assert(sprint.summary?.tasksWithoutAcceptanceCriteria === 3, 'Sprint health should count missing acceptance criteria');
  assert(sprint.summary?.tasksWithExternalDependencies === 2, 'Sprint health should count external dependencies');
  assert(sprintMarkdown.includes('## Summary'), 'Sprint markdown should include Summary');
  assert(sprintMarkdown.includes('## Risk Analysis'), 'Sprint markdown should include Risk Analysis');
  assert(sprintMarkdown.includes('## Recommendations'), 'Sprint markdown should include Recommendations');
  assert(sprintCsv.startsWith('taskId,title,sprint,assignee'), 'Sprint CSV should include required columns');

  const greenInputPath = writeJson('sprint-green.json', [
    {
      id: 'GREEN-1',
      title: 'Обновить справку по настройкам',
      source: 'file',
      assignee: 'pm_1',
      priority: 'medium',
      sprint: 'Sprint Green',
      task_type: 'task',
      clarity_score: 90,
      description: '## Контекст\nПользователю нужна понятная справка по настройкам профиля.\n\n## Ожидаемый результат\nСправка объясняет, где менять имя и уведомления.\n\n## Критерии приёмки\n- Есть шаги настройки.\n- Текст согласован с поддержкой.'
    },
    {
      id: 'GREEN-2',
      title: 'Добавить подсказку в профиль',
      source: 'file',
      assignee: 'frontend_1',
      priority: 'low',
      sprint: 'Sprint Green',
      task_type: 'task',
      clarity_score: 85,
      description: '## Контекст\nПользователи не понимают, где изменить язык интерфейса.\n\n## Ожидаемый результат\nВ профиле появляется короткая подсказка рядом с настройкой языка.\n\n## Критерии приёмки\n- Подсказка видна в desktop и mobile.\n- Текст не перекрывает форму.'
    }
  ]);
  const redInputPath = writeJson('sprint-red.json', [
    {
      id: 'RED-1',
      title: 'Починить оплату как обсуждали',
      source: 'file',
      clarity_score: 35,
      priority: '',
      description: 'Что-то не работает, надо быстро поправить оплату.'
    }
  ]);
  const greenOutputPath = path.join(tmpDir, 'sprint-green-report.json');
  const redOutputPath = path.join(tmpDir, 'sprint-red-report.json');
  const qualityGateGreenPath = path.join(tmpDir, 'quality-gate-green.json');
  const qualityGateRedPath = path.join(tmpDir, 'quality-gate-red.json');
  const actionPlanJsonPath = path.join(tmpDir, 'action-plan.json');
  const actionPlanMarkdownPath = path.join(tmpDir, 'action-plan.md');
  const actionPlanCsvPath = path.join(tmpDir, 'action-plan.csv');

  runNode([
    'dist/sprint-health-report.js',
    '--input',
    greenInputPath,
    '--output',
    greenOutputPath,
    '--format',
    'json'
  ]);
  runNode([
    'dist/sprint-health-report.js',
    '--input',
    redInputPath,
    '--output',
    redOutputPath,
    '--format',
    'json'
  ]);

  assert(readJson<SprintHealthSmokeReport>(greenOutputPath).sprintHealthStatus === 'green', 'Sprint health should detect green sprint');
  assert(readJson<SprintHealthSmokeReport>(redOutputPath).sprintHealthStatus === 'red', 'Sprint health should detect red sprint');

  runNode([
    'dist/quality-gate.js',
    '--input',
    greenInputPath,
    '--output',
    qualityGateGreenPath,
    '--format',
    'json'
  ]);

  const failedGate = spawnSync(process.execPath, [
    'dist/quality-gate.js',
    '--input',
    redInputPath,
    '--output',
    qualityGateRedPath,
    '--format',
    'json'
  ], {
    cwd: rootDir,
    encoding: 'utf8'
  });
  const greenGate = readJson<QualityGateSmokeReport>(qualityGateGreenPath);
  const redGate = readJson<QualityGateSmokeReport>(qualityGateRedPath);

  assert(greenGate.passed === true, 'Quality Gate should pass ready low-risk sprint');
  assert(greenGate.summary?.totalTasks === 2, 'Quality Gate should analyze green task set');
  assert(failedGate.status !== 0, 'Quality Gate CLI should fail red sprint with non-zero exit code');
  assert(redGate.passed === false, 'Quality Gate JSON should mark red sprint as failed');
  assert(
    Boolean(redGate.failedChecks?.some((check) => check.code === 'ready_tasks_percent')),
    'Quality Gate should explain failed readiness threshold'
  );

  runNode([
    'dist/action-plan.js',
    '--input',
    'data/demo_tasks.json',
    '--output',
    actionPlanJsonPath,
    '--format',
    'json',
    '--limit',
    '5'
  ]);
  runNode([
    'dist/action-plan.js',
    '--input',
    'data/demo_tasks.json',
    '--output',
    actionPlanMarkdownPath,
    '--format',
    'markdown'
  ]);
  runNode([
    'dist/action-plan.js',
    '--input',
    'data/demo_tasks.json',
    '--output',
    actionPlanCsvPath,
    '--format',
    'csv'
  ]);

  const actionPlan = readJson<ActionPlanSmokeReport>(actionPlanJsonPath);
  const actionPlanMarkdown = fs.readFileSync(actionPlanMarkdownPath, 'utf8');
  const actionPlanCsv = fs.readFileSync(actionPlanCsvPath, 'utf8');

  assert(actionPlan.totalTasks === 12, 'Action Plan should analyze demo tasks');
  assert((actionPlan.includedTasks || 0) > 0, 'Action Plan should include tasks that need fixing');
  assert(
    Boolean(actionPlan.items?.some((item) => item.taskId === 'RETRO-105')),
    'Action Plan should prioritize unclear demo tasks'
  );
  assert(actionPlanMarkdown.includes('Clarity Action Plan'), 'Action Plan markdown should be generated');
  assert(actionPlanCsv.startsWith('taskId,title,source'), 'Action Plan CSV should include required header');
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
    smokeDockerConfiguration();
    smokePrepareEventPayload();
    smokeWorkflowOutputs();
    await smokeAnalyze();
    await smokeChecklist();
    smokeYandexTrackerMockInput();
    await smokeYandexTrackerApi();
    smokeV2Reports();
    smokeRetroAnalytics();
    smokeRiskReadinessSprintHealth();
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
