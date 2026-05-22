import type {
  SmartAnalysisResult,
  SmartCriterionResult
} from './smartTypes';

function formatList(items: string[], fallback: string): string[] {
  if (items.length === 0) {
    return [`- ${fallback}`];
  }

  return items.map((item) => `- ${item}`);
}

function formatCriterion(criterion: SmartCriterionResult): string {
  return [
    `${criterion.title}: ${criterion.score}/100`,
    `Статус: ${criterion.status}`,
    '',
    'Найдено:',
    ...formatList(criterion.foundSignals, 'явных сигналов не найдено'),
    '',
    'Не хватает:',
    ...formatList(criterion.missingSignals, 'критичных пробелов не найдено'),
    '',
    'Рекомендация:',
    ...formatList(criterion.recommendations, 'Дополнительных действий не требуется.')
  ].join('\n');
}

export function formatSmartAnalysisMarkdown(result: SmartAnalysisResult): string {
  const criteriaMarkdown = result.criteria.map(formatCriterion).join('\n\n');

  return [
    '## SMART-анализ задачи',
    '',
    `Общий SMART Score: ${result.totalScore}/100`,
    `Статус SMART: ${result.status}`,
    '',
    criteriaMarkdown,
    '',
    '### Краткая рекомендация для менеджера',
    '',
    result.summary,
    '',
    '### Следующие улучшения',
    '',
    ...formatList(result.recommendations, 'Задача уже выглядит достаточно SMART.')
  ].join('\n');
}
