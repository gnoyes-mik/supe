import { EventEmitter } from 'events';
import type {
  Session, SessionConfig, AgentConfig, Universe,
  Pollen, Report, SessionEvents,
} from '../types.js';
import { logger } from '../utils/logger.js';

interface IUniverseRunner {
  setup(universe: Universe): Promise<void>;
  start(universe: Universe): Promise<void>;
  requestStop(): void;
}

export class Orchestrator {
  private emitter: EventEmitter;
  private session: Session;
  private config: SessionConfig;
  private agentConfigs: Record<string, AgentConfig>;
  private runners: Map<string, IUniverseRunner> = new Map();
  private lastCycleAt = 0;
  private pollenCycleRunning = false;
  private pollenProgressHandler: ((...args: any[]) => void) | null = null;
  private timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private cycleNumber = 0;

  constructor(
    emitter: EventEmitter,
    session: Session,
    agentConfigs: Record<string, AgentConfig>,
  ) {
    this.emitter = emitter;
    this.session = session;
    this.config = session.config;
    this.agentConfigs = agentConfigs;
  }

  async start(): Promise<void> {
    logger.info('orchestrator', `Starting ${this.session.universes.length} universes`);

    const runnerModule = await import('../universe/runner.js');
    const UniverseRunner = (runnerModule as Record<string, unknown>).UniverseRunner as unknown;

    for (const universe of this.session.universes) {
      const runner = new (UniverseRunner as new (emitter: EventEmitter, session: Session, agentConfigs: Record<string, AgentConfig>) => IUniverseRunner)(
        this.emitter,
        this.session,
        this.agentConfigs,
      );
      this.runners.set(universe.id, runner);
      await runner.setup(universe);
    }

    this.timeoutTimer = setTimeout(() => {
      this.handleTimeout();
    }, this.config.maxDurationMs);

    if (this.config.pollenEnabled) {
      this.pollenProgressHandler = (data: { universeId: string; progress: { totalCommits: number } }) => {
        this.onUniverseProgress(data);
      };
      this.emitter.on('universe:progress', this.pollenProgressHandler);
    }

    const promises = this.session.universes.map(universe => {
      const runner = this.runners.get(universe.id)!;
      return runner.start(universe).catch((err: unknown) => {
        logger.error('orchestrator', `Universe ${universe.config.symbol} crashed: ${err}`, universe.id);
        universe.status = 'failed';
        universe.error = String(err);
      });
    });

    await Promise.all(promises);

    this.cleanup();

    const allComplete = this.session.universes.every(
      u => u.status === 'completed' || u.status === 'failed' || u.status === 'stopped'
    );

    if (allComplete) {
      logger.info('orchestrator', 'All universes complete. Generating report...');
      this.emitter.emit('session:all-complete', { report: this.session.report! });
    }
  }

  async stop(): Promise<void> {
    logger.info('orchestrator', 'Stop requested. Shutting down universes...');
    for (const [, runner] of this.runners) {
      runner.requestStop();
    }
    this.cleanup();
  }

  private async runPollenCycle(): Promise<void> {
    this.cycleNumber++;
    const runningUniverses = this.session.universes.filter(u => u.status === 'running');

    if (runningUniverses.length < 2) {
      logger.debug('orchestrator', 'Skipping pollen cycle: fewer than 2 running universes');
      return;
    }

    logger.info('orchestrator', `Pollen cycle ${this.cycleNumber} starting`);
    this.emitter.emit('cycle:started', { cycleNumber: this.cycleNumber });

    try {
      const analystModule = await import('../pollen/analyst.js');
      const pollinatorModule = await import('../pollen/pollinator.js');
      const trackerModule = await import('../pollen/tracker.js');

      const PollenAnalyst = (analystModule as Record<string, unknown>).PollenAnalyst as new (session: Session) => {
        analyzeUniverse(universe: Universe): Promise<Pollen[]>;
      };
      const PollenPollinator = (pollinatorModule as Record<string, unknown>).PollenPollinator as new (session: Session, emitter: EventEmitter) => {
        pollinate(pollen: Pollen, targets: Universe[]): Promise<void>;
      };
      const PollenTracker = (trackerModule as Record<string, unknown>).PollenTracker as new (session: Session) => {
        trackAdoption(pollen: Pollen, target: unknown, targetUniverse: Universe): Promise<void>;
      };

      const analyst = new PollenAnalyst(this.session);
      const pollinator = new PollenPollinator(this.session, this.emitter);
      const tracker = new PollenTracker(this.session);

      const newPollens: Pollen[] = [];
      const analysisPromises = runningUniverses.map(async (universe) => {
        const pollens = await analyst.analyzeUniverse(universe);
        newPollens.push(...pollens);
      });
      await Promise.all(analysisPromises);

      const injectedPollens = this.session.pollens.filter(p =>
        p.targets.some(t => t.status === 'injected')
      );
      for (const pollen of injectedPollens) {
        for (const target of pollen.targets.filter(t => t.status === 'injected')) {
          const targetUniverse = this.session.universes.find(u => u.id === target.universeId);
          if (targetUniverse && targetUniverse.status === 'running') {
            await tracker.trackAdoption(pollen, target, targetUniverse);
          }
        }
      }

      for (const pollen of newPollens) {
        const targets = runningUniverses.filter(u => u.id !== pollen.sourceUniverseId);
        await pollinator.pollinate(pollen, targets);
        this.session.pollens.push(pollen);
      }

      this.emitter.emit('cycle:completed', {
        cycleNumber: this.cycleNumber,
        pollensCreated: newPollens.length,
      });

      logger.info('orchestrator', `Pollen cycle ${this.cycleNumber} complete: ${newPollens.length} new pollens`);
    } catch (err: unknown) {
      logger.error('orchestrator', `Pollen cycle ${this.cycleNumber} failed: ${err}`);
    }
  }

  private handleTimeout(): void {
    logger.warn('orchestrator', 'Session timeout reached. Stopping all universes...');
    this.emitter.emit('session:timeout', {
      elapsedMs: this.config.maxDurationMs,
    });
    for (const [, runner] of this.runners) {
      runner.requestStop();
    }
  }

  private onUniverseProgress(data: { universeId: string; progress: { totalCommits: number } }): void {
    // Skip if initial commits only (setup commits = 2)
    if (data.progress.totalCommits <= 2) return;

    // Skip if minimum interval not elapsed
    const now = Date.now();
    if (now - this.lastCycleAt < this.config.pollenIntervalMs) return;

    // Skip if cycle already running
    if (this.pollenCycleRunning) return;

    this.pollenCycleRunning = true;
    this.lastCycleAt = now;

    this.runPollenCycle()
      .catch((err: unknown) => {
        logger.error('orchestrator', `Pollen cycle error: ${err}`);
      })
      .finally(() => {
        this.pollenCycleRunning = false;
      });
  }

  private cleanup(): void {
    if (this.pollenProgressHandler) {
      this.emitter.removeListener('universe:progress', this.pollenProgressHandler);
      this.pollenProgressHandler = null;
    }
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
  }
}
