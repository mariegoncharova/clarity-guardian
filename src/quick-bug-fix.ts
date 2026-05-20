import {
  analyzeUnifiedTasks
} from './analytics';
import {
  csvEscape,
  inferReportFormat,
  tableCell,
  writeReport
} from './report-utils';
import {
  analyzeTaskRisk
} from './risk/analyzer';
import {
  normalizeUnifiedTasks
} from './task-model';
import {
  findKeywords,
  getAcceptanceCriteria,
  getExpectedResult,
  getTaskId,
  getTaskText,
  hasAcceptanceCriteria,
  hasContext,
  hasExpectedResult,
  hasExternalDependency,
  hasDependencyInfo,
  hasLargeScope,
  hasOpenBlocker,
  hasReopenedAfterLastTesting,
  hasTestingSignal,
  hasVagueWording
} from './task-signals';
import {
  getStringArg,
  makeCliError,
  normalizeText,
  parseArgs,
  readJsonFile
} from './utils';

import type {
  ReportFormat
} from './report-utils';
import type {
  RiskAnalysis
} from './risk/models';
import type {
  TaskAnalysisRecord
} from './types';

export type QuickBugFixStatus = 'quick_fix_ready' | 'needs_clarification' | 'needs_risk_review';

export interface QuickBugFixItem {
  taskId: string;
  title: string;
  source: string;
  assignee?: string;
  status?: string;
  priority?: string;
  clarityScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  riskScore: number;
  fixReadinessScore: number;
  quickFixStatus: QuickBugFixStatus;
  timeboxMinutes: number;
  bugSignals: string[];
  blockers: string[];
  patchPlan: string[];
  verificationChecklist: string[];
  safetyChecks: string[];
  suggestedOwnerRole: 'Frontend' | 'Backend' | 'QA' | 'Analytics' | 'Tech Lead' | 'PM';
}

export interface QuickBugFixReport {
  generatedAt: string;
  totalTasks: number;
  bugsTracked: number;
  quickFixReady: number;
  needsClarification: number;
  needsRiskReview: number;
  averageFixReadinessScore: number;
  items: QuickBugFixItem[];
}

const BUG_KEYWORDS = [
  'bug',
  'bugfix',
  'defect',
  'ошибка',
  'баг',
  'слом',
  'не работает',
  'исправить',
  'пофиксить',
  'edge case',
  'валидац',
  'fallback'
];

const TITLE_BUG_KEYWORDS = [
  'bug',
  'defect',
  'баг',
  'ошибка',
  'исправить',
  'пофиксить',
  'не работает',
  'слом',
  'валидац',
  'fallback'
];

const LABEL_BUG_KEYWORDS = [
  'bug',
  'bugfix',
  'defect',
  'баг',
  'ошибка'
];

const SMALL_FIX_KEYWORDS = [
  'copy',
  'текст ошибки',
  'template',
  'шаблон',
  'validation',
  'валидац',
  'promo',
  'промокод',
  'fallback',
  'localization',
  'локал',
  'email',
  'подсказ',
  'hint'
];

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, round(value)));
}

function parseNumberArg(
  args: Record<string, string | boolean>,
  key: string
): number | undefined {
  const value = getStringArg(args, key);

  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw makeCliError(`Аргумент --${key} должен быть числом`);
  }

  return parsed;
}

function getBugSignals(record: TaskAnalysisRecord): string[] {
  const signals: string[] = [];
  const title = normalizeText(record.task.title);
  const labelsText = [
    ...(record.task.labels || []),
    ...(record.task.tags || [])
  ].join(' ');
  const titleMatches = findKeywords(title, TITLE_BUG_KEYWORDS);
  const labelMatches = findKeywords(labelsText, LABEL_BUG_KEYWORDS);

  if (record.task.workItemType === 'bug') {
    signals.push('task_type: bug');
  }

  for (const keyword of titleMatches.slice(0, 3)) {
    signals.push(`title keyword: ${keyword}`);
  }

  for (const keyword of labelMatches.slice(0, 3)) {
    signals.push(`label keyword: ${keyword}`);
  }

  if (hasReopenedAfterLastTesting(record.task)) {
    signals.push('history: reopened_after_testing');
  }

  if (record.task.workItemType === 'bug') {
    for (const keyword of findKeywords(getTaskText(record.task), BUG_KEYWORDS).slice(0, 3)) {
      signals.push(`body keyword: ${keyword}`);
    }
  }

  return Array.from(new Set(signals));
}

function isBugCandidate(record: TaskAnalysisRecord): boolean {
  return getBugSignals(record).length > 0;
}

function getBlockers(record: TaskAnalysisRecord, risk: RiskAnalysis): string[] {
  const blockers: string[] = [];

  if (risk.riskLevel === 'high') {
    blockers.push('high risk');
  }

  if (!hasContext(record.task)) {
    blockers.push('missing context');
  }

  if (!hasExpectedResult(record.task)) {
    blockers.push('missing expected result');
  }

  if (!hasAcceptanceCriteria(record.task)) {
    blockers.push('missing acceptance criteria');
  }

  if (hasExternalDependency(record.task) && !hasDependencyInfo(record.task)) {
    blockers.push('unowned external dependency');
  }

  if (hasOpenBlocker(record.task)) {
    blockers.push('open blocker');
  }

  if (hasLargeScope(record.task)) {
    blockers.push('large scope');
  }

  if (hasVagueWording(record.task)) {
    blockers.push('vague wording');
  }

  if (record.task.workItemType === 'bug' && !hasTestingSignal(record.task) && !hasAcceptanceCriteria(record.task)) {
    blockers.push('no reproduction or testing signal');
  }

  return Array.from(new Set(blockers));
}

function hasSmallFixSignal(record: TaskAnalysisRecord): boolean {
  const text = getTaskText(record.task);

  return findKeywords(text, SMALL_FIX_KEYWORDS).length > 0 || hasStandaloneTextSignal(text);
}

function hasStandaloneTextSignal(text: string): boolean {
  return /(^|[^а-яё])текст([^а-яё]|$)/iu.test(text);
}

function calculateFixReadinessScore(
  record: TaskAnalysisRecord,
  risk: RiskAnalysis,
  blockers: string[]
): number {
  let score = 100 - risk.riskScore * 0.45;

  if (!hasContext(record.task)) {
    score -= 14;
  }

  if (!hasExpectedResult(record.task)) {
    score -= 18;
  }

  if (!hasAcceptanceCriteria(record.task)) {
    score -= 18;
  }

  if (!record.task.assignee) {
    score -= 8;
  }

  if (hasExternalDependency(record.task) && !hasDependencyInfo(record.task)) {
    score -= 18;
  }

  if (hasOpenBlocker(record.task)) {
    score -= 16;
  }

  if (hasLargeScope(record.task)) {
    score -= 18;
  }

  if (hasVagueWording(record.task)) {
    score -= 8;
  }

  if (hasTestingSignal(record.task)) {
    score += 5;
  }

  if (hasSmallFixSignal(record)) {
    score += 10;
  }

  if (blockers.length === 0) {
    score += 4;
  }

  return clampScore(score);
}

function getQuickFixStatus(
  record: TaskAnalysisRecord,
  risk: RiskAnalysis,
  blockers: string[],
  fixReadinessScore: number
): QuickBugFixStatus {
  const riskBlockers = [
    'high risk',
    'unowned external dependency',
    'open blocker',
    'large scope'
  ];

  if (risk.riskLevel === 'high' || blockers.some((blocker) => riskBlockers.includes(blocker))) {
    return 'needs_risk_review';
  }

  if (
    blockers.some((blocker) =>
      blocker === 'missing context' ||
      blocker === 'missing expected result' ||
      blocker === 'missing acceptance criteria' ||
      blocker === 'vague wording' ||
      blocker === 'no reproduction or testing signal'
    )
  ) {
    return 'needs_clarification';
  }

  if (fixReadinessScore >= 70) {
    return 'quick_fix_ready';
  }

  return 'needs_clarification';
}

function getTimeboxMinutes(status: QuickBugFixStatus, fixReadinessScore: number): number {
  if (status !== 'quick_fix_ready') {
    return 0;
  }

  if (fixReadinessScore >= 90) {
    return 30;
  }

  if (fixReadinessScore >= 80) {
    return 45;
  }

  return 60;
}

function getSuggestedOwnerRole(record: TaskAnalysisRecord): QuickBugFixItem['suggestedOwnerRole'] {
  const text = getTaskText(record.task).toLowerCase();

  if (/analytics|аналитик|event|событи|dashboard|метрик/.test(text)) {
    return 'Analytics';
  }

  if (/security|access|доступ|production|prod/.test(text)) {
    return 'Tech Lead';
  }

  if (/backend|api|payment|оплат|плат|promo|промокод|validation|валидац/.test(text)) {
    return 'Backend';
  }

  if (/frontend|ui|web|copy|template|email|localization|локал|подсказ/.test(text) || hasStandaloneTextSignal(text)) {
    return 'Frontend';
  }

  if (/qa|testing|тест|провер/.test(text)) {
    return 'QA';
  }

  return 'PM';
}

function getPatchPlan(record: TaskAnalysisRecord, status: QuickBugFixStatus): string[] {
  const text = getTaskText(record.task).toLowerCase();
  const plan: string[] = [];

  if (status === 'needs_risk_review') {
    plan.push('Не чинить сходу: сначала провести короткий risk review и подтвердить safe scope.');
  } else if (status === 'needs_clarification') {
    plan.push('Перед фиксом закрыть недостающие вопросы по expected result, acceptance criteria или reproduction steps.');
  } else {
    plan.push('Воспроизвести баг на минимальном сценарии и зафиксировать failing check.');
  }

  if (/copy|template|email|localization|локал/.test(text) || hasStandaloneTextSignal(text)) {
    plan.push('Исправить текст, шаблон или fallback в одном месте без изменения бизнес-логики.');
    plan.push('Проверить соседние локали и пустые значения.');
  } else if (/validation|валидац|promo|промокод/.test(text)) {
    plan.push('Добавить точечный guard в validation branch и покрыть регрессионным тестом.');
    plan.push('Проверить активный, истёкший и невалидный варианты данных.');
  } else if (/payment|оплат|плат|банк|bank/.test(text)) {
    plan.push('Изолировать ветку ошибки платежа или retry-flow, не меняя happy path транзакции.');
    plan.push('Проверить, что повторная попытка не создаёт дубль операции.');
  } else if (/analytics|аналитик|event|событи/.test(text)) {
    plan.push('Проверить контракт события и добавить недостающие поля без персональных данных.');
    plan.push('Проверить доставку события в staging dashboard.');
  } else if (/access|доступ|security|production|prod/.test(text)) {
    plan.push('Не менять доступы без владельца: подтвердить роли, audit log и rollback path.');
  } else {
    plan.push('Внести минимальное изменение в наиболее узком модуле, где проявляется дефект.');
    plan.push('Добавить regression check рядом с существующими тестами.');
  }

  plan.push('После фикса прогнать targeted test, smoke и обновить комментарий в задаче.');

  return Array.from(new Set(plan));
}

function getVerificationChecklist(record: TaskAnalysisRecord): string[] {
  const acceptanceCriteria = getAcceptanceCriteria(record.task);
  const expectedResult = getExpectedResult(record.task);

  if (acceptanceCriteria.length > 0) {
    return acceptanceCriteria.slice(0, 5).map((item) => `Проверить: ${item}`);
  }

  return [
    expectedResult
      ? `Проверить ожидаемый результат: ${expectedResult}`
      : 'Проверить основной сценарий, где проявлялся баг.',
    'Проверить соседний happy path.',
    'Проверить, что ошибка не повторяется после reload/retry.'
  ];
}

function getSafetyChecks(record: TaskAnalysisRecord, risk: RiskAnalysis): string[] {
  const checks = [
    'Не расширять scope фикса за пределы описанного дефекта.',
    'Добавить или обновить regression test.',
    'Проверить, что логирование не раскрывает персональные данные.'
  ];

  if (risk.riskLevel !== 'low') {
    checks.push('Согласовать rollback или feature flag для рискованного участка.');
  }

  if (hasExternalDependency(record.task)) {
    checks.push('Не считать фикс готовым, пока внешняя зависимость не подтверждена.');
  }

  return checks;
}

function toQuickBugFixItem(record: TaskAnalysisRecord): QuickBugFixItem {
  const risk = analyzeTaskRisk(record.task);
  const blockers = getBlockers(record, risk);
  const fixReadinessScore = calculateFixReadinessScore(record, risk, blockers);
  const quickFixStatus = getQuickFixStatus(record, risk, blockers, fixReadinessScore);

  return {
    taskId: getTaskId(record.task),
    title: record.task.title,
    source: record.task.source,
    assignee: record.task.assignee,
    status: record.task.status,
    priority: record.task.priority,
    clarityScore: record.score,
    riskLevel: risk.riskLevel,
    riskScore: risk.riskScore,
    fixReadinessScore,
    quickFixStatus,
    timeboxMinutes: getTimeboxMinutes(quickFixStatus, fixReadinessScore),
    bugSignals: getBugSignals(record),
    blockers,
    patchPlan: getPatchPlan(record, quickFixStatus),
    verificationChecklist: getVerificationChecklist(record),
    safetyChecks: getSafetyChecks(record, risk),
    suggestedOwnerRole: getSuggestedOwnerRole(record)
  };
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function buildQuickBugFixReport(
  records: TaskAnalysisRecord[],
  options: {
    limit?: number;
    minFixReadinessScore?: number;
    includeNeedsReview?: boolean;
    generatedAt?: string;
  } = {}
): QuickBugFixReport {
  const limit = options.limit ?? 10;
  const minFixReadinessScore = options.minFixReadinessScore ?? 0;
  const items = records
    .filter(isBugCandidate)
    .map(toQuickBugFixItem)
    .filter((item) =>
      options.includeNeedsReview ||
      item.quickFixStatus === 'quick_fix_ready' ||
      item.fixReadinessScore >= minFixReadinessScore
    )
    .sort((a, b) =>
      statusRank(a.quickFixStatus) - statusRank(b.quickFixStatus) ||
      b.fixReadinessScore - a.fixReadinessScore ||
      a.taskId.localeCompare(b.taskId)
    )
    .slice(0, limit);

  return {
    generatedAt: options.generatedAt || new Date().toISOString(),
    totalTasks: records.length,
    bugsTracked: items.length,
    quickFixReady: items.filter((item) => item.quickFixStatus === 'quick_fix_ready').length,
    needsClarification: items.filter((item) => item.quickFixStatus === 'needs_clarification').length,
    needsRiskReview: items.filter((item) => item.quickFixStatus === 'needs_risk_review').length,
    averageFixReadinessScore: average(items.map((item) => item.fixReadinessScore)),
    items
  };
}

function statusRank(status: QuickBugFixStatus): number {
  if (status === 'quick_fix_ready') {
    return 0;
  }

  if (status === 'needs_clarification') {
    return 1;
  }

  return 2;
}

export function formatQuickBugFixJson(report: QuickBugFixReport): string {
  return JSON.stringify(report, null, 2);
}

export function formatQuickBugFixCsv(report: QuickBugFixReport): string {
  const header = [
    'taskId',
    'title',
    'source',
    'assignee',
    'status',
    'priority',
    'quickFixStatus',
    'fixReadinessScore',
    'timeboxMinutes',
    'riskLevel',
    'riskScore',
    'bugSignals',
    'blockers',
    'patchPlan',
    'verificationChecklist'
  ];
  const rows = report.items.map((item) => [
    item.taskId,
    item.title,
    item.source,
    item.assignee || '',
    item.status || '',
    item.priority || '',
    item.quickFixStatus,
    item.fixReadinessScore,
    item.timeboxMinutes,
    item.riskLevel,
    item.riskScore,
    item.bugSignals.join('|'),
    item.blockers.join('|'),
    item.patchPlan.join('|'),
    item.verificationChecklist.join('|')
  ]);

  return [
    header.map(csvEscape).join(','),
    ...rows.map((row) => row.map(csvEscape).join(','))
  ].join('\n');
}

function formatList(items: string[]): string[] {
  return items.length > 0
    ? items.map((item) => `- ${item}`)
    : ['- Нет.'];
}

export function formatQuickBugFixMarkdown(report: QuickBugFixReport): string {
  const rows = report.items.map((item) =>
    `| ${tableCell(item.taskId)} | ${tableCell(item.title)} | ${item.quickFixStatus} | ${item.fixReadinessScore} | ${item.timeboxMinutes || '-'} | ${item.riskLevel} | ${tableCell(item.blockers.join('; ') || 'none')} |`
  );
  const items = report.items.flatMap((item, index) => [
    `### ${index + 1}. ${item.taskId} - ${tableCell(item.title)}`,
    '',
    `- Quick fix status: ${item.quickFixStatus}`,
    `- Fix Readiness Score: ${item.fixReadinessScore}/100`,
    `- Timebox: ${item.timeboxMinutes ? `${item.timeboxMinutes} min` : 'triage first'}`,
    `- Risk: ${item.riskLevel} (${item.riskScore}/100)`,
    `- Suggested owner role: ${item.suggestedOwnerRole}`,
    `- Assignee: ${item.assignee || 'Не назначен'}`,
    '',
    '**Bug signals:**',
    '',
    ...formatList(item.bugSignals),
    '',
    '**Blockers:**',
    '',
    ...formatList(item.blockers),
    '',
    '**Patch plan:**',
    '',
    ...formatList(item.patchPlan),
    '',
    '**Verification checklist:**',
    '',
    ...formatList(item.verificationChecklist),
    '',
    '**Safety checks:**',
    '',
    ...formatList(item.safetyChecks),
    ''
  ]);

  return [
    '# Quick Bug Fix Queue',
    '',
    `Generated at: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    `- Total tasks analyzed: ${report.totalTasks}`,
    `- Bugs tracked: ${report.bugsTracked}`,
    `- Quick fix ready: ${report.quickFixReady}`,
    `- Needs clarification: ${report.needsClarification}`,
    `- Needs risk review: ${report.needsRiskReview}`,
    `- Average Fix Readiness Score: ${report.averageFixReadinessScore}/100`,
    '',
    '## Bug Queue',
    '',
    '| Task | Title | Status | Fix Readiness | Timebox | Risk | Blockers |',
    '| --- | --- | --- | ---: | ---: | --- | --- |',
    ...(rows.length > 0 ? rows : ['| - | No bugs tracked | - | 0 | - | - | - |']),
    '',
    '## Fix Cards',
    '',
    ...(items.length > 0 ? items : ['Bug-задач для quick fix queue не найдено.'])
  ].join('\n');
}

function formatQuickBugFixReport(report: QuickBugFixReport, format: ReportFormat): string {
  if (format === 'json') {
    return formatQuickBugFixJson(report);
  }

  if (format === 'csv') {
    return formatQuickBugFixCsv(report);
  }

  return formatQuickBugFixMarkdown(report);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const inputPath = getStringArg(args, 'input');
  const outputPath = getStringArg(args, 'output');

  if (!inputPath) {
    throw makeCliError('Не передан аргумент --input');
  }

  if (!outputPath) {
    throw makeCliError('Не передан аргумент --output');
  }

  const limit = parseNumberArg(args, 'limit') ?? 10;
  const minFixReadinessScore = parseNumberArg(args, 'min-fix-readiness-score') ?? 0;
  const format = inferReportFormat(outputPath, getStringArg(args, 'format'));
  const tasks = normalizeUnifiedTasks(readJsonFile<unknown>(inputPath));
  const records = analyzeUnifiedTasks(tasks);
  const report = buildQuickBugFixReport(records, {
    limit,
    minFixReadinessScore,
    includeNeedsReview: args['include-needs-review'] === true
  });

  writeReport(outputPath, formatQuickBugFixReport(report, format));
  process.stdout.write(`Quick Bug Fix Queue сохранён: ${outputPath}\n`);
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
