# Supe (Superposition) — Project Context for AI Agents

## What is Supe?

Supe is a **multiverse orchestration engine** that takes a problem definition (spec.md) and:
1. Automatically designs N different approaches using LLM analysis
2. Runs each approach in an isolated Universe with its own agent (Ralph Loop)
3. Cross-pollinates insights between Universes periodically
4. Produces a Morning Report comparing all results

**One-liner**: "Define the problem, explore all solutions simultaneously."

## Tech Stack

- **Language**: TypeScript (ESM, strict mode)
- **Runtime**: Node.js 22+
- **CLI Framework**: commander.js
- **Terminal UI**: ink (React for CLI)
- **Slack Bot**: @slack/bolt (Socket Mode)
- **Git**: simple-git
- **LLM**: @anthropic-ai/sdk (for Pollen analysis, Spec parsing, Report comparison)
- **Templates**: Handlebars (universe-prompt.md.hbs)
- **IDs**: nanoid
- **Config**: dotenv + JSON

## Project Structure

```
supe/
├── docs/                          # Design documents (READ THESE FIRST)
│   ├── OVERVIEW.md                # Vision, use cases, worldbuilding
│   ├── ARCHITECTURE.md            # System architecture, sequences, config
│   ├── DATA_MODELS.md             # All TypeScript interfaces (copy to src/types.ts)
│   ├── POLLEN_ENGINE.md           # Cross-Pollination 3-layer system
│   ├── UNIVERSE_RUNNER.md         # Ralph-style execution loop
│   ├── SLACK_INTEGRATION.md       # Slack bot, Block Kit messages
│   ├── CLI_SPEC.md                # CLI commands, stability system, dashboard
│   └── IMPLEMENTATION_PLAN.md     # 5-phase build plan with dependency graph
│
├── src/
│   ├── index.ts                   # CLI entrypoint (commander.js)
│   ├── types.ts                   # All interfaces from DATA_MODELS.md
│   ├── cli/
│   │   ├── commands/
│   │   │   ├── run.ts             # `supe run` command
│   │   │   ├── status.ts          # `supe status` command
│   │   │   ├── report.ts          # `supe report` command
│   │   │   ├── list.ts            # `supe list` command
│   │   │   ├── stop.ts            # `supe stop` command
│   │   │   └── init.ts            # `supe init` command
│   │   └── dashboard.tsx          # ink-based live terminal dashboard
│   ├── core/
│   │   ├── session.ts             # Session lifecycle (EventEmitter-based)
│   │   ├── orchestrator.ts        # N Universe parallel management + Pollen scheduling
│   │   ├── spec-parser.ts         # spec.md → ParsedSpec + UniverseConfig[] (2 LLM calls)
│   │   └── stability.ts           # Multiverse Stability system (humor warnings)
│   ├── universe/
│   │   ├── runner.ts              # Single Universe Ralph Loop execution
│   │   ├── prompt-builder.ts      # Handlebars template → PROMPT.md
│   │   └── progress-detector.ts   # Git-based progress estimation
│   ├── pollen/
│   │   ├── analyst.ts             # Layer 1: git diff → LLM → Pollen extraction
│   │   ├── pollinator.ts          # Layer 2: relevance check → PROMPT.md injection
│   │   └── tracker.ts             # Layer 3: adoption tracking (applied/adapted/rejected)
│   ├── slack/
│   │   ├── app.ts                 # Slack Bolt app initialization (Socket Mode)
│   │   ├── messages.ts            # 8 Block Kit message formatters
│   │   └── handlers.ts            # Session EventEmitter → Slack message routing
│   ├── agents/
│   │   ├── base.ts                # AgentRunner interface
│   │   ├── claude.ts              # Claude Code process args
│   │   └── codex.ts               # OpenAI Codex process args
│   ├── reporter/
│   │   ├── metrics.ts             # Per-universe metric collection (cloc, git stats)
│   │   ├── comparator.ts          # Cross-universe comparison + LLM summary
│   │   └── formatter.ts           # Slack Block Kit + Terminal text formatting
│   └── utils/
│       ├── git.ts                 # simple-git wrapper
│       ├── logger.ts              # Structured logging (console + JSONL file)
│       ├── config.ts              # ~/.supe/config.json loader
│       └── llm.ts                 # Anthropic SDK wrapper with retry
│
├── templates/
│   └── universe-prompt.md.hbs     # Universe PROMPT.md template
│
├── specs/                         # Demo spec files for hackathon
│   ├── demo-dev.md                # Dev scenario: real-time task app
│   └── demo-strategy.md           # Non-dev scenario: market entry strategy
│
├── package.json
├── tsconfig.json
└── .env.example
```

## How to Read the Design Docs

**READ ORDER** (follow this exactly):

1. **DATA_MODELS.md** FIRST — Copy all interfaces to `src/types.ts`. Every other file references these types.
2. **ARCHITECTURE.md** — Understand the component diagram, event bus pattern, and 3 sequence diagrams.
3. **UNIVERSE_RUNNER.md** — The Ralph Loop execution engine. Core of the system.
4. **POLLEN_ENGINE.md** — The differentiator. 3-layer system with exact LLM prompts.
5. **SLACK_INTEGRATION.md** — Thread mapping, Block Kit messages, event handlers.
6. **CLI_SPEC.md** — Commands, Stability system, ink dashboard components.
7. **IMPLEMENTATION_PLAN.md** — Build order with dependency graph. Follow Phase 1→5 exactly.

## Implementation Rules

### MUST DO
- Follow `IMPLEMENTATION_PLAN.md` phases in order — each phase has explicit dependencies
- Use interfaces from `DATA_MODELS.md` exactly as defined (copy verbatim to `src/types.ts`)
- Use LLM prompts from `POLLEN_ENGINE.md` exactly as written
- Use EventEmitter pattern for all inter-component communication (see ARCHITECTURE.md)
- Use `nanoid` for all ID generation (Session: `ses_{nanoid(12)}`, Universe: `univ_{nanoid(8)}`)
- Persist state as JSON files in `~/.supe/sessions/{id}/`
- Make Slack and Pollen independently disableable (`--no-slack`, `--no-pollen`)
- Each Universe gets its own workdir with its own git repo
- Agent processes are spawned via `child_process.spawn`
- Commit frequently during implementation

### MUST NOT DO
- Do NOT deviate from the interfaces in DATA_MODELS.md
- Do NOT use a database — JSON file persistence only
- Do NOT build a web UI — CLI + Slack only
- Do NOT suppress TypeScript errors with `as any` or `@ts-ignore`
- Do NOT merge Universe results automatically — user chooses (Wavefunction Collapse)
- Do NOT hard-code API keys — use environment variables via dotenv

### Key Design Decisions Already Made
- **Event Bus**: Session extends EventEmitter. All components emit/listen via session events.
- **Pollen Cycle Order**: Analyst (discover) → Tracker (check previous) → Pollinator (inject new)
- **Agent Args**: Claude uses `--print` mode + `--dangerously-skip-permissions`
- **Progress Estimation**: Commit count × 3% heuristic, capped at 95%. DONE.md = 100%.
- **Cost Estimation**: Iteration count × $0.80 (rough estimate since agents don't report costs)
- **Pollen Cap**: Max 2 pollens per universe per cycle. Max 5 accumulated in PROMPT.md.
- **Universe Symbols**: Greek letters α, β, γ, δ, ε, ζ, η, θ, ι, κ (max 10)
- **Stability System**: 2-3 = STABLE, 4-5 = MINOR_FLUCTUATION, 6-7 = UNSTABLE, 8-9 = CRITICAL, 10 = COLLAPSE_IMMINENT, 11+ = REJECTED

## Worldbuilding / Theme

Supe has a quantum mechanics / multiverse theme. All UI text uses this vocabulary:
- Session states: Opening Rift → Multiverse Active → Wavefunction Collapsed
- Universe states: Dimension Forming → Active → Stabilized → Collapsed → Frozen
- Pollen events: Dimensional Scan → Entanglement Detected → Signal Transmitted → Synchronized/Decoherence
- Ambient flavor messages appear in dashboard/Slack for atmosphere (see OVERVIEW.md)
- Boot animation with ASCII art (normal + dramatic 10-universe version)

## Verification Checkpoints

After each phase, verify:

### Phase 1 (Foundation)
```bash
npx tsx src/index.ts --help  # Should show all commands
```

### Phase 2 (Core Engine)
```bash
supe run --spec test-spec.md --no-slack --no-pollen --no-dashboard
# N universes should run in parallel, create files, and stop on DONE.md
```

### Phase 3 (Pollen + Slack)
```bash
supe run --spec test-spec.md --no-dashboard
# Slack threads created, Pollen cycles run every 30min, Entanglement events posted
```

### Phase 4 (Dashboard + Polish)
```bash
supe run --spec test-spec.md
# Full experience: live dashboard + Slack + Pollen + Morning Report
```

## Quick Reference: File → Design Doc Mapping

| Source File | Design Doc |
|-------------|-----------|
| `src/types.ts` | `DATA_MODELS.md` (copy all interfaces) |
| `src/core/session.ts` | `ARCHITECTURE.md` § Session Manager |
| `src/core/orchestrator.ts` | `ARCHITECTURE.md` § Orchestrator |
| `src/core/spec-parser.ts` | `ARCHITECTURE.md` § Spec Parser |
| `src/core/stability.ts` | `CLI_SPEC.md` § Multiverse Stability System |
| `src/universe/runner.ts` | `UNIVERSE_RUNNER.md` (entire file) |
| `src/universe/prompt-builder.ts` | `UNIVERSE_RUNNER.md` § Prompt Builder |
| `src/pollen/analyst.ts` | `POLLEN_ENGINE.md` § Layer 1 |
| `src/pollen/pollinator.ts` | `POLLEN_ENGINE.md` § Layer 2 |
| `src/pollen/tracker.ts` | `POLLEN_ENGINE.md` § Layer 3 |
| `src/slack/app.ts` | `SLACK_INTEGRATION.md` § Slack App |
| `src/slack/messages.ts` | `SLACK_INTEGRATION.md` § Messages 1-8 |
| `src/slack/handlers.ts` | `SLACK_INTEGRATION.md` § handlers.ts |
| `src/cli/dashboard.tsx` | `CLI_SPEC.md` § Live Dashboard |
| `src/cli/commands/*.ts` | `CLI_SPEC.md` § Commands |
| `src/reporter/*.ts` | `ARCHITECTURE.md` § Reporter |
| `src/utils/*.ts` | `IMPLEMENTATION_PLAN.md` § Step 1.3 |
| `src/index.ts` | `CLI_SPEC.md` § CLI Entry Point |
| `templates/*.hbs` | `UNIVERSE_RUNNER.md` § Prompt Builder |
