import type {
  BadFormulationRuleConfig,
  StopPhraseRuleConfig
} from '../types';

export interface DictionarySignalPattern {
  label: string;
  pattern: RegExp;
}

export interface SmartVaguePhraseDefinition {
  phrase: string;
  mitigatedByConcreteResult?: boolean;
  mitigatedByTimeContext?: boolean;
}

export const DEFAULT_STOP_PHRASES: StopPhraseRuleConfig[] = [
  {
    phrase: 'сделать красиво',
    level: 'warning',
    code: 'vague_phrase',
    message: 'Фраза «сделать красиво» слишком субъективна. Лучше описать конкретные признаки результата.',
    languages: ['ru']
  },
  {
    phrase: 'сделать нормально',
    level: 'warning',
    code: 'vague_quality',
    message: 'Фраза «сделать нормально» слишком общая. Добавь конкретные критерии качества и приёмки.',
    languages: ['ru']
  },
  {
    phrase: 'сделать понятно',
    level: 'warning',
    code: 'vague_quality',
    message: 'Фраза «сделать понятно» субъективна. Опиши, какие тексты, состояния или подсказки должны появиться.',
    languages: ['ru']
  },
  {
    phrase: 'улучшить UX',
    level: 'warning',
    code: 'vague_ux',
    message: 'Фраза «улучшить UX» требует конкретики: какой сценарий улучшаем, как измеряем успех, что меняется на экране.',
    languages: ['ru']
  },
  {
    phrase: 'пофиксить',
    level: 'warning',
    code: 'vague_fix',
    message: 'Фраза «пофиксить» слишком общая. Опиши текущее поведение, ожидаемое поведение и критерии проверки.',
    languages: ['ru']
  },
  {
    phrase: 'починить',
    level: 'warning',
    code: 'weak_acceptance',
    message: 'Фраза «починить» без ожидаемого результата не задаёт критерии проверки.',
    languages: ['ru']
  },
  {
    phrase: 'доработать',
    level: 'warning',
    code: 'vague_change',
    message: 'Фраза «доработать» требует границ scope: что именно меняется и какой результат должен появиться.',
    languages: ['ru']
  },
  {
    phrase: 'разобраться',
    level: 'warning',
    code: 'investigation_without_outcome',
    message: 'Фраза «разобраться» не задаёт результат. Укажи, какой вывод, исправление или решение нужно получить.',
    languages: ['ru']
  },
  {
    phrase: 'как обсуждали',
    level: 'warning',
    code: 'hidden_context',
    message: 'Фраза «как обсуждали» прячет важный контекст. Добавь краткое резюме договорённостей прямо в задачу.',
    languages: ['ru']
  },
  {
    phrase: 'как договорились',
    level: 'warning',
    code: 'hidden_context',
    message: 'Фраза «как договорились» скрывает решение вне задачи. Зафиксируй договорённость письменно.',
    languages: ['ru']
  },
  {
    phrase: 'как в прошлый раз',
    level: 'warning',
    code: 'hidden_reference',
    message: 'Фраза «как в прошлый раз» может быть понята по-разному. Добавь ссылку или явно опиши нужное поведение.',
    languages: ['ru']
  },
  {
    phrase: 'как раньше',
    level: 'warning',
    code: 'hidden_reference',
    message: 'Фраза «как раньше» требует ссылки или явного описания старого поведения.',
    languages: ['ru']
  },
  {
    phrase: 'по аналогии',
    level: 'warning',
    code: 'hidden_reference',
    message: 'Фраза «по аналогии» скрывает критерии сравнения. Опиши, с чем именно сравниваем.',
    languages: ['ru']
  },
  {
    phrase: 'потом уточним',
    level: 'warning',
    code: 'deferred_context',
    message: 'Фраза «потом уточним» оставляет незакрытый вопрос. Укажи, что именно нужно уточнить и у кого.',
    languages: ['ru']
  },
  {
    phrase: 'потом разберемся',
    level: 'warning',
    code: 'deferred_context',
    message: 'Фраза «потом разберемся» переносит важные решения за пределы задачи. Добавь, что именно нужно решить до разработки.',
    languages: ['ru']
  },
  {
    phrase: 'как-нибудь',
    level: 'warning',
    code: 'undefined_solution',
    message: 'Фраза «как-нибудь» не задаёт проверяемый результат. Опиши ожидаемое поведение или ограничение.',
    languages: ['ru']
  },
  {
    phrase: 'что-нибудь',
    level: 'warning',
    code: 'undefined_solution',
    message: 'Фраза «что-нибудь» оставляет результат неопределённым. Замени её конкретным объектом и действием.',
    languages: ['ru']
  },
  {
    phrase: 'на усмотрение разработчика',
    level: 'warning',
    code: 'ownership_gap',
    message: 'Фраза «на усмотрение разработчика» перекладывает продуктовый выбор в реализацию. Зафиксируй ожидаемое поведение в задаче.',
    languages: ['ru']
  },
  {
    phrase: 'добавить везде',
    level: 'warning',
    code: 'unclear_scope',
    message: 'Фраза «добавить везде» размывает scope. Перечисли конкретные экраны, роли, API или состояния.',
    languages: ['ru']
  },
  {
    phrase: 'и так далее',
    level: 'warning',
    code: 'open_ended_scope',
    message: 'Фраза «и так далее» оставляет scope открытым. Замени её полным списком ожидаемых случаев.',
    languages: ['ru']
  },
  {
    phrase: 'очевидно',
    level: 'warning',
    code: 'implicit_requirement',
    message: 'Фраза «очевидно» часто скрывает требование. Запиши это требование явно.',
    languages: ['ru']
  },
  {
    phrase: 'просто',
    level: 'warning',
    code: 'oversimplified_requirement',
    message: 'Слово «просто» может маскировать сложность. Укажи точное изменение и ограничения.',
    languages: ['ru']
  },
  {
    phrase: 'срочно',
    level: 'warning',
    code: 'urgency_without_reason',
    message: 'Фраза «срочно» не объясняет приоритет. Лучше указать дедлайн, причину срочности и последствия задержки.',
    languages: ['ru']
  },
  {
    phrase: 'быстро',
    level: 'warning',
    code: 'unclear_deadline',
    message: 'Фраза «быстро» не задаёт срок. Укажи дедлайн, приоритет и причину.',
    languages: ['ru']
  },
  {
    phrase: 'make it nice',
    level: 'warning',
    code: 'vague_phrase',
    message: 'The phrase "make it nice" is subjective. Describe the exact visible or behavioral outcome instead.',
    languages: ['en']
  },
  {
    phrase: 'make it better',
    level: 'warning',
    code: 'vague_quality',
    message: '"Make it better" is too broad. Add concrete quality and acceptance criteria.',
    languages: ['en']
  },
  {
    phrase: 'improve UX',
    level: 'warning',
    code: 'vague_ux',
    message: '"Improve UX" needs a concrete scenario, success signal, and screen-level change.',
    languages: ['en']
  },
  {
    phrase: 'fix it',
    level: 'warning',
    code: 'vague_fix',
    message: 'The phrase "fix it" is too broad. Describe the current behavior, expected behavior, and verification criteria.',
    languages: ['en']
  },
  {
    phrase: 'as discussed',
    level: 'warning',
    code: 'hidden_context',
    message: 'The phrase "as discussed" hides important context. Add a short summary of the decision to the task.',
    languages: ['en']
  },
  {
    phrase: 'same as last time',
    level: 'warning',
    code: 'hidden_reference',
    message: 'The phrase "same as last time" can be interpreted differently. Add a link or describe the behavior explicitly.',
    languages: ['en']
  },
  {
    phrase: 'as before',
    level: 'warning',
    code: 'hidden_reference',
    message: '"As before" needs a link or an explicit description of the previous behavior.',
    languages: ['en']
  },
  {
    phrase: 'TBD',
    level: 'warning',
    code: 'tbd_requirement',
    message: 'TBD in a task means the requirement is not ready yet. Clarify it before implementation.',
    languages: ['en']
  },
  {
    phrase: 'to be decided',
    level: 'warning',
    code: 'tbd_requirement',
    message: '"To be decided" means the requirement is not ready yet. Decide it before handing the task to implementation.',
    languages: ['en']
  },
  {
    phrase: 'figure it out later',
    level: 'warning',
    code: 'deferred_context',
    message: '"Figure it out later" moves an important decision out of the task. Add the open question and the decision owner.',
    languages: ['en']
  },
  {
    phrase: 'somehow',
    level: 'warning',
    code: 'undefined_solution',
    message: '"Somehow" is not testable. Describe the expected behavior or constraint.',
    languages: ['en']
  },
  {
    phrase: 'up to the developer',
    level: 'warning',
    code: 'ownership_gap',
    message: '"Up to the developer" moves product choice into implementation. Capture the expected behavior in the task.',
    languages: ['en']
  },
  {
    phrase: 'everywhere',
    level: 'warning',
    code: 'unclear_scope',
    message: '"Everywhere" makes scope unclear. List exact screens, roles, APIs, or states.',
    languages: ['en']
  },
  {
    phrase: 'etc',
    level: 'warning',
    code: 'open_ended_scope',
    message: '"Etc" leaves scope open-ended. Replace it with the full expected list.',
    languages: ['en']
  },
  {
    phrase: 'obviously',
    level: 'warning',
    code: 'implicit_requirement',
    message: '"Obviously" often hides a requirement. Write the requirement explicitly.',
    languages: ['en']
  },
  {
    phrase: 'just',
    level: 'warning',
    code: 'oversimplified_requirement',
    message: '"Just" can hide complexity. State the exact change and constraints.',
    languages: ['en']
  },
  {
    phrase: 'urgent',
    level: 'warning',
    code: 'urgency_without_reason',
    message: 'The word "urgent" does not explain priority. Add a deadline, reason, and impact of delay.',
    languages: ['en']
  },
  {
    phrase: 'asap',
    level: 'warning',
    code: 'unclear_deadline',
    message: '"ASAP" does not define a deadline. Add the target date, priority, and reason.',
    languages: ['en']
  }
];

export const DEFAULT_BAD_FORMULATIONS: BadFormulationRuleConfig[] = [
  {
    phrase: 'как раньше',
    category: 'unclear_reference',
    message: 'Фраза «как раньше» требует ссылки или явного описания старого поведения.',
    recommendation: 'Добавь ссылку на пример или перечисли ожидаемые состояния.',
    languages: ['ru']
  },
  {
    phrase: 'по аналогии',
    category: 'unclear_reference',
    message: 'Фраза «по аналогии» скрывает критерии сравнения.',
    recommendation: 'Опиши, с чем именно сравниваем и какие отличия допустимы.',
    languages: ['ru']
  },
  {
    phrase: 'починить',
    category: 'weak_acceptance',
    message: 'Фраза «починить» без ожидаемого результата не задаёт критерии проверки.',
    recommendation: 'Добавь фактический результат, ожидаемый результат и acceptance criteria.',
    languages: ['ru'],
    workItemTypes: ['bug']
  },
  {
    phrase: 'улучшить',
    category: 'vague',
    message: 'Фраза «улучшить» должна быть привязана к сценарию и метрике успеха.',
    recommendation: 'Опиши, какой сценарий улучшается и как команда поймёт, что стало лучше.',
    languages: ['ru']
  },
  {
    phrase: 'оптимизировать',
    category: 'vague',
    message: 'Фраза «оптимизировать» требует метрики: что именно ускоряется, уменьшается или становится стабильнее.',
    recommendation: 'Добавь метрику до/после, порог или наблюдаемое поведение.',
    languages: ['ru']
  },
  {
    phrase: 'сделать удобно',
    category: 'vague',
    message: 'Фраза «сделать удобно» субъективна без сценария и критериев проверки.',
    recommendation: 'Опиши пользовательский сценарий и критерий, по которому понятна успешность изменения.',
    languages: ['ru']
  },
  {
    phrase: 'as before',
    category: 'unclear_reference',
    message: '"As before" needs a link or an explicit description of the previous behavior.',
    recommendation: 'Add a reference example and list the expected states.',
    languages: ['en']
  },
  {
    phrase: 'improve',
    category: 'vague',
    message: '"Improve" needs a scenario and success signal.',
    recommendation: 'Describe which workflow changes and how the team will verify improvement.',
    languages: ['en']
  },
  {
    phrase: 'optimize',
    category: 'vague',
    message: '"Optimize" needs a measurable target or observable behavior.',
    recommendation: 'Add before/after metric, threshold, or verification condition.',
    languages: ['en']
  }
];

export const TONE_DICTIONARY = {
  vagueWordingPhrases: [
    'сделать красиво',
    'сделать нормально',
    'сделать понятно',
    'сделать удобно',
    'поправить как надо',
    'доработать по мелочи',
    'починить всё',
    'привести в порядок',
    'навести порядок',
    'разобраться с проблемой',
    'сделать как обсуждали',
    'внести правки',
    'подумать над решением',
    'сделать более современно',
    'улучшить UX',
    'чтобы работало',
    'make it nice',
    'make it better',
    'improve UX',
    'clean it up'
  ],
  blamingTonePhrases: [
    'опять всё сломалось',
    'почему это до сих пор не работает',
    'вы опять не проверили',
    'кто это вообще делал',
    'надо было сразу нормально сделать',
    'сколько можно чинить одно и то же',
    'это очевидный баг',
    'это же элементарно',
    'почему не предусмотрели',
    'как можно было это пропустить'
  ],
  urgencyWithoutReasonPhrases: [
    'срочно',
    'очень срочно',
    'надо было вчера',
    'asap',
    'горит',
    'сделать сегодня',
    'максимально быстро',
    'нужно прямо сейчас',
    'без этого всё стоит',
    'критично'
  ],
  passiveAggressivePhrases: [
    'было бы неплохо наконец-то это исправить',
    'давайте уже сделаем нормально',
    'кажется, это всё-таки нужно было проверить',
    'наверное, стоит прочитать задачу внимательнее',
    'может, в этот раз получится',
    'я думала, это очевидно',
    'видимо, опять не договорились',
    'ну раз уж так получилось',
    'надеюсь, теперь будет работать',
    'давайте без сюрпризов на этот раз'
  ],
  tooInformalPhrases: [
    'там что-то отвалилось',
    'какая-то фигня',
    'юзер тыкает и ничего',
    'всё едет',
    'кнопка странная',
    'экран кривой',
    'логика мутная',
    'флоу сломался',
    'там багуля',
    'что-то не то'
  ]
} as const;

export const TASK_SIGNAL_KEYWORDS = {
  weakActionSignals: [
    'проверить',
    'посмотреть',
    'разобраться',
    'поправить',
    'обновить',
    'переделать',
    'настроить'
  ],
  weakContextPhrases: [
    'нужно добавить поле',
    'нужно поменять кнопку',
    'нужно убрать блок',
    'нужно переделать форму',
    'нужно поменять текст',
    'нужно добавить проверку',
    'нужно скрыть ошибку',
    'нужно изменить статус'
  ],
  expectedResultMarkers: [
    'должен',
    'должна',
    'должно',
    'ожидаемый результат',
    'критерии приемки',
    'критерии приёмки',
    'после',
    'в результате',
    'готово, если',
    'успешно',
    'пользователь видит',
    'статус меняется',
    'expected result',
    'acceptance criteria',
    'done when',
    'success',
    'user sees'
  ],
  contextMarkers: [
    'потому что',
    'чтобы',
    'так как',
    'из-за',
    'пользователь',
    'клиент',
    'поддержка',
    'бизнес',
    'конверсия',
    'оплата',
    'возврат',
    'ошибка влияет',
    'блокирует',
    'because',
    'so that',
    'user',
    'customer',
    'support',
    'business',
    'conversion',
    'blocks'
  ],
  urgencyReasonMarkers: [
    'потому что',
    'так как',
    'из-за',
    'дедлайн',
    'релиз',
    'production',
    'prod',
    'блокирует',
    'ошибка влияет',
    'влияет на',
    'не могут завершить',
    'не может завершить',
    'because',
    'deadline',
    'release',
    'blocks',
    'incident'
  ],
  vaguePhrases: [
    'сделать красиво',
    'сделать нормально',
    'сделать понятно',
    'как обсуждали',
    'как договорились',
    'починить',
    'пофиксить',
    'улучшить',
    'оптимизировать',
    'доработать',
    'быстро поправить',
    'примерно',
    'на всякий случай',
    'что-то не работает',
    'TBD',
    'make it better',
    'fix it',
    'as discussed'
  ],
  riskyDomainKeywords: [
    'payment',
    'refund',
    'billing',
    'оплата',
    'платёж',
    'платеж',
    'возврат',
    'деньги',
    'карта',
    'авторизация',
    'регистрация',
    'персональные данные',
    'доступы',
    'безопасность',
    'security',
    'интеграция',
    'миграция',
    'production',
    'prod',
    'релиз',
    'release'
  ],
  externalDependencyKeywords: [
    'blocked by',
    'blocked on',
    'blocked until',
    'блокер',
    'зависимость',
    'ждём',
    'ждем',
    'ожидаем',
    'нет ответа',
    'external',
    'third-party',
    'api партнёра',
    'api партнера',
    'интеграция с внешней системой',
    'security approval',
    'legal review'
  ],
  largeScopeKeywords: [
    'много сценариев',
    'несколько сценариев',
    'несколько сервисов',
    'весь флоу',
    'полностью переделать',
    'рефакторинг',
    'миграция',
    'затрагивает несколько команд',
    'слишком широкая задача',
    'декомпозировать',
    'end-to-end',
    'e2e',
    'entire flow',
    'multiple services'
  ],
  testingKeywords: [
    'tested',
    'qa passed',
    'проверено',
    'протестировано',
    'тестирование пройдено',
    'passed qa',
    'qa ok',
    'test cases passed',
    'регрессия пройдена'
  ],
  blockerKeywords: [
    'blocked by',
    'blocked on',
    'blocked until',
    'blocked:',
    'task is blocked',
    'work is blocked',
    'release is blocked',
    'блокер',
    'не можем завершить',
    'ждём',
    'ждем',
    'нет ответа',
    'зависимость'
  ],
  evidenceKeywords: [
    'figma',
    'макет',
    'скриншот',
    'screenshot',
    'пример',
    'example',
    'лог',
    'logs',
    'payload',
    'dataset',
    'test data',
    'тестовые данные',
    'исходные данные',
    'input data',
    'source data',
    'staging',
    'дашборд',
    'dashboard',
    'support ticket',
    'analytics event'
  ],
  edgeCaseKeywords: [
    'edge case',
    'edge cases',
    'corner case',
    'boundary',
    'гранич',
    'погранич',
    'негатив',
    'negative scenario',
    'error case',
    'при ошибке',
    'ошибка банка',
    'таймаут',
    'timeout',
    'empty',
    'пуст',
    'null',
    'fallback',
    'retry',
    'повтор',
    'роль',
    'roles',
    'права',
    'permissions'
  ],
  testableOutcomeKeywords: [
    'показывается',
    'отображается',
    'видит',
    'получает',
    'переходит',
    'сохраняет',
    'отправляется',
    'возвращает',
    'статус',
    'код',
    'событие',
    'логируется',
    'visible',
    'shown',
    'returns',
    'receives',
    'status',
    'event',
    'saved',
    'logged',
    'redirects',
    'opens'
  ]
} as const;

export const SMART_VAGUE_PHRASE_DEFINITIONS: SmartVaguePhraseDefinition[] = [
  { phrase: 'сделать красиво' },
  { phrase: 'сделать нормально' },
  { phrase: 'сделать понятно', mitigatedByConcreteResult: true },
  { phrase: 'пофиксить' },
  { phrase: 'починить' },
  { phrase: 'улучшить', mitigatedByConcreteResult: true },
  { phrase: 'ускорить', mitigatedByConcreteResult: true },
  { phrase: 'оптимизировать', mitigatedByConcreteResult: true },
  { phrase: 'доработать', mitigatedByConcreteResult: true },
  { phrase: 'разобраться' },
  { phrase: 'как-нибудь' },
  { phrase: 'нормально' },
  { phrase: 'как обсуждали' },
  { phrase: 'как договорились' },
  { phrase: 'как в прошлый раз' },
  { phrase: 'как раньше' },
  { phrase: 'по аналогии' },
  { phrase: 'срочно', mitigatedByTimeContext: true },
  { phrase: 'что-нибудь' },
  { phrase: 'навести порядок' },
  { phrase: 'чтобы работало' },
  { phrase: 'плохо работает' },
  { phrase: 'неудобно' },
  { phrase: 'сломалось' },
  { phrase: 'make it nice' },
  { phrase: 'make it better' },
  { phrase: 'fix it' },
  { phrase: 'improve', mitigatedByConcreteResult: true },
  { phrase: 'optimize', mitigatedByConcreteResult: true },
  { phrase: 'speed up', mitigatedByConcreteResult: true },
  { phrase: 'investigate' },
  { phrase: 'something' },
  { phrase: 'same as last time' },
  { phrase: 'as before' }
];

export const TASK_POSITIVE_SIGNAL_PATTERNS: {
  objects: DictionarySignalPattern[];
  actions: DictionarySignalPattern[];
  expectedResults: DictionarySignalPattern[];
  acceptanceCriteria: DictionarySignalPattern[];
  metrics: DictionarySignalPattern[];
  verifiableConditions: DictionarySignalPattern[];
  examples: DictionarySignalPattern[];
  constraints: DictionarySignalPattern[];
  resources: DictionarySignalPattern[];
  relevanceContext: DictionarySignalPattern[];
  userOrTeamValue: DictionarySignalPattern[];
  projectGoal: DictionarySignalPattern[];
  priorityReason: DictionarySignalPattern[];
  deadlines: DictionarySignalPattern[];
  sprintsOrReleases: DictionarySignalPattern[];
  timeframes: DictionarySignalPattern[];
} = {
  objects: [
    { label: 'указан интерфейсный или продуктовый объект', pattern: /(экран|страниц[ауы]?|форма|кнопк[аиу]?|поле|фильтр|профил[ья]|каталог|checkout|profile|screen|page|form|button|field|filter)/iu },
    { label: 'указан технический объект изменения', pattern: /(endpoint|api|событи[ея]|event|дашборд|dashboard|template|шаблон|лог|audit log|метрик[аи]?|analytics|аналитик[аи]?)/iu },
    { label: 'указан объект ошибки или поведения', pattern: /(ошибк[аиу]?|сообщени[ея]|плат[её]ж|payment|promocode|промокод|банк|bank|email|релиз|release)/iu }
  ],
  actions: [
    { label: 'есть конкретное действие', pattern: /(?<![\p{L}\p{N}_])(добавить|исправить|показать|обновить|настроить|удалить|отправить|сохранить|логировать|проверить|закрыть|снизить|покрыть|add|fix|show|update|configure|remove|send|save|log|verify|reduce|cover)(?![\p{L}\p{N}_])/iu }
  ],
  expectedResults: [
    { label: 'описан ожидаемый результат или состояние', pattern: /(ожидаемый результат|expected result|появляет[сц]я|становит[сц]я|пользователь видит|user sees|видит|доступ[её]н|available|order status|статус|success|успех|результат)/iu },
    { label: 'описано поведение после изменения', pattern: /(?<![\p{L}\p{N}_])(после|когда|при|when|after|then|если|чтобы)(?![\p{L}\p{N}_]).{0,120}(показы|видит|отправ|сохраня|доступ|понятн|сообщени|ошибк|shows|sends|saves|available|clear|message|error)/iu }
  ],
  acceptanceCriteria: [
    { label: 'есть acceptance criteria', pattern: /(критерии при[её]мки|acceptance criteria|готово,\s*если|done when|definition of done|успех:|success:|given.+when.+then)/iu }
  ],
  metrics: [
    { label: 'есть числовая метрика', pattern: /\d+(?:[.,]\d+)?\s?(?:%|ms|мс|sec|сек|секунд[аы]?|seconds?|мин|minutes?|час|hours?|дн|days?|балл(?:ов)?|score|px|пиксел)/iu },
    { label: 'есть продуктовая или техническая метрика', pattern: /(p95|p99|sla|lighthouse|fcp|first contentful paint|conversion|конверси[яи]|обращени[йя]|tickets?|support|поддержк[аи])/iu },
    { label: 'есть измеримое изменение', pattern: /(снизить|увеличить|уменьшить|не ниже|не выше|до|ниже|выше|reduce|increase|decrease|at least|at most).{0,80}\d+(?:[.,]\d+)?/iu }
  ],
  verifiableConditions: [
    { label: 'есть проверяемое условие готовности', pattern: /(готово,\s*если|проверить|проверено|qa|тест|test|test case|тест-кейс|должен|должна|должно|must|should|успех|success)/iu },
    { label: 'есть наблюдаемое поведение', pattern: /(пользователь видит|видит причину|показывается|открывается|отправляется|логируется|сохраняется|user sees|is visible|is sent|is saved|is logged)/iu }
  ],
  examples: [
    { label: 'есть пример поведения или сценария', pattern: /(например|пример|example|e\.g\.|given|when|then|при отклонении|при ошибке|bank decline|timeout|provider error|bank_unavailable|payment_failed)/iu }
  ],
  constraints: [
    { label: 'указаны ограничения или условия выполнения', pattern: /(только|без|не включает|не должно|не отображается|не созда[её]т|ограничени[ея]|constraint|only|without|does not|must not|no personal data|fallback)/iu },
    { label: 'указано условие срабатывания изменения', pattern: /(?<![\p{L}\p{N}_])(при|если|когда|when|if)(?![\p{L}\p{N}_]).{0,100}(ошибк|отклон|банк|timeout|error|decline|unavailable|плат[её]ж)/iu }
  ],
  resources: [
    { label: 'указаны данные, ресурс или среда проверки', pattern: /(данн[ыа]е|dataset|staging|лог[и]?|analytics|аналитик[аи]?|dashboard|дашборд|support|поддержк[аи]|api|endpoint|provider|провайдер|тест-кейс|test case|экран|страниц[ауы]?|screen|page)/iu },
    { label: 'указана зависимость или доступный источник', pattern: /(зависимост[ьи]|depends on|blocked by|жд[её]м|доступ|resource|input|mock|fixture)/iu }
  ],
  relevanceContext: [
    { label: 'описана проблема или бизнес-контекст', pattern: /(контекст|context|проблем[ауы]?|почему|зачем|because|cannot|не понимает|не может|не прош[её]л|медленн|загрузк[аи]|slow|loading|blocks|блокирует|support|поддержк[аи]|обращени[йя]|жалоб[аы]?)/iu }
  ],
  userOrTeamValue: [
    { label: 'указана пользовательская или командная ценность', pattern: /(пользовател[ьяюеи]|клиент[ауеы]?|покупател[ьяюеи]|команда|pm|qa|аналитик|поддержк[аи]|мобильн|user|client|customer|buyer|team|support|stakeholder|mobile)/iu }
  ],
  projectGoal: [
    { label: 'есть связь с целью проекта, продукта или процесса', pattern: /(цель|goal|objective|проект|project|спринт|sprint|релиз|release|roadmap|checkout|payment|profile|каталог|процесс|плат[её]ж|загрузк[аи]|performance|производительност)/iu }
  ],
  priorityReason: [
    { label: 'объяснён приоритет или причина срочности', pattern: /(сейчас|до релиза|перед релизом|текущего спринта|потому что|because|blocks|блокирует|рост|снизить|уменьшить|reduce|increase|priority|приоритет)/iu }
  ],
  deadlines: [
    { label: 'указан дедлайн или due date', pattern: /(deadline|due date|due|дедлайн|срок|до \d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?|до \d{4}-\d{2}-\d{2}|\d{4}-\d{2}-\d{2})/iu }
  ],
  sprintsOrReleases: [
    { label: 'указан спринт, релиз или период', pattern: /(sprint|спринт|release|релиз|iteration|итераци[яи]|period|период|квартал|quarter)/iu }
  ],
  timeframes: [
    { label: 'указана временная рамка в тексте', pattern: /(до конца|к началу|перед релизом|в течение|за \d+\s?(?:дн|day|час|hour)|на этой неделе|this week|current sprint|текущего спринта)/iu }
  ]
};
