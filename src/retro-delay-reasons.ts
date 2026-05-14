import type {
  UnifiedTask
} from './types';

export const RETURN_KEYWORDS = [
  'вернули с тестирования',
  'возврат с тестирования',
  'reopened',
  'не прошло тестирование',
  'баг на тесте',
  'нужно доработать',
  'qa failed'
];

export const DELAY_REASON_KEYWORDS: Record<string, string[]> = {
  missing_requirements: [
    'не хватает требований',
    'непонятно',
    'нет описания',
    'не описано',
    'как должно работать',
    'нет требований'
  ],
  missing_acceptance_criteria: [
    'нет критериев',
    'критерии приёмки',
    'acceptance criteria',
    'не описаны критерии'
  ],
  edge_cases: [
    'edge case',
    'пограничный случай',
    'не учли сценарий',
    'неописанный сценарий',
    'неописанного edge case',
    'краевой случай'
  ],
  external_dependency: [
    'ждём',
    'ждем',
    'зависимость',
    'blocked',
    'блокер',
    'нет ответа',
    'ожидаем ответ'
  ],
  testing_return: RETURN_KEYWORDS,
  scope_change: [
    'изменились требования',
    'переобсудили',
    'добавили ещё',
    'расширили задачу',
    'scope changed',
    'изменился скоуп'
  ],
  large_task: [
    'слишком большая задача',
    'надо декомпозировать',
    'много сценариев',
    'слишком широкий скоуп'
  ]
};

function buildSearchText(task: UnifiedTask): string {
  return [
    ...(task.comments || []),
    ...(task.labels || []),
    ...(task.tags || [])
  ].join('\n').toLowerCase();
}

export function detectDelayReasons(
  task: UnifiedTask,
  clarityScore: number,
  isReopened: boolean
): string[] {
  const text = buildSearchText(task);
  const reasons: string[] = [];

  for (const [reason, keywords] of Object.entries(DELAY_REASON_KEYWORDS)) {
    if (keywords.some((keyword) => text.includes(keyword.toLowerCase()))) {
      reasons.push(reason);
    }
  }

  if (isReopened && !reasons.includes('testing_return')) {
    reasons.push('testing_return');
  }

  if (clarityScore < 60 && reasons.length === 0) {
    reasons.push('low_clarity_score');
  }

  return reasons;
}

export function hasTestingReturnComment(task: UnifiedTask): boolean {
  const text = (task.comments || []).join('\n').toLowerCase();

  return RETURN_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()));
}
