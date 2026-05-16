import test from 'node:test';
import assert from 'node:assert/strict';

import {
  csvEscape
} from '../src/report-utils';
import {
  parseArgs
} from '../src/utils';

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
