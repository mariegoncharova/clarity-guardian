import {
  extractFirstMarkdownSection,
  normalizeText
} from './utils';

import type {
  UnifiedTask,
  WorkItemType
} from './types';

export const VAGUE_PHRASES = [
  'сделать красиво',
  'сделать нормально',
  'как обсуждали',
  'починить',
  'улучшить',
  'оптимизировать',
  'доработать',
  'быстро поправить',
  'примерно',
  'на всякий случай',
  'что-то не работает'
];

export const RISKY_DOMAIN_KEYWORDS = [
  'payment',
  'refund',
  'billing',
  'оплата',
  'платёж',
  'платеж',
  'возврат',
  'деньги',
  'карта',
  'авторизация',
  'регистрация',
  'персональные данные',
  'доступы',
  'безопасность',
  'интеграция',
  'миграция',
  'production',
  'prod',
  'релиз'
];

export const EXTERNAL_DEPENDENCY_KEYWORDS = [
  'blocked',
  'блокер',
  'зависимость',
  'ждём',
  'ждем',
  'ожидаем',
  'нет ответа',
  'external',
  'third-party',
  'api партнёра',
  'api партнера',
  'интеграция с внешней системой'
];

export const LARGE_SCOPE_KEYWORDS = [
  'много сценариев',
  'несколько сценариев',
  'несколько сервисов',
  'весь флоу',
  'полностью переделать',
  'рефакторинг',
  'миграция',
  'затрагивает несколько команд',
  'слишком широкая задача',
  'декомпозировать',
  'end-to-end',
  'e2e'
];

export const TESTING_KEYWORDS = [
  'tested',
  'qa passed',
  'проверено',
  'протестировано',
  'тестирование пройдено',
  'passed qa',
  'qa ok'
];

export const BLOCKER_KEYWORDS = [
  'blocked',
  'блокер',
  'не можем завершить',
  'ждём',
  'ждем',
  'нет ответа',
  'зависимость'
];

export const DONE_STATUSES = [
  'done',
  'closed',
  'released',
  'готово',
  'закрыто'
];

const CONTEXT_HEADINGS = ['Контекст', 'Context'];
const EXPECTED_RESULT_HEADINGS = ['Ожидаемый результат', 'Expected result', 'Expected outcome'];
const ACCEPTANCE_CRITERIA_HEADINGS = ['Критерии приёмки', 'Критерии приемки', 'Acceptance criteria', 'Acceptance Criteria'];

export function getTaskId(task: UnifiedTask): string {
  return task.key || task.id;
}

export function getTaskClarityScore(task: UnifiedTask): number {
  return typeof task.clarityScore === 'number' ? task.clarityScore : 0;
}

export function getTaskText(task: UnifiedTask): string {
  return [
    task.title,
    task.body,
    task.context,
    task.expectedResult,
    ...(task.acceptanceCriteria || []),
    ...(task.dependencies || []),
    ...(task.comments || []),
    ...(task.labels || []),
    ...(task.tags || []),
    ...(task.components || [])
  ].filter(Boolean).join('\n');
}

export function hasAnyKeyword(text: string, keywords: string[]): boolean {
  return findKeywords(text, keywords).length > 0;
}

export function findKeywords(text: string, keywords: string[]): string[] {
  const normalized = normalizeText(text).toLowerCase();

  return keywords.filter((keyword) =>
    keywordMatches(normalized, keyword.toLowerCase())
  );
}

function keywordMatches(normalizedText: string, keyword: string): boolean {
  if (keyword === 'ожидаем' || keyword === 'ждем' || keyword === 'ждём' || keyword === 'prod') {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, 'iu');

    return regex.test(normalizedText);
  }

  return normalizedText.includes(keyword);
}

export function getContext(task: UnifiedTask): string {
  return normalizeText(
    task.context || extractFirstMarkdownSection(task.body, CONTEXT_HEADINGS) || ''
  );
}

export function getExpectedResult(task: UnifiedTask): string {
  return normalizeText(
    task.expectedResult || extractFirstMarkdownSection(task.body, EXPECTED_RESULT_HEADINGS) || ''
  );
}

export function getAcceptanceCriteria(task: UnifiedTask): string[] {
  const explicit = (task.acceptanceCriteria || [])
    .map((item) => normalizeText(item))
    .filter(Boolean);

  if (explicit.length > 0) {
    return explicit;
  }

  const section = extractFirstMarkdownSection(task.body, ACCEPTANCE_CRITERIA_HEADINGS);

  if (!section) {
    return [];
  }

  return section
    .split('\n')
    .map((line) => normalizeText(line.replace(/^[-*]\s+/, '')))
    .filter(Boolean);
}

export function hasContext(task: UnifiedTask): boolean {
  return getContext(task).length >= 20;
}

export function hasExpectedResult(task: UnifiedTask): boolean {
  return getExpectedResult(task).length >= 20;
}

export function hasAcceptanceCriteria(task: UnifiedTask): boolean {
  return getAcceptanceCriteria(task).join('').length >= 20;
}

export function getTaskType(task: UnifiedTask): WorkItemType | undefined {
  return task.workItemType;
}

export function hasTestingSignal(task: UnifiedTask): boolean {
  return hasAnyKeyword(getTaskText(task), TESTING_KEYWORDS);
}

export function hasOpenBlocker(task: UnifiedTask): boolean {
  return hasAnyKeyword(getTaskText(task), BLOCKER_KEYWORDS);
}

export function hasExternalDependency(task: UnifiedTask): boolean {
  return hasAnyKeyword(getTaskText(task), EXTERNAL_DEPENDENCY_KEYWORDS);
}

export function hasDependencyInfo(task: UnifiedTask): boolean {
  return (task.dependencies || []).some((dependency) => normalizeText(dependency).length > 0);
}

export function hasLargeScope(task: UnifiedTask): boolean {
  return hasAnyKeyword(getTaskText(task), LARGE_SCOPE_KEYWORDS);
}

export function hasVagueWording(task: UnifiedTask): boolean {
  return hasAnyKeyword(getTaskText(task), VAGUE_PHRASES);
}

export function isDoneStatus(status: string | undefined): boolean {
  const normalized = normalizeText(status).toLowerCase();

  return DONE_STATUSES.includes(normalized);
}

export function hasReopenedAfterLastTesting(task: UnifiedTask): boolean {
  const history = task.statusHistory || [];
  let lastTestingIndex = -1;

  history.forEach((entry, index) => {
    if (entry.status.toLowerCase() === 'testing') {
      lastTestingIndex = index;
    }
  });

  if (lastTestingIndex === -1) {
    return false;
  }

  return history
    .slice(lastTestingIndex + 1)
    .some((entry) => entry.status.toLowerCase() === 'reopened');
}
