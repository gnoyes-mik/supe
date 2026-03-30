import type { EventEmitter } from 'events';
import { join } from 'path';
import type { SessionManager } from '../core/session.js';
import { Orchestrator } from '../core/orchestrator.js';
import {
  PULSE_FRAMES,
  PULSE_MESSAGES,
  mountSessionDashboard,
  type DashboardFrameProps,
  type MountInkDashboardOptions,
} from '../cli/dashboard.js';
import {
  createInitialUniversePresenterRows,
  highlightForRuntimeState,
  inferRuntimeStateFromCurrentStep,
  resolveTerminalPresenterMode,
  updateUniversePresenterRow,
  type TerminalPresenterMode,
} from '../runtime/presenter-model.js';
import type { AgentConfig, GlobalConfig, Session } from '../types.js';
import { getSupeHome } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { generateReport } from './report-service.js';

interface SlackApi {
  createSlackApp: (config: GlobalConfig['slack']) => Promise<unknown> | unknown;
  initializeSlack: (session: Session, app: unknown, emitter: EventEmitter) => Promise<void>;
}

export interface SessionRuntimeLaunchOptions {
  jsonMode?: boolean;
  isTTY?: boolean;
  dashboardEnabled?: boolean;
  stdout?: NodeJS.WriteStream;
  stdin?: NodeJS.ReadStream;
  stderr?: NodeJS.WriteStream;
  inkRender?: MountInkDashboardOptions['renderImpl'];
  now?: () => Date;
}

interface RuntimePresentation {
  mode: TerminalPresenterMode;
  attach: (emitter: EventEmitter, session: Session) => () => void;
}

interface UniverseProgressPayload {
  universeId: string;
  symbol: string;
  progress: {
    percentage: number;
    totalCommits: number;
    filesCreated: number;
    lastCommitMessage: string;
    currentPhase: string;
    lastActivityAt?: string;
    criteriaProgress: Array<{ criterion: string; status: string }>;
  };
}

interface UniverseFailurePayload {
  universeId: string;
  symbol: string;
  error: string;
  restartCount: number;
}

interface UniverseSimplePayload {
  universeId: string;
  symbol: string;
}

interface RuntimePresentationIo {
  stdout: NodeJS.WriteStream;
  stdin: NodeJS.ReadStream;
  stderr: NodeJS.WriteStream;
}

interface UniverseSnapshot {
  commits: number;
  files: number;
  percentage: number;
  doneCount: number;
}

const CONSOLE_PULSE_FRAMES = [
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

const CONSOLE_PULSE_MESSAGES = [
  'Universes expanding...',
  'Dimensions crystallizing...',
  'Agents analyzing problem space...',
  'Quantum states superposing...',
  'Exploring solution manifold...',
  'Rifts stabilizing...',
];

export async function executeSessionRuntime(
  sessionManager: SessionManager,
  session: Session,
  config: GlobalConfig,
  launchOptions: SessionRuntimeLaunchOptions = {},
): Promise<Session> {
  logger.setLogDir(join(getSupeHome(), 'sessions', session.id));
  sessionManager.updateStatus(session, 'running');
  await sessionManager.saveSession(session);

  if (session.config.slackEnabled) {
    await initializeSlackIfAvailable(config, session, sessionManager);
  }

  const detach = createRuntimePresentation(session, launchOptions).attach(sessionManager, session);

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

export function createRuntimePresentation(
  session: Session,
  launchOptions: SessionRuntimeLaunchOptions = {},
): RuntimePresentation {
  const stdout = launchOptions.stdout ?? process.stdout;
  const stdin = launchOptions.stdin ?? process.stdin;
  const stderr = launchOptions.stderr ?? process.stderr;
  const jsonMode = Boolean(launchOptions.jsonMode);
  const isTTY = launchOptions.isTTY ?? Boolean(stdout.isTTY);
  const dashboardEnabled = launchOptions.dashboardEnabled ?? (session.config.dashboardEnabled !== false);
  const mode = resolveTerminalPresenterMode({
    jsonMode,
    dashboardEnabled,
    isTTY,
  });

  const io: RuntimePresentationIo = { stdout, stdin, stderr };

  if (mode === 'ink-dashboard') {
    return createInkRuntimePresentation(session, io, launchOptions);
  }
  if (mode === 'plain-text') {
    return createConsoleRuntimePresentation(io);
  }

  return {
    mode,
    attach: () => () => {},
  };
}

export function attachSessionPresenter(
  emitter: EventEmitter,
  session: Session,
  launchOptions: SessionRuntimeLaunchOptions = {},
): () => void {
  return createRuntimePresentation(session, launchOptions).attach(emitter, session);
}

function createInkRuntimePresentation(
  session: Session,
  io: RuntimePresentationIo,
  launchOptions: SessionRuntimeLaunchOptions,
): RuntimePresentation {
  const now = launchOptions.now ?? (() => new Date());

  return {
    mode: 'ink-dashboard',
    attach: (emitter: EventEmitter) => {
      let props: DashboardFrameProps = {
        model: {
          mode: 'ink-dashboard',
          sessionId: session.id,
          rows: createInitialUniversePresenterRows(session),
        },
        startedAt: session.startedAt,
        nowIso: now().toISOString(),
        pulseFrame: 0,
        width: io.stdout.columns ?? 100,
        statusMessage: 'syncing universes...',
        pollenEnabled: session.config.pollenEnabled,
        pulseActive: true,
      };

      const dashboard = mountSessionDashboard(props, {
        renderImpl: launchOptions.inkRender,
        stdout: io.stdout,
        stdin: io.stdin,
        stderr: io.stderr,
      });

      const rerender = (): void => {
        dashboard.rerender({
          ...props,
          nowIso: now().toISOString(),
          width: io.stdout.columns ?? props.width ?? 100,
        });
      };

      const timer = setInterval(() => {
        props = {
          ...props,
          nowIso: now().toISOString(),
          pulseFrame: props.pulseFrame + 1,
        };
        rerender();
      }, 200);

      const setRow = (universeId: string, patch: Parameters<typeof updateUniversePresenterRow>[2]): void => {
        props = {
          ...props,
          model: {
            ...props.model,
            rows: updateUniversePresenterRow(props.model.rows, universeId, patch),
          },
        };
      };

      const onStarted = (data: UniverseSimplePayload): void => {
        setRow(data.universeId, {
          state: 'ready',
          currentStep: 'Runtime process started',
          lastActivityAt: now().toISOString(),
          highlight: 'normal',
        });
        props = { ...props, statusMessage: 'starting runtimes...' };
        rerender();
      };

      const onProgress = (data: UniverseProgressPayload): void => {
        const state = inferRuntimeStateFromCurrentStep(data.progress.currentPhase);
        const criteriaDone = data.progress.criteriaProgress.filter(
          (criterion) => criterion.status === 'verified' || criterion.status === 'likely_done',
        ).length;
        setRow(data.universeId, {
          state,
          currentStep: data.progress.currentPhase,
          criteriaDone,
          criteriaTotal: data.progress.criteriaProgress.length,
          lastActivityAt: data.progress.lastActivityAt ?? now().toISOString(),
          highlight: highlightForRuntimeState(state),
        });
        props = {
          ...props,
          pulseActive: false,
          statusMessage: 'tracking live universe output',
        };
        rerender();
      };

      const onCompleted = (data: UniverseSimplePayload): void => {
        setRow(data.universeId, {
          state: 'completed',
          currentStep: 'Universe completed',
          lastActivityAt: now().toISOString(),
          highlight: 'completed',
        });
        props = { ...props, pulseActive: false };
        rerender();
      };

      const onFailed = (data: UniverseFailurePayload): void => {
        setRow(data.universeId, {
          state: 'failed',
          currentStep: `Failed: ${data.error}`,
          lastActivityAt: now().toISOString(),
          highlight: 'failed',
        });
        props = {
          ...props,
          pulseActive: false,
          statusMessage: 'stabilizing damaged universes...',
        };
        rerender();
      };

      const onTimeout = (): void => {
        props = {
          ...props,
          pulseActive: false,
          statusMessage: 'timeout reached; stopping universes',
        };
        rerender();
      };

      emitter.on('universe:started', onStarted);
      emitter.on('universe:progress', onProgress);
      emitter.on('universe:completed', onCompleted);
      emitter.on('universe:failed', onFailed);
      emitter.on('session:timeout', onTimeout);

      return () => {
        clearInterval(timer);
        emitter.removeListener('universe:started', onStarted);
        emitter.removeListener('universe:progress', onProgress);
        emitter.removeListener('universe:completed', onCompleted);
        emitter.removeListener('universe:failed', onFailed);
        emitter.removeListener('session:timeout', onTimeout);
        dashboard.unmount();
        dashboard.cleanup();
      };
    },
  };
}

function createConsoleRuntimePresentation(io: RuntimePresentationIo): RuntimePresentation {
  return {
    mode: 'plain-text',
    attach: (emitter: EventEmitter, session: Session) => attachConsoleProgress(emitter, session, io.stdout),
  };
}

function attachConsoleProgress(emitter: EventEmitter, session: Session, stdout: NodeJS.WriteStream): () => void {
  const prev = new Map<string, UniverseSnapshot>();
  let pulseTimer: ReturnType<typeof setInterval> | null = null;
  let pulseFrame = 0;
  let firstProgressReceived = false;

  for (const line of selectConsoleBootBanner(stdout.columns ?? 100)) {
    console.log(line);
  }
  console.log('Opening rifts in spacetime...');

  for (const universe of session.universes) {
    prev.set(universe.id, { commits: 2, files: 2, percentage: 0, doneCount: 0 });
  }

  const bar = (pct: number) => {
    const filled = Math.round(pct / 10);
    return '█'.repeat(filled) + '░'.repeat(10 - filled);
  };

  const ts = () => {
    const current = new Date();
    return `${String(current.getHours()).padStart(2, '0')}:${String(current.getMinutes()).padStart(2, '0')}:${String(current.getSeconds()).padStart(2, '0')}`;
  };

  const startPulse = () => {
    if (pulseTimer) {
      return;
    }

    let msgIdx = 0;
    pulseTimer = setInterval(() => {
      const frame = CONSOLE_PULSE_FRAMES[pulseFrame % CONSOLE_PULSE_FRAMES.length];
      const msg = CONSOLE_PULSE_MESSAGES[msgIdx % CONSOLE_PULSE_MESSAGES.length];
      stdout.write(`\r  ${frame}  ${msg}    `);
      pulseFrame += 1;
      if (pulseFrame % CONSOLE_PULSE_FRAMES.length === 0) {
        msgIdx += 1;
      }
    }, 200);
  };

  const stopPulse = () => {
    if (!pulseTimer) {
      return;
    }

    clearInterval(pulseTimer);
    pulseTimer = null;
    stdout.write(`\r${' '.repeat(60)}\r`);
  };

  let startedCount = 0;
  const onStarted = (data: UniverseSimplePayload) => {
    const universe = session.universes.find((candidate) => candidate.id === data.universeId);
    const name = universe?.config.name ?? '';
    console.log(`${ts()} [${data.symbol}] Started — ${name}`);
    startedCount += 1;
    if (startedCount >= session.universes.length) {
      startPulse();
    }
  };

  const onProgress = (data: UniverseProgressPayload) => {
    if (!firstProgressReceived) {
      firstProgressReceived = true;
      stopPulse();
    }

    const snapshot = prev.get(data.universeId);
    if (!snapshot) {
      return;
    }

    const newCommits = data.progress.totalCommits > snapshot.commits;
    const newFiles = data.progress.filesCreated > snapshot.files;
    const pctChanged = data.progress.percentage !== snapshot.percentage;
    const doneCount = data.progress.criteriaProgress.filter(
      (criterion) => criterion.status === 'verified' || criterion.status === 'likely_done',
    ).length;
    const criteriaChanged = doneCount > snapshot.doneCount;

    if (newCommits || pctChanged || criteriaChanged) {
      const parts = [`${ts()} [${data.symbol}] ${bar(data.progress.percentage)} ${data.progress.percentage}%`];

      if (newCommits && data.progress.lastCommitMessage) {
        parts.push(`  "${data.progress.lastCommitMessage.slice(0, 60)}"`);
      }
      if (newFiles) {
        parts.push(`  ${data.progress.filesCreated} files`);
      }
      if (criteriaChanged) {
        parts.push(`  criteria ${doneCount}/${data.progress.criteriaProgress.length}`);
      }

      console.log(parts.join(''));
    }

    prev.set(data.universeId, {
      commits: data.progress.totalCommits,
      files: data.progress.filesCreated,
      percentage: data.progress.percentage,
      doneCount,
    });
  };

  const onCompleted = (data: UniverseSimplePayload) => {
    console.log(`${ts()} [${data.symbol}] ✓ Completed`);
  };

  const onFailed = (data: UniverseFailurePayload) => {
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
    const pollen = session.pollens.find((candidate) => candidate.id === data.pollenId);
    const title = pollen?.title ?? 'insight';
    console.log(`${ts()} [${data.targetSymbol}] ← Pollen received: "${title.slice(0, 50)}"`);
  };

  const onTimeout = (data: { elapsedMs: number }) => {
    const hours = Math.floor(data.elapsedMs / 3_600_000);
    const minutes = Math.floor((data.elapsedMs % 3_600_000) / 60_000);
    console.log(`${ts()} [session] Timeout reached (${hours}h ${minutes}m). Stopping...`);
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

function selectConsoleBootBanner(width: number): string[] {
  if (width >= 72) {
    return [
      '      .-..-.      .-..-.      .-..-.',
      '   .-( SU )-.  .-( PE )-.  .-( ++ )-.',
      '  (___.---.__)(___.---.__)(___.---.__)',
      '        SUPE :: PARALLEL UNIVERSE ORCHESTRATOR',
    ];
  }

  return ['== SUPE :: PARALLEL UNIVERSE =='];
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
