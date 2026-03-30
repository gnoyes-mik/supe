# Historical Implementation Plan

[한국어](./IMPLEMENTATION_PLAN_KR.md)

> Historical reference only. For the current implemented behavior, prefer `src/`, `schemas/`, automated tests, and the current README / OVERVIEW / ARCHITECTURE / CLI_SPEC / DATA_MODELS docs.

## What this document used to be

This file originally captured a hackathon-style execution plan for building Supe in a fixed overnight sequence.
The Korean counterpart preserves that original detailed plan.

## Historical intent

The historical plan assumed:
- a tightly time-boxed build window
- phase-by-phase delivery from foundation to orchestration
- Slack and dashboard work landing in the same milestone
- overnight demo execution as a primary acceptance target

## Historical phases

### Phase 1 — Foundation
The original plan front-loaded:
- project initialization
- core type definitions
- utility setup
- CLI entrypoint scaffolding
- Handlebars prompt template setup

### Phase 2 — Core engine
The next step focused on:
- spec parsing
- session management
- universe runner lifecycle
- agent runner wiring
- orchestrator integration
- making `supe run` end-to-end viable

### Phase 3 — Pollen + Slack
The historical design expected the following to land together:
- pollen analyst
- pollen pollinator
- pollen tracker
- orchestrator pollen cycle
- Slack bot bootstrap
- Slack message formatting and event handling

### Phase 4 — Reporter + Dashboard + Polish
The original milestone then expected:
- a reporter layer
- a live dashboard
- remaining CLI commands
- quick integration testing and bug fixing

### Phase 5/6 — Overnight demo and morning review
The plan concluded with:
- running real demo scenarios before sleep
- reviewing reports and Slack history the next morning
- preparing a short presentation around the resulting universes

## Why it is historical now

The implemented product has diverged from this exact sequence:
- docs are now updated from implemented reality, not plan-first design
- the output contract is spec-first (`solution-spec.md`, `verification-spec.md`)
- host-neutral app/API/MCP boundaries are more important than the original hackathon ordering
- local CLI-backed analysis became a first-class requirement later

## What is still useful here

This historical plan is still useful for understanding:
- the original delivery pressure and sequencing assumptions
- why some modules were grouped together conceptually
- how Slack/dashboard/reporter features were expected to relate in the first design pass

## Recommended source of truth now

Use these first:
1. `README.md` / `README_KR.md`
2. `docs/OVERVIEW.md` / `docs/OVERVIEW_KR.md`
3. `docs/ARCHITECTURE.md` / `docs/ARCHITECTURE_KR.md`
4. `docs/CLI_SPEC.md` / `docs/CLI_SPEC_KR.md`
5. `docs/DATA_MODELS.md` / `docs/DATA_MODELS_KR.md`
6. `src/` and automated tests
