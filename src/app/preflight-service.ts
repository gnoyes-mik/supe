import { spawnSync } from 'child_process';
import type { GlobalConfig } from '../types.js';
import { SupeServiceError } from './errors.js';

export function isLlmConfigured(config: GlobalConfig): boolean {
  if (config.llm.analysisProvider === 'claude-cli') {
    return isLocalCommandReady(config.agents.claude.command);
  }

  if (config.llm.analysisProvider === 'codex-cli') {
    return isLocalCommandReady(config.agents.codex.command);
  }

  if (typeof config.llm.apiKey !== 'string') {
    return false;
  }

  const key = config.llm.apiKey.trim();
  if (key.length === 0) {
    return false;
  }

  if (
    key === 'sk-ant-...'
    || key === 'your-api-key'
    || key.startsWith('${')
  ) {
    return false;
  }

  return true;
}

export function ensureLlmConfigured(config: GlobalConfig): void {
  if (isLlmConfigured(config)) {
    return;
  }

  if (config.llm.analysisProvider === 'claude-cli' || config.llm.analysisProvider === 'codex-cli') {
    throw new SupeServiceError(
      'precondition_failed',
      `Analysis backend ${config.llm.analysisProvider} is not ready. Ensure the local CLI is installed and runnable before starting a session.`,
    );
  }

  throw new SupeServiceError(
    'precondition_failed',
    `LLM API key is not configured for ${config.llm.analysisProvider}. ` +
    'Set the configured API key in ~/.supe/config.json or the matching environment variable before starting a session.',
  );
}

function isLocalCommandReady(command: string): boolean {
  const result = spawnSync(command, ['--version'], {
    encoding: 'utf8',
  });
  return result.status === 0;
}
