import type { SessionManager } from '../core/session.js';
import type { Session, SessionStatus } from '../types.js';

export interface SessionListRow {
  id: string;
  status: SessionStatus;
  title: string;
  universeCount: number;
  createdAt: string;
}

export async function loadSelectedSession(
  sessionManager: SessionManager,
  sessionId?: string,
): Promise<Session | null> {
  if (typeof sessionId === 'string' && sessionId.trim().length > 0) {
    return loadSpecificSession(sessionManager, sessionId.trim());
  }
  return sessionManager.getLatestSession();
}

export async function loadRunningOrSpecificSession(
  sessionManager: SessionManager,
  sessionId?: string,
): Promise<Session | null> {
  if (typeof sessionId === 'string' && sessionId.trim().length > 0) {
    return loadSpecificSession(sessionManager, sessionId.trim());
  }

  const listed = await sessionManager.listSessions();
  const running = listed.find((item) => item.status === 'running');
  if (!running) {
    return null;
  }

  return sessionManager.loadSession(running.id);
}

export async function listSessionsDetailed(
  sessionManager: SessionManager,
): Promise<SessionListRow[]> {
  const listed = await sessionManager.listSessions();
  const rows: SessionListRow[] = [];

  for (const listedSession of listed) {
    try {
      const full = await sessionManager.loadSession(listedSession.id);
      rows.push({
        id: listedSession.id,
        status: listedSession.status,
        title: listedSession.title,
        universeCount: full.universes.length,
        createdAt: listedSession.startedAt,
      });
    } catch {
      rows.push({
        id: listedSession.id,
        status: listedSession.status,
        title: listedSession.title,
        universeCount: 0,
        createdAt: listedSession.startedAt,
      });
    }
  }

  return rows;
}

export async function loadSpecificSession(
  sessionManager: SessionManager,
  sessionId: string,
): Promise<Session | null> {
  try {
    return await sessionManager.loadSession(sessionId);
  } catch {
    return null;
  }
}
