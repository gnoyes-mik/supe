import { EventEmitter } from 'events';
import { spawn, type ChildProcessWithoutNullStreams, type SpawnOptionsWithoutStdio } from 'child_process';
import type {
  ConversationProvider,
  ConversationProviderResumeOptions,
  ConversationProviderStartOptions,
  RuntimeEvent,
  RuntimeEventListener,
  RuntimeSessionHandle,
  RuntimeTurnInput,
} from '../contracts.js';

interface JsonRpcEnvelope {
  id?: number | string;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: unknown;
}

export interface CodexAppServerTransport {
  request(method: string, params?: Record<string, unknown>): Promise<unknown>;
  notify(method: string, params?: Record<string, unknown>): Promise<void>;
  subscribe(listener: (message: JsonRpcEnvelope) => void): () => void;
  close(): Promise<void>;
}

export interface CodexAppServerProviderOptions {
  approvalPolicy?: 'never' | 'on-request' | 'on-failure' | 'untrusted';
  command?: string;
  cwd?: string;
  model?: string;
  now?: () => Date;
  sandbox?: 'read-only' | 'workspace-write' | 'danger-full-access';
  spawnImpl?: (
    command: string,
    args: string[],
    options: SpawnOptionsWithoutStdio,
  ) => ChildProcessWithoutNullStreams;
  transport?: CodexAppServerTransport;
}

export class CodexAppServerProvider implements ConversationProvider {
  readonly provider = 'codex' as const;

  private readonly emitter = new EventEmitter();
  private readonly now: () => Date;
  private readonly options: Required<Pick<CodexAppServerProviderOptions, 'approvalPolicy' | 'command' | 'sandbox'>> & Omit<CodexAppServerProviderOptions, 'approvalPolicy' | 'command' | 'sandbox'>;
  private sequence = 0;
  private transportPromise: Promise<CodexAppServerTransport> | null = null;

  constructor(options: CodexAppServerProviderOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.options = {
      approvalPolicy: options.approvalPolicy ?? 'never',
      command: options.command ?? 'codex',
      sandbox: options.sandbox ?? 'danger-full-access',
      ...options,
    };
  }

  subscribe(listener: RuntimeEventListener): () => void {
    this.emitter.on('runtime-event', listener);
    return () => {
      this.emitter.removeListener('runtime-event', listener);
    };
  }

  async startSession(options: ConversationProviderStartOptions): Promise<RuntimeSessionHandle> {
    const transport = await this.getTransport();
    const response = await transport.request('thread/start', {
      approvalPolicy: this.options.approvalPolicy,
      cwd: this.options.cwd,
      model: this.options.model ?? null,
      sandbox: this.options.sandbox,
    });
    const externalSessionId = extractThreadId(response);
    this.emitEvent({
      type: 'progress_hint',
      universeId: options.universeId,
      label: 'Codex app-server thread started',
    });
    return {
      universeId: options.universeId,
      provider: this.provider,
      externalSessionId,
    };
  }

  async resumeSession(options: ConversationProviderResumeOptions): Promise<RuntimeSessionHandle> {
    const transport = await this.getTransport();
    await transport.request('thread/resume', {
      approvalPolicy: this.options.approvalPolicy,
      cwd: this.options.cwd,
      model: this.options.model ?? null,
      sandbox: this.options.sandbox,
      threadId: options.externalSessionId,
    });
    this.emitEvent({
      type: 'progress_hint',
      universeId: options.universeId,
      label: 'Codex app-server thread resumed',
    });
    return {
      universeId: options.universeId,
      provider: this.provider,
      externalSessionId: options.externalSessionId,
    };
  }

  async sendTurn(handle: RuntimeSessionHandle, turn: RuntimeTurnInput): Promise<void> {
    const transport = await this.getTransport();
    await transport.request('turn/start', {
      approvalPolicy: this.options.approvalPolicy,
      cwd: this.options.cwd,
      input: [{ type: 'text', text: turn.text }],
      model: this.options.model ?? null,
      sandboxPolicy: this.options.sandbox,
      threadId: handle.externalSessionId,
    });
  }

  async interrupt(handle: RuntimeSessionHandle): Promise<void> {
    const transport = await this.getTransport();
    const threadId = handle.externalSessionId;
    if (!threadId) {
      return;
    }

    try {
      const response = await transport.request('thread/read', {
        includeTurns: true,
        threadId,
      });
      const turnId = extractLastTurnId(response);
      if (turnId) {
        await transport.request('turn/interrupt', {
          threadId,
          turnId,
        });
      }
    } catch {
      // best-effort only
    }
  }

  async close(_handle: RuntimeSessionHandle): Promise<void> {
    if (this.transportPromise) {
      const transport = await this.transportPromise;
      await transport.close();
    }
    this.transportPromise = null;
  }

  private async getTransport(): Promise<CodexAppServerTransport> {
    if (!this.transportPromise) {
      this.transportPromise = Promise.resolve(
        this.options.transport ?? createLiveCodexTransport({
          command: this.options.command,
          cwd: this.options.cwd,
          model: this.options.model,
          now: this.now,
          spawnImpl: this.options.spawnImpl,
        }),
      );

      const transport = await this.transportPromise;
      transport.subscribe((message) => {
        this.handleTransportMessage(message);
      });
    }

    return this.transportPromise;
  }

  private handleTransportMessage(message: JsonRpcEnvelope): void {
    const method = message.method ?? '';
    const params = message.params ?? {};
    const universeId = extractUniverseId(params);

    if (!universeId) {
      return;
    }

    if (method === 'thread/started') {
      this.emitEvent({
        type: 'session_started',
        universeId,
        externalSessionId: extractThreadId(params),
      });
      return;
    }

    if (method === 'thread/status/changed') {
      const status = stringOrNull(params.status) ?? 'running';
      this.emitEvent({
        type: 'progress_hint',
        universeId,
        label: `Codex status: ${status}`,
      });
      return;
    }

    if (method === 'item/agentMessage/delta') {
      const text = extractDeltaText(params);
      if (text) {
        this.emitEvent({
          type: 'assistant_delta',
          universeId,
          text,
        });
      }
      return;
    }

    if (method === 'item/completed') {
      const toolName = stringOrNull(params.tool);
      const text = extractCompletedText(params);
      if (toolName) {
        this.emitEvent({
          type: 'tool_finished',
          universeId,
          toolName,
          ok: true,
        });
      }
      if (text) {
        this.emitEvent({
          type: 'assistant_message',
          universeId,
          text,
        });
      }
      return;
    }

    if (method === 'item/started') {
      const toolName = stringOrNull(params.tool) ?? stringOrNull(params.kind);
      if (toolName) {
        this.emitEvent({
          type: 'tool_started',
          universeId,
          toolName,
          detail: stringOrNull(params.description),
        });
      }
      return;
    }

    if (method === 'item/tool/requestUserInput') {
      const question = stringOrNull(params.question) ?? 'Codex requested user input';
      this.emitEvent({
        type: 'needs_user_input',
        universeId,
        question,
      });
      return;
    }

    if (method === 'turn/completed') {
      this.emitEvent({
        type: 'completed',
        universeId,
      });
      return;
    }

    if (method === 'error') {
      this.emitEvent({
        type: 'failed',
        universeId,
        error: stringOrNull(params.message) ?? 'Codex app-server error',
      });
    }
  }

  private emitEvent(
    event: { universeId: string; type: RuntimeEvent['type']; [key: string]: unknown },
  ): void {
    const fullEvent = {
      ...event,
      provider: this.provider,
      sequence: ++this.sequence,
      timestamp: this.now().toISOString(),
    } as RuntimeEvent;
    this.emitter.emit('runtime-event', fullEvent);
  }
}

function createLiveCodexTransport(options: {
  command: string;
  cwd?: string;
  model?: string;
  now: () => Date;
  spawnImpl?: CodexAppServerProviderOptions['spawnImpl'];
}): CodexAppServerTransport {
  const spawnImpl = options.spawnImpl ?? spawn;
  const child = spawnImpl(
    options.command,
    ['app-server', '--listen', 'stdio://'],
    {
      cwd: options.cwd,
      env: { ...process.env },
      stdio: 'pipe',
    },
  );

  let nextId = 1;
  const listeners = new Set<(message: JsonRpcEnvelope) => void>();
  const pending = new Map<number, { resolve: (value: unknown) => void; reject: (reason?: unknown) => void }>();
  let buffer = '';
  let initialized = false;

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    buffer += chunk;
    while (true) {
      const separator = buffer.indexOf('\r\n\r\n');
      if (separator < 0) {
        break;
      }

      const header = buffer.slice(0, separator);
      const lengthMatch = header.match(/Content-Length:\s*(\d+)/i);
      if (!lengthMatch) {
        buffer = '';
        break;
      }

      const bodyStart = separator + 4;
      const bodyLength = Number.parseInt(lengthMatch[1], 10);
      if (buffer.length < bodyStart + bodyLength) {
        break;
      }

      const body = buffer.slice(bodyStart, bodyStart + bodyLength);
      buffer = buffer.slice(bodyStart + bodyLength);
      const message = JSON.parse(body) as JsonRpcEnvelope;

      if (typeof message.id === 'number' && pending.has(message.id)) {
        const handlers = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) {
          handlers?.reject(message.error);
        } else {
          handlers?.resolve(message.result);
        }
      } else {
        listeners.forEach((listener) => listener(message));
      }
    }
  });

  const write = (payload: JsonRpcEnvelope): void => {
    const body = JSON.stringify(payload);
    child.stdin.write(`Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`);
  };

  const rawRequest = async (method: string, params?: Record<string, unknown>): Promise<unknown> => {
    return new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      write({ id, method, params });
    });
  };

  const initialize = async (): Promise<void> => {
    if (initialized) {
      return;
    }
    initialized = true;
    await rawRequest('initialize', {
      clientInfo: {
        name: 'supe',
        version: '0.1.0',
      },
    });
    await notify('initialized', {});
  };

  const request = async (method: string, params?: Record<string, unknown>): Promise<unknown> => {
    await initialize();
    return rawRequest(method, params);
  };

  const notify = async (method: string, params?: Record<string, unknown>): Promise<void> => {
    write({ method, params });
  };

  return {
    async request(method: string, params?: Record<string, unknown>): Promise<unknown> {
      return request(method, params);
    },
    async notify(method: string, params?: Record<string, unknown>): Promise<void> {
      await initialize();
      await notify(method, params);
    },
    subscribe(listener: (message: JsonRpcEnvelope) => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async close(): Promise<void> {
      for (const handlers of pending.values()) {
        handlers.reject(new Error('Codex app-server transport closed'));
      }
      pending.clear();
      child.kill('SIGTERM');
    },
  };
}

function extractUniverseId(params: Record<string, unknown>): string | null {
  return stringOrNull(params.universeId)
    ?? stringOrNull(
      ((params.thread as Record<string, unknown> | undefined)?.metadata as Record<string, unknown> | undefined)?.universeId,
    );
}

function extractThreadId(value: unknown): string | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const direct = stringOrNull((value as Record<string, unknown>).threadId)
    ?? stringOrNull((value as Record<string, unknown>).id);
  if (direct) {
    return direct;
  }

  const thread = (value as Record<string, unknown>).thread;
  if (thread && typeof thread === 'object') {
    return stringOrNull((thread as Record<string, unknown>).threadId)
      ?? stringOrNull((thread as Record<string, unknown>).id);
  }

  return null;
}

function extractLastTurnId(value: unknown): string | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const turns = (value as Record<string, unknown>).turns;
  if (!Array.isArray(turns) || turns.length === 0) {
    return null;
  }

  const last = turns[turns.length - 1];
  if (!last || typeof last !== 'object') {
    return null;
  }

  return stringOrNull((last as Record<string, unknown>).turnId)
    ?? stringOrNull((last as Record<string, unknown>).id);
}

function extractDeltaText(params: Record<string, unknown>): string | null {
  const delta = params.delta;
  if (delta && typeof delta === 'object') {
    return stringOrNull((delta as Record<string, unknown>).text);
  }
  return stringOrNull(params.text);
}

function extractCompletedText(params: Record<string, unknown>): string | null {
  const item = params.item;
  if (item && typeof item === 'object') {
    return stringOrNull((item as Record<string, unknown>).text)
      ?? stringOrNull((item as Record<string, unknown>).message);
  }
  return stringOrNull(params.text);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
