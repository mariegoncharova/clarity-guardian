import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeUnifiedTasks
} from '../src/analytics';
import {
  buildEvidenceBriefReport,
  formatEvidenceBriefMarkdown
} from '../src/evidence-brief';
import {
  normalizeUnifiedTasks
} from '../src/task-model';

test('buildEvidenceBriefReport prioritizes tasks with weak evidence and unclear handoff', () => {
  const tasks = normalizeUnifiedTasks([
    {
      id: 'BRIEF-1',
      source: 'file',
      title: 'Улучшить onboarding по жалобам пользователей',
      task_type: 'task',
      description: 'Пользователи жалуются, надо быстро улучшить onboarding как обсуждали.'
    },
    {
      id: 'BRIEF-2',
      source: 'file',
      title: 'Добавить проверку email домена',
      task_type: 'task',
      description: [
        '## Контекст',
        'По данным support dashboard, 18% обращений по регистрации связаны с ошибкой email домена.',
        '',
        '## Ожидаемый результат',
        'Пользователь видит понятную ошибку домена email и может исправить адрес до отправки формы.',
        '',
        '## Критерии приёмки',
        '- Ошибка появляется для домена без MX-записи.',
        '- Текст ошибки проверен на desktop и mobile.'
      ].join('\n')
    }
  ]);
  const report = buildEvidenceBriefReport(analyzeUnifiedTasks(tasks), {
    generatedAt: '2026-05-18T00:00:00.000Z'
  });

  assert.equal(report.totalTasks, 2);
  assert.ok(report.includedTasks >= 1);
  assert.equal(report.items[0].taskId, 'BRIEF-1');
  assert.equal(report.items[0].decision, 'needs_evidence_review');
  assert.ok(report.items[0].priorityScore >= 70);
  assert.ok(report.items[0].evidenceGaps.some((gap) => gap.code === 'missing_context'));
  assert.ok(report.items[0].evidenceGaps.some((gap) => gap.code === 'missing_evidence_source'));
  assert.ok(report.items[0].evidenceGaps.some((gap) => gap.code === 'missing_acceptance_criteria'));
});

test('buildEvidenceBriefReport can include ready evidence briefs', () => {
  const tasks = normalizeUnifiedTasks([
    {
      id: 'BRIEF-3',
      source: 'file',
      title: 'Снизить ошибки регистрации на email домене',
      task_type: 'task',
      description: [
        '## Контекст',
        'По данным support dashboard, 18% обращений по регистрации связаны с ошибкой email домена.',
        '',
        '## Ожидаемый результат',
        'Доля обращений по ошибке email домена снижается до 10% после релиза.',
        '',
        '## Критерии приёмки',
        '- Ошибка появляется для домена без MX-записи.',
        '- Событие validation_error_domain отправляется в analytics dashboard.'
      ].join('\n')
    }
  ]);
  const report = buildEvidenceBriefReport(analyzeUnifiedTasks(tasks), {
    includeReady: true,
    minPriorityScore: 0
  });

  assert.equal(report.includedTasks, 1);
  assert.equal(report.items[0].decision, 'ready_for_execution');
  assert.equal(report.items[0].evidenceGaps.length, 0);
  assert.ok(report.items[0].evidenceSignals.some((signal) => signal.includes('измеримый')));
});

test('formatEvidenceBriefMarkdown includes hypothesis, gaps, and next actions', () => {
  const tasks = normalizeUnifiedTasks([
    {
      id: 'BRIEF-4',
      source: 'file',
      title: 'Проверить оплату',
      description: 'Оплата не работает, нужно починить.'
    }
  ]);
  const report = buildEvidenceBriefReport(analyzeUnifiedTasks(tasks));
  const markdown = formatEvidenceBriefMarkdown(report);

  assert.match(markdown, /Evidence Brief/);
  assert.match(markdown, /Working hypothesis/);
  assert.match(markdown, /Evidence gaps/);
  assert.match(markdown, /Next actions/);
});
