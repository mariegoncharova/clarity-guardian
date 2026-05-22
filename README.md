# Clarity Guardian

**Clarity Guardian** - лёгкий инструмент PM-аналитики для команд, которые хотят писать задачи яснее, раньше видеть delivery-риск и обсуждать качество работы на фактах, а не на ощущениях.

Он анализирует задачи из GitHub, Jira, Yandex Tracker и JSON-файлов, считает **Clarity Score** и **SMART Score**, находит слабые требования, показывает риски для разработки и тестирования, готовит отчёты для planning, refinement, ретро и предрелизной проверки.

Проект сделан как практичный portfolio/product demo: без отдельной базы данных, тяжёлого backend и сложного frontend. Все ключевые сценарии запускаются локально через TypeScript/Node.js, npm scripts и JSON-данные.

## Кому полезен

| Роль | Что даёт Clarity Guardian |
| --- | --- |
| Научные коммуникаторы | Аккуратные формулировки, evidence-based brief, проверяемые гипотезы и осторожные выводы без ложной причинности. |
| Продуктовые и проектные менеджеры | Видимость качества backlog, готовность к planning, повестка refinement, stakeholder update и action plan. |
| QA и тестировщики | Acceptance criteria, проверяемый expected result, QA gaps, Definition of Done и release checklist. |
| DevOps и platform engineers | CLI, deterministic demo, smoke-проверки, Quality Gate и отчёты, которые можно встроить в CI. |
| Аналитики | CSV/JSON exports, before/after comparison, research notes, evidence gaps и метрики качества задач. |
| Разработчики | Единая модель задачи, risk radar, ясные требования, меньше скрытых договорённостей и возвратов с тестирования. |

## Быстрый старт

```bash
npm ci
npm run build
npm test
npm run demo
```

После `npm run demo` открой:

```text
reports/demo/dashboard.html
reports/demo/task-health-profile.md
reports/demo/refinement-agenda.md
reports/demo/stakeholder-update.md
reports/demo/release-guard.md
reports/demo/retro-report.md
reports/demo/decision-ledger.md
reports/demo/quick-bug-fix.md
```

Полная проверка проекта:

```bash
npm run verify
```

`verify` запускает TypeScript checks, build, smoke tests, demo generation, основные отчёты и `npm audit`.

## Идея проекта

Проблема обычно не в том, что команда не умеет работать. Часто задача просто передана недостаточно ясно:

- не описан контекст;
- непонятно, какую проблему решаем;
- expected result звучит расплывчато;
- acceptance criteria отсутствуют или не проверяемы;
- QA не понимает, что считать готовым;
- критичная зависимость живёт в переписке, а не в задаче;
- релизный риск виден слишком поздно.

Clarity Guardian превращает такие сигналы в понятные отчёты:

- где задача уже готова к работе;
- где нужен refinement;
- где high-risk или blocker;
- где не хватает evidence;
- где есть риск регрессии перед релизом;
- какие действия нужны от PM, QA, Tech Lead, Engineering или Analytics.

## Что анализируется

Инструмент приводит разные источники к единой модели `UnifiedTask` и проверяет:

- контекст и цель задачи;
- ожидаемый результат;
- критерии приёмки;
- SMART-критерии: конкретность, измеримость, достижимость, актуальность и срок;
- тестируемость;
- тон коммуникации;
- vague wording и stop phrases;
- скрытые договорённости вроде "как обсуждали";
- delivery-риск;
- внешние зависимости;
- large scope;
- reopened/returned задачи;
- DoR/DoD готовность;
- evidence gaps и traceability решений.

Поддерживаются русские и английские задачи, но документация и основные пользовательские сценарии в проекте ведутся на русском.

## Основные отчёты

| Отчёт | Для чего нужен |
| --- | --- |
| Dashboard | Общая картина качества задач, Clarity Score, SMART Score, top problems и trend. |
| Task Health Profile | Компактный профиль каждой задачи: что не так, какой риск и какой следующий шаг. |
| Refinement Agenda | Готовая повестка refinement: что обсуждать, кто нужен и какое решение зафиксировать. |
| Stakeholder Update | Короткий статус для менеджеров и стейкхолдеров: health, risks, asks, next actions. |
| Release Guard | Предрелизная проверка `go / review_required / no_go`, QA gaps, blockers, rollback notes. |
| Evidence Brief | Проверяемая формулировка гипотезы, evidence signals и gaps для аналитики и научной коммуникации. |
| Decision Ledger | Traceability решения: проблема, evidence, owner, verification и risk control. |
| Quick Bug Fix Queue | Отделяет быстрые безопасные bug fixes от дефектов, где нужен risk review. |
| Retro Report | Lead time, cycle time, stuck tasks, reopened tasks и bottlenecks. |
| Risk / Readiness / Sprint Health | Delivery-риск, Definition of Ready, Definition of Done и здоровье спринта. |

## Примеры команд

Сгенерировать полный demo bundle:

```bash
npm run demo
```

Сгенерировать отчёты из файла:

```bash
npm run v2:report -- --input data/demo_tasks.json --out-dir reports/custom
```

Запустить отдельные отчёты:

```bash
npm run task:health -- --input data/demo_tasks.json --output reports/task_health_profile.md
npm run refinement:agenda -- --input data/demo_tasks.json --output reports/refinement_agenda.md
npm run stakeholder:update -- --input data/demo_tasks.json --output reports/stakeholder_update.md
npm run release:guard -- --input data/demo_tasks.json --output reports/release_guard.md
npm run evidence:brief -- --input data/demo_tasks.json --output reports/evidence_brief.md
npm run decision:ledger -- --input data/demo_tasks.json --output reports/decision_ledger.md
npm run bug:quick-fix -- --input data/demo_tasks.json --output reports/quick_bug_fix.md
```

Получить JSON или CSV:

```bash
npm run release:guard -- --input data/demo_tasks.json --output reports/release_guard.json --format json
npm run release:guard -- --input data/demo_tasks.json --output reports/release_guard.csv --format csv
```

## Как читать результаты

**Clarity Score** показывает, насколько задача понятна для передачи в работу. Низкий score не означает, что автор плохой. Он означает, что команде не хватает информации.

**SMART Score** показывает, насколько задача сформулирована как управляемая цель: конкретная, измеримая, достижимая, актуальная и ограниченная во времени.

Clarity Score отвечает за качество описания задачи. SMART Score отвечает за качество постановки цели.

**Risk level** показывает delivery-риск. Он растёт, если задача неясная, слишком широкая, касается критичного домена, имеет внешние зависимости или историю возвратов.

**Definition of Ready / Done** помогает разделить две вещи: можно ли брать задачу в работу и можно ли считать её завершённой.

**Release Guard** смотрит на задачу как на часть релиза. Он не заменяет релизный процесс, а подсвечивает то, что нельзя выпускать без проверки: blockers, QA gaps, reopened history, risky domains и отсутствие rollback/fallback notes.

**Evidence Brief** полезен там, где важно не только сделать изменение, но и корректно объяснить, на каких данных, наблюдениях или гипотезах оно основано.

## Демо-данные

В проекте есть два основных набора данных:

```text
data/demo-tasks.json
data/demo_tasks.json
data/smart-demo-tasks.json
```

Они нужны для локального demo, ретро-аналитики и проверки отчётов без доступа к реальным трекерам. Папка `reports/` содержит сгенерированный вывод и игнорируется git.

## Интеграции

### GitHub

Основной bot-flow анализирует Issue/PR payload, формирует markdown-комментарий и может обновлять управляемый блок описания без дублирования комментариев.

Пример локального запуска для подготовленного `task.json`:

```bash
npm run analyze -- --input task.json --json-file reports/analysis.json --comment-file reports/comment.md
npm run generate:test-checklist -- --input task.json --comment-file reports/checklist.md
npm run sync:github -- --payload task.json --analysis reports/analysis.json --analysis-comment reports/comment.md
```

### Yandex Tracker

Можно выгрузить задачи из Yandex Tracker при наличии переменных окружения:

```bash
YANDEX_TRACKER_TOKEN=...
YANDEX_TRACKER_ORG_ID=...
YANDEX_TRACKER_QUEUE=...
```

Команда:

```bash
npm run fetch:yandex -- --output reports/yandex_tasks.json
```

### Jira

Jira sync поддерживает обновление комментариев и описания задачи при настроенных переменных:

```bash
JIRA_BASE_URL=...
JIRA_EMAIL=...
JIRA_API_TOKEN=...
```

Команда:

```bash
npm run sync:jira -- --payload task.json --analysis reports/analysis.json --analysis-comment reports/comment.md
```

## Архитектура

```text
GitHub / Jira / Yandex Tracker / JSON / demo data
  -> adapters и normalizers
  -> UnifiedTask[]
  -> анализ ясности, риска, готовности и жизненного цикла
  -> Markdown / JSON / CSV / static HTML отчёты
```

Ключевые модули:

```text
src/analyze.ts             # анализ одной задачи для bot-flow
src/task-model.ts          # единая модель задачи
src/smart/                 # SMART Task Check
src/analytics.ts           # dashboard, history, before/after, research data
src/task-signals.ts        # общие сигналы задач
src/risk/                  # delivery risk
src/readiness/             # Definition of Ready / Done
src/sprint-health/         # здоровье спринта
src/v2-report.ts           # полный bundle отчётов
src/release-guard.ts       # предрелизная проверка
src/evidence-brief.ts      # evidence-based brief
src/decision-ledger.ts     # traceability решений
scripts/smoke-test.ts      # end-to-end smoke checks
```

Проект намеренно модульный: новый источник задач добавляется через adapter, а новая аналитика строится поверх `UnifiedTask`, не смешиваясь с source-specific логикой.

## Проверки

```bash
npm run check      # TypeScript без сборки
npm run build      # production build
npm run smoke      # end-to-end CLI и integration checks
npm run test:tone  # unit tests бизнес-логики
npm test           # smoke + unit tests
npm run verify     # полный контрольный прогон
```

Smoke tests проверяют:

- анализ задач и Clarity Score;
- генерацию Markdown/JSON/CSV/HTML;
- Yandex/Jira/GitHub сценарии;
- risk, readiness, sprint health;
- refinement, stakeholder update, Release Guard, Evidence Brief и Decision Ledger;
- Docker sanity checks и audit.

## Конфигурация

Проект можно настраивать через `.clarity-guardian.json`:

```json
{
  "language": "ru",
  "mode": "strict",
  "updateDescription": true,
  "scoring": {
    "thresholds": {
      "good": 80,
      "medium": 60
    }
  },
  "analytics": {
    "ignoredStatuses": ["cancelled"],
    "ignoredLabels": ["wontfix"]
  },
  "reports": {
    "defaultFormat": "markdown"
  }
}
```

Настройки позволяют менять язык, strict mode, веса scoring, thresholds, словари формулировок, ignored labels/statuses и формат отчётов.

## Документация

Дополнительные материалы:

```text
ARCHITECTURE.md
ROADMAP.md
docs/PRODUCT_AUDIT.md
docs/smart-task-check.md
docs/V2_DEMO_GUIDE.md
docs/PORTFOLIO_CASE.md
docs/COMMUNICATION_GUIDE.md
docs/SCIENTIFIC_COMMUNICATION.md
data/README.md
```

## Ограничения

- Это не hosted SaaS и не полноценная система управления задачами.
- Инструмент не делает выводы за команду, а помогает увидеть риски и задать правильные вопросы.
- Метрики показывают сигналы качества коммуникации, но не доказывают причинно-следственную связь сами по себе.
- AI-assisted сценарии возможны как направление развития, но текущий demo сохраняет deterministic fallback и локальный CLI-first подход.

## Лицензия

Проект является проприетарным и доступен только для просмотра. Это не open source.

Репозиторий можно просматривать для ревью, оценки портфолио, найма, образовательной оценки или security inspection. Нельзя использовать, копировать, модифицировать, распространять, деплоить, интегрировать, публиковать, сублицензировать, продавать или создавать производные работы на основе проекта без предварительного письменного разрешения Maria Goncharova.

Полные условия описаны в [LICENSE](LICENSE).
