# Pollen Engine — Cross-Pollination System

> 단순 병렬 실행과 Supe의 결정적 차이. 각 Universe가 격리 상태에서 독립적으로 진화하되, 핵심 발견만 추상화하여 교차 전파한다. 전파된 인사이트를 채택할지 말지는 각 Universe가 자율적으로 판단한다.

---

## 생물학적 비유

갈라파고스 제도의 핀치새:
- 각 섬(Universe)에서 독립적으로 진화
- 가끔 섬 간 이동(Pollen)으로 유전자 교류
- 교류된 유전자가 적합하면 생존, 부적합하면 도태
- 결과: 각 종의 적응력이 강화되면서도 독자적 진화 유지

---

## 3-Layer Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Pollen Engine                         │
│                                                         │
│  Layer 1: DISCOVERY (발견 감지)                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │                   Analyst                          │  │
│  │  - 각 Universe의 최근 변경사항(git diff) 수집      │  │
│  │  - LLM으로 "범용적 인사이트"가 있는지 분석         │  │
│  │  - 있으면 Pollen 객체로 추출                       │  │
│  └──────────────────────┬────────────────────────────┘  │
│                         │ Pollen[]                       │
│                         ▼                                │
│  Layer 2: POLLINATION (전파)                              │
│  ┌───────────────────────────────────────────────────┐  │
│  │                  Pollinator                        │  │
│  │  - 각 Pollen의 타겟 Universe 결정                  │  │
│  │  - 관련성 판단 (LLM)                               │  │
│  │  - 관련성 높으면 타겟 Universe의 PROMPT.md에 주입   │  │
│  │  - 주입은 "힌트" 형태 — 강제가 아닌 참고 사항      │  │
│  └──────────────────────┬────────────────────────────┘  │
│                         │                                │
│                         ▼                                │
│  Layer 3: EVOLUTION TRACKING (진화 추적)                  │
│  ┌───────────────────────────────────────────────────┐  │
│  │                   Tracker                          │  │
│  │  - 주입된 Pollen이 실제 적용되었는지 추적          │  │
│  │  - 적용 시: 어떻게 변형되었는지 기록               │  │
│  │  - 거부 시: 거부 이유 기록                         │  │
│  │  - Morning Report의 Entanglement 섹션 데이터 제공  │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Layer 1: Discovery (Analyst)

### 파일: `src/pollen/analyst.ts`

### 트리거

Orchestrator가 Pollen Cycle을 실행할 때 호출된다 (기본: 30분 간격).

### 입력

각 running Universe에 대해:
- `lastScanCommitHash`: 이전 Pollen Cycle에서 마지막으로 스캔한 커밋 해시
- `currentCommitHash`: 현재 HEAD 커밋 해시
- Universe의 `config.approach`: 이 Universe의 접근법 설명

### 처리 흐름

```
analyzeUniverse(universe: Universe): Promise<Pollen[]>

1. lastScanCommitHash === currentCommitHash 이면 → 변경 없음, 빈 배열 반환

2. DISCOVERY.md-first 접근:
   a. universe.workdir/DISCOVERY.md 파일 존재 여부 확인
   b. DISCOVERY.md가 존재하고, 마지막 스캔 이후 새 엔트리가 있으면:
      - 새 엔트리를 직접 Pollen 후보로 사용 (LLM diff 분석 스킵)
      - DISCOVERY.md 파싱: ## 제목 → title, 본문 → insight, Type: 라인 → type
      - 마지막 스캔 위치를 업데이트 (다음 Cycle에서 중복 방지)
   c. DISCOVERY.md가 없거나 새 엔트리가 없으면 → 아래 3번 fallback으로 진행

3. Fallback: git diff LLM 분석:
   simple-git을 사용하여 lastScanCommitHash..currentCommitHash의 diff 취득
   diff가 너무 크면 (10,000자 초과) → git log --oneline로 커밋 메시지 목록 + 
   변경된 파일 목록으로 대체
   LLM 호출 (분석): 아래 프롬프트로 분석 요청 → JSON 배열 응답

4. 응답을 Pollen 객체로 변환

5. lastScanCommitHash를 currentCommitHash로 업데이트

6. Pollen[] 반환
```

### DISCOVERY.md-first 전략

에이전트가 직접 작성한 DISCOVERY.md를 우선 활용함으로써:
- **LLM 호출 절감**: 에이전트가 이미 인사이트를 정리했으므로 diff 분석 LLM 호출 불필요
- **정확도 향상**: 에이전트 자신이 "이것이 범용적 인사이트"라고 명시적으로 판단한 내용이므로, LLM이 diff에서 추측하는 것보다 정확

DISCOVERY.md 예상 포맷:
```markdown
## Hybrid Rate Limiter Pattern
Combining sliding window with token bucket creates superior burst handling.
The key insight is to use the sliding window for rate calculation but token bucket for actual enforcement.
This decouples measurement from enforcement, allowing independent tuning.
Type: pattern

## Data Normalization Warning
Input data with mixed encodings causes silent truncation in downstream processing.
Always normalize to UTF-8 at the ingestion boundary, not at each processing stage.
Type: warning
```

### LLM 프롬프트 (Analyst)

```
You are an insight analyst for a parallel exploration system.

## Context
Universe "${universe.config.symbol}" is working on the following approach:
"${universe.config.approach}"

It is solving this problem:
"${session.spec.parsed.problemStatement}"

## Recent Changes
${diffOrSummary}

## Your Task
Analyze the recent changes and determine if there are any **transferable insights** — 
discoveries, patterns, strategies, or warnings that could benefit a DIFFERENT approach 
to the SAME problem.

Rules:
- Only extract insights that are APPROACH-AGNOSTIC (applicable regardless of specific tools/stack)
- Abstract to the PATTERN level, not the implementation level
- Do NOT include implementation-specific details (variable names, file paths, library APIs)
- Do NOT include sensitive information (API keys, credentials, internal URLs)
- Maximum 2 pollens per analysis (only the most significant)
- If there are no transferable insights, return an empty array

## Response Format (JSON array, no markdown fencing)
[
  {
    "title": "Short title (max 60 chars)",
    "insight": "2-5 sentences describing the transferable insight at pattern level",
    "type": "pattern | data | strategy | warning",
    "abstractionLevel": "concept | pattern | technique"
  }
]

If no transferable insights, respond with: []
```

### Pollen 생성 규칙

- 한 Universe에서 한 Cycle당 최대 2개의 Pollen만 추출 (가장 중요한 것만)
- Pollen ID 형식: `pol_{sourceSymbol}_{3자리 순번}` (예: `pol_α_001`)
- `sourceDiffSummary`: diff의 첫 500자 또는 커밋 메시지 목록

---

## Layer 2: Pollination (Pollinator)

### 파일: `src/pollen/pollinator.ts`

### 트리거

Analyst가 새 Pollen을 반환했을 때 호출된다.

### 입력

- `pollen: Pollen`: 새로 생성된 Pollen
- `targetUniverses: Universe[]`: Pollen의 source를 제외한 나머지 running Universe들

### 처리 흐름

```
pollinate(pollen: Pollen, targets: Universe[]): Promise<void>

for each target in targets:

  1. 주입 빈도 제한 확인:
     target Universe에 마지막 Pollen 주입 후 minTimeBetweenInjectionsMinutes가 
     지나지 않았으면 → status: 'skipped', 다음 target으로

  2. 관련성 판단 (LLM 호출):
     target Universe의 현재 상태(approach, 최근 작업 내용)와 Pollen의 관련성 평가
     → 'high' | 'medium' | 'low' 반환

  3. relevance가 'low'이면 → status: 'rejected', rejectionReason 기록, 다음 target으로

  4. relevance가 'medium' 또는 'high'이면 → PROMPT.md에 주입 + Active Injection:
      a. target Universe의 PROMPT.md 파일을 읽는다
      b. "## Cross-Pollination Hints" 섹션을 찾는다 (없으면 생성)
      c. 새 Pollen 힌트를 추가한다
      d. PROMPT.md를 저장한다
      e. **Active Injection**: `target.pendingPollens` 큐에 Pollen을 추가한다
         - UniverseRunner가 다음 iteration 프롬프트 구성 시 이 큐를 읽어서
           에이전트의 직접 프롬프트에 [CROSS-POLLINATION ALERT]로 포함한다
         - 이를 통해 에이전트가 PROMPT.md를 다시 읽지 않아도 Pollen을 인지할 수 있다
      f. status: 'injected'로 업데이트

  5. 이벤트 발행: 'pollen:injected' 또는 'pollen:rejected'
```

### LLM 프롬프트 (관련성 판단)

```
You are evaluating whether an insight from one parallel exploration 
should be shared with another.

## Insight (from Universe ${pollen.sourceSymbol})
Title: ${pollen.title}
${pollen.insight}

## Target (Universe ${target.config.symbol})
Approach: ${target.config.approach}
Current work: ${target.progress.currentPhase}

## Question
How relevant is this insight to the target's current work?

Rules:
- "high": Directly applicable, would clearly improve the target's approach
- "medium": Potentially useful, worth considering but not critical
- "low": Not relevant to this approach, or the target is likely already handling this

Respond with a JSON object (no markdown fencing):
{
  "relevance": "high | medium | low",
  "reason": "One sentence explanation"
}
```

### PROMPT.md 주입 형식

```markdown
## Cross-Pollination Hints

> These hints come from parallel explorations of the same problem.
> You are NOT required to adopt them. Evaluate each hint and decide
> whether it benefits YOUR approach. If you adopt a hint, adapt it
> to fit your architecture — do NOT copy foreign patterns blindly.

### [pol_α_001] Hybrid Rate Limiter Pattern
_Source: Universe α | Relevance: high_

Another approach discovered that combining sliding window with token bucket 
creates superior burst handling. Consider this PATTERN when implementing 
your rate limiter. Adapt to your stack and architecture.

---
```

### 주입 규칙

- "## Cross-Pollination Hints" 섹션은 PROMPT.md의 **맨 끝**에 위치
- 각 Pollen 힌트는 `### [pollen_id] title` 형식
- 힌트 텍스트에 반드시 **"NOT required to adopt"**, **"adapt to your architecture"** 문구 포함
- 같은 Universe에 이미 주입된 Pollen의 ID 목록을 유지 → 중복 주입 방지
- 한 Universe에 누적된 Pollen 힌트가 5개를 초과하면 → 가장 오래된 것부터 제거 (PROMPT 비대화 방지)

---

## Layer 3: Evolution Tracking (Tracker)

### 파일: `src/pollen/tracker.ts`

### 트리거

두 가지 시점에 호출된다:
1. **Pollen Cycle 종료 시**: 이전 Cycle에서 주입된 Pollen들의 적용 여부 확인
2. **Universe 완료 시**: 최종 적용 상태 확인

### 입력

- `injectedPollens: Pollen[]`: status가 'injected'인 Pollen들
- `targetUniverse: Universe`: 확인 대상 Universe

### 처리 흐름

LLM 호출 대신 POLLEN_RESPONSE.md 파일 파싱으로 적용 여부를 판단한다. 이를 통해 Tracker의 LLM 호출을 **완전히 제거**한다.

```
trackAdoption(pollen: Pollen, target: Universe): Promise<void>

1. target Universe의 workdir에서 POLLEN_RESPONSE.md 파일을 읽는다
   - 파일이 없으면 → status 유지 ('injected'), cyclesMissing 카운터 증가

2. POLLEN_RESPONSE.md에서 해당 pollen.id 섹션을 파싱한다
   예상 포맷:
   ## {pollen_id}: {title}
   - Decision: APPLIED | ADAPTED | SKIPPED
   - How: {description if applied/adapted}
   - Reason: {reason if skipped}

3. 파싱 결과에 따라 PollenTarget 상태 업데이트:
   - Decision이 APPLIED → status: 'applied', evidence에 How 내용 기록
   - Decision이 ADAPTED → status: 'adapted', mutation에 How 내용 기록
   - Decision이 SKIPPED → status: 'rejected', rejectionReason에 Reason 내용 기록
   - pollen.id가 POLLEN_RESPONSE.md에 없음 → status 유지 ('injected'),
     cyclesMissing 카운터 증가
   - cyclesMissing >= 2 → status: 'rejected', 
     rejectionReason: "Not mentioned in POLLEN_RESPONSE.md after 2 cycles"

4. 이벤트 발행: 'pollen:applied', 'pollen:rejected', 또는 유지
```

### POLLEN_RESPONSE.md 파싱 로직

```typescript
interface PollenResponse {
  pollenId: string;
  title: string;
  decision: 'APPLIED' | 'ADAPTED' | 'SKIPPED';
  description: string | null;  // How (APPLIED/ADAPTED) or Reason (SKIPPED)
}

function parsePollenResponse(content: string): PollenResponse[] {
  const sections = content.split(/^## /m).filter(Boolean);
  return sections.map(section => {
    const [header, ...lines] = section.split('\n');
    const [pollenId, ...titleParts] = header.split(':');
    const title = titleParts.join(':').trim();
    
    const decisionLine = lines.find(l => l.startsWith('- Decision:'));
    const decision = decisionLine?.replace('- Decision:', '').trim() as PollenResponse['decision'];
    
    const howLine = lines.find(l => l.startsWith('- How:'));
    const reasonLine = lines.find(l => l.startsWith('- Reason:'));
    const description = howLine?.replace('- How:', '').trim() 
      ?? reasonLine?.replace('- Reason:', '').trim() 
      ?? null;
    
    return { pollenId: pollenId.trim(), title, decision, description };
  });
}
```

### 기존 LLM 기반 추적과의 비교

| 항목 | 기존 (LLM 기반) | 변경 (파일 파싱) |
|------|-----------------|-----------------|
| LLM 호출 | Cycle당 I회 (injected Pollen 수) | **0회** |
| 정확도 | LLM 추론에 의존 (false positive 가능) | 에이전트 자기 보고 (명시적) |
| 비용 | Sonnet 호출 비용 | 없음 |
| 의존성 | git diff + LLM | POLLEN_RESPONSE.md 파일만 |
| fallback | - | 파일 없으면 2 Cycle 후 'rejected' |

---

## Pollen Cycle Orchestration

Orchestrator가 관리하는 전체 Pollen Cycle 흐름:

```
pollenCycle(session: Session): Promise<void>

1. cycleNumber 증가
2. 이벤트 발행: 'cycle:started'

3. [Discovery] 각 running Universe에 대해 Analyst.analyzeUniverse() 호출
   → newPollens: Pollen[]
   병렬 처리: Promise.all로 모든 Universe 동시 분석

4. [Evolution Tracking] 이전 Cycle에서 주입된 Pollen들의 적용 추적
   → Tracker.trackAdoption() 호출
   병렬 처리: Promise.all로 모든 pending Pollen 동시 확인

5. [Pollination] 새 Pollen들을 타겟 Universe에 전파
   → Pollinator.pollinate() 호출
   순차 처리: 주입 빈도 제한을 정확히 적용하기 위해

6. session.pollens에 새 Pollen 추가
7. pollens.json에 persist

8. 이벤트 발행: 'cycle:completed'

9. 다음 Cycle 타이머 설정 (config.pollenIntervalMs)
```

### Cycle 타이밍

```
Session 시작
  │
  ├── 0분: Universe들 시작
  ├── 30분: Cycle 1 (최초. 대부분 scaffolding 단계라 Pollen 적음)
  ├── 60분: Cycle 2 (핵심 로직 구현 시작. Pollen 가능성 높음)
  ├── 90분: Cycle 3
  │   ...
  ├── N분: Cycle K (마지막)
  └── 완료: 최종 Evolution Tracking
```

### 첫 Cycle 딜레이

Session 시작 후 최초 Pollen Cycle까지 최소 30분 대기한다.
이유: 초기 scaffolding 단계에서는 범용 인사이트가 없으므로 LLM 비용 낭비.

---

## LLM 비용 관리

Pollen Engine은 Cycle마다 LLM 호출을 여러 번 한다. 비용을 관리해야 한다.

### 호출 횟수 (N = Universe 수, 한 Cycle 기준)

| 단계 | 호출 수 | 설명 |
|------|--------|------|
| Analyst | N회 | Universe당 1회 (diff 분석) |
| Pollinator (관련성) | P × (N-1)회 | P = 새 Pollen 수, 각 Pollen을 N-1개 타겟에 평가 |
| Tracker | I회 | I = 이전 Cycle의 injected Pollen 수 |

3개 Universe, Cycle당 평균 2개 Pollen 기준:
- Analyst: 3회
- Pollinator: 2 × 2 = 4회
- Tracker: ~2회
- **총: ~9회 / Cycle**

Sonnet 모델 사용 시 Cycle당 약 $0.02~0.05 수준. 10시간 세션(20 Cycles) 기준 $0.40~1.00.

### 비용 절감 전략

1. **짧은 프롬프트**: diff 전체가 아닌 요약 사용 (10,000자 초과 시)
2. **빈 diff 스킵**: 변경 없는 Universe는 분석 자체를 스킵
3. **Pollen 캡**: Cycle당 Universe별 최대 2개 Pollen (과도한 전파 방지)
4. **분석 모델**: 고비용 모델(Opus)이 아닌 경량 모델(Sonnet/Haiku)을 사용

---

## Edge Cases

### Universe가 1개만 running일 때

Cross-Pollination 대상이 없으므로 Pollen Cycle을 스킵한다.
Analyst는 여전히 동작하여 나중 참조를 위해 Pollen을 생성할 수 있으나, Pollinator는 호출하지 않는다.

### 모든 Universe가 비슷한 단계에 있을 때

Analyst가 "범용 인사이트 없음"으로 판단하여 빈 배열을 반환하는 것이 정상.
강제로 Pollen을 만들지 않는다.

### Pollen이 이미 적용된 아이디어와 중복될 때

Pollinator가 주입 시, 기존에 주입된 Pollen ID 목록을 체크한다.
유사한 제목의 Pollen이 이미 있으면 → 중복 주입하지 않고 'skipped' 처리.
정확한 중복 감지는 어렵기 때문에 ID 기반으로만 관리하고, LLM이 "이미 이전 힌트에서 다룬 주제"라고 판단하면 자연스럽게 무시하도록 프롬프트에 명시.

### Universe가 Cross-Pollination Hints를 전혀 읽지 않을 때

이는 정상 동작이다. 각 Universe는 자율적으로 판단한다.
2 Cycle 연속 미반영 시 해당 Pollen을 'rejected'로 처리하고 더 이상 추적하지 않는다.
PROMPT.md에서도 5개 초과 시 오래된 것부터 제거하여 프롬프트 비대화를 방지한다.
