import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'fs/promises';
import { join } from 'path';

const repoRoot = process.cwd();

test('plugin manifest points to local skills and mcp config', async () => {
  const raw = await readFile(join(repoRoot, '.claude-plugin', 'plugin.json'), 'utf-8');
  const parsed = JSON.parse(raw);
  assert.equal(parsed.skills, './skills/');
  assert.equal(parsed.mcpServers, './.mcp.json');
});

test('mcp config uses CLAUDE_PLUGIN_ROOT dist entrypoint', async () => {
  const raw = await readFile(join(repoRoot, '.mcp.json'), 'utf-8');
  assert.match(raw, /\$\{CLAUDE_PLUGIN_ROOT\}\/dist\/index\.js/);
});
