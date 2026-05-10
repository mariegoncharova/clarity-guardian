# Clarity Guardian

**Clarity Guardian** - бот, который защищает команду от испорченного телефона между менеджером, разработчиком и тестировщиком.

Он проверяет, что в Issue или Pull Request есть обязательные разделы:

- `## Контекст`
- `## Ожидаемый результат`
- `## Критерии приёмки`

А при переходе задачи в тестирование генерирует чек-лист для QA.

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
  - «не работает» без шагов воспроизведения.

Если есть ошибки - бот оставляет комментарий и workflow падает.

Если есть только предупреждения - бот оставляет совет, но не блокирует задачу.

---

## При переходе в тестирование

Бот считает задачу готовой для тестирования, если:

- добавлена метка `ready-for-testing`;
- или PR переведён из Draft в Ready for review.

После этого бот:

- берёт название и описание задачи;
- если есть `OPENAI_API_KEY`, генерирует QA-чеклист через OpenAI API;
- если ключа нет, использует шаблон `templates/tester-checklist.md`;
- добавляет чек-лист комментарием.

---

## Быстрый старт в GitHub

### 1. Файлы проекта

Структура должна быть такой:

```text
.github/workflows/clarity-guardian.yml
src/analyze.ts
src/generate-test-checklist.ts
src/utils.ts
src/types.ts
tsconfig.json
templates/manager-checklist.md
templates/tester-checklist.md
docs/COMMUNICATION_GUIDE.md
package.json
Dockerfile
README.md
```

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

### 3. Проверить permissions

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
- GitHub API вызывается только из workflow;
- Node.js-скрипты не знают ничего о GitHub-токенах.

---

## Локальный запуск

Установи dev-зависимости и собери TypeScript:

```bash
npm ci
npm run build
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
  --comment-file comment.md
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
  --comment-file analysis.md
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

## Что можно докрутить дальше

- Автоматически обновлять описание Issue/PR, а не только писать комментарий.
- Не дублировать комментарии, а редактировать предыдущий комментарий бота.
- Добавить project-specific словарь стоп-фраз.
- Добавить поддержку английских шаблонов.
- Добавить режим strict/non-strict.
- Добавить отдельные правила для bug/task/story.
- Подключить Jira REST API напрямую.
