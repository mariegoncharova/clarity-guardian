# Clarity Guardian

**Clarity Guardian** - инструмент для анализа качества постановки задач в продуктовых и инженерных командах.

Проект помогает сделать качество задач видимым, измеримым и обсуждаемым. Он анализирует описания задач из GitHub, Jira, Yandex Tracker, JSON-файлов и demo data, рассчитывает **Clarity Score**, выявляет типовые коммуникационные риски, формирует рекомендации для менеджеров и готовит отчёты для ретроспектив.

Clarity Guardian вырос из GitHub Issue/PR bot, который проверял наличие контекста, ожидаемого результата и критериев приёмки. Сейчас проект работает как лёгкий PM analytics tool: он не просто подсвечивает проблемы в отдельных задачах, а показывает качество постановки задач на уровне проекта, команды и периода.

Проект специально сделан простым и demo-friendly: без тяжёлого backend, отдельной базы данных и сложного frontend. Все ключевые сценарии можно показать локально на JSON-данных, demo dataset или через интеграции с рабочими трекерами.

Технически ядро проекта написано на TypeScript/Node.js. Папка `clarity_guardian/` содержит лёгкий Python-wrapper, чтобы demo-команды из product brief можно было запускать как `python -m clarity_guardian ...`.

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

### Project Managers / PM

Чтобы улучшать task handoff, снижать неоднозначность требований и видеть, какие проблемы в постановке задач повторяются чаще всего.

### Product Managers / продуктовые менеджеры

Чтобы связывать задачи с пользовательской ценностью, бизнес-контекстом и ожидаемым результатом.

### QA engineers / тестировщики

Чтобы быстрее понимать, что именно проверять, какие критерии приёмки есть у задачи и где описание недостаточно тестируемое.

### Команды разработки

Чтобы уменьшать количество недопониманий, уточнений, возвратов и лишней переработки.

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

### 2. Единая модель задачи

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

Категории качества:

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

### 4. Рекомендации для менеджера

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

### 5. Дашборд качества проекта

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

### 6. Отчёты для ретроспектив

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

### 7. Сравнение before/after

Проект поддерживает сравнение качества задач до и после изменения процесса.

Например, можно показать:

- как изменился средний Clarity Score;
- стало ли меньше poor tasks;
- какие проблемы начали встречаться реже;
- улучшилась ли полнота acceptance criteria;
- снизилось ли количество задач с vague wording.

Это особенно важно для portfolio storytelling: проект показывает не просто инструмент, а управленческую гипотезу, процесс улучшения и измеримый эффект.

---

### 8. Исследовательская гипотеза

В проекте есть осторожный analytics module для исследования гипотезы:

> Более ясные задачи могут коррелировать с более быстрой разработкой, меньшим количеством QA returns, меньшим числом clarification comments и меньшим количеством изменений в описании задачи.

Clarity Guardian не утверждает причинно-следственную связь. Формулировки в отчётах намеренно аккуратные:

- "может указывать на корреляцию";
- "по данным этого проектного сэмпла видно";
- "требует проверки на большем объёме данных".

Это важно для научной коммуникации: проект не подменяет исследование громкими выводами, а показывает наблюдаемую связь и предлагает дальнейшую проверку гипотезы.

---

## Retro Task Analytics

Clarity Guardian V2 умеет готовить отдельный retro-ready отчёт по жизненному циклу задач.

Модуль анализирует:

- сколько задачи находились в работе;
- где они зависали;
- сколько времени задача провела в каждом статусе;
- какие задачи возвращались с тестирования;
- какие причины задержек повторялись чаще всего;
- как Clarity Score связан со скоростью выполнения задач;
- какие улучшения стоит обсудить на следующем ретро.

Основные метрики:

- **Lead Time** - время от создания задачи до завершения;
- **Cycle Time** - время от входа в активную работу до завершения;
- **Time in Status** - длительность по каждому статусу;
- **Stuck Tasks** - задачи, которые слишком долго находились в одном статусе;
- **Bottlenecks** - статусы, где задачи чаще всего застревали;
- **Returned from Testing** - reopened-задачи и возвраты с тестирования;
- **Delay Reasons** - причины задержек по комментариям, статусам и Clarity Score.

Демо-данные для retro analytics находятся здесь:

```text
data/demo_tasks.json
```

Запуск через npm:

```bash
npm run retro -- --input data/demo_tasks.json --output reports/retro_report.md --format markdown
npm run retro -- --input data/demo_tasks.json --output reports/retro_report.json --format json
npm run retro -- --input data/demo_tasks.json --output reports/retro_tasks.csv --format csv
```

Совместимый запуск из product brief:

```bash
python -m clarity_guardian retro --input data/demo_tasks.json --output reports/retro_report.md --format markdown
python -m clarity_guardian retro --input data/demo_tasks.json --output reports/retro_report.json --format json
python -m clarity_guardian retro --input data/demo_tasks.json --output reports/retro_tasks.csv --format csv
```

Если в системе команда `python` не настроена, используй `python3 -m clarity_guardian ...`.

Если `--format` не указан, формат определяется по расширению файла:

- `.md` -> markdown;
- `.json` -> json;
- `.csv` -> csv.

Пример краткой сводки:

```text
Всего задач проанализировано: 10
Средний Clarity Score: 74.2
Средний Cycle Time: 5.3 дн.
Возвратов с тестирования: 3
Зависших задач: 5
Главное узкое место: In Progress
Основная причина задержек: testing_return
```

CSV-экспорт содержит аналитику уровня задач:

```text
task_id,title,source,assignee,clarity_score,lead_time_days,cycle_time_days,is_reopened,is_stuck,main_delay_reason,bottleneck_status,labels
```

Эта фича нужна для ретроспектив: PM может показать не только качество постановки задач, но и связь ясности с cycle time, возвратами с тестирования и процессными bottlenecks.

---

## Demo-режим

Проект можно запустить без доступа к GitHub, Jira или Yandex Tracker.

Демо-данные находятся здесь:

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

Демо-датасет позволяет показать все ключевые возможности проекта локально и без подключения к реальным рабочим данным.

---

## Архитектура

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
  retro-analyzer.ts          # расчёт lead time, cycle time и bottlenecks
  retro-report.ts            # CLI для Retro Task Analytics
  retro-report-*.ts          # Markdown, JSON и CSV exports для ретро
  retro-delay-reasons.ts     # причины задержек и возвратов
  sync-github.ts             # GitHub comments/body sync
  sync-jira.ts               # Jira REST sync
  generate-test-checklist.ts # QA checklist generation

data/
  demo-tasks.json            # демо-данные для portfolio demo
  demo_tasks.json            # демо-данные для Retro Task Analytics

scripts/
  smoke-test.ts              # end-to-end smoke checks

templates/
  *.md                       # manager и tester templates
```

GitHub bot остаётся совместимым с основной логикой анализа. Reporting layer построен поверх того же анализатора и расширяет проект до уровня PM analytics.

---

## Быстрый старт

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

Папка `reports/` игнорируется git, потому что это сгенерированный вывод.

---

## Генерация отчётов из файла

Подготовь JSON-массив unified tasks:

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

Для portfolio demo можно сгенерировать один отчёт через Python-wrapper:

```bash
python -m clarity_guardian analyze \
  --input data/demo_tasks.json \
  --output reports/clarity_report.md
```

Поддерживаются форматы `markdown`, `json` и `csv`; если `--format` не указан, формат определяется по расширению output-файла:

```bash
python -m clarity_guardian analyze --input data/demo_tasks.json --output reports/clarity_report.json --format json
python -m clarity_guardian analyze --input data/demo_tasks.json --output reports/clarity_tasks.csv --format csv
```

---

## Настройка GitHub

Workflow находится здесь:

```text
.github/workflows/clarity-guardian.yml
```

Он реагирует на:

- opened / edited / labeled issues;
- opened / edited / labeled / ready_for_review pull requests.

Нужные permissions:

```yaml
permissions:
  contents: read
  issues: write
  pull-requests: write
```

Бот умеет:

- анализировать задачу;
- обновлять Issue/PR description через managed Clarity Guardian block;
- редактировать предыдущий bot comment вместо создания дублей;
- генерировать tester checklist, когда задача переходит в ready for testing.

Опциональный secret:

```text
OPENAI_API_KEY=...
```

Без него checklist generation использует local templates.

---

## Интеграция с Yandex Tracker

Интеграция с Yandex Tracker реализована здесь:

```text
src/yandex-tracker.ts
```

Переменные окружения:

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

Построить отчёт напрямую из Yandex Tracker:

```bash
YANDEX_TRACKER_TOKEN=... \
YANDEX_TRACKER_ORG_ID=... \
YANDEX_TRACKER_QUEUE=CHECKOUT \
node dist/v2-report.js \
  --source yandex \
  --out-dir reports/yandex
```

CLI-параметры:

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

Отсутствующие опциональные поля обрабатываются через graceful fallback.

---

## Интеграция с Jira

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

## Локальный анализ задачи

Создай `event.json`:

```json
{
  "type": "issue",
  "title": "Проверить оплату после 3DS",
  "body": "## Контекст\nПользователь иногда не видит успешную оплату после 3DS.\n\n## Ожидаемый результат\nПосле успешного 3DS пользователь видит экран успеха.\n\n## Критерии приёмки\n- Оплата проходит успешно.\n- Ошибка банка показывает понятное сообщение.",
  "labels": ["bug"]
}
```

Запуск:

```bash
npm run build
node dist/analyze.js \
  --input event.json \
  --json-file result.json \
  --comment-file comment.md \
  --updated-body-file updated-body.md
```

Эта команда анализирует одну Issue/PR-задачу и используется GitHub/Jira bot-сценарием. Для анализа массива задач и портфолио-отчёта используй `python -m clarity_guardian analyze` или `node dist/v2-report.js`.

---

## Конфигурация

Основной config:

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

Пример:

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

## Ценность продукта

Clarity Guardian помогает команде:

- снижать неоднозначность до начала разработки;
- делать качество задач измеримым;
- видеть повторяющиеся коммуникационные проблемы;
- готовить содержательные ретроспективы;
- связывать task writing с delivery outcomes;
- делать PM work видимой через structured improvements;
- улучшать взаимодействие между PM, разработкой и QA.

---

## Ценность для PM

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

## Проверки

Проект использует TypeScript-проверки и smoke tests через npm. `pytest` здесь не нужен, потому что Python-часть является только wrapper-слоем поверх Node CLI.

Smoke tests покрывают:

- Clarity Score и task analysis;
- manager recommendations;
- demo task analysis;
- before/after comparison;
- Markdown, JSON, CSV и HTML exports;
- Python-wrapper команды `analyze` и `retro`;
- Retro Task Analytics edge cases;
- Yandex Tracker adapter и missing-field fallback;
- GitHub comment update behavior;
- Jira sync behavior;
- Docker configuration sanity check.

Запуск:

```bash
npm run smoke
```

Полная проверка:

```bash
npm ci
npm run verify
git diff --check
```

---

## Документация

Документация проекта:

- Communication Guide;
- Scientific Communication Rationale;
- Portfolio Case;
- Demo Guide.

---

## Лицензия

Проект публично доступен для portfolio review и educational demonstration.
