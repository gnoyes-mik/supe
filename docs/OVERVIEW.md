# Overview

[한국어](./OVERVIEW_KR.md)

Supe is a **comparison-first multiverse orchestration engine**.
It is the top-level product users interact with; Claude Code and Codex are internal runtimes that Supe can use per universe. The analysis/control plane is now local-CLI first as well.

## Current implemented shape

- Supe is the entrypoint
- universes are execution sandboxes with distinct approaches
- outputs are markdown-first (`solution-spec.md`, `verification-spec.md`)
- comparison is first-class; winner-picking is not
- host surfaces currently include CLI, MCP, and a minimal Claude plugin surface
- local CLI analysis backends currently support `claude-cli` and `codex-cli`
- mixed runtime sessions are assigned via `--agents` round-robin over `claude` / `codex`

## Core principles
- define the problem once
- lock the problem contract before universes diverge
- allow solution diversity, not contract drift
- share only reusable insights
- compare universes explicitly at the end

## Current surfaces

### CLI
Implemented:
- run / status / report / list / stop / resume
- setup / doctor / contracts
- JSON + non-interactive support

### MCP
Implemented:
- stdio MCP server
- contract + doctor + session lifecycle tools

### Claude plugin
Implemented minimally:
- `.claude-plugin/plugin.json`
- `skills/`
- `.mcp.json`

## Outputs

### Universe outputs
- `solution-spec.md`
- `verification-spec.md`
- `DONE.md`

### Session outputs
- `parsed-spec.json`
- `problem-contract.json`
- `report.json`

## Current limitations
- live Claude plugin install not yet validated end-to-end
- long-running local CLI sessions are not yet fully validated end-to-end for final deliverable emission
- stop/timeout behavior across extended preparation phases still needs additional live hardening

## Source of truth
For the current state of the system, prefer:
1. `src/`
2. `schemas/`
3. test evidence

This file is intentionally concise and implementation-aligned.
