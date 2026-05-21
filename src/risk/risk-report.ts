import type {
  UnifiedTask
} from '../types';

import {
  analyzeRisk
} from './risk-analyzer';

import type {
  RiskAnalysis,
  RiskAnalysisResult,
  RiskInputTask
} from './risk-types';

function formatList(items: string[], fallback: string): string[] {
  return items.length > 0
    ? items.map((item) => `- ${item}`)
    : [`- ${fallback}`];
}

type RiskReportInput = RiskInputTask | UnifiedTask | RiskAnalysis | RiskAnalysisResult;

function getTaskId(task: RiskReportInput): string {
  if ('taskId' in task) {
    return task.taskId;
  }

  return 'id' in task ? task.id || 'Не указан' : 'Не указан';
}

function getTaskTitle(task: RiskReportInput): string {
  if ('title' in task && task.title) {
    return task.title;
  }

  return 'Без названия';
}

export function formatRiskReportSections(result: RiskAnalysisResult & {
  taskId?: string;
  title?: string;
}): string {
  return [
    '## Task',
    '',
    `- ID: ${result.taskId || 'Не указан'}`,
    `- Title: ${result.title || 'Без названия'}`,
    '',
    '## Risk Summary',
    '',
    `- Risk level: ${result.riskLevel}`,
    `- Risk score: ${result.riskScore}/100`,
    `- Categories: ${result.categories.join(', ') || 'none'}`,
    '',
    '## Detected Problems',
    '',
    ...formatList(
      result.detectedProblems.map((problem) =>
        `${problem.message} (+${problem.riskPoints}, ${problem.category})`
      ),
      'Проблем не найдено.'
    ),
    '',
    '## Recommendations',
    '',
    ...formatList(result.recommendations, 'Дополнительные рекомендации не требуются.'),
    '',
    '## Manager Summary',
    '',
    result.managerSummary,
    '',
    '## QA Notes',
    '',
    ...formatList(result.qaNotes, 'Дополнительных QA notes нет.'),
    '',
    '## Rewritten Task Suggestion',
    '',
    result.rewrittenTaskSuggestion
  ].join('\n');
}

export function generateRiskReport(
  taskOrResult: RiskReportInput,
  result?: RiskAnalysisResult
): string {
  const analysis = result
    ? {
      ...result,
      taskId: getTaskId(taskOrResult),
      title: getTaskTitle(taskOrResult)
    }
    : 'riskScore' in taskOrResult && 'detectedProblems' in taskOrResult
      ? taskOrResult
      : analyzeRisk(taskOrResult);

  return [
    '# Risk Radar Report',
    '',
    formatRiskReportSections(analysis)
  ].join('\n');
}
