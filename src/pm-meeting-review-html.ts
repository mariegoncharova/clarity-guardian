import { createHash } from 'node:crypto';
import { CHANGE_REVIEW_FIELD_LABELS } from './change-review';
import type { MeetingQueue, Requirements } from './pm-meeting-review';
import { escapeHtml } from './report-utils';

export const MEETING_REVIEW_HTML = 'meeting-review.html';
const fields = ['context', 'expectedResult', 'acceptanceCriteria'] as const;

function fieldValue(value: string | string[], compared?: string | string[], side?: 'added' | 'removed'): string {
  if (Array.isArray(value)) {
    const comparison = Array.isArray(compared) ? new Set(compared) : undefined;
    const items = value.map((item) => {
      const label = comparison && !comparison.has(item)
        ? `<span class="delta ${side}">${side === 'added' ? 'Добавлено' : 'Убрано'}</span> ` : '';
      return `<li>${label}${escapeHtml(item)}</li>`;
    });
    return items.length ? `<ul>${items.join('')}</ul>` : '<p>—</p>';
  }
  return `<p>${escapeHtml(value || '—')}</p>`;
}

function proposedFields(draft: Requirements): string {
  return fields.map((field) => `<div class="field">
    <h3>${CHANGE_REVIEW_FIELD_LABELS[field]}</h3>${fieldValue(draft[field])}
  </div>`).join('');
}

function compareRequirements(before: Requirements, after: Requirements): string {
  const changed = fields.filter((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]));
  const comparison = changed.map((field) => `<div class="field">
    <h3>${CHANGE_REVIEW_FIELD_LABELS[field]}</h3>
    <div class="comparison">
      <div><strong>Сейчас</strong>${fieldValue(before[field], after[field], 'removed')}</div>
      <div class="proposed"><strong>Предложение</strong>${fieldValue(after[field], before[field], 'added')}</div>
    </div>
  </div>`).join('');
  return `${comparison || '<p class="meta">Поля постановки совпадают.</p>'}
    <details><summary>Полная постановка</summary>${proposedFields(after)}</details>`;
}

export function formatMeetingReviewHtml(queue: MeetingQueue, options: { demo?: boolean; meetingId?: string } = {}): string {
  const { drafts, review } = queue;
  const payload = JSON.stringify({ ...queue, meetingId: options.meetingId });
  const storageKey = createHash('sha256').update(payload).digest('hex');
  const cards = drafts.map((draft, index) => {
    const before = draft.target && review.currentTasks[draft.target.ref];
    return `<article class="card" aria-labelledby="draft-title-${index}">
      <p class="meta">${draft.target ? `Правка · ${escapeHtml(draft.target.taskId)}` : 'Новая задача'}</p>
      <h2 id="draft-title-${index}">${escapeHtml(draft.title)}</h2>
      ${before ? compareRequirements(before, draft) : proposedFields(draft)}
      <details class="source"><summary>Цитата из заметок</summary>
        <blockquote>${escapeHtml(draft.sourceQuote)}</blockquote>
      </details>
      <div class="card-actions">
        <label><input type="checkbox" data-draft="${index}" aria-describedby="draft-title-${index}"> Одобрить к переносу</label>
        <button class="copy" type="button" data-copy="${index}" aria-describedby="draft-title-${index}">Скопировать задачу</button>
      </div>
      <div class="copy-feedback" role="status"></div>
      <label class="copy-fallback" hidden>Текст для копирования<textarea readonly rows="5"></textarea></label>
    </article>`;
  }).join('');

  return `<!doctype html>
<html lang="ru">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ревью встречи · Clarity Guardian</title>
<style>
:root{color-scheme:light;--ink:#182823;--muted:#50665e;--accent:#185949;--line:#d1ded7;--paper:#fff;--bg:#edf3ef}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 Inter,system-ui,sans-serif}
main{max-width:900px;margin:auto;padding:30px 20px 48px;overflow-wrap:anywhere}
h1,h2,h3,p{margin:0}h1{font-size:clamp(2.2rem,7vw,3.6rem);line-height:1.03;letter-spacing:-.05em;margin:8px 0 10px}h2{line-height:1.2;margin:4px 0 12px}h3{font-size:.95rem;margin-bottom:5px}
.meta,.copy-feedback{color:var(--muted);font-size:.9rem}.back{margin-bottom:12px;display:inline-block;color:var(--accent)}
.card,.bar{background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:20px;margin:14px 0}
.bar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;position:sticky;top:6px;z-index:1;box-shadow:0 5px 16px #172b2712}
.field{margin:11px 0}.comparison{display:grid;grid-template-columns:1fr 1fr;gap:10px}.comparison>div{border:1px solid var(--line);border-radius:8px;padding:9px 12px}.comparison strong{display:block;font-size:.85rem;color:var(--muted);margin-bottom:3px}.proposed{background:#eff6f1}
ul{margin:4px 0;padding-left:21px}li+li{margin-top:4px}details{margin:10px 0}summary{cursor:pointer;color:var(--accent);font-weight:650}.source{font-size:.9rem}blockquote{margin:8px 0 0;padding-left:10px;border-left:3px solid var(--line);color:var(--muted);white-space:pre-wrap}
.delta{font-size:.78rem;font-weight:700;padding:2px 5px;border-radius:4px}.delta.added{color:#174e3d;background:#d7eee0}.delta.removed{color:#7b362b;background:#f5e4de}
.card-actions{display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px;margin-top:14px;padding-top:12px;border-top:1px solid var(--line)}label{cursor:pointer}input{accent-color:var(--accent);margin:0 4px 0 0}button{font:inherit;cursor:pointer;border-radius:8px;padding:8px 12px;border:1px solid var(--accent);background:var(--accent);color:#fff}button:disabled{background:#e8efea;border-color:#e8efea;color:var(--muted);cursor:default}.copy{background:var(--paper);color:var(--accent);font-size:.9rem}
.copy-feedback:not(:empty){margin-top:8px}textarea{width:100%;font:inherit;margin-top:6px;padding:8px}
:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
@media(max-width:600px){main{padding:18px 12px 30px}.card,.bar{padding:14px}.comparison{grid-template-columns:1fr}.bar{position:static}}
</style></head>
<body><main>
<header>
  ${options.demo ? '<a class="back" href="index.html">К рабочей сводке</a>' : ''}
  <p class="meta">Clarity Guardian</p><h1>Ревью встречи</h1>
  <p class="meta">${options.demo ? 'Демонстрационный разбор' : `Снимок от ${escapeHtml(review.createdAt.slice(0, 10))}`}</p>
</header>
${drafts.length ? `<div class="bar">
  <p id="selection-summary" role="status">Одобрено 0 из ${drafts.length}</p>
  <button id="download-approved" type="button" disabled>Скачать одобренные задачи</button>
</div>` : '<p class="card">Черновиков для переноса нет.</p>'}
${cards}
${review.questions.length ? `<section class="card"><h2>Открытые вопросы</h2><ul>
  ${review.questions.map(({ question, sourceQuote }) => `<li>${escapeHtml(question)}
    <details class="source"><summary>Цитата из заметок</summary><blockquote>${escapeHtml(sourceQuote)}</blockquote></details>
  </li>`).join('')}
</ul></section>` : ''}
</main>
<script type="application/json" id="meeting-data">${payload.replace(/</g, '\\u003c')}</script>
<script>
const meeting = JSON.parse(document.getElementById('meeting-data').textContent);
const selectionKey = 'clarity-review-${storageKey}';
const inputs = Array.from(document.querySelectorAll('input[data-draft]'));
const download = document.getElementById('download-approved');
function selected() {
  return inputs.filter(input => input.checked).map(input => Number(input.dataset.draft));
}
function renderSelection() {
  const count = selected().length;
  document.getElementById('selection-summary').textContent = 'Одобрено ' + count + ' из ' + inputs.length;
  download.disabled = count === 0;
}
if (download) {
  try {
    const previous = JSON.parse(localStorage.getItem(selectionKey) || '[]');
    if (Array.isArray(previous)) inputs.forEach(input => { input.checked = previous.includes(Number(input.dataset.draft)); });
  } catch {}
  inputs.forEach(input => input.addEventListener('change', () => {
    renderSelection();
    try { localStorage.setItem(selectionKey, JSON.stringify(selected())); } catch {}
  }));
  renderSelection();
  download.addEventListener('click', () => {
    const drafts = selected().map(index => meeting.drafts[index]);
    if (drafts.length === 0) return;
    const reviewed = Object.fromEntries(drafts.filter(draft => draft.target).map(draft =>
      [draft.target.ref, meeting.review.currentTasks[draft.target.ref]]));
    const packet = {
      status: 'approved_for_transfer',
      meetingId: meeting.meetingId,
      approvedAt: new Date().toISOString(),
      drafts,
      review: { ...meeting.review, currentTasks: reviewed, questions: [] }
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(packet, null, 2) + '\\n'], {type: 'application/json'}));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'approved-drafts.json';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}
document.querySelectorAll('button[data-copy]').forEach(button => button.addEventListener('click', async () => {
  const draft = meeting.drafts[Number(button.dataset.copy)];
  const text = [
    draft.target ? draft.target.taskId + ' · ' + draft.title : draft.title,
    '', '## Контекст', draft.context, '', '## Ожидаемый результат', draft.expectedResult,
    '', '## Критерии приёмки', ...draft.acceptanceCriteria.map(criterion => '- ' + criterion)
  ].join('\\n');
  const card = button.closest('article');
  const status = card.querySelector('.copy-feedback');
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = 'Задача скопирована';
  } catch {
    const fallback = card.querySelector('.copy-fallback');
    const field = fallback.querySelector('textarea');
    fallback.hidden = false;
    field.value = text;
    field.select();
    field.focus();
    status.textContent = 'Текст выделен. Скопируйте его.';
  }
}));
</script></body></html>`;
}
