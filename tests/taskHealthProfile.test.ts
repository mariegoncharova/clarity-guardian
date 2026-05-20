import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeUnifiedTasks
} from '../src/analytics';
import {
  buildTaskHealthReport,
  formatTaskHealthMarkdown
} from '../src/task-health-profile';
import {
  normalizeUnifiedTasks
} from '../src/task-model';

test('buildTaskHealthReport creates project summary and task profiles', () => {
  const tasks = normalizeUnifiedTasks([
    {
      id: 'HEALTH-1',
      source: 'file',
      title: 'Переделать оплату как раньше',
      description: 'Нужно починить оплату, как раньше, потому что сейчас не работает.',
      status: 'In Progress',
      assignee: 'backend_1',
      task_type: 'bug',
      priority: 'high',
      status_history: [
        { status: 'Backlog', entered_at: '2026-05-01T00:00:00Z', left_at: '2026-05-02T00:00:00Z' },
        { status: 'In Progress', entered_at: '2026-05-02T00:00:00Z', left_at: '2026-05-08T00:00:00Z' },
        { status: 'Testing', entered_at: '2026-05-08T00:00:00Z', left_at: '2026-05-09T00:00:00Z' },
        { status: 'Reopened', entered_at: '2026-05-09T00:00:00Z', left_at: '2026-05-10T00:00:00Z' }
      ],
      comments: ['Вернули с тестирования: не описан сценарий ошибки банка.']
    },
    {
      id: 'HEALTH-2',
      source: 'file',
      title: 'Обновить экран успеха',
      description: [
        '## Контекст',
        'После оплаты пользователю нужен понятный экран успешного заказа.',
        '',
        '## Ожидаемый результат',
        'Пользователь видит номер заказа, сумму и следующий шаг.',
        '',
        '## Критерии приёмки',
        '- Экран открывается после успешной оплаты.',
        '- Номер заказа и сумма совпадают с заказом.',
        '- Проверено на мобильном экране.'
      ].join('\n'),
      status: 'Done',
      assignee: 'frontend_1',
      task_type: 'task',
      priority: 'medium',
      comments: ['QA passed, проверено по чек-листу.']
    }
  ]);
  const report = buildTaskHealthReport(analyzeUnifiedTasks(tasks), {
    generatedAt: '2026-05-20T00:00:00.000Z'
  });

  assert.equal(report.summary.totalTasks, 2);
  assert.ok(report.summary.averageClarityScore > 0);
  assert.ok(report.summary.reopenedTasks > 0);
  assert.ok(report.summary.recommendations.length > 0);
  assert.ok(report.profiles.some((profile) => profile.taskId === 'HEALTH-1'));
  assert.ok(report.profiles.some((profile) => profile.healthStatus !== 'healthy'));
});

test('buildTaskHealthReport handles empty task sets', () => {
  const report = buildTaskHealthReport([], {
    generatedAt: '2026-05-20T00:00:00.000Z'
  });

  assert.equal(report.summary.totalTasks, 0);
  assert.equal(report.summary.averageClarityScore, 0);
  assert.equal(report.profiles.length, 0);
  assert.match(report.summary.recommendations[0], /Add demo or tracker tasks/);
});

test('formatTaskHealthMarkdown exposes summary, queue, and next action', () => {
  const tasks = normalizeUnifiedTasks([
    {
      id: 'HEALTH-3',
      source: 'file',
      title: 'Добавить событие аналитики',
      description: 'Нужно добавить событие аналитики.',
      status: 'Backlog',
      task_type: 'task'
    }
  ]);
  const report = buildTaskHealthReport(analyzeUnifiedTasks(tasks));
  const markdown = formatTaskHealthMarkdown(report);

  assert.match(markdown, /Task Health Profile/);
  assert.match(markdown, /Project Quality Summary/);
  assert.match(markdown, /Next best action/);
});
