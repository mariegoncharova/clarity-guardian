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
    '# Risk Detection Report',
    '',
    '## Summary',
    '',
    `- Всего задач: ${items.length}`,
    `- High risk: ${items.filter((item) => item.riskLevel === 'high').length}`,
    `- Medium risk: ${items.filter((item) => item.riskLevel === 'medium').length}`,
    `- Low risk: ${items.filter((item) => item.riskLevel === 'low').length}`,
    '',
    '## Risk Tasks',
    '',
    '| Task | Title | Risk Level | Risk Score | Risk Factors | Recommendation |',
    '| --- | --- | --- | ---: | --- | --- |',
    ...items.map((item) =>
      `| ${tableCell(item.taskId)} | ${tableCell(item.title)} | ${item.riskLevel} | ${item.riskScore} | ${tableCell(item.riskFactors.join('; '))} | ${tableCell(item.recommendation)} |`
    )
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
    'riskFactors',
    'recommendation'
  ];
  const rows = items.map((item) => [
    item.taskId,
    item.title,
    item.riskLevel,
    item.riskScore,
    item.riskFactors.join('|'),
    item.recommendation
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

  if (!inputPath) {
    throw makeCliError('Не передан аргумент --input');
  }

  if (!outputPath) {
    throw makeCliError('Не передан аргумент --output');
  }

  const format = inferReportFormat(outputPath, getStringArg(args, 'format'));
  const tasks = normalizeUnifiedTasks(readJsonFile<unknown>(inputPath));
  const report = analyzeRisks(tasks);

  writeReport(outputPath, formatRiskReport(report, format));
  process.stdout.write(`Отчёт Risk Detection сохранён: ${outputPath}\n`);
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
