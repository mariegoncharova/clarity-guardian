import assert from 'node:assert/strict';
import test from 'node:test';
import { readGitLabTasks, readLinearTasks } from '../src/backlog-import';
import { normalizeUnifiedTasks } from '../src/task-model';

test('Linear import follows the cursor and preserves tracker keys and completed state', async () => {
  const cursors: Array<string | undefined> = [];
  const tasks = await readLinearTasks('ENG', 'test-linear-key', async (url, options) => {
    assert.equal(String(url), 'https://api.linear.app/graphql');
    assert.equal(new Headers(options?.headers).get('Authorization'), 'test-linear-key');
    assert.equal(options?.redirect, 'error');
    const { query, variables } = JSON.parse(String(options?.body));
    assert.match(query, /^\s*query Backlog/);
    assert.equal(variables.team, 'ENG');
    cursors.push(variables.after);
    const done = Boolean(variables.after);
    return Response.json({ data: { team: { key: 'ENG', issues: {
      nodes: [{
        id: done ? 'closed-id' : 'open-id', identifier: done ? 'ENG-2' : 'ENG-1', title: 'Improve profile',
        description: 'User can view their settings.', assignee: { name: 'Anna' }, priorityLabel: 'High',
        state: { name: done ? 'Approved' : 'In Progress', type: done ? 'completed' : 'started' }
      }],
      pageInfo: { hasNextPage: !done, endCursor: done ? null : 'next' }
    } } } });
  });
  assert.deepEqual(cursors, [undefined, 'next']);
  assert.deepEqual(normalizeUnifiedTasks(tasks).map(({ key, source, status }) => [key, source, status]), [
    ['ENG-1', 'linear', 'In Progress'], ['ENG-2', 'linear', 'Done']
  ]);
});

test('GitLab import follows project pagination, maps tracker fields and keeps the token at the chosen HTTPS host', async () => {
  const pages: string[] = [];
  const tasks = await readGitLabTasks('shop/service', 'test-gitlab-key', 'https://gitlab.example.test', async (url, options) => {
    const endpoint = new URL(String(url));
    assert.equal(endpoint.origin, 'https://gitlab.example.test');
    assert.equal(endpoint.pathname, '/api/v4/projects/shop%2Fservice/issues');
    assert.equal(endpoint.searchParams.get('scope'), 'all');
    assert.equal(new Headers(options?.headers).get('PRIVATE-TOKEN'), 'test-gitlab-key');
    assert.equal(options?.redirect, 'error');
    const page = endpoint.searchParams.get('page')!;
    pages.push(page);
    return Response.json([{
      id: 9200 + Number(page), iid: Number(page), project_id: 7, title: 'Document support flow',
      web_url: `https://gitlab.example.test/shop/service/-/issues/${page}`, state: page === '1' ? 'opened' : 'closed',
      labels: ['support'], due_date: '2026-12-01'
    }], { headers: { 'x-next-page': page === '1' ? '2' : '' } });
  });
  assert.deepEqual(pages, ['1', '2']);
  assert.deepEqual(normalizeUnifiedTasks(tasks).map(({ key, source, status }) => [key, source, status]), [
    ['#1', 'gitlab', 'opened'], ['#2', 'gitlab', 'closed']
  ]);
  assert.equal(tasks[0].repository, 'https://gitlab.example.test/shop/service');
  assert.equal(tasks[0].dueDate, '2026-12-01');
  await assert.rejects(readGitLabTasks('shop/service', 'test-gitlab-key', 'http://gitlab.example.test'), /HTTPS/);
});
