import type { Universe, TurnUsage } from '../types.js';
import { createEmptyUsageSummary, addTurnToUsageSummary } from '../utils/usage.js';
import {
  appendRuntimeEvent,
} from './event-log.js';
import type {
  ConversationProvider,
  RuntimeEvent,
  RuntimeSessionHandle,
  RuntimeTurnInput,
} from './contracts.js';
import {
  appendTranscriptTail,
  createRuntimeSessionRecord,
  updateRuntimeSessionRecord,
  withRuntimeSessionState,
} from './session-registry.js';
import {
  deriveCurrentStepLabelFromEvent,
  deriveRuntimeSessionStateFromEvent,
} from './progress-mapper.js';

export interface ConversationManagerOptions {
  now?: () => Date;
  onRuntimeEvent?: (event: RuntimeEvent) => void;
}

export class ConversationManager {
  private readonly universe: Universe;
  private readonly provider: ConversationProvider;
  private readonly now: () => Date;
  private readonly onRuntimeEvent?: (event: RuntimeEvent) => void;
  private unsubscribe: (() => void) | null = null;
  private handle: RuntimeSessionHandle | null = null;

  constructor(
    universe: Universe,
    provider: ConversationProvider,
    options: ConversationManagerOptions = {},
  ) {
    this.universe = universe;
    this.provider = provider;
    this.now = options.now ?? (() => new Date());
    this.onRuntimeEvent = options.onRuntimeEvent;
  }

  async startOrResume(initialPrompt: string): Promise<RuntimeSessionHandle> {
    this.ensureSubscribed();

    const existingSessionId = this.universe.runtimeSession?.externalSessionId;
    const nowIso = this.now().toISOString();
    const baseRecord = this.universe.runtimeSession ?? createRuntimeSessionRecord(this.universe.config.agent, nowIso);
    this.universe.runtimeSession = withRuntimeSessionState(
      updateRuntimeSessionRecord(baseRecord, { pendingQuestion: null }),
      'booting',
      nowIso,
      'Opening provider runtime',
    );

    if (existingSessionId) {
      this.handle = await this.provider.resumeSession({
        universeId: this.universe.id,
        externalSessionId: existingSessionId,
      });
    } else {
      this.handle = await this.provider.startSession({
        universeId: this.universe.id,
        prompt: initialPrompt,
      });
    }

    const externalSessionId = this.handle.externalSessionId;
    const startedAt = this.now().toISOString();
    this.universe.runtimeSession = updateRuntimeSessionRecord(
      withRuntimeSessionState(
        this.universe.runtimeSession ?? createRuntimeSessionRecord(this.universe.config.agent, startedAt),
        'ready',
        startedAt,
        'Provider session established',
      ),
      {
        externalSessionId,
      },
    );

    return this.handle;
  }

  async sendTurn(input: RuntimeTurnInput): Promise<void> {
    if (!this.handle) {
      throw new Error(`Runtime session is not started for ${this.universe.id}`);
    }

    await this.provider.sendTurn(this.handle, input);
  }

  async reply(text: string): Promise<void> {
    await this.sendTurn({
      text,
      submittedAt: this.now().toISOString(),
    });
  }

  async interrupt(): Promise<void> {
    if (!this.handle) {
      return;
    }

    await this.provider.interrupt(this.handle);
    if (this.universe.runtimeSession) {
      this.universe.runtimeSession = withRuntimeSessionState(
        updateRuntimeSessionRecord(this.universe.runtimeSession, { pendingQuestion: null }),
        'paused',
        this.now().toISOString(),
        'Turn interrupted',
      );
    }
  }

  async cancel(): Promise<void> {
    if (!this.handle) {
      return;
    }

    await this.provider.close(this.handle);
    if (this.universe.runtimeSession) {
      this.universe.runtimeSession = withRuntimeSessionState(
        updateRuntimeSessionRecord(this.universe.runtimeSession, { pendingQuestion: null }),
        'failed',
        this.now().toISOString(),
        'Runtime cancelled',
      );
    }
    this.handle = null;
  }

  async close(): Promise<void> {
    if (this.handle) {
      await this.provider.close(this.handle);
      this.handle = null;
    }

    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  private ensureSubscribed(): void {
    if (this.unsubscribe) {
      return;
    }

    this.unsubscribe = this.provider.subscribe((event) => {
      void this.handleRuntimeEvent(event);
    });
  }

  private async handleRuntimeEvent(event: RuntimeEvent): Promise<void> {
    const record = this.universe.runtimeSession ?? createRuntimeSessionRecord(
      this.universe.config.agent,
      event.timestamp,
    );
    const state = deriveRuntimeSessionStateFromEvent(event);
    const currentStep = deriveCurrentStepLabelFromEvent(event);
    let next = withRuntimeSessionState(record, state, event.timestamp, currentStep);

    if (event.type === 'session_started') {
      next = updateRuntimeSessionRecord(next, {
        externalSessionId: event.externalSessionId,
      });
    }

    if (event.type === 'assistant_delta' || event.type === 'assistant_message') {
      next = appendTranscriptTail(next, event.text);
    }

    if (event.type === 'needs_user_input') {
      next = updateRuntimeSessionRecord(next, {
        pendingQuestion: event.question,
      });
    } else {
      next = updateRuntimeSessionRecord(next, {
        pendingQuestion: null,
      });
    }

    if (event.type === 'completed' && event.usage) {
      const summary = this.universe.usageSummary ?? createEmptyUsageSummary();
      const turn: TurnUsage = {
        turnIndex: summary.turns.length,
        model: event.model,
        usage: event.usage,
        costUsd: event.totalCostUsd ?? 0,
        timestamp: event.timestamp,
      };
      this.universe.usageSummary = addTurnToUsageSummary(summary, turn);
    }

    next = updateRuntimeSessionRecord(next, {
      lastSequence: event.sequence,
    });

    this.universe.runtimeSession = next;
    this.onRuntimeEvent?.(event);
    await appendRuntimeEvent(this.universe.workdir, event);
  }
}
