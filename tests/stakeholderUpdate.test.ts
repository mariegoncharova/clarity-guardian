import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeUnifiedTasks
} from '../src/analytics';
import {
  buildStakeholderUpdateReport,
  formatStakeholderUpdateMarkdown
} from '../src/stakeholder-update';
import {
  normalizeUnifiedTasks
} from '../src/task-model';

test('buildStakeholderUpdateReport creates red update with asks for risky blocked work', () => {
  const tasks = normalizeUnifiedTasks([
    {
      id: 'UPDATE-1',
      source: 'file',
      title: 'Интеграция с платёжным провайдером',
      task_type: 'task',
      priority: 'high',
      status: 'In Progress',
      assignee: 'backend_1',
      description: [
        '## Контекст',
        'Команда подключает новый endpoint платёжного провайдера.',
        '',
        '## Ожидаемый результат',
        'Backend отправляет запрос в новый endpoint и сохраняет результат операции.',
        '',
        'Ждём ответ от провайдера по финальному формату ошибок.'
      ].join('\n'),
      dependencies: ['Ответ провайдера по формату ошибок']
    },
    {
      id: 'UPDATE-2',
      source: 'file',
      title: 'Переделать фильтры каталога',
      task_type: 'task',
      status: 'Backlog',
      description: 'Фильтры нужно сделать удобнее. Добавили несколько сценариев, изменился scope, надо декомпозировать работу.'
    }
  ]);
  const report = buildStakeholderUpdateReport(analyzeUnifiedTasks(tasks), {
    generatedAt: '2026-05-21T00:00:00.000Z'
  });

  assert.equal(report.totalTasks, 2);
  assert.equal(report.health, 'red');
  assert.ok(report.summary.blockerTasks >= 1);
  assert.ok(report.summary.qaGapTasks >= 1);
  assert.ok(report.risks.some((risk) => risk.code === 'blockers'));
  assert.ok(report.risks.some((risk) => risk.code === 'low_readiness'));
  assert.ok(report.asks.some((ask) => ask.ownerRole === 'Tech Lead' && ask.urgency === 'now'));
  assert.ok(report.taskMentions.some((task) => task.taskId === 'UPDATE-1'));
});

test('buildStakeholderUpdateReport creates green update for ready low-risk work', () => {
  const tasks = normalizeUnifiedTasks([
    {
      id: 'UPDATE-3',
      source: 'file',
      title: 'Добавить проверку email домена',
      task_type: 'task',
      priority: 'medium',
      status: 'Backlog',
      assignee: 'frontend_1',
      description: [
        '## Контекст',
        'По данным support dashboard, 18% обращений по регистрации связаны с ошибкой email домена.',
        '',
        '## Ожидаемый результат',
        'Пользователь видит понятную ошибку домена email и может исправить адрес до отправки формы.',
        '',
        '## Критерии приёмки',
        '- Ошибка появляется для домена без MX-записи.',
        '- Текст ошибки проверен на desktop и mobile.'
      ].join('\n')
    }
  ]);
  const report = buildStakeholderUpdateReport(analyzeUnifiedTasks(tasks));

  assert.equal(report.health, 'green');
  assert.equal(report.summary.highRiskTasks, 0);
  assert.equal(report.summary.blockerTasks, 0);
  assert.equal(report.asks[0].urgency, 'monitor');
  assert.ok(report.highlights.some((highlight) => highlight.includes('High-risk')));
});

test('formatStakeholderUpdateMarkdown includes stakeholder sections', () => {
  const tasks = normalizeUnifiedTasks([
    {
      id: 'UPDATE-4',
      source: 'file',
      title: 'Починить оплату',
      task_type: 'bug',
      status: 'Testing',
      description: 'Оплата не работает, нужно срочно пофиксить как обсуждали.'
    }
  ]);
  const report = buildStakeholderUpdateReport(analyzeUnifiedTasks(tasks));
  const markdown = formatStakeholderUpdateMarkdown(report);

  assert.match(markdown, /Stakeholder Update/);
  assert.match(markdown, /Executive Summary/);
  assert.match(markdown, /Risks To Watch/);
  assert.match(markdown, /Asks/);
  assert.match(markdown, /Next Actions/);
});
