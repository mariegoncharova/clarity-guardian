import {
  getTaskId,
  hasAcceptanceCriteria,
  hasOpenBlocker,
  hasReopenedAfterLastTesting,
  hasTestingSignal,
  isDoneStatus,
  hasAnyKeyword,
  getTaskText
} from '../task-signals';

import type {
  UnifiedTask
} from '../types';

import type {
  DoneResult
} from './models';

const DOC_KEYWORDS = ['документация', 'docs', 'documentation'];
const DOC_UPDATED_KEYWORDS = ['документация обновлена', 'docs updated', 'documentation updated'];
const RELEASE_KEYWORDS = ['релиз', 'release', 'production', 'prod'];
const RELEASE_DONE_KEYWORDS = ['релиз выполнен', 'released', 'release done'];
const VERIFICATION_RESULT_KEYWORDS = [
  'результат проверки',
  'qa passed',
  'qa ok',
  'проверено',
  'протестировано',
  'тестирование пройдено'
];

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

function buildDodRecommendation(dodPassed: boolean): string {
  return dodPassed
    ? 'Задачу можно считать завершённой.'
    : 'Задачу рано считать завершённой: нужно закрыть критические условия Definition of Done.';
}

/** Проверяет Definition of Done: 8 критериев по 12.5 балла и критические провалы. */
export function checkDefinitionOfDone(task: UnifiedTask): DoneResult {
  const text = getTaskText(task);
  const passedChecks: string[] = [];
  const failedChecks: string[] = [];
  const doneStatus = isDoneStatus(task.status);
  const testingSignal = hasTestingSignal(task);
  const blocker = hasOpenBlocker(task);
  const docsRelevant = hasAnyKeyword(text, DOC_KEYWORDS);
  const releaseRelevant = hasAnyKeyword(text, RELEASE_KEYWORDS);
  const docsUpdated = !docsRelevant || hasAnyKeyword(text, DOC_UPDATED_KEYWORDS);
  const releaseReady = !releaseRelevant || Boolean(task.completedAt) || hasAnyKeyword(text, RELEASE_DONE_KEYWORDS);

  pushCheck(doneStatus, 'Задача в завершённом статусе', passedChecks, failedChecks);
  pushCheck(hasAcceptanceCriteria(task), 'Есть критерии приёмки', passedChecks, failedChecks);
  pushCheck(testingSignal, 'Есть признак тестирования', passedChecks, failedChecks);
  pushCheck(!blocker, 'Нет открытых блокеров', passedChecks, failedChecks);
  pushCheck(!hasReopenedAfterLastTesting(task), 'Нет Reopened после последнего Testing', passedChecks, failedChecks);
  pushCheck(hasAnyKeyword(text, VERIFICATION_RESULT_KEYWORDS), 'Есть комментарий или поле о результате проверки', passedChecks, failedChecks);
  pushCheck(docsUpdated, 'Документация обновлена, если она затронута', passedChecks, failedChecks);
  pushCheck(releaseReady, 'Есть признак релиза или completedAt, если задача про релиз', passedChecks, failedChecks);

  const dodScore = Math.round(passedChecks.length * 12.5 * 10) / 10;
  const hasCriticalFailure = !doneStatus || !testingSignal || blocker;
  const dodPassed = dodScore >= 80 && !hasCriticalFailure;

  return {
    taskId: getTaskId(task),
    title: task.title,
    dodPassed,
    dodScore,
    passedChecks,
    failedChecks,
    recommendation: buildDodRecommendation(dodPassed)
  };
}
