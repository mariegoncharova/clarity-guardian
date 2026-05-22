import {
  SMART_VAGUE_PHRASE_DEFINITIONS,
  TASK_POSITIVE_SIGNAL_PATTERNS
} from '../dictionaries/taskQualityDictionary';

import type {
  SmartCriterionKey,
  SmartSignalPattern,
  SmartVaguePhrase
} from './smartTypes';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function phrasePattern(phrase: string): RegExp {
  const pattern = escapeRegExp(phrase).replace(/\s+/g, '\\s+');

  return new RegExp(`(?<![\\p{L}\\p{N}_])${pattern}(?![\\p{L}\\p{N}_])`, 'iu');
}

export const SMART_CRITERION_TITLES: Record<SmartCriterionKey, string> = {
  specific: 'S - Конкретность',
  measurable: 'M - Измеримость',
  achievable: 'A - Достижимость',
  relevant: 'R - Актуальность',
  timeBound: 'T - Ограниченность во времени'
};

export const SMART_BAD_SIGNALS: {
  vaguePhrases: SmartVaguePhrase[];
  broadScope: SmartSignalPattern[];
} = {
  vaguePhrases: SMART_VAGUE_PHRASE_DEFINITIONS.map((item) => ({
    ...item,
    pattern: phrasePattern(item.phrase)
  })),
  broadScope: [
    { label: 'слишком широкий scope: вся система или весь продукт', pattern: /\b(весь продукт|вся система|everything|whole product|entire system)\b/iu },
    { label: 'слишком широкий scope: везде или всё сразу', pattern: /(?<![\p{L}\p{N}_])(везде|всё|все сценарии|любой сценарий|all scenarios|everywhere)(?![\p{L}\p{N}_])/iu },
    { label: 'слишком широкий scope: переделать без границ', pattern: /(?<![\p{L}\p{N}_])(переделать|переписать|рефакторить|refactor|rewrite)(?![\p{L}\p{N}_])/iu }
  ]
};

export const SMART_GOOD_SIGNALS: {
  objects: SmartSignalPattern[];
  actions: SmartSignalPattern[];
  expectedResults: SmartSignalPattern[];
  acceptanceCriteria: SmartSignalPattern[];
  metrics: SmartSignalPattern[];
  verifiableConditions: SmartSignalPattern[];
  examples: SmartSignalPattern[];
  constraints: SmartSignalPattern[];
  resources: SmartSignalPattern[];
  relevanceContext: SmartSignalPattern[];
  userOrTeamValue: SmartSignalPattern[];
  projectGoal: SmartSignalPattern[];
  priorityReason: SmartSignalPattern[];
  deadlines: SmartSignalPattern[];
  sprintsOrReleases: SmartSignalPattern[];
  timeframes: SmartSignalPattern[];
} = {
  objects: [
    ...TASK_POSITIVE_SIGNAL_PATTERNS.objects
  ],
  actions: [
    ...TASK_POSITIVE_SIGNAL_PATTERNS.actions,
    { label: 'есть конкретное действие', pattern: /(?<![\p{L}\p{N}_])(добавить|исправить|показать|обновить|настроить|удалить|отправить|сохранить|логировать|проверить|закрыть|снизить|покрыть|оптимизировать|ускорить|улучшить|доработать|add|fix|show|update|configure|remove|send|save|log|verify|reduce|cover|optimize|improve|speed up)(?![\p{L}\p{N}_])/iu }
  ],
  expectedResults: [
    ...TASK_POSITIVE_SIGNAL_PATTERNS.expectedResults
  ],
  acceptanceCriteria: [
    ...TASK_POSITIVE_SIGNAL_PATTERNS.acceptanceCriteria
  ],
  metrics: [
    ...TASK_POSITIVE_SIGNAL_PATTERNS.metrics
  ],
  verifiableConditions: [
    ...TASK_POSITIVE_SIGNAL_PATTERNS.verifiableConditions
  ],
  examples: [
    ...TASK_POSITIVE_SIGNAL_PATTERNS.examples
  ],
  constraints: [
    ...TASK_POSITIVE_SIGNAL_PATTERNS.constraints
  ],
  resources: [
    ...TASK_POSITIVE_SIGNAL_PATTERNS.resources
  ],
  relevanceContext: [
    ...TASK_POSITIVE_SIGNAL_PATTERNS.relevanceContext
  ],
  userOrTeamValue: [
    ...TASK_POSITIVE_SIGNAL_PATTERNS.userOrTeamValue
  ],
  projectGoal: [
    ...TASK_POSITIVE_SIGNAL_PATTERNS.projectGoal
  ],
  priorityReason: [
    ...TASK_POSITIVE_SIGNAL_PATTERNS.priorityReason
  ],
  deadlines: [
    ...TASK_POSITIVE_SIGNAL_PATTERNS.deadlines
  ],
  sprintsOrReleases: [
    ...TASK_POSITIVE_SIGNAL_PATTERNS.sprintsOrReleases
  ],
  timeframes: [
    ...TASK_POSITIVE_SIGNAL_PATTERNS.timeframes
  ]
};
