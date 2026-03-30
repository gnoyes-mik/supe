import type {
  Pollen,
  PollenTarget,
  Report,
  Session,
  Universe,
  UniverseProgress,
} from '../types.js';

export type SlackMessagePayload = {
  channel: string;
  text: string;
  thread_ts?: string;
  blocks: Array<Record<string, unknown>>;
};

export function formatTime(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function formatDuration(startIso: string, endIso: string): string {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  const durationMs = Math.max(end - start, 0);
  const totalMinutes = Math.floor(durationMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function metricsForProgress(progress: UniverseProgress): string {
  return `Progress: ${progress.percentage}% | Files: ${progress.filesCreated} | Commits: ${progress.totalCommits} | Cost: $${progress.estimatedCostUsd.toFixed(2)}`;
}

export function sessionStartMessage(session: Session): SlackMessagePayload {
  return {
    channel: session.slack!.channel,
    text: `🌌 Superposition 시작: ${session.spec.parsed.title}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `🌌 Superposition: ${session.spec.parsed.title}`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Problem:* ${session.spec.parsed.problemStatement}`,
        },
      },
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: session.universes
            .map(
              (u) =>
                `• 🧵 *Universe ${u.config.symbol}*: ${u.config.name}\n   _${u.config.approach.slice(0, 100)}_`,
            )
            .join('\n\n'),
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Session: \`${session.id}\` | Universes: ${session.universes.length} | Pollen Interval: ${session.config.pollenIntervalMs / 60000}min`,
          },
        ],
      },
    ],
  };
}

export function universeThreadMessage(universe: Universe, session: Session): SlackMessagePayload {
  return {
    channel: session.slack!.channel,
    text: `🌀 Universe ${universe.config.symbol}: ${universe.config.name}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `🌀 Universe ${universe.config.symbol}: ${universe.config.name}`,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Approach:*\n${universe.config.approach}` },
          {
            type: 'mrkdwn',
            text: `*Agent:* ${universe.config.agent}\n*Optimizing:* ${universe.config.optimizationAxis}`,
          },
        ],
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `이 스레드에서 Universe ${universe.config.symbol}의 진행 상황을 실시간으로 확인할 수 있습니다.`,
          },
        ],
      },
    ],
  };
}

export function universeProgressUpdate(
  universe: Universe,
  session: Session,
  detail: string,
): SlackMessagePayload {
  return {
    channel: session.slack!.channel,
    thread_ts: session.slack!.threadTsMap[universe.id],
    text: `[${universe.config.symbol}] ${detail}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${formatTime()}* — ${detail}`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: metricsForProgress(universe.progress),
          },
        ],
      },
    ],
  };
}

export function commitDetectedMessage(
  universe: Universe,
  session: Session,
  commitMessage: string,
  commitHash: string,
): SlackMessagePayload {
  return {
    channel: session.slack!.channel,
    thread_ts: session.slack!.threadTsMap[universe.id],
    text: `[${universe.config.symbol}] Commit: ${commitMessage}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `📝 \`${commitHash.slice(0, 7)}\` ${commitMessage}`,
        },
      },
    ],
  };
}

export function entanglementMessage(
  pollen: Pollen,
  targets: PollenTarget[],
  session: Session,
): SlackMessagePayload {
  const appliedTargets = targets.filter((t) => t.status !== 'rejected');
  const targetSymbols = appliedTargets.map((t) => t.universeSymbol).join(', ');

  return {
    channel: session.slack!.channel,
    thread_ts: session.slack!.mainMessageTs,
    text: `🔗 Entanglement: ${pollen.sourceSymbol} → ${targetSymbols}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🔗 *Entanglement*: Universe ${pollen.sourceSymbol} → ${targetSymbols}\n*${pollen.title}*`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `> ${pollen.insight}`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Pollen: \`${pollen.id}\` | Type: ${pollen.type} | Abstraction: ${pollen.abstractionLevel}`,
          },
        ],
      },
    ],
  };
}

export function pollenReceivedMessage(
  pollen: Pollen,
  target: PollenTarget,
  session: Session,
): SlackMessagePayload {
  return {
    channel: session.slack!.channel,
    thread_ts: session.slack!.threadTsMap[target.universeId],
    text: `🌸 Pollen received from ${pollen.sourceSymbol}: ${pollen.title}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🌸 *Pollen from Universe ${pollen.sourceSymbol}*: ${pollen.title}\nRelevance: ${target.relevance}\n\n> _${pollen.insight}_\n\n_This hint has been added to PROMPT.md. The agent will decide whether to adopt it._`,
        },
      },
    ],
  };
}

export function pollenAdoptionMessage(
  pollen: Pollen,
  target: PollenTarget,
  session: Session,
): SlackMessagePayload {
  const statusEmoji =
    target.status === 'applied' ? '✅' : target.status === 'adapted' ? '🔄' : '❌';
  const statusText =
    target.status === 'applied'
      ? 'Applied as-is'
      : target.status === 'adapted'
        ? `Adapted: ${target.mutation}`
        : 'Not adopted';

  return {
    channel: session.slack!.channel,
    thread_ts: session.slack!.threadTsMap[target.universeId],
    text: `${statusEmoji} Pollen ${pollen.id}: ${statusText}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${statusEmoji} *Pollen \`${pollen.id}\`*: ${statusText}`,
        },
      },
    ],
  };
}

export function morningReportMessage(report: Report, session: Session): SlackMessagePayload {
  const headerRow = `| | ${report.universeResults.map((u) => `*${u.symbol} ${u.name}*`).join(' | ')} |`;
  const divider = `|---|${report.universeResults.map(() => '---').join('|')}|`;

  const rows = [
    `| Status | ${report.universeResults.map((u) => (u.status === 'completed' ? '✅' : '⚠️')).join(' | ')} |`,
    `| Files | ${report.universeResults.map((u) => u.metrics?.totalFiles ?? '-').join(' | ')} |`,
    `| Commits | ${report.universeResults.map((u) => u.metrics?.totalCommits ?? '-').join(' | ')} |`,
    `| Cost | ${report.universeResults.map((u) => (u.metrics ? `$${u.metrics.estimatedCostUsd.toFixed(2)}` : '-')).join(' | ')} |`,
    `| Pollen Sent | ${report.universeResults.map((u) => u.metrics?.pollenEmitted ?? '-').join(' | ')} |`,
    `| Pollen Used | ${report.universeResults.map((u) => u.metrics?.pollenApplied ?? '-').join(' | ')} |`,
  ];

  if (session.spec.parsed.domain === 'software-development') {
    rows.push(
      `| LoC | ${report.universeResults.map((u) => u.metrics?.linesOfCode ?? '-').join(' | ')} |`,
      `| Build | ${report.universeResults.map((u) => (u.metrics?.buildSuccess === true ? '✅' : u.metrics?.buildSuccess === false ? '❌' : '-')).join(' | ')} |`,
    );
  } else {
    rows.push(
      `| Pages | ${report.universeResults.map((u) => u.metrics?.documentPages ?? '-').join(' | ')} |`,
      `| Sections | ${report.universeResults.map((u) => u.metrics?.sectionCount ?? '-').join(' | ')} |`,
    );
  }

  const table = [headerRow, divider, ...rows].join('\n');
  const entanglements = report.pollenStats.notableEntanglements
    .map((e) => `• ${e.description}`)
    .join('\n');
  const differences = report.comparisonSummary.differences
    .map((difference) => `• ${difference}`)
    .join('\n');

  const totalCost = report.universeResults.reduce(
    (sum, u) => sum + (u.metrics?.estimatedCostUsd ?? 0),
    0,
  );

  return {
    channel: session.slack!.channel,
    thread_ts: session.slack!.mainMessageTs,
    text: `☀️ Morning Report: ${session.spec.parsed.title}`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: '☀️ Morning Report' },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: report.summary,
        },
      },
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: table,
        },
      },
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*🔗 Notable Entanglements*\n${entanglements || '_No cross-pollination events_'}`,
        },
      },
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*🧭 Key Differences*\n${report.comparisonSummary.headline}\n${differences || '_No comparison notes yet_'}`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Session: \`${session.id}\` | Total Cost: $${totalCost.toFixed(2)} | Duration: ${formatDuration(session.startedAt, report.generatedAt)}`,
          },
        ],
      },
    ],
  };
}
