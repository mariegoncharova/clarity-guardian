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
  normalizeUnifiedTasks
} from './task-model';
import {
  getAcceptanceCriteria,
  getContext,
  getExpectedResult,
  getTaskId,
  getTaskText,
  hasAcceptanceCriteria,
  hasContext,
  hasExpectedResult,
  hasExternalDependency,
  hasLargeScope,
  hasOpenBlocker,
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
  TaskAnalysisRecord
} from './types';

export type EvidenceGapSeverity = 'low' | 'medium' | 'high';
export type EvidenceBriefDecision = 'ready_for_execution' | 'clarify_before_start' | 'needs_evidence_review';

export interface EvidenceGap {
  code: string;
  title: string;
  severity: EvidenceGapSeverity;
  ownerRole: 'PM' | 'Tech Lead' | 'QA' | 'Analytics';
  recommendation: string;
}

export interface EvidenceBriefItem {
  taskId: string;
  title: string;
  source: string;
  assignee?: string;
  status?: string;
  score: number;
  riskLevel: 'low' | 'medium' | 'high';
  priorityScore: number;
  decision: EvidenceBriefDecision;
  audience: string[];
  workingHypothesis: string;
  evidenceSignals: string[];
  evidenceGaps: EvidenceGap[];
  questions: string[];
  nextActions: string[];
  communicationFrame: string;
}

export interface EvidenceBriefReport {
  generatedAt: string;
  totalTasks: number;
  includedTasks: number;
  summary: {
    readyForExecution: number;
    clarifyBeforeStart: number;
    needsEvidenceReview: number;
    tasksWithEvidenceGaps: number;
    totalEvidenceGaps: number;
    topGapTypes: Array<{
      code: string;
      name: string;
      count: number;
    }>;
    roleDistribution: Array<{
      name: string;
      count: number;
    }>;
  };
  items: EvidenceBriefItem[];
}

const GAP_LABELS: Record<string, string> = {
  missing_context: 'Нет контекста проблемы',
  missing_evidence_source: 'Нет источника наблюдения',
  missing_expected_result: 'Нет проверяемого результата',
  missing_acceptance_criteria: 'Нет метода проверки',
  missing_reproduction_steps: 'Нет шагов воспроизведения',
  missing_metric: 'Нет метрики успеха',
  dependency_not_traceable: 'Неясная внешняя зависимость',
  scope_not_testable: 'Слишком широкий scope',
  vague_language: 'Размытая формулировка'
};

const CLAIM_KEYWORDS = [
  'пользователи жалуются',
  'пользователи сообщают',
  'пользователи не понимают',
  'пользователям нужно',
  'команде аналитики',
  'support receives',
  'users complain',
  'users report',
  'buyers need',
  'customers need',
  'blocks paid orders',
  'увеличивает обращения',
  'снижает конверсию',
  'медленно',
  'slow'
];

const EVIDENCE_SOURCE_KEYWORDS = [
  'по данным',
  'данные',
  'метрик',
  'analytics',
  'dashboard',
  'дашборд',
  'лог',
  'logs',
  'lighthouse',
  'support',
  'поддержк',
  'опрос',
  'интервью',
  'research',
  'исслед',
  'staging',
  'qa passed',
  'протестировано',
  'проверено'
];

const MEASUREMENT_NEED_KEYWORDS = [
  'analytics',
  'аналитик',
  'dashboard',
  'дашборд',
  'метрик',
  'конверси',
  'conversion',
  'support tickets',
  'обращени',
  'жалоб',
  'чаще',
  'most often',
  'медлен',
  'быстр',
  'увелич',
  'сниз',
  'уменьш',
  'performance',
  'lighthouse',
  'оптимиз',
  'исслед',
  'experiment',
  'эксперимент',
  'a/b'
];

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

function includesAny(text: string, keywords: string[]): boolean {
  const normalized = normalizeText(text).toLowerCase();

  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

function hasMetricValue(record: TaskAnalysisRecord): boolean {
  const metrics = record.task.metrics;
  const hasNumericMetric = Boolean(metrics && Object.values(metrics).some((value) =>
    typeof value === 'number' && Number.isFinite(value)
  ));

  if (hasNumericMetric) {
    return true;
  }

  return /\d+(?:[.,]\d+)?\s?(?:%|ms|мс|sec|сек|seconds?|мин|minutes?|hour|hours?|час|дн|days?|балл|score)|fcp|first contentful paint|lighthouse|p95|p99|sla/i
    .test(getTaskText(record.task));
}

function needsMetric(record: TaskAnalysisRecord): boolean {
  return record.task.workItemType === 'research' ||
    includesAny(getTaskText(record.task), MEASUREMENT_NEED_KEYWORDS);
}

function hasEvidenceSource(record: TaskAnalysisRecord): boolean {
  return hasTestingSignal(record.task) ||
    includesAny(getTaskText(record.task), EVIDENCE_SOURCE_KEYWORDS);
}

function hasUserOrBusinessClaim(record: TaskAnalysisRecord): boolean {
  return includesAny(getTaskText(record.task), CLAIM_KEYWORDS);
}

function hasReproductionSignal(record: TaskAnalysisRecord): boolean {
  return includesAny(getTaskText(record.task), [
    'шаги воспроизведения',
    'как воспроизвести',
    'steps to reproduce',
    'actual result',
    'actual outcome',
    'фактический результат',
    'окружение',
    'environment'
  ]);
}

function addGap(gaps: EvidenceGap[], gap: EvidenceGap): void {
  if (!gaps.some((item) => item.code === gap.code)) {
    gaps.push(gap);
  }
}

function buildEvidenceGaps(record: TaskAnalysisRecord): EvidenceGap[] {
  const gaps: EvidenceGap[] = [];
  const dependencies = record.task.dependencies || [];

  if (!hasContext(record.task)) {
    addGap(gaps, {
      code: 'missing_context',
      title: GAP_LABELS.missing_context,
      severity: 'high',
      ownerRole: 'PM',
      recommendation: 'Добавить, какую проблему, для кого и почему команда решает.'
    });
  }

  if (hasUserOrBusinessClaim(record) && !hasEvidenceSource(record)) {
    addGap(gaps, {
      code: 'missing_evidence_source',
      title: GAP_LABELS.missing_evidence_source,
      severity: record.riskLevel === 'high' ? 'high' : 'medium',
      ownerRole: 'PM',
      recommendation: 'Указать источник наблюдения: метрика, обращение support, исследование, лог или ссылка на обсуждение.'
    });
  }

  if (!hasExpectedResult(record.task)) {
    addGap(gaps, {
      code: 'missing_expected_result',
      title: GAP_LABELS.missing_expected_result,
      severity: 'high',
      ownerRole: 'PM',
      recommendation: 'Сформулировать проверяемый результат, который одинаково поймут PM, разработчик и QA.'
    });
  }

  if (!hasAcceptanceCriteria(record.task)) {
    addGap(gaps, {
      code: 'missing_acceptance_criteria',
      title: GAP_LABELS.missing_acceptance_criteria,
      severity: 'high',
      ownerRole: 'QA',
      recommendation: 'Добавить критерии приёмки как воспроизводимый метод проверки результата.'
    });
  }

  if (record.task.workItemType === 'bug' && !hasReproductionSignal(record)) {
    addGap(gaps, {
      code: 'missing_reproduction_steps',
      title: GAP_LABELS.missing_reproduction_steps,
      severity: 'high',
      ownerRole: 'QA',
      recommendation: 'Добавить шаги воспроизведения, фактический результат, ожидаемый результат и окружение.'
    });
  }

  if (needsMetric(record) && !hasMetricValue(record)) {
    addGap(gaps, {
      code: 'missing_metric',
      title: GAP_LABELS.missing_metric,
      severity: 'medium',
      ownerRole: 'Analytics',
      recommendation: 'Добавить метрику успеха или наблюдаемый proxy-сигнал для проверки эффекта.'
    });
  }

  if ((hasExternalDependency(record.task) || hasOpenBlocker(record.task)) && dependencies.length === 0) {
    addGap(gaps, {
      code: 'dependency_not_traceable',
      title: GAP_LABELS.dependency_not_traceable,
      severity: 'medium',
      ownerRole: 'Tech Lead',
      recommendation: 'Вынести зависимость в отдельное поле: кто отвечает, какой артефакт нужен и когда ждать ответ.'
    });
  }

  if (hasLargeScope(record.task)) {
    addGap(gaps, {
      code: 'scope_not_testable',
      title: GAP_LABELS.scope_not_testable,
      severity: 'medium',
      ownerRole: 'PM',
      recommendation: 'Разбить широкий scope на несколько проверяемых гипотез или технических шагов.'
    });
  }

  if (hasVagueWording(record.task)) {
    addGap(gaps, {
      code: 'vague_language',
      title: GAP_LABELS.vague_language,
      severity: 'medium',
      ownerRole: 'PM',
      recommendation: 'Заменить размытые формулировки на наблюдаемое поведение продукта и критерии проверки.'
    });
  }

  return gaps;
}

function shorten(value: string, maxLength = 220): string {
  const text = normalizeText(value).replace(/\s+/g, ' ');

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1).trim()}...`;
}

function asSentence(value: string, maxLength = 220): string {
  const text = shorten(value, maxLength);

  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function buildWorkingHypothesis(record: TaskAnalysisRecord): string {
  const context = getContext(record.task);
  const expectedResult = getExpectedResult(record.task);
  const acceptanceCriteria = getAcceptanceCriteria(record.task);

  if (context && expectedResult) {
    const verification = acceptanceCriteria[0]
      ? ` Проверка: ${asSentence(acceptanceCriteria[0], 140)}`
      : ' Проверку нужно описать отдельно.';

    return `Проблема: ${asSentence(context)} Ожидаемое изменение: ${asSentence(expectedResult)}${verification}`;
  }

  if (context) {
    return `Проблема описана, но гипотезу нужно завершить ожидаемым результатом: ${asSentence(context)}`;
  }

  return `Сформулировать проверяемую гипотезу для задачи "${shorten(record.task.title, 120)}": что меняем, для кого, какой эффект ожидаем и как проверяем.`;
}

function buildEvidenceSignals(record: TaskAnalysisRecord): string[] {
  const signals: string[] = [];

  if (hasContext(record.task)) {
    signals.push('Проблемный контекст описан.');
  }

  if (hasEvidenceSource(record)) {
    signals.push('Есть источник наблюдения или проверочный сигнал.');
  }

  if (hasExpectedResult(record.task)) {
    signals.push('Ожидаемый результат сформулирован.');
  }

  if (hasAcceptanceCriteria(record.task)) {
    signals.push('Есть воспроизводимый метод проверки через критерии приёмки.');
  }

  if (hasMetricValue(record)) {
    signals.push('Есть измеримый критерий или метрика.');
  }

  if ((record.task.dependencies || []).length > 0) {
    signals.push('Внешние зависимости описаны явно.');
  }

  return signals.length > 0 ? signals : ['Сигналы доказательности пока не найдены.'];
}

function buildAudience(record: TaskAnalysisRecord): string[] {
  const text = getTaskText(record.task).toLowerCase();
  const audience = new Set<string>(['PM']);

  if (/backend|frontend|api|интеграц|миграц|performance|оптимиз|checkout|payment|плат/i.test(text)) {
    audience.add('Engineering');
  }

  if (hasAcceptanceCriteria(record.task) || /qa|testing|тест|провер/i.test(text)) {
    audience.add('QA');
  }

  if (/analytics|аналитик|metric|метрик|dashboard|дашборд|event|событи/i.test(text)) {
    audience.add('Analytics');
  }

  if (/support|поддержк|ticket|обращени/i.test(text)) {
    audience.add('Support');
  }

  return Array.from(audience);
}

function getGapQuestion(gap: EvidenceGap): string {
  if (gap.code === 'missing_context') {
    return 'Какую пользовательскую, бизнес- или техническую проблему решает задача?';
  }

  if (gap.code === 'missing_evidence_source') {
    return 'На какие данные, обращения, логи или исследовательские наблюдения мы опираемся?';
  }

  if (gap.code === 'missing_expected_result') {
    return 'Какой результат будет считаться успешным и наблюдаемым?';
  }

  if (gap.code === 'missing_acceptance_criteria') {
    return 'Как QA или reviewer сможет воспроизвести проверку результата?';
  }

  if (gap.code === 'missing_reproduction_steps') {
    return 'Какие шаги, окружение и фактический результат нужны для воспроизведения бага?';
  }

  if (gap.code === 'missing_metric') {
    return 'Какая метрика или proxy-сигнал покажет, что изменение сработало?';
  }

  if (gap.code === 'dependency_not_traceable') {
    return 'Кто владеет внешней зависимостью и какой артефакт нужен до старта?';
  }

  if (gap.code === 'scope_not_testable') {
    return 'Как разделить scope на меньшие проверяемые решения?';
  }

  return 'Как переписать формулировку так, чтобы она описывала наблюдаемое поведение?';
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function buildNextActions(gaps: EvidenceGap[]): string[] {
  if (gaps.length === 0) {
    return ['Сохранить задачу как пример brief-формата для planning и QA handoff.'];
  }

  const actions = gaps.map((gap) => gap.recommendation);

  if (gaps.some((gap) => gap.severity === 'high')) {
    actions.unshift('Обновить задачу до refinement: claim, evidence, decision и verification должны быть видны в описании.');
  }

  return unique(actions);
}

function buildCommunicationFrame(gaps: EvidenceGap[]): string {
  const codes = new Set(gaps.map((gap) => gap.code));

  if (codes.has('missing_context') || codes.has('missing_evidence_source')) {
    return 'Вести обсуждение как короткий evidence brief: наблюдение -> источник -> решение -> метод проверки.';
  }

  if (
    codes.has('missing_expected_result') ||
    codes.has('missing_acceptance_criteria') ||
    codes.has('missing_reproduction_steps')
  ) {
    return 'Переписать задачу в структуре: проблема -> проверяемый результат -> критерии воспроизведения.';
  }

  if (codes.has('missing_metric')) {
    return 'Согласовать PM/Analytics frame: какая метрика меняется, где смотрим данные и когда принимаем решение.';
  }

  if (gaps.length > 0) {
    return 'Перед стартом синхронизировать роли и договорённости в одном письменном brief.';
  }

  return 'Задача уже похожа на evidence brief: её можно использовать для planning, разработки и QA handoff.';
}

function severityWeight(severity: EvidenceGapSeverity): number {
  if (severity === 'high') {
    return 18;
  }

  if (severity === 'medium') {
    return 10;
  }

  return 4;
}

function getPriorityScore(record: TaskAnalysisRecord, gaps: EvidenceGap[]): number {
  const riskWeight = record.riskLevel === 'high'
    ? 22
    : record.riskLevel === 'medium'
      ? 10
      : 0;
  const gapWeight = gaps.reduce((sum, gap) => sum + severityWeight(gap.severity), 0);
  const coreGapWeight = gaps.filter((gap) =>
    gap.code === 'missing_context' ||
    gap.code === 'missing_expected_result' ||
    gap.code === 'missing_acceptance_criteria' ||
    gap.code === 'missing_reproduction_steps'
  ).length * 6;

  return Math.min(100, round((100 - record.score) * 0.55 + riskWeight + gapWeight + coreGapWeight));
}

function getDecision(
  record: TaskAnalysisRecord,
  gaps: EvidenceGap[],
  priorityScore: number
): EvidenceBriefDecision {
  const highGaps = gaps.filter((gap) => gap.severity === 'high').length;

  if (gaps.length === 0) {
    return 'ready_for_execution';
  }

  if (highGaps >= 2 || priorityScore >= 70 || record.riskLevel === 'high') {
    return 'needs_evidence_review';
  }

  return 'clarify_before_start';
}

function toEvidenceBriefItem(record: TaskAnalysisRecord): EvidenceBriefItem {
  const evidenceGaps = buildEvidenceGaps(record);
  const priorityScore = getPriorityScore(record, evidenceGaps);
  const questions = unique([
    ...evidenceGaps.map(getGapQuestion),
    ...record.analysis.clarityFixSuggestions.questions
  ]).slice(0, 8);

  return {
    taskId: getTaskId(record.task),
    title: record.task.title,
    source: record.task.source,
    assignee: record.task.assignee,
    status: record.task.status,
    score: record.score,
    riskLevel: record.riskLevel,
    priorityScore,
    decision: getDecision(record, evidenceGaps, priorityScore),
    audience: buildAudience(record),
    workingHypothesis: buildWorkingHypothesis(record),
    evidenceSignals: buildEvidenceSignals(record),
    evidenceGaps,
    questions,
    nextActions: buildNextActions(evidenceGaps),
    communicationFrame: buildCommunicationFrame(evidenceGaps)
  };
}

function countGapTypes(items: EvidenceBriefItem[]): EvidenceBriefReport['summary']['topGapTypes'] {
  const counts = new Map<string, number>();

  for (const gap of items.flatMap((item) => item.evidenceGaps)) {
    counts.set(gap.code, (counts.get(gap.code) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([code, count]) => ({
      code,
      name: GAP_LABELS[code] || code,
      count
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 7);
}

function countRoles(items: EvidenceBriefItem[]): EvidenceBriefReport['summary']['roleDistribution'] {
  const counts = new Map<string, number>();

  for (const gap of items.flatMap((item) => item.evidenceGaps)) {
    counts.set(gap.ownerRole, (counts.get(gap.ownerRole) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function buildEvidenceBriefReport(
  records: TaskAnalysisRecord[],
  options: {
    limit?: number;
    minPriorityScore?: number;
    includeReady?: boolean;
    generatedAt?: string;
  } = {}
): EvidenceBriefReport {
  const limit = options.limit ?? 10;
  const minPriorityScore = options.minPriorityScore ?? 25;
  const items = records
    .map(toEvidenceBriefItem)
    .filter((item) =>
      options.includeReady ||
      (item.evidenceGaps.length > 0 && item.priorityScore >= minPriorityScore)
    )
    .sort((a, b) => b.priorityScore - a.priorityScore || a.taskId.localeCompare(b.taskId))
    .slice(0, limit);

  return {
    generatedAt: options.generatedAt || new Date().toISOString(),
    totalTasks: records.length,
    includedTasks: items.length,
    summary: {
      readyForExecution: items.filter((item) => item.decision === 'ready_for_execution').length,
      clarifyBeforeStart: items.filter((item) => item.decision === 'clarify_before_start').length,
      needsEvidenceReview: items.filter((item) => item.decision === 'needs_evidence_review').length,
      tasksWithEvidenceGaps: items.filter((item) => item.evidenceGaps.length > 0).length,
      totalEvidenceGaps: items.reduce((sum, item) => sum + item.evidenceGaps.length, 0),
      topGapTypes: countGapTypes(items),
      roleDistribution: countRoles(items)
    },
    items
  };
}

export function formatEvidenceBriefJson(report: EvidenceBriefReport): string {
  return JSON.stringify(report, null, 2);
}

export function formatEvidenceBriefCsv(report: EvidenceBriefReport): string {
  const header = [
    'taskId',
    'title',
    'source',
    'assignee',
    'status',
    'score',
    'riskLevel',
    'priorityScore',
    'decision',
    'audience',
    'evidenceSignals',
    'evidenceGaps',
    'questions',
    'nextActions',
    'workingHypothesis'
  ];
  const rows = report.items.map((item) => [
    item.taskId,
    item.title,
    item.source,
    item.assignee || '',
    item.status || '',
    item.score,
    item.riskLevel,
    item.priorityScore,
    item.decision,
    item.audience.join('|'),
    item.evidenceSignals.join('|'),
    item.evidenceGaps.map((gap) => `${gap.code}:${gap.severity}:${gap.ownerRole}`).join('|'),
    item.questions.join('|'),
    item.nextActions.join('|'),
    item.workingHypothesis
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

function formatGaps(gaps: EvidenceGap[]): string[] {
  return gaps.length > 0
    ? gaps.map((gap) =>
      `- ${gap.title} [${gap.severity}, ${gap.ownerRole}]: ${gap.recommendation}`
    )
    : ['- Evidence gaps не найдены.'];
}

export function formatEvidenceBriefMarkdown(report: EvidenceBriefReport): string {
  const topGaps = report.summary.topGapTypes.length > 0
    ? report.summary.topGapTypes.map((gap, index) => `${index + 1}. ${gap.name} - ${gap.count}`)
    : ['Повторяющихся evidence gaps не найдено.'];
  const roleDistribution = report.summary.roleDistribution.length > 0
    ? report.summary.roleDistribution.map((role) => `- ${role.name}: ${role.count}`)
    : ['- Нет gap-владельцев.'];
  const items = report.items.flatMap((item, index) => [
    `### ${index + 1}. ${item.taskId} - ${tableCell(item.title)}`,
    '',
    `- Decision: ${item.decision}`,
    `- Priority Score: ${item.priorityScore}`,
    `- Clarity Score: ${item.score}/100`,
    `- Risk: ${item.riskLevel}`,
    `- Audience: ${item.audience.join(', ')}`,
    `- Assignee: ${item.assignee || 'Не назначен'}`,
    `- Status: ${item.status || 'Не указан'}`,
    '',
    '**Working hypothesis:**',
    '',
    item.workingHypothesis,
    '',
    '**Evidence signals:**',
    '',
    ...formatList(item.evidenceSignals),
    '',
    '**Evidence gaps:**',
    '',
    ...formatGaps(item.evidenceGaps),
    '',
    '**Questions before handoff:**',
    '',
    ...formatList(item.questions),
    '',
    '**Next actions:**',
    '',
    ...formatList(item.nextActions),
    '',
    '**Communication frame:**',
    '',
    item.communicationFrame,
    ''
  ]);

  return [
    '# Evidence Brief',
    '',
    `Generated at: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    `- Total tasks analyzed: ${report.totalTasks}`,
    `- Tasks in brief: ${report.includedTasks}`,
    `- Ready for execution: ${report.summary.readyForExecution}`,
    `- Clarify before start: ${report.summary.clarifyBeforeStart}`,
    `- Needs evidence review: ${report.summary.needsEvidenceReview}`,
    `- Tasks with evidence gaps: ${report.summary.tasksWithEvidenceGaps}`,
    `- Total evidence gaps: ${report.summary.totalEvidenceGaps}`,
    '',
    '## Top Evidence Gaps',
    '',
    ...topGaps,
    '',
    '## Role Focus',
    '',
    ...roleDistribution,
    '',
    '## Task Briefs',
    '',
    ...(items.length > 0 ? items : ['Задач для evidence brief не найдено.'])
  ].join('\n');
}

function formatEvidenceBrief(report: EvidenceBriefReport, format: ReportFormat): string {
  if (format === 'json') {
    return formatEvidenceBriefJson(report);
  }

  if (format === 'csv') {
    return formatEvidenceBriefCsv(report);
  }

  return formatEvidenceBriefMarkdown(report);
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
  const minPriorityScore = parseNumberArg(args, 'min-priority-score') ?? 25;
  const format = inferReportFormat(outputPath, getStringArg(args, 'format'));
  const tasks = normalizeUnifiedTasks(readJsonFile<unknown>(inputPath));
  const records = analyzeUnifiedTasks(tasks);
  const report = buildEvidenceBriefReport(records, {
    limit,
    minPriorityScore,
    includeReady: args['include-ready'] === true
  });

  writeReport(outputPath, formatEvidenceBrief(report, format));
  process.stdout.write(`Evidence Brief сохранён: ${outputPath}\n`);
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
