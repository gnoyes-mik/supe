# Data Models

[한국어](./DATA_MODELS_KR.md)

This file summarizes the **current implemented model surface**.
For exact current types, see `src/types.ts`.

## Core concepts

### Session
A session contains:
- raw spec
- parsed spec
- universes
- config
- pollen history
- report
- timestamps and status

### ParsedSpec
Current parsed spec includes:
- `title`
- `problemStatement`
- `constraints`
- `desiredOutputs`
- `successCriteria`
- `domain`
- `additionalContext`
- `outOfScope`
- `assumptions`
- `problemContract`
- `universeConfigs`

### ProblemContract
A normalized contract shared by all universes:
- problem statement
- required outputs
- hard constraints
- success criteria
- out-of-scope items
- assumptions

### Universe
A universe contains:
- config (approach, runtime, optimization axis)
- workdir
- prompt path
- progress
- metrics
- logs
- pending pollens

Universe runtime assignment is materialized in `ParsedSpec.universeConfigs`. When `--agents` is provided, runtime assignment is expanded round-robin before session creation.

### Pollen
Pollen contains:
- abstract insight
- type (`pattern`, `data`, `strategy`, `warning`)
- source metadata
- deterministic evaluation metadata
- per-target relevance/evaluation state

### Report
Current report model is comparison-first.
It contains:
- `summary`
- `universeResults`
- `rankings`
- `pollenStats`
- `comparisonSummary`

It does **not** currently model a winner recommendation as the primary output.

## Public contract layer

Additional app-layer public types live in:
- `src/app/contracts.ts`

Important public structures:
- JSON envelope
- session artifact paths
- universe artifact paths
- host capabilities registry
- runtime adapter contracts

Configuration also models the analysis backend separately from per-universe runtime selection. The currently implemented local analysis backends are `claude-cli` and `codex-cli`.

## Persistence artifacts

Session root stores:
- `session.json`
- `spec.md`
- `parsed-spec.json`
- `problem-contract.json`
- `report.json`

Universe root stores:
- `PROMPT.md`
- `solution-spec.md`
- `verification-spec.md`
- `DONE.md`
- `.supe/universe.json`
- `.supe/logs.jsonl`

## Machine-readable schemas

Current schema files:
- `schemas/cli/session-envelope.schema.json`
- `schemas/cli/clarification-required.schema.json`
- `schemas/mcp/session-tools.schema.json`

## Source of truth

For exact fields and enums, use:
- `src/types.ts`
- `src/app/contracts.ts`
