# Supe (Superposition)

> 하나의 문제 계약을 고정한 뒤, Codex와 Claude 기반 여러 유니버스가 탐색하고, 그 결과를 명확하게 비교합니다.

[English README](./README.md)

Supe는 **비교 중심(comparison-first) 멀티 유니버스 오케스트레이션 엔진**입니다. 문제 정의를 입력받아 공통 계약을 고정하고, 서로 다른 접근의 유니버스를 만들고, 재사용 가능한 인사이트를 교환하게 한 뒤, 유니버스별 산출물과 비교 리포트를 반환합니다.

## 현재 제품 형태

현재 `main` 브랜치에는 **Phase 0-6 conversation runtime baseline**이 반영되어 있습니다.

- contract-first runtime model
- 인터랙티브 TTY용 Ink 대시보드
- **Codex app-server** 기반 conversational runtime
- **Claude stream-json** 기반 conversational runtime
- Supe가 소유하는 provider-neutral control plane
- runtime session metadata / event log 영속화
- mixed-provider universe sessions
- waiting universe에 대한 reply/resume 흐름

### 런타임 모델
- **Supe** = orchestration + control plane
- **Codex / Claude Code** = 내부 provider runtime
- **ConversationManager** = provider-neutral runtime/session owner
- **유니버스 산출물** = `solution-spec.md`, `verification-spec.md`, `DONE.md`
- **세션 산출물** = `session.json`, `parsed-spec.json`, `problem-contract.json`, `report.json`

## Supe가 하는 일

1. 자유 형식 문제 정의를 파싱
2. 빠진 **contract-level** 정보만 clarification
3. 서로 다른 최적화 축을 가진 universe 생성
4. `claude`, `codex`, 또는 혼합 round-robin으로 실행
5. Cross-Pollination으로 재사용 가능한 발견 공유
6. universe별 runtime session 상태와 event history 영속화
7. universe 산출물과 comparison-first report 반환

## 설치

### 요구사항
- Node.js 22+
- `PATH` 상의 Claude Code CLI 및/또는 Codex CLI

### 설정

```bash
git clone https://github.com/gnoyes-mik/supe.git
cd supe
npm install
npm run build
```

### 환경 점검

```bash
supe setup
supe doctor
supe doctor --json
```

## CLI 표면

```bash
supe run [options]
supe status [session-id] [--json]
supe report [session-id] [--json]
supe list [--json]
supe stop [session-id] [--json]
supe resume <session-id> [--json] [--reply <text>] [--universe <symbol-or-id>]
supe contracts [--json]
supe setup [--json]
supe doctor [--json] [--live]
supe mcp serve
```

### `run` 주요 옵션

```bash
--spec <path>
--universes <n>
--agent <claude|codex>
--agents <claude,codex,...>
--base-repo <path>
--timeout <duration>
--max-cost <usd>
--pollen-interval <min>
--json
--non-interactive
--yes
--clarification-json <json>
--clarification-file <path>
--no-pollen
--no-dashboard
```

### resume + reply

유니버스가 `waiting_for_user` 상태가 되면, Supe를 통해 답변을 큐에 넣고 다시 실행할 수 있습니다.

```bash
supe resume ses_abc123 --reply "REST API를 사용해" --universe α
```

대기 중인 universe가 하나뿐이면 `--universe`는 생략 가능합니다.

### 예시

```bash
supe run --spec ./spec.md
cat spec.md | supe run --spec - --json --non-interactive
supe run --spec ./spec.md --universes 5 --agents claude,codex
supe resume ses_abc123 --reply "PostgreSQL로 가자" --universe beta
supe contracts --json
```

## Runtime / Presentation 동작

### 인터랙티브 TTY
- Ink dashboard가 기본 presenter
- launch banner + boot pulse가 즉시 표시됨
- dashboard는 provider, state, step, criteria progress, focused detail을 표시

### JSON / non-TTY
- Ink 출력은 비활성화됨
- machine-readable JSON 동작은 유지됨

### 지원 provider
- **Codex**: app-server transport
- **Claude**: `--print --input-format stream-json --output-format stream-json`

## MCP 연동

Supe는 stdio MCP 서버를 포함합니다:

```bash
supe mcp serve
```

현재 MCP tools:
- `supe.get_contracts`
- `supe.doctor`
- `supe.start_session`
- `supe.get_session`
- `supe.list_sessions`
- `supe.get_report`
- `supe.resume_session`
- `supe.stop_session`

`supe.resume_session`은 reply-driven resume 인자도 지원합니다.

## 문서 안내

- [`docs/OVERVIEW_KR.md`](./docs/OVERVIEW_KR.md)
- [`docs/ARCHITECTURE_KR.md`](./docs/ARCHITECTURE_KR.md)
- [`docs/CLI_SPEC_KR.md`](./docs/CLI_SPEC_KR.md)
- [`docs/DATA_MODELS_KR.md`](./docs/DATA_MODELS_KR.md)
- [`docs/UNIVERSE_RUNNER_KR.md`](./docs/UNIVERSE_RUNNER_KR.md)

`docs/` 아래 historical/reference 문서도 남아 있지만, 이제는 현재 병합된 소스와 모순되지 않도록 정리되어 있습니다.

## 현재 한계

실환경에서는 여전히 수동 smoke test가 의미 있습니다:
- 실제 provider 세션에 대한 장시간 interactive run
- 실제 Claude plugin 설치/사용 흐름
- provider stall/restart가 긴 경우의 operational behavior

## Source of Truth

문서가 충돌하면 우선순위는 다음과 같습니다:
1. `src/`
2. `test/`
3. `schemas/`
4. 현재 문서
