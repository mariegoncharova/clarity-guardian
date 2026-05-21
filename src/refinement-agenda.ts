import {
  analyzeUnifiedTasks,
  PROBLEM_LABELS
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
  findKeywords,
  getTaskId,
  getTaskText,
  hasAcceptanceCriteria,
  hasLargeScope,
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

export type RefinementAgendaDecision =
  | 'ready_to_commit'
  | 'clarify_requirements'
  | 'split_scope'
  | 'resolve_blocker'
  | 'risk_review';

export type RefinementAgendaReadiness =
  | 'must_refine'
  | 'needs_team_alignment'
  | 'ready_candidate';

export type RefinementOwnerRole =
  | 'PM'
  | 'Tech Lead'
  | 'QA'
  | 'Analytics'
  | 'Engineering';

export interface RefinementAgendaItem {
  taskId: string;
  title: string;
  source: string;
  assignee?: string;
  status?: string;
  priority?: string;
  score: number;
  riskLevel: 'low' | 'medium' | 'high';
  priorityScore: number;
  readiness: RefinementAgendaReadiness;
  decision: RefinementAgendaDecision;
  ownerRole: RefinementOwnerRole;
  attendees: RefinementOwnerRole[];
  timeboxMinutes: number;
  reasons: string[];
  questions: string[];
  prepBeforeMeeting: string[];
  decisionsToCapture: string[];
  expectedOutcome: string;
}

export interface RefinementAgendaReport {
  generatedAt: string;
  totalTasks: number;
  includedTasks: number;
  totalTimeboxMinutes: number;
  summary: {
    mustRefine: number;
    needsTeamAlignment: number;
    readyCandidates: number;
    blockerItems: number;
    splitScopeItems: number;
    riskReviewItems: number;
    roleDistribution: Array<{
      name: string;
      count: number;
    }>;
    topReasons: Array<{
      name: string;
      count: number;
    }>;
  };
  items: RefinementAgendaItem[];
}

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

function isHighPriority(priority: string | undefined): boolean {
  const normalized = normalizeText(priority).toLowerCase();

  return /critical|highest|high|blocker|критич|высок|блокер/.test(normalized);
}

function hasRiskyDomain(record: TaskAnalysisRecord): boolean {
  return findKeywords(getTaskText(record.task), RISKY_DOMAIN_KEYWORDS).length > 0;
}

function hasAnalyticsFocus(record: TaskAnalysisRecord): boolean {
  return /analytics|аналитик|metric|метрик|dashboard|дашборд|event|событи|conversion|конверси/i
    .test(getTaskText(record.task));
}

function hasEngineeringFocus(record: TaskAnalysisRecord): boolean {
  return /backend|frontend|api|интеграц|миграц|performance|оптимиз|checkout|payment|плат/i
    .test(getTaskText(record.task));
}

function hasQaFocus(record: TaskAnalysisRecord): boolean {
  return record.task.workItemType === 'bug' ||
    hasAcceptanceCriteria(record.task) ||
    record.problemCodes.includes('missing_acceptance_criteria') ||
    record.problemCodes.includes('unclear_testing') ||
    /qa|testing|тест|провер|reproduce|воспроизв/i.test(getTaskText(record.task));
}

function hasCoreMissingProblem(record: TaskAnalysisRecord): boolean {
  return record.problemCodes.some((code) =>
    code === 'missing_context' ||
    code === 'missing_expected_result' ||
    code === 'missing_acceptance_criteria'
  );
}

function shouldSplitScope(record: TaskAnalysisRecord): boolean {
  return hasLargeScope(record.task) ||
    record.problemCodes.includes('task_too_large');
}

function shouldResolveBlocker(record: TaskAnalysisRecord): boolean {
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

function getDecision(record: TaskAnalysisRecord): RefinementAgendaDecision {
  if (shouldResolveBlocker(record)) {
    return 'resolve_blocker';
  }

  if (shouldSplitScope(record)) {
    return 'split_scope';
  }

  if (
    record.riskLevel === 'high' ||
    (hasRiskyDomain(record) && record.score < 75)
  ) {
    return 'risk_review';
  }

  if (
    hasCoreMissingProblem(record) ||
    record.analysis.clarityFixSuggestions.questions.length > 0 ||
    record.score < 80
  ) {
    return 'clarify_requirements';
  }

  return 'ready_to_commit';
}

function getOwnerRole(record: TaskAnalysisRecord, decision: RefinementAgendaDecision): RefinementOwnerRole {
  if (decision === 'resolve_blocker' || decision === 'split_scope' || decision === 'risk_review') {
    return 'Tech Lead';
  }

  if (
    record.problemCodes.includes('missing_acceptance_criteria') ||
    record.problemCodes.includes('unclear_testing') ||
    record.task.workItemType === 'bug'
  ) {
    return 'QA';
  }

  if (hasAnalyticsFocus(record)) {
    return 'Analytics';
  }

  return 'PM';
}

function buildAttendees(record: TaskAnalysisRecord, ownerRole: RefinementOwnerRole): RefinementOwnerRole[] {
  const attendees: RefinementOwnerRole[] = ['PM', ownerRole];

  if (hasEngineeringFocus(record) || shouldResolveBlocker(record) || shouldSplitScope(record)) {
    attendees.push('Engineering');
  }

  if (hasQaFocus(record)) {
    attendees.push('QA');
  }

  if (hasAnalyticsFocus(record)) {
    attendees.push('Analytics');
  }

  if (ownerRole === 'Tech Lead') {
    attendees.push('Tech Lead');
  }

  return unique(attendees);
}

function getTimeboxMinutes(
  record: TaskAnalysisRecord,
  decision: RefinementAgendaDecision
): number {
  const base = {
    ready_to_commit: 4,
    clarify_requirements: 8,
    risk_review: 10,
    split_scope: 12,
    resolve_blocker: 12
  } satisfies Record<RefinementAgendaDecision, number>;
  const extra = (record.riskLevel === 'high' ? 2 : 0) +
    (isHighPriority(record.task.priority) ? 2 : 0);

  return Math.min(15, base[decision] + extra);
}

function getPriorityScore(
  record: TaskAnalysisRecord,
  decision: RefinementAgendaDecision
): number {
  const riskWeight = record.riskLevel === 'high'
    ? 25
    : record.riskLevel === 'medium'
      ? 10
      : 0;
  const decisionWeight = {
    ready_to_commit: 0,
    clarify_requirements: 8,
    risk_review: 14,
    split_scope: 16,
    resolve_blocker: 20
  } satisfies Record<RefinementAgendaDecision, number>;
  const questionWeight = Math.min(
    14,
    record.analysis.clarityFixSuggestions.questions.length * 3
  );
  const coreMissingWeight = record.problemCodes.filter((code) =>
    code === 'missing_context' ||
    code === 'missing_expected_result' ||
    code === 'missing_acceptance_criteria'
  ).length * 5;
  const priorityWeight = isHighPriority(record.task.priority) ? 8 : 0;
  const vagueWeight = hasVagueWording(record.task) ? 4 : 0;
  const activeStatusWeight = record.task.status && !isDoneStatus(record.task.status) ? 4 : 0;

  return Math.min(100, round(
    (100 - record.score) * 0.6 +
    riskWeight +
    decisionWeight[decision] +
    questionWeight +
    coreMissingWeight +
    priorityWeight +
    vagueWeight +
    activeStatusWeight
  ));
}

function getReadiness(
  priorityScore: number,
  decision: RefinementAgendaDecision
): RefinementAgendaReadiness {
  if (decision === 'ready_to_commit') {
    return 'ready_candidate';
  }

  if (priorityScore >= 75 || decision === 'resolve_blocker') {
    return 'must_refine';
  }

  return 'needs_team_alignment';
}

function getReasons(record: TaskAnalysisRecord, decision: RefinementAgendaDecision): string[] {
  const reasons = record.problemCodes.map((code) => PROBLEM_LABELS[code] || code);

  if (decision === 'resolve_blocker') {
    reasons.push('Есть blocker или внешняя зависимость');
  }

  if (decision === 'split_scope') {
    reasons.push('Нужна декомпозиция scope');
  }

  if (decision === 'risk_review') {
    reasons.push('Нужен отдельный risk review');
  }

  if (hasRiskyDomain(record)) {
    reasons.push('Рискованный домен или критичный пользовательский сценарий');
  }

  if (isHighPriority(record.task.priority)) {
    reasons.push('Высокий приоритет');
  }

  if (reasons.length === 0) {
    reasons.push('Готова к короткому подтверждению перед commitment');
  }

  return unique(reasons).slice(0, 8);
}

function getDecisionQuestions(
  record: TaskAnalysisRecord,
  decision: RefinementAgendaDecision
): string[] {
  const questions = [...record.analysis.clarityFixSuggestions.questions];
  const prependQuestion = (question: string, duplicatePatterns: RegExp[]): void => {
    const alreadyCovered = questions.some((item) => {
      const normalized = normalizeText(item).toLowerCase();

      return duplicatePatterns.some((pattern) => pattern.test(normalized));
    });

    if (!alreadyCovered) {
      questions.unshift(question);
    }
  };

  if (decision === 'resolve_blocker') {
    questions.unshift('Кто владеет зависимостью, какой артефакт нужен и к какой дате?');
  }

  if (decision === 'split_scope') {
    questions.unshift('Какой минимальный проверяемый scope можно взять в ближайшую итерацию?');
  }

  if (decision === 'risk_review') {
    questions.unshift('Какие edge cases, fallback и rollback должны быть согласованы до старта?');
  }

  if (record.problemCodes.includes('missing_acceptance_criteria')) {
    prependQuestion(
      'Какие критерии приёмки позволят QA проверить результат без дополнительных уточнений?',
      [/критери/, /acceptance/, /qa.*готов/]
    );
  }

  if (record.problemCodes.includes('missing_expected_result')) {
    prependQuestion(
      'Какой наблюдаемый результат должен появиться после выполнения задачи?',
      [/ожидаем/, /expected/, /поведение.*правиль/, /результат.*успеш/]
    );
  }

  if (record.problemCodes.includes('missing_context')) {
    prependQuestion(
      'Какую проблему пользователя, бизнеса или команды решает задача?',
      [/какую.*проблем/, /context/, /контекст/]
    );
  }

  if (decision === 'ready_to_commit') {
    questions.push('Подтверждаем ли commitment: scope, владельца и критерии проверки без дополнительных уточнений?');
  }

  return unique(questions).slice(0, 8);
}

function getPrepBeforeMeeting(
  decision: RefinementAgendaDecision,
  ownerRole: RefinementOwnerRole
): string[] {
  if (decision === 'resolve_blocker') {
    return [
      'Подготовить статус зависимости, владельца и ожидаемый артефакт.',
      'Принести вариант обходного решения, если зависимость не закроется вовремя.'
    ];
  }

  if (decision === 'split_scope') {
    return [
      'Разметить обязательный и отложенный scope.',
      'Подготовить вариант разбиения на маленькие проверяемые задачи.'
    ];
  }

  if (decision === 'risk_review') {
    return [
      'Собрать edge cases, ограничения и критичные сценарии.',
      'Подготовить QA/risk notes для проверки и безопасного релиза.'
    ];
  }

  if (decision === 'clarify_requirements') {
    return [
      `${ownerRole}: подготовить контекст, ожидаемый результат и критерии приёмки.`,
      'Автору задачи обновить описание сразу после refinement.'
    ];
  }

  return [
    'Проверить, что scope, владелец и критерии приёмки всё ещё актуальны.',
    'Подготовить короткое yes/no решение по commitment.'
  ];
}

function getDecisionsToCapture(decision: RefinementAgendaDecision): string[] {
  if (decision === 'resolve_blocker') {
    return [
      'Владелец зависимости и дата следующего сигнала.',
      'Что делаем, если зависимость не закрывается вовремя.'
    ];
  }

  if (decision === 'split_scope') {
    return [
      'Граница ближайшего scope.',
      'Что явно уходит в follow-up задачи.'
    ];
  }

  if (decision === 'risk_review') {
    return [
      'Критичные сценарии и rollback/fallback правила.',
      'Минимальный QA checklist перед релизом.'
    ];
  }

  if (decision === 'clarify_requirements') {
    return [
      'Финальная формулировка контекста, результата и критериев приёмки.',
      'Кто обновляет задачу и когда она считается ready.'
    ];
  }

  return [
    'Подтверждение ready-to-commit.',
    'Владелец реализации и владелец проверки.'
  ];
}

function getExpectedOutcome(decision: RefinementAgendaDecision): string {
  if (decision === 'resolve_blocker') {
    return 'После обсуждения у команды есть владелец зависимости, срок и fallback-план.';
  }

  if (decision === 'split_scope') {
    return 'После обсуждения scope разложен на маленькие проверяемые задачи.';
  }

  if (decision === 'risk_review') {
    return 'После обсуждения риск, edge cases и verification plan зафиксированы до старта.';
  }

  if (decision === 'clarify_requirements') {
    return 'После обсуждения задача получает ясный контекст, результат и критерии приёмки.';
  }

  return 'После обсуждения задачу можно брать в commitment без дополнительных уточнений.';
}

function toRefinementAgendaItem(record: TaskAnalysisRecord): RefinementAgendaItem {
  const decision = getDecision(record);
  const ownerRole = getOwnerRole(record, decision);
  const priorityScore = getPriorityScore(record, decision);

  return {
    taskId: getTaskId(record.task),
    title: record.task.title,
    source: record.task.source,
    assignee: record.task.assignee,
    status: record.task.status,
    priority: record.task.priority,
    score: record.score,
    riskLevel: record.riskLevel,
    priorityScore,
    readiness: getReadiness(priorityScore, decision),
    decision,
    ownerRole,
    attendees: buildAttendees(record, ownerRole),
    timeboxMinutes: getTimeboxMinutes(record, decision),
    reasons: getReasons(record, decision),
    questions: getDecisionQuestions(record, decision),
    prepBeforeMeeting: getPrepBeforeMeeting(decision, ownerRole),
    decisionsToCapture: getDecisionsToCapture(decision),
    expectedOutcome: getExpectedOutcome(decision)
  };
}

function countBy(values: string[]): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function buildRefinementAgendaReport(
  records: TaskAnalysisRecord[],
  options: {
    limit?: number;
    minPriorityScore?: number;
    includeReady?: boolean;
    includeDone?: boolean;
    generatedAt?: string;
  } = {}
): RefinementAgendaReport {
  const limit = options.limit ?? 8;
  const minPriorityScore = options.minPriorityScore ?? 20;
  const items = records
    .map(toRefinementAgendaItem)
    .filter((item) => options.includeDone || !isDoneStatus(item.status))
    .filter((item) =>
      (options.includeReady || item.decision !== 'ready_to_commit') &&
      (item.priorityScore >= minPriorityScore || item.readiness === 'must_refine')
    )
    .sort((a, b) =>
      b.priorityScore - a.priorityScore ||
      b.timeboxMinutes - a.timeboxMinutes ||
      a.taskId.localeCompare(b.taskId)
    )
    .slice(0, limit);

  return {
    generatedAt: options.generatedAt || new Date().toISOString(),
    totalTasks: records.length,
    includedTasks: items.length,
    totalTimeboxMinutes: items.reduce((sum, item) => sum + item.timeboxMinutes, 0),
    summary: {
      mustRefine: items.filter((item) => item.readiness === 'must_refine').length,
      needsTeamAlignment: items.filter((item) => item.readiness === 'needs_team_alignment').length,
      readyCandidates: items.filter((item) => item.readiness === 'ready_candidate').length,
      blockerItems: items.filter((item) => item.decision === 'resolve_blocker').length,
      splitScopeItems: items.filter((item) => item.decision === 'split_scope').length,
      riskReviewItems: items.filter((item) => item.decision === 'risk_review').length,
      roleDistribution: countBy(items.flatMap((item) => item.attendees)),
      topReasons: countBy(items.flatMap((item) => item.reasons)).slice(0, 7)
    },
    items
  };
}

export function formatRefinementAgendaJson(report: RefinementAgendaReport): string {
  return JSON.stringify(report, null, 2);
}

export function formatRefinementAgendaCsv(report: RefinementAgendaReport): string {
  const header = [
    'taskId',
    'title',
    'source',
    'assignee',
    'status',
    'priority',
    'score',
    'riskLevel',
    'priorityScore',
    'readiness',
    'decision',
    'ownerRole',
    'attendees',
    'timeboxMinutes',
    'reasons',
    'questions',
    'decisionsToCapture',
    'expectedOutcome'
  ];
  const rows = report.items.map((item) => [
    item.taskId,
    item.title,
    item.source,
    item.assignee || '',
    item.status || '',
    item.priority || '',
    item.score,
    item.riskLevel,
    item.priorityScore,
    item.readiness,
    item.decision,
    item.ownerRole,
    item.attendees.join('|'),
    item.timeboxMinutes,
    item.reasons.join('|'),
    item.questions.join('|'),
    item.decisionsToCapture.join('|'),
    item.expectedOutcome
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

export function formatRefinementAgendaMarkdown(report: RefinementAgendaReport): string {
  const roleFocus = report.summary.roleDistribution.length > 0
    ? report.summary.roleDistribution.map((role) => `- ${role.name}: ${role.count}`)
    : ['- Нет участников для повестки.'];
  const topReasons = report.summary.topReasons.length > 0
    ? report.summary.topReasons.map((reason, index) => `${index + 1}. ${reason.name} - ${reason.count}`)
    : ['Повторяющихся причин не найдено.'];
  const items = report.items.flatMap((item, index) => [
    `### ${index + 1}. ${item.taskId} - ${tableCell(item.title)}`,
    '',
    `- Decision: ${item.decision}`,
    `- Readiness: ${item.readiness}`,
    `- Priority Score: ${item.priorityScore}`,
    `- Clarity Score: ${item.score}/100`,
    `- Risk: ${item.riskLevel}`,
    `- Timebox: ${item.timeboxMinutes} min`,
    `- Owner: ${item.ownerRole}`,
    `- Attendees: ${item.attendees.join(', ')}`,
    `- Assignee: ${item.assignee || 'Не назначен'}`,
    `- Status: ${item.status || 'Не указан'}`,
    '',
    '**Expected outcome:**',
    '',
    item.expectedOutcome,
    '',
    '**Why this is on the agenda:**',
    '',
    ...formatList(item.reasons),
    '',
    '**Questions:**',
    '',
    ...formatList(item.questions),
    '',
    '**Prep before meeting:**',
    '',
    ...formatList(item.prepBeforeMeeting),
    '',
    '**Decision to capture:**',
    '',
    ...formatList(item.decisionsToCapture),
    ''
  ]);

  return [
    '# Refinement Agenda',
    '',
    `Generated at: ${report.generatedAt}`,
    '',
    '## Meeting Plan',
    '',
    `- Total tasks analyzed: ${report.totalTasks}`,
    `- Agenda items: ${report.includedTasks}`,
    `- Total timebox: ${report.totalTimeboxMinutes} min`,
    `- Must refine: ${report.summary.mustRefine}`,
    `- Needs team alignment: ${report.summary.needsTeamAlignment}`,
    `- Ready candidates: ${report.summary.readyCandidates}`,
    `- Blocker items: ${report.summary.blockerItems}`,
    `- Split-scope items: ${report.summary.splitScopeItems}`,
    `- Risk-review items: ${report.summary.riskReviewItems}`,
    '',
    '## Role Focus',
    '',
    ...roleFocus,
    '',
    '## Top Reasons',
    '',
    ...topReasons,
    '',
    '## Agenda',
    '',
    ...(items.length > 0 ? items : ['Задач для refinement agenda не найдено.'])
  ].join('\n');
}

function formatRefinementAgenda(
  report: RefinementAgendaReport,
  format: ReportFormat
): string {
  if (format === 'json') {
    return formatRefinementAgendaJson(report);
  }

  if (format === 'csv') {
    return formatRefinementAgendaCsv(report);
  }

  return formatRefinementAgendaMarkdown(report);
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

  const limit = parseNumberArg(args, 'limit') ?? 8;
  const minPriorityScore = parseNumberArg(args, 'min-priority-score') ?? 20;
  const format = inferReportFormat(outputPath, getStringArg(args, 'format'));
  const tasks = normalizeUnifiedTasks(readJsonFile<unknown>(inputPath));
  const records = analyzeUnifiedTasks(tasks);
  const report = buildRefinementAgendaReport(records, {
    limit,
    minPriorityScore,
    includeReady: args['include-ready'] === true,
    includeDone: args['include-done'] === true
  });

  writeReport(outputPath, formatRefinementAgenda(report, format));
  process.stdout.write(`Refinement Agenda сохранён: ${outputPath}\n`);
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
