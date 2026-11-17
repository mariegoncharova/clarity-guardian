import { existsSync, lstatSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { CHANGE_REVIEW_FIELD_LABELS } from './change-review';
import { taskIdentity, type createPmAgentTools } from './pm-agent-tools';
import { draftTitleKey, validateMeetingQuestions, validateTaskDrafts, type PmTaskDraft } from './pm-task-drafts';
import { makeCliError, readJsonFile } from './utils';

export type Dataset = 'working' | 'demo';
export type Requirements = Pick<PmTaskDraft, 'context' | 'expectedResult' | 'acceptanceCriteria'>;

export interface MeetingQueue {
  status: 'review_required';
  drafts: PmTaskDraft[];
  review: {
    dataset: Dataset;
    snapshotId: string;
    createdAt: string;
    questions: ReturnType<typeof validateMeetingQuestions>;
    currentTasks: Record<string, Requirements>;
  };
}

export function buildMeetingQueue(
  input: { dataset: Dataset; snapshotId: string; createdAt: string; notes: string; drafts: unknown; questions: unknown },
  tools: ReturnType<typeof createPmAgentTools>,
  retrieved: Set<string>
): MeetingQueue {
  const drafts = validateTaskDrafts(input.drafts, input.notes, tools.sources, retrieved);
  const questions = validateMeetingQuestions(input.questions, input.notes);
  const currentTasks = Object.fromEntries(drafts.flatMap(({ target }) =>
    target ? [[target.ref, tools.getRequirements(target.ref)]] : []
  ));
  return {
    status: 'review_required', drafts,
    review: { dataset: input.dataset, snapshotId: input.snapshotId, createdAt: input.createdAt, questions, currentTasks }
  };
}

function inline(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/[\\`*_\[\]<>#&~]/g, '\\$&');
}

function requirementsMarkdown({ context, expectedResult, acceptanceCriteria }: Requirements): string[] {
  return [
    `- Контекст — ${inline(context || 'отсутствует')}`,
    `- Ожидаемый результат — ${inline(expectedResult || 'отсутствует')}`,
    '- Критерии приёмки',
    ...(acceptanceCriteria.length ? acceptanceCriteria : ['Критерии отсутствуют.']).map((text) => `  - ${inline(text)}`)
  ];
}

export function formatMeetingReview({ drafts, review }: MeetingQueue): string {
  const lines = ['# Разбор встречи', '', 'Статус — на проверке', '', `Дата разбора — ${review.createdAt}`, ''];

  if (!drafts.length) lines.push('Черновиков задач нет.', '');

  for (const draft of drafts) {
    lines.push(`## ${draft.target ? 'Правка' : 'Новая задача'} — ${inline(draft.title)}`, '');
    if (draft.target) {
      const target = draft.target;
      lines.push(
        `Карточка — ${inline(target.taskId)}${target.project ? ` · ${inline(target.project)}` : ''}`,
        '', '### Сейчас в бэклоге', '', ...requirementsMarkdown(review.currentTasks[target.ref]), ''
      );
    }
    lines.push('### Предложение', '', ...requirementsMarkdown(draft), '', `**Из заметок** — ${inline(draft.sourceQuote)}`, '');
  }

  lines.push('## Открытые вопросы', '');
  if (!review.questions.length) lines.push('Открытых вопросов нет.');
  for (const { question, sourceQuote } of review.questions) {
    lines.push(`- ${inline(question)}`, `  - Из заметок — ${inline(sourceQuote)}`);
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

const MEETING_ID = /^meeting-[a-zA-Z0-9]+$/;

export function readMeeting(directory: string, meetingId: unknown): MeetingQueue {
  if (typeof meetingId !== 'string' || !MEETING_ID.test(meetingId)) {
    throw makeCliError('Передай meetingId из результата save_drafts или list_meetings.');
  }

  const meetingDir = path.join(directory, meetingId);
  const queuePath = path.join(meetingDir, 'backlog-drafts.json');
  if (!lstatSync(meetingDir, { throwIfNoEntry: false })?.isDirectory() || !lstatSync(queuePath, { throwIfNoEntry: false })?.isFile()) {
    throw makeCliError('Сохранённый разбор встречи не найден.');
  }
  const queue = readJsonFile<MeetingQueue>(queuePath);
  if (typeof queue?.review?.createdAt !== 'string' || !Array.isArray(queue.drafts) ||
    !Array.isArray(queue.review.questions) || !queue.review.currentTasks) {
    throw makeCliError('В этом JSON нет данных ревью. Повтори разбор заметок, чтобы создать новый снимок.');
  }
  return queue;
}

export function listMeetings(directory: string, dataset: Dataset, offset: number) {
  const saved = existsSync(directory) ? readdirSync(directory, { withFileTypes: true }) : [];
  const matches = saved.filter((entry) => entry.isDirectory() && MEETING_ID.test(entry.name)).flatMap(({ name }) => {
    try {
      const { drafts, review } = readMeeting(directory, name);
      if (review.dataset !== dataset) return [];
      return [{ meetingId: name, createdAt: review.createdAt, savedDrafts: drafts.length, questions: review.questions }];
    } catch {
      return [];
    }
  }).sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.meetingId.localeCompare(right.meetingId));

  const end = offset + 10;
  return { items: matches.slice(offset, end), total: matches.length, nextOffset: end < matches.length ? end : null };
}

const reviewedFields: Array<keyof Requirements> = ['context', 'expectedResult', 'acceptanceCriteria'];

export type DraftsForReview = { drafts: PmTaskDraft[]; review: Pick<MeetingQueue['review'], 'currentTasks'> };

export function recheckDrafts(queue: DraftsForReview, tools: ReturnType<typeof createPmAgentTools>) {
  const tasks = [...tools.sources.values()].filter(({ ref }) => ref.startsWith('T'));
  return queue.drafts.map(({ title, target }) => {
    if (!target) {
      const matches = tasks.filter((task) => draftTitleKey(task.title) === draftTitleKey(title));
      return { title, status: matches.length ? 'title_exists' as const : 'unchanged' as const, matches };
    }

    const matches = tasks.filter((task) => taskIdentity(task) === taskIdentity(target));
    if (matches.length !== 1) {
      return { title, status: matches.length ? 'target_ambiguous' as const : 'target_missing' as const, target };
    }

    const before = queue.review.currentTasks[target.ref];
    if (!before) throw makeCliError(`В разборе отсутствуют исходные требования для ${target.taskId}.`);
    const [current] = matches;
    const now = tools.getRequirements(current.ref);
    const fields: Array<keyof Requirements | 'title'> = reviewedFields
      .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(now[key]));
    if (current.title !== target.title) fields.unshift('title');
    return { title, status: fields.length ? 'target_changed' as const : 'unchanged' as const, target: current, fields };
  });
}

export function recheckMeeting(queue: MeetingQueue, tools: ReturnType<typeof createPmAgentTools>, snapshotId: string) {
  return { backlogChanged: queue.review.snapshotId !== snapshotId, drafts: recheckDrafts(queue, tools) };
}

export function formatTransferReview(queue: DraftsForReview, tools: ReturnType<typeof createPmAgentTools>): string {
  const ready: string[] = [];
  const conflicts: string[] = [];

  for (const [index, result] of recheckDrafts(queue, tools).entries()) {
    const title = inline(result.title);
    const target = result.target ? inline([result.target.project, result.target.taskId].filter(Boolean).join(' / ')) : '';
    switch (result.status) {
      case 'unchanged':
        ready.push(`### ${target ? `Правка · ${target}` : 'Новая задача'} — ${title}`, '',
          ...requirementsMarkdown(queue.drafts[index]), '');
        break;
      case 'title_exists':
        conflicts.push(`- ${title} — такое название уже есть в бэклоге (${result.matches.map(({ taskId, project }) =>
          inline([project, taskId].filter(Boolean).join(' / '))).join(', ')}). Сверьте существующие карточки.`);
        break;
      case 'target_changed':
        conflicts.push(`- ${target} · ${title} — изменились поля «${result.fields.map((field) =>
          CHANGE_REVIEW_FIELD_LABELS[field]).join('», «')}». Сверьте правку с текущей карточкой.`);
        break;
      case 'target_ambiguous':
        conflicts.push(`- ${target} · ${title} — в выгрузке несколько совпадений. Уточните целевую карточку.`);
        break;
      case 'target_missing':
        conflicts.push(`- ${target} · ${title} — карточка отсутствует в выгрузке. Проверьте её в трекере.`);
        break;
    }
  }

  return [
    '# Проверка перед переносом', '',
    `Проверено одобренных задач — ${queue.drafts.length}. На уточнение — ${conflicts.length}.`, '',
    '## Можно переносить по этому снимку', '',
    ...(ready.length ? ready : ['Готовых задач нет.', '']),
    '## Нужно проверить', '',
    ...(conflicts.length ? conflicts : ['Конфликтов в этой выгрузке нет.'])
  ].join('\n') + '\n';
}
