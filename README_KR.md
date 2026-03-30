# Supe (Superposition)

> 문제를 한 번 정의하면, 여러 유니버스가 각자 탐색하고, 결과 차이를 선명하게 비교합니다.

[English README](./README.md)

Supe는 **비교 중심(comparison-first) 멀티 유니버스 오케스트레이션 엔진**입니다.  
하나의 문제 정의를 입력받아 공통 문제 계약을 고정하고, 서로 다른 접근법을 가진 여러 유니버스를 열고, 재사용 가능한 인사이트를 교환하게 한 뒤, 유니버스별 산출물과 비교 리포트를 반환합니다.

## 현재 제품 형태

Supe가 사용자의 **주 진입점**입니다.  
사용자는 **Supe를 먼저 실행**하고, Supe는 내부적으로 **Claude Code** 또는 **Codex**를 런타임 워커로 사용합니다.

### 핵심 모델
- **Supe** = 오케스트레이션 엔진
- **Claude Code / Codex** = 내부 런타임
- **유니버스 산출물** = `solution-spec.md`, `verification-spec.md`, `DONE.md`
- **세션 산출물** = 비교 중심 Morning Report

### 현재 상태
내부 구현 및 검증 완료:
- host-neutral app/service layer
- JSON + 비대화형 CLI 계약
- 최소 MCP 서버
- 최소 Claude plugin 표면
- `setup` / `doctor` / `contracts` 명령
- npm/plugin 배포 표면

아직 외부 검증이 필요한 항목:
- 실제 Claude plugin 설치 smoke test
- 실제 Codex host usage smoke test
- 실제 credential 기반 `start_session` full run

---

## Supe가 하는 일

1. 자유 형식의 문제 정의를 파싱
2. **무엇을 만들어야 하는지**에 대한 모호성을 감지
3. 계약 수준 정보가 부족할 때만 clarification 요청
4. 서로 다른 최적화 축을 가진 유니버스 생성
5. Claude Code 또는 Codex로 각 유니버스 실행
6. Cross-Pollination으로 재사용 가능한 발견 공유
7. 유니버스별 spec 산출물과 비교 리포트 생성

### 산출물 형태
각 유니버스는 기본적으로 다음 파일을 만듭니다:
- `solution-spec.md`
- `verification-spec.md`
- `DONE.md`

각 세션은 다음 파일을 남깁니다:
- `session.json`
- `parsed-spec.json`
- `problem-contract.json`
- `report.json`

---

## 설치

### 요구사항
- Node.js 22+
- 런타임 실행용 Claude Code CLI 또는 Codex CLI
- LLM 기반 spec/pollen/report 흐름을 위한 Anthropic API 키

### 의존성 설치

```bash
git clone https://github.com/gnoyes-mik/supe.git
cd supe
npm install
npm run build
```

### 초기화 / 환경 점검

```bash
supe setup
supe doctor
supe doctor --json
```

---

## CLI 표면

```bash
supe run [options]
supe status [session-id] [--json]
supe report [session-id] [--json]
supe list [--json]
supe stop [session-id] [--json]
supe resume <session-id> [--json]
supe contracts [--json]
supe setup [--json]
supe doctor [--json] [--live]
supe mcp serve
```

### `run` 주요 옵션

```bash
--spec <path>              필수, stdin은 - 사용
--universes <n>            2..10
--agent <claude|codex>     기본 런타임 타입
--base-repo <path>         각 유니버스를 기존 저장소로 시드
--timeout <duration>       예: 10h, 30m
--max-cost <usd>
--pollen-interval <min>
--json
--non-interactive
--yes
--clarification-json <json>
--clarification-file <path>
--no-pollen
--no-dashboard
--resume <session-id>
```

### 예시

#### 인터랙티브 실행

```bash
supe run --spec ./spec.md
```

#### 비대화형 stdin 실행

```bash
cat spec.md | supe run --spec - --json --non-interactive
```

#### 세션 재개

```bash
supe resume ses_abc123 --json
```

#### 계약 정보 확인

```bash
supe contracts --json
```

---

## JSON / 비대화형 동작

Supe는 버전이 고정된 machine-readable contract를 제공합니다.

### 현재 contract version
- `2026-03-30`

### 종료 코드
- `0` 성공
- `1` 실패 / precondition failure / runtime failure
- `2` clarification 필요
- `3` confirmation 필요
- `4` not found
- `5` invalid request

### Clarification 동작
Supe는 **해결 방식**이 아니라 **문제 계약**에 대해서만 질문합니다.

예:
- required outputs
- success criteria
- hard constraints
- out-of-scope items

`--non-interactive` 또는 `--json` 사용 시, 질문 대신 structured clarification error를 반환합니다.

---

## MCP 연동

Supe는 최소 stdio MCP 서버를 포함합니다:

```bash
supe mcp serve
```

### 현재 MCP tools
- `supe.get_contracts`
- `supe.doctor`
- `supe.start_session`
- `supe.get_session`
- `supe.list_sessions`
- `supe.get_report`
- `supe.resume_session`
- `supe.stop_session`

### MCP 설정
저장소 루트에 다음 파일이 있습니다:
- `.mcp.json`

현재 설정은 plugin-root 실행을 기준으로 합니다:
- `${CLAUDE_PLUGIN_ROOT}/dist/index.js mcp serve`

---

## Claude plugin 표면

저장소 루트에 다음이 있습니다:
- `.claude-plugin/plugin.json`
- `skills/`

현재 skills:
- `supe-run`
- `supe-status`
- `supe-report`
- `supe-resume`
- `supe-stop`
- `supe-setup`
- `supe-doctor`
- `supe-contracts`

이들은 모두 Supe 엔진 위에 얇게 얹힌 진입 표면입니다.

---

## 런타임 모델

혼합 런타임 유니버스는 구조적으로 지원됩니다.  
예를 들어 한 세션 안에서:
- Universe α → Claude Code
- Universe β → Codex
- Universe γ → Claude Code

Cross-Pollination은 raw code 복사가 아니라 **patterns / strategies / warnings** 공유 방식으로 동작합니다.

---

## 아키텍처 요약

### Host surfaces
- CLI
- MCP
- Claude plugin metadata + skills

### Host-neutral app layer
- `src/app/contracts.ts`
- `src/app/run-config.ts`
- `src/app/spec-service.ts`
- `src/app/run-service.ts`
- `src/app/session-service.ts`
- `src/app/report-service.ts`
- `src/app/runtime-service.ts`
- `src/app/stop-service.ts`
- `src/app/setup-service.ts`

### Core engine
- `src/core/session.ts`
- `src/core/orchestrator.ts`
- `src/core/spec-parser.ts`
- `src/core/ambiguity-gate.ts`
- `src/core/rubric.ts`

### 실행 / 공유
- `src/universe/*`
- `src/pollen/*`
- `src/reporter/*`

### Integration surfaces
- `src/mcp/server.ts`
- `src/cli/*`
- `.claude-plugin/`
- `skills/`
- `schemas/`

---

## 파일시스템 산출물

세션 루트:

```text
~/.supe/sessions/<session-id>/
  session.json
  spec.md
  parsed-spec.json
  problem-contract.json
  report.json
  universes/
```

유니버스 루트:

```text
<universe>/
  PROMPT.md
  solution-spec.md
  verification-spec.md
  DONE.md
  DISCOVERY.md
  POLLEN_RESPONSE.md
  .supe/
```

---

## 검증 상태

내부 검증 완료:
- build ✅
- typecheck ✅
- git diff check ✅
- automated tests ✅
- npm pack dry-run ✅
- runtime smoke (`claude --version`, `codex --version`) ✅

외부 live validation은 아직 남아 있습니다:
- 실제 Claude plugin install path
- 실제 Codex host path
- 실제 LLM-backed session run

---

## 문서 정책

`README.md`와 `docs/`는 이제 **구현된 현실 기준**으로 갱신됩니다.  
문서와 코드가 충돌하면, 코드와 `npm test` 증거를 우선하세요.

## 라이선스

MIT
