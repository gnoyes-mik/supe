import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { mkdir, writeFile, access } from 'fs/promises';
import { appendFileSync } from 'fs';
import { join } from 'path';
import type {
  Universe,
  Session,
  AgentConfig,
  LogEntry,
  Pollen,
  IterationContext,
  UniverseMetrics,
} from '../types.js';
import { getAgentRunner } from '../agents/base.js';
import {
  initRepo,
  createGit,
  getCommitCount,
  getFileCount,
  getLatestCommitMessage,
  isGitRepo,
  cloneRepo,
} from '../utils/git.js';
import { copyDir, appendToGitignore } from '../utils/fs.js';
import { logger } from '../utils/logger.js';
import { buildPrompt, writePromptFile } from './prompt-builder.js';
import { assessCriteriaProgress, calculatePercentage } from './progress-detector.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class UniverseRunner {
  private emitter: EventEmitter;
  private session: Session;
  private agentConfigs: Record<string, AgentConfig>;
  private stopRequested = false;
  private currentProc: ChildProcess | null = null;

  constructor(
    emitter: EventEmitter,
    session: Session,
    agentConfigs: Record<string, AgentConfig>,
  ) {
    this.emitter = emitter;
    this.session = session;
    this.agentConfigs = agentConfigs;
  }

  async setup(universe: Universe): Promise<void> {
    let git;

    if (this.session.config.baseRepoPath) {
      const isGit = await isGitRepo(this.session.config.baseRepoPath);

      if (isGit) {
        // git repo → clone + 새 브랜치 (히스토리 보존, 에이전트가 활용)
        git = await cloneRepo(this.session.config.baseRepoPath, universe.workdir, universe.gitBranch);
      } else {
        // non-git → 파일 복사 + git init
        await copyDir(this.session.config.baseRepoPath, universe.workdir);
        git = await initRepo(universe.workdir, universe.gitBranch);
        await git.add('.');
        await git.commit('init: imported base project');
      }

      await appendToGitignore(universe.workdir);
      await git.add('.gitignore');
    } else {
      // 기존 동작: 빈 디렉토리
      git = await initRepo(universe.workdir, universe.gitBranch);
      await writeFile(join(universe.workdir, '.gitignore'), '.supe/\n');
      await git.add('.gitignore');
      await git.commit('init: universe setup');
    }

    await mkdir(join(universe.workdir, '.supe', 'pollens'), { recursive: true });

    const promptContent = await buildPrompt(universe.config, this.session.spec.parsed);
    await writePromptFile(universe.workdir, promptContent);
    await git.add('PROMPT.md');
    await git.commit('supe: universe prompt');

    await this.saveState(universe);

    logger.info('universe-runner', `Universe ${universe.config.symbol} setup complete`, universe.id);
  }

  async start(universe: Universe): Promise<void> {
    universe.status = 'running';
    universe.startedAt = new Date().toISOString();

    this.emitter.emit('universe:started', {
      universeId: universe.id,
      symbol: universe.config.symbol,
    });

    let previousResult: 'success' | 'failed' | 'first' = 'first';

    while (true) {
      if (this.shouldStop(universe)) break;

      const context = await this.buildIterationContext(universe, previousResult);

      const exitCode = await this.runAgentIteration(universe, context);
      previousResult = exitCode === 0 ? 'success' : 'failed';

      if (exitCode === 0) {
        universe.restartCount = 0;
      } else {
        universe.restartCount++;
        this.emitter.emit('universe:failed', {
          universeId: universe.id,
          symbol: universe.config.symbol,
          error: `Exit code ${exitCode}`,
          restartCount: universe.restartCount,
        });
      }

      await this.updateProgress(universe);

      if (await this.isComplete(universe)) {
        universe.status = 'completed';
        universe.progress.percentage = 100;
        break;
      }

      await sleep(2000);
    }

    universe.completedAt = new Date().toISOString();
    universe.metrics = await this.collectMetrics(universe);
    await this.saveState(universe);

    this.emitter.emit('universe:completed', {
      universeId: universe.id,
      symbol: universe.config.symbol,
      metrics: universe.metrics,
    });
  }

  requestStop(): void {
    this.stopRequested = true;
    if (this.currentProc) {
      this.currentProc.kill('SIGTERM');
    }
  }

  private async buildIterationContext(
    universe: Universe,
    previousResult: 'success' | 'failed' | 'first',
  ): Promise<IterationContext> {
    const git = createGit(universe.workdir);
    const filesCount = await getFileCount(git);
    const commitsCount = await getCommitCount(git);

    let criteriaStatus = universe.progress.criteriaProgress;
    if (universe.agentProcess.iterationCount > 0 && universe.agentProcess.iterationCount % 3 === 0) {
      try {
        criteriaStatus = await assessCriteriaProgress(universe.workdir, this.session.spec.parsed);
        universe.progress.criteriaProgress = criteriaStatus;
      } catch {
      }
    }

    return {
      iterationNumber: universe.agentProcess.iterationCount + 1,
      previousResult,
      criteriaStatus,
      pendingPollens: universe.pendingPollens,
      filesCount,
      commitsCount,
    };
  }

  private buildDynamicPrompt(universe: Universe, context: IterationContext): string {
    const lines: string[] = [
      'Read PROMPT.md and continue working on the project.',
      'Check what has been done so far (look at existing files and git log).',
      '',
      '[ITERATION CONTEXT]',
      `- This is iteration ${context.iterationNumber}. Previous iteration: ${context.previousResult}.`,
      `- Files: ${context.filesCount}, Commits: ${context.commitsCount}.`,
      '- Criteria progress:',
    ];

    for (const cs of context.criteriaStatus) {
      const icon = cs.status === 'verified' || cs.status === 'likely_done' ? '✅' : '□';
      lines.push(`  ${icon} ${cs.criterion}`);
    }

    const unchecked = context.criteriaStatus.filter(
      (c) => c.status === 'not_started' || c.status === 'in_progress',
    );
    if (unchecked.length > 0) {
      lines.push('- Focus on unchecked criteria above.');
    }

    if (context.pendingPollens.length > 0) {
      lines.push('');
      lines.push('[CROSS-POLLINATION ALERT]');
      for (const pollen of context.pendingPollens) {
        lines.push(`Universe ${pollen.sourceSymbol} discovered: "${pollen.title}"`);
        lines.push(`> ${pollen.insight}`);
      }
      lines.push('→ If useful for your approach, adopt and note in POLLEN_RESPONSE.md');
      lines.push('→ If not relevant, briefly note why in POLLEN_RESPONSE.md');
    }

    lines.push('');
    lines.push('[DISCOVERY]');
    lines.push('If you find a reusable insight (approach-agnostic pattern/warning/data),');
    lines.push('write it to DISCOVERY.md.');
    lines.push('');
    lines.push('If all success criteria are met, create DONE.md with a summary.');

    return lines.join('\n');
  }

  private async runAgentIteration(universe: Universe, context: IterationContext): Promise<number> {
    const agentConfig = this.agentConfigs[universe.config.agent];
    if (!agentConfig) throw new Error(`No config for agent: ${universe.config.agent}`);

    const runner = getAgentRunner(universe.config.agent);
    const dynamicPrompt = this.buildDynamicPrompt(universe, context);

    const command = runner.buildCommand(agentConfig);
    const args = runner.buildArgs(agentConfig, dynamicPrompt);

    const proc = spawn(command, args, {
      cwd: universe.workdir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    this.currentProc = proc;
    universe.agentProcess.pid = proc.pid ?? null;
    universe.agentProcess.iterationCount++;
    universe.agentProcess.lastIterationAt = new Date().toISOString();
    universe.agentProcess.command = command;
    universe.agentProcess.args = args;

    universe.pendingPollens = [];

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
      const lines = data.toString().trim().split('\n');
      const lastLine = lines[lines.length - 1];
      if (lastLine) {
        universe.progress.currentPhase = lastLine.slice(0, 100);
      }
    });

    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    const exitCode = await new Promise<number>((resolve) => {
      proc.on('close', (code) => resolve(code ?? 1));
      proc.on('error', () => resolve(1));
    });

    this.currentProc = null;

    this.appendLog(universe, {
      level: exitCode === 0 ? 'info' : 'warn',
      source: 'agent-process',
      message: `Agent iteration ${universe.agentProcess.iterationCount} exited with code ${exitCode}`,
      data: {
        exitCode,
        stdoutTail: stdout.slice(-500),
        stderrTail: stderr.slice(-500),
      },
    });

    universe.agentProcess.pid = null;
    return exitCode;
  }

  private shouldStop(universe: Universe): boolean {
    if (this.stopRequested) {
      universe.status = 'stopped';
      return true;
    }
    if (universe.progress.estimatedCostUsd >= this.session.config.maxCostPerUniverseUsd) {
      universe.status = 'stopped';
      universe.error = 'Cost limit exceeded';
      return true;
    }
    if (universe.restartCount >= 3) {
      universe.status = 'failed';
      universe.error = 'Max restarts exceeded (3 consecutive failures)';
      return true;
    }
    if (universe.status === 'stopped' || universe.status === 'failed') {
      return true;
    }
    return false;
  }

  private async isComplete(universe: Universe): Promise<boolean> {
    try {
      await access(join(universe.workdir, 'DONE.md'));
      return true;
    } catch {
      return false;
    }
  }

  private async updateProgress(universe: Universe): Promise<void> {
    const git = createGit(universe.workdir);

    universe.progress.totalCommits = await getCommitCount(git);
    universe.progress.lastCommitMessage = await getLatestCommitMessage(git);
    universe.progress.filesCreated = await getFileCount(git);
    universe.progress.percentage = calculatePercentage(universe.progress.criteriaProgress);
    universe.progress.lastActivityAt = new Date().toISOString();
    universe.progress.estimatedCostUsd = universe.agentProcess.iterationCount * 0.8;

    await this.saveState(universe);

    this.emitter.emit('universe:progress', {
      universeId: universe.id,
      symbol: universe.config.symbol,
      progress: universe.progress,
    });
  }

  private async collectMetrics(universe: Universe): Promise<UniverseMetrics> {
    const git = createGit(universe.workdir);
    const fileCount = await getFileCount(git);
    const commitCount = await getCommitCount(git);

    const sessionPollens = this.session.pollens;
    const pollenEmitted = sessionPollens.filter((p) => p.sourceUniverseId === universe.id).length;
    const pollenReceived = sessionPollens.filter((p) =>
      p.targets.some((t) => t.universeId === universe.id && t.status !== 'rejected'),
    ).length;
    const pollenApplied = sessionPollens.filter((p) =>
      p.targets.some(
        (t) =>
          t.universeId === universe.id && (t.status === 'applied' || t.status === 'adapted'),
      ),
    ).length;

    return {
      totalFiles: fileCount,
      totalCommits: commitCount,
      durationMs: Date.now() - new Date(universe.startedAt ?? Date.now()).getTime(),
      estimatedCostUsd: universe.progress.estimatedCostUsd,
      pollenEmitted,
      pollenReceived,
      pollenApplied,
      linesOfCode: null,
      testsPassed: null,
      testsTotal: null,
      buildSuccess: null,
      buildTimeMs: null,
      documentPages: null,
      sectionCount: null,
      referenceSources: null,
    };
  }

  private async saveState(universe: Universe): Promise<void> {
    const statePath = join(universe.workdir, '.supe', 'universe.json');
    const state = {
      id: universe.id,
      status: universe.status,
      progress: universe.progress,
      agentProcess: {
        pid: universe.agentProcess.pid,
        iterationCount: universe.agentProcess.iterationCount,
        lastIterationAt: universe.agentProcess.lastIterationAt,
      },
      restartCount: universe.restartCount,
      error: universe.error,
    };
    await writeFile(statePath, JSON.stringify(state, null, 2));
  }

  private appendLog(universe: Universe, entry: Omit<LogEntry, 'timestamp' | 'universeId'>): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      universeId: universe.id,
      ...entry,
    };

    universe.logs.push(logEntry);
    if (universe.logs.length > 100) {
      universe.logs = universe.logs.slice(-100);
    }

    try {
      const logPath = join(universe.workdir, '.supe', 'logs.jsonl');
      appendFileSync(logPath, `${JSON.stringify(logEntry)}\n`);
    } catch {
    }
  }
}
