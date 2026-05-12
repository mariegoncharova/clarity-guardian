# Clarity Guardian

**Clarity Guardian** - инструмент для анализа качества постановки задач в продуктовых и инженерных командах.

Проект помогает сделать качество задач видимым, измеримым и обсуждаемым. Он анализирует описания задач из GitHub, Jira, Yandex Tracker, JSON-файлов и demo data, рассчитывает **Clarity Score**, выявляет типовые коммуникационные риски, формирует рекомендации для менеджеров и готовит отчёты для ретроспектив.

Clarity Guardian вырос из GitHub Issue/PR bot, который проверял наличие контекста, ожидаемого результата и критериев приёмки. Сейчас проект работает как лёгкий PM analytics tool: он не просто подсвечивает проблемы в отдельных задачах, а показывает качество постановки задач на уровне проекта, команды и периода.

Проект специально сделан простым и demo-friendly: без тяжёлого backend, отдельной базы данных и сложного frontend. Все ключевые сценарии можно показать локально на JSON-данных, demo dataset или через интеграции с рабочими трекерами.

---

## Зачем нужен Clarity Guardian

В продуктовой разработке задача может быть формально заведена в трекере, но при этом оставаться непонятной для команды.

Например, в задаче может быть неясно:

- зачем команда делает это изменение;
- какую пользовательскую проблему оно решает;
- какое поведение считается правильным;
- как QA должен проверять результат;
- что именно считается готовым;
- какие договорённости уже были приняты вне задачи.

Такие пробелы создают communication gap между менеджером, разработчиком и тестировщиком. В результате появляются уточняющие вопросы, возвраты с тестирования, лишние комментарии, задержки и повторная работа.

Clarity Guardian переводит качество постановки задач из субъективного ощущения в набор понятных сигналов:

- **Clarity Score** по каждой задаче;
- категории найденных проблем;
- повторяющиеся коммуникационные риски;
- рекомендации для менеджеров;
- dashboard по качеству задач;
- отчёты для ретроспектив;
- сравнение качества задач до и после внедрения инструмента.

---

## Для кого этот проект

### Project Managers

Чтобы улучшать task handoff, снижать неоднозначность требований и видеть, какие проблемы в постановке задач повторяются чаще всего.

### Product Managers

Чтобы связывать задачи с пользовательской ценностью, бизнес-контекстом и ожидаемым результатом.

### QA engineers

Чтобы быстрее понимать, что именно проверять, какие критерии приёмки есть у задачи и где описание недостаточно тестируемое.

### Engineering teams

Чтобы уменьшать количество недопониманий, уточнений, возвратов и лишней переработки.

### Portfolio reviewers

Чтобы увидеть проект, в котором соединены product thinking, PM-подход, инженерная логика, автоматизация и аккуратная аналитика.

---

## Основные возможности

### 1. Анализ качества задачи

Clarity Guardian проверяет описание задачи и определяет, достаточно ли в нём информации для передачи в разработку и тестирование.

Проверяются:

- обязательные разделы;
- пустые или слишком короткие блоки;
- vague wording;
- project-specific stop phrases;
- скрытые договорённости вроде "как обсуждали";
- наличие ожидаемого результата;
- наличие критериев приёмки;
- тестируемость требований;
- различия между bug, task и story;
- русские и английские шаблоны;
- strict и non-strict режимы.

Примеры проблемных формулировок:

- "сделать красиво";
- "как обсуждали";
- "потом уточним";
- "доработать логику" без описания ожидаемого поведения;
- "исправить баг" без шагов воспроизведения;
- "проверить оплату" без критериев успешности.

---

### 2. Unified Task Model

Проект приводит задачи из разных источников к единой модели.

Поддерживаются:

- GitHub Issues;
- GitHub Pull Requests;
- Jira;
- Yandex Tracker;
- JSON-файлы;
- demo dataset.

Это позволяет анализировать задачи одинаково независимо от того, где команда ведёт работу.

Пример unified task:

```json
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
```

---

### 3. Clarity Score

Каждая задача получает оценку от 0 до 100.

Score помогает быстро понять, насколько задача готова к передаче в разработку и тестирование.

Quality buckets:

- **80-100** - good;
- **50-79** - medium;
- **0-49** - poor.

Clarity Score учитывает:

- структурную полноту описания;
- наличие контекста;
- наличие ожидаемого результата;
- наличие критериев приёмки;
- количество найденных замечаний;
- коммуникационные риски;
- тестируемость задачи;
- потенциальную неоднозначность для команды.

---

### 4. Manager Recommendations

Clarity Guardian не выдаёт случайные советы. Рекомендации связаны с конкретными проблемами, найденными в задаче.

Примеры рекомендаций:

- добавить business context;
- уточнить expected result;
- добавить acceptance criteria в формате checklist или Given/When/Then;
- добавить reproduction steps для bug;
- заменить vague wording на конкретные требования;
- разделить задачу, если в ней смешано несколько изменений;
- явно указать, что считается done;
- добавить ограничения, зависимости или edge cases.

Такой подход помогает менеджеру не просто увидеть проблему, а сразу понять, как улучшить постановку задачи.

---

### 5. Project Quality Dashboard

Dashboard показывает качество задач на уровне проекта.

Он включает:

- общее количество проанализированных задач;
- средний Clarity Score;
- количество good, medium и poor задач;
- top problems;
- распределение по статусам;
- распределение по авторам;
- распределение по assignee;
- задачи с самым низким score;
- динамику score по дням и неделям.

Dashboard можно экспортировать в нескольких форматах:

- JSON;
- Markdown;
- CSV;
- static HTML.

Это делает проект удобным как для локальной демонстрации, так и для портфолио.

---

### 6. Retro Reports

Clarity Guardian формирует отчёт, который можно использовать на ретроспективе.

Retro report включает:

- summary за выбранный период;
- распределение задач по качеству;
- средний Clarity Score;
- top team problems;
- before/after dynamics;
- примеры задач, требующих внимания;
- рекомендации для команды;
- блок "what to improve in task writing".

Такой отчёт помогает обсуждать не только скорость разработки, но и качество коммуникации внутри команды.

---

### 7. Before/After Comparison

Проект поддерживает сравнение качества задач до и после изменения процесса.

Например, можно показать:

- как изменился средний Clarity Score;
- стало ли меньше poor tasks;
- какие проблемы начали встречаться реже;
- улучшилась ли полнота acceptance criteria;
- снизилось ли количество задач с vague wording.

Это особенно важно для portfolio storytelling: проект показывает не просто инструмент, а управленческую гипотезу, процесс улучшения и измеримый эффект.

---

### 8. Research Notes

В проекте есть осторожный analytics module для исследования гипотезы:

> Более ясные задачи могут коррелировать с более быстрой разработкой, меньшим количеством QA returns, меньшим числом clarification comments и меньшим количеством изменений в описании задачи.

Clarity Guardian не утверждает причинно-следственную связь. Формулировки в отчётах намеренно аккуратные:

- "may indicate correlation";
- "visible in this project sample";
- "requires validation on a larger dataset".

Это важно для научной коммуникации: проект не подменяет исследование громкими выводами, а показывает наблюдаемую связь и предлагает дальнейшую проверку гипотезы.

---

## Demo Mode

Проект можно запустить без доступа к GitHub, Jira или Yandex Tracker.

Demo data находится здесь:

```text
data/demo-tasks.json
```

Внутри есть:

- good, medium и poor tasks;
- before и after periods;
- задачи с QA returns и без них;
- разные development times;
- разные authors;
- разные assignees;
- разные statuses;
- priorities;
- tags;
- components.

Demo dataset позволяет показать все ключевые возможности проекта локально и без подключения к реальным рабочим данным.

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
  v2-report.ts               # report CLI
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

GitHub bot остаётся совместимым с основной логикой анализа. Reporting layer построен поверх того же анализатора и расширяет проект до уровня PM analytics.

---

## Quick Start

```bash
npm ci
npm run check
npm run build
npm run smoke
```

Запустить demo:

```bash
npm run v2:demo
```

После запуска будут сгенерированы файлы:

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

Папка `reports/` игнорируется git, потому что это generated output.

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

Workflow находится здесь:

```text
.github/workflows/clarity-guardian.yml
```

Он реагирует на:

- opened / edited / labeled issues;
- opened / edited / labeled / ready_for_review pull requests.

Required permissions:

```yaml
permissions:
  contents: read
  issues: write
  pull-requests: write
```

Bot умеет:

- анализировать задачу;
- обновлять Issue/PR description через managed Clarity Guardian block;
- редактировать предыдущий bot comment вместо создания дублей;
- генерировать tester checklist, когда задача переходит в ready for testing.

Optional secret:

```text
OPENAI_API_KEY=...
```

Без него checklist generation использует local templates.

---

## Yandex Tracker Integration

Интеграция с Yandex Tracker реализована здесь:

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
YANDEX_TRACKER_PROJECT="Checkout Project"
YANDEX_TRACKER_BASE_URL=https://api.tracker.yandex.net
```

Получить задачи из Tracker как unified JSON:

```bash
npm run build
node dist/yandex-tracker.js \
  --output yandex-tasks.json
```

Построить report напрямую из Yandex Tracker:

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

## Jira Integration

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

Поддерживает:

- language: `auto`, `ru`, `en`;
- mode: `strict`, `non-strict`;
- `updateDescription`;
- common rules;
- type-specific rules;
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

- снижать неоднозначность до начала разработки;
- делать качество задач измеримым;
- видеть повторяющиеся коммуникационные проблемы;
- готовить содержательные ретроспективы;
- связывать task writing с delivery outcomes;
- делать PM work видимой через structured improvements;
- улучшать взаимодействие между PM, разработкой и QA.

---

## PM Value

Для PM portfolio проект показывает:

- product problem framing;
- ясное понимание user value;
- lightweight analytics;
- integration thinking;
- умение приоритизировать demo-ready value вместо лишней сложности;
- коммуникацию между PM, engineering и QA;
- аккуратное исследовательское мышление без завышения выводов;
- способность превращать разрозненную боль команды в понятный инструмент.

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

Документация проекта:

- Communication Guide;
- Scientific Communication Rationale;
- Portfolio Case;
- Demo Guide.

---

## License

Проект публично доступен для portfolio review и educational demonstration.
