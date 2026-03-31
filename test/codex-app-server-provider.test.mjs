import test from 'node:test';
import assert from 'node:assert/strict';
import { CodexAppServerProvider } from '../dist/runtime/providers/codex-app-server.js';

function createMockTransport() {
  const listeners = new Set();
  const requests = [];

  return {
    requests,
    emit(message) {
      for (const listener of listeners) {
        listener(message);
      }
    },
    async request(method, params) {
      requests.push({ method, params });
      if (method === 'thread/start') {
        return { thread: { threadId: 'thread_abc' } };
      }
      if (method === 'thread/resume') {
        return { threadId: params.threadId };
      }
      if (method === 'thread/read') {
        return { turns: [{ turnId: 'turn_123' }] };
      }
      return {};
    },
    async notify(method, params) {
      requests.push({ method, params, kind: 'notify' });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async close() {},
  };
}

test('codex app-server provider starts/resumes threads and maps notifications to runtime events', async () => {
  const transport = createMockTransport();
  const events = [];
  const provider = new CodexAppServerProvider({
    now: () => new Date('2026-03-31T00:00:00.000Z'),
    transport,
  });

  provider.subscribe((event) => {
    events.push(event);
  });

  const handle = await provider.startSession({
    universeId: 'univ_alpha',
    prompt: 'hello',
  });
  assert.equal(handle.externalSessionId, 'thread_abc');

  transport.emit({
    method: 'thread/started',
    params: { universeId: 'univ_alpha', thread: { threadId: 'thread_abc' } },
  });
  transport.emit({
    method: 'item/agentMessage/delta',
    params: { universeId: 'univ_alpha', delta: { text: 'working' } },
  });
  transport.emit({
    method: 'item/tool/requestUserInput',
    params: { universeId: 'univ_alpha', question: 'Need a scope choice' },
  });
  transport.emit({
    method: 'turn/completed',
    params: { universeId: 'univ_alpha' },
  });

  assert.equal(events[0].type, 'progress_hint');
  assert.equal(events[1].type, 'session_started');
  assert.equal(events[2].type, 'assistant_delta');
  assert.equal(events[3].type, 'needs_user_input');
  assert.equal(events[4].type, 'completed');

  await provider.interrupt(handle);
  assert.equal(transport.requests.at(-1).method, 'turn/interrupt');
});
