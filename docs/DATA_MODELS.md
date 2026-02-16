# Data Models

모든 데이터 구조의 TypeScript 정의. 구현 시 이 파일의 인터페이스를 `src/types.ts`에 그대로 사용한다.

---

## Core Types

### Session

```typescript
interface Session {
  id: string;                    // 형식: "ses_{nanoid(12)}"
  status: SessionStatus;
  spec: {
    rawPath: string;             // 원본 spec.md 경로
    raw: string;                 // 원본 spec.md 내용
    parsed: ParsedSpec;          // LLM으로 파싱된 구조화 데이터
  };
  universes: Universe[];
  config: SessionConfig;
  slack: SessionSlackState | null; // --no-slack이면 null
  pollens: Pollen[];
  report: Report | null;         // 완료 후 생성
  startedAt: string;             // ISO 8601
  completedAt: string | null;    // ISO 8601
  error: string | null;
}

type SessionStatus = 'initializing' | 'running' | 'completed' | 'failed' | 'cancelled';
```

### SessionConfig

```typescript
interface SessionConfig {
  maxUniverses: number;          // 기본값: 3, 범위: 2~10 (Stability 참고)
  defaultAgent: AgentType;       // 기본값: 'claude'
  agentAssignments: AgentType[]; // Universe별 에이전트 지정. 길이 = maxUniverses
  maxDurationMs: number;         // 기본값: 36_000_000 (10시간)
  maxCostUsd: number;            // 기본값: 30.0 (세션 전체)
  maxCostPerUniverseUsd: number; // 기본값: 10.0 (Universe당)
  pollenIntervalMs: number;      // 기본값: 1_800_000 (30분)
  pollenEnabled: boolean;        // 기본값: true
  slackEnabled: boolean;         // 기본값: true
  slackChannel: string;          // 기본값: config.json의 defaultChannel
}

type AgentType = 'claude' | 'codex';
```

### SessionSlackState

```typescript
interface SessionSlackState {
  channel: string;               // Slack 채널 ID
  mainMessageTs: string;         // 세션 메인 메시지의 ts (timestamp)
  threadTsMap: Record<string, string>; // universe.id → thread ts 매핑
}
```

---

## Spec Types

### ParsedSpec

```typescript
interface ParsedSpec {
  title: string;                  // 프로젝트/문제 제목
  problemStatement: string;       // 해결하려는 핵심 문제
  constraints: string[];          // 제약 조건 목록
  desiredOutputs: string[];       // 기대하는 산출물 목록
  successCriteria: string[];      // 성공 기준
  domain: SpecDomain;             // 도메인 분류
  additionalContext: string;      // 기타 맥락 정보
  universeConfigs: UniverseConfig[]; // 생성된 Universe 접근법들
}

type SpecDomain =
  | 'software-development'
  | 'marketing'
  | 'business-strategy'
  | 'content-creation'
  | 'research'
  | 'design'
  | 'other';
```

### UniverseConfig

```typescript
interface UniverseConfig {
  name: string;                   // 예: "미니멀 Go+HTMX"
  symbol: string;                 // α, β, γ, δ, ε 중 하나
  approach: string;               // 접근법 상세 설명 (2-3문장)
  optimizationAxis: string;       // 이 Universe가 최적화하는 축 (예: "속도", "기능 완성도")
  tools: string[];                // 사용 도구/스택 (예: ["Go", "HTMX", "SQLite"])
  agent: AgentType;               // 이 Universe에 할당된 에이전트
  estimatedStrength: string;      // 예상 강점
  estimatedWeakness: string;      // 예상 약점
}
```

---

## Universe Types

### Universe

```typescript
interface Universe {
  id: string;                     // 형식: "univ_{nanoid(8)}"
  sessionId: string;
  config: UniverseConfig;
  status: UniverseStatus;
  workdir: string;                // 절대 경로: ~/.supe/sessions/{sid}/universes/{symbol}/
  gitBranch: string;              // "universe/{symbol}" (예: "universe/alpha")
  promptPath: string;             // workdir 내 PROMPT.md 경로
  agentProcess: AgentProcessState;
  progress: UniverseProgress;
  metrics: UniverseMetrics | null; // 완료 후 수집
  logs: LogEntry[];               // 메모리에 최근 N개만 유지, 전체는 logs.jsonl
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  restartCount: number;           // 재시작 횟수 (최대 3)
}

type UniverseStatus = 'pending' | 'running' | 'completed' | 'failed' | 'stopped';
```

### AgentProcessState

```typescript
interface AgentProcessState {
  pid: number | null;
  command: string;                // 예: "claude"
  args: string[];                 // 예: ["--dangerously-skip-permissions"]
  startedAt: string | null;
  iterationCount: number;         // Ralph 루프 반복 횟수
  lastIterationAt: string | null;
}
```

### UniverseProgress

```typescript
interface UniverseProgress {
  percentage: number;             // 0~100, 추정치
  currentPhase: string;           // 예: "인증 모듈 구현 중"
  filesCreated: number;
  totalCommits: number;
  lastCommitMessage: string;
  lastActivityAt: string;         // ISO 8601
  estimatedCostUsd: number;
  criteriaProgress: {
    criterion: string;
    status: 'not_started' | 'in_progress' | 'likely_done' | 'verified';
    evidence: string;
  }[];
}
```

### UniverseMetrics

```typescript
interface UniverseMetrics {
  // 공통 메트릭
  totalFiles: number;
  totalCommits: number;
  durationMs: number;
  estimatedCostUsd: number;
  pollenEmitted: number;          // 이 Universe에서 생성된 Pollen 수
  pollenReceived: number;         // 이 Universe가 수신한 Pollen 수
  pollenApplied: number;          // 수신한 Pollen 중 적용된 수

  // 개발 시나리오 메트릭 (domain이 software-development일 때)
  linesOfCode: number | null;
  testsPassed: number | null;
  testsTotal: number | null;
  buildSuccess: boolean | null;
  buildTimeMs: number | null;

  // 비개발 시나리오 메트릭
  documentPages: number | null;   // 문서 페이지 수 추정
  sectionCount: number | null;    // 문서 섹션 수
  referenceSources: number | null; // 참조 소스 수
}
```

---

## Pollen Types

### Pollen

```typescript
interface Pollen {
  id: string;                     // 형식: "pol_{sourceSymbol}_{순번3자리}" (예: "pol_α_007")
  sessionId: string;
  sourceUniverseId: string;
  sourceSymbol: string;           // α, β, γ 등

  // 내용
  title: string;                  // 한 줄 요약 (예: "Hybrid Rate Limiter Pattern")
  insight: string;                // 상세 인사이트 (2-5문장)
  type: PollenType;
  abstractionLevel: PollenAbstractionLevel;

  // 전파 상태
  targets: PollenTarget[];

  // 메타
  createdAt: string;              // ISO 8601
  cycleNumber: number;            // 몇 번째 Pollen Cycle에서 생성되었는지
  sourceDiffSummary: string;      // 이 Pollen을 트리거한 변경사항 요약
}

type PollenType =
  | 'pattern'       // 재사용 가능한 설계 패턴
  | 'data'          // 발견된 데이터/팩트
  | 'strategy'      // 전략적 접근법
  | 'warning';      // 실패/함정 경고

type PollenAbstractionLevel =
  | 'concept'       // 순수 아이디어 수준 (가장 추상적)
  | 'pattern'       // 패턴 수준 (구현 방식은 자유)
  | 'technique';    // 구체적 기법 수준 (특정 구현에 가까움)
```

### PollenTarget

```typescript
interface PollenTarget {
  universeId: string;
  universeSymbol: string;
  relevance: 'high' | 'medium' | 'low';
  status: PollenTargetStatus;
  injectedAt: string | null;      // 주입 시각
  appliedAt: string | null;       // 적용 확인 시각
  mutation: string | null;        // 어떻게 변형되어 적용되었는지 설명
  rejectionReason: string | null; // 거부된 경우 이유
}

type PollenTargetStatus =
  | 'pending'      // 아직 주입 전
  | 'injected'     // 주입됨, 적용 여부 미확인
  | 'applied'      // 적용 확인됨
  | 'adapted'      // 변형되어 적용됨
  | 'rejected'     // 관련성 낮아 주입 안 함
  | 'skipped';     // 타이밍 제한으로 이번 Cycle에서 스킵
```

---

## Iteration & Diversity Types

### IterationContext

UniverseRunner가 매 iteration 시작 전에 구성하는 컨텍스트. 동적 프롬프트 생성에 사용된다.

```typescript
interface IterationContext {
  iterationNumber: number;
  previousResult: 'success' | 'failed' | 'first';
  criteriaStatus: { criterion: string; met: boolean }[];
  pendingPollens: Pollen[];  // Pollen Engine이 주입했으나 아직 에이전트에게 보여주지 않은 Pollen
  filesCount: number;
  commitsCount: number;
}
```

### DiversityCheck

Spec Parser의 다양성 검증 단계에서 반환되는 결과.

```typescript
interface DiversityCheck {
  isDiverse: boolean;
  overlapScore: number;           // 0.0 = 완전 직교, 1.0 = 동일
  problematicPairs: {
    a: string;                    // 접근법 이름
    b: string;                    // 접근법 이름
    reason: string;               // 겹치는 이유
  }[];
  suggestions: string[];          // 다양성 개선을 위한 구체적 제안
}
```

---

## Report Types

### Report

```typescript
interface Report {
  sessionId: string;
  generatedAt: string;            // ISO 8601
  summary: string;                // LLM이 생성한 종합 요약 (3-5문장)

  universeResults: UniverseResult[];

  rankings: RankingCategory[];

  pollenStats: PollenStats;

  recommendation: {
    winnerId: string;             // 추천 Universe ID
    winnerSymbol: string;
    reason: string;               // 추천 이유 (2-3문장)
  };
}

interface UniverseResult {
  universeId: string;
  symbol: string;
  name: string;
  status: UniverseStatus;
  metrics: UniverseMetrics | null;
  highlights: string[];           // 이 Universe의 주목할 점 (2-3개)
}

interface RankingCategory {
  category: string;               // 예: "효율성", "완성도", "확장성", "비용 대비 성과"
  rankings: {
    rank: number;
    universeId: string;
    universeSymbol: string;
    score: string;                // 해당 카테고리의 점수/설명
  }[];
}

interface PollenStats {
  totalCreated: number;
  totalApplied: number;
  totalAdapted: number;
  totalRejected: number;
  mostActiveSource: string;       // 가장 많은 Pollen을 생성한 Universe symbol
  mostInfluenced: string;         // 가장 많은 Pollen을 수신/적용한 Universe symbol
  notableEntanglements: {
    pollenId: string;
    description: string;          // "α의 rate limiter 패턴이 β에서 middleware로 변형"
  }[];
}
```

---

## Log Types

### LogEntry

```typescript
interface LogEntry {
  timestamp: string;              // ISO 8601
  level: 'info' | 'warn' | 'error' | 'debug';
  source: LogSource;
  universeId: string | null;      // 세션 레벨 로그면 null
  message: string;
  data: Record<string, unknown> | null; // 추가 데이터
}

type LogSource =
  | 'session'
  | 'orchestrator'
  | 'universe-runner'
  | 'agent-process'
  | 'pollen-analyst'
  | 'pollen-pollinator'
  | 'pollen-tracker'
  | 'reporter'
  | 'slack'
  | 'cli';
```

---

## Event Types

Session의 EventEmitter가 발행하는 이벤트 타입 정의.

```typescript
interface SessionEvents {
  'universe:started': { universeId: string; symbol: string };
  'universe:progress': { universeId: string; symbol: string; progress: UniverseProgress };
  'universe:completed': { universeId: string; symbol: string; metrics: UniverseMetrics };
  'universe:failed': { universeId: string; symbol: string; error: string; restartCount: number };
  'universe:restarted': { universeId: string; symbol: string; restartCount: number };

  'pollen:created': { pollen: Pollen };
  'pollen:injected': { pollenId: string; targetUniverseId: string; targetSymbol: string };
  'pollen:applied': { pollenId: string; targetUniverseId: string; mutation: string | null };
  'pollen:rejected': { pollenId: string; targetUniverseId: string; reason: string };

  'cycle:started': { cycleNumber: number };
  'cycle:completed': { cycleNumber: number; pollensCreated: number };

  'session:all-complete': { report: Report };
  'session:timeout': { elapsedMs: number };
  'session:cost-limit': { totalCostUsd: number; limitUsd: number };
  'session:error': { error: string };
}
```

---

## Config File Types

### GlobalConfig (`~/.supe/config.json`)

```typescript
interface GlobalConfig {
  defaultAgent: AgentType;
  agents: Record<AgentType, AgentConfig>;
  slack: SlackConfig;
  pollen: PollenConfig;
  session: SessionDefaults;
  llm: LlmConfig;
}

interface AgentConfig {
  command: string;                // 실행 파일 이름 (예: "claude")
  args: string[];                 // 기본 인자 (예: ["--dangerously-skip-permissions"])
  maxCostPerUniverse: number;     // USD
}

interface SlackConfig {
  botToken: string;               // xoxb-...
  appToken: string;               // xapp-...
  defaultChannel: string;         // 채널 ID (예: "C0123456789")
}

interface PollenConfig {
  cycleIntervalMinutes: number;
  maxPollensPerCycle: number;     // Universe당 한 Cycle에서 최대 추출 수
  minTimeBetweenInjectionsMinutes: number; // 같은 Universe에 연속 주입 방지
}

interface SessionDefaults {
  maxDurationHours: number;
  maxUniverses: number;
}

interface LlmConfig {
  analysisModel: string;          // Pollen 분석 등에 사용할 모델
  analysisProvider: 'anthropic' | 'openai';
  apiKey: string;                 // 환경변수 참조 가능 "${ANTHROPIC_API_KEY}"
}
```

---

## Spec File Format

사용자가 작성하는 `spec.md` 파일의 권장 형식. 자유 형식이지만, 아래 섹션을 포함하면 파싱 품질이 향상된다.

```markdown
# [프로젝트/문제 제목]

## Problem
[해결하려는 문제를 구체적으로 설명]

## Constraints
- [제약 조건 1]
- [제약 조건 2]

## Desired Outputs
- [기대하는 산출물 1]
- [기대하는 산출물 2]

## Success Criteria
- [성공 기준 1]
- [성공 기준 2]

## Approaches (Optional)
사용자가 직접 Universe 분기를 지정할 수 있다.
지정하지 않으면 Supe가 자동 생성한다.

### Approach A: [이름]
[접근법 설명]

### Approach B: [이름]
[접근법 설명]

## Additional Context
[기타 배경 정보, 참조 링크 등]
```

---

## File Persistence Schema

### `session.json` 구조

```json
{
  "id": "ses_abc123def456",
  "status": "running",
  "spec": {
    "rawPath": "/Users/me/project/spec.md",
    "raw": "# My Project\n...",
    "parsed": { "...ParsedSpec..." }
  },
  "universes": [
    {
      "id": "univ_abcd1234",
      "config": { "...UniverseConfig..." },
      "status": "running",
      "workdir": "/Users/me/.supe/sessions/ses_abc123def456/universes/alpha",
      "progress": { "percentage": 65, "..." },
      "..."
    }
  ],
  "config": { "...SessionConfig..." },
  "slack": {
    "channel": "C0123456789",
    "mainMessageTs": "1707800000.000001",
    "threadTsMap": {
      "univ_abcd1234": "1707800001.000001",
      "univ_efgh5678": "1707800002.000001"
    }
  },
  "pollens": [],
  "report": null,
  "startedAt": "2026-02-28T22:00:00.000Z",
  "completedAt": null,
  "error": null
}
```

### `universe.json` 구조 (각 Universe workdir/.supe/ 내)

Universe Runner가 독립적으로 관리하는 상태 파일. Session Manager가 주기적으로 읽어서 session.json에 동기화.

```json
{
  "id": "univ_abcd1234",
  "status": "running",
  "progress": {
    "percentage": 65,
    "currentPhase": "인증 모듈 구현 중",
    "filesCreated": 12,
    "totalCommits": 23,
    "lastCommitMessage": "feat: add JWT middleware",
    "lastActivityAt": "2026-03-01T02:30:00.000Z",
    "estimatedCostUsd": 3.10
  },
  "agentProcess": {
    "pid": 12345,
    "iterationCount": 7,
    "lastIterationAt": "2026-03-01T02:25:00.000Z"
  },
  "restartCount": 0,
  "error": null
}
```

### `logs.jsonl` 구조 (각 Universe workdir/.supe/ 내)

JSONL 형식. 한 줄에 하나의 LogEntry.

```jsonl
{"timestamp":"2026-02-28T22:01:00.000Z","level":"info","source":"universe-runner","message":"Universe α started","data":null}
{"timestamp":"2026-02-28T22:01:05.000Z","level":"info","source":"agent-process","message":"Agent process spawned","data":{"pid":12345}}
{"timestamp":"2026-02-28T22:15:30.000Z","level":"info","source":"universe-runner","message":"Commit detected","data":{"message":"feat: initial project scaffolding","hash":"a1b2c3d"}}
```

### `pollens.json` 구조 (세션 레벨)

```json
[
  {
    "id": "pol_α_001",
    "sessionId": "ses_abc123def456",
    "sourceUniverseId": "univ_abcd1234",
    "sourceSymbol": "α",
    "title": "Hybrid Rate Limiter Pattern",
    "insight": "Rate limiting에서 sliding window와 token bucket을 결합한 하이브리드 접근...",
    "type": "pattern",
    "abstractionLevel": "pattern",
    "targets": [
      {
        "universeId": "univ_efgh5678",
        "universeSymbol": "β",
        "relevance": "high",
        "status": "adapted",
        "injectedAt": "2026-03-01T00:05:00.000Z",
        "appliedAt": "2026-03-01T00:45:00.000Z",
        "mutation": "Go channel 기반 원본을 Express middleware 패턴으로 변형 적용",
        "rejectionReason": null
      }
    ],
    "createdAt": "2026-03-01T00:00:00.000Z",
    "cycleNumber": 3,
    "sourceDiffSummary": "rate-limiter.go 추가, middleware 체인에 등록"
  }
]
```
