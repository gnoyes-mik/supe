import readline from 'readline/promises';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { loadConfig, saveConfig } from '../../utils/config.js';
import type { AgentType, GlobalConfig, LlmConfig } from '../../types.js';

export async function initCommand(): Promise<void> {
  const existing = await loadConfig();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const defaultAgentAnswer = await rl.question(
      `Default agent (claude/codex)? [${existing.defaultAgent}] `
    );
    const botTokenAnswer = await rl.question(
      `Slack Bot Token? (${existing.slack.botToken ? 'configured' : 'optional'}) `
    );
    const appTokenAnswer = await rl.question(
      `Slack App Token? (${existing.slack.appToken ? 'configured' : 'optional'}) `
    );
    const channelAnswer = await rl.question(
      `Default Slack channel? [${existing.slack.defaultChannel || 'optional'}] `
    );
    const analysisProviderAnswer = await rl.question(
      `Analysis backend (claude-cli/codex-cli/anthropic-api)? [${existing.llm.analysisProvider}] `
    );
    const apiKeyAnswer = await rl.question('Anthropic API Key? (optional unless using anthropic-api) ');

    const defaultAgent = parseAgent(defaultAgentAnswer) ?? existing.defaultAgent;
    const botToken = pickValue(botTokenAnswer, existing.slack.botToken);
    const appToken = pickValue(appTokenAnswer, existing.slack.appToken);
    const defaultChannel = pickValue(channelAnswer, existing.slack.defaultChannel);
    const analysisProvider = parseAnalysisProvider(analysisProviderAnswer) ?? existing.llm.analysisProvider;
    const apiKey = pickValue(apiKeyAnswer, existing.llm.apiKey);

    const config: GlobalConfig = {
      ...existing,
      defaultAgent,
      agents: {
        ...existing.agents,
        claude: {
          ...existing.agents.claude,
        },
        codex: {
          ...existing.agents.codex,
        },
      },
      slack: {
        botToken,
        appToken,
        defaultChannel,
      },
      llm: {
        ...existing.llm,
        analysisProvider,
        apiKey,
      },
    };

    await saveConfig(config);
    console.log('Supe configuration saved successfully.');

    await generateAgentsMd(process.cwd());
  } finally {
    rl.close();
  }
}

async function generateAgentsMd(cwd: string): Promise<void> {
  const templateDir = join(fileURLToPath(import.meta.url), '..', '..', '..', '..', 'templates');
  let supeSection: string;
  try {
    supeSection = await readFile(join(templateDir, 'AGENTS.md.hbs'), 'utf-8');
  } catch {
    console.log('AGENTS.md template not found, skipping.');
    return;
  }

  const agentsPath = join(cwd, 'AGENTS.md');

  try {
    const existing = await readFile(agentsPath, 'utf-8');
    if (existing.includes('<!-- supe:start -->')) {
      // 이미 Supe 섹션 있음 → 교체
      const updated = existing.replace(
        /<!-- supe:start -->[\s\S]*?<!-- supe:end -->/,
        supeSection.trim(),
      );
      await writeFile(agentsPath, updated);
      console.log('AGENTS.md updated with latest Supe section.');
    } else {
      // AGENTS.md 존재하지만 Supe 섹션 없음 → 끝에 append
      await writeFile(agentsPath, existing + '\n\n' + supeSection.trim() + '\n');
      console.log('Supe section appended to existing AGENTS.md.');
    }
  } catch {
    // AGENTS.md 없음 → 새로 생성
    await writeFile(agentsPath, supeSection.trim() + '\n');
    console.log('AGENTS.md created with Supe section.');
  }
}

function pickValue(input: string, fallback: string): string {
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function parseAgent(input: string): AgentType | undefined {
  const normalized = input.trim().toLowerCase();
  if (normalized === 'claude' || normalized === 'codex') {
    return normalized;
  }
  return undefined;
}

function parseAnalysisProvider(input: string): LlmConfig['analysisProvider'] | undefined {
  const normalized = input.trim().toLowerCase();
  if (
    normalized === 'claude-cli'
    || normalized === 'codex-cli'
    || normalized === 'anthropic-api'
  ) {
    return normalized;
  }
  return undefined;
}
