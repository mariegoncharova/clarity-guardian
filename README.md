# Clarity Guardian

**Clarity Guardian** - инструмент для анализа качества постановки задач в продуктовых и инженерных командах.

Проект помогает сделать качество задач видимым, измеримым и обсуждаемым. Он анализирует описания задач из GitHub, Jira, Yandex Tracker, JSON-файлов и демо-данных, рассчитывает **Clarity Score**, выявляет типовые коммуникационные риски, формирует рекомендации для менеджеров и готовит отчёты для ретроспектив.

Clarity Guardian вырос из бота для GitHub Issue/PR, который проверял наличие контекста, ожидаемого результата и критериев приёмки. Сейчас проект работает как лёгкий инструмент PM-аналитики: он не просто подсвечивает проблемы в отдельных задачах, а показывает качество постановки задач на уровне проекта, команды и периода.

Проект специально сделан простым и удобным для демо: без тяжёлого backend, отдельной базы данных и сложного frontend. Все ключевые сценарии можно показать локально на JSON-данных, демо-датасете или через интеграции с рабочими трекерами.

Технически проект полностью написан на TypeScript/Node.js. В проекте нет Python-wrapper, отдельной БД или backend-сервера: демо-сценарии запускаются через npm scripts и JSON-файлы.

---

## Позиционирование продукта

**Clarity Guardian - лёгкий инструмент PM-аналитики, который помогает командам улучшать ясность задач, находить слабые требования, анализировать delivery-риск и готовить отчёты для ретро на основе качества задач и данных жизненного цикла.**

Проект полезен для:

- PM, которые хотят улучшать передачу задач между ролями и готовность спринта;
- QA-инженеров, которым нужны проверяемые требования и меньше неясных тикетов;
- engineering leads, которым важно раньше видеть delivery-риск, bottlenecks и reopened-задачи;
- ревьюеров портфолио, которым нужно быстро понять продуктовое мышление, архитектуру и измеримую ценность проекта.

Проект намеренно компактный: без тяжёлого backend, базы данных и сложного frontend. Он показывает, как реальный продукт может начаться с бота и вырасти в workflow PM / Engineering analytics.

---

## Быстрый старт для ревьюера

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

Для полной проверки проекта:

```bash
npm run verify
```

---

## Лицензия

Проект является проприетарным и доступен только для просмотра. Это не open source.

Репозиторий можно просматривать только для ревью, оценки портфолио, найма, образовательной оценки или security inspection. Нельзя использовать, копировать, модифицировать, распространять, деплоить, интегрировать, публиковать, сублицензировать, продавать или создавать производные работы на основе проекта без предварительного письменного разрешения Maria Goncharova.

Полные условия описаны в [LICENSE](LICENSE).

---

## Зачем нужен Clarity Guardian

В продуктовой разработке задача может быть формально заведена в трекере, но при этом оставаться непонятной для команды.

Например, в задаче может быть неясно:

- зачем команда делает это изменение;
- какую пользовательскую проблему оно решает;
- какое поведение считается правильным;
- как QA должен проверять результат;
- что именно считается готовым;
- какие договорённости уже были приняты вне задачи.

Такие пробелы создают communication gap между менеджером, разработчиком и тестировщиком. В результате появляются уточняющие вопросы, возвраты с тестирования, лишние комментарии, задержки и повторная работа.

Clarity Guardian переводит качество постановки задач из субъективного ощущения в набор понятных сигналов:

- **Clarity Score** по каждой задаче;
- категории найденных проблем;
- повторяющиеся коммуникационные риски;
- рекомендации для менеджеров;
- дашборд по качеству задач;
- отчёты для ретроспектив;
- сравнение качества задач до и после внедрения инструмента.

---

## Для кого этот проект

### Менеджеры проектов / PM

Чтобы улучшать передачу задач между ролями, снижать неоднозначность требований и видеть, какие проблемы в постановке задач повторяются чаще всего.

### Продуктовые менеджеры

Чтобы связывать задачи с пользовательской ценностью, бизнес-контекстом и ожидаемым результатом.

### QA-инженеры / тестировщики

Чтобы быстрее понимать, что именно проверять, какие критерии приёмки есть у задачи и где описание недостаточно тестируемое.

### Команды разработки

Чтобы уменьшать количество недопониманий, уточнений, возвратов и лишней переработки.

---

## Основные возможности

### 1. Анализ качества задачи

Clarity Guardian проверяет описание задачи и определяет, достаточно ли в нём информации для передачи в разработку и тестирование.

Проверяются:

- обязательные разделы;
- пустые или слишком короткие блоки;
- vague wording;
- project-specific stop phrases;
- скрытые договорённости вроде "как обсуждали";
- коммуникационный тон задачи;
- проблемные формулировки;
- наличие ожидаемого результата;
- наличие критериев приёмки;
- тестируемость требований;
- различия между bug, task и story;
- русские и английские шаблоны;
- strict и non-strict режимы.

Примеры проблемных формулировок:

- "сделать красиво";
- "как обсуждали";
- "потом уточним";
- "доработать логику" без описания ожидаемого поведения;
- "исправить баг" без шагов воспроизведения;
- "проверить оплату" без критериев успешности.

---

### 2. Tone of Voice Analyzer

Clarity Guardian анализирует не только структуру задачи, но и качество коммуникации в описании. Tone of Voice Analyzer помогает увидеть формулировки, которые могут создать напряжение, недопонимание или лишние уточнения между менеджерами, разработчиками и QA.

Анализатор проверяет:

- структуру задачи;
- ясность;
- коммуникационный тон;
- проблемные формулировки;
- размытые требования;
- обвинительный или пассивно-агрессивный тон;
- срочность без объяснения причины;
- слишком неформальный стиль;
- PM-friendly предложения по переписыванию.

Фича не стыдит автора задачи. Она спокойно объясняет риск и предлагает более ясную формулировку через проблему, влияние, ожидаемый результат и критерии приёмки. Это помогает снижать недопонимание между PM, разработчиками и QA ещё до передачи задачи в работу.

Пример результата:

```json
{
  "toneOfVoice": {
    "tone": "tense",
    "riskLevel": "high",
    "categories": ["blaming_tone", "vague_wording", "unclear_urgency"],
    "problematicPhrases": [
      {
        "phrase": "опять всё сломалось",
        "category": "blaming_tone",
        "explanation": "Фраза звучит обвинительно и не описывает техническую проблему спокойно."
      }
    ],
    "recommendation": "Переписать задачу через проблему, влияние, ожидаемый результат и критерии приёмки, без оценки действий участников.",
    "rewrittenText": "Пользователи сообщают о проблеме в сценарии. Нужно проверить причину сбоя, описать влияние и восстановить ожидаемое поведение."
  }
}
```

---

### 3. Clarity Fix Suggestions

Clarity Guardian теперь не только показывает, что в задаче не так, но и предлагает конкретный первый шаг к исправлению.

Clarity Fix Suggestions добавляет в `analyze`-результат и markdown-комментарий:

- вопросы, которые нужно уточнить у автора задачи;
- черновик markdown-блоков `Контекст / Ожидаемый результат / Критерии приёмки`;
- PM-friendly rewrite, привязанный к конкретной задаче;
- следующие действия для менеджера или команды.

Пример результата:

```json
{
  "clarityFixSuggestions": {
    "questions": [
      "Какую пользовательскую или бизнес-проблему решает задача?",
      "По каким критериям QA и PM поймут, что задача готова?"
    ],
    "draftMarkdown": "## Контекст\n[Уточнить: какую пользовательскую или бизнес-проблему решаем...]\n\n## Ожидаемый результат\n[Уточнить: какое поведение продукта считается успешным...]\n\n## Критерии приёмки\n- [ ] Основной успешный сценарий описан и проверяем.",
    "pmFriendlyRewrite": "Задачу «Пофиксить оплату как обсуждали» стоит уточнить перед разработкой...",
    "nextActions": [
      "Ответить на вопросы выше до передачи задачи в разработку.",
      "Вставить черновик секций в описание и заменить плейсхолдеры конкретикой."
    ]
  }
}
```

---

### 4. Единая модель задачи

Проект приводит задачи из разных источников к единой модели.

Поддерживаются:

- GitHub Issues;
- GitHub Pull Requests;
- Jira;
- Yandex Tracker;
- JSON-файлы;
- демо-датасет.

Это позволяет анализировать задачи одинаково независимо от того, где команда ведёт работу.

Пример unified task:

```json
{
  "id": "TASK-1",
  "source": "file",
  "title": "Checkout success page",
  "body": "## Context\n...\n\n## Expected result\n...\n\n## Acceptance criteria\n- ...",
  "status": "Done",
  "author": "PM",
  "assignee": "Developer",
  "period": "after",
  "metrics": {
    "cycleTimeHours": 24,
    "qaReturns": 0,
    "commentsCount": 4,
    "descriptionChanges": 1
  }
}
```

---

### 5. Clarity Score

Каждая задача получает оценку от 0 до 100.

Score помогает быстро понять, насколько задача готова к передаче в разработку и тестирование.

Категории качества:

- **80-100** - good;
- **50-79** - medium;
- **0-49** - poor.

Clarity Score учитывает:

- структурную полноту описания;
- наличие контекста;
- наличие ожидаемого результата;
- наличие критериев приёмки;
- количество найденных замечаний;
- коммуникационные риски;
- тестируемость задачи;
- потенциальную неоднозначность для команды.

---

### 6. Рекомендации для менеджера

Clarity Guardian не выдаёт случайные советы. Рекомендации связаны с конкретными проблемами, найденными в задаче.

Примеры рекомендаций:

- добавить business context;
- уточнить expected result;
- добавить acceptance criteria в формате checklist или Given/When/Then;
- добавить reproduction steps для bug;
- заменить vague wording на конкретные требования;
- разделить задачу, если в ней смешано несколько изменений;
- явно указать, что считается done;
- добавить ограничения, зависимости или edge cases.

Такой подход помогает менеджеру не просто увидеть проблему, а сразу понять, как улучшить постановку задачи.

---

### 7. Дашборд качества проекта

Dashboard показывает качество задач на уровне проекта.

Он включает:

- общее количество проанализированных задач;
- средний Clarity Score;
- количество good, medium и poor задач;
- top problems;
- распределение по статусам;
- распределение по авторам;
- распределение по assignee;
- задачи с самым низким score;
- динамику score по дням и неделям.

Дашборд можно экспортировать в нескольких форматах:

- JSON;
- Markdown;
- CSV;
- статический HTML.

Это делает проект удобным как для локальной демонстрации, так и для портфолио.

---

### 8. Отчёты для ретроспектив

Clarity Guardian формирует отчёт, который можно использовать на ретроспективе.

Отчёт для ретро включает:

- сводку за выбранный период;
- распределение задач по качеству;
- средний Clarity Score;
- основные проблемы команды;
- динамику before/after;
- примеры задач, требующих внимания;
- рекомендации для команды;
- блок "что улучшить в постановке задач".

Такой отчёт помогает обсуждать не только скорость разработки, но и качество коммуникации внутри команды.

---

### 9. Сравнение before/after

Проект поддерживает сравнение качества задач до и после изменения процесса.

Например, можно показать:

- как изменился средний Clarity Score;
- стало ли меньше poor tasks;
- какие проблемы начали встречаться реже;
- улучшилась ли полнота acceptance criteria;
- снизилось ли количество задач с vague wording.

Это особенно важно для portfolio storytelling: проект показывает не просто инструмент, а управленческую гипотезу, процесс улучшения и измеримый эффект.

---

### 10. Исследовательская гипотеза

В проекте есть осторожный analytics module для исследования гипотезы:

> Более ясные задачи могут коррелировать с более быстрой разработкой, меньшим количеством QA returns, меньшим числом clarification comments и меньшим количеством изменений в описании задачи.

Clarity Guardian не утверждает причинно-следственную связь. Формулировки в отчётах намеренно аккуратные:

- "может указывать на корреляцию";
- "по данным этого проектного сэмпла видно";
- "требует проверки на большем объёме данных".

Это важно для научной коммуникации: проект не подменяет исследование громкими выводами, а показывает наблюдаемую связь и предлагает дальнейшую проверку гипотезы.

---

## Ретро-аналитика задач

Clarity Guardian V2 умеет готовить отдельный отчёт для ретро по жизненному циклу задач.

Модуль анализирует:

- сколько задачи находились в работе;
- где они зависали;
- сколько времени задача провела в каждом статусе;
- какие задачи возвращались с тестирования;
- какие причины задержек повторялись чаще всего;
- как Clarity Score связан со скоростью выполнения задач;
- какие улучшения стоит обсудить на следующем ретро.

Основные метрики:

- **Lead Time** - время от создания задачи до завершения;
- **Cycle Time** - время от входа в активную работу до завершения;
- **Time in Status** - длительность по каждому статусу;
- **Stuck Tasks** - задачи, которые слишком долго находились в одном статусе;
- **Bottlenecks** - статусы, где задачи чаще всего застревали;
- **Returned from Testing** - reopened-задачи и возвраты с тестирования;
- **Delay Reasons** - причины задержек по комментариям, статусам и Clarity Score.

Демо-данные для retro analytics находятся здесь:

```text
data/demo_tasks.json
```

Запуск через npm:

```bash
npm run retro -- --input data/demo_tasks.json --output reports/retro_report.md --format markdown
npm run retro -- --input data/demo_tasks.json --output reports/retro_report.json --format json
npm run retro -- --input data/demo_tasks.json --output reports/retro_tasks.csv --format csv
```

Если `--format` не указан, формат определяется по расширению файла:

- `.md` -> markdown;
- `.json` -> json;
- `.csv` -> csv.

Пример краткой сводки:

```text
Всего задач проанализировано: 10
Средний Clarity Score: 74.2
Средний Cycle Time: 5.3 дн.
Возвратов с тестирования: 3
Зависших задач: 5
Главное узкое место: In Progress
Основная причина задержек: testing_return
```

CSV-экспорт содержит аналитику уровня задач:

```text
task_id,title,source,assignee,clarity_score,lead_time_days,cycle_time_days,is_reopened,is_stuck,main_delay_reason,bottleneck_status,labels
```

Эта фича нужна для ретроспектив: PM может показать не только качество постановки задач, но и связь ясности с cycle time, возвратами с тестирования и процессными bottlenecks.

---

## Радар рисков

Радар рисков оценивает риск проблем при реализации задачи: насколько вероятны возвраты с тестирования, задержки, лишние уточнения от разработки или QA и разночтения между участниками команды.

Модуль нужен PM-у перед передачей в разработку: он показывает не просто "задача мутная", а какие именно пробелы создают риск. Радар рисков проверяет контекст, ожидаемый результат, критерии приёмки, тестируемость, edge cases, негативные сценарии, ссылки/макеты/логи/примеры данных и расплывчатые формулировки вроде "как обсуждали", "пофиксить", "сделать нормально", "urgent", "fix it".

`riskScore` считается от 0 до 100: за каждую найденную проблему добавляются risk points, затем score ограничивается диапазоном `0-100`.

- `0-30` - `low`;
- `31-65` - `medium`;
- `66-100` - `high`.

Clarity Score усиливает радар рисков, если он передан в задаче:

- `clarityScore < 40` добавляет сильный риск;
- `40-69` добавляет умеренный риск;
- `70+` не повышает риск.

Пример входных данных:

```json
{
  "id": "RISK-1",
  "source": "demo",
  "title": "Пофиксить оплату как обсуждали",
  "description": "Оплата не работает. Нужно срочно пофиксить и сделать нормально.",
  "clarityScore": 28
}
```

Пример результата:

```json
{
  "riskLevel": "high",
  "riskScore": 100,
  "categories": ["missing_context", "missing_acceptance_criteria", "vague_wording"],
  "recommendations": [
    "Добавьте бизнес-контекст: зачем нужна задача и на кого она влияет.",
    "Добавьте критерии приёмки в формате чек-листа или Given/When/Then."
  ],
  "managerSummary": "Задача имеет высокий риск проблем при реализации..."
}
```

Радар рисков также генерирует QA notes и `rewrittenTaskSuggestion` со структурой:

```text
## Контекст
## Ожидаемый результат
## Критерии приёмки
## Граничные случаи
## Что проверить
```

Это помогает снижать риск возвратов с тестирования, задержек и лишних уточнений: PM видит, какие детали нужно добавить до разработки, QA заранее понимает, что нельзя проверить, а команда получает более проверяемую постановку задачи.

Пример запуска:

```bash
npm run risk -- --input data/risk-radar-demo-tasks.json --output reports/risk_radar_report.md
npm run risk -- --input data/demo_tasks.json --output reports/risk_report.json --format json
npm run risk -- --input data/demo_tasks.json --output reports/risk_report.csv --format csv
```

---

## Definition of Ready / Definition of Done

Clarity Guardian V2 проверяет, можно ли задачу брать в разработку и можно ли считать её завершённой.

Definition of Ready помогает PM и команде понять, готова ли задача к разработке. Проверяются:

- контекст;
- ожидаемый результат;
- критерии приёмки;
- отсутствие мутных формулировок;
- понятные зависимости;
- размер задачи;
- Clarity Score;
- assignee;
- тип задачи;
- приоритет.

Definition of Done помогает не закрывать задачу слишком рано. Проверяются:

- завершённый статус;
- критерии приёмки;
- признак тестирования;
- отсутствие открытых блокеров;
- отсутствие Reopened после Testing;
- комментарий о результате проверки;
- обновление документации, если задача её затрагивает;
- признак релиза или `completedAt`, если задача про релиз.

Пример запуска:

```bash
npm run readiness -- --input data/demo_tasks.json --output reports/readiness_report.md
npm run readiness -- --input data/demo_tasks.json --output reports/readiness_report.json --format json
npm run readiness -- --input data/demo_tasks.json --output reports/readiness_report.csv --format csv
```

---

## Отчёт о здоровье спринта

Отчёт о здоровье спринта показывает PM, насколько устойчивым выглядит спринт перед планированием или на середине спринта.

Отчёт считает:

- общее количество задач;
- средний Clarity Score;
- средний Risk Score;
- сколько задач проходит Definition of Ready;
- сколько задач имеют high / medium / low risk;
- сколько задач без критериев приёмки или ожидаемого результата;
- внешние зависимости;
- крупный scope;
- reopened и stuck tasks;
- основные факторы риска;
- рекомендации для следующего grooming или planning.

Статусы здоровья:

- **green** - большинство задач готовы, высокий риск контролируемый;
- **yellow** - есть заметные проблемы, но спринт можно стабилизировать;
- **red** - много задач не готовы, высокий риск или низкая ясность.

Пример запуска:

```bash
npm run sprint-health -- --input data/demo_tasks.json --output reports/sprint_health.md
npm run sprint-health -- --input data/demo_tasks.json --output reports/sprint_health.json --format json
npm run sprint-health -- --input data/demo_tasks.json --output reports/sprint_health.csv --format csv
```

---

## Quality Gate

Quality Gate нужен для CI/CD и проверок перед planning: он анализирует набор задач и завершает процесс с ненулевым exit code, если качество постановки ниже заданных порогов.

По умолчанию проверяются:

- средний Clarity Score не ниже `70`;
- Definition of Ready проходит не меньше `80%` задач;
- high-risk задач не больше `20%`;
- входной набор задач не пустой.

Пороги можно менять аргументами:

```bash
npm run quality:gate -- --input data/demo_tasks.json \
  --min-average-clarity 70 \
  --min-ready-percent 70 \
  --max-high-risk-percent 30 \
  --output reports/quality_gate.json \
  --format json
```

Если gate падает, CLI возвращает код `1`, а JSON/Markdown отчёт показывает, какие проверки не прошли.

---

## Отчёт Action Plan

Отчёт Action Plan превращает результаты анализа в рабочий список для grooming: какие задачи стоит уточнить первыми, почему они попали в план, какие вопросы задать и какие действия выполнить.

Отчёт использует Clarity Score, уровень риска, найденные проблемы и Clarity Fix Suggestions. Для каждой задачи показывает:

- priority score;
- причины попадания в action plan;
- вопросы к автору задачи;
- следующие действия;
- PM-friendly rewrite.

Пример запуска:

```bash
npm run action:plan -- --input data/demo_tasks.json --output reports/action_plan.md
npm run action:plan -- --input data/demo_tasks.json --output reports/action_plan.json --format json --limit 5
npm run action:plan -- --input data/demo_tasks.json --output reports/action_plan.csv --format csv
```

Это удобно использовать перед planning или refinement: команда видит не только метрики, но и конкретный список задач, которые надо довести до готовности.

---

## Повестка refinement

Повестка refinement превращает аналитику задач в готовую структуру встречи: какие задачи обсуждать первыми, сколько времени заложить, кто нужен в комнате и какое решение надо зафиксировать.

Отчёт помогает PM и team lead проводить refinement без ручной сортировки backlog:

- priority score для порядка обсуждения;
- решение для каждой задачи: `clarify_requirements`, `split_scope`, `resolve_blocker`, `risk_review` или `ready_to_commit`;
- timebox в минутах;
- роль владельца и нужные участники;
- вопросы к автору задачи;
- подготовка перед встречей;
- решения, которые нужно зафиксировать после обсуждения.

Пример запуска:

```bash
npm run refinement:agenda -- --input data/demo_tasks.json --output reports/refinement_agenda.md
npm run refinement:agenda -- --input data/demo_tasks.json --output reports/refinement_agenda.json --format json --include-ready
npm run refinement:agenda -- --input data/demo_tasks.json --output reports/refinement_agenda.csv --format csv --limit 8
```

Эта фича закрывает практический PM-сценарий: после анализа команда получает не просто список проблем, а компактный план встречи для следующего refinement.

---

## Статус для стейкхолдеров

Статус для стейкхолдеров готовит короткий менеджерский апдейт: что происходит с качеством задач, где есть риски, какие запросы нужны от PM / Tech Lead / QA и какие задачи стоит явно упомянуть.

Отчёт помогает не пересказывать дашборд вручную:

- статус здоровья: `green`, `yellow` или `red`;
- краткая сводка по Clarity Score, DoR, high-risk задачам, blockers и QA gaps;
- highlights, которые можно отправить стейкхолдерам;
- риски для наблюдения с ролью владельца;
- запросы с urgency `now`, `this_week` или `monitor`;
- задачи, которые стоит упомянуть явно;
- следующие действия для ближайшего planning checkpoint.

Пример запуска:

```bash
npm run stakeholder:update -- --input data/demo_tasks.json --output reports/stakeholder_update.md
npm run stakeholder:update -- --input data/demo_tasks.json --output reports/stakeholder_update.json --format json --task-limit 5
npm run stakeholder:update -- --input data/demo_tasks.json --output reports/stakeholder_update.csv --format csv
```

Эта фича полезна для еженедельного PM/status update: вместо набора внутренних метрик команда получает короткое сообщение о здоровье backlog/sprint и конкретных запросах.

---

## Release Guard

Release Guard добавляет предрелизную проверку, которая помогает развивать проект и параллельно следить, чтобы изменения не ломали критичные сценарии. Отчёт собирает задачи с релизным риском, даёт решение `go`, `review_required` или `no_go` и показывает, что нужно проверить до выпуска.

Отчёт помогает PM, QA и Tech Lead быстро увидеть:

- blocked/no-go задачи и внешние зависимости;
- reopened/returned задачи, которые требуют regression check;
- QA-пробелы: нет acceptance criteria, expected result или evidence тестирования;
- рискованные домены: payment, auth, production, integration и похожие зоны;
- владельца риска и чек-лист проверки по каждой задаче;
- заметки по rollback/fallback для критичных сценариев.

Пример запуска:

```bash
npm run release:guard -- --input data/demo_tasks.json --output reports/release_guard.md
npm run release:guard -- --input data/demo_tasks.json --output reports/release_guard.json --format json --limit 8
npm run release:guard -- --input data/demo_tasks.json --output reports/release_guard.csv --format csv
```

Фича не заменяет релизный процесс, а делает его видимым: команда получает компактный список задач, которые нельзя выпускать без дополнительной проверки.

---

## Evidence Brief

Evidence Brief добавляет слой на стыке IT, научной коммуникации и project management. Отчёт превращает задачи в короткие проверяемые brief-записи для planning/refinement: какая гипотеза стоит за задачей, на какие данные команда опирается, где не хватает источника, метрики или воспроизводимого метода проверки.

Отчёт помогает PM, разработчикам, QA и аналитикам увидеть:

- рабочая гипотеза для задачи;
- evidence signals: контекст, источник наблюдения, критерии проверки, метрики;
- evidence gaps: отсутствие источника, проверяемого результата, acceptance criteria или метрики успеха;
- вопросы перед передачей задачи;
- следующие действия для PM / Tech Lead / QA / Analytics;
- коммуникационный frame для обсуждения на refinement.

Пример запуска:

```bash
npm run evidence:brief -- --input data/demo_tasks.json --output reports/evidence_brief.md
npm run evidence:brief -- --input data/demo_tasks.json --output reports/evidence_brief.json --format json --limit 5
npm run evidence:brief -- --input data/demo_tasks.json --output reports/evidence_brief.csv --format csv
```

Эта фича особенно полезна для задач с исследовательским, аналитическим или продуктовым компонентом: она не только говорит "задача мутная", а показывает, какой кусок доказательной коммуникации нужно добавить, чтобы команда могла принять решение и воспроизвести проверку.

---

## Журнал решений

Журнал решений показывает зрелость управленческой мысли в проекте: он проверяет, прослеживается ли решение от исходной проблемы до проверки, владельца и контроля риска.

Это не просто ещё один список проблем. Отчёт собирает по каждой задаче decision trace:

- problem framing: какая проблема зафиксирована;
- decision intent: какое целевое изменение принято;
- evidence basis: на какие данные или наблюдения опирается решение;
- verification method: как QA, reviewer или analytics проверят результат;
- owner and priority: кто accountable и насколько задача готова к commitment;
- dependency control: есть ли внешние зависимости и владельцы;
- risk control: нужен ли отдельный risk review.

Для каждой задачи считается **Traceability Score** от 0 до 100 и статус:

- `decision_ready`;
- `needs_problem_framing`;
- `needs_validation_plan`;
- `needs_owner_alignment`;
- `risk_review_required`.

Пример запуска:

```bash
npm run decision:ledger -- --input data/demo_tasks.json --output reports/decision_ledger.md
npm run decision:ledger -- --input data/demo_tasks.json --output reports/decision_ledger.json --format json --limit 5
npm run decision:ledger -- --input data/demo_tasks.json --output reports/decision_ledger.csv --format csv
```

Эта фича хорошо показывает, что Clarity Guardian работает как PM-инструмент: он связывает требования, evidence, DoR/DoD, риск и ответственность в одну проверяемую цепочку принятия решений.

---

## Профиль здоровья задачи

Профиль здоровья задачи собирает по каждой задаче компактный профиль, который удобно использовать на refinement, planning или ретро.

Профиль показывает:

- Clarity Score;
- уровень риска и risk score;
- missing sections;
- weak formulations и tone issues;
- delivery risks;
- QA risks;
- DoR / DoD scores;
- lead time и cycle time;
- рекомендации для менеджера;
- следующий лучший шаг.

На уровне проекта отчёт считает сводку качества: средний Clarity Score, процент задач хорошего качества, долю задач без acceptance criteria, долю vague formulations, high-risk tasks, reopened tasks, stuck tasks, частые проблемы и рекомендации для процесса.

Пример запуска:

```bash
npm run task:health -- --input data/demo_tasks.json --output reports/task_health_profile.md
npm run task:health -- --input data/demo_tasks.json --output reports/task_health_profile.json --format json --limit 20
npm run task:health -- --input data/demo_tasks.json --output reports/task_health_profile.csv --format csv --attention-only
```

Эта фича делает проект удобнее для внешнего демо: можно открыть один отчёт и увидеть, почему конкретная задача рискованная, что в ней не хватает и какой следующий управленческий шаг нужен.

---

## Очередь быстрых исправлений багов

Очередь быстрых исправлений багов помогает не терять мелкие баги в общем потоке задач. Она находит bug-кандидатов, отличает быстрые безопасные фиксы от задач, которые сначала требуют уточнения или risk review, и формирует короткую карточку фикса.

Для каждой bug-задачи отчёт показывает:

- bug signals: почему задача считается багом;
- Fix Readiness Score;
- статус `quick_fix_ready`, `needs_clarification` или `needs_risk_review`;
- рекомендуемый timebox для мелкого фикса;
- blockers;
- patch plan;
- verification checklist;
- safety checks.

Пример запуска:

```bash
npm run bug:quick-fix -- --input data/demo_tasks.json --output reports/quick_bug_fix.md
npm run bug:quick-fix -- --input data/demo_tasks.json --output reports/quick_bug_fix.json --format json --include-needs-review
npm run bug:quick-fix -- --input data/demo_tasks.json --output reports/quick_bug_fix.csv --format csv
```

Фича специально не обещает "авточинить" рискованные баги вслепую. Она ускоряет безопасные мелкие фиксы и останавливает те, где сначала нужны шаги воспроизведения, критерии проверки, владелец зависимости или risk review.

---

## Demo-режим

Проект можно запустить без доступа к GitHub, Jira или Yandex Tracker.

Демо-данные находятся здесь:

```text
data/demo-tasks.json
data/demo_tasks.json
```

Внутри есть:

- good, medium и poor tasks;
- before и after periods;
- задачи с QA returns и без них;
- разные development times;
- high / medium / low risk tasks;
- примеры Definition of Ready / Done;
- внешние зависимости и блокеры;
- Sprint Health demo;
- разные authors;
- разные assignees;
- разные statuses;
- priorities;
- tags;
- components.

Демо-датасет позволяет показать все ключевые возможности проекта локально и без подключения к реальным рабочим данным.

---

## Архитектура

```text
src/
  analyze.ts                 # анализ задачи и вывод для GitHub/Jira bot
  clarity-score.ts           # Clarity Score и коммуникационные риски
  recommendations.ts         # рекомендации для менеджера
  task-model.ts              # единая модель задачи
  yandex-tracker.ts          # adapter/service для Yandex Tracker
  analytics.ts               # дашборд, история, before/after, исследовательские данные
  reports.ts                 # форматирование Markdown, CSV и HTML отчётов
  v2-report.ts               # CLI для отчётов
  retro-analyzer.ts          # расчёт lead time, cycle time и bottlenecks
  quality-gate.ts            # CI gate по Clarity Score, DoR и high-risk задачам
  action-plan.ts             # приоритизированный список задач для уточнения
  refinement-agenda.ts       # повестка refinement с timebox, ролями и решениями
  stakeholder-update.ts      # короткий статус для стейкхолдеров с рисками и запросами
  release-guard.ts           # предрелизная guard-проверка, QA gaps и rollback notes
  evidence-brief.ts          # evidence brief для planning и научной коммуникации
  decision-ledger.ts         # матрица прослеживаемости решений и risk governance
  task-health-profile.ts     # единый профиль здоровья задачи и сводка качества проекта
  quick-bug-fix.ts           # очередь быстрых и безопасных фиксов мелких багов
  retro-report.ts            # CLI для ретро-аналитики задач
  retro-report-*.ts          # экспорты Markdown, JSON и CSV для ретро
  retro-delay-reasons.ts     # причины задержек и возвратов
  task-signals.ts            # общие сигналы задачи для PM-аналитики
  report-utils.ts            # общий вывод Markdown/JSON/CSV
  risk/                      # определение рисков
  readiness/                 # Definition of Ready / Definition of Done
  sprint-health/             # отчёт о здоровье спринта
  risk-report.ts             # CLI для отчёта по рискам
  readiness-report.ts        # CLI для DoR/DoD отчёта
  sprint-health-report.ts    # CLI для отчёта о здоровье спринта
  sync-github.ts             # GitHub comments/body sync
  sync-jira.ts               # Jira REST sync
  generate-test-checklist.ts # QA checklist generation

data/
  demo-tasks.json            # демо-данные для portfolio demo
  demo_tasks.json            # демо-данные для ретро-аналитики
  README.md                  # пояснение, какой dataset использовать для какого demo

scripts/
  smoke-test.ts              # end-to-end smoke-проверки

templates/
  *.md                       # шаблоны для менеджера и тестировщика
```

GitHub bot остаётся совместимым с основной логикой анализа. Слой отчётов построен поверх того же анализатора и расширяет проект до уровня PM-аналитики.

---

## Быстрый старт

```bash
npm ci
npm run check
npm run build
npm test
```

Запустить demo:

```bash
npm run demo
```

После запуска будут сгенерированы файлы:

```text
reports/demo/dashboard.json
reports/demo/dashboard.md
reports/demo/dashboard.html
reports/demo/retro-report.md
reports/demo/research-report.md
reports/demo/decision-ledger.md
reports/demo/quick-bug-fix.md
reports/demo/task-health-profile.md
reports/demo/refinement-agenda.md
reports/demo/stakeholder-update.md
reports/demo/release-guard.md
reports/demo/tasks.csv
reports/demo/before-after.json
reports/demo/clarity-history.jsonl
reports/demo/task-history.json
reports/demo/analysis-records.json
```

Папка `reports/` игнорируется git, потому что это сгенерированный вывод.

---

## Примеры отчётов

Чтобы внешний ревьюер мог быстро понять формат результата без запуска проекта, в репозитории есть committed examples:

```text
examples/sample-project-dashboard.md
examples/sample-retro-report.md
examples/sample-before-after.json
examples/sample-task-health-profile.md
examples/sample-clarity-report.json
examples/sample-task-health.csv
```

Полные актуальные отчёты генерируются командой `npm run demo` в `reports/demo/`.

---

## Генерация отчётов из файла

Подготовь JSON-массив unified tasks:

```json
[
  {
    "id": "TASK-1",
    "source": "file",
    "title": "Checkout success page",
    "body": "## Context\n...\n\n## Expected result\n...\n\n## Acceptance criteria\n- ...",
    "status": "Done",
    "author": "PM",
    "assignee": "Developer",
    "period": "after",
    "metrics": {
      "cycleTimeHours": 24,
      "qaReturns": 0,
      "commentsCount": 4,
      "descriptionChanges": 1
    }
  }
]
```

Запуск:

```bash
npm run build
node dist/v2-report.js \
  --input tasks.json \
  --out-dir reports/custom
```

Для portfolio demo можно сгенерировать отчёты через npm scripts:

```bash
npm run v2:report -- --input data/demo_tasks.json --out-dir reports/custom
npm run risk -- --input data/demo_tasks.json --output reports/risk_report.md
npm run readiness -- --input data/demo_tasks.json --output reports/readiness_report.md
npm run sprint-health -- --input data/demo_tasks.json --output reports/sprint_health.md
```

---

## Настройка GitHub

Workflow находится здесь:

```text
.github/workflows/clarity-guardian.yml
```

Он реагирует на:

- opened / edited / labeled issues;
- opened / edited / labeled / ready_for_review pull requests.

Нужные permissions:

```yaml
permissions:
  contents: read
  issues: write
  pull-requests: write
```

Бот умеет:

- анализировать задачу;
- обновлять Issue/PR description через managed Clarity Guardian block;
- редактировать предыдущий bot comment вместо создания дублей;
- генерировать tester checklist, когда задача переходит в ready for testing.

Опциональный secret:

```text
OPENAI_API_KEY=...
```

Без него checklist generation использует local templates.

---

## Интеграция с Yandex Tracker

Интеграция с Yandex Tracker реализована здесь:

```text
src/yandex-tracker.ts
```

Переменные окружения:

```bash
YANDEX_TRACKER_TOKEN=...
YANDEX_TRACKER_ORG_ID=...
# или
CLOUD_ORG_ID=...

YANDEX_TRACKER_QUEUE=CHECKOUT
YANDEX_TRACKER_PROJECT="Checkout Project"
YANDEX_TRACKER_BASE_URL=https://api.tracker.yandex.net
```

Получить задачи из Tracker как unified JSON:

```bash
npm run build
node dist/yandex-tracker.js \
  --output yandex-tasks.json
```

Построить отчёт напрямую из Yandex Tracker:

```bash
YANDEX_TRACKER_TOKEN=... \
YANDEX_TRACKER_ORG_ID=... \
YANDEX_TRACKER_QUEUE=CHECKOUT \
node dist/v2-report.js \
  --source yandex \
  --out-dir reports/yandex
```

CLI-параметры:

```bash
node dist/yandex-tracker.js --queue CHECKOUT --output tasks.json
node dist/yandex-tracker.js --project "Checkout Project" --output tasks.json
node dist/yandex-tracker.js --keys CHECKOUT-1,CHECKOUT-2 --output tasks.json
node dist/yandex-tracker.js --query 'Queue: CHECKOUT "Sort by": Updated DESC' --output tasks.json
```

Adapter читает:

- сводку;
- description;
- status;
- assignee;
- author / createdBy;
- createdAt;
- updatedAt;
- type;
- priority;
- tags;
- components;
- queue / project.

Отсутствующие опциональные поля обрабатываются через graceful fallback.

---

## Интеграция с Jira

Jira sync остаётся доступным:

```bash
JIRA_BASE_URL=https://your-company.atlassian.net
JIRA_EMAIL=name@example.com
JIRA_API_TOKEN=...
```

Запуск:

```bash
node dist/sync-jira.js \
  --payload event.json \
  --analysis result.json \
  --analysis-comment comment.md \
  --issue-key CG-123
```

---

## Локальный анализ задачи

Создай `event.json`:

```json
{
  "type": "issue",
  "title": "Проверить оплату после 3DS",
  "body": "## Контекст\nПользователь иногда не видит успешную оплату после 3DS.\n\n## Ожидаемый результат\nПосле успешного 3DS пользователь видит экран успеха.\n\n## Критерии приёмки\n- Оплата проходит успешно.\n- Ошибка банка показывает понятное сообщение.",
  "labels": ["bug"]
}
```

Запуск:

```bash
npm run build
node dist/analyze.js \
  --input event.json \
  --json-file result.json \
  --comment-file comment.md \
  --updated-body-file updated-body.md
```

Эта команда анализирует одну Issue/PR-задачу и используется GitHub/Jira bot-сценарием. Для анализа массива задач и портфолио-отчёта используй `npm run v2:report`.

---

## Конфигурация

Основной config:

```text
clarity-guardian.config.json
```

Поддерживает:

- language: `auto`, `ru`, `en`;
- mode: `strict`, `non-strict`;
- `updateDescription`;
- обязательные секции;
- common-правила и type-specific rules;
- project-specific stop phrases;
- словарь bad formulations;
- scoring weights и thresholds;
- risk thresholds;
- ignored labels / statuses для аналитики;
- формат отчёта по умолчанию.

Пример:

```json
{
  "language": "auto",
  "mode": "strict",
  "updateDescription": true,
  "stopPhrases": [
    {
      "phrase": "потом уточним",
      "level": "warning",
      "code": "deferred_context",
      "message": "Фраза оставляет незакрытый вопрос. Укажи, что именно нужно уточнить и у кого.",
      "languages": ["ru"]
    }
  ],
  "badFormulations": [
    {
      "phrase": "по аналогии",
      "category": "unclear_reference",
      "message": "Фраза скрывает критерии сравнения.",
      "languages": ["ru"]
    }
  ],
  "scoring": {
    "weights": {
      "missingAcceptanceCriteria": 20
    },
    "thresholds": {
      "good": 80,
      "medium": 50
    }
  },
  "analytics": {
    "ignoredLabels": ["duplicate"],
    "ignoredStatuses": ["Cancelled"]
  },
  "reports": {
    "defaultFormat": "markdown"
  }
}
```

---

## Ценность продукта

Clarity Guardian помогает команде:

- снижать неоднозначность до начала разработки;
- делать качество задач измеримым;
- видеть повторяющиеся коммуникационные проблемы;
- готовить содержательные ретроспективы;
- связывать постановку задач с delivery outcomes;
- делать PM-работу видимой через structured improvements;
- улучшать взаимодействие между PM, разработкой и QA.

---

## Ценность для PM

Для PM-портфолио проект показывает:

- product problem framing;
- ясное понимание user value;
- lightweight analytics;
- integration thinking;
- умение приоритизировать готовую для демо ценность вместо лишней сложности;
- коммуникацию между PM, разработкой и QA;
- аккуратное исследовательское мышление без завышения выводов;
- способность превращать разрозненную боль команды в понятный инструмент.

---

## Проверки

Проект использует TypeScript-проверки и smoke tests через npm.

Smoke tests покрывают:

- Clarity Score и анализ задач;
- рекомендации для менеджера;
- анализ demo-задач;
- сравнение before/after;
- экспорты Markdown, JSON, CSV и HTML;
- edge cases ретро-аналитики;
- определение рисков, DoR/DoD и отчёт о здоровье спринта;
- повестку refinement, статус для стейкхолдеров, Release Guard, Evidence Brief, журнал решений, очередь быстрых bug-fix задач и профиль здоровья задачи;
- adapter для Yandex Tracker и fallback для missing fields;
- поведение обновления комментариев GitHub;
- поведение Jira sync;
- sanity check Docker-конфигурации.

Запуск:

```bash
npm run smoke
```

Полная проверка:

```bash
npm ci
npm run typecheck
npm run lint
npm run build
npm test
npm run demo
npm run verify
git diff --check
```

---

## Документация

Документация проекта:

- руководство по коммуникации;
- обоснование через научную коммуникацию;
- портфолио-кейс;
- demo guide;
- архитектура;
- дорожная карта;
- продуктовый и инженерный аудит;
- examples с sample reports.

Ключевые файлы:

```text
ARCHITECTURE.md
ROADMAP.md
docs/PRODUCT_AUDIT.md
docs/V2_DEMO_GUIDE.md
examples/
```

---

## Дорожная карта

Дорожная карта находится в `ROADMAP.md` и разделена на этапы:

- V1 - бот ясности для GitHub Issue / PR;
- V2 - PM-аналитика и отчёты;
- V3 - интеграции и дашборды;
- V4 - потенциал SaaS / командного workspace.

---

## Ограничения

- Аналитика строится на эвристиках и качестве входных данных, поэтому её стоит использовать как поддержку принятия решений, а не как абсолютную оценку человека или команды.
- Метрики жизненного цикла зависят от полноты `statusHistory` во внешнем трекере.
- Статический HTML dashboard намеренно простой: он подходит для demo, но не заменяет полноценный SaaS dashboard.
- AI-интеграция не является обязательной частью проекта: все ключевые сценарии работают без API keys.
- Для коммерческого использования нужно дополнительно валидировать scoring weights и risk thresholds на реальных данных команды.
