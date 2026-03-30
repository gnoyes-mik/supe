# CLI Specification

This document reflects the **current implemented CLI**, not the earlier design draft.

## Entry point

```bash
supe <command>
```

## Commands

### `supe run`
Start a new session.

Key options:
- `--spec <path>` (required, use `-` for stdin)
- `--universes <n>`
- `--agent <claude|codex>`
- `--base-repo <path>`
- `--timeout <duration>`
- `--max-cost <usd>`
- `--pollen-interval <min>`
- `--json`
- `--non-interactive`
- `--yes`
- `--clarification-json <json>`
- `--clarification-file <path>`
- `--no-pollen`
- `--no-dashboard`
- `--resume <session-id>`

Behavior:
- parses raw spec
- applies ambiguity gate to contract-level uncertainty
- may return clarification-required JSON in non-interactive mode
- checks multiverse stability
- creates session + universes
- executes universes through the runtime layer

### `supe status [session-id]`
Show session status.

Supports:
- `--json`

### `supe report [session-id]`
Show a comparison report.

Supports:
- `--json`

### `supe list`
List sessions.

Supports:
- `--json`

### `supe stop [session-id]`
Stop a running session.

Supports:
- `--json`

### `supe resume <session-id>`
Resume a stopped session.

Supports:
- `--json`
- `--non-interactive`
- `--yes`

### `supe setup`
Prepare runtime/integration prerequisites.

Supports:
- `--json`

### `supe doctor`
Diagnose runtime/plugin/MCP readiness.

Supports:
- `--json`
- `--live`

### `supe contracts`
Print the current host-neutral contract snapshot.

Supports:
- `--json`

### `supe mcp serve`
Run the stdio MCP server.

## JSON contract

### Envelope
All JSON-capable commands emit:

```json
{
  "contractVersion": "2026-03-30",
  "ok": true,
  "data": {}
}
```

or

```json
{
  "contractVersion": "2026-03-30",
  "ok": false,
  "error": {
    "code": "not_found",
    "message": "...",
    "details": {}
  }
}
```

### Exit codes
- `0` success
- `1` failure / runtime failure / precondition failure
- `2` clarification required
- `3` confirmation required
- `4` not found
- `5` invalid request

## Non-interactive behavior

`run --non-interactive` never prompts.
If contract information is missing, it returns a clarification-required error instead.

Clarification answers can be re-submitted via:
- `--clarification-json <json>`
- `--clarification-file <path>`

## Current command set from built binary

```text
run, status, report, list, stop, resume, init, setup, doctor, contracts, mcp
```

## Notes
- `dashboard.tsx` still exists as a placeholder and is not the active product surface
- current authoritative behavior is covered by `src/cli/*` and test evidence
