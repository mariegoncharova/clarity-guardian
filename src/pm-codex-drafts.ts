import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import path from 'node:path';
import { PM_AGENT_TOOLS, createPmAgentTools } from './pm-agent-tools';
import { TASK_DRAFT_SCHEMA, validateTaskDrafts } from './pm-task-drafts';
import { writeReport } from './report-utils';
import { isTaskRow } from './task-model';
import { makeCliError, readJsonFile } from './utils';

const DATASET_SCHEMA = {
  type: 'string',
  enum: ['working', 'demo'],
  description: 'Use working for the local export. Use demo only for an explicitly requested demo.'
};

export const CODEX_PM_TOOLS = [
  ...PM_AGENT_TOOLS.map((tool) => ({
    ...tool,
    parameters: {
      ...tool.parameters,
      properties: { ...tool.parameters.properties, dataset: DATASET_SCHEMA },
      required: [...tool.parameters.required, 'dataset']
    }
  })),
  {
    name: 'save_drafts',
    description: 'Validate meeting action drafts against the exact notes and reviewed backlog snapshot. Writes a new local JSON for review.',
    parameters: {
      type: 'object',
      properties: {
        dataset: DATASET_SCHEMA,
        snapshotId: { type: 'string', description: 'Snapshot ID returned by list_tasks and the task review tools.' },
        notes: { type: 'string', description: 'Original meeting notes. Preserve the exact text.' },
        drafts: TASK_DRAFT_SCHEMA
      },
      required: ['dataset', 'snapshotId', 'notes', 'drafts'],
      additionalProperties: false
    }
  }
];

type Dataset = 'working' | 'demo';
type Snapshot = {
  id: string;
  tools: ReturnType<typeof createPmAgentTools>;
  searched: boolean;
  retrieved: Set<string>;
};

export function createCodexDraftTools(projectDir: string) {
  const snapshots = new Map<Dataset, Snapshot>();

  function load(dataset: Dataset): Snapshot {
    const tasksPath = path.join(projectDir, 'data', dataset === 'demo' ? 'demo-tasks.json' : 'local/tasks.json');
    const baselinePath = path.join(projectDir, 'data', dataset === 'demo' ? 'demo-scope-baseline.json' : 'local/approved.json');

    if (dataset === 'working' && !existsSync(tasksPath)) {
      throw makeCliError('Положи JSON-выгрузку бэклога в data/local/tasks.json. Для примера выбери dataset=demo.');
    }

    const tasks = readJsonFile(tasksPath);
    const baseline = existsSync(baselinePath) ? readJsonFile(baselinePath) : undefined;
    const id = createHash('sha256').update(JSON.stringify([dataset, tasks, baseline])).digest('hex');
    const previous = snapshots.get(dataset);

    if (previous?.id === id) {
      return previous;
    }

    const snapshot: Snapshot = { id, tools: createPmAgentTools(tasks, baseline), searched: false, retrieved: new Set() };
    snapshots.set(dataset, snapshot);
    return snapshot;
  }

  return {
    call(name: string, args: unknown) {
      if (!isTaskRow(args) || (args.dataset !== 'working' && args.dataset !== 'demo')) {
        throw makeCliError('Укажи dataset=working или dataset=demo.');
      }

      const snapshot = load(args.dataset);

      if (name !== 'save_drafts') {
        const result = snapshot.tools.call(name, args);

        if (!('error' in result.data)) {
          if (name === 'list_tasks') {
            snapshot.searched = true;
          }
          result.refs.forEach((ref) => snapshot.retrieved.add(ref));
        }

        return { ...result.data, snapshotId: snapshot.id, taskRefs: result.refs };
      }

      if (args.snapshotId !== snapshot.id || !snapshot.searched) {
        throw makeCliError('Нужен актуальный поиск по бэклогу. Вызови list_tasks и повтори сверку.');
      }
      if (typeof args.notes !== 'string' || !args.notes.trim()) {
        throw makeCliError('Передай исходный текст заметок.');
      }

      const drafts = validateTaskDrafts(args.drafts, args.notes, snapshot.tools.sources, snapshot.retrieved);
      const reportsDir = path.join(projectDir, 'reports', 'codex');
      mkdirSync(reportsDir, { recursive: true });
      const outputPath = path.join(mkdtempSync(path.join(reportsDir, 'meeting-')), 'backlog-drafts.json');
      writeReport(outputPath, `${JSON.stringify({ status: 'review_required', drafts }, null, 2)}\n`);
      return { path: path.relative(projectDir, outputPath), status: 'review_required', savedDrafts: drafts.length };
    }
  };
}
