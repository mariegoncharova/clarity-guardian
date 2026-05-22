# Product Logic

## Коротко

Clarity Guardian - это независимый аналитический слой поверх задач в трекерах. Он не заменяет GitHub, Jira или Yandex Tracker, а помогает команде понять качество задач до того, как неясность превратится в переделки, QA returns, scope creep или релизный риск.

Главная идея: задача рассматривается как рабочий контракт между ролями. Хорошая задача должна быть ясной, проверяемой, управляемой, связанной с целью и пригодной для принятия решений.

## Какую проблему решает

В реальной разработке слабая задача редко выглядит катастрофой сразу. Она может казаться нормальной, пока не начинается работа:

- разработчик додумывает недостающий context;
- QA строит проверки по предположениям;
- PM принимает результат по субъективному ощущению;
- аналитика или support не получают проверяемый outcome;
- релизная команда видит risk слишком поздно.

Clarity Guardian переводит эти слабые места в явные сигналы, score, рекомендации и отчеты.

## Product Thesis

Качество delivery зависит не только от скорости разработки, но и от качества передачи смысла.

Поэтому проект анализирует задачу на нескольких уровнях:

| Уровень | Вопрос |
| --- | --- |
| Clarity | Понятно ли, что нужно сделать и какой результат ожидается? |
| SMART | Сформулирована ли задача как конкретная, измеримая и ограниченная цель? |
| Readiness | Можно ли брать задачу в работу? |
| Risk | Какие delivery, QA, scope и dependency risks уже видны? |
| Evidence | На чем основано решение и как будет проверяться результат? |
| Lifecycle | Где задачи застревают и какие паттерны повторяются? |
| Release | Можно ли выпускать результат без дополнительной проверки? |

## Почему научная коммуникация здесь уместна

Научная коммуникация в проекте не подается как отдельная академическая тема. Она встроена как дисциплина работы с информацией:

- формулировать утверждения так, чтобы их можно было проверить;
- отделять факт от предположения;
- явно фиксировать evidence;
- избегать ложной причинности в аналитических выводах;
- сохранять traceability от проблемы до решения;
- объяснять риск понятным языком для разных ролей.

Именно поэтому рядом с Clarity Score есть Evidence Brief, Decision Ledger, Research Notes и осторожные формулировки в retro analytics.

## Системная логика

```text
Input tasks
  -> normalization
  -> task quality signals
  -> scoring
  -> role-specific interpretation
  -> reports and decisions
```

### 1. Input

Проект принимает задачи из GitHub, Jira, Yandex Tracker и JSON-файлов. Demo datasets нужны для воспроизводимого portfolio/demo сценария без доступа к приватным трекерам.

### 2. Normalization

Разные источники приводятся к `UnifiedTask`. Это отделяет source-specific parsing от аналитики и позволяет добавлять новые источники без переписывания scoring logic.

### 3. Signals

Аналитика строится на локальных deterministic signals:

- секции описания;
- acceptance criteria;
- expected result;
- SMART signals;
- vague wording;
- tone of voice;
- status history;
- comments;
- labels;
- dependencies;
- deadline, sprint, due date;
- metrics and lifecycle data.

### 4. Scoring

Score в проекте не является “истиной”. Это навигационный сигнал:

- Clarity Score показывает качество описания;
- SMART Score показывает качество постановки цели;
- Risk Score показывает вероятность friction в delivery;
- Readiness scores помогают принимать go/no-go решения на уровне работы с задачей.

### 5. Interpretation

Сырые findings превращаются в решения для ролей:

- PM получает questions, next actions, refinement agenda и stakeholder update.
- QA получает gaps, DoD, release checklist и проверяемые критерии.
- Engineering Lead видит scope, blockers, risk domains и readiness.
- Analytics/Product видят evidence gaps и decision traceability.

### 6. Reports

Отчеты разделены по workflow, а не по внутренним модулям:

| Workflow | Output |
| --- | --- |
| Project overview | Dashboard |
| Task-level triage | Task Health Profile |
| Refinement | Refinement Agenda |
| Delivery risk | Risk Radar, Sprint Health |
| Release readiness | Release Guard |
| Communication | Stakeholder Update |
| Evidence and decisions | Evidence Brief, Decision Ledger |
| Fast operational work | Quick Bug Fix Queue |
| Learning loop | Retro Report, Research Notes |

## Почему это выглядит как рабочий инструмент

Проект намеренно сделан не как “магический AI checker”, а как инженерно аккуратный CLI-first tool:

- TypeScript strict mode;
- единая модель задачи;
- source adapters;
- deterministic local analysis;
- JSON/CSV/Markdown/HTML outputs;
- smoke tests для CLI и exports;
- unit tests для бизнес-логики;
- конфигурируемые thresholds и словари;
- отсутствие обязательных внешних API в ядре;
- demo data для воспроизводимого ревью.

## Как рассказывать проект на интервью или ревью

Короткая формулировка:

> Clarity Guardian анализирует качество задач как управленческий артефакт. Он показывает, где задача неясная, неизмеримая, рискованная или плохо связана с решением, и превращает это в actionable reports для planning, refinement, QA handoff, release readiness и retro.

Расширенная формулировка:

> Я хотела показать не просто GitHub bot, а маленькую PM analytics system. Поэтому в проекте есть единая модель задачи, несколько независимых аналитических слоев, детерминированные scores, exports и demo datasets. Научная коммуникация встроена через проверяемость, evidence, осторожную интерпретацию и traceability решений, но конечный продукт остается практичным инструментом для engineering teams.
