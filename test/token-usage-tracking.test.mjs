import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createEmptyUsageSummary,
  addTurnToUsageSummary,
} from '../dist/utils/usage.js';

describe('createEmptyUsageSummary', () => {
  test('returns all zeroed fields', () => {
    const summary = createEmptyUsageSummary();
    assert.deepStrictEqual(summary, {
      turns: [],
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCacheCreationTokens: 0,
      totalCacheReadTokens: 0,
      totalCostUsd: 0,
    });
  });
});

describe('addTurnToUsageSummary', () => {
  test('adds a single turn and accumulates totals', () => {
    const empty = createEmptyUsageSummary();
    const turn = {
      turnIndex: 0,
      model: 'claude-sonnet-4-20250514',
      usage: {
        inputTokens: 1000,
        outputTokens: 500,
        cacheCreationInputTokens: 200,
        cacheReadInputTokens: 300,
      },
      costUsd: 0.012,
      timestamp: '2026-04-01T00:00:00.000Z',
    };

    const result = addTurnToUsageSummary(empty, turn);

    assert.equal(result.turns.length, 1);
    assert.equal(result.totalInputTokens, 1000);
    assert.equal(result.totalOutputTokens, 500);
    assert.equal(result.totalCacheCreationTokens, 200);
    assert.equal(result.totalCacheReadTokens, 300);
    assert.equal(result.totalCostUsd, 0.012);
  });

  test('accumulates token counts across multiple turns', () => {
    let summary = createEmptyUsageSummary();

    const turn1 = {
      turnIndex: 0,
      model: 'claude-sonnet-4-20250514',
      usage: {
        inputTokens: 1000,
        outputTokens: 500,
        cacheCreationInputTokens: 100,
        cacheReadInputTokens: 200,
      },
      costUsd: 0.05,
      timestamp: '2026-04-01T00:00:00.000Z',
    };

    const turn2 = {
      turnIndex: 1,
      model: 'claude-sonnet-4-20250514',
      usage: {
        inputTokens: 2000,
        outputTokens: 800,
        cacheCreationInputTokens: 50,
        cacheReadInputTokens: 900,
      },
      costUsd: 0.12,
      timestamp: '2026-04-01T00:01:00.000Z',
    };

    summary = addTurnToUsageSummary(summary, turn1);
    summary = addTurnToUsageSummary(summary, turn2);

    assert.equal(summary.turns.length, 2);
    assert.equal(summary.totalInputTokens, 3000);
    assert.equal(summary.totalOutputTokens, 1300);
    assert.equal(summary.totalCacheCreationTokens, 150);
    assert.equal(summary.totalCacheReadTokens, 1100);
    // totalCostUsd comes from the latest turn's costUsd (cumulative from Claude CLI)
    assert.equal(summary.totalCostUsd, 0.12);
  });

  test('is pure — does not mutate the input summary', () => {
    const original = createEmptyUsageSummary();
    const turn = {
      turnIndex: 0,
      model: null,
      usage: {
        inputTokens: 500,
        outputTokens: 200,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
      },
      costUsd: 0.01,
      timestamp: '2026-04-01T00:00:00.000Z',
    };

    addTurnToUsageSummary(original, turn);

    assert.equal(original.turns.length, 0);
    assert.equal(original.totalInputTokens, 0);
    assert.equal(original.totalCostUsd, 0);
  });

  test('handles null model gracefully', () => {
    const summary = createEmptyUsageSummary();
    const turn = {
      turnIndex: 0,
      model: null,
      usage: {
        inputTokens: 100,
        outputTokens: 50,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
      },
      costUsd: 0,
      timestamp: '2026-04-01T00:00:00.000Z',
    };

    const result = addTurnToUsageSummary(summary, turn);
    assert.equal(result.turns[0].model, null);
    assert.equal(result.totalCostUsd, 0);
  });
});

describe('ClaudeStreamJsonProvider usage extraction', () => {
  test('completed event includes usage and cost from result message', async () => {
    const { ClaudeStreamJsonProvider } = await import(
      '../dist/runtime/providers/claude-stream-json.js'
    );

    const events = [];
    let stdoutWrite;
    const fakeChild = {
      stdout: {
        setEncoding() {},
        on(event, cb) { if (event === 'data') stdoutWrite = cb; },
      },
      stdin: { write() {} },
      on() {},
      exitCode: null,
      killed: false,
      kill() {},
    };

    const provider = new ClaudeStreamJsonProvider({
      spawnImpl: () => fakeChild,
      command: 'echo',
      args: [],
    });

    provider.subscribe((event) => events.push(event));

    const handle = await provider.startSession({
      universeId: 'univ_test1',
      prompt: 'test prompt',
    });

    // Simulate sending a turn
    const turnPromise = provider.sendTurn(handle, {
      text: 'hello',
      submittedAt: '2026-04-01T00:00:00.000Z',
    });

    // Simulate Claude result with usage data
    stdoutWrite(JSON.stringify({
      type: 'result',
      subtype: 'success',
      is_error: false,
      result: 'done',
      total_cost_usd: 0.0542,
      model: 'claude-sonnet-4-20250514',
      usage: {
        input_tokens: 12500,
        output_tokens: 3200,
        cache_creation_input_tokens: 500,
        cache_read_input_tokens: 8000,
      },
      modelUsage: {
        'claude-sonnet-4-20250514': {
          inputTokens: 12500,
          outputTokens: 3200,
        },
      },
      session_id: 'sid_test',
    }) + '\n');

    await turnPromise;

    const completed = events.find((e) => e.type === 'completed');
    assert.ok(completed, 'should emit a completed event');
    assert.equal(completed.totalCostUsd, 0.0542);
    assert.equal(completed.model, 'claude-sonnet-4-20250514');
    assert.ok(completed.usage, 'should include usage data');
    assert.equal(completed.usage.inputTokens, 12500);
    assert.equal(completed.usage.outputTokens, 3200);
    assert.equal(completed.usage.cacheCreationInputTokens, 500);
    assert.equal(completed.usage.cacheReadInputTokens, 8000);

    await provider.close(handle);
  });

  test('completed event has null usage when result lacks usage data', async () => {
    const { ClaudeStreamJsonProvider } = await import(
      '../dist/runtime/providers/claude-stream-json.js'
    );

    const events = [];
    let stdoutWrite;
    const fakeChild = {
      stdout: {
        setEncoding() {},
        on(event, cb) { if (event === 'data') stdoutWrite = cb; },
      },
      stdin: { write() {} },
      on() {},
      exitCode: null,
      killed: false,
      kill() {},
    };

    const provider = new ClaudeStreamJsonProvider({
      spawnImpl: () => fakeChild,
      command: 'echo',
      args: [],
    });

    provider.subscribe((event) => events.push(event));

    const handle = await provider.startSession({
      universeId: 'univ_test2',
      prompt: 'test prompt',
    });

    const turnPromise = provider.sendTurn(handle, {
      text: 'hello',
      submittedAt: '2026-04-01T00:00:00.000Z',
    });

    // Result without usage or model
    stdoutWrite(JSON.stringify({
      type: 'result',
      is_error: false,
      result: 'done',
    }) + '\n');

    await turnPromise;

    const completed = events.find((e) => e.type === 'completed');
    assert.ok(completed);
    assert.equal(completed.totalCostUsd, null);
    assert.equal(completed.model, null);
    assert.equal(completed.usage, null);

    await provider.close(handle);
  });

  test('extracts model from modelUsage keys when model field is missing', async () => {
    const { ClaudeStreamJsonProvider } = await import(
      '../dist/runtime/providers/claude-stream-json.js'
    );

    const events = [];
    let stdoutWrite;
    const fakeChild = {
      stdout: {
        setEncoding() {},
        on(event, cb) { if (event === 'data') stdoutWrite = cb; },
      },
      stdin: { write() {} },
      on() {},
      exitCode: null,
      killed: false,
      kill() {},
    };

    const provider = new ClaudeStreamJsonProvider({
      spawnImpl: () => fakeChild,
      command: 'echo',
      args: [],
    });

    provider.subscribe((event) => events.push(event));

    const handle = await provider.startSession({
      universeId: 'univ_test3',
      prompt: 'test prompt',
    });

    const turnPromise = provider.sendTurn(handle, {
      text: 'hello',
      submittedAt: '2026-04-01T00:00:00.000Z',
    });

    // Result with modelUsage but no top-level model field
    stdoutWrite(JSON.stringify({
      type: 'result',
      is_error: false,
      result: 'done',
      total_cost_usd: 0.03,
      usage: { input_tokens: 100, output_tokens: 50 },
      modelUsage: { 'claude-opus-4-20250514': {} },
    }) + '\n');

    await turnPromise;

    const completed = events.find((e) => e.type === 'completed');
    assert.equal(completed.model, 'claude-opus-4-20250514');

    await provider.close(handle);
  });
});
