# Universe Runner

> 단일 Universe의 에이전트 실행 루프를 관리한다. Ralph Loop 패턴을 기반으로 하되, Supe에 맞게 확장한다.

---

## 파일: `src/universe/runner.ts`

---

## Lifecycle

```
UniverseRunner
  │
  ├── setup()        → workdir 생성, git init, PROMPT.md 생성
  ├── start()        → 에이전트 프로세스 시작, 루프 진입
  ├── [loop]         → Ralph 스타일 반복 실행
  │   ├── 에이전트 1회 실행
  │   ├── 결과 확인 (완료? 에러?)
  │   ├── 진행상황 업데이트
  │   └── 다음 반복 또는 종료
  ├── stop()         → 정상 종료 (비용 한도, 타임아웃, 사용자 취소)
  └── getMetrics()   → 완료 후 메트릭 수집
```

---

## Setup Phase

```typescript
async setup(universe: Universe, session: Session): Promise<void>
```

### 1. 작업 디렉토리 생성

```
경로: ~/.supe/sessions/{session.id}/universes/{universe.config.symbol}/
```

디렉토리 구조:
```
{symbol}/
├── .supe/
│   ├── universe.json     # Universe 상태 파일
│   ├── logs.jsonl        # 이벤트 로그
│   └── pollens/          # 수신한 Pollen 원본 보관 (참조용)
├── PROMPT.md             # 에이전트에게 전달할 메인 프롬프트
├── .gitignore            # .supe/ 디렉토리 제외
└── (에이전트가 생성할 파일들)
```

### 2. Git 초기화

```typescript
const git = simpleGit(universe.workdir);
await git.init();
await git.checkoutLocalBranch(`universe/${universe.config.symbol}`);
// .gitignore 생성: .supe/ 디렉토리 제외
await writeFile(join(universe.workdir, '.gitignore'), '.supe/\n');
await git.add('.gitignore');
await git.commit('init: universe setup');
```

### 3. PROMPT.md 생성

Handlebars 템플릿(`templates/universe-prompt.md.hbs`)을 사용하여 생성한다.

#### 템플릿 변수

| 변수 | 소스 |
|------|------|
| `problemStatement` | `session.spec.parsed.problemStatement` |
| `constraints` | `session.spec.parsed.constraints` |
| `desiredOutputs` | `session.spec.parsed.desiredOutputs` |
| `successCriteria` | `session.spec.parsed.successCriteria` |
| `additionalContext` | `session.spec.parsed.additionalContext` |
| `approach` | `universe.config.approach` |
| `tools` | `universe.config.tools` |
| `optimizationAxis` | `universe.config.optimizationAxis` |
| `domain` | `session.spec.parsed.domain` |

#### 템플릿 내용 (`templates/universe-prompt.md.hbs`)

```markdown
# Universe {{config.symbol}}: {{config.name}}

## Problem to Solve
{{problemStatement}}

## Your Approach
You are taking the following approach to solve this problem:
{{approach}}

{{#if tools.length}}
## Recommended Tools / Stack
{{#each tools}}- {{this}}
{{/each}}
{{/if}}

## Optimization Axis
Your primary optimization goal: **{{optimizationAxis}}**
Other approaches are optimizing for different axes. Focus on yours.

## Constraints
{{#each constraints}}- {{this}}
{{/each}}

## Desired Outputs
{{#each desiredOutputs}}- {{this}}
{{/each}}

## Success Criteria
{{#each successCriteria}}- {{this}}
{{/each}}

{{#if additionalContext}}
## Additional Context
{{additionalContext}}
{{/if}}

## Working Rules

1. Work autonomously. Do not ask for user input or confirmation.
2. Commit your work frequently with descriptive commit messages.
3. Create a README.md explaining what you built and how to use it.
4. If you encounter a blocker, document it in BLOCKERS.md and move on to the next task.
5. When all success criteria are met, create a file called DONE.md with a summary of what was accomplished.

## Completion Signal
When you believe all work is complete, create a file named `DONE.md` at the project root.
This signals the orchestrator that this Universe has finished.

{{!-- Cross-Pollination Hints will be appended here by Pollinator --}}
```

### 4. 초기 커밋

```typescript
await git.add('PROMPT.md');
await git.commit('init: universe prompt');
```

### 5. 상태 초기화

`universe.json`에 초기 상태를 저장:
```json
{
  "id": "univ_...",
  "status": "pending",
  "progress": {
    "percentage": 0,
    "currentPhase": "Setup complete, waiting to start",
    "filesCreated": 0,
    "totalCommits": 1,
    "lastCommitMessage": "init: universe prompt",
    "lastActivityAt": "...",
    "estimatedCostUsd": 0
  },
  "agentProcess": { "pid": null, "iterationCount": 0 },
  "restartCount": 0,
  "error": null
}
```

---

## Execution Loop (Ralph-Style)

### 핵심 루프

```typescript
async start(universe: Universe): Promise<void> {
  universe.status = 'running';
  this.emit('universe:started', { universeId: universe.id, symbol: universe.config.symbol });

  while (true) {
    // 종료 조건 확인
    if (await this.shouldStop(universe)) break;

    // 에이전트 1회 실행
    await this.runAgentIteration(universe);

    // 진행상황 업데이트
    await this.updateProgress(universe);

    // 완료 확인 (DONE.md 존재 여부)
    if (await this.isComplete(universe)) {
      universe.status = 'completed';
      break;
    }

    // 다음 반복 전 짧은 대기 (에이전트 프로세스 정리 시간)
    await sleep(2000);
  }

  // 메트릭 수집
  universe.metrics = await this.collectMetrics(universe);
  
  // 상태 persist
  await this.saveState(universe);
  
  this.emit('universe:completed', {
    universeId: universe.id,
    symbol: universe.config.symbol,
    metrics: universe.metrics
  });
}
```

### 에이전트 1회 실행 (`runAgentIteration`)

```typescript
async runAgentIteration(universe: Universe): Promise<void> {
  const agentConfig = this.getAgentConfig(universe.config.agent);
  
  // 에이전트 실행 인자 구성
  const args = this.buildAgentArgs(agentConfig, universe);
  
  // 프로세스 spawn
  const proc = spawn(agentConfig.command, args, {
    cwd: universe.workdir,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env }
  });

  universe.agentProcess.pid = proc.pid;
  universe.agentProcess.iterationCount++;
  universe.agentProcess.lastIterationAt = new Date().toISOString();

  // stdout/stderr 수집 (로그용)
  let stdout = '';
  let stderr = '';
  
  proc.stdout.on('data', (data: Buffer) => {
    stdout += data.toString();
    // 마지막 줄을 currentPhase로 사용
    const lines = data.toString().trim().split('\n');
    universe.progress.currentPhase = lines[lines.length - 1].slice(0, 100);
  });
  
  proc.stderr.on('data', (data: Buffer) => {
    stderr += data.toString();
  });

  // 프로세스 완료 대기
  const exitCode = await new Promise<number>((resolve) => {
    proc.on('close', (code) => resolve(code ?? 1));
  });

  // 로그 기록
  this.appendLog(universe, {
    level: exitCode === 0 ? 'info' : 'warn',
    source: 'agent-process',
    message: `Agent iteration ${universe.agentProcess.iterationCount} exited with code ${exitCode}`,
    data: {
      exitCode,
      durationMs: Date.now() - new Date(universe.agentProcess.lastIterationAt!).getTime(),
      stdoutTail: stdout.slice(-500),
      stderrTail: stderr.slice(-500)
    }
  });

  universe.agentProcess.pid = null;
}
```

### 에이전트 인자 구성 (`buildAgentArgs`)

```typescript
buildAgentArgs(agentConfig: AgentConfig, universe: Universe): string[] {
  const agent = universe.config.agent;
  
  if (agent === 'claude') {
    // Claude Code: PROMPT.md의 내용을 stdin으로 전달하는 대신
    // --print 모드로 PROMPT.md를 참조하여 실행
    return [
      ...agentConfig.args,           // ["--dangerously-skip-permissions"]
      '--print',                      // non-interactive 모드
      `Read PROMPT.md and continue working on the project. 
       Check what has been done so far (look at existing files and git log).
       Continue from where you left off. 
       If all success criteria are met, create DONE.md.`
    ];
  }
  
  if (agent === 'codex') {
    return [
      ...agentConfig.args,
      '--prompt',
      `Read PROMPT.md and continue working on the project.
       Check what has been done so far. Continue from where you left off.
       If all success criteria are met, create DONE.md.`
    ];
  }
  
  throw new Error(`Unknown agent type: ${agent}`);
}
```

### 종료 조건 (`shouldStop`)

```typescript
async shouldStop(universe: Universe): boolean {
  // 1. 비용 한도 초과
  if (universe.progress.estimatedCostUsd >= this.config.maxCostPerUniverseUsd) {
    this.appendLog(universe, {
      level: 'warn',
      source: 'universe-runner',
      message: `Cost limit reached: $${universe.progress.estimatedCostUsd}`
    });
    universe.status = 'stopped';
    universe.error = 'Cost limit exceeded';
    return true;
  }

  // 2. 재시작 횟수 초과 (연속 실패)
  // 주의: restartCount는 연속 실패 시에만 증가. 성공적 iteration 후에는 리셋.
  if (universe.restartCount >= 3) {
    universe.status = 'failed';
    universe.error = 'Max restarts exceeded (3 consecutive failures)';
    return true;
  }

  // 3. 외부 중단 시그널 (Orchestrator가 세션 타임아웃 또는 취소 시 설정)
  if (universe.status === 'stopped' || universe.status === 'cancelled') {
    return true;
  }

  return false;
}
```

### 완료 감지 (`isComplete`)

```typescript
async isComplete(universe: Universe): boolean {
  // DONE.md 파일 존재 여부 확인
  const donePath = join(universe.workdir, 'DONE.md');
  try {
    await access(donePath);
    return true;
  } catch {
    return false;
  }
}
```

---

## Progress Update

```typescript
async updateProgress(universe: Universe): Promise<void> {
  const git = simpleGit(universe.workdir);
  
  // 커밋 수
  const log = await git.log();
  universe.progress.totalCommits = log.total;
  universe.progress.lastCommitMessage = log.latest?.message ?? '';
  
  // 파일 수 (git ls-files)
  const files = await git.raw(['ls-files']);
  universe.progress.filesCreated = files.trim().split('\n').filter(Boolean).length;
  
  // 진행률 추정 (단순 휴리스틱)
  // DONE.md가 없는 상태에서, 커밋 수와 파일 수를 기반으로 대략적 추정
  // 실제로는 정확하지 않으나, 대시보드 표시용으로 충분
  const commitProgress = Math.min(universe.progress.totalCommits * 3, 80); // 커밋당 3%, 최대 80%
  universe.progress.percentage = Math.min(commitProgress, 95); // 95%까지만 (DONE.md로 100%)
  
  // 활동 시간 업데이트
  universe.progress.lastActivityAt = new Date().toISOString();
  
  // 비용 추정 (iteration 수 기반 대략적 추정)
  // Claude Code: iteration당 약 $0.50~1.50 (입력 토큰 기반)
  // 정밀한 비용은 에이전트 CLI가 제공하지 않으므로 iteration 기반 추정
  universe.progress.estimatedCostUsd = universe.agentProcess.iterationCount * 0.80;
  
  // 상태 파일 persist
  await this.saveState(universe);
  
  // 이벤트 발행
  this.emit('universe:progress', {
    universeId: universe.id,
    symbol: universe.config.symbol,
    progress: universe.progress
  });
}
```

---

## Error Handling & Restart

```typescript
// runAgentIteration이 에러로 종료된 경우 (exitCode !== 0)
handleAgentFailure(universe: Universe, exitCode: number): void {
  universe.restartCount++;
  
  this.appendLog(universe, {
    level: 'error',
    source: 'universe-runner',
    message: `Agent process failed (exit: ${exitCode}), restart ${universe.restartCount}/3`
  });
  
  this.emit('universe:failed', {
    universeId: universe.id,
    symbol: universe.config.symbol,
    error: `Exit code ${exitCode}`,
    restartCount: universe.restartCount
  });
  
  // restartCount는 연속 실패를 추적.
  // 성공적인 iteration 후에는 리셋해야 한다.
}

// 성공적인 iteration 후
handleAgentSuccess(universe: Universe): void {
  // 연속 실패 카운터 리셋
  universe.restartCount = 0;
}
```

성공/실패 판단 기준:
- 에이전트 프로세스가 exit code 0으로 종료 → 성공 (git diff에 변경이 있든 없든)
- 에이전트 프로세스가 exit code != 0으로 종료 → 실패
- 에이전트 프로세스가 시그널로 종료 (SIGTERM, SIGKILL) → 외부 중단, 실패로 처리하지 않음

---

## Metrics Collection

Universe 완료(또는 중단) 후 최종 메트릭을 수집한다.

```typescript
async collectMetrics(universe: Universe): Promise<UniverseMetrics> {
  const workdir = universe.workdir;
  const git = simpleGit(workdir);
  const domain = this.session.spec.parsed.domain;
  
  // 공통 메트릭
  const log = await git.log();
  const files = await git.raw(['ls-files']);
  const fileList = files.trim().split('\n').filter(Boolean);
  
  const metrics: UniverseMetrics = {
    totalFiles: fileList.length,
    totalCommits: log.total,
    durationMs: Date.now() - new Date(universe.startedAt!).getTime(),
    estimatedCostUsd: universe.progress.estimatedCostUsd,
    pollenEmitted: this.countPollensEmitted(universe.id),
    pollenReceived: this.countPollensReceived(universe.id),
    pollenApplied: this.countPollensApplied(universe.id),
    
    // 기본값 null (도메인에 따라 채움)
    linesOfCode: null,
    testsPassed: null,
    testsTotal: null,
    buildSuccess: null,
    buildTimeMs: null,
    documentPages: null,
    sectionCount: null,
    referenceSources: null,
  };
  
  if (domain === 'software-development') {
    // LoC 계산: git ls-files로 파일 목록 → wc -l 합산
    // cloc이 설치되어 있으면 cloc 사용, 없으면 단순 라인 수
    try {
      const clocResult = execSync('cloc --json .', { cwd: workdir });
      const cloc = JSON.parse(clocResult.toString());
      metrics.linesOfCode = cloc?.SUM?.code ?? null;
    } catch {
      // cloc 없으면 단순 라인 수
      let totalLines = 0;
      for (const file of fileList) {
        try {
          const content = await readFile(join(workdir, file), 'utf-8');
          totalLines += content.split('\n').length;
        } catch { /* skip binary files */ }
      }
      metrics.linesOfCode = totalLines;
    }
    
    // 빌드 시도 (package.json이 있으면 npm run build)
    try {
      const startBuild = Date.now();
      execSync('npm run build', { cwd: workdir, timeout: 60_000 });
      metrics.buildSuccess = true;
      metrics.buildTimeMs = Date.now() - startBuild;
    } catch {
      metrics.buildSuccess = false;
    }
    
    // 테스트 시도 (npm test)
    try {
      const testOutput = execSync('npm test -- --json 2>/dev/null || true', { cwd: workdir });
      // Jest JSON 출력 파싱 시도
      // 실패하면 null 유지
    } catch {
      // 테스트 스크립트 없음 → null 유지
    }
  } else {
    // 비개발 시나리오
    // 마크다운 파일 수와 섹션(## heading) 수 카운트
    let totalSections = 0;
    let totalPages = 0;
    
    for (const file of fileList) {
      if (file.endsWith('.md') && file !== 'PROMPT.md' && file !== 'DONE.md') {
        try {
          const content = await readFile(join(workdir, file), 'utf-8');
          const headings = content.match(/^#{1,3}\s/gm);
          totalSections += headings?.length ?? 0;
          // 페이지 추정: 3000자 = 1페이지
          totalPages += Math.ceil(content.length / 3000);
        } catch { /* skip */ }
      }
    }
    
    metrics.documentPages = totalPages || null;
    metrics.sectionCount = totalSections || null;
  }
  
  return metrics;
}
```

---

## Prompt Builder (`src/universe/prompt-builder.ts`)

PROMPT.md를 생성하는 유틸리티.

```typescript
import Handlebars from 'handlebars';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const TEMPLATE_PATH = join(__dirname, '../../templates/universe-prompt.md.hbs');

export async function buildPrompt(
  universe: UniverseConfig,
  spec: ParsedSpec
): Promise<string> {
  const templateSrc = await readFile(TEMPLATE_PATH, 'utf-8');
  const template = Handlebars.compile(templateSrc);
  
  return template({
    config: universe,
    problemStatement: spec.problemStatement,
    constraints: spec.constraints,
    desiredOutputs: spec.desiredOutputs,
    successCriteria: spec.successCriteria,
    additionalContext: spec.additionalContext,
    domain: spec.domain,
    tools: universe.tools
  });
}
```

---

## State Persistence

Universe Runner는 자신의 상태를 독립적으로 persist한다.
Session Manager가 주기적으로 각 Universe의 `universe.json`을 읽어서 `session.json`에 동기화한다.

```typescript
async saveState(universe: Universe): Promise<void> {
  const statePath = join(universe.workdir, '.supe', 'universe.json');
  const state = {
    id: universe.id,
    status: universe.status,
    progress: universe.progress,
    agentProcess: {
      pid: universe.agentProcess.pid,
      iterationCount: universe.agentProcess.iterationCount,
      lastIterationAt: universe.agentProcess.lastIterationAt
    },
    restartCount: universe.restartCount,
    error: universe.error
  };
  await writeFile(statePath, JSON.stringify(state, null, 2));
}
```

### 로그 기록

```typescript
appendLog(universe: Universe, entry: Omit<LogEntry, 'timestamp' | 'universeId'>): void {
  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    universeId: universe.id,
    ...entry
  };
  
  // 메모리에 최근 100개만 유지
  universe.logs.push(logEntry);
  if (universe.logs.length > 100) {
    universe.logs = universe.logs.slice(-100);
  }
  
  // JSONL 파일에는 전체 append
  const logPath = join(universe.workdir, '.supe', 'logs.jsonl');
  appendFileSync(logPath, JSON.stringify(logEntry) + '\n');
}
```
