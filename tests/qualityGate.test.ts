import test from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateQualityGate
} from '../src/quality-gate';
import {
  normalizeUnifiedTasks
} from '../src/task-model';

test('quality gate passes for a ready low-risk task set', () => {
  const tasks = normalizeUnifiedTasks([
    {
      id: 'GATE-1',
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

  const result = evaluateQualityGate(tasks);

  assert.equal(result.passed, true);
  assert.equal(result.summary.highRiskTasksPercent, 0);
  assert.equal(result.failedChecks.length, 0);
});

test('quality gate fails when clarity and readiness fall below thresholds', () => {
  const tasks = normalizeUnifiedTasks([
    {
      id: 'GATE-RED-1',
      source: 'file',
      title: 'Починить оплату как обсуждали',
      clarity_score: 35,
      description: 'Что-то не работает, надо срочно сделать нормально.'
    }
  ]);

  const result = evaluateQualityGate(tasks);

  assert.equal(result.passed, false);
  assert.ok(result.failedChecks.some((check) => check.code === 'average_clarity_score'));
  assert.ok(result.failedChecks.some((check) => check.code === 'ready_tasks_percent'));
  assert.ok(result.failedChecks.some((check) => check.code === 'high_risk_tasks_percent'));
});

test('quality gate can allow empty task sets explicitly', () => {
  const result = evaluateQualityGate([], {
    thresholds: {
      allowEmpty: true
    }
  });

  assert.equal(result.passed, true);
});
