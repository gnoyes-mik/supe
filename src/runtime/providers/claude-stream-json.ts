import { randomUUID } from 'crypto';
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import type {
  AssistantMessageRuntimeEvent,
  ConversationProvider,
  ConversationProviderResumeOptions,
  ConversationProviderStartOptions,
  RuntimeEvent,
  RuntimeEventListener,
  RuntimeSessionHandle,
  RuntimeTurnInput,
} from '../contracts.js';

type SpawnLike = (
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv },
) => ChildProcessWithoutNullStreams;

interface ClaudeStreamJsonProviderOptions {
  args?: string[];
  command?: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  now?: () => Date;
  sessionIdFactory?: () => string;
  spawnImpl?: SpawnLike;
}

interface ActiveProcess {
  child: ChildProcessWithoutNullStreams | null;
  pendingBasePrompt: string | null;
  handle: RuntimeSessionHandle;
  resolveTurn: (() => void) | null;
  rejectTurn: ((error: Error) => void) | null;
  stdoutBuffer: string;
}

export class ClaudeStreamJsonProvider implements ConversationProvider {
  readonly provider = 'claude' as const;

  private readonly args: string[];
  private readonly command: string;
  private readonly cwd?: string;
  private readonly env?: NodeJS.ProcessEnv;
  private readonly now: () => Date;
  private readonly sessionIdFactory: () => string;
  private readonly spawnImpl: SpawnLike;
  private readonly listeners = new Set<RuntimeEventListener>();
  private readonly processes = new Map<string, ActiveProcess>();
  private readonly sequences = new Map<string, number>();

  constructor(options: ClaudeStreamJsonProviderOptions = {}) {
    this.args = options.args ?? [];
    this.command = options.command ?? 'claude';
    this.cwd = options.cwd;
    this.env = options.env;
    this.now = options.now ?? (() => new Date());
    this.sessionIdFactory = options.sessionIdFactory ?? randomUUID;
    this.spawnImpl = options.spawnImpl ?? spawn;
  }

  subscribe(listener: RuntimeEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async startSession(options: ConversationProviderStartOptions): Promise<RuntimeSessionHandle> {
    const handle: RuntimeSessionHandle = {
      universeId: options.universeId,
      provider: this.provider,
      externalSessionId: this.sessionIdFactory(),
    };
    this.processes.set(options.universeId, {
      child: null,
      pendingBasePrompt: options.prompt,
      handle,
      resolveTurn: null,
      rejectTurn: null,
      stdoutBuffer: '',
    });
    this.emit({
      type: 'session_started',
      universeId: options.universeId,
      externalSessionId: handle.externalSessionId,
    });
    return handle;
  }

  async resumeSession(options: ConversationProviderResumeOptions): Promise<RuntimeSessionHandle> {
    const handle: RuntimeSessionHandle = {
      universeId: options.universeId,
      provider: this.provider,
      externalSessionId: options.externalSessionId,
    };
    this.processes.set(options.universeId, {
      child: null,
      pendingBasePrompt: null,
      handle,
      resolveTurn: null,
      rejectTurn: null,
      stdoutBuffer: '',
    });
    this.emit({
      type: 'session_started',
      universeId: options.universeId,
      externalSessionId: options.externalSessionId,
    });
    return handle;
  }

  async sendTurn(handle: RuntimeSessionHandle, turn: RuntimeTurnInput): Promise<void> {
    const active = this.ensureProcess(handle);
    if (active.child && (active.child.exitCode !== null || active.child.killed)) {
      this.processes.set(handle.universeId, this.spawnProcess(active.handle, active.pendingBasePrompt));
    }
    const current = this.ensureProcess(handle);
    const child = current.child;
    if (!child) {
      throw new Error(`Claude process did not start for ${handle.universeId}`);
    }

    const payloadText = current.pendingBasePrompt
      ? `${current.pendingBasePrompt}\n\n${turn.text}`.trim()
      : turn.text;
    current.pendingBasePrompt = null;

    const result = new Promise<void>((resolve, reject) => {
      current.resolveTurn = resolve;
      current.rejectTurn = reject;
    });

    child.stdin.write(`${JSON.stringify({
      type: 'user',
      message: {
        role: 'user',
        content: [
          {
            type: 'text',
            text: payloadText,
          },
        ],
      },
    })}\n`);

    await result;
  }

  async interrupt(handle: RuntimeSessionHandle): Promise<void> {
    const active = this.processes.get(handle.universeId);
    if (!active) {
      return;
    }

    active.child?.kill('SIGINT');
    active.rejectTurn?.(new Error('Claude turn interrupted'));
    active.resolveTurn = null;
    active.rejectTurn = null;
  }

  async close(handle: RuntimeSessionHandle): Promise<void> {
    const active = this.processes.get(handle.universeId);
    if (!active) {
      return;
    }

    active.child?.kill('SIGTERM');
    this.processes.delete(handle.universeId);
  }

  private ensureProcess(handle: RuntimeSessionHandle): ActiveProcess {
    let active = this.processes.get(handle.universeId);
    if (!active || !active.child || active.child.exitCode !== null) {
      active = this.spawnProcess(handle, active?.pendingBasePrompt ?? null);
      this.processes.set(handle.universeId, active);
    }
    return active;
  }

  private spawnProcess(handle: RuntimeSessionHandle, pendingBasePrompt: string | null): ActiveProcess {
    const args = [
      ...this.args,
      '--print',
      '--verbose',
      '--output-format',
      'stream-json',
      '--input-format',
      'stream-json',
      '--dangerously-skip-permissions',
      '--session-id',
      handle.externalSessionId ?? this.sessionIdFactory(),
    ];
    const child = this.spawnImpl(this.command, args, {
      cwd: this.cwd,
      env: { ...process.env, ...this.env },
    });

    const active: ActiveProcess = {
      child,
      pendingBasePrompt,
      handle: {
        ...handle,
        externalSessionId: handle.externalSessionId ?? this.sessionIdFactory(),
      },
      resolveTurn: null,
      rejectTurn: null,
      stdoutBuffer: '',
    };

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      active.stdoutBuffer += chunk;
      while (true) {
        const newlineIndex = active.stdoutBuffer.indexOf('\n');
        if (newlineIndex < 0) {
          break;
        }
        const line = active.stdoutBuffer.slice(0, newlineIndex).trim();
        active.stdoutBuffer = active.stdoutBuffer.slice(newlineIndex + 1);
        if (line.length === 0) {
          continue;
        }
        this.handleOutputLine(active, line);
      }
    });

    child.on('close', (code) => {
      if (code && code !== 0) {
        active.rejectTurn?.(new Error(`Claude stream-json exited with code ${code}`));
      }
      active.resolveTurn = null;
      active.rejectTurn = null;
    });

    return active;
  }

  private handleOutputLine(active: ActiveProcess, line: string): void {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(line) as Record<string, unknown>;
    } catch {
      return;
    }

    const sessionId = this.readString(parsed.session_id);
    if (sessionId) {
      active.handle.externalSessionId = sessionId;
    }

    const type = this.readString(parsed.type);
    if (type === 'stream_event') {
      const event = (parsed.event ?? {}) as Record<string, unknown>;
      const eventType = this.readString(event.type);
      if (eventType === 'content_block_delta') {
        const delta = (event.delta ?? {}) as Record<string, unknown>;
        const text = this.readString(delta.text);
        if (text) {
          this.emit({
            type: 'assistant_delta',
            universeId: active.handle.universeId,
            text,
          });
        }
      }
      return;
    }

    if (type === 'assistant') {
      const message = parsed.message as AssistantMessageRuntimeEvent['text'] | Record<string, unknown> | undefined;
      const text = this.extractAssistantText(message);
      if (text) {
        this.emit({
          type: 'assistant_message',
          universeId: active.handle.universeId,
          text,
        });
      }
      return;
    }

    if (type === 'result') {
      const isError = Boolean(parsed.is_error);
      if (isError) {
        const message = this.readString(parsed.result) ?? 'Claude stream-json turn failed';
        this.emit({
          type: 'failed',
          universeId: active.handle.universeId,
          error: message,
        });
        active.rejectTurn?.(new Error(message));
      } else {
        this.emit({
          type: 'completed',
          universeId: active.handle.universeId,
        });
        active.resolveTurn?.();
      }
      active.resolveTurn = null;
      active.rejectTurn = null;
    }
  }

  private emit(
    event: { universeId: string; type: RuntimeEvent['type']; [key: string]: unknown },
  ): void {
    const sequence = (this.sequences.get(event.universeId) ?? 0) + 1;
    this.sequences.set(event.universeId, sequence);
    const next = {
      ...event,
      provider: this.provider,
      sequence,
      timestamp: this.now().toISOString(),
    } as RuntimeEvent;

    for (const listener of this.listeners) {
      listener(next);
    }
  }

  private extractAssistantText(
    message: AssistantMessageRuntimeEvent['text'] | Record<string, unknown> | undefined,
  ): string | null {
    if (!message || typeof message !== 'object') {
      return typeof message === 'string' ? message : null;
    }

    const content = Array.isArray((message as { content?: unknown[] }).content)
      ? (message as { content: Array<Record<string, unknown>> }).content
      : [];
    const text = content
      .map((item) => this.readString(item.text))
      .filter((value): value is string => Boolean(value))
      .join('');

    return text.length > 0 ? text : null;
  }

  private readString(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
  }

}
