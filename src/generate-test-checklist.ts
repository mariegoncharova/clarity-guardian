import path from 'node:path';

import {
  detectLanguage,
  detectWorkItemType,
  loadConfig
} from './config';
import {
  getStringArg,
  makeCliError,
  normalizeText,
  parseArgs,
  readJsonFile,
  readTextFile,
  writeJsonFile,
  writeTextFile
} from './utils';

import type {
  ChecklistResult,
  NormalizedTask,
  OpenAIResponseBody,
  ResolvedConfig,
  TaskPayload
} from './types';

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

export function buildPrompt(task: NormalizedTask): string {
  if (task.language === 'en') {
    return [
      'You are an experienced QA Lead.',
      '',
      'Create a detailed testing checklist for this task.',
      '',
      'Requirements for the answer:',
      '- Write in English.',
      '- Use Markdown.',
      '- Do not invent business requirements that are not present in the task.',
      '- If information is missing, add a "Questions before testing" section.',
      '- Include verification steps.',
      '- Include the expected result for each step.',
      '- Add edge cases.',
      '- Add regression checks.',
      '- Add logging/analytics/API checks when relevant to the description.',
      '- Avoid filler and generic phrases.',
      '',
      `Work item type: ${task.workItemType}`,
      '',
      'Task title:',
      task.title || 'Untitled',
      '',
      'Task description:',
      task.body || 'No description.'
    ].join('\n');
  }

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
    `Тип задачи: ${task.workItemType}`,
    '',
    'Название задачи:',
    task.title || 'Без названия',
    '',
    'Описание задачи:',
    task.body || 'Описание отсутствует.'
  ].join('\n');
}

export function extractTextFromOpenAIResponse(data: OpenAIResponseBody): string {
  if (typeof data.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const chunks: string[] = [];

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

export async function generateChecklistWithOpenAI(
  task: NormalizedTask,
  options: {
    apiKey?: string;
    model?: string;
  } = {}
): Promise<string | null> {
  const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
  const model = options.model || DEFAULT_MODEL;

  if (!apiKey) {
    return null;
  }

  const prompt = buildPrompt(task);

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
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

  const data = JSON.parse(responseText) as OpenAIResponseBody;
  const generatedText = extractTextFromOpenAIResponse(data);

  if (!generatedText) {
    throw new Error('OpenAI API вернул пустой ответ.');
  }

  return generatedText;
}

function loadLocalizedFallbackChecklist(task: NormalizedTask): string {
  const templateName = task.language === 'en'
    ? 'tester-checklist.en.md'
    : 'tester-checklist.md';
  const templatePath = path.join('templates', templateName);

  return readTextFile(templatePath);
}

function wrapChecklistComment(
  task: NormalizedTask,
  checklistMarkdown: string,
  source: ChecklistResult['source']
): string {
  if (task.language === 'en') {
    const sourceText = source === 'openai'
      ? `Generated with OpenAI API, model \`${DEFAULT_MODEL}\`.`
      : 'OPENAI_API_KEY is not configured, so the default template was used.';

    return [
      '<!-- clarity-guardian:tester-checklist -->',
      '## 🧪 Clarity Guardian: testing checklist',
      '',
      `**Source:** ${sourceText}`,
      '',
      `**Task:** ${task.title || 'Untitled'}`,
      `**Type:** ${task.workItemType}`,
      '',
      '---',
      '',
      checklistMarkdown,
      '',
      '---',
      '',
      'Before testing, confirm that the task description and acceptance criteria do not conflict with this checklist.'
    ].join('\n');
  }

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
    `**Тип:** ${task.workItemType}`,
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

export async function generateTestChecklist(
  task: TaskPayload,
  options: {
    apiKey?: string;
    model?: string;
    config?: ResolvedConfig;
  } = {}
): Promise<ChecklistResult> {
  const config = options.config || loadConfig();
  const normalizedTask: NormalizedTask = {
    title: normalizeText(task.title),
    body: normalizeText(task.body),
    labels: (task.labels || []).map((label) => normalizeText(label)).filter(Boolean),
    type: task.type === 'pr' ? 'pr' : 'issue',
    workItemType: detectWorkItemType(task),
    language: detectLanguage(task, config)
  };

  const generated = await generateChecklistWithOpenAI(normalizedTask, options);

  if (generated) {
    const commentMarkdown = wrapChecklistComment(normalizedTask, generated, 'openai');

    return {
      source: 'openai',
      language: normalizedTask.language,
      workItemType: normalizedTask.workItemType,
      checklistMarkdown: generated,
      commentMarkdown
    };
  }

  const fallback = loadLocalizedFallbackChecklist(normalizedTask);
  const commentMarkdown = wrapChecklistComment(normalizedTask, fallback, 'fallback');

  return {
    source: 'fallback',
    language: normalizedTask.language,
    workItemType: normalizedTask.workItemType,
    checklistMarkdown: fallback,
    commentMarkdown
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  const inputPath = getStringArg(args, 'input');
  const jsonFilePath = getStringArg(args, 'json-file');
  const commentFilePath = getStringArg(args, 'comment-file');
  const configPath = getStringArg(args, 'config');

  if (!inputPath) {
    throw makeCliError('Не передан аргумент --input');
  }

  const task = readJsonFile<TaskPayload>(inputPath);
  const config = loadConfig(configPath);
  const result = await generateTestChecklist(task, { config });

  if (jsonFilePath) {
    writeJsonFile(jsonFilePath, result);
  } else {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }

  if (commentFilePath) {
    writeTextFile(commentFilePath, result.commentMarkdown);
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
