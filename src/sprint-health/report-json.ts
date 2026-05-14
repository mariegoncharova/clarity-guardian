import type {
  SprintHealthReport
} from './models';

export function formatSprintHealthJson(report: SprintHealthReport): string {
  return JSON.stringify({
    sprint: report.sprint,
    sprintHealthStatus: report.sprintHealthStatus,
    summary: report.summary,
    riskDistribution: report.riskDistribution,
    readiness: report.readiness,
    highRiskTasks: report.highRiskTasks,
    notReadyTasks: report.notReadyTasks,
    mainProblems: report.mainProblems,
    recommendations: report.recommendations,
    taskLevelAnalytics: report.taskLevelAnalytics
  }, null, 2);
}
