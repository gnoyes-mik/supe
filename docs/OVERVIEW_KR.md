# 개요

[English](./OVERVIEW.md)

Supe는 **병합된 Phase 0-6 conversation runtime baseline**을 포함한 비교 중심 멀티 유니버스 오케스트레이션 엔진입니다.

## 현재 구현 형태

- Supe가 주 진입점이다
- 각 universe는 분리된 worktree/workspace에서 다른 접근을 시도한다
- runtime 실행은 이제 순수 one-shot이 아니라 conversational baseline을 가진다
- Codex는 **app-server**를 통해 실행된다
- Claude는 **stream-json**을 통해 실행된다
- `ConversationManager`가 provider-neutral runtime/session 제어를 담당한다
- Ink가 기본 TTY dashboard surface다
- JSON / non-TTY 경로는 Ink를 우회한다

## 핵심 흐름

1. raw problem statement 파싱
2. 빠진 contract-level 정보만 clarification
3. 공유 problem contract 고정
4. 다양한 universe 생성
5. `claude`, `codex`, 또는 혼합 assignment로 실행
6. pollen을 통해 재사용 가능한 insight 공유
7. 결과 artifact를 비교하고 report 생성

## Control-plane 기능

현재 runtime/control 기능:
- universe별 runtime session metadata 영속화
- append-only runtime event log
- provider-neutral waiting state (`waiting_for_user`)
- queued reply injection 기반 resume (`supe resume ... --reply ...`)
- timeout / interrupt / cancel 상태 전파
- 가장 중요한 universe를 보여주는 focused dashboard detail

## 현재 host surface

### CLI
구현됨:
- run / status / report / list / stop / resume
- setup / doctor / contracts
- JSON + non-interactive 동작

### MCP
구현됨:
- stdio MCP server
- session lifecycle tool
- contract + doctor surface

### Claude plugin
얇은 host surface로 구현됨:
- `.claude-plugin/plugin.json`
- `skills/`
- `.mcp.json`

## 산출물

### Universe outputs
- `solution-spec.md`
- `verification-spec.md`
- `DONE.md`

### Session outputs
- `session.json`
- `parsed-spec.json`
- `problem-contract.json`
- `report.json`

## 현재 한계

실환경에서 수동 확인이 특히 의미 있는 부분:
- 장시간 interactive provider session
- 실제 provider 대상 resume-with-reply 흐름
- provider stall/restart 시 operational behavior
