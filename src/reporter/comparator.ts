import type {
  PollenStats,
  RankingCategory,
  Report,
  Session,
  Universe,
  UniverseMetrics,
  UniverseResult,
} from '../types.js';
import { callLlm, callLlmJson } from '../utils/llm.js';
import { logger } from '../utils/logger.js';
import { MetricsCollector } from './metrics.js';

interface RankingCategoryResponse {
  category: string;
  rankings: Array<{
    rank: number;
    universeId: string;
    universeSymbol: string;
    score: string;
  }>;
}

interface ComparisonSummaryResponse {
  headline: string;
  differences: string[];
}

export class ReportComparator {
  constructor(private session: Session) {}

  async generateReport(): Promise<Report> {
    const collector = new MetricsCollector(this.session);
    const universeResults = await Promise.all(
      this.session.universes.map((universe) => this.buildUniverseResult(universe, collector))
    );

    const rankings = await this.generateRankings(universeResults);
    const summary = await this.generateSummary(universeResults, rankings);
    const pollenStats = this.buildPollenStats();
    const comparisonSummary = await this.generateComparisonSummary(
      universeResults,
      rankings,
      pollenStats,
    );

    return {
      sessionId: this.session.id,
      generatedAt: new Date().toISOString(),
      summary,
      universeResults,
      rankings,
      pollenStats,
      comparisonSummary,
    };
  }

  private async buildUniverseResult(
    universe: Universe,
    collector: MetricsCollector
  ): Promise<UniverseResult> {
    let metrics = universe.metrics;
    if (!metrics && universe.status === 'completed') {
      metrics = await collector.collectMetrics(universe);
      universe.metrics = metrics;
    }

    return {
      universeId: universe.id,
      symbol: universe.config.symbol,
      name: universe.config.name,
      status: universe.status,
      approach: universe.config.approach,
      optimizationAxis: universe.config.optimizationAxis,
      tools: universe.config.tools,
      estimatedStrength: universe.config.estimatedStrength,
      estimatedWeakness: universe.config.estimatedWeakness,
      metrics,
      highlights: this.buildHighlights(universe, metrics),
    };
  }

  private buildHighlights(universe: Universe, metrics: UniverseMetrics | null): string[] {
    const highlights: string[] = [];

    if (universe.status === 'completed') {
      highlights.push('Completed all planned iterations.');
    } else if (universe.status === 'failed') {
      highlights.push(`Failed after ${universe.restartCount} restart attempts.`);
    } else if (universe.status === 'stopped') {
      highlights.push('Stopped before full completion.');
    }

    if (metrics) {
      highlights.push(`Produced ${metrics.totalFiles} files and ${metrics.totalCommits} commits.`);
      highlights.push(`Cross-pollination impact: ${metrics.pollenApplied}/${metrics.pollenReceived} applied.`);
      if (metrics.linesOfCode !== null) {
        highlights.push(`Code change volume around ${metrics.linesOfCode.toLocaleString()} LoC.`);
      } else if (metrics.documentPages !== null) {
        highlights.push(`Generated approximately ${metrics.documentPages} pages of content.`);
      }
    } else {
      highlights.push('No metrics available yet.');
    }

    highlights.push(`Primary axis: ${universe.config.optimizationAxis}.`);

    return highlights.slice(0, 3);
  }

  private async generateRankings(universeResults: UniverseResult[]): Promise<RankingCategory[]> {
    const prompt = `You are evaluating results from multiple universes that solved the same task.

Return rankings across exactly 4 categories:
1) Execution Completeness
2) Technical/Content Quality
3) Efficiency
4) Cost Effectiveness

Each category must rank every universe.
Use rank starting at 1 (1 is best).
Score field must be a short string like "9/10 - clear rationale".

Input data:
${JSON.stringify(universeResults, null, 2)}

Respond with JSON only:
[
  {
    "category": "Execution Completeness",
    "rankings": [
      {
        "rank": 1,
        "universeId": "univ_xxx",
        "universeSymbol": "α",
        "score": "9/10 - ..."
      }
    ]
  }
]`;

    try {
      const llmRankings = await callLlmJson<RankingCategoryResponse[]>(prompt, { maxTokens: 2200 });
      return this.normalizeRankings(llmRankings, universeResults);
    } catch (error) {
      logger.warn('reporter', `Ranking generation failed, using fallback: ${String(error)}`);
      return this.buildFallbackRankings(universeResults);
    }
  }

  private normalizeRankings(
    raw: RankingCategoryResponse[],
    universeResults: UniverseResult[]
  ): RankingCategory[] {
    if (!Array.isArray(raw) || raw.length === 0) {
      return this.buildFallbackRankings(universeResults);
    }

    const universeMap = new Map(universeResults.map((result) => [result.universeId, result]));
    const normalized: RankingCategory[] = [];

    for (const category of raw) {
      if (typeof category.category !== 'string' || !Array.isArray(category.rankings)) {
        continue;
      }

      const rankings = category.rankings
        .filter((entry) => typeof entry.universeId === 'string' && universeMap.has(entry.universeId))
        .map((entry, index) => ({
          rank: Number.isFinite(entry.rank) && entry.rank > 0 ? Math.floor(entry.rank) : index + 1,
          universeId: entry.universeId,
          universeSymbol:
            typeof entry.universeSymbol === 'string' && entry.universeSymbol.length > 0
              ? entry.universeSymbol
              : universeMap.get(entry.universeId)?.symbol ?? '?',
          score:
            typeof entry.score === 'string' && entry.score.trim().length > 0
              ? entry.score.trim()
              : 'N/A',
        }))
        .sort((a, b) => a.rank - b.rank)
        .slice(0, universeResults.length);

      if (rankings.length > 0) {
        normalized.push({ category: category.category.trim(), rankings });
      }
    }

    if (normalized.length === 0) {
      return this.buildFallbackRankings(universeResults);
    }

    return normalized;
  }

  private buildFallbackRankings(universeResults: UniverseResult[]): RankingCategory[] {
    const byProductivity = [...universeResults]
      .sort((a, b) => this.metricOrZero(b.metrics, 'totalCommits') - this.metricOrZero(a.metrics, 'totalCommits'));
    const byOutput = [...universeResults]
      .sort((a, b) => this.metricOrZero(b.metrics, 'totalFiles') - this.metricOrZero(a.metrics, 'totalFiles'));
    const byEfficiency = [...universeResults]
      .sort((a, b) => this.metricOrZero(a.metrics, 'durationMs') - this.metricOrZero(b.metrics, 'durationMs'));
    const byCost = [...universeResults]
      .sort((a, b) => this.metricOrZero(a.metrics, 'estimatedCostUsd') - this.metricOrZero(b.metrics, 'estimatedCostUsd'));

    return [
      this.mapRankingCategory('Execution Completeness', byProductivity, (r) => `${r.metrics?.totalCommits ?? 0} commits`),
      this.mapRankingCategory('Technical/Content Quality', byOutput, (r) => `${r.metrics?.totalFiles ?? 0} files`),
      this.mapRankingCategory('Efficiency', byEfficiency, (r) => `${this.formatDuration(r.metrics?.durationMs ?? 0)}`),
      this.mapRankingCategory('Cost Effectiveness', byCost, (r) => `$${(r.metrics?.estimatedCostUsd ?? 0).toFixed(2)}`),
    ];
  }

  private mapRankingCategory(
    category: string,
    results: UniverseResult[],
    scoreFn: (result: UniverseResult) => string
  ): RankingCategory {
    return {
      category,
      rankings: results.map((result, index) => ({
        rank: index + 1,
        universeId: result.universeId,
        universeSymbol: result.symbol,
        score: scoreFn(result),
      })),
    };
  }

  private async generateSummary(
    universeResults: UniverseResult[],
    rankings: RankingCategory[]
  ): Promise<string> {
    const prompt = `Create a concise executive summary in 3-5 sentences.

Context:
- Session title: ${this.session.spec.parsed.title}
- Domain: ${this.session.spec.parsed.domain}
- Universe results: ${JSON.stringify(universeResults, null, 2)}
- Rankings: ${JSON.stringify(rankings, null, 2)}

Guidelines:
- Compare trade-offs, not just rankings.
- Mention where cross-pollination helped.
- Keep it concrete and decision-ready.`;

    try {
      const summary = await callLlm(prompt, { maxTokens: 500 });
      return summary.trim();
    } catch (error) {
      logger.warn('reporter', `Summary generation failed, using fallback: ${String(error)}`);
      return this.buildFallbackSummary(universeResults, rankings);
    }
  }

  private buildFallbackSummary(universeResults: UniverseResult[], rankings: RankingCategory[]): string {
    const completed = universeResults.filter((result) => result.status === 'completed').length;
    const primaryAxes = universeResults
      .map((result) => `${result.symbol}: ${result.optimizationAxis}`)
      .join(', ');

    return [
      `${completed}/${universeResults.length} universes completed successfully for "${this.session.spec.parsed.title}".`,
      `The run surfaces clear trade-offs across these primary axes: ${primaryAxes}.`,
      rankings.length > 0
        ? `Comparison rankings were generated across ${rankings.length} lenses.`
        : 'No ranking data was available, so the report focuses on qualitative differences.',
      'Cross-pollination signals indicate meaningful idea transfer across approaches.',
    ].join(' ');
  }

  private buildPollenStats(): PollenStats {
    const totalCreated = this.session.pollens.length;
    const totalApplied = this.session.pollens.reduce(
      (sum, pollen) => sum + pollen.targets.filter((target) => target.status === 'applied').length,
      0
    );
    const totalAdapted = this.session.pollens.reduce(
      (sum, pollen) => sum + pollen.targets.filter((target) => target.status === 'adapted').length,
      0
    );
    const totalRejected = this.session.pollens.reduce(
      (sum, pollen) => sum + pollen.targets.filter((target) => target.status === 'rejected').length,
      0
    );

    const sourceCounts = new Map<string, number>();
    const influenceCounts = new Map<string, number>();
    const notableEntanglements: PollenStats['notableEntanglements'] = [];

    for (const pollen of this.session.pollens) {
      sourceCounts.set(pollen.sourceSymbol, (sourceCounts.get(pollen.sourceSymbol) ?? 0) + 1);

      for (const target of pollen.targets) {
        if (target.status === 'injected' || target.status === 'applied' || target.status === 'adapted') {
          influenceCounts.set(
            target.universeSymbol,
            (influenceCounts.get(target.universeSymbol) ?? 0) + 1
          );
        }

        if ((target.status === 'applied' || target.status === 'adapted') && notableEntanglements.length < 5) {
          const detail = target.mutation && target.mutation.length > 0
            ? target.mutation
            : `${pollen.title} adopted with minimal mutation`;
          notableEntanglements.push({
            pollenId: pollen.id,
            description: `${pollen.sourceSymbol} -> ${target.universeSymbol}: ${detail}`,
          });
        }
      }
    }

    return {
      totalCreated,
      totalApplied,
      totalAdapted,
      totalRejected,
      mostActiveSource: this.pickMaxKey(sourceCounts),
      mostInfluenced: this.pickMaxKey(influenceCounts),
      notableEntanglements,
    };
  }

  private async generateComparisonSummary(
    universeResults: UniverseResult[],
    rankings: RankingCategory[],
    pollenStats: PollenStats
  ): Promise<Report['comparisonSummary']> {
    const prompt = `Summarize the key differences across these universes.

Session context:
- Problem: ${this.session.spec.parsed.problemStatement}
- Domain: ${this.session.spec.parsed.domain}

Universe results:
${JSON.stringify(universeResults, null, 2)}

Rankings:
${JSON.stringify(rankings, null, 2)}

Pollen stats:
${JSON.stringify(pollenStats, null, 2)}

Respond with JSON only:
{
  "headline": "One sentence capturing the overall split between universes",
  "differences": [
    "3-5 concise bullets explaining how the universes differ in approach, trade-offs, or validation focus"
  ]
}`;

    try {
      const raw = await callLlmJson<ComparisonSummaryResponse>(prompt, { maxTokens: 900 });
      if (
        typeof raw.headline !== 'string'
        || raw.headline.trim().length === 0
        || !Array.isArray(raw.differences)
      ) {
        return this.buildFallbackComparisonSummary(universeResults, rankings, pollenStats);
      }

      return {
        headline: raw.headline.trim(),
        differences: raw.differences
          .filter((entry): entry is string => typeof entry === 'string')
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0)
          .slice(0, 5),
      };
    } catch (error) {
      logger.warn('reporter', `Comparison summary generation failed, using fallback: ${String(error)}`);
      return this.buildFallbackComparisonSummary(universeResults, rankings, pollenStats);
    }
  }

  private buildFallbackComparisonSummary(
    universeResults: UniverseResult[],
    rankings: RankingCategory[],
    pollenStats: PollenStats
  ): Report['comparisonSummary'] {
    if (universeResults.length === 0) {
      return {
        headline: 'No universe results were available for comparison.',
        differences: [],
      };
    }

    const differences = universeResults.slice(0, 5).map((result) => {
      const toolSummary = result.tools.length > 0 ? result.tools.join(', ') : 'custom stack';
      return `Universe ${result.symbol} emphasizes ${result.optimizationAxis} via ${toolSummary}; strongest at ${result.estimatedStrength}, weakest at ${result.estimatedWeakness}.`;
    });

    if (rankings.length > 0) {
      differences.push(
        `The report compares universes across ${rankings.length} ranking lenses so readers can inspect trade-offs from multiple angles.`,
      );
    }

    if (pollenStats.totalApplied + pollenStats.totalAdapted > 0) {
      differences.push(
        `Cross-pollination produced ${pollenStats.totalApplied + pollenStats.totalAdapted} confirmed adoptions or adaptations across universes.`,
      );
    }

    return {
      headline: `${universeResults.length} universes explored distinct design paths without collapsing to a single preferred path.`,
      differences: differences.slice(0, 5),
    };
  }

  private metricOrZero(
    metrics: UniverseMetrics | null,
    key: 'totalCommits' | 'totalFiles' | 'durationMs' | 'estimatedCostUsd'
  ): number {
    if (!metrics) {
      return 0;
    }
    return metrics[key];
  }

  private formatDuration(durationMs: number): string {
    const seconds = Math.max(0, Math.floor(durationMs / 1000));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  }

  private pickMaxKey(counts: Map<string, number>): string {
    let bestKey = '-';
    let max = 0;
    for (const [key, count] of counts.entries()) {
      if (count > max) {
        bestKey = key;
        max = count;
      }
    }
    return bestKey;
  }
}
