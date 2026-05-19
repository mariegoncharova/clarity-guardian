import {
  analyzeUnifiedTasks
} from './analytics';
import {
  buildEvidenceBriefReport
} from './evidence-brief';
import {
  checkDefinitionOfDone
} from './readiness/dod';
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
  analyzeTaskRisk
} from './risk/analyzer';
import {
  normalizeUnifiedTasks
} from './task-model';
import {
  getAcceptanceCriteria,
  getContext,
  getExpectedResult,
  getTaskId,
  hasAcceptanceCriteria,
  hasContext,
  hasDependencyInfo,
  hasExpectedResult,
  hasExternalDependency,
  hasReopenedAfterLastTesting,
  hasTestingSignal
} from './task-signals';
import {
  getStringArg,
  makeCliError,
  normalizeText,
  parseArgs,
  readJsonFile
} from './utils';

import type {
  EvidenceBriefItem
} from './evidence-brief';
import type {
  DoneResult,
  ReadinessResult
} from './readiness/models';
import type {
  ReportFormat
} from './report-utils';
import type {
  RiskAnalysis
} from './risk/models';
import type {
  TaskAnalysisRecord
} from './types';

export type DecisionLedgerStatus =
  | 'decision_ready'
  | 'needs_problem_framing'
  | 'needs_validation_plan'
  | 'needs_owner_alignment'
  | 'risk_review_required';

export type TraceLinkKey =
  | 'problem'
  | 'decision'
  | 'evidence'
  | 'verification'
  | 'owner'
  | 'dependency'
  | 'risk_control';

export interface DecisionTraceLink {
  key: TraceLinkKey;
  label: string;
  ownerRole: 'PM' | 'Tech Lead' | 'QA' | 'Analytics';
  present: boolean;
  evidence: string;
  recommendation: string;
  weight: number;
}

export interface DecisionLedgerItem {
  taskId: string;
  title: string;
  source: string;
  assignee?: string;
  status?: string;
  clarityScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  riskScore: number;
  dorPassed: boolean;
  dorScore: number;
  dodPassed: boolean;
  dodScore: number;
  traceabilityScore: number;
  decisionStatus: DecisionLedgerStatus;
  traceLinks: DecisionTraceLink[];
  missingLinks: string[];
  governanceWarnings: string[];
  decisionNarrative: string;
  raci: {
    accountable: string;
    consulted: string[];
    informed: string[];
  };
  nextDecision: string;
}

export interface DecisionLedgerReport {
  generatedAt: string;
  totalTasks: number;
  includedTasks: number;
  summary: {
    averageTraceabilityScore: number;
    decisionReady: number;
    needsProblemFraming: number;
    needsValidationPlan: number;
    needsOwnerAlignment: number;
    riskReviewRequired: number;
    topMissingLinks: Array<{
      name: string;
      count: number;
    }>;
    governanceWarnings: number;
  };
  items: DecisionLedgerItem[];
}

const TRACE_LABELS: Record<TraceLinkKey, string> = {
  problem: 'Problem framing',
  decision: 'Decision intent',
  evidence: 'Evidence basis',
  verification: 'Verification method',
  owner: 'Owner and priority',
  dependency: 'Dependency control',
  risk_control: 'Risk control'
};

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

function summarize(value: string, fallback: string): string {
  const text = normalizeText(value).replace(/\s+/g, ' ');

  if (!text) {
    return fallback;
  }

  return text.length <= 180 ? text : `${text.slice(0, 179).trim()}...`;
}

function hasEvidenceGap(evidence: EvidenceBriefItem | undefined, code: string): boolean {
  return Boolean(evidence?.evidenceGaps.some((gap) => gap.code === code));
}

function hasEvidenceBasis(evidence: EvidenceBriefItem | undefined): boolean {
  if (!evidence) {
    return false;
  }

  return evidence.evidenceSignals.some((signal) =>
    !/пока не найдены/i.test(signal)
  ) && !hasEvidenceGap(evidence, 'missing_evidence_source');
}

function hasVerification(record: TaskAnalysisRecord, evidence: EvidenceBriefItem | undefined): boolean {
  if (!hasAcceptanceCriteria(record.task)) {
    return false;
  }

  if (record.task.workItemType === 'bug' && hasEvidenceGap(evidence, 'missing_reproduction_steps')) {
    return false;
  }

  return true;
}

function buildTraceLinks(
  record: TaskAnalysisRecord,
  risk: RiskAnalysis,
  dor: ReadinessResult,
  evidence: EvidenceBriefItem | undefined
): DecisionTraceLink[] {
  const context = getContext(record.task);
  const expectedResult = getExpectedResult(record.task);
  const acceptanceCriteria = getAcceptanceCriteria(record.task);
  const dependencies = record.task.dependencies || [];
  const dependencyControlled = !hasExternalDependency(record.task) || hasDependencyInfo(record.task);
  const ownerAligned = Boolean(record.task.assignee) && Boolean(record.task.priority) && Boolean(record.task.workItemType);
  const verificationReady = hasVerification(record, evidence);
  const riskControlled = risk.riskLevel !== 'high' || (
    dor.dorPassed &&
    verificationReady &&
    !hasEvidenceGap(evidence, 'missing_metric') &&
    !hasEvidenceGap(evidence, 'dependency_not_traceable')
  );

  return [
    {
      key: 'problem',
      label: TRACE_LABELS.problem,
      ownerRole: 'PM',
      present: hasContext(record.task),
      evidence: summarize(context, 'Проблемный контекст не описан.'),
      recommendation: 'Зафиксировать, какую проблему и для кого решает задача.',
      weight: 18
    },
    {
      key: 'decision',
      label: TRACE_LABELS.decision,
      ownerRole: 'PM',
      present: hasExpectedResult(record.task),
      evidence: summarize(expectedResult, 'Ожидаемый результат не сформулирован.'),
      recommendation: 'Сформулировать решение как наблюдаемое изменение поведения продукта или системы.',
      weight: 18
    },
    {
      key: 'evidence',
      label: TRACE_LABELS.evidence,
      ownerRole: evidence?.audience.includes('Analytics') ? 'Analytics' : 'PM',
      present: hasEvidenceBasis(evidence),
      evidence: evidence?.evidenceSignals.join('; ') || 'Evidence signals не рассчитаны.',
      recommendation: 'Указать источник наблюдения: метрика, support, лог, исследование или проверочный сигнал.',
      weight: 16
    },
    {
      key: 'verification',
      label: TRACE_LABELS.verification,
      ownerRole: 'QA',
      present: verificationReady,
      evidence: acceptanceCriteria.length > 0
        ? acceptanceCriteria.slice(0, 2).join('; ')
        : 'Критерии приёмки или шаги воспроизведения не описаны.',
      recommendation: 'Добавить воспроизводимый метод проверки, acceptance criteria и bug reproduction details.',
      weight: 18
    },
    {
      key: 'owner',
      label: TRACE_LABELS.owner,
      ownerRole: 'PM',
      present: ownerAligned,
      evidence: [
        record.task.assignee ? `assignee: ${record.task.assignee}` : 'assignee не назначен',
        record.task.priority ? `priority: ${record.task.priority}` : 'priority не указан',
        record.task.workItemType ? `type: ${record.task.workItemType}` : 'type не указан'
      ].join('; '),
      recommendation: 'Назначить владельца, приоритет и тип задачи до commitment.',
      weight: 10
    },
    {
      key: 'dependency',
      label: TRACE_LABELS.dependency,
      ownerRole: 'Tech Lead',
      present: dependencyControlled,
      evidence: dependencies.length > 0
        ? dependencies.join('; ')
        : 'Явных внешних зависимостей нет или они не вынесены в поле dependencies.',
      recommendation: 'Для внешних зависимостей указать владельца, ожидаемый артефакт и срок.',
      weight: 10
    },
    {
      key: 'risk_control',
      label: TRACE_LABELS.risk_control,
      ownerRole: 'Tech Lead',
      present: riskControlled,
      evidence: `${risk.riskLevel} risk (${risk.riskScore}/100): ${risk.riskFactors.join('; ') || 'факторы риска не найдены'}`,
      recommendation: 'Для high-risk задач провести короткий risk review до старта разработки.',
      weight: 10
    }
  ];
}

function calculateTraceabilityScore(links: DecisionTraceLink[]): number {
  const totalWeight = links.reduce((sum, link) => sum + link.weight, 0);
  const passedWeight = links
    .filter((link) => link.present)
    .reduce((sum, link) => sum + link.weight, 0);

  if (totalWeight === 0) {
    return 0;
  }

  return round((passedWeight / totalWeight) * 100);
}

function getDecisionStatus(
  links: DecisionTraceLink[],
  risk: RiskAnalysis,
  traceabilityScore: number
): DecisionLedgerStatus {
  const missing = new Set(links.filter((link) => !link.present).map((link) => link.key));

  if (missing.has('problem') || missing.has('decision')) {
    return 'needs_problem_framing';
  }

  if (missing.has('verification') || missing.has('evidence')) {
    return 'needs_validation_plan';
  }

  if (missing.has('owner')) {
    return 'needs_owner_alignment';
  }

  if (
    risk.riskLevel === 'high' ||
    traceabilityScore < 75 ||
    missing.has('dependency') ||
    missing.has('risk_control')
  ) {
    return 'risk_review_required';
  }

  return 'decision_ready';
}

function getNextDecision(status: DecisionLedgerStatus): string {
  if (status === 'decision_ready') {
    return 'Можно брать в planning или execution: решение, проверка и владельцы прослеживаются.';
  }

  if (status === 'needs_problem_framing') {
    return 'Сначала провести PM clarification: зафиксировать проблему, целевое состояние и границы решения.';
  }

  if (status === 'needs_validation_plan') {
    return 'До handoff согласовать validation plan: evidence source, acceptance criteria, QA checks и метрику успеха.';
  }

  if (status === 'needs_owner_alignment') {
    return 'До commitment назначить владельца, приоритет и роль ответственного за следующий шаг.';
  }

  return 'Провести risk review с PM, Tech Lead и QA до старта разработки.';
}

function buildGovernanceWarnings(
  record: TaskAnalysisRecord,
  risk: RiskAnalysis,
  dor: ReadinessResult,
  dod: DoneResult,
  evidence: EvidenceBriefItem | undefined
): string[] {
  const warnings: string[] = [];

  if (risk.riskLevel === 'high' && (!dor.dorPassed || hasEvidenceGap(evidence, 'missing_acceptance_criteria'))) {
    warnings.push('High-risk задача не проходит готовность к разработке или не имеет достаточной проверки.');
  }

  if (record.task.status && /done|closed|готово|закрыто/i.test(record.task.status) && !dod.dodPassed) {
    warnings.push('Задача выглядит завершённой, но Definition of Done не подтверждён.');
  }

  if (hasExternalDependency(record.task) && !hasDependencyInfo(record.task)) {
    warnings.push('Есть внешняя зависимость без явного владельца или артефакта.');
  }

  if (hasEvidenceGap(evidence, 'missing_metric')) {
    warnings.push('Задача заявляет измеримый эффект, но метрика успеха не зафиксирована.');
  }

  if (record.task.workItemType === 'bug' && !hasTestingSignal(record.task)) {
    warnings.push('Bug-задача не содержит явного QA/testing сигнала.');
  }

  if (hasReopenedAfterLastTesting(record.task)) {
    warnings.push('Задача возвращалась после Testing: стоит проверить качество handoff и критериев проверки.');
  }

  return warnings;
}

function buildDecisionNarrative(
  record: TaskAnalysisRecord,
  evidence: EvidenceBriefItem | undefined
): string {
  if (evidence?.workingHypothesis) {
    return evidence.workingHypothesis;
  }

  const context = getContext(record.task);
  const expectedResult = getExpectedResult(record.task);

  if (context && expectedResult) {
    return `Проблема: ${summarize(context, '')}. Решение: ${summarize(expectedResult, '')}.`;
  }

  return `Сформулировать decision narrative для "${record.task.title}": проблема, решение, evidence и validation.`;
}

function buildRaci(record: TaskAnalysisRecord, evidence: EvidenceBriefItem | undefined): DecisionLedgerItem['raci'] {
  const consulted = new Set<string>();
  const informed = new Set<string>();

  for (const role of evidence?.audience || []) {
    if (role === 'PM') {
      continue;
    }

    if (role === 'Support') {
      informed.add(role);
    } else {
      consulted.add(role);
    }
  }

  if (hasExternalDependency(record.task)) {
    consulted.add('Tech Lead');
  }

  if (hasAcceptanceCriteria(record.task)) {
    consulted.add('QA');
  }

  return {
    accountable: record.task.assignee || record.task.author || 'PM',
    consulted: Array.from(consulted),
    informed: Array.from(informed)
  };
}

function toDecisionLedgerItem(
  record: TaskAnalysisRecord,
  evidence: EvidenceBriefItem | undefined
): DecisionLedgerItem {
  const risk = analyzeTaskRisk(record.task);
  const dor = checkDefinitionOfReady(record.task);
  const dod = checkDefinitionOfDone(record.task);
  const traceLinks = buildTraceLinks(record, risk, dor, evidence);
  const traceabilityScore = calculateTraceabilityScore(traceLinks);
  const decisionStatus = getDecisionStatus(traceLinks, risk, traceabilityScore);
  const missingLinks = traceLinks
    .filter((link) => !link.present)
    .map((link) => link.label);

  return {
    taskId: getTaskId(record.task),
    title: record.task.title,
    source: record.task.source,
    assignee: record.task.assignee,
    status: record.task.status,
    clarityScore: record.score,
    riskLevel: risk.riskLevel,
    riskScore: risk.riskScore,
    dorPassed: dor.dorPassed,
    dorScore: dor.dorScore,
    dodPassed: dod.dodPassed,
    dodScore: dod.dodScore,
    traceabilityScore,
    decisionStatus,
    traceLinks,
    missingLinks,
    governanceWarnings: buildGovernanceWarnings(record, risk, dor, dod, evidence),
    decisionNarrative: buildDecisionNarrative(record, evidence),
    raci: buildRaci(record, evidence),
    nextDecision: getNextDecision(decisionStatus)
  };
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function countBy(values: string[], limit = 7): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export function buildDecisionLedgerReport(
  records: TaskAnalysisRecord[],
  options: {
    limit?: number;
    minTraceabilityScore?: number;
    includeReady?: boolean;
    generatedAt?: string;
  } = {}
): DecisionLedgerReport {
  const limit = options.limit ?? 10;
  const minTraceabilityScore = options.minTraceabilityScore ?? 100;
  const evidenceReport = buildEvidenceBriefReport(records, {
    includeReady: true,
    limit: records.length,
    minPriorityScore: 0,
    generatedAt: options.generatedAt
  });
  const evidenceByTaskId = new Map(
    evidenceReport.items.map((item) => [item.taskId, item])
  );
  const items = records
    .map((record) => toDecisionLedgerItem(record, evidenceByTaskId.get(getTaskId(record.task))))
    .filter((item) =>
      options.includeReady ||
      item.decisionStatus !== 'decision_ready' ||
      item.traceabilityScore < minTraceabilityScore ||
      item.governanceWarnings.length > 0
    )
    .sort((a, b) =>
      a.traceabilityScore - b.traceabilityScore ||
      b.riskScore - a.riskScore ||
      a.taskId.localeCompare(b.taskId)
    )
    .slice(0, limit);

  return {
    generatedAt: options.generatedAt || new Date().toISOString(),
    totalTasks: records.length,
    includedTasks: items.length,
    summary: {
      averageTraceabilityScore: average(items.map((item) => item.traceabilityScore)),
      decisionReady: items.filter((item) => item.decisionStatus === 'decision_ready').length,
      needsProblemFraming: items.filter((item) => item.decisionStatus === 'needs_problem_framing').length,
      needsValidationPlan: items.filter((item) => item.decisionStatus === 'needs_validation_plan').length,
      needsOwnerAlignment: items.filter((item) => item.decisionStatus === 'needs_owner_alignment').length,
      riskReviewRequired: items.filter((item) => item.decisionStatus === 'risk_review_required').length,
      topMissingLinks: countBy(items.flatMap((item) => item.missingLinks)),
      governanceWarnings: items.reduce((sum, item) => sum + item.governanceWarnings.length, 0)
    },
    items
  };
}

export function formatDecisionLedgerJson(report: DecisionLedgerReport): string {
  return JSON.stringify(report, null, 2);
}

export function formatDecisionLedgerCsv(report: DecisionLedgerReport): string {
  const header = [
    'taskId',
    'title',
    'source',
    'assignee',
    'status',
    'decisionStatus',
    'traceabilityScore',
    'clarityScore',
    'riskLevel',
    'riskScore',
    'dorPassed',
    'dodPassed',
    'missingLinks',
    'governanceWarnings',
    'nextDecision'
  ];
  const rows = report.items.map((item) => [
    item.taskId,
    item.title,
    item.source,
    item.assignee || '',
    item.status || '',
    item.decisionStatus,
    item.traceabilityScore,
    item.clarityScore,
    item.riskLevel,
    item.riskScore,
    item.dorPassed,
    item.dodPassed,
    item.missingLinks.join('|'),
    item.governanceWarnings.join('|'),
    item.nextDecision
  ]);

  return [
    header.map(csvEscape).join(','),
    ...rows.map((row) => row.map(csvEscape).join(','))
  ].join('\n');
}

function formatTraceLinks(links: DecisionTraceLink[]): string[] {
  return links.map((link) =>
    `| ${link.present ? 'yes' : 'no'} | ${tableCell(link.label)} | ${link.ownerRole} | ${tableCell(link.evidence)} | ${tableCell(link.recommendation)} |`
  );
}

function formatList(items: string[]): string[] {
  return items.length > 0
    ? items.map((item) => `- ${item}`)
    : ['- Нет.'];
}

export function formatDecisionLedgerMarkdown(report: DecisionLedgerReport): string {
  const topMissingLinks = report.summary.topMissingLinks.length > 0
    ? report.summary.topMissingLinks.map((item, index) => `${index + 1}. ${item.name} - ${item.count}`)
    : ['Нет повторяющихся missing links.'];
  const matrixRows = report.items.map((item) =>
    `| ${tableCell(item.taskId)} | ${tableCell(item.title)} | ${item.decisionStatus} | ${item.traceabilityScore} | ${item.riskLevel} | ${tableCell(item.missingLinks.join('; ') || 'none')} |`
  );
  const details = report.items.flatMap((item, index) => [
    `### ${index + 1}. ${item.taskId} - ${tableCell(item.title)}`,
    '',
    `- Decision status: ${item.decisionStatus}`,
    `- Traceability Score: ${item.traceabilityScore}/100`,
    `- Clarity Score: ${item.clarityScore}/100`,
    `- Risk: ${item.riskLevel} (${item.riskScore}/100)`,
    `- DoR: ${item.dorPassed ? 'passed' : 'failed'} (${item.dorScore}/100)`,
    `- DoD: ${item.dodPassed ? 'passed' : 'failed'} (${item.dodScore}/100)`,
    `- Accountable: ${item.raci.accountable}`,
    `- Consulted: ${item.raci.consulted.join(', ') || 'Не указано'}`,
    `- Informed: ${item.raci.informed.join(', ') || 'Не указано'}`,
    '',
    '**Decision narrative:**',
    '',
    item.decisionNarrative,
    '',
    '**Trace links:**',
    '',
    '| Present | Link | Owner | Evidence | Recommendation |',
    '| --- | --- | --- | --- | --- |',
    ...formatTraceLinks(item.traceLinks),
    '',
    '**Governance warnings:**',
    '',
    ...formatList(item.governanceWarnings),
    '',
    '**Next decision:**',
    '',
    item.nextDecision,
    ''
  ]);

  return [
    '# Decision Ledger',
    '',
    `Generated at: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    `- Total tasks analyzed: ${report.totalTasks}`,
    `- Tasks in ledger: ${report.includedTasks}`,
    `- Average Traceability Score: ${report.summary.averageTraceabilityScore}/100`,
    `- Decision ready: ${report.summary.decisionReady}`,
    `- Needs problem framing: ${report.summary.needsProblemFraming}`,
    `- Needs validation plan: ${report.summary.needsValidationPlan}`,
    `- Needs owner alignment: ${report.summary.needsOwnerAlignment}`,
    `- Risk review required: ${report.summary.riskReviewRequired}`,
    `- Governance warnings: ${report.summary.governanceWarnings}`,
    '',
    '## Top Missing Links',
    '',
    ...topMissingLinks,
    '',
    '## Decision Traceability Matrix',
    '',
    '| Task | Title | Decision Status | Traceability | Risk | Missing Links |',
    '| --- | --- | --- | ---: | --- | --- |',
    ...(matrixRows.length > 0 ? matrixRows : ['| - | No tasks | - | 0 | - | - |']),
    '',
    '## Task Ledger',
    '',
    ...(details.length > 0 ? details : ['Задач для decision ledger не найдено.'])
  ].join('\n');
}

function formatDecisionLedger(report: DecisionLedgerReport, format: ReportFormat): string {
  if (format === 'json') {
    return formatDecisionLedgerJson(report);
  }

  if (format === 'csv') {
    return formatDecisionLedgerCsv(report);
  }

  return formatDecisionLedgerMarkdown(report);
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
  const minTraceabilityScore = parseNumberArg(args, 'min-traceability-score') ?? 100;
  const format = inferReportFormat(outputPath, getStringArg(args, 'format'));
  const tasks = normalizeUnifiedTasks(readJsonFile<unknown>(inputPath));
  const records = analyzeUnifiedTasks(tasks);
  const report = buildDecisionLedgerReport(records, {
    limit,
    minTraceabilityScore,
    includeReady: args['include-ready'] === true
  });

  writeReport(outputPath, formatDecisionLedger(report, format));
  process.stdout.write(`Decision Ledger сохранён: ${outputPath}\n`);
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
