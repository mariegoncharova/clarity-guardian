import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeUnifiedTasks
} from '../src/analytics';
import {
  buildQuickBugFixReport,
  formatQuickBugFixMarkdown
} from '../src/quick-bug-fix';
import {
  normalizeUnifiedTasks
} from '../src/task-model';

test('buildQuickBugFixReport promotes clear small bugs to quick fix ready', () => {
  const tasks = normalizeUnifiedTasks([
    {
      id: 'BUG-1',
      source: 'file',
      title: 'Исправить текст ошибки промокода',
      assignee: 'frontend_1',
      priority: 'medium',
      task_type: 'bug',
      description: [
        '## Контекст',
        'Пользователь видит технический текст ошибки при вводе истёкшего промокода.',
        '',
        '## Шаги воспроизведения',
        '- Ввести истёкший промокод PROMO_OLD.',
        '- Нажать применить.',
        '',
        '## Фактический результат',
        'Показывается технический код expired_promo.',
        '',
        '## Ожидаемый результат',
        'Для истёкшего промокода показывается понятный текст без технических кодов.',
        '',
        '## Критерии приёмки',
        '- Истёкший промокод показывает понятный текст.',
        '- Активный промокод продолжает применяться.'
      ].join('\n')
    }
  ]);
  const report = buildQuickBugFixReport(analyzeUnifiedTasks(tasks), {
    generatedAt: '2026-05-20T00:00:00.000Z'
  });

  assert.equal(report.bugsTracked, 1);
  assert.equal(report.quickFixReady, 1);
  assert.equal(report.items[0].quickFixStatus, 'quick_fix_ready');
  assert.ok(report.items[0].timeboxMinutes > 0);
  assert.ok(report.items[0].patchPlan.some((item) => /текст|validation|guard/i.test(item)));
});

test('buildQuickBugFixReport separates unclear and risky bugs', () => {
  const tasks = normalizeUnifiedTasks([
    {
      id: 'BUG-2',
      source: 'file',
      title: 'Баг оплаты',
      task_type: 'bug',
      description: 'Оплата не работает, нужно пофиксить как обсуждали.'
    },
    {
      id: 'BUG-3',
      source: 'file',
      title: 'Исправить доступы в production',
      assignee: 'devops_1',
      priority: 'high',
      task_type: 'bug',
      description: [
        '## Контекст',
        'В production мониторинге неверно отображаются доступы support.',
        '',
        '## Ожидаемый результат',
        'Доступы видны только разрешённой группе support-oncall.',
        '',
        '## Критерии приёмки',
        '- Доступ есть только у support-oncall.',
        '- Все изменения записаны в audit log.'
      ].join('\n')
    }
  ]);
  const report = buildQuickBugFixReport(analyzeUnifiedTasks(tasks), {
    includeNeedsReview: true
  });
  const unclear = report.items.find((item) => item.taskId === 'BUG-2');
  const risky = report.items.find((item) => item.taskId === 'BUG-3');

  assert.ok(unclear);
  assert.equal(unclear.quickFixStatus, 'needs_risk_review');
  assert.ok(unclear.blockers.includes('high risk'));

  assert.ok(risky);
  assert.equal(risky.quickFixStatus, 'needs_risk_review');
  assert.ok(risky.patchPlan.some((item) => /risk review|доступы/i.test(item)));
});

test('formatQuickBugFixMarkdown includes queue, patch plan, and verification checklist', () => {
  const tasks = normalizeUnifiedTasks([
    {
      id: 'BUG-4',
      source: 'file',
      title: 'Ошибка валидации email',
      assignee: 'backend_1',
      priority: 'medium',
      task_type: 'bug',
      description: [
        '## Контекст',
        'Пользователь может отправить email без домена.',
        '',
        '## Ожидаемый результат',
        'Форма показывает ошибку валидации до отправки.',
        '',
        '## Критерии приёмки',
        '- Email без домена не отправляется.'
      ].join('\n')
    }
  ]);
  const report = buildQuickBugFixReport(analyzeUnifiedTasks(tasks));
  const markdown = formatQuickBugFixMarkdown(report);

  assert.match(markdown, /Quick Bug Fix Queue/);
  assert.match(markdown, /Patch plan/);
  assert.match(markdown, /Verification checklist/);
});
