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
  getStringArg,
  makeCliError,
  parseArgs,
  readJsonFile
} from './utils';

import type {
  ReportFormat
} from './report-utils';
import type {
  TaskAnalysisRecord
} from './types';

export interface ActionPlanItem {
  taskId: string;
  title: string;
  source: string;
  assignee?: string;
  status?: string;
  score: number;
  riskLevel: 'low' | 'medium' | 'high';
  priorityScore: number;
  reasons: string[];
  questions: string[];
  nextActions: string[];
  draftMarkdown: string;
  pmFriendlyRewrite: string;
}

export interface ActionPlanReport {
  generatedAt: string;
  totalTasks: number;
  includedTasks: number;
  summary: {
    highPriorityTasks: number;
    mediumPriorityTasks: number;
    lowPriorityTasks: number;
    totalQuestions: number;
    topReasons: Array<{
      name: string;
      count: number;
    }>;
  };
  items: ActionPlanItem[];
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

function getPriorityScore(record: TaskAnalysisRecord): number {
  const errorsCount = record.analysis.remarks.filter((remark) => remark.level === 'error').length;
  const warningsCount = record.analysis.remarks.filter((remark) => remark.level === 'warning').length;
  const riskWeight = record.riskLevel === 'high'
    ? 30
    : record.riskLevel === 'medium'
      ? 12
      : 0;
  const questionWeight = record.analysis.clarityFixSuggestions.questions.length * 4;
  const missingCoreWeight = record.problemCodes.filter((code) =>
    code === 'missing_context' ||
    code === 'missing_expected_result' ||
    code === 'missing_acceptance_criteria'
  ).length * 8;

  return round(
    (100 - record.score) +
    riskWeight +
    errorsCount * 10 +
    warningsCount * 3 +
    questionWeight +
    missingCoreWeight
  );
}

function countReasons(items: ActionPlanItem[]): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();

  for (const item of items) {
    for (const reason of item.reasons) {
      counts.set(reason, (counts.get(reason) || 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 7);
}

function getReasons(record: TaskAnalysisRecord): string[] {
  return record.problemCodes.length > 0
    ? record.problemCodes.map((code) => PROBLEM_LABELS[code] || code)
    : ['Критичных проблем не найдено'];
}

function toActionPlanItem(record: TaskAnalysisRecord): ActionPlanItem {
  return {
    taskId: record.task.key || record.task.id,
    title: record.task.title,
    source: record.task.source,
    assignee: record.task.assignee,
    status: record.task.status,
    score: record.score,
    riskLevel: record.riskLevel,
    priorityScore: getPriorityScore(record),
    reasons: getReasons(record),
    questions: record.analysis.clarityFixSuggestions.questions,
    nextActions: record.analysis.clarityFixSuggestions.nextActions,
    draftMarkdown: record.analysis.clarityFixSuggestions.draftMarkdown,
    pmFriendlyRewrite: record.analysis.clarityFixSuggestions.pmFriendlyRewrite
  };
}

export function buildActionPlanReport(
  records: TaskAnalysisRecord[],
  options: {
    limit?: number;
    minPriorityScore?: number;
    includeLowRisk?: boolean;
    generatedAt?: string;
  } = {}
): ActionPlanReport {
  const limit = options.limit ?? 10;
  const minPriorityScore = options.minPriorityScore ?? 20;
  const items = records
    .map(toActionPlanItem)
    .filter((item) =>
      item.priorityScore >= minPriorityScore &&
      (options.includeLowRisk || item.riskLevel !== 'low' || item.questions.length > 0)
    )
    .sort((a, b) => b.priorityScore - a.priorityScore || a.taskId.localeCompare(b.taskId))
    .slice(0, limit);

  return {
    generatedAt: options.generatedAt || new Date().toISOString(),
    totalTasks: records.length,
    includedTasks: items.length,
    summary: {
      highPriorityTasks: items.filter((item) => item.priorityScore >= 80).length,
      mediumPriorityTasks: items.filter((item) => item.priorityScore >= 50 && item.priorityScore < 80).length,
      lowPriorityTasks: items.filter((item) => item.priorityScore < 50).length,
      totalQuestions: items.reduce((sum, item) => sum + item.questions.length, 0),
      topReasons: countReasons(items)
    },
    items
  };
}

export function formatActionPlanJson(report: ActionPlanReport): string {
  return JSON.stringify(report, null, 2);
}

export function formatActionPlanCsv(report: ActionPlanReport): string {
  const header = [
    'taskId',
    'title',
    'source',
    'assignee',
    'status',
    'score',
    'riskLevel',
    'priorityScore',
    'reasons',
    'questions',
    'nextActions'
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
    item.reasons.join('|'),
    item.questions.join('|'),
    item.nextActions.join('|')
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

export function formatActionPlanMarkdown(report: ActionPlanReport): string {
  const topReasons = report.summary.topReasons.length > 0
    ? report.summary.topReasons.map((reason, index) => `${index + 1}. ${reason.name} - ${reason.count}`)
    : ['Повторяющихся причин не найдено.'];
  const items = report.items.flatMap((item, index) => [
    `### ${index + 1}. ${item.taskId} - ${tableCell(item.title)}`,
    '',
    `- Priority Score: ${item.priorityScore}`,
    `- Clarity Score: ${item.score}/100`,
    `- Risk: ${item.riskLevel}`,
    `- Assignee: ${item.assignee || 'Не назначен'}`,
    `- Status: ${item.status || 'Не указан'}`,
    '',
    '**Why this is in the plan:**',
    '',
    ...formatList(item.reasons),
    '',
    '**Questions to ask:**',
    '',
    ...formatList(item.questions),
    '',
    '**Next actions:**',
    '',
    ...formatList(item.nextActions),
    '',
    '**PM-friendly rewrite:**',
    '',
    item.pmFriendlyRewrite,
    ''
  ]);

  return [
    '# Clarity Action Plan',
    '',
    `Generated at: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    `- Total tasks analyzed: ${report.totalTasks}`,
    `- Tasks in action plan: ${report.includedTasks}`,
    `- High priority tasks: ${report.summary.highPriorityTasks}`,
    `- Medium priority tasks: ${report.summary.mediumPriorityTasks}`,
    `- Low priority tasks: ${report.summary.lowPriorityTasks}`,
    `- Questions to clarify: ${report.summary.totalQuestions}`,
    '',
    '## Top Reasons',
    '',
    ...topReasons,
    '',
    '## Task Plan',
    '',
    ...(items.length > 0 ? items : ['Критичных задач для action plan не найдено.'])
  ].join('\n');
}

function formatActionPlan(report: ActionPlanReport, format: ReportFormat): string {
  if (format === 'json') {
    return formatActionPlanJson(report);
  }

  if (format === 'csv') {
    return formatActionPlanCsv(report);
  }

  return formatActionPlanMarkdown(report);
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
  const minPriorityScore = parseNumberArg(args, 'min-priority-score') ?? 20;
  const format = inferReportFormat(outputPath, getStringArg(args, 'format'));
  const tasks = normalizeUnifiedTasks(readJsonFile<unknown>(inputPath));
  const records = analyzeUnifiedTasks(tasks);
  const report = buildActionPlanReport(records, {
    limit,
    minPriorityScore,
    includeLowRisk: args['include-low-risk'] === true
  });

  writeReport(outputPath, formatActionPlan(report, format));
  process.stdout.write(`Action Plan сохранён: ${outputPath}\n`);
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
