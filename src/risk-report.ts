import {
  loadConfig
} from './config';
import {
  inferReportFormat,
  csvEscape,
  tableCell,
  writeReport
} from './report-utils';
import {
  analyzeRisks
} from './risk/analyzer';
import {
  formatRiskReportSections
} from './risk/risk-report';
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
  RiskAnalysis
} from './risk/models';

function formatRiskMarkdown(items: RiskAnalysis[]): string {
  return [
    '# Risk Radar Report',
    '',
    '_Legacy report name: Risk Detection Report_',
    '',
    '## Summary',
    '',
    `- Всего задач: ${items.length}`,
    `- High risk: ${items.filter((item) => item.riskLevel === 'high').length}`,
    `- Medium risk: ${items.filter((item) => item.riskLevel === 'medium').length}`,
    `- Low risk: ${items.filter((item) => item.riskLevel === 'low').length}`,
    '',
    '## Task Risk Table',
    '',
    '| Task | Title | Risk Level | Risk Score | Categories | Recommendation |',
    '| --- | --- | --- | ---: | --- | --- |',
    ...items.map((item) =>
      `| ${tableCell(item.taskId)} | ${tableCell(item.title)} | ${item.riskLevel} | ${item.riskScore} | ${tableCell(item.categories.join('; '))} | ${tableCell(item.recommendation)} |`
    ),
    '',
    '---',
    '',
    ...items.flatMap((item, index) => [
      index > 0 ? '\n---\n' : '',
      formatRiskReportSections(item)
    ])
  ].join('\n');
}

function formatRiskJson(items: RiskAnalysis[]): string {
  return JSON.stringify({
    summary: {
      totalTasks: items.length,
      highRiskTasks: items.filter((item) => item.riskLevel === 'high').length,
      mediumRiskTasks: items.filter((item) => item.riskLevel === 'medium').length,
      lowRiskTasks: items.filter((item) => item.riskLevel === 'low').length
    },
    taskLevelAnalytics: items
  }, null, 2);
}

function formatRiskCsv(items: RiskAnalysis[]): string {
  const header = [
    'taskId',
    'title',
    'riskLevel',
    'riskScore',
    'categories',
    'riskFactors',
    'recommendation',
    'qaNotes'
  ];
  const rows = items.map((item) => [
    item.taskId,
    item.title,
    item.riskLevel,
    item.riskScore,
    item.categories.join('|'),
    item.riskFactors.join('|'),
    item.recommendation,
    item.qaNotes.join('|')
  ]);

  return [
    header.map(csvEscape).join(','),
    ...rows.map((row) => row.map(csvEscape).join(','))
  ].join('\n');
}

function formatRiskReport(items: RiskAnalysis[], format: string): string {
  if (format === 'json') {
    return formatRiskJson(items);
  }

  if (format === 'csv') {
    return formatRiskCsv(items);
  }

  return formatRiskMarkdown(items);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const inputPath = getStringArg(args, 'input');
  const outputPath = getStringArg(args, 'output');
  const config = loadConfig(getStringArg(args, 'config'));

  if (!inputPath) {
    throw makeCliError('Не передан аргумент --input');
  }

  if (!outputPath) {
    throw makeCliError('Не передан аргумент --output');
  }

  const format = inferReportFormat(outputPath, getStringArg(args, 'format'));
  const tasks = normalizeUnifiedTasks(readJsonFile<unknown>(inputPath));
  const report = analyzeRisks(tasks, { thresholds: config.riskThresholds });

  writeReport(outputPath, formatRiskReport(report, format));
  process.stdout.write(`Отчёт Risk Radar сохранён: ${outputPath}\n`);
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
