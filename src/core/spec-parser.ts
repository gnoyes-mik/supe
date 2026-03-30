import { readFile } from 'fs/promises';
import type { AgentType, DiversityCheck, ParsedSpec, SpecDomain, UniverseConfig } from '../types.js';
import { callLlmJson } from '../utils/llm.js';
import { logger } from '../utils/logger.js';
import { buildProblemContract } from './ambiguity-gate.js';
import { UNIVERSE_SYMBOLS } from './stability.js';

export type ParsedSpecBase = Omit<ParsedSpec, 'universeConfigs'>;

interface ParsedSpecResponse {
  title: unknown;
  problemStatement: unknown;
  constraints: unknown;
  desiredOutputs: unknown;
  successCriteria: unknown;
  domain: unknown;
  additionalContext: unknown;
  outOfScope: unknown;
  assumptions: unknown;
}

interface UniverseConfigResponse {
  name: unknown;
  symbol: unknown;
  approach: unknown;
  optimizationAxis: unknown;
  tools: unknown;
  agent: unknown;
  estimatedStrength: unknown;
  estimatedWeakness: unknown;
}

interface DiversityCheckResponse {
  isDiverse: unknown;
  overlapScore: unknown;
  problematicPairs: unknown;
  suggestions: unknown;
}

const SPEC_DOMAINS: SpecDomain[] = [
  'software-development',
  'marketing',
  'business-strategy',
  'content-creation',
  'research',
  'design',
  'other',
];

const DEFAULT_AGENT: AgentType = 'claude';

export async function parseSpec(
  specPath: string,
  universeCount: number,
  defaultAgent: AgentType
): Promise<ParsedSpec> {
  const specContent = await readFile(specPath, 'utf-8');

  logger.info('session', `Parsing spec: ${specPath}`);

  const parsedBase = await parseSpecContent(specContent);

  const universeConfigs = await generateUniverseConfigsForParsedSpec(
    parsedBase,
    universeCount,
    defaultAgent,
  );

  return {
    ...parsedBase,
    universeConfigs,
  };
}

export async function parseSpecContent(specContent: string): Promise<ParsedSpecBase> {
  const prompt = `You are a problem decomposer. Parse this free-form specification into structured data.

## Spec Content
${specContent}

## Response Format (JSON, no markdown fencing)
{
  "title": "Project/problem title",
  "problemStatement": "Core problem to solve",
  "constraints": ["constraint 1", "constraint 2"],
  "desiredOutputs": ["output 1", "output 2"],
  "successCriteria": ["criterion 1", "criterion 2"],
  "domain": "software-development | marketing | business-strategy | content-creation | research | design | other",
  "additionalContext": "Any other relevant context",
  "outOfScope": ["explicitly excluded item"],
  "assumptions": ["safe assumption inferred from the spec"]
}`;

  const parsed = await callLlmJsonWithRetry<ParsedSpecResponse>(prompt, 'spec parsing');
  return normalizeParsedSpecResponse(parsed);
}

export async function generateUniverseConfigsForParsedSpec(
  parsedBase: ParsedSpecBase,
  universeCount: number,
  defaultAgent: AgentType,
): Promise<UniverseConfig[]> {
  const symbols = UNIVERSE_SYMBOLS.slice(0, universeCount);
  const agentAssignments = Array.from<AgentType>({ length: universeCount }).fill(defaultAgent);
  let universeConfigs = await generateUniverseConfigs(
    parsedBase,
    universeCount,
    symbols,
    agentAssignments
  );

  const diversityCheck = await validateDiversity(parsedBase, universeConfigs);

  if (!diversityCheck.isDiverse && diversityCheck.overlapScore > 0.5) {
    logger.warn(
      'session',
      `Low diversity detected (overlap: ${diversityCheck.overlapScore}). Regenerating...`
    );
    universeConfigs = await generateUniverseConfigs(
      parsedBase,
      universeCount,
      symbols,
      agentAssignments,
      diversityCheck.suggestions
    );
  }

  return universeConfigs;
}

async function generateUniverseConfigs(
  parsedBase: ParsedSpecBase,
  universeCount: number,
  symbols: string[],
  agentAssignments: AgentType[],
  suggestions: string[] = []
): Promise<UniverseConfig[]> {
  const suggestionsSection =
    suggestions.length > 0
      ? `\n## Diversity Improvement Suggestions\n${suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}\nApply these suggestions to increase orthogonality.\n`
      : '';

  const prompt = `You are a strategic diversifier. Given a parsed problem spec, generate ${universeCount} fundamentally different approaches.

## Problem
${JSON.stringify(parsedBase, null, 2)}

## Instructions
1. First, identify ${universeCount}+ independent optimization axes for this problem.
   Example axes for software: performance, developer-experience, cost-to-run, time-to-market, scalability, simplicity
   Example axes for strategy: risk, speed, cost, market-coverage, innovation
2. Assign each Universe a PRIMARY axis that no other Universe shares.
3. Each Universe's technology/methodology choices should be DRIVEN BY its primary axis.
4. Constraint: No two Universes may share >40% of their technology stack.${suggestionsSection}

## Available Symbols
${symbols.map((s, i) => `${i}: ${s}`).join(', ')}

## Response Format (JSON array, no markdown fencing)
[
  {
    "name": "Short name",
    "symbol": "α",
    "approach": "2-3 sentences describing this approach",
    "optimizationAxis": "What this optimizes for",
    "tools": ["tool1", "tool2"],
    "agent": "claude",
    "estimatedStrength": "Expected strength",
    "estimatedWeakness": "Expected weakness"
  }
]`;

  const generated = await callLlmJsonWithRetry<UniverseConfigResponse[]>(
    prompt,
    'universe generation'
  );

  return normalizeUniverseConfigs(generated, universeCount, symbols, agentAssignments);
}

async function validateDiversity(
  parsedBase: ParsedSpecBase,
  universeConfigs: UniverseConfig[]
): Promise<DiversityCheck> {
  const count = universeConfigs.length;
  const prompt = `You are a diversity auditor. Evaluate whether these ${count} approaches to the same problem are MEANINGFULLY different.

## Problem
${parsedBase.problemStatement}

## Approaches
${JSON.stringify(universeConfigs, null, 2)}

## Evaluation Criteria
1. Architecture: Do they use fundamentally different system architectures?
2. Trade-offs: Does each optimize for a genuinely different axis?
3. Failure modes: Would they fail in different ways?
4. Stack overlap: >60% shared technology = NOT diverse enough

## Response Format (JSON, no markdown fencing)
{
  "isDiverse": true/false,
  "overlapScore": 0.0-1.0,
  "problematicPairs": [
    { "a": "α", "b": "β", "reason": "explanation" }
  ],
  "suggestions": ["suggestion if not diverse enough"]
}`;

  const diversity = await callLlmJsonWithRetry<DiversityCheckResponse>(prompt, 'diversity validation');
  return normalizeDiversityCheck(diversity);
}

async function callLlmJsonWithRetry<T>(prompt: string, operation: string): Promise<T> {
  try {
    return await callLlmJson<T>(prompt);
  } catch (error) {
    logger.warn('session', `Failed ${operation} JSON parse. Retrying once.`, null, {
      error: error instanceof Error ? error.message : String(error),
    });
    return callLlmJson<T>(prompt);
  }
}

function normalizeParsedSpecResponse(raw: ParsedSpecResponse): ParsedSpecBase {
  const title = toNonEmptyString(raw.title, 'title');
  const problemStatement = toNonEmptyString(raw.problemStatement, 'problemStatement');
  const constraints = toStringArray(raw.constraints, 'constraints');
  const desiredOutputs = toStringArray(raw.desiredOutputs, 'desiredOutputs');
  const successCriteria = toStringArray(raw.successCriteria, 'successCriteria');
  const domain = toSpecDomain(raw.domain);
  const additionalContext = toString(raw.additionalContext);
  const outOfScope = toOptionalStringArray(raw.outOfScope);
  const assumptions = toOptionalStringArray(raw.assumptions);

  const parsed: ParsedSpecBase = {
    title,
    problemStatement,
    constraints,
    desiredOutputs,
    successCriteria,
    domain,
    additionalContext,
    outOfScope,
    assumptions,
    problemContract: buildProblemContract({
      problemStatement,
      desiredOutputs,
      constraints,
      successCriteria,
      outOfScope,
      assumptions,
    }),
  };

  return parsed;
}

function normalizeUniverseConfigs(
  raw: UniverseConfigResponse[],
  universeCount: number,
  symbols: string[],
  agentAssignments: AgentType[]
): UniverseConfig[] {
  if (!Array.isArray(raw)) {
    throw new Error('Universe generation response must be an array');
  }

  if (raw.length < universeCount) {
    throw new Error(
      `Universe generation returned ${raw.length} configs, expected at least ${universeCount}`
    );
  }

  return symbols.map((symbol, idx) => {
    const entry = raw[idx];
    if (!entry) {
      throw new Error(`Missing universe config at index ${idx}`);
    }

    return {
      name: toNonEmptyString(entry.name, `universeConfigs[${idx}].name`),
      symbol,
      approach: toNonEmptyString(entry.approach, `universeConfigs[${idx}].approach`),
      optimizationAxis: toNonEmptyString(
        entry.optimizationAxis,
        `universeConfigs[${idx}].optimizationAxis`
      ),
      tools: toStringArray(entry.tools, `universeConfigs[${idx}].tools`),
      agent: pickAgent(agentAssignments, idx),
      estimatedStrength: toNonEmptyString(
        entry.estimatedStrength,
        `universeConfigs[${idx}].estimatedStrength`
      ),
      estimatedWeakness: toNonEmptyString(
        entry.estimatedWeakness,
        `universeConfigs[${idx}].estimatedWeakness`
      ),
    };
  });
}

function normalizeDiversityCheck(raw: DiversityCheckResponse): DiversityCheck {
  const isDiverse = toBoolean(raw.isDiverse, 'isDiverse');
  const overlapScore = toOverlapScore(raw.overlapScore);
  const problematicPairs = toProblematicPairs(raw.problematicPairs);
  const suggestions = toOptionalStringArray(raw.suggestions);

  return {
    isDiverse,
    overlapScore,
    problematicPairs,
    suggestions,
  };
}

function toNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid ${field}: expected non-empty string`);
  }
  return value.trim();
}

function toString(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }
  return '';
}

function toStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid ${field}: expected string[]`);
  }

  const values = value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim())
    .filter(item => item.length > 0);

  if (values.length === 0) {
    throw new Error(`Invalid ${field}: must include at least one entry`);
  }

  return values;
}

function toOptionalStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim())
    .filter(item => item.length > 0);
}

function toSpecDomain(value: unknown): SpecDomain {
  if (typeof value === 'string' && SPEC_DOMAINS.includes(value as SpecDomain)) {
    return value as SpecDomain;
  }
  return 'other';
}

function toBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`Invalid ${field}: expected boolean`);
  }
  return value;
}

function toOverlapScore(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error('Invalid overlapScore: expected number');
  }
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

function toProblematicPairs(
  value: unknown
): Array<{ a: string; b: string; reason: string }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(item => {
      if (
        typeof item !== 'object' ||
        item === null ||
        !('a' in item) ||
        !('b' in item) ||
        !('reason' in item)
      ) {
        return null;
      }

      const candidate = item as { a: unknown; b: unknown; reason: unknown };
      if (
        typeof candidate.a !== 'string' ||
        typeof candidate.b !== 'string' ||
        typeof candidate.reason !== 'string'
      ) {
        return null;
      }

      return {
        a: candidate.a.trim(),
        b: candidate.b.trim(),
        reason: candidate.reason.trim(),
      };
    })
    .filter((pair): pair is { a: string; b: string; reason: string } => pair !== null)
    .filter(pair => pair.a.length > 0 && pair.b.length > 0 && pair.reason.length > 0);
}

function pickAgent(agentAssignments: AgentType[], index: number): AgentType {
  if (agentAssignments.length === 0) {
    return DEFAULT_AGENT;
  }
  return agentAssignments[index % agentAssignments.length] ?? DEFAULT_AGENT;
}
