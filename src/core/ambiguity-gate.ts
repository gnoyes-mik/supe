import type {
  AmbiguityAssessment,
  ClarificationField,
  ClarificationQuestion,
  ParsedSpec,
  ProblemContract,
} from '../types.js';

type ParsedSpecBase = Omit<ParsedSpec, 'universeConfigs'>;

const PLACEHOLDER_PATTERNS = [
  /^n\/a$/i,
  /^none$/i,
  /^tbd$/i,
  /^unknown$/i,
  /not specified/i,
  /to be decided/i,
  /something/i,
  /etc\.?$/i,
];

const GENERIC_OUTPUT_PATTERNS = [
  /^(working\s+)?(solution|system|app|application|platform|tool)$/i,
  /^(document|report|implementation|artifact)$/i,
];

const VAGUE_QUALITY_PATTERNS = [
  /\bgood\b/i,
  /\bclean\b/i,
  /\bpolished\b/i,
  /\bwell[-\s]?structured\b/i,
  /\bbest practices\b/i,
  /\buser[-\s]?friendly\b/i,
  /\bintuitive\b/i,
];

const MEASURABLE_PATTERNS = [
  /\d/,
  /\bmust\b/i,
  /\bat least\b/i,
  /\bwithin\b/i,
  /\bunder\b/i,
  /\bpass\b/i,
  /\bbuild\b/i,
  /\bexport\b/i,
  /\bcompare\b/i,
  /\bmap\b/i,
  /\bvalidate\b/i,
];

const DEFAULT_OUT_OF_SCOPE_ASSUMPTION =
  'No explicit out-of-scope items were provided; universes should avoid inventing adjacent deliverables beyond the stated problem.';

export function buildProblemContract(source: Pick<
  ParsedSpecBase,
  'problemStatement' | 'desiredOutputs' | 'constraints' | 'successCriteria' | 'outOfScope' | 'assumptions'
>): ProblemContract {
  return {
    problemStatement: source.problemStatement,
    requiredOutputs: [...source.desiredOutputs],
    hardConstraints: [...source.constraints],
    successCriteria: [...source.successCriteria],
    outOfScope: [...source.outOfScope],
    assumptions: [...source.assumptions],
  };
}

export function assessAmbiguity(parsedSpec: ParsedSpecBase): AmbiguityAssessment {
  const questions: ClarificationQuestion[] = [];
  const blockingReasons: string[] = [];
  const assumptions = [...parsedSpec.assumptions];

  const broadProblem = isBroadProblemStatement(parsedSpec.problemStatement);
  const outputsAreAmbiguous = parsedSpec.desiredOutputs.every(isGenericOutput);
  const successCriteriaAreVague =
    parsedSpec.successCriteria.filter(isVagueSuccessCriterion).length
    >= Math.ceil(parsedSpec.successCriteria.length / 2);
  const constraintsAreGeneric = parsedSpec.constraints.every(isPlaceholderLike);
  const missingOutOfScope = parsedSpec.outOfScope.length === 0;

  if (outputsAreAmbiguous) {
    blockingReasons.push('Desired outputs are too generic to keep universes aligned on what must be delivered.');
    questions.push({
      id: 'desiredOutputs',
      why: 'Universes need the same target artifact set before they diverge on approach.',
      prompt:
        'List the must-have artifacts or sections each universe must cover. Separate items with semicolons:',
    });
  }

  if (successCriteriaAreVague) {
    blockingReasons.push('Success criteria are too subjective to compare universes consistently.');
    questions.push({
      id: 'successCriteria',
      why: 'Comparison only works if all universes are judged against the same concrete checks.',
      prompt:
        'List the specific checks that would prove the problem is solved. Separate items with semicolons:',
    });
  }

  if (constraintsAreGeneric || (broadProblem && parsedSpec.constraints.length <= 1)) {
    blockingReasons.push('Hard constraints are underspecified, so universes may solve different problems.');
    questions.push({
      id: 'constraints',
      why: 'Non-negotiable constraints must be fixed before the multiverse opens.',
      prompt:
        'List the non-negotiable constraints or prohibitions. Separate items with semicolons:',
    });
  }

  if (missingOutOfScope && broadProblem) {
    questions.push({
      id: 'outOfScope',
      why: 'A broad problem statement benefits from explicit exclusions so universes do not expand the scope differently.',
      prompt:
        'List anything that should be explicitly out of scope. Separate items with semicolons (leave blank if none):',
    });
  } else if (missingOutOfScope) {
    assumptions.push(DEFAULT_OUT_OF_SCOPE_ASSUMPTION);
  }

  return {
    requiresClarification: blockingReasons.length > 0,
    blockingReasons,
    questions: dedupeQuestions(questions),
    assumptions: dedupeStrings(assumptions),
  };
}

export function applyClarificationAnswers(
  parsedSpec: ParsedSpecBase,
  answers: Partial<Record<ClarificationField, string>>,
  assessment: AmbiguityAssessment,
): ParsedSpecBase {
  const next: ParsedSpecBase = {
    ...parsedSpec,
    desiredOutputs: [...parsedSpec.desiredOutputs],
    successCriteria: [...parsedSpec.successCriteria],
    constraints: [...parsedSpec.constraints],
    outOfScope: [...parsedSpec.outOfScope],
    assumptions: dedupeStrings([...parsedSpec.assumptions, ...assessment.assumptions]),
    problemContract: parsedSpec.problemContract,
  };

  const fields: ClarificationField[] = [
    'desiredOutputs',
    'successCriteria',
    'constraints',
    'outOfScope',
  ];

  for (const field of fields) {
    const rawAnswer = answers[field];
    if (typeof rawAnswer !== 'string') {
      continue;
    }

    const parsedAnswer = parseListAnswer(rawAnswer);
    if (parsedAnswer.length === 0) {
      continue;
    }

    if (field === 'desiredOutputs') {
      next.desiredOutputs = parsedAnswer;
    } else if (field === 'successCriteria') {
      next.successCriteria = parsedAnswer;
    } else if (field === 'constraints') {
      next.constraints = parsedAnswer;
    } else if (field === 'outOfScope') {
      next.outOfScope = parsedAnswer;
    }
  }

  if (next.outOfScope.length === 0) {
    next.assumptions = dedupeStrings([...next.assumptions, DEFAULT_OUT_OF_SCOPE_ASSUMPTION]);
  }

  next.problemContract = buildProblemContract(next);
  return next;
}

function isPlaceholderLike(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return true;
  }
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function isGenericOutput(value: string): boolean {
  const trimmed = value.trim();
  if (isPlaceholderLike(trimmed)) {
    return true;
  }
  return GENERIC_OUTPUT_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function isVagueSuccessCriterion(value: string): boolean {
  const trimmed = value.trim();
  if (isPlaceholderLike(trimmed)) {
    return true;
  }

  const hasMeasure = MEASURABLE_PATTERNS.some((pattern) => pattern.test(trimmed));
  const soundsQualitative = VAGUE_QUALITY_PATTERNS.some((pattern) => pattern.test(trimmed));

  if (soundsQualitative && !hasMeasure) {
    return true;
  }

  return trimmed.split(/\s+/).length < 4 && !hasMeasure;
}

function isBroadProblemStatement(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return true;
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length < 7) {
    return true;
  }

  return /\b(build|make|create|design|improve|optimize|fix|strategy|plan)\b/i.test(trimmed)
    && words.length < 12;
}

function parseListAnswer(value: string): string[] {
  return value
    .split(/\n|;/)
    .map((entry) => entry.replace(/^\s*[-*]\s*/, '').trim())
    .filter((entry) => entry.length > 0);
}

function dedupeQuestions(questions: ClarificationQuestion[]): ClarificationQuestion[] {
  const seen = new Set<string>();
  const next: ClarificationQuestion[] = [];

  for (const question of questions) {
    if (seen.has(question.id)) {
      continue;
    }
    seen.add(question.id);
    next.push(question);
  }

  return next;
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (normalized.length === 0 || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    next.push(normalized);
  }

  return next;
}
