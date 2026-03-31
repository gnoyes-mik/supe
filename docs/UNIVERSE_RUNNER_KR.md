# Universe Runner Reference

[English](./UNIVERSE_RUNNER.md)

이 문서는 **현재 구현된 runner 동작**을 요약합니다.

## 현재 역할

`src/universe/runner.ts`는 더 이상 단순 one-shot subprocess loop만 담당하지 않습니다.
현재는 단일 universe의 **conversation-session supervisor** 역할을 합니다.

주요 책임:
- 분리된 universe workspace 준비
- git/workdir 상태 초기화
- `PROMPT.md` 생성
- 적절한 conversation provider 선택 (`claude` 또는 `codex`)
- `ConversationManager` 생성 및 구동
- iterative turn과 queued user reply 전송
- progress/metrics/state 업데이트
- completion / failure / waiting-for-user / orchestrator shutdown에서 종료

## Lifecycle

### 1. Setup
- repo/workdir 초기화
- `.supe/` 상태 영역 생성
- `PROMPT.md` 생성 및 커밋

### 2. Runtime start
- universe를 running으로 표시
- `universe:started` emit
- provider adapter 생성
- provider-backed conversation session 시작 또는 resume

### 3. Conversation loop
각 cycle에서 runner는:
- iteration context 구성
- 일반 next-turn prompt 또는 queued user reply 전송
- provider 기반 completion 또는 error 대기
- universe progress와 runtime session state 업데이트
- `waiting_for_user` 상태가 되면 중단

### 4. Completion
다음 중 하나에서 종료합니다:
- required deliverable 존재
- universe가 stop/failure limit 도달
- orchestrator가 stop 요청

## 현재 source of truth

우선 순위:
- `src/universe/runner.ts`
- `src/runtime/conversation-manager.ts`
- `src/runtime/providers/*`
- `src/universe/prompt-builder.ts`
- `src/types.ts`
