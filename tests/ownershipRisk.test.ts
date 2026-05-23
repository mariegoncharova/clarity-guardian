import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeUnifiedTasks
} from '../src/analytics';
import {
  buildOwnershipRiskReport,
  formatOwnershipRiskMarkdown
} from '../src/ownership-risk';
import {
  normalizeUnifiedTasks
} from '../src/task-model';

test('buildOwnershipRiskReport highlights critical owners and unassigned risky work', () => {
  const tasks = normalizeUnifiedTasks([
    {
      id: 'OWN-1',
      source: 'file',
      title: 'Интеграция с платёжным провайдером',
      task_type: 'task',
      priority: 'high',
      status: 'In Progress',
      assignee: 'backend_1',
      description: [
        '## Контекст',
        'Подключаем новый endpoint платёжного провайдера для оплаты заказа.',
        '',
        '## Ожидаемый результат',
        'Платёж отправляется в новый endpoint и пользователь видит результат операции.',
        '',
        'Ждём ответ от провайдера по формату ошибок и таймаутов.'
      ].join('\n'),
      dependencies: ['Ответ провайдера по формату ошибок']
    },
    {
      id: 'OWN-2',
      source: 'file',
      title: 'Переделать фильтры каталога',
      task_type: 'task',
      status: 'Backlog',
      assignee: 'backend_1',
      description: 'Фильтры нужно сделать удобнее, scope вырос, надо потом обсудить детали и тестирование.'
    },
    {
      id: 'OWN-3',
      source: 'file',
      title: 'Починить оплату',
      task_type: 'bug',
      priority: 'high',
      status: 'Backlog',
      description: 'Оплата не работает, нужно срочно пофиксить как обсуждали.'
    },
    {
      id: 'OWN-4',
      source: 'file',
      title: 'Добавить подсказку email',
      task_type: 'task',
      priority: 'medium',
      status: 'Done',
      assignee: 'frontend_1',
      description: [
        '## Контекст',
        'Пользователи не понимают, почему email домен отклоняется при регистрации.',
        '',
        '## Ожидаемый результат',
        'Пользователь видит понятную подсказку рядом с полем email.',
        '',
        '## Критерии приёмки',
        '- Подсказка видна на desktop и mobile.',
        '- QA passed: проверено на форме регистрации.'
      ].join('\n')
    }
  ]);
  const report = buildOwnershipRiskReport(analyzeUnifiedTasks(tasks), {
    generatedAt: '2026-05-23T00:00:00.000Z',
    maxActiveTasks: 1
  });
  const backendProfile = report.ownerProfiles.find((profile) => profile.owner === 'backend_1');

  assert.equal(report.totalTasks, 4);
  assert.equal(report.unassignedRiskTasks, 1);
  assert.ok(backendProfile);
  assert.equal(backendProfile?.riskLevel, 'critical');
  assert.ok((backendProfile?.ownerRiskScore || 0) >= 70);
  assert.ok((backendProfile?.qaGapTasks || 0) >= 1);
  assert.ok(report.unassignedRiskQueue.some((task) => task.taskId === 'OWN-3'));
  assert.ok(report.recommendations.some((recommendation) => /unassigned/i.test(recommendation)));
});

test('formatOwnershipRiskMarkdown includes heatmap, unassigned queue, and owner details', () => {
  const tasks = normalizeUnifiedTasks([
    {
      id: 'OWN-5',
      source: 'file',
      title: 'Уточнить отчёт по заказам',
      task_type: 'task',
      status: 'Backlog',
      assignee: 'analytics_1',
      description: 'Нужно сделать нормальный отчёт по заказам, детали обсудим позже.'
    }
  ]);
  const report = buildOwnershipRiskReport(analyzeUnifiedTasks(tasks));
  const markdown = formatOwnershipRiskMarkdown(report);

  assert.match(markdown, /Ownership Risk/);
  assert.match(markdown, /Owner Heatmap/);
  assert.match(markdown, /Unassigned Risk Queue/);
  assert.match(markdown, /Owner Details/);
  assert.match(markdown, /analytics_1/);
});
