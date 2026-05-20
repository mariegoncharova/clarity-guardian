import {
  analyzeUnifiedTasks
} from './analytics';
import {
  loadConfig
} from './config';
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
  calculateCycleTime,
  calculateLeadTime,
  calculateTimeInStatus,
  isReturnedFromTesting,
  STUCK_STATUS_THRESHOLDS_DAYS
} from './retro-analyzer';
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
  hasExpectedResult,
  hasOpenBlocker,
  hasTestingSignal
} from './task-signals';
import {
  getStringArg,
  makeCliError,
  parseArgs,
  readJsonFile
} from './utils';

import type {
  ReportFormat
} from './report-utils';
import type {
  ResolvedConfig,
  ResolvedRiskThresholdConfig,
  TaskAnalysisRecord
} from './types';

export type TaskHealthStatus = 'healthy' | 'needs_refinement' | 'qa_risk' | 'delivery_risk';

export interface TaskHealthProfile {
  taskId: string;
  title: string;
  source: string;
  assignee?: string;
  status?: string;
  clarityScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  riskScore: number;
  dorScore: number;
  dodScore: number;
  leadTimeDays: number;
  cycleTimeDays: number;
  healthStatus: TaskHealthStatus;
  missingSections: string[];
  weakFormulations: string[];
  toneIssues: string[];
  deliveryRisks: string[];
  qaRisks: string[];
  managerRecommendations: string[];
  nextBestAction: string;
}

export interface ProjectQualitySummary {
  generatedAt: string;
  totalTasks: number;
  averageClarityScore: number;
  goodTaskPercent: number;
  missingAcceptanceCriteriaPercent: number;
  vagueFormulationsPercent: number;
  highRiskPercent: number;
  reopenedTasks: number;
  stuckTasks: number;
  mostCommonProblems: Array<{
    name: string;
    count: number;
  }>;
  mostProblematicStatuses: Array<{
    name: string;
    count: number;
  }>;
  recommendations: string[];
}

export interface TaskHealthReport {
  summary: ProjectQualitySummary;
  profiles: TaskHealthProfile[];
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function percent(part: number, total: number): number {
  if (total === 0) {
    return 0;
  }

  return round((part / total) * 100);
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

function countBy(values: string[], limit = 7): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();

  for (const value of values) {
    const key = value || 'Не указано';
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

function getMissingSections(record: TaskAnalysisRecord): string[] {
  const sections: string[] = [];

  if (!hasContext(record.task)) {
    sections.push('context');
  }

  if (!hasExpectedResult(record.task)) {
    sections.push('expected_result');
  }

  if (!hasAcceptanceCriteria(record.task)) {
    sections.push('acceptance_criteria');
  }

  if (record.analysis.remarks.some((remark) => /broken_without_reproduction/i.test(remark.code))) {
    sections.push('reproduction_steps');
  }

  return unique(sections);
}

function getWeakFormulations(record: TaskAnalysisRecord): string[] {
  return unique([
    ...record.analysis.remarks
      .filter((remark) => remark.phrase)
      .map((remark) => `${remark.phrase}: ${remark.message}`),
    ...record.analysis.toneOfVoice.problematicPhrases.map((phrase) =>
      `${phrase.phrase}: ${phrase.explanation}`
    )
  ]);
}

function getToneIssues(record: TaskAnalysisRecord): string[] {
  return record.analysis.toneOfVoice.categories.filter((category) => category !== 'constructive');
}

function getStuckSignals(record: TaskAnalysisRecord): string[] {
  return calculateTimeInStatus(record.task)
    .filter((duration) => {
      const threshold = STUCK_STATUS_THRESHOLDS_DAYS[duration.status] ?? 5;

      return duration.days > threshold;
    })
    .map((duration) =>
      `${duration.status}: ${duration.days}d above ${STUCK_STATUS_THRESHOLDS_DAYS[duration.status] ?? 5}d threshold`
    );
}

function taskWithCurrentScore(record: TaskAnalysisRecord): TaskAnalysisRecord['task'] {
  return {
    ...record.task,
    clarityScore: record.score
  };
}

function getDeliveryRisks(record: TaskAnalysisRecord, thresholds?: ResolvedRiskThresholdConfig): string[] {
  const risk = analyzeTaskRisk(taskWithCurrentScore(record), { thresholds });
  const stuckSignals = getStuckSignals(record);
  const cycleTime = calculateCycleTime(record.task);
  const deliveryRisks = [
    ...risk.riskFactors,
    ...stuckSignals,
    ...(hasOpenBlocker(record.task) ? ['Open blocker or unresolved dependency'] : []),
    ...(cycleTime.days > 7 ? [`Cycle time is high: ${cycleTime.days}d`] : [])
  ];

  return unique(deliveryRisks);
}

function formatFailedDoneCheck(check: string): string {
  const labels: Record<string, string> = {
    'Задача в завершённом статусе': 'Task is not in a done status',
    'Есть критерии приёмки': 'Acceptance criteria are missing',
    'Есть признак тестирования': 'Testing evidence is missing',
    'Нет открытых блокеров': 'Open blocker is still present',
    'Нет Reopened после последнего Testing': 'Task was reopened after testing',
    'Есть комментарий или поле о результате проверки': 'Verification result is missing'
  };

  return labels[check] || `DoD check failed: ${check}`;
}

function getQaRisks(record: TaskAnalysisRecord): string[] {
  const dod = checkDefinitionOfDone(record.task);
  const qaRisks = [
    ...dod.failedChecks
      .filter((check) => /критер|тест|провер|Reopened|блокер|Done|заверш/i.test(check))
      .map(formatFailedDoneCheck),
    ...(!hasAcceptanceCriteria(record.task) ? ['Missing acceptance criteria'] : []),
    ...(!hasExpectedResult(record.task) ? ['Missing expected result'] : []),
    ...(isReturnedFromTesting(record.task) ? ['Returned from testing'] : []),
    ...(record.task.workItemType === 'bug' && !hasTestingSignal(record.task)
      ? ['Bug lacks explicit testing or reproduction signal']
      : [])
  ];

  return unique(qaRisks);
}

function getHealthStatus(profile: Omit<TaskHealthProfile, 'healthStatus' | 'nextBestAction'>): TaskHealthStatus {
  if (profile.riskLevel === 'high' || profile.deliveryRisks.length >= 3) {
    return 'delivery_risk';
  }

  if (profile.qaRisks.length > 0) {
    return 'qa_risk';
  }

  if (
    profile.clarityScore < 80 ||
    profile.missingSections.length > 0 ||
    profile.weakFormulations.length > 0 ||
    profile.toneIssues.length > 0
  ) {
    return 'needs_refinement';
  }

  return 'healthy';
}

function getNextBestAction(profile: Omit<TaskHealthProfile, 'nextBestAction'>): string {
  if (profile.healthStatus === 'delivery_risk') {
    return 'Run a short risk review, split scope or unblock dependency before committing.';
  }

  if (profile.healthStatus === 'qa_risk') {
    return 'Add verification details: expected result, acceptance criteria and testing evidence.';
  }

  if (profile.healthStatus === 'needs_refinement') {
    return 'Clarify the task before development: context, outcome, weak wording and owner expectations.';
  }

  return 'Keep as reference example for task writing and reuse its structure in planning.';
}

function toTaskHealthProfile(record: TaskAnalysisRecord, thresholds?: ResolvedRiskThresholdConfig): TaskHealthProfile {
  const currentTask = taskWithCurrentScore(record);
  const risk = analyzeTaskRisk(currentTask, { thresholds });
  const dor = checkDefinitionOfReady(currentTask);
  const dod = checkDefinitionOfDone(record.task);
  const leadTime = calculateLeadTime(record.task);
  const cycleTime = calculateCycleTime(record.task);
  const baseProfile = {
    taskId: getTaskId(record.task),
    title: record.task.title,
    source: record.task.source,
    assignee: record.task.assignee,
    status: record.task.status,
    clarityScore: record.score,
    riskLevel: risk.riskLevel,
    riskScore: risk.riskScore,
    dorScore: dor.dorScore,
    dodScore: dod.dodScore,
    leadTimeDays: leadTime.days,
    cycleTimeDays: cycleTime.days,
    missingSections: getMissingSections(record),
    weakFormulations: getWeakFormulations(record),
    toneIssues: getToneIssues(record),
    deliveryRisks: getDeliveryRisks(record, thresholds),
    qaRisks: getQaRisks(record),
    managerRecommendations: unique([
      ...record.recommendations,
      dor.recommendation,
      risk.recommendation
    ])
  };
  const healthStatus = getHealthStatus(baseProfile);
  const profile = {
    ...baseProfile,
    healthStatus
  };

  return {
    ...profile,
    nextBestAction: getNextBestAction(profile)
  };
}

function statusRank(status: TaskHealthStatus): number {
  if (status === 'delivery_risk') {
    return 0;
  }

  if (status === 'qa_risk') {
    return 1;
  }

  if (status === 'needs_refinement') {
    return 2;
  }

  return 3;
}

function buildSummary(records: TaskAnalysisRecord[], profiles: TaskHealthProfile[], generatedAt: string): ProjectQualitySummary {
  const total = records.length;
  const commonProblems = countBy(records.flatMap((record) => record.problemCodes));
  const attentionProfiles = profiles.filter((profile) => profile.healthStatus !== 'healthy');

  return {
    generatedAt,
    totalTasks: total,
    averageClarityScore: average(records.map((record) => record.score)),
    goodTaskPercent: percent(records.filter((record) => record.score >= 80).length, total),
    missingAcceptanceCriteriaPercent: percent(
      records.filter((record) => record.problemCodes.includes('missing_acceptance_criteria')).length,
      total
    ),
    vagueFormulationsPercent: percent(
      records.filter((record) => record.problemCodes.includes('vague_wording')).length,
      total
    ),
    highRiskPercent: percent(profiles.filter((profile) => profile.riskLevel === 'high').length, total),
    reopenedTasks: records.filter((record) => isReturnedFromTesting(record.task)).length,
    stuckTasks: profiles.filter((profile) =>
      profile.deliveryRisks.some((risk) => /above .* threshold|Cycle time is high/i.test(risk))
    ).length,
    mostCommonProblems: commonProblems,
    mostProblematicStatuses: countBy(attentionProfiles.map((profile) => profile.status || 'Не указано')),
    recommendations: buildProjectRecommendations(total, profiles, commonProblems)
  };
}

function buildProjectRecommendations(
  total: number,
  profiles: TaskHealthProfile[],
  commonProblems: Array<{ name: string; count: number }>
): string[] {
  const recommendations: string[] = [];
  const count = (status: TaskHealthStatus): number =>
    profiles.filter((profile) => profile.healthStatus === status).length;
  const hasProblem = (name: string): boolean =>
    commonProblems.some((problem) => problem.name === name && problem.count > 0);

  if (total === 0) {
    return ['Add demo or tracker tasks before evaluating project quality.'];
  }

  if (hasProblem('missing_acceptance_criteria')) {
    recommendations.push('Make acceptance criteria mandatory before development starts.');
  }

  if (hasProblem('vague_wording')) {
    recommendations.push('Use the bad formulations dictionary during refinement and replace vague phrases with observable behavior.');
  }

  if (count('qa_risk') > 0) {
    recommendations.push('Review QA-risk tasks before testing: add expected result, checklist and test evidence.');
  }

  if (count('delivery_risk') > 0) {
    recommendations.push('Discuss delivery-risk tasks on planning: scope, dependencies, blockers and rollback path.');
  }

  if (profiles.some((profile) => profile.healthStatus === 'healthy')) {
    recommendations.push('Reuse healthy tasks as examples in the team task-writing guide.');
  }

  return recommendations.length > 0
    ? recommendations
    : ['Project task health looks stable; keep tracking clarity trend and QA returns on retro.'];
}

export function buildTaskHealthReport(
  records: TaskAnalysisRecord[],
  options: {
    limit?: number;
    includeHealthy?: boolean;
    generatedAt?: string;
    riskThresholds?: ResolvedRiskThresholdConfig;
  } = {}
): TaskHealthReport {
  const generatedAt = options.generatedAt || new Date().toISOString();
  const includeHealthy = options.includeHealthy ?? true;
  const limit = options.limit ?? 20;
  const allProfiles = records
    .map((record) => toTaskHealthProfile(record, options.riskThresholds))
    .sort((a, b) =>
      statusRank(a.healthStatus) - statusRank(b.healthStatus) ||
      b.riskScore - a.riskScore ||
      a.clarityScore - b.clarityScore ||
      a.taskId.localeCompare(b.taskId)
    );
  const profiles = allProfiles
    .filter((profile) => includeHealthy || profile.healthStatus !== 'healthy')
    .slice(0, limit);

  return {
    summary: buildSummary(records, allProfiles, generatedAt),
    profiles
  };
}

export function formatTaskHealthJson(report: TaskHealthReport): string {
  return JSON.stringify(report, null, 2);
}

export function formatTaskHealthCsv(report: TaskHealthReport): string {
  const header = [
    'taskId',
    'title',
    'source',
    'status',
    'assignee',
    'healthStatus',
    'clarityScore',
    'riskLevel',
    'riskScore',
    'dorScore',
    'dodScore',
    'leadTimeDays',
    'cycleTimeDays',
    'missingSections',
    'weakFormulations',
    'deliveryRisks',
    'qaRisks',
    'nextBestAction'
  ];
  const rows = report.profiles.map((profile) => [
    profile.taskId,
    profile.title,
    profile.source,
    profile.status || '',
    profile.assignee || '',
    profile.healthStatus,
    profile.clarityScore,
    profile.riskLevel,
    profile.riskScore,
    profile.dorScore,
    profile.dodScore,
    profile.leadTimeDays,
    profile.cycleTimeDays,
    profile.missingSections.join('|'),
    profile.weakFormulations.join('|'),
    profile.deliveryRisks.join('|'),
    profile.qaRisks.join('|'),
    profile.nextBestAction
  ]);

  return [
    header.map(csvEscape).join(','),
    ...rows.map((row) => row.map(csvEscape).join(','))
  ].join('\n');
}

function formatList(items: string[]): string[] {
  return items.length > 0 ? items.map((item) => `- ${item}`) : ['- Нет.'];
}

export function formatTaskHealthMarkdown(report: TaskHealthReport): string {
  const rows = report.profiles.map((profile) =>
    `| ${tableCell(profile.taskId)} | ${tableCell(profile.title)} | ${profile.healthStatus} | ${profile.clarityScore} | ${profile.riskLevel} | ${profile.dorScore} | ${profile.dodScore} | ${tableCell(profile.nextBestAction)} |`
  );
  const profileCards = report.profiles.flatMap((profile, index) => [
    `### ${index + 1}. ${profile.taskId} - ${tableCell(profile.title)}`,
    '',
    `- Health status: ${profile.healthStatus}`,
    `- Clarity Score: ${profile.clarityScore}/100`,
    `- Risk: ${profile.riskLevel} (${profile.riskScore}/100)`,
    `- DoR / DoD: ${profile.dorScore}/100 / ${profile.dodScore}/100`,
    `- Lead / Cycle time: ${profile.leadTimeDays}d / ${profile.cycleTimeDays}d`,
    `- Next best action: ${profile.nextBestAction}`,
    '',
    '**Missing sections:**',
    '',
    ...formatList(profile.missingSections),
    '',
    '**Weak formulations:**',
    '',
    ...formatList(profile.weakFormulations),
    '',
    '**Delivery risks:**',
    '',
    ...formatList(profile.deliveryRisks),
    '',
    '**QA risks:**',
    '',
    ...formatList(profile.qaRisks),
    '',
    '**Manager recommendations:**',
    '',
    ...formatList(profile.managerRecommendations),
    ''
  ]);

  return [
    '# Task Health Profile',
    '',
    `Generated at: ${report.summary.generatedAt}`,
    '',
    '## Project Quality Summary',
    '',
    `- Total tasks: ${report.summary.totalTasks}`,
    `- Average Clarity Score: ${report.summary.averageClarityScore}/100`,
    `- Good task percent: ${report.summary.goodTaskPercent}%`,
    `- Missing acceptance criteria: ${report.summary.missingAcceptanceCriteriaPercent}%`,
    `- Vague formulations: ${report.summary.vagueFormulationsPercent}%`,
    `- High risk tasks: ${report.summary.highRiskPercent}%`,
    `- Reopened tasks: ${report.summary.reopenedTasks}`,
    `- Stuck tasks: ${report.summary.stuckTasks}`,
    '',
    '## Most Common Problems',
    '',
    ...formatList(report.summary.mostCommonProblems.map((problem) => `${problem.name}: ${problem.count}`)),
    '',
    '## Manager Recommendations',
    '',
    ...formatList(report.summary.recommendations),
    '',
    '## Profile Queue',
    '',
    '| Task | Title | Health | Clarity | Risk | DoR | DoD | Next best action |',
    '| --- | --- | --- | ---: | --- | ---: | ---: | --- |',
    ...(rows.length > 0 ? rows : ['| - | No profiles | - | 0 | - | 0 | 0 | - |']),
    '',
    '## Task Profiles',
    '',
    ...(profileCards.length > 0 ? profileCards : ['Задачи для Task Health Profile не найдены.'])
  ].join('\n');
}

function formatTaskHealthReport(report: TaskHealthReport, format: ReportFormat): string {
  if (format === 'json') {
    return formatTaskHealthJson(report);
  }

  if (format === 'csv') {
    return formatTaskHealthCsv(report);
  }

  return formatTaskHealthMarkdown(report);
}

function parseNumberArg(args: Record<string, string | boolean>, key: string): number | undefined {
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

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const inputPath = getStringArg(args, 'input');
  const outputPath = getStringArg(args, 'output');
  const configPath = getStringArg(args, 'config');

  if (!inputPath) {
    throw makeCliError('Не передан аргумент --input');
  }

  if (!outputPath) {
    throw makeCliError('Не передан аргумент --output');
  }

  const config: ResolvedConfig = loadConfig(configPath);
  const tasks = normalizeUnifiedTasks(readJsonFile<unknown>(inputPath));
  const records = analyzeUnifiedTasks(tasks, { config });
  const report = buildTaskHealthReport(records, {
    limit: parseNumberArg(args, 'limit') ?? 20,
    includeHealthy: args['attention-only'] !== true,
    riskThresholds: config.riskThresholds
  });
  const format = inferReportFormat(outputPath, getStringArg(args, 'format') || config.reports.defaultFormat);

  writeReport(outputPath, formatTaskHealthReport(report, format));
  process.stdout.write(`Task Health Profile сохранён: ${outputPath}\n`);
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
