import Handlebars from 'handlebars';
import { readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { UniverseConfig, ParsedSpec } from '../types.js';
import { buildProblemContract } from '../core/ambiguity-gate.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = join(__dirname, '../../templates/universe-prompt.md.hbs');

export async function buildPrompt(
  config: UniverseConfig,
  spec: ParsedSpec,
): Promise<string> {
  const templateSrc = await readFile(TEMPLATE_PATH, 'utf-8');
  const template = Handlebars.compile(templateSrc);
  const problemContract = spec.problemContract ?? buildProblemContract({
    problemStatement: spec.problemStatement,
    desiredOutputs: spec.desiredOutputs,
    constraints: spec.constraints,
    successCriteria: spec.successCriteria,
    outOfScope: spec.outOfScope ?? [],
    assumptions: spec.assumptions ?? [],
  });

  return template({
    config,
    problemStatement: spec.problemStatement,
    constraints: spec.constraints,
    desiredOutputs: spec.desiredOutputs,
    successCriteria: spec.successCriteria,
    additionalContext: spec.additionalContext,
    problemContract,
    outOfScope: spec.outOfScope ?? [],
    assumptions: spec.assumptions ?? [],
    domain: spec.domain,
    tools: config.tools,
    approach: config.approach,
    optimizationAxis: config.optimizationAxis,
  });
}

export async function writePromptFile(workdir: string, content: string): Promise<void> {
  await writeFile(join(workdir, 'PROMPT.md'), content);
}
