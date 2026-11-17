# Clarity Guardian

Clarity Guardian помогает PM и команде разобраться, что тормозит спринт или релиз, какие требования изменились и какие договорённости со встречи нужно перенести в бэклог. Рабочая сводка открывается в браузере по выгрузке задач. PM Agent в Codex сверяет заметки с бэклогом через MCP и сохраняет черновики и вопросы для ревью.

## Быстрый старт

```bash
npm ci
npm run demo
```

Откройте `reports/demo/index.html` в браузере. Главная кнопка ведёт к приоритетному действию по текущей выгрузке. В разделе «Итоги встречи» можно сразу скопировать команду. Диагностика, файлы для ретро и выгрузки собраны под «Подробные отчёты и выгрузки».

Встроенный пример показывает текущие задачи на первой странице. Историческая часть демо доступна в подробных отчётах для сравнения до и после.

Полная проверка проекта:

```bash
npm run verify
```

`verify` запускает TypeScript checks, сборку, smoke- и unit-тесты, генерацию демо и основных отчётов, а также `npm audit`.

## Рабочие сценарии

- **Перед спринтом.** Посмотрите вопросы к постановке и роль, которая может их решить. Отдельно проверьте, какие задачи готовы к передаче AI-агенту.
- **Перед релизом.** Разберите причины паузы и результаты, которые QA или Tech Lead должны подтвердить.
- **После согласования ТЗ.** Сравните изменения в объёме работ, сроках и критериях приёмки с согласованным снимком.
- **После встречи.** Сверьте заметки с бэклогом, сохраните черновики и поднимите открытые вопросы на следующем созвоне.

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
| Agent Handoff | Показывает, какие задачи можно передать AI-агенту, где добавить детали и где подключить человека. Для подготовленных задач формирует бриф. |
| Change Review | Сравнивает согласованный и текущий снимок. Показывает точные изменения условий, новые задачи и задачи, отсутствующие в текущей выгрузке. |
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

JSON может содержать массив задач или объект с массивом `tasks`. Для анализа достаточно заголовка, описания или отдельного поля с контекстом, ожидаемым результатом либо критериями приёмки.

### Передача AI-агенту и согласование изменений

В демо откройте Agent Handoff из Project Pulse. Задача CG-203 содержит бриф с репозиторием, объёмом работ, критериями приёмки и планом проверки. Задача CG-204 затрагивает оплату и требует проверки человеком. Для своего экспорта добавьте поля `repository`, `scope` и `verification` или секции Markdown «Репозиторий», «Объём работ» и «План проверки». Отчёт работает локально. Передачу и приёмку подтверждает команда.

В Change Review видно, что в CG-203 добавилась проверка для заблокированного аккаунта и изменился срок. Используйте в обоих снимках одинаковые фильтры и стабильные `id` или `key`. Сравнение учитывает источник и проект, отмечает изменения описания и условий, пропускает обновления статуса и останавливается на дублях. Файл согласованного снимка выбирает команда.

```bash
npm run agent:handoff -- --input data/demo-tasks.json --output reports/agent-handoff.md
npm run change:review -- --baseline data/demo-scope-baseline.json --input data/demo-tasks.json --output reports/change-review.md
npm run v2:report -- --input data/demo-tasks.json --baseline data/demo-scope-baseline.json --out-dir reports/custom
```

Оба отчёта доступны в Markdown и JSON. Без параметра `--baseline` пользовательский комплект отчётов включает Agent Handoff. Change Review появляется, когда передан согласованный снимок.

### PM Agent

Локальный пример на данных из демо:

```bash
npm run pm:agent -- --demo
```

Вопрос к модели на своём бэклоге. Укажите `OPENAI_API_KEY` в окружении. По умолчанию используется GPT-6 Luna, модель можно поменять через `OPENAI_MODEL`.

```bash
npm run pm:agent -- --online --input tasks.json --baseline approved.json \
  --ask "Сравни ТЗ. Что уточнить у разработки и QA? Напиши короткий ответ заказчику." \
  --output reports/client-brief.md
```

С `--notes meeting.txt` агент сопоставит итоги созвона с карточками. Для разбора без сравнения уберите `--baseline`. Можно начать с вопроса «Что тормозит подготовку спринта и какие задачи готовы к передаче агенту?». Для JSON укажите выходной файл с расширением `.json`.

Режим `--online` отправляет в OpenAI вопрос, переданные заметки и фрагменты карточек, выбранные инструментами. Агент читает локальные выгрузки и сохраняет результаты в отчёт. Обновление задач и отправку сообщений выполняет человек. Для каждого вывода по задаче проверяется, что ссылка относится к карточке, которую агент получил от инструментов. В JSON видны вызовы инструментов.

### Из заметок встречи в бэклог

Передайте заметки и выгрузку, чтобы получить отдельную очередь черновиков:

```bash
npm run pm:agent -- --demo --online --notes data/demo-meeting-notes.txt \
  --ask "Подготовь обновление для CG-203 и черновик новой задачи. Отдельно перечисли вопросы к QA." \
  --output reports/meeting-brief.md --drafts-out reports/backlog-drafts.json
```

Черновик содержит контекст, ожидаемый результат, критерии приёмки и цитату из заметок. Для правки агент указывает карточку, которую нашёл поиском. Программа проверяет цитату, ссылку на текущую задачу, наличие критериев приёмки и повторяющиеся названия новых задач. JSON помечается как `review_required`. PM проверяет очередь и переносит согласованные изменения в трекер.

### Заметки в Codex без отдельного API-ключа

Откройте корень Clarity Guardian как доверенный проект в Codex. Убедитесь, что `node` версии 20 или новее доступен в `PATH`, выполните `npm ci && npm run build` и откройте новый чат проекта. Конфигурация в `.codex/config.toml` подключает MCP-сервер `clarity_guardian`. Текст разбирает модель текущего чата Codex. [Настройки проектов в Codex](https://learn.chatgpt.com/docs/config-file/config-basic)

Для первого прогона отправьте в чат этот запрос.

```text
$meeting-drafts Разбери демозаметки из data/demo-meeting-notes.txt, сверь их с демобэклогом и сохрани черновики в JSON.
```

В демо получается черновик статьи справки о смене email. Мобильная проверка уже описана в CG-203, а отдельная проверка на планшете сохраняется как вопрос к QA с цитатой из заметок.

Для рабочих заметок сохраните JSON-выгрузку бэклога в `data/local/tasks.json`. Подойдёт массив задач или объект с полем `tasks`, как в `data/demo-tasks.json`. Если нужно свериться с согласованным ТЗ, положите его выгрузку в `data/local/approved.json`. Прикрепите заметки к сообщению или вставьте их текст и отправьте запрос.

```text
$meeting-drafts Сверь эти заметки с рабочим бэклогом и сохрани черновики в JSON. Открытые вопросы покажи отдельно.
```

Поиск через MCP учитывает описание, критерии приёмки и план проверки. Точный ключ задачи получает приоритет. Для каждой встречи MCP создаёт отдельную папку `reports/codex/meeting-…/`.

- `meeting-review.md` можно передать команде на ревью. Правки показывают текущий контекст, ожидаемый результат и критерии рядом с предложением из заметок.
- `backlog-drafts.json` хранит очередь со статусом `review_required`, снимок исходных требований и вопросы с цитатами, чтобы их можно было поднять к следующей встрече.

Чтобы вернуться к прошлой встрече, попросите Codex показать сохранённые вопросы или передать `meetingId` на перепроверку. Перед переносом в трекер обновите `data/local/tasks.json`. Агент покажет, изменились ли требования к целевой карточке, исчезла ли она из выгрузки или уже появилась карточка с таким же названием.

```text
$meeting-drafts Покажи открытые вопросы с последней рабочей встречи и перепроверь её черновики по актуальному бэклогу.
```

История и перепроверка доступны для разборов, сохранённых вместе с Markdown. Выгрузки и отчёты игнорируются Git. Обновление карточек в трекере остаётся за командой.

### Подключение другого MCP-клиента

Соберите проект через `npm ci && npm run build`. Любой клиент с поддержкой локальных MCP-серверов по stdio может запустить то же рабочее пространство. В настройках клиента укажите абсолютный путь к собранному серверу.

```json
{
  "command": "node",
  "args": ["/absolute/path/clarity-guardian/dist/pm-mcp.js", "--workspace"]
}
```

Приложите `data/demo-meeting-notes.txt` в чате клиента и отправьте запрос.

```text
Сверь приложенные заметки с демобэклогом Clarity Guardian через MCP. Вызови prepare_meeting с dataset=demo, ключами карточек и короткими фразами из заметок. Затем передай исходные заметки, snapshotId, черновики и открытые вопросы с цитатами в save_drafts. Покажи пути к Markdown и JSON.
```

Для своих заметок используйте `dataset=working` и положите выгрузку в `data/local/tasks.json`. MCP-сервер работает локально без API-ключа. Модель и её авторизацию определяет клиент. Режимы `--demo` и `--input /absolute/path/tasks.json [--baseline /absolute/path/approved.json]` подходят для чтения бэклога и сравнения ТЗ. [Документация MCP](https://ts.sdk.modelcontextprotocol.io/v2/serving/stdio)

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

### Linear и GitLab

Импорт подготавливает локальную выгрузку для рабочей сводки и MCP-агента. Для Linear укажите ключ или ID команды и переменную окружения `LINEAR_API_KEY`. Для GitLab укажите ID или путь проекта и `GITLAB_TOKEN` с доступом на чтение API. Для своей установки GitLab добавьте `--host https://gitlab.example.com`. [Linear API](https://linear.app/developers/graphql) · [GitLab Issues API](https://docs.gitlab.com/api/issues/#list-all-project-issues)

```bash
npm run backlog:import -- --source linear --team ENG
# Или вместо Linear используйте GitLab
npm run backlog:import -- --source gitlab --project group/project
```

Каждая успешная выгрузка заменяет `data/local/tasks.json` выбранным бэклогом. Для отдельного файла укажите `--output path/to/tasks.json`. После импорта можно приложить заметки в MCP-клиенте с `dataset=working` или открыть сводку по этой же выгрузке.

```bash
npm run report -- --input data/local/tasks.json --out-dir reports/working
```

Для одноразовой сводки `npm run report` также принимает `--source linear --team ENG` или `--source gitlab --project group/project`.

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

© 2026 Мария Журбина. Проприетарная лицензия разрешает просмотр репозитория для ревью и оценки портфолио, в том числе при найме. Для запуска, интеграции и другого использования требуется предварительное письменное разрешение автора. Код зависимостей распространяется на условиях их собственных лицензий. [Полный текст лицензии](LICENSE)
