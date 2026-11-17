import { inferReportFormat, tableCell, writeReport } from './report-utils';
import { getStableTaskId, getTaskRows, isTaskRow, normalizeTaskRow } from './task-model';
import { getAcceptanceCriteria, getContext, getExecutionDetails, getExpectedResult, getTaskId } from './task-signals';
import { getStringArg, makeCliError, parseArgs, readJsonFile } from './utils';
import type { UnifiedTask } from './types';

export const CHANGE_REVIEW_FIELD_LABELS = {
  title: 'Название',
  repository: 'Репозиторий',
  context: 'Контекст',
  expectedResult: 'Ожидаемый результат',
  scope: 'Объём работ',
  acceptanceCriteria: 'Критерии приёмки',
  verification: 'План проверки',
  body: 'Текст описания',
  dependencies: 'Зависимости',
  deadline: 'Срок',
  assignee: 'Ответственный'
};

type ReviewedField = keyof typeof CHANGE_REVIEW_FIELD_LABELS;
type ChangeValue = string | string[];

function normalizeList(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function getReviewedFields(task: UnifiedTask): Record<ReviewedField, ChangeValue> {
  return {
    title: task.title,
    ...getExecutionDetails(task),
    context: getContext(task),
    expectedResult: getExpectedResult(task),
    acceptanceCriteria: normalizeList(getAcceptanceCriteria(task)),
    body: task.body,
    dependencies: normalizeList(task.dependencies || []),
    deadline: task.deadline || task.dueDate || '',
    assignee: task.assignee || ''
  };
}

function indexSnapshot(snapshot: unknown, label: string): Map<string, UnifiedTask> {
  const rows = getTaskRows(snapshot);

  if (!rows) {
    throw makeCliError(`${label}: ожидается массив задач или объект с полем tasks.`);
  }

  const tasks = new Map<string, UnifiedTask>();

  for (const [index, row] of rows.entries()) {
    const task = isTaskRow(row) ? normalizeTaskRow(row, index) : undefined;

    if (!task || !isTaskRow(row) || !getStableTaskId(row)) {
      throw makeCliError(`${label}, строка ${index + 1}: нужны id или key и содержимое задачи.`);
    }

    const project = task.projectKey || task.queue || task.repository || '';
    const identity = JSON.stringify([task.source, project, task.id]);

    if (tasks.has(identity)) {
      throw makeCliError(`${label}, строка ${index + 1}: повторяется идентификатор ${task.id} (${task.source}/${project}).`);
    }

    tasks.set(identity, task);
  }

  return tasks;
}

function identifyTask(task: UnifiedTask) {
  return {
    id: task.id,
    taskId: getTaskId(task),
    title: task.title,
    source: task.source,
    project: task.projectKey || task.queue || task.repository
  };
}

function compareTasks(previous: UnifiedTask, current: UnifiedTask) {
  const before = getReviewedFields(previous);
  const after = getReviewedFields(current);

  return (Object.keys(CHANGE_REVIEW_FIELD_LABELS) as ReviewedField[])
    .filter((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]))
    .map((field) => ({ field, before: before[field], after: after[field] }));
}

export function buildChangeReview(baseline: unknown, input: unknown) {
  const approved = indexSnapshot(baseline, 'Согласованный снимок');
  const current = indexSnapshot(input, 'Текущий снимок');
  const added = [];
  const missing = [];
  const changed = [];
  let unchanged = 0;

  for (const [identity, task] of current) {
    const previous = approved.get(identity);

    if (!previous) {
      added.push(identifyTask(task));
      continue;
    }

    const changes = compareTasks(previous, task);

    if (changes.length > 0) {
      changed.push({ ...identifyTask(task), changes });
    } else {
      unchanged += 1;
    }
  }

  for (const [identity, task] of approved) {
    if (!current.has(identity)) {
      missing.push(identifyTask(task));
    }
  }

  return {
    summary: {
      baselineTasks: approved.size,
      currentTasks: current.size,
      changed: changed.length,
      added: added.length,
      missing: missing.length,
      unchanged
    },
    changed,
    added,
    missing
  };
}

function displayTask(task: ReturnType<typeof identifyTask>): string {
  return tableCell([task.project || task.source, task.taskId, task.title].filter(Boolean).join(' · '));
}

function displayValue(value: ChangeValue): string {
  return tableCell(Array.isArray(value) ? value.join(' / ') : value) || '—';
}

export function formatChangeReviewMarkdown(report: ReturnType<typeof buildChangeReview>): string {
  const { summary } = report;
  return [
    '# Изменения после согласования',
    '',
    `Согласованный снимок: ${summary.baselineTasks} задач. Текущий снимок: ${summary.currentTasks}.`,
    '',
    `- Изменились: ${summary.changed}`,
    `- Добавились: ${summary.added}`,
    `- Отсутствуют в текущем снимке: ${summary.missing}`,
    `- Без изменений: ${summary.unchanged}`,
    '',
    'PM уточняет у разработки и QA влияние изменений на сроки и проверку, затем сверяет новый объём с заказчиком. Для отсутствующих задач сначала проверьте фильтры выгрузки.',
    ...report.changed.flatMap((task) => [
      '',
      `## ${displayTask(task)}`,
      '',
      '| Поле | Было | Стало |',
      '| --- | --- | --- |',
      ...task.changes.map(({ field, before, after }) =>
        `| ${CHANGE_REVIEW_FIELD_LABELS[field]} | ${displayValue(before)} | ${displayValue(after)} |`
      )
    ]),
    ...(report.added.length > 0 ? ['', '## Новые задачи', '', ...report.added.map((task) => `- ${displayTask(task)}`)] : []),
    ...(report.missing.length > 0 ? ['', '## Отсутствуют в текущем снимке', '', ...report.missing.map((task) => `- ${displayTask(task)}`)] : []),
    ''
  ].join('\n');
}

if (require.main === module) {
  try {
    const args = parseArgs(process.argv);
    const baseline = getStringArg(args, 'baseline');
    const input = getStringArg(args, 'input');
    const output = getStringArg(args, 'output');

    if (!baseline || !input || !output) {
      throw makeCliError('Укажи --baseline approved.json, --input current.json и --output report.md|report.json');
    }

    const format = inferReportFormat(output, getStringArg(args, 'format'));

    if (format === 'csv') {
      throw makeCliError('Для сравнения снимков поддерживаются форматы markdown и json');
    }

    const report = buildChangeReview(readJsonFile(baseline), readJsonFile(input));
    writeReport(output, format === 'json' ? JSON.stringify(report, null, 2) : formatChangeReviewMarkdown(report));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
