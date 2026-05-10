import fs from 'node:fs';

import {
  getStringArg,
  makeCliError,
  parseArgs,
  readJsonFile
} from './utils';

import type {
  AnalysisResult,
  TaskPayload
} from './types';

export function isReadyForTesting(payload: TaskPayload): boolean {
  const labels = payload.labels || [];
  const hasReadyLabel = labels.includes('ready-for-testing');
  const becameReadyForReview =
    payload.type === 'pr' &&
    payload.action === 'ready_for_review' &&
    payload.isDraft === false;

  return hasReadyLabel || becameReadyForReview;
}

function appendGitHubOutput(filePath: string, values: Record<string, string>): void {
  const lines = Object.entries(values)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  fs.appendFileSync(filePath, `${lines}\n`, 'utf8');
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const payloadPath = getStringArg(args, 'payload');
  const analysisPath = getStringArg(args, 'analysis');
  const githubOutputPath = getStringArg(args, 'github-output') || process.env.GITHUB_OUTPUT;

  if (!payloadPath) {
    throw makeCliError('Не передан аргумент --payload');
  }

  if (!analysisPath) {
    throw makeCliError('Не передан аргумент --analysis');
  }

  if (!githubOutputPath) {
    throw makeCliError('Не передан путь к GITHUB_OUTPUT');
  }

  const payload = readJsonFile<TaskPayload>(payloadPath);
  const analysis = readJsonFile<AnalysisResult>(analysisPath);

  appendGitHubOutput(githubOutputPath, {
    has_errors: analysis.hasErrors ? 'true' : 'false',
    is_ready: isReadyForTesting(payload) ? 'true' : 'false'
  });
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
} 
