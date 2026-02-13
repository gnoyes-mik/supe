# Architecture

## System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                          USER INTERFACES                             │
│                                                                      │
│   ┌─────────────┐                    ┌─────────────────────┐         │
│   │  CLI (supe)  │                    │  Slack Bot (@supe)  │         │
│   │  - run       │                    │  - /supe command    │         │
│   │  - status    │                    │  - Thread updates   │         │
│   │  - report    │                    │  - Morning Report   │         │
│   │  - dashboard │                    │  - Entanglement log │         │
│   └──────┬───────┘                    └──────────┬──────────┘         │
│          │                                       │                    │
└──────────┼───────────────────────────────────────┼────────────────────┘
           │                                       │
           ▼                                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│                           CORE ENGINE                                │
│                                                                      │
│   ┌──────────────────────────────────────────────────────────┐       │
│   │                     Session Manager                       │       │
│   │  - Session 생명주기 (create → running → completed)        │       │
│   │  - 상태 persist (JSON)                                    │       │
│   │  - 이벤트 버스 (EventEmitter)                             │       │
│   └───────────────────────┬──────────────────────────────────┘       │
│                           │                                          │
│   ┌───────────────────────▼──────────────────────────────────┐       │
│   │                     Orchestrator                          │       │
│   │  - N개 Universe 병렬 관리                                 │       │
│   │  - Pollen Cycle 스케줄링 (매 N분)                         │       │
│   │  - 완료 감지 + Morning Report 트리거                      │       │
│   └───┬──────────────┬──────────────┬────────────────────────┘       │
│       │              │              │                                 │
│       ▼              ▼              ▼                                 │
│   ┌────────┐   ┌────────┐   ┌────────┐                              │
│   │ Univ α │   │ Univ β │   │ Univ γ │   ... (N개)                  │
│   │ Runner │   │ Runner │   │ Runner │                              │
│   └───┬────┘   └───┬────┘   └───┬────┘                              │
│       │            │            │                                    │
│       ▼            ▼            ▼                                    │
│   ┌────────┐   ┌────────┐   ┌────────┐                              │
│   │ Agent  │   │ Agent  │   │ Agent  │   (Claude/Codex 프로세스)     │
│   │Process │   │Process │   │Process │                              │
│   └────────┘   └────────┘   └────────┘                              │
│                                                                      │
│   ┌──────────────────────────────────────────────────────────┐       │
│   │                    Pollen Engine                          │       │
│   │  ┌──────────┐  ┌─────────────┐  ┌──────────────┐        │       │
│   │  │ Analyst  │→ │ Pollinator  │→ │   Tracker    │        │       │
│   │  │ (발견감지)│  │ (전파/주입) │  │ (적용추적)   │        │       │
│   │  └──────────┘  └─────────────┘  └──────────────┘        │       │
│   └──────────────────────────────────────────────────────────┘       │
│                                                                      │
│   ┌──────────────────────────────────────────────────────────┐       │
│   │                      Reporter                            │       │
│   │  - 메트릭 수집 (LoC, 파일 수, 비용, 시간)               │       │
│   │  - Universe 간 비교                                      │       │
│   │  - Morning Report 생성                                   │       │
│   └──────────────────────────────────────────────────────────┘       │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         FILE SYSTEM                                  │
│                                                                      │
│   ~/.supe/                                                           │
│   ├── config.json                # 글로벌 설정                       │
│   └── sessions/                                                      │
│       └── {session_id}/                                              │
│           ├── session.json       # 세션 상태                         │
│           ├── spec.md            # 원본 스펙 복사본                  │
│           ├── parsed-spec.json   # 파싱된 스펙                       │
│           ├── pollens.json       # 모든 Pollen 기록                  │
│           ├── report.json        # 최종 리포트 데이터                │
│           └── universes/                                             │
│               ├── alpha/         # Universe α workdir               │
│               │   ├── .git/                                          │
│               │   ├── PROMPT.md  # Universe별 에이전트 프롬프트      │
│               │   ├── .supe/                                         │
│               │   │   ├── universe.json  # Universe 상태             │
│               │   │   ├── logs.jsonl     # 이벤트 로그              │
│               │   │   └── pollens/       # 수신한 Pollen 파일들     │
│               │   └── (에이전트가 생성한 파일들)                     │
│               ├── beta/          # Universe β workdir               │
│               └── gamma/         # Universe γ workdir               │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Component Responsibilities

### 1. Session Manager (`src/core/session.ts`)

**역할**: Session의 전체 생명주기를 관리한다.

**책임**:
- Session 생성: spec 파일 수신 → 파싱 → Universe 구성 → 디렉토리 구조 생성
- Session 상태 관리: `pending` → `running` → `completed` | `failed`
- 상태 Persist: `~/.supe/sessions/{id}/session.json`에 주기적 저장
- 이벤트 버스: 모든 하위 컴포넌트의 이벤트를 수집하여 Slack/CLI에 라우팅
- Session 복구: 프로세스 재시작 시 기존 세션 복구

**이벤트 버스 패턴**:
```
Session (EventEmitter)
  ├── 'universe:started'     → Slack 스레드 생성, CLI 대시보드 업데이트
  ├── 'universe:progress'    → Slack 스레드 업데이트, CLI 프로그레스 업데이트
  ├── 'universe:completed'   → Slack 스레드 완료 메시지
  ├── 'universe:failed'      → Slack 에러 메시지, 재시도 판단
  ├── 'pollen:created'       → Slack 메인채널 Entanglement 알림
  ├── 'pollen:applied'       → Slack 타겟 스레드 업데이트
  ├── 'pollen:rejected'      → 로그 기록
  ├── 'session:all-complete' → Morning Report 트리거
  └── 'session:error'        → 에러 핸들링
```

### 2. Spec Parser (`src/core/spec-parser.ts`)

**역할**: 자유 형식의 spec.md를 구조화된 데이터로 파싱하고, N개의 Universe 접근법을 생성한다.

**입력**: 사용자가 작성한 자유 형식 마크다운 (spec.md)

**처리 단계**:

1. **Spec 파싱** (LLM 호출 1회):
   - spec.md를 읽어서 구조화
   - 추출 항목: 문제 정의, 제약 조건, 원하는 산출물, 성공 기준, 도메인

2. **Universe 분기 생성** (LLM 호출 1회):
   - 파싱된 스펙을 기반으로 N개의 "의미 있게 다른" 접근법 생성
   - 각 접근법: 이름, 전략 요약, 사용 도구/스택, 에이전트 할당, 예상 강점/약점
   - 핵심: 랜덤이 아닌, **스펙의 제약 조건을 다른 축으로 최적화**하는 분기

**출력**: `ParsedSpec` + `UniverseConfig[]` (DATA_MODELS.md 참조)

**LLM 프롬프트 전략**:
- Spec 파싱 프롬프트에는 JSON 출력 스키마를 명시적으로 제공
- Universe 분기 생성 프롬프트에는 "각 Universe가 서로 다른 축을 최적화하도록" 명시
- 예: 속도 최적화 vs 기능 최대화 vs 비용 최소화 vs 확장성 우선

### 3. Orchestrator (`src/core/orchestrator.ts`)

**역할**: N개의 Universe Runner를 병렬로 관리하고, Pollen Cycle을 스케줄링한다.

**책임**:
- Universe Runner N개를 동시에 시작
- 각 Runner의 이벤트를 Session 이벤트 버스로 전파
- Pollen Cycle 타이머 관리 (기본: 30분 간격)
- 모든 Universe 완료 감지 → Reporter 트리거
- 비용 한도 관리: 각 Universe별 또는 세션 전체 비용 한도 초과 시 중단
- 타임아웃 관리: 세션 전체 최대 실행 시간 초과 시 정상 종료

**Pollen Cycle**:
```
매 N분마다:
  1. 모든 running Universe의 최근 변경사항 수집
  2. Analyst에게 전달 → Pollen 추출
  3. 새 Pollen이 있으면 Pollinator에게 전달 → 타겟 Universe에 주입
  4. Tracker 업데이트
```

### 4. Universe Runner (`src/universe/runner.ts`)

**역할**: 단일 Universe의 에이전트 실행 루프를 관리한다.

상세 설계: [UNIVERSE_RUNNER.md](./UNIVERSE_RUNNER.md)

### 5. Pollen Engine (`src/pollen/`)

**역할**: Cross-Pollination의 전체 라이프사이클을 관리한다.

상세 설계: [POLLEN_ENGINE.md](./POLLEN_ENGINE.md)

### 6. Reporter (`src/reporter/`)

**역할**: 모든 Universe가 완료된 후 비교 리포트를 생성한다.

**메트릭 수집** (`metrics.ts`):
- 각 Universe workdir를 스캔하여 메트릭 수집
- 개발 시나리오: LoC (cloc), 파일 수, 테스트 통과율, 빌드 성공 여부
- 비개발 시나리오: 문서 페이지 수, 섹션 커버리지, 참조 소스 수
- 공통: 총 커밋 수, 에이전트 실행 시간, 추정 비용, Pollen 교류 횟수

**비교 로직** (`comparator.ts`):
- 메트릭별 랭킹 산출
- 카테고리별 우승자 선정 (예: "가장 효율적", "가장 기능이 많은", "가장 균형 잡힌")
- 종합 추천 생성 (LLM 호출 1회: 메트릭 데이터를 주고 종합 평가 요청)

**포맷팅** (`formatter.ts`):
- Slack Block Kit 포맷 (메인 채널 Morning Report용)
- Terminal 포맷 (CLI `supe report`용)
- 두 포맷 모두 같은 데이터 소스에서 생성

### 7. Slack Integration (`src/slack/`)

상세 설계: [SLACK_INTEGRATION.md](./SLACK_INTEGRATION.md)

### 8. CLI (`src/cli/`)

상세 설계: [CLI_SPEC.md](./CLI_SPEC.md)

---

## Sequence Diagrams

### Flow 1: Session Creation (CLI)

```
User              CLI               SessionManager      SpecParser         Orchestrator       Slack
 │                 │                      │                  │                  │               │
 │ supe run        │                      │                  │                  │               │
 │ --spec spec.md  │                      │                  │                  │               │
 │ --universes 3   │                      │                  │                  │               │
 │────────────────>│                      │                  │                  │               │
 │                 │ createSession(spec,3) │                  │                  │               │
 │                 │─────────────────────>│                  │                  │               │
 │                 │                      │ parseSpec(spec)   │                  │               │
 │                 │                      │─────────────────>│                  │               │
 │                 │                      │                  │ [LLM] parse      │               │
 │                 │                      │                  │ [LLM] generate   │               │
 │                 │                      │                  │   3 universes    │               │
 │                 │                      │<─────────────────│                  │               │
 │                 │                      │   ParsedSpec +   │                  │               │
 │                 │                      │   UniverseConfig[]│                  │               │
 │                 │                      │                  │                  │               │
 │                 │                      │ createDirs()      │                  │               │
 │                 │                      │ (workdir, git init per universe)     │               │
 │                 │                      │                  │                  │               │
 │                 │                      │ postInitMessage() │                  │               │
 │                 │                      │─────────────────────────────────────────────────────>│
 │                 │                      │                  │                  │   Main msg +   │
 │                 │                      │                  │                  │   3 threads    │
 │                 │                      │<─────────────────────────────────────────────────────│
 │                 │                      │   thread_ts[]    │                  │               │
 │                 │                      │                  │                  │               │
 │                 │                      │ start(session)   │                  │               │
 │                 │                      │─────────────────────────────────────>│               │
 │                 │                      │                  │                  │ launch N      │
 │                 │                      │                  │                  │ UniverseRunners│
 │                 │                      │                  │                  │ start Pollen  │
 │                 │                      │                  │                  │ Cycle timer   │
 │                 │<─────────────────────│                  │                  │               │
 │ Session created │                      │                  │                  │               │
 │ ID: ses_abc123  │                      │                  │                  │               │
 │<────────────────│                      │                  │                  │               │
 │                 │                      │                  │                  │               │
 │ (dashboard)     │                      │                  │                  │               │
 │<════════════════│ (live terminal UI starts)               │                  │               │
```

### Flow 2: Pollen Cycle

```
Timer          Orchestrator       Analyst          Pollinator         Tracker         Slack
 │                  │                │                  │                │              │
 │ tick (30min)     │                │                  │                │              │
 │─────────────────>│                │                  │                │              │
 │                  │                │                  │                │              │
 │                  │ for each running Universe:        │                │              │
 │                  │ collectDiff()  │                  │                │              │
 │                  │───────────────>│                  │                │              │
 │                  │                │ git diff         │                │              │
 │                  │                │ since last scan  │                │              │
 │                  │                │                  │                │              │
 │                  │                │ [LLM] analyze    │                │              │
 │                  │                │ "Is there a      │                │              │
 │                  │                │  transferable    │                │              │
 │                  │                │  insight?"       │                │              │
 │                  │                │                  │                │              │
 │                  │                │ if yes:          │                │              │
 │                  │                │ create Pollen    │                │              │
 │                  │<───────────────│                  │                │              │
 │                  │  Pollen[]      │                  │                │              │
 │                  │                │                  │                │              │
 │                  │ for each new Pollen:              │                │              │
 │                  │ pollinate(pollen, targets)         │                │              │
 │                  │─────────────────────────────────>│                │              │
 │                  │                │                  │                │              │
 │                  │                │                  │ for each target:│              │
 │                  │                │                  │ [LLM] "Is this │              │
 │                  │                │                  │ relevant to    │              │
 │                  │                │                  │ target's work?"│              │
 │                  │                │                  │                │              │
 │                  │                │                  │ if relevant:   │              │
 │                  │                │                  │ inject into    │              │
 │                  │                │                  │ PROMPT.md      │              │
 │                  │                │                  │                │              │
 │                  │                │                  │ record()       │              │
 │                  │                │                  │───────────────>│              │
 │                  │                │                  │                │              │
 │                  │<─────────────────────────────────│                │              │
 │                  │                │                  │                │              │
 │                  │ emit('pollen:created')            │                │              │
 │                  │────────────────────────────────────────────────────────────────>│
 │                  │                │                  │                │  Entanglement│
 │                  │                │                  │                │  msg in main │
 │                  │                │                  │                │  channel     │
 │                  │                │                  │                │              │
 │                  │                │                  │                │  Update in   │
 │                  │                │                  │                │  target      │
 │                  │                │                  │                │  thread      │
```

### Flow 3: Morning Report

```
Orchestrator       Reporter          Comparator       Formatter          Slack          CLI
 │                    │                  │                │                 │              │
 │ all universes      │                  │                │                 │              │
 │ completed          │                  │                │                 │              │
 │                    │                  │                │                 │              │
 │ generateReport()   │                  │                │                 │              │
 │───────────────────>│                  │                │                 │              │
 │                    │                  │                │                 │              │
 │                    │ collectMetrics() │                │                 │              │
 │                    │ (scan each       │                │                 │              │
 │                    │  universe workdir)│                │                 │              │
 │                    │                  │                │                 │              │
 │                    │ compare(metrics) │                │                 │              │
 │                    │─────────────────>│                │                 │              │
 │                    │                  │ rank per metric│                 │              │
 │                    │                  │ [LLM] summarize│                 │              │
 │                    │<─────────────────│                │                 │              │
 │                    │                  │                │                 │              │
 │                    │ format(comparison)│               │                 │              │
 │                    │─────────────────────────────────>│                 │              │
 │                    │                  │                │ slackBlocks     │              │
 │                    │                  │                │ terminalText    │              │
 │                    │<─────────────────────────────────│                 │              │
 │                    │                  │                │                 │              │
 │<───────────────────│                  │                │                 │              │
 │                    │                  │                │                 │              │
 │ emit('session:all-complete', report)  │                │                 │              │
 │──────────────────────────────────────────────────────────────────────>│              │
 │                    │                  │                │   Morning Report│              │
 │                    │                  │                │   in main channel│             │
 │──────────────────────────────────────────────────────────────────────────────────────>│
 │                    │                  │                │                 │  Dashboard   │
 │                    │                  │                │                 │  update      │
```

---

## Configuration

### Global Config (`~/.supe/config.json`)

```json
{
  "defaultAgent": "claude",
  "agents": {
    "claude": {
      "command": "claude",
      "args": ["--dangerously-skip-permissions"],
      "maxCostPerUniverse": 10.0
    },
    "codex": {
      "command": "codex",
      "args": [],
      "maxCostPerUniverse": 10.0
    }
  },
  "slack": {
    "botToken": "${SUPE_SLACK_BOT_TOKEN}",
    "appToken": "${SUPE_SLACK_APP_TOKEN}",
    "defaultChannel": "#supe"
  },
  "pollen": {
    "cycleIntervalMinutes": 30,
    "maxPollensPerCycle": 3,
    "minTimeBetweenInjectionsMinutes": 20
  },
  "session": {
    "maxDurationHours": 10,
    "maxUniverses": 10
  },
  "llm": {
    "analysisModel": "claude-sonnet-4-20250514",
    "analysisProvider": "anthropic",
    "apiKey": "${ANTHROPIC_API_KEY}"
  }
}
```

### Session-level Config (CLI flags로 오버라이드 가능)

| Flag | Default | Description |
|------|---------|-------------|
| `--spec` | (required) | 스펙 파일 경로 |
| `--universes` | 3 | 생성할 Universe 수 (2~10, 다만 많을수록 시공간이 불안정해짐) |
| `--agent` | config default | 기본 에이전트 (claude/codex) |
| `--agents` | - | Universe별 에이전트 지정 (예: `claude,codex,claude`) |
| `--timeout` | 10h | 최대 실행 시간 |
| `--max-cost` | $30 | 세션 전체 비용 한도 |
| `--pollen-interval` | 30m | Cross-Pollination 주기 |
| `--channel` | config default | Slack 채널 |
| `--no-slack` | false | Slack 없이 CLI만 사용 |
| `--no-pollen` | false | Cross-Pollination 비활성화 |

---

## Error Handling Strategy

### Universe 실패 시

1. 에이전트 프로세스 비정상 종료 → 최대 3회 자동 재시작
2. 3회 실패 시 해당 Universe를 `failed`로 마킹
3. 다른 Universe는 계속 실행
4. Slack 해당 스레드에 실패 메시지 + 마지막 에러 로그 포스팅
5. Morning Report에 실패한 Universe도 포함 (가용한 메트릭까지만)

### Pollen Engine 실패 시

1. LLM 분석 호출 실패 → 해당 Pollen Cycle 스킵, 다음 Cycle에서 재시도
2. Pollen 주입 실패 → 로그 기록, 해당 Pollen을 pending 상태로 유지
3. Pollen Engine 실패가 Universe 실행을 중단시키지 않음 (독립적)

### 비용 한도 초과 시

1. Universe별 한도 초과 → 해당 Universe만 정상 종료 (현재까지 결과 보존)
2. 세션 전체 한도 초과 → 모든 Universe 정상 종료 → 가용한 결과로 Morning Report 생성

### 프로세스 크래시 시

1. Session 상태는 JSON에 주기적 persist (30초 간격)
2. `supe run --resume {session_id}`로 크래시 지점에서 재개 가능
3. 재개 시: 완료된 Universe는 스킵, running이었던 Universe만 재시작

---

## Security Considerations

- Slack 토큰, API 키는 환경변수로만 관리 (`.env`, 코드에 하드코딩 금지)
- 에이전트 프로세스는 사용자 권한으로 실행 (추가 권한 상승 없음)
- Universe workdir 간 파일 시스템 격리 (각자 독립된 디렉토리)
- Pollen 전파 시 민감 정보(API 키, 인증 정보 등) 필터링 필요
  - Analyst 프롬프트에 "민감 정보를 Pollen에 포함하지 마라" 명시
