import test from 'node:test';
import assert from 'node:assert/strict';

import {
  csvEscape
} from '../src/report-utils';
import {
  extractMarkdownSection,
  parseArgs
} from '../src/utils';

test('extractMarkdownSection keeps every line until the next heading at the same level', () => {
  const markdown = '## Acceptance criteria\n- First\n- Second\n\n### Details\nExtra note\n\n## Verification\nRun the tests.';
  assert.equal(extractMarkdownSection(markdown, 'Acceptance criteria'), '- First\n- Second\n\n### Details\nExtra note');
  assert.equal(extractMarkdownSection(markdown, 'Verification'), 'Run the tests.');
  assert.equal(extractMarkdownSection('## Acceptance criteria', 'Acceptance criteria'), '');
});

test('parseArgs supports --key value, --key=value, boolean flags, and -- terminator', () => {
  const args = parseArgs([
    'node',
    'cli.js',
    '--input=data/tasks.json',
    '--output',
    'reports/out.md',
    '--demo',
    '--format=json',
    '--',
    '--ignored=value'
  ]);

  assert.equal(args.input, 'data/tasks.json');
  assert.equal(args.output, 'reports/out.md');
  assert.equal(args.demo, true);
  assert.equal(args.format, 'json');
  assert.equal(args.ignored, undefined);
});

test('csvEscape quotes carriage returns as row-breaking characters', () => {
  assert.equal(csvEscape('line 1\rline 2'), '"line 1\rline 2"');
});
