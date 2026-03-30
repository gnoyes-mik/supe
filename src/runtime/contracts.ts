import type { AgentType, RuntimeSessionState, RuntimeTransport } from '../types.js';

export type RuntimeEventType =
  | 'session_started'
  | 'assistant_delta'
  | 'assistant_message'
  | 'tool_started'
  | 'tool_finished'
  | 'file_changed'
  | 'commit_created'
  | 'progress_hint'
  | 'needs_user_input'
  | 'heartbeat'
  | 'completed'
  | 'failed';

export interface RuntimeEventBase {
  type: RuntimeEventType;
  universeId: string;
  provider: AgentType;
  sequence: number;
  timestamp: string;
}

export interface RuntimeTurnInput {
  text: string;
  submittedAt: string;
}

export interface RuntimeSessionHandle {
  universeId: string;
  provider: AgentType;
  externalSessionId: string | null;
}

export interface SessionStartedRuntimeEvent extends RuntimeEventBase {
  type: 'session_started';
  externalSessionId: string | null;
}

export interface AssistantDeltaRuntimeEvent extends RuntimeEventBase {
  type: 'assistant_delta';
  text: string;
}

export interface AssistantMessageRuntimeEvent extends RuntimeEventBase {
  type: 'assistant_message';
  text: string;
}

export interface ToolStartedRuntimeEvent extends RuntimeEventBase {
  type: 'tool_started';
  toolName: string;
  detail: string | null;
}

export interface ToolFinishedRuntimeEvent extends RuntimeEventBase {
  type: 'tool_finished';
  toolName: string;
  ok: boolean;
}

export interface FileChangedRuntimeEvent extends RuntimeEventBase {
  type: 'file_changed';
  path: string;
}

export interface CommitCreatedRuntimeEvent extends RuntimeEventBase {
  type: 'commit_created';
  message: string;
}

export interface ProgressHintRuntimeEvent extends RuntimeEventBase {
  type: 'progress_hint';
  label: string;
}

export interface NeedsUserInputRuntimeEvent extends RuntimeEventBase {
  type: 'needs_user_input';
  question: string;
}

export interface HeartbeatRuntimeEvent extends RuntimeEventBase {
  type: 'heartbeat';
  phase: RuntimeSessionState;
}

export interface CompletedRuntimeEvent extends RuntimeEventBase {
  type: 'completed';
}

export interface FailedRuntimeEvent extends RuntimeEventBase {
  type: 'failed';
  error: string;
}

export type RuntimeEvent =
  | SessionStartedRuntimeEvent
  | AssistantDeltaRuntimeEvent
  | AssistantMessageRuntimeEvent
  | ToolStartedRuntimeEvent
  | ToolFinishedRuntimeEvent
  | FileChangedRuntimeEvent
  | CommitCreatedRuntimeEvent
  | ProgressHintRuntimeEvent
  | NeedsUserInputRuntimeEvent
  | HeartbeatRuntimeEvent
  | CompletedRuntimeEvent
  | FailedRuntimeEvent;

export type ControlPlaneAction = 'reply' | 'cancel' | 'interrupt' | 'timeout';

export interface ConversationProviderStartOptions {
  universeId: string;
  prompt: string;
}

export interface ConversationProviderResumeOptions {
  universeId: string;
  externalSessionId: string;
}

export interface ConversationProviderContract {
  provider: AgentType;
  transport: RuntimeTransport;
  supportsLongLivedSessions: boolean;
  supportsStreamingDeltas: boolean;
  supportsSessionResume: boolean;
  supportsStructuredUserInput: boolean;
  canonicalTtyPresenter: 'ink';
}

export interface ConversationProvider {
  readonly provider: AgentType;
  startSession(options: ConversationProviderStartOptions): Promise<RuntimeSessionHandle>;
  resumeSession(options: ConversationProviderResumeOptions): Promise<RuntimeSessionHandle>;
  sendTurn(handle: RuntimeSessionHandle, turn: RuntimeTurnInput): Promise<void>;
  interrupt(handle: RuntimeSessionHandle): Promise<void>;
  close(handle: RuntimeSessionHandle): Promise<void>;
}

export const CONVERSATION_PROVIDER_CONTRACTS: Record<AgentType, ConversationProviderContract> = {
  claude: {
    provider: 'claude',
    transport: 'stream-json',
    supportsLongLivedSessions: true,
    supportsStreamingDeltas: true,
    supportsSessionResume: true,
    supportsStructuredUserInput: false,
    canonicalTtyPresenter: 'ink',
  },
  codex: {
    provider: 'codex',
    transport: 'app-server',
    supportsLongLivedSessions: true,
    supportsStreamingDeltas: true,
    supportsSessionResume: true,
    supportsStructuredUserInput: true,
    canonicalTtyPresenter: 'ink',
  },
};

export interface RuntimeResumeContract {
  owner: 'conversation-manager';
  dispositionsRequiringReview: readonly (
    | 'partial_turn'
    | 'inflight_tool'
    | 'provider_restart'
  )[];
  supportedActions: readonly ControlPlaneAction[];
}

export const DEFAULT_RUNTIME_RESUME_CONTRACT: RuntimeResumeContract = {
  owner: 'conversation-manager',
  dispositionsRequiringReview: ['partial_turn', 'inflight_tool', 'provider_restart'],
  supportedActions: ['reply', 'cancel', 'interrupt', 'timeout'],
};
