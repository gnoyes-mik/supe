# Historical Pollen Engine Reference

[한국어](./POLLEN_ENGINE_KR.md)

> Historical reference only. For the current implemented pollen behavior, prefer `src/pollen/*`, `src/core/rubric.ts`, `src/core/ambiguity-gate.ts`, automated tests, and the current architecture docs.

## Historical role of the pollen engine

Pollen was designed as the differentiator between Supe and ordinary parallel execution.
The core idea was:
- universes evolve independently
- only reusable discoveries are abstracted out
- those discoveries are injected into other universes as hints, warnings, or strategies
- target universes remain autonomous in whether they adopt them

## Historical 3-layer model

### 1. Discovery (Analyst)
The analyst layer was responsible for:
- reading recent universe output, especially `DISCOVERY.md`
- falling back to code/doc diffs when direct discovery notes were missing
- extracting portable insights rather than copying implementation
- classifying insights into types such as `pattern`, `strategy`, `data`, and `warning`

### 2. Pollination (Pollinator)
The pollinator layer was responsible for:
- evaluating whether a discovery was relevant to another universe
- injecting cross-pollination hints into the target prompt surface
- respecting timing gates and anti-spam limits
- preserving universe diversity instead of forcing convergence

### 3. Evolution tracking (Tracker)
The tracker layer was responsible for:
- observing whether a target universe adopted, adapted, or rejected a pollen item
- reading explicit response artifacts such as `POLLEN_RESPONSE.md`
- distinguishing between ignored hints and actively rejected ones

## Key historical ideas that still matter

### Runtime-neutral sharing
The durable idea is that sharing should happen through:
- patterns
- strategies
- warnings
- reusable constraints

and not through raw code copying.
This remains important for mixed-runtime sessions.

### Discovery-first abstraction
The historical design emphasized that universes should surface their own discoveries explicitly when possible.
That is why `DISCOVERY.md` was treated as a preferred source over raw repository diffs.

### Warning as first-class signal
Warnings were always meant to represent broadly relevant risk:
- contract violations
- anti-patterns
- dangerous assumptions
- performance/security/quality traps

rather than mere stylistic disagreement.

## What changed in the implemented system

The current implementation has moved away from a purely LLM-opinionated model and now emphasizes:
- explicit problem contracts
- deterministic rubric inputs
- runtime-neutral sharing across Claude/Codex universes
- app/core boundaries that make pollen part of a larger orchestration contract

## Why keep this document

This historical reference is still helpful for understanding:
- why the pollen modules are split into analyst / pollinator / tracker
- why universes exchange abstracted insights instead of patches
- why diversity preservation is part of the sharing contract

## Current source of truth

Use these first:
- `src/pollen/analyst.ts`
- `src/pollen/pollinator.ts`
- `src/pollen/tracker.ts`
- `src/core/rubric.ts`
- `docs/ARCHITECTURE.md`
- automated tests
