import { Box, Text, render as inkRender, type Instance, type RenderOptions } from 'ink';
import type { ReactNode } from 'react';
import type { PresenterModel, UniversePresenterRow } from '../runtime/presenter-model.js';
import { summarizePresenterRows } from '../runtime/presenter-model.js';

export const HERO_BANNER_LINES = [
  '      .-..-.      .-..-.      .-..-.',
  '   .-( SU )-.  .-( PE )-.  .-( ++ )-.',
  '  (___.---.__)(___.---.__)(___.---.__)',
  '        SUPE :: PARALLEL UNIVERSE ORCHESTRATOR',
] as const;

export const COMPACT_BANNER_LINES = [
  '== SUPE :: PARALLEL UNIVERSE ==',
] as const;

export const PULSE_FRAMES = [
  '[=     ]',
  '[==    ]',
  '[ ===  ]',
  '[  === ]',
  '[   ===]',
  '[    ==]',
  '[     =]',
  '[    ==]',
  '[   ===]',
  '[  === ]',
  '[ ===  ]',
  '[==    ]',
] as const;

export const PULSE_MESSAGES = [
  'syncing universes...',
  'resolving dimensions...',
  'starting runtimes...',
  'stabilizing multiverse...',
] as const;

export interface DashboardFrameProps {
  model: PresenterModel;
  startedAt: string;
  nowIso: string;
  pulseFrame: number;
  width?: number;
  statusMessage?: string | null;
  pollenEnabled?: boolean;
  pulseActive?: boolean;
  detailLines?: string[];
}

export interface MountInkDashboardOptions {
  stderr?: NodeJS.WriteStream;
  stdin?: NodeJS.ReadStream;
  stdout?: NodeJS.WriteStream;
  renderImpl?: (
    node: ReactNode,
    options?: RenderOptions,
  ) => Pick<Instance, 'rerender' | 'unmount' | 'waitUntilExit' | 'clear' | 'cleanup'>;
}

export interface MountedSessionDashboard {
  rerender(nextProps: DashboardFrameProps): void;
  unmount(): void;
  waitUntilExit(): Promise<void>;
  clear(): void;
  cleanup(): void;
}

export function selectParallelUniverseBanner(width: number = 100): string[] {
  return width >= 72 ? [...HERO_BANNER_LINES] : [...COMPACT_BANNER_LINES];
}

export const selectBootBanner = selectParallelUniverseBanner;

export function isAsciiSafeBanner(lines: readonly string[]): boolean {
  return lines.every((line) => /^[\x20-\x7E]*$/.test(line));
}

export function buildDashboardLines(input: DashboardFrameProps): string[] {
  return renderDashboardFrame(input);
}

export function renderDashboardFrame(input: DashboardFrameProps): string[] {
  const width = input.width ?? 100;
  const summary = summarizePresenterRows(input.model.rows);
  const activeCount = Math.max(0, summary.activeCount - summary.waitingCount);
  const pulseFrame = input.pulseActive === false
    ? '[      ]'
    : PULSE_FRAMES[input.pulseFrame % PULSE_FRAMES.length];
  const pulseMessage = input.statusMessage ?? PULSE_MESSAGES[input.pulseFrame % PULSE_MESSAGES.length];

  return [
    ...selectParallelUniverseBanner(width),
    '',
    'Opening rifts in spacetime...',
    `${pulseFrame} ${pulseMessage}`,
    '',
    `Session ${input.model.sessionId} | universes ${input.model.rows.length} | active ${activeCount} | elapsed ${formatElapsed(input.startedAt, input.nowIso)} | pollen ${input.pollenEnabled ? 'on' : 'off'}`,
    '',
    ...input.model.rows.map((row) => formatUniverseRow(row, input.nowIso, width)),
    '',
    ...(input.detailLines && input.detailLines.length > 0
      ? ['Focused universe:', ...input.detailLines, '']
      : []),
    `Activity summary | completed ${summary.completedCount} | waiting ${summary.waitingCount} | failed ${summary.failedCount}`,
    `Multiverse activity | ${summary.activeCount} universes active | ${summary.toolCount} tool lanes active | ${summary.waitingCount} waiting for user`,
  ];
}

export function RuntimeDashboard(props: DashboardFrameProps): ReactNode {
  const lines = renderDashboardFrame(props);
  return (
    <Box flexDirection="column">
      {lines.map((line, index) => (
        <Text key={`${index}-${line}`}>{line}</Text>
      ))}
    </Box>
  );
}

export function mountSessionDashboard(
  props: DashboardFrameProps,
  options?: MountInkDashboardOptions,
): MountedSessionDashboard {
  const renderImpl = options?.renderImpl ?? inkRender;
  const instance = renderImpl(<RuntimeDashboard {...props} />, {
    stdout: options?.stdout,
    stdin: options?.stdin,
    stderr: options?.stderr,
  });

  return {
    rerender(nextProps: DashboardFrameProps) {
      instance.rerender(<RuntimeDashboard {...nextProps} />);
    },
    unmount() {
      instance.unmount();
    },
    waitUntilExit() {
      return instance.waitUntilExit ? instance.waitUntilExit() : Promise.resolve();
    },
    clear() {
      instance.clear?.();
    },
    cleanup() {
      instance.cleanup?.();
    },
  };
}

function formatUniverseRow(
  row: UniversePresenterRow,
  nowIso: string,
  width: number,
): string {
  const provider = row.provider.toUpperCase().padEnd(6, ' ');
  const state = formatStateLabel(row.state).padEnd(width >= 96 ? 14 : 10, ' ');
  const stepWidth = width >= 96 ? 34 : 20;
  const step = padAndTrim(row.currentStep ?? 'Waiting for update', stepWidth);
  const criteria = `${row.criteriaDone}/${row.criteriaTotal}`.padStart(5, ' ');
  const activity = formatLastActivity(row.lastActivityAt, nowIso);

  if (width >= 96) {
    return `${row.symbol} ${provider} ${state} ${step} criteria ${criteria} ${activity}`;
  }

  return `${row.symbol} ${provider.trim()} ${state.trim()} ${step} c:${criteria.trim()} ${activity}`;
}

function formatStateLabel(state: UniversePresenterRow['state']): string {
  switch (state) {
    case 'tool_running':
      return 'TOOL';
    case 'writing_output':
      return 'WRITING';
    case 'waiting_for_user':
      return 'WAITING';
    case 'completed':
      return 'DONE';
    default:
      return String(state).toUpperCase();
  }
}

function formatLastActivity(lastActivityAt: string | null, nowIso: string): string {
  if (!lastActivityAt) {
    return 'active --';
  }

  const deltaMs = Date.parse(nowIso) - Date.parse(lastActivityAt);
  if (!Number.isFinite(deltaMs) || deltaMs < 1_500) {
    return 'active now';
  }

  const seconds = Math.max(1, Math.round(deltaMs / 1_000));
  return `active ${seconds}s ago`;
}

function formatElapsed(startedAt: string, nowIso: string): string {
  const deltaSeconds = Math.max(0, Math.floor((Date.parse(nowIso) - Date.parse(startedAt)) / 1_000));
  const minutes = Math.floor(deltaSeconds / 60);
  const seconds = deltaSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function padAndTrim(value: string, width: number): string {
  if (value.length === width) {
    return value;
  }
  if (value.length < width) {
    return value.padEnd(width, ' ');
  }
  if (width <= 3) {
    return value.slice(0, width);
  }
  return `${value.slice(0, width - 3)}...`;
}
