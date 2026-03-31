import type { AgentConfig, AgentType } from '../../types.js';
import type { ConversationProvider } from '../contracts.js';
import { ClaudeStreamJsonProvider } from './claude-stream-json.js';
import { CodexAppServerProvider } from './codex-app-server.js';

export function createConversationProvider(
  provider: AgentType,
  config: AgentConfig,
  cwd: string,
): ConversationProvider {
  switch (provider) {
    case 'codex':
      return new CodexAppServerProvider({
        command: config.command,
        cwd,
      });
    case 'claude':
      return new ClaudeStreamJsonProvider({
        args: config.args,
        command: config.command,
        cwd,
      });
    default:
      throw new Error(`Unsupported conversation provider: ${provider satisfies never}`);
  }
}
