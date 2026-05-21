import {
  extractFirstMarkdownSection,
  normalizeText
} from '../utils';

import type {
  ResolvedRiskThresholdConfig,
  UnifiedTask
} from '../types';

import {
  buildManagerSummary,
  buildQaNotes,
  buildRewrittenTaskSuggestion,
  buildRiskRecommendations
} from './risk-recommendations';
import {
  EXTERNAL_DEPENDENCY_KEYWORDS,
  LARGE_SCOPE_KEYWORDS,
  RISKY_DOMAIN_KEYWORDS,
  findKeywordMatches,
  findRiskPhrases,
  hasEdgeCaseCoverage,
  hasEvidenceAsset,
  hasMeasurableOrObservableOutcome,
  hasUrgencyReason
} from './risk-rules';
import type {
  RiskPhraseMatch
} from './risk-rules';

import type {
  AnalyzeRiskOptions,
  NormalizedRiskTask,
  RiskAnalysis,
  RiskCategory,
  RiskDetectedProblem,
  RiskInputTask,
  RiskLevel
} from './risk-types';

const DEFAULT_RISK_THRESHOLDS: ResolvedRiskThresholdConfig = {
  lowMax: 30,
  mediumMax: 65
};

const CONTEXT_HEADINGS = [
  'Контекст',
  'Бизнес-контекст',
  'Context',
  'Business context'
];
const EXPECTED_RESULT_HEADINGS = [
  'Ожидаемый результат',
  'Результат',
  'Expected result',
  'Expected outcome'
];
const ACCEPTANCE_CRITERIA_HEADINGS = [
  'Критерии приёмки',
  'Критерии приемки',
  'Acceptance criteria',
  'Acceptance Criteria'
];
const EDGE_CASE_HEADINGS = [
  'Edge cases',
  'Edge Cases',
  'Граничные случаи',
  'Пограничные случаи',
  'Негативные сценарии'
];
const QA_NOTE_HEADINGS = [
  'QA notes',
  'QA Notes',
  'Что проверить',
  'Проверка',
  'Testing notes'
];
const REPRODUCTION_HEADINGS = [
  'Шаги воспроизведения',
  'Как воспроизвести',
  'Steps to reproduce',
  'Reproduction steps'
];
const ACTUAL_RESULT_HEADINGS = [
  'Фактический результат',
  'Actual result',
  'Actual outcome'
];

function capScore(score: number): number {
  return Math.min(100, Math.max(0, score));
}

function toRiskLevel(score: number, thresholds: ResolvedRiskThresholdConfig): RiskLevel {
  if (score <= thresholds.lowMax) {
    return 'low';
  }

  if (score <= thresholds.mediumMax) {
    return 'medium';
  }

  return 'high';
}

function splitMarkdownList(value: string | null): string[] {
  if (!value) {
    return [];
  }

  return value
    .split('\n')
    .map((line) =>
      normalizeText(line.replace(/^[-*]\s+/, '').replace(/^\[[ x]\]\s+/i, ''))
    )
    .filter(Boolean);
}

function normalizeList(values: unknown): string[] {
  if (typeof values === 'string') {
    return [normalizeText(values)].filter(Boolean);
  }

  if (!Array.isArray(values)) {
    return [];
  }

  return values.map((value) => normalizeText(value)).filter(Boolean);
}

function normalizeClarityScore(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  const score = Number(value);

  return Number.isFinite(score) ? capScore(score) : undefined;
}

function isUnifiedTask(task: RiskInputTask | UnifiedTask): task is UnifiedTask {
  return 'body' in task || 'acceptanceCriteria' in task || 'expectedResult' in task;
}

function deriveApproximateClarityScore(task: NormalizedRiskTask): number | undefined {
  if (!isUnifiedLikeWorkItem(task)) {
    return undefined;
  }

  let score = 100;

  if (!hasUsefulText(task.context)) {
    score -= 20;
  }

  if (!hasUsefulText(task.expectedResult)) {
    score -= 20;
  }

  if (!hasAcceptanceCriteria(task)) {
    score -= 20;
  }

  if (task.workItemType === 'bug') {
    const reproduction = extractFirstMarkdownSection(task.description, REPRODUCTION_HEADINGS);
    const actualResult = extractFirstMarkdownSection(task.description, ACTUAL_RESULT_HEADINGS);

    if (!hasUsefulText(reproduction || '')) {
      score -= 30;
    }

    if (!hasUsefulText(actualResult || '')) {
      score -= 30;
    }
  }

  if (findRiskPhrases(task.fullText).length > 0) {
    score -= 15;
  }

  if (!hasCoveredEdgeCases(task)) {
    score -= 5;
  }

  if (!hasEvidenceAsset(task.fullText)) {
    score -= 5;
  }

  return capScore(score);
}

function isUnifiedLikeWorkItem(task: NormalizedRiskTask): boolean {
  return task.workItemType !== undefined || task.source !== undefined;
}

function normalizeRiskTask(task: RiskInputTask | UnifiedTask): NormalizedRiskTask {
  const description = isUnifiedTask(task)
    ? normalizeText(task.body || (task as unknown as { description?: string }).description)
    : normalizeText(task.description);
  const context = isUnifiedTask(task)
    ? normalizeText(task.context) || normalizeText(extractFirstMarkdownSection(description, CONTEXT_HEADINGS))
    : normalizeText(extractFirstMarkdownSection(description, CONTEXT_HEADINGS));
  const expectedResult = isUnifiedTask(task)
    ? normalizeText(task.expectedResult) || normalizeText(extractFirstMarkdownSection(description, EXPECTED_RESULT_HEADINGS))
    : normalizeText(extractFirstMarkdownSection(description, EXPECTED_RESULT_HEADINGS));
  const acceptanceCriteria = isUnifiedTask(task) && task.acceptanceCriteria && task.acceptanceCriteria.length > 0
    ? normalizeList(task.acceptanceCriteria)
    : splitMarkdownList(extractFirstMarkdownSection(description, ACCEPTANCE_CRITERIA_HEADINGS));
  const edgeCases = splitMarkdownList(extractFirstMarkdownSection(description, EDGE_CASE_HEADINGS));
  const qaNotes = splitMarkdownList(extractFirstMarkdownSection(description, QA_NOTE_HEADINGS));
  const comments = normalizeList(task.comments);
  const title = normalizeText(task.title);
  const fullText = [
    title,
    description,
    context,
    expectedResult,
    ...acceptanceCriteria,
    ...edgeCases,
    ...qaNotes,
    ...comments
  ].filter(Boolean).join('\n');
  const rawClarityScore = isUnifiedTask(task)
    ? task.clarityScore
    : task.clarityScore;
  const normalized: NormalizedRiskTask = {
    id: normalizeText(task.id) || (isUnifiedTask(task) ? normalizeText(task.key) : undefined) || undefined,
    title,
    description,
    fullText,
    clarityScore: normalizeClarityScore(rawClarityScore),
    source: normalizeText(task.source) || undefined,
    comments,
    statusHistory: Array.isArray(task.statusHistory) ? task.statusHistory : [],
    context,
    expectedResult,
    acceptanceCriteria,
    edgeCases,
    qaNotes,
    workItemType: isUnifiedTask(task) ? task.workItemType : undefined
  };

  return {
    ...normalized,
    clarityScore: normalized.clarityScore ?? deriveApproximateClarityScore(normalized)
  };
}

function hasUsefulText(value: string): boolean {
  return normalizeText(value).length >= 20;
}

function hasAcceptanceCriteria(task: NormalizedRiskTask): boolean {
  return task.acceptanceCriteria.join('').length >= 20;
}

function hasExplicitEdgeCaseGap(text: string): boolean {
  const normalized = normalizeText(text).toLowerCase();
  const gapBeforeTopic = /(не хватает|не описан[аоы]?|не учли|нужно\s+(отдельно\s+)?описать|уточнить).{0,90}(edge|гранич|погранич|негатив|сценари|ошиб|таймаут)/iu;
  const topicBeforeGap = /(edge|гранич|погранич|негатив|сценари|ошиб|таймаут).{0,90}(не хватает|не описан[аоы]?|не учли|нужно\s+(отдельно\s+)?описать|уточнить)/iu;

  return gapBeforeTopic.test(normalized) || topicBeforeGap.test(normalized);
}

function hasCoveredEdgeCases(task: NormalizedRiskTask): boolean {
  return hasEdgeCaseCoverage(task.fullText) && !hasExplicitEdgeCaseGap(task.fullText);
}

function hasTestableResult(task: NormalizedRiskTask): boolean {
  if (!hasUsefulText(task.expectedResult)) {
    return false;
  }

  return hasAcceptanceCriteria(task) ||
    hasMeasurableOrObservableOutcome(`${task.expectedResult}\n${task.fullText}`);
}

function isReturnedFromTesting(task: NormalizedRiskTask): boolean {
  const statuses = task.statusHistory
    .filter((entry): entry is { status?: unknown } =>
      typeof entry === 'object' && entry !== null && 'status' in entry
    )
    .map((entry) => normalizeText(entry.status).toLowerCase())
    .filter(Boolean);
  const testingIndex = statuses.findIndex((status) => /testing|тест/.test(status));

  if (testingIndex >= 0) {
    const laterStatuses = statuses.slice(testingIndex + 1);

    if (laterStatuses.some((status) => /reopened|in progress|development|возврат|доработ/.test(status))) {
      return true;
    }
  }

  return task.comments.some((comment) =>
    /вернул|возврат|reopened|returned from testing|не прошло тест/i.test(comment)
  );
}

function isMitigatedVaguePhrase(match: RiskPhraseMatch, task: NormalizedRiskTask): boolean {
  const hasStrongStructure = hasUsefulText(task.context) &&
    hasUsefulText(task.expectedResult) &&
    hasAcceptanceCriteria(task);

  if (!hasStrongStructure) {
    return false;
  }

  if (match.group === 'urgency') {
    return hasUrgencyReason(task.fullText);
  }

  if (match.group === 'hidden_reference') {
    return hasEvidenceAsset(task.fullText);
  }

  if (match.group === 'generic_fix' || match.group === 'generic_improvement') {
    return hasMeasurableOrObservableOutcome(task.fullText);
  }

  return hasMeasurableOrObservableOutcome(task.fullText);
}

function hasGenericRequestWithoutDetails(matches: RiskPhraseMatch[], task: NormalizedRiskTask): boolean {
  const genericMatches = matches.filter((match) =>
    match.group === 'generic_fix' || match.group === 'generic_improvement'
  );

  if (genericMatches.length === 0) {
    return false;
  }

  return !hasUsefulText(task.expectedResult) ||
    !hasAcceptanceCriteria(task) ||
    !hasMeasurableOrObservableOutcome(task.fullText);
}

function addProblem(
  problems: RiskDetectedProblem[],
  category: RiskCategory,
  message: string,
  riskPoints: number,
  evidence: string[] = []
): void {
  if (problems.some((problem) => problem.category === category && problem.message === message)) {
    return;
  }

  problems.push({
    category,
    message,
    riskPoints,
    evidence: evidence.length > 0 ? evidence : undefined
  });
}

function inferCategories(
  score: number,
  problems: RiskDetectedProblem[]
): RiskCategory[] {
  const categories = new Set(problems.map((problem) => problem.category));

  if (
    score > 30 &&
    (
      categories.has('missing_acceptance_criteria') ||
      categories.has('untestable_result') ||
      categories.has('missing_edge_cases')
    )
  ) {
    categories.add('qa_return_risk');
  }

  if (
    categories.has('missing_context') ||
    categories.has('vague_wording')
  ) {
    categories.add('communication_overhead');
  }

  if (
    score > 65 ||
    categories.has('missing_context') && categories.has('missing_expected_result') ||
    categories.has('delivery_delay_risk')
  ) {
    categories.add('delivery_delay_risk');
  }

  return Array.from(categories);
}

/** Анализирует одну задачу и возвращает Risk Radar результат. */
export function analyzeRisk(
  input: RiskInputTask | UnifiedTask,
  options: AnalyzeRiskOptions = {}
): RiskAnalysis {
  const thresholds = options.thresholds || DEFAULT_RISK_THRESHOLDS;
  const task = normalizeRiskTask(input);
  const problems: RiskDetectedProblem[] = [];
  const hasContext = hasUsefulText(task.context);
  const hasExpectedResult = hasUsefulText(task.expectedResult);
  const hasCriteria = hasAcceptanceCriteria(task);
  const phraseMatches = findRiskPhrases(task.fullText);
  const actionableVagueMatches = phraseMatches.filter((match) =>
    !isMitigatedVaguePhrase(match, task)
  );
  const urgencyMatches = phraseMatches.filter((match) => match.group === 'urgency');
  const riskyDomainMatches = findKeywordMatches(task.fullText, RISKY_DOMAIN_KEYWORDS);
  const externalDependencyMatches = findKeywordMatches(task.fullText, EXTERNAL_DEPENDENCY_KEYWORDS);
  const largeScopeMatches = findKeywordMatches(task.fullText, LARGE_SCOPE_KEYWORDS);
  const hasEdgeCases = hasCoveredEdgeCases(task);
  const hasEvidence = hasEvidenceAsset(task.fullText);

  if (!hasContext) {
    addProblem(
      problems,
      'missing_context',
      'Отсутствует понятный контекст задачи.',
      20
    );
  }

  if (!hasExpectedResult) {
    addProblem(
      problems,
      'missing_expected_result',
      'Отсутствует ожидаемый результат.',
      20
    );
  }

  if (!hasCriteria) {
    addProblem(
      problems,
      'missing_acceptance_criteria',
      'Отсутствуют критерии приёмки.',
      25
    );
  }

  if (actionableVagueMatches.length > 0) {
    const groups = new Set(actionableVagueMatches.map((match) => match.group));
    const evidence = actionableVagueMatches.map((match) => match.phrase);

    addProblem(
      problems,
      'vague_wording',
      `Есть расплывчатые формулировки: ${evidence.slice(0, 5).join(', ')}.`,
      Math.min(25, groups.size * 10),
      evidence
    );
  }

  if (!hasTestableResult(task)) {
    addProblem(
      problems,
      'untestable_result',
      'Результат нельзя нормально протестировать по текущему описанию.',
      20
    );
  }

  if (!hasEdgeCases) {
    addProblem(
      problems,
      'missing_edge_cases',
      'Не описаны edge cases и негативные сценарии.',
      10
    );
  }

  if (!hasEvidence) {
    addProblem(
      problems,
      'missing_links_or_examples',
      'Нет ссылок, макетов, скриншотов, примеров, логов или исходных данных.',
      10
    );
  }

  if (urgencyMatches.length > 0 && !hasUrgencyReason(task.fullText)) {
    addProblem(
      problems,
      'communication_overhead',
      'Есть срочность без объяснения причины.',
      10,
      urgencyMatches.map((match) => match.phrase)
    );
  }

  if (hasGenericRequestWithoutDetails(phraseMatches, task)) {
    addProblem(
      problems,
      'vague_wording',
      'Есть общее действие вроде "пофиксить", "улучшить" или "починить" без достаточных деталей.',
      10,
      phraseMatches
        .filter((match) => match.group === 'generic_fix' || match.group === 'generic_improvement')
        .map((match) => match.phrase)
    );
  }

  if (task.clarityScore !== undefined && task.clarityScore < 40) {
    addProblem(
      problems,
      'delivery_delay_risk',
      'Низкий Clarity Score сильно повышает риск задержки и повторных уточнений.',
      25,
      [`Clarity Score: ${task.clarityScore}`]
    );
  } else if (task.clarityScore !== undefined && task.clarityScore < 70) {
    addProblem(
      problems,
      'delivery_delay_risk',
      'Средний Clarity Score умеренно повышает риск дополнительных уточнений.',
      10,
      [`Clarity Score: ${task.clarityScore}`]
    );
  }

  if (riskyDomainMatches.length > 0 && (!hasEdgeCases || !hasEvidence)) {
    addProblem(
      problems,
      'delivery_delay_risk',
      `Задача затрагивает рискованный домен: ${riskyDomainMatches[0]}.`,
      25,
      riskyDomainMatches.slice(0, 3)
    );
  }

  if (externalDependencyMatches.length > 0) {
    addProblem(
      problems,
      'delivery_delay_risk',
      'Есть внешняя зависимость или блокер, который может задержать задачу.',
      15,
      externalDependencyMatches.slice(0, 3)
    );
  }

  if (largeScopeMatches.length > 0) {
    addProblem(
      problems,
      'delivery_delay_risk',
      'Scope задачи выглядит слишком широким для безопасной реализации.',
      15,
      largeScopeMatches.slice(0, 3)
    );
  }

  if (isReturnedFromTesting(task)) {
    addProblem(
      problems,
      'qa_return_risk',
      'Задача уже возвращалась с тестирования или имеет признаки QA return.',
      15
    );
  }

  const riskScore = capScore(problems.reduce((sum, problem) => sum + problem.riskPoints, 0));
  const riskLevel = toRiskLevel(riskScore, thresholds);
  const categories = inferCategories(riskScore, problems);
  const recommendations = buildRiskRecommendations(categories);
  const partialResult = {
    riskLevel,
    detectedProblems: problems
  };
  const managerSummary = buildManagerSummary(partialResult);
  const qaNotes = buildQaNotes(problems);
  const rewrittenTaskSuggestion = buildRewrittenTaskSuggestion(task);
  const riskFactors = problems.map((problem) => problem.message);

  return {
    taskId: task.id || task.title || 'task',
    title: task.title || task.id || 'Untitled task',
    riskLevel,
    riskScore,
    categories,
    detectedProblems: problems,
    recommendations,
    managerSummary,
    qaNotes,
    rewrittenTaskSuggestion,
    riskFactors,
    recommendation: recommendations[0] || 'Сохранить текущий уровень ясности задачи.',
    clarityScore: task.clarityScore
  };
}

/** Backward-compatible alias for older Clarity Guardian reports. */
export function analyzeTaskRisk(
  task: UnifiedTask,
  options: AnalyzeRiskOptions = {}
): RiskAnalysis {
  return analyzeRisk(task, options);
}

export function analyzeRisks(
  tasks: Array<RiskInputTask | UnifiedTask>,
  options: AnalyzeRiskOptions = {}
): RiskAnalysis[] {
  return tasks.map((task) => analyzeRisk(task, options));
}
