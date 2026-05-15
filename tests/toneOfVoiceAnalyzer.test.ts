import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeToneOfVoice } from '../src/analyzers/toneOfVoiceAnalyzer';

test('detects blaming tone, unclear urgency, and vague wording', () => {
  const result = analyzeToneOfVoice('Опять всё сломалось, срочно сделайте нормально.');

  assert.equal(result.riskLevel, 'high');
  assert.equal(result.tone, 'tense');
  assert.ok(result.categories.includes('blaming_tone'));
  assert.ok(result.categories.includes('unclear_urgency'));
  assert.ok(result.categories.includes('vague_wording'));
});

test('detects missing context and expected result for weak UI change', () => {
  const result = analyzeToneOfVoice('Нужно поменять кнопку.');

  assert.equal(result.riskLevel, 'medium');
  assert.ok(result.categories.includes('missing_context'));
  assert.ok(result.categories.includes('missing_expected_result'));
});

test('keeps constructive task tone low risk', () => {
  const result = analyzeToneOfVoice(
    'При оплате заказа пользователь видит ошибку. Нужно проверить причину и восстановить успешную оплату. Приоритет высокий, так как проблема блокирует завершение заказа.'
  );

  assert.equal(result.riskLevel, 'low');
  assert.equal(result.tone, 'constructive');
  assert.ok(!result.categories.includes('blaming_tone'));
  assert.ok(!result.categories.includes('passive_aggressive'));
});

test('detects too informal wording and missing expected result', () => {
  const result = analyzeToneOfVoice('Там какая-то фигня с оплатой, юзер тыкает и ничего.');

  assert.ok(result.categories.includes('too_informal'));
  assert.ok(result.categories.includes('missing_expected_result'));
  assert.ok(result.tone === 'informal' || result.tone === 'mixed');
});

test('detects passive-aggressive wording', () => {
  const result = analyzeToneOfVoice('Было бы неплохо наконец-то это исправить.');

  assert.ok(result.categories.includes('passive_aggressive'));
  assert.ok(result.riskLevel === 'medium' || result.riskLevel === 'high');
});
