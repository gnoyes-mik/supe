import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { ClaudeStreamJsonProvider } from '../dist/runtime/providers/claude-stream-json.js';

function createFakeChild() {
  const child = new EventEmitter();
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = () => true;
  child.killed = false;
  child.exitCode = null;
  return child;
}

test('claude stream-json provider emits assistant deltas/messages and reuses the session id', async () => {
  const child = createFakeChild();
  let spawnCount = 0;
  let lastArgs = [];
  let stdinPayload = '';
  child.stdin.on('data', (chunk) => {
    stdinPayload += chunk.toString();
  });

  const provider = new ClaudeStreamJsonProvider({
    sessionIdFactory: () => 'claude-session-1',
    spawnImpl(command, args) {
      spawnCount += 1;
      lastArgs = [command, ...args];
      return child;
    },
  });

  const emitted = [];
  provider.subscribe((event) => {
    emitted.push(event);
  });

  const handle = await provider.startSession({ universeId: 'univ_alpha', prompt: 'base prompt' });
  assert.equal(handle.externalSessionId, 'claude-session-1');

  const turnPromise = provider.sendTurn(handle, {
    text: 'follow up',
    submittedAt: '2026-03-31T00:00:00.000Z',
  });

  child.stdout.write('{"type":"stream_event","session_id":"claude-session-1","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}}\n');
  child.stdout.write('{"type":"assistant","session_id":"claude-session-1","message":{"content":[{"type":"text","text":"Hello there"}]}}\n');
  child.stdout.write('{"type":"result","session_id":"claude-session-1","subtype":"success","is_error":false,"result":"Hello there"}\n');

  await turnPromise;

  assert.equal(spawnCount, 1);
  assert.ok(lastArgs.includes('--session-id'));
  assert.ok(lastArgs.includes('claude-session-1'));
  assert.match(stdinPayload, /base prompt/);
  assert.match(stdinPayload, /follow up/);
  assert.deepEqual(emitted.map((event) => event.type), [
    'session_started',
    'assistant_delta',
    'assistant_message',
    'completed',
  ]);
});

test('claude stream-json provider emits failed on result error', async () => {
  const child = createFakeChild();
  const provider = new ClaudeStreamJsonProvider({
    sessionIdFactory: () => 'claude-session-2',
    spawnImpl() {
      return child;
    },
  });

  const emitted = [];
  provider.subscribe((event) => {
    emitted.push(event.type);
  });

  const handle = await provider.startSession({ universeId: 'univ_beta', prompt: 'base' });
  const turnPromise = provider.sendTurn(handle, {
    text: 'hello',
    submittedAt: '2026-03-31T00:00:00.000Z',
  });

  child.stdout.write('{"type":"result","session_id":"claude-session-2","subtype":"error","is_error":true,"result":"provider failed"}\n');

  await assert.rejects(turnPromise, /provider failed/);
  assert.deepEqual(emitted, ['session_started', 'failed']);
});
