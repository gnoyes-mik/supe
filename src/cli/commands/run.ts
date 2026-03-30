import { readFile } from 'fs/promises';
import readline from 'readline/promises';
import { stdin as input } from 'process';
import {
  SUPE_EXIT_CODES,
  type ClarificationJsonData,
  type RunJsonData,
  makeSessionJsonData,
} from '../../app/contracts.js';
import { loadClarificationAnswers } from '../../app/clarification-input.js';
import { errorCodeToExitCode, SupeServiceError } from '../../app/errors.js';
import {
  buildSessionConfig,
  normalizeAgentType,
  normalizeUniverseCount,
  resolveAgentAssignments,
  resolveBaseRepoPath,
} from '../../app/run-config.js';
import {
  prepareSessionForRun,
  runPreparedSession,
} from '../../app/run-service.js';
import { loadSpecificSession } from '../../app/session-service.js';
import { ensureLlmConfigured } from '../../app/preflight-service.js';
import { SessionManager } from '../../core/session.js';
import { loadConfig } from '../../utils/config.js';
import { initLlmClient } from '../../utils/llm.js';
import { logger } from '../../utils/logger.js';
import { configureJsonOutput, printJsonError, printJsonSuccess } from '../output.js';
import type {
  AgentType,
  AmbiguityAssessment,
  ClarificationField,
  GlobalConfig,
  Session,
} from '../../types.js';

export async function runCommand(opts: Record<string, unknown>): Promise<void> {
  const jsonMode = Boolean(opts.json);
  const nonInteractive = Boolean(opts['nonInteractive']);
  const autoYes = Boolean(opts.yes);
  configureJsonOutput(jsonMode);

  const config = await loadConfig();
  initLlmClient(config.llm, config.agents);

  const sessionManager = new SessionManager();

  try {
    const resumeId = getStringOpt(opts.resume);
    let session: Session;

    if (resumeId) {
      const resumed = await loadSpecificSession(sessionManager, resumeId);
      if (!resumed) {
        throw new SupeServiceError('not_found', `Session ${resumeId} was not found.`);
      }
      session = resumed;
      logger.info('cli', `Resuming session ${session.id}`);
    } else {
      ensureLlmConfigured(config);
      const specPath = getStringOpt(opts.spec);
      const rawSpec = specPath
        ? await readSpecInput(specPath)
        : await promptInteractiveSpec();

      const universeCount = normalizeUniverseCount(opts.universes, config.session.maxUniverses);
      const defaultAgent = normalizeAgentType(opts.agent) ?? config.defaultAgent;
      const agentAssignments = resolveAgentAssignments(opts['agents'], universeCount, defaultAgent);
      const baseRepoPath = await resolveBaseRepoPath(opts.baseRepo);
      const clarificationAnswers = await loadClarificationAnswers({
        clarificationJson: opts['clarificationJson'],
        clarificationFile: opts['clarificationFile'],
      });

      const sessionConfig = buildSessionConfig({
        timeout: opts.timeout,
        maxCost: opts['maxCost'],
        pollenInterval: opts['pollenInterval'],
        pollen: opts.pollen,
        slack: opts.slack,
      }, config, universeCount, defaultAgent, baseRepoPath);
      const specSourcePath = specPath
        ? (specPath === '-' ? '<stdin>' : specPath)
        : '<interactive>';
      const prepared = await prepareSessionForRun(sessionManager, {
        rawSpec,
        specSourcePath,
        universeCount,
        defaultAgent,
        agentAssignments,
        sessionConfig,
        clarificationAnswers,
        clarificationMode: nonInteractive || jsonMode ? 'return' : 'prompt',
        confirmationMode: autoYes ? 'auto_accept' : (nonInteractive || jsonMode || !input.isTTY ? 'return' : 'prompt'),
        confirmationPrompt: async () => promptConfirmation('> '),
        clarificationPrompt: async (details) => promptClarificationAnswers({
          questions: details.questions.map((question) => ({
            ...question,
            id: question.id as ClarificationField,
          })),
          blockingReasons: details.blockingReasons,
          assumptions: details.assumptions,
          requiresClarification: true,
        }),
      });

      if (prepared.status === 'clarification_required') {
        throw new ClarificationRequiredError(prepared.details);
      }

      if (prepared.status === 'confirmation_required') {
        process.exitCode = SUPE_EXIT_CODES.CONFIRMATION_REQUIRED;
        if (jsonMode) {
          printJsonError('confirmation_required', 'Execution requires explicit confirmation.', {
            level: prepared.level,
            message: prepared.message,
          });
        } else {
          console.error(prepared.message);
        }
        return;
      }

      if (prepared.status === 'rejected') {
        if (!jsonMode) {
          console.log(prepared.message);
        }
        process.exitCode = prepared.message.includes('fabric of reality') ? SUPE_EXIT_CODES.FAILURE : 0;
        return;
      }

      session = prepared.session;
    }

    session = await runPreparedSession(sessionManager, session, config, {
      jsonMode,
      isTTY: Boolean(process.stdout.isTTY),
      dashboardEnabled: opts.dashboard !== false,
    });
    if (jsonMode) {
      const payload: RunJsonData = {
        ...makeSessionJsonData(session),
        report: session.report,
      };
      printJsonSuccess(payload);
    }
  } catch (error) {
    logger.error('cli', `Run command failed: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof ClarificationRequiredError) {
      process.exitCode = SUPE_EXIT_CODES.CLARIFICATION_REQUIRED;
      if (jsonMode) {
        printJsonError('clarification_required', error.message, error.details);
      } else {
        console.error(error.message);
      }
    } else {
      if (error instanceof SupeServiceError) {
        process.exitCode = errorCodeToExitCode(error.code);
        if (jsonMode) {
          printJsonError(error.code, error.message, error.details);
        }
      } else {
        process.exitCode = SUPE_EXIT_CODES.FAILURE;
        if (jsonMode) {
          printJsonError('runtime_failure', error instanceof Error ? error.message : String(error));
        }
      }
    }
  } finally {
    configureJsonOutput(false);
    sessionManager.destroy();
  }
}

class ClarificationRequiredError extends Error {
  details: ClarificationJsonData;

  constructor(details: ClarificationJsonData) {
    super('Clarification is required before Supe can open aligned universes.');
    this.details = details;
  }
}

function getStringOpt(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getRequiredStringOpt(value: unknown, optionName: string): string {
  const resolved = getStringOpt(value);
  if (!resolved) {
    throw new Error(`Missing required option: ${optionName}`);
  }
  return resolved;
}

async function promptConfirmation(prompt: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await rl.question(prompt);
    return answer.trim().toLowerCase() === 'y';
  } finally {
    rl.close();
  }
}

async function readSpecInput(specPath: string): Promise<string> {
  if (specPath !== '-') {
    return readFile(specPath, 'utf-8');
  }

  let raw = '';
  for await (const chunk of input) {
    raw += chunk.toString();
  }

  if (raw.trim().length === 0) {
    throw new SupeServiceError('invalid_request', 'No spec content was provided on stdin.');
  }

  return raw;
}

async function promptInteractiveSpec(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log('');
    console.log('No spec file provided. Entering interactive mode.');
    console.log('Describe your problem and Supe will open the multiverse.\n');

    const problem = await rl.question('What problem do you want to solve?\n> ');
    if (problem.trim().length === 0) {
      throw new SupeServiceError('invalid_request', 'Problem description cannot be empty.');
    }

    const constraints = await rl.question('\nAny constraints? (optional, separate with semicolons)\n> ');
    const outputs = await rl.question('\nWhat outputs do you expect? (optional, separate with semicolons)\n> ');
    const criteria = await rl.question('\nHow will you know it\'s solved? (optional, separate with semicolons)\n> ');

    const sections: string[] = [`# ${problem.trim()}\n`, `## Problem\n${problem.trim()}\n`];

    if (constraints.trim().length > 0) {
      const items = constraints.split(/;|\n/).map(s => s.trim()).filter(Boolean);
      sections.push(`## Constraints\n${items.map(c => `- ${c}`).join('\n')}\n`);
    }

    if (outputs.trim().length > 0) {
      const items = outputs.split(/;|\n/).map(s => s.trim()).filter(Boolean);
      sections.push(`## Desired Outputs\n${items.map(o => `- ${o}`).join('\n')}\n`);
    }

    if (criteria.trim().length > 0) {
      const items = criteria.split(/;|\n/).map(s => s.trim()).filter(Boolean);
      sections.push(`## Success Criteria\n${items.map(c => `- ${c}`).join('\n')}\n`);
    }

    return sections.join('\n');
  } finally {
    rl.close();
  }
}

async function promptClarificationAnswers(
  assessment: AmbiguityAssessment,
): Promise<Partial<Record<ClarificationField, string>>> {
  const answers: Partial<Record<ClarificationField, string>> = {};
  const questions = assessment.questions.slice(0, 3);

  if (questions.length === 0) {
    return answers;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log('');
    console.log('Supe needs a tighter problem contract before the universes diverge:');
    for (const reason of assessment.blockingReasons) {
      console.log(`- ${reason}`);
    }
    console.log('');

    for (const question of questions) {
      console.log(`${question.why}`);
      const answer = await rl.question(`${question.prompt}\n> `);
      answers[question.id] = answer;
      console.log('');
    }
  } finally {
    rl.close();
  }

  return answers;
}
