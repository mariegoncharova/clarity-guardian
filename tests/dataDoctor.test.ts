import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDataDoctorReport,
  formatDataDoctorMarkdown
} from '../src/data-doctor';

test('buildDataDoctorReport detects dropped rows, duplicate ids, unstable ids and bad dates', () => {
  const report = buildDataDoctorReport([
    {
      id: 'DATA-1',
      source: 'file',
      title: 'Починить оплату',
      description: 'Оплата не работает.',
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: 'bad-date',
      statusHistory: [
        {
          status: 'In Progress',
          enteredAt: '2026-05-03T00:00:00.000Z',
          leftAt: '2026-05-02T00:00:00.000Z'
        }
      ]
    },
    {
      id: 'DATA-1',
      source: 'file',
      title: 'Повтор задачи',
      description: 'Дублирующийся id ломает историю.'
    },
    {
      title: 'Задача без стабильного id',
      description: 'Есть текст, но нет id или key.'
    },
    {
      source: 'file',
      priority: 'high'
    },
    'not-a-task'
  ], {
    generatedAt: '2026-05-25T00:00:00.000Z'
  });

  assert.equal(report.rawItemsCount, 5);
  assert.equal(report.normalizedTasksCount, 3);
  assert.equal(report.droppedItemsCount, 2);
  assert.equal(report.status, 'critical');
  assert.ok(report.dataQualityScore < 80);
  assert.ok(report.issues.some((issue) => issue.code === 'duplicate_task_ids'));
  assert.ok(report.issues.some((issue) => issue.code === 'missing_stable_id'));
  assert.ok(report.issues.some((issue) => issue.code === 'invalid_dates'));
  assert.ok(report.issues.some((issue) => issue.code === 'status_history_order'));
  assert.ok(report.recommendations.some((recommendation) => /Stabilize task identity/i.test(recommendation)));
});

test('Data Doctor identifies the exact dropped rows and counts accepted structured descriptions', () => {
  const report = buildDataDoctorReport({
    tasks: [
      { id: '', key: 'DATA-1', context: 'Users lose their drafts.' },
      null,
      { id: 'DATA-3' },
      { id: 'DATA-4', acceptance_criteria: ['A reload keeps the draft.'] }
    ]
  });

  assert.equal(report.normalizedTasksCount, 2);
  assert.equal(report.droppedItemsCount, 2);
  assert.equal(report.summary.unstableIds, 0);
  assert.equal(report.summary.missingBodyTasks, 0);
  assert.deepEqual(report.issues.find(({ code }) => code === 'non_object_items')?.taskIds, ['row:1']);
  const dropped = report.issues.find(({ code }) => code === 'dropped_tasks');
  assert.deepEqual(dropped?.taskIds, ['row:2']);
  assert.match(dropped?.message || '', /^1 /);
});

test('Data Doctor distinguishes a valid empty export from an unsupported format', () => {
  const empty = buildDataDoctorReport({ tasks: [] });
  assert.equal(empty.issues[0].code, 'empty_task_array');
  assert.equal(empty.droppedItemsCount, 0);

  const invalid = buildDataDoctorReport({ issues: [] });
  assert.equal(invalid.issues[0].code, 'empty_or_unsupported_input');
});

test('formatDataDoctorMarkdown exposes dataset health and field coverage', () => {
  const report = buildDataDoctorReport([
    {
      id: 'DATA-2',
      source: 'file',
      title: 'Добавить подсказку email',
      description: '## Контекст\nПользователи ошибаются в email.\n\n## Ожидаемый результат\nПодсказка помогает исправить домен.\n\n## Критерии приёмки\n- Подсказка видна.',
      status: 'Backlog',
      assignee: 'frontend_1',
      task_type: 'task',
      priority: 'medium',
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-02T00:00:00.000Z'
    }
  ]);
  const markdown = formatDataDoctorMarkdown(report);

  assert.equal(report.normalizedTasksCount, 1);
  assert.match(markdown, /Data Doctor/);
  assert.match(markdown, /Dataset Health/);
  assert.match(markdown, /Field Coverage/);
  assert.match(markdown, /Data Quality Score/);
});
