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
  getTaskId,
  hasAcceptanceCriteria,
  hasContext,
  hasDependencyInfo,
  hasExpectedResult,
  hasExternalDependency,
  hasLargeScope,
  hasOpenBlocker,
  hasTestingSignal,
  hasVagueWording,
  isDoneStatus
} from './task-signals';
import {
  getStringArg,
  makeCliError,
  parseArgs,
  readJsonFile
} from './utils';

import type {
  EvidenceBriefItem
} from './evidence-brief';
import type {
  ReportFormat
} from './report-utils';
import type {
  TaskAnalysisRecord
} from './types';

export type HandoffRole = 'Analyst' | 'Developer' | 'QA';
export type HandoffStatus = 'ready' | 'needs_input' | 'blocked';
export type HandoffMeeting = 'none' | 'refinement' | 'risk_review' | 'qa_handoff';

export interface RoleHandoff {
  role: HandoffRole;
  status: HandoffStatus;
  score: number;
  readySignals: string[];
  blockers: string[];
  nextAction: string;
}

export interface TeamHandoffItem {
  taskId: string;
  title: string;
  source: string;
  status?: string;
  assignee?: string;
  clarityScore: number;
  smartScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  overallStatus: HandoffStatus;
  recommendedMeeting: HandoffMeeting;
  analyst: RoleHandoff;
  developer: RoleHandoff;
  qa: RoleHandoff;
  openReports: string[];
}

export interface TeamHandoffReport {
  generatedAt: string;
  totalTasks: number;
  includedTasks: number;
  summary: {
    readyForDevelopment: number;
    blockedForDevelopment: number;
    readyForQa: number;
    blockedForQa: number;
    analystNeedsInput: number;
    fullyReady: number;
    totalRoleBlockers: number;
    topBlockers: Array<{
      name: string;
      count: number;
    }>;
    roleDistribution: Array<{
      role: HandoffRole;
      ready: number;
      needsInput: number;
      blocked: number;
    }>;
  };
  recommendations: string[];
  items: TeamHandoffItem[];
}

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

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function countBy(values: string[], limit = 8): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

function statusRank(status: HandoffStatus): number {
  if (status === 'blocked') {
    return 0;
  }

  if (status === 'needs_input') {
    return 1;
  }

  return 2;
}

function roleScore(base: number, blockers: string[], softWarnings: string[] = []): number {
  return clampScore(base - blockers.length * 18 - softWarnings.length * 7);
}

function roleStatus(score: number, blockers: string[], hardBlockerPatterns: RegExp[] = []): HandoffStatus {
  if (blockers.some((blocker) => hardBlockerPatterns.some((pattern) => pattern.test(blocker)))) {
    return 'blocked';
  }

  if (score < 50) {
    return 'blocked';
  }

  if (blockers.length > 0 || score < 80) {
    return 'needs_input';
  }

  return 'ready';
}

function buildAnalystHandoff(
  record: TaskAnalysisRecord,
  evidence: EvidenceBriefItem | undefined
): RoleHandoff {
  const blockers: string[] = [];
  const readySignals: string[] = [];
  const evidenceGapCodes = evidence?.evidenceGaps.map((gap) => gap.code) || [];

  if (hasContext(record.task)) {
    readySignals.push('problem context is present');
  } else {
    blockers.push('missing problem context');
  }

  if (hasExpectedResult(record.task)) {
    readySignals.push('decision intent / expected result is present');
  } else {
    blockers.push('missing expected result');
  }

  if (record.smartAnalysis.totalScore >= 70) {
    readySignals.push('SMART goal is mostly clear');
  } else {
    blockers.push('weak SMART framing');
  }

  if (evidence && evidence.evidenceGaps.length === 0) {
    readySignals.push('evidence brief has no gaps');
  } else if (evidenceGapCodes.includes('missing_evidence_source')) {
    blockers.push('missing evidence source');
  } else if (evidenceGapCodes.length > 0) {
    blockers.push('evidence gaps need review');
  }

  if (record.problemCodes.includes('hidden_agreement')) {
    blockers.push('hidden agreement must be documented');
  }

  const score = roleScore(record.smartAnalysis.totalScore, blockers, record.problemCodes);
  const status = roleStatus(score, blockers, [/missing problem context/, /missing expected result/]);

  return {
    role: 'Analyst',
    status,
    score,
    readySignals,
    blockers: unique(blockers),
    nextAction: status === 'ready'
      ? 'Keep problem framing and evidence as reference for delivery.'
      : 'Clarify problem, expected outcome, evidence source and decision assumptions before handoff.'
  };
}

function buildDeveloperHandoff(record: TaskAnalysisRecord): RoleHandoff {
  const currentTask = {
    ...record.task,
    clarityScore: record.score
  };
  const dor = checkDefinitionOfReady(currentTask);
  const risk = analyzeTaskRisk(currentTask);
  const blockers: string[] = [];
  const readySignals: string[] = [];

  if (dor.dorPassed) {
    readySignals.push('Definition of Ready passed');
  } else {
    blockers.push(`DoR not passed: ${dor.failedChecks.slice(0, 3).join(', ')}`);
  }

  if (risk.riskLevel === 'high') {
    blockers.push('high delivery risk');
  } else {
    readySignals.push(`delivery risk is ${risk.riskLevel}`);
  }

  if (hasExternalDependency(record.task) && !hasDependencyInfo(record.task)) {
    blockers.push('external dependency has no owner or ready condition');
  }

  if (hasOpenBlocker(record.task)) {
    blockers.push('open blocker must be resolved');
  }

  if (hasLargeScope(record.task)) {
    blockers.push('scope needs decomposition');
  }

  if (hasVagueWording(record.task)) {
    blockers.push('vague wording remains in task');
  }

  if (record.score >= 80) {
    readySignals.push('task description is clear enough for implementation');
  }

  const score = roleScore(dor.dorScore, blockers);
  const status = roleStatus(score, blockers, [/open blocker/, /external dependency/, /high delivery risk/]);

  return {
    role: 'Developer',
    status,
    score,
    readySignals,
    blockers: unique(blockers),
    nextAction: status === 'ready'
      ? 'Implementation can start; keep risk notes and verification path visible.'
      : 'Resolve blockers, split scope or run risk review before implementation commitment.'
  };
}

function buildQaHandoff(record: TaskAnalysisRecord): RoleHandoff {
  const dod = checkDefinitionOfDone(record.task);
  const blockers: string[] = [];
  const readySignals: string[] = [];

  if (hasExpectedResult(record.task)) {
    readySignals.push('expected result is testable');
  } else {
    blockers.push('missing expected result');
  }

  if (hasAcceptanceCriteria(record.task)) {
    readySignals.push('acceptance criteria are present');
  } else {
    blockers.push('missing acceptance criteria');
  }

  if (record.task.workItemType === 'bug' && !hasTestingSignal(record.task)) {
    blockers.push('bug lacks reproduction or testing signal');
  }

  if (hasOpenBlocker(record.task)) {
    blockers.push('open blocker prevents QA handoff');
  }

  if (isDoneStatus(record.task.status)) {
    if (dod.dodPassed) {
      readySignals.push('Definition of Done passed');
    } else {
      blockers.push(`DoD not passed: ${dod.failedChecks.slice(0, 3).join(', ')}`);
    }
  } else if (hasTestingSignal(record.task)) {
    readySignals.push('testing signal is present');
  }

  const score = roleScore(isDoneStatus(record.task.status) ? dod.dodScore : 75, blockers);
  const status = roleStatus(score, blockers, [/missing acceptance criteria/, /missing expected result/, /open blocker/]);

  return {
    role: 'QA',
    status,
    score,
    readySignals,
    blockers: unique(blockers),
    nextAction: status === 'ready'
      ? 'QA can verify against expected result, acceptance criteria and regression notes.'
      : 'Add expected result, acceptance criteria, reproduction/testing notes and resolve blockers before QA handoff.'
  };
}

function getOverallStatus(roles: RoleHandoff[]): HandoffStatus {
  if (roles.some((role) => role.status === 'blocked')) {
    return 'blocked';
  }

  if (roles.some((role) => role.status === 'needs_input')) {
    return 'needs_input';
  }

  return 'ready';
}

function getRecommendedMeeting(item: Pick<TeamHandoffItem, 'analyst' | 'developer' | 'qa' | 'riskLevel'>): HandoffMeeting {
  if (item.developer.blockers.some((blocker) => /risk|dependency|scope|blocker/i.test(blocker)) || item.riskLevel === 'high') {
    return 'risk_review';
  }

  if (item.qa.status !== 'ready') {
    return 'qa_handoff';
  }

  if (item.analyst.status !== 'ready' || item.developer.status !== 'ready') {
    return 'refinement';
  }

  return 'none';
}

function getOpenReports(item: Pick<TeamHandoffItem, 'analyst' | 'developer' | 'qa' | 'recommendedMeeting'>): string[] {
  const reports: string[] = ['team-handoff.md'];

  if (item.analyst.status !== 'ready') {
    reports.push('evidence-brief.md', 'decision-ledger.md');
  }

  if (item.developer.status !== 'ready') {
    reports.push('refinement-agenda.md', 'release-guard.md');
  }

  if (item.qa.status !== 'ready') {
    reports.push('task-health-profile.md', 'release-guard.md');
  }

  if (item.recommendedMeeting === 'risk_review') {
    reports.push('ownership-risk.md');
  }

  return unique(reports);
}

function toTeamHandoffItem(
  record: TaskAnalysisRecord,
  evidenceByTaskId: Map<string, EvidenceBriefItem>
): TeamHandoffItem {
  const taskId = getTaskId(record.task);
  const analyst = buildAnalystHandoff(record, evidenceByTaskId.get(taskId));
  const developer = buildDeveloperHandoff(record);
  const qa = buildQaHandoff(record);
  const baseItem = {
    taskId,
    title: record.task.title,
    source: record.task.source,
    status: record.task.status,
    assignee: record.task.assignee,
    clarityScore: record.score,
    smartScore: record.smartAnalysis.totalScore,
    riskLevel: record.riskLevel,
    overallStatus: getOverallStatus([analyst, developer, qa]),
    recommendedMeeting: 'none' as HandoffMeeting,
    analyst,
    developer,
    qa,
    openReports: []
  };
  const recommendedMeeting = getRecommendedMeeting(baseItem);
  const item = {
    ...baseItem,
    recommendedMeeting
  };

  return {
    ...item,
    openReports: getOpenReports(item)
  };
}

function buildRecommendations(items: TeamHandoffItem[]): string[] {
  const recommendations: string[] = [];

  if (items.some((item) => item.analyst.status !== 'ready')) {
    recommendations.push('Analyst: close problem framing, expected result and evidence gaps before implementation handoff.');
  }

  if (items.some((item) => item.developer.status === 'blocked')) {
    recommendations.push('Developer / Tech Lead: run risk review for blocked implementation items before commitment.');
  }

  if (items.some((item) => item.qa.status !== 'ready')) {
    recommendations.push('QA: request acceptance criteria, expected result and reproduction/testing notes before test design.');
  }

  if (items.some((item) => item.recommendedMeeting === 'risk_review')) {
    recommendations.push('PM: schedule one focused risk review instead of spreading blockers across async comments.');
  }

  return recommendations.length > 0
    ? recommendations
    : ['Team handoff looks clean; use ready tasks as examples for future backlog items.'];
}

function buildRoleDistribution(items: TeamHandoffItem[]): TeamHandoffReport['summary']['roleDistribution'] {
  const roles: HandoffRole[] = ['Analyst', 'Developer', 'QA'];

  return roles.map((role) => {
    const handoffs = items.map((item) =>
      role === 'Analyst' ? item.analyst : role === 'Developer' ? item.developer : item.qa
    );

    return {
      role,
      ready: handoffs.filter((handoff) => handoff.status === 'ready').length,
      needsInput: handoffs.filter((handoff) => handoff.status === 'needs_input').length,
      blocked: handoffs.filter((handoff) => handoff.status === 'blocked').length
    };
  });
}

function itemSortScore(item: TeamHandoffItem): number {
  return (item.overallStatus === 'blocked' ? 80 : item.overallStatus === 'needs_input' ? 40 : 0) +
    (item.riskLevel === 'high' ? 25 : item.riskLevel === 'medium' ? 10 : 0) +
    (100 - item.clarityScore) * 0.2 +
    item.analyst.blockers.length * 4 +
    item.developer.blockers.length * 5 +
    item.qa.blockers.length * 5;
}

export function buildTeamHandoffReport(
  records: TaskAnalysisRecord[],
  options: {
    generatedAt?: string;
    limit?: number;
    includeReady?: boolean;
  } = {}
): TeamHandoffReport {
  const evidence = buildEvidenceBriefReport(records, { includeReady: true });
  const evidenceByTaskId = new Map(evidence.items.map((item) => [item.taskId, item]));
  const allItems = records
    .map((record) => toTeamHandoffItem(record, evidenceByTaskId))
    .sort((a, b) => itemSortScore(b) - itemSortScore(a) || a.taskId.localeCompare(b.taskId));
  const items = allItems
    .filter((item) => options.includeReady || item.overallStatus !== 'ready')
    .slice(0, options.limit ?? 20);
  const allBlockers = allItems.flatMap((item) => [
    ...item.analyst.blockers.map((blocker) => `Analyst: ${blocker}`),
    ...item.developer.blockers.map((blocker) => `Developer: ${blocker}`),
    ...item.qa.blockers.map((blocker) => `QA: ${blocker}`)
  ]);

  return {
    generatedAt: options.generatedAt || new Date().toISOString(),
    totalTasks: records.length,
    includedTasks: items.length,
    summary: {
      readyForDevelopment: allItems.filter((item) => item.developer.status === 'ready').length,
      blockedForDevelopment: allItems.filter((item) => item.developer.status === 'blocked').length,
      readyForQa: allItems.filter((item) => item.qa.status === 'ready').length,
      blockedForQa: allItems.filter((item) => item.qa.status === 'blocked').length,
      analystNeedsInput: allItems.filter((item) => item.analyst.status !== 'ready').length,
      fullyReady: allItems.filter((item) => item.overallStatus === 'ready').length,
      totalRoleBlockers: allBlockers.length,
      topBlockers: countBy(allBlockers),
      roleDistribution: buildRoleDistribution(allItems)
    },
    recommendations: buildRecommendations(allItems),
    items
  };
}

export function formatTeamHandoffJson(report: TeamHandoffReport): string {
  return JSON.stringify(report, null, 2);
}

export function formatTeamHandoffCsv(report: TeamHandoffReport): string {
  const header = [
    'taskId',
    'title',
    'assignee',
    'status',
    'overallStatus',
    'recommendedMeeting',
    'clarityScore',
    'smartScore',
    'riskLevel',
    'analystStatus',
    'developerStatus',
    'qaStatus',
    'analystBlockers',
    'developerBlockers',
    'qaBlockers',
    'openReports'
  ];
  const rows = report.items.map((item) => [
    item.taskId,
    item.title,
    item.assignee || '',
    item.status || '',
    item.overallStatus,
    item.recommendedMeeting,
    item.clarityScore,
    item.smartScore,
    item.riskLevel,
    item.analyst.status,
    item.developer.status,
    item.qa.status,
    item.analyst.blockers.join('|'),
    item.developer.blockers.join('|'),
    item.qa.blockers.join('|'),
    item.openReports.join('|')
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

function formatRole(role: RoleHandoff): string[] {
  return [
    `- ${role.role}: ${role.status}, score ${role.score}/100`,
    `  - Next action: ${role.nextAction}`,
    `  - Blockers: ${role.blockers.join('; ') || 'none'}`,
    `  - Ready signals: ${role.readySignals.join('; ') || 'none'}`
  ];
}

export function formatTeamHandoffMarkdown(report: TeamHandoffReport): string {
  const roleRows = report.summary.roleDistribution.map((role) =>
    `| ${role.role} | ${role.ready} | ${role.needsInput} | ${role.blocked} |`
  );
  const items = report.items.flatMap((item, index) => [
    `### ${index + 1}. ${item.taskId} - ${tableCell(item.title)}`,
    '',
    `- Overall handoff status: ${item.overallStatus}`,
    `- Recommended meeting: ${item.recommendedMeeting}`,
    `- Clarity / SMART: ${item.clarityScore}/100 / ${item.smartScore}/100`,
    `- Risk: ${item.riskLevel}`,
    `- Assignee: ${item.assignee || 'not assigned'}`,
    `- Status: ${item.status || 'not set'}`,
    `- Open reports: ${item.openReports.join(', ')}`,
    '',
    '**Role handoff:**',
    '',
    ...formatRole(item.analyst),
    ...formatRole(item.developer),
    ...formatRole(item.qa),
    ''
  ]);

  return [
    '# Team Handoff Matrix',
    '',
    `Generated at: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    `- Total tasks: ${report.totalTasks}`,
    `- Included tasks: ${report.includedTasks}`,
    `- Fully ready tasks: ${report.summary.fullyReady}`,
    `- Ready for development: ${report.summary.readyForDevelopment}`,
    `- Blocked for development: ${report.summary.blockedForDevelopment}`,
    `- Ready for QA: ${report.summary.readyForQa}`,
    `- Blocked for QA: ${report.summary.blockedForQa}`,
    `- Analyst needs input: ${report.summary.analystNeedsInput}`,
    `- Total role blockers: ${report.summary.totalRoleBlockers}`,
    '',
    '## Recommendations',
    '',
    ...formatList(report.recommendations),
    '',
    '## Role Distribution',
    '',
    '| Role | Ready | Needs input | Blocked |',
    '| --- | ---: | ---: | ---: |',
    ...(roleRows.length > 0 ? roleRows : ['| - | 0 | 0 | 0 |']),
    '',
    '## Top Blockers',
    '',
    ...formatList(report.summary.topBlockers.map((blocker) => `${blocker.name}: ${blocker.count}`)),
    '',
    '## Handoff Queue',
    '',
    ...(items.length > 0 ? items : ['No handoff issues found.'])
  ].join('\n');
}

function formatTeamHandoffReport(report: TeamHandoffReport, format: ReportFormat): string {
  if (format === 'json') {
    return formatTeamHandoffJson(report);
  }

  if (format === 'csv') {
    return formatTeamHandoffCsv(report);
  }

  return formatTeamHandoffMarkdown(report);
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
  const report = buildTeamHandoffReport(records, {
    limit: parseNumberArg(args, 'limit') ?? 20,
    includeReady: args['include-ready'] === true
  });
  const format = inferReportFormat(outputPath, getStringArg(args, 'format'));

  writeReport(outputPath, formatTeamHandoffReport(report, format));
  process.stdout.write(`Team Handoff Matrix сохранён: ${outputPath}\n`);
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
