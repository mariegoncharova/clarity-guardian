# Продуктовый и инженерный аудит

Дата: 2026-05-20

## Область аудита

Проверены структура проекта, TypeScript-модули, CLI-скрипты, конфигурация, тесты, GitHub Actions, demo data, отчёты, документация и позиционирование для портфолио.

## Сильные стороны

- Ясная основная проблема: описания задач часто плохо работают как артефакты передачи между PM, разработкой и QA.
- TypeScript-кодовая база небольшая и понятная.
- Существующий bot-flow сохраняет практическую пользу: анализ GitHub Issue / PR, управляемые комментарии, Jira sync и fallback-генерация checklist.
- В проекте уже есть сильные модули PM-аналитики: dashboard, retro, risk, readiness, sprint health, evidence brief, decision ledger и quick bug queue.
- SMART Task Check усиливает продуктовую логику: проект теперь оценивает не только качество описания, но и качество постановки цели.
- Demo data покрывает разные источники, статусы, уровни риска, returned tasks, stuck tasks и before/after storytelling.
- Отчёты детерминированы и работают без backend или базы данных.

## Найденные слабые места

- Продуктовая история была размазана по README и не имела компактной архитектурной и roadmap-точки входа.
- Не было нормального CI workflow для проверки push / pull request; существующий workflow был продуктовой функциональностью, а не repository CI.
- Анализатор тона имел сильный встроенный словарь, но project-specific плохие формулировки не были настраиваемым first-class механизмом.
- Не было единого профиля здоровья задачи, который объединяет ясность, риск, готовность, жизненный цикл, QA-риск и действие менеджера.
- Сгенерированные отчёты лежали в `reports/`, но удобные для портфолио примеры не были закоммичены, потому что `reports/` игнорируется.
- В `package.json` не хватало очевидных команд для внешнего ревью: `demo`, `report`, `typecheck`, `lint`.
- Архитектурная документация в основном жила внутри README, из-за чего репозиторий было сложнее быстро просмотреть.

## Реализованные улучшения

- Добавлен настраиваемый словарь плохих формулировок с категориями `vague`, `pressure`, `unclear_reference`, `missing_context`, `weak_acceptance` и `hidden_requirement`.
- Добавлены настраиваемые веса и thresholds для Clarity Score.
- Добавлена analytics-конфигурация для ignored labels и statuses.
- Добавлен `Task Health Profile` - отчёт, который объединяет ясность, риск, DoR/DoD, жизненный цикл, слабые формулировки, delivery-риски, QA-риски и следующий лучший шаг по каждой задаче.
- Добавлен нормальный CI workflow: clean clone install, статическая TypeScript-проверка, build, tests и demo generation.
- Добавлены `ARCHITECTURE.md`, `ROADMAP.md` и примеры, удобные для портфолио.
- Добавлены package scripts, которые упрощают оценку проекта: `demo`, `report`, `typecheck`, `lint`, `task:health`.
- Добавлен `docs/PRODUCT_LOGIC.md`, который объясняет проект как цельную PM analytics system, а не как набор отдельных проверок.
- README и portfolio case перепозиционированы вокруг workflow: backlog quality, refinement, QA handoff, release readiness и retro.
- Научная коммуникация встроена в позиционирование как методологическая база: evidence, traceability, проверяемость и аккуратная интерпретация данных.

## Оставшиеся продуктовые риски

- Инструмент пока выводит многие сигналы эвристически; на больших реальных датасетах понадобится калибровка и false-positive review.
- Dashboard HTML намеренно статичный и компактный; Project Pulse закрывает стартовую навигацию, но более зрелому продукту позже понадобятся интерактивные фильтры и навигация по трендам.
- Risk thresholds вынесены в config, но более глубокий domain-specific risk scoring нужно валидировать на реальных командных данных до overfitting.
- Lifecycle analytics зависит от качества status history во внешних трекерах.
- AI-assisted rewriting намеренно не является ядром продукта, потому что проект должен работать без secrets и network calls.

## Дополнительное усиление от 2026-05-25

- Добавлен `Project Pulse` как единая стартовая страница demo bundle: health score, executive summary, focus areas, task spotlight, next actions и карта отчётов.
- `reports/demo/index.html` стал первым экраном для ревьюера или команды; dashboard остаётся аналитическим срезом, а Project Pulse объясняет, что открыть дальше.
- Добавлен отдельный CLI `npm run project:pulse`, поддерживающий markdown, json, csv и html output.
- Smoke tests теперь проверяют, что V2 bundle содержит Project Pulse JSON, markdown и HTML index с навигацией по отчётам.

## Рекомендуемый demo-сценарий

1. Начать с боли передачи задач: неясные требования создают возвраты QA и delivery drag.
2. Показать `npm run demo` и открыть `reports/demo/index.html`.
3. Через Project Pulse показать health score, focus areas, task spotlight и карту отчётов.
4. Открыть `reports/demo/dashboard.html` и показать рядом Clarity Score и SMART Score: качество описания и качество постановки цели.
5. Открыть `reports/demo/task-health-profile.md`, чтобы показать, как одна задача превращается в actionable-профиль.
6. Открыть `reports/demo/refinement-agenda.md`, чтобы показать переход от findings к рабочей встрече.
7. Открыть `reports/demo/decision-ledger.md`, чтобы показать зрелое PM-мышление: problem, evidence, decision, owner и risk control.
8. Открыть `reports/demo/release-guard.md`, чтобы показать связь качества задач с release readiness.
9. Открыть `reports/demo/retro-report.md`, чтобы связать ясность с трением в жизненном цикле задачи.

## Вывод аудита

Проект теперь выглядит не как одиночный GitHub-бот, а как компактный продукт PM-аналитики: он сохраняет исходный automation use case, но добавляет отчётность на уровне проекта, аналитику жизненного цикла, настраиваемые правила коммуникации и outputs, готовые для демо.
