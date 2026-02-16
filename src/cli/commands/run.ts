import { readFile } from 'fs/promises';
import { EventEmitter } from 'events';
import { join } from 'path';
import readline from 'readline/promises';
import { SessionManager } from '../../core/session.js';
import { Orchestrator } from '../../core/orchestrator.js';
import { checkMultiverseStability } from '../../core/stability.js';
import { loadConfig, getSupeHome } from '../../utils/config.js';
import { initLlmClient } from '../../utils/llm.js';
import { logger } from '../../utils/logger.js';
import type {
  AgentConfig,
  AgentType,
  GlobalConfig,
  ParsedSpec,
  Report,
  Session,
  SessionConfig,
  UniverseConfig,
} from '../../types.js';

interface ParsedSpecOnly {
  parseSpec(rawSpec: string): Promise<Omit<ParsedSpec, 'universeConfigs'>>;
  generateUniverses(parsedSpec: Omit<ParsedSpec, 'universeConfigs'>, count: number): Promise<UniverseConfig[]>;
  validateDiversity(configs: UniverseConfig[]): Promise<{ isDiverse: boolean }>;
}

interface ReportComparatorApi {
  generateReport(session: Session): Promise<Report>;
}

interface SlackApi {
  createSlackApp: (config: GlobalConfig['slack']) => Promise<unknown> | unknown;
  initializeSlack: (session: Session, app: unknown, emitter: EventEmitter) => Promise<void>;
}

export async function runCommand(opts: Record<string, unknown>): Promise<void> {
  const config = await loadConfig();
  initLlmClient(config.llm);

  const sessionManager = new SessionManager();

  try {
    const resumeId = getStringOpt(opts.resume);
    let session: Session;

    if (resumeId) {
      session = await sessionManager.loadSession(resumeId);
      logger.info('cli', `Resuming session ${session.id}`);
    } else {
      const specPath = getRequiredStringOpt(opts.spec, '--spec');
      const rawSpec = await readFile(specPath, 'utf-8');

      const universeCount = getUniverseCount(opts.universes, config.session.maxUniverses);
      const defaultAgent = getAgentType(opts.agent) ?? config.defaultAgent;
      const assignments = getAgentAssignments(opts.agents, universeCount, defaultAgent);

      const parsedSpec = await parseSpecWithFallback(specPath, rawSpec, universeCount, assignments);

      const sessionConfig = buildSessionConfig(opts, config, universeCount, defaultAgent, assignments);
      const stability = checkMultiverseStability(sessionConfig.maxUniverses);

      console.log(stability.message);
      if (stability.level === 'REJECTED') {
        process.exitCode = 1;
        return;
      }

      if (stability.requiresConfirmation) {
        const proceed = await promptConfirmation('> ');
        if (!proceed) {
          console.log('Wise choice. The multiverse remains intact.');
          return;
        }
        console.log('Brave soul. Opening rifts in spacetime...');
      }

      session = await sessionManager.createSession(specPath, parsedSpec, sessionConfig);
    }

    logger.setLogDir(join(getSupeHome(), 'sessions', session.id));
    sessionManager.updateStatus(session, 'running');
    await sessionManager.saveSession(session);

    if (session.config.slackEnabled) {
      await initializeSlackIfAvailable(config, session, sessionManager);
    }

    const orchestrator = new Orchestrator(
      sessionManager,
      session,
      config.agents as Record<string, AgentConfig>
    );
    await orchestrator.start();

    if (session.status === 'running' || session.status === 'initializing') {
      const hasFailure = session.universes.some((universe) => universe.status === 'failed');
      sessionManager.updateStatus(session, hasFailure ? 'failed' : 'completed');
    }

    session.report = await generateReportWithFallback(session);
    await sessionManager.saveSession(session);

    logger.info('cli', `Session ${session.id} finished with status: ${session.status}`);
  } catch (error) {
    logger.error('cli', `Run command failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  } finally {
    sessionManager.destroy();
  }
}

function getStringOpt(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getRequiredStringOpt(value: unknown, optionName: string): string {
  const resolved = getStringOpt(value);
  if (!resolved) {
    throw new Error(`Missing required option: ${optionName}`);
  }
  return resolved;
}

function getUniverseCount(value: unknown, fallback: number): number {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number.NaN;
  const candidate = Number.isFinite(parsed) ? parsed : fallback;
  if (candidate < 2) {
    return 2;
  }
  if (candidate > 10) {
    return 10;
  }
  return candidate;
}

function getAgentType(value: unknown): AgentType | undefined {
  if (value === 'claude' || value === 'codex') {
    return value;
  }
  return undefined;
}

function getAgentAssignments(value: unknown, count: number, defaultAgent: AgentType): AgentType[] {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return Array.from({ length: count }, () => defaultAgent);
  }

  const parsed = value
    .split(',')
    .map((entry) => entry.trim())
    .map((entry) => (entry === 'claude' || entry === 'codex' ? entry : null))
    .filter((entry): entry is AgentType => entry !== null);

  if (parsed.length === 0) {
    return Array.from({ length: count }, () => defaultAgent);
  }

  return Array.from({ length: count }, (_, idx) => parsed[idx % parsed.length] ?? defaultAgent);
}

function getBooleanOpt(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function getNumberOpt(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function parseDurationToMs(value: unknown, fallbackMs: number): number {
  if (typeof value !== 'string') {
    return fallbackMs;
  }

  const trimmed = value.trim();
  const match = /^([0-9]+)\s*([hms])$/i.exec(trimmed);
  if (!match) {
    return fallbackMs;
  }

  const amount = Number.parseInt(match[1], 10);
  if (!Number.isFinite(amount) || amount <= 0) {
    return fallbackMs;
  }

  const unit = match[2].toLowerCase();
  if (unit === 'h') {
    return amount * 60 * 60 * 1000;
  }
  if (unit === 'm') {
    return amount * 60 * 1000;
  }
  return amount * 1000;
}

function buildSessionConfig(
  opts: Record<string, unknown>,
  config: GlobalConfig,
  universeCount: number,
  defaultAgent: AgentType,
  assignments: AgentType[]
): SessionConfig {
  const maxDurationMs = parseDurationToMs(
    opts.timeout,
    config.session.maxDurationHours * 60 * 60 * 1000
  );
  const maxCostUsd = getNumberOpt(opts['maxCost'], 30);
  const maxCostPerUniverseUsd = Number.isFinite(maxCostUsd / universeCount)
    ? maxCostUsd / universeCount
    : config.agents[defaultAgent].maxCostPerUniverse;
  const pollenIntervalMs = getNumberOpt(opts['pollenInterval'], config.pollen.cycleIntervalMinutes) * 60 * 1000;
  const slackEnabled = getBooleanOpt(opts.slack, true);

  return {
    maxUniverses: universeCount,
    defaultAgent,
    agentAssignments: assignments,
    maxDurationMs,
    maxCostUsd,
    maxCostPerUniverseUsd,
    pollenIntervalMs,
    pollenEnabled: getBooleanOpt(opts.pollen, true),
    slackEnabled,
    slackChannel: getStringOpt(opts.channel) ?? config.slack.defaultChannel,
  };
}

async function promptConfirmation(prompt: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await rl.question(prompt);
    return answer.trim().toLowerCase() === 'y';
  } finally {
    rl.close();
  }
}

async function parseSpecWithFallback(
  specPath: string,
  rawSpec: string,
  universeCount: number,
  assignments: AgentType[]
): Promise<ParsedSpec> {
  const module = await import('../../core/spec-parser.js');
  const candidate = (module as Record<string, unknown>).SpecParser;

  if (typeof candidate === 'function') {
    const parser = new (candidate as new () => ParsedSpecOnly)();
    const parsed = await parser.parseSpec(rawSpec);
    const configs = await parser.generateUniverses(parsed, universeCount);
    const diversity = await parser.validateDiversity(configs);
    if (!diversity.isDiverse) {
      logger.warn('cli', 'Low diversity detected for generated universes.');
    }
    return {
      ...parsed,
      universeConfigs: configs,
    };
  }

  if ('parseSpec' in module && typeof module.parseSpec === 'function') {
    const parseSpecFn = module.parseSpec as (
      path: string,
      count: number,
      agents: AgentType[]
    ) => Promise<ParsedSpec>;
    return parseSpecFn(specPath, universeCount, assignments);
  }

  throw new Error('Spec parser is not available.');
}

async function initializeSlackIfAvailable(
  config: GlobalConfig,
  session: Session,
  emitter: EventEmitter,
): Promise<void> {
  const module = await import('../../slack/app.js');
  const maybeSlackApi = module as Partial<SlackApi>;

  if (typeof maybeSlackApi.createSlackApp !== 'function') {
    logger.warn('cli', 'Slack is enabled but createSlackApp is not implemented.');
    return;
  }

  if (typeof maybeSlackApi.initializeSlack !== 'function') {
    logger.warn('cli', 'Slack is enabled but initializeSlack is not implemented.');
    return;
  }

  const slackApp = await maybeSlackApi.createSlackApp(config.slack);
  await maybeSlackApi.initializeSlack(session, slackApp, emitter);
}

function buildFallbackReport(session: Session): Report {
  const totalCreated = session.pollens.length;
  let totalApplied = 0;
  let totalAdapted = 0;
  let totalRejected = 0;

  for (const pollen of session.pollens) {
    for (const target of pollen.targets) {
      if (target.status === 'applied') {
        totalApplied += 1;
      } else if (target.status === 'adapted') {
        totalAdapted += 1;
      } else if (target.status === 'rejected') {
        totalRejected += 1;
      }
    }
  }

  const winner = session.universes[0];
  const winnerId = winner?.id ?? '';
  const winnerSymbol = winner?.config.symbol ?? '';

  return {
    sessionId: session.id,
    generatedAt: new Date().toISOString(),
    summary: `Session ${session.id} completed with ${session.universes.length} universes.`,
    universeResults: session.universes.map((universe) => ({
      universeId: universe.id,
      symbol: universe.config.symbol,
      name: universe.config.name,
      status: universe.status,
      metrics: universe.metrics,
      highlights: [universe.progress.currentPhase].filter((entry) => entry.trim().length > 0),
    })),
    rankings: [],
    pollenStats: {
      totalCreated,
      totalApplied,
      totalAdapted,
      totalRejected,
      mostActiveSource: session.universes[0]?.config.symbol ?? '',
      mostInfluenced: session.universes[0]?.config.symbol ?? '',
      notableEntanglements: [],
    },
    recommendation: {
      winnerId,
      winnerSymbol,
      reason: winner
        ? `${winner.config.symbol} has the highest available completion signal.`
        : 'No winner available.',
    },
  };
}

async function generateReportWithFallback(session: Session): Promise<Report> {
  const module = await import('../../reporter/comparator.js');
  const maybeCtor = (module as Record<string, unknown>).ReportComparator;

  if (typeof maybeCtor === 'function') {
    const comparator = new (maybeCtor as new () => ReportComparatorApi)();
    if (typeof comparator.generateReport === 'function') {
      return comparator.generateReport(session);
    }
  }

  logger.warn('cli', 'ReportComparator is not implemented. Generating fallback report.');
  return buildFallbackReport(session);
}
