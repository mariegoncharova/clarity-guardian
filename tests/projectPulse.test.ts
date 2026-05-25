import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeUnifiedTasks
} from '../src/analytics';
import {
  buildProjectPulseReport,
  formatProjectPulseHtml,
  formatProjectPulseMarkdown
} from '../src/project-pulse';
import {
  normalizeUnifiedTasks
} from '../src/task-model';

test('buildProjectPulseReport creates a prioritized executive entrypoint', () => {
  const tasks = normalizeUnifiedTasks([
    {
      id: 'PULSE-1',
      source: 'file',
      title: 'Починить оплату',
      task_type: 'bug',
      priority: 'high',
      status: 'Testing',
      assignee: 'backend_1',
      description: 'Оплата не работает, нужно срочно пофиксить как обсуждали.'
    },
    {
      id: 'PULSE-2',
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
        'Ждём ответ от провайдера по формату ошибок.'
      ].join('\n'),
      dependencies: ['Ответ провайдера по формату ошибок']
    },
    {
      id: 'PULSE-3',
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
  const report = buildProjectPulseReport(analyzeUnifiedTasks(tasks), {
    generatedAt: '2026-05-25T00:00:00.000Z'
  });

  assert.equal(report.metrics.totalTasks, 3);
  assert.ok(report.projectHealthScore >= 0 && report.projectHealthScore <= 100);
  assert.ok(report.focusAreas.some((area) => area.code === 'readiness_gap'));
  assert.ok(report.focusAreas.some((area) => area.sourceReports.includes('release-guard.md')));
  assert.ok(report.taskSpotlight.some((task) => task.taskId === 'PULSE-1'));
  assert.ok(report.nextActions.length > 0);
  assert.ok(report.reportMap.some((link) => link.fileName === 'index.html'));
});

test('Project Pulse markdown and html expose the navigation map', () => {
  const tasks = normalizeUnifiedTasks([
    {
      id: 'PULSE-4',
      source: 'file',
      title: 'Переделать фильтры каталога',
      task_type: 'task',
      status: 'Backlog',
      description: 'Фильтры нужно сделать удобнее, scope вырос, детали обсудим позже.'
    }
  ]);
  const report = buildProjectPulseReport(analyzeUnifiedTasks(tasks));
  const markdown = formatProjectPulseMarkdown(report);
  const html = formatProjectPulseHtml(report);

  assert.match(markdown, /Project Pulse/);
  assert.match(markdown, /What To Do Next/);
  assert.match(markdown, /Report Map/);
  assert.match(html, /Clarity Guardian Project Pulse/);
  assert.match(html, /href="dashboard\.html"/);
  assert.match(html, /Task Spotlight/);
});
