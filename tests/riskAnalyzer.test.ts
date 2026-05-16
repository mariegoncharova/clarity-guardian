import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeTaskRisk
} from '../src/risk/analyzer';
import {
  checkDefinitionOfReady
} from '../src/readiness/dor';
import {
  normalizeUnifiedTask
} from '../src/task-model';

test('risk and readiness derive clarity score when input task has no clarity_score field', () => {
  const task = normalizeUnifiedTask({
    id: 'CLEAR-1',
    source: 'file',
    title: 'Обновить справку по настройкам профиля',
    assignee: 'pm_1',
    priority: 'medium',
    task_type: 'task',
    description: [
      '## Контекст',
      'Пользователь не понимает, где изменить настройки уведомлений в профиле.',
      '',
      '## Ожидаемый результат',
      'Пользователь видит понятную подсказку рядом с настройкой уведомлений.',
      '',
      '## Критерии приёмки',
      '- Подсказка видна на desktop и mobile.',
      '- Текст не перекрывает форму и помогает проверить сценарий.'
    ].join('\n')
  });

  const risk = analyzeTaskRisk(task);
  const readiness = checkDefinitionOfReady(task);

  assert.equal(risk.riskLevel, 'low');
  assert.ok(!risk.riskFactors.includes('Низкий Clarity Score'));
  assert.equal(readiness.dorPassed, true);
});
