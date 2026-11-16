import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeUnifiedTasks,
  unifiedTaskToTaskPayload
} from '../src/task-model';

test('normalizeUnifiedTasks preserves numeric zero text fields and ignores empty scores', () => {
  const [task] = normalizeUnifiedTasks([
    {
      id: 0,
      source: 'file',
      title: 0,
      clarity_score: ''
    }
  ]);

  assert.equal(task.id, '0');
  assert.equal(task.title, '0');
  assert.equal(task.clarityScore, undefined);
});

test('normalizeUnifiedTasks retains structured tasks and rejects non-text descriptions', () => {
  const input = {
    tasks: [
      { id: ' ', key: 'CG-1', context: 'Users lose drafts.', expected_result: 'Keep the draft.' },
      { summary: ' ', body: '', description: 'Restore the draft on reload.' },
      { acceptance_criteria: ['A reload keeps the draft.'] },
      { body: { invalid: true }, acceptance_criteria: [{}] },
      []
    ]
  };

  const tasks = normalizeUnifiedTasks(input);
  assert.equal(tasks.length, 3);
  assert.equal(tasks[0].id, 'CG-1');
  assert.equal(tasks[0].expectedResult, 'Keep the draft.');
  assert.equal(tasks[1].body, 'Restore the draft on reload.');
  assert.deepEqual(tasks[2].acceptanceCriteria, ['A reload keeps the draft.']);
  assert.notEqual(tasks[1].id, tasks[2].id);
  assert.deepEqual(normalizeUnifiedTasks(input), tasks);
});

test('unifiedTaskToTaskPayload detects language from generated body sections', () => {
  const payload = unifiedTaskToTaskPayload({
    id: 'EN-1',
    source: 'file',
    title: 'Add profile hint',
    body: '',
    context: 'Users cannot find where to change notification settings in profile.',
    expectedResult: 'Users see a clear hint near the notification settings control.',
    acceptanceCriteria: [
      'The hint is visible on desktop and mobile layouts.'
    ]
  });

  assert.equal(payload.language, 'en');
  assert.match(payload.body || '', /## Context/);
});
