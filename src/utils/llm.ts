import Anthropic from '@anthropic-ai/sdk';
import { spawn } from 'child_process';
import { mkdtemp, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { getAgentRunner } from '../agents/base.js';
import type { AgentConfig, AgentType, GlobalConfig, LlmConfig } from '../types.js';
import { logger } from './logger.js';

interface AnalysisClient {
  call(
    prompt: string,
    options?: {
      model?: string;
      maxTokens?: number;
      systemPrompt?: string;
    },
  ): Promise<string>;
}

let client: AnalysisClient | null = null;

export function initLlmClient(
  llmConfig: LlmConfig,
  agentsConfig?: Record<AgentType, AgentConfig>,
): void {
  if (llmConfig.analysisProvider === 'anthropic-api') {
    client = new AnthropicApiClient(llmConfig);
    return;
  }

  if (llmConfig.analysisProvider === 'claude-cli') {
    if (!agentsConfig?.claude) {
      throw new Error('Claude CLI analysis backend requires configured claude agent settings.');
    }
    client = new CliAnalysisClient('claude', agentsConfig.claude);
    return;
  }

  if (llmConfig.analysisProvider === 'codex-cli') {
    if (!agentsConfig?.codex) {
      throw new Error('Codex CLI analysis backend requires configured codex agent settings.');
    }
    client = new CliAnalysisClient('codex', agentsConfig.codex);
    return;
  }

  throw new Error(`Unsupported analysis provider: ${llmConfig.analysisProvider}`);
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
  return client.call(prompt, options);
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

class AnthropicApiClient implements AnalysisClient {
  private client: Anthropic;
  private llmConfig: LlmConfig;

  constructor(llmConfig: LlmConfig) {
    this.llmConfig = llmConfig;
    this.client = new Anthropic({ apiKey: llmConfig.apiKey });
  }

  async call(
    prompt: string,
    options: {
      model?: string;
      maxTokens?: number;
      systemPrompt?: string;
    } = {},
  ): Promise<string> {
    const model = options.model ?? this.llmConfig.analysisModel ?? 'claude-sonnet-4-20250514';
    const maxTokens = options.maxTokens ?? 4096;
    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: prompt },
    ];

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await this.client.messages.create({
          model,
          max_tokens: maxTokens,
          system: options.systemPrompt ?? undefined,
          messages,
        });

        const textBlock = response.content.find((block) => block.type === 'text');
        if (!textBlock || textBlock.type !== 'text') {
          throw new Error('No text content in LLM response');
        }
        return textBlock.text;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn('session', `LLM call failed (attempt ${attempt + 1}/3): ${lastError.message}`);
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }

    throw lastError ?? new Error('LLM call failed after 3 attempts');
  }
}

class CliAnalysisClient implements AnalysisClient {
  private type: AgentType;
  private config: AgentConfig;

  constructor(type: AgentType, config: AgentConfig) {
    this.type = type;
    this.config = config;
  }

  async call(
    prompt: string,
    options: {
      model?: string;
      maxTokens?: number;
      systemPrompt?: string;
    } = {},
  ): Promise<string> {
    void options.model;
    void options.maxTokens;

    const runner = getAgentRunner(this.type);
    const fullPrompt = options.systemPrompt
      ? `[SYSTEM]\n${options.systemPrompt}\n\n[USER]\n${prompt}`
      : prompt;

    const command = runner.buildCommand(this.config);
    let args = runner.buildArgs(this.config, fullPrompt);
    let lastMessageFile: string | null = null;

    if (this.type === 'codex') {
      const tempDir = await mkdtemp(join(tmpdir(), 'supe-codex-'));
      lastMessageFile = join(tempDir, 'last-message.txt');
      args = [...this.config.args, 'exec', '--json', '--output-last-message', lastMessageFile, fullPrompt];
    }

    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, {
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      proc.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      proc.on('error', reject);
      proc.on('close', async (code) => {
        if ((code ?? 1) !== 0) {
          if (lastMessageFile) {
            await cleanupTempFile(lastMessageFile);
          }
          reject(new Error(
            `${this.type} CLI analysis failed with code ${code ?? 1}: ${stderr.trim() || stdout.trim()}`,
          ));
          return;
        }
        if (lastMessageFile) {
          try {
            const content = (await readFile(lastMessageFile, 'utf8')).trim();
            await cleanupTempFile(lastMessageFile);
            resolve(content);
            return;
          } catch (error) {
            await cleanupTempFile(lastMessageFile);
            reject(error);
            return;
          }
        }

        resolve(stdout.trim());
      });
    });
  }
}

async function cleanupTempFile(file: string): Promise<void> {
  const dir = file.slice(0, file.lastIndexOf('/'));
  await rm(file, { force: true }).catch(() => {});
  await rm(dir, { recursive: true, force: true }).catch(() => {});
}
