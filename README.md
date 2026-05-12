# Clarity Guardian V2

**Clarity Guardian** - инструмент для анализа качества постановки задач в продуктовой и инженерной команде.

Проект начался как GitHub Issue/PR bot: он проверял, хватает ли в задаче контекста, ожидаемого результата и критериев приёмки. В **Version 2** Clarity Guardian становится лёгким PM analytics tool: анализирует качество задач по проекту, считает Clarity Score, показывает динамику, готовит retro reports и помогает менеджерам улучшать формулировки.

Проект специально сделан простым и demo-friendly: без тяжёлого backend, отдельной БД и сложного frontend. V2 работает с JSON-данными, demo data, GitHub payload и Yandex Tracker.

---

## Что нового в V2

- Unified task model для GitHub, Jira, Yandex Tracker, файлов и demo data.
- Yandex Tracker adapter с импортом задач по `queue`, `project`, `keys` или `query`.
- История Clarity Score в JSONL.
- Project quality dashboard в JSON, Markdown, CSV и статическом HTML.
- Генерация retro report.
- Сравнение периодов `before/after` для portfolio storytelling.
- Research notes о возможной связи ясности задач со сроками разработки, QA returns, comments и изменениями описания.
- Manager recommendations, связанные с найденными проблемами.
- Demo dataset, который работает без реального доступа к GitHub, Jira или Yandex Tracker.

---

## Product Idea

Плохо описанные задачи создают communication gap между PM, разработчиком и QA. Задача может быть заведена в трекере, но всё равно не объяснять:

- зачем команда делает эту задачу;
- какую пользовательскую проблему она решает;
- какое поведение считается правильным;
- как QA должен это проверить;
- что считается done.

Clarity Guardian превращает качество постановки задач в видимые и измеримые сигналы:

- **Clarity Score** по каждой задаче;
- recurring problem categories;
- рекомендации для менеджеров;
- project-level dashboard;
- retro-ready reports.

---

## Для кого этот инструмент

- **Project Managers** - чтобы улучшать task handoff и снижать неоднозначность.
- **Product Managers** - чтобы связывать задачи с user value.
- **QA engineers** - чтобы получать testable acceptance criteria.
- **Engineering teams** - чтобы уменьшать misunderstandings и avoidable rework.
- **Portfolio reviewers** - чтобы увидеть product thinking, automation и ясную архитектуру в одном проекте.

---

## Основные возможности

### Task Analysis

Clarity Guardian проверяет:

- обязательные разделы;
- пустые или слишком короткие разделы;
- vague wording и project-specific stop phrases;
- hidden agreements вроде “как обсуждали”;
- отдельные правила для `bug`, `task`, `story`;
- `strict` и `non-strict` режимы;
- русские и английские шаблоны.

### Clarity Score

Каждая задача получает score от `0` до `100`.

Quality buckets:

- `80-100`: good;
- `50-79`: medium;
- `0-49`: poor.

Score учитывает структурную полноту описания, найденные remarks, communication risks и testability.

### Manager Recommendations

Рекомендации не генерируются случайно. Они связаны с найденными проблемами.

Примеры:

- добавить business context;
- уточнить expected result;
- добавить acceptance criteria как checklist или Given/When/Then;
- добавить reproduction steps для bugs;
- заменить vague wording на конкретные требования;
- split task, если в задаче смешано несколько изменений.

### Project Dashboard

V2 dashboard показывает:

- total analyzed tasks;
- average Clarity Score;
- количество good, medium и poor задач;
- top problems;
- status distribution;
- author и assignee distribution;
- lowest score tasks;
- score trend по дням и неделям.

### Retro Reports

Retro report включает:

- period summary;
- score distribution;
- top team problems;
- `before/after` dynamics;
- examples of tasks requiring attention;
- team recommendations;
- блок “what to improve in task writing”.

### Research Hypothesis

Проект включает осторожный analytics module для гипотезы:

> Более ясные задачи могут коррелировать с более быстрой разработкой, меньшим количеством QA returns, clarification comments и description changes.

Report не утверждает причинно-следственную связь. Формулировки аккуратные:

- “may indicate correlation”;
- “visible in this project sample”;
- “requires validation on a larger dataset”.

---

## Architecture

```text
src/
  analyze.ts                 # task analysis и вывод для GitHub/Jira bot
  clarity-score.ts           # Clarity Score и communication risks
  recommendations.ts         # manager recommendations
  task-model.ts              # unified task model
  yandex-tracker.ts          # Yandex Tracker adapter/service
  analytics.ts               # dashboard, history, before/after, research data
  reports.ts                 # Markdown, CSV, HTML report formatting
  v2-report.ts               # V2 report CLI
  sync-github.ts             # GitHub comments/body sync
  sync-jira.ts               # Jira REST sync
  generate-test-checklist.ts # QA checklist generation
data/
  demo-tasks.json            # portfolio demo dataset
scripts/
  smoke-test.ts              # end-to-end smoke checks
templates/
  *.md                       # manager и tester templates
```

Старый GitHub bot остаётся совместимым. V2 добавлена как модульный reporting layer поверх того же анализатора.

---

## Quick Start

```bash
npm ci
npm run check
npm run build
npm run smoke
```

Запустить V2 demo:

```bash
npm run v2:demo
```

Generated files:

```text
reports/demo/dashboard.json
reports/demo/dashboard.md
reports/demo/dashboard.html
reports/demo/retro-report.md
reports/demo/research-report.md
reports/demo/tasks.csv
reports/demo/before-after.json
reports/demo/clarity-history.jsonl
reports/demo/task-history.json
reports/demo/analysis-records.json
```

`reports/` игнорируется git, потому что это generated output.

---

## Demo Mode

Demo data лежит в:

```text
data/demo-tasks.json
```

Внутри есть:

- good, medium и poor tasks;
- before и after periods;
- задачи с QA returns и без них;
- разные development times;
- разные authors, assignees, statuses, priorities, tags и components.

Это позволяет показывать проект без реального доступа к GitHub, Jira или Yandex Tracker.

---

## Generate Reports From A File

Подготовь JSON array unified tasks:

```json
[
  {
    "id": "TASK-1",
    "source": "file",
    "title": "Checkout success page",
    "body": "## Context\n...\n\n## Expected result\n...\n\n## Acceptance criteria\n- ...",
    "status": "Done",
    "author": "PM",
    "assignee": "Developer",
    "period": "after",
    "metrics": {
      "cycleTimeHours": 24,
      "qaReturns": 0,
      "commentsCount": 4,
      "descriptionChanges": 1
    }
  }
]
```

Запуск:

```bash
npm run build
node dist/v2-report.js \
  --input tasks.json \
  --out-dir reports/custom
```

---

## GitHub Setup

Workflow лежит здесь:

```text
.github/workflows/clarity-guardian.yml
```

Он реагирует на:

- opened/edited/labeled issues;
- opened/edited/labeled/ready_for_review pull requests.

Required permissions:

```yaml
permissions:
  contents: read
  issues: write
  pull-requests: write
```

Bot:

- анализирует задачу;
- обновляет Issue/PR description через managed Clarity Guardian block;
- редактирует предыдущий bot comment вместо дублей;
- генерирует tester checklist, когда задача становится ready for testing.

Optional secret:

```text
OPENAI_API_KEY=...
```

Без него checklist generation использует local templates.

---

## Yandex Tracker Setup

Yandex Tracker integration реализована здесь:

```text
src/yandex-tracker.ts
```

Environment variables:

```bash
YANDEX_TRACKER_TOKEN=...
YANDEX_TRACKER_ORG_ID=...
# or
CLOUD_ORG_ID=...

YANDEX_TRACKER_QUEUE=CHECKOUT
YANDEX_TRACKER_PROJECT=Checkout Project
YANDEX_TRACKER_BASE_URL=https://api.tracker.yandex.net
```

Получить Tracker tasks как unified JSON:

```bash
npm run build
node dist/yandex-tracker.js \
  --output yandex-tasks.json
```

Построить V2 report напрямую из Yandex Tracker:

```bash
YANDEX_TRACKER_TOKEN=... \
YANDEX_TRACKER_ORG_ID=... \
YANDEX_TRACKER_QUEUE=CHECKOUT \
node dist/v2-report.js \
  --source yandex \
  --out-dir reports/yandex
```

CLI overrides:

```bash
node dist/yandex-tracker.js --queue CHECKOUT --output tasks.json
node dist/yandex-tracker.js --project "Checkout Project" --output tasks.json
node dist/yandex-tracker.js --keys CHECKOUT-1,CHECKOUT-2 --output tasks.json
node dist/yandex-tracker.js --query 'Queue: CHECKOUT "Sort by": Updated DESC' --output tasks.json
```

Adapter читает:

- summary;
- description;
- status;
- assignee;
- author / createdBy;
- createdAt;
- updatedAt;
- type;
- priority;
- tags;
- components;
- queue / project.

Missing optional fields обрабатываются через graceful fallback.

---

## Jira Setup

Jira sync остаётся доступным:

```bash
JIRA_BASE_URL=https://your-company.atlassian.net
JIRA_EMAIL=name@example.com
JIRA_API_TOKEN=...
```

Запуск:

```bash
node dist/sync-jira.js \
  --payload event.json \
  --analysis result.json \
  --analysis-comment comment.md \
  --issue-key CG-123
```

---

## Local Task Analysis

Создай `event.json`:

```json
{
  "type": "issue",
  "title": "Проверить оплату после 3DS",
  "body": "## Контекст\nПользователь иногда не видит успешную оплату после 3DS.\n\n## Ожидаемый результат\nПосле успешного 3DS пользователь видит экран успеха.\n\n## Критерии приёмки\n- Оплата проходит успешно.\n- Ошибка банка показывает понятное сообщение.",
  "labels": ["bug"]
}
```

Run:

```bash
npm run build
node dist/analyze.js \
  --input event.json \
  --json-file result.json \
  --comment-file comment.md \
  --updated-body-file updated-body.md
```

---

## Configuration

Main config:

```text
clarity-guardian.config.json
```

Supports:

- `language`: `auto`, `ru`, `en`;
- `mode`: `strict`, `non-strict`;
- `updateDescription`;
- common and type-specific rules;
- project-specific stop phrases.

Example:

```json
{
  "language": "auto",
  "mode": "strict",
  "updateDescription": true,
  "stopPhrases": [
    {
      "phrase": "потом уточним",
      "level": "warning",
      "code": "deferred_context",
      "message": "Фраза оставляет незакрытый вопрос. Укажи, что именно нужно уточнить и у кого.",
      "languages": ["ru"]
    }
  ]
}
```

---

## Product Value

Clarity Guardian помогает команде:

- reduce ambiguity до начала разработки;
- сделать task quality measurable;
- видеть recurring communication problems;
- готовить более содержательные retrospectives;
- связать task writing с delivery outcomes;
- сделать PM work видимой через structured improvements.

---

## PM Value

Для PM portfolio проект показывает:

- product problem framing;
- clear user value;
- lightweight analytics;
- integration thinking;
- приоритизацию demo-ready value вместо лишней сложности;
- коммуникацию между PM, engineering и QA;
- careful research framing без overstating causality.

---

## Testing

Smoke tests покрывают:

- Clarity Score и task analysis;
- manager recommendations;
- demo task analysis;
- before/after comparison;
- Markdown, JSON, CSV и HTML exports;
- Yandex Tracker adapter и missing-field fallback;
- GitHub comment update behavior;
- Jira sync behavior;
- Docker configuration sanity check.

Запуск:

```bash
npm run smoke
```

Full check:

```bash
npm ci
npm run check
npm run build
npm run smoke
npm audit --audit-level=moderate
git diff --check
```

---

## Documentation

- [Communication Guide](docs/COMMUNICATION_GUIDE.md)
- [Scientific Communication Rationale](docs/SCIENTIFIC_COMMUNICATION.md)
- [Portfolio Case](docs/PORTFOLIO_CASE.md)
- [V2 Demo Guide](docs/V2_DEMO_GUIDE.md)

---

## License

Проект публично доступен для просмотра в portfolio review и educational demonstration.
