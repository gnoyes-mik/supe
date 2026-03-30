# NOTE

This document is a historical design reference. For the current implemented behavior, prefer `src/`, `schemas/`, automated tests, and the updated README/OVERVIEW/ARCHITECTURE/CLI_SPEC/DATA_MODELS docs.

---

# Implementation Plan

> 해커톤 타임라인(19시간, 수면 포함)에 맞춘 구현 순서. 의존관계를 고려하여 **반드시 이 순서대로** 구현한다.

---

## 전체 타임라인 (해커톤 당일)

```
16:00  체크인
16:30  Phase 1 시작 — Foundation
18:30  Phase 1 완료
18:30  Phase 2 시작 — Core Engine
21:00  Phase 2 완료
21:00  Phase 3 시작 — Pollen Engine + Slack
23:00  Phase 3 완료
23:00  Phase 4 시작 — Dashboard + Polish
00:30  Phase 4 완료
00:30  🌙 Supe 실행 → 잠자기
       (밤새 N개 Universe가 자율 실행 + Cross-Pollination)
07:00  기상 → 결과 확인
07:30  Phase 5 — 데모 준비
09:00  발표
11:00  체크아웃
```

---

## Phase 1: Foundation (16:30 ~ 18:30, 2시간)

프로젝트 스캐폴딩과 핵심 타입/유틸리티.

### Step 1.1: 프로젝트 초기화 (20분)

```bash
mkdir -p supe/src/{cli/commands,core,universe,pollen,slack,reporter,agents,utils}
mkdir -p supe/templates
cd supe
npm init -y
```

**package.json 핵심 의존성:**
```json
{
  "type": "module",
  "dependencies": {
    "@slack/bolt": "^4.1.0",
    "commander": "^12.0.0",
    "ink": "^5.1.0",
    "react": "^18.3.0",
    "handlebars": "^4.7.8",
    "simple-git": "^3.27.0",
    "nanoid": "^5.0.0",
    "dotenv": "^16.4.0",
    "@anthropic-ai/sdk": "^0.39.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "tsx": "^4.19.0",
    "@types/node": "^22.0.0",
    "@types/react": "^18.3.0"
  },
  "bin": {
    "supe": "./dist/index.js"
  },
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "jsx": "react-jsx",
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["src/**/*"]
}
```

**의존성 설치:**
```bash
npm install
```

**산출물:** 프로젝트 구조 + 의존성 설치 완료

### Step 1.2: 타입 정의 (20분)

`src/types.ts` — DATA_MODELS.md의 모든 인터페이스를 그대로 옮긴다.

**산출물:** `src/types.ts` (모든 인터페이스, enum, 이벤트 타입)

### Step 1.3: 유틸리티 (30분)

| 파일 | 내용 |
|------|------|
| `src/utils/config.ts` | `~/.supe/config.json` 로드, 환경변수 치환, 기본값 적용 |
| `src/utils/logger.ts` | 구조화된 로그 (콘솔 + JSONL 파일). LogEntry 인터페이스 사용 |
| `src/utils/git.ts` | simple-git 래퍼: init, commit 수집, diff 취득, ls-files |
| `src/utils/llm.ts` | Anthropic SDK 래퍼: 프롬프트 전송 → JSON 파싱 응답 반환. 에러 시 재시도 (최대 2회) |

**산출물:** 4개 유틸리티 파일

### Step 1.4: CLI 엔트리포인트 (20분)

`src/index.ts` — CLI_SPEC.md의 커맨드 정의를 그대로 구현. 각 커맨드의 action은 placeholder (import만 해두고 구현은 나중).

**검증:** `npx tsx src/index.ts --help`가 정상 출력되는지 확인.

**산출물:** `src/index.ts`

### Step 1.5: Handlebars 템플릿 (10분)

`templates/universe-prompt.md.hbs` — UNIVERSE_RUNNER.md에 정의된 템플릿.

**산출물:** `templates/universe-prompt.md.hbs`

---

## Phase 2: Core Engine (18:30 ~ 21:00, 2.5시간)

Spec Parser → Session Manager → Universe Runner → Orchestrator 순으로 구현. 이 Phase 완료 후 **Pollen 없이 N개 Universe 병렬 실행**이 가능해야 한다.

### Step 2.1: Spec Parser (40분)

`src/core/spec-parser.ts`

구현:
1. `parseSpec(specPath: string): Promise<ParsedSpec>`
   - 파일 읽기
   - LLM 호출 1: 자유 형식 → 구조화 (ParsedSpec에서 universeConfigs 제외한 필드)
   - LLM 호출 2: 구조화된 스펙 → N개 UniverseConfig 생성
   - 두 LLM 호출의 프롬프트는 ARCHITECTURE.md의 "Spec Parser" 섹션에 서술된 전략을 따름

2. 프롬프트 설계 핵심:
   - Spec 파싱 프롬프트: JSON 출력 스키마를 명시적으로 제공. ParsedSpec 인터페이스의 필드를 JSON schema로 변환하여 포함.
   - Universe 분기 생성 프롬프트: "각 Universe가 서로 다른 축을 최적화하도록 설계하라. 같은 축을 최적화하는 Universe는 만들지 마라. 사용자가 Approaches 섹션을 제공했다면 그것을 존중하되, 없으면 자유롭게 설계하라."

**검증:** 테스트 spec.md를 만들고 파싱 결과가 올바른 구조인지 확인.

**산출물:** `src/core/spec-parser.ts`

### Step 2.2: Session Manager (30분)

`src/core/session.ts`

구현:
1. `createSession(specPath, config): Promise<Session>`
   - nanoid로 session ID 생성
   - Spec Parser 호출
   - 디렉토리 구조 생성 (`~/.supe/sessions/{id}/`)
   - session.json 초기 저장

2. `loadSession(sessionId): Promise<Session>`
   - session.json 로드
   - EventEmitter 재초기화

3. `saveSession(session): Promise<void>`
   - session.json 저장 (30초 간격 auto-save를 위한 타이머도 관리)

4. `getLatestSession(): Promise<Session | null>`
   - `~/.supe/sessions/` 디렉토리 스캔, 가장 최근 세션 반환

5. Session은 EventEmitter를 상속 (Node.js events). DATA_MODELS.md의 SessionEvents 타입으로 이벤트 정의.

**산출물:** `src/core/session.ts`

### Step 2.3: Universe Runner (50분)

`src/universe/runner.ts` + `src/universe/prompt-builder.ts`

구현 — UNIVERSE_RUNNER.md 전체를 따른다:
1. `setup()` — workdir, git init, PROMPT.md 생성
2. `start()` — Ralph-style 실행 루프
3. `runAgentIteration()` — 에이전트 프로세스 spawn + 완료 대기
4. `updateProgress()` — git log/ls-files 기반 진행상황 업데이트
5. `isComplete()` — DONE.md 감지
6. `shouldStop()` — 비용 한도, 재시작 초과, 외부 중단
7. `collectMetrics()` — 완료 후 메트릭 수집

`src/universe/prompt-builder.ts`:
1. Handlebars 템플릿 로드 + 변수 바인딩 + PROMPT.md 문자열 반환

**검증:** 단일 Universe를 수동으로 setup → start하여 에이전트가 실행되고, DONE.md 생성 시 종료되는지 확인.

**산출물:** `src/universe/runner.ts`, `src/universe/prompt-builder.ts`

### Step 2.4: Agent Runners (20분)

`src/agents/base.ts` + `src/agents/claude.ts` + `src/agents/codex.ts`

구현:
1. `base.ts`: AgentRunner 인터페이스 정의 (command, args 빌드 로직)
2. `claude.ts`: Claude Code 실행 인자 구성
3. `codex.ts`: OpenAI Codex 실행 인자 구성

**산출물:** 3개 에이전트 파일

### Step 2.5: Orchestrator (30분)

`src/core/orchestrator.ts`

구현:
1. `start(session): Promise<void>`
   - N개 Universe Runner를 Promise.all로 동시 시작
   - 각 Runner의 이벤트를 Session 이벤트 버스로 전파
   - 모든 Universe 완료 감지 → Reporter 트리거 → 'session:all-complete' 이벤트

2. Pollen Cycle 타이머는 Phase 3에서 추가 (이 시점에서는 Pollen 없이 동작)

3. 타임아웃 타이머: `setTimeout` → 만료 시 모든 Universe에 stop 시그널

**검증:** `supe run --spec test.md --no-slack --no-pollen`이 N개 Universe를 병렬 실행하는지 확인.

**산출물:** `src/core/orchestrator.ts`

### Step 2.6: `supe run` 커맨드 완성 (20분)

`src/cli/commands/run.ts`

구현:
1. CLI 옵션 파싱 → SessionConfig 생성
2. Session Manager로 세션 생성
3. Orchestrator 시작
4. (대시보드는 Phase 4에서 추가)

**Phase 2 완료 체크포인트:**
```bash
supe run --spec test-spec.md --no-slack --no-pollen --no-dashboard
# → N개 Universe가 병렬로 실행되어야 함
# → 각 Universe의 workdir에 에이전트가 파일을 생성하고 커밋해야 함
# → DONE.md 생성 시 해당 Universe가 종료되어야 함
# → 모든 Universe 완료 시 세션이 종료되어야 함
```

---

## Phase 3: Pollen Engine + Slack (21:00 ~ 23:00, 2시간)

### Step 3.1: Pollen Analyst (30분)

`src/pollen/analyst.ts`

POLLEN_ENGINE.md의 Layer 1을 구현한다.
- `analyzeUniverse()`: git diff → LLM 분석 → Pollen[] 반환
- LLM 프롬프트는 POLLEN_ENGINE.md에 정의된 것을 그대로 사용

**산출물:** `src/pollen/analyst.ts`

### Step 3.2: Pollen Pollinator (30분)

`src/pollen/pollinator.ts`

POLLEN_ENGINE.md의 Layer 2를 구현한다.
- `pollinate()`: 관련성 판단 → PROMPT.md 주입
- 주입 빈도 제한, 최대 5개 누적 제한
- Cross-Pollination Hints 섹션 관리

**산출물:** `src/pollen/pollinator.ts`

### Step 3.3: Pollen Tracker (20분)

`src/pollen/tracker.ts`

POLLEN_ENGINE.md의 Layer 3를 구현한다.
- `trackAdoption()`: diff 분석 → 적용/변형/미반영 판단
- 2 Cycle 연속 미반영 → rejected 처리

**산출물:** `src/pollen/tracker.ts`

### Step 3.4: Orchestrator에 Pollen Cycle 통합 (10분)

`src/core/orchestrator.ts` 수정:
- `setInterval`로 Pollen Cycle 스케줄링
- Analyst → Tracker → Pollinator 순서로 호출
- 이벤트 발행

### Step 3.5: Slack Bot 초기화 (15분)

`src/slack/app.ts`

Bolt 앱 초기화. Socket Mode 연결.

### Step 3.6: Slack 메시지 포맷터 (20분)

`src/slack/messages.ts`

SLACK_INTEGRATION.md에 정의된 모든 메시지 함수를 구현:
- `sessionStartMessage()`
- `universeThreadMessage()`
- `universeProgressUpdate()`
- `commitDetectedMessage()`
- `entanglementMessage()`
- `pollenReceivedMessage()`
- `pollenAdoptionMessage()`
- `morningReportMessage()`

### Step 3.7: Slack 이벤트 핸들러 (15분)

`src/slack/handlers.ts`

Session EventEmitter → Slack 메시지 매핑. SLACK_INTEGRATION.md의 `registerSlackHandlers` 구현.

**Phase 3 완료 체크포인트:**
```bash
supe run --spec test-spec.md --no-dashboard
# → N개 Universe가 병렬 실행
# → Slack 채널에 메인 메시지 + N개 스레드가 생성
# → 30분마다 Pollen Cycle이 실행
# → Entanglement 이벤트가 메인 스레드에 reply로 포스팅
# → 각 Universe 스레드에 커밋 감지 + Pollen 수신 알림이 포스팅
```

---

## Phase 4: Dashboard + Reporter + Polish (23:00 ~ 00:30, 1.5시간)

### Step 4.1: Reporter (30분)

`src/reporter/metrics.ts` + `src/reporter/comparator.ts` + `src/reporter/formatter.ts`

- `metrics.ts`: 각 Universe의 메트릭 수집 (cloc, git stats, etc.)
- `comparator.ts`: 메트릭 비교 + LLM으로 종합 평가
- `formatter.ts`: Slack Block Kit + Terminal 텍스트 포맷

### Step 4.2: Live Dashboard (40분)

`src/cli/dashboard.tsx`

CLI_SPEC.md의 ink 컴포넌트 구현:
- HeaderBar, MainView, UniverseCard, ProgressBar
- UniverseDetailView, PollensView
- 키보드 입력 핸들링 (q, r, p, s, 1-5, ESC)
- Session EventEmitter 구독하여 실시간 갱신

### Step 4.3: 나머지 CLI 커맨드 (10분)

- `src/cli/commands/status.ts`: session.json 로드 → 상태 출력
- `src/cli/commands/report.ts`: report.json 로드 → 포맷팅 출력
- `src/cli/commands/list.ts`: sessions 디렉토리 스캔 → 목록 출력
- `src/cli/commands/stop.ts`: session.json의 status 변경 → Orchestrator stop 시그널

### Step 4.4: 통합 테스트 + 버그 수정 (10분)

전체 흐름 테스트:
```bash
supe run --spec test-spec.md --universes 2 --pollen-interval 5
# → 빠른 Pollen 주기로 2개 Universe 테스트
# → Slack + Dashboard 동시 동작 확인
# → 5분 후 수동 stop으로 Report 확인
```

---

## Phase 5: 잠자기 전 실행 (00:30)

### 실행할 데모 시나리오

밤새 돌릴 **실제 데모 spec** 2가지를 준비한다:

#### 데모 1: 개발 시나리오 (코드 생성)
```markdown
# Real-time Task Management App

## Problem
Build a simple but functional real-time collaborative task management web application.

## Constraints
- Must be a single deployable artifact (no microservices)
- Must include real-time sync between users
- Must work offline with sync-on-reconnect
- Use only open-source dependencies

## Desired Outputs
- Working web application with backend and frontend
- README with setup and run instructions
- At least 5 basic tests

## Success Criteria
- Users can create, edit, delete, and complete tasks
- Changes sync in real-time across browser tabs
- App builds and runs with a single command
```

#### 데모 2: 비개발 시나리오 (전략 문서)
```markdown
# AI 스타트업 한국 시장 진출 전략

## Problem
미국 기반 AI SaaS 스타트업이 한국 시장에 진출하려고 한다.
B2B 엔터프라이즈 고객을 타겟으로 한다.

## Constraints
- 초기 투자 예산 $500K 이하
- 한국 현지 팀 없이 시작
- 6개월 내 첫 유료 고객 확보 목표

## Desired Outputs
- 시장 분석 리포트
- GTM (Go-to-Market) 전략 문서
- 예상 P&L (12개월)
- 리스크 분석 및 대응 방안

## Success Criteria
- 각 산출물이 최소 5페이지 이상의 상세한 문서
- 한국 시장 특수성(문화, 규제, 경쟁)이 반영되어야 함
- 실행 가능한 구체적 액션 아이템 포함
```

### 실행 명령

```bash
# 터미널 1: 개발 시나리오
supe run --spec demo-dev.md --universes 3 --agents claude,codex,claude --pollen-interval 30

# 터미널 2: 비개발 시나리오 (별도 Slack 채널)
supe run --spec demo-strategy.md --universes 3 --channel C_STRATEGY --pollen-interval 30
```

### 잠자기 전 체크리스트

- [ ] 두 세션 모두 정상 시작 확인 (Slack 스레드 생성됨)
- [ ] 에이전트가 첫 커밋을 생성했는지 확인
- [ ] 비용 한도가 적절히 설정되었는지 확인 ($30/세션)
- [ ] 타임아웃이 8시간으로 설정되었는지 확인
- [ ] Slack 알림을 켜놓고 잠 (에러 발생 시 확인용)

---

## Phase 6: 기상 후 (07:00 ~ 09:00)

### 7:00 — 결과 확인

```bash
# 세션 상태 확인
supe status

# Morning Report 확인
supe report

# Slack에서 전체 히스토리 확인
# → 메인 채널: Entanglement 이벤트 타임라인
# → 각 스레드: Universe별 작업 로그
```

### 7:30 — 데모 준비

1. **개발 시나리오 결과물 확인**
   - 각 Universe의 앱을 실제로 빌드/실행해본다
   - 가장 잘 된 Universe를 데모 대상으로 선정
   - 비교 리포트에서 인상적인 수치 메모

2. **비개발 시나리오 결과물 확인**
   - 각 Universe의 전략 문서를 훑어본다
   - Cross-Pollination으로 전파된 인사이트 중 인상적인 것 메모

3. **데모 스크립트 준비**
   - Slack 히스토리에서 가장 인상적인 Entanglement 이벤트 캡처
   - Morning Report 스크린샷 준비
   - 발표 흐름 정리

### 발표 구조 (10분)

| 시간 | 내용 | 비주얼 |
|------|------|--------|
| 0~1분 | 후킹: "무엇을 만들지 고민하지 마세요. 풀고싶은 문제만 정의하세요" | 타이틀 슬라이드 |
| 1~2분 | 문제 정의: 의사결정 병목, 하나만 골라야 하는 제약 | - |
| 2~3분 | Supe 소개: 문제만 정의하면 멀티버스가 열린다 | 아키텍처 다이어그램 |
| 3~5분 | 데모 1: "어젯밤 이 spec을 넣고 잤습니다" → Slack 히스토리 라이브 | Slack 화면 |
| 5~6분 | Entanglement 하이라이트: "α의 발견이 β에서 이렇게 변형되었습니다" | Slack Entanglement 메시지 |
| 6~7분 | Morning Report: 비교표 | CLI 또는 Slack Report |
| 7~8분 | 데모 2: 비개발 시나리오 결과 (VC 관점 어필) | 전략 문서 결과물 |
| 8~9분 | 기술적 차별점: Cross-Pollination이 왜 중요한가 | Pollen Flow 다이어그램 |
| 9~10분 | 비전: "모든 팀의 모든 의사결정에 Supe를" | 클로징 |

---

## 의존관계 그래프

```
Phase 1 (Foundation)
├── 1.1 프로젝트 초기화
├── 1.2 타입 정의 ← 1.1
├── 1.3 유틸리티 ← 1.1, 1.2
├── 1.4 CLI 엔트리포인트 ← 1.1
└── 1.5 템플릿 ← 1.1

Phase 2 (Core Engine)
├── 2.1 Spec Parser ← 1.2, 1.3
├── 2.2 Session Manager ← 1.2, 1.3, 2.1
├── 2.3 Universe Runner ← 1.2, 1.3, 1.5, 2.4
├── 2.4 Agent Runners ← 1.2
├── 2.5 Orchestrator ← 2.2, 2.3
└── 2.6 run 커맨드 ← 1.4, 2.2, 2.5

Phase 3 (Pollen + Slack)
├── 3.1 Analyst ← 1.3 (llm, git utils)
├── 3.2 Pollinator ← 1.3, 3.1
├── 3.3 Tracker ← 1.3, 3.1
├── 3.4 Orchestrator 통합 ← 2.5, 3.1, 3.2, 3.3
├── 3.5 Slack Bot ← 1.3
├── 3.6 Slack Messages ← 1.2
└── 3.7 Slack Handlers ← 3.5, 3.6

Phase 4 (Dashboard + Polish)
├── 4.1 Reporter ← 1.2, 1.3
├── 4.2 Dashboard ← 1.2
├── 4.3 CLI 커맨드들 ← 2.2, 4.1
└── 4.4 통합 테스트 ← all
```

---

## 리스크 및 대응

| 리스크 | 확률 | 영향 | 대응 |
|--------|------|------|------|
| 에이전트가 DONE.md를 생성 안 함 | 중 | 중 | 타임아웃으로 강제 종료. 부분 결과로 리포트 생성 |
| Pollen LLM 분석이 빈약함 | 중 | 저 | Pollen 없이도 병렬 실행은 동작. 데모에서 수동으로 인상적인 diff를 하이라이트 |
| Slack API 레이트 리밋 | 저 | 중 | throttle 이미 설계에 포함. 최악의 경우 --no-slack으로 CLI만 사용 |
| 에이전트 비용 초과 | 중 | 고 | maxCostPerUniverse 설정. 초과 시 해당 Universe만 중단 |
| Phase 2까지만 구현 가능 | 저 | 고 | Pollen/Slack 없이도 "N개 병렬 실행 + 수동 비교"만으로 최소 데모 가능 |

---

## 최소 동작 버전 (Minimum Viable Demo)

시간이 부족하면 **Phase 2까지만 완성**해도 데모 가능:

- ✅ spec 파싱 → N개 Universe 자동 생성
- ✅ N개 에이전트 병렬 실행
- ✅ DONE.md 감지로 완료 판단
- ❌ Cross-Pollination (수동으로 "이런 패턴이 있었다" 설명)
- ❌ Slack (터미널 로그로 대체)
- ❌ Dashboard (supe status로 대체)

**이 경우에도 핵심 메시지는 전달 가능:**
"문제만 정의했더니 3가지 다른 방식으로 밤새 풀어줬습니다"
