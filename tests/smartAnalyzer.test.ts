import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeSmartTask,
  getSmartCriterion
} from '../src/smart/smartAnalyzer';
import { formatSmartAnalysisMarkdown } from '../src/smart/smartFormatter';

import type {
  SmartAnalysisResult,
  SmartCriterionKey
} from '../src/smart/smartTypes';

function criterion(result: SmartAnalysisResult, key: SmartCriterionKey) {
  const item = getSmartCriterion(result, key);

  assert.ok(item, `Expected SMART criterion ${key}`);

  return item;
}

test('analyzeSmartTask gives strong score for a complete SMART task', () => {
  const result = analyzeSmartTask(
    'До конца текущего спринта добавить понятное сообщение об ошибке на экран оплаты при отклонении платежа банком. ' +
    'Успех: пользователь видит причину отказа, повторный сценарий оплаты доступен, ошибка покрыта тест-кейсами, ' +
    'количество обращений в поддержку по причине payment_failed должно снизиться на 10%.'
  );

  assert.equal(result.status, 'strong');
  assert.ok(result.totalScore >= 80);
  assert.ok(criterion(result, 'specific').score >= 80);
  assert.ok(criterion(result, 'measurable').score >= 80);
});

test('analyzeSmartTask gives weak score for a vague task', () => {
  const result = analyzeSmartTask('Пофиксить экран оплаты, там что-то неудобно.');

  assert.equal(result.status, 'weak');
  assert.ok(result.totalScore < 50);
  assert.ok(criterion(result, 'specific').missingSignals.some((signal) =>
    signal.includes('пофиксить') || signal.includes('неудобно')
  ));
});

test('analyzeSmartTask detects a task without deadline', () => {
  const result = analyzeSmartTask({
    id: 'SMART-1',
    source: 'file',
    title: 'Добавить сообщение об ошибке на экран оплаты',
    body: '## Контекст\nПользователь не понимает причину отказа банка.\n\n## Ожидаемый результат\nПри отказе банка пользователь видит причину ошибки.\n\n## Критерии приёмки\n- Сообщение показывается при bank_decline.\n- Повторная оплата доступна.',
    acceptanceCriteria: [
      'Сообщение показывается при bank_decline.',
      'Повторная оплата доступна.'
    ]
  });

  assert.equal(criterion(result, 'timeBound').score, 0);
  assert.ok(criterion(result, 'timeBound').missingSignals.some((signal) =>
    signal.includes('дедлайна')
  ));
});

test('analyzeSmartTask detects a task without metrics', () => {
  const result = analyzeSmartTask(
    'Добавить сообщение об ошибке на экран оплаты. Готово, если пользователь видит текст ошибки и может повторить оплату.'
  );

  assert.ok(criterion(result, 'measurable').score < 80);
  assert.ok(criterion(result, 'measurable').missingSignals.some((signal) =>
    signal.includes('метрик')
  ));
});

test('analyzeSmartTask does not punish vague verb when concrete metric is present', () => {
  const result = analyzeSmartTask(
    'Оптимизировать загрузку страницы до 2 секунд на мобильных устройствах.'
  );
  const specific = criterion(result, 'specific');

  assert.equal(specific.status, 'passed');
  assert.ok(!specific.missingSignals.some((signal) => signal.includes('оптимизировать')));
  assert.ok(criterion(result, 'measurable').score >= 50);
});

test('analyzeSmartTask handles empty description', () => {
  const result = analyzeSmartTask('');

  assert.equal(result.totalScore, 0);
  assert.equal(result.status, 'weak');
  assert.ok(result.criteria.every((item) => item.status === 'failed'));
});

test('analyzeSmartTask handles title-only task', () => {
  const result = analyzeSmartTask('Добавить сообщение об ошибке на экран оплаты');

  assert.ok(result.totalScore > 0);
  assert.ok(['weak', 'needs_improvement'].includes(result.status));
  assert.ok(criterion(result, 'specific').foundSignals.length > 0);
});

test('analyzeSmartTask uses acceptance criteria from unified task model', () => {
  const result = analyzeSmartTask({
    id: 'SMART-2',
    source: 'file',
    title: 'Добавить событие analytics для ошибки оплаты',
    body: 'Команде аналитики нужно видеть ошибки оплаты в staging dashboard.',
    acceptanceCriteria: [
      'Событие payment_failed отправляется при ошибке банка.',
      'В событии есть error_type и payment_method.',
      'QA проверяет событие в staging.'
    ],
    sprint: 'Sprint 12',
    components: ['checkout-api'],
    labels: ['analytics', 'payment']
  });

  assert.ok(criterion(result, 'measurable').score >= 60);
  assert.ok(criterion(result, 'measurable').foundSignals.some((signal) =>
    signal.includes('acceptance criteria')
  ));
});

test('formatSmartAnalysisMarkdown adds readable SMART section', () => {
  const result = analyzeSmartTask('Пофиксить экран оплаты, там что-то неудобно.');
  const markdown = formatSmartAnalysisMarkdown(result);

  assert.match(markdown, /## SMART-анализ задачи/);
  assert.match(markdown, /Общий SMART Score:/);
  assert.match(markdown, /Краткая рекомендация для менеджера/);
});
