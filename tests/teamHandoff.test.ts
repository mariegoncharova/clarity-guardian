import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeUnifiedTasks
} from '../src/analytics';
import {
  buildTeamHandoffReport,
  formatTeamHandoffMarkdown
} from '../src/team-handoff';
import {
  normalizeUnifiedTasks
} from '../src/task-model';

test('buildTeamHandoffReport separates Analyst, Developer and QA blockers', () => {
  const tasks = normalizeUnifiedTasks([
    {
      id: 'HAND-1',
      source: 'file',
      title: 'Починить оплату',
      task_type: 'bug',
      priority: 'high',
      status: 'Testing',
      assignee: 'backend_1',
      description: 'Оплата не работает, нужно срочно пофиксить как обсуждали.'
    },
    {
      id: 'HAND-2',
      source: 'file',
      title: 'Добавить подсказку email',
      task_type: 'task',
      priority: 'medium',
      status: 'Backlog',
      assignee: 'frontend_1',
      description: [
        '## Контекст',
        'Пользователи часто ошибаются в домене email при регистрации.',
        '',
        '## Ожидаемый результат',
        'Пользователь видит понятную подсказку рядом с полем email и исправляет адрес до отправки.',
        '',
        '## Критерии приёмки',
        '- Подсказка видна на desktop и mobile.',
        '- Ошибка проверена на форме регистрации.'
      ].join('\n')
    }
  ]);
  const report = buildTeamHandoffReport(analyzeUnifiedTasks(tasks), {
    generatedAt: '2026-05-25T00:00:00.000Z',
    includeReady: true
  });
  const riskyItem = report.items.find((item) => item.taskId === 'HAND-1');
  const clearItem = report.items.find((item) => item.taskId === 'HAND-2');

  assert.equal(report.totalTasks, 2);
  assert.ok(riskyItem);
  assert.equal(riskyItem?.overallStatus, 'blocked');
  assert.equal(riskyItem?.recommendedMeeting, 'risk_review');
  assert.ok(riskyItem?.analyst.blockers.some((blocker) => /context|expected/i.test(blocker)));
  assert.ok(riskyItem?.developer.blockers.length);
  assert.ok(riskyItem?.qa.blockers.some((blocker) => /acceptance|expected|reproduction/i.test(blocker)));
  assert.ok(clearItem);
  assert.ok(clearItem?.developer.status === 'ready' || clearItem?.developer.status === 'needs_input');
  assert.ok(report.summary.totalRoleBlockers > 0);
  assert.ok(report.recommendations.some((recommendation) => /Analyst|QA|Developer/i.test(recommendation)));
});

test('formatTeamHandoffMarkdown includes role distribution and handoff queue', () => {
  const tasks = normalizeUnifiedTasks([
    {
      id: 'HAND-3',
      source: 'file',
      title: 'Переделать фильтры каталога',
      task_type: 'task',
      status: 'Backlog',
      description: 'Фильтры нужно сделать удобнее, scope вырос, детали обсудим позже.'
    }
  ]);
  const report = buildTeamHandoffReport(analyzeUnifiedTasks(tasks));
  const markdown = formatTeamHandoffMarkdown(report);

  assert.match(markdown, /Team Handoff Matrix/);
  assert.match(markdown, /Role Distribution/);
  assert.match(markdown, /Handoff Queue/);
  assert.match(markdown, /Analyst/);
  assert.match(markdown, /Developer/);
  assert.match(markdown, /QA/);
});
