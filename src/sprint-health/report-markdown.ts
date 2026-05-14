import {
  tableCell
} from '../report-utils';

import type {
  SprintHealthReport
} from './models';

export function formatSprintHealthMarkdown(report: SprintHealthReport): string {
  return [
    '# Sprint Health Report',
    '',
    '## Summary',
    '',
    `- Sprint: ${report.sprint}`,
    `- Total tasks: ${report.summary.totalTasks}`,
    `- Sprint Health: ${report.sprintHealthStatus}`,
    `- Average Clarity Score: ${report.summary.averageClarityScore}`,
    `- Average Risk Score: ${report.summary.averageRiskScore}`,
    `- Ready Tasks: ${report.summary.readyTasksCount}`,
    `- Not Ready Tasks: ${report.summary.notReadyTasksCount}`,
    `- High Risk Tasks: ${report.summary.highRiskTasksCount}`,
    '',
    '## Readiness',
    '',
    '| Metric | Value |',
    '|---|---:|',
    `| Ready tasks | ${report.readiness.readyTasks} |`,
    `| Not ready tasks | ${report.readiness.notReadyTasks} |`,
    `| Ready percent | ${report.readiness.readyPercent}% |`,
    '',
    '## Risk Analysis',
    '',
    '| Risk Level | Count |',
    '|---|---:|',
    `| High | ${report.riskDistribution.high} |`,
    `| Medium | ${report.riskDistribution.medium} |`,
    `| Low | ${report.riskDistribution.low} |`,
    '',
    '## Main Problems',
    '',
    ...report.mainProblems.map((problem) => `- ${problem}`),
    '',
    '## High Risk Tasks',
    '',
    '| Task | Title | Risk Score | Main Risk Factors |',
    '| --- | --- | ---: | --- |',
    ...report.highRiskTasks.map((task) =>
      `| ${tableCell(task.taskId)} | ${tableCell(task.title)} | ${task.risk.riskScore} | ${tableCell(task.risk.riskFactors.slice(0, 3).join('; '))} |`
    ),
    '',
    '## Not Ready Tasks',
    '',
    '| Task | Title | DoR Score | Failed Checks |',
    '| --- | --- | ---: | --- |',
    ...report.notReadyTasks.map((task) =>
      `| ${tableCell(task.taskId)} | ${tableCell(task.title)} | ${task.dor.dorScore} | ${tableCell(task.dor.failedChecks.join('; '))} |`
    ),
    '',
    '## Recommendations',
    '',
    ...report.recommendations.map((recommendation) => `- ${recommendation}`),
    '',
    '## Manager Summary',
    '',
    report.managerSummary
  ].join('\n');
}
