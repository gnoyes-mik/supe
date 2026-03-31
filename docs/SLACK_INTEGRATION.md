# Historical Slack Integration Reference

[한국어](./SLACK_INTEGRATION_KR.md)

> Historical/reference document. Slack still exists in the repository, but it is not the primary verified host surface of the current milestone.

## Current implementation context

Supe currently prioritizes:
- CLI
- MCP
- conversation runtime execution
- Ink dashboard visibility

Slack support remains in the codebase, but the main verified interaction path is no longer Slack-first.

## Why this document still exists

It explains why `src/slack/*` exists and what the original intent was:
- session-level notifications
- per-universe progress threads
- pollen/entanglement visibility
- final report delivery into chat surfaces

## Current source of truth

If you are specifically working on Slack, prefer:
- `src/slack/*`
- `src/app/runtime-service.ts`
- `src/core/orchestrator.ts`
- `src/types.ts`

For general product behavior, prefer CLI/MCP/docs over this file.
