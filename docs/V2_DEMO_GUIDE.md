# Clarity Guardian V2 Demo Guide

Короткий сценарий для показа Clarity Guardian V2 как portfolio-проекта.

## Цель demo

Показать, что Clarity Guardian - это не только checker для задач, а лёгкий PM analytics tool:

- анализирует постановку задач;
- считает Clarity Score;
- находит повторяющиеся проблемы качества;
- сравнивает периоды `before` и `after`;
- генерирует dashboard и retro reports;
- показывает decision traceability через Decision Ledger;
- собирает Task Health Profile по каждой задаче;
- выделяет мелкие баги, которые можно безопасно чинить быстро;
- работает на demo data без внешних доступов;
- умеет импортировать задачи из Yandex Tracker.

## Запуск

```bash
npm ci
npm run verify
```

Demo report генерируется в:

```text
reports/demo/
```

Главные файлы для показа:

- `dashboard.html` - быстрый визуальный обзор;
- `dashboard.json` - структурированные данные dashboard;
- `retro-report.md` - summary для ретро;
- `research-report.md` - аккуратные research notes;
- `decision-ledger.md` - матрица прослеживаемости решений;
- `task-health-profile.md` - профиль здоровья задач и project quality summary;
- `quick-bug-fix.md` - очередь быстрых bug-fix карточек;
- `tasks.csv` - экспорт для spreadsheet analysis;
- `before-after.json` - сравнение before/after;
- `clarity-history.jsonl` - история Clarity Score.

## Сценарий показа

1. Начать с проблемы: неясные задачи создают rework между PM, разработкой и QA.
2. Показать `data/README.md`: `data/demo-tasks.json` используется для portfolio before/after demo, а `data/demo_tasks.json` - для более насыщенной lifecycle analytics.
3. Запустить `npm run v2:demo`.
4. Открыть `reports/demo/dashboard.html` и показать project-level view.
5. Открыть `reports/demo/retro-report.md` и объяснить, как PM может использовать отчёт на ретро.
6. Открыть `reports/demo/research-report.md` и подчеркнуть осторожную формулировку: это correlation-oriented анализ, а не ложное научное утверждение.
7. Запустить `npm run decision:ledger -- --input data/demo_tasks.json --output reports/decision_ledger.md` и показать, как задачи раскладываются на problem, decision, evidence, verification, owner и risk control.
8. Открыть `reports/demo/task-health-profile.md` и показать, как одна карточка соединяет clarity, risk, DoR/DoD, QA risk, delivery risk и next best action.
9. Запустить `npm run bug:quick-fix -- --input data/demo_tasks.json --output reports/quick_bug_fix.md --include-needs-review` и показать, какие баги можно чинить быстро, а какие нужно сначала уточнить.
10. Отдельно отметить, что GitHub и Jira flow остались совместимыми, а Yandex Tracker добавлен отдельным adapter.

## Что подчеркнуть

- Простая архитектура вместо огромной недоделанной системы.
- Product thinking: инструмент решает реальную проблему коммуникации.
- PM value: качество постановки задач становится видимым через данные.
- Decision thinking: проект проверяет не только описание задачи, но и прослеживаемость принятого решения.
- Product analytics thinking: Task Health Profile превращает разрозненные сигналы в action-oriented карточку.
- Operational thinking: мелкие баги получают короткий patch plan, verification checklist и safety checks.
- Demo readiness: отчёты генерируются локально одной командой.
- Extensibility: внешние трекеры подключаются через adapters, не смешиваясь с core analysis.
