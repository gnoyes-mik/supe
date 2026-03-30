import { resolve } from 'path';
import { stat } from 'fs/promises';
import type { AgentType, GlobalConfig, SessionConfig } from '../types.js';
import { invalidRequest } from './errors.js';

export function normalizeUniverseCount(value: unknown, fallback: number): number {
  const parsed = typeof value === 'string' || typeof value === 'number'
    ? Number.parseInt(String(value), 10)
    : Number.NaN;
  const candidate = Number.isFinite(parsed) ? parsed : fallback;
  if (candidate < 2) {
    return 2;
  }
  if (candidate > 10) {
    return 10;
  }
  return candidate;
}

export function normalizeAgentType(value: unknown): AgentType | undefined {
  if (value === 'claude' || value === 'codex') {
    return value;
  }
  return undefined;
}

export function resolveAgentAssignments(
  agentsValue: unknown,
  universeCount: number,
  fallbackAgent: AgentType,
): AgentType[] {
  if (typeof agentsValue !== 'string' || agentsValue.trim().length === 0) {
    return Array.from<AgentType>({ length: universeCount }).fill(fallbackAgent);
  }

  const requested = agentsValue
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);

  if (requested.length === 0) {
    throw invalidRequest('`--agents` must include at least one runtime name.');
  }

  const normalized = requested.map((entry) => {
    if (entry === 'claude' || entry === 'codex') {
      return entry as AgentType;
    }
    throw invalidRequest(
      `Unsupported agent in --agents: ${entry}. Supported values are: claude, codex.`,
    );
  });

  return Array.from({ length: universeCount }, (_, idx) => normalized[idx % normalized.length]);
}

export async function resolveBaseRepoPath(value: unknown): Promise<string | null> {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (raw.length === 0) return null;

  const resolved = resolve(raw);
  try {
    const s = await stat(resolved);
    if (!s.isDirectory()) {
      throw new Error(`--base-repo path is not a directory: ${resolved}`);
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('--base-repo')) throw err;
    throw new Error(`--base-repo path does not exist: ${resolved}`);
  }
  return resolved;
}

export function buildSessionConfig(
  input: {
    timeout?: unknown;
    maxCost?: unknown;
    pollenInterval?: unknown;
    pollen?: unknown;
    slack?: unknown;
    dashboard?: unknown;
  },
  config: GlobalConfig,
  universeCount: number,
  defaultAgent: AgentType,
  baseRepoPath: string | null,
): SessionConfig {
  const maxDurationMs = parseDurationToMs(
    input.timeout,
    config.session.maxDurationHours * 60 * 60 * 1000,
  );
  const maxCostUsd = getNumberOpt(input.maxCost, 30);
  const maxCostPerUniverseUsd = Number.isFinite(maxCostUsd / universeCount)
    ? maxCostUsd / universeCount
    : config.agents[defaultAgent].maxCostPerUniverse;
  const pollenIntervalMs = getNumberOpt(input.pollenInterval, config.pollen.cycleIntervalMinutes) * 60 * 1000;
  const slackEnabled = getBooleanOpt(input.slack, false) && Boolean(config.slack.botToken);

  return {
    maxUniverses: universeCount,
    defaultAgent,
    baseRepoPath,
    maxDurationMs,
    maxCostUsd,
    maxCostPerUniverseUsd,
    pollenIntervalMs,
    pollenEnabled: getBooleanOpt(input.pollen, true),
    slackEnabled,
    slackChannel: config.slack.defaultChannel,
    dashboardEnabled: getBooleanOpt(input.dashboard, true),
  };
}

function getBooleanOpt(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function getNumberOpt(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function parseDurationToMs(value: unknown, fallbackMs: number): number {
  if (typeof value !== 'string') {
    return fallbackMs;
  }

  const trimmed = value.trim();
  const match = /^([0-9]+)\s*([hms])$/i.exec(trimmed);
  if (!match) {
    return fallbackMs;
  }

  const amount = Number.parseInt(match[1], 10);
  if (!Number.isFinite(amount) || amount <= 0) {
    return fallbackMs;
  }

  const unit = match[2].toLowerCase();
  if (unit === 'h') {
    return amount * 60 * 60 * 1000;
  }
  if (unit === 'm') {
    return amount * 60 * 1000;
  }
  return amount * 1000;
}
