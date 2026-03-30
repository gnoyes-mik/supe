import type { EventEmitter } from 'events';
import { join } from 'path';
import type { SessionManager } from '../core/session.js';
import { Orchestrator } from '../core/orchestrator.js';
import type { AgentConfig, GlobalConfig, Session } from '../types.js';
import { getSupeHome } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { generateReport } from './report-service.js';

interface SlackApi {
  createSlackApp: (config: GlobalConfig['slack']) => Promise<unknown> | unknown;
  initializeSlack: (session: Session, app: unknown, emitter: EventEmitter) => Promise<void>;
}

export async function executeSessionRuntime(
  sessionManager: SessionManager,
  session: Session,
  config: GlobalConfig,
): Promise<Session> {
  logger.setLogDir(join(getSupeHome(), 'sessions', session.id));
  sessionManager.updateStatus(session, 'running');
  await sessionManager.saveSession(session);

  if (session.config.slackEnabled) {
    await initializeSlackIfAvailable(config, session, sessionManager);
  }

  const detach = attachConsoleProgress(sessionManager, session);

  const orchestrator = new Orchestrator(
    sessionManager,
    session,
    config.agents as Record<string, AgentConfig>,
  );
  await orchestrator.start();

  detach();

  if (session.status === 'running' || session.status === 'initializing') {
    const hasFailure = session.universes.some((universe) => universe.status === 'failed');
    const hasStopped = session.universes.some((universe) => universe.status === 'stopped');
    const allCompleted = session.universes.every((universe) => universe.status === 'completed');
    if (allCompleted) {
      sessionManager.updateStatus(session, 'completed');
    } else if (hasFailure || hasStopped) {
      sessionManager.updateStatus(session, 'failed');
    } else {
      sessionManager.updateStatus(session, 'failed');
    }
  }

  session.report = await generateReport(session);
  await sessionManager.saveSession(session);

  logger.info('cli', `Session ${session.id} finished with status: ${session.status}`);
  return session;
}

interface UniverseSnapshot {
  commits: number;
  files: number;
  percentage: number;
  doneCount: number;
}

const PULSE_FRAMES = [
  '          ·          ',
  '         ·•·         ',
  '        ·•●•·        ',
  '       ·•●◉●•·       ',
  '      ·•●◉✦◉●•·      ',
  '     ·•●◉✦✧✦◉●•·     ',
  '      ·•●◉✦◉●•·      ',
  '       ·•●◉●•·       ',
  '        ·•●•·        ',
  '         ·•·         ',
];

const PULSE_MESSAGES = [
  'Universes expanding...',
  'Dimensions crystallizing...',
  'Agents analyzing problem space...',
  'Quantum states superposing...',
  'Exploring solution manifold...',
  'Rifts stabilizing...',
];

function attachConsoleProgress(emitter: EventEmitter, session: Session): () => void {
  const prev = new Map<string, UniverseSnapshot>();
  let pulseTimer: ReturnType<typeof setInterval> | null = null;
  let pulseFrame = 0;
  let firstProgressReceived = false;

  for (const u of session.universes) {
    prev.set(u.id, { commits: 2, files: 2, percentage: 0, doneCount: 0 });
  }

  const bar = (pct: number) => {
    const filled = Math.round(pct / 10);
    return '█'.repeat(filled) + '░'.repeat(10 - filled);
  };

  const ts = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  };

  const startPulse = () => {
    if (pulseTimer) return;
    let msgIdx = 0;
    pulseTimer = setInterval(() => {
      const frame = PULSE_FRAMES[pulseFrame % PULSE_FRAMES.length];
      const msg = PULSE_MESSAGES[msgIdx % PULSE_MESSAGES.length];
      process.stdout.write(`\r  ${frame}  ${msg}    `);
      pulseFrame++;
      if (pulseFrame % PULSE_FRAMES.length === 0) msgIdx++;
    }, 200);
  };

  const stopPulse = () => {
    if (pulseTimer) {
      clearInterval(pulseTimer);
      pulseTimer = null;
      process.stdout.write('\r' + ' '.repeat(60) + '\r');
    }
  };

  let startedCount = 0;
  const onStarted = (data: { universeId: string; symbol: string }) => {
    const u = session.universes.find(u => u.id === data.universeId);
    const name = u?.config.name ?? '';
    console.log(`${ts()} [${data.symbol}] Started — ${name}`);
    startedCount++;
    if (startedCount >= session.universes.length) {
      startPulse();
    }
  };

  const onProgress = (data: {
    universeId: string;
    symbol: string;
    progress: {
      percentage: number;
      totalCommits: number;
      filesCreated: number;
      lastCommitMessage: string;
      currentPhase: string;
      criteriaProgress: Array<{ criterion: string; status: string }>;
    };
  }) => {
    if (!firstProgressReceived) {
      firstProgressReceived = true;
      stopPulse();
    }

    const { symbol, universeId, progress } = data;
    const snapshot = prev.get(universeId);
    if (!snapshot) return;

    const newCommits = progress.totalCommits > snapshot.commits;
    const newFiles = progress.filesCreated > snapshot.files;
    const pctChanged = progress.percentage !== snapshot.percentage;
    const doneCount = progress.criteriaProgress.filter(
      c => c.status === 'verified' || c.status === 'likely_done'
    ).length;
    const criteriaChanged = doneCount > snapshot.doneCount;

    // Only print when something meaningful changed
    if (newCommits || pctChanged || criteriaChanged) {
      const parts = [`${ts()} [${symbol}] ${bar(progress.percentage)} ${progress.percentage}%`];

      if (newCommits && progress.lastCommitMessage) {
        parts.push(`  "${progress.lastCommitMessage.slice(0, 60)}"`);
      }

      if (newFiles) {
        parts.push(`  ${progress.filesCreated} files`);
      }

      if (criteriaChanged) {
        const total = progress.criteriaProgress.length;
        parts.push(`  criteria ${doneCount}/${total}`);
      }

      console.log(parts.join(''));
    }

    prev.set(universeId, {
      commits: progress.totalCommits,
      files: progress.filesCreated,
      percentage: progress.percentage,
      doneCount,
    });
  };

  const onCompleted = (data: { universeId: string; symbol: string }) => {
    console.log(`${ts()} [${data.symbol}] ✓ Completed`);
  };

  const onFailed = (data: { universeId: string; symbol: string; error: string; restartCount: number }) => {
    stopPulse();
    console.log(`${ts()} [${data.symbol}] ✗ Failed (restart ${data.restartCount}/3): ${data.error}`);
  };

  const onCycleStarted = (data: { cycleNumber: number }) => {
    console.log(`${ts()} [pollen] Cycle ${data.cycleNumber} — scanning universes...`);
  };

  const onCycleCompleted = (data: { cycleNumber: number; pollensCreated: number }) => {
    if (data.pollensCreated > 0) {
      console.log(`${ts()} [pollen] Cycle ${data.cycleNumber} — ${data.pollensCreated} insights discovered`);
    }
  };

  const onInjected = (data: { pollenId: string; targetUniverseId: string; targetSymbol: string }) => {
    const pollen = session.pollens.find(p => p.id === data.pollenId);
    const title = pollen?.title ?? 'insight';
    console.log(`${ts()} [${data.targetSymbol}] ← Pollen received: "${title.slice(0, 50)}"`);
  };

  const onTimeout = (data: { elapsedMs: number }) => {
    const hours = Math.floor(data.elapsedMs / 3_600_000);
    const mins = Math.floor((data.elapsedMs % 3_600_000) / 60_000);
    console.log(`${ts()} [session] Timeout reached (${hours}h ${mins}m). Stopping...`);
  };

  emitter.on('universe:started', onStarted);
  emitter.on('universe:progress', onProgress);
  emitter.on('universe:completed', onCompleted);
  emitter.on('universe:failed', onFailed);
  emitter.on('cycle:started', onCycleStarted);
  emitter.on('cycle:completed', onCycleCompleted);
  emitter.on('pollen:injected', onInjected);
  emitter.on('session:timeout', onTimeout);

  return () => {
    stopPulse();
    emitter.removeListener('universe:started', onStarted);
    emitter.removeListener('universe:progress', onProgress);
    emitter.removeListener('universe:completed', onCompleted);
    emitter.removeListener('universe:failed', onFailed);
    emitter.removeListener('cycle:started', onCycleStarted);
    emitter.removeListener('cycle:completed', onCycleCompleted);
    emitter.removeListener('pollen:injected', onInjected);
    emitter.removeListener('session:timeout', onTimeout);
  };
}

async function initializeSlackIfAvailable(
  config: GlobalConfig,
  session: Session,
  emitter: EventEmitter,
): Promise<void> {
  const module = await import('../slack/app.js');
  const maybeSlackApi = module as Partial<SlackApi>;

  if (typeof maybeSlackApi.createSlackApp !== 'function') {
    logger.warn('cli', 'Slack is enabled but createSlackApp is not implemented.');
    return;
  }

  if (typeof maybeSlackApi.initializeSlack !== 'function') {
    logger.warn('cli', 'Slack is enabled but initializeSlack is not implemented.');
    return;
  }

  const slackApp = await maybeSlackApi.createSlackApp(config.slack);
  await maybeSlackApi.initializeSlack(session, slackApp, emitter);
}
