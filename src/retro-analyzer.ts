import {
  detectDelayReasons,
  hasTestingReturnComment
} from './retro-delay-reasons';

import type {
  StatusHistoryEntry,
  UnifiedTask
} from './types';

export const ACTIVE_STATUSES = [
  'In Progress',
  'Development',
  'Review',
  'Testing',
  'Reopened'
];

export const STUCK_STATUS_THRESHOLDS_DAYS: Record<string, number> = {
  Backlog: 5,
  'In Progress': 3,
  Development: 3,
  Review: 2,
  Testing: 2,
  Reopened: 1
};

export interface Duration {
  hours: number;
  days: number;
}

export interface StatusDuration extends Duration {
  status: string;
}

export interface RetroTaskAnalytics {
  taskId: string;
  title: string;
  source: string;
  assignee?: string;
  clarityScore: number;
  leadTime: Duration;
  cycleTime: Duration;
  timeInStatus: StatusDuration[];
  isReopened: boolean;
  isStuck: boolean;
  stuckReasons: string[];
  delayReasons: string[];
  mainDelayReason: string;
  bottleneckStatus?: string;
  labels: string[];
}

export interface BottleneckAnalytics {
  status: string;
  taskCount: number;
  averageDays: number;
  stuckTaskCount: number;
}

export interface DelayReasonSummary {
  reason: string;
  count: number;
  exampleTasks: string[];
}

export interface ClarityCycleGroup {
  group: 'score_lt_60' | 'score_60_79' | 'score_gte_80';
  taskCount: number;
  averageCycleTimeDays: number | null;
}

export interface RetroReport {
  summary: {
    period: {
      from?: string;
      to?: string;
    };
    totalTasksAnalyzed: number;
    averageClarityScore: number;
    averageLeadTimeDays: number;
    averageCycleTimeDays: number;
    returnedFromTesting: number;
    stuckTasks: number;
    mainBottleneck?: string;
    mainDelayReason?: string;
    dataWarning?: string;
  };
  keyMetrics: Array<{
    name: string;
    value: string;
  }>;
  bottlenecks: BottleneckAnalytics[];
  longestTasks: RetroTaskAnalytics[];
  reopenedTasks: RetroTaskAnalytics[];
  delayReasons: DelayReasonSummary[];
  clarityVsCycleTime: ClarityCycleGroup[];
  recommendations: string[];
  taskLevelAnalytics: RetroTaskAnalytics[];
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

function parseDate(value: string | undefined, fallback?: Date): Date | null {
  if (!value) {
    return fallback || null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return fallback || null;
  }

  return date;
}

function durationBetween(start: Date | null, end: Date | null): Duration {
  if (!start || !end || end.getTime() < start.getTime()) {
    return {
      hours: 0,
      days: 0
    };
  }

  const hours = round((end.getTime() - start.getTime()) / 3_600_000);

  return {
    hours,
    days: round(hours / 24)
  };
}

function getCompletionDate(task: UnifiedTask, now: Date): Date | null {
  return parseDate(task.completedAt || task.updatedAt, now);
}

function isActiveStatus(status: string): boolean {
  return ACTIVE_STATUSES.some((activeStatus) =>
    activeStatus.toLowerCase() === status.toLowerCase()
  );
}

function getThresholdDays(status: string): number {
  const match = Object.entries(STUCK_STATUS_THRESHOLDS_DAYS)
    .find(([name]) => name.toLowerCase() === status.toLowerCase());

  return match ? match[1] : 5;
}

function getTaskClarityScore(task: UnifiedTask): number {
  if (typeof task.clarityScore === 'number') {
    return task.clarityScore;
  }

  return typeof task.metrics?.cycleTimeHours === 'number' ? 70 : 0;
}

/** Рассчитывает lead time: от создания задачи до завершения или последнего обновления. */
export function calculateLeadTime(task: UnifiedTask, now = new Date()): Duration {
  return durationBetween(
    parseDate(task.createdAt, now),
    getCompletionDate(task, now)
  );
}

/** Рассчитывает cycle time: от первого активного статуса до завершения или последнего обновления. */
export function calculateCycleTime(task: UnifiedTask, now = new Date()): Duration {
  const firstActiveStatus = (task.statusHistory || [])
    .find((entry) => isActiveStatus(entry.status));
  const startDate = parseDate(firstActiveStatus?.enteredAt || task.createdAt, now);

  return durationBetween(startDate, getCompletionDate(task, now));
}

/** Рассчитывает время в каждом статусе и группирует повторные попадания в один статус. */
export function calculateTimeInStatus(task: UnifiedTask, now = new Date()): StatusDuration[] {
  const fallbackEnd = parseDate(task.updatedAt || task.completedAt, now) || now;
  const durations = new Map<string, number>();

  for (const entry of task.statusHistory || []) {
    const duration = durationBetween(
      parseDate(entry.enteredAt, now),
      parseDate(entry.leftAt, fallbackEnd)
    );

    durations.set(entry.status, (durations.get(entry.status) || 0) + duration.hours);
  }

  return Array.from(durations.entries())
    .map(([status, hours]) => ({
      status,
      hours: round(hours),
      days: round(hours / 24)
    }))
    .sort((a, b) => b.hours - a.hours);
}

export function isReturnedFromTesting(task: UnifiedTask): boolean {
  const history = task.statusHistory || [];

  if (history.some((entry) => entry.status.toLowerCase() === 'reopened')) {
    return true;
  }

  for (let index = 0; index < history.length - 1; index += 1) {
    const current = history[index].status.toLowerCase();
    const next = history[index + 1].status.toLowerCase();

    if (
      current === 'testing' &&
      (next === 'in progress' || next === 'development')
    ) {
      return true;
    }
  }

  return hasTestingReturnComment(task);
}

function getBottleneckStatus(timeInStatus: StatusDuration[]): string | undefined {
  return timeInStatus[0]?.status;
}

function getStatusStuckReasons(timeInStatus: StatusDuration[]): string[] {
  return timeInStatus
    .filter((duration) => duration.days > getThresholdDays(duration.status))
    .map((duration) =>
      `${duration.status}: ${duration.days} дн. при пороге ${getThresholdDays(duration.status)} дн.`
    );
}

function getLabels(task: UnifiedTask): string[] {
  return [
    ...(task.labels || []),
    ...(task.tags || [])
  ].filter(Boolean);
}

function analyzeTaskLifecycle(
  task: UnifiedTask,
  averageCycleTimeDays: number,
  now: Date
): RetroTaskAnalytics {
  const clarityScore = getTaskClarityScore(task);
  const leadTime = calculateLeadTime(task, now);
  const cycleTime = calculateCycleTime(task, now);
  const timeInStatus = calculateTimeInStatus(task, now);
  const isReopened = isReturnedFromTesting(task);
  const statusStuckReasons = getStatusStuckReasons(timeInStatus);
  const isCycleAboveAverage = averageCycleTimeDays > 0 && cycleTime.days > averageCycleTimeDays;
  const lowClarityWithReturn = clarityScore < 60 && isReopened;
  const stuckReasons = [
    ...statusStuckReasons,
    ...(isCycleAboveAverage ? [`Cycle time выше среднего по проекту: ${cycleTime.days} дн.`] : []),
    ...(lowClarityWithReturn ? ['Низкий Clarity Score и был возврат с тестирования.'] : [])
  ];
  const delayReasons = detectDelayReasons(task, clarityScore, isReopened);

  return {
    taskId: task.key || task.id,
    title: task.title,
    source: task.source,
    assignee: task.assignee,
    clarityScore,
    leadTime,
    cycleTime,
    timeInStatus,
    isReopened,
    isStuck: stuckReasons.length > 0,
    stuckReasons,
    delayReasons,
    mainDelayReason: delayReasons[0] || 'no_obvious_delay_reason',
    bottleneckStatus: getBottleneckStatus(timeInStatus),
    labels: getLabels(task)
  };
}

function buildBottlenecks(tasks: RetroTaskAnalytics[]): BottleneckAnalytics[] {
  const byStatus = new Map<string, {
    totalDays: number;
    taskCount: number;
    stuckTaskCount: number;
  }>();

  for (const task of tasks) {
    for (const duration of task.timeInStatus) {
      const current = byStatus.get(duration.status) || {
        totalDays: 0,
        taskCount: 0,
        stuckTaskCount: 0
      };
      current.totalDays += duration.days;
      current.taskCount += 1;

      if (duration.days > getThresholdDays(duration.status)) {
        current.stuckTaskCount += 1;
      }

      byStatus.set(duration.status, current);
    }
  }

  return Array.from(byStatus.entries())
    .map(([status, value]) => ({
      status,
      taskCount: value.taskCount,
      averageDays: round(value.totalDays / value.taskCount),
      stuckTaskCount: value.stuckTaskCount
    }))
    .sort((a, b) =>
      b.stuckTaskCount - a.stuckTaskCount ||
      b.averageDays - a.averageDays
    );
}

function buildDelayReasons(tasks: RetroTaskAnalytics[]): DelayReasonSummary[] {
  const byReason = new Map<string, string[]>();

  for (const task of tasks) {
    for (const reason of task.delayReasons) {
      byReason.set(reason, [...(byReason.get(reason) || []), task.taskId]);
    }
  }

  return Array.from(byReason.entries())
    .map(([reason, taskIds]) => ({
      reason,
      count: taskIds.length,
      exampleTasks: taskIds.slice(0, 5)
    }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));
}

function buildClarityVsCycleTime(tasks: RetroTaskAnalytics[]): ClarityCycleGroup[] {
  const groups: Array<{
    group: ClarityCycleGroup['group'];
    predicate: (score: number) => boolean;
  }> = [
    { group: 'score_lt_60', predicate: (score) => score < 60 },
    { group: 'score_60_79', predicate: (score) => score >= 60 && score < 80 },
    { group: 'score_gte_80', predicate: (score) => score >= 80 }
  ];

  return groups.map(({ group, predicate }) => {
    const matchingTasks = tasks.filter((task) => predicate(task.clarityScore));

    return {
      group,
      taskCount: matchingTasks.length,
      averageCycleTimeDays: matchingTasks.length > 0
        ? average(matchingTasks.map((task) => task.cycleTime.days))
        : null
    };
  });
}

function buildRecommendations(params: {
  tasks: RetroTaskAnalytics[];
  delayReasons: DelayReasonSummary[];
  bottlenecks: BottleneckAnalytics[];
}): string[] {
  const recommendations: string[] = [];
  const reasonCounts = new Map(params.delayReasons.map((reason) => [reason.reason, reason.count]));
  const lowClarityTasks = params.tasks.filter((task) => task.clarityScore < 60).length;

  if ((reasonCounts.get('missing_requirements') || 0) > 0) {
    recommendations.push('Перед передачей задачи в разработку проверять наличие контекста и ожидаемого результата.');
  }

  if ((reasonCounts.get('missing_acceptance_criteria') || 0) > 0) {
    recommendations.push('Добавлять критерии приёмки до старта разработки.');
  }

  if ((reasonCounts.get('edge_cases') || 0) > 0) {
    recommendations.push('Отдельно описывать edge cases для сложных пользовательских сценариев.');
  }

  if ((reasonCounts.get('testing_return') || 0) > 0) {
    recommendations.push('Разбирать возвращённые с тестирования задачи на ретро и фиксировать причины возвратов.');
  }

  if ((reasonCounts.get('external_dependency') || 0) > 0) {
    recommendations.push('Выделять внешние зависимости до начала спринта.');
  }

  if ((reasonCounts.get('large_task') || 0) > 0) {
    recommendations.push('Декомпозировать крупные задачи до sprint planning.');
  }

  if (lowClarityTasks > 0) {
    recommendations.push('Задачи с Clarity Score ниже 60 отправлять на уточнение до разработки.');
  }

  if (params.bottlenecks[0]) {
    recommendations.push(`На следующем ретро отдельно обсудить статус ${params.bottlenecks[0].status}: там виден главный bottleneck.`);
  }

  if (recommendations.length === 0) {
    recommendations.push('Сохранить текущую практику постановки задач и продолжать отслеживать динамику на ретро.');
  }

  return recommendations;
}

function getPeriod(tasks: UnifiedTask[]): { from?: string; to?: string } {
  const dates = tasks
    .flatMap((task) => [task.createdAt, task.completedAt || task.updatedAt])
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  return {
    from: dates[0]?.toISOString(),
    to: dates[dates.length - 1]?.toISOString()
  };
}

export function analyzeRetroTasks(
  tasks: UnifiedTask[],
  options: {
    now?: Date;
  } = {}
): RetroReport {
  const now = options.now || new Date();
  const preliminaryCycleTimes = tasks.map((task) => calculateCycleTime(task, now).days);
  const averageCycleTimeDays = average(preliminaryCycleTimes);
  const taskLevelAnalytics = tasks.map((task) =>
    analyzeTaskLifecycle(task, averageCycleTimeDays, now)
  );
  const bottlenecks = buildBottlenecks(taskLevelAnalytics);
  const delayReasons = buildDelayReasons(taskLevelAnalytics);
  const clarityVsCycleTime = buildClarityVsCycleTime(taskLevelAnalytics);
  const recommendations = buildRecommendations({
    tasks: taskLevelAnalytics,
    delayReasons,
    bottlenecks
  });
  const averageLeadTimeDays = average(taskLevelAnalytics.map((task) => task.leadTime.days));
  const averageClarityScore = average(taskLevelAnalytics.map((task) => task.clarityScore));
  const longestTasks = [...taskLevelAnalytics]
    .sort((a, b) => b.leadTime.days - a.leadTime.days)
    .slice(0, 5);
  const reopenedTasks = taskLevelAnalytics.filter((task) => task.isReopened);

  return {
    summary: {
      period: getPeriod(tasks),
      totalTasksAnalyzed: taskLevelAnalytics.length,
      averageClarityScore,
      averageLeadTimeDays,
      averageCycleTimeDays,
      returnedFromTesting: reopenedTasks.length,
      stuckTasks: taskLevelAnalytics.filter((task) => task.isStuck).length,
      mainBottleneck: bottlenecks[0]?.status,
      mainDelayReason: delayReasons[0]?.reason,
      dataWarning: taskLevelAnalytics.length < 10
        ? 'Недостаточно данных для уверенного вывода, но можно использовать как гипотезу для обсуждения на ретро.'
        : undefined
    },
    keyMetrics: [
      { name: 'Всего задач проанализировано', value: String(taskLevelAnalytics.length) },
      { name: 'Средний Clarity Score', value: String(averageClarityScore) },
      { name: 'Средний Lead Time', value: `${averageLeadTimeDays} дн.` },
      { name: 'Средний Cycle Time', value: `${averageCycleTimeDays} дн.` },
      { name: 'Возвраты с тестирования', value: String(reopenedTasks.length) },
      { name: 'Зависшие задачи', value: String(taskLevelAnalytics.filter((task) => task.isStuck).length) }
    ],
    bottlenecks,
    longestTasks,
    reopenedTasks,
    delayReasons,
    clarityVsCycleTime,
    recommendations,
    taskLevelAnalytics
  };
}
