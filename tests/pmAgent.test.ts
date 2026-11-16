import assert from 'node:assert/strict';
import test from 'node:test';
import { formatPmAgentMarkdown, runPmAgent } from '../src/pm-agent';
import { createPmAgentTools } from '../src/pm-agent-tools';

const approved = {
  source: 'jira',
  id: '1943',
  key: 'WEB-12',
  projectKey: 'WEB',
  url: 'https://tracker.example/browse/WEB-12',
  title: 'Add a help link to the profile',
  context: 'Users cannot find the help page from the profile.',
  expectedResult: 'The profile toolbar shows a link to the help page.',
  acceptanceCriteria: ['The link opens the help page in the current tab.'],
  scope: 'Update the profile toolbar view and its existing tests.',
  verification: 'Open the profile toolbar and activate the help link.',
  repository: 'example/profile-web',
  deadline: '2026-11-20'
};
const current = { ...approved, deadline: '2026-11-24' };

function toolCall(name: string, args: object, callId: string) {
  return { status: 'completed', output: [{ type: 'function_call', name, call_id: callId, arguments: JSON.stringify(args) }] };
}

function finalResponse(taskRef: string, draftTasks: object[] = []) {
  return {
    status: 'completed',
    output: [{
      type: 'message',
      content: [{
        type: 'output_text',
        text: JSON.stringify({
          summary: 'Нужно сверить влияние обновлённого срока.',
          findings: [{ text: 'Срок изменился с 20 на 24 ноября.', taskRefs: [taskRef] }],
          nextActions: [{ text: 'PM подтверждает срок с заказчиком.', taskRefs: [taskRef] }],
          questions: [],
          draftMessage: 'Добрый день! Предлагаю подтвердить срок 24 ноября.',
          draftTasks
        })
      }]
    }]
  };
}

test('PM agent sends real read-only tool results back to the model and renders a cited brief', async () => {
  const context = createPmAgentTools([current], [approved]);
  const requests: Array<{
    tool_choice: string;
    store: boolean;
    text: { format: { strict: boolean } };
    input: Array<{ call_id?: string; output?: string }>;
  }> = [];
  const responses = [
    toolCall('review_changes', { query: 'WEB-12', offset: 0 }, 'call_change'),
    toolCall('inspect_task', { taskRef: 'T1' }, 'call_inspect'),
    finalResponse('T1')
  ];

  const result = await runPmAgent(context, 'Что изменилось? Напиши заказчику.', {
    apiKey: 'mock-api-key',
    notes: 'На встрече предложили проверить дату с QA.',
    fetcher: async (url, init) => {
      assert.equal(String(url), 'https://api.openai.com/v1/responses');
      assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer mock-api-key');
      requests.push(JSON.parse(String(init?.body)));
      return Response.json(responses[requests.length - 1]);
    }
  });

  assert.equal(requests.length, 3);
  assert.equal(requests[0].tool_choice, 'required');
  assert.equal(requests[0].store, false);
  assert.equal(requests[0].text.format.strict, true);
  assert.match(JSON.stringify(requests[0].input), /проверить дату с QA/);
  assert.doesNotMatch(JSON.stringify(requests[0].input), /profile toolbar/);
  const changeOutput = requests[1].input.at(-1);
  assert.ok(changeOutput?.output);
  assert.equal(changeOutput.call_id, 'call_change');
  assert.deepEqual(JSON.parse(changeOutput.output).items[0].changes, [
    { field: 'deadline', before: '2026-11-20', after: '2026-11-24' }
  ]);
  const inspection = requests[2].input.at(-1);
  assert.ok(inspection?.output);
  assert.equal(inspection.call_id, 'call_inspect');
  assert.equal(JSON.parse(inspection.output).handoffStatus, 'ready_for_agent');
  assert.deepEqual(result.trace.map(({ tool }) => tool), ['review_changes', 'inspect_task']);
  assert.equal(result.sources[0].taskId, 'WEB-12');
  const markdown = formatPmAgentMarkdown(result);
  assert.match(markdown, /https:\/\/tracker\.example\/browse\/WEB-12/);
  assert.match(markdown, /Черновик сообщения/);
});

test('PM agent rejects even a real task reference if the model did not retrieve that task', async () => {
  const context = createPmAgentTools([current], [approved]);
  const replies = [toolCall('list_tasks', { query: 'OTHER', scope: 'all', offset: 0 }, 'call_find'), finalResponse('T1')];

  await assert.rejects(runPmAgent(context, 'Что с карточкой OTHER?', {
    apiKey: 'mock-api-key',
    fetcher: async () => Response.json(replies.shift())
  }), /задачу, которой не было в результатах/);
});

test('PM agent disables tools on the last turn and stops if the model keeps calling them', async () => {
  let turns = 0;
  let lastChoice: string | undefined;
  await assert.rejects(runPmAgent(createPmAgentTools([current]), 'Разбери WEB-12.', {
    apiKey: 'mock-api-key',
    fetcher: async (_url, init) => {
      turns += 1;
      lastChoice = JSON.parse(String(init?.body)).tool_choice;
      return Response.json(toolCall('inspect_task', { taskRef: 'T1' }, `call-${turns}`));
    }
  }), /неподдерживаемый вызов инструмента/);
  assert.equal(turns, 6);
  assert.equal(lastChoice, 'none');
});

test('PM agent returns an explanation if the approved snapshot was not supplied', () => {
  const context = createPmAgentTools([current]);
  assert.deepEqual(context.call('review_changes', { query: '', offset: 0 }).refs, []);
  assert.match(JSON.stringify(context.call('review_changes', { query: '', offset: 0 }).data), /No approved snapshot/);
  assert.deepEqual(context.call('read_files', { query: '', offset: 0 }).refs, []);
});

test('PM agent keeps separate references for identical tracker IDs and for baseline-only tasks', () => {
  const second = { ...current, projectKey: 'MOBILE', url: 'https://tracker.example/browse/MOBILE-12' };
  const removed = { ...approved, id: '1946', key: 'WEB-20' };
  const context = createPmAgentTools([current, second], [approved, removed]);
  assert.deepEqual(context.call('list_tasks', { query: 'WEB-12', scope: 'all', offset: 0 }).refs, ['T1', 'T2']);
  const changes = context.call('review_changes', { query: '', offset: 0 });
  assert.deepEqual(changes.refs, ['T1', 'T2', 'B1']);
  assert.equal(context.sources.get('B1')?.taskId, 'WEB-20');
});

const note = 'Добавить проверку подсказки профиля на мобильном экране.';
const draftUpdate = {
  operation: 'update',
  targetRef: 'T1',
  title: 'Проверить попап справки на мобильном экране',
  context: 'Во время созвона команда попросила добавить проверку мобильного сценария.',
  expectedResult: 'Подсказка открывает справку на мобильном экране.',
  acceptanceCriteria: ['Ссылка открывается при ширине 390 px.'],
  sourceQuote: note
};

async function reviewDrafts(drafts: object[]) {
  const replies = [
    toolCall('list_tasks', { query: 'WEB-12', scope: 'all', offset: 0 }, 'lookup'),
    finalResponse('T1', drafts)
  ];

  return runPmAgent(createPmAgentTools([current]), 'Собери черновики из заметок.', {
    apiKey: 'mock-api-key',
    notes: `Итоги встречи.\n${note}`,
    prepareTaskDrafts: true,
    fetcher: async () => Response.json(replies.shift())
  });
}

test('PM agent attaches a verified meeting quote and the existing task to an update draft', async () => {
  const report = await reviewDrafts([
    draftUpdate,
    { ...draftUpdate, operation: 'create', targetRef: null, title: 'Подготовить примеры для проверки' }
  ]);
  assert.equal(report.draftTasks[0].target?.taskId, 'WEB-12');
  assert.equal(report.draftTasks[0].sourceQuote, note);
  assert.equal(report.draftTasks[1].target, null);
  assert.match(formatPmAgentMarkdown(report), /Черновики задач для проверки/);
});

test('PM agent rejects unsupported quotes and duplicate proposals', async () => {
  await assert.rejects(reviewDrafts([{ ...draftUpdate, sourceQuote: 'Срок согласовали с заказчиком.' }]), /не подтверждён цитатой/);
  await assert.rejects(reviewDrafts([{ ...draftUpdate, operation: 'create', targetRef: null, title: current.title }]), /дублирует/);
  await assert.rejects(reviewDrafts([draftUpdate, draftUpdate]), /отдельную текущую задачу/);
});
