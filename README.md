# Supe (Superposition)

> Define one problem contract, let multiple universes explore it with Codex and Claude, then compare the results clearly.

[한국어 README 보기](./README_KR.md)

Supe is a **comparison-first multiverse orchestration engine**. It accepts a problem statement, locks a shared contract, creates multiple universes with distinct approaches, lets them exchange reusable insights, and returns universe artifacts plus a comparison report.

## Current Product Shape

The current `main` branch includes the merged **Phase 0-6 conversation runtime baseline**:

- contract-first runtime model
- Ink dashboard for interactive TTY runs
- Codex conversational runtime via **app-server**
- Claude conversational runtime via **stream-json**
- provider-neutral conversation control through Supe
- persisted runtime session metadata and event logs
- mixed-provider universe sessions
- reply/resume flow for universes waiting on user input

### Runtime model
- **Supe** = orchestration + control plane
- **Codex / Claude Code** = internal provider runtimes
- **ConversationManager** = provider-neutral runtime/session owner
- **Universe outputs** = `solution-spec.md`, `verification-spec.md`, `DONE.md`
- **Session outputs** = `session.json`, `parsed-spec.json`, `problem-contract.json`, `report.json`

## What Supe Does

1. Parse a free-form problem statement
2. Clarify only missing **contract-level** facts
3. Generate diverse universes with distinct optimization axes
4. Run universes on `claude`, `codex`, or a round-robin mix
5. Exchange reusable discoveries through Cross-Pollination
6. Persist per-universe runtime session state and event history
7. Return per-universe deliverables and a comparison-first report

## Installation

### Requirements
- Node.js 22+
- Claude Code CLI and/or Codex CLI on `PATH`

### Setup

```bash
git clone https://github.com/gnoyes-mik/supe.git
cd supe
npm install
npm run build
```

### Environment checks

```bash
supe setup
supe doctor
supe doctor --json
```

## CLI Surface

```bash
supe run [options]
supe status [session-id] [--json]
supe report [session-id] [--json]
supe list [--json]
supe stop [session-id] [--json]
supe resume <session-id> [--json] [--reply <text>] [--universe <symbol-or-id>]
supe contracts [--json]
supe setup [--json]
supe doctor [--json] [--live]
supe mcp serve
```

### Key `run` options

```bash
--spec <path>
--universes <n>
--agent <claude|codex>
--agents <claude,codex,...>
--base-repo <path>
--timeout <duration>
--max-cost <usd>
--pollen-interval <min>
--json
--non-interactive
--yes
--clarification-json <json>
--clarification-file <path>
--no-pollen
--no-dashboard
```

### Resume and reply

When a universe reaches `waiting_for_user`, you can resume the session and inject the reply through Supe:

```bash
supe resume ses_abc123 --reply "Use the REST API" --universe α
```

If only one universe is waiting, `--universe` is optional.

### Examples

```bash
supe run --spec ./spec.md
cat spec.md | supe run --spec - --json --non-interactive
supe run --spec ./spec.md --universes 5 --agents claude,codex
supe resume ses_abc123 --reply "Use PostgreSQL" --universe beta
supe contracts --json
```

## Runtime and Presentation Behavior

### Interactive TTY
- Ink dashboard is the default presenter
- launch banner + boot pulse appear immediately
- dashboard shows provider, state, step, criteria progress, and focused detail

### JSON / non-TTY
- Ink output is suppressed
- machine-readable JSON behavior remains intact

### Supported providers
- **Codex**: app-server transport
- **Claude**: `--print --input-format stream-json --output-format stream-json`

## MCP Integration

Supe includes a stdio MCP server:

```bash
supe mcp serve
```

Current MCP tools:
- `supe.get_contracts`
- `supe.doctor`
- `supe.start_session`
- `supe.get_session`
- `supe.list_sessions`
- `supe.get_report`
- `supe.resume_session`
- `supe.stop_session`

`supe.resume_session` also supports reply-driven resume semantics through tool arguments.

## Docs Map

- [`docs/OVERVIEW.md`](./docs/OVERVIEW.md)
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
- [`docs/CLI_SPEC.md`](./docs/CLI_SPEC.md)
- [`docs/DATA_MODELS.md`](./docs/DATA_MODELS.md)
- [`docs/UNIVERSE_RUNNER.md`](./docs/UNIVERSE_RUNNER.md)

Historical/reference docs still exist under `docs/`, but they are now aligned with the current merged source and explicitly marked when they are primarily historical.

## Current Limitations

Still worth manual smoke-testing in real environments:
- long-running interactive provider sessions with real user replies
- real Claude plugin install/use flow
- operational behavior under long provider stalls/restarts

## Source of Truth

When docs disagree, prefer:
1. `src/`
2. `test/`
3. `schemas/`
4. these docs
