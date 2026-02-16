import Anthropic from '@anthropic-ai/sdk';
import type { LlmConfig } from '../types.js';
import { logger } from './logger.js';

let client: Anthropic | null = null;

export function initLlmClient(config: LlmConfig): void {
  client = new Anthropic({ apiKey: config.apiKey });
}

export async function callLlm(
  prompt: string,
  options: {
    model?: string;
    maxTokens?: number;
    systemPrompt?: string;
  } = {}
): Promise<string> {
  if (!client) {
    throw new Error('LLM client not initialized. Call initLlmClient first.');
  }

  const model = options.model ?? 'claude-sonnet-4-20250514';
  const maxTokens = options.maxTokens ?? 4096;

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: prompt },
  ];

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system: options.systemPrompt ?? undefined,
        messages,
      });

      const textBlock = response.content.find(b => b.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        throw new Error('No text content in LLM response');
      }
      return textBlock.text;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn('session', `LLM call failed (attempt ${attempt + 1}/3): ${lastError.message}`);
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }

  throw lastError ?? new Error('LLM call failed after 3 attempts');
}

export async function callLlmJson<T>(
  prompt: string,
  options: {
    model?: string;
    maxTokens?: number;
    systemPrompt?: string;
  } = {}
): Promise<T> {
  const raw = await callLlm(prompt, options);
  
  let jsonStr = raw.trim();
  
  const fenceMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  }

  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    throw new Error(`Failed to parse LLM response as JSON: ${jsonStr.slice(0, 200)}`);
  }
}
