#!/usr/bin/env node
import { Command } from 'commander';

const program = new Command();

program
  .name('supe')
  .description('Superposition — Define the problem, explore all solutions simultaneously')
  .version('0.1.0');

program
  .command('run')
  .description('Start a new Superposition session')
  .requiredOption('--spec <path>', 'Path to spec file')
  .option('--base-repo <path>', 'Use existing project as base for each universe')
  .option('--universes <number>', 'Number of universes', '3')
  .option('--agent <type>', 'Default agent type')
  .option('--timeout <duration>', 'Max duration', '10h')
  .option('--max-cost <usd>', 'Max total cost in USD', '30')
  .option('--pollen-interval <min>', 'Pollen minimum interval in minutes', '5')
  .option('--json', 'Emit machine-readable JSON output')
  .option('--non-interactive', 'Do not prompt; return machine-readable errors for missing input')
  .option('--yes', 'Auto-confirm prompts that would otherwise require manual confirmation')
  .option('--clarification-json <json>', 'Clarification answers as JSON for non-interactive follow-up runs')
  .option('--clarification-file <path>', 'Path to clarification answers JSON file')
  .option('--no-pollen', 'Disable cross-pollination')
  .option('--no-dashboard', 'Disable live dashboard')
  .option('--resume <session-id>', 'Resume a stopped session')
  .action(async (opts) => {
    const { runCommand } = await import('./cli/commands/run.js');
    await runCommand(opts);
  });

program
  .command('status')
  .description('Show session status')
  .argument('[session-id]', 'Session ID (default: latest)')
  .option('--json', 'Emit machine-readable JSON output')
  .action(async (sessionId: string | undefined, opts: Record<string, unknown>) => {
    const { statusCommand } = await import('./cli/commands/status.js');
    await statusCommand(sessionId, opts);
  });

program
  .command('report')
  .description('Show morning report')
  .argument('[session-id]', 'Session ID (default: latest)')
  .option('--json', 'Emit machine-readable JSON output')
  .action(async (sessionId: string | undefined, opts: Record<string, unknown>) => {
    const { reportCommand } = await import('./cli/commands/report.js');
    await reportCommand(sessionId, opts);
  });

program
  .command('list')
  .description('List all sessions')
  .option('--json', 'Emit machine-readable JSON output')
  .action(async (opts: Record<string, unknown>) => {
    const { listCommand } = await import('./cli/commands/list.js');
    await listCommand(opts);
  });

program
  .command('stop')
  .description('Stop a running session')
  .argument('[session-id]', 'Session ID (default: latest running)')
  .option('--json', 'Emit machine-readable JSON output')
  .action(async (sessionId: string | undefined, opts: Record<string, unknown>) => {
    const { stopCommand } = await import('./cli/commands/stop.js');
    await stopCommand(sessionId, opts);
  });

program
  .command('resume')
  .description('Resume a stopped session')
  .argument('<session-id>', 'Session ID to resume')
  .option('--json', 'Emit machine-readable JSON output')
  .option('--non-interactive', 'Do not prompt; return machine-readable errors for missing input')
  .option('--yes', 'Auto-confirm prompts that would otherwise require manual confirmation')
  .action(async (sessionId: string, opts: Record<string, unknown>) => {
    const { resumeCommand } = await import('./cli/commands/resume.js');
    await resumeCommand(sessionId, opts);
  });

program
  .command('init')
  .description('Initialize Supe configuration')
  .action(async () => {
    const { initCommand } = await import('./cli/commands/init.js');
    await initCommand();
  });

program
  .command('setup')
  .description('Setup Supe runtime and integration prerequisites')
  .option('--json', 'Emit machine-readable JSON output')
  .action(async (opts: Record<string, unknown>) => {
    const { setupCommand } = await import('./cli/commands/setup.js');
    await setupCommand(opts);
  });

program
  .command('doctor')
  .description('Diagnose Supe runtime and integration prerequisites')
  .option('--json', 'Emit machine-readable JSON output')
  .option('--live', 'Attempt a live LLM connectivity check when credentials are configured')
  .action(async (opts: Record<string, unknown>) => {
    const { doctorCommand } = await import('./cli/commands/setup.js');
    await doctorCommand(opts);
  });

program
  .command('contracts')
  .description('Show Supe host-neutral contract snapshot')
  .option('--json', 'Emit machine-readable JSON output')
  .action(async (opts: Record<string, unknown>) => {
    const { contractsCommand } = await import('./cli/commands/contracts.js');
    await contractsCommand(opts);
  });

program
  .command('mcp')
  .description('MCP utilities')
  .argument('<subcommand>', 'Supported: serve')
  .action(async (subcommand: string) => {
    const { mcpCommand } = await import('./cli/commands/mcp.js');
    await mcpCommand(subcommand);
  });

program.parse();
