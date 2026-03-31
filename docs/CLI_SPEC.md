# CLI Specification

[한국어](./CLI_SPEC_KR.md)

This document reflects the **current implemented CLI** on `main`.

## Entry point

```bash
supe <command>
```

## Commands

### `supe run`
Start a new session.

Key options:
- `--spec <path>`
- `--universes <n>`
- `--agent <claude|codex>`
- `--agents <claude,codex,...>`
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

Behavior:
- prepares the problem contract
- creates a session and universes
- selects runtime assignment (`--agent` or `--agents` round-robin)
- launches the conversation runtime layer
- uses Ink dashboard by default for interactive TTY runs
- suppresses Ink in JSON and non-TTY modes

### `supe status [session-id]`
Show session status.

Current output includes:
- universe progress
- runtime session state when available
- waiting question when a universe is blocked on user input

### `supe report [session-id]`
Show a comparison report.

### `supe list`
List sessions.

### `supe stop [session-id]`
Stop a running session.

### `supe resume <session-id>`
Resume a stopped session.

Supported options:
- `--json`
- `--non-interactive`
- `--yes`
- `--reply <text>`
- `--universe <symbol-or-id>`

Behavior:
- resumes the stored runtime session state
- optionally queues a reply into a waiting universe before resume
- if only one universe is waiting, `--universe` may be omitted

### `supe setup`
Prepare runtime/integration prerequisites.

### `supe doctor`
Inspect runtime readiness and optional live connectivity.

### `supe contracts`
Show the host-neutral contract snapshot.

### `supe mcp serve`
Run the stdio MCP server.

## JSON and exit behavior

Current contract version:
- `2026-03-30`

Exit codes:
- `0` success
- `1` failure / runtime failure / precondition failure
- `2` clarification required
- `3` confirmation required
- `4` not found
- `5` invalid request

## Presentation behavior

### Interactive TTY
- Ink dashboard is the default presenter
- boot banner and pulse render immediately
- focused detail section is shown for the most relevant universe

### JSON / non-TTY
- no dashboard rendering
- structured output remains stable
