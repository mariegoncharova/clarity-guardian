import {
  normalizeText
} from '../utils';

export type RiskPhraseGroup =
  | 'subjective_quality'
  | 'hidden_reference'
  | 'urgency'
  | 'generic_fix'
  | 'generic_improvement';

export interface RiskPhraseRule {
  phrase: string;
  group: RiskPhraseGroup;
  language: 'ru' | 'en';
}

export interface RiskPhraseMatch extends RiskPhraseRule {
  index: number;
}

export const RISK_VAGUE_PHRASES: RiskPhraseRule[] = [
  { phrase: 'сделать красиво', group: 'subjective_quality', language: 'ru' },
  { phrase: 'сделать нормально', group: 'subjective_quality', language: 'ru' },
  { phrase: 'как раньше', group: 'hidden_reference', language: 'ru' },
  { phrase: 'как было', group: 'hidden_reference', language: 'ru' },
  { phrase: 'как обсуждали', group: 'hidden_reference', language: 'ru' },
  { phrase: 'срочно', group: 'urgency', language: 'ru' },
  { phrase: 'побыстрее', group: 'urgency', language: 'ru' },
  { phrase: 'просто поправить', group: 'generic_fix', language: 'ru' },
  { phrase: 'пофиксить', group: 'generic_fix', language: 'ru' },
  { phrase: 'починить', group: 'generic_fix', language: 'ru' },
  { phrase: 'не работает', group: 'generic_fix', language: 'ru' },
  { phrase: 'улучшить', group: 'generic_improvement', language: 'ru' },
  { phrase: 'оптимизировать', group: 'generic_improvement', language: 'ru' },
  { phrase: 'доработать', group: 'generic_improvement', language: 'ru' },
  { phrase: 'что-то сломалось', group: 'generic_fix', language: 'ru' },
  { phrase: 'надо посмотреть', group: 'generic_fix', language: 'ru' },
  { phrase: 'разобраться', group: 'generic_fix', language: 'ru' },
  { phrase: 'make it better', group: 'subjective_quality', language: 'en' },
  { phrase: 'as before', group: 'hidden_reference', language: 'en' },
  { phrase: 'as discussed', group: 'hidden_reference', language: 'en' },
  { phrase: 'urgent', group: 'urgency', language: 'en' },
  { phrase: 'asap', group: 'urgency', language: 'en' },
  { phrase: 'just fix', group: 'generic_fix', language: 'en' },
  { phrase: 'fix it', group: 'generic_fix', language: 'en' },
  { phrase: "doesn't work", group: 'generic_fix', language: 'en' },
  { phrase: 'not working', group: 'generic_fix', language: 'en' },
  { phrase: 'improve', group: 'generic_improvement', language: 'en' },
  { phrase: 'optimize', group: 'generic_improvement', language: 'en' },
  { phrase: 'check it', group: 'generic_fix', language: 'en' },
  { phrase: 'something is broken', group: 'generic_fix', language: 'en' },
  { phrase: 'take a look', group: 'generic_fix', language: 'en' }
];

export const RISKY_DOMAIN_KEYWORDS = [
  'payment',
  'refund',
  'billing',
  'оплата',
  'платёж',
  'платеж',
  'возврат',
  'деньги',
  'карта',
  'авторизация',
  'регистрация',
  'персональные данные',
  'доступы',
  'безопасность',
  'security',
  'production',
  'prod',
  'релиз'
];

export const EXTERNAL_DEPENDENCY_KEYWORDS = [
  'blocked',
  'блокер',
  'зависимость',
  'ждём',
  'ждем',
  'ожидаем',
  'нет ответа',
  'external',
  'third-party',
  'api партнёра',
  'api партнера',
  'интеграция с внешней системой'
];

export const LARGE_SCOPE_KEYWORDS = [
  'много сценариев',
  'несколько сценариев',
  'несколько сервисов',
  'весь флоу',
  'полностью переделать',
  'рефакторинг',
  'миграция',
  'затрагивает несколько команд',
  'слишком широкая задача',
  'декомпозировать',
  'end-to-end',
  'e2e'
];

const EVIDENCE_KEYWORDS = [
  'figma',
  'макет',
  'скриншот',
  'screenshot',
  'пример',
  'example',
  'лог',
  'logs',
  'payload',
  'dataset',
  'test data',
  'тестовые данные',
  'исходные данные',
  'input data',
  'source data',
  'staging',
  'дашборд',
  'dashboard'
];

const EDGE_CASE_KEYWORDS = [
  'edge case',
  'edge cases',
  'corner case',
  'boundary',
  'гранич',
  'погранич',
  'негатив',
  'negative scenario',
  'error case',
  'при ошибке',
  'ошибка банка',
  'таймаут',
  'timeout',
  'empty',
  'пуст',
  'null',
  'fallback',
  'retry',
  'повтор',
  'роль',
  'roles',
  'права',
  'permissions'
];

const URGENCY_REASON_KEYWORDS = [
  'потому что',
  'из-за',
  'причина',
  'дедлайн',
  'до ',
  'релиз',
  'инцидент',
  'блокирует',
  'sla',
  'production',
  'prod',
  'customer',
  'because',
  'reason',
  'deadline',
  'release',
  'incident',
  'blocks',
  'blocked'
];

const TESTABLE_OUTCOME_KEYWORDS = [
  'показывается',
  'отображается',
  'видит',
  'получает',
  'переходит',
  'сохраняет',
  'отправляется',
  'возвращает',
  'статус',
  'код',
  'событие',
  'логируется',
  'visible',
  'shown',
  'returns',
  'receives',
  'status',
  'event',
  'saved',
  'logged',
  'redirects',
  'opens'
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsPhrase(text: string, phrase: string): number {
  const normalizedText = normalizeText(text).toLowerCase();
  const normalizedPhrase = normalizeText(phrase).toLowerCase();

  if (!normalizedPhrase) {
    return -1;
  }

  const regex = new RegExp(
    `(?<![\\p{L}\\p{N}_])${escapeRegExp(normalizedPhrase)}(?![\\p{L}\\p{N}_])`,
    'iu'
  );
  const match = normalizedText.match(regex);

  return match && match.index !== undefined ? match.index : -1;
}

export function findRiskPhrases(text: string): RiskPhraseMatch[] {
  return RISK_VAGUE_PHRASES
    .map((rule) => ({
      ...rule,
      index: containsPhrase(text, rule.phrase)
    }))
    .filter((match) => match.index >= 0);
}

export function findKeywordMatches(text: string, keywords: string[]): string[] {
  return keywords.filter((keyword) => containsPhrase(text, keyword) >= 0);
}

export function hasEvidenceAsset(text: string): boolean {
  const normalized = normalizeText(text).toLowerCase();

  return /https?:\/\/\S+|\[[^\]]+\]\([^)]+\)|```/.test(normalized) ||
    EVIDENCE_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

export function hasEdgeCaseCoverage(text: string): boolean {
  const normalized = normalizeText(text).toLowerCase();

  return EDGE_CASE_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

export function hasUrgencyReason(text: string): boolean {
  const normalized = normalizeText(text).toLowerCase();

  return /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\.\d{1,2}\b/.test(normalized) ||
    URGENCY_REASON_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

export function hasMeasurableOrObservableOutcome(text: string): boolean {
  const normalized = normalizeText(text).toLowerCase();

  return /\d|%|<=|>=|<|>/.test(normalized) ||
    TESTABLE_OUTCOME_KEYWORDS.some((keyword) => normalized.includes(keyword));
}
