import { readFile } from 'fs/promises';
import { join } from 'path';
import type {
  AnalystRubricScores,
  DiscoveryEntry,
  Pollen,
  PollenAbstractionLevel,
  PollenType,
  Session,
  Universe,
} from '../types.js';
import {
  judgePollen,
  normalizeAnalystRubricScores,
  normalizePollenType,
} from '../core/rubric.js';
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
      return discoveries
        .map((discovery) => this.discoveryToPollen(discovery, universe))
        .filter((pollen): pollen is Pollen => pollen !== null);
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

  private discoveryToPollen(discovery: DiscoveryEntry, universe: Universe): Pollen | null {
    const counter = (this.pollenCounters.get(universe.config.symbol) ?? 0) + 1;
    const sourceEvaluation = this.evaluateDiscoveryEntry(discovery);
    if (!sourceEvaluation || sourceEvaluation.judgement === 'reject') {
      return null;
    }
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
      sourceEvaluation,
    };
  }

  private evaluateDiscoveryEntry(discovery: DiscoveryEntry): Pollen['sourceEvaluation'] {
    const lowerInsight = discovery.insight.toLowerCase();
    const riskSeverity = discovery.type === 'warning'
      || /(risk|failure|break|violate|security|compliance|perf|latency|leak)/i.test(lowerInsight)
      ? 85
      : 25;
    const evidenceStrength = discovery.insight.length > 180 ? 75 : discovery.insight.length > 100 ? 65 : 55;
    const transferability = /(stack|library|framework|file path|endpoint)/i.test(lowerInsight) ? 45 : 75;
    const constraintFit = /(contract violation|constraint|must not|forbidden|out of scope)/i.test(lowerInsight) ? 80 : 65;
    const scores: AnalystRubricScores = {
      transferability,
      constraintFit,
      evidenceStrength,
      riskSeverity,
    };
    const judgement = judgePollen(scores);

    return {
      ...scores,
      judgement,
      rationale: discovery.type === 'warning'
        ? 'Discovery.md marked this as a warning and the deterministic keyword scan found concrete risk signals.'
        : 'Discovery.md entry looked reusable and evidence-backed under the deterministic discovery rubric.',
    };
  }

  private async analyzeDiffWithLlm(universe: Universe, diffContent: string): Promise<Pollen[]> {
    const systemPrompt = `You are Supe's deterministic insight rubric.
Only surface insights that are reusable across universes.
Warnings are reserved for likely failures, contract violations, or serious quality/security/compliance/performance risks.
If evidence is weak or the idea is stack-specific, score it low enough that the system can reject it.`;
    const prompt = `You are an insight analyst for a parallel exploration system.

## Context
Universe "${universe.config.symbol}" is working on the following approach:
"${universe.config.approach}"

It is solving this problem:
"${this.session.spec.parsed.problemStatement}"

Fixed problem contract:
- Required outputs: ${this.session.spec.parsed.problemContract.requiredOutputs.join('; ') || '(none stated)'}
- Hard constraints: ${this.session.spec.parsed.problemContract.hardConstraints.join('; ') || '(none stated)'}
- Out of scope: ${this.session.spec.parsed.problemContract.outOfScope.join('; ') || '(none stated)'}

## Recent Changes
${diffContent}

## Your Task
Analyze the recent changes and determine if there are any **transferable insights** — discoveries, patterns, strategies, or warnings that could benefit a DIFFERENT approach to the SAME problem.

Rules:
- Only extract insights that are APPROACH-AGNOSTIC (applicable regardless of specific tools/stack)
- Abstract to the PATTERN level, not the implementation level
- Do NOT include implementation-specific details (variable names, file paths, library APIs)
- Do NOT include sensitive information (API keys, credentials, internal URLs)
- Score every candidate using this rubric:
  - transferability: how reusable this is across universes
  - constraintFit: how safely it fits the fixed problem contract
  - evidenceStrength: how strongly the recent changes support the claim
  - riskSeverity: how serious the downside is if the insight is ignored
- Good/shared insights must be reusable, contract-safe, and evidence-backed.
- Warnings are only for likely failures, contract violations, or serious quality/security/compliance/performance risks.
- Reject anything stack-specific, weakly evidenced, or likely to reduce universe diversity.
- Maximum 2 pollens per analysis (only the most significant)
- If there are no transferable insights, return an empty array

## Response Format (JSON array, no markdown fencing)
[
  {
    "title": "Short title (max 60 chars)",
    "insight": "2-5 sentences describing the transferable insight at pattern level",
    "suggestedType": "pattern | data | strategy | warning",
    "abstractionLevel": "concept | pattern | technique",
    "scores": {
      "transferability": 0,
      "constraintFit": 0,
      "evidenceStrength": 0,
      "riskSeverity": 0
    },
    "rationale": "One sentence on why this is worth sharing or warning about"
  }
]

If no transferable insights, respond with: []`;

    try {
      const results = await callLlmJson<
        Array<{
          title: string;
          insight: string;
          suggestedType: PollenType;
          abstractionLevel: PollenAbstractionLevel;
          scores: Partial<Record<keyof AnalystRubricScores, number>>;
          rationale: string;
        }>
      >(prompt, { systemPrompt, maxTokens: 1800 });

      return results.slice(0, 2).flatMap((result) => {
        const normalizedScores = normalizeAnalystRubricScores(result.scores ?? {});
        const judgement = judgePollen(normalizedScores);
        if (judgement === 'reject') {
          return [];
        }

        const counter = (this.pollenCounters.get(universe.config.symbol) ?? 0) + 1;
        this.pollenCounters.set(universe.config.symbol, counter);

        return [{
          id: `pol_${universe.config.symbol}_${String(counter).padStart(3, '0')}`,
          sessionId: this.session.id,
          sourceUniverseId: universe.id,
          sourceSymbol: universe.config.symbol,
          title: result.title,
          insight: result.insight,
          type: normalizePollenType(result.suggestedType, judgement),
          abstractionLevel: result.abstractionLevel,
          targets: [],
          createdAt: new Date().toISOString(),
          cycleNumber: 0,
          sourceDiffSummary: diffContent.slice(0, 500),
          sourceEvaluation: {
            ...normalizedScores,
            judgement,
            rationale: typeof result.rationale === 'string' && result.rationale.trim().length > 0
              ? result.rationale.trim()
              : 'Structured rubric assessment returned no rationale.',
          },
        }];
      });
    } catch (err) {
      logger.warn('pollen-analyst', `LLM analysis failed: ${err}`, universe.id);
      return [];
    }
  }
}
