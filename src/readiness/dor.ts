import {
  getTaskClarityScore,
  getTaskId,
  getTaskType,
  hasAcceptanceCriteria,
  hasContext,
  hasDependencyInfo,
  hasExpectedResult,
  hasExternalDependency,
  hasLargeScope,
  hasVagueWording
} from '../task-signals';

import type {
  UnifiedTask
} from '../types';

import type {
  ReadinessResult
} from './models';

const EXPLICIT_UNASSIGNED_MARKERS = [
  'assignee пока не назначен',
  'исполнитель пока не назначен',
  'исполнитель не назначен',
  'не назначен исполнитель'
];

function hasAssigneeOrExplicitUnassigned(task: UnifiedTask): boolean {
  const text = `${task.title}\n${task.body}\n${(task.comments || []).join('\n')}`.toLowerCase();

  return Boolean(task.assignee) || EXPLICIT_UNASSIGNED_MARKERS.some((marker) => text.includes(marker));
}

function pushCheck(
  condition: boolean,
  label: string,
  passedChecks: string[],
  failedChecks: string[]
): void {
  if (condition) {
    passedChecks.push(label);
  } else {
    failedChecks.push(label);
  }
}

function buildDorRecommendation(result: {
  dorPassed: boolean;
  failedChecks: string[];
}): string {
  if (result.dorPassed) {
    return 'Задачу можно брать в разработку: ключевые условия Definition of Ready выполнены.';
  }

  if (result.failedChecks.some((check) => /критериев|ожидаемый|Clarity Score/i.test(check))) {
    return 'Задачу лучше не брать в разработку до уточнения ожидаемого результата, критериев приёмки и ключевых требований.';
  }

  return 'Перед стартом разработки стоит закрыть оставшиеся вопросы по готовности задачи.';
}

/** Проверяет Definition of Ready: 10 критериев по 10 баллов и критические провалы. */
export function checkDefinitionOfReady(task: UnifiedTask): ReadinessResult {
  const passedChecks: string[] = [];
  const failedChecks: string[] = [];
  const clarityScore = getTaskClarityScore(task);
  const dependencyClear = !hasExternalDependency(task) || hasDependencyInfo(task);

  pushCheck(hasContext(task), 'Есть контекст', passedChecks, failedChecks);
  pushCheck(hasExpectedResult(task), 'Есть ожидаемый результат', passedChecks, failedChecks);
  pushCheck(hasAcceptanceCriteria(task), 'Есть критерии приёмки', passedChecks, failedChecks);
  pushCheck(!hasVagueWording(task), 'Нет мутных формулировок', passedChecks, failedChecks);
  pushCheck(dependencyClear, 'Понятны зависимости', passedChecks, failedChecks);
  pushCheck(!hasLargeScope(task), 'Задача не слишком крупная', passedChecks, failedChecks);
  pushCheck(clarityScore >= 60, 'Clarity Score не ниже 60', passedChecks, failedChecks);
  pushCheck(hasAssigneeOrExplicitUnassigned(task), 'Есть assignee или явно указано, что он не назначен', passedChecks, failedChecks);
  pushCheck(Boolean(getTaskType(task)), 'Есть тип задачи', passedChecks, failedChecks);
  pushCheck(Boolean(task.priority), 'Указан приоритет', passedChecks, failedChecks);

  const dorScore = passedChecks.length * 10;
  const hasCriticalFailure =
    !hasExpectedResult(task) ||
    !hasAcceptanceCriteria(task) ||
    clarityScore < 50;
  const dorPassed = dorScore >= 80 && !hasCriticalFailure;

  return {
    taskId: getTaskId(task),
    title: task.title,
    dorPassed,
    dorScore,
    passedChecks,
    failedChecks,
    recommendation: buildDorRecommendation({ dorPassed, failedChecks })
  };
}
