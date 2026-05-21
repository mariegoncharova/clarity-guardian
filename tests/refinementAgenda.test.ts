import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeUnifiedTasks
} from '../src/analytics';
import {
  buildRefinementAgendaReport,
  formatRefinementAgendaMarkdown
} from '../src/refinement-agenda';
import {
  normalizeUnifiedTasks
} from '../src/task-model';

test('buildRefinementAgendaReport prioritizes blockers for refinement', () => {
  const tasks = normalizeUnifiedTasks([
    {
      id: 'AGENDA-1',
      source: 'file',
      title: 'Интеграция с платёжным провайдером',
      task_type: 'task',
      priority: 'high',
      status: 'Backlog',
      description: [
        '## Контекст',
        'Команда подключает новый endpoint платёжного провайдера.',
        '',
        '## Ожидаемый результат',
        'Backend отправляет запрос в новый endpoint и сохраняет результат операции.',
        '',
        '## Критерии приёмки',
        '- Успешный ответ провайдера сохраняет payment_id.',
        '',
        'Ждём ответ от провайдера по финальному формату ошибок.'
      ].join('\n')
    },
    {
      id: 'AGENDA-2',
      source: 'file',
      title: 'Обновить подсказку профиля',
      task_type: 'task',
      status: 'Backlog',
      description: [
        '## Контекст',
        'Пользователи не понимают, где изменить настройки уведомлений в профиле.',
        '',
        '## Ожидаемый результат',
        'Пользователь видит понятную подсказку рядом с настройкой уведомлений.',
        '',
        '## Критерии приёмки',
        '- Подсказка видна на desktop и mobile.',
        '- Текст не перекрывает форму.'
      ].join('\n')
    }
  ]);
  const report = buildRefinementAgendaReport(analyzeUnifiedTasks(tasks), {
    generatedAt: '2026-05-21T00:00:00.000Z'
  });

  assert.equal(report.totalTasks, 2);
  assert.equal(report.includedTasks, 1);
  assert.equal(report.items[0].taskId, 'AGENDA-1');
  assert.equal(report.items[0].decision, 'resolve_blocker');
  assert.equal(report.items[0].readiness, 'must_refine');
  assert.equal(report.items[0].ownerRole, 'Tech Lead');
  assert.ok(report.items[0].timeboxMinutes >= 12);
  assert.ok(report.summary.blockerItems >= 1);
});

test('buildRefinementAgendaReport can include ready candidates', () => {
  const tasks = normalizeUnifiedTasks([
    {
      id: 'AGENDA-3',
      source: 'file',
      title: 'Добавить проверку email домена',
      task_type: 'task',
      status: 'Backlog',
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
  const report = buildRefinementAgendaReport(analyzeUnifiedTasks(tasks), {
    includeReady: true,
    minPriorityScore: 0
  });

  assert.equal(report.includedTasks, 1);
  assert.equal(report.items[0].decision, 'ready_to_commit');
  assert.equal(report.items[0].readiness, 'ready_candidate');
  assert.equal(report.items[0].timeboxMinutes, 4);
  assert.ok(report.items[0].questions.some((question) => question.includes('commitment')));
});

test('formatRefinementAgendaMarkdown includes meeting plan and capture decisions', () => {
  const tasks = normalizeUnifiedTasks([
    {
      id: 'AGENDA-4',
      source: 'file',
      title: 'Переделать фильтры каталога',
      task_type: 'task',
      status: 'In Progress',
      description: 'Фильтры нужно сделать удобнее. Добавили несколько сценариев, изменился scope, надо декомпозировать работу.'
    }
  ]);
  const report = buildRefinementAgendaReport(analyzeUnifiedTasks(tasks));
  const markdown = formatRefinementAgendaMarkdown(report);

  assert.match(markdown, /Refinement Agenda/);
  assert.match(markdown, /Meeting Plan/);
  assert.match(markdown, /Timebox:/);
  assert.match(markdown, /Decision to capture/);
});
