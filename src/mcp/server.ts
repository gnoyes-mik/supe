import {
  buildSessionConfig,
  normalizeAgentType,
  normalizeUniverseCount,
  resolveAgentAssignments,
  resolveBaseRepoPath,
} from '../app/run-config.js';
import {
  makeSessionJsonData,
  SUPE_CONTRACT_VERSION,
} from '../app/contracts.js';
import { getContractSnapshot } from '../app/contracts-service.js';
import { SupeServiceError, toErrorPayload } from '../app/errors.js';
import { ensureLlmConfigured } from '../app/preflight-service.js';
import { ensureReport } from '../app/report-service.js';
import {
  listSessionsDetailed,
  loadSpecificSession,
  loadRunningOrSpecificSession,
  loadSelectedSession,
} from '../app/session-service.js';
import { stopSession } from '../app/stop-service.js';
import { prepareSessionForRun, runPreparedSession } from '../app/run-service.js';
import { diagnoseSupeEnvironment } from '../app/setup-service.js';
import { SessionManager } from '../core/session.js';
import { initLlmClient } from '../utils/llm.js';
import { loadConfig } from '../utils/config.js';
import type { GlobalConfig } from '../types.js';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const TOOLS: McpToolDefinition[] = [
  {
    name: 'supe.get_contracts',
    description: 'Get the host-neutral Supe contract snapshot used by CLI and MCP integrations.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'supe.doctor',
    description: 'Get Supe runtime/plugin/MCP readiness information.',
    inputSchema: {
      type: 'object',
      properties: {
        live: { type: 'boolean' },
      },
    },
  },
  {
    name: 'supe.start_session',
    description: 'Start a Supe session from a raw spec string.',
    inputSchema: {
      type: 'object',
      required: ['spec'],
      properties: {
        spec: { type: 'string' },
        specSourcePath: { type: 'string' },
        clarificationAnswers: {
          type: 'object',
          properties: {
            desiredOutputs: { type: 'string' },
            successCriteria: { type: 'string' },
            constraints: { type: 'string' },
            outOfScope: { type: 'string' }
          }
        },
        universes: { type: 'integer', minimum: 2, maximum: 10 },
        agent: { type: 'string', enum: ['claude', 'codex'] },
        timeout: { type: 'string' },
        maxCost: { type: 'number' },
        pollenInterval: { type: 'number' },
        pollen: { type: 'boolean' },
        yes: { type: 'boolean' },
      },
    },
  },
  {
    name: 'supe.get_session',
    description: 'Get a single session by id or latest when omitted.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string' },
      },
    },
  },
  {
    name: 'supe.list_sessions',
    description: 'List sessions with basic metadata.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'supe.get_report',
    description: 'Get the report for a session or latest session when omitted.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string' },
      },
    },
  },
  {
    name: 'supe.resume_session',
    description: 'Resume a stopped session and continue execution.',
    inputSchema: {
      type: 'object',
      required: ['sessionId'],
      properties: {
        sessionId: { type: 'string' },
      },
    },
  },
  {
    name: 'supe.stop_session',
    description: 'Stop a running session by id or the latest running session.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string' },
      },
    },
  },
];

const REPO_ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

export async function serveMcp(): Promise<void> {
  const config = await loadConfig();
  initLlmClient(config.llm, config.agents);

  let buffer = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk: string) => {
    buffer += chunk;
    void tryHandleBuffer(config);
  });

  async function tryHandleBuffer(runtimeConfig: GlobalConfig): Promise<void> {
    while (true) {
      const headerEnd = buffer.indexOf('\r\n\r\n');
      const altHeaderEnd = buffer.indexOf('\n\n');
      const effectiveHeaderEnd = headerEnd >= 0 ? headerEnd : altHeaderEnd;
      if (effectiveHeaderEnd < 0) {
        return;
      }

      const headerText = buffer.slice(0, effectiveHeaderEnd);
      const contentLength = extractContentLength(headerText);
      if (contentLength === null) {
        writeResponse({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32700, message: 'Missing Content-Length header' },
        });
        buffer = '';
        return;
      }

      const separatorLength = headerEnd >= 0 ? 4 : 2;
      const bodyStart = effectiveHeaderEnd + separatorLength;
      if (buffer.length < bodyStart + contentLength) {
        return;
      }

      const rawBody = buffer.slice(bodyStart, bodyStart + contentLength);
      buffer = buffer.slice(bodyStart + contentLength);

      let request: JsonRpcRequest;
      try {
        request = JSON.parse(rawBody) as JsonRpcRequest;
      } catch {
        writeResponse({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32700, message: 'Invalid JSON payload' },
        });
        continue;
      }

      const response = await handleRequest(request, runtimeConfig);
      if (response) {
        writeResponse(response);
      }
    }
  }
}

function extractContentLength(headerText: string): number | null {
  const match = headerText.match(/Content-Length:\s*(\d+)/i);
  if (!match) {
    return null;
  }
  return Number.parseInt(match[1], 10);
}

function writeResponse(response: JsonRpcResponse): void {
  const body = JSON.stringify(response);
  process.stdout.write(`Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`);
}

async function handleRequest(
  request: JsonRpcRequest,
  config: GlobalConfig,
): Promise<JsonRpcResponse | null> {
  if (request.method === 'notifications/initialized') {
    return null;
  }

  if (request.method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id: request.id ?? null,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: 'supe',
          version: SUPE_CONTRACT_VERSION,
        },
      },
    };
  }

  if (request.method === 'ping') {
    return {
      jsonrpc: '2.0',
      id: request.id ?? null,
      result: {},
    };
  }

  if (request.method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id: request.id ?? null,
      result: { tools: TOOLS },
    };
  }

  if (request.method === 'tools/call') {
    const params = request.params ?? {};
    const toolName = typeof params.name === 'string' ? params.name : '';
    const args = typeof params.arguments === 'object' && params.arguments !== null
      ? params.arguments as Record<string, unknown>
      : {};

    try {
      const result = await callTool(toolName, args, config);
      return {
        jsonrpc: '2.0',
        id: request.id ?? null,
        result: {
          structuredContent: result,
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        },
      };
    } catch (error) {
      const errorPayload = toErrorPayload(error);
      return {
        jsonrpc: '2.0',
        id: request.id ?? null,
        result: {
          structuredContent: errorPayload,
          content: [
            {
              type: 'text',
              text: JSON.stringify(errorPayload, null, 2),
            },
          ],
          isError: true,
        },
      };
    }
  }

  return {
    jsonrpc: '2.0',
    id: request.id ?? null,
    error: {
      code: -32601,
      message: `Method not found: ${request.method}`,
    },
  };
}

async function callTool(
  toolName: string,
  args: Record<string, unknown>,
  config: GlobalConfig,
): Promise<unknown> {
  if (toolName === 'supe.get_contracts') {
    void args;
    void config;
    return getContractSnapshot(REPO_ROOT);
  }

  if (toolName === 'supe.doctor') {
    return diagnoseSupeEnvironment({
      liveLlmCheck: Boolean(args.live),
    });
  }

  if (toolName === 'supe.start_session') {
    const sessionManager = new SessionManager();
    try {
      ensureLlmConfigured(config);
      const universeCount = normalizeUniverseCount(args.universes, config.session.maxUniverses);
      const defaultAgent = normalizeAgentType(args.agent) ?? config.defaultAgent;
      const agentAssignments = resolveAgentAssignments(args.agents, universeCount, defaultAgent);
      const baseRepoPath = await resolveBaseRepoPath(args.baseRepo);
      const sessionConfig = buildSessionConfig({
        timeout: args.timeout,
        maxCost: args.maxCost,
        pollenInterval: args.pollenInterval,
        pollen: args.pollen,
      }, config, universeCount, defaultAgent, baseRepoPath);

      const prepared = await prepareSessionForRun(sessionManager, {
        rawSpec: String(args.spec ?? ''),
        specSourcePath: typeof args.specSourcePath === 'string' ? args.specSourcePath : '<mcp>',
        universeCount,
        defaultAgent,
        agentAssignments,
        sessionConfig,
        clarificationAnswers: parseClarificationAnswers(args.clarificationAnswers),
        clarificationMode: 'return',
        confirmationMode: Boolean(args.yes) ? 'auto_accept' : 'return',
        confirmationPrompt: async () => false,
        clarificationPrompt: async () => ({}),
      });

      if (prepared.status !== 'ready') {
        return prepared;
      }

      const session = await runPreparedSession(sessionManager, prepared.session, config);
      return {
        ...makeSessionJsonData(session),
        report: session.report,
      };
    } finally {
      sessionManager.destroy();
    }
  }

  if (toolName === 'supe.get_session') {
    const sessionManager = new SessionManager();
    try {
      const session = await loadSelectedSession(sessionManager, asOptionalString(args.sessionId));
      if (!session) {
        throw new SupeServiceError('not_found', 'No session found.');
      }
      return makeSessionJsonData(session);
    } finally {
      sessionManager.destroy();
    }
  }

  if (toolName === 'supe.list_sessions') {
    const sessionManager = new SessionManager();
    try {
      return {
        sessions: await listSessionsDetailed(sessionManager),
      };
    } finally {
      sessionManager.destroy();
    }
  }

  if (toolName === 'supe.get_report') {
    const sessionManager = new SessionManager();
    try {
      const session = await loadSelectedSession(sessionManager, asOptionalString(args.sessionId));
      if (!session) {
        throw new SupeServiceError('not_found', 'No session found.');
      }
      const report = await ensureReport(session, sessionManager);
      return {
        ...makeSessionJsonData(session),
        report,
      };
    } finally {
      sessionManager.destroy();
    }
  }

  if (toolName === 'supe.resume_session') {
    const sessionManager = new SessionManager();
    try {
      const sessionId = asRequiredString(args.sessionId, 'sessionId');
      const session = await loadSpecificSession(sessionManager, sessionId);
      if (!session) {
        throw new SupeServiceError('not_found', `Session ${sessionId} was not found.`);
      }
      const resumed = await runPreparedSession(sessionManager, session, config);
      return {
        ...makeSessionJsonData(resumed),
        report: resumed.report,
      };
    } finally {
      sessionManager.destroy();
    }
  }

  if (toolName === 'supe.stop_session') {
    const sessionManager = new SessionManager();
    try {
      const session = await loadRunningOrSpecificSession(sessionManager, asOptionalString(args.sessionId));
      if (!session) {
        throw new SupeServiceError('not_found', 'No session found to stop.');
      }
      const stopped = await stopSession(sessionManager, session);

      return {
        ...makeSessionJsonData(session),
        stopped: true,
        killedProcesses: stopped.killedProcesses,
      };
    } finally {
      sessionManager.destroy();
    }
  }

  throw new Error(`Unknown tool: ${toolName}`);
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function asRequiredString(value: unknown, field: string): string {
  const resolved = asOptionalString(value);
  if (!resolved) {
    throw new Error(`Missing required field: ${field}`);
  }
  return resolved;
}

function parseClarificationAnswers(
  value: unknown,
): Partial<Record<'desiredOutputs' | 'successCriteria' | 'constraints' | 'outOfScope', string>> | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;
  const next: Partial<Record<'desiredOutputs' | 'successCriteria' | 'constraints' | 'outOfScope', string>> = {};
  for (const key of ['desiredOutputs', 'successCriteria', 'constraints', 'outOfScope'] as const) {
    if (typeof candidate[key] === 'string') {
      next[key] = candidate[key];
    }
  }
  return Object.keys(next).length > 0 ? next : undefined;
}
