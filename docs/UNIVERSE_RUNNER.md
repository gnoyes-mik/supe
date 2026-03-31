# Universe Runner Reference

[한국어](./UNIVERSE_RUNNER_KR.md)

This document summarizes the **current implemented runner behavior**.

## Current role

`src/universe/runner.ts` no longer acts as only a one-shot subprocess loop.
It now serves as a **conversation-session supervisor** for a single universe.

Its responsibilities are:
- prepare the isolated universe workspace
- initialize git/workdir state
- generate `PROMPT.md`
- choose the correct conversation provider (`claude` or `codex`)
- create and drive the `ConversationManager`
- send iterative turns and queued user replies
- update progress/metrics/state
- stop on completion, failure, waiting-for-user, or orchestrator shutdown

## Lifecycle

### 1. Setup
- initialize repo/workdir
- create `.supe/` state area
- generate and commit `PROMPT.md`

### 2. Runtime start
- mark the universe running
- emit `universe:started`
- create the provider adapter
- start or resume the provider-backed conversation session

### 3. Conversation loop
For each cycle, the runner:
- builds iteration context
- sends either a normal next-turn prompt or a queued user reply
- waits for provider-backed completion or error
- updates universe progress and runtime session state
- stops if the universe reaches `waiting_for_user`

### 4. Completion
The runner ends when:
- required deliverables exist
- the universe hits stop/failure limits
- the orchestrator requests stop

## Current source of truth

Use these first:
- `src/universe/runner.ts`
- `src/runtime/conversation-manager.ts`
- `src/runtime/providers/*`
- `src/universe/prompt-builder.ts`
- `src/types.ts`
