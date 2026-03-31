import type { Session } from '../types.js';
import type { SessionManager } from '../core/session.js';

export function queueUniverseReply(
  session: Session,
  universeSelector: string | undefined,
  reply: string,
): Session {
  const target = resolveTargetUniverse(session, universeSelector);
  if (!target.runtimeSession) {
    throw new Error(`Universe ${target.config.symbol} has no active runtime session to reply to.`);
  }

  target.runtimeSession.pendingReply = reply;
  target.runtimeSession.pendingQuestion = null;
  target.runtimeSession.currentStep = 'Queued user reply';
  target.runtimeSession.state = 'ready';
  target.runtimeSession.lastActivityAt = new Date().toISOString();
  target.status = 'running';
  target.error = null;
  session.status = 'running';
  return session;
}

export async function queueUniverseReplyAndSave(
  sessionManager: SessionManager,
  session: Session,
  universeSelector: string | undefined,
  reply: string,
): Promise<Session> {
  const updated = queueUniverseReply(session, universeSelector, reply);
  await sessionManager.saveSession(updated);
  return updated;
}

function resolveTargetUniverse(session: Session, selector?: string) {
  const waiting = session.universes.filter((universe) => universe.runtimeSession?.pendingQuestion);
  if (!selector) {
    if (waiting.length === 1) {
      return waiting[0];
    }
    if (waiting.length > 1) {
      throw new Error('Multiple universes are waiting for user input. Specify --universe.');
    }
    throw new Error('No waiting universe found to receive a reply.');
  }

  const trimmed = selector.trim();
  const byId = session.universes.find((universe) => universe.id === trimmed);
  if (byId) {
    return byId;
  }

  const normalized = trimmed.toLowerCase();
  const bySymbol = session.universes.find((universe) => universe.config.symbol.toLowerCase() === normalized);
  if (bySymbol) {
    return bySymbol;
  }

  throw new Error(`Universe ${selector} was not found in session ${session.id}.`);
}
