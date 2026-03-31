import { join } from 'path';
import type { Report, Session, Universe } from '../types.js';
import { getSessionsDir } from '../utils/config.js';
import { CONVERSATION_PROVIDER_CONTRACTS } from '../runtime/contracts.js';

export const SUPE_CONTRACT_VERSION = '2026-03-30';

export const SUPE_EXIT_CODES = {
  SUCCESS: 0,
  FAILURE: 1,
  CLARIFICATION_REQUIRED: 2,
  CONFIRMATION_REQUIRED: 3,
  NOT_FOUND: 4,
  INVALID_REQUEST: 5,
} as const;

export type SupeErrorCode =
  | 'clarification_required'
  | 'confirmation_required'
  | 'not_found'
  | 'invalid_request'
  | 'precondition_failed'
  | 'runtime_failure';

export interface JsonEnvelope<T> {
  contractVersion: typeof SUPE_CONTRACT_VERSION;
  ok: boolean;
  data?: T;
  error?: {
    code: SupeErrorCode;
    message: string;
    details?: unknown;
  };
}

export interface SessionArtifactPaths {
  sessionPath: string;
  specPath: string;
  parsedSpecPath: string;
  problemContractPath: string;
  reportPath: string;
}

export interface UniverseArtifactPaths {
  universeId: string;
  symbol: string;
  path: string;
  promptPath: string;
  solutionSpecPath: string;
  verificationSpecPath: string;
  donePath: string;
}

export interface SessionJsonData {
  sessionId: string;
  status: Session['status'];
  title: string;
  startedAt: string;
  completedAt: string | null;
  artifactPaths: SessionArtifactPaths;
  universes: UniverseArtifactPaths[];
}

export interface RunJsonData extends SessionJsonData {
  report: Report | null;
}

export interface ClarificationJsonData {
  blockingReasons: string[];
  questions: Array<{
    id: string;
    prompt: string;
    why: string;
  }>;
  assumptions: string[];
}

export interface HostCapabilities {
  host: 'cli' | 'mcp' | 'claude-plugin' | 'codex';
  supportsInteractivePrompts: boolean;
  supportsJsonOutput: boolean;
  supportsMcp: boolean;
  supportsPluginInstall: boolean;
}

export interface RuntimeAdapterContract {
  runtime: 'claude' | 'codex';
  supportsStreamingOutput: boolean;
  supportsNonInteractiveExecution: boolean;
  supportsConversationalSessions: boolean;
  supportsSessionResume: boolean;
  supportsStructuredUserInput: boolean;
  promptTransport: 'arg' | 'stdin' | 'file' | 'rpc';
  interactiveTransport: 'stream-json' | 'app-server';
  canonicalTtyPresenter: 'ink';
}

export const HOST_CAPABILITIES_REGISTRY: Record<HostCapabilities['host'], HostCapabilities> = {
  cli: {
    host: 'cli',
    supportsInteractivePrompts: true,
    supportsJsonOutput: true,
    supportsMcp: false,
    supportsPluginInstall: false,
  },
  mcp: {
    host: 'mcp',
    supportsInteractivePrompts: false,
    supportsJsonOutput: true,
    supportsMcp: true,
    supportsPluginInstall: false,
  },
  'claude-plugin': {
    host: 'claude-plugin',
    supportsInteractivePrompts: true,
    supportsJsonOutput: true,
    supportsMcp: true,
    supportsPluginInstall: true,
  },
  codex: {
    host: 'codex',
    supportsInteractivePrompts: false,
    supportsJsonOutput: true,
    supportsMcp: true,
    supportsPluginInstall: false,
  },
};

export const RUNTIME_ADAPTER_CONTRACTS: Record<RuntimeAdapterContract['runtime'], RuntimeAdapterContract> = {
  claude: {
    runtime: 'claude',
    supportsStreamingOutput: true,
    supportsNonInteractiveExecution: true,
    supportsConversationalSessions: true,
    supportsSessionResume: true,
    supportsStructuredUserInput: false,
    promptTransport: 'stdin',
    interactiveTransport: 'stream-json',
    canonicalTtyPresenter: 'ink',
  },
  codex: {
    runtime: 'codex',
    supportsStreamingOutput: true,
    supportsNonInteractiveExecution: true,
    supportsConversationalSessions: true,
    supportsSessionResume: true,
    supportsStructuredUserInput: true,
    promptTransport: 'rpc',
    interactiveTransport: 'app-server',
    canonicalTtyPresenter: 'ink',
  },
};

export const CONVERSATION_PROVIDER_REGISTRY = CONVERSATION_PROVIDER_CONTRACTS;

export function makeSessionArtifactPaths(session: Session): SessionArtifactPaths {
  const sessionPath = join(getSessionsDir(), session.id);
  return {
    sessionPath,
    specPath: join(sessionPath, 'spec.md'),
    parsedSpecPath: join(sessionPath, 'parsed-spec.json'),
    problemContractPath: join(sessionPath, 'problem-contract.json'),
    reportPath: join(sessionPath, 'report.json'),
  };
}

export function makeUniverseArtifactPaths(universe: Universe): UniverseArtifactPaths {
  return {
    universeId: universe.id,
    symbol: universe.config.symbol,
    path: universe.workdir,
    promptPath: universe.promptPath,
    solutionSpecPath: join(universe.workdir, 'solution-spec.md'),
    verificationSpecPath: join(universe.workdir, 'verification-spec.md'),
    donePath: join(universe.workdir, 'DONE.md'),
  };
}

export function makeSessionJsonData(session: Session): SessionJsonData {
  return {
    sessionId: session.id,
    status: session.status,
    title: session.spec.parsed.title,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    artifactPaths: makeSessionArtifactPaths(session),
    universes: session.universes.map(makeUniverseArtifactPaths),
  };
}
