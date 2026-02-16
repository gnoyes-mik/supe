import { SessionManager } from '../../core/session.js';
import type { Session } from '../../types.js';

export async function stopCommand(sessionId?: string): Promise<void> {
  const sessionManager = new SessionManager();

  try {
    const session = await loadTargetSession(sessionManager, sessionId);
    if (!session) {
      console.error('No session found to stop.');
      process.exitCode = 1;
      return;
    }

    if (session.status !== 'running') {
      console.error(`Session ${session.id} is not running (status: ${session.status}).`);
      process.exitCode = 1;
      return;
    }

    sessionManager.updateStatus(session, 'cancelled');
    await sessionManager.saveSession(session);

    console.log(`Stopped session ${session.id}.`);
  } finally {
    sessionManager.destroy();
  }
}

async function loadTargetSession(
  sessionManager: SessionManager,
  sessionId?: string
): Promise<Session | null> {
  if (typeof sessionId === 'string' && sessionId.trim().length > 0) {
    return sessionManager.loadSession(sessionId.trim());
  }

  const listed = await sessionManager.listSessions();
  const running = listed.find((item) => item.status === 'running');
  if (!running) {
    return null;
  }

  return sessionManager.loadSession(running.id);
}
