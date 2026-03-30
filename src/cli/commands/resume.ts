import { runCommand } from './run.js';

export async function resumeCommand(
  sessionId: string,
  opts: Record<string, unknown> = {},
): Promise<void> {
  await runCommand({
    ...opts,
    resume: sessionId,
  });
}
