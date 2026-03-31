# Overview

[한국어](./OVERVIEW_KR.md)

Supe is a comparison-first multiverse orchestration engine that now ships with a **merged Phase 0-6 conversation runtime baseline**.

## Current implemented shape

- Supe is the primary entrypoint
- universes are isolated workspaces with distinct approaches
- runtime execution is conversational rather than purely one-shot
- Codex runs through **app-server**
- Claude runs through **stream-json**
- `ConversationManager` owns provider-neutral runtime/session control
- Ink is the default TTY dashboard surface
- JSON and non-TTY flows bypass Ink cleanly

## Core workflow

1. Parse a raw problem statement
2. Clarify only missing contract-level facts
3. Freeze a shared problem contract
4. Create diverse universes
5. Run universes on `claude`, `codex`, or a mixed assignment
6. Share reusable insights through pollen
7. Compare resulting artifacts and generate a report

## Control-plane capabilities

Current runtime/control features include:
- persisted per-universe runtime session metadata
- append-only runtime event logs
- provider-neutral waiting state (`waiting_for_user`)
- resume with queued reply injection (`supe resume ... --reply ...`)
- timeout / interrupt / cancel state propagation
- focused dashboard detail for the most relevant universe

## Current host surfaces

### CLI
Implemented:
- run / status / report / list / stop / resume
- setup / doctor / contracts
- JSON + non-interactive behavior

### MCP
Implemented:
- stdio MCP server
- session lifecycle tools
- contract + doctor surfaces

### Claude plugin
Implemented as a thin host surface:
- `.claude-plugin/plugin.json`
- `skills/`
- `.mcp.json`

## Outputs

### Universe outputs
- `solution-spec.md`
- `verification-spec.md`
- `DONE.md`

### Session outputs
- `session.json`
- `parsed-spec.json`
- `problem-contract.json`
- `report.json`

## Current limitations

Still best validated manually in real environments:
- long-lived interactive provider sessions
- real resume-with-reply flows against both providers
- operational behavior around provider stalls/restarts
