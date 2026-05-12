import type {
  NormalizedTask,
  Remark
} from './types';

import type {
  ClarityScoreResult
} from './clarity-score';

const FALLBACK_RECOMMENDATIONS = {
  ru: 'Сохранить текущий уровень ясности: контекст, ожидаемый результат и критерии проверки уже описаны достаточно понятно.',
  en: 'Keep the current clarity level: context, expected result, and verification criteria are already described clearly enough.'
} as const;

function addUnique(items: string[], value: string): void {
  if (!items.includes(value)) {
    items.push(value);
  }
}

export function generateManagerRecommendations(
  task: NormalizedTask,
  remarks: Remark[],
  clarityScore: ClarityScoreResult
): string[] {
  const recommendations: string[] = [];
  const language = task.language;

  for (const risk of clarityScore.communicationRisks) {
    addUnique(recommendations, risk.recommendation);
  }

  for (const remark of remarks) {
    if (remark.code === 'missing_section' && remark.section) {
      if (/контекст|context/i.test(remark.section)) {
        addUnique(
          recommendations,
          language === 'ru'
            ? 'Добавить бизнес-контекст: зачем команда делает задачу и какую проблему пользователя она решает.'
            : 'Add business context: why the team is doing this task and which user problem it solves.'
        );
      } else if (/критерии|acceptance/i.test(remark.section)) {
        addUnique(
          recommendations,
          language === 'ru'
            ? 'Добавить критерии приёмки в формате чек-листа или Given/When/Then.'
            : 'Add acceptance criteria as a checklist or Given/When/Then scenarios.'
        );
      } else if (/ожидаемый|expected/i.test(remark.section)) {
        addUnique(
          recommendations,
          language === 'ru'
            ? 'Уточнить ожидаемый результат: какое поведение считается правильным после выполнения задачи.'
            : 'Clarify the expected result: which behavior is considered correct after the task is done.'
        );
      }
    }

    if (remark.code === 'broken_without_reproduction') {
      addUnique(
        recommendations,
        language === 'ru'
          ? 'Добавить шаги воспроизведения, фактический результат и ожидаемый результат, чтобы QA и разработчик проверяли один сценарий.'
          : 'Add reproduction steps, actual result, and expected result so QA and engineering verify the same scenario.'
      );
    }

    if (remark.code === 'stop_phrase' || remark.phrase) {
      addUnique(
        recommendations,
        language === 'ru'
          ? 'Заменить размытые формулировки на конкретные требования, ограничения и проверяемые признаки результата.'
          : 'Replace vague wording with concrete requirements, constraints, and verifiable outcome signals.'
      );
    }
  }

  if (
    task.body.length > 2500 ||
    (task.body.match(/^##\s+/gm) || []).length > 8 ||
    (task.body.match(/\n-\s+/g) || []).length > 15
  ) {
    addUnique(
      recommendations,
      language === 'ru'
        ? 'Проверить размер задачи: если в описании смешаны разные изменения, разбить её на несколько меньших задач.'
        : 'Check task size: if the description mixes several changes, split it into smaller tasks.'
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(FALLBACK_RECOMMENDATIONS[language]);
  }

  return recommendations;
}
