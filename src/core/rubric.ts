import type {
  AnalystRubricScores,
  PollinationRubricScores,
  PollenJudgement,
  PollenType,
} from '../types.js';

export function clampScore(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 100) {
    return 100;
  }
  return Math.round(value);
}

export function normalizeAnalystRubricScores(
  raw: Partial<Record<keyof AnalystRubricScores, unknown>>,
): AnalystRubricScores {
  return {
    transferability: clampScore(raw.transferability),
    constraintFit: clampScore(raw.constraintFit),
    evidenceStrength: clampScore(raw.evidenceStrength),
    riskSeverity: clampScore(raw.riskSeverity),
  };
}

export function judgePollen(scores: AnalystRubricScores): PollenJudgement {
  if (
    scores.riskSeverity >= 75
    && scores.evidenceStrength >= 50
    && scores.transferability >= 40
  ) {
    return 'warning';
  }

  if (
    scores.transferability >= 60
    && scores.constraintFit >= 60
    && scores.evidenceStrength >= 50
  ) {
    return 'share';
  }

  return 'reject';
}

export function normalizePollenType(type: unknown, judgement: PollenJudgement): PollenType {
  if (judgement === 'warning') {
    return 'warning';
  }

  if (type === 'pattern' || type === 'data' || type === 'strategy') {
    return type;
  }

  return 'pattern';
}

export function normalizePollinationRubricScores(
  raw: Partial<Record<keyof PollinationRubricScores, unknown>>,
): PollinationRubricScores {
  return {
    relevanceToTarget: clampScore(raw.relevanceToTarget),
    constraintFit: clampScore(raw.constraintFit),
    diversityFit: clampScore(raw.diversityFit),
    timeliness: clampScore(raw.timeliness),
  };
}

export function deriveTargetRelevance(
  scores: PollinationRubricScores,
  pollenType: PollenType,
): 'high' | 'medium' | 'low' {
  const warningEligible =
    pollenType === 'warning'
    && scores.relevanceToTarget >= 45
    && scores.constraintFit >= 50
    && scores.diversityFit >= 45;

  if (
    scores.relevanceToTarget >= 75
    && scores.constraintFit >= 65
    && scores.diversityFit >= 60
    && scores.timeliness >= 50
  ) {
    return 'high';
  }

  if (
    warningEligible
    || (
      scores.relevanceToTarget >= 55
      && scores.constraintFit >= 50
      && scores.diversityFit >= 50
    )
  ) {
    return 'medium';
  }

  return 'low';
}
