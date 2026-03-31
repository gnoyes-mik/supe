import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CONVERSATION_PROVIDER_CONTRACTS,
  DEFAULT_RUNTIME_RESUME_CONTRACT,
} from '../dist/runtime/contracts.js';
import {
  createPresenterModelFromSession,
  createUniversePresenterRow,
  resolveTerminalPresenterMode,
  shouldRenderInteractiveBootSequence,
} from '../dist/runtime/presenter-model.js';
import {
  appendTranscriptTail,
  createRuntimeSessionRecord,
  withRuntimeSessionState,
} from '../dist/runtime/session-registry.js';
import {
  appendRuntimeEvent,
  readRuntimeEvents,
} from '../dist/runtime/event-log.js';
import {
  deriveCurrentStepLabelFromEvent,
  deriveRuntimeSessionStateFromEvent,
} from '../dist/runtime/progress-mapper.js';
import { ConversationManager } from '../dist/runtime/conversation-manager.js';

test('conversation provider contracts freeze codex app-server and claude stream-json decisions', () => {
  assert.deepEqual(CONVERSATION_PROVIDER_CONTRACTS.codex, {
    provider: 'codex',
    transport: 'app-server',
    supportsLongLivedSessions: true,
    supportsStreamingDeltas: true,
    supportsSessionResume: true,
    supportsStructuredUserInput: true,
    canonicalTtyPresenter: 'ink',
  });
  assert.deepEqual(CONVERSATION_PROVIDER_CONTRACTS.claude, {
    provider: 'claude',
    transport: 'stream-json',
    supportsLongLivedSessions: true,
    supportsStreamingDeltas: true,
    supportsSessionResume: true,
    supportsStructuredUserInput: false,
    canonicalTtyPresenter: 'ink',
  });
});

test('runtime resume contract centralizes review dispositions and control-plane actions', () => {
  assert.equal(DEFAULT_RUNTIME_RESUME_CONTRACT.owner, 'conversation-manager');
  assert.deepEqual(DEFAULT_RUNTIME_RESUME_CONTRACT.dispositionsRequiringReview, [
    'partial_turn',
    'inflight_tool',
    'provider_restart',
  ]);
  assert.deepEqual(DEFAULT_RUNTIME_RESUME_CONTRACT.supportedActions, [
    'reply',
    'cancel',
    'interrupt',
    'timeout',
  ]);
});

test('presenter mode resolves to ink only for tty interactive dashboard runs', () => {
  assert.equal(
    resolveTerminalPresenterMode({ jsonMode: false, dashboardEnabled: true, isTTY: true }),
    'ink-dashboard',
  );
  assert.equal(
    resolveTerminalPresenterMode({ jsonMode: true, dashboardEnabled: true, isTTY: true }),
    'json',
  );
  assert.equal(
    resolveTerminalPresenterMode({ jsonMode: false, dashboardEnabled: false, isTTY: true }),
    'plain-text',
  );
  assert.equal(
    shouldRenderInteractiveBootSequence({ jsonMode: false, dashboardEnabled: true, isTTY: true }),
    true,
  );
  assert.equal(
    shouldRenderInteractiveBootSequence({ jsonMode: false, dashboardEnabled: true, isTTY: false }),
    false,
  );
});

test('runtime session registry creates and updates provider session records', () => {
  const created = createRuntimeSessionRecord('codex', '2026-03-31T00:00:00.000Z');
  assert.equal(created.provider, 'codex');
  assert.equal(created.transport, 'app-server');
  assert.equal(created.state, 'booting');
  assert.equal(created.currentStep, 'Initializing provider session');

  const updated = withRuntimeSessionState(
    appendTranscriptTail(created, 'first line'),
    'thinking',
    '2026-03-31T00:01:00.000Z',
    'Comparing options',
  );

  assert.equal(updated.state, 'thinking');
  assert.equal(updated.currentStep, 'Comparing options');
  assert.equal(updated.lastActivityAt, '2026-03-31T00:01:00.000Z');
  assert.deepEqual(updated.transcriptTail, ['first line']);
});

test('presenter rows derive universe runtime state, progress, and highlight from session data', () => {
  const universe = {
    id: 'univ_123',
    sessionId: 'ses_123',
    config: {
      name: 'Alpha',
      symbol: 'α',
      approach: 'test',
      optimizationAxis: 'speed',
      tools: [],
      agent: 'codex',
      estimatedStrength: '',
      estimatedWeakness: '',
    },
    status: 'running',
    workdir: '/tmp/univ_123',
    gitBranch: 'universe/alpha',
    promptPath: '/tmp/univ_123/PROMPT.md',
    agentProcess: {
      pid: null,
      command: '',
      args: [],
      startedAt: null,
      iterationCount: 0,
      lastIterationAt: null,
    },
    progress: {
      percentage: 50,
      currentPhase: 'Comparing options',
      filesCreated: 1,
      totalCommits: 2,
      lastCommitMessage: 'Update spec',
      lastActivityAt: '2026-03-31T00:00:00.000Z',
      estimatedCostUsd: 0,
      criteriaProgress: [
        { criterion: 'A', status: 'verified', evidence: '' },
        { criterion: 'B', status: 'likely_done', evidence: '' },
        { criterion: 'C', status: 'not_started', evidence: '' },
      ],
    },
    metrics: null,
    logs: [],
    runtimeSession: {
      provider: 'codex',
      transport: 'app-server',
      externalSessionId: null,
      state: 'waiting_for_user',
      currentStep: 'Need clarification',
      lastActivityAt: '2026-03-31T00:00:01.000Z',
      lastSequence: 3,
      pendingQuestion: 'Which API?',
      transcriptTail: [],
    },
    startedAt: '2026-03-31T00:00:00.000Z',
    completedAt: null,
    error: null,
    restartCount: 0,
    pendingPollens: [],
  };

  const row = createUniversePresenterRow(universe);
  assert.equal(row.provider, 'codex');
  assert.equal(row.state, 'waiting_for_user');
  assert.equal(row.currentStep, 'Which API?');
  assert.equal(row.criteriaDone, 2);
  assert.equal(row.criteriaTotal, 3);
  assert.equal(row.highlight, 'waiting');

  const presenter = createPresenterModelFromSession({
    id: 'ses_123',
    status: 'running',
    spec: { rawPath: '', raw: '', parsed: {} },
    universes: [universe],
    config: {},
    slack: null,
    pollens: [],
    report: null,
    startedAt: '2026-03-31T00:00:00.000Z',
    completedAt: null,
    error: null,
  }, 'ink-dashboard');

  assert.equal(presenter.sessionId, 'ses_123');
  assert.equal(presenter.rows.length, 1);
  assert.equal(presenter.rows[0].symbol, 'α');
});

test('runtime event log appends and reads back canonical events', async () => {
  const workdir = await mkdtemp(join(tmpdir(), 'supe-runtime-log-'));
  try {
    await appendRuntimeEvent(workdir, {
      type: 'session_started',
      universeId: 'univ_123',
      provider: 'claude',
      sequence: 1,
      timestamp: '2026-03-31T00:00:00.000Z',
      externalSessionId: 'ses_provider_1',
    });
    await appendRuntimeEvent(workdir, {
      type: 'heartbeat',
      universeId: 'univ_123',
      provider: 'claude',
      sequence: 2,
      timestamp: '2026-03-31T00:00:01.000Z',
      phase: 'thinking',
    });

    const events = await readRuntimeEvents(workdir);
    assert.equal(events.length, 2);
    assert.equal(events[0].type, 'session_started');
    assert.equal(events[1].type, 'heartbeat');
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
});

test('progress mapper derives state and current step labels from canonical events', () => {
  const event = {
    type: 'tool_started',
    universeId: 'univ_123',
    provider: 'codex',
    sequence: 7,
    timestamp: '2026-03-31T00:00:00.000Z',
    toolName: 'Bash',
    detail: 'npm test',
  };

  assert.equal(deriveRuntimeSessionStateFromEvent(event), 'tool_running');
  assert.equal(deriveCurrentStepLabelFromEvent(event), 'Bash: npm test');
});

test('conversation manager persists runtime events and updates universe session state', async () => {
  const emitted = [];
  const provider = {
    provider: 'codex',
    subscribe(listener) {
      this.listener = listener;
      return () => {
        this.listener = null;
      };
    },
    async startSession({ universeId }) {
      this.listener?.({
        type: 'session_started',
        universeId,
        provider: 'codex',
        sequence: 1,
        timestamp: '2026-03-31T00:00:00.000Z',
        externalSessionId: 'thread_123',
      });
      return { universeId, provider: 'codex', externalSessionId: 'thread_123' };
    },
    async resumeSession() {
      throw new Error('not used');
    },
    async sendTurn(handle, turn) {
      this.listener?.({
        type: 'assistant_delta',
        universeId: handle.universeId,
        provider: 'codex',
        sequence: 2,
        timestamp: '2026-03-31T00:00:01.000Z',
        text: turn.text,
      });
      this.listener?.({
        type: 'needs_user_input',
        universeId: handle.universeId,
        provider: 'codex',
        sequence: 3,
        timestamp: '2026-03-31T00:00:02.000Z',
        question: 'Need clarification',
      });
    },
    async interrupt() {},
    async close() {},
  };

  const universeWorkdir = await mkdtemp(join(tmpdir(), 'supe-conversation-manager-'));
  try {
    const universe = {
      id: 'univ_456',
      sessionId: 'ses_456',
      config: {
        name: 'Alpha',
        symbol: 'α',
        approach: 'test',
        optimizationAxis: 'speed',
        tools: [],
        agent: 'codex',
        estimatedStrength: '',
        estimatedWeakness: '',
      },
      status: 'running',
      workdir: universeWorkdir,
      gitBranch: 'universe/alpha',
      promptPath: join(universeWorkdir, 'PROMPT.md'),
      agentProcess: {
        pid: null,
        command: '',
        args: [],
        startedAt: null,
        iterationCount: 0,
        lastIterationAt: null,
      },
      progress: {
        percentage: 0,
        currentPhase: 'Preparing',
        filesCreated: 0,
        totalCommits: 0,
        lastCommitMessage: '',
        lastActivityAt: '2026-03-31T00:00:00.000Z',
        estimatedCostUsd: 0,
        criteriaProgress: [],
      },
      metrics: null,
      logs: [],
      runtimeSession: null,
      startedAt: '2026-03-31T00:00:00.000Z',
      completedAt: null,
      error: null,
      restartCount: 0,
      pendingPollens: [],
    };

    const manager = new ConversationManager(universe, provider, {
      onRuntimeEvent(event) {
        emitted.push(event.type);
      },
    });

    const handle = await manager.startOrResume('hello');
    assert.equal(handle.externalSessionId, 'thread_123');
    await manager.reply('follow up');

    assert.equal(universe.runtimeSession.externalSessionId, 'thread_123');
    assert.equal(universe.runtimeSession.state, 'waiting_for_user');
    assert.equal(universe.runtimeSession.pendingQuestion, 'Need clarification');
    assert.deepEqual(universe.runtimeSession.transcriptTail, ['follow up']);
    assert.deepEqual([...emitted].sort(), ['assistant_delta', 'needs_user_input', 'session_started']);

    await new Promise((resolve) => setTimeout(resolve, 25));
    const events = await readRuntimeEvents(universeWorkdir);
    assert.equal(events.length, 3);
    assert.ok(events.some((event) => event.type === 'needs_user_input'));
  } finally {
    await rm(universeWorkdir, { recursive: true, force: true });
  }
});
