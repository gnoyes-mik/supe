import test from 'node:test';
import assert from 'node:assert/strict';
import { queueUniverseReply } from '../dist/app/runtime-control-service.js';

function makeSession() {
  return {
    id: 'ses_reply',
    status: 'stopped',
    spec: { rawPath: '', raw: '', parsed: {} },
    config: {},
    slack: null,
    pollens: [],
    report: null,
    startedAt: '2026-03-31T00:00:00.000Z',
    completedAt: null,
    error: null,
    universes: [
      {
        id: 'univ_alpha',
        sessionId: 'ses_reply',
        config: { symbol: 'α', name: 'Alpha', agent: 'codex' },
        status: 'stopped',
        workdir: '/tmp/a',
        gitBranch: 'universe/alpha',
        promptPath: '/tmp/a/PROMPT.md',
        agentProcess: { pid: null, command: '', args: [], startedAt: null, iterationCount: 0, lastIterationAt: null },
        progress: { percentage: 0, currentPhase: '', filesCreated: 0, totalCommits: 0, lastCommitMessage: '', lastActivityAt: '2026-03-31T00:00:00.000Z', estimatedCostUsd: 0, criteriaProgress: [] },
        metrics: null,
        logs: [],
        runtimeSession: {
          provider: 'codex',
          transport: 'app-server',
          externalSessionId: 'thread_1',
          state: 'waiting_for_user',
          currentStep: 'Need clarification',
          lastActivityAt: '2026-03-31T00:00:00.000Z',
          lastSequence: 1,
          pendingQuestion: 'Need clarification',
          pendingReply: null,
          transcriptTail: [],
        },
        startedAt: null,
        completedAt: null,
        error: 'waiting',
        restartCount: 0,
        pendingPollens: [],
      },
    ],
  };
}

test('queueUniverseReply stores reply on the waiting universe and flips it back to running', () => {
  const session = makeSession();
  queueUniverseReply(session, undefined, 'Use the REST API');

  assert.equal(session.status, 'running');
  assert.equal(session.universes[0].status, 'running');
  assert.equal(session.universes[0].runtimeSession.pendingReply, 'Use the REST API');
  assert.equal(session.universes[0].runtimeSession.pendingQuestion, null);
  assert.equal(session.universes[0].runtimeSession.state, 'ready');
});
