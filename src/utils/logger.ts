import { appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { LogEntry, LogSource } from '../types.js';

export class Logger {
  private logDir: string | null = null;

  setLogDir(dir: string): void {
    this.logDir = dir;
    mkdirSync(dir, { recursive: true });
  }

  log(
    level: LogEntry['level'],
    source: LogSource,
    message: string,
    universeId: string | null = null,
    data: Record<string, unknown> | null = null
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      source,
      universeId,
      message,
      data,
    };

    const prefix = universeId ? `[${universeId}]` : '[session]';
    const levelTag = level.toUpperCase().padEnd(5);
    console.log(`[${entry.timestamp}] ${levelTag} ${prefix} ${message}`);

    if (this.logDir) {
      const logPath = join(this.logDir, 'logs.jsonl');
      appendFileSync(logPath, JSON.stringify(entry) + '\n');
    }
  }

  info(source: LogSource, message: string, universeId?: string | null, data?: Record<string, unknown> | null): void {
    this.log('info', source, message, universeId ?? null, data ?? null);
  }

  warn(source: LogSource, message: string, universeId?: string | null, data?: Record<string, unknown> | null): void {
    this.log('warn', source, message, universeId ?? null, data ?? null);
  }

  error(source: LogSource, message: string, universeId?: string | null, data?: Record<string, unknown> | null): void {
    this.log('error', source, message, universeId ?? null, data ?? null);
  }

  debug(source: LogSource, message: string, universeId?: string | null, data?: Record<string, unknown> | null): void {
    this.log('debug', source, message, universeId ?? null, data ?? null);
  }
}

export const logger = new Logger();
