import assert from 'node:assert/strict';
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
