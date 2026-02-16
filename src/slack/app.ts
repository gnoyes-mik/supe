import { App } from '@slack/bolt';
import { EventEmitter } from 'events';
import type { Session, SlackConfig, Universe } from '../types.js';
import { logger } from '../utils/logger.js';
import { registerSlackHandlers } from './handlers.js';
import { sessionStartMessage, universeThreadMessage } from './messages.js';

export function createSlackApp(config: SlackConfig): App {
  return new App({
    token: config.botToken,
    appToken: config.appToken,
    socketMode: true,
  });
}

function ensureThreadMap(universes: Universe[], threadTsMap: Record<string, string>): void {
  for (const universe of universes) {
    if (!threadTsMap[universe.id]) {
      threadTsMap[universe.id] = '';
    }
  }
}

export async function initializeSlack(
  session: Session,
  slackApp: App,
  emitter: EventEmitter,
): Promise<void> {
  if (!session.slack) {
    logger.warn('slack', `Slack initialization skipped for session ${session.id}: slack disabled`);
    return;
  }

  try {
    const mainMessage = await slackApp.client.chat.postMessage(sessionStartMessage(session));
    session.slack.mainMessageTs = mainMessage.ts ?? '';

    ensureThreadMap(session.universes, session.slack.threadTsMap);

    for (const universe of session.universes) {
      const threadAnchor = await slackApp.client.chat.postMessage(
        universeThreadMessage(universe, session),
      );
      session.slack.threadTsMap[universe.id] = threadAnchor.ts ?? '';
    }

    registerSlackHandlers(session, emitter, slackApp);
    logger.info('slack', `Slack initialized for session ${session.id}`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('slack', `Failed to initialize Slack for session ${session.id}: ${errorMessage}`);
    throw error;
  }
}
