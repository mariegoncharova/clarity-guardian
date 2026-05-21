import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeUnifiedTasks
} from '../src/analytics';
import {
  buildReleaseGuardReport,
  formatReleaseGuardMarkdown
} from '../src/release-guard';
import {
  normalizeUnifiedTasks
} from '../src/task-model';

test('buildReleaseGuardReport blocks release for reopened high-risk payment bug', () => {
  const tasks = normalizeUnifiedTasks([
    {
      id: 'REL-1',
      source: 'file',
      title: 'Bug: оплата падает после 3DS',
      task_type: 'bug',
      priority: 'high',
      status: 'Reopened',
      assignee: 'backend_1',
      description: 'Оплата снова падает после 3DS, нужно срочно починить как обсуждали.',
      status_history: [
        { status: 'In Progress', entered_at: '2026-05-20T09:00:00.000Z', left_at: '2026-05-20T13:00:00.000Z' },
        { status: 'Testing', entered_at: '2026-05-20T13:00:00.000Z', left_at: '2026-05-20T15:00:00.000Z' },
        { status: 'Reopened', entered_at: '2026-05-20T15:00:00.000Z' }
      ]
    }
  ]);
  const report = buildReleaseGuardReport(analyzeUnifiedTasks(tasks), {
    generatedAt: '2026-05-21T00:00:00.000Z'
  });

  assert.equal(report.totalTasks, 1);
  assert.equal(report.releaseDecision, 'no_go');
  assert.ok(report.releaseReadinessScore < 80);
  assert.equal(report.items[0].guardStatus, 'blocked');
  assert.ok(report.items[0].releaseRisks.some((risk) => risk.code === 'regression_history'));
  assert.ok(report.items[0].releaseRisks.some((risk) => risk.code === 'missing_acceptance_criteria'));
  assert.ok(report.releaseChecklist.some((item) => item.includes('Не выпускать релиз')));
});

test('buildReleaseGuardReport returns go for verified low-risk completed work', () => {
  const tasks = normalizeUnifiedTasks([
    {
      id: 'REL-2',
      source: 'file',
      title: 'Обновить подсказку настройки email',
      task_type: 'task',
      priority: 'medium',
      status: 'Done',
      assignee: 'frontend_1',
      completed_at: '2026-05-21T10:00:00.000Z',
      description: [
        '## Контекст',
        'Пользователи не понимают, где изменить email для уведомлений в профиле.',
        '',
        '## Ожидаемый результат',
        'Пользователь видит понятную подсказку рядом с настройкой email и может изменить адрес без обращения в поддержку.',
        '',
        '## Критерии приёмки',
        '- Подсказка видна на desktop и mobile.',
        '- Текст подсказки согласован с поддержкой.',
        '- Результат проверки зафиксирован в комментарии.'
      ].join('\n'),
      comments: [
        'QA passed. Результат проверки: desktop и mobile проверено, регрессии не найдено.'
      ]
    }
  ]);
  const report = buildReleaseGuardReport(analyzeUnifiedTasks(tasks), {
    includeReady: true,
    minImpactScore: 0
  });

  assert.equal(report.releaseDecision, 'go');
  assert.equal(report.summary.releaseReady, 1);
  assert.equal(report.items[0].guardStatus, 'release_ready');
  assert.equal(report.items[0].releaseRisks.length, 0);
});

test('formatReleaseGuardMarkdown includes localized release sections', () => {
  const tasks = normalizeUnifiedTasks([
    {
      id: 'REL-3',
      source: 'file',
      title: 'Проверить rollback для интеграции',
      task_type: 'task',
      status: 'Testing',
      description: 'Интеграция с внешней системой, ждём ответ по API партнёра.'
    }
  ]);
  const report = buildReleaseGuardReport(analyzeUnifiedTasks(tasks));
  const markdown = formatReleaseGuardMarkdown(report);

  assert.match(markdown, /Release Guard/);
  assert.match(markdown, /Решение по релизу/);
  assert.match(markdown, /Чек-лист перед релизом/);
  assert.match(markdown, /Задачи для внимания/);
});
