import { analyzeTaskEvidence } from './evidence-brief';
import { buildReleaseGuardItem } from './release-guard';
import { escapeHtml } from './report-utils';
import { getAcceptanceCriteria, getContext, getExecutionDetails, getExpectedResult, isDoneStatus } from './task-signals';
import { buildTeamHandoffItem, type RoleHandoff } from './team-handoff';
import type { TaskAnalysisRecord } from './types';
import { extractFirstMarkdownSection } from './utils';

export const TEAM_WORKSPACE_HTML = 'team-workspace.html';

const ROLES = {
  developer: 'Разработчик',
  qa: 'QA',
  analyst: 'Аналитик',
  lead: 'Техлид'
};
type Role = keyof typeof ROLES;

const BLOCKERS: Record<string, string> = {
  'missing problem context': 'Нужно описать проблему или пользовательский сценарий.',
  'missing expected result': 'Нужно зафиксировать ожидаемый результат.',
  'weak SMART framing': 'Уточнить цель и критерий успеха.',
  'missing evidence source': 'Нужен источник данных или пример из обращений пользователей.',
  'evidence gaps need review': 'Нужно проверить, чем подтверждается постановка.',
  'hidden agreement must be documented': 'Записать договорённость прямо в карточке.',
  'high delivery risk': 'Проверить риск до начала реализации.',
  'external dependency has no owner or ready condition': 'У внешней зависимости нет владельца или условия готовности.',
  'open blocker must be resolved': 'Нужно снять открытый блокер.',
  'scope needs decomposition': 'Разбить объём работ на части.',
  'vague wording remains in task': 'Заменить общие формулировки конкретным поведением.',
  'missing acceptance criteria': 'Нужны критерии приёмки.',
  'bug lacks reproduction or testing signal': 'Нужны шаги воспроизведения или результат проверки.',
  'missing verification plan': 'Нужен план проверки.',
  'open blocker prevents QA handoff': 'Снять блокер перед проверкой.'
};

function field(label: string, value: string | string[]): string {
  if (!value.length) return '';
  const content = Array.isArray(value)
    ? `<ul>${value.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`
    : `<p>${escapeHtml(value)}</p>`;
  return `<div class="field"><h3>${label}</h3>${content}</div>`;
}

function blockers(handoff: RoleHandoff): string {
  return field('Что запросить', handoff.blockers.map((text) =>
    BLOCKERS[text] || text.replace(/^DoR not passed:/, 'Условия старта:').replace(/^DoD not passed:/, 'Условия завершения:')));
}

function status(handoff: RoleHandoff, ready: string): string {
  return handoff.status === 'ready' ? ready : handoff.status === 'blocked' ? 'Есть блокер' : 'Нужно уточнение';
}

function trackerLink(value: string | undefined): string {
  if (!value) return '';
  try {
    const url = new URL(value);
    if ((url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password) {
      return `<a href="${escapeHtml(url.href)}" rel="noreferrer">Открыть в трекере</a>`;
    }
  } catch {
    return '';
  }
  return '';
}

function taskCard(record: TaskAnalysisRecord, index: number): string {
  const task = record.task;
  const release = buildReleaseGuardItem(record);
  const active = !isDoneStatus(task.status);
  if (!active && release.decision === 'go') return '';

  const handoff = buildTeamHandoffItem(record);
  const qaRisks = release.releaseRisks.filter(({ ownerRole }) => ownerRole === 'QA');
  const details = getExecutionDetails(task);
  const plan = details.verification ||
    extractFirstMarkdownSection(task.body, ['Steps to reproduce', 'Шаги воспроизведения']) || '';
  const criteria = getAcceptanceCriteria(task);
  const evidence = active ? analyzeTaskEvidence(record) : undefined;
  const framingSuggestions = handoff.analyst.status === 'ready' ? [] : record.smartAnalysis.criteria
    .filter(({ status }) => status !== 'passed')
    .flatMap(({ recommendations }) => recommendations.slice(0, 1));
  const parts: Partial<Record<Role, { status: string; body: string }>> = {
    ...(evidence ? {
      developer: {
        status: status(handoff.developer, 'Можно брать в работу'),
        body: blockers(handoff.developer) + field('Репозиторий', details.repository) +
          field('Границы реализации', details.scope) + field('Критерии приёмки', criteria)
      },
      analyst: {
        status: status(handoff.analyst, 'Контекст для постановки есть'),
        body: blockers(handoff.analyst) + field('Бизнес-контекст', getContext(task)) +
          field('Что подтверждает постановку', evidence.evidenceSignals) +
          field('Вопросы к уточнению', evidence.questions) +
          field('Что добавить в постановку', framingSuggestions)
      }
    } : {}),
    ...(active || qaRisks.length ? {
      qa: {
        status: qaRisks.length ? 'Нужна проверка перед выпуском' : status(handoff.qa, 'Можно готовить проверку'),
        body: field('План проверки или шаги воспроизведения', plan) + field('Критерии приёмки', criteria) +
          blockers(handoff.qa) + field('Что подтвердить перед выпуском', qaRisks.map(({ title, recommendation }) =>
            `${title}. ${recommendation}`))
      }
    } : {}),
    lead: {
      status: release.decision === 'no_go' ? 'Выпуск на паузе'
        : release.decision === 'review_required' ? 'Перед выпуском нужна проверка' : 'По снимку выпуск возможен',
      body: field('Риски и ответственные роли', release.releaseRisks.map(({ ownerRole, title, recommendation }) =>
        `${ownerRole} · ${title}. ${recommendation}`)) + field('Зависимости из карточки', task.dependencies || []) +
        field('Рекомендации по проверке', release.verificationChecklist) +
        field('Рекомендации по откату', release.rollbackNotes)
    }
  };

  const title = `${handoff.taskId} · ${task.title}`;
  const project = task.projectKey || task.queue || task.repository;
  const hint = [project, task.assignee, task.status].filter(Boolean).join(' · ');
  const search = [title, hint].join(' ').toLowerCase();
  return `<details class="task" name="team-task" id="task-${index}" data-search="${escapeHtml(search)}" data-title="${escapeHtml(title)}"${parts.developer ? '' : ' hidden'}>
    <summary><span class="task-title">${escapeHtml(title)}</span>${hint ? `<span class="meta">${escapeHtml(hint)}</span>` : ''}</summary>
    <div class="task-body">
      ${field('Ожидаемый результат', getExpectedResult(task))}
      ${Object.entries(parts).map(([role, part]) => `<section data-role="${role}"${role === 'developer' ? '' : ' hidden'}>
        <p class="status">${escapeHtml(part.status)}</p>${part.body}
      </section>`).join('')}
      <div class="card-actions"><button type="button" data-copy>Скопировать для передачи</button>${trackerLink(task.url)}</div>
      <p class="copy-status meta" role="status"></p>
      <label class="copy-fallback" hidden>Текст для копирования<textarea readonly rows="6"></textarea></label>
    </div>
  </details>`;
}

export function formatTeamWorkspaceHtml(records: TaskAnalysisRecord[], analyzedAt: string): string {
  const roles = Object.entries(ROLES).map(([id, label]) =>
    `<button type="button" data-switch="${id}" aria-pressed="${id === 'developer'}">${label}</button>`).join('');
  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Передача задач команде · Clarity Guardian</title>
<style>
:root{color-scheme:light;--ink:#182823;--muted:#4c655e;--accent:#185949;--line:#cddbd3;--paper:#fff;--bg:#edf3ef}
*{box-sizing:border-box}[hidden]{display:none!important}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 Inter,system-ui,sans-serif}
main{max-width:850px;margin:auto;padding:28px 20px 48px;overflow-wrap:anywhere}
h1,h2,h3,p{margin:0}h1{font-size:clamp(2rem,6vw,3.2rem);line-height:1.08;letter-spacing:-.04em;margin:8px 0 10px}
a{color:var(--accent);text-underline-offset:.2em}.meta{color:var(--muted);font-size:.9rem}.back{display:inline-block;margin-bottom:14px}
nav{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0 12px}
button{font:inherit;cursor:pointer;border-radius:8px;padding:7px 12px;border:1px solid var(--line);background:var(--paper);color:var(--accent)}
button[aria-pressed=true],[data-copy]{border-color:var(--accent);background:var(--accent);color:#fff}
label{display:block;font-weight:650;margin-top:8px}#task-search,textarea{display:block;width:100%;font:inherit;padding:8px 10px;margin-top:4px;border:1px solid var(--line);border-radius:8px;color:var(--ink)}
.task{background:var(--paper);border:1px solid var(--line);border-radius:12px;margin-top:10px}.task>summary{cursor:pointer;padding:14px}.task-title{font-weight:700}summary .meta{display:block;margin-top:3px}
.task-body{padding:0 14px 14px}.field{margin:9px 0}.field h3{font-size:.95rem;margin-bottom:3px}.field p{white-space:pre-line}.field ul{margin:3px 0;padding-left:22px}
.status{display:inline-block;background:#e4efea;color:var(--accent);padding:3px 8px;border-radius:5px;font-size:.88rem;font-weight:650;margin-top:4px}.card-actions{display:flex;align-items:center;flex-wrap:wrap;gap:9px 14px;margin-top:14px}
:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
@media(max-width:560px){main{padding:20px 12px 32px}nav{gap:6px}}
</style></head><body><main>
<a class="back" href="index.html">К рабочей сводке</a>
<header><p class="meta">Clarity Guardian · Отчёт от ${escapeHtml(analyzedAt.slice(0, 10))}</p><h1>Передача задач команде</h1></header>
<nav aria-label="Роль в команде">${roles}</nav>
<label for="task-search">Найти задачу</label><input id="task-search" type="search" placeholder="Ключ, название или исполнитель">
<p id="empty" hidden>Подходящих задач в этой роли нет.</p>
${records.map(taskCard).join('')}
</main><script>
const switches = [...document.querySelectorAll('[data-switch]')];
const cards = [...document.querySelectorAll('details.task')];
const search = document.getElementById('task-search');
function render(openLinkedTask = false) {
  const [requestedRole, task] = location.hash.slice(1).split('/');
  const role = switches.some(button => button.dataset.switch === requestedRole) ? requestedRole : 'developer';
  const query = search.value.trim().toLowerCase();
  let shown = 0;
  switches.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.switch === role)));
  cards.forEach(card => {
    let current;
    card.querySelectorAll('[data-role]').forEach(section => {
      section.hidden = section.dataset.role !== role;
      if (!section.hidden) current = section;
    });
    card.hidden = !current || !card.dataset.search.includes(query);
    if (!card.hidden) {
      shown += 1;
      if (openLinkedTask && card.id === task) card.open = true;
    }
    card.querySelector('.copy-fallback').hidden = true;
    card.querySelector('.copy-status').textContent = '';
  });
  document.getElementById('empty').hidden = shown > 0;
}
switches.forEach(button => button.addEventListener('click', () => {
  const open = cards.find(card => card.open && !card.hidden);
  location.hash = button.dataset.switch + (open ? '/' + open.id : '');
}));
search.addEventListener('input', () => render());
window.addEventListener('hashchange', () => render(true));
render(true);
document.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click', async () => {
  const card = button.closest('details');
  const role = card.querySelector('[data-role]:not([hidden])');
  const expected = card.querySelector('.task-body > .field');
  const text = [card.dataset.title, expected?.innerText, role?.innerText].filter(Boolean).join('\\n\\n');
  const status = card.querySelector('.copy-status');
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = 'Скопировано для передачи';
  } catch {
    const fallback = card.querySelector('.copy-fallback');
    const field = fallback.querySelector('textarea');
    fallback.hidden = false;
    field.value = text;
    field.focus();
    field.select();
    status.textContent = 'Текст выделен для копирования';
  }
}));
</script></body></html>`;
}
