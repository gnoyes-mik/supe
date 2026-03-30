import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { getContractSnapshot } from '../dist/app/contracts-service.js';
import { callMcpTool, repoRoot } from './helpers/process.mjs';

test('contract snapshot exposes host/runtime contracts and schema paths', () => {
  const snapshot = getContractSnapshot(repoRoot);
  assert.equal(snapshot.contractVersion, '2026-03-30');
  assert.ok(snapshot.exitCodes.SUCCESS === 0);
  assert.ok(snapshot.hostCapabilities.cli.supportsJsonOutput);
  assert.ok(snapshot.hostCapabilities.mcp.supportsMcp);
  assert.equal(snapshot.runtimeContracts.claude.runtime, 'claude');
  assert.equal(snapshot.runtimeContracts.codex.runtime, 'codex');
  assert.equal(snapshot.runtimeContracts.codex.interactiveTransport, 'app-server');
  assert.equal(snapshot.runtimeContracts.claude.interactiveTransport, 'stream-json');
  assert.equal(snapshot.runtimeContracts.codex.canonicalTtyPresenter, 'ink');
  assert.equal(snapshot.conversationProviders.codex.transport, 'app-server');
  assert.equal(snapshot.conversationProviders.claude.transport, 'stream-json');
  assert.ok(snapshot.schemaPaths.cliSessionEnvelope.endsWith('schemas/cli/session-envelope.schema.json'));
  assert.ok(snapshot.schemaPaths.mcpTools.endsWith('schemas/mcp/session-tools.schema.json'));
});

test('contracts CLI returns repo-root schema paths', async () => {
  const proc = spawn('node', ['dist/index.js', 'contracts', '--json'], {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'inherit'],
  });

  let stdout = '';
  for await (const chunk of proc.stdout) {
    stdout += chunk.toString();
  }

  const exitCode = await new Promise((resolve) => proc.on('close', resolve));
  assert.equal(exitCode, 0);
  const payload = JSON.parse(stdout);
  assert.equal(payload.ok, true);
  assert.ok(payload.data.schemaPaths.cliSessionEnvelope.startsWith(repoRoot));
  assert.ok(!payload.data.schemaPaths.cliSessionEnvelope.includes('/dist/schemas/'));
});

test('MCP get_contracts returns structuredContent contract snapshot', async () => {
  const response = await callMcpTool('supe.get_contracts');
  assert.equal(response.result.structuredContent.contractVersion, '2026-03-30');
  assert.ok(response.result.structuredContent.hostCapabilities['claude-plugin']);
  assert.ok(response.result.structuredContent.runtimeContracts.codex);
  assert.equal(response.result.structuredContent.runtimeContracts.claude.supportsStreamingOutput, true);
  assert.equal(response.result.structuredContent.conversationProviders.codex.transport, 'app-server');
});
