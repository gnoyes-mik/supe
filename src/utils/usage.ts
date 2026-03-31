import type { TokenUsage, TurnUsage, UniverseUsageSummary } from '../types.js';

export function createEmptyUsageSummary(): UniverseUsageSummary {
  return {
    turns: [],
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheCreationTokens: 0,
    totalCacheReadTokens: 0,
    totalCostUsd: 0,
  };
}

export function addTurnToUsageSummary(
  summary: UniverseUsageSummary,
  turn: TurnUsage,
): UniverseUsageSummary {
  return {
    turns: [...summary.turns, turn],
    totalInputTokens: summary.totalInputTokens + turn.usage.inputTokens,
    totalOutputTokens: summary.totalOutputTokens + turn.usage.outputTokens,
    totalCacheCreationTokens: summary.totalCacheCreationTokens + turn.usage.cacheCreationInputTokens,
    totalCacheReadTokens: summary.totalCacheReadTokens + turn.usage.cacheReadInputTokens,
    totalCostUsd: turn.costUsd,
  };
}
