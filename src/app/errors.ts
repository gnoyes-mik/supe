import { SUPE_EXIT_CODES, type SupeErrorCode } from './contracts.js';

export class SupeServiceError extends Error {
  code: SupeErrorCode;
  details?: unknown;

  constructor(code: SupeErrorCode, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export function toErrorPayload(error: unknown): {
  code: SupeErrorCode;
  message: string;
  details?: unknown;
} {
  if (error instanceof SupeServiceError) {
    return {
      code: error.code,
      message: error.message,
      details: error.details,
    };
  }

  return {
    code: 'runtime_failure',
    message: error instanceof Error ? error.message : String(error),
  };
}

export function errorCodeToExitCode(code: SupeErrorCode): number {
  switch (code) {
    case 'clarification_required':
      return SUPE_EXIT_CODES.CLARIFICATION_REQUIRED;
    case 'confirmation_required':
      return SUPE_EXIT_CODES.CONFIRMATION_REQUIRED;
    case 'not_found':
      return SUPE_EXIT_CODES.NOT_FOUND;
    case 'invalid_request':
      return SUPE_EXIT_CODES.INVALID_REQUEST;
    case 'precondition_failed':
    case 'runtime_failure':
    default:
      return SUPE_EXIT_CODES.FAILURE;
  }
}
