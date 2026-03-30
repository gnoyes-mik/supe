import { SessionManager } from '../../core/session.js';
import { logger } from '../../utils/logger.js';
import type { Report, Session } from '../../types.js';

interface ReportComparatorApi {
  generateReport(): Promise<Report>;
}

interface ReportFormatterApi {
  formatForTerminal(report: Report, session: Session): string;
}

export async function reportCommand(sessionId?: string): Promise<void> {
  const sessionManager = new SessionManager();

  try {
    const session = await loadSelectedSession(sessionManager, sessionId);
    if (!session) {
      console.log('No session found.');
      return;
    }

    const report = session.report ?? (await generateReportWithFallback(session));
    if (!session.report) {
      session.report = report;
      await sessionManager.saveSession(session);
    }

    const output = await formatReportForTerminal(report, session);
    console.log(output);
  } finally {
    sessionManager.destroy();
  }
}

async function loadSelectedSession(
  sessionManager: SessionManager,
  sessionId?: string
): Promise<Session | null> {
  if (typeof sessionId === 'string' && sessionId.trim().length > 0) {
    return sessionManager.loadSession(sessionId.trim());
  }
  return sessionManager.getLatestSession();
}

async function generateReportWithFallback(session: Session): Promise<Report> {
  const module = await import('../../reporter/comparator.js');
  const maybeCtor = (module as Record<string, unknown>).ReportComparator;

  if (typeof maybeCtor === 'function') {
    const comparator = new (maybeCtor as new (session: Session) => ReportComparatorApi)(session);
    if (typeof comparator.generateReport === 'function') {
      return comparator.generateReport();
    }
  }

  logger.warn('cli', 'ReportComparator is not implemented. Using fallback report.');
  return buildFallbackReport(session);
}

async function formatReportForTerminal(report: Report, session: Session): Promise<string> {
  const module = await import('../../reporter/formatter.js');
  const maybeCtor = (module as Record<string, unknown>).ReportFormatter;

  if (typeof maybeCtor === 'function') {
    const formatter = new (maybeCtor as new () => ReportFormatterApi)();
    if (typeof formatter.formatForTerminal === 'function') {
      return formatter.formatForTerminal(report, session);
    }
  }

  return buildFallbackTextReport(report, session);
}

function buildFallbackReport(session: Session): Report {
  return {
    sessionId: session.id,
    generatedAt: new Date().toISOString(),
    summary: `Intermediate report for ${session.spec.parsed.title}`,
    universeResults: session.universes.map((universe) => ({
      universeId: universe.id,
      symbol: universe.config.symbol,
      name: universe.config.name,
      status: universe.status,
      approach: universe.config.approach,
      optimizationAxis: universe.config.optimizationAxis,
      tools: universe.config.tools,
      estimatedStrength: universe.config.estimatedStrength,
      estimatedWeakness: universe.config.estimatedWeakness,
      metrics: universe.metrics,
      highlights: [universe.progress.currentPhase],
    })),
    rankings: [],
    pollenStats: {
      totalCreated: session.pollens.length,
      totalApplied: countTargetStatus(session, 'applied'),
      totalAdapted: countTargetStatus(session, 'adapted'),
      totalRejected: countTargetStatus(session, 'rejected'),
      mostActiveSource: session.universes[0]?.config.symbol ?? '',
      mostInfluenced: session.universes[0]?.config.symbol ?? '',
      notableEntanglements: [],
    },
    comparisonSummary: {
      headline: `${session.universes.length} universes are being compared without auto-selecting a single preferred path.`,
      differences: session.universes.map((universe) =>
        `Universe ${universe.config.symbol} is optimizing for ${universe.config.optimizationAxis}.`,
      ),
    },
  };
}

function buildFallbackTextReport(report: Report, session: Session): string {
  const lines = [
    `Morning Report: ${session.spec.parsed.title}`,
    `Session: ${report.sessionId}`,
    `Generated: ${formatRelativeTime(report.generatedAt)}`,
    '',
    report.summary,
    '',
    ...report.universeResults.map((result) =>
      `- ${result.symbol} ${result.name}: ${result.status}`
    ),
    '',
    `Differences: ${report.comparisonSummary.headline}`,
    ...report.comparisonSummary.differences.map((difference) => `- ${difference}`),
    '',
    `Pollens: ${report.pollenStats.totalCreated} created, ` +
      `${report.pollenStats.totalApplied} applied, ${report.pollenStats.totalAdapted} adapted, ` +
      `${report.pollenStats.totalRejected} rejected`,
  ];

  return lines.join('\n');
}

function countTargetStatus(session: Session, status: 'applied' | 'adapted' | 'rejected'): number {
  let count = 0;
  for (const pollen of session.pollens) {
    for (const target of pollen.targets) {
      if (target.status === status) {
        count += 1;
      }
    }
  }
  return count;
}

function formatRelativeTime(isoDate: string): string {
  const ts = Date.parse(isoDate);
  if (Number.isNaN(ts)) {
    return isoDate;
  }

  const deltaMs = Date.now() - ts;
  const minutes = Math.floor(deltaMs / (60 * 1000));
  if (minutes < 1) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
