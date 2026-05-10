import path from 'node:path';

import {
  applyModeToLevel,
  detectLanguage,
  detectWorkItemType,
  getRequiredSections,
  getStopPhrases,
  loadConfig
} from './config';
import {
  countNonWhitespaceChars,
  extractFirstMarkdownSection,
  getStringArg,
  makeCliError,
  normalizeText,
  parseArgs,
  readJsonFile,
  readTextFile,
  replaceManagedBlock,
  writeJsonFile,
  writeTextFile
} from './utils';

import type {
  AnalysisResult,
  ClarityMode,
  NormalizedTask,
  Remark,
  ResolvedConfig,
  SectionRuleConfig,
  StopPhraseRuleConfig,
  TaskPayload,
  TemplateLanguage,
  WorkItemType
} from './types';

const DESCRIPTION_START_MARKER = '<!-- clarity-guardian:description:start -->';
const DESCRIPTION_END_MARKER = '<!-- clarity-guardian:description:end -->';

const LOCALIZED_TEXT = {
  ru: {
    commentTitle: '## 🛡️ Clarity Guardian: проверка ясности задачи',
    descriptionTitle: '## Clarity Guardian',
    blocked: '🛑 Я остановил задачу: в описании не хватает обязательной ясности.',
    warning: '⚠️ Задачу можно читать, но есть места, где легко начнётся испорченный телефон.',
    ok: '✅ Описание выглядит достаточно ясным.',
    objectLabel: 'Проверяемый объект',
    typeLabel: 'Тип',
    modeLabel: 'Режим',
    languageLabel: 'Язык',
    whatToFix: '### Что нужно поправить',
    noRemarks: 'Замечаний нет.',
    error: 'Ошибка',
    advice: 'Совет',
    footer: 'Когда поправишь описание, я проверю его заново при следующем `edited` событии.',
    missingSection: (section: string) => `Отсутствует обязательный раздел «## ${section}».`,
    shortSection: (section: string, count: number) =>
      `Раздел «## ${section}» есть, но он пустой или слишком короткий. Нужно минимум ${count} непробельных символов.`,
    brokenWithoutSteps: 'Есть формулировка «не работает», но нет шагов воспроизведения. Добавь: что сделал пользователь, что произошло, что должно было произойти.'
  },
  en: {
    commentTitle: '## 🛡️ Clarity Guardian: task clarity check',
    descriptionTitle: '## Clarity Guardian',
    blocked: '🛑 I stopped this task because the description is missing required clarity.',
    warning: '⚠️ The task is readable, but some parts can still be misunderstood.',
    ok: '✅ The description looks clear enough.',
    objectLabel: 'Checked object',
    typeLabel: 'Type',
    modeLabel: 'Mode',
    languageLabel: 'Language',
    whatToFix: '### What to fix',
    noRemarks: 'No remarks.',
    error: 'Error',
    advice: 'Advice',
    footer: 'After you update the description, I will check it again on the next `edited` event.',
    missingSection: (section: string) => `Missing required section "## ${section}".`,
    shortSection: (section: string, count: number) =>
      `Section "## ${section}" exists, but it is empty or too short. It needs at least ${count} non-whitespace characters.`,
    brokenWithoutSteps: 'The description says "not working", but does not include reproduction steps. Add what the user did, what happened, and what should have happened.'
  }
} as const;

function detectBrokenWithoutReproductionSteps(
  body: string,
  language: TemplateLanguage,
  mode: ClarityMode
): Remark | null {
  const normalized = normalizeText(body).toLowerCase();
  const brokenPhrase = language === 'ru' ? 'не работает' : 'not working';

  if (!normalized.includes(brokenPhrase)) {
    return null;
  }

  const reproductionMarkers = language === 'ru'
    ? [
      'шаги',
      'шаги воспроизведения',
      'как воспроизвести',
      'str',
      'steps to reproduce',
      'фактический результат',
      'ожидаемый результат'
    ]
    : [
      'steps',
      'steps to reproduce',
      'str',
      'actual result',
      'actual outcome',
      'expected result',
      'expected outcome'
    ];

  const hasReproductionContext = reproductionMarkers.some((marker) =>
    normalized.includes(marker)
  );

  if (hasReproductionContext) {
    return null;
  }

  return {
    level: applyModeToLevel('error', mode),
    code: 'broken_without_reproduction',
    message: LOCALIZED_TEXT[language].brokenWithoutSteps
  };
}

function getSectionHeadings(rule: SectionRuleConfig): string[] {
  return [rule.section, ...(rule.aliases || [])];
}

export function analyzeRequiredSections(
  body: string,
  requiredSections: SectionRuleConfig[],
  language: TemplateLanguage,
  mode: ClarityMode,
  workItemType: WorkItemType
): Remark[] {
  const remarks: Remark[] = [];

  for (const rule of requiredSections) {
    const section = rule.section;
    const content = extractFirstMarkdownSection(body, getSectionHeadings(rule));
    const level = applyModeToLevel(rule.level || 'error', mode);

    if (content === null) {
      remarks.push({
        level,
        code: rule.code || 'missing_section',
        section,
        workItemType,
        message: rule.message || LOCALIZED_TEXT[language].missingSection(section)
      });
      continue;
    }

    const charsCount = countNonWhitespaceChars(content);
    const minChars = rule.minNonWhitespaceChars || 20;

    if (charsCount < minChars) {
      remarks.push({
        level,
        code: 'empty_or_too_short_section',
        section,
        workItemType,
        message: LOCALIZED_TEXT[language].shortSection(section, minChars)
      });
    }
  }

  return remarks;
}

export function analyzeStopPhrases(
  body: string,
  stopPhrases: StopPhraseRuleConfig[],
  language: TemplateLanguage,
  mode: ClarityMode
): Remark[] {
  const remarks: Remark[] = [];
  const normalized = normalizeText(body).toLowerCase();

  for (const rule of stopPhrases) {
    const phrase = normalizeText(rule.phrase).toLowerCase();

    if (phrase && containsStopPhrase(normalized, phrase)) {
      remarks.push({
        level: applyModeToLevel(rule.level || 'warning', mode),
        code: rule.code || 'stop_phrase',
        phrase: rule.phrase,
        message: rule.message || `Stop phrase detected: ${rule.phrase}`
      });
    }
  }

  const brokenWithoutSteps = detectBrokenWithoutReproductionSteps(body, language, mode);

  if (brokenWithoutSteps) {
    remarks.push(brokenWithoutSteps);
  }

  return remarks;
}

function containsStopPhrase(normalizedBody: string, normalizedPhrase: string): boolean {
  const escapedPhrase = normalizedPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(
    `(?<![\\p{L}\\p{N}_])${escapedPhrase}(?![\\p{L}\\p{N}_])`,
    'iu'
  );

  return regex.test(normalizedBody);
}

function getTemplatePath(baseName: string, language: TemplateLanguage): string {
  if (language === 'en') {
    return path.join('templates', `${baseName}.en.md`);
  }

  return path.join('templates', `${baseName}.md`);
}

function getStatusLine(task: NormalizedTask, remarks: Remark[]): string {
  const text = LOCALIZED_TEXT[task.language];
  const errors = remarks.filter((remark) => remark.level === 'error');

  if (errors.length > 0) {
    return text.blocked;
  }

  if (remarks.length > 0) {
    return text.warning;
  }

  return text.ok;
}

function formatRemarks(task: NormalizedTask, remarks: Remark[]): string {
  const text = LOCALIZED_TEXT[task.language];

  return remarks.map((remark, index) => {
    const icon = remark.level === 'error' ? '🛑' : '⚠️';
    const levelText = remark.level === 'error' ? text.error : text.advice;

    return `${index + 1}. ${icon} **${levelText}:** ${remark.message}`;
  }).join('\n');
}

function buildManagerChecklistComment(
  task: NormalizedTask,
  remarks: Remark[],
  mode: ClarityMode
): string {
  const managerChecklistPath = getTemplatePath('manager-checklist', task.language);
  const managerChecklist = readTextFile(managerChecklistPath);
  const text = LOCALIZED_TEXT[task.language];
  const remarksMarkdown = formatRemarks(task, remarks);

  return [
    '<!-- clarity-guardian:analysis -->',
    text.commentTitle,
    '',
    getStatusLine(task, remarks),
    '',
    `**${text.objectLabel}:** ${task.type === 'pr' ? 'Pull Request' : 'Issue'}`,
    `**${text.typeLabel}:** ${task.workItemType}`,
    `**${text.modeLabel}:** ${mode}`,
    `**${text.languageLabel}:** ${task.language}`,
    '',
    text.whatToFix,
    '',
    remarksMarkdown || text.noRemarks,
    '',
    '---',
    '',
    managerChecklist,
    '',
    '---',
    '',
    text.footer
  ].join('\n');
}

function buildDescriptionBlock(
  task: NormalizedTask,
  remarks: Remark[],
  mode: ClarityMode
): string {
  const text = LOCALIZED_TEXT[task.language];
  const remarksMarkdown = formatRemarks(task, remarks);

  return [
    text.descriptionTitle,
    '',
    getStatusLine(task, remarks),
    '',
    `- ${text.objectLabel}: ${task.type === 'pr' ? 'Pull Request' : 'Issue'}`,
    `- ${text.typeLabel}: ${task.workItemType}`,
    `- ${text.modeLabel}: ${mode}`,
    `- ${text.languageLabel}: ${task.language}`,
    '',
    remarksMarkdown || text.noRemarks
  ].join('\n');
}

function normalizeTask(task: TaskPayload, config: ResolvedConfig): NormalizedTask {
  const language = detectLanguage(task, config);
  const workItemType = detectWorkItemType(task);

  return {
    title: normalizeText(task.title),
    body: normalizeText(task.body),
    labels: (task.labels || []).map((label) => normalizeText(label)).filter(Boolean),
    type: task.type === 'pr' ? 'pr' : 'issue',
    workItemType,
    language
  };
}

function buildUpdatedBody(task: NormalizedTask, descriptionMarkdown: string): string {
  const managedBlock = [
    DESCRIPTION_START_MARKER,
    descriptionMarkdown,
    DESCRIPTION_END_MARKER
  ].join('\n');

  return replaceManagedBlock(
    task.body,
    DESCRIPTION_START_MARKER,
    DESCRIPTION_END_MARKER,
    managedBlock
  );
}

export function analyzeTask(
  task: TaskPayload,
  options: {
    config?: ResolvedConfig;
  } = {}
): AnalysisResult {
  const config = options.config || loadConfig();
  const normalizedTask = normalizeTask(task, config);
  const requiredSections = getRequiredSections(
    config,
    normalizedTask.language,
    normalizedTask.workItemType
  );
  const stopPhrases = getStopPhrases(
    config,
    normalizedTask.language,
    normalizedTask.workItemType
  );

  const remarks = [
    ...analyzeRequiredSections(
      normalizedTask.body,
      requiredSections,
      normalizedTask.language,
      config.mode,
      normalizedTask.workItemType
    ),
    ...analyzeStopPhrases(
      normalizedTask.body,
      stopPhrases,
      normalizedTask.language,
      config.mode
    )
  ];

  const hasErrors = remarks.some((remark) => remark.level === 'error');
  const hasWarnings = remarks.some((remark) => remark.level === 'warning');
  const commentMarkdown = buildManagerChecklistComment(normalizedTask, remarks, config.mode);
  const descriptionMarkdown = buildDescriptionBlock(normalizedTask, remarks, config.mode);
  const updatedBody = config.updateDescription
    ? buildUpdatedBody(normalizedTask, descriptionMarkdown)
    : normalizedTask.body;

  return {
    hasErrors,
    hasWarnings,
    mode: config.mode,
    language: normalizedTask.language,
    workItemType: normalizedTask.workItemType,
    remarks,
    commentMarkdown,
    descriptionMarkdown,
    updatedBody,
    shouldUpdateDescription: config.updateDescription && updatedBody !== normalizedTask.body
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  const inputPath = getStringArg(args, 'input');
  const jsonFilePath = getStringArg(args, 'json-file');
  const commentFilePath = getStringArg(args, 'comment-file');
  const updatedBodyFilePath = getStringArg(args, 'updated-body-file');
  const configPath = getStringArg(args, 'config');

  if (!inputPath) {
    throw makeCliError('Не передан аргумент --input');
  }

  const task = readJsonFile<TaskPayload>(inputPath);
  const config = loadConfig(configPath);
  const result = analyzeTask(task, { config });

  if (jsonFilePath) {
    writeJsonFile(jsonFilePath, result);
  } else {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }

  if (commentFilePath) {
    writeTextFile(commentFilePath, result.commentMarkdown);
  }

  if (updatedBodyFilePath) {
    writeTextFile(updatedBodyFilePath, result.updatedBody);
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
