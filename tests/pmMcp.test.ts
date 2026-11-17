import assert from 'node:assert/strict';
import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

test('MCP exposes read-only PM tools and serves the approved change over stdio', { timeout: 15_000 }, async (t) => {
  const client = new Client({ name: 'clarity-guardian-test', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    cwd: tmpdir(),
    args: [
      path.resolve(__dirname, '../src/pm-mcp.js'),
      '--input', path.resolve('data/demo-tasks.json'),
      '--baseline', path.resolve('data/demo-scope-baseline.json')
    ]
  });
  t.after(async () => {
    await client.close();
    await transport.close();
  });

  await client.connect(transport);
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map(({ name }) => name).sort(), ['inspect_task', 'list_tasks', 'review_changes', 'review_handoff']);
  assert.ok(tools.every(({ annotations }) => annotations?.readOnlyHint && annotations.destructiveHint === false));

  const result = await client.callTool({
    name: 'review_changes', arguments: { query: 'CG-203', offset: 0 }
  });
  const content = JSON.stringify(result.structuredContent);
  assert.match(content, /CG-203/);
  assert.match(content, /2026-04-13/);
  assert.match(content, /2026-04-15/);

  const invalid = await client.callTool({
    name: 'inspect_task', arguments: { taskRef: 'T999' }
  });
  assert.equal(invalid.isError, true);
  assert.match(JSON.stringify(invalid.content), /Unknown current task reference/);
});

test('A standalone MCP client prepares and saves a meeting via the workspace mode', { timeout: 15_000 }, async (t) => {
  const client = new Client({ name: 'local-workspace-client', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    cwd: tmpdir(),
    args: [path.resolve(__dirname, '../src/pm-mcp.js'), '--workspace']
  });
  t.after(() => client.close());
  await client.connect(transport);

  const prepared = await client.callTool({
    name: 'prepare_meeting', arguments: { dataset: 'demo', queries: ['CG-203', 'help article'] }
  });
  assert.equal(prepared.isError, false);
  assert.match(JSON.stringify(prepared.structuredContent), /Check the hint at a mobile viewport/);
  const batch = prepared.structuredContent;
  assert.ok(batch && typeof batch === 'object' && 'snapshotId' in batch && typeof batch.snapshotId === 'string');

  const sourceQuote = 'Подготовить статью справки о смене email со ссылкой на настройки профиля.';
  const notes = readFileSync('data/demo-meeting-notes.txt', 'utf8');
  const stored = await client.callTool({
    name: 'save_drafts',
    arguments: {
      dataset: 'demo', snapshotId: batch.snapshotId, notes,
      drafts: [{
        operation: 'create', targetRef: null, title: 'Статья о смене email',
        context: 'Пользователю нужна инструкция.', expectedResult: 'Статья опубликована в справке.',
        acceptanceCriteria: ['Из статьи можно перейти в настройки профиля.'], sourceQuote
      }]
    }
  });
  assert.equal(stored.isError, false);
  const artifact = stored.structuredContent;
  assert.ok(artifact && typeof artifact === 'object' && 'path' in artifact && typeof artifact.path === 'string');
  const output = artifact.path;
  assert.match(output, /^reports[/\\]codex[/\\]meeting-[a-zA-Z0-9]+[/\\]backlog-drafts\.json$/);
  t.after(() => rmSync(path.dirname(output), { recursive: true, force: true }));
  const queue = JSON.parse(readFileSync(output, 'utf8'));
  assert.equal(queue.status, 'review_required');
  assert.equal(queue.drafts[0].sourceQuote, sourceQuote);
});
