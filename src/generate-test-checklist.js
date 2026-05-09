'use strict';

/**
 * Генерация чек-листа для тестировщика.
 *
 * Если OPENAI_API_KEY задан:
 *   - отправляем задачу в OpenAI API;
 *   - просим вернуть Markdown-чеклист;
 *   - добавляем результат в комментарий.
 *
 * Если OPENAI_API_KEY не задан:
 *   - возвращаем стандартный шаблон из templates/tester-checklist.md.
 *
 * Скрипт не зависит от GitHub API.
 */

const path = require('path');

const {
  readJsonFile,
  writeJsonFile,
  readTextFile,
  writeTextFile,
  parseArgs,
  normalizeText,
  makeCliError
} = require('./utils');

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

function buildPrompt(task) {
  return [
    'Ты - опытный QA Lead.',
    '',
    'Составь подробный чек-лист для тестирования задачи.',
    '',
    'Требования к ответу:',
    '- Пиши на русском языке.',
    '- Формат: Markdown.',
    '- Не придумывай бизнес-требования, которых нет в задаче.',
    '- Если информации не хватает, добавь раздел "Что уточнить перед тестированием".',
    '- Укажи шаги проверки.',
    '- Для каждого шага укажи ожидаемый результат.',
    '- Добавь граничные случаи.',
    '- Добавь регрессионные проверки.',
    '- Добавь проверки логирования/аналитики/API, если это уместно по описанию.',
    '- Не используй воду и общие фразы.',
    '',
    'Название задачи:',
    task.title || 'Без названия',
    '',
    'Описание задачи:',
    task.body || 'Описание отсутствует.'
  ].join('\n');
}

function extractTextFromOpenAIResponse(data) {
  if (typeof data.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const chunks = [];

  if (Array.isArray(data.output)) {
    for (const outputItem of data.output) {
      if (!Array.isArray(outputItem.content)) {
        continue;
      }

      for (const contentItem of outputItem.content) {
        if (typeof contentItem.text === 'string') {
          chunks.push(contentItem.text);
        }
      }
    }
  }

  return chunks.join('\n').trim();
}

async function generateChecklistWithOpenAI(task, options = {}) {
  const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
  const model = options.model || DEFAULT_MODEL;

  if (!apiKey) {
    return null;
  }

  const prompt = buildPrompt(task);

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      input: prompt,
      temperature: 0.2,
      max_output_tokens: 2500
    })
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `OpenAI API вернул ошибку ${response.status}: ${responseText}`
    );
  }

  const data = JSON.parse(responseText);
  const generatedText = extractTextFromOpenAIResponse(data);

  if (!generatedText) {
    throw new Error('OpenAI API вернул пустой ответ.');
  }

  return generatedText;
}

function loadFallbackChecklist() {
  const templatePath = path.join('templates', 'tester-checklist.md');
  return readTextFile(templatePath);
}

function wrapChecklistComment(task, checklistMarkdown, source) {
  const sourceText = source === 'openai'
    ? `Сгенерировано через OpenAI API, модель \`${DEFAULT_MODEL}\`.`
    : 'OPENAI_API_KEY не задан, поэтому использован стандартный шаблон.';

  return [
    '<!-- clarity-guardian:tester-checklist -->',
    '## 🧪 Clarity Guardian: чек-лист для тестирования',
    '',
    `**Источник:** ${sourceText}`,
    '',
    `**Задача:** ${task.title || 'Без названия'}`,
    '',
    '---',
    '',
    checklistMarkdown,
    '',
    '---',
    '',
    'Перед началом тестирования проверь, что описание задачи и критерии приёмки не противоречат этому чек-листу.'
  ].join('\n');
}

async function generateTestChecklist(task, options = {}) {
  const normalizedTask = {
    title: normalizeText(task.title),
    body: normalizeText(task.body),
    type: task.type === 'pr' ? 'pr' : 'issue'
  };

  const generated = await generateChecklistWithOpenAI(normalizedTask, options);

  if (generated) {
    const commentMarkdown = wrapChecklistComment(normalizedTask, generated, 'openai');

    return {
      source: 'openai',
      checklistMarkdown: generated,
      commentMarkdown
    };
  }

  const fallback = loadFallbackChecklist();
  const commentMarkdown = wrapChecklistComment(normalizedTask, fallback, 'fallback');

  return {
    source: 'fallback',
    checklistMarkdown: fallback,
    commentMarkdown
  };
}

async function main() {
  const args = parseArgs(process.argv);

  if (!args.input) {
    throw makeCliError('Не передан аргумент --input');
  }

  const task = readJsonFile(args.input);
  const result = await generateTestChecklist(task);

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
  generateTestChecklist,
  generateChecklistWithOpenAI,
  buildPrompt,
  extractTextFromOpenAIResponse
};
