import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createCodexDraftTools } from '../src/pm-codex-drafts';

test('Codex drafts use the reviewed working export and preserve each validated queue', (t) => {
  const projectDir = mkdtempSync(path.join(tmpdir(), 'clarity-codex-'));
  t.after(() => rmSync(projectDir, { recursive: true, force: true }));

  const tools = createCodexDraftTools(projectDir);
  const search = { dataset: 'working', query: 'CG-203', scope: 'all', offset: 0 };
  assert.throws(() => tools.call('list_tasks', search), /data\/local\/tasks\.json/);

  const tasksPath = path.join(projectDir, 'data/local/tasks.json');
  mkdirSync(path.dirname(tasksPath), { recursive: true });
  copyFileSync('data/demo-tasks.json', tasksPath);
  const first = tools.call('list_tasks', search);
  assert.ok('taskRefs' in first);
  assert.equal(first.taskRefs.length, 1);

  const action = 'Добавить проверку на планшете для заблокированного аккаунта.';
  const question = 'У QA уточнить, нужна ли проверка поворота экрана.';
  const notes = `${action}\n${question}`;
  const draft = {
    operation: 'update', targetRef: first.taskRefs[0], title: 'Расширить проверку подсказки на планшеты',
    context: 'Пользователь с заблокированным аккаунтом может зайти с планшета.',
    expectedResult: 'Добавлена проверка на ширине экрана планшета.',
    acceptanceCriteria: ['Подсказка видна в профиле заблокированного аккаунта на планшете.'],
    sourceQuote: action
  };
  const newDraft = { ...draft, operation: 'create', targetRef: null, title: 'Подготовить чек-лист для планшета' };
  const args = {
    dataset: 'working', snapshotId: first.snapshotId, notes, drafts: [draft, newDraft],
    questions: [{ question: 'Нужна ли проверка поворота экрана?', sourceQuote: question }]
  };
  assert.throws(() => tools.call('save_drafts', { ...args, notes: 'Заметки о другом решении.' }), /цитатой/);
  assert.throws(() => tools.call('save_drafts', {
    ...args, questions: [{ question, sourceQuote: 'Этой цитаты нет в заметках.' }]
  }), /Вопрос.*цитатой/);

  const saved = tools.call('save_drafts', args);
  assert.ok('path' in saved && typeof saved.path === 'string');
  assert.match(saved.path, /^reports\/codex\/meeting-[^/]+\/backlog-drafts\.json$/);
  const queue = JSON.parse(readFileSync(path.join(projectDir, saved.path), 'utf8'));
  assert.equal(queue.status, 'review_required');
  assert.equal(queue.drafts.length, 2);
  assert.equal(queue.drafts[0].target.taskId, 'CG-203');
  assert.equal(queue.drafts[0].sourceQuote, action);
  assert.deepEqual(queue.review.questions, args.questions);
  assert.ok(typeof saved.reportPath === 'string');
  const markdown = readFileSync(path.join(projectDir, saved.reportPath), 'utf8');
  assert.match(markdown, /Сейчас в бэклоге[\s\S]+Hint is visible only to authenticated users/);
  assert.match(markdown, /Предложение[\s\S]+Подсказка видна в профиле заблокированного аккаунта на планшете/);
  assert.match(markdown, /У QA уточнить, нужна ли проверка поворота экрана/);

  const history = createCodexDraftTools(projectDir).call('list_meetings', { dataset: 'working', offset: 0 });
  assert.ok('items' in history && Array.isArray(history.items) && 'questions' in history.items[0]);
  assert.deepEqual(history.items[0].questions, args.questions);
  const demoHistory = tools.call('list_meetings', { dataset: 'demo', offset: 0 });
  assert.deepEqual(demoHistory, { items: [], total: 0, nextOffset: null });

  const recheck = { dataset: 'working', meetingId: saved.meetingId };
  assert.throws(() => tools.call('recheck_drafts', { ...recheck, meetingId: '../tasks' }), /meetingId/);
  const original = JSON.parse(readFileSync(tasksPath, 'utf8'));
  const target = original.find((task: { key: string }) => task.key === 'CG-203');
  writeFileSync(tasksPath, JSON.stringify([
    { ...target, id: 'new-card', key: 'CG-999', title: newDraft.title },
    { ...target, expectedResult: 'Уточнили условия для неавторизованных пользователей.' }
  ]));
  const conflicts = tools.call('recheck_drafts', recheck);
  assert.ok('drafts' in conflicts && conflicts.drafts);
  assert.equal(conflicts.backlogChanged, true);
  assert.deepEqual(conflicts.drafts.map(({ status }) => status), ['target_changed', 'title_exists']);
  assert.deepEqual(conflicts.drafts[0].fields, ['expectedResult']);

  writeFileSync(tasksPath, '[]');
  const removed = tools.call('recheck_drafts', recheck);
  assert.ok('drafts' in removed && removed.drafts);
  assert.equal(removed.drafts[0].status, 'target_missing');
  assert.throws(() => tools.call('save_drafts', args), /актуальный поиск/);
  const current = tools.call('list_tasks', search);
  assert.ok('taskRefs' in current);
  assert.notEqual(current.snapshotId, first.snapshotId);
  assert.throws(() => tools.call('save_drafts', { ...args, snapshotId: current.snapshotId }), /результатов поиска/);

  const empty = tools.call('save_drafts', { ...args, snapshotId: current.snapshotId, drafts: [], questions: undefined });
  assert.ok('path' in empty && typeof empty.path === 'string');
  assert.notEqual(empty.path, saved.path);
  const emptyQueue = JSON.parse(readFileSync(path.join(projectDir, empty.path), 'utf8'));
  assert.deepEqual(emptyQueue.drafts, []);
  assert.deepEqual(emptyQueue.review.questions, []);
});
