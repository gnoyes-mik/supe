import { access, mkdir, readFile } from 'fs/promises';
import { constants } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { HOST_CAPABILITIES_REGISTRY, RUNTIME_ADAPTER_CONTRACTS } from './contracts.js';
import { isLlmConfigured } from './preflight-service.js';
import { ensureSupeHome, getSupeHome, loadConfig, saveConfig } from '../utils/config.js';
import { callLlm, initLlmClient } from '../utils/llm.js';
import type { GlobalConfig } from '../types.js';

const REPO_ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

export interface RuntimeDetection {
  command: 'claude' | 'codex';
  available: boolean;
  path: string | null;
  smokeOk: boolean;
  smokeCommand: string | null;
  version: string | null;
}

export interface SetupResult {
  supeHome: string;
  configPath: string;
  runtimes: RuntimeDetection[];
  runtimeContracts: typeof RUNTIME_ADAPTER_CONTRACTS;
  hostCapabilities: typeof HOST_CAPABILITIES_REGISTRY;
  pluginManifestPath: string;
  mcpConfigPath: string;
  skillsPath: string;
}

export interface DoctorResult extends SetupResult {
  configExists: boolean;
  distBuilt: boolean;
  llmProvider: GlobalConfig['llm']['analysisProvider'];
  llmConfigured: boolean;
  llmSmoke: {
    attempted: boolean;
    ok: boolean;
    message: string | null;
  };
  pluginManifestExists: boolean;
  mcpConfigExists: boolean;
  pluginManifestValid: boolean;
  mcpConfigUsesPluginRoot: boolean;
  skillFilesPresent: string[];
  missingSurfaceFiles: string[];
}

export async function setupSupeEnvironment(): Promise<SetupResult> {
  await ensureSupeHome();
  const existing = await loadConfig();
  const nextConfig = await withDetectedRuntimeCommands(existing);
  await saveConfig(nextConfig);

  return collectSetupResult();
}

export async function diagnoseSupeEnvironment(
  options: { liveLlmCheck?: boolean } = {},
): Promise<DoctorResult> {
  const base = await collectSetupResult();
  const config = await loadConfig();
  const requiredSkillFiles = [
    join(base.skillsPath, 'supe-contracts', 'SKILL.md'),
    join(base.skillsPath, 'supe-doctor', 'SKILL.md'),
    join(base.skillsPath, 'supe-report', 'SKILL.md'),
    join(base.skillsPath, 'supe-resume', 'SKILL.md'),
    join(base.skillsPath, 'supe-run', 'SKILL.md'),
    join(base.skillsPath, 'supe-status', 'SKILL.md'),
    join(base.skillsPath, 'supe-setup', 'SKILL.md'),
    join(base.skillsPath, 'supe-stop', 'SKILL.md'),
  ];
  const surfaceChecks = await Promise.all([
    pathExists(base.pluginManifestPath),
    pathExists(base.mcpConfigPath),
    ...requiredSkillFiles.map(pathExists),
  ]);
  const pluginManifestExists = surfaceChecks[0];
  const mcpConfigExists = surfaceChecks[1];
  const skillChecks = surfaceChecks.slice(2);
  const skillFilesPresent = requiredSkillFiles.filter((_, idx) => skillChecks[idx]);
  const pluginManifestValid = pluginManifestExists
    ? await hasExpectedPluginPointers(base.pluginManifestPath)
    : false;
  const mcpConfigUsesPluginRoot = mcpConfigExists
    ? await mcpConfigReferencesPluginRoot(base.mcpConfigPath)
    : false;
  const missingSurfaceFiles = [
    ...(pluginManifestExists ? [] : [base.pluginManifestPath]),
    ...(mcpConfigExists ? [] : [base.mcpConfigPath]),
    ...requiredSkillFiles.filter((_, idx) => !skillChecks[idx]),
  ];

  return {
    ...base,
    configExists: await pathExists(base.configPath),
    distBuilt: await pathExists(join(REPO_ROOT, 'dist', 'index.js')),
    llmProvider: config.llm.analysisProvider,
    llmConfigured: isLlmConfigured(config),
    llmSmoke: await probeLlm(config, options.liveLlmCheck === true),
    pluginManifestExists,
    mcpConfigExists,
    pluginManifestValid,
    mcpConfigUsesPluginRoot,
    skillFilesPresent,
    missingSurfaceFiles,
  };
}

async function collectSetupResult(): Promise<SetupResult> {
  return {
    supeHome: getSupeHome(),
    configPath: join(getSupeHome(), 'config.json'),
    runtimes: detectRuntimes(),
    runtimeContracts: RUNTIME_ADAPTER_CONTRACTS,
    hostCapabilities: HOST_CAPABILITIES_REGISTRY,
    pluginManifestPath: join(REPO_ROOT, '.claude-plugin', 'plugin.json'),
    mcpConfigPath: join(REPO_ROOT, '.mcp.json'),
    skillsPath: join(REPO_ROOT, 'skills'),
  };
}

export function detectRuntimes(): RuntimeDetection[] {
  return [
    detectRuntime('claude'),
    detectRuntime('codex'),
  ];
}

async function withDetectedRuntimeCommands(config: GlobalConfig): Promise<GlobalConfig> {
  const runtimes = detectRuntimes();
  const next: GlobalConfig = {
    ...config,
    agents: {
      ...config.agents,
      claude: { ...config.agents.claude },
      codex: { ...config.agents.codex },
    },
  };

  for (const runtime of runtimes) {
    if (!runtime.available || !runtime.path) {
      continue;
    }
    next.agents[runtime.command].command = runtime.path;
  }

  await mkdir(join(REPO_ROOT, '.claude-plugin'), { recursive: true });
  await mkdir(join(REPO_ROOT, 'skills'), { recursive: true });
  return next;
}

function detectRuntime(command: 'claude' | 'codex'): RuntimeDetection {
  const result = spawnSync('sh', ['-lc', `command -v ${command}`], {
    encoding: 'utf8',
  });
  const resolved = result.status === 0 ? result.stdout.trim() : '';
  const smoke = resolved.length > 0 ? probeRuntime(resolved) : null;
  return {
    command,
    available: resolved.length > 0,
    path: resolved.length > 0 ? resolved : null,
    smokeOk: smoke?.ok ?? false,
    smokeCommand: smoke?.usedFlag ?? null,
    version: smoke?.output ?? null,
  };
}

function probeRuntime(path: string): { ok: boolean; usedFlag: string; output: string | null } {
  for (const flag of ['--version', '-v', '--help']) {
    const result = spawnSync(path, [flag], {
      encoding: 'utf8',
    });
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
    if (result.status === 0 && output.length > 0) {
      return {
        ok: true,
        usedFlag: flag,
        output: output.split('\n')[0] ?? null,
      };
    }
  }

  return {
    ok: false,
    usedFlag: '--version',
    output: null,
  };
}

async function probeLlm(
  config: GlobalConfig,
  live: boolean,
): Promise<DoctorResult['llmSmoke']> {
  if (!live) {
    return {
      attempted: false,
      ok: false,
      message: 'Live LLM check not requested.',
    };
  }

  if (!isLlmConfigured(config)) {
    return {
      attempted: true,
      ok: false,
      message: 'LLM is not configured.',
    };
  }

  try {
    initLlmClient(config.llm);
    const response = await callLlm('Reply with exactly OK.', { maxTokens: 8 });
    return {
      attempted: true,
      ok: response.trim().toUpperCase().includes('OK'),
      message: response.trim(),
    };
  } catch (error) {
    return {
      attempted: true,
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function hasExpectedPluginPointers(path: string): Promise<boolean> {
  try {
    const raw = await readFile(path, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parsed.skills === './skills/' && parsed.mcpServers === './.mcp.json';
  } catch {
    return false;
  }
}

async function mcpConfigReferencesPluginRoot(path: string): Promise<boolean> {
  try {
    const raw = await readFile(path, 'utf-8');
    return raw.includes('${CLAUDE_PLUGIN_ROOT}/dist/index.js');
  } catch {
    return false;
  }
}
