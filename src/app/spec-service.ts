import { applyClarificationAnswers, assessAmbiguity } from '../core/ambiguity-gate.js';
import {
  generateUniverseConfigsForParsedSpec,
  parseSpecContent,
  type ParsedSpecBase,
} from '../core/spec-parser.js';
import type {
  AgentType,
  AmbiguityAssessment,
  ClarificationField,
  ParsedSpec,
} from '../types.js';

export type PreparedSpecResult =
  | {
      status: 'ready';
      parsedSpec: ParsedSpec;
    }
  | {
      status: 'clarification_required';
      parsedSpec: ParsedSpecBase;
      assessment: AmbiguityAssessment;
    };

export async function prepareSpecFromRawSpec(
  rawSpec: string,
  universeCount: number,
  defaultAgent: AgentType,
  answers: Partial<Record<ClarificationField, string>> = {},
): Promise<PreparedSpecResult> {
  const parsedBase = await parseSpecContent(rawSpec);
  const assessment = assessAmbiguity(parsedBase);

  if (assessment.requiresClarification && Object.keys(answers).length === 0) {
    return {
      status: 'clarification_required',
      parsedSpec: parsedBase,
      assessment,
    };
  }

  const resolvedBase = applyClarificationAnswers(parsedBase, answers, assessment);
  const universeConfigs = await generateUniverseConfigsForParsedSpec(
    resolvedBase,
    universeCount,
    defaultAgent,
  );

  return {
    status: 'ready',
    parsedSpec: {
      ...resolvedBase,
      universeConfigs,
    },
  };
}

export async function finalizePreparedSpec(
  parsedBase: ParsedSpecBase,
  assessment: AmbiguityAssessment,
  universeCount: number,
  defaultAgent: AgentType,
  answers: Partial<Record<ClarificationField, string>> = {},
): Promise<ParsedSpec> {
  const resolvedBase = applyClarificationAnswers(parsedBase, answers, assessment);
  const universeConfigs = await generateUniverseConfigsForParsedSpec(
    resolvedBase,
    universeCount,
    defaultAgent,
  );

  return {
    ...resolvedBase,
    universeConfigs,
  };
}
