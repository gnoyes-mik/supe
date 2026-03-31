import { loadSelectedSession } from '../../app/session-service.js';
import { SessionManager } from '../../core/session.js';
import { SUPE_EXIT_CODES, makeSessionJsonData } from '../../app/contracts.js';
import { configureJsonOutput, printJsonError, printJsonSuccess } from '../output.js';
import type { Session } from '../../types.js';

const FILLED_BAR = '█';
const EMPTY_BAR = '░';
const BAR_WIDTH = 10;

export async function statusCommand(sessionId?: string, opts: Record<string, unknown> = {}): Promise<void> {
  const jsonMode = Boolean(opts.json);
  configureJsonOutput(jsonMode);
  const sessionManager = new SessionManager();

  try {
    const session = await loadSelectedSession(sessionManager, sessionId);
    if (!session) {
      process.exitCode = SUPE_EXIT_CODES.NOT_FOUND;
      if (jsonMode) {
        printJsonError('not_found', 'No session found.');
      } else {
        console.log('No session found.');
      }
      return;
    }

    const pollenSummary = summarizePollens(session);
    if (jsonMode) {
      const sessionData = makeSessionJsonData(session);
      printJsonSuccess({
        ...sessionData,
        elapsed: formatElapsed(session.startedAt),
        pollenSummary,
        universes: session.universes.map((universe) => ({
          ...sessionData.universes.find((entry) => entry.universeId === universe.id)!,
          progress: universe.progress,
          runtimeSession: universe.runtimeSession,
        })),
      });
      return;
    }

    console.log(`Session: ${session.id}`);
    console.log(`Status:  ${session.status} (${formatElapsed(session.startedAt)} elapsed)`);
    console.log(`Spec:    ${session.spec.parsed.title}`);
    console.log('');

    for (const universe of session.universes) {
      const progressBar = renderProgressBar(universe.progress.percentage);
      const statusSuffix = universe.status === 'completed' ? '  OK' : '';
      console.log(
        `Universe ${universe.config.symbol} (${universe.config.name})  ${progressBar}` +
          `  $${universe.progress.estimatedCostUsd.toFixed(2)}` +
          `  ${universe.progress.filesCreated} files` +
          `  ${universe.progress.totalCommits} commits${statusSuffix}`
      );
      if (universe.runtimeSession) {
        console.log(`  runtime: ${universe.runtimeSession.state} | ${universe.runtimeSession.currentStep ?? 'n/a'}`);
        if (universe.runtimeSession.pendingQuestion) {
          console.log(`  waiting: ${universe.runtimeSession.pendingQuestion}`);
        }
      }
    }

    console.log('');
    console.log(
      `Pollens: ${pollenSummary.total} total, ${pollenSummary.applied} applied, ` +
        `${pollenSummary.adapted} adapted, ${pollenSummary.rejected} rejected`
    );
  } finally {
    configureJsonOutput(false);
    sessionManager.destroy();
  }
}

function clampPercentage(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 100) {
    return 100;
  }
  return value;
}

function renderProgressBar(percentage: number): string {
  const safe = clampPercentage(percentage);
  const filled = Math.round((safe / 100) * BAR_WIDTH);
  const empty = BAR_WIDTH - filled;
  return `${FILLED_BAR.repeat(filled)}${EMPTY_BAR.repeat(empty)} ${safe.toFixed(0)}%`;
}

function summarizePollens(session: Session): {
  total: number;
  applied: number;
  adapted: number;
  rejected: number;
} {
  let applied = 0;
  let adapted = 0;
  let rejected = 0;

  for (const pollen of session.pollens) {
    for (const target of pollen.targets) {
      if (target.status === 'applied') {
        applied += 1;
      } else if (target.status === 'adapted') {
        adapted += 1;
      } else if (target.status === 'rejected') {
        rejected += 1;
      }
    }
  }

  return {
    total: session.pollens.length,
    applied,
    adapted,
    rejected,
  };
}

function formatElapsed(startIso: string): string {
  const startMs = Date.parse(startIso);
  if (Number.isNaN(startMs)) {
    return '0m';
  }

  const elapsedMs = Math.max(0, Date.now() - startMs);
  const totalMinutes = Math.floor(elapsedMs / (60 * 1000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return `${minutes}m`;
  }

  return `${hours}h ${minutes}m`;
}
