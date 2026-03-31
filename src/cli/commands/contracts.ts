import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getContractSnapshot } from '../../app/contracts-service.js';
import { configureJsonOutput, printJsonSuccess } from '../output.js';

const REPO_ROOT = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));

export async function contractsCommand(opts: Record<string, unknown> = {}): Promise<void> {
  const jsonMode = Boolean(opts.json);
  configureJsonOutput(jsonMode);

  try {
    const snapshot = getContractSnapshot(REPO_ROOT);
    if (jsonMode) {
      printJsonSuccess(snapshot);
      return;
    }

    console.log(`Supe contract version: ${snapshot.contractVersion}`);
    console.log('Exit codes:');
    for (const [name, value] of Object.entries(snapshot.exitCodes)) {
      console.log(`- ${name}: ${value}`);
    }
    console.log('Host capabilities:');
    for (const [name, value] of Object.entries(snapshot.hostCapabilities)) {
      console.log(`- ${name}: json=${value.supportsJsonOutput} mcp=${value.supportsMcp} interactive=${value.supportsInteractivePrompts}`);
    }
    console.log('Runtime contracts:');
    for (const [name, value] of Object.entries(snapshot.runtimeContracts)) {
      console.log(
        `- ${name}: nonInteractive=${value.supportsNonInteractiveExecution} streaming=${value.supportsStreamingOutput} ` +
          `conversation=${value.supportsConversationalSessions} resume=${value.supportsSessionResume} ` +
          `structuredInput=${value.supportsStructuredUserInput} promptTransport=${value.promptTransport} ` +
          `interactiveTransport=${value.interactiveTransport} tty=${value.canonicalTtyPresenter}`,
      );
    }
    console.log('Conversation providers:');
    for (const [name, value] of Object.entries(snapshot.conversationProviders)) {
      console.log(
        `- ${name}: transport=${value.transport} longLived=${value.supportsLongLivedSessions} ` +
          `streaming=${value.supportsStreamingDeltas} resume=${value.supportsSessionResume} ` +
          `structuredInput=${value.supportsStructuredUserInput} tty=${value.canonicalTtyPresenter}`,
      );
    }
    console.log('Schema paths:');
    for (const [name, value] of Object.entries(snapshot.schemaPaths)) {
      console.log(`- ${name}: ${value}`);
    }
  } finally {
    configureJsonOutput(false);
  }
}
