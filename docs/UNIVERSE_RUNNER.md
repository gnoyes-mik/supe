# Historical Universe Runner Reference

[한국어](./UNIVERSE_RUNNER_KR.md)

> Historical reference only. For the current implemented runner behavior, prefer `src/universe/runner.ts`, `src/universe/prompt-builder.ts`, `src/universe/progress-detector.ts`, and the current architecture docs.

## Historical role of the universe runner

The universe runner was designed to own the lifecycle of a single universe.
Its purpose was to:
- prepare an isolated workspace
- initialize git state
- generate a prompt contract
- repeatedly invoke an agent runtime
- track progress toward success criteria
- stop on completion, failure, or external shutdown conditions

## Historical lifecycle

### 1. Setup phase
The historical setup phase included:
- creating a work directory
- initializing a git repository / branch
- generating `PROMPT.md`
- writing internal state files under `.supe/`
- making an initial prompt/setup commit

### 2. Execution loop
The historical loop was Ralph-inspired and assumed repeated iterations of:
- gathering current state
- building a fresh iteration prompt
- invoking the agent once
- observing changed files / commits / completion markers
- updating progress and metrics
- deciding whether to continue or stop

### 3. Completion / stop detection
The runner was expected to terminate when:
- the required deliverables existed
- criteria appeared satisfied
- the universe hit failure or stop limits
- the orchestrator requested shutdown

## Historical prompt structure

The prompt surface was meant to include:
- the shared problem to solve
- that universe's specific approach
- recommended tools / stack
- optimization axis
- constraints / desired outputs / success criteria
- working rules and completion signal expectations

This is why `templates/universe-prompt.md.hbs` and the prompt builder were central to the design.

## Historical progress model

The design coupled progress with:
- success criteria tracking
- file creation counts
- commit counts
- last activity timestamps
- estimated cost and restart count

That model still explains many fields that exist on the universe/session state today.

## What changed in the current implementation

The implemented system now also emphasizes:
- fixed problem contracts before divergence
- host-neutral orchestration boundaries
- local CLI-backed analysis
- explicit runtime assignment (`claude` / `codex`, including `--agents` round-robin)

## Why keep this document

This historical reference is still useful for understanding:
- why the runner has setup / loop / persistence responsibilities
- why prompt generation is separated from raw runtime invocation
- why success criteria and progress tracking are embedded in the universe model

## Current source of truth

Use these first:
- `src/universe/runner.ts`
- `src/universe/prompt-builder.ts`
- `src/universe/progress-detector.ts`
- `docs/ARCHITECTURE.md`
- `src/types.ts`
