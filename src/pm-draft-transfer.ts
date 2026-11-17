import { createPmAgentTools, taskIdentity, type AgentSource } from './pm-agent-tools';
import { formatTransferReview, type DraftsForReview, type Requirements } from './pm-meeting-review';
import { draftTitleKey, type PmTaskDraft } from './pm-task-drafts';
import { getStableTaskId, getTaskRows, isTaskRow } from './task-model';
import { getStringArg, makeCliError, parseArgs, readJsonFile } from './utils';

function isText(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value.trim());
}

function isRequirements(value: unknown): value is Requirements {
  return isTaskRow(value) && typeof value.context === 'string' && typeof value.expectedResult === 'string' &&
    Array.isArray(value.acceptanceCriteria) && value.acceptanceCriteria.every(isText);
}

function isTarget(value: unknown): value is AgentSource {
  return isTaskRow(value) && isText(value.id) && isText(value.taskId) && isText(value.source) &&
    typeof value.title === 'string' && typeof value.ref === 'string' && /^T\d+$/.test(value.ref) &&
    (value.project === undefined || isText(value.project));
}

function isDraft(value: unknown): value is PmTaskDraft {
  if (!isTaskRow(value) || !isText(value.title) || !isText(value.sourceQuote)) return false;
  const { operation, target } = value;
  return isRequirements(value) && isText(value.context) && isText(value.expectedResult) &&
    value.acceptanceCriteria.length > 0 && (
      (operation === 'create' && target === null) ||
      (operation === 'update' && isTarget(target))
    );
}

function parseApprovedPacket(packet: unknown): DraftsForReview {
  if (!isTaskRow(packet) || packet.status !== 'approved_for_transfer' || !Array.isArray(packet.drafts) ||
    packet.drafts.length === 0 || packet.drafts.length > 8 || !packet.drafts.every(isDraft) ||
    !isTaskRow(packet.review) || !isTaskRow(packet.review.currentTasks)) {
    throw makeCliError('Нужен файл approved-drafts.json, скачанный после одобрения задач в ревью встречи.');
  }

  const seen = new Set<string>();
  const savedRequirements = packet.review.currentTasks;
  const currentTasks: Record<string, Requirements> = {};
  for (const { target, title } of packet.drafts) {
    const key = target ? `update:${taskIdentity(target)}` : `create:${draftTitleKey(title)}`;
    if (seen.has(key)) throw makeCliError(`В файле одобрения повторяется задача «${title}».`);
    seen.add(key);

    if (target) {
      const before = savedRequirements[target.ref];
      if (!Object.hasOwn(savedRequirements, target.ref) || !isRequirements(before)) {
        throw makeCliError(`В файле одобрения отсутствуют исходные требования для ${target.taskId}.`);
      }
      currentTasks[target.ref] = before;
    }
  }

  return { drafts: packet.drafts, review: { currentTasks } };
}

function main(): void {
  const args = parseArgs(process.argv);
  const approved = getStringArg(args, 'approved');
  const input = getStringArg(args, 'input');
  if (!approved || !input) {
    throw makeCliError('Укажите --approved для файла одобрения и --input для свежей JSON-выгрузки бэклога.');
  }

  const queue = parseApprovedPacket(readJsonFile(approved));
  const backlog = readJsonFile(input);
  const rows = getTaskRows(backlog);
  if (!rows || rows.some((row) => !isTaskRow(row) || !getStableTaskId(row))) {
    throw makeCliError('В свежей выгрузке нужен массив задач или объект с полем tasks. У каждой задачи нужен id или key.');
  }
  const tools = createPmAgentTools(backlog);
  if (tools.snapshot.dropped) throw makeCliError('В выгрузке есть строки без названия и описания задачи.');
  process.stdout.write(formatTransferReview(queue, tools));
}

try {
  main();
} catch (error: unknown) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
