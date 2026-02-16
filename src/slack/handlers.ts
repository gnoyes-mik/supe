import { App } from '@slack/bolt';
import { EventEmitter } from 'events';
import type {
  Pollen,
  PollenTarget,
  Session,
  SessionEvents,
  Universe,
} from '../types.js';
import { logger } from '../utils/logger.js';
import {
  commitDetectedMessage,
  entanglementMessage,
  formatDuration,
  morningReportMessage,
  pollenAdoptionMessage,
  pollenReceivedMessage,
  universeProgressUpdate,
  type SlackMessagePayload,
} from './messages.js';

const PROGRESS_THROTTLE_MS = 120_000;

export function registerSlackHandlers(session: Session, emitter: EventEmitter, slackApp: App): void {
  const lastPostAt = new Map<string, number>();
  const lastCommitByUniverse = new Map<string, string>();

  const postMessage = async (message: SlackMessagePayload): Promise<void> => {
    try {
      await slackApp.client.chat.postMessage(message);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('slack', `Slack post failed: ${errorMessage}`);
    }
  };

  const findUniverse = (universeId: string): Universe | null => {
    const universe = session.universes.find((u) => u.id === universeId);
    if (!universe) {
      logger.warn('slack', `Universe not found for event routing: ${universeId}`);
      return null;
    }
    return universe;
  };

  const findPollenAndTarget = (
    pollenId: string,
    targetUniverseId: string,
  ): { pollen: Pollen; target: PollenTarget } | null => {
    const pollen = session.pollens.find((p) => p.id === pollenId);
    if (!pollen) {
      logger.warn('slack', `Pollen not found for event routing: ${pollenId}`);
      return null;
    }

    const target = pollen.targets.find((t) => t.universeId === targetUniverseId);
    if (!target) {
      logger.warn('slack', `Pollen target not found for universe ${targetUniverseId}: ${pollenId}`);
      return null;
    }

    return { pollen, target };
  };

  const onEvent = <K extends keyof SessionEvents>(
    event: K,
    handler: (payload: SessionEvents[K]) => Promise<void>,
  ): void => {
    emitter.on(event, (payload: SessionEvents[K]) => {
      void handler(payload).catch((error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('slack', `Slack handler failed for ${String(event)}: ${errorMessage}`);
      });
    });
  };

  onEvent('universe:started', async ({ universeId, symbol }) => {
    const universe = findUniverse(universeId);
    if (!universe) return;

    const threadTs = session.slack?.threadTsMap[universeId];
    if (!threadTs) return;

    await postMessage({
      channel: session.slack!.channel,
      thread_ts: threadTs,
      text: `🚀 Universe ${symbol} 실행 시작 (Agent: ${universe.config.agent})`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🚀 *Universe ${symbol} 실행 시작*\nAgent: ${universe.config.agent} | Optimization: ${universe.config.optimizationAxis}`,
          },
        },
      ],
    });
  });

  onEvent('universe:progress', async ({ universeId, progress }) => {
    const universe = findUniverse(universeId);
    if (!universe) return;

    const latestCommitKey = `${progress.totalCommits}:${progress.lastCommitMessage}`;
    const previousCommitKey = lastCommitByUniverse.get(universeId);
    if (
      progress.totalCommits > 0
      && progress.lastCommitMessage.trim().length > 0
      && latestCommitKey !== previousCommitKey
    ) {
      lastCommitByUniverse.set(universeId, latestCommitKey);
      await postMessage(
        commitDetectedMessage(
          universe,
          session,
          progress.lastCommitMessage,
          `commit-${progress.totalCommits}`,
        ),
      );
    }

    const now = Date.now();
    const lastProgressPost = lastPostAt.get(universeId) ?? 0;
    if (now - lastProgressPost < PROGRESS_THROTTLE_MS) {
      return;
    }

    lastPostAt.set(universeId, now);
    await postMessage(universeProgressUpdate(universe, session, progress.currentPhase));
  });

  onEvent('universe:completed', async ({ universeId, symbol, metrics }) => {
    const universe = findUniverse(universeId);
    if (!universe) return;

    const startedAt = universe.startedAt ?? session.startedAt;
    const completedAt = universe.completedAt ?? new Date().toISOString();

    await postMessage({
      channel: session.slack!.channel,
      thread_ts: session.slack!.threadTsMap[universeId],
      text: `✅ Universe ${symbol} 완료!`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: [
              `✅ *Universe ${symbol} 완료!*`,
              `Files: ${metrics.totalFiles} | Commits: ${metrics.totalCommits}`,
              `Cost: $${metrics.estimatedCostUsd.toFixed(2)} | Duration: ${formatDuration(startedAt, completedAt)}`,
              `Pollen Sent: ${metrics.pollenEmitted} | Used: ${metrics.pollenApplied}`,
            ].join('\n'),
          },
        },
      ],
    });
  });

  onEvent('universe:failed', async ({ universeId, symbol, error, restartCount }) => {
    await postMessage({
      channel: session.slack!.channel,
      thread_ts: session.slack!.threadTsMap[universeId],
      text: `⚠️ Universe ${symbol} error: ${error} (restart ${restartCount}/3)`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `⚠️ *Universe ${symbol} 오류*\nError: ${error}\nRestart: ${restartCount}/3`,
          },
        },
      ],
    });
  });

  onEvent('universe:restarted', async ({ universeId, symbol, restartCount }) => {
    await postMessage({
      channel: session.slack!.channel,
      thread_ts: session.slack!.threadTsMap[universeId],
      text: `🔁 Universe ${symbol} restarted (${restartCount}/3)`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🔁 *Universe ${symbol} 재시작*\nAttempt: ${restartCount}/3`,
          },
        },
      ],
    });
  });

  onEvent('pollen:created', async ({ pollen }) => {
    const targets = pollen.targets.filter((target) => target.status !== 'rejected');
    if (targets.length === 0) return;
    await postMessage(entanglementMessage(pollen, targets, session));
  });

  onEvent('pollen:injected', async ({ pollenId, targetUniverseId }) => {
    const payload = findPollenAndTarget(pollenId, targetUniverseId);
    if (!payload) return;
    await postMessage(pollenReceivedMessage(payload.pollen, payload.target, session));
  });

  onEvent('pollen:applied', async ({ pollenId, targetUniverseId }) => {
    const payload = findPollenAndTarget(pollenId, targetUniverseId);
    if (!payload) return;
    await postMessage(pollenAdoptionMessage(payload.pollen, payload.target, session));
  });

  onEvent('session:all-complete', async ({ report }) => {
    await postMessage(morningReportMessage(report, session));
  });

  logger.info('slack', `Slack handlers registered for session ${session.id}`);
}
