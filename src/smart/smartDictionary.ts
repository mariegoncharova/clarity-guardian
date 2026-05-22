import type {
  SmartCriterionKey,
  SmartSignalPattern,
  SmartVaguePhrase
} from './smartTypes';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function phrasePattern(phrase: string): RegExp {
  const pattern = escapeRegExp(phrase).replace(/\s+/g, '\\s+');

  return new RegExp(`(?<![\\p{L}\\p{N}_])${pattern}(?![\\p{L}\\p{N}_])`, 'iu');
}

export const SMART_CRITERION_TITLES: Record<SmartCriterionKey, string> = {
  specific: 'S - Конкретность',
  measurable: 'M - Измеримость',
  achievable: 'A - Достижимость',
  relevant: 'R - Актуальность',
  timeBound: 'T - Ограниченность во времени'
};

export const SMART_BAD_SIGNALS: {
  vaguePhrases: SmartVaguePhrase[];
  broadScope: SmartSignalPattern[];
} = {
  vaguePhrases: [
    { phrase: 'сделать красиво', pattern: phrasePattern('сделать красиво') },
    { phrase: 'пофиксить', pattern: phrasePattern('пофиксить') },
    { phrase: 'улучшить', pattern: phrasePattern('улучшить'), mitigatedByConcreteResult: true },
    { phrase: 'ускорить', pattern: phrasePattern('ускорить'), mitigatedByConcreteResult: true },
    { phrase: 'оптимизировать', pattern: phrasePattern('оптимизировать'), mitigatedByConcreteResult: true },
    { phrase: 'доработать', pattern: phrasePattern('доработать'), mitigatedByConcreteResult: true },
    { phrase: 'разобраться', pattern: phrasePattern('разобраться') },
    { phrase: 'как-нибудь', pattern: phrasePattern('как-нибудь') },
    { phrase: 'нормально', pattern: phrasePattern('нормально') },
    { phrase: 'как в прошлый раз', pattern: phrasePattern('как в прошлый раз') },
    { phrase: 'срочно', pattern: phrasePattern('срочно'), mitigatedByTimeContext: true },
    { phrase: 'что-нибудь', pattern: phrasePattern('что-нибудь') },
    { phrase: 'навести порядок', pattern: phrasePattern('навести порядок') },
    { phrase: 'чтобы работало', pattern: phrasePattern('чтобы работало') },
    { phrase: 'плохо работает', pattern: phrasePattern('плохо работает') },
    { phrase: 'неудобно', pattern: phrasePattern('неудобно') },
    { phrase: 'сломалось', pattern: phrasePattern('сломалось') },
    { phrase: 'make it nice', pattern: phrasePattern('make it nice') },
    { phrase: 'fix it', pattern: phrasePattern('fix it') },
    { phrase: 'improve', pattern: phrasePattern('improve'), mitigatedByConcreteResult: true },
    { phrase: 'optimize', pattern: phrasePattern('optimize'), mitigatedByConcreteResult: true },
    { phrase: 'speed up', pattern: phrasePattern('speed up'), mitigatedByConcreteResult: true },
    { phrase: 'investigate', pattern: phrasePattern('investigate') },
    { phrase: 'something', pattern: phrasePattern('something') },
    { phrase: 'same as last time', pattern: phrasePattern('same as last time') }
  ],
  broadScope: [
    { label: 'слишком широкий scope: вся система или весь продукт', pattern: /\b(весь продукт|вся система|everything|whole product|entire system)\b/iu },
    { label: 'слишком широкий scope: везде или всё сразу', pattern: /(?<![\p{L}\p{N}_])(везде|всё|все сценарии|любой сценарий|all scenarios|everywhere)(?![\p{L}\p{N}_])/iu },
    { label: 'слишком широкий scope: переделать без границ', pattern: /(?<![\p{L}\p{N}_])(переделать|переписать|рефакторить|refactor|rewrite)(?![\p{L}\p{N}_])/iu }
  ]
};

export const SMART_GOOD_SIGNALS: {
  objects: SmartSignalPattern[];
  actions: SmartSignalPattern[];
  expectedResults: SmartSignalPattern[];
  acceptanceCriteria: SmartSignalPattern[];
  metrics: SmartSignalPattern[];
  verifiableConditions: SmartSignalPattern[];
  examples: SmartSignalPattern[];
  constraints: SmartSignalPattern[];
  resources: SmartSignalPattern[];
  relevanceContext: SmartSignalPattern[];
  userOrTeamValue: SmartSignalPattern[];
  projectGoal: SmartSignalPattern[];
  priorityReason: SmartSignalPattern[];
  deadlines: SmartSignalPattern[];
  sprintsOrReleases: SmartSignalPattern[];
  timeframes: SmartSignalPattern[];
} = {
  objects: [
    { label: 'указан интерфейсный или продуктовый объект', pattern: /(экран|страниц[ауы]?|форма|кнопк[аиу]?|поле|фильтр|профил[ья]|каталог|checkout|profile|screen|page|form|button|field|filter)/iu },
    { label: 'указан технический объект изменения', pattern: /(endpoint|api|событи[ея]|event|дашборд|dashboard|template|шаблон|лог|audit log|метрик[аи]?|analytics|аналитик[аи]?)/iu },
    { label: 'указан объект ошибки или поведения', pattern: /(ошибк[аиу]?|сообщени[ея]|плат[её]ж|payment|promocode|промокод|банк|bank|email|релиз|release)/iu }
  ],
  actions: [
    { label: 'есть конкретное действие', pattern: /(?<![\p{L}\p{N}_])(добавить|исправить|показать|обновить|настроить|удалить|отправить|сохранить|логировать|проверить|закрыть|снизить|покрыть|оптимизировать|ускорить|улучшить|доработать|add|fix|show|update|configure|remove|send|save|log|verify|reduce|cover|optimize|improve|speed up)(?![\p{L}\p{N}_])/iu }
  ],
  expectedResults: [
    { label: 'описан ожидаемый результат или состояние', pattern: /(ожидаемый результат|expected result|появляет[сц]я|становит[сц]я|пользователь видит|user sees|видит|доступ[её]н|available|order status|статус|success|успех|результат)/iu },
    { label: 'описано поведение после изменения', pattern: /(?<![\p{L}\p{N}_])(после|когда|при|when|after|then|если|чтобы)(?![\p{L}\p{N}_]).{0,120}(показы|видит|отправ|сохраня|доступ|понятн|сообщени|ошибк|shows|sends|saves|available|clear|message|error)/iu }
  ],
  acceptanceCriteria: [
    { label: 'есть acceptance criteria', pattern: /(критерии при[её]мки|acceptance criteria|готово,\s*если|done when|definition of done|успех:|success:)/iu }
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
