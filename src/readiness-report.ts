import {
  csvEscape,
  inferReportFormat,
  tableCell,
  writeReport
} from './report-utils';
import {
  analyzeReadiness
} from './readiness/analyzer';
import {
  normalizeUnifiedTasks
} from './task-model';
import {
  getStringArg,
  makeCliError,
  parseArgs,
  readJsonFile
} from './utils';

import type {
  ReadinessAnalytics
} from './readiness/models';

function formatReadinessMarkdown(items: ReadinessAnalytics[]): string {
  return [
    '# Definition of Ready / Definition of Done Report',
    '',
    '## Summary',
    '',
    `- Всего задач: ${items.length}`,
    `- DoR passed: ${items.filter((item) => item.dor.dorPassed).length}`,
    `- DoD passed: ${items.filter((item) => item.dod.dodPassed).length}`,
    '',
    '## Definition of Ready',
    '',
    '| Task | Title | DoR Score | Passed | Failed Checks | Recommendation |',
    '| --- | --- | ---: | --- | --- | --- |',
    ...items.map((item) =>
      `| ${tableCell(item.taskId)} | ${tableCell(item.title)} | ${item.dor.dorScore} | ${item.dor.dorPassed ? 'yes' : 'no'} | ${tableCell(item.dor.failedChecks.join('; '))} | ${tableCell(item.dor.recommendation)} |`
    ),
    '',
    '## Definition of Done',
    '',
    '| Task | Title | DoD Score | Passed | Failed Checks | Recommendation |',
    '| --- | --- | ---: | --- | --- | --- |',
    ...items.map((item) =>
      `| ${tableCell(item.taskId)} | ${tableCell(item.title)} | ${item.dod.dodScore} | ${item.dod.dodPassed ? 'yes' : 'no'} | ${tableCell(item.dod.failedChecks.join('; '))} | ${tableCell(item.dod.recommendation)} |`
    )
  ].join('\n');
}

function formatReadinessJson(items: ReadinessAnalytics[]): string {
  return JSON.stringify({
    summary: {
      totalTasks: items.length,
      dorPassed: items.filter((item) => item.dor.dorPassed).length,
      dodPassed: items.filter((item) => item.dod.dodPassed).length
    },
    taskLevelAnalytics: items
  }, null, 2);
}

function formatReadinessCsv(items: ReadinessAnalytics[]): string {
  const header = [
    'taskId',
    'title',
    'dorPassed',
    'dorScore',
    'dorFailedChecks',
    'dodPassed',
    'dodScore',
    'dodFailedChecks'
  ];
  const rows = items.map((item) => [
    item.taskId,
    item.title,
    item.dor.dorPassed,
    item.dor.dorScore,
    item.dor.failedChecks.join('|'),
    item.dod.dodPassed,
    item.dod.dodScore,
    item.dod.failedChecks.join('|')
  ]);

  return [
    header.map(csvEscape).join(','),
    ...rows.map((row) => row.map(csvEscape).join(','))
  ].join('\n');
}

function formatReadinessReport(items: ReadinessAnalytics[], format: string): string {
  if (format === 'json') {
    return formatReadinessJson(items);
  }

  if (format === 'csv') {
    return formatReadinessCsv(items);
  }

  return formatReadinessMarkdown(items);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const inputPath = getStringArg(args, 'input');
  const outputPath = getStringArg(args, 'output');

  if (!inputPath) {
    throw makeCliError('Не передан аргумент --input');
  }

  if (!outputPath) {
    throw makeCliError('Не передан аргумент --output');
  }

  const format = inferReportFormat(outputPath, getStringArg(args, 'format'));
  const tasks = normalizeUnifiedTasks(readJsonFile<unknown>(inputPath));
  const report = analyzeReadiness(tasks);

  writeReport(outputPath, formatReadinessReport(report, format));
  process.stdout.write(`Отчёт Definition of Ready / Done сохранён: ${outputPath}\n`);
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
