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

  const orchestrator = new Orchestrator(
    sessionManager,
    session,
    config.agents as Record<string, AgentConfig>,
  );
  await orchestrator.start();

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
