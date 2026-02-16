import type { AgentType, AgentConfig } from '../types.js';

export interface AgentRunner {
  type: AgentType;
  buildCommand(config: AgentConfig): string;
  buildArgs(config: AgentConfig, prompt: string): string[];
}

export function getAgentRunner(type: AgentType): AgentRunner {
  switch (type) {
    case 'claude':
      return new ClaudeRunner();
    case 'codex':
      return new CodexRunner();
    default:
      throw new Error(`Unknown agent type: ${type}`);
  }
}

class ClaudeRunner implements AgentRunner {
  type: AgentType = 'claude';

  buildCommand(config: AgentConfig): string {
    return config.command;
  }

  buildArgs(config: AgentConfig, prompt: string): string[] {
    return [...config.args, '--print', prompt];
  }
}

class CodexRunner implements AgentRunner {
  type: AgentType = 'codex';

  buildCommand(config: AgentConfig): string {
    return config.command;
  }

  buildArgs(config: AgentConfig, prompt: string): string[] {
    return [...config.args, '--prompt', prompt];
  }
}
