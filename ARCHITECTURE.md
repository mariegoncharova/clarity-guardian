# Архитектура

Clarity Guardian - лёгкий инструмент PM-аналитики на TypeScript/Node.js. В проекте нет сервера, базы данных или тяжёлого frontend: данные приходят через adapters или JSON-файлы, нормализуются в единую модель задачи и проходят через модули анализа и отчётов.

## Поток данных

```text
GitHub / Jira / Yandex / JSON / demo data
  -> adapters и normalizers
  -> UnifiedTask[]
  -> анализ ясности задачи
  -> аналитика риска, готовности, жизненного цикла, решений, релизной проверки и здоровья задачи
  -> отчёты Markdown / JSON / CSV / static HTML
```

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
- `src/clarity-score.ts` рассчитывает Clarity Score и коммуникационные риски.
- `src/analyzers/toneOfVoiceAnalyzer.ts` находит слабый тон, давление, vague wording и настраиваемые плохие формулировки.
- `src/clarity-fix-suggestions.ts` превращает findings в PM-friendly вопросы и черновики исправлений.

### Аналитика

- `src/analytics.ts` собирает данные дашборда проекта, before/after comparison, history и research notes.
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
  period?: 'before' | 'after';
  metrics?: TaskMetrics;
}
```

Так source-specific parsing остаётся вне слоя аналитики.

## Добавление нового источника задач

1. Создать adapter, который реализует `TaskProvider`.
2. Преобразовать внешние записи в `UnifiedTask`.
3. Нормализовать отсутствующие optional fields в пустые массивы или `undefined`.
4. Переиспользовать `npm run v2:report -- --input tasks.json --out-dir reports/custom`.
5. Добавить smoke test на missing fields, empty descriptions и representative lifecycle data.

## Принципы проектирования

- Держать product demo локальным и детерминированным.
- Предпочитать типизированные преобразования данных вместо ad hoc string handling.
- Делать отчёты читаемыми для PM, QA и инженерных читателей.
- Рассматривать аналитику как поддержку принятия решений, а не как абсолютную истину.
- Добавлять интеграции через adapters, а не смешивать source-specific логику со scoring.
