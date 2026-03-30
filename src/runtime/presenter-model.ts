import type { AgentType, RuntimeSessionState } from '../types.js';

export type TerminalPresenterMode = 'ink-dashboard' | 'plain-text' | 'json';

export interface PresenterLaunchContext {
  jsonMode: boolean;
  dashboardEnabled: boolean;
  isTTY: boolean;
}

export interface UniversePresenterRow {
  universeId: string;
  symbol: string;
  provider: AgentType;
  state: RuntimeSessionState;
  currentStep: string | null;
  criteriaDone: number;
  criteriaTotal: number;
  lastActivityAt: string | null;
  highlight: 'normal' | 'waiting' | 'failed' | 'completed';
}

export interface PresenterModel {
  mode: TerminalPresenterMode;
  sessionId: string;
  rows: UniversePresenterRow[];
}

export function resolveTerminalPresenterMode(
  context: PresenterLaunchContext,
): TerminalPresenterMode {
  if (context.jsonMode) {
    return 'json';
  }

  if (context.isTTY && context.dashboardEnabled) {
    return 'ink-dashboard';
  }

  return 'plain-text';
}

export function shouldRenderInteractiveBootSequence(
  context: PresenterLaunchContext,
): boolean {
  return resolveTerminalPresenterMode(context) === 'ink-dashboard';
}
