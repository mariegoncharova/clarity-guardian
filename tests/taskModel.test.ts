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
