import type {
  ClarityCycleGroup,
  RetroReport,
  RetroTaskAnalytics
} from './retro-analyzer';

const GROUP_LABELS: Record<ClarityCycleGroup['group'], string> = {
  score_lt_60: 'score < 60',
  score_60_79: 'score 60-79',
  score_gte_80: 'score >= 80'
};

function formatDays(value: number | null): string {
  return value === null ? 'нет данных' : `${value} дн.`;
}

function formatPeriod(report: RetroReport): string {
  const from = report.summary.period.from?.slice(0, 10) || 'не указано';
  const to = report.summary.period.to?.slice(0, 10) || 'не указано';

  return `${from} - ${to}`;
}

function getMainIssue(task: RetroTaskAnalytics): string {
  if (task.mainDelayReason !== 'no_obvious_delay_reason') {
    return task.mainDelayReason;
  }

  if (task.isStuck && task.bottleneckStatus) {
    return `bottleneck:${task.bottleneckStatus}`;
  }

  return 'нет явной причины';
}

function taskLink(task: RetroTaskAnalytics): string {
  return `${task.taskId} - ${task.title}`;
}

export function formatRetroMarkdownReport(report: RetroReport): string {
  const dataWarning = report.summary.dataWarning
    ? ['', `> ${report.summary.dataWarning}`]
    : [];

  return [
    '# Retro Report: анализ качества задач',
    '',
    '## Кратко',
    '',
    `- Период: ${formatPeriod(report)}`,
    `- Всего задач проанализировано: ${report.summary.totalTasksAnalyzed}`,
    `- Средний Clarity Score: ${report.summary.averageClarityScore}`,
    `- Средний Lead Time: ${report.summary.averageLeadTimeDays} дн.`,
    `- Средний Cycle Time: ${report.summary.averageCycleTimeDays} дн.`,
    `- Возвратов с тестирования: ${report.summary.returnedFromTesting}`,
    `- Зависших задач: ${report.summary.stuckTasks}`,
    ...dataWarning,
    '',
    '## Основные метрики',
    '',
    '| Метрика | Значение |',
    '| --- | --- |',
    ...report.keyMetrics.map((metric) => `| ${metric.name} | ${metric.value} |`),
    '',
    '## Bottlenecks / узкие места',
    '',
    report.bottlenecks.length > 0
      ? report.bottlenecks.map((bottleneck, index) =>
        `${index + 1}. ${bottleneck.status}: среднее время ${bottleneck.averageDays} дн., зависших задач ${bottleneck.stuckTaskCount}.`
      ).join('\n')
      : 'Узкие места не найдены.',
    '',
    '## Самые долгие задачи',
    '',
    '| Задача | Название | Lead Time | Cycle Time | Clarity Score | Основная проблема |',
    '| --- | --- | --- | --- | --- | --- |',
    ...report.longestTasks.map((task) =>
      `| ${task.taskId} | ${task.title} | ${task.leadTime.days} дн. | ${task.cycleTime.days} дн. | ${task.clarityScore} | ${getMainIssue(task)} |`
    ),
    '',
    '## Reopened / возвраты с тестирования',
    '',
    report.reopenedTasks.length > 0
      ? report.reopenedTasks.map((task) => `- ${taskLink(task)} (${task.mainDelayReason})`).join('\n')
      : 'Возвраты с тестирования не найдены.',
    '',
    '## Причины задержек',
    '',
    '| Причина | Количество | Примеры задач |',
    '| --- | --- | --- |',
    ...report.delayReasons.map((reason) =>
      `| ${reason.reason} | ${reason.count} | ${reason.exampleTasks.join(', ')} |`
    ),
    '',
    '## Clarity Score vs Cycle Time',
    '',
    ...report.clarityVsCycleTime.map((group) =>
      `- ${GROUP_LABELS[group.group]}: ${group.taskCount} задач, средний cycle time ${formatDays(group.averageCycleTimeDays)}`
    ),
    '',
    '## Рекомендации для следующего спринта',
    '',
    ...report.recommendations.map((recommendation) => `- ${recommendation}`)
  ].join('\n');
}
