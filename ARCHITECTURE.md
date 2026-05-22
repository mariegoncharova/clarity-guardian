# Architecture

Clarity Guardian - лёгкий инструмент PM-аналитики на TypeScript/Node.js. В проекте нет сервера, базы данных или тяжёлого frontend: данные приходят через adapters или JSON-файлы, нормализуются в единую модель задачи и проходят через модули анализа и отчётов.

## Design Intent

Архитектура построена вокруг одной идеи: качество задачи нужно анализировать независимо от источника данных. GitHub Issue, Jira task, Yandex Tracker issue или demo JSON после нормализации должны выглядеть одинаково для аналитических модулей.

Это дает три преимущества:

- новые источники можно добавлять через adapters без переписывания scoring;
- бизнес-логика остается deterministic и тестируемой;
- отчеты можно строить на одном наборе records и экспортировать в Markdown, JSON, CSV и static HTML.

## Поток данных

```text
GitHub / Jira / Yandex / JSON / demo data
  -> adapters и normalizers
  -> UnifiedTask[]
  -> task quality signals
  -> Clarity Score + SMART Score
  -> risk, readiness, evidence, lifecycle, release and health analytics
  -> Markdown / JSON / CSV / static HTML reports
```

## Product Layers

| Layer | Responsibility |
| --- | --- |
| Source adapters | Получить задачи из внешних систем или файлов. |
| Unified model | Убрать различия источников и дать аналитике стабильный контракт. |
| Signal extraction | Найти sections, criteria, vague wording, deadlines, dependencies, lifecycle data и другие признаки. |
| Scoring | Рассчитать Clarity, SMART, risk, readiness и traceability metrics. |
| Interpretation | Превратить findings в понятные рекомендации для PM, QA, Engineering и Analytics. |
| Reporting | Собрать dashboard, task profiles, agenda, release checks, CSV/JSON exports и demo bundle. |

## Основные слои

### Адаптеры

- `src/prepare-event-payload.ts` превращает GitHub event payloads в task payloads.
- `src/sync-github.ts` обновляет комментарии GitHub и управляемые блоки описания без дублирования.
- `src/sync-jira.ts` синхронизирует комментарии анализа в Jira при наличии настроек.
- `src/yandex-tracker.ts` получает задачи из Yandex Tracker и приводит их к `UnifiedTask`.
- `src/task-model.ts` нормализует file/demo задачи и собирает task payloads для анализа.

### Базовый анализ

- `src/analyze.ts` - pipeline анализа одной задачи, который используется bot-flow.
- `src/config.ts` загружает правила проекта: язык, strict mode, обязательные секции, stop phrases, bad formulations, scoring weights, thresholds и ignored labels/statuses.
- `src/dictionaries/` содержит общие словари качества задач: stop phrases, bad formulations, tone phrases, positive SMART signals, risk keywords.
- `src/clarity-score.ts` рассчитывает Clarity Score и коммуникационные риски.
- `src/smart/` рассчитывает SMART Score по Specific, Measurable, Achievable, Relevant и Time-bound.
- `src/analyzers/toneOfVoiceAnalyzer.ts` находит слабый тон, давление, vague wording и настраиваемые плохие формулировки.
- `src/clarity-fix-suggestions.ts` превращает findings в PM-friendly вопросы и черновики исправлений.

### Аналитика

- `src/analytics.ts` собирает project-level records: dashboard, before/after comparison, history, Clarity/SMART metrics и research notes.
- `src/retro-analyzer.ts` рассчитывает lead time, cycle time, time in status, stuck tasks, reopened tasks и bottlenecks.
- `src/risk/` оценивает delivery-риск.
- `src/readiness/` проверяет Definition of Ready и Definition of Done.
- `src/sprint-health/` собирает сводку здоровья спринта.
- `src/decision-ledger.ts` проверяет traceability решения от проблемы до evidence, owner, verification и risk control.
- `src/task-health-profile.ts` создаёт профили здоровья задач и сводку качества проекта.
- `src/quick-bug-fix.ts` отделяет быстрые безопасные bug fixes от неясных или рискованных дефектов.
- `src/release-guard.ts` собирает предрелизные no-go/review/go сигналы, QA-пробелы, reopened-задачи и rollback notes.

### Отчёты

- `src/reports.ts` форматирует dashboard, retro, research и CSV exports.
- `src/report-utils.ts` содержит общие Markdown/JSON/CSV helpers.
- Отдельные report-модули отдают CLI-friendly вывод в Markdown, JSON и CSV.
- `src/v2-report.ts` генерирует полный demo/report bundle.

### Тесты и smoke-проверки

- `tests/` покрывают сфокусированную бизнес-логику.
- `scripts/smoke-test.ts` запускает end-to-end проверки CLI-скриптов, exports, integrations и сгенерированных отчётов.
- `.github/workflows/ci.yml` проверяет clean clone behavior через `npm ci`, TypeScript checks, build, tests и demo generation.

## Единая модель задачи

Все источники нормализуются в `UnifiedTask`:

```ts
interface UnifiedTask {
  id: string;
  source: 'github' | 'jira' | 'yandex-tracker' | 'demo' | 'file';
  title: string;
  body: string;
  status?: string;
  assignee?: string;
  author?: string;
  statusHistory?: StatusHistoryEntry[];
  labels?: string[];
  workItemType?: 'bug' | 'task' | 'story' | 'research' | 'tech_debt';
  context?: string;
  expectedResult?: string;
  acceptanceCriteria?: string[];
  dependencies?: string[];
  sprint?: string;
  deadline?: string;
  dueDate?: string;
  period?: 'before' | 'after';
  metrics?: TaskMetrics;
}
```

Так source-specific parsing остаётся вне слоя аналитики.

## Analysis Record

После анализа задача превращается в `TaskAnalysisRecord`. Это основной объект для reports:

```text
TaskAnalysisRecord
  task
  analyzedAt
  score / riskLevel
  smartAnalysis
  problemCodes
  recommendations
  full analysis result
```

Такой record можно сериализовать в JSON, использовать для CSV, передать в dashboard или переиспользовать отдельными workflow-модулями.

## Почему отчеты разделены по workflow

В проекте много отчетов, но они не дублируют друг друга. Каждый отвечает на отдельный управленческий вопрос:

| Report | Question |
| --- | --- |
| Dashboard | Что происходит с качеством backlog в целом? |
| Task Health Profile | Какие задачи требуют внимания и почему? |
| Refinement Agenda | Что нужно обсудить до старта работы? |
| Risk Radar | Где delivery может сорваться? |
| Evidence Brief | На чем основано решение и чего не хватает? |
| Decision Ledger | Можно ли проследить путь от проблемы до verification? |
| Release Guard | Можно ли выпускать результат? |
| Retro Report | Какие паттерны friction повторяются? |

## Добавление нового источника задач

1. Создать adapter, который реализует `TaskProvider`.
2. Преобразовать внешние записи в `UnifiedTask`.
3. Нормализовать отсутствующие optional fields в пустые массивы или `undefined`.
4. Переиспользовать `npm run v2:report -- --input tasks.json --out-dir reports/custom`.
5. Добавить smoke test на missing fields, empty descriptions и representative lifecycle data.

## Принципы проектирования

- Держать product demo локальным и детерминированным.
- Предпочитать типизированные преобразования данных вместо ad hoc string handling.
- Разделять source adapters, analysis и report formatting.
- Делать отчёты читаемыми для PM, QA и инженерных читателей.
- Рассматривать аналитику как поддержку принятия решений, а не как абсолютную истину.
- Добавлять интеграции через adapters, а не смешивать source-specific логику со scoring.
- Сохранять научную аккуратность в выводах: не выдавать correlation за causation и явно показывать evidence gaps.
