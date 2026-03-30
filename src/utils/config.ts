import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import dotenv from 'dotenv';
import type { GlobalConfig } from '../types.js';

dotenv.config();

const SUPE_HOME = join(homedir(), '.supe');
const CONFIG_PATH = join(SUPE_HOME, 'config.json');

export function getSupeHome(): string {
  return SUPE_HOME;
}

export function getSessionsDir(): string {
  return join(SUPE_HOME, 'sessions');
}

export async function ensureSupeHome(): Promise<void> {
  await mkdir(SUPE_HOME, { recursive: true });
  await mkdir(join(SUPE_HOME, 'sessions'), { recursive: true });
}

export async function loadConfig(): Promise<GlobalConfig> {
  try {
    const raw = await readFile(CONFIG_PATH, 'utf-8');
    const config = JSON.parse(raw) as GlobalConfig;
    // Resolve environment variable references like "${ANTHROPIC_API_KEY}"
    return normalizeConfig(resolveEnvVars(config));
  } catch {
    return getDefaultConfig();
  }
}

export async function saveConfig(config: GlobalConfig): Promise<void> {
  await ensureSupeHome();
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function resolveEnvVars(obj: any): any {
  if (typeof obj === 'string') {
    return obj.replace(/\$\{(\w+)\}/g, (_, key) => process.env[key] ?? '');
  }
  if (Array.isArray(obj)) return obj.map(resolveEnvVars);
  if (obj && typeof obj === 'object') {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = resolveEnvVars(v);
    }
    return result;
  }
  return obj;
}

function getDefaultConfig(): GlobalConfig {
  return {
    defaultAgent: 'claude',
    agents: {
      claude: {
        command: 'claude',
        args: ['--dangerously-skip-permissions'],
        maxCostPerUniverse: 10.0,
      },
      codex: {
        command: 'codex',
        args: ['--full-auto'],
        maxCostPerUniverse: 10.0,
      },
    },
    slack: {
      botToken: process.env.SUPE_SLACK_BOT_TOKEN ?? '',
      appToken: process.env.SUPE_SLACK_APP_TOKEN ?? '',
      defaultChannel: '',
    },
    pollen: {
      cycleIntervalMinutes: 5,
      maxPollensPerCycle: 3,
      minTimeBetweenInjectionsMinutes: 20,
    },
    session: {
      maxDurationHours: 10,
      maxUniverses: 10,
    },
    llm: {
      analysisModel: 'default',
      analysisProvider: 'claude-cli',
      apiKey: process.env.ANTHROPIC_API_KEY ?? '',
    },
  };
}

function normalizeConfig(config: GlobalConfig): GlobalConfig {
  const rawProvider = config.llm.analysisProvider as string;
  const provider = rawProvider === 'anthropic'
    ? 'anthropic-api'
    : rawProvider;

  return {
    ...config,
    llm: {
      ...config.llm,
      analysisProvider: provider as GlobalConfig['llm']['analysisProvider'],
    },
  };
}
