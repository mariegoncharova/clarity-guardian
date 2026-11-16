import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAgentHandoffReport, formatAgentHandoffMarkdown } from '../src/agent-handoff';
import { analyzeUnifiedTasks } from '../src/analytics';
import { normalizeUnifiedTasks } from '../src/task-model';

const completeTask = {
  id: 'GH-1',
  title: 'Show the help link in the profile',
  context: 'Users cannot find the profile help page.',
  expectedResult: 'The profile toolbar shows a link to the help page.',
  acceptanceCriteria: ['The help link is visible in the toolbar and opens the help page.'],
  repository: 'example/profile-web',
  scope: 'Update the profile toolbar and its existing tests only.',
  verification: 'Open the profile on desktop and mobile and follow the help link.'
};

function reportFor(tasks: unknown) {
  return buildAgentHandoffReport(analyzeUnifiedTasks(normalizeUnifiedTasks(tasks)));
}

test('agent handoff includes a brief only for tasks with enough implementation detail', () => {
  const report = reportFor([
    completeTask,
    { ...completeTask, id: 'GH-2', repository: 'N/A', scope: 'TBD', verification: '' }
  ]);

  assert.deepEqual(report.summary, { readyForAgent: 1, needsClarification: 1, humanReview: 0 });
  assert.equal(report.items[0].brief?.repository, 'example/profile-web');
  assert.equal(report.items[0].brief?.verification, completeTask.verification);
  assert.equal(report.items[1].brief, undefined);
  assert.equal(report.items[1].questions.length, 3);
  assert.match(formatAgentHandoffMarkdown(report), /example\/profile-web/);
});

test('agent handoff reads Markdown sections and keeps sensitive work for human review', () => {
  const { repository, scope, verification, ...common } = completeTask;
  const report = reportFor([
    {
      ...common,
      source: 'github',
      projectKey: repository,
      body: `## Scope\n${scope}\n\n## Verification\n${verification}`
    },
    { ...completeTask, id: 'GH-3', scope: 'Change checkout payment validation and tests.' },
    { ...completeTask, id: 'GH-5', status: 'Blocked' },
    { ...completeTask, id: 'GH-4', status: 'Closed' }
  ]);

  assert.equal(report.activeTasks, 3);
  assert.equal(report.items[0].status, 'ready_for_agent');
  assert.equal(report.items[1].status, 'human_review');
  assert.match(report.items[1].reviewReasons.join(' '), /payment/);
  assert.equal(report.items[1].brief, undefined);
  assert.equal(report.items[2].status, 'human_review');
  assert.match(report.items[2].reviewReasons.join(' '), /блокер/);
});
