import type {
  RetroReport
} from './retro-analyzer';

export function formatRetroJsonReport(report: RetroReport): string {
  return JSON.stringify({
    summary: report.summary,
    key_metrics: report.keyMetrics,
    bottlenecks: report.bottlenecks,
    longest_tasks: report.longestTasks,
    reopened_tasks: report.reopenedTasks,
    delay_reasons: report.delayReasons,
    clarity_vs_cycle_time: report.clarityVsCycleTime,
    recommendations: report.recommendations,
    task_level_analytics: report.taskLevelAnalytics
  }, null, 2);
}
