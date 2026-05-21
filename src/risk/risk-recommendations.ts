import type {
  NormalizedRiskTask,
  RiskAnalysisResult,
  RiskCategory,
  RiskDetectedProblem
} from './risk-types';

const CATEGORY_RECOMMENDATIONS: Record<RiskCategory, string> = {
  missing_context: 'Добавьте бизнес-контекст: зачем нужна задача и на кого она влияет.',
  missing_expected_result: 'Добавьте ожидаемый результат в проверяемом формате.',
  missing_acceptance_criteria: 'Добавьте критерии приёмки в формате чек-листа или Given/When/Then.',
  vague_wording: 'Замените расплывчатые формулировки на конкретное поведение системы.',
  untestable_result: 'Добавьте тестовые данные или условия воспроизведения.',
  missing_edge_cases: 'Добавьте edge cases и негативные сценарии для QA.',
  missing_links_or_examples: 'Приложите ссылки, скриншоты, макеты, логи или примеры данных.',
  qa_return_risk: 'Укажите, что именно QA должен проверить до закрытия задачи.',
  delivery_delay_risk: 'Укажите, какие сценарии не входят в задачу, чтобы снизить риск разночтений.',
  communication_overhead: 'Зафиксируйте открытые вопросы, владельцев уточнений и источник договорённостей.'
};

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function formatProblemList(problems: RiskDetectedProblem[]): string {
  if (problems.length === 0) {
    return '';
  }

  return problems
    .slice(0, 2)
    .map((problem) => problem.message.toLowerCase())
    .join(' и ');
}

function formatList(items: string[], fallback: string): string {
  return items.length > 0
    ? items.map((item) => `- ${item}`).join('\n')
    : fallback;
}

export function buildRiskRecommendations(categories: RiskCategory[]): string[] {
  const recommendations = categories.map((category) => CATEGORY_RECOMMENDATIONS[category]);

  return unique(recommendations).slice(0, 8);
}

export function buildManagerSummary(result: Pick<RiskAnalysisResult, 'riskLevel' | 'detectedProblems'>): string {
  if (result.riskLevel === 'high') {
    const focus = formatProblemList(result.detectedProblems);

    return focus
      ? `Задача имеет высокий риск проблем при реализации, потому что ${focus}. Перед передачей в разработку менеджеру стоит уточнить ожидаемое поведение, добавить проверяемые критерии и приложить примеры.`
      : 'Задача имеет высокий риск проблем при реализации. Перед передачей в разработку стоит уточнить требования, критерии проверки и недостающий контекст.';
  }

  if (result.riskLevel === 'medium') {
    return 'Задача в целом понятна, но может потребовать дополнительных уточнений во время разработки или тестирования. Стоит усилить критерии приёмки и добавить недостающие детали.';
  }

  return 'Задача выглядит готовой к разработке. Контекст, ожидаемый результат и критерии приёмки достаточно понятны.';
}

export function buildQaNotes(problems: RiskDetectedProblem[]): string[] {
  const notes: string[] = [];
  const categories = new Set(problems.map((problem) => problem.category));

  if (categories.has('missing_acceptance_criteria')) {
    notes.push('Нельзя полноценно протестировать задачу без критериев приёмки.');
  }

  if (categories.has('missing_expected_result') || categories.has('untestable_result')) {
    notes.push('Нужно понять, какое поведение считается корректным при успешном и ошибочном сценарии.');
  }

  if (categories.has('missing_links_or_examples')) {
    notes.push('Не хватает тестовых данных, ссылок, логов или примеров входных условий.');
  }

  if (categories.has('missing_edge_cases')) {
    notes.push('Нужно уточнить негативные сценарии и edge cases.');
  }

  if (categories.has('missing_context')) {
    notes.push('Нужно уточнить, какие статусы, роли, права или пользовательские сегменты затрагивает задача.');
  }

  if (categories.has('vague_wording')) {
    notes.push('Есть риск разных трактовок: QA стоит запросить конкретное ожидаемое поведение до начала тестирования.');
  }

  return notes.length > 0
    ? notes
    : ['QA может проверять задачу по описанным критериям; дополнительных блокеров по тестированию не найдено.'];
}

export function buildRewrittenTaskSuggestion(task: NormalizedRiskTask): string {
  const context = task.context ||
    '[Добавьте бизнес-контекст: зачем нужна задача и на кого она влияет]';
  const expectedResult = task.expectedResult ||
    '[Опишите проверяемое поведение системы или пользователя]';
  const acceptanceCriteria = task.acceptanceCriteria.length > 0
    ? task.acceptanceCriteria
    : [
      '[Критерий 1]',
      '[Критерий 2]',
      '[Критерий 3]'
    ];
  const edgeCases = task.edgeCases.length > 0
    ? task.edgeCases
    : [
      '[Граничный случай 1]',
      '[Граничный случай 2]'
    ];
  const qaNotes = task.qaNotes.length > 0
    ? task.qaNotes
    : [
      '[Что важно проверить]',
      '[Какие данные нужны для проверки]'
    ];

  return [
    '## Контекст',
    context,
    '',
    '## Ожидаемый результат',
    expectedResult,
    '',
    '## Критерии приёмки',
    formatList(acceptanceCriteria, '- [Критерий 1]'),
    '',
    '## Edge cases',
    formatList(edgeCases, '- [Граничный случай 1]'),
    '',
    '## QA notes',
    formatList(qaNotes, '- [Что важно проверить]')
  ].join('\n');
}
