import { EventEmitter } from 'events';
import { readFile, writeFile, mkdir, readdir, stat } from 'fs/promises';
import { join } from 'path';
import { nanoid } from 'nanoid';
import type {
  Session, SessionConfig, SessionStatus, SessionEvents,
  ParsedSpec, Universe, UniverseConfig, Pollen, AgentType,
} from '../types.js';
import { getSessionsDir, ensureSupeHome } from '../utils/config.js';
import { logger } from '../utils/logger.js';

export class SessionManager extends EventEmitter {
  private autoSaveTimer: ReturnType<typeof setInterval> | null = null;
  private session: Session | null = null;

  async createSession(
    specPath: string,
    parsedSpec: ParsedSpec,
    config: SessionConfig,
  ): Promise<Session> {
    await ensureSupeHome();
    
    const sessionId = `ses_${nanoid(12)}`;
    const sessionDir = join(getSessionsDir(), sessionId);
    const universesDir = join(sessionDir, 'universes');
    
    await mkdir(sessionDir, { recursive: true });
    await mkdir(universesDir, { recursive: true });
    
    const specContent = await readFile(specPath, 'utf-8');
    
    const universes: Universe[] = parsedSpec.universeConfigs.map((uc) => {
      const symbolName = this.symbolToName(uc.symbol);
      return {
        id: `univ_${nanoid(8)}`,
        sessionId,
        config: uc,
        status: 'pending',
        workdir: join(universesDir, symbolName),
        gitBranch: `universe/${symbolName}`,
        promptPath: join(universesDir, symbolName, 'PROMPT.md'),
        agentProcess: {
          pid: null,
          command: '',
          args: [],
          startedAt: null,
          iterationCount: 0,
          lastIterationAt: null,
        },
        progress: {
          percentage: 0,
          currentPhase: 'Setup complete, waiting to start',
          filesCreated: 0,
          totalCommits: 0,
          lastCommitMessage: '',
          lastActivityAt: new Date().toISOString(),
          estimatedCostUsd: 0,
          criteriaProgress: parsedSpec.successCriteria.map(c => ({
            criterion: c,
            status: 'not_started' as const,
            evidence: '',
          })),
        },
        metrics: null,
        logs: [],
        startedAt: null,
        completedAt: null,
        error: null,
        restartCount: 0,
        pendingPollens: [],
      };
    });
    
    const session: Session = {
      id: sessionId,
      status: 'initializing',
      spec: {
        rawPath: specPath,
        raw: specContent,
        parsed: parsedSpec,
      },
      universes,
      config,
      slack: config.slackEnabled ? {
        channel: config.slackChannel,
        mainMessageTs: '',
        threadTsMap: {},
      } : null,
      pollens: [],
      report: null,
      startedAt: new Date().toISOString(),
      completedAt: null,
      error: null,
    };
    
    await writeFile(join(sessionDir, 'spec.md'), specContent);
    await writeFile(join(sessionDir, 'parsed-spec.json'), JSON.stringify(parsedSpec, null, 2));
    
    await this.saveSession(session);
    
    this.session = session;
    this.startAutoSave(session);
    
    logger.info('session', `Session created: ${sessionId}`);
    return session;
  }

  async loadSession(sessionId: string): Promise<Session> {
    const sessionDir = join(getSessionsDir(), sessionId);
    const sessionPath = join(sessionDir, 'session.json');
    const raw = await readFile(sessionPath, 'utf-8');
    const session = JSON.parse(raw) as Session;
    this.session = session;
    return session;
  }

  async saveSession(session: Session): Promise<void> {
    const sessionDir = join(getSessionsDir(), session.id);
    const sessionPath = join(sessionDir, 'session.json');
    await writeFile(sessionPath, JSON.stringify(session, null, 2));
  }

  async getLatestSession(): Promise<Session | null> {
    const sessionsDir = getSessionsDir();
    try {
      const entries = await readdir(sessionsDir);
      if (entries.length === 0) return null;
      
      let latest: { name: string; mtime: number } | null = null;
      for (const entry of entries) {
        const entryPath = join(sessionsDir, entry);
        const s = await stat(entryPath);
        if (!latest || s.mtimeMs > latest.mtime) {
          latest = { name: entry, mtime: s.mtimeMs };
        }
      }
      
      if (!latest) return null;
      return this.loadSession(latest.name);
    } catch {
      return null;
    }
  }

  async listSessions(): Promise<{ id: string; status: SessionStatus; title: string; startedAt: string }[]> {
    const sessionsDir = getSessionsDir();
    try {
      const entries = await readdir(sessionsDir);
      const sessions: { id: string; status: SessionStatus; title: string; startedAt: string }[] = [];
      
      for (const entry of entries) {
        try {
          const session = await this.loadSession(entry);
          sessions.push({
            id: session.id,
            status: session.status,
            title: session.spec.parsed.title,
            startedAt: session.startedAt,
          });
        } catch { /* skip invalid sessions */ }
      }
      
      return sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    } catch {
      return [];
    }
  }

  updateStatus(session: Session, status: SessionStatus): void {
    session.status = status;
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      session.completedAt = new Date().toISOString();
      this.stopAutoSave();
    }
  }

  emitSessionEvent<K extends keyof SessionEvents>(
    event: K,
    data: SessionEvents[K]
  ): void {
    this.emit(event, data);
  }

  private startAutoSave(session: Session): void {
    this.autoSaveTimer = setInterval(async () => {
      try {
        await this.saveSession(session);
      } catch (err) {
        logger.warn('session', `Auto-save failed: ${err}`);
      }
    }, 30_000);
  }

  private stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  private symbolToName(symbol: string): string {
    const map: Record<string, string> = {
      'α': 'alpha', 'β': 'beta', 'γ': 'gamma', 'δ': 'delta', 'ε': 'epsilon',
      'ζ': 'zeta', 'η': 'eta', 'θ': 'theta', 'ι': 'iota', 'κ': 'kappa',
    };
    return map[symbol] ?? symbol.toLowerCase();
  }

  destroy(): void {
    this.stopAutoSave();
    this.removeAllListeners();
  }
}
