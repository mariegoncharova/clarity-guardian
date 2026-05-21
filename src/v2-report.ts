import fs from 'node:fs';
import path from 'node:path';

import {
  analyzeUnifiedTasks,
  buildDashboard,
  buildResearchData,
  buildTaskScoreHistory,
  compareBeforeAfter,
  writeHistoryJsonl
} from './analytics';
import {
  loadConfig
} from './config';
import {
  buildDecisionLedgerReport,
  formatDecisionLedgerMarkdown
} from './decision-ledger';
import {
  buildQuickBugFixReport,
  formatQuickBugFixMarkdown
} from './quick-bug-fix';
import {
  formatDashboardHtml,
  formatDashboardMarkdown,
  formatResearchReportMarkdown,
  formatRetroReportMarkdown,
  formatTasksCsv
} from './reports';
import {
  buildRefinementAgendaReport,
  formatRefinementAgendaMarkdown
} from './refinement-agenda';
import {
  buildStakeholderUpdateReport,
  formatStakeholderUpdateMarkdown
} from './stakeholder-update';
import { normalizeUnifiedTasks } from './task-model';
import {
  buildTaskHealthReport,
  formatTaskHealthMarkdown
} from './task-health-profile';
import { createYandexTrackerProviderFromEnv } from './yandex-tracker';
import {
  getStringArg,
  makeCliError,
  parseArgs,
  readJsonFile,
  writeJsonFile,
  writeTextFile
} from './utils';

import type {
  UnifiedTask
} from './types';

const DEFAULT_DEMO_DATA_PATH = 'data/demo-tasks.json';
const DEFAULT_OUT_DIR = 'reports/demo';

function ensureDir(dirPath: string): void {
  fs.mkdirSync(path.resolve(process.cwd(), dirPath), { recursive: true });
}

function resolveOutputPath(outDir: string, fileName: string): string {
  return path.join(outDir, fileName);
}

function loadTasksFromFile(filePath: string): UnifiedTask[] {
  return normalizeUnifiedTasks(readJsonFile<unknown>(filePath));
}

async function loadTasks(args: Record<string, string | boolean>): Promise<UnifiedTask[]> {
  const inputPath = getStringArg(args, 'input');
  const source = getStringArg(args, 'source');
  const demo = args.demo === true || source === 'demo';

  if (demo) {
    return loadTasksFromFile(getStringArg(args, 'demo-data') || DEFAULT_DEMO_DATA_PATH);
  }

  if (source === 'yandex') {
    return createYandexTrackerProviderFromEnv({
      project: getStringArg(args, 'project'),
      queue: getStringArg(args, 'queue'),
      query: getStringArg(args, 'query'),
      keys: getStringArg(args, 'keys')?.split(',').map((key) => key.trim()).filter(Boolean)
    }).listTasks();
  }

  if (inputPath) {
    return loadTasksFromFile(inputPath);
  }

  throw makeCliError('Передай --demo, --source yandex или --input tasks.json');
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const outDir = getStringArg(args, 'out-dir') || DEFAULT_OUT_DIR;
  const analyzedAt = getStringArg(args, 'analyzed-at') || new Date().toISOString();
  const config = loadConfig(getStringArg(args, 'config'));
  const tasks = await loadTasks(args);

  ensureDir(outDir);

  const records = analyzeUnifiedTasks(tasks, { analyzedAt, config });
  const dashboard = buildDashboard(records);
  const comparison = compareBeforeAfter(records);
  const research = buildResearchData(records);
  const decisionLedger = buildDecisionLedgerReport(records);
  const quickBugFix = buildQuickBugFixReport(records, { includeNeedsReview: true });
  const taskHealth = buildTaskHealthReport(records, {
    includeHealthy: true,
    riskThresholds: config.riskThresholds
  });
  const refinementAgenda = buildRefinementAgendaReport(records, {
    includeReady: true,
    includeDone: true
  });
  const stakeholderUpdate = buildStakeholderUpdateReport(records);

  writeJsonFile(resolveOutputPath(outDir, 'dashboard.json'), dashboard);
  writeJsonFile(resolveOutputPath(outDir, 'before-after.json'), comparison);
  writeJsonFile(resolveOutputPath(outDir, 'task-history.json'), buildTaskScoreHistory(records));
  writeJsonFile(resolveOutputPath(outDir, 'analysis-records.json'), records);
  writeJsonFile(resolveOutputPath(outDir, 'decision-ledger.json'), decisionLedger);
  writeJsonFile(resolveOutputPath(outDir, 'quick-bug-fix.json'), quickBugFix);
  writeJsonFile(resolveOutputPath(outDir, 'task-health-profile.json'), taskHealth);
  writeJsonFile(resolveOutputPath(outDir, 'refinement-agenda.json'), refinementAgenda);
  writeJsonFile(resolveOutputPath(outDir, 'stakeholder-update.json'), stakeholderUpdate);
  writeHistoryJsonl(resolveOutputPath(outDir, 'clarity-history.jsonl'), records);
  writeTextFile(resolveOutputPath(outDir, 'dashboard.md'), formatDashboardMarkdown(dashboard));
  writeTextFile(resolveOutputPath(outDir, 'dashboard.html'), formatDashboardHtml(dashboard));
  writeTextFile(resolveOutputPath(outDir, 'retro-report.md'), formatRetroReportMarkdown(dashboard, comparison));
  writeTextFile(resolveOutputPath(outDir, 'research-report.md'), formatResearchReportMarkdown(research));
  writeTextFile(resolveOutputPath(outDir, 'decision-ledger.md'), formatDecisionLedgerMarkdown(decisionLedger));
  writeTextFile(resolveOutputPath(outDir, 'quick-bug-fix.md'), formatQuickBugFixMarkdown(quickBugFix));
  writeTextFile(resolveOutputPath(outDir, 'task-health-profile.md'), formatTaskHealthMarkdown(taskHealth));
  writeTextFile(resolveOutputPath(outDir, 'refinement-agenda.md'), formatRefinementAgendaMarkdown(refinementAgenda));
  writeTextFile(resolveOutputPath(outDir, 'stakeholder-update.md'), formatStakeholderUpdateMarkdown(stakeholderUpdate));
  writeTextFile(resolveOutputPath(outDir, 'tasks.csv'), formatTasksCsv(records));

  process.stdout.write(`Clarity Guardian V2 report generated in ${outDir}\n`);
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
