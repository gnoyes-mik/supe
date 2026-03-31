# Data Models

[한국어](./DATA_MODELS_KR.md)

This file summarizes the current model surface. For exact types, see `src/types.ts`.

## Session

A session contains:
- raw + parsed spec
- universe list
- session config
- pollen history
- report
- timestamps and status

Notable current behavior:
- session status still tracks the top-level lifecycle (`initializing`, `running`, `completed`, `failed`, `cancelled`)
- provider-specific runtime detail is stored per universe, not on the session root

## SessionConfig

Current session config includes:
- universe count + default agent
- base repo path
- dashboard enabled flag
- duration / cost / pollen settings
- Slack enablement/config

## Universe

A universe contains:
- config (approach, symbol, runtime, optimization axis)
- workdir / prompt path / git branch
- progress + metrics + logs
- pending pollens
- `runtimeSession`

## RuntimeSessionRecord

Per-universe runtime metadata includes:
- `provider`
- `transport`
- `externalSessionId`
- `state`
- `currentStep`
- `lastActivityAt`
- `lastSequence`
- `pendingQuestion`
- `pendingReply`
- `transcriptTail`

This is the main persistence surface for the conversation runtime baseline.

## ParsedSpec and ProblemContract

`ParsedSpec` includes:
- title
- problem statement
- constraints
- desired outputs
- success criteria
- domain
- additional context
- out-of-scope
- assumptions
- normalized `problemContract`
- `universeConfigs`

`ProblemContract` is the shared contract frozen before universes diverge.

## Pollen

Pollen models reusable discoveries, not code patches.
Current types include:
- `pattern`
- `data`
- `strategy`
- `warning`

Targets track relevance and adoption/rejection state.

## Runtime events

Canonical runtime events live in `src/runtime/contracts.ts`.
They include:
- session start
- assistant deltas/messages
- tool start/finish
- file/commit updates
- progress hints
- needs-user-input
- heartbeat
- completion/failure

## Report

The report remains comparison-first.
It summarizes:
- overall session outcome
- per-universe results
- ranking/comparison data
- pollen statistics
