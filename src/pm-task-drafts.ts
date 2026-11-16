import { isTaskRow } from './task-model';
import { makeCliError, normalizeText } from './utils';
import type { AgentSource } from './pm-agent-tools';

export interface PmTaskDraft {
  operation: 'create' | 'update';
  target: AgentSource | null;
  title: string;
  context: string;
  expectedResult: string;
  acceptanceCriteria: string[];
  sourceQuote: string;
}

export const TASK_DRAFT_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['create', 'update'] },
      targetRef: { type: ['string', 'null'] },
      title: { type: 'string' },
      context: { type: 'string' },
      expectedResult: { type: 'string' },
      acceptanceCriteria: { type: 'array', items: { type: 'string' } },
      sourceQuote: { type: 'string' }
    },
    required: ['operation', 'targetRef', 'title', 'context', 'expectedResult', 'acceptanceCriteria', 'sourceQuote'],
    additionalProperties: false
  }
};

function compact(text: string): string {
  return normalizeText(text).replace(/\s+/g, ' ');
}

function requiredText(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw makeCliError(`В черновике задачи отсутствует поле «${label}».`);
  }

  return value.trim();
}

export function validateTaskDrafts(
  drafts: unknown,
  notes: string | undefined,
  sources: Map<string, AgentSource>,
  retrieved: Set<string>
): PmTaskDraft[] {
  if (!Array.isArray(drafts) || drafts.length > 8) {
    throw makeCliError('Модель должна вернуть список из 0–8 черновиков. Для большой встречи уточни, какие темы разобрать.');
  }

  const meetingText = compact(notes || '');
  const currentTitles = new Set([...sources.values()]
    .filter(({ ref }) => ref.startsWith('T'))
    .map(({ title }) => compact(title).toLowerCase()));
  const updated = new Set<string>();

  return drafts.map((draft) => {
    if (!isTaskRow(draft) || (draft.operation !== 'create' && draft.operation !== 'update')) {
      throw makeCliError('У черновика должен быть тип «новая задача» или «обновление».');
    }

    const title = requiredText(draft.title, 'Название');
    const sourceQuote = requiredText(draft.sourceQuote, 'Цитата из заметок');
    const quote = compact(sourceQuote);

    if (quote.length < 12 || !meetingText.includes(quote)) {
      throw makeCliError(`Черновик «${title}» не подтверждён цитатой из заметок встречи.`);
    }

    let target: AgentSource | null = null;

    if (draft.operation === 'update') {
      const ref = draft.targetRef;
      const source = typeof ref === 'string' && ref.startsWith('T') && retrieved.has(ref)
        ? sources.get(ref)
        : undefined;

      if (!source || updated.has(source.ref)) {
        throw makeCliError(`Черновик «${title}» должен ссылаться на отдельную текущую задачу из результатов поиска.`);
      }

      updated.add(source.ref);
      target = source;
    } else {
      const key = compact(title).toLowerCase();

      if (draft.targetRef !== null || currentTitles.has(key)) {
        throw makeCliError(`Черновик «${title}» дублирует существующую задачу или другой черновик.`);
      }

      currentTitles.add(key);
    }

    if (!Array.isArray(draft.acceptanceCriteria) || draft.acceptanceCriteria.length === 0) {
      throw makeCliError(`В черновике «${title}» нужны критерии приёмки.`);
    }

    return {
      operation: draft.operation,
      target,
      title,
      context: requiredText(draft.context, 'Контекст'),
      expectedResult: requiredText(draft.expectedResult, 'Ожидаемый результат'),
      acceptanceCriteria: [...new Set(draft.acceptanceCriteria.map((item) => requiredText(item, 'Критерий приёмки')))],
      sourceQuote
    };
  });
}
