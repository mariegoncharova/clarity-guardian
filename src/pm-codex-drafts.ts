import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import type { fromJsonSchema } from '@modelcontextprotocol/server';
import { PM_AGENT_TOOLS, createPmAgentTools } from './pm-agent-tools';
import { TASK_DRAFT_SCHEMA, validateMeetingQuestions, validateTaskDrafts } from './pm-task-drafts';
import { formatMeetingReview, listMeetings, readMeeting, recheckMeeting, type Dataset, type MeetingQueue } from './pm-meeting-review';
import { writeReport } from './report-utils';
import { isTaskRow } from './task-model';
import { makeCliError, readJsonFile } from './utils';

const DATASET_SCHEMA = {
  type: 'string',
  enum: ['working', 'demo'],
  description: 'Use working for the local export. Use demo only for an explicitly requested demo.'
};

export const CODEX_PM_TOOLS: Array<{
  name: string;
  description: string;
  parameters: Parameters<typeof fromJsonSchema>[0];
}> = [
  ...PM_AGENT_TOOLS.map((tool) => ({
    ...tool,
    parameters: {
      ...tool.parameters,
      properties: { ...tool.parameters.properties, dataset: DATASET_SCHEMA },
      required: [...tool.parameters.required, 'dataset']
    }
  })),
  {
    name: 'list_meetings',
    description: 'Find saved meeting reviews in newest-first order, including recorded open questions. Start at offset 0.',
    parameters: {
      type: 'object',
      properties: { dataset: DATASET_SCHEMA, offset: { type: 'integer', minimum: 0 } },
      required: ['dataset', 'offset'],
      additionalProperties: false
    }
  },
  {
    name: 'recheck_drafts',
    description: 'Compare saved meeting drafts to the latest backlog before transferring them. Flags changed or missing tasks and exact title conflicts for new cards.',
    parameters: {
      type: 'object',
      properties: { dataset: DATASET_SCHEMA, meetingId: { type: 'string', description: 'Meeting ID returned by save_drafts or list_meetings.' } },
      required: ['dataset', 'meetingId'],
      additionalProperties: false
    }
  },
  {
    name: 'save_drafts',
    description: 'Validate task drafts and open questions against meeting notes and the reviewed backlog snapshot. Writes local JSON and Markdown for review.',
    parameters: {
      type: 'object',
      properties: {
        dataset: DATASET_SCHEMA,
        snapshotId: { type: 'string', description: 'Snapshot ID returned by list_tasks and the task review tools.' },
        notes: { type: 'string', description: 'Original meeting notes. Preserve the exact text.' },
        drafts: TASK_DRAFT_SCHEMA,
        questions: {
          type: 'array',
          description: 'Questions left unresolved in the meeting, each with a verbatim excerpt. Use an empty list when none were recorded.',
          items: {
            type: 'object',
            properties: { question: { type: 'string' }, sourceQuote: { type: 'string' } },
            required: ['question', 'sourceQuote'],
            additionalProperties: false
          }
        }
      },
      required: ['dataset', 'snapshotId', 'notes', 'drafts'],
      additionalProperties: false
    }
  }
];

type Snapshot = {
  id: string;
  tools: ReturnType<typeof createPmAgentTools>;
  searched: boolean;
  retrieved: Set<string>;
};

export function createCodexDraftTools(projectDir: string) {
  const snapshots = new Map<Dataset, Snapshot>();
  const reportsDir = path.join(projectDir, 'reports', 'codex');

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

      if (name === 'list_meetings') {
        if (typeof args.offset !== 'number' || !Number.isSafeInteger(args.offset) || args.offset < 0) {
          throw makeCliError('Укажи целое неотрицательное смещение offset.');
        }
        const meetings = listMeetings(reportsDir, args.dataset, args.offset);
        return { ...meetings, items: meetings.items.map((meeting) => ({
          ...meeting, reportPath: path.join('reports', 'codex', meeting.meetingId, 'meeting-review.md')
        })) };
      }

      const snapshot = load(args.dataset);

      if (name === 'recheck_drafts') {
        const meeting = readMeeting(reportsDir, args.meetingId);
        if (meeting.review.dataset !== args.dataset) throw makeCliError('Разбор относится к другому набору бэклога.');
        return recheckMeeting(meeting, snapshot.tools, snapshot.id);
      }

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
      const questions = validateMeetingQuestions(args.questions, args.notes);
      const currentTasks = Object.fromEntries(drafts.flatMap(({ target }) =>
        target ? [[target.ref, snapshot.tools.getRequirements(target.ref)]] : []
      ));
      const queue: MeetingQueue = {
        status: 'review_required', drafts,
        review: { dataset: args.dataset, snapshotId: snapshot.id, createdAt: new Date().toISOString(), questions, currentTasks }
      };

      mkdirSync(reportsDir, { recursive: true });
      const directory = mkdtempSync(path.join(reportsDir, 'meeting-'));
      const reportPath = path.join(directory, 'meeting-review.md');
      const outputPath = path.join(directory, 'backlog-drafts.json');
      try {
        writeReport(reportPath, formatMeetingReview(queue));
        writeReport(outputPath, `${JSON.stringify(queue, null, 2)}\n`);
      } catch (error) {
        rmSync(directory, { recursive: true, force: true });
        throw error;
      }
      return {
        meetingId: path.basename(directory), path: path.relative(projectDir, outputPath), reportPath: path.relative(projectDir, reportPath),
        status: queue.status, savedDrafts: drafts.length, savedQuestions: questions.length
      };
    }
  };
}
