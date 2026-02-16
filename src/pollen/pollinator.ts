import { EventEmitter } from 'events';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import type { Pollen, PollenTarget, Session, Universe } from '../types.js';
import { callLlmJson } from '../utils/llm.js';
import { logger } from '../utils/logger.js';

export class PollenPollinator {
  private session: Session;
  private emitter: EventEmitter;
  private lastInjectionTime: Map<string, number> = new Map();

  constructor(session: Session, emitter: EventEmitter) {
    this.session = session;
    this.emitter = emitter;
  }

  async pollinate(pollen: Pollen, targets: Universe[]): Promise<void> {
    for (const target of targets) {
      const minInterval = this.session.config.pollenIntervalMs * 0.66;
      const lastTime = this.lastInjectionTime.get(target.id) ?? 0;

      if (Date.now() - lastTime < minInterval) {
        pollen.targets.push({
          universeId: target.id,
          universeSymbol: target.config.symbol,
          relevance: 'medium',
          status: 'skipped',
          injectedAt: null,
          appliedAt: null,
          mutation: null,
          rejectionReason: 'Rate limited: too soon since last injection',
        });
        continue;
      }

      const relevance = await this.assessRelevance(pollen, target);

      if (relevance.relevance === 'low') {
        pollen.targets.push({
          universeId: target.id,
          universeSymbol: target.config.symbol,
          relevance: 'low',
          status: 'rejected',
          injectedAt: null,
          appliedAt: null,
          mutation: null,
          rejectionReason: relevance.reason,
        });
        this.emitter.emit('pollen:rejected', {
          pollenId: pollen.id,
          targetUniverseId: target.id,
          reason: relevance.reason,
        });
        continue;
      }

      await this.injectIntoPrompt(pollen, target, relevance.relevance);
      target.pendingPollens.push(pollen);

      const targetEntry: PollenTarget = {
        universeId: target.id,
        universeSymbol: target.config.symbol,
        relevance: relevance.relevance,
        status: 'injected',
        injectedAt: new Date().toISOString(),
        appliedAt: null,
        mutation: null,
        rejectionReason: null,
      };
      pollen.targets.push(targetEntry);

      this.lastInjectionTime.set(target.id, Date.now());

      this.emitter.emit('pollen:injected', {
        pollenId: pollen.id,
        targetUniverseId: target.id,
        targetSymbol: target.config.symbol,
      });

      logger.info('pollen-pollinator', `Pollen ${pollen.id} injected into Universe ${target.config.symbol}`, target.id);
    }
  }

  private async assessRelevance(
    pollen: Pollen,
    target: Universe
  ): Promise<{ relevance: 'high' | 'medium' | 'low'; reason: string }> {
    const prompt = `You are evaluating whether an insight from one parallel exploration should be shared with another.

## Insight (from Universe ${pollen.sourceSymbol})
Title: ${pollen.title}
${pollen.insight}

## Target (Universe ${target.config.symbol})
Approach: ${target.config.approach}
Current work: ${target.progress.currentPhase}

## Question
How relevant is this insight to the target's current work?

Rules:
- "high": Directly applicable, would clearly improve the target's approach
- "medium": Potentially useful, worth considering but not critical
- "low": Not relevant to this approach, or the target is likely already handling this

Respond with a JSON object (no markdown fencing):
{
  "relevance": "high | medium | low",
  "reason": "One sentence explanation"
}`;

    try {
      const result = await callLlmJson<{ relevance: string; reason: string }>(prompt);
      if (result.relevance === 'high' || result.relevance === 'low' || result.relevance === 'medium') {
        return { relevance: result.relevance, reason: result.reason };
      }
      return { relevance: 'medium', reason: result.reason || 'Invalid relevance returned, defaulting to medium' };
    } catch {
      return { relevance: 'medium', reason: 'Assessment failed, defaulting to medium' };
    }
  }

  private async injectIntoPrompt(
    pollen: Pollen,
    target: Universe,
    relevance: 'high' | 'medium' | 'low'
  ): Promise<void> {
    const promptPath = join(target.workdir, 'PROMPT.md');
    let content: string;

    try {
      content = await readFile(promptPath, 'utf-8');
    } catch {
      return;
    }

    const sectionHeader = '## Cross-Pollination Hints';
    const hint = `### [${pollen.id}] ${pollen.title}
_Source: Universe ${pollen.sourceSymbol} | Relevance: ${relevance}_

${pollen.insight}

---
`;

    if (content.includes(sectionHeader)) {
      const hintCount = (content.match(/^### \[pol_/gm) ?? []).length;
      if (hintCount >= 5) {
        const headerIndex = content.indexOf(sectionHeader);
        const afterHeader = content.slice(headerIndex + sectionHeader.length);
        const firstHintStart = afterHeader.indexOf('### [pol_');
        const secondHintStart = afterHeader.indexOf('### [pol_', firstHintStart + 1);
        if (firstHintStart >= 0 && secondHintStart > firstHintStart) {
          content =
            content.slice(0, headerIndex + sectionHeader.length + firstHintStart) +
            afterHeader.slice(secondHintStart);
        }
      }
      content += `\n${hint}`;
    } else {
      content += `\n\n${sectionHeader}

> These hints come from parallel explorations of the same problem.
> You are NOT required to adopt them. Evaluate each hint and decide
> whether it benefits YOUR approach. If you adopt a hint, adapt it
> to fit your architecture - do NOT copy foreign patterns blindly.

${hint}`;
    }

    await writeFile(promptPath, content);
  }
}
