import {
  analyzeUnifiedTasks
} from './analytics';
import {
  checkDefinitionOfDone
} from './readiness/dod';
import {
  csvEscape,
  inferReportFormat,
  tableCell,
  writeReport
} from './report-utils';
import {
  normalizeUnifiedTasks
} from './task-model';
import {
  findKeywords,
  getTaskId,
  getTaskText,
  hasAcceptanceCriteria,
  hasDependencyInfo,
  hasExpectedResult,
  hasExternalDependency,
  hasLargeScope,
  hasReopenedAfterLastTesting,
  hasTestingSignal,
  hasVagueWording,
  isDoneStatus,
  RISKY_DOMAIN_KEYWORDS
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

export type ReleaseGuardDecision = 'go' | 'review_required' | 'no_go';
export type ReleaseGuardStatus = 'release_ready' | 'needs_verification' | 'blocked';
export type ReleaseRiskSeverity = 'low' | 'medium' | 'high';
export type ReleaseOwnerRole = 'PM' | 'Tech Lead' | 'QA' | 'Engineering' | 'Analytics';

export interface ReleaseGuardRisk {
  code: string;
  title: string;
  severity: ReleaseRiskSeverity;
  ownerRole: ReleaseOwnerRole;
  evidence?: string[];
  recommendation: string;
}

export interface ReleaseGuardItem {
  taskId: string;
  title: string;
  source: string;
  status?: string;
  assignee?: string;
  score: number;
  riskLevel: 'low' | 'medium' | 'high';
  releaseImpactScore: number;
  guardStatus: ReleaseGuardStatus;
  decision: ReleaseGuardDecision;
  ownerRole: ReleaseOwnerRole;
  releaseRisks: ReleaseGuardRisk[];
  verificationChecklist: string[];
  rollbackNotes: string[];
}

export interface ReleaseGuardReport {
  generatedAt: string;
  releaseDecision: ReleaseGuardDecision;
  releaseReadinessScore: number;
  totalTasks: number;
  includedTasks: number;
  summary: {
    releaseReady: number;
    needsVerification: number;
    blocked: number;
    highRiskTasks: number;
    qaGapTasks: number;
    reopenedTasks: number;
    blockerTasks: number;
    riskyDomainTasks: number;
    untestedDoneTasks: number;
  };
  topRiskTypes: Array<{
    code: string;
    title: string;
    count: number;
  }>;
  releaseChecklist: string[];
  items: ReleaseGuardItem[];
}

const GENERIC_RELEASE_DOMAIN_KEYWORDS = new Set(['release', 'релиз']);

function round(value: number): number {
  return Math.round(value * 10) / 10;
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

function addRisk(risks: ReleaseGuardRisk[], risk: ReleaseGuardRisk): void {
  if (!risks.some((item) => item.code === risk.code)) {
    risks.push(risk);
  }
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

function hasRiskyDomain(record: TaskAnalysisRecord): boolean {
  return findKeywords(getTaskText(record.task), RISKY_DOMAIN_KEYWORDS)
    .some((keyword) => !GENERIC_RELEASE_DOMAIN_KEYWORDS.has(keyword.toLowerCase()));
}

function hasReleaseLikeStatus(record: TaskAnalysisRecord): boolean {
  const status = normalizeText(record.task.status).toLowerCase();

  return isDoneStatus(record.task.status) ||
    /review|testing|ready|готов|релиз|release/.test(status);
}

function hasEdgeOrRollbackSignal(record: TaskAnalysisRecord): boolean {
  return /edge case|edge cases|fallback|rollback|откат|негативн|граничн|повторн|retry|таймаут|timeout/i
    .test(getTaskText(record.task));
}

function isReturnedOrReopened(record: TaskAnalysisRecord): boolean {
  return hasReopenedAfterLastTesting(record.task) ||
    (record.task.metrics?.qaReturns || 0) > 0;
}

function buildReleaseRisks(record: TaskAnalysisRecord): ReleaseGuardRisk[] {
  const risks: ReleaseGuardRisk[] = [];
  const dod = checkDefinitionOfDone(record.task);
  const doneOrReleaseLike = hasReleaseLikeStatus(record);
  const riskyDomain = hasRiskyDomain(record);

  if (hasExplicitBlocker(record)) {
    addRisk(risks, {
      code: 'blocker_or_dependency',
      title: 'Есть блокер или внешняя зависимость',
      severity: 'high',
      ownerRole: 'Tech Lead',
      recommendation: 'Перед релизом назначить владельца зависимости, срок ответа и fallback-план.'
    });
  }

  if (record.riskLevel === 'high') {
    addRisk(risks, {
      code: 'high_delivery_risk',
      title: 'Высокий delivery-риск',
      severity: 'high',
      ownerRole: 'Tech Lead',
      recommendation: 'Провести разбор риска по граничным сценариям, rollback/fallback и влиянию на критичные пользовательские сценарии.'
    });
  }

  if (isReturnedOrReopened(record)) {
    addRisk(risks, {
      code: 'regression_history',
      title: 'Есть возврат с тестирования или reopened history',
      severity: 'high',
      ownerRole: 'QA',
      recommendation: 'Перед релизом выполнить regression check по сценарию возврата и зафиксировать результат проверки.'
    });
  }

  if (!hasAcceptanceCriteria(record.task)) {
    addRisk(risks, {
      code: 'missing_acceptance_criteria',
      title: 'Нет критериев приёмки',
      severity: 'high',
      ownerRole: 'QA',
      recommendation: 'Добавить проверяемые acceptance criteria до решения по релизу.'
    });
  }

  if (!hasExpectedResult(record.task)) {
    addRisk(risks, {
      code: 'missing_expected_result',
      title: 'Нет ожидаемого результата',
      severity: 'medium',
      ownerRole: 'PM',
      recommendation: 'Уточнить наблюдаемый результат, чтобы релизная проверка не зависела от устных договорённостей.'
    });
  }

  if (doneOrReleaseLike && !hasTestingSignal(record.task)) {
    addRisk(risks, {
      code: 'missing_testing_evidence',
      title: 'Нет признака тестирования',
      severity: 'high',
      ownerRole: 'QA',
      recommendation: 'Зафиксировать результат проверки по критериям приёмки перед выпуском.'
    });
  }

  if (doneOrReleaseLike && !dod.dodPassed) {
    addRisk(risks, {
      code: 'dod_not_passed',
      title: 'Definition of Done не пройден',
      severity: dod.dodScore < 60 ? 'high' : 'medium',
      ownerRole: 'QA',
      recommendation: 'Закрыть критичные DoD-проверки до релиза.'
    });
  }

  if (riskyDomain && !hasEdgeOrRollbackSignal(record)) {
    addRisk(risks, {
      code: 'risky_domain_without_safety_notes',
      title: 'Критичный домен без заметок по безопасному релизу',
      severity: record.riskLevel === 'low' ? 'medium' : 'high',
      ownerRole: 'Tech Lead',
      recommendation: 'Зафиксировать граничные сценарии, fallback/rollback и регрессионный чек-лист для критичного сценария.'
    });
  }

  if (hasExternalDependency(record.task) && !hasDependencyInfo(record.task)) {
    addRisk(risks, {
      code: 'unowned_external_dependency',
      title: 'Внешняя зависимость без владельца',
      severity: 'medium',
      ownerRole: 'Tech Lead',
      recommendation: 'Указать владельца внешней зависимости и условие готовности к релизу.'
    });
  }

  if (hasLargeScope(record.task)) {
    addRisk(risks, {
      code: 'large_scope',
      title: 'Слишком широкий scope',
      severity: 'medium',
      ownerRole: 'Tech Lead',
      recommendation: 'Проверить, не нужно ли разделить объём релиза или усилить регрессионный чек-лист.'
    });
  }

  if (record.score < 50 || hasVagueWording(record.task)) {
    addRisk(risks, {
      code: 'low_clarity',
      title: 'Низкая ясность задачи',
      severity: record.score < 50 ? 'high' : 'medium',
      ownerRole: 'PM',
      recommendation: 'Уточнить описание задачи до релиза: контекст, результат, критерии проверки.'
    });
  }

  return risks.sort((a, b) => {
    const severityWeight: Record<ReleaseRiskSeverity, number> = {
      high: 3,
      medium: 2,
      low: 1
    };

    return severityWeight[b.severity] - severityWeight[a.severity] ||
      a.code.localeCompare(b.code);
  });
}

function severityWeight(severity: ReleaseRiskSeverity): number {
  if (severity === 'high') {
    return 18;
  }

  if (severity === 'medium') {
    return 9;
  }

  return 3;
}

function getReleaseImpactScore(record: TaskAnalysisRecord, risks: ReleaseGuardRisk[]): number {
  const riskWeight = risks.reduce((sum, risk) => sum + severityWeight(risk.severity), 0);
  const scorePenalty = Math.max(0, 100 - record.score) * 0.25;
  const riskLevelWeight = record.riskLevel === 'high'
    ? 20
    : record.riskLevel === 'medium'
      ? 10
      : 0;
  const domainWeight = hasRiskyDomain(record) ? 8 : 0;

  return Math.min(100, round(riskWeight + scorePenalty + riskLevelWeight + domainWeight));
}

function getGuardStatus(risks: ReleaseGuardRisk[], impactScore: number): ReleaseGuardStatus {
  if (
    risks.some((risk) =>
      risk.code === 'blocker_or_dependency' ||
      risk.code === 'missing_acceptance_criteria' ||
      risk.code === 'missing_testing_evidence'
    ) ||
    impactScore >= 80
  ) {
    return 'blocked';
  }

  if (risks.length > 0 || impactScore >= 35) {
    return 'needs_verification';
  }

  return 'release_ready';
}

function getDecision(status: ReleaseGuardStatus): ReleaseGuardDecision {
  if (status === 'blocked') {
    return 'no_go';
  }

  if (status === 'needs_verification') {
    return 'review_required';
  }

  return 'go';
}

function getOwnerRole(risks: ReleaseGuardRisk[]): ReleaseOwnerRole {
  return risks[0]?.ownerRole || 'Engineering';
}

function buildVerificationChecklist(record: TaskAnalysisRecord, risks: ReleaseGuardRisk[]): string[] {
  const checklist = [
    'Проверить основной успешный сценарий по задаче.',
    'Зафиксировать результат проверки в задаче или комментарии.'
  ];
  const riskCodes = new Set(risks.map((risk) => risk.code));

  if (riskCodes.has('regression_history')) {
    checklist.unshift('Повторить сценарий, из-за которого задача возвращалась с тестирования.');
  }

  if (riskCodes.has('missing_acceptance_criteria') || riskCodes.has('missing_expected_result')) {
    checklist.unshift('Согласовать ожидаемый результат и критерии приёмки до решения по релизу.');
  }

  if (hasRiskyDomain(record)) {
    checklist.push('Проверить критичный домен: payment/auth/production/integration сценарии и негативные ветки.');
  }

  if (record.task.workItemType === 'bug') {
    checklist.push('Проверить шаги воспроизведения, фактический результат и отсутствие регрессии.');
  }

  if (riskCodes.has('large_scope')) {
    checklist.push('Проверить, что объём релиза не включает незафиксированные последующие изменения.');
  }

  return unique(checklist);
}

function buildRollbackNotes(record: TaskAnalysisRecord, risks: ReleaseGuardRisk[]): string[] {
  const notes: string[] = [];
  const riskCodes = new Set(risks.map((risk) => risk.code));

  if (hasRiskyDomain(record) || record.riskLevel === 'high') {
    notes.push('Зафиксировать rollback/fallback путь для критичного сценария.');
  }

  if (riskCodes.has('blocker_or_dependency') || riskCodes.has('unowned_external_dependency')) {
    notes.push('Не выпускать зависимую часть, если внешний артефакт не готов.');
  }

  if (record.task.workItemType === 'bug') {
    notes.push('Сохранить быстрый способ отката фикса, если баг проявится повторно.');
  }

  if (notes.length === 0) {
    notes.push('Заметки по откату не требуются сверх стандартного релизного процесса.');
  }

  return notes;
}

export function buildReleaseGuardItem(record: TaskAnalysisRecord): ReleaseGuardItem {
  const releaseRisks = buildReleaseRisks(record);
  const releaseImpactScore = getReleaseImpactScore(record, releaseRisks);
  const guardStatus = getGuardStatus(releaseRisks, releaseImpactScore);

  return {
    taskId: getTaskId(record.task),
    title: record.task.title,
    source: record.task.source,
    status: record.task.status,
    assignee: record.task.assignee,
    score: record.score,
    riskLevel: record.riskLevel,
    releaseImpactScore,
    guardStatus,
    decision: getDecision(guardStatus),
    ownerRole: getOwnerRole(releaseRisks),
    releaseRisks,
    verificationChecklist: buildVerificationChecklist(record, releaseRisks),
    rollbackNotes: buildRollbackNotes(record, releaseRisks)
  };
}

function countRiskTypes(items: ReleaseGuardItem[]): ReleaseGuardReport['topRiskTypes'] {
  const counts = new Map<string, {
    title: string;
    count: number;
  }>();

  for (const risk of items.flatMap((item) => item.releaseRisks)) {
    const current = counts.get(risk.code);
    counts.set(risk.code, {
      title: risk.title,
      count: (current?.count || 0) + 1
    });
  }

  return Array.from(counts.entries())
    .map(([code, value]) => ({
      code,
      title: value.title,
      count: value.count
    }))
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title))
    .slice(0, 8);
}

function getReleaseDecision(items: ReleaseGuardItem[]): ReleaseGuardDecision {
  if (items.some((item) => item.decision === 'no_go')) {
    return 'no_go';
  }

  if (items.some((item) => item.decision === 'review_required')) {
    return 'review_required';
  }

  return 'go';
}

function getReleaseReadinessScore(items: ReleaseGuardItem[], totalTasks: number): number {
  if (totalTasks === 0) {
    return 0;
  }

  const totalPenalty = items.reduce((sum, item) => sum + item.releaseImpactScore, 0);

  return Math.max(0, round(100 - totalPenalty / totalTasks));
}

function buildReleaseChecklist(items: ReleaseGuardItem[], decision: ReleaseGuardDecision): string[] {
  const riskCodes = new Set(items.flatMap((item) => item.releaseRisks.map((risk) => risk.code)));
  const checklist: string[] = [
    'Проверить, что все задачи, блокирующие релиз, имеют владельца и зафиксированный статус.',
    'Зафиксировать результат финальной QA-проверки в задачах или релизных заметках.'
  ];

  if (decision === 'no_go') {
    checklist.unshift('Не выпускать релиз, пока заблокированные/no-go задачи не закрыты.');
  }

  if (riskCodes.has('high_delivery_risk') || riskCodes.has('risky_domain_without_safety_notes')) {
    checklist.push('Провести разбор риска по критичным сценариям и fallback/rollback.');
  }

  if (riskCodes.has('regression_history')) {
    checklist.push('Повторить регрессионные проверки по задачам, которые возвращались с тестирования.');
  }

  if (riskCodes.has('missing_acceptance_criteria') || riskCodes.has('missing_testing_evidence')) {
    checklist.push('Закрыть acceptance criteria и подтверждение QA до решения по релизу.');
  }

  if (riskCodes.has('blocker_or_dependency') || riskCodes.has('unowned_external_dependency')) {
    checklist.push('Подтвердить готовность внешних зависимостей и владельцев.');
  }

  return unique(checklist);
}

export function buildReleaseGuardReport(
  records: TaskAnalysisRecord[],
  options: {
    limit?: number;
    minImpactScore?: number;
    includeReady?: boolean;
    generatedAt?: string;
  } = {}
): ReleaseGuardReport {
  const limit = options.limit ?? 12;
  const minImpactScore = options.minImpactScore ?? 15;
  const allItems = records.map(buildReleaseGuardItem);
  const items = allItems
    .filter((item) =>
      options.includeReady ||
      item.guardStatus !== 'release_ready' ||
      item.releaseImpactScore >= minImpactScore
    )
    .sort((a, b) =>
      b.releaseImpactScore - a.releaseImpactScore ||
      a.taskId.localeCompare(b.taskId)
    )
    .slice(0, limit);
  const releaseDecision = getReleaseDecision(allItems);

  return {
    generatedAt: options.generatedAt || new Date().toISOString(),
    releaseDecision,
    releaseReadinessScore: getReleaseReadinessScore(allItems, records.length),
    totalTasks: records.length,
    includedTasks: items.length,
    summary: {
      releaseReady: allItems.filter((item) => item.guardStatus === 'release_ready').length,
      needsVerification: allItems.filter((item) => item.guardStatus === 'needs_verification').length,
      blocked: allItems.filter((item) => item.guardStatus === 'blocked').length,
      highRiskTasks: records.filter((record) => record.riskLevel === 'high').length,
      qaGapTasks: allItems.filter((item) =>
        item.releaseRisks.some((risk) =>
          risk.code === 'missing_acceptance_criteria' ||
          risk.code === 'missing_testing_evidence' ||
          risk.code === 'dod_not_passed'
        )
      ).length,
      reopenedTasks: records.filter(isReturnedOrReopened).length,
      blockerTasks: records.filter(hasExplicitBlocker).length,
      riskyDomainTasks: records.filter(hasRiskyDomain).length,
      untestedDoneTasks: allItems.filter((item) =>
        item.releaseRisks.some((risk) => risk.code === 'missing_testing_evidence')
      ).length
    },
    topRiskTypes: countRiskTypes(items),
    releaseChecklist: buildReleaseChecklist(allItems, releaseDecision),
    items
  };
}

export function formatReleaseGuardJson(report: ReleaseGuardReport): string {
  return JSON.stringify(report, null, 2);
}

export function formatReleaseGuardCsv(report: ReleaseGuardReport): string {
  const header = [
    'taskId',
    'title',
    'source',
    'status',
    'assignee',
    'score',
    'riskLevel',
    'releaseImpactScore',
    'guardStatus',
    'decision',
    'ownerRole',
    'releaseRisks',
    'verificationChecklist',
    'rollbackNotes'
  ];
  const rows = report.items.map((item) => [
    item.taskId,
    item.title,
    item.source,
    item.status || '',
    item.assignee || '',
    item.score,
    item.riskLevel,
    item.releaseImpactScore,
    item.guardStatus,
    item.decision,
    item.ownerRole,
    item.releaseRisks.map((risk) => `${risk.code}:${risk.severity}:${risk.ownerRole}`).join('|'),
    item.verificationChecklist.join('|'),
    item.rollbackNotes.join('|')
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

function formatRisks(risks: ReleaseGuardRisk[]): string[] {
  return risks.length > 0
    ? risks.map((risk) =>
      `- ${risk.title} [${risk.severity}, ${risk.ownerRole}]: ${risk.recommendation}`
    )
    : ['- Релизных рисков не найдено.'];
}

export function formatReleaseGuardMarkdown(report: ReleaseGuardReport): string {
  const topRiskTypes = report.topRiskTypes.length > 0
    ? report.topRiskTypes.map((risk, index) => `${index + 1}. ${risk.title} - ${risk.count}`)
    : ['Повторяющихся релизных рисков не найдено.'];
  const items = report.items.flatMap((item, index) => [
    `### ${index + 1}. ${item.taskId} - ${tableCell(item.title)}`,
    '',
    `- Решение по задаче: ${item.decision}`,
    `- Статус guard-проверки: ${item.guardStatus}`,
    `- Оценка влияния на релиз: ${item.releaseImpactScore}`,
    `- Clarity Score: ${item.score}/100`,
    `- Риск: ${item.riskLevel}`,
    `- Владелец риска: ${item.ownerRole}`,
    `- Исполнитель: ${item.assignee || 'Не назначен'}`,
    `- Статус: ${item.status || 'Не указан'}`,
    '',
    '**Релизные риски:**',
    '',
    ...formatRisks(item.releaseRisks),
    '',
    '**Чек-лист проверки:**',
    '',
    ...formatList(item.verificationChecklist),
    '',
    '**Заметки по откату:**',
    '',
    ...formatList(item.rollbackNotes),
    ''
  ]);

  return [
    '# Release Guard',
    '',
    `Сформировано: ${report.generatedAt}`,
    '',
    '## Решение по релизу',
    '',
    `- Решение: ${report.releaseDecision}`,
    `- Оценка готовности релиза: ${report.releaseReadinessScore}/100`,
    `- Всего задач: ${report.totalTasks}`,
    `- Задач в guard-отчёте: ${report.includedTasks}`,
    `- Готовы к релизу: ${report.summary.releaseReady}`,
    `- Нужна проверка: ${report.summary.needsVerification}`,
    `- Заблокированные/no-go задачи: ${report.summary.blocked}`,
    `- Высокорисковые задачи: ${report.summary.highRiskTasks}`,
    `- QA-пробелы: ${report.summary.qaGapTasks}`,
    `- Возвращённые/Reopened задачи: ${report.summary.reopenedTasks}`,
    `- Задачи в критичных доменах: ${report.summary.riskyDomainTasks}`,
    '',
    '## Повторяющиеся релизные риски',
    '',
    ...topRiskTypes,
    '',
    '## Чек-лист перед релизом',
    '',
    ...formatList(report.releaseChecklist),
    '',
    '## Задачи для внимания',
    '',
    ...(items.length > 0 ? items : ['Релизных рисков для задач не найдено.'])
  ].join('\n');
}

function formatReleaseGuard(report: ReleaseGuardReport, format: ReportFormat): string {
  if (format === 'json') {
    return formatReleaseGuardJson(report);
  }

  if (format === 'csv') {
    return formatReleaseGuardCsv(report);
  }

  return formatReleaseGuardMarkdown(report);
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

  const limit = parseNumberArg(args, 'limit') ?? 12;
  const minImpactScore = parseNumberArg(args, 'min-impact-score') ?? 15;
  const format = inferReportFormat(outputPath, getStringArg(args, 'format'));
  const tasks = normalizeUnifiedTasks(readJsonFile<unknown>(inputPath));
  const records = analyzeUnifiedTasks(tasks);
  const report = buildReleaseGuardReport(records, {
    limit,
    minImpactScore,
    includeReady: args['include-ready'] === true
  });

  writeReport(outputPath, formatReleaseGuard(report, format));
  process.stdout.write(`Release Guard сохранён: ${outputPath}\n`);
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
