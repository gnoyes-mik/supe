import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const repoRoot = process.cwd();

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'inherit'],
    });

    let stdout = '';
    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      resolve({ code: code ?? 1, stdout });
    });
  });
}

test('npm pack dry-run includes plugin, mcp, schemas, skills, and dist surfaces', async () => {
  const result = await runCommand('npm', ['pack', '--dry-run', '--json']);
  assert.equal(result.code, 0);
  const payload = JSON.parse(result.stdout);
  const files = payload[0].files.map((entry) => entry.path);

  assert.ok(files.includes('dist/index.js'));
  assert.ok(files.includes('.claude-plugin/plugin.json'));
  assert.ok(files.includes('.mcp.json'));
  assert.ok(files.includes('schemas/cli/session-envelope.schema.json'));
  assert.ok(files.includes('schemas/mcp/session-tools.schema.json'));
  assert.ok(files.includes('skills/supe-run/SKILL.md'));
  assert.ok(files.includes('skills/supe-doctor/SKILL.md'));
});
