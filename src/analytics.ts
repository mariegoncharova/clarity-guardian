import fs from 'node:fs';
import path from 'node:path';

import { analyzeTask } from './analyze';
import { unifiedTaskToTaskPayload } from './task-model';
import { writeJsonFile } from './utils';

import type {
  ClarityDashboard,
  ClarityScoreHistoryEntry,
  DashboardTaskSummary,
  DistributionItem,
  PeriodComparison,
  ResearchReportData,
  ResolvedConfig,
  TaskAnalysisRecord,
  TaskPeriod,
  UnifiedTask
} from './types';

const PROBLEM_LABELS: Record<string, string> = {
  missing_context: 'Нет контекста',
  missing_expected_result: 'Нет ожидаемого результата',
  missing_acceptance_criteria: 'Нет критериев приёмки',
  vague_wording: 'Мутные формулировки',
  missing_business_goal: 'Нет бизнес-цели',
  task_too_large: 'Задача слишком большая',
  unclear_testing: 'Неясно, как тестировать',
  missing_user_scenario: 'Нет пользовательского сценария',
  hidden_agreement: 'Скрытые договорённости',
  blaming_tone: 'Обвинительный тон',
  passive_aggressive: 'Пассивно-агрессивный тон',
  unclear_urgency: 'Срочность без причины',
  too_informal: 'Слишком неформальный стиль'
};

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function nullableAverage(values: Array<number | undefined>): number | null {
  const existing = values.filter((value): value is number => typeof value === 'number');

  if (existing.length === 0) {
    return null;
  }

  return average(existing);
}

function addProblem(problems: Set<string>, problem: string): void {
  problems.add(problem);
}

function getProblemCodes(record: TaskAnalysisRecord): string[] {
  const problems = new Set<string>();

  for (const remark of record.analysis.remarks) {
    const section = (remark.section || '').toLowerCase();

    if (/контекст|context/.test(section)) {
      addProblem(problems, 'missing_context');
    }

    if (/ожидаемый|expected/.test(section)) {
      addProblem(problems, 'missing_expected_result');
    }

    if (/критерии|acceptance/.test(section)) {
      addProblem(problems, 'missing_acceptance_criteria');
    }

    if (remark.phrase || /stop_phrase|vague|undefined|deferred|hidden/.test(remark.code)) {
      addProblem(problems, 'vague_wording');
    }

    if (/broken_without_reproduction|missing_environment/.test(remark.code)) {
      addProblem(problems, 'unclear_testing');
    }
  }

  for (const risk of record.analysis.clarityScore.communicationRisks) {
    if (risk.type === 'implicit_context') {
      addProblem(problems, 'missing_context');
    }

    if (risk.type === 'ambiguous_result') {
      addProblem(problems, 'missing_expected_result');
    }

    if (risk.type === 'unverifiable_acceptance') {
      addProblem(problems, 'missing_acceptance_criteria');
    }

    if (risk.type === 'hidden_agreement') {
      addProblem(problems, 'hidden_agreement');
      addProblem(problems, 'vague_wording');
    }

    if (risk.type === 'missing_user_scenario') {
      addProblem(problems, 'missing_user_scenario');
      addProblem(problems, 'missing_business_goal');
    }

    if (risk.type === 'qa_uncertainty') {
      addProblem(problems, 'unclear_testing');
    }

    if (risk.type === 'implementation_without_goal') {
      addProblem(problems, 'missing_business_goal');
    }
  }

  for (const category of record.analysis.toneOfVoice.categories) {
    if (category !== 'constructive') {
      addProblem(problems, category);
    }
  }

  if (
    record.task.body.length > 2500 ||
    (record.task.body.match(/^##\s+/gm) || []).length > 8 ||
    (record.task.body.match(/\n-\s+/g) || []).length > 15
  ) {
    addProblem(problems, 'task_too_large');
  }

  return Array.from(problems);
}

function countBy(values: string[]): DistributionItem[] {
  const counts = new Map<string, number>();

  for (const value of values) {
    const key = value || 'Не указано';
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function toTaskSummary(record: TaskAnalysisRecord): DashboardTaskSummary {
  return {
    id: record.task.id,
    key: record.task.key,
    title: record.task.title,
    source: record.task.source,
    status: record.task.status,
    assignee: record.task.assignee,
    author: record.task.author,
    score: record.score,
    riskLevel: record.riskLevel,
    problemCodes: record.problemCodes,
    recommendations: record.recommendations
  };
}

function getDay(value: string): string {
  return value.slice(0, 10);
}

function getWeek(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return getDay(value);
  }

  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);

  return getDay(date.toISOString());
}

function buildScoreTrend(
  records: TaskAnalysisRecord[],
  getBucket: (value: string) => string
): DistributionItem[] {
  const groups = new Map<string, number[]>();

  for (const record of records) {
    const bucket = getBucket(record.analyzedAt);
    groups.set(bucket, [...(groups.get(bucket) || []), record.score]);
  }

  return Array.from(groups.entries())
    .map(([name, values]) => ({ name, count: average(values) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function summarizePeriod(records: TaskAnalysisRecord[], period: TaskPeriod): PeriodComparison[TaskPeriod] {
  const periodRecords = records.filter((record) => record.task.period === period);

  return {
    totalTasks: periodRecords.length,
    averageScore: average(periodRecords.map((record) => record.score)),
    lowQualityTasks: periodRecords.filter((record) => record.score < 50).length,
    missingAcceptanceCriteria: periodRecords.filter((record) =>
      record.problemCodes.includes('missing_acceptance_criteria')
    ).length,
    missingContext: periodRecords.filter((record) =>
      record.problemCodes.includes('missing_context')
    ).length,
    qaReturns: periodRecords.reduce((sum, record) => sum + (record.task.metrics?.qaReturns || 0), 0)
  };
}

function percentDelta(before: number, after: number): number {
  if (before === 0) {
    return after === 0 ? 0 : 100;
  }

  return round(((after - before) / before) * 100);
}

export function analyzeUnifiedTasks(
  tasks: UnifiedTask[],
  options: {
    analyzedAt?: string;
    config?: ResolvedConfig;
  } = {}
): TaskAnalysisRecord[] {
  const analyzedAt = options.analyzedAt || new Date().toISOString();

  return tasks.map((task) => {
    const analysis = analyzeTask(
      unifiedTaskToTaskPayload(task, options.config),
      options.config ? { config: options.config } : {}
    );
    const record: TaskAnalysisRecord = {
      task,
      analyzedAt,
      score: analysis.clarityScore.score,
      riskLevel: analysis.clarityScore.riskLevel,
      problemCodes: [],
      recommendations: analysis.managerRecommendations,
      analysis
    };

    record.problemCodes = getProblemCodes(record);

    return record;
  });
}

export function buildDashboard(records: TaskAnalysisRecord[]): ClarityDashboard {
  const scores = records.map((record) => record.score);
  const topProblems = countBy(records.flatMap((record) => record.problemCodes))
    .map((item) => ({
      name: PROBLEM_LABELS[item.name] || item.name,
      count: item.count
    }));

  return {
    generatedAt: new Date().toISOString(),
    totalTasks: records.length,
    averageScore: average(scores),
    quality: {
      good: records.filter((record) => record.score >= 80).length,
      medium: records.filter((record) => record.score >= 50 && record.score < 80).length,
      poor: records.filter((record) => record.score < 50).length
    },
    topProblems,
    statusDistribution: countBy(records.map((record) => record.task.status || 'Не указано')),
    authorDistribution: countBy(records.map((record) => record.task.author || 'Не указан')),
    assigneeDistribution: countBy(records.map((record) => record.task.assignee || 'Не назначен')),
    lowestScoreTasks: [...records]
      .sort((a, b) => a.score - b.score)
      .slice(0, 5)
      .map(toTaskSummary),
    trendByDay: buildScoreTrend(records, getDay),
    trendByWeek: buildScoreTrend(records, getWeek)
  };
}

export function toHistoryEntries(records: TaskAnalysisRecord[]): ClarityScoreHistoryEntry[] {
  return records.map((record) => ({
    taskId: record.task.id,
    taskKey: record.task.key,
    source: record.task.source,
    projectKey: record.task.projectKey,
    analyzedAt: record.analyzedAt,
    score: record.score,
    riskLevel: record.riskLevel,
    problemCodes: record.problemCodes,
    recommendations: record.recommendations
  }));
}

export function buildTaskScoreHistory(records: TaskAnalysisRecord[]): Record<string, {
  key?: string;
  title: string;
  points: Array<{
    analyzedAt: string;
    score: number;
    riskLevel: 'low' | 'medium' | 'high';
    problemCodes: string[];
  }>;
}> {
  const history: Record<string, {
    key?: string;
    title: string;
    points: Array<{
      analyzedAt: string;
      score: number;
      riskLevel: 'low' | 'medium' | 'high';
      problemCodes: string[];
    }>;
  }> = {};

  for (const record of records) {
    history[record.task.id] ||= {
      key: record.task.key,
      title: record.task.title,
      points: []
    };
    history[record.task.id].points.push({
      analyzedAt: record.analyzedAt,
      score: record.score,
      riskLevel: record.riskLevel,
      problemCodes: record.problemCodes
    });
  }

  return history;
}

export function writeHistoryJsonl(filePath: string, records: TaskAnalysisRecord[]): void {
  const absolutePath = path.resolve(process.cwd(), filePath);
  const entries = toHistoryEntries(records)
    .map((entry) => JSON.stringify(entry))
    .join('\n');

  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, entries ? `${entries}\n` : '', 'utf8');
}

export function writeDashboardJson(filePath: string, dashboard: ClarityDashboard): void {
  writeJsonFile(filePath, dashboard);
}

export function compareBeforeAfter(records: TaskAnalysisRecord[]): PeriodComparison {
  const before = summarizePeriod(records, 'before');
  const after = summarizePeriod(records, 'after');

  return {
    before,
    after,
    delta: {
      averageScore: round(after.averageScore - before.averageScore),
      averageScorePercent: percentDelta(before.averageScore, after.averageScore),
      lowQualityTasks: after.lowQualityTasks - before.lowQualityTasks,
      missingAcceptanceCriteria: after.missingAcceptanceCriteria - before.missingAcceptanceCriteria,
      missingContext: after.missingContext - before.missingContext,
      qaReturns: after.qaReturns - before.qaReturns
    }
  };
}

export function buildResearchData(records: TaskAnalysisRecord[]): ResearchReportData {
  const highClarity = records.filter((record) => record.score >= 80);
  const lowClarity = records.filter((record) => record.score < 50);

  return {
    totalTasks: records.length,
    highClarityAverageCycleHours: nullableAverage(highClarity.map((record) => record.task.metrics?.cycleTimeHours)),
    lowClarityAverageCycleHours: nullableAverage(lowClarity.map((record) => record.task.metrics?.cycleTimeHours)),
    highClarityAverageQaReturns: nullableAverage(highClarity.map((record) => record.task.metrics?.qaReturns)),
    lowClarityAverageQaReturns: nullableAverage(lowClarity.map((record) => record.task.metrics?.qaReturns)),
    highClarityAverageComments: nullableAverage(highClarity.map((record) => record.task.metrics?.commentsCount)),
    lowClarityAverageComments: nullableAverage(lowClarity.map((record) => record.task.metrics?.commentsCount)),
    highClarityAverageDescriptionChanges: nullableAverage(highClarity.map((record) => record.task.metrics?.descriptionChanges)),
    lowClarityAverageDescriptionChanges: nullableAverage(lowClarity.map((record) => record.task.metrics?.descriptionChanges)),
    notes: [
      'Это исследовательская аналитика для ретро, а не доказательство причинно-следственной связи.',
      'Низкий Clarity Score может указывать на корреляцию между ясностью задачи, длительностью разработки и количеством возвратов с тестирования.',
      'Выводы стоит проверять на большем объёме данных и с учётом сложности задач.'
    ]
  };
}

export { PROBLEM_LABELS };
