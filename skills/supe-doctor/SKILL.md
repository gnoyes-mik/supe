---
name: supe-doctor
description: Diagnose Supe runtime, plugin, and MCP readiness
---

# Supe Doctor

Use this skill to verify whether Supe is ready to be called from Claude plugin, MCP clients, or Codex-driven flows.

## Typical flow
```bash
supe doctor
supe doctor --json
```

## Checks
- config presence
- dist build presence
- Claude/Codex runtime detection
- plugin + MCP + skills surface visibility
