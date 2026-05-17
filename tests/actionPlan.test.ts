import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeUnifiedTasks
} from '../src/analytics';
import {
  buildActionPlanReport,
  formatActionPlanMarkdown
} from '../src/action-plan';
import {
  normalizeUnifiedTasks
} from '../src/task-model';

test('buildActionPlanReport prioritizes unclear high-risk tasks', () => {
  const tasks = normalizeUnifiedTasks([
    {
      id: 'PLAN-1',
      source: 'file',
      title: 'Починить оплату как обсуждали',
      clarity_score: 35,
      description: 'Что-то не работает, надо срочно сделать нормально.'
    },
    {
      id: 'PLAN-2',
      source: 'file',
      title: 'Обновить подсказку профиля',
      assignee: 'frontend_1',
      priority: 'medium',
      task_type: 'task',
      clarity_score: 90,
      description: [
        '## Контекст',
        'Пользователи не понимают, где изменить настройки уведомлений в профиле.',
        '',
        '## Ожидаемый результат',
        'Пользователь видит понятную подсказку рядом с настройкой уведомлений.',
        '',
        '## Критерии приёмки',
        '- Подсказка видна на desktop и mobile.',
        '- Текст не перекрывает форму.'
      ].join('\n')
    }
  ]);
  const report = buildActionPlanReport(analyzeUnifiedTasks(tasks));

  assert.equal(report.totalTasks, 2);
  assert.equal(report.includedTasks, 1);
  assert.equal(report.items[0].taskId, 'PLAN-1');
  assert.equal(report.items[0].riskLevel, 'high');
  assert.ok(report.items[0].priorityScore > 80);
  assert.ok(report.items[0].questions.length > 0);
});

test('formatActionPlanMarkdown includes reasons, questions, and next actions', () => {
  const tasks = normalizeUnifiedTasks([
    {
      id: 'PLAN-3',
      source: 'file',
      title: 'Поменять кнопку',
      description: 'Нужно поменять кнопку.'
    }
  ]);
  const report = buildActionPlanReport(analyzeUnifiedTasks(tasks));
  const markdown = formatActionPlanMarkdown(report);

  assert.match(markdown, /Clarity Action Plan/);
  assert.match(markdown, /Questions to ask/);
  assert.match(markdown, /Next actions/);
});
