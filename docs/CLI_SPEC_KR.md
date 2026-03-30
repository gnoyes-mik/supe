# CLI 명세

[English](./CLI_SPEC.md)

이 문서는 초기 설계 초안이 아니라 **현재 구현된 CLI**를 설명합니다.

## 진입점

```bash
supe <command>
```

## 명령

### `supe run`
새 세션을 시작합니다.

주요 옵션:
- `--spec <path>` (필수, stdin은 `-`)
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
- `--resume <session-id>`

동작:
- raw spec를 파싱한다
- 설정된 analysis backend를 사용한다 (local CLI 우선: `claude-cli` / `codex-cli`)
- contract-level ambiguity에 ambiguity gate를 적용한다
- non-interactive 모드에서는 clarification-required JSON을 반환할 수 있다
- multiverse stability를 점검한다
- session + universes를 생성한다
- `--agents`가 있으면 `--agent`보다 우선하며 선언 순서대로 round-robin 배정한다
- 지원되지 않는 `--agents` 값은 실행 전에 거부한다
- runtime layer를 통해 universes를 실행한다

### `supe status [session-id]`
세션 상태를 보여줍니다.

지원:
- `--json`

### `supe report [session-id]`
비교 리포트를 보여줍니다.

지원:
- `--json`

### `supe list`
세션 목록을 보여줍니다.

지원:
- `--json`

### `supe stop [session-id]`
실행 중 세션을 중지합니다.

지원:
- `--json`

### `supe resume <session-id>`
중지된 세션을 재개합니다.

지원:
- `--json`
- `--non-interactive`
- `--yes`

### `supe setup`
runtime / integration 사전조건을 준비합니다.

지원:
- `--json`

### `supe doctor`
runtime / plugin / MCP 준비 상태와 선택된 analysis backend를 진단합니다.

지원:
- `--json`
- `--live`

### `supe contracts`
현재 host-neutral contract snapshot을 출력합니다.

지원:
- `--json`

### `supe mcp serve`
stdio MCP server를 실행합니다.

## JSON 계약

### Envelope
JSON 지원 command는 모두 다음 형태를 사용합니다:

```json
{
  "contractVersion": "2026-03-30",
  "ok": true,
  "data": {}
}
```

또는

```json
{
  "contractVersion": "2026-03-30",
  "ok": false,
  "error": {
    "code": "not_found",
    "message": "...",
    "details": {}
  }
}
```

### Exit codes
- `0` success
- `1` failure / runtime failure / precondition failure
- `2` clarification required
- `3` confirmation required
- `4` not found
- `5` invalid request

## 비대화형 동작

`run --non-interactive`는 prompt를 띄우지 않습니다.
계약 정보가 부족하면 clarification-required error를 반환합니다.

Clarification 응답 재제출 방법:
- `--clarification-json <json>`
- `--clarification-file <path>`

## 현재 빌드된 바이너리의 command set

```text
run, status, report, list, stop, resume, init, setup, doctor, contracts, mcp
```

## Notes
- `dashboard.tsx`는 아직 placeholder이며 현재 제품 surface가 아니다
- 명시적으로 API 기반 구성을 고정하지 않았다면 `setup`은 `claude-cli`, 그다음 `codex-cli`를 analysis용으로 우선 선택한다
- 현재 authoritative behavior는 `src/cli/*`와 테스트 증거로 확인한다
