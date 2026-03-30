import { diagnoseSupeEnvironment, setupSupeEnvironment } from '../../app/setup-service.js';
import { configureJsonOutput, printJsonSuccess } from '../output.js';

export async function setupCommand(opts: Record<string, unknown> = {}): Promise<void> {
  const jsonMode = Boolean(opts.json);
  configureJsonOutput(jsonMode);

  try {
    const result = await setupSupeEnvironment();
    if (jsonMode) {
      printJsonSuccess(result);
      return;
    }

    console.log('Supe setup complete.');
    console.log(`- Config: ${result.configPath}`);
    console.log(`- Plugin manifest: ${result.pluginManifestPath}`);
    console.log(`- MCP config: ${result.mcpConfigPath}`);
    console.log(`- Skills: ${result.skillsPath}`);
    console.log('- Detected runtimes:');
    for (const runtime of result.runtimes) {
      console.log(`  - ${runtime.command}: ${runtime.available ? runtime.path : 'not found'}`);
    }
  } finally {
    configureJsonOutput(false);
  }
}

export async function doctorCommand(opts: Record<string, unknown> = {}): Promise<void> {
  const jsonMode = Boolean(opts.json);
  const live = Boolean(opts.live);
  configureJsonOutput(jsonMode);

  try {
    const result = await diagnoseSupeEnvironment({ liveLlmCheck: live });
    if (jsonMode) {
      printJsonSuccess(result);
      return;
    }

    console.log('Supe doctor report');
    console.log(`- Config exists: ${result.configExists ? 'yes' : 'no'}`);
    console.log(`- Dist built: ${result.distBuilt ? 'yes' : 'no'}`);
    console.log(`- Plugin manifest exists: ${result.pluginManifestExists ? 'yes' : 'no'}`);
    console.log(`- MCP config exists: ${result.mcpConfigExists ? 'yes' : 'no'}`);
    console.log(`- Plugin manifest valid: ${result.pluginManifestValid ? 'yes' : 'no'}`);
    console.log(`- MCP config uses CLAUDE_PLUGIN_ROOT: ${result.mcpConfigUsesPluginRoot ? 'yes' : 'no'}`);
    console.log(`- LLM configured (${result.llmProvider}): ${result.llmConfigured ? 'yes' : 'no'}`);
    console.log(`- LLM live check: ${result.llmSmoke.attempted ? (result.llmSmoke.ok ? 'ok' : 'failed') : 'skipped'}`);
    if (result.llmSmoke.message) {
      console.log(`  ${result.llmSmoke.message}`);
    }
    if (result.missingSurfaceFiles.length > 0) {
      console.log('- Missing surface files:');
      for (const entry of result.missingSurfaceFiles) {
        console.log(`  - ${entry}`);
      }
    }
    console.log('- Runtimes:');
    for (const runtime of result.runtimes) {
      console.log(`  - ${runtime.command}: ${runtime.available ? runtime.path : 'not found'}`);
    }
  } finally {
    configureJsonOutput(false);
  }
}
