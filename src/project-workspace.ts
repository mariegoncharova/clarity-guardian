import { CHANGE_REVIEW_FIELD_LABELS, type buildChangeReview } from './change-review';
import type { buildAgentHandoffReport } from './agent-handoff';
import type { ProjectPulseReport } from './project-pulse';
import type { RefinementAgendaReport } from './refinement-agenda';
import type { ReleaseGuardReport } from './release-guard';

interface Workspace {
  demo: boolean;
  release: ReleaseGuardReport;
  refinement: RefinementAgendaReport;
  handoff: ReturnType<typeof buildAgentHandoffReport>;
  changes?: ReturnType<typeof buildChangeReview>;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function textList(items: string[]): string {
  return items.length ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '';
}

function extraItems(items: string[], label: string): string {
  const primary = items.slice(0, 3).join('');
  if (items.length <= 3) return primary;
  return `${primary}<details><summary>${label} · ${items.length - 3}</summary>${items.slice(3).join('')}</details>`;
}

const RELEASE_LABELS = {
  no_go: 'Выпуск на паузе',
  review_required: 'Перед выпуском нужна проверка',
  go: 'Проверки пройдены'
};
const RISK_ORDER = { high: 0, medium: 1, low: 2 };

function releaseSection(report: ReleaseGuardReport): string {
  const status = report.totalTasks ? RELEASE_LABELS[report.releaseDecision] : 'Нет задач для оценки';
  const items = report.items.filter((item) => item.decision !== 'go').map((item) => {
    const [risk, ...others] = [...item.releaseRisks].sort((a, b) => RISK_ORDER[a.severity] - RISK_ORDER[b.severity]);
    const priority = item.decision === 'no_go' ? 'Блокирует выпуск' : 'Требует проверки';
    return `<article class="item">
      <p class="meta">${escapeHtml(item.taskId)} · ${priority}${item.status ? ` · Статус задачи ${escapeHtml(item.status)}` : ''}</p>
      <h3>${escapeHtml(item.title)}</h3>
      ${risk ? `<p>${escapeHtml(risk.title)}</p><p><strong>${escapeHtml(risk.ownerRole)}</strong> · ${escapeHtml(risk.recommendation)}</p>` : ''}
      ${others.length ? `<details><summary>Остальные причины</summary>${textList(others.map(({ ownerRole, title, recommendation }) =>
        `${ownerRole} · ${title}. ${recommendation}`))}</details>` : ''}
    </article>`;
  });
  return `<section id="release" class="panel">
    <div class="section-title"><h2>Решение по релизу</h2><span class="status ${report.totalTasks ? report.releaseDecision : ''}">${status}</span></div>
    <p class="meta">${report.totalTasks} задач в снимке · блокируют выпуск: ${report.summary.blocked} · требуют проверки: ${report.summary.needsVerification}</p>
    ${extraItems(items, 'Остальные задачи по релизу')}
  </section>`;
}

const HANDOFF_LABELS = {
  human_review: 'Проверить человеком',
  needs_clarification: 'Уточнить постановку',
  ready_for_agent: 'Готово к передаче'
};

const HANDOFF_ORDER = ['human_review', 'needs_clarification', 'ready_for_agent'];

function tasksSection(refinement: RefinementAgendaReport, report: Workspace['handoff']): string {
  const agenda = refinement.items.map((item) => `<article class="item"><p class="meta">${escapeHtml(item.taskId)} · ${escapeHtml(item.ownerRole)}</p>
    <h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.expectedOutcome)}</p>
    ${item.questions.length ? `<details><summary>Вопросы к разбору</summary>${textList(item.questions)}</details>` : ''}
  </article>`);
  const items = [...report.items].sort((a, b) => HANDOFF_ORDER.indexOf(a.status) - HANDOFF_ORDER.indexOf(b.status)).map((item) => {
    const [reason, ...others] = [...item.reviewReasons, ...item.questions];
    return `<article class="item"><p class="meta">${escapeHtml(item.taskId)} · ${HANDOFF_LABELS[item.status]}</p>
      <h3>${escapeHtml(item.title)}</h3>
      ${reason ? `<p>${escapeHtml(reason)}</p>` : ''}
      ${others.length ? `<details><summary>Остальные уточнения</summary>${textList(others)}</details>` : ''}
      ${item.brief ? `<details><summary>Задание и план проверки</summary>${textList([
        `Контекст — ${item.brief.context}`, `Репозиторий — ${item.brief.repository}`,
        `Объём — ${item.brief.scope}`, `Результат — ${item.brief.expectedResult}`,
        ...item.brief.acceptanceCriteria, `Проверка — ${item.brief.verification}`
      ])}</details>` : ''}
    </article>`;
  });
  return `<section id="tasks" class="panel"><h2>Подготовка задач</h2>
    ${agenda.length ? extraItems(agenda, 'Остальные задачи к уточнению') : '<p class="meta">Повестка уточнений перед спринтом пуста.</p>'}
    <details><summary>Передача AI-агенту · ${report.summary.readyForAgent} готово · ${report.summary.humanReview} на проверку${report.summary.needsClarification ? ` · ${report.summary.needsClarification} к уточнению` : ''}</summary>
    ${items.length ? extraItems(items, 'Остальные активные задачи') : '<p class="meta">В снимке нет активных задач.</p>'}
    </details>
  </section>`;
}

function changeSection(report: NonNullable<Workspace['changes']>): string {
  const { changed, added, missing, summary } = report;
  const changedItems = changed.map((item) => `<details class="change"><summary>${escapeHtml(item.taskId)} · ${escapeHtml(item.title)}</summary>
    ${item.changes.map(({ field, before, after }) => {
      const comparison = `<div class="diff"><p><strong>Согласовано</strong>${escapeHtml(Array.isArray(before) ? before.join('\n') : before || '—')}</p>
      <p><strong>Сейчас</strong>${escapeHtml(Array.isArray(after) ? after.join('\n') : after || '—')}</p></div>`;
      return field === 'body'
        ? `<details><summary>Полный текст карточки</summary>${comparison}</details>`
        : `<div class="field"><h3>${CHANGE_REVIEW_FIELD_LABELS[field]}</h3>${comparison}</div>`;
    }).join('')}
  </details>`);
  return `<section id="scope" class="panel"><h2>Что изменилось после согласования</h2>
    <p class="meta">Изменено: ${summary.changed} · добавлено: ${summary.added} · отсутствует в текущем снимке: ${summary.missing}</p>
    ${extraItems(changedItems, 'Остальные изменения')}
    ${added.length ? `<details><summary>Новые задачи · ${added.length}</summary>${textList(added.map((item) => `${item.taskId} · ${item.title}`))}</details>` : ''}
    ${missing.length ? `<details><summary>Задачи вне текущей выгрузки · ${missing.length}</summary>${textList(missing.map((item) => `${item.taskId} · ${item.title}`))}</details>` : ''}
  </section>`;
}

function meetingSection(demo: boolean): string {
  const command = demo
    ? '$meeting-drafts Разбери демозаметки из data/demo-meeting-notes.txt, сверь их с демобэклогом и сохрани черновики и вопросы.'
    : '$meeting-drafts Сверь эти заметки с рабочим бэклогом и сохрани черновики и открытые вопросы.';
  const instructions = demo
    ? 'Откройте корень Clarity Guardian как доверенный проект в Codex и отправьте команду из поля ниже.'
    : 'Откройте корень Clarity Guardian как доверенный проект в Codex. Положите выгрузку в data/local/tasks.json, приложите заметки и отправьте команду.';
  return `<section id="meeting" class="panel"><h2>Итоги встречи</h2>
    <p>${instructions} Получите Markdown для ревью и JSON с черновиками и вопросами.</p>
    <label for="meeting-command">Команда для чата Codex</label>
    <textarea id="meeting-command" rows="3" readonly>${escapeHtml(command)}</textarea>
    <button id="copy-command" type="button">Скопировать команду</button>
    <span id="copy-status" role="status"></span>
  </section>`;
}

export function formatProjectPulseHtml(report: ProjectPulseReport, workspace?: Workspace): string {
  const links = report.reportMap.filter((link) => link.fileName !== 'index.html');
  const title = 'Clarity Guardian Project Pulse';

  return `<!doctype html>
<html lang="ru">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
:root{color-scheme:light;--ink:#172b27;--muted:#4c655e;--line:#cedbd4;--bg:#eef4ef;--paper:#fff;--accent:#125747}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 Inter,system-ui,sans-serif}
main{max-width:880px;margin:auto;padding:32px 22px 48px}header{padding:6px 0 16px}
h1,h2,h3,p{margin:0}h1{font-size:clamp(2rem,6vw,3.35rem);line-height:1.05;letter-spacing:-.045em;margin:8px 0 12px}
h2{font-size:1.3rem;line-height:1.25}h3{font-size:1rem;line-height:1.3}p+p{margin-top:5px}
a{color:var(--accent);text-underline-offset:.2em}a:hover{color:var(--ink)}
a:focus-visible,button:focus-visible,summary:focus-visible,textarea:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
.brand,.meta{font-size:.875rem;color:var(--muted)}.brand{font-weight:700}.meta{overflow-wrap:anywhere}
nav{display:flex;flex-wrap:wrap;gap:9px 18px;padding:12px 0 17px;border-top:1px solid var(--line)}
nav a{font-size:.925rem;font-weight:650}.panel,.library{background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:20px;margin-bottom:14px;overflow-wrap:anywhere}
.panel>h2,.section-title{margin-bottom:8px}.section-title{display:flex;align-items:baseline;flex-wrap:wrap;gap:6px 14px}
.status{font-weight:650;font-size:.875rem;padding:3px 9px;border-radius:6px;background:#e6f0e8}
.status.no_go{background:#f9e7e1;color:#8b2a1d}.status.review_required{background:#fbefd9;color:#744510}
.item,.change{border-top:1px solid var(--line);padding-top:12px;margin-top:12px}.item h3{margin:4px 0}
.item p:not(.meta){font-size:.95rem}.item details{margin-top:7px}
details{margin-top:12px}summary{color:var(--accent);font-weight:650;cursor:pointer}ul{margin:8px 0 4px;padding-left:22px}
.field{margin-top:11px}.diff{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:5px}
.diff p{margin:0;padding:8px 10px;border:1px solid var(--line);border-radius:7px;white-space:pre-wrap;font-size:.9rem}.diff strong{display:block;color:var(--muted)}
label{display:block;font-weight:600;margin-top:10px;font-size:.9rem}textarea{width:100%;padding:9px;margin:3px 0 7px;color:var(--ink);background:#f3f7f4;border:1px solid var(--line);border-radius:7px;font:inherit;font-size:.9rem;resize:vertical}
button{color:#fff;background:var(--accent);border:0;border-radius:7px;padding:9px 12px;font:inherit;font-size:.9rem;cursor:pointer}#copy-status{display:inline-block;margin-left:8px;font-size:.9rem;color:var(--muted)}
.library ul{columns:2}.library li{break-inside:avoid;margin-bottom:4px}
@media(max-width:540px){main{padding:20px 13px 32px}.panel,.library{padding:15px}.diff{grid-template-columns:1fr}.library ul{columns:1}}
</style></head>
<body><main>
<header><p class="brand">Clarity Guardian</p><h1>Рабочая сводка проекта</h1>
<p class="meta">${workspace?.demo ? 'Демо · текущая версия задач' : 'По загруженной выгрузке'} · Отчёт от ${escapeHtml(report.generatedAt.slice(0, 10))}</p></header>
${workspace ? `<nav aria-label="Сценарии"><a href="#release">Релиз</a><a href="#tasks">Подготовка задач</a>
${workspace.changes ? '<a href="#scope">Изменения ТЗ</a>' : ''}<a href="#meeting">Итоги встречи</a></nav>
${releaseSection(workspace.release)}${tasksSection(workspace.refinement, workspace.handoff)}
${workspace.changes ? changeSection(workspace.changes) : ''}${meetingSection(workspace.demo)}`
  : `<section class="panel"><h2>Следующие шаги</h2><p>${escapeHtml(report.executiveSummary)}</p>${textList(report.nextActions)}
  ${report.taskSpotlight.length ? `<details><summary>Задачи для разбора</summary>${textList(report.taskSpotlight.map((task) =>
    `${task.taskId} · ${task.title}. ${task.nextAction}`))}</details>` : ''}</section>`}
${links.length ? `<details class="library"><summary>Подробные отчёты и выгрузки</summary>
${workspace?.demo ? '<p class="meta">Файлы для анализа содержат весь набор демо, включая исторические задачи.</p>' : ''}
<ul>${links.map(({ fileName, title: label }) => `<li><a href="${escapeHtml(fileName)}">${escapeHtml(label)}</a></li>`).join('')}</ul></details>` : ''}
</main>
${workspace ? `<script>
document.getElementById('copy-command').addEventListener('click', async () => {
  const command = document.getElementById('meeting-command');
  const status = document.getElementById('copy-status');
  try {
    await navigator.clipboard.writeText(command.value);
    status.textContent = 'Команда скопирована';
  } catch {
    command.focus();
    command.select();
    status.textContent = 'Команда выделена. Скопируйте её.';
  }
});
</script>` : ''}
</body></html>`;
}
