import type {
  ClarityDashboard,
  PeriodComparison,
  ResearchReportData,
  TaskAnalysisRecord
} from './types';

function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : '';

  return `${sign}${value}%`;
}

function formatDelta(value: number): string {
  const sign = value > 0 ? '+' : '';

  return `${sign}${value}`;
}

function csvEscape(value: unknown): string {
  const text = String(value ?? '');

  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function htmlEscape(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function topItems(items: Array<{ name: string; count: number }>, limit = 5): string[] {
  return items.slice(0, limit).map((item, index) =>
    `${index + 1}. ${item.name} - ${item.count}`
  );
}

export function formatDashboardMarkdown(dashboard: ClarityDashboard): string {
  return [
    '# Clarity Guardian Dashboard',
    '',
    `Сгенерировано: ${dashboard.generatedAt}`,
    '',
    '## Обзор',
    '',
    `- Всего задач: ${dashboard.totalTasks}`,
    `- Средний Clarity Score: ${dashboard.averageScore}/100`,
    `- Задач с высоким качеством: ${dashboard.quality.good}`,
    `- Задач со средним качеством: ${dashboard.quality.medium}`,
    `- Задач с низким качеством: ${dashboard.quality.poor}`,
    '',
    '## Основные проблемы',
    '',
    ...(topItems(dashboard.topProblems).length > 0 ? topItems(dashboard.topProblems) : ['Повторяющихся проблем не найдено.']),
    '',
    '## Задачи с самым низким score',
    '',
    ...dashboard.lowestScoreTasks.map((task, index) =>
      `${index + 1}. ${task.key || task.id} - ${task.score}/100 - ${task.title}`
    )
  ].join('\n');
}

export function formatRetroReportMarkdown(
  dashboard: ClarityDashboard,
  comparison: PeriodComparison
): string {
  const improvementText = comparison.delta.averageScore >= 0
    ? `Средний score вырос на ${formatDelta(comparison.delta.averageScore)} пунктов (${formatPercent(comparison.delta.averageScorePercent)}).`
    : `Средний score снизился на ${Math.abs(comparison.delta.averageScore)} пунктов (${formatPercent(comparison.delta.averageScorePercent)}).`;

  return [
    '# Clarity Guardian Retro Report',
    '',
    '## Период',
    '',
    'Данные построены по выбранному набору задач. В demo-режиме период задан полем `period`: `before` и `after`.',
    '',
    '## Общая картина',
    '',
    `- Всего задач: ${dashboard.totalTasks}`,
    `- Средний Clarity Score: ${dashboard.averageScore}/100`,
    `- Задач с высоким качеством: ${dashboard.quality.good}`,
    `- Задач со средним качеством: ${dashboard.quality.medium}`,
    `- Задач с низким качеством: ${dashboard.quality.poor}`,
    '',
    '## Основные проблемы',
    '',
    ...(topItems(dashboard.topProblems).length > 0 ? topItems(dashboard.topProblems) : ['1. Повторяющихся проблем не найдено.']),
    '',
    '## Динамика',
    '',
    `- Before: ${comparison.before.totalTasks} задач, средний score ${comparison.before.averageScore}/100.`,
    `- After: ${comparison.after.totalTasks} задач, средний score ${comparison.after.averageScore}/100.`,
    `- ${improvementText}`,
    `- Изменение задач с низким качеством: ${formatDelta(comparison.delta.lowQualityTasks)}.`,
    `- Изменение задач без критериев приёмки: ${formatDelta(comparison.delta.missingAcceptanceCriteria)}.`,
    `- Изменение задач без контекста: ${formatDelta(comparison.delta.missingContext)}.`,
    `- Изменение возвратов с тестирования: ${formatDelta(comparison.delta.qaReturns)}.`,
    '',
    '## Примеры задач, требующих внимания',
    '',
    ...dashboard.lowestScoreTasks.map((task, index) =>
      `${index + 1}. **${task.key || task.id}** - ${task.score}/100 - ${task.title}`
    ),
    '',
    '## Рекомендации для команды',
    '',
    '- Добавлять бизнес-контекст: зачем задача нужна и какую проблему пользователя решает.',
    '- Фиксировать ожидаемый результат как наблюдаемое поведение продукта.',
    '- Писать критерии приёмки в формате чек-листа или Given/When/Then.',
    '- Убирать формулировки вроде “как обсуждали”, “пофиксить”, “сделать нормально”.',
    '- Разбивать большие задачи на несколько проверяемых изменений.',
    '',
    '## Что стоит улучшить в постановке задач',
    '',
    '- Сделать шаблон задачи обязательным для `bug`, `task` и `story`.',
    '- Выносить договорённости из чатов в описание задачи.',
    '- Перед разработкой проверять, сможет ли QA построить тест-кейсы только по задаче.',
    '',
    '## Вывод',
    '',
    'Clarity Guardian помогает команде увидеть, где именно теряется смысл задачи, и превратить это в обсуждаемые улучшения процесса.'
  ].join('\n');
}

export function formatResearchReportMarkdown(data: ResearchReportData): string {
  return [
    '# Clarity Guardian: исследовательские заметки',
    '',
    '## Гипотеза',
    '',
    'Более ясные задачи могут проходить разработку быстрее и давать меньше возвратов с тестирования, потому что команда раньше согласует контекст, ожидаемый результат и критерии проверки.',
    '',
    '## Наблюдения',
    '',
    `- Всего задач в выборке: ${data.totalTasks}`,
    `- Среднее время high-clarity задач: ${data.highClarityAverageCycleHours ?? 'нет данных'} часов`,
    `- Среднее время low-clarity задач: ${data.lowClarityAverageCycleHours ?? 'нет данных'} часов`,
    `- Средние возвраты QA для high-clarity задач: ${data.highClarityAverageQaReturns ?? 'нет данных'}`,
    `- Средние возвраты QA для low-clarity задач: ${data.lowClarityAverageQaReturns ?? 'нет данных'}`,
    `- Среднее число комментариев high-clarity задач: ${data.highClarityAverageComments ?? 'нет данных'}`,
    `- Среднее число комментариев low-clarity задач: ${data.lowClarityAverageComments ?? 'нет данных'}`,
    `- Среднее число изменений описания high-clarity задач: ${data.highClarityAverageDescriptionChanges ?? 'нет данных'}`,
    `- Среднее число изменений описания low-clarity задач: ${data.lowClarityAverageDescriptionChanges ?? 'нет данных'}`,
    '',
    '## Аккуратная интерпретация',
    '',
    ...data.notes.map((note) => `- ${note}`),
    '',
    '## Следующий шаг',
    '',
    'На ретро стоит посмотреть примеры low-score задач и проверить, какие проблемы повторяются чаще всего.'
  ].join('\n');
}

export function formatTasksCsv(records: TaskAnalysisRecord[]): string {
  const header = [
    'id',
    'key',
    'source',
    'title',
    'status',
    'author',
    'assignee',
    'period',
    'score',
    'riskLevel',
    'problems',
    'qaReturns',
    'cycleTimeHours',
    'commentsCount',
    'descriptionChanges'
  ];
  const rows = records.map((record) => [
    record.task.id,
    record.task.key || '',
    record.task.source,
    record.task.title,
    record.task.status || '',
    record.task.author || '',
    record.task.assignee || '',
    record.task.period || '',
    record.score,
    record.riskLevel,
    record.problemCodes.join('|'),
    record.task.metrics?.qaReturns ?? '',
    record.task.metrics?.cycleTimeHours ?? '',
    record.task.metrics?.commentsCount ?? '',
    record.task.metrics?.descriptionChanges ?? ''
  ]);

  return [
    header.map(csvEscape).join(','),
    ...rows.map((row) => row.map(csvEscape).join(','))
  ].join('\n');
}

export function formatDashboardHtml(dashboard: ClarityDashboard): string {
  const problemRows = dashboard.topProblems.map((problem) =>
    `<tr><td>${htmlEscape(problem.name)}</td><td>${problem.count}</td></tr>`
  ).join('');
  const lowScoreRows = dashboard.lowestScoreTasks.map((task) =>
    `<tr><td>${htmlEscape(task.key || task.id)}</td><td>${htmlEscape(task.title)}</td><td>${task.score}</td><td>${task.riskLevel}</td></tr>`
  ).join('');

  return [
    '<!doctype html>',
    '<html lang="ru">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>Clarity Guardian Dashboard</title>',
    '<style>',
    'body{font-family:Inter,Arial,sans-serif;margin:32px;color:#1f2937;background:#f8fafc}',
    'main{max-width:1040px;margin:0 auto}',
    '.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}',
    '.metric{background:#fff;border:1px solid #dbe3ee;border-radius:8px;padding:16px}',
    '.value{font-size:32px;font-weight:700}',
    'table{width:100%;border-collapse:collapse;background:#fff;margin-top:12px}',
    'th,td{border:1px solid #dbe3ee;padding:10px;text-align:left}',
    'th{background:#eef2f7}',
    '</style>',
    '</head>',
    '<body><main>',
    '<h1>Clarity Guardian Dashboard</h1>',
    `<p>Сгенерировано: ${dashboard.generatedAt}</p>`,
    '<section class="metrics">',
    `<div class="metric"><div>Всего задач</div><div class="value">${dashboard.totalTasks}</div></div>`,
    `<div class="metric"><div>Средний score</div><div class="value">${dashboard.averageScore}</div></div>`,
    `<div class="metric"><div>Высокое качество</div><div class="value">${dashboard.quality.good}</div></div>`,
    `<div class="metric"><div>Среднее качество</div><div class="value">${dashboard.quality.medium}</div></div>`,
    `<div class="metric"><div>Низкое качество</div><div class="value">${dashboard.quality.poor}</div></div>`,
    '</section>',
    '<h2>Основные проблемы</h2>',
    `<table><thead><tr><th>Проблема</th><th>Количество</th></tr></thead><tbody>${problemRows}</tbody></table>`,
    '<h2>Задачи с самым низким score</h2>',
    `<table><thead><tr><th>Задача</th><th>Название</th><th>Score</th><th>Риск</th></tr></thead><tbody>${lowScoreRows}</tbody></table>`,
    '</main></body></html>'
  ].join('');
}
