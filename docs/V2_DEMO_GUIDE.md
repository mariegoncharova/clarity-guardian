# Руководство по демо Clarity Guardian V2

Короткий сценарий для показа Clarity Guardian V2 как портфолио-проекта.

## Цель демо

Показать, что Clarity Guardian - это не только checker для задач, а лёгкий инструмент PM-аналитики:

- анализирует постановку задач;
- считает Clarity Score;
- находит повторяющиеся проблемы качества;
- сравнивает периоды `before` и `after`;
- генерирует дашборд и отчёты для ретро;
- показывает прослеживаемость решений через Decision Ledger;
- собирает профиль здоровья по каждой задаче;
- выделяет мелкие баги, которые можно безопасно чинить быстро;
- собирает Project Pulse как один стартовый cockpit для демо;
- работает на демо-данных без внешних доступов;
- умеет импортировать задачи из Yandex Tracker.

## Запуск

```bash
npm ci
npm run verify
```

Демо-отчёт генерируется в:

```text
reports/demo/
```

Главные файлы для показа:

- `index.html` - стартовый Project Pulse: статус, health score, focus areas, task spotlight и карта отчётов;
- `project-pulse.md` - markdown-версия executive summary и next actions;
- `dashboard.html` - быстрый визуальный обзор;
- `action-plan.md` - приоритетный список задач, вопросов и правок описания;
- `dashboard.json` - структурированные данные дашборда;
- `retro-report.md` - сводка для ретро;
- `research-report.md` - аккуратные исследовательские заметки;
- `decision-ledger.md` - матрица прослеживаемости решений;
- `task-health-profile.md` - профиль здоровья задач и сводка качества проекта;
- `quick-bug-fix.md` - очередь быстрых bug-fix карточек;
- `tasks.csv` - экспорт для анализа в таблицах;
- `before-after.json` - сравнение before/after;
- `clarity-history.jsonl` - история Clarity Score.

## Сценарий показа

1. Начать с проблемы: неясные задачи создают повторную работу между PM, разработкой и QA.
2. Показать `data/README.md`: `data/demo-tasks.json` используется для portfolio before/after demo, а `data/demo_tasks.json` - для более насыщенной аналитики жизненного цикла.
3. Запустить `npm run v2:demo`.
4. Открыть `reports/demo/index.html`: начать с Project Pulse, показать статус, health score, next actions и ссылки на отчёты.
5. Открыть `reports/demo/dashboard.html` и показать обзор на уровне проекта.
6. Открыть `reports/demo/retro-report.md` и объяснить, как PM может использовать отчёт на ретро.
7. Открыть `reports/demo/research-report.md` и подчеркнуть осторожную формулировку: это анализ корреляций, а не ложное научное утверждение.
8. Запустить `npm run decision:ledger -- --input data/demo_tasks.json --output reports/decision_ledger.md` и показать, как задачи раскладываются на проблему, решение, evidence, проверку, владельца и контроль риска.
9. Открыть `reports/demo/task-health-profile.md` и показать, как одна карточка соединяет ясность, риск, DoR/DoD, QA-риск, delivery-риск и следующий лучший шаг.
10. Запустить `npm run bug:quick-fix -- --input data/demo_tasks.json --output reports/quick_bug_fix.md --include-needs-review` и показать, какие баги можно чинить быстро, а какие нужно сначала уточнить.
11. Отдельно отметить, что GitHub и Jira flow остались совместимыми, а Yandex Tracker добавлен отдельным adapter.

## Что подчеркнуть

- Простая архитектура вместо огромной недоделанной системы.
- Product thinking: инструмент решает реальную проблему коммуникации.
- PM value: качество постановки задач становится видимым через данные.
- Decision thinking: проект проверяет не только описание задачи, но и прослеживаемость принятого решения.
- Product analytics thinking: профиль здоровья задачи превращает разрозненные сигналы в actionable-карточку.
- Operational thinking: мелкие баги получают короткий patch plan, verification checklist и safety checks.
- Готовность к демо: отчёты генерируются локально одной командой.
- Усиленная юзабельность: Project Pulse говорит, что открыть первым и какие действия сделать дальше.
- Расширяемость: внешние трекеры подключаются через adapters, не смешиваясь с core analysis.
