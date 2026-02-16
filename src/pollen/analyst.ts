import { readFile } from 'fs/promises';
import { join } from 'path';
import type {
  DiscoveryEntry,
  Pollen,
  PollenAbstractionLevel,
  PollenType,
  Session,
  Universe,
} from '../types.js';
import { createGit, getCommitsSince, getCurrentHash, getDiffSince } from '../utils/git.js';
import { callLlmJson } from '../utils/llm.js';
import { logger } from '../utils/logger.js';

export class PollenAnalyst {
  private session: Session;
  private lastScanHashes: Map<string, string> = new Map();
  private pollenCounters: Map<string, number> = new Map();

  constructor(session: Session) {
    this.session = session;
  }

  async analyzeUniverse(universe: Universe): Promise<Pollen[]> {
    const git = createGit(universe.workdir);
    const currentHash = await getCurrentHash(git);
    const lastHash = this.lastScanHashes.get(universe.id) ?? '';

    if (lastHash === currentHash && lastHash !== '') {
      return [];
    }

    const discoveries = await this.readDiscoveryFile(universe);
    if (discoveries.length > 0) {
      logger.info('pollen-analyst', `Found ${discoveries.length} discoveries in DISCOVERY.md`, universe.id);
      this.lastScanHashes.set(universe.id, currentHash);
      return discoveries.map((discovery) => this.discoveryToPollen(discovery, universe));
    }

    if (!lastHash) {
      this.lastScanHashes.set(universe.id, currentHash);
      return [];
    }

    let diffContent = await getDiffSince(git, lastHash);
    if (!diffContent) {
      this.lastScanHashes.set(universe.id, currentHash);
      return [];
    }

    if (diffContent.length > 10000) {
      const commits = await getCommitsSince(git, lastHash);
      diffContent = `Recent commits:\n${commits.join('\n')}`;
    }

    const pollens = await this.analyzeDiffWithLlm(universe, diffContent);
    this.lastScanHashes.set(universe.id, currentHash);
    return pollens;
  }

  private async readDiscoveryFile(universe: Universe): Promise<DiscoveryEntry[]> {
    try {
      const content = await readFile(join(universe.workdir, 'DISCOVERY.md'), 'utf-8');
      return this.parseDiscoveryMd(content);
    } catch {
      return [];
    }
  }

  private parseDiscoveryMd(content: string): DiscoveryEntry[] {
    const entries: DiscoveryEntry[] = [];
    const sections = content.split(/^## /m).filter(Boolean);

    for (const section of sections) {
      const lines = section.trim().split('\n');
      const title = lines[0]?.trim() ?? '';
      if (!title) {
        continue;
      }

      const body = lines.slice(1).join('\n').trim();
      const typeMatch = body.match(/Type:\s*(pattern|data|strategy|warning)/i);
      const pollenType = (typeMatch?.[1]?.toLowerCase() ?? 'pattern') as PollenType;
      const insight = body.replace(/Type:\s*(pattern|data|strategy|warning)/i, '').trim();

      if (insight.length > 10) {
        entries.push({ title, insight, type: pollenType });
      }
    }

    return entries;
  }

  private discoveryToPollen(discovery: DiscoveryEntry, universe: Universe): Pollen {
    const counter = (this.pollenCounters.get(universe.config.symbol) ?? 0) + 1;
    this.pollenCounters.set(universe.config.symbol, counter);

    return {
      id: `pol_${universe.config.symbol}_${String(counter).padStart(3, '0')}`,
      sessionId: this.session.id,
      sourceUniverseId: universe.id,
      sourceSymbol: universe.config.symbol,
      title: discovery.title,
      insight: discovery.insight,
      type: discovery.type,
      abstractionLevel: 'pattern',
      targets: [],
      createdAt: new Date().toISOString(),
      cycleNumber: 0,
      sourceDiffSummary: `From DISCOVERY.md: ${discovery.title}`,
    };
  }

  private async analyzeDiffWithLlm(universe: Universe, diffContent: string): Promise<Pollen[]> {
    const prompt = `You are an insight analyst for a parallel exploration system.

## Context
Universe "${universe.config.symbol}" is working on the following approach:
"${universe.config.approach}"

It is solving this problem:
"${this.session.spec.parsed.problemStatement}"

## Recent Changes
${diffContent}

## Your Task
Analyze the recent changes and determine if there are any **transferable insights** — discoveries, patterns, strategies, or warnings that could benefit a DIFFERENT approach to the SAME problem.

Rules:
- Only extract insights that are APPROACH-AGNOSTIC (applicable regardless of specific tools/stack)
- Abstract to the PATTERN level, not the implementation level
- Do NOT include implementation-specific details (variable names, file paths, library APIs)
- Do NOT include sensitive information (API keys, credentials, internal URLs)
- Maximum 2 pollens per analysis (only the most significant)
- If there are no transferable insights, return an empty array

## Response Format (JSON array, no markdown fencing)
[
  {
    "title": "Short title (max 60 chars)",
    "insight": "2-5 sentences describing the transferable insight at pattern level",
    "type": "pattern | data | strategy | warning",
    "abstractionLevel": "concept | pattern | technique"
  }
]

If no transferable insights, respond with: []`;

    try {
      const results = await callLlmJson<
        Array<{
          title: string;
          insight: string;
          type: PollenType;
          abstractionLevel: PollenAbstractionLevel;
        }>
      >(prompt);

      return results.slice(0, 2).map((result) => {
        const counter = (this.pollenCounters.get(universe.config.symbol) ?? 0) + 1;
        this.pollenCounters.set(universe.config.symbol, counter);

        return {
          id: `pol_${universe.config.symbol}_${String(counter).padStart(3, '0')}`,
          sessionId: this.session.id,
          sourceUniverseId: universe.id,
          sourceSymbol: universe.config.symbol,
          title: result.title,
          insight: result.insight,
          type: result.type,
          abstractionLevel: result.abstractionLevel,
          targets: [],
          createdAt: new Date().toISOString(),
          cycleNumber: 0,
          sourceDiffSummary: diffContent.slice(0, 500),
        };
      });
    } catch (err) {
      logger.warn('pollen-analyst', `LLM analysis failed: ${err}`, universe.id);
      return [];
    }
  }
}
