import type { SessionManager } from '../core/session.js';
import type { Session } from '../types.js';

export interface StopSessionResult {
  session: Session;
  killedProcesses: Array<{ pid: number; symbol: string }>;
}

export async function stopSession(
  sessionManager: SessionManager,
  session: Session,
): Promise<StopSessionResult> {
  sessionManager.updateStatus(session, 'cancelled');
  await sessionManager.saveSession(session);

  const killedProcesses: Array<{ pid: number; symbol: string }> = [];
  for (const universe of session.universes) {
    if (universe.runtimeSession) {
      universe.runtimeSession.state = 'failed';
      universe.runtimeSession.currentStep = 'Session cancelled';
      universe.runtimeSession.pendingQuestion = null;
      universe.runtimeSession.pendingReply = null;
      universe.runtimeSession.lastActivityAt = new Date().toISOString();
    }
    if (universe.agentProcess.pid) {
      try {
        process.kill(universe.agentProcess.pid, 'SIGTERM');
        killedProcesses.push({
          pid: universe.agentProcess.pid,
          symbol: universe.config.symbol,
        });
      } catch {
        // already exited
      }
    }
  }

  return {
    session,
    killedProcesses,
  };
}
