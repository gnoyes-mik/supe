import type {
  AgentType,
  CriterionStatus,
  RuntimeSessionState,
  Session,
  Universe,
  UniverseStatus,
} from '../types.js';

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

export interface PresenterActivitySummary {
  activeCount: number;
  waitingCount: number;
  failedCount: number;
  completedCount: number;
  toolCount: number;
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

export function countCompletedCriteria(criteria: CriterionStatus[]): number {
  return criteria.filter((item) => item.status === 'verified' || item.status === 'likely_done').length;
}

export function createUniversePresenterRow(
  universe: Universe,
  nowIso: string = new Date().toISOString(),
): UniversePresenterRow {
  const state = universe.runtimeSession?.state ?? mapUniverseStatusToRuntimeState(universe.status, universe);

  return {
    universeId: universe.id,
    symbol: universe.config.symbol,
    provider: universe.config.agent,
    state,
    currentStep: deriveCurrentStep(universe, state, nowIso),
    criteriaDone: countCompletedCriteria(universe.progress.criteriaProgress),
    criteriaTotal: universe.progress.criteriaProgress.length,
    lastActivityAt: universe.runtimeSession?.lastActivityAt
      ?? universe.progress.lastActivityAt
      ?? universe.startedAt,
    highlight: highlightForRuntimeState(state),
  };
}

export function createPresenterModelFromSession(
  session: Session,
  mode: TerminalPresenterMode,
  nowIso: string = new Date().toISOString(),
): PresenterModel {
  return {
    mode,
    sessionId: session.id,
    rows: session.universes.map((universe) => createUniversePresenterRow(universe, nowIso)),
  };
}

export function createInitialUniversePresenterRows(
  session: Pick<Session, 'universes' | 'startedAt'>,
): UniversePresenterRow[] {
  return session.universes.map((universe) => ({
    universeId: universe.id,
    symbol: universe.config.symbol,
    provider: universe.config.agent,
    state: 'booting',
    currentStep: 'Preparing universe workspace',
    criteriaDone: countCompletedCriteria(universe.progress.criteriaProgress),
    criteriaTotal: universe.progress.criteriaProgress.length,
    lastActivityAt: universe.runtimeSession?.lastActivityAt
      ?? universe.progress.lastActivityAt
      ?? session.startedAt,
    highlight: 'normal',
  }));
}

export function updateUniversePresenterRow(
  rows: UniversePresenterRow[],
  universeId: string,
  patch: Partial<UniversePresenterRow>,
): UniversePresenterRow[] {
  return rows.map((row) => row.universeId === universeId ? { ...row, ...patch } : row);
}

export function summarizePresenterRows(
  rows: UniversePresenterRow[],
): PresenterActivitySummary {
  return rows.reduce<PresenterActivitySummary>((summary, row) => {
    if (row.state === 'completed') {
      summary.completedCount += 1;
      return summary;
    }

    if (row.state === 'failed') {
      summary.failedCount += 1;
      return summary;
    }

    if (row.state === 'waiting_for_user') {
      summary.waitingCount += 1;
    }

    if (row.state === 'tool_running') {
      summary.toolCount += 1;
    }

    summary.activeCount += 1;
    return summary;
  }, {
    activeCount: 0,
    waitingCount: 0,
    failedCount: 0,
    completedCount: 0,
    toolCount: 0,
  });
}

export function inferRuntimeStateFromCurrentStep(
  currentStep: string | null | undefined,
): RuntimeSessionState {
  const normalized = currentStep?.trim().toLowerCase() ?? '';
  if (normalized.length === 0) {
    return 'thinking';
  }

  if (normalized.includes('wait') || normalized.includes('clarif') || normalized.includes('input')) {
    return 'waiting_for_user';
  }

  if (
    normalized.includes('test')
    || normalized.includes('build')
    || normalized.includes('install')
    || normalized.includes('tool')
    || normalized.includes('command')
    || normalized.includes('npm')
    || normalized.includes('pnpm')
    || normalized.includes('yarn')
    || normalized.includes('bash')
  ) {
    return 'tool_running';
  }

  if (
    normalized.includes('write')
    || normalized.includes('edit')
    || normalized.includes('commit')
    || normalized.includes('file')
    || normalized.includes('save')
    || normalized.includes('patch')
  ) {
    return 'writing_output';
  }

  return 'thinking';
}

export function highlightForRuntimeState(
  state: RuntimeSessionState,
): UniversePresenterRow['highlight'] {
  if (state === 'waiting_for_user') {
    return 'waiting';
  }

  if (state === 'failed') {
    return 'failed';
  }

  if (state === 'completed') {
    return 'completed';
  }

  return 'normal';
}

function mapUniverseStatusToRuntimeState(
  status: UniverseStatus,
  universe: Universe,
): RuntimeSessionState {
  switch (status) {
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'stopped':
      return 'paused';
    case 'running':
      return universe.progress.percentage === 0 && universe.progress.totalCommits <= 2
        ? 'booting'
        : inferRuntimeStateFromCurrentStep(universe.progress.currentPhase);
    case 'pending':
    default:
      return 'booting';
  }
}

function deriveCurrentStep(
  universe: Universe,
  state: RuntimeSessionState,
  nowIso: string,
): string | null {
  if (universe.runtimeSession?.pendingQuestion) {
    return universe.runtimeSession.pendingQuestion;
  }

  if (universe.runtimeSession?.currentStep) {
    return isActivityStale(universe.runtimeSession.lastActivityAt, nowIso, 3_000)
      && state !== 'waiting_for_user'
      && state !== 'completed'
      && state !== 'failed'
      ? 'Waiting on provider'
      : universe.runtimeSession.currentStep;
  }

  if (state === 'booting') {
    return universe.status === 'pending'
      ? 'Preparing universe workspace'
      : 'Opening provider runtime';
  }

  if (state === 'completed') {
    return 'Universe completed';
  }

  if (state === 'failed') {
    return universe.error ?? 'Universe failed';
  }

  if (state === 'paused') {
    return 'Universe paused';
  }

  const phase = universe.progress.currentPhase.trim();
  if (phase.length > 0 && !isActivityStale(universe.progress.lastActivityAt, nowIso, 3_000)) {
    return phase;
  }

  return 'Waiting on provider';
}

function isActivityStale(
  lastActivityAt: string | null,
  nowIso: string,
  thresholdMs: number,
): boolean {
  if (!lastActivityAt) {
    return true;
  }

  const last = Date.parse(lastActivityAt);
  const now = Date.parse(nowIso);
  if (!Number.isFinite(last) || !Number.isFinite(now)) {
    return false;
  }

  return now - last >= thresholdMs;
}
