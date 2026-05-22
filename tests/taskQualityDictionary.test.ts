import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeToneOfVoice
} from '../src/analyzers/toneOfVoiceAnalyzer';
import {
  getStopPhrases,
  loadConfig
} from '../src/config';
import {
  analyzeSmartTask
} from '../src/smart/smartAnalyzer';

test('default task quality dictionary provides stop phrases without project config', () => {
  const config = loadConfig('__missing_clarity_guardian_config__.json');
  const stopPhrases = getStopPhrases(config, 'ru', 'task');

  assert.ok(stopPhrases.some((rule) => rule.phrase === 'потом уточним'));
  assert.ok(stopPhrases.some((rule) => rule.phrase === 'и так далее'));
  assert.equal(
    stopPhrases.filter((rule) => rule.phrase === 'сделать красиво').length,
    1
  );
});

test('default bad formulations dictionary feeds tone analysis', () => {
  const config = loadConfig('__missing_clarity_guardian_config__.json');
  const result = analyzeToneOfVoice('Сделать checkout по аналогии с прошлым проектом.', {
    language: 'ru',
    workItemType: 'task',
    badFormulations: config.badFormulations
  });

  assert.ok(result.categories.includes('vague_wording'));
  assert.ok(result.problematicPhrases.some((phrase) => phrase.phrase === 'по аналогии'));
});

test('positive task dictionary helps SMART recognize verification and time signals', () => {
  const result = analyzeSmartTask(
    'До 2026-06-01 добавить событие payment_failed в checkout. Готово, если QA проверяет событие в staging dashboard, в payload есть error_type, а support tickets по ошибке снижаются на 10%.'
  );
  const measurable = result.criteria.find((criterion) => criterion.key === 'measurable');
  const timeBound = result.criteria.find((criterion) => criterion.key === 'timeBound');

  assert.equal(result.status, 'strong');
  assert.ok(measurable);
  assert.ok(timeBound);
  assert.equal(measurable.score, 100);
  assert.ok(timeBound.score >= 50);
});
