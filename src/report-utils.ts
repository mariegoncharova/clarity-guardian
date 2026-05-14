import path from 'node:path';

import {
  makeCliError,
  writeTextFile
} from './utils';

export type ReportFormat = 'markdown' | 'json' | 'csv';

export function inferReportFormat(outputPath: string, explicitFormat?: string): ReportFormat {
  if (explicitFormat && explicitFormat !== 'markdown' && explicitFormat !== 'json' && explicitFormat !== 'csv') {
    throw makeCliError(`Неподдерживаемый формат отчёта: ${explicitFormat}`);
  }

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

  throw makeCliError('Неподдерживаемый формат отчёта: укажи --format markdown|json|csv или output с расширением .md, .json, .csv');
}

export function tableCell(value: unknown): string {
  return String(value ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/\|/g, '\\|');
}

export function csvEscape(value: unknown): string {
  const text = String(value ?? '');

  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export function writeReport(outputPath: string, content: string): void {
  writeTextFile(outputPath, content);
}
