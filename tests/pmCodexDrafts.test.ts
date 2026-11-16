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

  const notes = 'Добавить проверку на планшете для заблокированного аккаунта.';
  const draft = {
    operation: 'update', targetRef: first.taskRefs[0], title: 'Расширить проверку подсказки на планшеты',
    context: 'Пользователь с заблокированным аккаунтом может зайти с планшета.',
    expectedResult: 'Добавлена проверка на ширине экрана планшета.',
    acceptanceCriteria: ['Подсказка видна в профиле заблокированного аккаунта на планшете.'],
    sourceQuote: notes
  };
  const args = { dataset: 'working', snapshotId: first.snapshotId, notes, drafts: [draft] };
  assert.throws(() => tools.call('save_drafts', { ...args, notes: 'Заметки о другом решении.' }), /цитатой/);

  const saved = tools.call('save_drafts', args);
  assert.ok(typeof saved.path === 'string');
  assert.match(saved.path, /^reports\/codex\/meeting-[^/]+\/backlog-drafts\.json$/);
  const queue = JSON.parse(readFileSync(path.join(projectDir, saved.path), 'utf8'));
  assert.equal(queue.status, 'review_required');
  assert.equal(queue.drafts.length, 1);
  assert.equal(queue.drafts[0].target.taskId, 'CG-203');
  assert.equal(queue.drafts[0].sourceQuote, notes);

  writeFileSync(tasksPath, '[]');
  assert.throws(() => tools.call('save_drafts', args), /актуальный поиск/);
  const current = tools.call('list_tasks', search);
  assert.ok('taskRefs' in current);
  assert.notEqual(current.snapshotId, first.snapshotId);
  assert.throws(() => tools.call('save_drafts', { ...args, snapshotId: current.snapshotId }), /результатов поиска/);

  const empty = tools.call('save_drafts', { ...args, snapshotId: current.snapshotId, drafts: [] });
  assert.ok(typeof empty.path === 'string');
  assert.notEqual(empty.path, saved.path);
  assert.deepEqual(JSON.parse(readFileSync(path.join(projectDir, empty.path), 'utf8')), { status: 'review_required', drafts: [] });
});
