import { loadRunningOrSpecificSession } from '../../app/session-service.js';
import { stopSession } from '../../app/stop-service.js';
import { SessionManager } from '../../core/session.js';
import { SUPE_EXIT_CODES, makeSessionJsonData } from '../../app/contracts.js';
import { configureJsonOutput, printJsonError, printJsonSuccess } from '../output.js';

export async function stopCommand(sessionId?: string, opts: Record<string, unknown> = {}): Promise<void> {
  const jsonMode = Boolean(opts.json);
  configureJsonOutput(jsonMode);
  const sessionManager = new SessionManager();

  try {
    const session = await loadRunningOrSpecificSession(sessionManager, sessionId);
    if (!session) {
      process.exitCode = SUPE_EXIT_CODES.NOT_FOUND;
      if (jsonMode) {
        printJsonError('not_found', 'No session found to stop.');
      } else {
        console.error('No session found to stop.');
      }
      return;
    }

    if (session.status !== 'running') {
      process.exitCode = SUPE_EXIT_CODES.INVALID_REQUEST;
      if (jsonMode) {
        printJsonError('invalid_request', `Session ${session.id} is not running.`, {
          status: session.status,
        });
      } else {
        console.error(`Session ${session.id} is not running (status: ${session.status}).`);
      }
      return;
    }

    const stopped = await stopSession(sessionManager, session);
    const killedProcesses = stopped.killedProcesses;
    for (const killed of killedProcesses) {
      if (!jsonMode) {
        console.log(`Killed agent process ${killed.pid} for universe ${killed.symbol}`);
      }
    }

    if (jsonMode) {
      printJsonSuccess({
        ...makeSessionJsonData(session),
        stopped: true,
        killedProcesses,
      });
      return;
    }

    console.log(`Stopped session ${session.id}.`);
  } finally {
    configureJsonOutput(false);
    sessionManager.destroy();
  }
}
