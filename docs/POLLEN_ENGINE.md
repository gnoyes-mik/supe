# Historical Pollen Engine Reference

[한국어](./POLLEN_ENGINE_KR.md)

> Historical/reference document. For exact current behavior, prefer `src/pollen/*`, `src/core/orchestrator.ts`, `src/types.ts`, and automated tests.

## Current implementation context

Pollen is still the cross-universe insight-sharing mechanism, but it now lives inside a broader conversation-runtime system.

What matters in the current implementation:
- pollen is shared as **abstracted insights**, not code patches
- universes remain autonomous in whether they adopt or reject a pollen item
- pollen state is persisted as part of session/universe orchestration state
- mixed-provider universes (`claude` / `codex`) still share pollen through the same neutral model

## Why this document is historical

This file is kept mainly to explain the original conceptual split:
- **Analyst** — discover reusable insights
- **Pollinator** — choose relevant targets and inject hints
- **Tracker** — record adoption, adaptation, or rejection

That conceptual split still explains the module layout in `src/pollen/*`, even though the surrounding runtime architecture has evolved.

## Current source of truth

Use these first:
- `src/pollen/analyst.ts`
- `src/pollen/pollinator.ts`
- `src/pollen/tracker.ts`
- `src/core/orchestrator.ts`
- `src/types.ts`
- automated tests
