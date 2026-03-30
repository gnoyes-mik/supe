# Architecture

This document describes the **current implemented architecture**, not the original design intent.

## Top-level shape

```text
User / Host
  -> Supe CLI / MCP / Plugin surface
    -> host-neutral app layer
      -> core multiverse engine
        -> Claude Code / Codex runtimes
          -> universe workdirs + artifacts
```

## Layer 1 — Host surfaces

### CLI
Files:
- `src/index.ts`
- `src/cli/commands/*`
- `src/cli/output.ts`

Responsibilities:
- parse commands/options
- emit JSON or human-readable output
- delegate to app layer

### MCP
Files:
- `src/mcp/server.ts`
- `.mcp.json`

Responsibilities:
- stdio MCP transport
- tool routing
- structuredContent responses
- session lifecycle access via app layer

### Plugin surface
Files:
- `.claude-plugin/plugin.json`
- `skills/*`

Responsibilities:
- host discovery/entry only
- no orchestration logic ownership

## Layer 2 — Host-neutral app layer

Files:
- `src/app/contracts.ts`
- `src/app/contracts-service.ts`
- `src/app/run-config.ts`
- `src/app/spec-service.ts`
- `src/app/run-service.ts`
- `src/app/session-service.ts`
- `src/app/report-service.ts`
- `src/app/runtime-service.ts`
- `src/app/stop-service.ts`
- `src/app/setup-service.ts`
- `src/app/preflight-service.ts`
- `src/app/errors.ts`

Responsibilities:
- public contract definitions
- spec preparation and ambiguity handling
- session lifecycle services
- report generation services
- runtime execution orchestration
- setup/doctor diagnostics
- normalized service errors

## Layer 3 — Core engine

Files:
- `src/core/session.ts`
- `src/core/orchestrator.ts`
- `src/core/spec-parser.ts`
- `src/core/ambiguity-gate.ts`
- `src/core/rubric.ts`
- `src/core/stability.ts`

Responsibilities:
- persistent session model
- universe orchestration
- ambiguity assessment
- problem contract fixing
- deterministic sharing rubric
- stability warnings/limits

## Layer 4 — Execution / reporting

### Universes
Files:
- `src/universe/runner.ts`
- `src/universe/prompt-builder.ts`
- `src/universe/progress-detector.ts`

### Cross-Pollination
Files:
- `src/pollen/analyst.ts`
- `src/pollen/pollinator.ts`
- `src/pollen/tracker.ts`

### Reporting
Files:
- `src/reporter/metrics.ts`
- `src/reporter/comparator.ts`
- `src/reporter/formatter.ts`

## Runtime boundary

Files:
- `src/agents/base.ts`
- `src/agents/claude.ts`
- `src/agents/codex.ts`

Responsibilities:
- map universe execution to concrete runtime commands
- keep runtime-specific assumptions out of higher orchestration layers

## Persistence model

Session root:
- `session.json`
- `spec.md`
- `parsed-spec.json`
- `problem-contract.json`
- `report.json`

Universe root:
- `PROMPT.md`
- `solution-spec.md`
- `verification-spec.md`
- `DONE.md`
- `.supe/universe.json`
- `.supe/logs.jsonl`

## Current contract status

The public contract is currently versioned as:
- `2026-03-30`

Relevant machine-readable assets:
- `schemas/cli/session-envelope.schema.json`
- `schemas/cli/clarification-required.schema.json`
- `schemas/mcp/session-tools.schema.json`

## Known limitations
- MCP `start_session` is currently synchronous
- MCP server is minimal/handcrafted
- external live validation is still required for plugin install and real LLM-backed session runs
