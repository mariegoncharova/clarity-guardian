import { analyzeUnifiedTasks } from './analytics';
import { inferReportFormat, tableCell, writeReport } from './report-utils';
import { normalizeUnifiedTasks } from './task-model';
import {
  BLOCKER_KEYWORDS,
  findKeywords,
  getAcceptanceCriteria,
  getContext,
  getExecutionDetails,
  getExpectedResult,
  getTaskId,
  getTaskText,
  hasAcceptanceCriteria,
  hasContext,
  hasExpectedResult,
  isDoneStatus,
  RISKY_DOMAIN_KEYWORDS
} from './task-signals';
import { extractFirstMarkdownSection, getStringArg, makeCliError, parseArgs, readJsonFile } from './utils';
import type { TaskAnalysisRecord } from './types';

type HandoffStatus = 'ready_for_agent' | 'needs_clarification' | 'human_review';

const STATUS_LABELS: Record<HandoffStatus, string> = {
  ready_for_agent: 'Готово к передаче',
  needs_clarification: 'Нужно уточнить',
  human_review: 'Нужна проверка человеком'
};

function hasInstruction(value: string): boolean {
  return value.trim().length >= 20;
}

function isRepositoryReference(value: string): boolean {
  return value.toLowerCase() !== 'n/a'
    && /^(?:https?:\/\/[^/\s]+\/|git@[^:\s]+:)?[\w.-]+(?:\/[\w.-]+)+\/?$/.test(value);
}

function analyzeHandoff(record: TaskAnalysisRecord) {
  const { task } = record;
  const { repository, scope, verification } = getExecutionDetails(task);
  const brief = {
    repository,
    context: getContext(task),
    expectedResult: getExpectedResult(task),
    scope,
    acceptanceCriteria: getAcceptanceCriteria(task),
    verification
  };
  const missing = [
    !hasContext(task) && 'Какая проблема или пользовательский сценарий стоит за задачей?',
    !hasExpectedResult(task) && 'Какое поведение должно измениться?',
    !isRepositoryReference(repository) && 'В каком репозитории нужно работать? Укажи ссылку или owner/repo.',
    !hasInstruction(scope) && 'Что входит в задачу и какие части проекта следует оставить без изменений?',
    !hasAcceptanceCriteria(task) && 'По каким критериям PM и QA примут результат?',
    !hasInstruction(verification) && 'Как воспроизвести проверку результата?'
  ].filter((item): item is string => Boolean(item));
  const riskyDomains = findKeywords([getTaskText(task), scope, verification].join('\n'), RISKY_DOMAIN_KEYWORDS);
  const blockerSignals = [
    task.status,
    ...(task.labels || []),
    ...(task.tags || []),
    extractFirstMarkdownSection(task.body, ['Blockers', 'Блокеры'])
  ].filter(Boolean).join('\n');
  const reviewReasons = [
    riskyDomains.length > 0 && `Рискованные области: ${riskyDomains.join(', ')}.`,
    findKeywords(blockerSignals, BLOCKER_KEYWORDS).length > 0 && 'В задаче есть открытый блокер.',
    record.riskLevel === 'high' && missing.length === 0 && 'Риск выполнения задачи оценён как высокий.'
  ].filter((item): item is string => Boolean(item));
  const status: HandoffStatus = reviewReasons.length > 0
    ? 'human_review'
    : missing.length > 0 ? 'needs_clarification' : 'ready_for_agent';

  return {
    taskId: getTaskId(task),
    title: task.title,
    source: task.source,
    project: task.projectKey || task.queue,
    status,
    questions: missing,
    reviewReasons,
    brief: status === 'ready_for_agent' ? brief : undefined
  };
}

export function buildAgentHandoffReport(records: TaskAnalysisRecord[]) {
  const items = records
    .filter(({ task }) => !isDoneStatus(task.status))
    .map(analyzeHandoff);

  return {
    activeTasks: items.length,
    summary: {
      readyForAgent: items.filter(({ status }) => status === 'ready_for_agent').length,
      needsClarification: items.filter(({ status }) => status === 'needs_clarification').length,
      humanReview: items.filter(({ status }) => status === 'human_review').length
    },
    items
  };
}

export function formatAgentHandoffMarkdown(report: ReturnType<typeof buildAgentHandoffReport>): string {
  return [
    '# Передача задач AI-агенту',
    '',
    'Локальная проверка постановки задачи. Владелец проекта подтверждает передачу, а человек проверяет результат перед приёмкой.',
    '',
    `- Готово к передаче: ${report.summary.readyForAgent}`,
    `- Нужно уточнить: ${report.summary.needsClarification}`,
    `- Нужна проверка человеком: ${report.summary.humanReview}`,
    ...report.items.flatMap((item) => [
      '',
      `## ${tableCell(item.taskId)} — ${tableCell(item.title)}`,
      '',
      `**${STATUS_LABELS[item.status]}**`,
      ...item.reviewReasons.map((reason) => `- ${reason}`),
      ...item.questions.map((question) => `- ${question}`),
      ...(item.brief ? [
        '',
        `- Репозиторий: ${tableCell(item.brief.repository)}`,
        `- Контекст: ${tableCell(item.brief.context)}`,
        `- Ожидаемый результат: ${tableCell(item.brief.expectedResult)}`,
        `- Объём работ: ${tableCell(item.brief.scope)}`,
        `- Критерии приёмки: ${item.brief.acceptanceCriteria.map(tableCell).join(' / ')}`,
        `- План проверки: ${tableCell(item.brief.verification)}`
      ] : [])
    ]),
    ''
  ].join('\n');
}

if (require.main === module) {
  try {
    const args = parseArgs(process.argv);
    const input = getStringArg(args, 'input');
    const output = getStringArg(args, 'output');

    if (!input || !output) {
      throw makeCliError('Укажи --input tasks.json и --output report.md|report.json');
    }

    const format = inferReportFormat(output, getStringArg(args, 'format'));

    if (format === 'csv') {
      throw makeCliError('Для передачи задач поддерживаются форматы markdown и json');
    }

    const tasks = normalizeUnifiedTasks(readJsonFile(input));
    const report = buildAgentHandoffReport(analyzeUnifiedTasks(tasks));
    writeReport(output, format === 'json' ? JSON.stringify(report, null, 2) : formatAgentHandoffMarkdown(report));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
