# Supe (Superposition)

> Define the problem once, let multiple universes explore it, compare the results clearly.

[한국어 README 보기](./README_KR.md)

Supe is a **comparison-first multiverse orchestration engine**.
It accepts a problem statement, locks a shared problem contract, opens multiple universes with distinct approaches, lets them exchange reusable insights, and returns per-universe deliverables plus a comparison report.

## Current Product Shape

Supe is the primary entrypoint.
Users start **Supe first**, and Supe internally uses **Claude Code** and/or **Codex** as runtime workers.

### Core model
- **Supe** = orchestration engine
- **Claude Code / Codex** = internal runtimes
- **Universe outputs** = `solution-spec.md`, `verification-spec.md`, `DONE.md`
- **Session output** = comparison-first Morning Report

### Current status
Implemented and verified internally:
- host-neutral app/service layer
- JSON + non-interactive CLI contract
- minimal MCP server
- minimal Claude plugin surface
- setup/doctor/contracts commands
- packaging surface for npm/plugin distribution

Still pending external validation:
- real Claude plugin install smoke
- real Codex host usage smoke
- real credential-backed `start_session` full run

---

## What Supe Does

1. Parses a free-form problem statement
2. Detects ambiguity around **what must be built**
3. Requires clarification only for missing contract-level facts
4. Generates diverse universes with different optimization axes
5. Runs universes with Claude Code and/or Codex
6. Shares reusable discoveries through Cross-Pollination
7. Produces per-universe spec artifacts and a comparison report

### Output shape
Each universe is expected to produce:
- `solution-spec.md`
- `verification-spec.md`
- `DONE.md`

Each session produces:
- `session.json`
- `parsed-spec.json`
- `problem-contract.json`
- `report.json`

---

## Installation

### Requirements
- Node.js 22+
- Claude Code CLI and/or Codex CLI on PATH for runtime execution
- Anthropic API key for LLM-backed spec/pollen/report flows

### Install dependencies

```bash
git clone https://github.com/gnoyes-mik/supe.git
cd supe
npm install
npm run build
```

### Initialize / inspect environment

```bash
supe setup
supe doctor
supe doctor --json
```

---

## CLI Surface

```bash
supe run [options]
supe status [session-id] [--json]
supe report [session-id] [--json]
supe list [--json]
supe stop [session-id] [--json]
supe resume <session-id> [--json]
supe contracts [--json]
supe setup [--json]
supe doctor [--json] [--live]
supe mcp serve
```

### Key `run` options

```bash
--spec <path>              required; use - for stdin
--universes <n>            2..10
--agent <claude|codex>     default runtime type
--base-repo <path>         seed each universe from an existing repo
--timeout <duration>       e.g. 10h, 30m
--max-cost <usd>
--pollen-interval <min>
--json
--non-interactive
--yes
--clarification-json <json>
--clarification-file <path>
--no-pollen
--no-dashboard
--resume <session-id>
```

### Examples

#### Interactive run

```bash
supe run --spec ./spec.md
```

#### Non-interactive stdin run

```bash
cat spec.md | supe run --spec - --json --non-interactive
```

#### Resume a session

```bash
supe resume ses_abc123 --json
```

#### Inspect contracts

```bash
supe contracts --json
```

---

## JSON / Non-interactive behavior

Supe now exposes a versioned machine-readable contract.

### Current contract version
- `2026-03-30`

### Exit codes
- `0` success
- `1` failure / precondition failure / runtime failure
- `2` clarification required
- `3` confirmation required
- `4` not found
- `5` invalid request

### Clarification behavior
Supe only asks questions about the **problem contract**, not the solution approach.

Examples of clarifiable items:
- required outputs
- success criteria
- hard constraints
- out-of-scope items

If `--non-interactive` or `--json` is used, Supe returns a structured clarification error instead of prompting.

---

## MCP Integration

Supe includes a minimal stdio MCP server:

```bash
supe mcp serve
```

### Current MCP tools
- `supe.get_contracts`
- `supe.doctor`
- `supe.start_session`
- `supe.get_session`
- `supe.list_sessions`
- `supe.get_report`
- `supe.resume_session`
- `supe.stop_session`

### MCP config
Repository root includes:
- `.mcp.json`

Current config targets plugin-root execution:
- `${CLAUDE_PLUGIN_ROOT}/dist/index.js mcp serve`

---

## Claude plugin surface

Repository root includes:
- `.claude-plugin/plugin.json`
- `skills/`

Current skills:
- `supe-run`
- `supe-status`
- `supe-report`
- `supe-resume`
- `supe-stop`
- `supe-setup`
- `supe-doctor`
- `supe-contracts`

These are intentionally thin entry surfaces over the Supe engine.

---

## Runtime model

Mixed-runtime universes are supported conceptually and structurally.
A session may contain:
- Universe α → Claude Code
- Universe β → Codex
- Universe γ → Claude Code

Cross-Pollination works by sharing **patterns / strategies / warnings**, not raw code copying.

---

## Architecture Summary

### Host surfaces
- CLI
- MCP
- Claude plugin metadata + skills

### Host-neutral app layer
- `src/app/contracts.ts`
- `src/app/run-config.ts`
- `src/app/spec-service.ts`
- `src/app/run-service.ts`
- `src/app/session-service.ts`
- `src/app/report-service.ts`
- `src/app/runtime-service.ts`
- `src/app/stop-service.ts`
- `src/app/setup-service.ts`

### Core engine
- `src/core/session.ts`
- `src/core/orchestrator.ts`
- `src/core/spec-parser.ts`
- `src/core/ambiguity-gate.ts`
- `src/core/rubric.ts`

### Execution / sharing
- `src/universe/*`
- `src/pollen/*`
- `src/reporter/*`

### Integration surfaces
- `src/mcp/server.ts`
- `src/cli/*`
- `.claude-plugin/`
- `skills/`
- `schemas/`

---

## Filesystem outputs

Session root:

```text
~/.supe/sessions/<session-id>/
  session.json
  spec.md
  parsed-spec.json
  problem-contract.json
  report.json
  universes/
```

Universe root:

```text
<universe>/
  PROMPT.md
  solution-spec.md
  verification-spec.md
  DONE.md
  DISCOVERY.md
  POLLEN_RESPONSE.md
  .supe/
```

---

## Verification status

Fresh internal verification completed:
- build ✅
- typecheck ✅
- git diff check ✅
- automated tests ✅
- npm pack dry-run ✅
- runtime smoke (`claude --version`, `codex --version`) ✅

External live validation still pending:
- real Claude plugin install path
- real Codex host path
- real LLM-backed session run

---

## Docs policy

`README.md` and `docs/` are now being updated from **implemented reality**.
If any doc conflicts with code, prefer code and `npm test` evidence.

## License

MIT
