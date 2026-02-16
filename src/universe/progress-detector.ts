import type { CriterionStatus, ParsedSpec } from '../types.js';
import { callLlmJson } from '../utils/llm.js';
import { createGit } from '../utils/git.js';

export async function assessCriteriaProgress(
  workdir: string,
  spec: ParsedSpec,
): Promise<CriterionStatus[]> {
  const git = createGit(workdir);

  let fileList: string;
  try {
    fileList = await git.raw(['ls-files']);
  } catch {
    fileList = '';
  }

  let recentCommits: string;
  try {
    const log = await git.log({ maxCount: 10 });
    recentCommits = log.all.map((c) => c.message).join('\n');
  } catch {
    recentCommits = '';
  }

  const prompt = `You are evaluating progress on a project.

## Success Criteria
${spec.successCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

## Files in project
${fileList || '(no files yet)'}

## Recent commits
${recentCommits || '(no commits yet)'}

## Task
For each success criterion, assess its current status.

## Response Format (JSON array, no markdown fencing)
[
  {
    "criterion": "exact criterion text",
    "status": "not_started | in_progress | likely_done | verified",
    "evidence": "brief evidence from files/commits"
  }
]`;

  try {
    const result = await callLlmJson<CriterionStatus[]>(prompt);
    return result;
  } catch {
    return spec.successCriteria.map((c) => ({
      criterion: c,
      status: 'in_progress' as const,
      evidence: 'Assessment unavailable',
    }));
  }
}

export function calculatePercentage(criteria: CriterionStatus[]): number {
  if (criteria.length === 0) return 0;

  const weights: Record<CriterionStatus['status'], number> = {
    not_started: 0,
    in_progress: 30,
    likely_done: 80,
    verified: 100,
  };

  const total = criteria.reduce((sum, c) => sum + weights[c.status], 0);
  return Math.min(Math.round(total / criteria.length), 95);
}
