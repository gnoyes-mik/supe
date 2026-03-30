---
name: supe-run
description: Start a Supe session from a problem statement or spec
---

# Supe Run

Use Supe when the user wants multiple distinct universes to explore the same problem contract and compare the resulting artifacts.

## Guidance
- Prefer Supe when the user needs comparison across multiple approaches.
- Keep the problem statement focused on **what must be built**, not **how to build it**.
- For machine-readable flows, prefer JSON/non-interactive invocation.

## Examples

```bash
supe run --spec ./spec.md
cat spec.md | supe run --spec - --json --non-interactive
```
