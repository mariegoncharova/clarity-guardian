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
  normalizeUnifiedTasks
} from './task-model';
import {
  getTaskId,
  hasAcceptanceCriteria,
  hasExpectedResult,
  hasExternalDependency,
  hasLargeScope,
  hasOpenBlocker,
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

export type OwnerRiskLevel = 'stable' | 'watch' | 'critical';

export interface OwnershipRiskTask {
  taskId: string;
  title: string;
  status?: string;
  assignee?: string;
  priority?: string;
  score: number;
  riskLevel: 'low' | 'medium' | 'high';
  smartScore: number;
  signals: string[];
  recommendedAction: string;
}

export interface OwnerRiskProfile {
  owner: string;
  taskCount: number;
  activeTaskCount: number;
  averageClarityScore: number;
  averageSmartScore: number;
  highRiskTasks: number;
  mediumRiskTasks: number;
  lowClarityTasks: number;
  qaGapTasks: number;
  notReadyTasks: number;
  blockerTasks: number;
  scopeRiskTasks: number;
  ownerRiskScore: number;
  riskLevel: OwnerRiskLevel;
  tasks: OwnershipRiskTask[];
  recommendation: string;
}

export interface OwnershipRiskReport {
  generatedAt: string;
  totalTasks: number;
  assignedTasks: number;
  unassignedTasks: number;
  unassignedRiskTasks: number;
  summary: {
    criticalOwners: number;
    watchOwners: number;
    stableOwners: number;
    overloadedOwners: number;
    highRiskTasks: number;
    qaGapTasks: number;
    notReadyTasks: number;
    blockerTasks: number;
    averageClarityScore: number;
  };
  ownerProfiles: OwnerRiskProfile[];
  unassignedRiskQueue: OwnershipRiskTask[];
  recommendations: string[];
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
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

function isNotReady(record: TaskAnalysisRecord): boolean {
  return !checkDefinitionOfReady({
    ...record.task,
    clarityScore: record.score
  }).dorPassed;
}

function hasQaGap(record: TaskAnalysisRecord): boolean {
  return !hasAcceptanceCriteria(record.task) ||
    !hasExpectedResult(record.task) ||
    record.problemCodes.includes('unclear_testing') ||
    (record.task.metrics?.qaReturns || 0) > 0;
}

function hasBlockerRisk(record: TaskAnalysisRecord): boolean {
  const status = normalizeText(record.task.status).toLowerCase();

  return hasOpenBlocker(record.task) ||
    /^(blocked|блокер)$/.test(status) ||
    (hasExternalDependency(record.task) && (record.task.dependencies || []).length === 0);
}

function getTaskSignals(record: TaskAnalysisRecord): string[] {
  const signals: string[] = [];

  if (record.riskLevel === 'high') {
    signals.push('high_delivery_or_communication_risk');
  }

  if (record.score < 60) {
    signals.push('low_clarity');
  }

  if (record.smartAnalysis.totalScore < 60 || record.smartAnalysis.status === 'weak') {
    signals.push('weak_smart_goal');
  }

  if (hasQaGap(record)) {
    signals.push('qa_verification_gap');
  }

  if (isNotReady(record)) {
    signals.push('not_ready');
  }

  if (hasBlockerRisk(record)) {
    signals.push('blocker_or_unowned_dependency');
  }

  if (hasLargeScope(record.task)) {
    signals.push('scope_risk');
  }

  return unique(signals);
}

function getTaskRecommendedAction(signals: string[]): string {
  const signalSet = new Set(signals);

  if (signalSet.has('blocker_or_unowned_dependency')) {
    return 'Assign dependency owner, next checkpoint date and fallback before committing the task.';
  }

  if (signalSet.has('qa_verification_gap')) {
    return 'Add acceptance criteria, expected result and explicit verification notes with QA.';
  }

  if (signalSet.has('not_ready') || signalSet.has('low_clarity')) {
    return 'Run refinement before development and rewrite the task around context, outcome and checks.';
  }

  if (signalSet.has('scope_risk')) {
    return 'Split the task or mark the smallest releasable slice for the current iteration.';
  }

  return 'Keep ownership visible and monitor the task on the next planning checkpoint.';
}

function toOwnershipRiskTask(record: TaskAnalysisRecord): OwnershipRiskTask {
  const signals = getTaskSignals(record);

  return {
    taskId: getTaskId(record.task),
    title: record.task.title,
    status: record.task.status,
    assignee: record.task.assignee,
    priority: record.task.priority,
    score: record.score,
    riskLevel: record.riskLevel,
    smartScore: record.smartAnalysis.totalScore,
    signals,
    recommendedAction: getTaskRecommendedAction(signals)
  };
}

function getTaskPriorityScore(record: TaskAnalysisRecord): number {
  return (record.riskLevel === 'high' ? 35 : record.riskLevel === 'medium' ? 15 : 0) +
    (100 - record.score) * 0.35 +
    (100 - record.smartAnalysis.totalScore) * 0.15 +
    (hasBlockerRisk(record) ? 25 : 0) +
    (hasQaGap(record) ? 14 : 0) +
    (isNotReady(record) ? 12 : 0) +
    (hasLargeScope(record.task) ? 10 : 0);
}

function getOwnerRiskScore(
  records: TaskAnalysisRecord[],
  activeTaskCount: number,
  maxActiveTasks: number
): number {
  const highRiskTasks = records.filter((record) => record.riskLevel === 'high').length;
  const mediumRiskTasks = records.filter((record) => record.riskLevel === 'medium').length;
  const lowClarityTasks = records.filter((record) => record.score < 60).length;
  const qaGapTasks = records.filter(hasQaGap).length;
  const notReadyTasks = records.filter(isNotReady).length;
  const blockerTasks = records.filter(hasBlockerRisk).length;
  const scopeRiskTasks = records.filter((record) => hasLargeScope(record.task)).length;
  const clarityPenalty = Math.max(0, 70 - average(records.map((record) => record.score))) * 0.4;
  const overloadPenalty = Math.max(0, activeTaskCount - maxActiveTasks) * 8;

  return Math.min(100, round(
    highRiskTasks * 25 +
    mediumRiskTasks * 10 +
    lowClarityTasks * 12 +
    qaGapTasks * 10 +
    notReadyTasks * 8 +
    blockerTasks * 16 +
    scopeRiskTasks * 8 +
    clarityPenalty +
    overloadPenalty
  ));
}

function getOwnerRiskLevel(profile: Omit<OwnerRiskProfile, 'riskLevel' | 'recommendation'>): OwnerRiskLevel {
  if (
    profile.ownerRiskScore >= 70 ||
    profile.highRiskTasks >= 2 ||
    (profile.highRiskTasks > 0 && profile.blockerTasks > 0)
  ) {
    return 'critical';
  }

  if (
    profile.ownerRiskScore >= 35 ||
    profile.highRiskTasks > 0 ||
    profile.lowClarityTasks > 0 ||
    profile.qaGapTasks > 0 ||
    profile.notReadyTasks > 0 ||
    profile.blockerTasks > 0 ||
    profile.scopeRiskTasks > 0
  ) {
    return 'watch';
  }

  return 'stable';
}

function getOwnerRecommendation(profile: Omit<OwnerRiskProfile, 'recommendation'>, maxActiveTasks: number): string {
  if (profile.riskLevel === 'critical') {
    return 'Run ownership review: reduce parallel work, name a backup owner and close blockers before planning commitment.';
  }

  if (profile.activeTaskCount > maxActiveTasks) {
    return 'Reduce WIP or move low-priority tasks to another owner before adding more work.';
  }

  if (profile.blockerTasks > 0) {
    return 'Assign dependency owner, next checkpoint date and fallback for blocked work.';
  }

  if (profile.qaGapTasks > 0) {
    return 'Pair with QA to close verification gaps before tasks move to testing.';
  }

  if (profile.notReadyTasks > 0 || profile.lowClarityTasks > 0) {
    return 'Schedule refinement for unclear work and update descriptions before development starts.';
  }

  if (profile.scopeRiskTasks > 0) {
    return 'Split broad tasks into smaller deliverable slices.';
  }

  return 'Ownership looks stable; keep current owner visible in planning and retro.';
}

function toOwnerRiskProfile(
  owner: string,
  records: TaskAnalysisRecord[],
  options: {
    maxActiveTasks: number;
    taskLimit: number;
  }
): OwnerRiskProfile {
  const activeRecords = records.filter((record) => !isDoneStatus(record.task.status));
  const tasks = [...records]
    .sort((a, b) => getTaskPriorityScore(b) - getTaskPriorityScore(a) || getTaskId(a.task).localeCompare(getTaskId(b.task)))
    .slice(0, options.taskLimit)
    .map(toOwnershipRiskTask);
  const baseProfile = {
    owner,
    taskCount: records.length,
    activeTaskCount: activeRecords.length,
    averageClarityScore: average(records.map((record) => record.score)),
    averageSmartScore: average(records.map((record) => record.smartAnalysis.totalScore)),
    highRiskTasks: records.filter((record) => record.riskLevel === 'high').length,
    mediumRiskTasks: records.filter((record) => record.riskLevel === 'medium').length,
    lowClarityTasks: records.filter((record) => record.score < 60).length,
    qaGapTasks: records.filter(hasQaGap).length,
    notReadyTasks: records.filter(isNotReady).length,
    blockerTasks: records.filter(hasBlockerRisk).length,
    scopeRiskTasks: records.filter((record) => hasLargeScope(record.task)).length,
    ownerRiskScore: getOwnerRiskScore(records, activeRecords.length, options.maxActiveTasks),
    tasks
  };
  const riskLevel = getOwnerRiskLevel(baseProfile);
  const profile = {
    ...baseProfile,
    riskLevel
  };

  return {
    ...profile,
    recommendation: getOwnerRecommendation(profile, options.maxActiveTasks)
  };
}

function groupByOwner(records: TaskAnalysisRecord[]): Map<string, TaskAnalysisRecord[]> {
  const groups = new Map<string, TaskAnalysisRecord[]>();

  for (const record of records) {
    const owner = record.task.assignee?.trim();

    if (!owner) {
      continue;
    }

    groups.set(owner, [...(groups.get(owner) || []), record]);
  }

  return groups;
}

function isUnassignedRisk(record: TaskAnalysisRecord): boolean {
  return !record.task.assignee &&
    !isDoneStatus(record.task.status) &&
    (
      record.riskLevel !== 'low' ||
      record.score < 80 ||
      hasQaGap(record) ||
      isNotReady(record) ||
      hasBlockerRisk(record)
    );
}

function buildRecommendations(report: Omit<OwnershipRiskReport, 'recommendations'>): string[] {
  const recommendations: string[] = [];

  if (report.unassignedRiskTasks > 0) {
    recommendations.push('Назначить владельцев для рискованных unassigned задач до следующего planning checkpoint.');
  }

  if (report.summary.criticalOwners > 0) {
    recommendations.push('Провести ownership review для critical owners: WIP, backup owner, blockers и QA gaps.');
  }

  if (report.summary.overloadedOwners > 0) {
    recommendations.push('Ограничить параллельную работу у overloaded owners или перераспределить низкоприоритетные задачи.');
  }

  if (report.summary.qaGapTasks > 0) {
    recommendations.push('Закрыть QA verification gaps вместе с владельцами задач, а не оставлять их до Testing.');
  }

  if (report.summary.notReadyTasks > 0) {
    recommendations.push('Вернуть not-ready задачи в refinement до commitment.');
  }

  return recommendations.length > 0
    ? recommendations
    : ['Ownership risk looks stable; keep owner distribution visible in planning and retro.'];
}

export function buildOwnershipRiskReport(
  records: TaskAnalysisRecord[],
  options: {
    generatedAt?: string;
    ownerLimit?: number;
    taskLimit?: number;
    maxActiveTasks?: number;
  } = {}
): OwnershipRiskReport {
  const maxActiveTasks = options.maxActiveTasks ?? 5;
  const taskLimit = options.taskLimit ?? 5;
  const ownerProfilesAll = Array.from(groupByOwner(records).entries())
    .map(([owner, ownerRecords]) =>
      toOwnerRiskProfile(owner, ownerRecords, { maxActiveTasks, taskLimit })
    )
    .sort((a, b) =>
      b.ownerRiskScore - a.ownerRiskScore ||
      b.highRiskTasks - a.highRiskTasks ||
      a.owner.localeCompare(b.owner)
    );
  const unassignedRiskQueue = records
    .filter(isUnassignedRisk)
    .sort((a, b) => getTaskPriorityScore(b) - getTaskPriorityScore(a) || getTaskId(a.task).localeCompare(getTaskId(b.task)))
    .slice(0, options.taskLimit ?? 10)
    .map(toOwnershipRiskTask);
  const baseReport = {
    generatedAt: options.generatedAt || new Date().toISOString(),
    totalTasks: records.length,
    assignedTasks: records.filter((record) => Boolean(record.task.assignee)).length,
    unassignedTasks: records.filter((record) => !record.task.assignee).length,
    unassignedRiskTasks: records.filter(isUnassignedRisk).length,
    summary: {
      criticalOwners: ownerProfilesAll.filter((profile) => profile.riskLevel === 'critical').length,
      watchOwners: ownerProfilesAll.filter((profile) => profile.riskLevel === 'watch').length,
      stableOwners: ownerProfilesAll.filter((profile) => profile.riskLevel === 'stable').length,
      overloadedOwners: ownerProfilesAll.filter((profile) => profile.activeTaskCount > maxActiveTasks).length,
      highRiskTasks: records.filter((record) => record.riskLevel === 'high').length,
      qaGapTasks: records.filter(hasQaGap).length,
      notReadyTasks: records.filter(isNotReady).length,
      blockerTasks: records.filter(hasBlockerRisk).length,
      averageClarityScore: average(records.map((record) => record.score))
    },
    ownerProfiles: ownerProfilesAll.slice(0, options.ownerLimit ?? 12),
    unassignedRiskQueue
  };

  return {
    ...baseReport,
    recommendations: buildRecommendations(baseReport)
  };
}

export function formatOwnershipRiskJson(report: OwnershipRiskReport): string {
  return JSON.stringify(report, null, 2);
}

export function formatOwnershipRiskCsv(report: OwnershipRiskReport): string {
  const header = [
    'rowType',
    'owner',
    'taskId',
    'title',
    'status',
    'riskLevel',
    'clarityScore',
    'smartScore',
    'ownerRiskScore',
    'signals',
    'recommendation'
  ];
  const ownerRows = report.ownerProfiles.map((profile) => [
    'owner',
    profile.owner,
    '',
    '',
    '',
    profile.riskLevel,
    profile.averageClarityScore,
    profile.averageSmartScore,
    profile.ownerRiskScore,
    [
      `highRisk:${profile.highRiskTasks}`,
      `qaGap:${profile.qaGapTasks}`,
      `notReady:${profile.notReadyTasks}`,
      `blockers:${profile.blockerTasks}`
    ].join('|'),
    profile.recommendation
  ]);
  const taskRows = [
    ...report.ownerProfiles.flatMap((profile) =>
      profile.tasks.map((task) => [
        'owned_task',
        profile.owner,
        task.taskId,
        task.title,
        task.status || '',
        task.riskLevel,
        task.score,
        task.smartScore,
        profile.ownerRiskScore,
        task.signals.join('|'),
        task.recommendedAction
      ])
    ),
    ...report.unassignedRiskQueue.map((task) => [
      'unassigned_task',
      '',
      task.taskId,
      task.title,
      task.status || '',
      task.riskLevel,
      task.score,
      task.smartScore,
      '',
      task.signals.join('|'),
      task.recommendedAction
    ])
  ];

  return [
    header.map(csvEscape).join(','),
    ...[...ownerRows, ...taskRows].map((row) => row.map(csvEscape).join(','))
  ].join('\n');
}

function formatList(items: string[]): string[] {
  return items.length > 0
    ? items.map((item) => `- ${item}`)
    : ['- Нет.'];
}

function formatTaskLine(task: OwnershipRiskTask): string {
  return `${task.taskId} - ${tableCell(task.title)}: risk ${task.riskLevel}, clarity ${task.score}/100, SMART ${task.smartScore}/100, status ${task.status || 'not set'}. ${task.recommendedAction}`;
}

export function formatOwnershipRiskMarkdown(report: OwnershipRiskReport): string {
  const ownerRows = report.ownerProfiles.map((profile) =>
    `| ${tableCell(profile.owner)} | ${profile.riskLevel} | ${profile.ownerRiskScore} | ${profile.activeTaskCount}/${profile.taskCount} | ${profile.averageClarityScore} | ${profile.averageSmartScore} | ${profile.highRiskTasks} | ${profile.qaGapTasks} | ${profile.notReadyTasks} | ${profile.blockerTasks} | ${tableCell(profile.recommendation)} |`
  );
  const ownerDetails = report.ownerProfiles.flatMap((profile, index) => [
    `### ${index + 1}. ${tableCell(profile.owner)}`,
    '',
    `- Risk level: ${profile.riskLevel}`,
    `- Owner risk score: ${profile.ownerRiskScore}/100`,
    `- Active / total tasks: ${profile.activeTaskCount}/${profile.taskCount}`,
    `- Average Clarity / SMART: ${profile.averageClarityScore}/100 / ${profile.averageSmartScore}/100`,
    `- High-risk / QA gap / Not-ready / Blocker tasks: ${profile.highRiskTasks} / ${profile.qaGapTasks} / ${profile.notReadyTasks} / ${profile.blockerTasks}`,
    `- Recommendation: ${profile.recommendation}`,
    '',
    '**Priority tasks:**',
    '',
    ...formatList(profile.tasks.map(formatTaskLine)),
    ''
  ]);

  return [
    '# Ownership Risk',
    '',
    `Generated at: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    `- Total tasks: ${report.totalTasks}`,
    `- Assigned tasks: ${report.assignedTasks}`,
    `- Unassigned tasks: ${report.unassignedTasks}`,
    `- Unassigned risk tasks: ${report.unassignedRiskTasks}`,
    `- Average Clarity Score: ${report.summary.averageClarityScore}/100`,
    `- Owners: ${report.summary.criticalOwners} critical, ${report.summary.watchOwners} watch, ${report.summary.stableOwners} stable`,
    `- Overloaded owners: ${report.summary.overloadedOwners}`,
    `- High-risk / QA gap / Not-ready / Blocker tasks: ${report.summary.highRiskTasks} / ${report.summary.qaGapTasks} / ${report.summary.notReadyTasks} / ${report.summary.blockerTasks}`,
    '',
    '## Team Recommendations',
    '',
    ...formatList(report.recommendations),
    '',
    '## Owner Heatmap',
    '',
    '| Owner | Level | Risk score | Active/total | Clarity | SMART | High risk | QA gaps | Not ready | Blockers | Recommendation |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
    ...(ownerRows.length > 0 ? ownerRows : ['| - | stable | 0 | 0/0 | 0 | 0 | 0 | 0 | 0 | 0 | No owner profiles |']),
    '',
    '## Unassigned Risk Queue',
    '',
    ...formatList(report.unassignedRiskQueue.map(formatTaskLine)),
    '',
    '## Owner Details',
    '',
    ...(ownerDetails.length > 0 ? ownerDetails : ['Owner-specific risks were not found.'])
  ].join('\n');
}

function formatOwnershipRisk(
  report: OwnershipRiskReport,
  format: ReportFormat
): string {
  if (format === 'json') {
    return formatOwnershipRiskJson(report);
  }

  if (format === 'csv') {
    return formatOwnershipRiskCsv(report);
  }

  return formatOwnershipRiskMarkdown(report);
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
  const report = buildOwnershipRiskReport(records, {
    ownerLimit: parseNumberArg(args, 'owner-limit') ?? 12,
    taskLimit: parseNumberArg(args, 'task-limit') ?? 5,
    maxActiveTasks: parseNumberArg(args, 'max-active-tasks') ?? 5
  });
  const format = inferReportFormat(outputPath, getStringArg(args, 'format'));

  writeReport(outputPath, formatOwnershipRisk(report, format));
  process.stdout.write(`Ownership Risk сохранён: ${outputPath}\n`);
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
