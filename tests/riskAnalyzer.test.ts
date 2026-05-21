import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeRisk,
  analyzeTaskRisk
} from '../src/risk/analyzer';
import {
  generateRiskReport
} from '../src/risk/risk-report';
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

test('risk radar returns low risk for task with context, expected result and acceptance criteria', () => {
  const result = analyzeRisk({
    id: 'RISK-LOW',
    source: 'demo',
    title: 'Добавить подсказку профиля',
    description: [
      '## Контекст',
      'Пользователи не понимают, где изменить настройки уведомлений в профиле.',
      '',
      '## Ожидаемый результат',
      'Пользователь видит подсказку рядом с настройкой уведомлений.',
      '',
      '## Критерии приёмки',
      '- Подсказка видна на desktop и mobile.',
      '- Текст не перекрывает форму.',
      '',
      '## Edge cases',
      '- Настройки открыты с мобильного браузера.',
      '',
      '## QA notes',
      '- Проверить demo_user_01.',
      '',
      'Figma: https://example.com/profile-hint'
    ].join('\n'),
    clarityScore: 90
  });

  assert.equal(result.riskLevel, 'low');
  assert.ok(result.riskScore <= 30);
  assert.ok(!result.categories.includes('missing_acceptance_criteria'));
});

test('risk radar returns medium risk for task with partial information', () => {
  const result = analyzeRisk({
    id: 'RISK-MEDIUM',
    source: 'demo',
    title: 'Обновить email template',
    description: [
      '## Контекст',
      'Пользователь получает устаревшее приветственное письмо после регистрации.',
      '',
      '## Ожидаемый результат',
      'Пользователь получает письмо с приветствием и ссылкой на настройки профиля.'
    ].join('\n'),
    clarityScore: 64
  });

  assert.equal(result.riskLevel, 'medium');
  assert.ok(result.categories.includes('missing_acceptance_criteria'));
  assert.ok(result.recommendations.some((item) => /критерии приёмки/i.test(item)));
});

test('risk radar returns high risk for vague task without acceptance criteria', () => {
  const result = analyzeRisk({
    id: 'RISK-HIGH',
    source: 'demo',
    title: 'Пофиксить оплату как обсуждали',
    description: 'Оплата не работает. Нужно срочно пофиксить и сделать нормально, как раньше. Что-то сломалось, надо посмотреть.',
    clarityScore: 28
  });

  assert.equal(result.riskLevel, 'high');
  assert.ok(result.riskScore >= 66);
  assert.ok(result.categories.includes('vague_wording'));
  assert.ok(result.categories.includes('missing_acceptance_criteria'));
});

test('risk radar increases score when clarityScore is low', () => {
  const result = analyzeRisk({
    id: 'RISK-CLARITY',
    source: 'demo',
    title: 'Добавить баннер',
    description: [
      '## Контекст',
      'Команде нужно показать пользователю важное предупреждение в профиле.',
      '',
      '## Ожидаемый результат',
      'Пользователь видит предупреждение в верхней части профиля.',
      '',
      '## Критерии приёмки',
      '- Баннер отображается для пользователя demo_user_01.',
      '- Баннер можно закрыть.'
    ].join('\n'),
    clarityScore: 35
  });

  assert.ok(result.riskScore >= 25);
  assert.ok(result.detectedProblems.some((problem) => /Clarity Score/i.test(problem.message)));
});

test('risk radar detects urgency without explanation', () => {
  const result = analyzeRisk({
    id: 'RISK-URGENT',
    source: 'demo',
    title: 'Срочно обновить текст',
    description: [
      '## Контекст',
      'Пользователь видит старый текст на экране профиля.',
      '',
      '## Ожидаемый результат',
      'Пользователь видит новый текст на экране профиля.',
      '',
      '## Критерии приёмки',
      '- Новый текст отображается на desktop и mobile.',
      '',
      'Срочно.'
    ].join('\n'),
    clarityScore: 80
  });

  assert.ok(result.categories.includes('communication_overhead'));
  assert.ok(result.detectedProblems.some((problem) => /срочность/i.test(problem.message)));
});

test('risk radar creates QA notes when QA details are missing', () => {
  const result = analyzeRisk({
    id: 'RISK-QA',
    source: 'demo',
    title: 'Добавить настройку email',
    description: [
      '## Контекст',
      'Пользователю нужна отдельная настройка email-уведомлений.',
      '',
      '## Ожидаемый результат',
      'Пользователь может включить или выключить email-уведомления.',
      '',
      '## Критерии приёмки',
      '- Настройка сохраняется после reload.',
      '- Изменение не влияет на push-уведомления.'
    ].join('\n'),
    clarityScore: 86
  });

  assert.ok(result.qaNotes.some((note) => /edge cases|тестовых данных|ссылок|логов|примеров/i.test(note)));
});

test('risk radar markdown report contains required sections', () => {
  const result = analyzeRisk({
    id: 'RISK-REPORT',
    source: 'demo',
    title: 'Починить форму',
    description: 'Форма не работает, нужно починить.'
  });
  const markdown = generateRiskReport(result);

  assert.match(markdown, /# Risk Radar Report/);
  assert.match(markdown, /## Task/);
  assert.match(markdown, /## Risk Summary/);
  assert.match(markdown, /## Detected Problems/);
  assert.match(markdown, /## Recommendations/);
  assert.match(markdown, /## Manager Summary/);
  assert.match(markdown, /## QA Notes/);
  assert.match(markdown, /## Rewritten Task Suggestion/);
});
