# 아키텍처

[English](./ARCHITECTURE.md)

이 문서는 **현재 구현된 아키텍처**를 설명하며, 초기 설계 의도를 그대로 보존한 문서가 아닙니다.

## 최상위 구조

```text
User / Host
  -> Supe CLI / MCP / Plugin surface
    -> host-neutral app layer
      -> core multiverse engine
        -> analysis backend (`claude-cli` / `codex-cli` / legacy `anthropic-api`)
        -> Claude Code / Codex universe runtimes
          -> universe workdirs + artifacts
```

## Layer 1 — Host surfaces

### CLI
파일:
- `src/index.ts`
- `src/cli/commands/*`
- `src/cli/output.ts`

책임:
- command / option 파싱
- JSON 또는 사람이 읽는 출력 생성
- app layer로 위임

### MCP
파일:
- `src/mcp/server.ts`
- `.mcp.json`

책임:
- stdio MCP transport
- tool routing
- structuredContent 응답
- app layer를 통한 session lifecycle 접근

### Plugin surface
파일:
- `.claude-plugin/plugin.json`
- `skills/*`

책임:
- host discovery / 진입점 역할
- orchestration logic의 주 소유자가 되지 않음

## Layer 2 — Host-neutral app layer

파일:
- `src/app/contracts.ts`
- `src/app/contracts-service.ts`
- `src/app/run-config.ts`
- `src/app/spec-service.ts`
- `src/app/run-service.ts`
- `src/app/session-service.ts`
- `src/app/report-service.ts`
- `src/app/runtime-service.ts`
- `src/app/stop-service.ts`
- `src/app/setup-service.ts`
- `src/app/preflight-service.ts`
- `src/app/errors.ts`

책임:
- 공개 계약 정의
- spec 준비 및 ambiguity 처리
- session lifecycle service
- report 생성 service
- runtime 실행 orchestration
- setup / doctor 진단
- 정규화된 service error

## Layer 3 — Core engine

파일:
- `src/core/session.ts`
- `src/core/orchestrator.ts`
- `src/core/spec-parser.ts`
- `src/core/ambiguity-gate.ts`
- `src/core/rubric.ts`
- `src/core/stability.ts`

책임:
- 영속 session model
- universe orchestration
- ambiguity 평가
- problem contract 고정
- deterministic sharing rubric
- stability 경고 / 제한

## Layer 4 — Execution / reporting

### Universes
파일:
- `src/universe/runner.ts`
- `src/universe/prompt-builder.ts`
- `src/universe/progress-detector.ts`

### Cross-Pollination
파일:
- `src/pollen/analyst.ts`
- `src/pollen/pollinator.ts`
- `src/pollen/tracker.ts`

### Reporting
파일:
- `src/reporter/metrics.ts`
- `src/reporter/comparator.ts`
- `src/reporter/formatter.ts`

## Runtime boundary

파일:
- `src/agents/base.ts`
- `src/agents/claude.ts`
- `src/agents/codex.ts`
- `src/utils/llm.ts`

책임:
- universe 실행을 실제 runtime command로 매핑
- analysis 호출을 선택된 backend (`claude-cli`, `codex-cli`, legacy API)로 매핑
- runtime-specific 가정을 상위 orchestration layer로 새지 않게 유지

## 영속성 모델

Session 루트:
- `session.json`
- `spec.md`
- `parsed-spec.json`
- `problem-contract.json`
- `report.json`

Universe 루트:
- `PROMPT.md`
- `solution-spec.md`
- `verification-spec.md`
- `DONE.md`
- `.supe/universe.json`
- `.supe/logs.jsonl`

## 현재 contract 상태

현재 public contract version:
- `2026-03-30`

관련 machine-readable asset:
- `schemas/cli/session-envelope.schema.json`
- `schemas/cli/clarification-required.schema.json`
- `schemas/mcp/session-tools.schema.json`

## 알려진 한계

- MCP `start_session`은 현재 synchronous하다
- MCP server는 minimal / handcrafted 상태다
- 장시간 local CLI 세션에서 최종 산출물이 안정적으로 떨어지는지 추가 live validation이 필요하다
- 긴 preparation 단계에 대한 stop / timeout 보강이 더 필요하다
- 실제 Claude plugin install path는 아직 외부 live validation이 필요하다
