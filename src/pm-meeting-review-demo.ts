import { createHash } from 'node:crypto';
import { createPmAgentTools } from './pm-agent-tools';
import { buildMeetingQueue } from './pm-meeting-review';
import { readTextFile } from './utils';

export function buildDemoMeetingReview(input: unknown, createdAt: string) {
  const tools = createPmAgentTools(input);
  const [ref] = tools.findTasks('cg-203', 'all', 0).refs;
  const task = tools.sources.get(ref);
  if (!task || task.taskId !== 'CG-203') throw new Error('В демобэклоге нет карточки CG-203.');

  const before = tools.getRequirements(ref);
  const demoDecision = 'Согласовано для CG-203: проверить, что подсказка остаётся видимой после поворота смартфона в альбомную ориентацию.';
  const notes = `${readTextFile('data/demo-meeting-notes.txt').trim()}\n${demoDecision}`;
  return buildMeetingQueue({
    dataset: 'demo',
    snapshotId: createHash('sha256').update(JSON.stringify(input)).digest('hex'),
    createdAt,
    notes,
    drafts: [
      {
        operation: 'update', targetRef: ref, title: task.title,
        context: before.context, expectedResult: before.expectedResult,
        acceptanceCriteria: [...before.acceptanceCriteria, 'The hint remains visible after rotating a smartphone to landscape.'],
        sourceQuote: demoDecision
      },
      {
        operation: 'create', targetRef: null, title: 'Подготовить статью справки о смене email',
        context: 'Пользователям нужен понятный путь к настройкам профиля.',
        expectedResult: 'В справке опубликована инструкция по смене email.',
        acceptanceCriteria: ['В статье описаны шаги по смене email и есть рабочая ссылка на настройки профиля.'],
        sourceQuote: 'Подготовить статью справки о смене email со ссылкой на настройки профиля.'
      }
    ],
    questions: [{
      question: 'Нужна ли отдельная проверка подсказки на планшете?',
      sourceQuote: 'Уточнить у QA, нужна ли отдельная проверка для планшета.'
    }]
  }, tools, new Set([ref]));
}
