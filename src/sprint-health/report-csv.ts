import {
  csvEscape
} from '../report-utils';

import type {
  SprintHealthReport
} from './models';

export function formatSprintHealthCsv(report: SprintHealthReport): string {
  const header = [
    'taskId',
    'title',
    'sprint',
    'assignee',
    'clarityScore',
    'riskLevel',
    'riskScore',
    'riskFactors',
    'dorPassed',
    'dorScore',
    'dorFailedChecks',
    'dodPassed',
    'dodScore',
    'dodFailedChecks',
    'sprintHealthStatus'
  ];
  const rows = report.taskLevelAnalytics.map((task) => [
    task.taskId,
    task.title,
    task.sprint || report.sprint,
    task.assignee || '',
    task.clarityScore,
    task.risk.riskLevel,
    task.risk.riskScore,
    task.risk.riskFactors.join('|'),
    task.dor.dorPassed,
    task.dor.dorScore,
    task.dor.failedChecks.join('|'),
    task.dod.dodPassed,
    task.dod.dodScore,
    task.dod.failedChecks.join('|'),
    report.sprintHealthStatus
  ]);

  return [
    header.map(csvEscape).join(','),
    ...rows.map((row) => row.map(csvEscape).join(','))
  ].join('\n');
}
