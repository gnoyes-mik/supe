import { readdir, readFile } from 'fs/promises';
import { extname, join } from 'path';
import type { Session, Universe, UniverseMetrics } from '../types.js';
import { createGit, getCommitCount, getFileCount } from '../utils/git.js';
import { logger } from '../utils/logger.js';

const CONTENT_EXTENSIONS = new Set(['.md', '.txt', '.rst', '.adoc']);

export class MetricsCollector {
  constructor(private session: Session) {}

  async collectMetrics(universe: Universe): Promise<UniverseMetrics> {
    const git = createGit(universe.workdir);
    const [totalFiles, totalCommits] = await Promise.all([
      getFileCount(git),
      getCommitCount(git),
    ]);

    const durationMs = this.calculateDurationMs(universe);
    const estimatedCostUsd = universe.usageSummary?.totalCostUsd
      ?? Number((universe.agentProcess.iterationCount * 0.05).toFixed(2));
    const pollenStats = this.collectPollenStats(universe.id);

    const baseMetrics: UniverseMetrics = {
      totalFiles,
      totalCommits,
      durationMs,
      estimatedCostUsd,
      pollenEmitted: pollenStats.emitted,
      pollenReceived: pollenStats.received,
      pollenApplied: pollenStats.applied,
      linesOfCode: null,
      testsPassed: null,
      testsTotal: null,
      buildSuccess: null,
      buildTimeMs: null,
      documentPages: null,
      sectionCount: null,
      referenceSources: null,
    };

    if (this.session.spec.parsed.domain === 'software-development') {
      const devMetrics = await this.collectSoftwareDevMetrics(universe.workdir, universe.logs);
      return {
        ...baseMetrics,
        ...devMetrics,
      };
    }

    const nonDevMetrics = await this.collectNonDevMetrics(universe.workdir);
    return {
      ...baseMetrics,
      ...nonDevMetrics,
    };
  }

  private calculateDurationMs(universe: Universe): number {
    const startedAt = universe.startedAt ? new Date(universe.startedAt).getTime() : Date.now();
    const completedAt = universe.completedAt ? new Date(universe.completedAt).getTime() : Date.now();
    const duration = completedAt - startedAt;
    return duration > 0 ? duration : 0;
  }

  private collectPollenStats(universeId: string): { emitted: number; received: number; applied: number } {
    const emitted = this.session.pollens.filter((pollen) => pollen.sourceUniverseId === universeId).length;
    const received = this.session.pollens.filter((pollen) =>
      pollen.targets.some((target) =>
        target.universeId === universeId
        && target.status !== 'rejected'
        && target.status !== 'skipped'
      )
    ).length;
    const applied = this.session.pollens.filter((pollen) =>
      pollen.targets.some((target) =>
        target.universeId === universeId
        && (target.status === 'applied' || target.status === 'adapted')
      )
    ).length;

    return { emitted, received, applied };
  }

  private async collectSoftwareDevMetrics(
    workdir: string,
    logs: Universe['logs']
  ): Promise<Pick<UniverseMetrics, 'linesOfCode' | 'testsPassed' | 'testsTotal' | 'buildSuccess' | 'buildTimeMs'>> {
    const git = createGit(workdir);

    let linesOfCode: number | null = null;
    try {
      const numstat = await git.raw(['log', '--pretty=tformat:', '--numstat']);
      linesOfCode = this.extractLineCount(numstat);
    } catch (error) {
      logger.warn('reporter', `Failed to calculate LoC: ${String(error)}`);
    }

    const testSummary = this.extractTestSummary(logs);
    const buildSummary = this.extractBuildSummary(logs);

    return {
      linesOfCode,
      testsPassed: testSummary.passed,
      testsTotal: testSummary.total,
      buildSuccess: buildSummary.success,
      buildTimeMs: buildSummary.timeMs,
    };
  }

  private extractLineCount(numstatOutput: string): number | null {
    let added = 0;
    let removed = 0;

    for (const line of numstatOutput.split('\n')) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 3) {
        continue;
      }
      const plus = Number(parts[0]);
      const minus = Number(parts[1]);
      if (Number.isFinite(plus)) {
        added += plus;
      }
      if (Number.isFinite(minus)) {
        removed += minus;
      }
    }

    const total = added + removed;
    return total > 0 ? total : null;
  }

  private extractTestSummary(logs: Universe['logs']): { passed: number | null; total: number | null } {
    const text = logs
      .map((entry) => {
        const data = entry.data ?? {};
        const stdoutTail = typeof data.stdoutTail === 'string' ? data.stdoutTail : '';
        const stderrTail = typeof data.stderrTail === 'string' ? data.stderrTail : '';
        return `${entry.message}\n${stdoutTail}\n${stderrTail}`;
      })
      .join('\n');

    const patterns: RegExp[] = [
      /(\d+)\s+passed(?:[^\d]+(\d+)\s+total)?/i,
      /tests?:\s*(\d+)\s*passed(?:[^\d]+(\d+)\s*total)?/i,
      /(\d+)\/(\d+)\s+tests?\s+passed/i,
      /passing\s*[:=]?\s*(\d+)(?:[^\d]+total\s*[:=]?\s*(\d+))?/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (!match) {
        continue;
      }

      const first = Number(match[1]);
      const second = match[2] ? Number(match[2]) : null;
      if (!Number.isFinite(first)) {
        continue;
      }

      if (pattern.source.includes('\\/(\\d+)')) {
        const total = second !== null && Number.isFinite(second) ? second : null;
        return { passed: first, total };
      }

      if (second !== null && Number.isFinite(second)) {
        const total = second >= first ? second : first;
        return { passed: first, total };
      }

      return { passed: first, total: first };
    }

    return { passed: null, total: null };
  }

  private extractBuildSummary(logs: Universe['logs']): { success: boolean | null; timeMs: number | null } {
    const combined = logs
      .map((entry) => {
        const data = entry.data ?? {};
        const stdoutTail = typeof data.stdoutTail === 'string' ? data.stdoutTail : '';
        const stderrTail = typeof data.stderrTail === 'string' ? data.stderrTail : '';
        return `${entry.message}\n${stdoutTail}\n${stderrTail}`;
      })
      .join('\n')
      .toLowerCase();

    let success: boolean | null = null;
    if (/(build\s+(succeeded|successful|complete)|compiled\s+successfully)/i.test(combined)) {
      success = true;
    }
    if (/(build\s+(failed|error)|compilation\s+failed|failed\s+to\s+build)/i.test(combined)) {
      success = false;
    }

    const timeMatch = combined.match(/(?:build(?:\s+time)?|compiled|built)\s*(?:in|:)?\s*(\d+(?:\.\d+)?)\s*(ms|s|sec|seconds)/i);
    let timeMs: number | null = null;
    if (timeMatch) {
      const value = Number(timeMatch[1]);
      const unit = timeMatch[2]?.toLowerCase();
      if (Number.isFinite(value)) {
        timeMs = unit === 'ms' ? Math.round(value) : Math.round(value * 1000);
      }
    }

    return { success, timeMs };
  }

  private async collectNonDevMetrics(
    workdir: string
  ): Promise<Pick<UniverseMetrics, 'documentPages' | 'sectionCount' | 'referenceSources'>> {
    const files = await this.collectTextFiles(workdir);
    if (files.length === 0) {
      return {
        documentPages: null,
        sectionCount: null,
        referenceSources: null,
      };
    }

    let wordCount = 0;
    let sectionCount = 0;
    let referenceSources = 0;

    for (const filePath of files) {
      try {
        const content = await readFile(filePath, 'utf-8');
        wordCount += this.countWords(content);
        sectionCount += (content.match(/^#{1,6}\s+/gm) ?? []).length;
        referenceSources += (content.match(/https?:\/\/[^\s)]+/g) ?? []).length;
      } catch (error) {
        logger.debug('reporter', `Skipping unreadable file: ${filePath}`, null, {
          error: String(error),
        });
      }
    }

    const documentPages = wordCount > 0 ? Math.max(1, Math.ceil(wordCount / 500)) : null;

    return {
      documentPages,
      sectionCount: sectionCount > 0 ? sectionCount : null,
      referenceSources: referenceSources > 0 ? referenceSources : null,
    };
  }

  private async collectTextFiles(dir: string): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      if (entry.name === '.git' || entry.name === '.supe' || entry.name === 'node_modules') {
        continue;
      }

      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        const nested = await this.collectTextFiles(fullPath);
        files.push(...nested);
        continue;
      }

      if (CONTENT_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
        files.push(fullPath);
      }
    }

    return files;
  }

  private countWords(content: string): number {
    const tokens = content.trim().split(/\s+/).filter(Boolean);
    return tokens.length;
  }
}
