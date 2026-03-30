import test from 'node:test';
import assert from 'node:assert/strict';
import { getAgentRunner } from '../dist/agents/base.js';

test('claude runner uses --print prompt transport', () => {
  const runner = getAgentRunner('claude');
  const args = runner.buildArgs({
    command: 'claude',
    args: ['--dangerously-skip-permissions'],
    maxCostPerUniverse: 10,
  }, 'hello');
  assert.deepEqual(args, ['--dangerously-skip-permissions', '--print', 'hello']);
});

test('codex runner uses exec positional prompt transport', () => {
  const runner = getAgentRunner('codex');
  const args = runner.buildArgs({
    command: 'codex',
    args: ['--full-auto'],
    maxCostPerUniverse: 10,
  }, 'hello');
  assert.deepEqual(args, ['--full-auto', 'exec', 'hello']);
});
