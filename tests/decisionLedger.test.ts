import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeUnifiedTasks
} from '../src/analytics';
import {
  buildDecisionLedgerReport,
  formatDecisionLedgerMarkdown
} from '../src/decision-ledger';
import {
  normalizeUnifiedTasks
} from '../src/task-model';

test('buildDecisionLedgerReport detects missing decision traceability', () => {
  const tasks = normalizeUnifiedTasks([
    {
      id: 'LEDGER-1',
      source: 'file',
      title: 'Переделать checkout как обсуждали',
      task_type: 'task',
      description: 'Нужно улучшить checkout, добавить сценарии и сделать нормально.'
    },
    {
      id: 'LEDGER-2',
      source: 'file',
      title: 'Добавить событие ошибки оплаты',
      assignee: 'analytics_1',
      priority: 'medium',
      task_type: 'task',
      description: [
        '## Контекст',
        'По данным support dashboard, пользователи часто обращаются из-за ошибок оплаты.',
        '',
        '## Ожидаемый результат',
        'При ошибке оплаты отправляется событие payment_error с типом ошибки и платформой.',
        '',
        '## Критерии приёмки',
        '- Событие отправляется для bank_decline и timeout.',
        '- Analytics dashboard получает событие в staging.'
      ].join('\n')
    }
  ]);
  const report = buildDecisionLedgerReport(analyzeUnifiedTasks(tasks), {
    generatedAt: '2026-05-19T00:00:00.000Z',
    includeReady: true
  });
  const unclear = report.items.find((item) => item.taskId === 'LEDGER-1');
  const ready = report.items.find((item) => item.taskId === 'LEDGER-2');

  assert.ok(unclear);
  assert.equal(unclear.decisionStatus, 'needs_problem_framing');
  assert.ok(unclear.traceabilityScore < 60);
  assert.ok(unclear.missingLinks.includes('Problem framing'));
  assert.ok(unclear.missingLinks.includes('Decision intent'));

  assert.ok(ready);
  assert.equal(ready.decisionStatus, 'decision_ready');
  assert.ok(ready.traceabilityScore >= 90);
  assert.equal(ready.missingLinks.length, 0);
});

test('Decision Ledger keeps evidence separate for tasks sharing a tracker key', () => {
  const tasks = normalizeUnifiedTasks([
    { id: 'repo-a:1', key: '1', title: 'Drafts in repo A', context: 'Users report lost drafts.' },
    { id: 'repo-b:1', key: '1', title: 'Drafts in repo B', context: 'Users report lost drafts in support tickets.' }
  ]);
  const report = buildDecisionLedgerReport(analyzeUnifiedTasks(tasks), { includeReady: true });
  const titlesWithEvidence = report.items
    .filter((item) => item.traceLinks.some((link) => link.key === 'evidence' && link.present))
    .map((item) => item.title);
  assert.deepEqual(titlesWithEvidence, ['Drafts in repo B']);
});

test('buildDecisionLedgerReport flags high-risk tasks that need validation control', () => {
  const tasks = normalizeUnifiedTasks([
    {
      id: 'LEDGER-3',
      source: 'file',
      title: 'Исправить повторную оплату',
      assignee: 'backend_1',
      priority: 'high',
      task_type: 'bug',
      description: [
        '## Контекст',
        'После ошибки банка пользователь может повторить оплату, но сценарий повторной попытки описан неполно.',
        '',
        '## Ожидаемый результат',
        'Пользователь может повторить оплату без создания дубля заказа.'
      ].join('\n')
    }
  ]);
  const report = buildDecisionLedgerReport(analyzeUnifiedTasks(tasks), {
    includeReady: true
  });

  assert.equal(report.items[0].decisionStatus, 'needs_validation_plan');
  assert.ok(report.items[0].missingLinks.includes('Verification method'));
  assert.ok(report.items[0].governanceWarnings.length > 0);
});

test('formatDecisionLedgerMarkdown includes matrix, trace links, and next decision', () => {
  const tasks = normalizeUnifiedTasks([
    {
      id: 'LEDGER-4',
      source: 'file',
      title: 'Проверить оплату',
      description: 'Оплата не работает, нужно починить.'
    }
  ]);
  const report = buildDecisionLedgerReport(analyzeUnifiedTasks(tasks));
  const markdown = formatDecisionLedgerMarkdown(report);

  assert.match(markdown, /Decision Ledger/);
  assert.match(markdown, /Decision Traceability Matrix/);
  assert.match(markdown, /Trace links/);
  assert.match(markdown, /Next decision/);
});
