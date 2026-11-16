import {
  analyzeUnifiedTasks,
  buildDashboard
} from './analytics';
import {
  buildActionPlanReport
} from './action-plan';
import {
  buildDecisionLedgerReport
} from './decision-ledger';
import {
  buildEvidenceBriefReport
} from './evidence-brief';
import {
  buildOwnershipRiskReport
} from './ownership-risk';
import {
  buildQuickBugFixReport
} from './quick-bug-fix';
import {
  checkDefinitionOfReady
} from './readiness/dor';
import {
  csvEscape,
  tableCell,
  writeReport
} from './report-utils';
import {
  buildReleaseGuardReport
} from './release-guard';
import {
  buildStakeholderUpdateReport
} from './stakeholder-update';
import {
  normalizeUnifiedTasks
} from './task-model';
import {
  buildTaskHealthReport
} from './task-health-profile';
import {
  getStringArg,
  makeCliError,
  parseArgs,
  readJsonFile
} from './utils';

import type {
  TaskAnalysisRecord
} from './types';

export type ProjectPulseStatus = 'healthy' | 'watch' | 'critical';
export type ProjectPulseSeverity = 'low' | 'medium' | 'high';
export type ProjectPulseOwnerRole = 'PM' | 'Tech Lead' | 'QA' | 'Analytics' | 'Engineering';
export type ProjectPulseFormat = 'markdown' | 'json' | 'csv' | 'html';

export interface ProjectPulseFocusArea {
  code: string;
  title: string;
  severity: ProjectPulseSeverity;
  ownerRole: ProjectPulseOwnerRole;
  reason: string;
  nextAction: string;
  taskIds: string[];
  sourceReports: string[];
}

export interface ProjectPulseTaskSpotlight {
  taskId: string;
  title: string;
  status?: string;
  assignee?: string;
  clarityScore: number;
  smartScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  priorityScore: number;
  reasons: string[];
  nextAction: string;
  openReports: string[];
}

export interface ProjectPulseReportLink {
  fileName: string;
  title: string;
  purpose: string;
  openWhen: string;
}

export interface ProjectPulseReport {
  generatedAt: string;
  status: ProjectPulseStatus;
  projectHealthScore: number;
  executiveSummary: string;
  metrics: {
    totalTasks: number;
    averageClarityScore: number;
    averageSmartScore: number;
    readyTasksPercent: number;
    highRiskTasks: number;
    lowQualityTasks: number;
    qaGapTasks: number;
    releaseDecision: string;
    releaseReadinessScore: number;
    criticalOwners: number;
    unassignedRiskTasks: number;
    decisionTraceabilityScore: number;
    evidenceReviewTasks: number;
    quickFixReady: number;
  };
  focusAreas: ProjectPulseFocusArea[];
  taskSpotlight: ProjectPulseTaskSpotlight[];
  nextActions: string[];
  reportMap: ProjectPulseReportLink[];
}

const DEFAULT_REPORT_MAP: ProjectPulseReportLink[] = [
  {
    fileName: 'index.html',
    title: 'Project Pulse',
    purpose: 'Единая первая страница demo bundle с executive summary и маршрутом по отчётам.',
    openWhen: 'Открывать первым после npm run demo.'
  },
  {
    fileName: 'dashboard.html',
    title: 'Dashboard',
    purpose: 'Быстрый визуальный обзор Clarity Score, SMART Score и повторяющихся проблем.',
    openWhen: 'Нужна общая картина качества backlog.'
  },
  {
    fileName: 'data-doctor.md',
    title: 'Data Doctor',
    purpose: 'Проверяет качество входного dataset: dropped rows, duplicate ids, даты, coverage и status history.',
    openWhen: 'Открывать перед доверием к аналитике или при подключении нового экспорта из трекера.'
  },
  {
    fileName: 'task-health-profile.md',
    title: 'Task Health Profile',
    purpose: 'Показывает здоровье каждой задачи, слабые места и next best action.',
    openWhen: 'Нужно понять, какие задачи разбирать первыми.'
  },
  {
    fileName: 'team-handoff.md',
    title: 'Team Handoff Matrix',
    purpose: 'Показывает готовность задач для Analyst, Developer и QA, роль-владельца блокера и нужный meeting.',
    openWhen: 'Нужно передать задачи между ролями без потери контекста.'
  },
  {
    fileName: 'action-plan.md',
    title: 'Action Plan',
    purpose: 'Приоритизирует задачи, вопросы и конкретные правки описаний.',
    openWhen: 'Нужно быстро перейти от анализа к редактированию задач.'
  },
  {
    fileName: 'refinement-agenda.md',
    title: 'Refinement Agenda',
    purpose: 'Собирает готовую повестку refinement с вопросами и решениями.',
    openWhen: 'Нужно провести рабочую встречу по not-ready задачам.'
  },
  {
    fileName: 'stakeholder-update.md',
    title: 'Stakeholder Update',
    purpose: 'Короткий статус для менеджеров: health, risks, asks и next actions.',
    openWhen: 'Нужно быстро объяснить состояние проекта вне команды.'
  },
  {
    fileName: 'release-guard.md',
    title: 'Release Guard',
    purpose: 'Проверяет release readiness: go, review_required или no_go.',
    openWhen: 'Есть релизный checkpoint или задача в Testing/Done.'
  },
  {
    fileName: 'ownership-risk.md',
    title: 'Ownership Risk',
    purpose: 'Показывает концентрацию риска по assignee и risky unassigned work.',
    openWhen: 'Нужно разложить ответственность и WIP по владельцам.'
  },
  {
    fileName: 'decision-ledger.md',
    title: 'Decision Ledger',
    purpose: 'Проверяет traceability: problem, evidence, decision, owner и verification.',
    openWhen: 'Важно объяснить, почему команда принимает конкретное решение.'
  },
  {
    fileName: 'evidence-brief.md',
    title: 'Evidence Brief',
    purpose: 'Формулирует гипотезу, evidence signals, gaps и осторожную интерпретацию.',
    openWhen: 'Нужно отделить факты от предположений.'
  },
  {
    fileName: 'quick-bug-fix.md',
    title: 'Quick Bug Fix Queue',
    purpose: 'Отделяет быстрые безопасные фиксы от багов, которым нужен risk review.',
    openWhen: 'Нужно выбрать маленькие баги для короткого patch window.'
  },
  {
    fileName: 'retro-report.md',
    title: 'Retro Report',
    purpose: 'Связывает качество задач с lifecycle friction: cycle time, reopened и stuck.',
    openWhen: 'Команда готовится к ретро.'
  },
  {
    fileName: 'tasks.csv',
    title: 'Tasks CSV',
    purpose: 'Табличный экспорт для анализа в Sheets, Excel или BI.',
    openWhen: 'Нужен внешний анализ или портфолио-артефакт.'
  }
];

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, round(value)));
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
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

function inferProjectPulseFormat(outputPath: string, explicitFormat?: string): ProjectPulseFormat {
  if (
    explicitFormat &&
    explicitFormat !== 'markdown' &&
    explicitFormat !== 'json' &&
    explicitFormat !== 'csv' &&
    explicitFormat !== 'html'
  ) {
    throw makeCliError(`Неподдерживаемый формат отчёта: ${explicitFormat}`);
  }

  if (
    explicitFormat === 'markdown' ||
    explicitFormat === 'json' ||
    explicitFormat === 'csv' ||
    explicitFormat === 'html'
  ) {
    return explicitFormat;
  }

  if (/\.md$/i.test(outputPath)) {
    return 'markdown';
  }

  if (/\.json$/i.test(outputPath)) {
    return 'json';
  }

  if (/\.csv$/i.test(outputPath)) {
    return 'csv';
  }

  if (/\.html?$/i.test(outputPath)) {
    return 'html';
  }

  throw makeCliError('Неподдерживаемый формат отчёта: укажи --format markdown|json|csv|html или output с расширением .md, .json, .csv, .html');
}

function htmlEscape(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getTaskId(record: TaskAnalysisRecord): string {
  return record.task.key || record.task.id;
}

function severityWeight(severity: ProjectPulseSeverity): number {
  if (severity === 'high') {
    return 3;
  }

  if (severity === 'medium') {
    return 2;
  }

  return 1;
}

function addFocusArea(
  focusAreas: ProjectPulseFocusArea[],
  focusArea: ProjectPulseFocusArea,
  condition: boolean
): void {
  if (condition) {
    focusAreas.push(focusArea);
  }
}

function getHealthScore(params: {
  averageClarityScore: number;
  averageSmartScore: number;
  readyTasksPercent: number;
  releaseReadinessScore: number;
  highRiskTasks: number;
  criticalOwners: number;
  unassignedRiskTasks: number;
  releaseDecision: string;
}): number {
  const base = average([
    params.averageClarityScore,
    params.averageSmartScore,
    params.readyTasksPercent,
    params.releaseReadinessScore
  ]);
  const penalty = params.highRiskTasks * 3 +
    params.criticalOwners * 7 +
    params.unassignedRiskTasks * 5 +
    (params.releaseDecision === 'no_go' ? 18 : params.releaseDecision === 'review_required' ? 8 : 0);

  return clampScore(base - penalty);
}

function getStatus(params: {
  projectHealthScore: number;
  releaseDecision: string;
  stakeholderHealth: string;
  criticalOwners: number;
  unassignedRiskTasks: number;
}): ProjectPulseStatus {
  if (
    params.projectHealthScore < 50 ||
    params.releaseDecision === 'no_go' ||
    params.stakeholderHealth === 'red' ||
    params.criticalOwners >= 2
  ) {
    return 'critical';
  }

  if (
    params.projectHealthScore < 75 ||
    params.releaseDecision === 'review_required' ||
    params.stakeholderHealth === 'yellow' ||
    params.criticalOwners > 0 ||
    params.unassignedRiskTasks > 0
  ) {
    return 'watch';
  }

  return 'healthy';
}

function getExecutiveSummary(status: ProjectPulseStatus, metrics: ProjectPulseReport['metrics']): string {
  if (status === 'critical') {
    return `Project needs active steering: release decision is ${metrics.releaseDecision}, ${metrics.highRiskTasks} high-risk tasks and ${metrics.criticalOwners} critical owners need attention.`;
  }

  if (status === 'watch') {
    return `Project is usable but needs follow-up: ${metrics.readyTasksPercent}% tasks pass Definition of Ready and ${metrics.qaGapTasks} tasks still have QA or verification gaps.`;
  }

  return `Project looks healthy: average Clarity Score is ${metrics.averageClarityScore}/100, release readiness is ${metrics.releaseReadinessScore}/100 and ownership risk is controlled.`;
}

function getTaskPriorityScore(record: TaskAnalysisRecord): number {
  const dorPassed = checkDefinitionOfReady({
    ...record.task,
    clarityScore: record.score
  }).dorPassed;
  const issueWeight = record.riskLevel === 'high'
    ? 35
    : record.riskLevel === 'medium'
      ? 14
      : 0;
  const clarityWeight = Math.max(0, 100 - record.score) * 0.35;
  const smartWeight = Math.max(0, 100 - record.smartAnalysis.totalScore) * 0.15;
  const problemWeight = record.problemCodes.length * 5;
  const recommendationWeight = record.recommendations.length * 2;
  const readinessWeight = dorPassed ? 0 : 12;
  const ownershipWeight = record.task.assignee ? 0 : 10;

  return round(issueWeight + clarityWeight + smartWeight + problemWeight + recommendationWeight + readinessWeight + ownershipWeight);
}

function getTaskReasons(record: TaskAnalysisRecord): string[] {
  const reasons: string[] = [];

  if (record.riskLevel !== 'low') {
    reasons.push(`${record.riskLevel} risk`);
  }

  if (record.score < 60) {
    reasons.push('low clarity');
  }

  if (record.smartAnalysis.totalScore < 60) {
    reasons.push('weak SMART goal');
  }

  if (!record.task.assignee) {
    reasons.push('no assignee');
  }

  reasons.push(...record.problemCodes.slice(0, 3));

  return unique(reasons);
}

function getTaskNextAction(record: TaskAnalysisRecord): string {
  const suggestions = record.analysis.clarityFixSuggestions.nextActions;

  if (suggestions.length > 0) {
    return suggestions[0];
  }

  if (record.riskLevel === 'high') {
    return 'Run risk review before commitment or release decision.';
  }

  if (record.score < 80) {
    return 'Clarify context, expected result and acceptance criteria.';
  }

  return 'Keep task as a reference example and monitor in the next checkpoint.';
}

function getOpenReports(record: TaskAnalysisRecord): string[] {
  const reports: string[] = ['task-health-profile.md'];

  if (record.riskLevel !== 'low') {
    reports.push('release-guard.md');
  }

  if (!record.task.assignee) {
    reports.push('ownership-risk.md');
  }

  if (record.problemCodes.includes('missing_context') || record.problemCodes.includes('missing_acceptance_criteria')) {
    reports.push('refinement-agenda.md');
  }

  if (record.problemCodes.includes('hidden_agreement') || record.problemCodes.includes('missing_business_goal')) {
    reports.push('decision-ledger.md');
  }

  return unique(reports);
}

function buildTaskSpotlight(records: TaskAnalysisRecord[], limit: number): ProjectPulseTaskSpotlight[] {
  return [...records]
    .map((record) => ({
      record,
      priorityScore: getTaskPriorityScore(record)
    }))
    .filter((item) => item.priorityScore >= 20 || item.record.riskLevel !== 'low' || item.record.score < 80)
    .sort((a, b) => b.priorityScore - a.priorityScore || getTaskId(a.record).localeCompare(getTaskId(b.record)))
    .slice(0, limit)
    .map(({ record, priorityScore }) => ({
      taskId: getTaskId(record),
      title: record.task.title,
      status: record.task.status,
      assignee: record.task.assignee,
      clarityScore: record.score,
      smartScore: record.smartAnalysis.totalScore,
      riskLevel: record.riskLevel,
      priorityScore,
      reasons: getTaskReasons(record),
      nextAction: getTaskNextAction(record),
      openReports: getOpenReports(record)
    }));
}

function buildFocusAreas(params: {
  records: TaskAnalysisRecord[];
  metrics: ProjectPulseReport['metrics'];
  releaseGuard: ReturnType<typeof buildReleaseGuardReport>;
  ownershipRisk: ReturnType<typeof buildOwnershipRiskReport>;
  decisionLedger: ReturnType<typeof buildDecisionLedgerReport>;
  evidenceBrief: ReturnType<typeof buildEvidenceBriefReport>;
  actionPlan: ReturnType<typeof buildActionPlanReport>;
  quickBugFix: ReturnType<typeof buildQuickBugFixReport>;
}): ProjectPulseFocusArea[] {
  const focusAreas: ProjectPulseFocusArea[] = [];
  const highRiskTaskIds = params.records
    .filter((record) => record.riskLevel === 'high')
    .map(getTaskId);
  const lowReadyIds = params.records
    .filter((record) => !checkDefinitionOfReady({ ...record.task, clarityScore: record.score }).dorPassed)
    .map(getTaskId);

  addFocusArea(focusAreas, {
    code: 'release_decision',
    title: 'Release decision needs attention',
    severity: params.releaseGuard.releaseDecision === 'no_go' ? 'high' : 'medium',
    ownerRole: 'Tech Lead',
    reason: `Release Guard decision is ${params.releaseGuard.releaseDecision}, readiness score ${params.releaseGuard.releaseReadinessScore}/100.`,
    nextAction: 'Open Release Guard and close no-go or review-required items before shipping.',
    taskIds: params.releaseGuard.items.slice(0, 5).map((item) => item.taskId),
    sourceReports: ['release-guard.md']
  }, params.releaseGuard.releaseDecision !== 'go');

  addFocusArea(focusAreas, {
    code: 'readiness_gap',
    title: 'Planning readiness is below target',
    severity: params.metrics.readyTasksPercent < 50 ? 'high' : 'medium',
    ownerRole: 'PM',
    reason: `${params.metrics.readyTasksPercent}% tasks pass Definition of Ready.`,
    nextAction: 'Run refinement for not-ready tasks before sprint commitment.',
    taskIds: lowReadyIds.slice(0, 5),
    sourceReports: ['refinement-agenda.md', 'task-health-profile.md']
  }, params.metrics.readyTasksPercent < 80);

  addFocusArea(focusAreas, {
    code: 'ownership_risk',
    title: 'Risk is concentrated around owners',
    severity: params.ownershipRisk.summary.criticalOwners > 0 ? 'high' : 'medium',
    ownerRole: 'Engineering',
    reason: `${params.ownershipRisk.summary.criticalOwners} critical owners and ${params.ownershipRisk.unassignedRiskTasks} unassigned risk tasks.`,
    nextAction: 'Review owner heatmap, reduce WIP and assign owners for risky unassigned work.',
    taskIds: params.ownershipRisk.unassignedRiskQueue.slice(0, 5).map((task) => task.taskId),
    sourceReports: ['ownership-risk.md']
  }, params.ownershipRisk.summary.criticalOwners > 0 || params.ownershipRisk.unassignedRiskTasks > 0);

  addFocusArea(focusAreas, {
    code: 'qa_gap',
    title: 'QA verification gaps can create returns',
    severity: params.metrics.qaGapTasks >= 3 ? 'high' : 'medium',
    ownerRole: 'QA',
    reason: `${params.metrics.qaGapTasks} tasks have missing expected result, acceptance criteria, testing evidence or QA return signals.`,
    nextAction: 'Add verification notes before tasks move to Testing or Done.',
    taskIds: params.releaseGuard.items
      .filter((item) => item.releaseRisks.some((risk) => /acceptance|testing|dod/i.test(risk.code)))
      .slice(0, 5)
      .map((item) => item.taskId),
    sourceReports: ['task-health-profile.md', 'release-guard.md']
  }, params.metrics.qaGapTasks > 0);

  addFocusArea(focusAreas, {
    code: 'decision_traceability',
    title: 'Decision traceability is weak',
    severity: params.metrics.decisionTraceabilityScore < 50 ? 'high' : 'medium',
    ownerRole: 'PM',
    reason: `Average traceability score is ${params.metrics.decisionTraceabilityScore}/100 and ${params.decisionLedger.summary.governanceWarnings} governance warnings were found.`,
    nextAction: 'Document problem, evidence, owner and verification plan for the top decision-ledger items.',
    taskIds: params.decisionLedger.items.slice(0, 5).map((item) => item.taskId),
    sourceReports: ['decision-ledger.md', 'evidence-brief.md']
  }, params.metrics.decisionTraceabilityScore < 70 || params.decisionLedger.summary.governanceWarnings > 0);

  addFocusArea(focusAreas, {
    code: 'evidence_review',
    title: 'Evidence review is needed',
    severity: params.metrics.evidenceReviewTasks >= 3 ? 'high' : 'medium',
    ownerRole: 'Analytics',
    reason: `${params.metrics.evidenceReviewTasks} tasks need evidence review or have evidence gaps.`,
    nextAction: 'Validate sources, metrics or support signals before treating assumptions as facts.',
    taskIds: params.evidenceBrief.items.slice(0, 5).map((item) => item.taskId),
    sourceReports: ['evidence-brief.md']
  }, params.metrics.evidenceReviewTasks > 0);

  addFocusArea(focusAreas, {
    code: 'high_risk_tasks',
    title: 'High-risk tasks need explicit review',
    severity: params.metrics.highRiskTasks >= 3 ? 'high' : 'medium',
    ownerRole: 'Tech Lead',
    reason: `${params.metrics.highRiskTasks} tasks are currently high risk.`,
    nextAction: 'Review scope, dependencies, rollback/fallback and test coverage for high-risk tasks.',
    taskIds: highRiskTaskIds.slice(0, 5),
    sourceReports: ['release-guard.md', 'task-health-profile.md']
  }, params.metrics.highRiskTasks > 0);

  addFocusArea(focusAreas, {
    code: 'quick_fix_opportunity',
    title: 'Quick bug fixes are available',
    severity: 'low',
    ownerRole: 'Engineering',
    reason: `${params.metrics.quickFixReady} bugs look ready for a short safe patch window.`,
    nextAction: 'Use Quick Bug Fix Queue to pick low-risk fixes with clear verification checklist.',
    taskIds: params.quickBugFix.items
      .filter((item) => item.quickFixStatus === 'quick_fix_ready')
      .slice(0, 5)
      .map((item) => item.taskId),
    sourceReports: ['quick-bug-fix.md']
  }, params.metrics.quickFixReady > 0);

  addFocusArea(focusAreas, {
    code: 'action_plan',
    title: 'Action plan has unresolved questions',
    severity: params.actionPlan.summary.highPriorityTasks > 0 ? 'high' : 'medium',
    ownerRole: 'PM',
    reason: `${params.actionPlan.includedTasks} tasks are in the clarity action plan with ${params.actionPlan.summary.totalQuestions} open questions.`,
    nextAction: 'Start with the top action-plan tasks and update descriptions before handoff.',
    taskIds: params.actionPlan.items.slice(0, 5).map((item) => item.taskId),
    sourceReports: ['action-plan.md', 'refinement-agenda.md']
  }, params.actionPlan.includedTasks > 0);

  return focusAreas
    .sort((a, b) =>
      severityWeight(b.severity) - severityWeight(a.severity) ||
      b.taskIds.length - a.taskIds.length ||
      a.title.localeCompare(b.title)
    )
    .slice(0, 8);
}

function buildNextActions(focusAreas: ProjectPulseFocusArea[], status: ProjectPulseStatus): string[] {
  const actions = focusAreas
    .filter((focusArea) => focusArea.severity !== 'low')
    .map((focusArea) => `${focusArea.ownerRole}: ${focusArea.nextAction}`);

  if (status === 'critical') {
    actions.unshift('PM / Tech Lead: run a 30-minute project pulse review before the next commitment.');
  }

  if (actions.length === 0) {
    actions.push('PM: share the Project Pulse and continue monitoring clarity, ownership and release readiness weekly.');
  }

  return unique(actions).slice(0, 6);
}

export function buildProjectPulseReport(
  records: TaskAnalysisRecord[],
  options: {
    generatedAt?: string;
    spotlightLimit?: number;
    reportMap?: ProjectPulseReportLink[];
  } = {}
): ProjectPulseReport {
  const dashboard = buildDashboard(records);
  const actionPlan = buildActionPlanReport(records);
  const decisionLedger = buildDecisionLedgerReport(records);
  const evidenceBrief = buildEvidenceBriefReport(records, { limit: records.length });
  const ownershipRisk = buildOwnershipRiskReport(records);
  const quickBugFix = buildQuickBugFixReport(records, { includeNeedsReview: true });
  const releaseGuard = buildReleaseGuardReport(records, { includeReady: true });
  const stakeholderUpdate = buildStakeholderUpdateReport(records);
  const taskHealth = buildTaskHealthReport(records, { includeHealthy: true });
  const readyTasks = records.filter((record) =>
    checkDefinitionOfReady({ ...record.task, clarityScore: record.score }).dorPassed
  ).length;
  const totalTasks = records.length;
  const metrics = {
    totalTasks,
    averageClarityScore: dashboard.averageScore,
    averageSmartScore: dashboard.averageSmartScore,
    readyTasksPercent: totalTasks === 0 ? 0 : round((readyTasks / totalTasks) * 100),
    highRiskTasks: records.filter((record) => record.riskLevel === 'high').length,
    lowQualityTasks: records.filter((record) => record.score < 50).length,
    qaGapTasks: taskHealth.profiles.filter((profile) => profile.qaRisks.length > 0).length,
    releaseDecision: releaseGuard.releaseDecision,
    releaseReadinessScore: releaseGuard.releaseReadinessScore,
    criticalOwners: ownershipRisk.summary.criticalOwners,
    unassignedRiskTasks: ownershipRisk.unassignedRiskTasks,
    decisionTraceabilityScore: decisionLedger.summary.averageTraceabilityScore,
    evidenceReviewTasks: evidenceBrief.summary.needsEvidenceReview,
    quickFixReady: quickBugFix.quickFixReady
  };
  const projectHealthScore = getHealthScore(metrics);
  const status = getStatus({
    projectHealthScore,
    releaseDecision: metrics.releaseDecision,
    stakeholderHealth: stakeholderUpdate.health,
    criticalOwners: metrics.criticalOwners,
    unassignedRiskTasks: metrics.unassignedRiskTasks
  });
  const focusAreas = buildFocusAreas({
    records,
    metrics,
    releaseGuard,
    ownershipRisk,
    decisionLedger,
    evidenceBrief,
    actionPlan,
    quickBugFix
  });

  return {
    generatedAt: options.generatedAt || new Date().toISOString(),
    status,
    projectHealthScore,
    executiveSummary: getExecutiveSummary(status, metrics),
    metrics,
    focusAreas,
    taskSpotlight: buildTaskSpotlight(records, options.spotlightLimit ?? 7),
    nextActions: buildNextActions(focusAreas, status),
    reportMap: options.reportMap || DEFAULT_REPORT_MAP
  };
}

export function formatProjectPulseJson(report: ProjectPulseReport): string {
  return JSON.stringify(report, null, 2);
}

export function formatProjectPulseCsv(report: ProjectPulseReport): string {
  const header = [
    'rowType',
    'codeOrTaskId',
    'title',
    'severityOrRisk',
    'ownerRoleOrAssignee',
    'score',
    'taskIdsOrReasons',
    'nextAction'
  ];
  const focusRows = report.focusAreas.map((focusArea) => [
    'focus_area',
    focusArea.code,
    focusArea.title,
    focusArea.severity,
    focusArea.ownerRole,
    '',
    focusArea.taskIds.join('|'),
    focusArea.nextAction
  ]);
  const taskRows = report.taskSpotlight.map((task) => [
    'task_spotlight',
    task.taskId,
    task.title,
    task.riskLevel,
    task.assignee || '',
    task.priorityScore,
    task.reasons.join('|'),
    task.nextAction
  ]);

  return [
    header.map(csvEscape).join(','),
    ...[...focusRows, ...taskRows].map((row) => row.map(csvEscape).join(','))
  ].join('\n');
}

function formatList(items: string[]): string[] {
  return items.length > 0
    ? items.map((item) => `- ${item}`)
    : ['- Нет.'];
}

function formatFocusAreas(focusAreas: ProjectPulseFocusArea[]): string[] {
  return focusAreas.length > 0
    ? focusAreas.map((focusArea) =>
      `- ${focusArea.title} [${focusArea.severity}, ${focusArea.ownerRole}]: ${focusArea.reason} Next: ${focusArea.nextAction} Reports: ${focusArea.sourceReports.join(', ')}.`
    )
    : ['- Существенных focus areas не найдено.'];
}

function formatTaskSpotlight(tasks: ProjectPulseTaskSpotlight[]): string[] {
  return tasks.length > 0
    ? tasks.map((task) =>
      `- ${task.taskId} - ${tableCell(task.title)}: priority ${task.priorityScore}, clarity ${task.clarityScore}/100, SMART ${task.smartScore}/100, risk ${task.riskLevel}, assignee ${task.assignee || 'not assigned'}. Next: ${task.nextAction}`
    )
    : ['- Задач для spotlight не найдено.'];
}

export function formatProjectPulseMarkdown(report: ProjectPulseReport): string {
  return [
    '# Project Pulse',
    '',
    `Generated at: ${report.generatedAt}`,
    '',
    '## Executive Summary',
    '',
    `- Status: ${report.status}`,
    `- Project Health Score: ${report.projectHealthScore}/100`,
    `- Summary: ${report.executiveSummary}`,
    '',
    '## Key Metrics',
    '',
    `- Total tasks: ${report.metrics.totalTasks}`,
    `- Average Clarity Score: ${report.metrics.averageClarityScore}/100`,
    `- Average SMART Score: ${report.metrics.averageSmartScore}/100`,
    `- Ready tasks: ${report.metrics.readyTasksPercent}%`,
    `- High-risk tasks: ${report.metrics.highRiskTasks}`,
    `- Low-quality tasks: ${report.metrics.lowQualityTasks}`,
    `- QA gap tasks: ${report.metrics.qaGapTasks}`,
    `- Release decision: ${report.metrics.releaseDecision}`,
    `- Release readiness: ${report.metrics.releaseReadinessScore}/100`,
    `- Critical owners: ${report.metrics.criticalOwners}`,
    `- Unassigned risk tasks: ${report.metrics.unassignedRiskTasks}`,
    `- Decision traceability: ${report.metrics.decisionTraceabilityScore}/100`,
    `- Evidence review tasks: ${report.metrics.evidenceReviewTasks}`,
    `- Quick-fix ready bugs: ${report.metrics.quickFixReady}`,
    '',
    '## What To Do Next',
    '',
    ...formatList(report.nextActions),
    '',
    '## Focus Areas',
    '',
    ...formatFocusAreas(report.focusAreas),
    '',
    '## Task Spotlight',
    '',
    ...formatTaskSpotlight(report.taskSpotlight),
    ...(report.reportMap.length > 0 ? [
      '',
      '## Report Map',
      '',
      ...report.reportMap.map((link) =>
        `- ${link.fileName} - ${link.title}: ${link.purpose} Open when: ${link.openWhen}`
      )
    ] : [])
  ].join('\n');
}

function statusClass(status: ProjectPulseStatus): string {
  if (status === 'critical') {
    return 'critical';
  }

  if (status === 'watch') {
    return 'watch';
  }

  return 'healthy';
}

function metricHtml(label: string, value: string | number, note: string): string {
  return [
    '<div class="metric">',
    `<div class="metric-label">${htmlEscape(label)}</div>`,
    `<div class="metric-value">${htmlEscape(value)}</div>`,
    `<div class="metric-note">${htmlEscape(note)}</div>`,
    '</div>'
  ].join('');
}

export function formatProjectPulseHtml(report: ProjectPulseReport): string {
  const linkedReports = new Set(report.reportMap.map((reportLink) => reportLink.fileName));
  const focusRows = report.focusAreas.map((focusArea) => {
    const sources = focusArea.sourceReports.map((source) => {
      const name = htmlEscape(source);
      return linkedReports.has(source) ? `<a href="${name}">${name}</a>` : name;
    }).join('<br>');

    return `<tr><td><span class="badge ${focusArea.severity}">${htmlEscape(focusArea.severity)}</span></td><td>${htmlEscape(focusArea.title)}</td><td>${htmlEscape(focusArea.ownerRole)}</td><td>${htmlEscape(focusArea.reason)}</td><td>${htmlEscape(focusArea.nextAction)}</td><td>${sources}</td></tr>`;
  }).join('');
  const taskRows = report.taskSpotlight.map((task) =>
    `<tr><td>${htmlEscape(task.taskId)}</td><td>${htmlEscape(task.title)}</td><td>${htmlEscape(task.priorityScore)}</td><td>${htmlEscape(task.clarityScore)}</td><td>${htmlEscape(task.smartScore)}</td><td>${htmlEscape(task.riskLevel)}</td><td>${htmlEscape(task.assignee || 'not assigned')}</td><td>${htmlEscape(task.nextAction)}</td></tr>`
  ).join('');
  const reportLinks = report.reportMap
    .filter((link) => link.fileName !== 'index.html')
    .map((link) =>
      `<li><a href="${htmlEscape(link.fileName)}">${htmlEscape(link.title)}</a><span>${htmlEscape(link.purpose)}</span></li>`
    ).join('');

  return [
    '<!doctype html>',
    '<html lang="ru">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>Clarity Guardian Project Pulse</title>',
    '<style>',
    ':root{color-scheme:light;--text:#172033;--muted:#5b667a;--line:#d9e0ea;--surface:#fff;--bg:#f4f7fb;--green:#0f7a4f;--amber:#9a6200;--red:#b42318;--blue:#2458a7}',
    '*{box-sizing:border-box}',
    'body{margin:0;background:var(--bg);color:var(--text);font-family:Inter,Arial,sans-serif;line-height:1.45}',
    'main{max-width:1180px;margin:0 auto;padding:28px 20px 44px}',
    'header{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;align-items:end;border-bottom:1px solid var(--line);padding-bottom:18px;margin-bottom:18px}',
    'h1{font-size:34px;line-height:1.1;margin:0 0 8px}',
    'h2{font-size:20px;margin:28px 0 12px}',
    'p{margin:0;color:var(--muted)}',
    '.status{border:1px solid var(--line);border-radius:8px;background:var(--surface);padding:14px 16px;min-width:190px}',
    '.status strong{display:block;font-size:28px}',
    '.status.critical strong{color:var(--red)}.status.watch strong{color:var(--amber)}.status.healthy strong{color:var(--green)}',
    '.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(172px,1fr));gap:10px}',
    '.metric{background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:13px}',
    '.metric-label{font-size:12px;text-transform:uppercase;color:var(--muted);font-weight:700}',
    '.metric-value{font-size:28px;font-weight:800;margin-top:2px}',
    '.metric-note{font-size:12px;color:var(--muted)}',
    '.actions{background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:16px 18px}',
    '.actions li{margin:7px 0}',
    'table{width:100%;border-collapse:collapse;background:var(--surface);border:1px solid var(--line)}',
    'th,td{padding:10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top;font-size:14px}',
    'th{background:#eaf0f7;color:#263246}',
    'a{color:var(--blue);text-decoration:none;font-weight:700}a:hover{text-decoration:underline}',
    '.badge{display:inline-block;border-radius:6px;padding:2px 7px;font-weight:800;font-size:12px;color:#fff}.badge.high{background:var(--red)}.badge.medium{background:var(--amber)}.badge.low{background:var(--green)}',
    '.report-map{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px;padding:0;margin:0;list-style:none}',
    '.report-map li{background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:12px}.report-map span{display:block;margin-top:5px;color:var(--muted);font-size:13px}',
    '@media(max-width:760px){header{grid-template-columns:1fr}h1{font-size:28px}table{display:block;overflow-x:auto;white-space:nowrap}}',
    '</style>',
    '</head>',
    '<body><main>',
    '<header>',
    '<div>',
    '<h1>Clarity Guardian Project Pulse</h1>',
    `<p>${htmlEscape(report.executiveSummary)}</p>`,
    `<p>Generated at: ${htmlEscape(report.generatedAt)}</p>`,
    '</div>',
    `<div class="status ${statusClass(report.status)}"><span>Status</span><strong>${htmlEscape(report.status)}</strong><span>Health ${report.projectHealthScore}/100</span></div>`,
    '</header>',
    '<section class="metrics">',
    metricHtml('Tasks', report.metrics.totalTasks, 'analyzed work items'),
    metricHtml('Clarity', `${report.metrics.averageClarityScore}/100`, 'description quality'),
    metricHtml('SMART', `${report.metrics.averageSmartScore}/100`, 'goal quality'),
    metricHtml('Ready', `${report.metrics.readyTasksPercent}%`, 'Definition of Ready'),
    metricHtml('Release', report.metrics.releaseDecision, `${report.metrics.releaseReadinessScore}/100 readiness`),
    metricHtml('Critical Owners', report.metrics.criticalOwners, 'ownership risk'),
    metricHtml('QA Gaps', report.metrics.qaGapTasks, 'verification gaps'),
    metricHtml('Quick Fixes', report.metrics.quickFixReady, 'ready bug fixes'),
    '</section>',
    '<h2>What To Do Next</h2>',
    `<ol class="actions">${report.nextActions.map((action) => `<li>${htmlEscape(action)}</li>`).join('')}</ol>`,
    '<h2>Focus Areas</h2>',
    `<table><thead><tr><th>Severity</th><th>Focus</th><th>Owner</th><th>Reason</th><th>Next action</th><th>Reports</th></tr></thead><tbody>${focusRows || '<tr><td colspan="6">No focus areas found.</td></tr>'}</tbody></table>`,
    '<h2>Task Spotlight</h2>',
    `<table><thead><tr><th>Task</th><th>Title</th><th>Priority</th><th>Clarity</th><th>SMART</th><th>Risk</th><th>Assignee</th><th>Next action</th></tr></thead><tbody>${taskRows || '<tr><td colspan="8">No task spotlight items found.</td></tr>'}</tbody></table>`,
    ...(reportLinks ? ['<h2>Report Map</h2>', `<ul class="report-map">${reportLinks}</ul>`] : []),
    '</main></body></html>'
  ].join('');
}

function formatProjectPulse(report: ProjectPulseReport, format: ProjectPulseFormat): string {
  if (format === 'json') {
    return formatProjectPulseJson(report);
  }

  if (format === 'csv') {
    return formatProjectPulseCsv(report);
  }

  if (format === 'html') {
    return formatProjectPulseHtml(report);
  }

  return formatProjectPulseMarkdown(report);
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

  const tasks = normalizeUnifiedTasks(readJsonFile<unknown>(inputPath));
  const records = analyzeUnifiedTasks(tasks);
  const report = buildProjectPulseReport(records, {
    spotlightLimit: parseNumberArg(args, 'spotlight-limit') ?? 7,
    reportMap: []
  });
  const format = inferProjectPulseFormat(outputPath, getStringArg(args, 'format'));

  writeReport(outputPath, formatProjectPulse(report, format));
  process.stdout.write(`Project Pulse сохранён: ${outputPath}\n`);
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
