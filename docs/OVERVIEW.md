# Supe (Superposition)

> **"이제 기획서도 필요 없습니다. 풀고 싶은 문제만 정의하세요."**
>
> 기획서를 쓰고, 방법론을 고민하고, 하나를 골라 베팅하던 시대는 끝났습니다.
> 문제만 던지면 Supe가 멀티버스를 열어, 여러 방법을 동시에 탐색합니다.

## One-Liner

**문제만 정의하면 N개의 평행우주가 열리고, 각 우주가 독립적으로 해법을 탐색하며, 서로의 발견을 자율적으로 교류하여, 아침에 최선의 결과를 비교하고 고른다.**

---

## Problem Statement

모든 조직에서 매일 일어나는 일:

1. 문제를 인식한다
2. "어떤 방식으로 풀지?" 토론에 수일~수주 소요
3. 결국 하나를 선택하고 실행
4. 실패하면 처음부터 다시

근본적 결함이 두 가지 있다:

1. **"어떻게 풀지"를 사람이 고민해야 한다** — 방법론 선정에 에너지가 소모된다
2. **하나를 골라서 베팅해야 한다** — 인간이 직접 실행하므로 병렬 탐색이 불가능하다

AI 에이전트는 이 두 제약을 동시에 제거한다. 방법은 AI가 다각도로 열고, 실행도 AI가 병렬로 한다.

---

## Solution

Supe는 **문제 정의(problem statement)만 받아서, 스스로 다양한 접근법을 설계하고, 각각을 독립된 Universe에서 동시에 실행**하는 오케스트레이션 엔진이다.

- 사용자는 **풀고 싶은 문제**만 정의한다 (선호 방향 힌트는 선택사항)
- Supe가 문제를 분석하여 **의미 있게 다른 N개의 접근법**을 자동 설계한다
- 각 접근법은 독립된 **Universe**에서 에이전트가 자율 실행한다
- Universe들은 격리되어 있지만, 핵심 발견은 **Cross-Pollination**으로 교차 전파된다
- 전파된 인사이트를 **도입할지 말지는 각 Universe가 스스로 판단**한다
- 실행이 완료되면 **Morning Report**로 정량 비교하여 최선을 선택한다

### 핵심 원칙

1. **사용자는 "What(문제)"에 집중, "How(방법)"는 Supe가 담당**
2. **각 Universe는 자율적** — Pollen(다른 우주의 인사이트)을 받아도 채택 여부는 스스로 결정
3. **방법의 다양성은 시스템이 보장** — 같은 축을 최적화하는 Universe는 생성하지 않음

---

## Quantum Mechanics Metaphor

| Quantum Concept | Supe Concept | 설명 |
|-----------------|--------------|------|
| **Superposition** | N개 Universe 동시 실행 | 관측 전까지 모든 해법이 동시에 존재 |
| **Observation** | Morning Report | 결과를 관측하여 비교 |
| **Wavefunction Collapse** | 하나를 선택 | 최선의 Universe를 선택, 나머지는 보관 또는 폐기 |
| **Entanglement** | Cross-Pollination | 한 Universe의 발견이 다른 Universe에 즉시 영향 |
| **Decoherence** | Universe 격리 | 각 Universe는 독립적으로 진화하되, Entanglement로만 교류 |

---

## Core Innovation: Cross-Pollination (Entanglement)

단순 병렬 실행과 Supe의 결정적 차이.

- 각 Universe는 독립적으로 작업하되, 주기적으로 **Analyst**가 발견을 스캔
- 범용적 인사이트(Pollen)를 추출하여 다른 Universe에 **패턴 수준으로** 전파
- 코드/내용을 복사하는 것이 아니라, **아이디어의 자연선택**
- 전파된 Pollen이 적용/변형/거부되는 과정이 추적됨

상세 설계: [POLLEN_ENGINE.md](./POLLEN_ENGINE.md)

---

## Use Cases (Domain-Agnostic)

Supe는 개발 도구가 아니다. **의사결정이 있는 모든 곳**에 적용된다.

### Software Development
```
Spec: "실시간 할 일 관리 앱"
Universe A: Go + HTMX (미니멀)
Universe B: Next.js + Supabase (풀스택)
Universe C: FastAPI + Vue (밸런스)
→ 아침에: 3개 동작하는 앱 + 비교 리포트
```

### Marketing Strategy
```
Spec: "새 프로덕트 런칭 캠페인"
Universe A: 바이럴 숏폼 중심
Universe B: SEO + 롱폼 콘텐츠
Universe C: 커뮤니티/PLG
→ 아침에: 3가지 GTM 전략 + 콘텐츠 초안 + 비교표
```

### Business Strategy
```
Spec: "동남아 시장 진출 전략"
Universe A: 베트남 직진출 (현지법인)
Universe B: 싱가포르 허브 (파트너십)
Universe C: 인도네시아 M&A
→ 아침에: 3가지 진출 전략 리포트 + 리스크/리턴 비교
```

### Content / Pitch
```
Spec: "AI 스타트업 피치덱"
Universe A: 기술 중심 스토리
Universe B: 시장 중심 스토리
Universe C: 팀 중심 스토리
→ 아침에: 3개 피치덱 + VC 유형별 추천
```

---

## Service Form

### Primary Interface: CLI + Slack

**CLI**: 세션 생성, 모니터링, 리포트 조회. 터미널 라이브 대시보드 포함.
**Slack**: 각 Universe가 별도 스레드에 실시간 기록. 팀원이 자연스럽게 참여.

### Why Slack?

1. Slack Thread = Universe 컨테이너로 완벽하게 매핑
2. 비개발자도 실시간으로 진행 상황 관찰 가능
3. 팀원이 특정 Universe 스레드에 개입("이 방향 더 파봐") 가능
4. 메인 채널 = Entanglement 이벤트 + Morning Report
5. 별도 UI 구축 불필요 (Slack이 이미 완벽한 UI)

### Flow Summary

```
사용자 → Slack 채널 또는 CLI에서 spec 제출
       → Supe가 N개 Universe 자동 생성
       → 각 Universe = 별도 Slack 스레드 + 별도 workdir + 별도 에이전트 프로세스
       → 에이전트가 작업하면서 스레드에 실시간 기록
       → 주기적으로 Cross-Pollination 수행
       → Entanglement 이벤트를 메인 채널에 포스팅
       → 완료 시 Morning Report를 메인 채널에 포스팅
       → 사용자가 비교하고 선택 (Collapse)
```

---

## Tech Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Language | TypeScript (ESM) | 타입 안전성 + Slack SDK 호환 |
| Runtime | Node.js 22+ | ESM 네이티브 지원, child_process API |
| Slack Bot | @slack/bolt | 공식 SDK, 이벤트/커맨드/인터랙션 지원 |
| CLI Framework | commander.js | 가볍고 직관적 |
| Terminal UI | ink (React for CLI) | React 패러다임으로 터미널 UI 렌더링 |
| Agent Execution | child_process.spawn | Claude Code / Codex CLI 프로세스 관리 |
| Git Operations | simple-git | 브랜치/커밋/diff 관리 |
| State Persistence | JSON files | 경량, 디버깅 용이, 별도 DB 불필요 |
| Config | dotenv + JSON | 환경변수(토큰) + 설정파일 |

---

## Project Structure

```
supe/
├── docs/                          # 설계 문서 (현재 디렉토리)
│   ├── OVERVIEW.md                # 이 파일
│   ├── ARCHITECTURE.md            # 시스템 아키텍처
│   ├── DATA_MODELS.md             # 데이터 모델 전체 정의
│   ├── POLLEN_ENGINE.md           # Cross-Pollination 엔진 상세
│   ├── UNIVERSE_RUNNER.md         # Universe 실행기 상세
│   ├── SLACK_INTEGRATION.md       # Slack 연동 상세
│   ├── CLI_SPEC.md                # CLI 명령어 및 대시보드
│   └── IMPLEMENTATION_PLAN.md     # 구현 계획 및 순서
│
├── src/
│   ├── index.ts                   # CLI 엔트리포인트
│   ├── cli/
│   │   ├── commands/
│   │   │   ├── run.ts             # `supe run` 커맨드
│   │   │   ├── status.ts          # `supe status` 커맨드
│   │   │   └── report.ts          # `supe report` 커맨드
│   │   └── dashboard.tsx          # ink 기반 터미널 대시보드
│   ├── core/
│   │   ├── session.ts             # Session 생명주기 관리
│   │   ├── orchestrator.ts        # N개 Universe 병렬 관리
│   │   └── spec-parser.ts         # spec.md 파싱 + Universe 분기 생성
│   ├── universe/
│   │   ├── runner.ts              # 단일 Universe 실행 루프
│   │   ├── prompt-builder.ts      # Universe별 PROMPT.md 생성
│   │   └── progress-detector.ts   # 진행률 감지
│   ├── pollen/
│   │   ├── analyst.ts             # diff 분석 → Pollen 추출
│   │   ├── pollinator.ts          # Pollen → 타겟 Universe 주입
│   │   └── tracker.ts             # Pollen 적용/거부 추적
│   ├── slack/
│   │   ├── app.ts                 # Slack Bolt 앱 초기화
│   │   ├── messages.ts            # 메시지 포맷터 (Block Kit)
│   │   └── handlers.ts            # 슬래시 커맨드 + 이벤트 핸들러
│   ├── agents/
│   │   ├── base.ts                # AgentRunner 인터페이스
│   │   ├── claude.ts              # Claude Code 실행기
│   │   └── codex.ts               # OpenAI Codex 실행기
│   ├── reporter/
│   │   ├── metrics.ts             # 메트릭 수집기
│   │   ├── comparator.ts          # Universe 간 비교 로직
│   │   └── formatter.ts           # 리포트 포맷팅 (Slack/Terminal)
│   └── utils/
│       ├── git.ts                 # Git 유틸리티
│       ├── logger.ts              # 구조화된 로깅
│       ├── config.ts              # 설정 로드
│       └── llm.ts                 # LLM 호출 유틸리티 (분석용)
│
├── templates/
│   ├── universe-prompt.md.hbs     # Universe PROMPT.md Handlebars 템플릿
│   └── pollen-injection.md.hbs    # Pollen 주입 템플릿
│
├── package.json
├── tsconfig.json
├── .env.example                   # 환경변수 템플릿
└── .claude/
    └── CLAUDE.md                  # AI 에이전트용 프로젝트 컨텍스트
```

---

## Key Terminology

| Term | Definition |
|------|-----------|
| **Session** | 하나의 Supe 실행 단위. spec + N개 Universe + 설정을 포함 |
| **Universe** | 하나의 접근법으로 독립 실행되는 작업 공간 |
| **Spec** | 사용자가 제출하는 문제 정의 (자유 형식 마크다운) |
| **Pollen** | Cross-Pollination에서 전파되는 인사이트 단위 |
| **Entanglement** | 한 Universe의 발견이 다른 Universe에 영향을 주는 이벤트 |
| **Collapse** | 사용자가 최종 Universe를 선택하는 행위 |
| **Analyst** | Pollen을 추출하는 분석 에이전트 |
| **Morning Report** | 모든 Universe 완료 후 생성되는 비교 리포트 |

---

## Worldbuilding — 멀티버스 세계관

Supe는 단순 도구가 아니라 **세계관을 가진 시스템**이다. 모든 UI 텍스트, 로그, 에러 메시지가 이 세계관 안에서 작성된다. 이는 기술 데모를 넘어 **기억에 남는 경험**을 만든다.

### 세계관 설정

Supe를 실행하면 사용자는 **멀티버스 관측자(Observer)**가 된다. 문제를 정의하는 것은 "시공간에 균열(Rift)을 여는 행위"이며, 각 Universe는 그 균열을 통해 실체화된 평행현실이다. Universe들이 동시에 존재하는 것은 양자 중첩 상태이며, 사용자가 최종 결과를 선택하는 순간 파동함수가 붕괴한다.

### Session Lifecycle — 멀티버스 용어 매핑

모든 상태 전이에 세계관 용어를 사용한다. CLI/Slack 표시 시 이 용어를 우선 사용.

| 기술 상태 | 세계관 용어 | 아이콘 | 표시 문구 |
|----------|-----------|--------|----------|
| `initializing` | Opening Rift | 🌀 | `Opening rift in spacetime...` |
| `running` | Multiverse Active | 🌌 | `Multiverse active. {n} realities coexist.` |
| `completed` | Wavefunction Collapsed | 💫 | `Wavefunction collapsed. Reality selected.` |
| `failed` | Reality Fracture | 💥 | `Reality fracture detected. Dimensions unstable.` |
| `cancelled` | Rift Sealed | 🔒 | `Rift sealed. Multiverse contained.` |

### Universe Status — 차원 용어

| 기술 상태 | 세계관 용어 | 아이콘 | 표시 문구 |
|----------|-----------|--------|----------|
| `pending` | Dimension Forming | 🫧 | `Dimension forming...` |
| `running` | Dimension Active | ◉ | `Dimension active. Reality materializing.` |
| `completed` | Dimension Stabilized | ✦ | `Dimension stabilized. Reality anchored.` |
| `failed` | Dimension Collapsed | ⊘ | `Dimension collapsed. Reality lost.` |
| `stopped` | Dimension Frozen | ❄️ | `Dimension frozen. Timeline suspended.` |

### Pollen Events — 양자 얽힘 용어

| 기술 이벤트 | 세계관 용어 | 아이콘 | 표시 문구 |
|------------|-----------|--------|----------|
| Pollen Cycle 시작 | Dimensional Scan | 📡 | `Scanning dimensions for quantum anomalies...` |
| Pollen 생성 | Entanglement Detected | 🔗 | `Quantum entanglement detected in Universe {s}` |
| Pollen 주입 | Signal Transmitted | 📡 | `Transmitting signal to Universe {s}...` |
| Pollen 적용 | Entanglement Synchronized | ✅ | `Entanglement synchronized. Realities converging.` |
| Pollen 변형 적용 | Entanglement Mutated | 🔄 | `Entanglement mutated. Adapted to local reality.` |
| Pollen 거부 | Decoherence | ❌ | `Decoherence. Signal incompatible with local reality.` |

### Ambient Flavor Messages

6개 이상의 Universe가 동시 실행될 때, 또는 장시간 실행 시, 주기적으로 분위기 연출 메시지가 표시된다. 실제 기능에는 영향 없는 순수 세계관 요소.

#### 랜덤 이벤트 풀 (CLI 대시보드 + Slack 메인 스레드)

```typescript
const AMBIENT_MESSAGES = [
  // 시공간 이상
  "⚡ Interdimensional static detected between Universe {a} and {b}. Probably nothing.",
  "🌀 Minor reality leak near Universe {a}. Self-sealing in progress.",
  "👁️ Something briefly observed all universes simultaneously. It looked confused.",
  "🐈 A cat was observed alive in Universe {a} and dead in Universe {b}. Schrödinger sends his regards.",
  
  // 코스트 관련
  "💸 Universe {a} just mass-produced tokens. Your wallet felt a disturbance in the force.",
  "🪙 The interdimensional exchange rate is fluctuating. Token costs may vary across realities.",
  
  // 크로스폴리네이션 관련
  "🧬 Universe {a}'s DNA is showing up in Universe {b}. Evolution works in mysterious ways.",
  "📻 Faint whispers detected between dimensions. The universes are... talking?",
  "🌊 A ripple in the quantum foam. Universe {a}'s discovery is echoing across realities.",
  
  // 장시간 실행
  "🌙 The multiverse hums quietly. All dimensions are working while you sleep.",
  "⏳ Time flows differently in each universe. What feels like minutes here is epochs there.",
  "🔭 From this vantage point, you can see {n} realities evolving in parallel. Beautiful.",
  
  // 유머
  "🍕 Universe {a} just ordered pizza. Wait, that's not in the spec...",
  "📎 It looks like you're trying to solve a problem. Would you like to open 3 more dimensions?",
  "🎲 God does not play dice with the universe. But Supe does. With {n} of them.",
];
```

#### 표시 규칙

- **CLI 대시보드**: 하단 로그 영역에 15~30분 간격으로 1개씩 표시. 디자인적으로 `dim` 스타일 적용하여 주요 정보와 시각적 구분.
- **Slack**: 메인 스레드에 1~2시간 간격으로 포스팅. 너무 자주 올리면 노이즈.
- **6개 미만 Universe**: 표시하지 않거나, 장시간(3시간+) 실행 시에만 가끔 표시.
- **6개 이상 Universe**: 더 빈번하게 표시. 시공간 불안정 테마 메시지 비중 증가.
- `{a}`, `{b}`는 실제 running Universe의 symbol로 치환. `{n}`은 Universe 수.

### Morning Report 세계관 테마

Morning Report의 제목과 클로징 문구:

- 헤더: `☀️ THE OBSERVER'S MORNING REPORT` 또는 `☀️ MULTIVERSE STATUS: WAVEFUNCTION READY TO COLLAPSE`
- 추천 문구: `🏆 RECOMMENDED COLLAPSE TARGET: Universe {s}` (추천 Universe)
- 클로징: `Select a universe to collapse the wavefunction, or let all realities coexist a little longer.`

### CLI 시작 시퀀스 (Boot Animation)

`supe run` 실행 시 짧은 시작 시퀀스:

```
$ supe run --spec strategy.md --universes 3

  ╔═══════════════════════════════════════╗
  ║                                       ║
  ║     ✦  S U P E R P O S I T I O N  ✦  ║
  ║                                       ║
  ║     "Don't plan. Just define."        ║
  ║                                       ║
  ╚═══════════════════════════════════════╝

  🔬 Analyzing problem space...
  🌀 Opening rift in spacetime...
  🟢 Spacetime stable. 3 universes initialized.

  ◉ Universe α — Viral Short-form Strategy  (Claude)
  ◉ Universe β — SEO Long-form Strategy     (GPT)
  ◉ Universe γ — Community-led Strategy      (Claude)

  🌌 Multiverse active. 3 realities coexist.
  📡 First dimensional scan in 30 minutes.
  
  Entering observation mode...

```

10개 Universe 진입 시:

```
$ supe run --spec megaproject.md --universes 10

  ╔═══════════════════════════════════════╗
  ║                                       ║
  ║     ✦  S U P E R P O S I T I O N  ✦  ║
  ║                                       ║
  ║     "Don't plan. Just define."        ║
  ║                                       ║
  ╚═══════════════════════════════════════╝

  🔬 Analyzing problem space...
  
  💀 SPACETIME COLLAPSE IMMINENT
     10 simultaneous universes has never been attempted.
     The last person who tried was never seen again.
     They say he still wanders between dimensions,
     mumbling about token costs.
     
     Final warning — proceed? (y/N) y

  🌀 Brave soul. Tearing open 10 rifts in spacetime...
  ⚡ Reality anchors straining...
  ⚡ Dimensional barriers weakening...
  🔴 UNSTABLE — but holding. For now.

  ◉ Universe α — ...
  ◉ Universe β — ...
  ...
  ◉ Universe κ — ...

  🌌 Multiverse active. 10 realities coexist.
  ⚠️ Spacetime integrity: 23%. Expect interdimensional interference.
  📡 First dimensional scan in 30 minutes.
  
  Entering observation mode... (pray)

```

---

## Non-Goals (Scope Boundary)

- 자체 LLM 호스팅 (기존 Claude Code / Codex CLI를 사용)
- 웹 UI (Slack + CLI가 인터페이스)
- 실시간 협업 편집 (Google Docs 같은 동시 편집)
- Universe 간 코드 자동 머지 (사용자가 수동으로 선택)
- 과금/빌링 시스템
