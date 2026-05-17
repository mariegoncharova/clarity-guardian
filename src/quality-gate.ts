import {
  inferReportFormat,
  tableCell,
  writeReport
} from './report-utils';
import {
  analyzeSprintHealth
} from './sprint-health/analyzer';
import {
  normalizeUnifiedTasks
} from './task-model';
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
  SprintHealthReport
} from './sprint-health/models';
import type {
  UnifiedTask
} from './types';

export interface QualityGateThresholds {
  minAverageClarityScore: number;
  minReadyTasksPercent: number;
  maxHighRiskTasksPercent: number;
  maxNotReadyTasksCount?: number;
  allowEmpty: boolean;
}

export interface QualityGateCheck {
  code: string;
  label: string;
  passed: boolean;
  actual: number;
  expected: string;
}

export interface QualityGateResult {
  passed: boolean;
  sprint: string;
  thresholds: QualityGateThresholds;
  summary: {
    totalTasks: number;
    averageClarityScore: number;
    readyTasksPercent: number;
    highRiskTasksPercent: number;
    highRiskTasksCount: number;
    notReadyTasksCount: number;
    sprintHealthStatus: string;
  };
  checks: QualityGateCheck[];
  failedChecks: QualityGateCheck[];
  recommendations: string[];
}

const DEFAULT_THRESHOLDS: QualityGateThresholds = {
  minAverageClarityScore: 70,
  minReadyTasksPercent: 80,
  maxHighRiskTasksPercent: 20,
  allowEmpty: false
};

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function percent(count: number, total: number): number {
  if (total === 0) {
    return 0;
  }

  return round((count / total) * 100);
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

function mergeThresholds(
  thresholds: Partial<QualityGateThresholds> = {}
): QualityGateThresholds {
  return {
    minAverageClarityScore: thresholds.minAverageClarityScore ?? DEFAULT_THRESHOLDS.minAverageClarityScore,
    minReadyTasksPercent: thresholds.minReadyTasksPercent ?? DEFAULT_THRESHOLDS.minReadyTasksPercent,
    maxHighRiskTasksPercent: thresholds.maxHighRiskTasksPercent ?? DEFAULT_THRESHOLDS.maxHighRiskTasksPercent,
    maxNotReadyTasksCount: thresholds.maxNotReadyTasksCount,
    allowEmpty: thresholds.allowEmpty ?? DEFAULT_THRESHOLDS.allowEmpty
  };
}

function buildChecks(
  report: SprintHealthReport,
  thresholds: QualityGateThresholds
): QualityGateCheck[] {
  const totalTasks = report.summary.totalTasks;
  const highRiskTasksPercent = percent(report.summary.highRiskTasksCount, totalTasks);
  const checks: QualityGateCheck[] = [
    {
      code: 'has_tasks',
      label: 'Есть задачи для анализа',
      passed: thresholds.allowEmpty || totalTasks > 0,
      actual: totalTasks,
      expected: thresholds.allowEmpty ? '>= 0' : '> 0'
    },
    {
      code: 'average_clarity_score',
      label: 'Средний Clarity Score не ниже порога',
      passed: totalTasks === 0 && thresholds.allowEmpty
        ? true
        : report.summary.averageClarityScore >= thresholds.minAverageClarityScore,
      actual: report.summary.averageClarityScore,
      expected: `>= ${thresholds.minAverageClarityScore}`
    },
    {
      code: 'ready_tasks_percent',
      label: 'Доля задач, прошедших Definition of Ready, не ниже порога',
      passed: totalTasks === 0 && thresholds.allowEmpty
        ? true
        : report.summary.readyTasksPercent >= thresholds.minReadyTasksPercent,
      actual: report.summary.readyTasksPercent,
      expected: `>= ${thresholds.minReadyTasksPercent}%`
    },
    {
      code: 'high_risk_tasks_percent',
      label: 'Доля high-risk задач не выше порога',
      passed: highRiskTasksPercent <= thresholds.maxHighRiskTasksPercent,
      actual: highRiskTasksPercent,
      expected: `<= ${thresholds.maxHighRiskTasksPercent}%`
    }
  ];

  if (thresholds.maxNotReadyTasksCount !== undefined) {
    checks.push({
      code: 'not_ready_tasks_count',
      label: 'Количество not-ready задач не выше порога',
      passed: report.summary.notReadyTasksCount <= thresholds.maxNotReadyTasksCount,
      actual: report.summary.notReadyTasksCount,
      expected: `<= ${thresholds.maxNotReadyTasksCount}`
    });
  }

  return checks;
}

export function evaluateQualityGate(
  tasks: UnifiedTask[],
  options: {
    sprint?: string;
    thresholds?: Partial<QualityGateThresholds>;
  } = {}
): QualityGateResult {
  const thresholds = mergeThresholds(options.thresholds);
  const report = analyzeSprintHealth(tasks, options.sprint);
  const checks = buildChecks(report, thresholds);
  const failedChecks = checks.filter((check) => !check.passed);

  return {
    passed: failedChecks.length === 0,
    sprint: report.sprint,
    thresholds,
    summary: {
      totalTasks: report.summary.totalTasks,
      averageClarityScore: report.summary.averageClarityScore,
      readyTasksPercent: report.summary.readyTasksPercent,
      highRiskTasksPercent: percent(report.summary.highRiskTasksCount, report.summary.totalTasks),
      highRiskTasksCount: report.summary.highRiskTasksCount,
      notReadyTasksCount: report.summary.notReadyTasksCount,
      sprintHealthStatus: report.sprintHealthStatus
    },
    checks,
    failedChecks,
    recommendations: report.recommendations
  };
}

export function formatQualityGateJson(result: QualityGateResult): string {
  return JSON.stringify(result, null, 2);
}

export function formatQualityGateMarkdown(result: QualityGateResult): string {
  const status = result.passed ? 'PASSED' : 'FAILED';
  const checks = result.checks.map((check) =>
    `| ${check.passed ? 'pass' : 'fail'} | ${tableCell(check.label)} | ${check.actual} | ${tableCell(check.expected)} |`
  );

  return [
    '# Quality Gate Report',
    '',
    `Status: **${status}**`,
    `Sprint: ${result.sprint}`,
    '',
    '## Summary',
    '',
    `- Total tasks: ${result.summary.totalTasks}`,
    `- Average Clarity Score: ${result.summary.averageClarityScore}/100`,
    `- Ready tasks: ${result.summary.readyTasksPercent}%`,
    `- High-risk tasks: ${result.summary.highRiskTasksCount} (${result.summary.highRiskTasksPercent}%)`,
    `- Not-ready tasks: ${result.summary.notReadyTasksCount}`,
    `- Sprint Health: ${result.summary.sprintHealthStatus}`,
    '',
    '## Checks',
    '',
    '| Status | Check | Actual | Expected |',
    '| --- | --- | ---: | --- |',
    ...checks,
    '',
    '## Recommendations',
    '',
    ...(result.recommendations.length > 0
      ? result.recommendations.map((item) => `- ${item}`)
      : ['- Quality Gate passed. Keep monitoring task clarity before planning.'])
  ].join('\n');
}

function formatQualityGate(result: QualityGateResult, format: ReportFormat): string {
  if (format === 'json') {
    return formatQualityGateJson(result);
  }

  if (format === 'csv') {
    throw makeCliError('Quality Gate поддерживает только markdown и json');
  }

  return formatQualityGateMarkdown(result);
}

function getThresholdsFromArgs(args: Record<string, string | boolean>): Partial<QualityGateThresholds> {
  return {
    minAverageClarityScore: parseNumberArg(args, 'min-average-clarity'),
    minReadyTasksPercent: parseNumberArg(args, 'min-ready-percent'),
    maxHighRiskTasksPercent: parseNumberArg(args, 'max-high-risk-percent'),
    maxNotReadyTasksCount: parseNumberArg(args, 'max-not-ready'),
    allowEmpty: args['allow-empty'] === true
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const inputPath = getStringArg(args, 'input');
  const outputPath = getStringArg(args, 'output');

  if (!inputPath) {
    throw makeCliError('Не передан аргумент --input');
  }

  const explicitFormat = getStringArg(args, 'format');
  const format = outputPath
    ? inferReportFormat(outputPath, explicitFormat)
    : explicitFormat === undefined || explicitFormat === 'markdown' || explicitFormat === 'json'
      ? explicitFormat || 'markdown'
      : inferReportFormat('quality-gate.md', explicitFormat);
  const tasks = normalizeUnifiedTasks(readJsonFile<unknown>(inputPath));
  const result = evaluateQualityGate(tasks, {
    sprint: getStringArg(args, 'sprint'),
    thresholds: getThresholdsFromArgs(args)
  });
  const content = formatQualityGate(result, format);

  if (outputPath) {
    writeReport(outputPath, content);
  }

  process.stdout.write(
    [
      `Quality Gate ${result.passed ? 'PASSED' : 'FAILED'}: ${result.sprint}`,
      `Average Clarity Score: ${result.summary.averageClarityScore}/100`,
      `Ready tasks: ${result.summary.readyTasksPercent}%`,
      `High-risk tasks: ${result.summary.highRiskTasksPercent}%`
    ].join('\n') + '\n'
  );

  if (!result.passed) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
