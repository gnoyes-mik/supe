# 아키텍처

[English](./ARCHITECTURE.md)

이 문서는 `main` 기준 **현재 구현된 아키텍처**를 설명합니다.

## 최상위 구조

```text
User / Host
  -> Supe CLI / MCP / plugin surfaces
    -> app-layer services
      -> core session + orchestrator
        -> conversation runtime layer
          -> Codex app-server provider
          -> Claude stream-json provider
        -> universe workdirs + artifacts
        -> report / pollen / status surfaces
```

## Layer 1 — Host surface

### CLI
주요 파일:
- `src/index.ts`
- `src/cli/commands/*`
- `src/cli/output.ts`
- `src/cli/dashboard.tsx`

책임:
- 사용자 명령/옵션 파싱
- JSON / plain-text / Ink presenter 선택
- waiting universe에 대한 reply를 resume 시 주입

### MCP
주요 파일:
- `src/mcp/server.ts`
- `.mcp.json`

책임:
- stdio MCP transport
- tool routing
- machine-readable session/report/resume surface 제공

### Plugin surface
주요 파일:
- `.claude-plugin/plugin.json`
- `skills/*`

책임:
- host 진입/탐색 surface
- runtime orchestration logic의 주 소유자는 아님

## Layer 2 — App service

주요 파일:
- `src/app/run-service.ts`
- `src/app/runtime-service.ts`
- `src/app/runtime-control-service.ts`
- `src/app/session-service.ts`
- `src/app/report-service.ts`
- `src/app/stop-service.ts`
- `src/app/contracts.ts`
- `src/app/run-config.ts`

책임:
- session 준비 및 실행
- presenter 선택과 dashboard rendering
- waiting universe용 reply queue 처리
- host-neutral JSON/MCP contract 제공
- stop/cancel/report/session retrieval service 제공

## Layer 3 — Core session/orchestration

주요 파일:
- `src/core/session.ts`
- `src/core/orchestrator.ts`

책임:
- 상위 session 상태 영속화
- universe runner 생성/관리
- pollen cycle 및 session timeout 경계 관리

## Layer 4 — Conversation runtime layer

주요 파일:
- `src/runtime/contracts.ts`
- `src/runtime/conversation-manager.ts`
- `src/runtime/session-registry.ts`
- `src/runtime/event-log.ts`
- `src/runtime/progress-mapper.ts`
- `src/runtime/presenter-model.ts`
- `src/runtime/providers/*`

책임:
- canonical runtime contract / event 정의
- provider별 동작을 canonical runtime event로 정규화
- universe별 runtime session metadata 영속화
- universe workdir 하위에 runtime event log append
- canonical runtime/session 데이터에서 presenter state 도출
- provider-neutral reply / interrupt / cancel 전이 관리

## Layer 5 — Provider adapter

### Codex
- `src/runtime/providers/codex-app-server.ts`
- transport: `codex app-server`
- thread lifecycle: `thread/start`, `thread/resume`, `thread/read`
- turn lifecycle: `turn/start`, `turn/interrupt`

### Claude
- `src/runtime/providers/claude-stream-json.ts`
- transport: `claude --print --input-format stream-json --output-format stream-json`
- `--session-id` 기반 session lifecycle
- stdout stream을 canonical runtime event로 변환

## Universe runner

주요 파일:
- `src/universe/runner.ts`

현재 역할:
- 분리된 workspace + prompt contract 준비
- 올바른 provider adapter 생성
- `ConversationManager` 구동
- iterative turn 또는 queued user reply 전송
- completion / failure / waiting-for-user / external stop에서 종료

## Runtime persistence

Universe별로 다음을 영속화합니다:
- provider + transport
- external session/thread id
- runtime state
- current step
- last activity
- pending question
- pending reply
- transcript tail
- append-only runtime event log

## Presentation

### Interactive TTY
- Ink dashboard가 기본 presenter
- launch banner + pulse가 즉시 표시됨
- row + focused detail pane 표시

### JSON / non-TTY
- dashboard 비활성화
- structured output이 계약 surface로 유지됨
