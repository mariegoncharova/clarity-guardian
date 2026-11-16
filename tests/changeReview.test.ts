import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChangeReview, formatChangeReviewMarkdown } from '../src/change-review';

const approved = {
  key: '25',
  source: 'github',
  projectKey: 'demo/profile',
  title: 'Edit the profile toolbar',
  scope: 'Add a help link to the settings toolbar.',
  acceptanceCriteria: ['The link opens the help page.', 'The link has a visible focus state.'],
  deadline: '2026-11-20',
  status: 'Backlog'
};

test('change review compares matching snapshots and ignores workflow-only updates', () => {
  const otherProject = { ...approved, projectKey: 'demo/storefront' };
  const report = buildChangeReview([approved, otherProject], { tasks: [
    {
      ...approved,
      scope: 'Add a help link to both the settings toolbar and footer.',
      deadline: '2026-11-24',
      status: 'In Progress'
    },
    { ...otherProject, status: 'Done', acceptanceCriteria: [...approved.acceptanceCriteria].reverse() }
  ] });

  assert.equal(report.summary.changed, 1);
  assert.equal(report.summary.unchanged, 1);
  assert.equal(report.changed[0].project, 'demo/profile');
  assert.deepEqual(report.changed[0].changes.map(({ field }) => field), ['scope', 'deadline']);
  assert.match(formatChangeReviewMarkdown(report), /2026-11-20 \| 2026-11-24/);
});

test('change review detects a changed Markdown criterion and distinguishes added and missing tasks', () => {
  const first = { ...approved, acceptanceCriteria: undefined, body: '## Критерии приёмки\n- Показывать ссылку в профиле.' };
  const report = buildChangeReview([
    first,
    { ...first, key: '26' }
  ], [
    { ...first, body: '## Критерии приёмки\n- Показывать ссылку и на мобильном экране.' },
    { ...first, key: '27' }
  ]);

  assert.equal(report.added[0].taskId, '27');
  assert.equal(report.missing[0].taskId, '26');
  const acceptance = report.changed[0].changes.find(({ field }) => field === 'acceptanceCriteria');
  assert.deepEqual(acceptance?.after, ['Показывать ссылку и на мобильном экране.']);
});

test('change review rejects duplicates and invalid rows before interpreting them as changes', () => {
  assert.throws(() => buildChangeReview([approved, approved], []), /строка 2: повторяется идентификатор 25/);
  assert.throws(() => buildChangeReview([approved], [null]), /Текущий снимок, строка 1/);
  assert.throws(() => buildChangeReview([approved], { issues: [] }), /ожидается массив задач/);
  assert.throws(() => buildChangeReview([approved], [{ title: 'No stable ID' }]), /нужны id или key/);
});
