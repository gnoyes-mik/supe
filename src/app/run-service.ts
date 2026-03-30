import { checkMultiverseStability } from '../core/stability.js';
import type {
  AgentType,
  ClarificationField,
  GlobalConfig,
  Session,
  SessionConfig,
} from '../types.js';
import type { SessionManager } from '../core/session.js';
import {
  finalizePreparedSpec,
  prepareSpecFromRawSpec,
} from './spec-service.js';
import { executeSessionRuntime } from './runtime-service.js';
import type { ClarificationJsonData } from './contracts.js';

export interface RunPreparationOptions {
  rawSpec: string;
  specSourcePath: string;
  universeCount: number;
  defaultAgent: AgentType;
  agentAssignments: AgentType[];
  sessionConfig: SessionConfig;
  clarificationAnswers?: Partial<Record<ClarificationField, string>>;
  clarificationMode: 'prompt' | 'return';
  confirmationMode: 'prompt' | 'return' | 'auto_accept';
  confirmationPrompt: () => Promise<boolean>;
  clarificationPrompt: (
    details: ClarificationJsonData,
  ) => Promise<Partial<Record<ClarificationField, string>>>;
}

export type RunPreparationResult =
  | { status: 'ready'; session: Session }
  | {
      status: 'clarification_required';
      details: ClarificationJsonData;
    }
  | {
      status: 'confirmation_required';
      level: string;
      message: string;
    }
  | {
      status: 'rejected';
      message: string;
    };

export async function prepareSessionForRun(
  sessionManager: SessionManager,
  options: RunPreparationOptions,
): Promise<RunPreparationResult> {
  const prepared = await prepareSpecFromRawSpec(
    options.rawSpec,
    options.universeCount,
    options.agentAssignments,
    options.clarificationAnswers,
  );

  let parsedSpec;
  if (prepared.status === 'clarification_required') {
    const details: ClarificationJsonData = {
      blockingReasons: prepared.assessment.blockingReasons,
      questions: prepared.assessment.questions,
      assumptions: prepared.assessment.assumptions,
    };

    if (options.clarificationMode === 'return') {
      return {
        status: 'clarification_required',
        details,
      };
    }

    const answers = await options.clarificationPrompt(details);
    parsedSpec = await finalizePreparedSpec(
      prepared.parsedSpec,
      prepared.assessment,
      options.universeCount,
      options.agentAssignments,
      answers,
    );
  } else {
    parsedSpec = prepared.parsedSpec;
  }

  const stability = checkMultiverseStability(options.sessionConfig.maxUniverses);
  if (stability.level === 'REJECTED') {
    return {
      status: 'rejected',
      message: stability.message,
    };
  }

  if (stability.requiresConfirmation && options.confirmationMode !== 'auto_accept') {
    if (options.confirmationMode === 'return') {
      return {
        status: 'confirmation_required',
        level: stability.level,
        message: stability.message,
      };
    }

    const proceed = await options.confirmationPrompt();
    if (!proceed) {
      return {
        status: 'rejected',
        message: 'Wise choice. The multiverse remains intact.',
      };
    }
  }

  const session = await sessionManager.createSession(
    options.specSourcePath,
    parsedSpec,
    options.sessionConfig,
    options.rawSpec,
  );

  return {
    status: 'ready',
    session,
  };
}

export async function runPreparedSession(
  sessionManager: SessionManager,
  session: Session,
  config: GlobalConfig,
): Promise<Session> {
  return executeSessionRuntime(sessionManager, session, config);
}
