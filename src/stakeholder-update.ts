import {
  analyzeUnifiedTasks
} from './analytics';
import {
  checkDefinitionOfReady
} from './readiness/dor';
import {
  csvEscape,
  inferReportFormat,
  tableCell,
  writeReport
} from './report-utils';
import {
  isReturnedFromTesting
} from './retro-analyzer';
import {
  normalizeUnifiedTasks
} from './task-model';
import {
  getTaskId,
  getTaskText,
  hasAcceptanceCriteria,
  hasExpectedResult,
  hasLargeScope,
  isDoneStatus
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
  TaskAnalysisRecord
} from './types';

export type StakeholderHealth = 'green' | 'yellow' | 'red';
export type StakeholderSeverity = 'low' | 'medium' | 'high';
export type StakeholderUrgency = 'now' | 'this_week' | 'monitor';
export type StakeholderOwnerRole = 'PM' | 'Tech Lead' | 'QA' | 'Analytics' | 'Engineering';

export interface StakeholderRisk {
  code: string;
  title: string;
  severity: StakeholderSeverity;
  ownerRole: StakeholderOwnerRole;
  taskIds: string[];
  why: string;
  recommendation: string;
}

export interface StakeholderAsk {
  ownerRole: StakeholderOwnerRole;
  urgency: StakeholderUrgency;
  message: string;
  taskIds: string[];
}

export interface StakeholderTaskMention {
  taskId: string;
  title: string;
  status?: string;
  assignee?: string;
  score: number;
  riskLevel: 'low' | 'medium' | 'high';
  reason: string;
}

export interface StakeholderUpdateReport {
  generatedAt: string;
  health: StakeholderHealth;
  totalTasks: number;
  summary: {
    averageClarityScore: number;
    readyTasks: number;
    readyTasksPercent: number;
    highRiskTasks: number;
    blockerTasks: number;
    qaGapTasks: number;
    lowClarityTasks: number;
    scopeRiskTasks: number;
    reopenedTasks: number;
    doneTasks: number;
    unassignedRiskTasks: number;
  };
  highlights: string[];
  risks: StakeholderRisk[];
  asks: StakeholderAsk[];
  nextActions: string[];
  taskMentions: StakeholderTaskMention[];
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function percent(count: number, total: number): number {
  if (total === 0) {
    return 0;
  }

  return round((count / total) * 100);
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
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

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function getTaskIds(records: TaskAnalysisRecord[], limit = 5): string[] {
  return records
    .slice(0, limit)
    .map((record) => getTaskId(record.task));
}

function hasExplicitBlocker(record: TaskAnalysisRecord): boolean {
  const status = normalizeText(record.task.status).toLowerCase();
  const dependencies = record.task.dependencies || [];
  const text = normalizeText(getTaskText(record.task)).toLowerCase();
  const explicitDependencyPatterns = [
    /\bblocked\s+(?:by|on)\b/i,
    /\bexternal dependency\b/i,
    /\bthird-party\b/i,
    /нет ответа/i,
    /зависимость/i,
    /api партн/i,
    /жд[её]м\s+(?:ответ|данные|документац|подтверждение|решение|формат|согласование)/i,
    /ожидаем\s+(?:ответ|данные|документац|подтверждение|решение|формат|согласование)/i
  ];

  return dependencies.some((dependency) => normalizeText(dependency).length > 0) ||
    /^(blocked|блокер)$/.test(status) ||
    explicitDependencyPatterns.some((pattern) => pattern.test(text));
}

function hasQaGap(record: TaskAnalysisRecord): boolean {
  return !hasAcceptanceCriteria(record.task) ||
    !hasExpectedResult(record.task) ||
    (
      record.problemCodes.includes('unclear_testing') &&
      (record.score < 80 || record.riskLevel !== 'low')
    ) ||
    (record.task.metrics?.qaReturns || 0) > 0 ||
    isReturnedFromTesting(record.task);
}

function hasScopeRisk(record: TaskAnalysisRecord): boolean {
  return hasLargeScope(record.task) ||
    record.problemCodes.includes('task_too_large');
}

function hasUnassignedRisk(record: TaskAnalysisRecord): boolean {
  return !record.task.assignee &&
    !isDoneStatus(record.task.status) &&
    (record.riskLevel !== 'low' || record.score < 80 || hasExplicitBlocker(record));
}

function isNotReady(record: TaskAnalysisRecord): boolean {
  return !checkDefinitionOfReady({
    ...record.task,
    clarityScore: record.score
  }).dorPassed;
}

function getHealth(params: {
  totalTasks: number;
  averageClarityScore: number;
  readyTasksPercent: number;
  highRiskTasksPercent: number;
  blockerTasks: number;
  qaGapTasks: number;
}): StakeholderHealth {
  if (params.totalTasks === 0) {
    return 'yellow';
  }

  if (
    params.averageClarityScore < 60 ||
    params.readyTasksPercent < 50 ||
    params.highRiskTasksPercent > 30 ||
    params.blockerTasks >= 2
  ) {
    return 'red';
  }

  if (
    params.averageClarityScore < 75 ||
    params.readyTasksPercent < 80 ||
    params.highRiskTasksPercent > 0 ||
    params.blockerTasks > 0 ||
    params.qaGapTasks > 0
  ) {
    return 'yellow';
  }

  return 'green';
}

function addRisk(
  risks: StakeholderRisk[],
  risk: StakeholderRisk,
  records: TaskAnalysisRecord[]
): void {
  if (records.length === 0) {
    return;
  }

  risks.push({
    ...risk,
    taskIds: getTaskIds(records)
  });
}

function buildRisks(records: TaskAnalysisRecord[], summary: StakeholderUpdateReport['summary']): StakeholderRisk[] {
  const risks: StakeholderRisk[] = [];
  const notReadyRecords = records.filter(isNotReady);
  const highRiskRecords = records.filter((record) => record.riskLevel === 'high');
  const blockerRecords = records.filter(hasExplicitBlocker);
  const qaGapRecords = records.filter(hasQaGap);
  const lowClarityRecords = records.filter((record) => record.score < 50);
  const scopeRiskRecords = records.filter(hasScopeRisk);
  const unassignedRiskRecords = records.filter(hasUnassignedRisk);

  addRisk(risks, {
    code: 'low_readiness',
    title: 'Planning readiness is below target',
    severity: summary.readyTasksPercent < 50 ? 'high' : 'medium',
    ownerRole: 'PM',
    taskIds: [],
    why: `${summary.readyTasksPercent}% задач проходят Definition of Ready.`,
    recommendation: 'Перед commitment уточнить контекст, ожидаемый результат и критерии приёмки для not-ready задач.'
  }, notReadyRecords);

  addRisk(risks, {
    code: 'high_risk_tasks',
    title: 'High-risk tasks need explicit review',
    severity: 'high',
    ownerRole: 'Tech Lead',
    taskIds: [],
    why: `${summary.highRiskTasks} задач имеют высокий delivery или communication risk.`,
    recommendation: 'Провести короткий risk review: edge cases, fallback, owner и verification plan.'
  }, highRiskRecords);

  addRisk(risks, {
    code: 'blockers',
    title: 'Blockers or external dependencies can delay delivery',
    severity: blockerRecords.length >= 2 ? 'high' : 'medium',
    ownerRole: 'Tech Lead',
    taskIds: [],
    why: `${summary.blockerTasks} задач требуют закрытия зависимости или ответа внешней стороны.`,
    recommendation: 'Назначить владельца зависимости, дату следующего сигнала и fallback-план.'
  }, blockerRecords);

  addRisk(risks, {
    code: 'qa_verification_gap',
    title: 'QA verification gaps can create returns from testing',
    severity: qaGapRecords.length >= 3 ? 'high' : 'medium',
    ownerRole: 'QA',
    taskIds: [],
    why: `${summary.qaGapTasks} задач имеют пробелы в проверке, критериях приёмки или возвратах QA.`,
    recommendation: 'Добавить acceptance criteria, reproduction steps и явный способ проверки результата.'
  }, qaGapRecords);

  addRisk(risks, {
    code: 'low_clarity',
    title: 'Low clarity can slow alignment',
    severity: lowClarityRecords.length >= 3 ? 'high' : 'medium',
    ownerRole: 'PM',
    taskIds: [],
    why: `${summary.lowClarityTasks} задач имеют Clarity Score ниже 50.`,
    recommendation: 'Переписать слабые задачи через problem, expected outcome и acceptance criteria.'
  }, lowClarityRecords);

  addRisk(risks, {
    code: 'scope_risk',
    title: 'Scope needs decomposition',
    severity: scopeRiskRecords.length >= 2 ? 'high' : 'medium',
    ownerRole: 'Tech Lead',
    taskIds: [],
    why: `${summary.scopeRiskTasks} задач выглядят слишком широкими или плохо проверяемыми.`,
    recommendation: 'Разделить scope на маленькие проверяемые изменения до planning.'
  }, scopeRiskRecords);

  addRisk(risks, {
    code: 'ownership_gap',
    title: 'Risky work needs a clear owner',
    severity: 'medium',
    ownerRole: 'PM',
    taskIds: [],
    why: `${summary.unassignedRiskTasks} рискованных задач не имеют assignee.`,
    recommendation: 'Назначить владельца или явно зафиксировать, что assignee будет выбран на planning.'
  }, unassignedRiskRecords);

  return risks.sort((a, b) => {
    const severityWeight: Record<StakeholderSeverity, number> = {
      high: 3,
      medium: 2,
      low: 1
    };

    return severityWeight[b.severity] - severityWeight[a.severity] ||
      b.taskIds.length - a.taskIds.length ||
      a.title.localeCompare(b.title);
  });
}

function buildHighlights(summary: StakeholderUpdateReport['summary']): string[] {
  const highlights = [
    `Средний Clarity Score: ${summary.averageClarityScore}/100.`,
    `${summary.readyTasksPercent}% задач проходят Definition of Ready.`
  ];

  if (summary.highRiskTasks === 0) {
    highlights.push('High-risk задач не найдено.');
  }

  if (summary.blockerTasks === 0) {
    highlights.push('Явных blocker/dependency задач не найдено.');
  }

  if (summary.doneTasks > 0) {
    highlights.push(`${summary.doneTasks} задач уже находятся в done/closed/released статусе.`);
  }

  if (summary.reopenedTasks === 0) {
    highlights.push('Возвратов с тестирования по status history не найдено.');
  }

  return highlights;
}

function buildAsks(risks: StakeholderRisk[]): StakeholderAsk[] {
  if (risks.length === 0) {
    return [{
      ownerRole: 'PM',
      urgency: 'monitor',
      message: 'Поддерживать текущий уровень ясности задач и обновлять статус на следующем planning checkpoint.',
      taskIds: []
    }];
  }

  return risks.slice(0, 5).map((risk) => ({
    ownerRole: risk.ownerRole,
    urgency: risk.severity === 'high' ? 'now' : 'this_week',
    message: risk.recommendation,
    taskIds: risk.taskIds
  }));
}

function buildNextActions(health: StakeholderHealth, risks: StakeholderRisk[]): string[] {
  const riskCodes = new Set(risks.map((risk) => risk.code));
  const actions: string[] = [];

  if (health === 'red') {
    actions.push('Согласовать stop/go решение по planning scope до commitment.');
  }

  if (riskCodes.has('blockers')) {
    actions.push('Закрыть владельцев внешних зависимостей и fallback-планы.');
  }

  if (riskCodes.has('high_risk_tasks')) {
    actions.push('Провести risk review для high-risk задач.');
  }

  if (riskCodes.has('low_readiness') || riskCodes.has('low_clarity')) {
    actions.push('Провести refinement по not-ready задачам и обновить описания.');
  }

  if (riskCodes.has('qa_verification_gap')) {
    actions.push('Добавить QA verification notes и acceptance criteria.');
  }

  if (riskCodes.has('scope_risk')) {
    actions.push('Декомпозировать крупные задачи до ближайшей итерации.');
  }

  if (actions.length === 0) {
    actions.push('Поделиться green update и продолжить мониторинг Clarity Score на следующем срезе.');
  }

  return unique(actions).slice(0, 6);
}

function getMentionReason(record: TaskAnalysisRecord): string {
  if (hasExplicitBlocker(record)) {
    return 'blocker/dependency';
  }

  if (record.riskLevel === 'high') {
    return 'high risk';
  }

  if (hasScopeRisk(record)) {
    return 'scope risk';
  }

  if (hasQaGap(record)) {
    return 'QA verification gap';
  }

  if (record.score < 50) {
    return 'low clarity';
  }

  if (hasUnassignedRisk(record)) {
    return 'ownership gap';
  }

  return 'ready signal';
}

function getMentionPriority(record: TaskAnalysisRecord): number {
  return (hasExplicitBlocker(record) ? 35 : 0) +
    (record.riskLevel === 'high' ? 30 : record.riskLevel === 'medium' ? 12 : 0) +
    (hasScopeRisk(record) ? 18 : 0) +
    (hasQaGap(record) ? 14 : 0) +
    (hasUnassignedRisk(record) ? 10 : 0) +
    (100 - record.score) * 0.3;
}

function buildTaskMentions(records: TaskAnalysisRecord[], limit: number): StakeholderTaskMention[] {
  return [...records]
    .filter((record) =>
      hasExplicitBlocker(record) ||
      record.riskLevel !== 'low' ||
      record.score < 80 ||
      hasQaGap(record) ||
      hasScopeRisk(record) ||
      hasUnassignedRisk(record)
    )
    .sort((a, b) => getMentionPriority(b) - getMentionPriority(a) || getTaskId(a.task).localeCompare(getTaskId(b.task)))
    .slice(0, limit)
    .map((record) => ({
      taskId: getTaskId(record.task),
      title: record.task.title,
      status: record.task.status,
      assignee: record.task.assignee,
      score: record.score,
      riskLevel: record.riskLevel,
      reason: getMentionReason(record)
    }));
}

export function buildStakeholderUpdateReport(
  records: TaskAnalysisRecord[],
  options: {
    generatedAt?: string;
    taskLimit?: number;
  } = {}
): StakeholderUpdateReport {
  const totalTasks = records.length;
  const readyRecords = records.filter((record) =>
    checkDefinitionOfReady({
      ...record.task,
      clarityScore: record.score
    }).dorPassed
  );
  const summary = {
    averageClarityScore: average(records.map((record) => record.score)),
    readyTasks: readyRecords.length,
    readyTasksPercent: percent(readyRecords.length, totalTasks),
    highRiskTasks: records.filter((record) => record.riskLevel === 'high').length,
    blockerTasks: records.filter(hasExplicitBlocker).length,
    qaGapTasks: records.filter(hasQaGap).length,
    lowClarityTasks: records.filter((record) => record.score < 50).length,
    scopeRiskTasks: records.filter(hasScopeRisk).length,
    reopenedTasks: records.filter((record) => isReturnedFromTesting(record.task)).length,
    doneTasks: records.filter((record) => isDoneStatus(record.task.status)).length,
    unassignedRiskTasks: records.filter(hasUnassignedRisk).length
  };
  const health = getHealth({
    totalTasks,
    averageClarityScore: summary.averageClarityScore,
    readyTasksPercent: summary.readyTasksPercent,
    highRiskTasksPercent: percent(summary.highRiskTasks, totalTasks),
    blockerTasks: summary.blockerTasks,
    qaGapTasks: summary.qaGapTasks
  });
  const risks = buildRisks(records, summary);

  return {
    generatedAt: options.generatedAt || new Date().toISOString(),
    health,
    totalTasks,
    summary,
    highlights: buildHighlights(summary),
    risks,
    asks: buildAsks(risks),
    nextActions: buildNextActions(health, risks),
    taskMentions: buildTaskMentions(records, options.taskLimit ?? 6)
  };
}

export function formatStakeholderUpdateJson(report: StakeholderUpdateReport): string {
  return JSON.stringify(report, null, 2);
}

export function formatStakeholderUpdateCsv(report: StakeholderUpdateReport): string {
  const header = [
    'section',
    'ownerRole',
    'severityOrUrgency',
    'taskIds',
    'message'
  ];
  const riskRows = report.risks.map((risk) => [
    'risk',
    risk.ownerRole,
    risk.severity,
    risk.taskIds.join('|'),
    `${risk.title}: ${risk.recommendation}`
  ]);
  const askRows = report.asks.map((ask) => [
    'ask',
    ask.ownerRole,
    ask.urgency,
    ask.taskIds.join('|'),
    ask.message
  ]);
  const mentionRows = report.taskMentions.map((task) => [
    'task',
    '',
    task.riskLevel,
    task.taskId,
    `${task.title} (${task.reason})`
  ]);

  return [
    header.map(csvEscape).join(','),
    ...[...riskRows, ...askRows, ...mentionRows].map((row) => row.map(csvEscape).join(','))
  ].join('\n');
}

function formatList(items: string[]): string[] {
  return items.length > 0
    ? items.map((item) => `- ${item}`)
    : ['- Нет.'];
}

function formatRisks(risks: StakeholderRisk[]): string[] {
  return risks.length > 0
    ? risks.map((risk) =>
      `- ${risk.title} [${risk.severity}, ${risk.ownerRole}]: ${risk.why} Tasks: ${risk.taskIds.join(', ') || 'n/a'}. ${risk.recommendation}`
    )
    : ['- Существенных рисков для stakeholder update не найдено.'];
}

function formatAsks(asks: StakeholderAsk[]): string[] {
  return asks.map((ask) =>
    `- ${ask.ownerRole} [${ask.urgency}]: ${ask.message}${ask.taskIds.length > 0 ? ` Tasks: ${ask.taskIds.join(', ')}.` : ''}`
  );
}

function formatTaskMentions(tasks: StakeholderTaskMention[]): string[] {
  return tasks.length > 0
    ? tasks.map((task) =>
      `- ${task.taskId} - ${tableCell(task.title)}: ${task.reason}, score ${task.score}/100, risk ${task.riskLevel}, status ${task.status || 'not set'}, assignee ${task.assignee || 'not assigned'}.`
    )
    : ['- Отдельных задач для упоминания нет.'];
}

export function formatStakeholderUpdateMarkdown(report: StakeholderUpdateReport): string {
  return [
    '# Stakeholder Update',
    '',
    `Generated at: ${report.generatedAt}`,
    '',
    '## Executive Summary',
    '',
    `- Health: ${report.health}`,
    `- Total tasks: ${report.totalTasks}`,
    `- Average Clarity Score: ${report.summary.averageClarityScore}/100`,
    `- Ready tasks: ${report.summary.readyTasks} (${report.summary.readyTasksPercent}%)`,
    `- High-risk tasks: ${report.summary.highRiskTasks}`,
    `- Blocker/dependency tasks: ${report.summary.blockerTasks}`,
    `- QA gap tasks: ${report.summary.qaGapTasks}`,
    `- Reopened tasks: ${report.summary.reopenedTasks}`,
    '',
    '## Highlights',
    '',
    ...formatList(report.highlights),
    '',
    '## Risks To Watch',
    '',
    ...formatRisks(report.risks),
    '',
    '## Asks',
    '',
    ...formatAsks(report.asks),
    '',
    '## Task Mentions',
    '',
    ...formatTaskMentions(report.taskMentions),
    '',
    '## Next Actions',
    '',
    ...formatList(report.nextActions)
  ].join('\n');
}

function formatStakeholderUpdate(
  report: StakeholderUpdateReport,
  format: ReportFormat
): string {
  if (format === 'json') {
    return formatStakeholderUpdateJson(report);
  }

  if (format === 'csv') {
    return formatStakeholderUpdateCsv(report);
  }

  return formatStakeholderUpdateMarkdown(report);
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

  const taskLimit = parseNumberArg(args, 'task-limit') ?? 6;
  const format = inferReportFormat(outputPath, getStringArg(args, 'format'));
  const tasks = normalizeUnifiedTasks(readJsonFile<unknown>(inputPath));
  const records = analyzeUnifiedTasks(tasks);
  const report = buildStakeholderUpdateReport(records, { taskLimit });

  writeReport(outputPath, formatStakeholderUpdate(report, format));
  process.stdout.write(`Stakeholder Update сохранён: ${outputPath}\n`);
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
