# Supe (Superposition)

> **"Don't plan. Just define."**
>
> 문제만 던지면 N개의 평행우주가 열리고, 각 우주가 독립적으로 해법을 탐색하며,
> 서로의 발견을 자율적으로 교류하여, 아침에 최선의 결과를 비교하고 고른다.

---

## What is Supe?

Supe는 **문제 정의(problem statement)만 받아서, 다양한 접근법을 자동 설계하고, 각각을 독립된 Universe에서 동시에 실행**하는 멀티버스 오케스트레이션 엔진입니다.

- 사용자는 **"무엇(What)"** 에만 집중 — "어떻게(How)"는 Supe가 담당
- N개의 **근본적으로 다른 접근법**을 AI가 자동 설계 (다양성 검증 포함)
- 각 접근법은 독립된 **Universe**에서 AI 에이전트(Claude Code / Codex)가 자율 실행
- 핵심 발견은 **Cross-Pollination**으로 교차 전파 — 도입 여부는 각 Universe가 자율 판단
- 완료 후 **Morning Report**로 정량 비교하여 최선을 선택

```
사용자: "실시간 할 일 관리 앱"

→ Universe α: Go + HTMX (미니멀, 성능 최적화)
→ Universe β: Next.js + Supabase (풀스택, 개발속도 최적화)  
→ Universe γ: FastAPI + Vue (밸런스, 확장성 최적화)

→ 아침에: 3개 동작하는 앱 + 비교 리포트
```

## Quick Start

### Prerequisites

- Node.js 22+
- Claude Code CLI 또는 OpenAI Codex CLI
- Anthropic API Key (Pollen 분석용)

### Installation

```bash
# Clone
git clone https://github.com/gnoyes-mik/supe.git
cd supe

# Install dependencies
npm install

# Initialize configuration
npx tsx src/index.ts init
```

### Configuration

`supe init` 실행 시 `~/.supe/config.json`이 생성됩니다:

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
    "botToken": "",
    "appToken": "",
    "defaultChannel": ""
  },
  "llm": {
    "analysisModel": "claude-sonnet-4-20250514",
    "analysisProvider": "anthropic",
    "apiKey": "${ANTHROPIC_API_KEY}"
  }
}
```

환경변수로도 설정 가능합니다:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export SUPE_SLACK_BOT_TOKEN=xoxb-...   # Optional
export SUPE_SLACK_APP_TOKEN=xapp-...   # Optional
```

### Usage

#### 1. Spec 파일 작성

자유 형식의 마크다운으로 **풀고 싶은 문제**를 정의합니다:

```markdown
# 실시간 할 일 관리 앱

## 문제
팀원들이 공유 가능한 실시간 할 일 관리 앱이 필요하다.

## 제약 조건
- 3명 이하의 소규모 팀 대상
- 모바일 웹 지원 필수
- 자체 호스팅 가능해야 함

## 성공 기준
- 실시간 동기화 동작
- 사용자 인증 구현
- 드래그앤드롭 정렬
- 빌드 성공 + 기본 테스트 통과
```

#### 2. Session 시작

```bash
# 기본 실행 (3 Universes, Claude Code)
npx tsx src/index.ts run --spec ./my-spec.md

# 커스텀 설정
npx tsx src/index.ts run --spec ./my-spec.md \
  --universes 4 \
  --agents claude,codex,claude,claude \
  --timeout 8h \
  --max-cost 50

# Slack 없이 CLI만
npx tsx src/index.ts run --spec ./my-spec.md --no-slack

# 중단된 세션 재개
npx tsx src/index.ts run --resume ses_abc123def456
```

#### 3. 모니터링

```bash
# 현재 세션 상태
npx tsx src/index.ts status

# 특정 세션
npx tsx src/index.ts status ses_abc123def456

# 전체 세션 목록
npx tsx src/index.ts list
```

#### 4. 리포트 확인

```bash
# Morning Report 조회
npx tsx src/index.ts report

# 세션 중단
npx tsx src/index.ts stop
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         CLI / Slack                          │
│  supe run, status, report, list, stop, init                 │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                      Session Manager                         │
│  Create/Load/Save sessions, EventEmitter for all events      │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                       Orchestrator                           │
│  N-Universe parallel management + Pollen cycle scheduling    │
└───────┬──────────────────┼──────────────────┬───────────────┘
        │                  │                  │
┌───────▼───────┐  ┌───────▼───────┐  ┌───────▼───────┐
│  Universe α   │  │  Universe β   │  │  Universe γ   │
│  (Claude)     │  │  (Codex)      │  │  (Claude)     │
│               │  │               │  │               │
│  Dynamic      │  │  Dynamic      │  │  Dynamic      │
│  Prompt Loop  │  │  Prompt Loop  │  │  Prompt Loop  │
└───────┬───────┘  └───────┬───────┘  └───────┬───────┘
        │                  │                  │
        └──────────┬───────┴──────────┬───────┘
                   │                  │
          ┌────────▼────────┐  ┌──────▼───────┐
          │  Pollen Engine  │  │   Reporter   │
          │                 │  │              │
          │  Analyst        │  │  Metrics     │
          │  Pollinator     │  │  Comparator  │
          │  Tracker        │  │  Formatter   │
          └─────────────────┘  └──────────────┘
```

### Core Modules

| Module | Path | Description |
|--------|------|-------------|
| **Spec Parser** | `src/core/spec-parser.ts` | 자유 형식 spec을 구조화 + Universe 접근법 생성 + 다양성 검증 |
| **Session Manager** | `src/core/session.ts` | Session CRUD + EventEmitter + auto-save |
| **Orchestrator** | `src/core/orchestrator.ts` | N개 Universe 병렬 관리 + Pollen Cycle 스케줄링 |
| **Universe Runner** | `src/universe/runner.ts` | Ralph-style 반복 실행 + 동적 프롬프트 생성 |
| **Progress Detector** | `src/universe/progress-detector.ts` | LLM 기반 성공 기준별 진행률 평가 |
| **Pollen Analyst** | `src/pollen/analyst.ts` | DISCOVERY.md-first + git diff fallback 인사이트 추출 |
| **Pollen Pollinator** | `src/pollen/pollinator.ts` | 관련성 평가 + Active Pollen Injection |
| **Pollen Tracker** | `src/pollen/tracker.ts` | POLLEN_RESPONSE.md 파싱으로 적용 추적 (LLM 0회) |
| **Reporter** | `src/reporter/` | 메트릭 수집 + LLM 비교 + Slack/Terminal 포맷팅 |
| **Slack Integration** | `src/slack/` | Block Kit 메시지 + 이벤트 라우팅 + 스레드 관리 |

---

## Key Innovations

### 1. Dynamic Agent Prompts

매 iteration마다 상황 인식 프롬프트를 동적 생성합니다. 기존의 정적 "continue working" 대신:

```
[ITERATION CONTEXT]
- This is iteration 7. Previous iteration: success.
- Files: 12, Commits: 23.
- Criteria progress:
  ✅ 인증 모듈 구현
  ✅ API 엔드포인트 설계
  □  테스트 커버리지 80% 이상
  □  배포 스크립트 작성
- Focus on unchecked criteria above.
```

에이전트가 **지금 무엇을 해야 하는지** 정확히 알게 되어, 이미 완료된 작업을 반복하지 않습니다.

### 2. Active Pollen Injection

Cross-Pollination의 3단계 모두를 개선:

| 단계 | 기존 방식 | 개선 방식 |
|------|----------|----------|
| **발견** | 매번 LLM으로 git diff 분석 | DISCOVERY.md 우선 파싱 (LLM 호출 0회) |
| **전파** | PROMPT.md에 append (수동적) | `pendingPollens` 큐 + 프롬프트 직접 주입 (능동적) |
| **추적** | LLM으로 적용 여부 추론 | POLLEN_RESPONSE.md 파싱 (LLM 호출 0회) |

결과: **LLM 비용 ~80% 절감 + 정확도 향상** (에이전트 자기 보고 활용)

### 3. Diversity Validation

Universe 생성 후 LLM으로 접근법 간 직교성을 검증합니다:

- 아키텍처가 근본적으로 다른가?
- 각각 다른 축을 최적화하는가?
- 기술 스택 중복이 60% 미만인가?

`overlapScore > 0.5`이면 개선 제안과 함께 자동 재생성하여, **의미 있는 다양성을 시스템이 보장**합니다.

---

## Multiverse Stability System

Universe 수에 따라 시공간 안정성 경고를 표시합니다:

| Universes | Level | Message |
|-----------|-------|---------|
| 2-3 | `STABLE` | 🟢 Spacetime stable. |
| 4-5 | `MINOR_FLUCTUATION` | 🟡 Minor spacetime fluctuations detected. |
| 6-7 | `UNSTABLE` | 🟠 WARNING: Spacetime fabric is stretching. |
| 8-9 | `CRITICAL` | 🔴 CRITICAL: The multiverse is groaning. |
| 10 | `COLLAPSE_IMMINENT` | 💀 SPACETIME COLLAPSE IMMINENT. |
| 11+ | `REJECTED` | 🕳️ Nice try. Even Supe has limits. |

---

## Slack Integration

Slack을 통해 실시간으로 모니터링할 수 있습니다:

- **메인 채널**: 세션 시작 알림 + Entanglement 이벤트 + Morning Report
- **Universe 스레드**: 각 Universe의 커밋, 진행 업데이트, Pollen 수신 알림
- **Throttling**: 동일 이벤트는 최소 2분 간격으로 포스팅

### 필요한 Slack 권한

- Bot Token Scopes: `chat:write`, `chat:write.customize`, `channels:read`, `channels:history`
- Socket Mode 활성화 + `connections:write`

---

## Use Cases

Supe는 개발 도구가 아닙니다. **의사결정이 있는 모든 곳**에 적용됩니다.

| Domain | Example Spec | Universes |
|--------|-------------|-----------|
| **Software Dev** | "실시간 할 일 관리 앱" | Go+HTMX / Next.js+Supabase / FastAPI+Vue |
| **Marketing** | "새 프로덕트 런칭 캠페인" | 바이럴 숏폼 / SEO 롱폼 / 커뮤니티 PLG |
| **Business Strategy** | "동남아 시장 진출 전략" | 베트남 직진출 / 싱가포르 허브 / 인도네시아 M&A |
| **Content** | "AI 스타트업 피치덱" | 기술 중심 / 시장 중심 / 팀 중심 |

---

## Project Structure

```
supe/
├── src/
│   ├── index.ts                    # CLI entrypoint (commander.js)
│   ├── types.ts                    # All TypeScript interfaces
│   ├── cli/commands/               # 6 CLI commands (run, status, report, list, stop, init)
│   ├── core/
│   │   ├── session.ts              # Session lifecycle + EventEmitter
│   │   ├── orchestrator.ts         # N-Universe parallel + Pollen scheduling
│   │   ├── spec-parser.ts          # Spec parsing + diversity validation
│   │   └── stability.ts            # Multiverse stability system
│   ├── universe/
│   │   ├── runner.ts               # Ralph-style loop + dynamic prompts
│   │   ├── prompt-builder.ts       # Handlebars PROMPT.md generation
│   │   └── progress-detector.ts    # LLM criteria assessment
│   ├── pollen/
│   │   ├── analyst.ts              # DISCOVERY.md-first insight extraction
│   │   ├── pollinator.ts           # Active injection + relevance assessment
│   │   └── tracker.ts              # POLLEN_RESPONSE.md parsing (zero LLM)
│   ├── reporter/
│   │   ├── metrics.ts              # Git-based metric collection
│   │   ├── comparator.ts           # LLM cross-universe comparison
│   │   └── formatter.ts            # Slack Block Kit + terminal formatting
│   ├── slack/
│   │   ├── app.ts                  # Slack Bolt initialization
│   │   ├── messages.ts             # 8 Block Kit message formatters
│   │   └── handlers.ts             # Event-to-Slack routing + throttling
│   ├── agents/
│   │   ├── base.ts                 # AgentRunner interface
│   │   ├── claude.ts               # Claude Code defaults
│   │   └── codex.ts                # Codex defaults
│   └── utils/
│       ├── config.ts               # ~/.supe/ config management
│       ├── logger.ts               # Structured logging (console + JSONL)
│       ├── git.ts                  # simple-git wrapper
│       └── llm.ts                  # Anthropic SDK with retry
├── templates/
│   └── universe-prompt.md.hbs      # Universe PROMPT.md template
├── docs/                           # Design documentation
├── specs/                          # Example spec files
├── package.json
└── tsconfig.json
```

---

## Development

```bash
# Type check
npm run typecheck

# Run in dev mode
npm run dev -- run --spec ./specs/demo-dev.md

# Build
npm run build

# Run built version
npm start -- run --spec ./specs/demo-dev.md
```

---

## Tech Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| Language | TypeScript (ESM) | Type safety + ecosystem |
| Runtime | Node.js 22+ | ESM native + child_process |
| CLI | commander.js | Lightweight, intuitive |
| Slack | @slack/bolt | Official SDK, Socket Mode |
| Git | simple-git | Branch/commit/diff management |
| LLM | @anthropic-ai/sdk | Pollen analysis + spec parsing |
| Templates | Handlebars | PROMPT.md generation |
| State | JSON files | Lightweight, debuggable, no DB needed |

---

## Quantum Mechanics Metaphor

| Quantum Concept | Supe Concept | Description |
|-----------------|-------------|-------------|
| **Superposition** | N Universes | 관측 전까지 모든 해법이 동시에 존재 |
| **Observation** | Morning Report | 결과를 관측하여 비교 |
| **Wavefunction Collapse** | Selection | 최선의 Universe를 선택 |
| **Entanglement** | Cross-Pollination | 한 Universe의 발견이 다른 Universe에 영향 |
| **Decoherence** | Universe Isolation | 각 Universe는 독립 진화, Entanglement로만 교류 |

---

## License

MIT
