import {
  STUCK_STATUS_THRESHOLDS_DAYS,
  calculateTimeInStatus,
  isReturnedFromTesting
} from '../retro-analyzer';
import {
  checkDefinitionOfDone
} from '../readiness/dod';
import {
  checkDefinitionOfReady
} from '../readiness/dor';
import {
  analyzeTaskRisk
} from '../risk/analyzer';
import {
  getTaskClarityScore,
  hasAcceptanceCriteria,
  hasExpectedResult,
  hasExternalDependency,
  hasLargeScope
} from '../task-signals';

import type {
  UnifiedTask
} from '../types';

import type {
  SprintHealthReport,
  SprintHealthStatus,
  SprintHealthTaskAnalytics
} from './models';

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function getThreshold(status: string): number {
  const match = Object.entries(STUCK_STATUS_THRESHOLDS_DAYS)
    .find(([name]) => name.toLowerCase() === status.toLowerCase());

  return match ? match[1] : 5;
}

function isTaskStuck(task: UnifiedTask): boolean {
  return calculateTimeInStatus(task).some((duration) =>
    duration.days > getThreshold(duration.status)
  );
}

function determineHealthStatus(params: {
  totalTasks: number;
  readyTasksPercent: number;
  highRiskTasksCount: number;
  averageClarityScore: number;
}): SprintHealthStatus {
  const highRiskPercent = params.totalTasks === 0
    ? 0
    : (params.highRiskTasksCount / params.totalTasks) * 100;

  if (
    params.readyTasksPercent < 50 ||
    highRiskPercent > 30 ||
    params.averageClarityScore < 60
  ) {
    return 'red';
  }

  if (
    params.readyTasksPercent < 80 ||
    highRiskPercent > 10 ||
    params.averageClarityScore < 75
  ) {
    return 'yellow';
  }

  return 'green';
}

function countFactors(tasks: SprintHealthTaskAnalytics[]): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();

  for (const task of tasks) {
    for (const factor of task.risk.riskFactors) {
      counts.set(factor, (counts.get(factor) || 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 7);
}

function buildProblems(report: {
  totalTasks: number;
  readyTasksPercent: number;
  highRiskTasksCount: number;
  tasksWithoutAcceptanceCriteria: number;
  tasksWithoutExpectedResult: number;
  tasksWithExternalDependencies: number;
  largeScopeTasks: number;
  reopenedTasks: number;
  stuckTasks: number;
}): string[] {
  const problems: string[] = [];

  if (report.totalTasks === 0) {
    return ['В отчёте нет задач для анализа.'];
  }

  if (report.readyTasksPercent < 80) {
    problems.push(`${round(100 - report.readyTasksPercent)}% задач не готовы к разработке`);
  }

  if (report.highRiskTasksCount > 0) {
    problems.push(`${report.highRiskTasksCount} задач имеют высокий риск`);
  }

  if (report.tasksWithoutAcceptanceCriteria > 0) {
    problems.push(`${report.tasksWithoutAcceptanceCriteria} задач без критериев приёмки`);
  }

  if (report.tasksWithoutExpectedResult > 0) {
    problems.push(`${report.tasksWithoutExpectedResult} задач без ожидаемого результата`);
  }

  if (report.tasksWithExternalDependencies > 0) {
    problems.push(`${report.tasksWithExternalDependencies} задач с внешними зависимостями`);
  }

  if (report.largeScopeTasks > 0) {
    problems.push(`${report.largeScopeTasks} задач выглядят слишком крупными`);
  }

  if (report.reopenedTasks > 0) {
    problems.push(`${report.reopenedTasks} задач возвращались с тестирования`);
  }

  if (report.stuckTasks > 0) {
    problems.push(`${report.stuckTasks} задач зависали в статусах`);
  }

  return problems.length > 0 ? problems : ['Критичных проблем по спринту не найдено.'];
}

function buildRecommendations(report: {
  highRiskTasksCount: number;
  tasksWithoutAcceptanceCriteria: number;
  tasksWithoutExpectedResult: number;
  tasksWithExternalDependencies: number;
  largeScopeTasks: number;
  readyTasksPercent: number;
}): string[] {
  const recommendations: string[] = [];

  if (report.highRiskTasksCount > 0) {
    recommendations.push('Провести grooming для задач с высоким риском.');
  }

  if (report.tasksWithoutAcceptanceCriteria > 0) {
    recommendations.push('Добавить критерии приёмки до начала разработки.');
  }

  if (report.tasksWithoutExpectedResult > 0) {
    recommendations.push('Уточнить ожидаемый результат для задач, где он не описан.');
  }

  if (report.tasksWithExternalDependencies > 0) {
    recommendations.push('Разобрать внешние зависимости до планирования.');
  }

  if (report.largeScopeTasks > 0) {
    recommendations.push('Декомпозировать крупные задачи до sprint planning.');
  }

  if (report.readyTasksPercent < 80) {
    recommendations.push('Не брать в спринт задачи, которые не проходят Definition of Ready.');
  }

  return recommendations.length > 0
    ? recommendations
    : ['Сохранить текущий уровень подготовки задач и отслеживать health status на каждом планировании.'];
}

function buildManagerSummary(status: SprintHealthStatus, report: {
  readyTasksPercent: number;
  highRiskTasksCount: number;
  tasksWithoutAcceptanceCriteria: number;
  tasksWithExternalDependencies: number;
}): string {
  const statusLabel = status === 'green'
    ? 'зелёной'
    : status === 'yellow'
      ? 'жёлтой'
      : 'красной';

  if (status === 'green') {
    return `Спринт находится в ${statusLabel} зоне: большинство задач готовы к разработке, высокий риск контролируемый.`;
  }

  const focus = report.tasksWithoutAcceptanceCriteria > 0
    ? 'отсутствие критериев приёмки'
    : report.tasksWithExternalDependencies > 0
      ? 'внешние зависимости'
      : 'задачи с высоким риском';

  return `Спринт находится в ${statusLabel} зоне: готовность задач ${report.readyTasksPercent}%, задач с высоким риском ${report.highRiskTasksCount}. Основная проблема - ${focus}.`;
}

/** Собирает Sprint Health Report по набору задач без БД и backend, только по unified task model. */
export function analyzeSprintHealth(tasks: UnifiedTask[], sprintName?: string): SprintHealthReport {
  const taskLevelAnalytics: SprintHealthTaskAnalytics[] = tasks.map((task) => {
    const risk = analyzeTaskRisk(task);
    const dor = checkDefinitionOfReady(task);
    const dod = checkDefinitionOfDone(task);

    return {
      taskId: task.key || task.id,
      title: task.title,
      sprint: task.sprint,
      assignee: task.assignee,
      clarityScore: getTaskClarityScore(task),
      risk,
      dor,
      dod,
      isReopened: isReturnedFromTesting(task),
      isStuck: isTaskStuck(task)
    };
  });
  const totalTasks = taskLevelAnalytics.length;
  const readyTasksCount = taskLevelAnalytics.filter((task) => task.dor.dorPassed).length;
  const highRiskTasksCount = taskLevelAnalytics.filter((task) => task.risk.riskLevel === 'high').length;
  const mediumRiskTasksCount = taskLevelAnalytics.filter((task) => task.risk.riskLevel === 'medium').length;
  const lowRiskTasksCount = taskLevelAnalytics.filter((task) => task.risk.riskLevel === 'low').length;
  const readyTasksPercent = totalTasks === 0 ? 0 : round((readyTasksCount / totalTasks) * 100);
  const summary = {
    totalTasks,
    averageClarityScore: average(taskLevelAnalytics.map((task) => task.clarityScore)),
    averageRiskScore: average(taskLevelAnalytics.map((task) => task.risk.riskScore)),
    readyTasksCount,
    notReadyTasksCount: totalTasks - readyTasksCount,
    readyTasksPercent,
    highRiskTasksCount,
    mediumRiskTasksCount,
    lowRiskTasksCount,
    tasksWithoutAcceptanceCriteria: tasks.filter((task) => !hasAcceptanceCriteria(task)).length,
    tasksWithoutExpectedResult: tasks.filter((task) => !hasExpectedResult(task)).length,
    tasksWithExternalDependencies: tasks.filter(hasExternalDependency).length,
    largeScopeTasks: tasks.filter(hasLargeScope).length,
    reopenedTasks: taskLevelAnalytics.filter((task) => task.isReopened).length,
    stuckTasks: taskLevelAnalytics.filter((task) => task.isStuck).length
  };
  const sprintHealthStatus = determineHealthStatus({
    totalTasks,
    readyTasksPercent,
    highRiskTasksCount,
    averageClarityScore: summary.averageClarityScore
  });
  const problemInput = {
    totalTasks,
    readyTasksPercent,
    highRiskTasksCount,
    tasksWithoutAcceptanceCriteria: summary.tasksWithoutAcceptanceCriteria,
    tasksWithoutExpectedResult: summary.tasksWithoutExpectedResult,
    tasksWithExternalDependencies: summary.tasksWithExternalDependencies,
    largeScopeTasks: summary.largeScopeTasks,
    reopenedTasks: summary.reopenedTasks,
    stuckTasks: summary.stuckTasks
  };

  return {
    sprint: sprintName || tasks.find((task) => task.sprint)?.sprint || 'Не указан',
    sprintHealthStatus,
    summary,
    riskDistribution: {
      high: highRiskTasksCount,
      medium: mediumRiskTasksCount,
      low: lowRiskTasksCount
    },
    readiness: {
      readyTasks: readyTasksCount,
      notReadyTasks: totalTasks - readyTasksCount,
      readyPercent: readyTasksPercent
    },
    highRiskTasks: taskLevelAnalytics.filter((task) => task.risk.riskLevel === 'high'),
    notReadyTasks: taskLevelAnalytics.filter((task) => !task.dor.dorPassed),
    mainRiskFactors: countFactors(taskLevelAnalytics),
    mainProblems: buildProblems(problemInput),
    recommendations: buildRecommendations(problemInput),
    managerSummary: buildManagerSummary(sprintHealthStatus, {
      readyTasksPercent,
      highRiskTasksCount,
      tasksWithoutAcceptanceCriteria: summary.tasksWithoutAcceptanceCriteria,
      tasksWithExternalDependencies: summary.tasksWithExternalDependencies
    }),
    taskLevelAnalytics
  };
}
