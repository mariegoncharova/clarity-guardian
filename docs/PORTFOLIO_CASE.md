# Portfolio Case: Clarity Guardian

## One-liner

Clarity Guardian - это CLI-first PM analytics tool, который анализирует качество задач, находит неясность, SMART-пробелы, delivery-риск и evidence gaps, а затем собирает отчеты для planning, refinement, QA handoff, release readiness и retro.

## Почему проект выглядит продуктово

Это не набор разрозненных проверок и не “бот, который ругает задачи”. Проект построен вокруг реального workflow:

```text
задача появляется в трекере
  -> команда должна понять, можно ли брать ее в работу
  -> нужно увидеть риски, пробелы и вопросы
  -> нужно принять решение
  -> нужно проверить результат
  -> нужно вынести уроки на retro
```

Clarity Guardian закрывает этот workflow как аналитический слой поверх GitHub, Jira, Yandex Tracker и JSON datasets.

## Проблема

В разработке задача часто становится главным способом передачи знания между ролями. Если задача написана расплывчато, проблема редко проявляется сразу. Она проявляется позже:

- разработчик реализует свое понимание;
- QA проверяет неявные ожидания;
- PM принимает результат без четких критериев;
- аналитик не видит evidence или success metric;
- релизная команда ловит риск слишком поздно;
- команда обсуждает качество работы на ощущениях, а не на данных.

Это приводит к переделкам, возвратам с тестирования, scope creep, конфликтам ожиданий и слабой traceability решений.

## Решение

Clarity Guardian превращает задачу в структурированный аналитический объект.

Система:

- приводит разные источники к `UnifiedTask`;
- анализирует описание, criteria, comments, labels, dependencies, sprint, due date и lifecycle data;
- считает Clarity Score и SMART Score;
- выявляет delivery, QA, decision и release risks;
- формирует role-specific рекомендации;
- экспортирует результаты в Markdown, JSON, CSV и static HTML.

## Ключевые метрики

| Метрика | Что показывает |
| --- | --- |
| Clarity Score | Насколько задача понятна для передачи между PM, разработкой и QA. |
| SMART Score | Насколько задача сформулирована как конкретная, измеримая и ограниченная цель. |
| Risk Score | Насколько вероятны delivery friction, blockers, QA returns или scope issues. |
| DoR / DoD | Можно ли начинать работу и можно ли считать результат завершенным. |
| Traceability Score | Насколько решение связано с problem, evidence, owner и verification. |

Эти метрики не заменяют управленческое решение. Они помогают быстрее увидеть, где нужен refinement или risk review.

## Продуктовые модули

| Модуль | Роль в продукте |
| --- | --- |
| Dashboard | Общая картина качества backlog и trends. |
| Task Health Profile | Task-level triage: что не так, какой риск, какой следующий шаг. |
| SMART Task Check | Проверка постановки цели по Specific, Measurable, Achievable, Relevant, Time-bound. |
| Refinement Agenda | Готовая повестка обсуждения для задач, которые нельзя брать в работу без уточнений. |
| Risk Radar | Delivery risk signals по scope, dependencies, uncertainty и history. |
| Readiness | Definition of Ready и Definition of Done. |
| Evidence Brief | Проверяемая формулировка гипотезы, evidence signals и gaps. |
| Decision Ledger | Traceability решения от проблемы до verification plan. |
| Release Guard | Go / review_required / no_go сигналы перед релизом. |
| Stakeholder Update | Короткая управленческая сводка: health, risks, asks, next actions. |
| Quick Bug Fix Queue | Отделяет быстрые безопасные fixes от дефектов, где нужен risk review. |
| Retro Report | Lead time, cycle time, stuck tasks, reopened tasks и bottlenecks. |

## Как встроена научная коммуникация

Проект опирается на принципы научной коммуникации, но не ограничивается ими.

Научная коммуникация проявляется в том, что система:

- требует проверяемых формулировок;
- отделяет evidence от предположений;
- аккуратно формулирует research notes без ложной причинности;
- связывает решения с источниками данных;
- помогает объяснять риск разным ролям понятным языком;
- делает выводы воспроизводимыми через deterministic reports.

Так методология становится частью профессионального engineering process, а не декоративной темой.

## Инженерная реализация

Проект специально сделан локальным и воспроизводимым:

- TypeScript strict mode;
- единая модель `UnifiedTask`;
- source adapters для GitHub, Jira и Yandex Tracker;
- deterministic local analyzers без обязательных внешних API;
- Markdown / JSON / CSV / static HTML exports;
- конфигурируемые thresholds, scoring weights и словари формулировок;
- unit tests для бизнес-логики;
- smoke tests для CLI, integrations и generated reports;
- demo datasets для быстрого review.

Такой подход показывает инженерную дисциплину: система расширяемая, проверяемая и не завязана на один источник данных.

## Demo Story

Хорошая демонстрация занимает 5-7 минут:

1. Запустить `npm run demo`.
2. Открыть `reports/demo/dashboard.html` и показать overview: Clarity Score, SMART Score, top problems.
3. Открыть `reports/demo/task-health-profile.md` и показать task-level diagnosis.
4. Открыть `reports/demo/refinement-agenda.md` и показать, как findings превращаются в meeting agenda.
5. Открыть `reports/demo/decision-ledger.md` и показать problem/evidence/decision traceability.
6. Открыть `reports/demo/release-guard.md` и показать go / review_required / no_go логику.
7. Открыть `reports/demo/retro-report.md` и связать качество задач с lifecycle friction.

Для отдельной демонстрации SMART Task Check:

```bash
npm run v2:report -- --input data/smart-demo-tasks.json --out-dir reports/smart-demo
```

В `reports/smart-demo` видно три уровня постановки задачи: weak, needs_improvement и strong.

## Почему это сильный portfolio case

Clarity Guardian показывает сразу несколько компетенций:

- продуктово мыслить о workflow, ролях и decision points;
- проектировать source-agnostic data model;
- писать типизированную TypeScript business logic;
- строить deterministic analytics без внешних API;
- оформлять вывод в понятные PM/QA/Engineering reports;
- держать тесты и smoke-проверки;
- связывать коммуникацию, evidence и delivery management в один инструмент.

## Короткий pitch

> Clarity Guardian помогает команде увидеть качество задач до того, как неясность станет delivery-проблемой. Он анализирует backlog как управленческий артефакт: считает Clarity и SMART scores, подсвечивает риски, gaps и decision traceability, а затем собирает практичные отчеты для planning, refinement, release readiness и retro.
