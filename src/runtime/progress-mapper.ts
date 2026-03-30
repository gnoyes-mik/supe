import type { RuntimeEvent } from './contracts.js';
import type { RuntimeSessionState } from '../types.js';

export function deriveRuntimeSessionStateFromEvent(
  event: RuntimeEvent,
): RuntimeSessionState {
  switch (event.type) {
    case 'session_started':
      return 'ready';
    case 'assistant_delta':
    case 'assistant_message':
    case 'progress_hint':
    case 'heartbeat':
      return 'thinking';
    case 'tool_started':
      return 'tool_running';
    case 'file_changed':
    case 'commit_created':
      return 'writing_output';
    case 'needs_user_input':
      return 'waiting_for_user';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'tool_finished':
      return 'ready';
    default:
      return 'ready';
  }
}

export function deriveCurrentStepLabelFromEvent(
  event: RuntimeEvent,
): string | null {
  switch (event.type) {
    case 'session_started':
      return 'Provider session established';
    case 'assistant_delta':
      return 'Streaming assistant output';
    case 'assistant_message':
      return 'Assistant response received';
    case 'tool_started':
      return event.detail ? `${event.toolName}: ${event.detail}` : `Running ${event.toolName}`;
    case 'tool_finished':
      return event.ok ? `${event.toolName} completed` : `${event.toolName} failed`;
    case 'file_changed':
      return `Editing ${event.path}`;
    case 'commit_created':
      return `Committed: ${event.message}`;
    case 'progress_hint':
      return event.label;
    case 'needs_user_input':
      return 'Waiting for user input';
    case 'heartbeat':
      return `Heartbeat: ${event.phase}`;
    case 'completed':
      return 'Universe completed';
    case 'failed':
      return event.error;
    default:
      return null;
  }
}
