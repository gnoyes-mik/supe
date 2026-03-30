import type { JsonEnvelope, SupeErrorCode } from '../app/contracts.js';
import { SUPE_CONTRACT_VERSION } from '../app/contracts.js';
import { logger } from '../utils/logger.js';

export function configureJsonOutput(enabled: boolean): void {
  logger.setConsoleEnabled(!enabled);
}

export function printJsonSuccess<T>(data: T): void {
  const payload: JsonEnvelope<T> = {
    contractVersion: SUPE_CONTRACT_VERSION,
    ok: true,
    data,
  };
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

export function printJsonError(
  code: SupeErrorCode,
  message: string,
  details?: unknown,
): void {
  const payload: JsonEnvelope<never> = {
    contractVersion: SUPE_CONTRACT_VERSION,
    ok: false,
    error: {
      code,
      message,
      details,
    },
  };
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}
