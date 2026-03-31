import type { AgentType, RuntimeSessionRecord, RuntimeSessionState } from '../types.js';
import { CONVERSATION_PROVIDER_CONTRACTS } from './contracts.js';

export function createRuntimeSessionRecord(
  provider: AgentType,
  nowIso: string = new Date().toISOString(),
): RuntimeSessionRecord {
  const contract = CONVERSATION_PROVIDER_CONTRACTS[provider];
  return {
    provider,
    transport: contract.transport,
    externalSessionId: null,
    state: 'booting',
    currentStep: 'Initializing provider session',
    lastActivityAt: nowIso,
    lastSequence: 0,
    pendingQuestion: null,
    pendingReply: null,
    transcriptTail: [],
  };
}

export function updateRuntimeSessionRecord(
  record: RuntimeSessionRecord,
  update: Partial<Omit<RuntimeSessionRecord, 'provider' | 'transport'>>,
): RuntimeSessionRecord {
  return {
    ...record,
    ...update,
  };
}

export function withRuntimeSessionState(
  record: RuntimeSessionRecord,
  state: RuntimeSessionState,
  nowIso: string = new Date().toISOString(),
  currentStep: string | null = record.currentStep,
): RuntimeSessionRecord {
  return updateRuntimeSessionRecord(record, {
    state,
    currentStep,
    lastActivityAt: nowIso,
  });
}

export function appendTranscriptTail(
  record: RuntimeSessionRecord,
  entry: string,
  maxEntries: number = 20,
): RuntimeSessionRecord {
  const trimmedEntry = entry.trim();
  if (trimmedEntry.length === 0) {
    return record;
  }

  const transcriptTail = [...record.transcriptTail, trimmedEntry].slice(-maxEntries);
  return updateRuntimeSessionRecord(record, { transcriptTail });
}
