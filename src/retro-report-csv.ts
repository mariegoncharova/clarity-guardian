import type {
  RetroReport
} from './retro-analyzer';

function csvEscape(value: unknown): string {
  const text = String(value ?? '');

  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export function formatRetroCsvReport(report: RetroReport): string {
  const header = [
    'task_id',
    'title',
    'source',
    'assignee',
    'clarity_score',
    'lead_time_days',
    'cycle_time_days',
    'is_reopened',
    'is_stuck',
    'main_delay_reason',
    'bottleneck_status',
    'labels'
  ];
  const rows = report.taskLevelAnalytics.map((task) => [
    task.taskId,
    task.title,
    task.source,
    task.assignee || '',
    task.clarityScore,
    task.leadTime.days,
    task.cycleTime.days,
    task.isReopened,
    task.isStuck,
    task.mainDelayReason,
    task.bottleneckStatus || '',
    task.labels.join('|')
  ]);

  return [
    header.map(csvEscape).join(','),
    ...rows.map((row) => row.map(csvEscape).join(','))
  ].join('\n');
}
