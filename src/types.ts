/**
 * Complete TypeScript type definitions for Supe
 * All interfaces from DATA_MODELS.md plus improvement types
 */

// ============================================================================
// CORE SESSION TYPES
// ============================================================================

export interface Session {
  id: string; // 형식: "ses_{nanoid(12)}"
  status: SessionStatus;
  spec: {
    rawPath: string; // 원본 spec.md 경로
    raw: string; // 원본 spec.md 내용
    parsed: ParsedSpec; // LLM으로 파싱된 구조화 데이터
  };
  universes: Universe[];
  config: SessionConfig;
  slack: SessionSlackState | null; // --no-slack이면 null
  pollens: Pollen[];
  report: Report | null; // 완료 후 생성
  startedAt: string; // ISO 8601
  completedAt: string | null; // ISO 8601
  error: string | null;
}

export type SessionStatus =
  | 'initializing'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface SessionConfig {
  maxUniverses: number; // 기본값: 3, 범위: 2~10 (Stability 참고)
  defaultAgent: AgentType; // 기본값: 'claude'
  baseRepoPath: string | null; // null이면 빈 디렉토리에서 시작
  maxDurationMs: number; // 기본값: 36_000_000 (10시간)
  maxCostUsd: number; // 기본값: 30.0 (세션 전체)
  maxCostPerUniverseUsd: number; // 기본값: 10.0 (Universe당)
  pollenIntervalMs: number; // 기본값: 300_000 (5분)
  pollenEnabled: boolean; // 기본값: true
  slackEnabled: boolean; // 기본값: true
  slackChannel: string; // 기본값: config.json의 defaultChannel
}

export type AgentType = 'claude' | 'codex';

export interface SessionSlackState {
  channel: string; // Slack 채널 ID
  mainMessageTs: string; // 세션 메인 메시지의 ts (timestamp)
  threadTsMap: Record<string, string>; // universe.id → thread ts 매핑
}

// ============================================================================
// SPEC TYPES
// ============================================================================

export interface ParsedSpec {
  title: string; // 프로젝트/문제 제목
  problemStatement: string; // 해결하려는 핵심 문제
  constraints: string[]; // 제약 조건 목록
  desiredOutputs: string[]; // 기대하는 산출물 목록
  successCriteria: string[]; // 성공 기준
  domain: SpecDomain; // 도메인 분류
  additionalContext: string; // 기타 맥락 정보
  outOfScope: string[]; // 명시적 제외 범위
  assumptions: string[]; // 시스템이 채운 가정
  problemContract: ProblemContract; // 유니버스 전체에 고정되는 문제 계약
  universeConfigs: UniverseConfig[]; // 생성된 Universe 접근법들
}

export interface ProblemContract {
  problemStatement: string;
  requiredOutputs: string[];
  hardConstraints: string[];
  successCriteria: string[];
  outOfScope: string[];
  assumptions: string[];
}

export type SpecDomain =
  | 'software-development'
  | 'marketing'
  | 'business-strategy'
  | 'content-creation'
  | 'research'
  | 'design'
  | 'other';

export interface UniverseConfig {
  name: string; // 예: "미니멀 Go+HTMX"
  symbol: string; // α, β, γ, δ, ε 중 하나
  approach: string; // 접근법 상세 설명 (2-3문장)
  optimizationAxis: string; // 이 Universe가 최적화하는 축 (예: "속도", "기능 완성도")
  tools: string[]; // 사용 도구/스택 (예: ["Go", "HTMX", "SQLite"])
  agent: AgentType; // 이 Universe에 할당된 에이전트
  estimatedStrength: string; // 예상 강점
  estimatedWeakness: string; // 예상 약점
}

// ============================================================================
// UNIVERSE TYPES
// ============================================================================

export interface Universe {
  id: string; // 형식: "univ_{nanoid(8)}"
  sessionId: string;
  config: UniverseConfig;
  status: UniverseStatus;
  workdir: string; // 절대 경로: ~/.supe/sessions/{sid}/universes/{symbol}/
  gitBranch: string; // "universe/{symbol}" (예: "universe/alpha")
  promptPath: string; // workdir 내 PROMPT.md 경로
  agentProcess: AgentProcessState;
  progress: UniverseProgress;
  metrics: UniverseMetrics | null; // 완료 후 수집
  logs: LogEntry[]; // 메모리에 최근 N개만 유지, 전체는 logs.jsonl
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  restartCount: number; // 재시작 횟수 (최대 3)
  pendingPollens: Pollen[]; // Pollens injected but not yet shown to agent
}

export type UniverseStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'stopped';

export interface AgentProcessState {
  pid: number | null;
  command: string; // 예: "claude"
  args: string[]; // 예: ["--dangerously-skip-permissions"]
  startedAt: string | null;
  iterationCount: number; // Ralph 루프 반복 횟수
  lastIterationAt: string | null;
}

export interface UniverseProgress {
  percentage: number; // 0~100, 추정치
  currentPhase: string; // 예: "인증 모듈 구현 중"
  filesCreated: number;
  totalCommits: number;
  lastCommitMessage: string;
  lastActivityAt: string; // ISO 8601
  estimatedCostUsd: number;
  criteriaProgress: CriterionStatus[]; // NEW: Iteration context
}

export interface UniverseMetrics {
  // 공통 메트릭
  totalFiles: number;
  totalCommits: number;
  durationMs: number;
  estimatedCostUsd: number;
  pollenEmitted: number; // 이 Universe에서 생성된 Pollen 수
  pollenReceived: number; // 이 Universe가 수신한 Pollen 수
  pollenApplied: number; // 수신한 Pollen 중 적용된 수

  // 개발 시나리오 메트릭 (domain이 software-development일 때)
  linesOfCode: number | null;
  testsPassed: number | null;
  testsTotal: number | null;
  buildSuccess: boolean | null;
  buildTimeMs: number | null;

  // 비개발 시나리오 메트릭
  documentPages: number | null; // 문서 페이지 수 추정
  sectionCount: number | null; // 문서 섹션 수
  referenceSources: number | null; // 참조 소스 수
}

// ============================================================================
// POLLEN TYPES
// ============================================================================

export interface Pollen {
  id: string; // 형식: "pol_{sourceSymbol}_{순번3자리}" (예: "pol_α_007")
  sessionId: string;
  sourceUniverseId: string;
  sourceSymbol: string; // α, β, γ 등

  // 내용
  title: string; // 한 줄 요약 (예: "Hybrid Rate Limiter Pattern")
  insight: string; // 상세 인사이트 (2-5문장)
  type: PollenType;
  abstractionLevel: PollenAbstractionLevel;

  // 전파 상태
  targets: PollenTarget[];

  // 메타
  createdAt: string; // ISO 8601
  cycleNumber: number; // 몇 번째 Pollen Cycle에서 생성되었는지
  sourceDiffSummary: string; // 이 Pollen을 트리거한 변경사항 요약
  sourceEvaluation: PollenSourceEvaluation | null; // 공유/경고/거부 판단 근거
}

export type PollenType =
  | 'pattern' // 재사용 가능한 설계 패턴
  | 'data' // 발견된 데이터/팩트
  | 'strategy' // 전략적 접근법
  | 'warning'; // 실패/함정 경고

export type PollenAbstractionLevel =
  | 'concept' // 순수 아이디어 수준 (가장 추상적)
  | 'pattern' // 패턴 수준 (구현 방식은 자유)
  | 'technique'; // 구체적 기법 수준 (특정 구현에 가까움)

export interface PollenTarget {
  universeId: string;
  universeSymbol: string;
  relevance: 'high' | 'medium' | 'low';
  status: PollenTargetStatus;
  injectedAt: string | null; // 주입 시각
  appliedAt: string | null; // 적용 확인 시각
  mutation: string | null; // 어떻게 변형되어 적용되었는지 설명
  rejectionReason: string | null; // 거부된 경우 이유
  evaluation: PollenTargetEvaluation | null; // 타겟 적합성 판단 근거
}

export type PollenTargetStatus =
  | 'pending' // 아직 주입 전
  | 'injected' // 주입됨, 적용 여부 미확인
  | 'applied' // 적용 확인됨
  | 'adapted' // 변형되어 적용됨
  | 'rejected' // 관련성 낮아 주입 안 함
  | 'skipped'; // 타이밍 제한으로 이번 Cycle에서 스킵

// ============================================================================
// REPORT TYPES
// ============================================================================

export interface Report {
  sessionId: string;
  generatedAt: string; // ISO 8601
  summary: string; // LLM이 생성한 종합 요약 (3-5문장)

  universeResults: UniverseResult[];

  rankings: RankingCategory[];

  pollenStats: PollenStats;

  comparisonSummary: {
    headline: string; // 전체 차이를 요약하는 한 줄
    differences: string[]; // 유니버스 간 핵심 차이점 목록
  };
}

export interface UniverseResult {
  universeId: string;
  symbol: string;
  name: string;
  status: UniverseStatus;
  approach: string;
  optimizationAxis: string;
  tools: string[];
  estimatedStrength: string;
  estimatedWeakness: string;
  metrics: UniverseMetrics | null;
  highlights: string[]; // 이 Universe의 주목할 점 (2-3개)
}

export interface RankingCategory {
  category: string; // 예: "효율성", "완성도", "확장성", "비용 대비 성과"
  rankings: {
    rank: number;
    universeId: string;
    universeSymbol: string;
    score: string; // 해당 카테고리의 점수/설명
  }[];
}

export interface PollenStats {
  totalCreated: number;
  totalApplied: number;
  totalAdapted: number;
  totalRejected: number;
  mostActiveSource: string; // 가장 많은 Pollen을 생성한 Universe symbol
  mostInfluenced: string; // 가장 많은 Pollen을 수신/적용한 Universe symbol
  notableEntanglements: {
    pollenId: string;
    description: string; // "α의 rate limiter 패턴이 β에서 middleware로 변형"
  }[];
}

// ============================================================================
// LOG TYPES
// ============================================================================

export interface LogEntry {
  timestamp: string; // ISO 8601
  level: 'info' | 'warn' | 'error' | 'debug';
  source: LogSource;
  universeId: string | null; // 세션 레벨 로그면 null
  message: string;
  data: Record<string, unknown> | null; // 추가 데이터
}

export type LogSource =
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

// ============================================================================
// EVENT TYPES
// ============================================================================

export interface SessionEvents {
  'universe:started': { universeId: string; symbol: string };
  'universe:progress': {
    universeId: string;
    symbol: string;
    progress: UniverseProgress;
  };
  'universe:completed': {
    universeId: string;
    symbol: string;
    metrics: UniverseMetrics;
  };
  'universe:failed': {
    universeId: string;
    symbol: string;
    error: string;
    restartCount: number;
  };
  'universe:restarted': { universeId: string; symbol: string; restartCount: number };

  'pollen:created': { pollen: Pollen };
  'pollen:injected': {
    pollenId: string;
    targetUniverseId: string;
    targetSymbol: string;
  };
  'pollen:applied': {
    pollenId: string;
    targetUniverseId: string;
    mutation: string | null;
  };
  'pollen:rejected': {
    pollenId: string;
    targetUniverseId: string;
    reason: string;
  };

  'cycle:started': { cycleNumber: number };
  'cycle:completed': { cycleNumber: number; pollensCreated: number };

  'session:all-complete': { report: Report };
  'session:timeout': { elapsedMs: number };
  'session:cost-limit': { totalCostUsd: number; limitUsd: number };
  'session:error': { error: string };
}

// ============================================================================
// CONFIG FILE TYPES
// ============================================================================

export interface GlobalConfig {
  defaultAgent: AgentType;
  agents: Record<AgentType, AgentConfig>;
  slack: SlackConfig;
  pollen: PollenConfig;
  session: SessionDefaults;
  llm: LlmConfig;
}

export interface AgentConfig {
  command: string; // 실행 파일 이름 (예: "claude")
  args: string[]; // 기본 인자 (예: ["--dangerously-skip-permissions"])
  maxCostPerUniverse: number; // USD
}

export interface SlackConfig {
  botToken: string; // xoxb-...
  appToken: string; // xapp-...
  defaultChannel: string; // 채널 ID (예: "C0123456789")
}

export interface PollenConfig {
  cycleIntervalMinutes: number;
  maxPollensPerCycle: number; // Universe당 한 Cycle에서 최대 추출 수
  minTimeBetweenInjectionsMinutes: number; // 같은 Universe에 연속 주입 방지
}

export interface SessionDefaults {
  maxDurationHours: number;
  maxUniverses: number;
}

export interface LlmConfig {
  analysisModel: string; // Pollen 분석 등에 사용할 모델
  analysisProvider: 'anthropic-api' | 'claude-cli' | 'codex-cli';
  apiKey: string; // 환경변수 참조 가능 "${ANTHROPIC_API_KEY}"
}

// ============================================================================
// NEW IMPROVEMENT TYPES
// ============================================================================

/**
 * Iteration context for dynamic agent prompts
 * Tracks progress through success criteria and pending work
 */
export interface IterationContext {
  iterationNumber: number;
  previousResult: 'success' | 'failed' | 'first';
  criteriaStatus: CriterionStatus[];
  pendingPollens: Pollen[];
  filesCount: number;
  commitsCount: number;
}

/**
 * Status of a single success criterion
 */
export interface CriterionStatus {
  criterion: string;
  status: 'not_started' | 'in_progress' | 'likely_done' | 'verified';
  evidence: string;
}

/**
 * Diversity validation for Universe approaches
 */
export interface DiversityCheck {
  isDiverse: boolean;
  overlapScore: number;
  problematicPairs: { a: string; b: string; reason: string }[];
  suggestions: string[];
}

export type ClarificationField =
  | 'desiredOutputs'
  | 'successCriteria'
  | 'constraints'
  | 'outOfScope';

export interface ClarificationQuestion {
  id: ClarificationField;
  prompt: string;
  why: string;
}

export interface AmbiguityAssessment {
  requiresClarification: boolean;
  blockingReasons: string[];
  questions: ClarificationQuestion[];
  assumptions: string[];
}

export interface AnalystRubricScores {
  transferability: number;
  constraintFit: number;
  evidenceStrength: number;
  riskSeverity: number;
}

export type PollenJudgement = 'share' | 'warning' | 'reject';

export interface PollenSourceEvaluation extends AnalystRubricScores {
  judgement: PollenJudgement;
  rationale: string;
}

export interface PollinationRubricScores {
  relevanceToTarget: number;
  constraintFit: number;
  diversityFit: number;
  timeliness: number;
}

export interface PollenTargetEvaluation extends PollinationRubricScores {
  finalRelevance: 'high' | 'medium' | 'low';
  reason: string;
}

/**
 * Pollen response from agent (parsed from POLLEN_RESPONSE.md)
 */
export interface PollenResponse {
  pollenId: string;
  title: string;
  decision: 'applied' | 'adapted' | 'skipped';
  detail: string; // how it was applied/adapted, or reason for skipping
}

/**
 * Discovery entry from agent (parsed from DISCOVERY.md)
 */
export interface DiscoveryEntry {
  title: string;
  insight: string;
  type: PollenType;
}

/**
 * Stability levels for Universe execution
 */
export type StabilityLevel =
  | 'STABLE'
  | 'MINOR_FLUCTUATION'
  | 'UNSTABLE'
  | 'CRITICAL'
  | 'COLLAPSE_IMMINENT'
  | 'REJECTED';

/**
 * Stability check result
 */
export interface StabilityCheck {
  level: StabilityLevel;
  message: string;
  requiresConfirmation: boolean;
}
