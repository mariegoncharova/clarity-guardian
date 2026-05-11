import fs from 'node:fs';
import path from 'node:path';

import { normalizeText } from './utils';

import type {
  ClarityGuardianConfig,
  ClarityMode,
  ConfigLanguage,
  ResolvedConfig,
  RuleSetConfig,
  SectionRuleConfig,
  StopPhraseRuleConfig,
  TaskPayload,
  TemplateLanguage,
  WorkItemType
} from './types';

const DEFAULT_MIN_SECTION_NON_WHITESPACE_CHARS = 20;

const COMMON_REQUIRED_SECTIONS: Record<TemplateLanguage, SectionRuleConfig[]> = {
  ru: [
    {
      section: 'Контекст',
      minNonWhitespaceChars: DEFAULT_MIN_SECTION_NON_WHITESPACE_CHARS
    },
    {
      section: 'Ожидаемый результат',
      minNonWhitespaceChars: DEFAULT_MIN_SECTION_NON_WHITESPACE_CHARS
    },
    {
      section: 'Критерии приёмки',
      aliases: ['Критерии приемки'],
      minNonWhitespaceChars: DEFAULT_MIN_SECTION_NON_WHITESPACE_CHARS
    }
  ],
  en: [
    {
      section: 'Context',
      minNonWhitespaceChars: DEFAULT_MIN_SECTION_NON_WHITESPACE_CHARS
    },
    {
      section: 'Expected result',
      aliases: ['Expected outcome'],
      minNonWhitespaceChars: DEFAULT_MIN_SECTION_NON_WHITESPACE_CHARS
    },
    {
      section: 'Acceptance criteria',
      aliases: ['Acceptance Criteria'],
      minNonWhitespaceChars: DEFAULT_MIN_SECTION_NON_WHITESPACE_CHARS
    }
  ]
};

const TYPE_REQUIRED_SECTIONS: Record<
TemplateLanguage,
Record<WorkItemType, SectionRuleConfig[]>
> = {
  ru: {
    bug: [
      {
        section: 'Шаги воспроизведения',
        aliases: ['Как воспроизвести'],
        minNonWhitespaceChars: DEFAULT_MIN_SECTION_NON_WHITESPACE_CHARS
      },
      {
        section: 'Фактический результат',
        minNonWhitespaceChars: DEFAULT_MIN_SECTION_NON_WHITESPACE_CHARS
      }
    ],
    story: [
      {
        section: 'Пользовательская история',
        aliases: ['User story'],
        minNonWhitespaceChars: DEFAULT_MIN_SECTION_NON_WHITESPACE_CHARS
      }
    ],
    task: []
  },
  en: {
    bug: [
      {
        section: 'Steps to reproduce',
        aliases: ['Reproduction steps'],
        minNonWhitespaceChars: DEFAULT_MIN_SECTION_NON_WHITESPACE_CHARS
      },
      {
        section: 'Actual result',
        aliases: ['Actual outcome'],
        minNonWhitespaceChars: DEFAULT_MIN_SECTION_NON_WHITESPACE_CHARS
      }
    ],
    story: [
      {
        section: 'User story',
        minNonWhitespaceChars: DEFAULT_MIN_SECTION_NON_WHITESPACE_CHARS
      }
    ],
    task: []
  }
};

const DEFAULT_STOP_PHRASES: StopPhraseRuleConfig[] = [
  {
    phrase: 'сделать красиво',
    level: 'warning',
    code: 'vague_phrase',
    message: 'Фраза «сделать красиво» слишком субъективна. Лучше описать конкретные признаки результата.',
    languages: ['ru']
  },
  {
    phrase: 'как обсуждали',
    level: 'warning',
    code: 'hidden_context',
    message: 'Фраза «как обсуждали» прячет важный контекст. Добавь краткое резюме договорённостей прямо в задачу.',
    languages: ['ru']
  },
  {
    phrase: 'как в прошлый раз',
    level: 'warning',
    code: 'hidden_reference',
    message: 'Фраза «как в прошлый раз» может быть понята по-разному. Добавь ссылку или явно опиши нужное поведение.',
    languages: ['ru']
  },
  {
    phrase: 'срочно',
    level: 'warning',
    code: 'urgency_without_reason',
    message: 'Фраза «срочно» не объясняет приоритет. Лучше указать дедлайн, причину срочности и последствия задержки.',
    languages: ['ru']
  },
  {
    phrase: 'пофиксить',
    level: 'warning',
    code: 'vague_fix',
    message: 'Фраза «пофиксить» слишком общая. Опиши текущее поведение, ожидаемое поведение и критерии проверки.',
    languages: ['ru']
  },
  {
    phrase: 'make it nice',
    level: 'warning',
    code: 'vague_phrase',
    message: 'The phrase "make it nice" is subjective. Describe the exact visible or behavioral outcome instead.',
    languages: ['en']
  },
  {
    phrase: 'as discussed',
    level: 'warning',
    code: 'hidden_context',
    message: 'The phrase "as discussed" hides important context. Add a short summary of the decision to the task.',
    languages: ['en']
  },
  {
    phrase: 'same as last time',
    level: 'warning',
    code: 'hidden_reference',
    message: 'The phrase "same as last time" can be interpreted differently. Add a link or describe the behavior explicitly.',
    languages: ['en']
  },
  {
    phrase: 'urgent',
    level: 'warning',
    code: 'urgency_without_reason',
    message: 'The word "urgent" does not explain priority. Add a deadline, reason, and impact of delay.',
    languages: ['en']
  },
  {
    phrase: 'fix it',
    level: 'warning',
    code: 'vague_fix',
    message: 'The phrase "fix it" is too broad. Describe the current behavior, expected behavior, and verification criteria.',
    languages: ['en']
  }
];

const DEFAULT_CONFIG: ResolvedConfig = {
  language: 'auto',
  mode: 'strict',
  updateDescription: true,
  rules: {
    common: {},
    bug: {},
    task: {},
    story: {}
  },
  stopPhrases: []
};

function readConfig(configPath?: string): ClarityGuardianConfig {
  const selectedPath = configPath || process.env.CLARITY_GUARDIAN_CONFIG || 'clarity-guardian.config.json';
  const absolutePath = path.resolve(process.cwd(), selectedPath);

  if (!fs.existsSync(absolutePath)) {
    return {};
  }

  return JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as ClarityGuardianConfig;
}

function resolveMode(config: ClarityGuardianConfig): ClarityMode {
  const envMode = process.env.CLARITY_GUARDIAN_MODE;

  if (envMode === 'strict' || envMode === 'non-strict') {
    return envMode;
  }

  if (config.mode === 'strict' || config.mode === 'non-strict') {
    return config.mode;
  }

  if (typeof config.strict === 'boolean') {
    return config.strict ? 'strict' : 'non-strict';
  }

  return DEFAULT_CONFIG.mode;
}

function resolveLanguage(config: ClarityGuardianConfig): ConfigLanguage {
  const envLanguage = process.env.CLARITY_GUARDIAN_LANGUAGE;

  if (envLanguage === 'ru' || envLanguage === 'en' || envLanguage === 'auto') {
    return envLanguage;
  }

  if (config.language === 'ru' || config.language === 'en' || config.language === 'auto') {
    return config.language;
  }

  return DEFAULT_CONFIG.language;
}

function resolveUpdateDescription(config: ClarityGuardianConfig): boolean {
  const envValue = process.env.CLARITY_GUARDIAN_UPDATE_DESCRIPTION;

  if (envValue) {
    return ['1', 'true', 'yes', 'on'].includes(envValue.toLowerCase());
  }

  if (typeof config.updateDescription === 'boolean') {
    return config.updateDescription;
  }

  return DEFAULT_CONFIG.updateDescription;
}

export function loadConfig(configPath?: string): ResolvedConfig {
  const config = readConfig(configPath);
  const rules = {
    common: config.rules?.common || {},
    bug: config.rules?.bug || {},
    task: config.rules?.task || {},
    story: config.rules?.story || {}
  };

  return {
    language: resolveLanguage(config),
    mode: resolveMode(config),
    updateDescription: resolveUpdateDescription(config),
    rules,
    stopPhrases: [
      ...DEFAULT_STOP_PHRASES,
      ...(config.stopPhrases || []),
      ...(config.rules?.common?.stopPhrases || []),
      ...(config.rules?.bug?.stopPhrases || []),
      ...(config.rules?.task?.stopPhrases || []),
      ...(config.rules?.story?.stopPhrases || [])
    ]
  };
}

export function detectLanguage(task: TaskPayload, config: ResolvedConfig): TemplateLanguage {
  if (task.language === 'ru' || task.language === 'en') {
    return task.language;
  }

  if (config.language === 'ru' || config.language === 'en') {
    return config.language;
  }

  const text = normalizeText(`${task.title || ''}\n${task.body || ''}`).toLowerCase();
  const englishSignals = [
    '## context',
    '## expected result',
    '## expected outcome',
    '## acceptance criteria',
    '## steps to reproduce',
    '## actual result',
    'user story'
  ];

  if (englishSignals.some((signal) => text.includes(signal))) {
    return 'en';
  }

  return 'ru';
}

export function detectWorkItemType(task: TaskPayload): WorkItemType {
  if (
    task.workItemType === 'bug' ||
    task.workItemType === 'task' ||
    task.workItemType === 'story'
  ) {
    return task.workItemType;
  }

  const labels = (task.labels || []).map((label) => normalizeText(label).toLowerCase());
  const title = normalizeText(task.title).toLowerCase();
  const text = `${title} ${labels.join(' ')}`;

  if (/\b(bug|defect|ошибка|баг)\b/.test(text)) {
    return 'bug';
  }

  if (/\b(story|user story|стори|история)\b/.test(text)) {
    return 'story';
  }

  return 'task';
}

function matchesLanguage(
  rule: SectionRuleConfig | StopPhraseRuleConfig,
  language: TemplateLanguage
): boolean {
  return !rule.languages || rule.languages.length === 0 || rule.languages.includes(language);
}

function matchesWorkItemType(
  rule: SectionRuleConfig | StopPhraseRuleConfig,
  workItemType: WorkItemType
): boolean {
  return !rule.workItemTypes || rule.workItemTypes.length === 0 || rule.workItemTypes.includes(workItemType);
}

function normalizeRuleSet(ruleSet: RuleSetConfig | undefined): RuleSetConfig {
  return ruleSet || {};
}

export function getRequiredSections(
  config: ResolvedConfig,
  language: TemplateLanguage,
  workItemType: WorkItemType
): SectionRuleConfig[] {
  const configuredCommon = normalizeRuleSet(config.rules.common).requiredSections || [];
  const configuredType = normalizeRuleSet(config.rules[workItemType]).requiredSections || [];
  const rules = [
    ...COMMON_REQUIRED_SECTIONS[language],
    ...TYPE_REQUIRED_SECTIONS[language][workItemType],
    ...configuredCommon,
    ...configuredType
  ];

  return rules.filter((rule) =>
    matchesLanguage(rule, language) && matchesWorkItemType(rule, workItemType)
  );
}

export function getStopPhrases(
  config: ResolvedConfig,
  language: TemplateLanguage,
  workItemType: WorkItemType
): StopPhraseRuleConfig[] {
  return config.stopPhrases.filter((rule) =>
    matchesLanguage(rule, language) && matchesWorkItemType(rule, workItemType)
  );
}

export function applyModeToLevel(
  level: 'error' | 'warning',
  mode: ClarityMode
): 'error' | 'warning' {
  if (mode === 'non-strict' && level === 'error') {
    return 'warning';
  }

  return level;
}
