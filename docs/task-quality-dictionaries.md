# Task Quality Dictionaries

Clarity Guardian использует словари как локальную базу знаний о качестве задач. Это не отдельный AI-layer и не внешний API: все правила deterministic, типизированы и лежат в коде или конфиге проекта.

Главный файл:

```text
src/dictionaries/taskQualityDictionary.ts
```

## Какие словари есть

| Словарь | Где используется | Что ловит |
| --- | --- | --- |
| `DEFAULT_STOP_PHRASES` | `config.ts`, `analyzeStopPhrases` | Стоп-фразы в описании задач: vague wording, hidden context, deferred decisions, unclear scope, urgency without reason. |
| `DEFAULT_BAD_FORMULATIONS` | `toneOfVoiceAnalyzer` | Плохие формулировки с категориями: `vague`, `pressure`, `unclear_reference`, `missing_context`, `weak_acceptance`, `hidden_requirement`. |
| `TONE_DICTIONARY` | `toneOfVoiceAnalyzer` | Тональность: vague wording, blaming tone, passive-aggressive, too informal, unclear urgency. |
| `TASK_SIGNAL_KEYWORDS` | `task-signals`, `risk-rules`, tone analyzer | Операционные keywords: risky domains, external dependencies, large scope, blockers, testing, evidence, edge cases. |
| `SMART_VAGUE_PHRASE_DEFINITIONS` | `smartDictionary` | Размытые SMART-фразы и правила, когда они смягчаются конкретикой или сроком. |
| `TASK_POSITIVE_SIGNAL_PATTERNS` | `smartDictionary` | Позитивные сигналы зрелой задачи: объект, действие, expected result, acceptance criteria, метрика, verification, constraint, evidence, deadline. |

## Зачем нужны позитивные сигналы

Словари не должны только ругать задачу. Хорошая аналитика должна видеть и сильные признаки:

- есть конкретный объект изменения;
- описано наблюдаемое поведение;
- есть acceptance criteria;
- есть метрика успеха;
- указаны ограничения;
- есть evidence или источник данных;
- есть dependency owner;
- есть deadline, sprint или release frame.

Именно поэтому SMART Task Check использует не только vague-фразы, но и `TASK_POSITIVE_SIGNAL_PATTERNS`.

## Как расширять

Для общих правил, которые должны работать без пользовательского config, добавляй их в `src/dictionaries/taskQualityDictionary.ts`.

Для project-specific правил лучше использовать `clarity-guardian.config.json`:

```json
{
  "stopPhrases": [
    {
      "phrase": "потом решим",
      "level": "warning",
      "code": "deferred_decision",
      "message": "Фраза переносит решение за пределы задачи. Укажи owner и срок решения.",
      "languages": ["ru"]
    }
  ],
  "badFormulations": [
    {
      "phrase": "по аналогии",
      "category": "unclear_reference",
      "message": "Нужна ссылка или явное описание референса.",
      "recommendation": "Добавь пример и перечисли допустимые отличия.",
      "languages": ["ru"]
    }
  ]
}
```

## Правила качества

- Не добавлять слишком короткие универсальные слова без контекста, если они дают много false positives.
- Для vague-глаголов вроде `улучшить` или `оптимизировать` учитывать смягчение: если рядом есть объект, метрика и expected result, задача может быть нормальной.
- Для urgency-фраз учитывать причину: `срочно` без причины плохо, но deadline/release/incident context снижает риск.
- Для позитивных сигналов предпочитать наблюдаемое поведение и проверяемые условия, а не красивые абстрактные слова.
- Добавлять тест, если словарь влияет на scoring или tone/risk category.

## Проверки

Словари покрыты тестами в:

```text
tests/taskQualityDictionary.test.ts
tests/toneOfVoiceAnalyzer.test.ts
tests/smartAnalyzer.test.ts
```

Минимальная проверка после изменения словарей:

```bash
npm run check
npm run test:tone
```
