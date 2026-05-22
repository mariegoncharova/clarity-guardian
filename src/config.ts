import fs from 'node:fs';
import path from 'node:path';

import {
  DEFAULT_BAD_FORMULATIONS,
  DEFAULT_STOP_PHRASES
} from './dictionaries/taskQualityDictionary';
import { normalizeText } from './utils';

import type {
  BadFormulationRuleConfig,
  ClarityGuardianConfig,
  ClarityMode,
  ConfigLanguage,
  ResolvedConfig,
  ResolvedClarityScoreThresholds,
  ResolvedClarityScoreWeights,
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
    task: [],
    research: [],
    tech_debt: []
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
    task: [],
    research: [],
    tech_debt: []
  }
};

const DEFAULT_CONFIG: ResolvedConfig = {
  language: 'auto',
  mode: 'strict',
  updateDescription: true,
  rules: {
    common: {},
    bug: {},
    task: {},
    story: {},
    research: {},
    tech_debt: {}
  },
  stopPhrases: [],
  badFormulations: [],
  scoring: {
    weights: {
      errorRemark: 20,
      warningRemark: 7,
      missingContext: 20,
      missingExpectedResult: 20,
      missingAcceptanceCriteria: 20,
      hiddenAgreement: 10,
      missingUserScenario: 10,
      qaUncertainty: 10,
      implementationWithoutGoal: 10
    },
    thresholds: {
      good: 80,
      medium: 50
    }
  },
  riskThresholds: {
    lowMax: 30,
    mediumMax: 65
  },
  analytics: {
    ignoredLabels: [],
    ignoredStatuses: []
  },
  reports: {
    defaultFormat: 'markdown'
  }
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

function resolveScoreWeights(config: ClarityGuardianConfig): ResolvedClarityScoreWeights {
  const weights = config.scoring?.weights || {};

  return {
    errorRemark: weights.errorRemark ?? DEFAULT_CONFIG.scoring.weights.errorRemark,
    warningRemark: weights.warningRemark ?? DEFAULT_CONFIG.scoring.weights.warningRemark,
    missingContext: weights.missingContext ?? DEFAULT_CONFIG.scoring.weights.missingContext,
    missingExpectedResult: weights.missingExpectedResult ?? DEFAULT_CONFIG.scoring.weights.missingExpectedResult,
    missingAcceptanceCriteria: weights.missingAcceptanceCriteria ?? DEFAULT_CONFIG.scoring.weights.missingAcceptanceCriteria,
    hiddenAgreement: weights.hiddenAgreement ?? DEFAULT_CONFIG.scoring.weights.hiddenAgreement,
    missingUserScenario: weights.missingUserScenario ?? DEFAULT_CONFIG.scoring.weights.missingUserScenario,
    qaUncertainty: weights.qaUncertainty ?? DEFAULT_CONFIG.scoring.weights.qaUncertainty,
    implementationWithoutGoal: weights.implementationWithoutGoal ?? DEFAULT_CONFIG.scoring.weights.implementationWithoutGoal
  };
}

function resolveScoreThresholds(config: ClarityGuardianConfig): ResolvedClarityScoreThresholds {
  const configured = config.scoring?.thresholds || {};
  const thresholds = {
    good: configured.good ?? DEFAULT_CONFIG.scoring.thresholds.good,
    medium: configured.medium ?? DEFAULT_CONFIG.scoring.thresholds.medium
  };

  return thresholds.good >= thresholds.medium
    ? thresholds
    : DEFAULT_CONFIG.scoring.thresholds;
}

function resolveReportFormat(config: ClarityGuardianConfig): ResolvedConfig['reports']['defaultFormat'] {
  const format = config.reports?.defaultFormat;

  if (format === 'markdown' || format === 'json' || format === 'csv') {
    return format;
  }

  return DEFAULT_CONFIG.reports.defaultFormat;
}

function normalizeRuleKeyParts(values: string[] | undefined): string {
  return (values || []).map((value) => normalizeText(value).toLowerCase()).sort().join('|');
}

function stopPhraseRuleKey(rule: StopPhraseRuleConfig): string {
  return [
    normalizeText(rule.phrase).toLowerCase(),
    normalizeRuleKeyParts(rule.languages),
    normalizeRuleKeyParts(rule.workItemTypes),
    normalizeText(rule.code).toLowerCase()
  ].join('::');
}

function badFormulationRuleKey(rule: BadFormulationRuleConfig): string {
  return [
    normalizeText(rule.phrase).toLowerCase(),
    rule.category,
    normalizeRuleKeyParts(rule.languages),
    normalizeRuleKeyParts(rule.workItemTypes)
  ].join('::');
}

function mergeStopPhrases(...groups: StopPhraseRuleConfig[][]): StopPhraseRuleConfig[] {
  const seen = new Set<string>();
  const result: StopPhraseRuleConfig[] = [];

  for (const rule of groups.flat()) {
    const key = stopPhraseRuleKey(rule);

    if (!key.startsWith('::') && !seen.has(key)) {
      seen.add(key);
      result.push(rule);
    }
  }

  return result;
}

function mergeBadFormulations(...groups: BadFormulationRuleConfig[][]): BadFormulationRuleConfig[] {
  const seen = new Set<string>();
  const result: BadFormulationRuleConfig[] = [];

  for (const rule of groups.flat()) {
    const key = badFormulationRuleKey(rule);

    if (!key.startsWith('::') && !seen.has(key)) {
      seen.add(key);
      result.push(rule);
    }
  }

  return result;
}

export function loadConfig(configPath?: string): ResolvedConfig {
  const config = readConfig(configPath);
  const rules = {
    common: config.rules?.common || {},
    bug: config.rules?.bug || {},
    task: config.rules?.task || {},
    story: config.rules?.story || {},
    research: config.rules?.research || {},
    tech_debt: config.rules?.tech_debt || {}
  };

  return {
    language: resolveLanguage(config),
    mode: resolveMode(config),
    updateDescription: resolveUpdateDescription(config),
    rules,
    stopPhrases: mergeStopPhrases(
      DEFAULT_STOP_PHRASES,
      config.stopPhrases || [],
      config.rules?.common?.stopPhrases || [],
      config.rules?.bug?.stopPhrases || [],
      config.rules?.task?.stopPhrases || [],
      config.rules?.story?.stopPhrases || [],
      config.rules?.research?.stopPhrases || [],
      config.rules?.tech_debt?.stopPhrases || []
    ),
    badFormulations: mergeBadFormulations(DEFAULT_BAD_FORMULATIONS, config.badFormulations || []),
    scoring: {
      weights: resolveScoreWeights(config),
      thresholds: resolveScoreThresholds(config)
    },
    riskThresholds: {
      ...DEFAULT_CONFIG.riskThresholds,
      ...(config.riskThresholds || {})
    },
    analytics: {
      ignoredLabels: config.analytics?.ignoredLabels || [],
      ignoredStatuses: config.analytics?.ignoredStatuses || []
    },
    reports: {
      defaultFormat: resolveReportFormat(config)
    }
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

  const cyrillicChars = text.match(/\p{Script=Cyrillic}/gu)?.length || 0;
  const latinChars = text.match(/[a-z]/g)?.length || 0;

  if (latinChars > 0 && cyrillicChars === 0) {
    return 'en';
  }

  return 'ru';
}

export function detectWorkItemType(task: TaskPayload): WorkItemType {
  if (
    task.workItemType === 'bug' ||
    task.workItemType === 'task' ||
    task.workItemType === 'story' ||
    task.workItemType === 'research' ||
    task.workItemType === 'tech_debt'
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

  if (/\b(research|исследование|ресерч)\b/.test(text)) {
    return 'research';
  }

  if (/\b(tech debt|tech_debt|technical debt|техдолг)\b/.test(text)) {
    return 'tech_debt';
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
