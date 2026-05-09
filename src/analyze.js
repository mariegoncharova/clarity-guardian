'use strict';

/**
 * Анализ описания Issue/PR на полноту.
 */

const path = require('path');

const {
  readJsonFile,
  writeJsonFile,
  readTextFile,
  writeTextFile,
  parseArgs,
  normalizeText,
  countNonWhitespaceChars,
  extractMarkdownSection,
  makeCliError
} = require('./utils');

const REQUIRED_SECTIONS = [
  'Контекст',
  'Ожидаемый результат',
  'Критерии приёмки'
];

const MIN_SECTION_NON_WHITESPACE_CHARS = 20;

const STOP_PHRASES = [
  {
    phrase: 'сделать красиво',
    level: 'warning',
    code: 'vague_phrase',
    message: 'Фраза «сделать красиво» слишком субъективна. Лучше описать конкретные признаки результата.'
  },
  {
    phrase: 'как обсуждали',
    level: 'warning',
    code: 'hidden_context',
    message: 'Фраза «как обсуждали» прячет важный контекст. Добавь краткое резюме договорённостей прямо в задачу.'
  },
  {
    phrase: 'как в прошлый раз',
    level: 'warning',
    code: 'hidden_reference',
    message: 'Фраза «как в прошлый раз» может быть понята по-разному. Добавь ссылку или явно опиши нужное поведение.'
  },
  {
    phrase: 'срочно',
    level: 'warning',
    code: 'urgency_without_reason',
    message: 'Фраза «срочно» не объясняет приоритет. Лучше указать дедлайн, причину срочности и последствия задержки.'
  },
  {
    phrase: 'пофиксить',
    level: 'warning',
    code: 'vague_fix',
    message: 'Фраза «пофиксить» слишком общая. Опиши текущее поведение, ожидаемое поведение и критерии проверки.'
  }
];

function detectBrokenWithoutReproductionSteps(body) {
  const normalized = normalizeText(body).toLowerCase();

  if (!normalized.includes('не работает')) {
    return null;
  }

  const reproductionMarkers = [
    'шаги',
    'шаги воспроизведения',
    'как воспроизвести',
    'str',
    'steps to reproduce',
    'фактический результат',
    'ожидаемый результат'
  ];

  const hasReproductionContext = reproductionMarkers.some(marker => normalized.includes(marker));

  if (hasReproductionContext) {
    return null;
  }

  return {
    level: 'error',
    code: 'broken_without_reproduction',
    message: 'Есть формулировка «не работает», но нет шагов воспроизведения. Добавь: что сделал пользователь, что произошло, что должно было произойти.'
  };
}

function analyzeRequiredSections(body) {
  const remarks = [];

  for (const section of REQUIRED_SECTIONS) {
    const content = extractMarkdownSection(body, section);

    if (content === null) {
      remarks.push({
        level: 'error',
        code: 'missing_section',
        section,
        message: `Отсутствует обязательный раздел «## ${section}».`
      });
      continue;
    }

    const charsCount = countNonWhitespaceChars(content);

    if (charsCount < MIN_SECTION_NON_WHITESPACE_CHARS) {
      remarks.push({
        level: 'error',
        code: 'empty_or_too_short_section',
        section,
        message: `Раздел «## ${section}» есть, но он пустой или слишком короткий. Нужно минимум ${MIN_SECTION_NON_WHITESPACE_CHARS} непробельных символов.`
      });
    }
  }

  return remarks;
}

function analyzeStopPhrases(body) {
  const remarks = [];
  const normalized = normalizeText(body).toLowerCase();

  for (const rule of STOP_PHRASES) {
    if (normalized.includes(rule.phrase)) {
      remarks.push({
        level: rule.level,
        code: rule.code,
        phrase: rule.phrase,
        message: rule.message
      });
    }
  }

  const brokenWithoutSteps = detectBrokenWithoutReproductionSteps(body);

  if (brokenWithoutSteps) {
    remarks.push(brokenWithoutSteps);
  }

  return remarks;
}

function buildManagerChecklistComment(task, remarks) {
  const managerChecklistPath = path.join('templates', 'manager-checklist.md');
  const managerChecklist = readTextFile(managerChecklistPath);

  const errors = remarks.filter(remark => remark.level === 'error');

  const statusLine = errors.length > 0
    ? '🛑 Я остановил задачу: в описании не хватает обязательной ясности.'
    : '⚠️ Задачу можно читать, но есть места, где легко начнётся испорченный телефон.';

  const remarksMarkdown = remarks.map((remark, index) => {
    const icon = remark.level === 'error' ? '🛑' : '⚠️';
    const levelText = remark.level === 'error' ? 'Ошибка' : 'Совет';

    return `${index + 1}. ${icon} **${levelText}:** ${remark.message}`;
  }).join('\n');

  return [
    '<!-- clarity-guardian:analysis -->',
    '## 🛡️ Clarity Guardian: проверка ясности задачи',
    '',
    statusLine,
    '',
    `**Проверяемый объект:** ${task.type === 'pr' ? 'Pull Request' : 'Issue'}`,
    '',
    '### Что нужно поправить',
    '',
    remarksMarkdown || 'Замечаний нет.',
    '',
    '---',
    '',
    managerChecklist,
    '',
    '---',
    '',
    'Когда поправишь описание, я проверю его заново при следующем `edited` событии.'
  ].join('\n');
}

function analyzeTask(task) {
  const normalizedTask = {
    title: normalizeText(task.title),
    body: normalizeText(task.body),
    type: task.type === 'pr' ? 'pr' : 'issue'
  };

  const remarks = [
    ...analyzeRequiredSections(normalizedTask.body),
    ...analyzeStopPhrases(normalizedTask.body)
  ];

  const hasErrors = remarks.some(remark => remark.level === 'error');
  const hasWarnings = remarks.some(remark => remark.level === 'warning');

  const commentMarkdown = buildManagerChecklistComment(normalizedTask, remarks);

  return {
    hasErrors,
    hasWarnings,
    remarks,
    commentMarkdown
  };
}

async function main() {
  const args = parseArgs(process.argv);

  if (!args.input) {
    throw makeCliError('Не передан аргумент --input');
  }

  const task = readJsonFile(args.input);
  const result = analyzeTask(task);

  if (args['json-file']) {
    writeJsonFile(args['json-file'], result);
  } else {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }

  if (args['comment-file']) {
    writeTextFile(args['comment-file'], result.commentMarkdown);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  analyzeTask,
  analyzeRequiredSections,
  analyzeStopPhrases
};
