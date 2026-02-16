import readline from 'readline/promises';
import { loadConfig, saveConfig } from '../../utils/config.js';
import type { AgentType, GlobalConfig } from '../../types.js';

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
    const apiKeyAnswer = await rl.question('Anthropic API Key? ');

    const defaultAgent = parseAgent(defaultAgentAnswer) ?? existing.defaultAgent;
    const botToken = pickValue(botTokenAnswer, existing.slack.botToken);
    const appToken = pickValue(appTokenAnswer, existing.slack.appToken);
    const defaultChannel = pickValue(channelAnswer, existing.slack.defaultChannel);
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
        apiKey,
      },
    };

    await saveConfig(config);
    console.log('Supe configuration saved successfully.');
  } finally {
    rl.close();
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
