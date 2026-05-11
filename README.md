# Clarity Guardian

**Clarity Guardian** - бот, который защищает команду от испорченного телефона между менеджером, разработчиком и тестировщиком.

Он проверяет качество постановки задач в GitHub Issues, Pull Requests и Jira: ищет недостающий контекст, неясный ожидаемый результат, непроверяемые критерии приёмки и формулировки, которые могут привести к разной интерпретации задачи.

---

## Why this project matters

Clarity Guardian is not only an automation bot. It is a project about technical and scientific communication in software development.

In IT teams, a task description often becomes the main unit of knowledge transfer between roles. If the task is unclear, each participant interprets it differently: a manager expects one result, a developer implements another, and a QA engineer checks a third version of the truth.

The project applies principles of scientific communication to engineering workflows:

- clarity of context;
- explicit expected results;
- verifiable acceptance criteria;
- reproducible testing scenarios;
- reduction of ambiguity;
- transformation of implicit knowledge into written, reviewable knowledge.

This makes Clarity Guardian a practical tool for improving communication quality in IT teams.

---

## Project documentation

- [Communication Guide](docs/COMMUNICATION_GUIDE.md) - practical guide for writing clear tasks.
- [Scientific Communication Rationale](docs/SCIENTIFIC_COMMUNICATION.md) - explanation of the project through the lens of scientific and technical communication.
- [Portfolio Case](docs/PORTFOLIO_CASE.md) - short case description for reviewers and admissions portfolio.

---

## Что делает бот

### При создании или редактировании Issue/PR

Бот анализирует описание задачи.

Он проверяет:

- есть ли обязательные разделы;
- не пустые ли они;
- нет ли мутных формулировок:
  - «сделать красиво»;
  - «как обсуждали»;
  - «как в прошлый раз»;
  - «срочно»;
  - «пофиксить»;
  - «не работает» без шагов воспроизведения;
- соответствует ли описание типу задачи: `bug`, `task`, `story`;
- можно ли проверить задачу по критериям приёмки;
- достаточно ли информации для QA.

Если есть ошибки - бот оставляет комментарий и workflow падает.

Если есть только предупреждения - бот оставляет совет, но не блокирует задачу.

Бот также добавляет или обновляет managed-блок `Clarity Guardian` прямо в описании Issue/PR. Повторные запуски не создают новые комментарии: бот ищет свой предыдущий комментарий по скрытому маркеру и редактирует его.

---

## Clarity Score

В проект добавлена оценка ясности задачи - **Clarity Score**.

Она показывает, насколько описание готово к передаче между ролями: менеджером, разработчиком и тестировщиком.

Пример:

```text
Clarity Score: 72/100
Risk Level: medium
```

Оценка учитывает:

- структурную полноту описания;
- наличие блокирующих ошибок;
- количество предупреждений;
- коммуникационные риски;
- проверяемость критериев приёмки;
- наличие пользовательского сценария;
- наличие скрытых договорённостей.

Clarity Score нужен не только для автоматической проверки, но и для объяснения: **почему задача может быть неправильно понята**.

---

## Коммуникационные риски

Clarity Guardian классифицирует проблемы описания как коммуникационные риски:

- неявный контекст;
- размытый ожидаемый результат;
- непроверяемые критерии приёмки;
- скрытые договорённости;
- отсутствие пользовательского сценария;
- неясность для QA;
- описание реализации без цели.

Такой подход связывает инженерную задачу с принципами научной коммуникации: ясностью, воспроизводимостью и проверяемостью.

---

## Режим strict/non-strict

В `strict` режиме ошибки блокируют workflow.

В `non-strict` режиме блокирующие ошибки превращаются в предупреждения, поэтому workflow не падает, но комментарий и managed-блок всё равно показывают, что нужно поправить.

Режим задаётся в `clarity-guardian.config.json`:

```json
{
  "mode": "strict"
}
```

Или переменной окружения:

```bash
CLARITY_GUARDIAN_MODE=non-strict
```

---

## Типы задач

Тип определяется из `workItemType` во входном JSON или из labels/title:

- `bug`, `defect`, `ошибка`, `баг` → `bug`;
- `story`, `user story`, `стори`, `история` → `story`;
- всё остальное → `task`.

Для `bug` дополнительно проверяются шаги воспроизведения и фактический результат.

Для `story` дополнительно проверяется user story.

Для `task` используются базовые правила.

---

## Английские шаблоны

Язык определяется автоматически по заголовкам в описании или задаётся явно:

```json
{
  "language": "auto"
}
```

Поддерживаются английские разделы:

- `## Context`
- `## Expected result`
- `## Acceptance criteria`
- `## Steps to reproduce`
- `## Actual result`
- `## User story`

Шаблоны лежат в:

- `templates/manager-checklist.md`
- `templates/tester-checklist.md`
- `templates/manager-checklist.en.md`
- `templates/tester-checklist.en.md`

---

## Project-specific стоп-фразы

Дополнительные стоп-фразы настраиваются в `clarity-guardian.config.json`:

```json
{
  "stopPhrases": [
    {
      "phrase": "потом разберемся",
      "level": "warning",
      "code": "deferred_context",
      "message": "Фраза «потом разберемся» переносит важные решения за пределы задачи.",
      "languages": ["ru"]
    }
  ]
}
```

Стоп-фразы можно ограничивать языком и типом задачи через `languages` и `workItemTypes`.

---

## При переходе в тестирование

Бот считает задачу готовой для тестирования, если:

- добавлена метка `ready-for-testing`;
- или PR переведён из Draft в Ready for review.

После этого бот:

- берёт название и описание задачи;
- если есть `OPENAI_API_KEY`, генерирует QA-чеклист через OpenAI API;
- если ключа нет, использует шаблон `templates/tester-checklist.md`;
- добавляет или обновляет чек-лист в комментарии бота.

---

## Быстрый старт в GitHub

### 1. Файлы проекта

Структура проекта:

```text
.github/workflows/clarity-guardian.yml
clarity-guardian.config.json
src/analyze.ts
src/clarity-score.ts
src/config.ts
src/generate-test-checklist.ts
src/prepare-event-payload.ts
src/sync-github.ts
src/sync-jira.ts
src/types.ts
src/utils.ts
src/write-workflow-outputs.ts
tsconfig.json
templates/manager-checklist.md
templates/tester-checklist.md
templates/manager-checklist.en.md
templates/tester-checklist.en.md
docs/COMMUNICATION_GUIDE.md
docs/SCIENTIFIC_COMMUNICATION.md
docs/PORTFOLIO_CASE.md
package.json
package-lock.json
Dockerfile
README.md
```

---

### 2. Добавить секрет OpenAI, если нужна AI-генерация

В GitHub:

```text
Settings → Secrets and variables → Actions → New repository secret
```

Добавить:

```text
OPENAI_API_KEY=...
```

Если секрет не задан, бот всё равно работает, но чек-лист для тестировщика будет стандартным шаблоном.

---

### 3. Добавить Jira secrets, если нужна синхронизация с Jira

В GitHub Actions secrets:

```text
JIRA_BASE_URL=https://your-company.atlassian.net
JIRA_EMAIL=name@example.com
JIRA_API_TOKEN=...
```

Бот ищет Jira issue key в title/body/labels/branch по паттерну:

```text
[A-Z][A-Z0-9]+-\d+
```

Паттерн можно переопределить GitHub variable:

```text
JIRA_ISSUE_KEY_PATTERN=CG-\d+
```

По умолчанию Jira description тоже обновляется. Отключить можно variable:

```text
JIRA_UPDATE_DESCRIPTION=false
```

---

### 4. Проверить permissions

В workflow уже указано:

```yaml
permissions:
  contents: read
  issues: write
  pull-requests: write
```

Для репозитория желательно включить:

```text
Settings → Actions → General → Workflow permissions → Read and write permissions
```

---

## Важное про безопасность

Workflow использует `pull_request_target`.

Это удобно, потому что бот может комментировать PR, но опасно, если запускать непроверенный код из PR.

Поэтому в этом проекте:

- не выполняется код из ветки PR;
- checkout делается из default branch;
- анализ идёт только по `github.event`;
- GitHub API вызывается из `dist/sync-github.js` только с `GITHUB_TOKEN`;
- Jira API вызывается из `dist/sync-jira.js` только если заданы Jira secrets;
- чувствительные данные берутся только из GitHub Secrets.

---

## Локальный запуск

Установи dev-зависимости и собери TypeScript:

```bash
npm ci
npm run build
npm run smoke
```

Создай файл `event.json`:

```json
{
  "type": "issue",
  "title": "Пофиксить оплату",
  "body": "## Контекст\nОплата картой иногда не работает у пользователей после прохождения 3DS.\n\n## Ожидаемый результат\nПосле успешного 3DS пользователь возвращается на экран успеха, заказ получает статус paid.\n\n## Критерии приёмки\n- [ ] Оплата с 3DS проходит успешно.\n- [ ] При ошибке банка показывается понятное сообщение.\n- [ ] Повторная оплата доступна.",
  "labels": []
}
```

Запусти анализ:

```bash
node dist/analyze.js \
  --input event.json \
  --json-file result.json \
  --comment-file comment.md \
  --updated-body-file updated-body.md
```

Сгенерируй чек-лист:

```bash
OPENAI_API_KEY=sk-... node dist/generate-test-checklist.js \
  --input event.json \
  --json-file checklist.json \
  --comment-file checklist.md
```

Без `OPENAI_API_KEY`:

```bash
node dist/generate-test-checklist.js \
  --input event.json \
  --json-file checklist.json \
  --comment-file checklist.md
```

Синхронизация с GitHub:

```bash
GITHUB_TOKEN=... node dist/sync-github.js \
  --payload event.json \
  --analysis result.json \
  --analysis-comment comment.md
```

Синхронизация с Jira:

```bash
JIRA_BASE_URL=https://your-company.atlassian.net \
JIRA_EMAIL=name@example.com \
JIRA_API_TOKEN=... \
node dist/sync-jira.js \
  --payload event.json \
  --analysis result.json \
  --analysis-comment comment.md \
  --issue-key CG-123
```

---

## Docker

Сборка:

```bash
docker build -t clarity-guardian .
```

Анализ:

```bash
docker run --rm \
  -v "$PWD/event.json:/app/event.json" \
  -v "$PWD/out:/app/out" \
  clarity-guardian \
  dist/analyze.js \
  --input event.json \
  --json-file out/result.json \
  --comment-file out/comment.md
```

Генерация чек-листа:

```bash
docker run --rm \
  -e OPENAI_API_KEY="$OPENAI_API_KEY" \
  -v "$PWD/event.json:/app/event.json" \
  -v "$PWD/out:/app/out" \
  clarity-guardian \
  dist/generate-test-checklist.js \
  --input event.json \
  --json-file out/checklist.json \
  --comment-file out/checklist.md
```

---

## Интеграция не только с GitHub

Основная логика вынесена в чистые Node.js-скрипты.

Это значит, что Clarity Guardian можно подключить к:

- GitLab CI;
- Jira Automation;
- Jenkins;
- TeamCity;
- собственному webhook-сервису;
- Docker/Kubernetes job.

### Общий контракт входа

На вход нужен JSON:

```json
{
  "type": "issue",
  "title": "Название задачи",
  "body": "Markdown или обычный текст описания",
  "labels": ["ready-for-testing"]
}
```

### Анализ задачи

```bash
node dist/analyze.js \
  --input task.json \
  --json-file analysis.json \
  --comment-file analysis.md \
  --updated-body-file updated-body.md
```

### Генерация чек-листа

```bash
node dist/generate-test-checklist.js \
  --input task.json \
  --json-file checklist.json \
  --comment-file checklist.md
```

---

## Как задача должна выглядеть

Минимальный корректный пример:

```markdown
## Контекст

Пользователь не может завершить оплату после прохождения 3DS.
После возврата из банка форма остаётся в состоянии загрузки.

## Ожидаемый результат

После успешного прохождения 3DS пользователь возвращается на экран успешной оплаты.
Заказ получает статус `paid`.

## Критерии приёмки

- [ ] Оплата с 3DS проходит успешно.
- [ ] После возврата из банка заказ получает статус `paid`.
- [ ] При ошибке банка пользователь видит понятное сообщение.
- [ ] Повторная попытка оплаты доступна.
```

---

## Что уже подключено

- Автоматическое обновление описания Issue/PR через managed-блок.
- Редактирование предыдущего комментария бота вместо дублей.
- Project-specific словарь стоп-фраз в `clarity-guardian.config.json`.
- Русские и английские шаблоны.
- Режим `strict`/`non-strict`.
- Отдельные правила для `bug`/`task`/`story`.
- Прямая синхронизация с Jira REST API v3.
- Clarity Score для оценки ясности задачи.
- Классификация коммуникационных рисков.
- Документация для портфолио и научной коммуникации.

---

## Roadmap

- Интеграция с Yandex Tracker.
- Дашборд качества задач по проекту.
- Аналитика динамики Clarity Score.
- Экспорт отчётов для ретро.
- Рекомендации для менеджеров по улучшению постановки задач.
- Сравнение качества задач до и после внедрения инструмента.
- Исследование влияния ясности задач на скорость разработки и количество возвратов с тестирования.

---

## License

This project is publicly visible for portfolio and review purposes.

All rights reserved. You may not copy, modify, distribute, publish, sublicense, sell, use in production, or create derivative works based on this software without prior written permission from the author.
