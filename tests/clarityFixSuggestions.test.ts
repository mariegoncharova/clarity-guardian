import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeTask
} from '../src/analyze';

test('analyzeTask returns actionable clarity fix suggestions for unclear tasks', () => {
  const result = analyzeTask({
    type: 'issue',
    title: 'Пофиксить оплату как обсуждали',
    body: 'Оплата не работает, срочно сделайте нормально.',
    labels: []
  });

  assert.ok(result.clarityFixSuggestions.questions.some((question) =>
    question.includes('пользовательскую') || question.includes('бизнес-проблему')
  ));
  assert.ok(result.clarityFixSuggestions.questions.some((question) =>
    question.includes('критериям')
  ));
  assert.match(result.clarityFixSuggestions.draftMarkdown, /## Контекст/);
  assert.match(result.clarityFixSuggestions.draftMarkdown, /## Ожидаемый результат/);
  assert.match(result.clarityFixSuggestions.draftMarkdown, /## Критерии приёмки/);
  assert.match(result.clarityFixSuggestions.pmFriendlyRewrite, /оплат/);
  assert.ok(result.clarityFixSuggestions.nextActions.length > 0);
  assert.match(result.commentMarkdown, /Clarity Fix Suggestions/);
});

test('analyzeTask keeps fix suggestions lightweight for clear tasks', () => {
  const result = analyzeTask({
    type: 'issue',
    title: 'Проверить оплату после 3DS',
    body: [
      '## Контекст',
      'Оплата картой иногда не завершалась после прохождения 3DS у пользователя в checkout.',
      '',
      '## Ожидаемый результат',
      'После успешного 3DS пользователь возвращается на экран успеха, заказ получает статус paid.',
      '',
      '## Критерии приёмки',
      '- Оплата с 3DS проходит успешно.',
      '- При ошибке банка показывается понятное сообщение.',
      '- Повторная оплата доступна.'
    ].join('\n'),
    labels: []
  });

  assert.deepEqual(result.clarityFixSuggestions.questions, []);
  assert.equal(result.clarityFixSuggestions.nextActions.length, 1);
  assert.match(result.clarityFixSuggestions.pmFriendlyRewrite, /достаточно ясной/);
});
