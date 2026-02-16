import { SessionManager } from '../../core/session.js';
import type { SessionStatus } from '../../types.js';

interface SessionRow {
  id: string;
  status: SessionStatus;
  title: string;
  universeCount: number;
  createdAt: string;
}

export async function listCommand(): Promise<void> {
  const sessionManager = new SessionManager();

  try {
    const listed = await sessionManager.listSessions();
    if (listed.length === 0) {
      console.log('No sessions found.');
      return;
    }

    const rows: SessionRow[] = [];
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

    const idWidth = Math.max(2, ...rows.map((row) => row.id.length));
    const statusWidth = Math.max(6, ...rows.map((row) => row.status.length));
    const titleWidth = Math.max(4, ...rows.map((row) => row.title.length));
    const universeWidth = Math.max(9, ...rows.map((row) => String(row.universeCount).length));

    console.log(
      `${pad('ID', idWidth)}  ${pad('Status', statusWidth)}  ${pad('Spec Title', titleWidth)}  ` +
        `${pad('Universes', universeWidth)}  Created`
    );

    for (const row of rows) {
      console.log(
        `${pad(row.id, idWidth)}  ${pad(row.status, statusWidth)}  ${pad(row.title, titleWidth)}  ` +
          `${pad(String(row.universeCount), universeWidth)}  ${formatRelativeTime(row.createdAt)}`
      );
    }
  } finally {
    sessionManager.destroy();
  }
}

function pad(input: string, width: number): string {
  return input.padEnd(width);
}

function formatRelativeTime(isoDate: string): string {
  const ts = Date.parse(isoDate);
  if (Number.isNaN(ts)) {
    return 'unknown';
  }

  const deltaMs = Date.now() - ts;
  const absMs = Math.abs(deltaMs);

  const minutes = Math.floor(absMs / (60 * 1000));
  if (minutes < 1) {
    return 'just now';
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
