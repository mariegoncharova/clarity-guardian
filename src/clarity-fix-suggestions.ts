import {
  extractFirstMarkdownSection,
  normalizeText
} from './utils';

import type {
  ClarityScoreResult
} from './clarity-score';

import type {
  ClarityFixSuggestions,
  NormalizedTask,
  Remark,
  TemplateLanguage
} from './types';

import type {
  ToneAnalysisResult
} from './types/toneOfVoice';

const SECTION_HEADINGS: Record<TemplateLanguage, {
  context: string;
  contextAliases: string[];
  expectedResult: string;
  expectedResultAliases: string[];
  acceptanceCriteria: string;
  acceptanceCriteriaAliases: string[];
  reproductionSteps: string;
  reproductionStepsAliases: string[];
  actualResult: string;
  actualResultAliases: string[];
}> = {
  ru: {
    context: 'Контекст',
    contextAliases: ['Context'],
    expectedResult: 'Ожидаемый результат',
    expectedResultAliases: ['Expected result', 'Expected outcome'],
    acceptanceCriteria: 'Критерии приёмки',
    acceptanceCriteriaAliases: ['Критерии приемки', 'Acceptance criteria', 'Acceptance Criteria'],
    reproductionSteps: 'Шаги воспроизведения',
    reproductionStepsAliases: ['Как воспроизвести', 'Steps to reproduce'],
    actualResult: 'Фактический результат',
    actualResultAliases: ['Actual result', 'Actual outcome']
  },
  en: {
    context: 'Context',
    contextAliases: ['Контекст'],
    expectedResult: 'Expected result',
    expectedResultAliases: ['Expected outcome', 'Ожидаемый результат'],
    acceptanceCriteria: 'Acceptance criteria',
    acceptanceCriteriaAliases: ['Acceptance Criteria', 'Критерии приёмки', 'Критерии приемки'],
    reproductionSteps: 'Steps to reproduce',
    reproductionStepsAliases: ['Reproduction steps', 'Шаги воспроизведения', 'Как воспроизвести'],
    actualResult: 'Actual result',
    actualResultAliases: ['Actual outcome', 'Фактический результат']
  }
};

const TEXT = {
  ru: {
    placeholders: {
      context: '[Уточнить: какую пользовательскую или бизнес-проблему решаем, кто затронут и почему это важно сейчас.]',
      expectedResult: '[Уточнить: какое наблюдаемое поведение продукта считается успешным результатом.]',
      reproductionSteps: '[Уточнить: шаги пользователя, окружение и входные данные, на которых ошибка воспроизводится.]',
      actualResult: '[Уточнить: что пользователь видит сейчас и чем это отличается от ожидаемого поведения.]',
      pmRewriteReady: (title: string) =>
        `Задача «${title}» выглядит достаточно ясной: контекст, ожидаемый результат и проверка уже описаны. Перед стартом стоит только убедиться, что последние договорённости сохранены в описании.`,
      pmRewriteNeedsWork: (title: string, focus: string) =>
        `Задачу «${title}» стоит уточнить перед разработкой: ${focus}. После этого команда сможет одинаково понять цель, результат и критерии проверки.`
    },
    acceptanceCriteria: [
      '- [ ] Основной успешный сценарий описан и проверяем.',
      '- [ ] Ошибки, пустые состояния и edge cases перечислены.',
      '- [ ] QA может проверить результат без дополнительных устных договорённостей.'
    ],
    questions: {
      context: 'Какую пользовательскую или бизнес-проблему решает задача?',
      expectedResult: 'Какое поведение продукта считается правильным после выполнения?',
      acceptanceCriteria: 'По каким критериям QA и PM поймут, что задача готова?',
      vagueWording: 'Какие слова вроде “нормально”, “улучшить”, “как обсуждали” можно заменить конкретными состояниями, экранами или ограничениями?',
      hiddenAgreement: 'Какие договорённости из чата или встречи нужно перенести прямо в описание?',
      urgency: 'Какой дедлайн, приоритет и причина срочности у задачи?',
      reproduction: 'Какие шаги воспроизведения, окружение и фактический результат нужно добавить?',
      tone: 'Как описать проблему нейтрально: через факт, влияние на пользователя и ожидаемое действие?'
    },
    actions: {
      keep: 'Оставить описание как есть и обновлять его только при новых договорённостях.',
      answerQuestions: 'Ответить на вопросы выше до передачи задачи в разработку.',
      pasteDraft: 'Вставить черновик секций в описание и заменить плейсхолдеры конкретикой.',
      removeVague: 'Заменить размытые формулировки на проверяемые требования.',
      neutralTone: 'Переписать напряжённые формулировки в нейтральном PM-friendly тоне.'
    },
    focusFallback: 'зафиксировать недостающий контекст, ожидаемый результат и критерии приёмки'
  },
  en: {
    placeholders: {
      context: '[Clarify: which user or business problem this solves, who is affected, and why it matters now.]',
      expectedResult: '[Clarify: which observable product behavior counts as a successful result.]',
      reproductionSteps: '[Clarify: user steps, environment, and inputs that reproduce the issue.]',
      actualResult: '[Clarify: what the user sees now and how it differs from the expected behavior.]',
      pmRewriteReady: (title: string) =>
        `The task “${title}” is clear enough: context, expected result, and verification are already described. Before starting, keep any new agreements captured in the description.`,
      pmRewriteNeedsWork: (title: string, focus: string) =>
        `The task “${title}” should be clarified before implementation: ${focus}. After that, the team can align on the goal, outcome, and verification criteria.`
    },
    acceptanceCriteria: [
      '- [ ] The main successful scenario is described and verifiable.',
      '- [ ] Errors, empty states, and edge cases are listed.',
      '- [ ] QA can verify the result without extra verbal agreements.'
    ],
    questions: {
      context: 'Which user or business problem does this task solve?',
      expectedResult: 'Which product behavior is correct after the task is done?',
      acceptanceCriteria: 'Which criteria tell QA and PM that the task is complete?',
      vagueWording: 'Which vague words such as “make it better”, “urgent”, or “as discussed” should become concrete states, screens, or constraints?',
      hiddenAgreement: 'Which chat or meeting agreements need to be copied into the task description?',
      urgency: 'What is the deadline, priority, and reason for urgency?',
      reproduction: 'Which reproduction steps, environment, and actual result should be added?',
      tone: 'How can the issue be described neutrally through facts, user impact, and expected action?'
    },
    actions: {
      keep: 'Keep the description as-is and update it only when new agreements appear.',
      answerQuestions: 'Answer the questions above before handing the task to implementation.',
      pasteDraft: 'Paste the draft sections into the description and replace placeholders with concrete details.',
      removeVague: 'Replace vague wording with verifiable requirements.',
      neutralTone: 'Rewrite tense wording in a neutral PM-friendly tone.'
    },
    focusFallback: 'capture missing context, expected result, and acceptance criteria'
  }
} as const;

function addUnique(items: string[], value: string): void {
  if (!items.includes(value)) {
    items.push(value);
  }
}

function hasSectionRemark(remarks: Remark[], pattern: RegExp): boolean {
  return remarks.some((remark) =>
    pattern.test(remark.section || '') ||
    pattern.test(remark.code) ||
    pattern.test(remark.message)
  );
}

function hasRemarkCode(remarks: Remark[], pattern: RegExp): boolean {
  return remarks.some((remark) => pattern.test(remark.code) || Boolean(remark.phrase && pattern.test(remark.phrase)));
}

function hasCommunicationRisk(clarityScore: ClarityScoreResult, type: string): boolean {
  return clarityScore.communicationRisks.some((risk) => risk.type === type);
}

function getSection(task: NormalizedTask, heading: string, aliases: string[]): string {
  return normalizeText(extractFirstMarkdownSection(task.body, [heading, ...aliases]) || '');
}

function getAcceptanceCriteria(task: NormalizedTask, language: TemplateLanguage): string[] {
  const headings = SECTION_HEADINGS[language];
  const section = getSection(
    task,
    headings.acceptanceCriteria,
    headings.acceptanceCriteriaAliases
  );

  return section
    .split('\n')
    .map((line) => normalizeText(line.replace(/^[-*]\s+/, '')))
    .filter(Boolean);
}

function buildFocus(
  language: TemplateLanguage,
  questions: string[]
): string {
  const text = TEXT[language];

  if (questions.length === 0) {
    return text.focusFallback;
  }

  return questions
    .slice(0, 3)
    .map((question) => question.replace(/[?.]$/u, '').toLowerCase())
    .join('; ');
}

function buildDraftMarkdown(
  task: NormalizedTask,
  language: TemplateLanguage
): string {
  const headings = SECTION_HEADINGS[language];
  const text = TEXT[language];
  const context = getSection(task, headings.context, headings.contextAliases) || text.placeholders.context;
  const expectedResult = getSection(
    task,
    headings.expectedResult,
    headings.expectedResultAliases
  ) || text.placeholders.expectedResult;
  const criteria = getAcceptanceCriteria(task, language);
  const criteriaLines = criteria.length > 0
    ? criteria.map((item) => `- ${item}`)
    : [...text.acceptanceCriteria];
  const sections = [
    `## ${headings.context}`,
    context,
    '',
    `## ${headings.expectedResult}`,
    expectedResult,
    '',
    `## ${headings.acceptanceCriteria}`,
    ...criteriaLines
  ];

  if (task.workItemType === 'bug') {
    sections.push(
      '',
      `## ${headings.reproductionSteps}`,
      getSection(task, headings.reproductionSteps, headings.reproductionStepsAliases) || text.placeholders.reproductionSteps,
      '',
      `## ${headings.actualResult}`,
      getSection(task, headings.actualResult, headings.actualResultAliases) || text.placeholders.actualResult
    );
  }

  return sections.join('\n');
}

function buildQuestions(params: {
  task: NormalizedTask;
  remarks: Remark[];
  clarityScore: ClarityScoreResult;
  toneOfVoice: ToneAnalysisResult;
}): string[] {
  const { task, remarks, clarityScore, toneOfVoice } = params;
  const text = TEXT[task.language];
  const questions: string[] = [];

  if (
    hasSectionRemark(remarks, /контекст|context/i) ||
    hasCommunicationRisk(clarityScore, 'implicit_context') ||
    toneOfVoice.categories.includes('missing_context')
  ) {
    addUnique(questions, text.questions.context);
  }

  if (
    hasSectionRemark(remarks, /ожидаемый|expected/i) ||
    hasCommunicationRisk(clarityScore, 'ambiguous_result') ||
    toneOfVoice.categories.includes('missing_expected_result')
  ) {
    addUnique(questions, text.questions.expectedResult);
  }

  if (
    hasSectionRemark(remarks, /критерии|acceptance/i) ||
    hasCommunicationRisk(clarityScore, 'unverifiable_acceptance')
  ) {
    addUnique(questions, text.questions.acceptanceCriteria);
  }

  if (
    hasRemarkCode(remarks, /vague|undefined|deferred|hidden|tbd|scope|quality|ux/i) ||
    hasCommunicationRisk(clarityScore, 'hidden_agreement') ||
    toneOfVoice.categories.includes('vague_wording')
  ) {
    addUnique(questions, text.questions.vagueWording);
  }

  if (hasCommunicationRisk(clarityScore, 'hidden_agreement') || hasRemarkCode(remarks, /hidden|deferred/i)) {
    addUnique(questions, text.questions.hiddenAgreement);
  }

  if (toneOfVoice.categories.includes('unclear_urgency') || hasRemarkCode(remarks, /urgency|deadline|asap/i)) {
    addUnique(questions, text.questions.urgency);
  }

  if (task.workItemType === 'bug' && hasSectionRemark(remarks, /шаги|steps|фактический|actual|reproduction/i)) {
    addUnique(questions, text.questions.reproduction);
  }

  if (
    toneOfVoice.categories.includes('blaming_tone') ||
    toneOfVoice.categories.includes('passive_aggressive') ||
    toneOfVoice.categories.includes('too_informal')
  ) {
    addUnique(questions, text.questions.tone);
  }

  return questions;
}

function buildNextActions(
  language: TemplateLanguage,
  questions: string[],
  remarks: Remark[],
  toneOfVoice: ToneAnalysisResult
): string[] {
  const text = TEXT[language];
  const actions: string[] = [];

  if (questions.length === 0 && remarks.length === 0 && toneOfVoice.riskLevel === 'low') {
    return [text.actions.keep];
  }

  if (questions.length > 0) {
    addUnique(actions, text.actions.answerQuestions);
    addUnique(actions, text.actions.pasteDraft);
  }

  if (hasRemarkCode(remarks, /vague|undefined|deferred|hidden|tbd|scope|quality|ux/i)) {
    addUnique(actions, text.actions.removeVague);
  }

  if (toneOfVoice.riskLevel !== 'low') {
    addUnique(actions, text.actions.neutralTone);
  }

  return actions.length > 0 ? actions : [text.actions.pasteDraft];
}

export function generateClarityFixSuggestions(params: {
  task: NormalizedTask;
  remarks: Remark[];
  clarityScore: ClarityScoreResult;
  toneOfVoice: ToneAnalysisResult;
}): ClarityFixSuggestions {
  const { task, remarks, clarityScore, toneOfVoice } = params;
  const text = TEXT[task.language];
  const questions = buildQuestions(params);
  const focus = buildFocus(task.language, questions);
  const baseRewrite = questions.length === 0 && remarks.length === 0 && toneOfVoice.riskLevel === 'low'
    ? text.placeholders.pmRewriteReady(task.title)
    : text.placeholders.pmRewriteNeedsWork(task.title, focus);
  const pmFriendlyRewrite = toneOfVoice.rewrittenText && toneOfVoice.riskLevel !== 'low'
    ? `${baseRewrite}\n\n${toneOfVoice.rewrittenText}`
    : baseRewrite;

  return {
    questions,
    draftMarkdown: buildDraftMarkdown(task, task.language),
    pmFriendlyRewrite,
    nextActions: buildNextActions(task.language, questions, remarks, toneOfVoice)
  };
}

export function formatClarityFixSuggestionsMarkdown(suggestions: ClarityFixSuggestions): string {
  const questions = suggestions.questions.length > 0
    ? suggestions.questions.map((question) => `- ${question}`)
    : ['- Открытых вопросов по ясности задачи не найдено.'];
  const nextActions = suggestions.nextActions.map((action) => `- ${action}`);

  return [
    '## Clarity Fix Suggestions',
    '',
    '### Questions to clarify',
    '',
    ...questions,
    '',
    '### Draft description block',
    '',
    '```markdown',
    suggestions.draftMarkdown,
    '```',
    '',
    '### PM-friendly rewrite',
    '',
    suggestions.pmFriendlyRewrite,
    '',
    '### Next actions',
    '',
    ...nextActions
  ].join('\n');
}
