import { appendFile, mkdir, readFile } from 'fs/promises';
import { join } from 'path';
import type { RuntimeEvent } from './contracts.js';

export function getRuntimeEventLogPath(universeWorkdir: string): string {
  return join(universeWorkdir, '.supe', 'runtime-events.jsonl');
}

export async function appendRuntimeEvent(
  universeWorkdir: string,
  event: RuntimeEvent,
): Promise<void> {
  const dir = join(universeWorkdir, '.supe');
  await mkdir(dir, { recursive: true });
  await appendFile(getRuntimeEventLogPath(universeWorkdir), `${JSON.stringify(event)}\n`);
}

export async function readRuntimeEvents(
  universeWorkdir: string,
): Promise<RuntimeEvent[]> {
  try {
    const raw = await readFile(getRuntimeEventLogPath(universeWorkdir), 'utf8');
    return raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as RuntimeEvent);
  } catch {
    return [];
  }
}
