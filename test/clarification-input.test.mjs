import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { loadClarificationAnswers, normalizeClarificationPayload } from '../dist/app/clarification-input.js';

test('normalizeClarificationPayload accepts strings and arrays', () => {
  const normalized = normalizeClarificationPayload({
    desiredOutputs: ['solution-spec.md', 'verification-spec.md'],
    successCriteria: 'All required files exist',
    constraints: ['No Claude-specific core assumptions'],
  });

  assert.equal(normalized.desiredOutputs, 'solution-spec.md; verification-spec.md');
  assert.equal(normalized.successCriteria, 'All required files exist');
  assert.equal(normalized.constraints, 'No Claude-specific core assumptions');
});

test('loadClarificationAnswers reads from file', async () => {
  const path = join(process.cwd(), '.tmp-clarification-test.json');
  await writeFile(path, JSON.stringify({
    outOfScope: ['deployment', 'hosting'],
  }));
  try {
    const loaded = await loadClarificationAnswers({ clarificationFile: path });
    assert.equal(loaded.outOfScope, 'deployment; hosting');
  } finally {
    await unlink(path).catch(() => {});
  }
});
