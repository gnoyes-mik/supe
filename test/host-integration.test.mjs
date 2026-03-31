import test from 'node:test';
import assert from 'node:assert/strict';
import { callMcpTool, runCli } from './helpers/process.mjs';

test('doctor --json exposes llm readiness and host/runtime surfaces', async () => {
  const result = await runCli(['doctor', '--json']);
  assert.equal(result.code, 0);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.equal(typeof payload.data.llmConfigured, 'boolean');
  assert.equal(typeof payload.data.llmSmoke.attempted, 'boolean');
  assert.ok(payload.data.hostCapabilities.mcp.supportsMcp);
  assert.ok(payload.data.runtimeContracts.codex.supportsNonInteractiveExecution);
  assert.equal(typeof payload.data.runtimes[0].smokeOk, 'boolean');
  assert.equal(typeof payload.data.runtimes[0].smokeCommand, 'string');
  assert.equal(payload.data.pluginManifestValid, true);
  assert.equal(payload.data.mcpConfigUsesPluginRoot, true);
  assert.ok(payload.data.skillFilesPresent.length >= 8);
});

test('doctor --live --json reports skipped/failed LLM smoke without crashing', async () => {
  const result = await runCli(['doctor', '--live', '--json']);
  assert.equal(result.code, 0);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.data.llmSmoke.attempted, true);
  assert.equal(typeof payload.data.llmSmoke.ok, 'boolean');
});

test('MCP doctor returns readiness snapshot', async () => {
  const response = await callMcpTool('supe.doctor');
  assert.equal(typeof response.result.structuredContent.configExists, 'boolean');
  assert.equal(typeof response.result.structuredContent.llmConfigured, 'boolean');
  assert.ok(Array.isArray(response.result.structuredContent.runtimes));
});

test('MCP list_sessions returns structuredContent', async () => {
  const response = await callMcpTool('supe.list_sessions');
  assert.ok(Array.isArray(response.result.structuredContent.sessions));
});

test('MCP get_session returns not_found code for missing session', async () => {
  const response = await callMcpTool('supe.get_session', {
    sessionId: 'ses_missing_for_test',
  });
  assert.equal(response.result.isError, true);
  assert.equal(response.result.structuredContent.code, 'not_found');
});

test('MCP get_report returns not_found code for missing session', async () => {
  const response = await callMcpTool('supe.get_report', {
    sessionId: 'ses_missing_for_test',
  });
  assert.equal(response.result.isError, true);
  assert.equal(response.result.structuredContent.code, 'not_found');
});

test('MCP stop_session returns not_found code for missing session', async () => {
  const response = await callMcpTool('supe.stop_session', {
    sessionId: 'ses_missing_for_test',
  });
  assert.equal(response.result.isError, true);
  assert.equal(response.result.structuredContent.code, 'not_found');
});

test('MCP resume_session returns not_found code for missing session', async () => {
  const response = await callMcpTool('supe.resume_session', {
    sessionId: 'ses_missing_for_test',
  });
  assert.equal(response.result.isError, true);
  assert.equal(response.result.structuredContent.code, 'not_found');
});

test('MCP start_session rejects unsupported agents before launch', async () => {
  const response = await callMcpTool('supe.start_session', {
    spec: 'Build something useful',
    universes: 3,
    agent: 'claude',
    agents: 'claude,gemini,codex',
  });
  assert.equal(response.result.isError, true);
  assert.equal(response.result.structuredContent.code, 'invalid_request');
  assert.match(
    response.result.structuredContent.message,
    /Unsupported agent in --agents: gemini/i,
  );
});
