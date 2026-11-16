import {
  extractFirstMarkdownSection,
  normalizeText
} from './utils';
import {
  analyzeRequiredSections,
  analyzeStopPhrases
} from './analyze';
import {
  calculateClarityScore
} from './clarity-score';
import {
  detectLanguage,
  detectWorkItemType,
  getRequiredSections,
  getStopPhrases,
  loadConfig
} from './config';
import {
  unifiedTaskToTaskPayload
} from './task-model';
import {
  TASK_SIGNAL_KEYWORDS
} from './dictionaries/taskQualityDictionary';

import type {
  UnifiedTask,
  WorkItemType
} from './types';

export const VAGUE_PHRASES = [
  ...TASK_SIGNAL_KEYWORDS.vaguePhrases
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

export const TESTING_KEYWORDS = [
  ...TASK_SIGNAL_KEYWORDS.testingKeywords
];

export const BLOCKER_KEYWORDS = [
  ...TASK_SIGNAL_KEYWORDS.blockerKeywords
];

export const DONE_STATUSES = [
  'done',
  'closed',
  'released',
  'готово',
  'закрыто'
];

const CONTEXT_HEADINGS = ['Контекст', 'Context'];
const EXPECTED_RESULT_HEADINGS = ['Ожидаемый результат', 'Expected result', 'Expected outcome'];
const ACCEPTANCE_CRITERIA_HEADINGS = ['Критерии приёмки', 'Критерии приемки', 'Acceptance criteria', 'Acceptance Criteria'];

function clampClarityScore(score: number): number {
  return Math.min(100, Math.max(0, score));
}

function calculateDerivedClarityScore(task: UnifiedTask): number {
  const config = loadConfig();
  const payload = unifiedTaskToTaskPayload(task, config);
  const title = normalizeText(payload.title);
  const body = normalizeText(payload.body);
  const language = detectLanguage(payload, config);
  const workItemType = detectWorkItemType(payload);
  const remarks = [
    ...analyzeRequiredSections(
      body,
      getRequiredSections(config, language, workItemType),
      language,
      config.mode,
      workItemType
    ),
    ...analyzeStopPhrases(
      `${title}\n${body}`,
      getStopPhrases(config, language, workItemType),
      language,
      config.mode
    )
  ];

  return calculateClarityScore({
    title,
    body,
    remarks,
    scoring: config.scoring
  }).score;
}

export function getTaskId(task: UnifiedTask): string {
  return task.key || task.id;
}

export function getTaskClarityScore(task: UnifiedTask): number {
  if (typeof task.clarityScore === 'number' && Number.isFinite(task.clarityScore)) {
    return clampClarityScore(task.clarityScore);
  }

  return calculateDerivedClarityScore(task);
}

export function getTaskText(task: UnifiedTask): string {
  return [
    task.title,
    task.body,
    task.context,
    task.expectedResult,
    ...(task.acceptanceCriteria || []),
    ...(task.dependencies || []),
    ...(task.comments || []),
    ...(task.labels || []),
    ...(task.tags || []),
    ...(task.components || [])
  ].filter(Boolean).join('\n');
}

export function hasAnyKeyword(text: string, keywords: string[]): boolean {
  return findKeywords(text, keywords).length > 0;
}

export function findKeywords(text: string, keywords: string[]): string[] {
  const normalized = normalizeText(text).toLowerCase();

  return keywords.filter((keyword) =>
    keywordMatches(normalized, keyword.toLowerCase())
  );
}

function keywordMatches(normalizedText: string, keyword: string): boolean {
  if (keyword === 'ожидаем' || keyword === 'ждем' || keyword === 'ждём' || keyword === 'prod') {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, 'iu');

    return regex.test(normalizedText);
  }

  return normalizedText.includes(keyword);
}

export function getContext(task: UnifiedTask): string {
  return normalizeText(
    task.context || extractFirstMarkdownSection(task.body, CONTEXT_HEADINGS) || ''
  );
}

export function getExpectedResult(task: UnifiedTask): string {
  return normalizeText(
    task.expectedResult || extractFirstMarkdownSection(task.body, EXPECTED_RESULT_HEADINGS) || ''
  );
}

export function getExecutionDetails(task: UnifiedTask): {
  repository: string;
  scope: string;
  verification: string;
} {
  return {
    repository: task.repository
      || extractFirstMarkdownSection(task.body, ['Repository', 'Репозиторий'])
      || (task.source === 'github' ? task.projectKey : undefined)
      || '',
    scope: task.scope || extractFirstMarkdownSection(task.body, ['Scope', 'Объём работ', 'Объем работ']) || '',
    verification: task.verification
      || extractFirstMarkdownSection(task.body, ['Verification', 'План проверки', 'Как проверить'])
      || ''
  };
}

export function getAcceptanceCriteria(task: UnifiedTask): string[] {
  const explicit = (task.acceptanceCriteria || [])
    .map((item) => normalizeText(item))
    .filter(Boolean);

  if (explicit.length > 0) {
    return explicit;
  }

  const section = extractFirstMarkdownSection(task.body, ACCEPTANCE_CRITERIA_HEADINGS);

  if (!section) {
    return [];
  }

  return section
    .split('\n')
    .map((line) => normalizeText(line.replace(/^[-*]\s+/, '')))
    .filter(Boolean);
}

export function hasContext(task: UnifiedTask): boolean {
  return getContext(task).length >= 20;
}

export function hasExpectedResult(task: UnifiedTask): boolean {
  return getExpectedResult(task).length >= 20;
}

export function hasAcceptanceCriteria(task: UnifiedTask): boolean {
  return getAcceptanceCriteria(task).join('').length >= 20;
}

export function getTaskType(task: UnifiedTask): WorkItemType | undefined {
  return task.workItemType;
}

export function hasTestingSignal(task: UnifiedTask): boolean {
  return hasAnyKeyword(getTaskText(task), TESTING_KEYWORDS);
}

export function hasOpenBlocker(task: UnifiedTask): boolean {
  return hasAnyKeyword(getTaskText(task), BLOCKER_KEYWORDS);
}

export function hasExternalDependency(task: UnifiedTask): boolean {
  return hasAnyKeyword(getTaskText(task), EXTERNAL_DEPENDENCY_KEYWORDS);
}

export function hasDependencyInfo(task: UnifiedTask): boolean {
  return (task.dependencies || []).some((dependency) => normalizeText(dependency).length > 0);
}

export function hasLargeScope(task: UnifiedTask): boolean {
  return hasAnyKeyword(getTaskText(task), LARGE_SCOPE_KEYWORDS);
}

export function hasVagueWording(task: UnifiedTask): boolean {
  return hasAnyKeyword(getTaskText(task), VAGUE_PHRASES);
}

export function isDoneStatus(status: string | undefined): boolean {
  const normalized = normalizeText(status).toLowerCase();

  return DONE_STATUSES.includes(normalized);
}

export function hasReopenedAfterLastTesting(task: UnifiedTask): boolean {
  const history = task.statusHistory || [];
  let lastTestingIndex = -1;

  history.forEach((entry, index) => {
    if (entry.status.toLowerCase() === 'testing') {
      lastTestingIndex = index;
    }
  });

  if (lastTestingIndex === -1) {
    return false;
  }

  return history
    .slice(lastTestingIndex + 1)
    .some((entry) => entry.status.toLowerCase() === 'reopened');
}
