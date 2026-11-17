import { existsSync, lstatSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { taskIdentity, type createPmAgentTools } from './pm-agent-tools';
import { draftTitleKey, type PmTaskDraft, type validateMeetingQuestions } from './pm-task-drafts';
import { makeCliError, readJsonFile } from './utils';

export type Dataset = 'working' | 'demo';
type Requirements = Pick<PmTaskDraft, 'context' | 'expectedResult' | 'acceptanceCriteria'>;

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

export function recheckMeeting(queue: MeetingQueue, tools: ReturnType<typeof createPmAgentTools>, snapshotId: string) {
  const tasks = [...tools.sources.values()].filter(({ ref }) => ref.startsWith('T'));
  const drafts = queue.drafts.map(({ title, target }) => {
    if (!target) {
      const matches = tasks.filter((task) => draftTitleKey(task.title) === draftTitleKey(title));
      return { title, status: matches.length ? 'title_exists' : 'unchanged', matches };
    }

    const matches = tasks.filter((task) => taskIdentity(task) === taskIdentity(target));
    if (matches.length !== 1) return { title, status: matches.length ? 'target_ambiguous' : 'target_missing', target };

    const before = queue.review.currentTasks[target.ref];
    if (!before) throw makeCliError(`В разборе отсутствуют исходные требования для ${target.taskId}.`);
    const now = tools.getRequirements(matches[0].ref);
    const fields = reviewedFields.filter((key) => JSON.stringify(before[key]) !== JSON.stringify(now[key]));
    return { title, status: fields.length ? 'target_changed' : 'unchanged', target: matches[0], fields };
  });

  return { backlogChanged: queue.review.snapshotId !== snapshotId, drafts };
}
