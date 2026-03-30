export async function mcpCommand(subcommand?: string): Promise<void> {
  if (subcommand !== 'serve') {
    throw new Error('Usage: supe mcp serve');
  }

  const { serveMcp } = await import('../../mcp/server.js');
  await serveMcp();
}
