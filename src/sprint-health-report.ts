import {
  inferReportFormat,
  writeReport
} from './report-utils';
import {
  analyzeSprintHealth
} from './sprint-health/analyzer';
import {
  formatSprintHealthCsv
} from './sprint-health/report-csv';
import {
  formatSprintHealthJson
} from './sprint-health/report-json';
import {
  formatSprintHealthMarkdown
} from './sprint-health/report-markdown';
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
  SprintHealthReport
} from './sprint-health/models';

function formatReport(report: SprintHealthReport, format: string): string {
  if (format === 'json') {
    return formatSprintHealthJson(report);
  }

  if (format === 'csv') {
    return formatSprintHealthCsv(report);
  }

  return formatSprintHealthMarkdown(report);
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
  const sprint = getStringArg(args, 'sprint');
  const tasks = normalizeUnifiedTasks(readJsonFile<unknown>(inputPath));
  const report = analyzeSprintHealth(tasks, sprint);

  writeReport(outputPath, formatReport(report, format));
  process.stdout.write(`Отчёт Sprint Health сохранён: ${outputPath}\n`);
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
