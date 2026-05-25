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
  normalizeText,
  parseArgs,
  readJsonFile
} from './utils';

import type {
  ReportFormat
} from './report-utils';
import type {
  StatusHistoryEntry,
  UnifiedTask
} from './types';

export type DataDoctorStatus = 'healthy' | 'watch' | 'critical';
export type DataDoctorSeverity = 'low' | 'medium' | 'high';

export interface DataDoctorIssue {
  code: string;
  severity: DataDoctorSeverity;
  title: string;
  taskIds: string[];
  message: string;
  recommendation: string;
}

export interface DataDoctorFieldCoverage {
  field: string;
  present: number;
  total: number;
  percent: number;
}

export interface DataDoctorReport {
  generatedAt: string;
  status: DataDoctorStatus;
  dataQualityScore: number;
  rawItemsCount: number;
  normalizedTasksCount: number;
  droppedItemsCount: number;
  summary: {
    highIssues: number;
    mediumIssues: number;
    lowIssues: number;
    duplicateIds: number;
    unstableIds: number;
    invalidDates: number;
    statusHistoryProblems: number;
    missingBodyTasks: number;
    missingAssigneeTasks: number;
    missingWorkItemTypeTasks: number;
    missingPriorityTasks: number;
  };
  fieldCoverage: DataDoctorFieldCoverage[];
  issues: DataDoctorIssue[];
  recommendations: string[];
}

const REQUIRED_FOR_ANALYTICS_FIELDS: Array<keyof UnifiedTask> = [
  'id',
  'title',
  'body',
  'status',
  'assignee',
  'workItemType',
  'priority',
  'createdAt',
  'updatedAt'
];

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, round(value)));
}

function getRawItems(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as { tasks?: unknown[] }).tasks)
  ) {
    return (value as { tasks: unknown[] }).tasks;
  }

  return [];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : null;
}

function getRawStableId(raw: Record<string, unknown>): string {
  return normalizeText(raw.id ?? raw.key);
}

function getTaskId(task: UnifiedTask): string {
  return task.key || task.id;
}

function getRawTitle(raw: Record<string, unknown>): string {
  return normalizeText(raw.title ?? raw.summary);
}

function getRawBody(raw: Record<string, unknown>): string {
  return normalizeText(raw.body ?? raw.description ?? raw.context ?? raw.expectedResult);
}

function addIssue(issues: DataDoctorIssue[], issue: DataDoctorIssue): void {
  const existing = issues.find((item) => item.code === issue.code && item.message === issue.message);

  if (existing) {
    existing.taskIds = Array.from(new Set([...existing.taskIds, ...issue.taskIds]));
    return;
  }

  issues.push({
    ...issue,
    taskIds: Array.from(new Set(issue.taskIds))
  });
}

function percent(part: number, total: number): number {
  if (total === 0) {
    return 0;
  }

  return round((part / total) * 100);
}

function isValidDate(value: string | undefined): boolean {
  if (!value) {
    return true;
  }

  return !Number.isNaN(new Date(value).getTime());
}

function dateMs(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const ms = new Date(value).getTime();

  return Number.isNaN(ms) ? undefined : ms;
}

function getInvalidDateFields(task: UnifiedTask): string[] {
  const invalidFields: string[] = [];
  const dateFields: Array<keyof Pick<UnifiedTask, 'createdAt' | 'updatedAt' | 'completedAt' | 'deadline' | 'dueDate'>> = [
    'createdAt',
    'updatedAt',
    'completedAt',
    'deadline',
    'dueDate'
  ];

  for (const field of dateFields) {
    if (!isValidDate(task[field])) {
      invalidFields.push(field);
    }
  }

  for (const [index, entry] of (task.statusHistory || []).entries()) {
    if (!isValidDate(entry.enteredAt)) {
      invalidFields.push(`statusHistory[${index}].enteredAt`);
    }

    if (!isValidDate(entry.leftAt)) {
      invalidFields.push(`statusHistory[${index}].leftAt`);
    }
  }

  return invalidFields;
}

function getStatusHistoryProblems(history: StatusHistoryEntry[]): string[] {
  const problems: string[] = [];
  let previousEnteredAt: number | undefined;

  for (const [index, entry] of history.entries()) {
    const enteredAt = dateMs(entry.enteredAt);
    const leftAt = dateMs(entry.leftAt);

    if (enteredAt !== undefined && leftAt !== undefined && leftAt < enteredAt) {
      problems.push(`entry ${index} leaves before it enters`);
    }

    if (
      enteredAt !== undefined &&
      previousEnteredAt !== undefined &&
      enteredAt < previousEnteredAt
    ) {
      problems.push(`entry ${index} is out of chronological order`);
    }

    if (enteredAt !== undefined) {
      previousEnteredAt = enteredAt;
    }
  }

  return problems;
}

function hasValue(task: UnifiedTask, field: keyof UnifiedTask): boolean {
  const value = task[field];

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === 'string') {
    return normalizeText(value).length > 0;
  }

  return value !== undefined && value !== null;
}

function buildFieldCoverage(tasks: UnifiedTask[]): DataDoctorFieldCoverage[] {
  return REQUIRED_FOR_ANALYTICS_FIELDS.map((field) => {
    const present = tasks.filter((task) => hasValue(task, field)).length;

    return {
      field,
      present,
      total: tasks.length,
      percent: percent(present, tasks.length)
    };
  });
}

function inspectRawInput(rawItems: unknown[], normalizedTasks: UnifiedTask[], issues: DataDoctorIssue[]): void {
  if (rawItems.length === 0) {
    addIssue(issues, {
      code: 'empty_or_unsupported_input',
      severity: 'high',
      title: 'Input does not contain a task array',
      taskIds: [],
      message: 'The input must be an array of tasks or an object with a tasks array.',
      recommendation: 'Export tracker data as JSON array or wrap it as { "tasks": [...] }.'
    });
    return;
  }

  const nonObjectItems = rawItems
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !asRecord(item));

  if (nonObjectItems.length > 0) {
    addIssue(issues, {
      code: 'non_object_items',
      severity: 'high',
      title: 'Some input rows are not objects',
      taskIds: nonObjectItems.map(({ index }) => `row:${index}`),
      message: `${nonObjectItems.length} rows cannot be normalized because they are not task objects.`,
      recommendation: 'Remove non-object rows or map them to UnifiedTask-compatible objects.'
    });
  }

  const droppedObjects = rawItems
    .map((item, index) => ({ raw: asRecord(item), index }))
    .filter(({ raw }) => raw && !getRawTitle(raw) && !getRawBody(raw));

  if (droppedObjects.length > 0 || normalizedTasks.length < rawItems.filter(asRecord).length) {
    addIssue(issues, {
      code: 'dropped_tasks',
      severity: 'high',
      title: 'Some rows were dropped during normalization',
      taskIds: droppedObjects.map(({ index }) => `row:${index}`),
      message: `${rawItems.length - normalizedTasks.length} raw rows did not become analyzable tasks.`,
      recommendation: 'Ensure each task has at least title/summary or body/description/context fields.'
    });
  }

  const unstableIdRows = rawItems
    .map((item, index) => ({ raw: asRecord(item), index }))
    .filter(({ raw }) => raw && !getRawStableId(raw));

  if (unstableIdRows.length > 0) {
    addIssue(issues, {
      code: 'missing_stable_id',
      severity: 'medium',
      title: 'Tasks are missing stable id or key',
      taskIds: unstableIdRows.map(({ index }) => `row:${index}`),
      message: `${unstableIdRows.length} rows do not have id or key, so history and deduplication can become unstable.`,
      recommendation: 'Include stable tracker id/key in every export row.'
    });
  }
}

function inspectNormalizedTasks(tasks: UnifiedTask[], issues: DataDoctorIssue[]): void {
  const idCounts = new Map<string, number>();

  for (const task of tasks) {
    idCounts.set(task.id, (idCounts.get(task.id) || 0) + 1);
  }

  const duplicateIds = Array.from(idCounts.entries()).filter(([, count]) => count > 1);

  if (duplicateIds.length > 0) {
    addIssue(issues, {
      code: 'duplicate_task_ids',
      severity: 'high',
      title: 'Duplicate task ids found',
      taskIds: duplicateIds.map(([id]) => id),
      message: `${duplicateIds.length} task ids appear more than once.`,
      recommendation: 'Deduplicate input or use source-specific stable keys before analysis.'
    });
  }

  const missingBodyTasks = tasks.filter((task) => !normalizeText(task.body) && !task.context && !task.expectedResult);
  const missingAssigneeTasks = tasks.filter((task) => !task.assignee);
  const missingWorkItemTypeTasks = tasks.filter((task) => !task.workItemType);
  const missingPriorityTasks = tasks.filter((task) => !task.priority);
  const invalidDateTasks = tasks
    .map((task) => ({ task, fields: getInvalidDateFields(task) }))
    .filter(({ fields }) => fields.length > 0);
  const inconsistentDateTasks = tasks.filter((task) => {
    const createdAt = dateMs(task.createdAt);
    const updatedAt = dateMs(task.updatedAt);
    const completedAt = dateMs(task.completedAt);

    return (createdAt !== undefined && updatedAt !== undefined && updatedAt < createdAt) ||
      (createdAt !== undefined && completedAt !== undefined && completedAt < createdAt);
  });
  const statusHistoryProblems = tasks
    .map((task) => ({ task, problems: getStatusHistoryProblems(task.statusHistory || []) }))
    .filter(({ problems }) => problems.length > 0);

  if (missingBodyTasks.length > 0) {
    addIssue(issues, {
      code: 'missing_task_body',
      severity: 'medium',
      title: 'Tasks have no analyzable description',
      taskIds: missingBodyTasks.map(getTaskId),
      message: `${missingBodyTasks.length} tasks have no body, context or expected result.`,
      recommendation: 'Export task description fields or map tracker custom fields to context and expectedResult.'
    });
  }

  if (missingAssigneeTasks.length > 0) {
    addIssue(issues, {
      code: 'missing_assignee',
      severity: 'medium',
      title: 'Assignee coverage is incomplete',
      taskIds: missingAssigneeTasks.map(getTaskId).slice(0, 20),
      message: `${missingAssigneeTasks.length} tasks have no assignee.`,
      recommendation: 'Include assignee in exports to unlock ownership and WIP analytics.'
    });
  }

  if (missingWorkItemTypeTasks.length > 0) {
    addIssue(issues, {
      code: 'missing_work_item_type',
      severity: 'medium',
      title: 'Work item type coverage is incomplete',
      taskIds: missingWorkItemTypeTasks.map(getTaskId).slice(0, 20),
      message: `${missingWorkItemTypeTasks.length} tasks have no detected work item type.`,
      recommendation: 'Map tracker issue type into workItemType or add labels like bug/story/research/task.'
    });
  }

  if (missingPriorityTasks.length > 0) {
    addIssue(issues, {
      code: 'missing_priority',
      severity: 'low',
      title: 'Priority coverage is incomplete',
      taskIds: missingPriorityTasks.map(getTaskId).slice(0, 20),
      message: `${missingPriorityTasks.length} tasks have no priority.`,
      recommendation: 'Include priority if planning, ownership or release reports should reflect urgency.'
    });
  }

  if (invalidDateTasks.length > 0) {
    addIssue(issues, {
      code: 'invalid_dates',
      severity: 'high',
      title: 'Invalid dates found',
      taskIds: invalidDateTasks.map(({ task }) => getTaskId(task)),
      message: `${invalidDateTasks.length} tasks contain invalid date fields.`,
      recommendation: 'Use ISO-8601 timestamps for createdAt, updatedAt, completedAt, dueDate and statusHistory.'
    });
  }

  if (inconsistentDateTasks.length > 0) {
    addIssue(issues, {
      code: 'inconsistent_dates',
      severity: 'medium',
      title: 'Date order looks inconsistent',
      taskIds: inconsistentDateTasks.map(getTaskId),
      message: `${inconsistentDateTasks.length} tasks have updatedAt/completedAt before createdAt.`,
      recommendation: 'Check timezone conversion and tracker export date mappings.'
    });
  }

  if (statusHistoryProblems.length > 0) {
    addIssue(issues, {
      code: 'status_history_order',
      severity: 'medium',
      title: 'Status history has ordering problems',
      taskIds: statusHistoryProblems.map(({ task }) => getTaskId(task)),
      message: `${statusHistoryProblems.length} tasks have status history entries with impossible or out-of-order dates.`,
      recommendation: 'Sort statusHistory chronologically and ensure leftAt is after enteredAt.'
    });
  }
}

function countIssues(issues: DataDoctorIssue[], severity: DataDoctorSeverity): number {
  return issues.filter((issue) => issue.severity === severity).length;
}

function getDataQualityScore(report: Pick<DataDoctorReport, 'rawItemsCount' | 'normalizedTasksCount' | 'droppedItemsCount' | 'issues' | 'fieldCoverage'>): number {
  const coveragePenalty = report.fieldCoverage.reduce((sum, field) => {
    if (field.field === 'createdAt' || field.field === 'updatedAt') {
      return sum + Math.max(0, 70 - field.percent) * 0.03;
    }

    return sum + Math.max(0, 80 - field.percent) * 0.05;
  }, 0);
  const issuePenalty = countIssues(report.issues, 'high') * 14 +
    countIssues(report.issues, 'medium') * 7 +
    countIssues(report.issues, 'low') * 2;
  const droppedPenalty = report.droppedItemsCount * 8;

  return clampScore(100 - issuePenalty - droppedPenalty - coveragePenalty);
}

function getStatus(score: number, issues: DataDoctorIssue[]): DataDoctorStatus {
  if (score < 50 || issues.some((issue) => issue.severity === 'high')) {
    return 'critical';
  }

  if (score < 80 || issues.some((issue) => issue.severity === 'medium')) {
    return 'watch';
  }

  return 'healthy';
}

function buildRecommendations(report: Omit<DataDoctorReport, 'recommendations'>): string[] {
  const codes = new Set(report.issues.map((issue) => issue.code));
  const recommendations: string[] = [];

  if (codes.has('empty_or_unsupported_input') || codes.has('dropped_tasks')) {
    recommendations.push('Fix input shape first: Clarity Guardian needs task objects with title/summary or body/description.');
  }

  if (codes.has('duplicate_task_ids') || codes.has('missing_stable_id')) {
    recommendations.push('Stabilize task identity before using trends, history, ownership or before/after analytics.');
  }

  if (codes.has('invalid_dates') || codes.has('status_history_order') || codes.has('inconsistent_dates')) {
    recommendations.push('Clean date fields before trusting lifecycle, retro and stuck-status analytics.');
  }

  if (codes.has('missing_assignee')) {
    recommendations.push('Add assignee data to improve Ownership Risk and stakeholder asks.');
  }

  if (codes.has('missing_work_item_type')) {
    recommendations.push('Map issue type or labels to workItemType so bug/story/research rules apply correctly.');
  }

  if (codes.has('missing_task_body')) {
    recommendations.push('Export descriptions and custom fields so clarity, SMART, evidence and QA analysis have enough context.');
  }

  return recommendations.length > 0
    ? recommendations
    : ['Dataset looks ready for analysis; keep this check in CI before generating stakeholder reports.'];
}

export function buildDataDoctorReport(
  rawInput: unknown,
  options: {
    generatedAt?: string;
  } = {}
): DataDoctorReport {
  const rawItems = getRawItems(rawInput);
  const normalizedTasks = normalizeUnifiedTasks(rawInput);
  const issues: DataDoctorIssue[] = [];

  inspectRawInput(rawItems, normalizedTasks, issues);
  inspectNormalizedTasks(normalizedTasks, issues);

  const fieldCoverage = buildFieldCoverage(normalizedTasks);
  const partialReport = {
    generatedAt: options.generatedAt || new Date().toISOString(),
    status: 'healthy' as DataDoctorStatus,
    dataQualityScore: 100,
    rawItemsCount: rawItems.length,
    normalizedTasksCount: normalizedTasks.length,
    droppedItemsCount: Math.max(0, rawItems.length - normalizedTasks.length),
    summary: {
      highIssues: countIssues(issues, 'high'),
      mediumIssues: countIssues(issues, 'medium'),
      lowIssues: countIssues(issues, 'low'),
      duplicateIds: issues.find((issue) => issue.code === 'duplicate_task_ids')?.taskIds.length || 0,
      unstableIds: issues.find((issue) => issue.code === 'missing_stable_id')?.taskIds.length || 0,
      invalidDates: issues.find((issue) => issue.code === 'invalid_dates')?.taskIds.length || 0,
      statusHistoryProblems: issues.find((issue) => issue.code === 'status_history_order')?.taskIds.length || 0,
      missingBodyTasks: issues.find((issue) => issue.code === 'missing_task_body')?.taskIds.length || 0,
      missingAssigneeTasks: issues.find((issue) => issue.code === 'missing_assignee')?.taskIds.length || 0,
      missingWorkItemTypeTasks: issues.find((issue) => issue.code === 'missing_work_item_type')?.taskIds.length || 0,
      missingPriorityTasks: issues.find((issue) => issue.code === 'missing_priority')?.taskIds.length || 0
    },
    fieldCoverage,
    issues: issues.sort((a, b) => {
      const weights: Record<DataDoctorSeverity, number> = {
        high: 3,
        medium: 2,
        low: 1
      };

      return weights[b.severity] - weights[a.severity] || a.code.localeCompare(b.code);
    })
  };
  const dataQualityScore = getDataQualityScore(partialReport);
  const report = {
    ...partialReport,
    dataQualityScore,
    status: getStatus(dataQualityScore, issues)
  };

  return {
    ...report,
    recommendations: buildRecommendations(report)
  };
}

export function formatDataDoctorJson(report: DataDoctorReport): string {
  return JSON.stringify(report, null, 2);
}

export function formatDataDoctorCsv(report: DataDoctorReport): string {
  const header = [
    'rowType',
    'codeOrField',
    'severity',
    'title',
    'taskIds',
    'message',
    'recommendation',
    'present',
    'total',
    'percent'
  ];
  const issueRows = report.issues.map((issue) => [
    'issue',
    issue.code,
    issue.severity,
    issue.title,
    issue.taskIds.join('|'),
    issue.message,
    issue.recommendation,
    '',
    '',
    ''
  ]);
  const coverageRows = report.fieldCoverage.map((field) => [
    'field_coverage',
    field.field,
    '',
    '',
    '',
    '',
    '',
    field.present,
    field.total,
    field.percent
  ]);

  return [
    header.map(csvEscape).join(','),
    ...[...issueRows, ...coverageRows].map((row) => row.map(csvEscape).join(','))
  ].join('\n');
}

function formatList(items: string[]): string[] {
  return items.length > 0
    ? items.map((item) => `- ${item}`)
    : ['- Нет.'];
}

export function formatDataDoctorMarkdown(report: DataDoctorReport): string {
  const issueRows = report.issues.map((issue) =>
    `| ${issue.severity} | ${issue.code} | ${tableCell(issue.title)} | ${tableCell(issue.message)} | ${tableCell(issue.taskIds.join(', ') || 'n/a')} | ${tableCell(issue.recommendation)} |`
  );
  const coverageRows = report.fieldCoverage.map((field) =>
    `| ${field.field} | ${field.present}/${field.total} | ${field.percent}% |`
  );

  return [
    '# Data Doctor',
    '',
    `Generated at: ${report.generatedAt}`,
    '',
    '## Dataset Health',
    '',
    `- Status: ${report.status}`,
    `- Data Quality Score: ${report.dataQualityScore}/100`,
    `- Raw items: ${report.rawItemsCount}`,
    `- Normalized tasks: ${report.normalizedTasksCount}`,
    `- Dropped items: ${report.droppedItemsCount}`,
    `- Issues: ${report.summary.highIssues} high, ${report.summary.mediumIssues} medium, ${report.summary.lowIssues} low`,
    '',
    '## Recommendations',
    '',
    ...formatList(report.recommendations),
    '',
    '## Field Coverage',
    '',
    '| Field | Present | Coverage |',
    '| --- | ---: | ---: |',
    ...(coverageRows.length > 0 ? coverageRows : ['| - | 0/0 | 0% |']),
    '',
    '## Issues',
    '',
    '| Severity | Code | Title | Message | Tasks | Recommendation |',
    '| --- | --- | --- | --- | --- | --- |',
    ...(issueRows.length > 0 ? issueRows : ['| low | no_issues | Dataset looks ready | No issues found. | n/a | Keep this check in CI. |'])
  ].join('\n');
}

function formatDataDoctorReport(report: DataDoctorReport, format: ReportFormat): string {
  if (format === 'json') {
    return formatDataDoctorJson(report);
  }

  if (format === 'csv') {
    return formatDataDoctorCsv(report);
  }

  return formatDataDoctorMarkdown(report);
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

  const rawInput = readJsonFile<unknown>(inputPath);
  const report = buildDataDoctorReport(rawInput);
  const format = inferReportFormat(outputPath, getStringArg(args, 'format'));

  writeReport(outputPath, formatDataDoctorReport(report, format));
  process.stdout.write(`Data Doctor сохранён: ${outputPath}\n`);
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
