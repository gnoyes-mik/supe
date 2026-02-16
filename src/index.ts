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
  .option('--universes <number>', 'Number of universes', '3')
  .option('--agent <type>', 'Default agent type')
  .option('--agents <list>', 'Per-universe agents (comma-separated)')
  .option('--timeout <duration>', 'Max duration', '10h')
  .option('--max-cost <usd>', 'Max total cost in USD', '30')
  .option('--pollen-interval <min>', 'Pollen cycle interval in minutes', '30')
  .option('--channel <id>', 'Slack channel ID')
  .option('--no-slack', 'Disable Slack')
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
  .action(async (sessionId?: string) => {
    const { statusCommand } = await import('./cli/commands/status.js');
    await statusCommand(sessionId);
  });

program
  .command('report')
  .description('Show morning report')
  .argument('[session-id]', 'Session ID (default: latest)')
  .action(async (sessionId?: string) => {
    const { reportCommand } = await import('./cli/commands/report.js');
    await reportCommand(sessionId);
  });

program
  .command('list')
  .description('List all sessions')
  .action(async () => {
    const { listCommand } = await import('./cli/commands/list.js');
    await listCommand();
  });

program
  .command('stop')
  .description('Stop a running session')
  .argument('[session-id]', 'Session ID (default: latest running)')
  .action(async (sessionId?: string) => {
    const { stopCommand } = await import('./cli/commands/stop.js');
    await stopCommand(sessionId);
  });

program
  .command('init')
  .description('Initialize Supe configuration')
  .action(async () => {
    const { initCommand } = await import('./cli/commands/init.js');
    await initCommand();
  });

program.parse();
