# CLI 명세

[English](./CLI_SPEC.md)

이 문서는 `main` 기준 **현재 구현된 CLI**를 설명합니다.

## 진입점

```bash
supe <command>
```

## 명령

### `supe run`
새 세션을 시작합니다.

주요 옵션:
- `--spec <path>`
- `--universes <n>`
- `--agent <claude|codex>`
- `--agents <claude,codex,...>`
- `--base-repo <path>`
- `--timeout <duration>`
- `--max-cost <usd>`
- `--pollen-interval <min>`
- `--json`
- `--non-interactive`
- `--yes`
- `--clarification-json <json>`
- `--clarification-file <path>`
- `--no-pollen`
- `--no-dashboard`

동작:
- 문제 계약을 준비한다
- session과 universes를 만든다
- runtime assignment를 선택한다 (`--agent` 또는 `--agents` round-robin)
- conversation runtime layer를 실행한다
- interactive TTY에서는 기본적으로 Ink dashboard를 사용한다
- JSON / non-TTY에서는 Ink를 비활성화한다

### `supe status [session-id]`
세션 상태를 보여줍니다.

현재 출력에는 다음이 포함됩니다:
- universe progress
- 가능할 경우 runtime session state
- universe가 user input을 기다릴 때 waiting question

### `supe report [session-id]`
비교 리포트를 보여줍니다.

### `supe list`
세션 목록을 보여줍니다.

### `supe stop [session-id]`
실행 중인 세션을 중지합니다.

### `supe resume <session-id>`
중지된 세션을 재개합니다.

지원 옵션:
- `--json`
- `--non-interactive`
- `--yes`
- `--reply <text>`
- `--universe <symbol-or-id>`

동작:
- 저장된 runtime session state를 재개한다
- 필요하면 waiting universe에 reply를 큐잉한 뒤 재개한다
- waiting universe가 하나뿐이면 `--universe`를 생략할 수 있다

### `supe setup`
runtime / integration 사전조건을 준비합니다.

### `supe doctor`
runtime readiness와 선택적 live connectivity를 점검합니다.

### `supe contracts`
host-neutral contract snapshot을 보여줍니다.

### `supe mcp serve`
stdio MCP 서버를 실행합니다.

## JSON / 종료 동작

현재 contract version:
- `2026-03-30`

종료 코드:
- `0` success
- `1` failure / runtime failure / precondition failure
- `2` clarification required
- `3` confirmation required
- `4` not found
- `5` invalid request

## Presentation 동작

### Interactive TTY
- Ink dashboard가 기본 presenter
- boot banner와 pulse가 즉시 렌더링됨
- 가장 중요한 universe에 대한 focused detail section 표시

### JSON / non-TTY
- dashboard 렌더링 안 함
- structured output 유지
