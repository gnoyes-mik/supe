import { readFile } from 'fs/promises';
import type { ClarificationField } from '../types.js';

export type ClarificationAnswers = Partial<Record<ClarificationField, string>>;

const FIELDS: ClarificationField[] = [
  'desiredOutputs',
  'successCriteria',
  'constraints',
  'outOfScope',
];

export async function loadClarificationAnswers(
  opts: {
    clarificationJson?: unknown;
    clarificationFile?: unknown;
  },
): Promise<ClarificationAnswers | undefined> {
  const rawJson = typeof opts.clarificationJson === 'string' ? opts.clarificationJson.trim() : '';
  const rawFile = typeof opts.clarificationFile === 'string' ? opts.clarificationFile.trim() : '';

  if (rawJson.length > 0 && rawFile.length > 0) {
    throw new Error('Use either --clarification-json or --clarification-file, not both.');
  }

  if (rawJson.length > 0) {
    return normalizeClarificationPayload(JSON.parse(rawJson));
  }

  if (rawFile.length > 0) {
    const content = await readFile(rawFile, 'utf-8');
    return normalizeClarificationPayload(JSON.parse(content));
  }

  return undefined;
}

export function normalizeClarificationPayload(payload: unknown): ClarificationAnswers {
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('Clarification payload must be a JSON object.');
  }

  const candidate = payload as Record<string, unknown>;
  const answers: ClarificationAnswers = {};

  for (const field of FIELDS) {
    const value = candidate[field];
    if (typeof value === 'string' && value.trim().length > 0) {
      answers[field] = value.trim();
      continue;
    }

    if (Array.isArray(value)) {
      const normalized = value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
      if (normalized.length > 0) {
        answers[field] = normalized.join('; ');
      }
    }
  }

  return answers;
}
