import type { GlobalConfig } from '../types.js';
import { SupeServiceError } from './errors.js';

export function isLlmConfigured(config: GlobalConfig): boolean {
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

  throw new SupeServiceError(
    'precondition_failed',
    `LLM API key is not configured for ${config.llm.analysisProvider}. ` +
    'Set the configured API key in ~/.supe/config.json or the matching environment variable before starting a session.',
  );
}
