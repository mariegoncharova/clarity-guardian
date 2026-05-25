# Clarity Guardian

**Clarity Guardian** - локальный инструмент PM analytics для команд, которые хотят управлять качеством задач, снижать delivery-риск и обсуждать backlog на фактах, а не на ощущениях.

Он анализирует задачи из GitHub, Jira, Yandex Tracker и JSON-файлов, приводит их к единой модели, считает **Clarity Score** и **SMART Score**, находит слабые требования, подсвечивает риски для разработки и QA, а затем собирает управленческие отчёты для planning, refinement, ретро и release readiness.

Проект сделан как профессиональный CLI-first product demo: без базы данных, тяжёлого backend и внешних AI/API-зависимостей в ядре. Вся аналитика детерминирована, типизирована и запускается локально через TypeScript/Node.js, npm scripts и JSON-данные.

## Продуктовая идея

В большинстве команд задача - это не просто текст в трекере. Это контракт между PM, разработкой, QA, аналитикой и стейкхолдерами. Если контракт написан расплывчато, команда теряет время на уточнения, возвращает задачи с тестирования, принимает решения без evidence и замечает релизные риски слишком поздно.

Clarity Guardian превращает описание задачи в набор рабочих сигналов:

- насколько задача понятна как артефакт передачи между ролями;
- насколько цель сформулирована по SMART;
- можно ли брать задачу в работу по Definition of Ready;
- можно ли считать её завершённой по Definition of Done;
- какие delivery, QA, decision и release risks уже видны;
- какое следующее действие нужно от PM, QA, Tech Lead, Engineering или Analytics.

Научная коммуникация здесь не отдельная “тема проекта”, а методологическая основа: ясность, проверяемость, осторожная интерпретация данных, traceability решений и отделение фактов от предположений. Поверх неё построен практичный PM-инструмент для engineering workflow.

## Как работает система

```text
GitHub / Jira / Yandex Tracker / JSON / demo data
  -> UnifiedTask normalization
  -> Data Doctor input validation
  -> task quality signals
  -> Clarity Score + SMART Score
  -> risk, readiness, evidence, lifecycle and release analytics
  -> Project Pulse + Markdown / JSON / CSV / static HTML reports
```

Ключевая логика проекта: не пытаться заменить Jira или GitHub, а дать команде независимый аналитический слой поверх задач. Источники данных могут быть разными, но после нормализации все задачи проходят один и тот же pipeline анализа.

## Кому полезен

| Роль | Что даёт Clarity Guardian |
| --- | --- |
| PM / Project Manager | Видимость качества backlog, SMART-постановка задач, agenda для refinement, action plan и stakeholder update. |
| Engineering Lead | Ранние delivery-риск сигналы, large scope, blockers, external dependencies и release readiness. |
| QA | Проверяемый expected result, acceptance criteria, QA gaps, DoD, regression и release checklist. |
| Product / Analytics | Evidence Brief, decision traceability, аккуратные гипотезы, CSV/JSON exports и before/after comparison. |
| Developers | Единая модель задачи, меньше скрытых договорённостей, понятный scope и меньше возвратов из-за неясных требований. |
| DevOps / Platform | CLI-first запуск, deterministic demo, smoke-проверки, Quality Gate и отчёты, которые можно встроить в CI. |

## Почему это не просто набор проверок

Clarity Guardian построен как система связанных аналитических слоёв:

| Слой | Что решает |
| --- | --- |
| Data Doctor | Проверяет качество входного JSON до аналитики: dropped rows, duplicate ids, даты, coverage и status history. |
| Task Clarity | Проверяет, достаточно ли задача понятна для передачи между ролями. |
| SMART Task Check | Проверяет, сформулирована ли задача как конкретная и управляемая цель. |
| Risk Radar | Показывает delivery-риск до того, как задача застрянет в работе. |
| Readiness | Разделяет “можно начинать” и “можно закрывать” через DoR/DoD. |
| Evidence & Decision | Связывает проблему, evidence, решение, владельца и verification plan. |
| Team Handoff | Показывает, готова ли задача к передаче между Analyst, Developer и QA. |
| Lifecycle Analytics | Смотрит на lead time, cycle time, reopened tasks, stuck statuses и QA returns. |
| Project Pulse | Собирает executive summary, next actions, task spotlight и карту отчётов в одну стартовую страницу. |
| Release Guard | Переводит качество задач в go / review_required / no_go сигналы перед релизом. |

Каждый модуль можно запускать отдельно, но вместе они дают цельную картину: от качества постановки задачи до управленческого решения.

## Быстрый старт

```bash
npm ci
npm run build
npm test
npm run demo
```

После `npm run demo` открой:

```text
reports/demo/index.html
reports/demo/dashboard.html
reports/demo/project-pulse.md
reports/demo/data-doctor.md
reports/demo/team-handoff.md
reports/demo/action-plan.md
reports/demo/task-health-profile.md
reports/demo/refinement-agenda.md
reports/demo/stakeholder-update.md
reports/demo/release-guard.md
reports/demo/retro-report.md
reports/demo/decision-ledger.md
reports/demo/quick-bug-fix.md
reports/demo/ownership-risk.md
```

Полная проверка проекта:

```bash
npm run verify
```

`verify` запускает TypeScript checks, build, smoke tests, demo generation, основные отчёты и `npm audit`.

## Рабочие сценарии

Clarity Guardian закрывает несколько реальных PM/engineering workflows:

- **Backlog grooming:** найти задачи без контекста, результата, метрик, срока или проверяемых критериев.
- **Project review:** открыть один Project Pulse и сразу увидеть статус, next actions и какие отчёты читать дальше.
- **Data onboarding:** проверить новый экспорт задач до анализа, чтобы не строить выводы на плохих данных.
- **Team handoff:** увидеть, что нужно аналитику, разработчику и QA перед передачей задачи дальше.
- **Refinement:** собрать список вопросов, решений и владельцев до старта разработки.
- **Sprint planning:** оценить готовность задач, scope и внешние зависимости.
- **Ownership review:** увидеть, у каких владельцев сконцентрированы рискованные задачи и где нет assignee.
- **QA handoff:** понять, сможет ли QA построить тест-кейсы только по описанию задачи.
- **Release readiness:** увидеть no-go/review/go сигналы до релиза.
- **Retro:** связать качество задач с возвратами, stuck statuses, cycle time и repeated gaps.
- **Stakeholder communication:** подготовить короткий статус: что здорово, где риск, какие asks и next actions.

## Что анализируется

Инструмент приводит разные источники к единой модели `UnifiedTask` и проверяет:

- контекст и цель задачи;
- качество входного dataset: dropped rows, duplicate ids, даты, coverage и status history;
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
- готовность передачи между аналитиком, разработчиком и QA;
- ownership gaps и концентрацию риска по assignee;
- evidence gaps и traceability решений.

Поддерживаются русские и английские задачи, но документация и основные пользовательские сценарии в проекте ведутся на русском.

## Основные отчёты

| Отчёт | Для чего нужен |
| --- | --- |
| Project Pulse | Первая страница demo bundle: executive summary, health score, focus areas, task spotlight и карта отчётов. |
| Data Doctor | Предпроверка входных данных: сколько задач нормализовалось, где дубли, битые даты и слабое покрытие полей. |
| Team Handoff Matrix | Матрица передачи задач между Analyst, Developer и QA: blockers, ready signals, meeting и open reports. |
| Dashboard | Общая картина качества задач, Clarity Score, SMART Score, top problems и trend. |
| Task Health Profile | Компактный профиль каждой задачи: что не так, какой риск и какой следующий шаг. |
| Refinement Agenda | Готовая повестка refinement: что обсуждать, кто нужен и какое решение зафиксировать. |
| Stakeholder Update | Короткий статус для менеджеров и стейкхолдеров: health, risks, asks, next actions. |
| Release Guard | Предрелизная проверка `go / review_required / no_go`, QA gaps, blockers, rollback notes. |
| Evidence Brief | Проверяемая формулировка гипотезы, evidence signals и gaps для аналитики и научной коммуникации. |
| Decision Ledger | Traceability решения: проблема, evidence, owner, verification и risk control. |
| Quick Bug Fix Queue | Отделяет быстрые безопасные bug fixes от дефектов, где нужен risk review. |
| Ownership Risk | Показывает концентрацию риска по assignee, overloaded owners и рискованные задачи без владельца. |
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
npm run data:doctor -- --input data/demo_tasks.json --output reports/data_doctor.md
npm run team:handoff -- --input data/demo_tasks.json --output reports/team_handoff.md
npm run task:health -- --input data/demo_tasks.json --output reports/task_health_profile.md
npm run refinement:agenda -- --input data/demo_tasks.json --output reports/refinement_agenda.md
npm run stakeholder:update -- --input data/demo_tasks.json --output reports/stakeholder_update.md
npm run release:guard -- --input data/demo_tasks.json --output reports/release_guard.md
npm run evidence:brief -- --input data/demo_tasks.json --output reports/evidence_brief.md
npm run decision:ledger -- --input data/demo_tasks.json --output reports/decision_ledger.md
npm run bug:quick-fix -- --input data/demo_tasks.json --output reports/quick_bug_fix.md
npm run ownership:risk -- --input data/demo_tasks.json --output reports/ownership_risk.md
npm run project:pulse -- --input data/demo_tasks.json --output reports/project_pulse.html
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

**Project Pulse** - первый экран для команды и ревьюера. Он собирает health score, executive summary, focus areas, next actions, task spotlight и ссылки на остальные отчёты, чтобы demo bundle не выглядел россыпью файлов.

**Data Doctor** проверяет, можно ли доверять входному JSON: обнаруживает dropped rows, нестабильные или дублирующиеся id, битые даты, проблемы status history и неполное покрытие ключевых полей.

**Team Handoff Matrix** показывает, готова ли каждая задача для аналитика, разработчика и QA отдельно. Это помогает не смешивать разные виды неготовности: слабый problem framing, delivery blockers и QA gaps требуют разных владельцев и разных встреч.

**Release Guard** смотрит на задачу как на часть релиза. Он не заменяет релизный процесс, а подсвечивает то, что нельзя выпускать без проверки: blockers, QA gaps, reopened history, risky domains и отсутствие rollback/fallback notes.

**Evidence Brief** полезен там, где важно не только сделать изменение, но и корректно объяснить, на каких данных, наблюдениях или гипотезах оно основано.

**Ownership Risk** помогает не потерять риск между ролями: он показывает critical/watch owners, overloaded assignees, QA gaps у конкретных владельцев и задачи без assignee, которые нельзя оставлять до planning.

## Демо-данные

В проекте есть несколько demo-наборов данных:

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
src/data-doctor.ts         # диагностика качества входного dataset
src/team-handoff.ts        # role-based handoff Analyst / Developer / QA
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
src/ownership-risk.ts      # концентрация риска по владельцам задач
src/project-pulse.ts       # единая стартовая страница и executive summary для bundle
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
docs/PRODUCT_LOGIC.md
docs/PRODUCT_AUDIT.md
docs/DEMO_SCRIPT.md
docs/smart-task-check.md
docs/task-quality-dictionaries.md
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
