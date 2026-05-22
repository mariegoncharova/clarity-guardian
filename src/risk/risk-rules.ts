import {
  normalizeText
} from '../utils';
import {
  TASK_SIGNAL_KEYWORDS
} from '../dictionaries/taskQualityDictionary';

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
  ...TASK_SIGNAL_KEYWORDS.riskyDomainKeywords
];

export const EXTERNAL_DEPENDENCY_KEYWORDS = [
  ...TASK_SIGNAL_KEYWORDS.externalDependencyKeywords
];

export const LARGE_SCOPE_KEYWORDS = [
  ...TASK_SIGNAL_KEYWORDS.largeScopeKeywords
];

const EVIDENCE_KEYWORDS = [
  ...TASK_SIGNAL_KEYWORDS.evidenceKeywords
];

const EDGE_CASE_KEYWORDS = [
  ...TASK_SIGNAL_KEYWORDS.edgeCaseKeywords
];

const URGENCY_REASON_KEYWORDS = [
  ...TASK_SIGNAL_KEYWORDS.urgencyReasonMarkers,
  'причина',
  'до ',
  'инцидент',
  'sla',
  'customer',
  'reason',
  'blocked'
];

const TESTABLE_OUTCOME_KEYWORDS = [
  ...TASK_SIGNAL_KEYWORDS.testableOutcomeKeywords
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
