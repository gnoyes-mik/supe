# Historical Slack Integration Reference

[한국어](./SLACK_INTEGRATION_KR.md)

> Historical reference only. For the current implemented product surface, prefer CLI/MCP/plugin docs first. Slack remains part of the codebase, but it is not the primary verified host surface in this milestone.

## Historical role of Slack

Slack was originally envisioned as:
- a primary user interface for long-running sessions
- a real-time event log for universe activity
- the place where cross-universe entanglement events and the morning report would be consumed

## Historical Slack model

### Main session message
The initial design expected one main message per session to:
- summarize the session goal
- link to universe threads
- receive major entanglement / pollen-cycle replies
- receive the final morning report reply

### Per-universe threads
Each universe was expected to get its own thread for:
- iteration progress updates
- commit notifications
- pollen receipt notifications
- pollen adoption/rejection updates

### Message taxonomy
The historical design separated message types such as:
- session start
- universe thread start
- throttled progress updates
- commit-detected updates
- entanglement events on the main thread
- pollen receipt and adoption responses
- final report publication

## Historical implementation assumptions

The design assumed:
- a Slack app with the right OAuth scopes
- bot/app tokens in environment/config
- deterministic thread mapping from session and universe IDs
- handler-driven event posting from session/orchestrator events

## What changed in the implemented milestone

The current milestone prioritized:
- CLI
- MCP
- plugin/package surface
- local CLI-backed analysis/runtime behavior

So Slack remains present in the repository, but it is not the main verified integration path yet.

## Why keep this document

This historical note still helps explain:
- why Slack modules exist in `src/slack/*`
- how the system originally expected to expose long-running session observability
- how session-level and universe-level events were intended to map into a chat UI

## Current source of truth

Use these first:
- `README.md`
- `docs/OVERVIEW.md`
- `docs/ARCHITECTURE.md`
- `src/slack/*` (if you are specifically working on Slack)
- automated tests for the currently verified host surfaces
