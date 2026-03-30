import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAgentAssignments } from '../dist/app/run-config.js';

test('resolveAgentAssignments falls back to a single repeated agent', () => {
  assert.deepEqual(
    resolveAgentAssignments(undefined, 3, 'claude'),
    ['claude', 'claude', 'claude'],
  );
});

test('resolveAgentAssignments applies round-robin order from --agents', () => {
  assert.deepEqual(
    resolveAgentAssignments('claude,codex', 5, 'claude'),
    ['claude', 'codex', 'claude', 'codex', 'claude'],
  );
});

test('resolveAgentAssignments rejects unsupported agents', () => {
  assert.throws(
    () => resolveAgentAssignments('claude,gemini,codex', 3, 'claude'),
    /Unsupported agent in --agents: gemini/,
  );
});
