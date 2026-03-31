import { join } from 'path';
import {
  CONVERSATION_PROVIDER_REGISTRY,
  HOST_CAPABILITIES_REGISTRY,
  RUNTIME_ADAPTER_CONTRACTS,
  SUPE_CONTRACT_VERSION,
  SUPE_EXIT_CODES,
} from './contracts.js';

export interface ContractSnapshot {
  contractVersion: string;
  exitCodes: typeof SUPE_EXIT_CODES;
  hostCapabilities: typeof HOST_CAPABILITIES_REGISTRY;
  runtimeContracts: typeof RUNTIME_ADAPTER_CONTRACTS;
  conversationProviders: typeof CONVERSATION_PROVIDER_REGISTRY;
  schemaPaths: {
    cliSessionEnvelope: string;
    cliClarificationRequired: string;
    mcpTools: string;
  };
}

export function getContractSnapshot(repoRoot: string): ContractSnapshot {
  return {
    contractVersion: SUPE_CONTRACT_VERSION,
    exitCodes: SUPE_EXIT_CODES,
    hostCapabilities: HOST_CAPABILITIES_REGISTRY,
    runtimeContracts: RUNTIME_ADAPTER_CONTRACTS,
    conversationProviders: CONVERSATION_PROVIDER_REGISTRY,
    schemaPaths: {
      cliSessionEnvelope: join(repoRoot, 'schemas', 'cli', 'session-envelope.schema.json'),
      cliClarificationRequired: join(repoRoot, 'schemas', 'cli', 'clarification-required.schema.json'),
      mcpTools: join(repoRoot, 'schemas', 'mcp', 'session-tools.schema.json'),
    },
  };
}
