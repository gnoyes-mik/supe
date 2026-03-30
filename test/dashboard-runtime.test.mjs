import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import {
  HERO_BANNER_LINES,
  buildDashboardLines,
  selectBootBanner,
} from '../dist/cli/dashboard.js';
import { attachSessionPresenter } from '../dist/app/runtime-service.js';

function createSession() {
  return {
    id: 'ses_dashboard',
    startedAt: '2026-03-31T00:00:00.000Z',
    config: {
      dashboardEnabled: true,
      pollenEnabled: true,
    },
    pollens: [],
    universes: [
      {
        id: 'univ_alpha',
        config: {
          symbol: 'α',
          agent: 'codex',
          name: 'Codex universe',
        },
        progress: {
          lastActivityAt: '2026-03-31T00:00:00.000Z',
          currentPhase: 'Preparing universe workspace',
          criteriaProgress: [
            { criterion: 'one', status: 'verified', evidence: '' },
            { criterion: 'two', status: 'not_started', evidence: '' },
          ],
        },
        runtimeSession: null,
      },
      {
        id: 'univ_beta',
        config: {
          symbol: 'β',
          agent: 'claude',
          name: 'Claude universe',
        },
        progress: {
          lastActivityAt: '2026-03-31T00:00:01.000Z',
          currentPhase: 'Waiting for clarification',
          criteriaProgress: [
            { criterion: 'one', status: 'not_started', evidence: '' },
          ],
        },
        runtimeSession: {
          provider: 'claude',
          transport: 'stream-json',
          externalSessionId: null,
          state: 'waiting_for_user',
          currentStep: 'Waiting for clarification',
          lastActivityAt: '2026-03-31T00:00:01.000Z',
          lastSequence: 0,
          pendingQuestion: 'Need clarification',
          transcriptTail: [],
        },
      },
    ],
  };
}

function createTtyStream() {
  return Object.assign(new PassThrough(), {
    isTTY: true,
    columns: 100,
    rows: 30,
  });
}

test('dashboard banner uses the hero banner on wide terminals', () => {
  assert.deepEqual(selectBootBanner(100), [...HERO_BANNER_LINES]);
});

test('dashboard lines render opening line, live rows, and activity summary', () => {
  const lines = buildDashboardLines({
    model: {
      mode: 'ink-dashboard',
      sessionId: 'ses_dashboard',
      rows: [
        {
          universeId: 'univ_alpha',
          symbol: 'α',
          provider: 'codex',
          state: 'thinking',
          currentStep: 'Comparing solution branches',
          criteriaDone: 1,
          criteriaTotal: 2,
          lastActivityAt: '2026-03-31T00:00:04.000Z',
          highlight: 'normal',
        },
        {
          universeId: 'univ_beta',
          symbol: 'β',
          provider: 'claude',
          state: 'waiting_for_user',
          currentStep: 'Waiting for clarification',
          criteriaDone: 0,
          criteriaTotal: 1,
          lastActivityAt: '2026-03-31T00:00:01.000Z',
          highlight: 'waiting',
        },
      ],
    },
    startedAt: '2026-03-31T00:00:00.000Z',
    nowIso: '2026-03-31T00:00:05.000Z',
    pulseFrame: 2,
    width: 100,
    pollenEnabled: true,
  });

  assert.ok(lines.includes('Opening rifts in spacetime...'));
  assert.ok(lines.some((line) => line.includes('α') && line.includes('CODEX') && line.includes('THINKING')));
  assert.ok(lines.some((line) => line.includes('β') && line.includes('WAITING')));
  assert.ok(lines.some((line) => line.includes('1 waiting for user')));
});

test('attachSessionPresenter mounts Ink once in interactive TTY mode and rerenders on events', () => {
  const emitter = new EventEmitter();
  const session = createSession();
  const stdout = createTtyStream();
  const stdin = createTtyStream();
  const stderr = createTtyStream();

  let renderCalls = 0;
  let rerenderCalls = 0;
  let unmountCalls = 0;
  let cleanupCalls = 0;

  const detach = attachSessionPresenter(emitter, session, {
    jsonMode: false,
    dashboardEnabled: true,
    isTTY: true,
    stdout,
    stdin,
    stderr,
    inkRender: () => {
      renderCalls += 1;
      return {
        rerender() {
          rerenderCalls += 1;
        },
        unmount() {
          unmountCalls += 1;
        },
        cleanup() {
          cleanupCalls += 1;
        },
        waitUntilExit: async () => {},
        clear() {},
      };
    },
  });

  assert.equal(renderCalls, 1);

  emitter.emit('universe:started', { universeId: 'univ_alpha', symbol: 'α' });
  emitter.emit('universe:progress', {
    universeId: 'univ_alpha',
    symbol: 'α',
    progress: {
      percentage: 25,
      totalCommits: 3,
      filesCreated: 4,
      lastCommitMessage: 'Add progress presenter',
      currentPhase: 'Running npm test',
      criteriaProgress: [
        { criterion: 'one', status: 'verified' },
        { criterion: 'two', status: 'not_started' },
      ],
    },
  });

  assert.ok(rerenderCalls >= 2);
  detach();
  assert.equal(unmountCalls, 1);
  assert.equal(cleanupCalls, 1);
});

test('attachSessionPresenter stays silent in json mode', () => {
  const emitter = new EventEmitter();
  const session = createSession();
  let renderCalls = 0;

  const detach = attachSessionPresenter(emitter, session, {
    jsonMode: true,
    dashboardEnabled: true,
    isTTY: true,
    inkRender: () => {
      renderCalls += 1;
      return {
        rerender() {},
        unmount() {},
        cleanup() {},
        waitUntilExit: async () => {},
        clear() {},
      };
    },
  });

  emitter.emit('universe:started', { universeId: 'univ_alpha', symbol: 'α' });
  detach();
  assert.equal(renderCalls, 0);
});
