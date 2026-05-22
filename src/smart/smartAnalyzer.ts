import {
  SMART_BAD_SIGNALS,
  SMART_CRITERION_TITLES,
  SMART_GOOD_SIGNALS
} from './smartDictionary';

import {
  extractFirstMarkdownSection,
  normalizeText
} from '../utils';

import type {
  SmartAnalysisResult,
  SmartAnalysisStatus,
  SmartCriterionKey,
  SmartCriterionResult,
  SmartCriterionStatus,
  SmartSignalPattern,
  SmartTaskInput,
  SmartVaguePhrase
} from './smartTypes';

import type { UnifiedTask } from '../types';

const CRITERION_ORDER: SmartCriterionKey[] = [
  'specific',
  'measurable',
  'achievable',
  'relevant',
  'timeBound'
];

const CONTEXT_HEADINGS = ['Контекст', 'Context'];
const EXPECTED_RESULT_HEADINGS = ['Ожидаемый результат', 'Expected result', 'Expected outcome'];
const ACCEPTANCE_CRITERIA_HEADINGS = ['Критерии приёмки', 'Критерии приемки', 'Acceptance criteria', 'Acceptance Criteria'];

interface SmartInputSnapshot {
  title: string;
  body: string;
  context: string;
  expectedResult: string;
  acceptanceCriteria: string[];
  comments: string[];
  labels: string[];
  components: string[];
  dependencies: string[];
  sprint: string;
  deadline: string;
  dueDate: string;
  priority: string;
  text: string;
}

interface SmartSignals {
  hasObject: boolean;
  hasExpectedResult: boolean;
  hasClearAction: boolean;
  unmitigatedVaguePhrases: string[];
  mitigatedVaguePhrases: string[];
  hasAcceptanceCriteria: boolean;
  hasMetric: boolean;
  hasVerifiableCondition: boolean;
  hasExample: boolean;
  hasConstraints: boolean;
  hasResourcesOrDependencies: boolean;
  hasClearScope: boolean;
  hasBroadScope: boolean;
  hasBusinessContext: boolean;
  hasUserOrTeamValue: boolean;
  hasProjectGoal: boolean;
  hasPriorityReason: boolean;
  hasDeadline: boolean;
  hasSprintOrRelease: boolean;
  hasTimeframe: boolean;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function round(value: number): number {
  return Math.round(value);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => normalizeText(value)).filter(Boolean)));
}

function normalizeList(values: unknown): string[] {
  if (typeof values === 'string') {
    return [normalizeText(values)].filter(Boolean);
  }

  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => normalizeText(value))
    .filter(Boolean);
}

function splitMarkdownList(section: string | null): string[] {
  if (!section) {
    return [];
  }

  return section
    .split('\n')
    .map((line) => normalizeText(line.replace(/^[-*]\s+/, '').replace(/^\[[ x]\]\s+/i, '')))
    .filter(Boolean);
}

function readTextField(source: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = normalizeText(source[key]);

    if (value) {
      return value;
    }
  }

  return '';
}

function buildSnapshotFromString(input: string): SmartInputSnapshot {
  const text = normalizeText(input);
  const context = normalizeText(extractFirstMarkdownSection(text, CONTEXT_HEADINGS));
  const expectedResult = normalizeText(extractFirstMarkdownSection(text, EXPECTED_RESULT_HEADINGS));
  const acceptanceCriteria = splitMarkdownList(extractFirstMarkdownSection(text, ACCEPTANCE_CRITERIA_HEADINGS));
  const [firstLine = ''] = text.split('\n');
  const title = firstLine.startsWith('#') ? normalizeText(firstLine.replace(/^#+\s*/, '')) : '';

  return {
    title,
    body: text,
    context,
    expectedResult,
    acceptanceCriteria,
    comments: [],
    labels: [],
    components: [],
    dependencies: [],
    sprint: '',
    deadline: '',
    dueDate: '',
    priority: '',
    text
  };
}

function buildSnapshotFromTask(task: UnifiedTask): SmartInputSnapshot {
  const source = task as UnifiedTask & Record<string, unknown>;
  const body = normalizeText(task.body);
  const markdownContext = normalizeText(extractFirstMarkdownSection(body, CONTEXT_HEADINGS));
  const markdownExpectedResult = normalizeText(extractFirstMarkdownSection(body, EXPECTED_RESULT_HEADINGS));
  const markdownAcceptanceCriteria = splitMarkdownList(extractFirstMarkdownSection(body, ACCEPTANCE_CRITERIA_HEADINGS));
  const context = normalizeText(task.context) || markdownContext;
  const expectedResult = normalizeText(task.expectedResult) || markdownExpectedResult;
  const acceptanceCriteria = unique([
    ...(task.acceptanceCriteria || []),
    ...markdownAcceptanceCriteria
  ]);
  const comments = normalizeList(task.comments);
  const labels = unique([
    ...(task.labels || []),
    ...(task.tags || [])
  ]);
  const components = normalizeList(task.components);
  const dependencies = normalizeList(task.dependencies);
  const deadline = readTextField(source, ['deadline', 'due', 'due_at']);
  const dueDate = readTextField(source, ['dueDate', 'due_date', 'targetDate', 'target_date']);
  const sprint = normalizeText(task.sprint);
  const priority = normalizeText(task.priority);
  const text = unique([
    task.title,
    body,
    context,
    expectedResult,
    ...acceptanceCriteria,
    ...comments,
    ...labels,
    ...components,
    ...dependencies,
    sprint,
    deadline,
    dueDate,
    priority
  ]).join('\n');

  return {
    title: normalizeText(task.title),
    body,
    context,
    expectedResult,
    acceptanceCriteria,
    comments,
    labels,
    components,
    dependencies,
    sprint,
    deadline,
    dueDate,
    priority,
    text
  };
}

function buildSnapshot(input: SmartTaskInput): SmartInputSnapshot {
  if (typeof input === 'string') {
    return buildSnapshotFromString(input);
  }

  return buildSnapshotFromTask(input);
}

function hasAnyPattern(text: string, patterns: SmartSignalPattern[]): boolean {
  return patterns.some((item) => item.pattern.test(text));
}

function findVaguePhrases(text: string): SmartVaguePhrase[] {
  return SMART_BAD_SIGNALS.vaguePhrases.filter((item) => item.pattern.test(text));
}

function hasStructuredAcceptanceCriteria(snapshot: SmartInputSnapshot): boolean {
  return snapshot.acceptanceCriteria.length > 0 ||
    hasAnyPattern(snapshot.text, SMART_GOOD_SIGNALS.acceptanceCriteria);
}

function hasExplicitMetric(snapshot: SmartInputSnapshot): boolean {
  return hasAnyPattern(snapshot.text, SMART_GOOD_SIGNALS.metrics);
}

function hasObjectSignal(snapshot: SmartInputSnapshot): boolean {
  return snapshot.components.length > 0 ||
    (snapshot.labels.length > 0 && hasAnyPattern(snapshot.text, SMART_GOOD_SIGNALS.actions)) ||
    hasAnyPattern(snapshot.text, SMART_GOOD_SIGNALS.objects);
}

function hasExpectedResultSignal(snapshot: SmartInputSnapshot, hasMetric: boolean): boolean {
  return Boolean(snapshot.expectedResult) ||
    hasAnyPattern(snapshot.text, SMART_GOOD_SIGNALS.expectedResults) ||
    (hasMetric && hasAnyPattern(snapshot.text, SMART_GOOD_SIGNALS.actions));
}

function hasClearScopeSignal(snapshot: SmartInputSnapshot, hasObject: boolean, hasAction: boolean): boolean {
  const acceptanceCriteriaCount = snapshot.acceptanceCriteria.length;

  return (hasObject && hasAction && snapshot.text.length <= 2200) ||
    (acceptanceCriteriaCount > 0 && acceptanceCriteriaCount <= 8) ||
    Boolean(snapshot.expectedResult);
}

function isVaguePhraseMitigated(
  phrase: SmartVaguePhrase,
  snapshot: SmartInputSnapshot,
  signals: Pick<SmartSignals, 'hasObject' | 'hasExpectedResult' | 'hasMetric' | 'hasDeadline' | 'hasSprintOrRelease' | 'hasTimeframe'>
): boolean {
  if (phrase.mitigatedByConcreteResult) {
    return signals.hasObject && (signals.hasExpectedResult || signals.hasMetric);
  }

  if (phrase.mitigatedByTimeContext) {
    return signals.hasDeadline || signals.hasSprintOrRelease || signals.hasTimeframe ||
      /потому что|because|до релиза|перед релизом|приоритет/i.test(snapshot.text);
  }

  return false;
}

function collectSignals(snapshot: SmartInputSnapshot): SmartSignals {
  const hasMetric = hasExplicitMetric(snapshot);
  const hasObject = hasObjectSignal(snapshot);
  const hasClearAction = hasAnyPattern(snapshot.text, SMART_GOOD_SIGNALS.actions);
  const hasExpectedResult = hasExpectedResultSignal(snapshot, hasMetric);
  const hasAcceptanceCriteria = hasStructuredAcceptanceCriteria(snapshot);
  const hasDeadline = Boolean(snapshot.deadline || snapshot.dueDate) ||
    hasAnyPattern(snapshot.text, SMART_GOOD_SIGNALS.deadlines);
  const hasSprintOrRelease = Boolean(snapshot.sprint) ||
    hasAnyPattern(snapshot.text, SMART_GOOD_SIGNALS.sprintsOrReleases);
  const hasTimeframe = hasAnyPattern(snapshot.text, SMART_GOOD_SIGNALS.timeframes);
  const partialSignals = {
    hasObject,
    hasExpectedResult,
    hasMetric,
    hasDeadline,
    hasSprintOrRelease,
    hasTimeframe
  };
  const vaguePhraseMatches = findVaguePhrases(snapshot.text);
  const mitigatedVaguePhrases = vaguePhraseMatches
    .filter((phrase) => isVaguePhraseMitigated(phrase, snapshot, partialSignals))
    .map((phrase) => phrase.phrase);
  const unmitigatedVaguePhrases = vaguePhraseMatches
    .filter((phrase) => !isVaguePhraseMitigated(phrase, snapshot, partialSignals))
    .map((phrase) => phrase.phrase);
  const hasBroadScope = hasAnyPattern(snapshot.text, SMART_BAD_SIGNALS.broadScope) &&
    !hasAcceptanceCriteria &&
    !hasMetric;

  return {
    hasObject,
    hasExpectedResult,
    hasClearAction,
    unmitigatedVaguePhrases,
    mitigatedVaguePhrases,
    hasAcceptanceCriteria,
    hasMetric,
    hasVerifiableCondition: hasAcceptanceCriteria ||
      hasAnyPattern(snapshot.text, SMART_GOOD_SIGNALS.verifiableConditions) ||
      (hasObject && hasExpectedResult && hasClearAction),
    hasExample: hasAnyPattern(snapshot.text, SMART_GOOD_SIGNALS.examples),
    hasConstraints: hasAnyPattern(snapshot.text, SMART_GOOD_SIGNALS.constraints),
    hasResourcesOrDependencies: snapshot.dependencies.length > 0 ||
      hasAnyPattern(snapshot.text, SMART_GOOD_SIGNALS.resources),
    hasClearScope: hasClearScopeSignal(snapshot, hasObject, hasClearAction),
    hasBroadScope,
    hasBusinessContext: Boolean(snapshot.context) ||
      hasAnyPattern(snapshot.text, SMART_GOOD_SIGNALS.relevanceContext),
    hasUserOrTeamValue: hasAnyPattern(snapshot.text, SMART_GOOD_SIGNALS.userOrTeamValue),
    hasProjectGoal: hasAnyPattern(snapshot.text, SMART_GOOD_SIGNALS.projectGoal),
    hasPriorityReason: hasAnyPattern(snapshot.text, SMART_GOOD_SIGNALS.priorityReason),
    hasDeadline,
    hasSprintOrRelease,
    hasTimeframe
  };
}

function criterionStatus(score: number): SmartCriterionStatus {
  if (score >= 80) {
    return 'passed';
  }

  if (score >= 50) {
    return 'warning';
  }

  return 'failed';
}

function analysisStatus(score: number): SmartAnalysisStatus {
  if (score >= 80) {
    return 'strong';
  }

  if (score >= 50) {
    return 'needs_improvement';
  }

  return 'weak';
}

function buildCriterion(
  key: SmartCriterionKey,
  score: number,
  foundSignals: string[],
  missingSignals: string[],
  recommendations: string[]
): SmartCriterionResult {
  const finalScore = clampScore(score);

  return {
    key,
    title: SMART_CRITERION_TITLES[key],
    score: finalScore,
    status: criterionStatus(finalScore),
    foundSignals: unique(foundSignals),
    missingSignals: unique(missingSignals),
    recommendations: unique(recommendations)
  };
}

function analyzeSpecific(signals: SmartSignals): SmartCriterionResult {
  let score = 0;
  const found: string[] = [];
  const missing: string[] = [];
  const recommendations: string[] = [];

  if (signals.hasObject) {
    score += 30;
    found.push('указан объект изменения');
  } else {
    missing.push('не указан конкретный объект изменения');
    recommendations.push('Назвать экран, компонент, API, событие или другой объект, который должен измениться.');
  }

  if (signals.hasExpectedResult) {
    score += 30;
    found.push('описан ожидаемый результат или состояние после выполнения');
  } else {
    missing.push('не описан понятный ожидаемый результат');
    recommendations.push('Добавить наблюдаемое состояние продукта после выполнения задачи.');
  }

  if (signals.unmitigatedVaguePhrases.length === 0) {
    score += 20;
    found.push(signals.mitigatedVaguePhrases.length > 0
      ? `vague-формулировки уточнены конкретикой: ${signals.mitigatedVaguePhrases.join(', ')}`
      : 'сильных vague-фраз не найдено');
  } else {
    missing.push(`есть размытые формулировки без уточнения: ${signals.unmitigatedVaguePhrases.join(', ')}`);
    recommendations.push('Заменить общие слова на конкретное действие, объект и ожидаемое состояние.');
  }

  if (signals.hasClearAction) {
    score += 20;
    found.push('есть понятное действие');
  } else {
    missing.push('не видно конкретного действия');
    recommendations.push('Начать задачу с проверяемого действия: добавить, исправить, показать, отправить, удалить.');
  }

  return buildCriterion('specific', score, found, missing, recommendations);
}

function analyzeMeasurable(signals: SmartSignals): SmartCriterionResult {
  let score = 0;
  const found: string[] = [];
  const missing: string[] = [];
  const recommendations: string[] = [];

  if (signals.hasAcceptanceCriteria) {
    score += 40;
    found.push('есть acceptance criteria или явное условие готовности');
  } else {
    missing.push('нет явных критериев приёмки');
    recommendations.push('Добавить acceptance criteria в формате "Готово, если...".');
  }

  if (signals.hasMetric) {
    score += 30;
    found.push('есть метрика, число или измеримое изменение');
  } else {
    missing.push('нет метрик успеха или числовых ориентиров');
    recommendations.push('Добавить измеримый признак успеха: процент, время, количество, SLA или порог качества.');
  }

  if (signals.hasVerifiableCondition) {
    score += 20;
    found.push('есть проверяемый результат или условие');
  } else {
    missing.push('нельзя уверенно понять, когда задача готова');
    recommendations.push('Описать, что именно должен проверить PM или QA.');
  }

  if (signals.hasExample) {
    score += 10;
    found.push('есть пример ожидаемого поведения или сценария');
  } else {
    missing.push('нет примеров ожидаемого поведения');
    recommendations.push('Добавить хотя бы один пример сценария или ошибки, на котором проверяется результат.');
  }

  return buildCriterion('measurable', score, found, missing, recommendations);
}

function analyzeAchievable(signals: SmartSignals): SmartCriterionResult {
  let score = 0;
  const found: string[] = [];
  const missing: string[] = [];
  const recommendations: string[] = [];

  if (signals.hasConstraints) {
    score += 30;
    found.push('указаны ограничения или условия выполнения');
  } else {
    missing.push('не указаны ограничения выполнения');
    recommendations.push('Добавить ограничения: что не должно измениться, какие роли, данные или сценарии исключены.');
  }

  if (signals.hasResourcesOrDependencies) {
    score += 30;
    found.push('указаны доступные данные, ресурсы, среда или зависимости');
  } else {
    missing.push('не указаны ресурсы, данные или зависимости');
    recommendations.push('Указать доступные данные, среду проверки, внешние зависимости или владельца источника.');
  }

  if (signals.hasClearScope) {
    score += 20;
    found.push('понятен ограниченный scope работы');
  } else {
    missing.push('scope задачи выглядит неограниченным');
    recommendations.push('Сузить задачу до одного результата или декомпозировать её на несколько задач.');
  }

  if (!signals.hasBroadScope) {
    score += 20;
    found.push('нет признаков чрезмерно широкой постановки');
  } else {
    missing.push('есть признаки слишком широкой постановки');
    recommendations.push('Убрать формулировки про "всё", "везде" или "переделать" без границ scope.');
  }

  return buildCriterion('achievable', score, found, missing, recommendations);
}

function analyzeRelevant(signals: SmartSignals): SmartCriterionResult {
  let score = 0;
  const found: string[] = [];
  const missing: string[] = [];
  const recommendations: string[] = [];

  if (signals.hasBusinessContext) {
    score += 40;
    found.push('описана проблема или бизнес-контекст');
  } else {
    missing.push('не объяснено, какую проблему решает задача');
    recommendations.push('Добавить контекст: почему задача нужна и что изменится для продукта или процесса.');
  }

  if (signals.hasUserOrTeamValue) {
    score += 30;
    found.push('видна пользовательская или командная ценность');
  } else {
    missing.push('непонятно, кому нужен результат');
    recommendations.push('Указать пользователя, команду или роль, для которой важен результат.');
  }

  if (signals.hasProjectGoal) {
    score += 20;
    found.push('есть связь с целью проекта, спринта или продукта');
  } else {
    missing.push('нет связи с целью проекта, спринта или процесса');
    recommendations.push('Связать задачу с целью проекта, спринта, релиза или продуктового направления.');
  }

  if (signals.hasPriorityReason) {
    score += 10;
    found.push('объяснён приоритет или актуальность сейчас');
  } else {
    missing.push('не объяснено, почему задачу нужно делать сейчас');
    recommendations.push('Добавить причину приоритета: дедлайн, релиз, риск, поддержку или ожидаемый эффект.');
  }

  return buildCriterion('relevant', score, found, missing, recommendations);
}

function analyzeTimeBound(signals: SmartSignals): SmartCriterionResult {
  let score = 0;
  const found: string[] = [];
  const missing: string[] = [];
  const recommendations: string[] = [];

  if (signals.hasDeadline) {
    score += 50;
    found.push('указан дедлайн или due date');
  } else {
    missing.push('нет дедлайна или due date');
    recommendations.push('Указать дату, дедлайн или момент, к которому нужен результат.');
  }

  if (signals.hasSprintOrRelease) {
    score += 30;
    found.push('указан спринт, релиз или период');
  } else {
    missing.push('нет спринта, релиза или периода');
    recommendations.push('Привязать задачу к спринту, релизу или периоду анализа.');
  }

  if (signals.hasTimeframe) {
    score += 20;
    found.push('есть временная рамка в тексте');
  } else {
    missing.push('нет временной рамки в описании');
    recommendations.push('Добавить временную рамку: "до конца спринта", "перед релизом", "за 2 дня".');
  }

  return buildCriterion('timeBound', score, found, missing, recommendations);
}

function buildEmptyCriterion(key: SmartCriterionKey): SmartCriterionResult {
  return buildCriterion(
    key,
    0,
    [],
    ['нет текста задачи для анализа'],
    ['Добавить title, контекст, ожидаемый результат, критерии приёмки и временное ограничение.']
  );
}

function collectTopRecommendations(criteria: SmartCriterionResult[]): string[] {
  const weakCriteria = criteria
    .filter((criterion) => criterion.status !== 'passed')
    .sort((a, b) => a.score - b.score);

  return unique(weakCriteria.flatMap((criterion) => criterion.recommendations)).slice(0, 5);
}

function buildSummary(totalScore: number, criteria: SmartCriterionResult[]): string {
  const failedOrWarning = criteria
    .filter((criterion) => criterion.status !== 'passed')
    .sort((a, b) => a.score - b.score);

  if (totalScore >= 80) {
    return 'Задача выглядит хорошо сформулированной по SMART: понятен результат, есть проверяемость и видна цель. Перед передачей в работу стоит только проверить слабые критерии, если они есть.';
  }

  if (totalScore >= 50) {
    const focus = failedOrWarning.slice(0, 2).map((criterion) => criterion.title).join(' и ');

    return `Задача выглядит частично понятной, но SMART-постановку стоит усилить. Перед передачей в разработку сфокусируйтесь на критериях: ${focus || 'измеримость и сроки'}.`;
  }

  const focus = failedOrWarning.slice(0, 3).map((criterion) => criterion.title).join(', ');

  return `Задача пока выглядит размытой как цель. Перед планированием стоит уточнить SMART-критерии: ${focus || 'конкретность, измеримость и срок'}.`;
}

export function analyzeSmartTask(input: SmartTaskInput): SmartAnalysisResult {
  const snapshot = buildSnapshot(input);

  if (!snapshot.text) {
    const criteria = CRITERION_ORDER.map(buildEmptyCriterion);

    return {
      totalScore: 0,
      status: 'weak',
      criteria,
      summary: 'Задача пустая: по ней нельзя понять результат, критерии успеха, ограничения, ценность и срок.',
      recommendations: collectTopRecommendations(criteria)
    };
  }

  const signals = collectSignals(snapshot);
  const criteria = [
    analyzeSpecific(signals),
    analyzeMeasurable(signals),
    analyzeAchievable(signals),
    analyzeRelevant(signals),
    analyzeTimeBound(signals)
  ];
  const totalScore = round(criteria.reduce((sum, criterion) => sum + criterion.score, 0) / criteria.length);

  return {
    totalScore,
    status: analysisStatus(totalScore),
    criteria,
    summary: buildSummary(totalScore, criteria),
    recommendations: collectTopRecommendations(criteria)
  };
}

export function getSmartCriterion(
  result: SmartAnalysisResult,
  key: SmartCriterionKey
): SmartCriterionResult | undefined {
  return result.criteria.find((criterion) => criterion.key === key);
}
