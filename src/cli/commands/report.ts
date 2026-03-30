import { ensureReport, formatReportForTerminal } from '../../app/report-service.js';
import { loadSelectedSession } from '../../app/session-service.js';
import { SessionManager } from '../../core/session.js';
import { SUPE_EXIT_CODES, makeSessionArtifactPaths, makeSessionJsonData } from '../../app/contracts.js';
import { configureJsonOutput, printJsonError, printJsonSuccess } from '../output.js';
import type { Session } from '../../types.js';

export async function reportCommand(sessionId?: string, opts: Record<string, unknown> = {}): Promise<void> {
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

    const report = await ensureReport(session, sessionManager);

    if (jsonMode) {
      printJsonSuccess({
        ...makeSessionJsonData(session),
        artifactPaths: makeSessionArtifactPaths(session),
        report,
      });
      return;
    }

    const output = await formatReportForTerminal(report, session);
    console.log(output);
  } finally {
    configureJsonOutput(false);
    sessionManager.destroy();
  }
}
