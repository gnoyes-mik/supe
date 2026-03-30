import test from 'node:test';
import assert from 'node:assert/strict';
import { runCli } from './helpers/process.mjs';

test('list --json returns a valid JSON envelope', async () => {
  const result = await runCli(['list', '--json']);
  assert.equal(result.code, 0);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.ok(Array.isArray(payload.data.sessions));
});

test('status --json returns not_found envelope for missing session', async () => {
  const result = await runCli(['status', 'ses_missing_for_test', '--json']);
  assert.equal(result.code, 4);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, 'not_found');
});

test('report --json returns not_found envelope for missing session', async () => {
  const result = await runCli(['report', 'ses_missing_for_test', '--json']);
  assert.equal(result.code, 4);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, 'not_found');
});

test('stop --json returns not_found envelope for missing session', async () => {
  const result = await runCli(['stop', 'ses_missing_for_test', '--json']);
  assert.equal(result.code, 4);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, 'not_found');
});

test('run --spec - --json --non-interactive returns invalid_request on empty stdin when local analysis backend is ready', async () => {
  const result = await runCli(['run', '--spec', '-', '--json', '--non-interactive'], {
    stdin: '',
  });
  assert.equal(result.code, 5);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, 'invalid_request');
});

test('resume --json returns not_found envelope and exit code for missing session', async () => {
  const result = await runCli(['resume', 'ses_missing_for_test', '--json']);
  assert.equal(result.code, 4);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, 'not_found');
});
