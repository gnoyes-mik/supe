# Architecture

[한국어](./ARCHITECTURE_KR.md)

This document describes the **current implemented architecture** on `main`.

## Top-level shape

```text
User / Host
  -> Supe CLI / MCP / plugin surfaces
    -> app-layer services
      -> core session + orchestrator
        -> conversation runtime layer
          -> Codex app-server provider
          -> Claude stream-json provider
        -> universe workdirs + artifacts
        -> report / pollen / status surfaces
```

## Layer 1 — Host surfaces

### CLI
Key files:
- `src/index.ts`
- `src/cli/commands/*`
- `src/cli/output.ts`
- `src/cli/dashboard.tsx`

Responsibilities:
- parse user-facing commands/options
- choose JSON vs plain-text vs Ink presentation
- inject replies on resume when a universe is waiting

### MCP
Key files:
- `src/mcp/server.ts`
- `.mcp.json`

Responsibilities:
- stdio MCP transport
- tool routing to app/runtime services
- machine-readable session/report/resume surfaces

### Plugin surface
Key files:
- `.claude-plugin/plugin.json`
- `skills/*`

Responsibilities:
- host entry/discovery only
- not the owner of runtime orchestration logic

## Layer 2 — App services

Key files:
- `src/app/run-service.ts`
- `src/app/runtime-service.ts`
- `src/app/runtime-control-service.ts`
- `src/app/session-service.ts`
- `src/app/report-service.ts`
- `src/app/stop-service.ts`
- `src/app/contracts.ts`
- `src/app/run-config.ts`

Responsibilities:
- prepare and launch sessions
- manage presenter selection and dashboard rendering
- queue reply injections for waiting universes
- expose host-neutral JSON/MCP contracts
- stop/cancel/report/session retrieval services

## Layer 3 — Core session/orchestration

Key files:
- `src/core/session.ts`
- `src/core/orchestrator.ts`

Responsibilities:
- persist top-level session state
- construct/manage universe runners
- drive pollen cycles and session timeout boundaries

## Layer 4 — Conversation runtime layer

Key files:
- `src/runtime/contracts.ts`
- `src/runtime/conversation-manager.ts`
- `src/runtime/session-registry.ts`
- `src/runtime/event-log.ts`
- `src/runtime/progress-mapper.ts`
- `src/runtime/presenter-model.ts`
- `src/runtime/providers/*`

Responsibilities:
- define canonical runtime contracts and events
- normalize provider-specific behavior into runtime events
- persist per-universe runtime session metadata
- append runtime event logs under universe workdirs
- derive presenter state from canonical runtime/session data
- own provider-neutral reply / interrupt / cancel transitions

## Layer 5 — Provider adapters

### Codex
- `src/runtime/providers/codex-app-server.ts`
- transport: `codex app-server`
- thread lifecycle: `thread/start`, `thread/resume`, `thread/read`
- turn lifecycle: `turn/start`, `turn/interrupt`

### Claude
- `src/runtime/providers/claude-stream-json.ts`
- transport: `claude --print --input-format stream-json --output-format stream-json`
- session lifecycle via `--session-id`
- stdout stream parsing into canonical runtime events

## Universe runner

Key file:
- `src/universe/runner.ts`

Current role:
- prepare isolated workspace + prompt contract
- create the correct provider adapter
- drive the `ConversationManager`
- send iterative turns or queued user replies
- stop on completion / failure / waiting-for-user / external stop

## Runtime persistence

Per universe, Supe now persists:
- provider + transport
- external session/thread id
- runtime state
- current step
- last activity
- pending question
- pending reply
- transcript tail
- append-only runtime event log

## Presentation

### Interactive TTY
- Ink dashboard is the default presenter
- launch banner + pulse appear immediately
- presenter shows rows + focused detail pane

### JSON / non-TTY
- dashboard is bypassed
- structured output remains the contract surface
