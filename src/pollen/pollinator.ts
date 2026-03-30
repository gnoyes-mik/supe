import { EventEmitter } from 'events';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import type {
  PollinationRubricScores,
  Pollen,
  PollenTarget,
  PollenTargetEvaluation,
  Session,
  Universe,
} from '../types.js';
import { deriveTargetRelevance, normalizePollinationRubricScores } from '../core/rubric.js';
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
          evaluation: null,
        });
        continue;
      }

      const evaluation = await this.assessRelevance(pollen, target);

      if (evaluation.finalRelevance === 'low') {
        pollen.targets.push({
          universeId: target.id,
          universeSymbol: target.config.symbol,
          relevance: 'low',
          status: 'rejected',
          injectedAt: null,
          appliedAt: null,
          mutation: null,
          rejectionReason: evaluation.reason,
          evaluation,
        });
        this.emitter.emit('pollen:rejected', {
          pollenId: pollen.id,
          targetUniverseId: target.id,
          reason: evaluation.reason,
        });
        continue;
      }

      await this.injectIntoPrompt(pollen, target, evaluation.finalRelevance);
      target.pendingPollens.push(pollen);

      const targetEntry: PollenTarget = {
        universeId: target.id,
        universeSymbol: target.config.symbol,
        relevance: evaluation.finalRelevance,
        status: 'injected',
        injectedAt: new Date().toISOString(),
        appliedAt: null,
        mutation: null,
        rejectionReason: null,
        evaluation,
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
  ): Promise<PollenTargetEvaluation> {
    const systemPrompt = `You are Supe's cross-pollination rubric.
Preserve universe diversity while allowing useful shared insights.
Score high only when the target can benefit without collapsing into the source approach.
Warnings should be shareable when the risk is meaningful and contract-relevant.`;
    const prompt = `You are evaluating whether an insight from one parallel exploration should be shared with another.

## Insight (from Universe ${pollen.sourceSymbol})
Title: ${pollen.title}
${pollen.insight}

## Target (Universe ${target.config.symbol})
Approach: ${target.config.approach}
Current work: ${target.progress.currentPhase}
Fixed contract constraints: ${this.session.spec.parsed.problemContract.hardConstraints.join('; ') || '(none stated)'}
Out of scope: ${this.session.spec.parsed.problemContract.outOfScope.join('; ') || '(none stated)'}

## Question
How relevant is this insight to the target's current work?

Rules:
- Score every candidate using this rubric:
  - relevanceToTarget: direct usefulness for the target's current work
  - constraintFit: safety with respect to the fixed problem contract
  - diversityFit: whether sharing this preserves the target universe's distinct approach
  - timeliness: whether this is actionable right now
- High/medium/low is decided by the system from these scores.
- Warnings should still be shared when the risk is meaningful, even if the target would only adapt them partially.
- Reject anything that would collapse distinct universes into the same approach.

Respond with a JSON object (no markdown fencing):
{
  "scores": {
    "relevanceToTarget": 0,
    "constraintFit": 0,
    "diversityFit": 0,
    "timeliness": 0
  },
  "reason": "One sentence explanation"
}`;

    try {
      const result = await callLlmJson<{
        scores: Partial<Record<keyof PollinationRubricScores, number>>;
        reason: string;
      }>(prompt, { systemPrompt, maxTokens: 900 });
      const scores = normalizePollinationRubricScores(result.scores ?? {});
      return {
        ...scores,
        finalRelevance: deriveTargetRelevance(scores, pollen.type),
        reason: typeof result.reason === 'string' && result.reason.trim().length > 0
          ? result.reason.trim()
          : 'Structured pollination rubric returned no rationale.',
      };
    } catch {
      const scores = normalizePollinationRubricScores({
        relevanceToTarget: pollen.type === 'warning' ? 55 : 50,
        constraintFit: 50,
        diversityFit: 50,
        timeliness: 50,
      });

      return {
        ...scores,
        finalRelevance: deriveTargetRelevance(scores, pollen.type),
        reason: 'Assessment failed, falling back to deterministic medium-safe sharing.',
      };
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
