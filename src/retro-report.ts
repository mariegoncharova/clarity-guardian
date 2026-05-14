import path from 'node:path';

import { analyzeRetroTasks } from './retro-analyzer';
import { formatRetroCsvReport } from './retro-report-csv';
import { formatRetroJsonReport } from './retro-report-json';
import { formatRetroMarkdownReport } from './retro-report-markdown';
import { normalizeUnifiedTasks } from './task-model';
import {
  getStringArg,
  makeCliError,
  parseArgs,
  readJsonFile,
  writeTextFile
} from './utils';

type RetroReportFormat = 'markdown' | 'json' | 'csv';

function inferFormat(outputPath: string, explicitFormat?: string): RetroReportFormat {
  if (explicitFormat === 'markdown' || explicitFormat === 'json' || explicitFormat === 'csv') {
    return explicitFormat;
  }

  const extension = path.extname(outputPath).toLowerCase();

  if (extension === '.md') {
    return 'markdown';
  }

  if (extension === '.json') {
    return 'json';
  }

  if (extension === '.csv') {
    return 'csv';
  }

  return 'markdown';
}

function formatReport(format: RetroReportFormat, input: unknown): string {
  const tasks = normalizeUnifiedTasks(input);
  const report = analyzeRetroTasks(tasks);

  if (format === 'json') {
    return formatRetroJsonReport(report);
  }

  if (format === 'csv') {
    return formatRetroCsvReport(report);
  }

  return formatRetroMarkdownReport(report);
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

  const format = inferFormat(outputPath, getStringArg(args, 'format'));
  const output = formatReport(format, readJsonFile<unknown>(inputPath));

  writeTextFile(outputPath, output);
  process.stdout.write(`Отчёт Retro Task Analytics сохранён: ${outputPath}\n`);
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
