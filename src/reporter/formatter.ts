import type { Report, Session, UniverseResult } from '../types.js';

export class ReportFormatter {
  formatForSlack(report: Report, session: Session): { text: string; blocks: unknown[] } {
    const title = session.spec.parsed.title;
    const headerText = `Multiverse report for ${title}`;
    const plainText = headerText;

    const universeLines = report.universeResults.map((result) => this.formatUniverseSlackLine(result));
    const rankingLines = report.rankings.map((category) => {
      const top = category.rankings[0];
      if (!top) {
        return `• *${category.category}*: n/a`;
      }
      return `• *${category.category}*: ${top.universeSymbol} (${top.score})`;
    });

    const pollen = report.pollenStats;
    const pollenText = [
      `Created: *${pollen.totalCreated}*`,
      `Applied: *${pollen.totalApplied}*`,
      `Adapted: *${pollen.totalAdapted}*`,
      `Rejected: *${pollen.totalRejected}*`,
    ].join(' | ');

    const differenceLines = report.comparisonSummary.differences.map((difference) => `• ${difference}`);

    const blocks: unknown[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `Multiverse Report - ${title}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Summary*\n${report.summary}`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Universe Comparison*\n${universeLines.join('\n')}`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Rankings*\n${rankingLines.join('\n')}`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `*Pollen Stats* - ${pollenText}`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Key Differences*\n*${report.comparisonSummary.headline}*\n${differenceLines.join('\n')}`,
        },
      },
    ];

    return {
      text: plainText,
      blocks,
    };
  }

  formatForTerminal(report: Report, session: Session): string {
    const lines: string[] = [];

    lines.push(`┌──────────────────────────────────────────────────────────────────────────────┐`);
    lines.push(`│ ${this.padRight(`SUPE MULTIVERSE REPORT - ${session.spec.parsed.title}`, 76)} │`);
    lines.push(`└──────────────────────────────────────────────────────────────────────────────┘`);
    lines.push('');
    lines.push(this.renderUniverseTable(report.universeResults));
    lines.push('');
    lines.push('◈ Rankings');
    for (const category of report.rankings) {
      lines.push(`  ${category.category}`);
      for (const ranking of category.rankings) {
        lines.push(`    ${ranking.rank}. ${ranking.universeSymbol} - ${ranking.score}`);
      }
    }
    lines.push('');
    lines.push('◈ Universe Profiles');
    for (const result of report.universeResults) {
      lines.push(`  ${result.symbol} ${result.name}`);
      lines.push(`    Axis: ${result.optimizationAxis}`);
      lines.push(`    Tools: ${result.tools.join(', ') || 'n/a'}`);
      lines.push(`    Strength: ${result.estimatedStrength}`);
      lines.push(`    Weakness: ${result.estimatedWeakness}`);
    }
    lines.push('');
    lines.push('◈ Pollen Stats');
    lines.push(`  Created: ${report.pollenStats.totalCreated}`);
    lines.push(`  Applied: ${report.pollenStats.totalApplied}`);
    lines.push(`  Adapted: ${report.pollenStats.totalAdapted}`);
    lines.push(`  Rejected: ${report.pollenStats.totalRejected}`);
    lines.push(`  Most Active Source: ${report.pollenStats.mostActiveSource}`);
    lines.push(`  Most Influenced: ${report.pollenStats.mostInfluenced}`);
    if (report.pollenStats.notableEntanglements.length > 0) {
      lines.push('  Notable Entanglements:');
      for (const entanglement of report.pollenStats.notableEntanglements) {
        lines.push(`    - [${entanglement.pollenId}] ${entanglement.description}`);
      }
    }
    lines.push('');
    lines.push('◈ Key Differences');
    lines.push(`  ${report.comparisonSummary.headline}`);
    for (const difference of report.comparisonSummary.differences) {
      lines.push(`  - ${difference}`);
    }
    lines.push('');
    lines.push('◈ LLM Summary');
    lines.push(`  ${report.summary}`);

    return lines.join('\n');
  }

  private formatUniverseSlackLine(result: UniverseResult): string {
    const metrics = result.metrics;
    const files = metrics?.totalFiles ?? 0;
    const commits = metrics?.totalCommits ?? 0;
    const cost = metrics ? `$${metrics.estimatedCostUsd.toFixed(2)}` : 'n/a';
    const tools = result.tools.slice(0, 3).join(', ') || 'n/a';
    return `${result.symbol} *${result.name}* | axis ${result.optimizationAxis} | tools ${tools} | ${result.status} | files ${files} | commits ${commits} | cost ${cost}`;
  }

  private renderUniverseTable(results: UniverseResult[]): string {
    const col1 = 4;
    const col2 = 22;
    const col3 = 11;
    const col4 = 7;
    const col5 = 9;
    const col6 = 9;

    const header = [
      `┌${'─'.repeat(col1 + 2)}┬${'─'.repeat(col2 + 2)}┬${'─'.repeat(col3 + 2)}┬${'─'.repeat(col4 + 2)}┬${'─'.repeat(col5 + 2)}┬${'─'.repeat(col6 + 2)}┐`,
      `│ ${this.padRight('Sym', col1)} │ ${this.padRight('Name', col2)} │ ${this.padRight('Status', col3)} │ ${this.padRight('Files', col4)} │ ${this.padRight('Commits', col5)} │ ${this.padRight('Cost', col6)} │`,
      `├${'─'.repeat(col1 + 2)}┼${'─'.repeat(col2 + 2)}┼${'─'.repeat(col3 + 2)}┼${'─'.repeat(col4 + 2)}┼${'─'.repeat(col5 + 2)}┼${'─'.repeat(col6 + 2)}┤`,
    ];

    const body = results.map((result) => {
      const metrics = result.metrics;
      const files = String(metrics?.totalFiles ?? 0);
      const commits = String(metrics?.totalCommits ?? 0);
      const cost = metrics ? `$${metrics.estimatedCostUsd.toFixed(2)}` : 'n/a';
      return `│ ${this.padRight(result.symbol, col1)} │ ${this.padRight(this.truncate(result.name, col2), col2)} │ ${this.padRight(result.status, col3)} │ ${this.padLeft(files, col4)} │ ${this.padLeft(commits, col5)} │ ${this.padLeft(cost, col6)} │`;
    });

    const footer = `└${'─'.repeat(col1 + 2)}┴${'─'.repeat(col2 + 2)}┴${'─'.repeat(col3 + 2)}┴${'─'.repeat(col4 + 2)}┴${'─'.repeat(col5 + 2)}┴${'─'.repeat(col6 + 2)}┘`;

    return [...header, ...body, footer].join('\n');
  }

  private truncate(value: string, max: number): string {
    if (value.length <= max) {
      return value;
    }
    if (max <= 1) {
      return value.slice(0, max);
    }
    return `${value.slice(0, max - 1)}…`;
  }

  private padRight(value: string, width: number): string {
    if (value.length >= width) {
      return value;
    }
    return value + ' '.repeat(width - value.length);
  }

  private padLeft(value: string, width: number): string {
    if (value.length >= width) {
      return value;
    }
    return ' '.repeat(width - value.length) + value;
  }
}
