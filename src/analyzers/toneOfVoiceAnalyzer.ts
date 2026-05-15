import { normalizeText } from '../utils';

import type {
  ToneAnalysisResult,
  ToneCategory,
  ToneProblematicPhrase,
  ToneRiskLevel
} from '../types/toneOfVoice';

interface PhraseRule {
  phrase: string;
  category: ToneCategory;
  explanation: string;
}

interface RegexRule extends PhraseRule {
  pattern: RegExp;
}

export const VAGUE_WORDING_PHRASES = [
  'сделать красиво',
  'сделать нормально',
  'поправить как надо',
  'доработать по мелочи',
  'починить всё',
  'сделать удобно',
  'привести в порядок',
  'разобраться с проблемой',
  'сделать как обсуждали',
  'внести правки',
  'подумать над решением',
  'сделать более современно'
];

export const BLAMING_TONE_PHRASES = [
  'опять всё сломалось',
  'почему это до сих пор не работает',
  'вы опять не проверили',
  'кто это вообще делал',
  'надо было сразу нормально сделать',
  'сколько можно чинить одно и то же',
  'это очевидный баг',
  'это же элементарно',
  'почему не предусмотрели',
  'как можно было это пропустить'
];

export const URGENCY_WITHOUT_REASON_PHRASES = [
  'срочно',
  'очень срочно',
  'надо было вчера',
  'asap',
  'горит',
  'сделать сегодня',
  'максимально быстро',
  'нужно прямо сейчас',
  'без этого всё стоит',
  'критично'
];

export const PASSIVE_AGGRESSIVE_PHRASES = [
  'было бы неплохо наконец-то это исправить',
  'давайте уже сделаем нормально',
  'кажется, это всё-таки нужно было проверить',
  'наверное, стоит прочитать задачу внимательнее',
  'может, в этот раз получится',
  'я думала, это очевидно',
  'видимо, опять не договорились',
  'ну раз уж так получилось',
  'надеюсь, теперь будет работать',
  'давайте без сюрпризов на этот раз'
];

export const TOO_INFORMAL_PHRASES = [
  'там что-то отвалилось',
  'какая-то фигня',
  'юзер тыкает и ничего',
  'всё едет',
  'кнопка странная',
  'экран кривой',
  'логика мутная',
  'флоу сломался',
  'там багуля',
  'что-то не то'
];

export const WEAK_ACTION_SIGNALS = [
  'проверить',
  'посмотреть',
  'разобраться',
  'поправить',
  'обновить',
  'переделать',
  'настроить'
];

export const EXPECTED_RESULT_MARKERS = [
  'должен',
  'должна',
  'должно',
  'ожидаемый результат',
  'критерии приемки',
  'критерии приёмки',
  'после',
  'в результате',
  'готово, если',
  'успешно',
  'пользователь видит',
  'статус меняется'
];

export const WEAK_CONTEXT_PHRASES = [
  'нужно добавить поле',
  'нужно поменять кнопку',
  'нужно убрать блок',
  'нужно переделать форму',
  'нужно поменять текст',
  'нужно добавить проверку',
  'нужно скрыть ошибку',
  'нужно изменить статус'
];

export const CONTEXT_MARKERS = [
  'потому что',
  'чтобы',
  'так как',
  'из-за',
  'пользователь',
  'клиент',
  'поддержка',
  'бизнес',
  'конверсия',
  'оплата',
  'возврат',
  'ошибка влияет',
  'блокирует'
];

const URGENCY_REASON_MARKERS = [
  'потому что',
  'так как',
  'из-за',
  'дедлайн',
  'релиз',
  'production',
  'prod',
  'блокирует',
  'ошибка влияет',
  'влияет на',
  'не могут завершить',
  'не может завершить'
];

const CATEGORY_EXPLANATIONS: Record<
Exclude<ToneCategory, 'constructive' | 'missing_expected_result' | 'missing_context'>,
string
> = {
  vague_wording: 'Фраза слишком общая: команда может по-разному понять ожидаемый результат.',
  blaming_tone: 'Фраза звучит обвинительно и не описывает техническую проблему спокойно.',
  unclear_urgency: 'Фраза задаёт срочность, но не объясняет причину, дедлайн или влияние задержки.',
  passive_aggressive: 'Формулировка может восприниматься как упрёк и отвлекает от сути задачи.',
  too_informal: 'Разговорная формулировка затрудняет передачу задачи между PM, разработкой и QA.'
};

const FLEXIBLE_VAGUE_RULES: RegexRule[] = [
  {
    phrase: 'сделать нормально',
    category: 'vague_wording',
    explanation: CATEGORY_EXPLANATIONS.vague_wording,
    pattern: /сдела(?:ть|йте|й|ем)\s+нормально/iu
  }
];

const ACTION_PATTERN =
  /(?:нужно|надо|требуется|просим|сдела(?:ть|йте)|давайте)\s+(?:проверить|посмотреть|разобраться|поправить|обновить|переделать|настроить|добавить|поменять|убрать|изменить|скрыть|исправить|восстановить)/iu;

function normalizeForSearch(value: string): string {
  return normalizeText(value)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findPhrase(text: string, phrase: string): string | null {
  const normalizedPhrase = normalizeForSearch(phrase);
  const pattern = escapeRegExp(normalizedPhrase).replace(/\s+/g, '\\s+');
  const regex = new RegExp(
    `(?<![\\p{L}\\p{N}_])${pattern}(?![\\p{L}\\p{N}_])`,
    'iu'
  );
  const match = text.match(regex);

  return match ? match[0] : null;
}

function hasAnyMarker(text: string, markers: string[]): boolean {
  return markers.some((marker) => findPhrase(text, marker) !== null);
}

function buildPhraseRules(
  phrases: string[],
  category: Exclude<ToneCategory, 'constructive' | 'missing_expected_result' | 'missing_context'>
): PhraseRule[] {
  return phrases.map((phrase) => ({
    phrase,
    category,
    explanation: CATEGORY_EXPLANATIONS[category]
  }));
}

function addCategory(categories: Set<ToneCategory>, category: ToneCategory): void {
  if (category !== 'constructive') {
    categories.add(category);
  }
}

function addProblematicPhrase(
  problematicPhrases: ToneProblematicPhrase[],
  phrase: string,
  category: ToneCategory,
  explanation: string
): void {
  const normalizedPhrase = normalizeForSearch(phrase);
  const exists = problematicPhrases.some((item) =>
    item.category === category && normalizeForSearch(item.phrase) === normalizedPhrase
  );

  if (!exists) {
    problematicPhrases.push({
      phrase: normalizeText(phrase),
      category,
      explanation
    });
  }
}

function collectDictionaryMatches(
  text: string,
  categories: Set<ToneCategory>,
  problematicPhrases: ToneProblematicPhrase[]
): void {
  const rules = [
    ...buildPhraseRules(VAGUE_WORDING_PHRASES, 'vague_wording'),
    ...buildPhraseRules(BLAMING_TONE_PHRASES, 'blaming_tone'),
    ...buildPhraseRules(PASSIVE_AGGRESSIVE_PHRASES, 'passive_aggressive'),
    ...buildPhraseRules(TOO_INFORMAL_PHRASES, 'too_informal')
  ];

  for (const rule of rules) {
    const match = findPhrase(text, rule.phrase);

    if (match) {
      addCategory(categories, rule.category);
      addProblematicPhrase(problematicPhrases, rule.phrase, rule.category, rule.explanation);
    }
  }

  for (const rule of FLEXIBLE_VAGUE_RULES) {
    const match = text.match(rule.pattern);

    if (match) {
      addCategory(categories, rule.category);
      addProblematicPhrase(problematicPhrases, match[0], rule.category, rule.explanation);
    }
  }
}

function collectUrgencyMatches(
  text: string,
  categories: Set<ToneCategory>,
  problematicPhrases: ToneProblematicPhrase[]
): void {
  if (hasAnyMarker(text, URGENCY_REASON_MARKERS)) {
    return;
  }

  for (const phrase of URGENCY_WITHOUT_REASON_PHRASES) {
    const match = findPhrase(text, phrase);

    if (match) {
      addCategory(categories, 'unclear_urgency');
      addProblematicPhrase(
        problematicPhrases,
        phrase,
        'unclear_urgency',
        CATEGORY_EXPLANATIONS.unclear_urgency
      );
    }
  }
}

function findExpectedResultActionSignal(text: string): string | null {
  for (const phrase of WEAK_CONTEXT_PHRASES) {
    const match = findPhrase(text, phrase);

    if (match) {
      return match;
    }
  }

  for (const signal of WEAK_ACTION_SIGNALS) {
    const match = findPhrase(text, signal);

    if (match) {
      return match;
    }
  }

  for (const phrase of TOO_INFORMAL_PHRASES) {
    const match = findPhrase(text, phrase);

    if (match) {
      return match;
    }
  }

  const actionMatch = text.match(ACTION_PATTERN);

  return actionMatch ? actionMatch[0] : null;
}

function collectMissingExpectedResult(
  text: string,
  categories: Set<ToneCategory>,
  problematicPhrases: ToneProblematicPhrase[]
): void {
  const actionSignal = findExpectedResultActionSignal(text);
  const hasExpectedResult = hasAnyMarker(text, EXPECTED_RESULT_MARKERS) || text.includes('успешн');

  if (!actionSignal || hasExpectedResult) {
    return;
  }

  addCategory(categories, 'missing_expected_result');
  addProblematicPhrase(
    problematicPhrases,
    actionSignal,
    'missing_expected_result',
    'В задаче есть действие, но не описано, какое состояние или поведение будет считаться успешным.'
  );
}

function collectMissingContext(
  text: string,
  categories: Set<ToneCategory>,
  problematicPhrases: ToneProblematicPhrase[]
): void {
  if (hasAnyMarker(text, CONTEXT_MARKERS)) {
    return;
  }

  const weakContextPhrase = WEAK_CONTEXT_PHRASES
    .map((phrase) => findPhrase(text, phrase))
    .find((match): match is string => Boolean(match));

  if (!weakContextPhrase) {
    return;
  }

  addCategory(categories, 'missing_context');
  addProblematicPhrase(
    problematicPhrases,
    weakContextPhrase,
    'missing_context',
    'Формулировка просит изменить интерфейс или поведение, но не объясняет, зачем это нужно пользователю или бизнесу.'
  );
}

function getRiskLevel(categories: ToneCategory[]): ToneRiskLevel {
  const problemCategories = categories.filter((category) => category !== 'constructive');
  const hasBlamingOrPassive =
    problemCategories.includes('blaming_tone') || problemCategories.includes('passive_aggressive');
  const hasVagueOrUrgency =
    problemCategories.includes('vague_wording') || problemCategories.includes('unclear_urgency');

  if (problemCategories.length === 0) {
    return 'low';
  }

  if ((hasBlamingOrPassive && hasVagueOrUrgency) || problemCategories.length >= 4) {
    return 'high';
  }

  if (
    problemCategories.length >= 2 ||
    problemCategories.includes('unclear_urgency') ||
    problemCategories.includes('missing_expected_result') ||
    hasBlamingOrPassive
  ) {
    return 'medium';
  }

  return 'low';
}

function getTone(categories: ToneCategory[]): string {
  const problemCategories = categories.filter((category) => category !== 'constructive');

  if (problemCategories.length === 0) {
    return 'constructive';
  }

  if (
    problemCategories.includes('blaming_tone') ||
    problemCategories.includes('unclear_urgency') ||
    problemCategories.includes('passive_aggressive')
  ) {
    return 'tense';
  }

  if (
    problemCategories.includes('too_informal') &&
    problemCategories.every((category) =>
      category === 'too_informal' || category === 'missing_expected_result' || category === 'missing_context'
    )
  ) {
    return 'informal';
  }

  if (
    problemCategories.every((category) =>
      category === 'vague_wording' ||
      category === 'missing_expected_result' ||
      category === 'missing_context'
    )
  ) {
    return 'unclear';
  }

  if (problemCategories.length > 1) {
    return 'mixed';
  }

  return problemCategories.includes('too_informal') ? 'informal' : 'mixed';
}

function getRecommendation(categories: ToneCategory[]): string {
  const problemCategories = categories.filter((category) => category !== 'constructive');

  if (problemCategories.length === 0) {
    return 'Сохранить текущий стиль: задача описывает проблему, влияние и ожидаемый результат достаточно спокойно и понятно.';
  }

  if (
    problemCategories.includes('blaming_tone') ||
    problemCategories.includes('passive_aggressive') ||
    problemCategories.includes('unclear_urgency')
  ) {
    return 'Переписать задачу через проблему, влияние, ожидаемый результат и критерии приёмки, без оценки действий участников.';
  }

  if (problemCategories.includes('too_informal')) {
    return 'Заменить разговорные формулировки на наблюдаемое поведение продукта, влияние на пользователя и проверяемый результат.';
  }

  return 'Добавить бизнес-контекст, ожидаемый результат и проверяемые критерии, чтобы PM, разработчик и QA читали задачу одинаково.';
}

function buildRewrite(text: string, categories: ToneCategory[]): string {
  const normalizedText = normalizeText(text);
  const problemCategories = categories.filter((category) => category !== 'constructive');

  if (problemCategories.length === 0) {
    return normalizedText;
  }

  if (problemCategories.includes('blaming_tone') || problemCategories.includes('unclear_urgency')) {
    return 'Пользователи сообщают о проблеме в сценарии. Нужно проверить причину сбоя, описать влияние и восстановить ожидаемое поведение. Приоритет высокий, если проблема блокирует ключевой пользовательский сценарий.';
  }

  if (problemCategories.includes('passive_aggressive')) {
    return 'В задаче есть сценарий, который требует проверки и исправления. Нужно описать текущее поведение, ожидаемый результат, влияние на пользователя и критерии приёмки.';
  }

  if (problemCategories.includes('missing_context')) {
    return 'Нужно изменить элемент в указанном сценарии. Опишите, где находится элемент, почему требуется изменение и какой результат должен увидеть пользователь после обновления.';
  }

  if (problemCategories.includes('too_informal')) {
    return 'В указанном сценарии пользователь сталкивается с некорректным поведением. Нужно описать шаги, фактический результат, ожидаемое поведение и влияние проблемы на завершение сценария.';
  }

  return 'Нужно уточнить задачу: описать текущий сценарий, причину изменения, ожидаемый результат и критерии приёмки.';
}

export function analyzeToneOfVoice(text: string): ToneAnalysisResult {
  const normalizedText = normalizeForSearch(text);
  const categories = new Set<ToneCategory>();
  const problematicPhrases: ToneProblematicPhrase[] = [];

  collectDictionaryMatches(normalizedText, categories, problematicPhrases);
  collectUrgencyMatches(normalizedText, categories, problematicPhrases);
  collectMissingExpectedResult(normalizedText, categories, problematicPhrases);
  collectMissingContext(normalizedText, categories, problematicPhrases);

  const categoryList = categories.size > 0
    ? Array.from(categories)
    : ['constructive' as const];

  return {
    tone: getTone(categoryList),
    riskLevel: getRiskLevel(categoryList),
    categories: categoryList,
    problematicPhrases,
    recommendation: getRecommendation(categoryList),
    rewrittenText: buildRewrite(text, categoryList)
  };
}
