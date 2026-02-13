# CLI Specification

> `supe` CLI는 세션 생성, 모니터링, 리포트 조회를 위한 인터페이스다. ink(React for CLI)를 사용한 라이브 대시보드를 포함한다.

---

## 설치 및 실행

```bash
# 개발 모드
npx tsx src/index.ts <command>

# 빌드 후
npm run build
node dist/index.js <command>

# 글로벌 설치 (package.json bin 필드)
npm link
supe <command>
```

---

## Commands

### `supe run`

새 세션을 시작한다.

```
Usage: supe run [options]

Options:
  --spec <path>           (필수) 스펙 파일 경로
  --universes <number>    Universe 수 (기본: 3, 범위: 2~10)
  --agent <type>          기본 에이전트: claude | codex (기본: config의 defaultAgent)
  --agents <list>         Universe별 에이전트 (쉼표 구분, 예: claude,codex,claude)
  --timeout <duration>    최대 실행 시간 (예: 10h, 30m) (기본: 10h)
  --max-cost <usd>        세션 전체 비용 한도 (기본: $30)
  --pollen-interval <min> Cross-Pollination 주기 분 (기본: 30)
  --channel <id>          Slack 채널 ID (기본: config의 defaultChannel)
  --no-slack              Slack 비활성화
  --no-pollen             Cross-Pollination 비활성화
  --no-dashboard          라이브 대시보드 비활성화 (로그만 출력)
  --resume <session-id>   중단된 세션 재개
```

**실행 예시:**
```bash
# 기본 사용
supe run --spec ./strategy.md

# 커스텀 설정
supe run --spec ./app-spec.md --universes 4 --agents claude,codex,claude,claude --timeout 8h

# Slack 없이 CLI만
supe run --spec ./spec.md --no-slack

# 중단된 세션 재개
supe run --resume ses_abc123def456
```

**동작:**
1. spec 파일 읽기 + 파싱 (LLM)
2. **Multiverse Stability Check** (아래 참조)
3. N개 Universe config 생성 (LLM)
4. 디렉토리 구조 생성
5. Slack 초기화 (활성화 시)
6. 라이브 대시보드 시작 (활성화 시)
7. Orchestrator 시작 → N개 Universe 병렬 실행

---

### Multiverse Stability System

Universe 개수에 따라 시공간 안정성 경고를 표시한다. Supe의 세계관에서 너무 많은 평행우주를 동시에 여는 것은 현실의 안정성을 위협한다.

#### Stability Levels

| Universes | Stability | 메시지 |
|-----------|-----------|--------|
| 2~3 | `STABLE` | `🟢 Spacetime stable. {n} universes initialized.` |
| 4~5 | `MINOR_FLUCTUATION` | `🟡 Minor spacetime fluctuations detected. {n} universes is... ambitious. Proceeding.` |
| 6~7 | `UNSTABLE` | `🟠 WARNING: Spacetime fabric is stretching. {n} parallel realities may cause interdimensional interference. Your wallet might also feel the distortion. Proceed? (y/N)` |
| 8~9 | `CRITICAL` | `🔴 CRITICAL: The multiverse is groaning under the weight of {n} realities. Reality anchors failing. Cost projections are entering a dimension we can't calculate. Are you absolutely sure? (y/N)` |
| 10 | `COLLAPSE_IMMINENT` | `💀 SPACETIME COLLAPSE IMMINENT. 10 simultaneous universes has never been attempted. The last person who tried was never seen again. They say he still wanders between dimensions, mumbling about token costs. Final warning — proceed? (y/N)` |
| 11+ | `REJECTED` | `🕳️ Nice try. Even Supe has limits. The fabric of reality cannot sustain {n} universes. Maximum: 10. (The multiverse thanks you for your restraint.)` |

#### 구현

```typescript
// src/core/stability.ts

interface StabilityCheck {
  level: StabilityLevel;
  message: string;
  requiresConfirmation: boolean;
}

type StabilityLevel = 
  | 'STABLE' 
  | 'MINOR_FLUCTUATION' 
  | 'UNSTABLE' 
  | 'CRITICAL' 
  | 'COLLAPSE_IMMINENT' 
  | 'REJECTED';

function checkMultiverseStability(universeCount: number): StabilityCheck {
  if (universeCount > 10) {
    return {
      level: 'REJECTED',
      message: `🕳️  Nice try. Even Supe has limits. The fabric of reality cannot sustain ${universeCount} universes. Maximum: 10.\n   (The multiverse thanks you for your restraint.)`,
      requiresConfirmation: false  // 실행 자체를 거부
    };
  }
  if (universeCount >= 10) {
    return {
      level: 'COLLAPSE_IMMINENT',
      message: `💀 SPACETIME COLLAPSE IMMINENT\n   10 simultaneous universes has never been attempted.\n   The last person who tried was never seen again.\n   They say he still wanders between dimensions, mumbling about token costs.\n   Final warning — proceed? (y/N)`,
      requiresConfirmation: true
    };
  }
  if (universeCount >= 8) {
    return {
      level: 'CRITICAL',
      message: `🔴 CRITICAL: The multiverse is groaning under the weight of ${universeCount} realities.\n   Reality anchors failing. Cost projections entering an unknown dimension.\n   Are you absolutely sure? (y/N)`,
      requiresConfirmation: true
    };
  }
  if (universeCount >= 6) {
    return {
      level: 'UNSTABLE',
      message: `🟠 WARNING: Spacetime fabric is stretching.\n   ${universeCount} parallel realities may cause interdimensional interference.\n   Your wallet might also feel the distortion. Proceed? (y/N)`,
      requiresConfirmation: true
    };
  }
  if (universeCount >= 4) {
    return {
      level: 'MINOR_FLUCTUATION',
      message: `🟡 Minor spacetime fluctuations detected. ${universeCount} universes is... ambitious. Proceeding.`,
      requiresConfirmation: false
    };
  }
  return {
    level: 'STABLE',
    message: `🟢 Spacetime stable. ${universeCount} universes initialized.`,
    requiresConfirmation: false
  };
}
```

#### CLI에서의 사용

```typescript
// src/cli/commands/run.ts 내부

const stability = checkMultiverseStability(universeCount);
console.log(stability.message);

if (stability.level === 'REJECTED') {
  process.exit(1);
}

if (stability.requiresConfirmation) {
  const answer = await promptUser(''); // readline으로 y/N 입력 받기
  if (answer.toLowerCase() !== 'y') {
    console.log('🌌 Wise choice. The multiverse remains intact.');
    process.exit(0);
  }
  console.log('🌀 Brave soul. Opening rifts in spacetime...');
}
```

#### 대시보드에서의 표시

라이브 대시보드 HeaderBar에 현재 Stability Level을 아이콘으로 표시:

```
╔═══════════════════════ SUPERPOSITION ══════════════════════════════╗
║ 🟡 MINOR FLUCTUATION | Spec: 동남아 전략 | 4 universes | 3h 42m  ║
```

6개 이상일 때는 주기적으로 "시공간 미세 균열" 같은 유머러스한 로그가 끼어든다:

```
[02:47] ⚡ Interdimensional static detected between Universe δ and ε. 
        Don't worry, probably nothing.
[04:12] 🌀 Minor reality leak in Universe ζ. Self-healing in progress...
```

이 로그는 실제 기능에 영향 없이 순수 UX 유머 요소다.
Slack에서도 6개 이상일 때 가끔 메인 스레드에 비슷한 "시공간 이상 감지" 메시지를 포스팅한다.

### `supe status`

현재 실행 중인 세션(또는 지정 세션)의 상태를 조회한다.

```
Usage: supe status [session-id]

session-id를 생략하면 가장 최근 세션의 상태를 표시한다.
```

**출력 예시:**
```
Session: ses_abc123def456
Status:  running (3h 42m elapsed)
Spec:    동남아 진출 전략

Universe α (베트남 직진출)     ████████░░  78%  $3.10  12 files  23 commits
Universe β (싱가포르 허브)     ██████████ 100%  $2.80   8 files  18 commits  ✅
Universe γ (인도네시아 M&A)    ██████░░░░  55%  $2.30   9 files  15 commits

Pollens: 5 created, 3 applied, 1 adapted, 1 rejected
Next pollen cycle in: 12m
```

### `supe report`

세션의 Morning Report를 조회한다. 세션이 완료되지 않았으면 중간 리포트를 생성한다.

```
Usage: supe report [session-id]

session-id를 생략하면 가장 최근 세션의 리포트를 표시한다.
```

### `supe list`

모든 세션 목록을 조회한다.

```
Usage: supe list

출력:
  ID               Status     Spec                    Universes  Created
  ses_abc123...    completed  동남아 진출 전략           3/3       2h ago
  ses_def456...    running    실시간 채팅 앱             3/3       45m ago
```

### `supe stop`

실행 중인 세션을 정상 종료한다. 현재까지의 결과로 리포트를 생성한다.

```
Usage: supe stop [session-id]
```

### `supe init`

`~/.supe/config.json`을 대화형으로 생성한다.

```
Usage: supe init

질문:
  1. Default agent (claude/codex)?
  2. Claude Code command path?
  3. Slack Bot Token?
  4. Slack App Token?
  5. Default Slack channel?
  6. Anthropic API Key (for analysis)?
```

---

## Live Dashboard

`supe run` 실행 시 자동으로 표시되는 터미널 라이브 대시보드. ink(React for CLI) 기반.
우주/멀티버스 테마를 시각적으로 구현한다.

### 파일: `src/cli/dashboard.tsx`

### 디자인 시스템 — Space Theme

#### 컬러 팔레트

ink의 `color` 속성으로 터미널 컬러를 적용한다.

| 요소 | 색상 | ink 코드 | 용도 |
|------|------|----------|------|
| 배경 텍스트 (별) | dim white | `dimColor` | 빈 공간에 흩뿌린 별 `.` `·` `*` |
| 헤더/타이틀 | cyan | `color="cyan"` | SUPERPOSITION 타이틀, 섹션 헤더 |
| Universe Active | green | `color="green"` | 활성 Universe 테두리, 프로그레스 |
| Universe Stable | cyan | `color="cyan"` | 완료된 Universe |
| Universe Failed | red | `color="red"` | 실패한 Universe |
| Entanglement | magenta | `color="magenta"` | Pollen 이벤트, 연결선 |
| 경고/불안정 | yellow | `color="yellow"` | Stability 경고 |
| 비용 | dim yellow | `color="yellowBright"` | 토큰/비용 표시 |
| Ambient 메시지 | dim | `dimColor` | 세계관 분위기 메시지 |

#### 유니코드 문자 세트

```
테두리:  ┌ ─ ┐ │ └ ┘ (싱글) 또는 ╭ ─ ╮ │ ╰ ╯ (라운드)
별:      · ∙ * ✦ ✧ ⊹ ✶ ˚
포탈:    ◉ ◎ ⊕ ⊗ ⊙
프로그레스: ━━━━━╸━━━━ (활성: cyan/green, 비활성: dim)
연결선:  ┄┄┄ ╌╌╌ ···· (Entanglement 연결)
차원:    ◈ ◇ ◆
에너지:  ▰▱ 또는 ⣿⣀
```

### 레이아웃 — Space Observatory

```
  · ✦  ·    ·        ✧    ·      ·  ✦        ·    ·   ✧  ·     ·
      ·        ·  ╭─────────────────────────────────╮  ·       ·
  ·       ✧    ·  │  ✦  S U P E R P O S I T I O N  │     ·
     ·         ·  │     The Observer's Dashboard     │  ✧       ·
  ·    ·    ·     ╰─────────────────────────────────╯     ·   ·
 ─────────────────────────────────────────────────────────────────
  PROBLEM  동남아 진출 전략                     🟢 SPACETIME STABLE
  SESSION  ses_abc123       ELAPSED  3h 42m     COST  $8.20
  REALITIES  3 active       SCAN CYCLE  7       NEXT SCAN  12m
 ─────────────────────────────────────────────────────────────────
    ·    ·        ·    ·         ·    ·        ·    ·     ·
         ╭─── ◉ Universe α ───╮      ╭─── ✦ Universe β ───╮
    ·    │  베트남 직진출       │ ·    │  싱가포르 허브       │    ·
         │  Agent: Claude      │      │  Agent: GPT         │
         │                     │      │                     │
    ·    │  ━━━━━━━━╸━━  78%  │      │  ━━━━━━━━━━  100%  │    ·
         │  📁 12  📝 23      │ ┄┄┄┄ │  📁 8   📝 18      │
         │  💫 $3.10           │  ┄┄  │  💫 $2.80      ✦   │
    ·    │  규제 분석 중...     │      │  STABILIZED         │    ·
         ╰─────────────────────╯      ╰─────────────────────╯
              ·    │    ·                   ·    │   ·
                   ┆ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┆
              ·    │    ·         ·         ·   │  ·    ·
         ╭─── ◉ Universe γ ───╮
    ·    │  인도네시아 M&A      │    ·
         │  Agent: Claude      │
         │                     │         ·              ·
    ·    │  ━━━━━╸━━━━━  55%  │
         │  📁 9   📝 15      │              ·
         │  💫 $2.30           │    ·
    ·    │  M&A 후보 리서치...  │         ·         ·
         ╰─────────────────────╯
    ·        ·         ·    ·        ·    ·        ·
 ─────────────────────────────────────────────────────────────────
  🔗 ENTANGLEMENT LOG                              ·         ·
  ·
  23:47  🔗 α ━━▶ β,γ  "베트남 간편인증 규제 완화"         ✅ synced
  01:30  🔗 γ ━━▶ α    "동남아 밸류에이션 방법론"          🔄 mutated
  03:02  🔗 β ━━▶ α    "싱가포르 세금 혜택 데이터"         ⏳ pending
  ·                                                ·
  04:12  🌀 Minor reality leak near Universe γ. Self-healing...
    ·        ·         ·    ·        ·    ·        ·    ·
 ─────────────────────────────────────────────────────────────────
  [q]uit  [r]eport  [p]ollens  [s]tatus  [1-3] universe detail
  ·    ·        ·         ·    ·        ·    ·    ✧    ·     ·
```

### 디자인 요소 설명

#### 1. Star Field (별 배경)

빈 공간을 `·`, `✦`, `✧`, `*` 문자로 채워 우주 느낌을 연출한다.

```typescript
// 별 배경 생성기
const STAR_CHARS = ['·', '·', '·', '·', '✦', '✧', '*', ' ', ' ', ' ', ' ', ' '];

function generateStarLine(width: number): string {
  return Array.from({ length: width }, () => 
    STAR_CHARS[Math.floor(Math.random() * STAR_CHARS.length)]
  ).join('');
}
```

- 별은 `dimColor`로 렌더링하여 주요 정보와 시각적 구분
- 대시보드 갱신마다 별 위치가 미세하게 변경 → "반짝이는" 효과
- 너무 빽빽하지 않게 공백 비율을 50% 이상 유지

#### 2. Universe Card (차원 카드)

각 Universe를 라운드 박스로 표현. 상태에 따라 아이콘과 테두리 색상이 변경.

```tsx
function UniverseCard({ universe, index }: { universe: Universe; index: number }) {
  // 상태별 스타일
  const style = {
    pending:   { icon: '🫧', border: 'dim',    label: 'FORMING' },
    running:   { icon: '◉',  border: 'green',  label: '' },
    completed: { icon: '✦',  border: 'cyan',   label: 'STABILIZED' },
    failed:    { icon: '⊘',  border: 'red',    label: 'COLLAPSED' },
    stopped:   { icon: '❄️',  border: 'yellow', label: 'FROZEN' },
  }[universe.status];

  return (
    <Box 
      flexDirection="column" 
      width="33%" 
      borderStyle="round" 
      borderColor={style.border}
      padding={1}
    >
      <Text bold color={style.border}>
        {style.icon} [{index}] Universe {universe.config.symbol}
      </Text>
      <Text>{universe.config.name}</Text>
      <Text dimColor>Agent: {universe.config.agent}</Text>
      <SpaceProgressBar 
        percentage={universe.progress.percentage} 
        color={style.border}
      />
      <Text>
        <Text dimColor>{'📁'}</Text> {universe.progress.filesCreated}  
        <Text dimColor>{'📝'}</Text> {universe.progress.totalCommits}
      </Text>
      <Text color="yellowBright">{'💫'} ${universe.progress.estimatedCostUsd.toFixed(2)}</Text>
      {style.label ? (
        <Text bold color={style.border}>{style.label}</Text>
      ) : (
        <Text dimColor wrap="truncate">{universe.progress.currentPhase}</Text>
      )}
    </Box>
  );
}
```

#### 3. Space Progress Bar

일반 블록 대신 얇은 라인 스타일:

```tsx
function SpaceProgressBar({ percentage, color }: { percentage: number; color: string }) {
  const width = 20;
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  
  return (
    <Text>
      <Text color={color}>{'━'.repeat(filled)}</Text>
      <Text color={color}>{'╸'}</Text>
      <Text dimColor>{'━'.repeat(Math.max(0, empty - 1))}</Text>
      <Text> {percentage}%</Text>
    </Text>
  );
}
```

100% 완료 시:
```
━━━━━━━━━━━━━━━━━━━━ 100% ✦
```

#### 4. Entanglement 연결선

Universe 카드 사이에 점선(┄)으로 Entanglement 연결을 시각화한다.

```
         Universe α          ┄┄┄┄┄         Universe β
              │                                  │
              ┆ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄┆
              │                                  │
         Universe γ
```

- 점선은 `magenta` 색상 (Entanglement 전용 색상)
- 최근에 Entanglement가 발생한 연결은 더 밝게 (bold)
- 오래된 연결은 dim 처리

구현 방식: 정적 라인이 아니라, 최근 Pollen 이벤트의 source/target 관계를 분석하여 관련 Universe 쌍 사이에만 점선 표시.

```tsx
function EntanglementLines({ pollens, universes }: Props) {
  // 최근 5개 Pollen에서 source-target 쌍 추출
  const recentPairs = getRecentEntanglementPairs(pollens, 5);
  
  // Universe 위치(인덱스)를 기반으로 연결선 렌더링
  return (
    <Box justifyContent="center">
      {recentPairs.map(([sourceIdx, targetIdx]) => (
        <Text key={`${sourceIdx}-${targetIdx}`} color="magenta" dimColor>
          {renderConnectionLine(sourceIdx, targetIdx, universes.length)}
        </Text>
      ))}
    </Box>
  );
}
```

#### 5. Ambient Message Ticker

대시보드 하단 Entanglement 로그 영역에 세계관 분위기 메시지가 간헐적으로 끼어든다.

```tsx
function AmbientTicker({ session }: { session: Session }) {
  const [message, setMessage] = useState<string | null>(null);
  
  useEffect(() => {
    const interval = setInterval(() => {
      // 15~30분 랜덤 간격으로 표시
      if (Math.random() < 0.03) { // 약 30초마다 체크, 3% 확률
        setMessage(pickAmbientMessage(session));
      }
    }, 30_000);
    
    return () => clearInterval(interval);
  }, [session]);
  
  if (!message) return null;
  
  return (
    <Text dimColor italic>  {message}</Text>
  );
}
```

#### 6. Header Banner

```tsx
function HeaderBanner({ session }: { session: Session }) {
  const stability = checkMultiverseStability(session.universes.length);
  const stabilityIcon = {
    STABLE: '🟢',
    MINOR_FLUCTUATION: '🟡',
    UNSTABLE: '🟠',
    CRITICAL: '🔴',
    COLLAPSE_IMMINENT: '💀'
  }[stability.level];
  
  const stabilityLabel = {
    STABLE: 'SPACETIME STABLE',
    MINOR_FLUCTUATION: 'MINOR FLUCTUATION',
    UNSTABLE: 'UNSTABLE',
    CRITICAL: 'CRITICAL',
    COLLAPSE_IMMINENT: 'COLLAPSE IMMINENT'
  }[stability.level];
  
  return (
    <Box flexDirection="column">
      {/* 타이틀 */}
      <Box justifyContent="center">
        <Text color="cyan" bold>{'✦  S U P E R P O S I T I O N  ✦'}</Text>
      </Box>
      <Box justifyContent="center">
        <Text dimColor>The Observer's Dashboard</Text>
      </Box>
      
      {/* 상태 바 */}
      <Box justifyContent="space-between" marginTop={1}>
        <Text>
          <Text bold>PROBLEM</Text>  {session.spec.parsed.title}
        </Text>
        <Text>{stabilityIcon} {stabilityLabel}</Text>
      </Box>
      <Box justifyContent="space-between">
        <Text dimColor>
          SESSION {session.id}    ELAPSED {formatElapsed(session.startedAt)}    
          COST ${totalCost(session).toFixed(2)}
        </Text>
      </Box>
      <Box justifyContent="space-between">
        <Text dimColor>
          REALITIES {countActive(session)} active    
          SCAN CYCLE {currentCycle}    
          NEXT SCAN {formatCountdown(nextScanAt)}
        </Text>
      </Box>
    </Box>
  );
}
```

### Universe Detail View (우주 테마)

숫자 키를 눌러 특정 Universe를 확대 관찰하는 뷰:

```
  ·    ✧    ·         ·    ·         ·    ✦    ·         ·    ·
 ─────────────────────────────────────────────────────────────────
           ◉  OBSERVING UNIVERSE α — 베트남 직진출
 ─────────────────────────────────────────────────────────────────
  ·         ·    ·         ·         ·    ·         ·    ·
  AGENT      Claude                  STATUS    ACTIVE
  APPROACH   베트남 핀테크 시장 직진출,     PROGRESS  ━━━━━━━━╸━━ 78%
             현지법인 설립 전략             COMMITS   23
  OPTIMIZING 리스크 대비 리턴              FILES     12
                                         COST      $3.10
  ·         ·    ·         ·    ·         ·         ·    ·
 ─────────────────────────────────────────────────────────────────
  DIMENSIONAL LOG
  ·
  22:15  📝 feat: initial market research framework
  22:34  📝 feat: vietnam fintech regulation analysis
  23:02  📝 feat: add licensing requirements section
  23:47  🌸 Pollen received: "싱가포르 세금 혜택" from β
  00:15  📝 feat: incorporate tax treaty benefits (adapted from β)
  00:15  🔄 Pollen pol_β_002 adapted: "조세협약을 베트남 현지법인 구조에 적용"
  01:30  📝 feat: financial projections with tax optimization
  02:00  📡 Pollen emitted: "베트남 간편인증 규제 완화"
  02:45  📝 feat: risk analysis matrix
  ·
  🌀 This dimension is humming steadily. All systems nominal.
  ·         ·    ·         ·    ·         ·    ·    ✧    ·
 ─────────────────────────────────────────────────────────────────
  [ESC] back to observatory    [p] pollens    [r] report
  ·    ·    ✧    ·         ·    ·    ·         ·    ·    ·
```

### ink 컴포넌트 구조

```tsx
// src/cli/dashboard.tsx

import React from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';

interface DashboardProps {
  session: Session;
}

function Dashboard({ session }: DashboardProps) {
  const { exit } = useApp();
  const [view, setView] = useState<'main' | 'universe' | 'pollens'>('main');
  const [selectedUniverse, setSelectedUniverse] = useState<number>(0);

  useInput((input, key) => {
    if (input === 'q') exit();
    if (input === 'r') { /* trigger report */ }
    if (input === 'p') setView('pollens');
    if (input === 's') setView('main');
    if (['1','2','3','4','5'].includes(input)) {
      const idx = parseInt(input) - 1;
      if (idx < session.universes.length) {
        setSelectedUniverse(idx);
        setView('universe');
      }
    }
    if (key.escape) setView('main');
  });

  return (
    <Box flexDirection="column" borderStyle="double" padding={1}>
      <HeaderBar session={session} />
      {view === 'main' && <MainView session={session} />}
      {view === 'universe' && <UniverseDetailView universe={session.universes[selectedUniverse]} />}
      {view === 'pollens' && <PollensView pollens={session.pollens} />}
      <FooterBar />
    </Box>
  );
}
```

### 컴포넌트 상세

#### HeaderBar

세션 제목, 경과 시간, 총 비용, Pollen Cycle 번호를 표시.

```tsx
function HeaderBar({ session }: { session: Session }) {
  return (
    <Box justifyContent="space-between">
      <Text bold>🌌 SUPERPOSITION: {session.spec.parsed.title}</Text>
      <Text>
        Elapsed: {formatElapsed(session.startedAt)}  
        Cost: ${totalCost(session).toFixed(2)}  
        Cycle: {currentCycleNumber}
      </Text>
    </Box>
  );
}
```

#### MainView — Universe 카드 그리드

각 Universe의 요약 정보를 가로로 나열.

```tsx
function MainView({ session }: { session: Session }) {
  return (
    <Box flexDirection="column">
      {/* Universe 카드들 */}
      <Box justifyContent="space-around">
        {session.universes.map((u, i) => (
          <UniverseCard key={u.id} universe={u} index={i + 1} />
        ))}
      </Box>
      
      {/* Entanglement 로그 */}
      <Box flexDirection="column" marginTop={1}>
        <Text bold>🔗 ENTANGLEMENT LOG</Text>
        {recentPollens(session.pollens, 5).map(p => (
          <PollenLogLine key={p.id} pollen={p} />
        ))}
      </Box>
    </Box>
  );
}
```

#### UniverseCard

단일 Universe 요약 카드.

```tsx
function UniverseCard({ universe, index }: { universe: Universe; index: number }) {
  const statusIcon = universe.status === 'completed' ? '✅' : 
                     universe.status === 'failed' ? '❌' : 
                     universe.status === 'running' ? '🔄' : '⏳';
  
  return (
    <Box flexDirection="column" width="30%" borderStyle="single" padding={1}>
      <Text bold>{statusIcon} [{index}] Universe {universe.config.symbol}</Text>
      <Text>{universe.config.name}</Text>
      <Text dimColor>Agent: {universe.config.agent}</Text>
      <ProgressBar percentage={universe.progress.percentage} />
      <Text>Files: {universe.progress.filesCreated}  Commits: {universe.progress.totalCommits}</Text>
      <Text>Cost: ${universe.progress.estimatedCostUsd.toFixed(2)}</Text>
      <Text dimColor wrap="truncate">{universe.progress.currentPhase}</Text>
    </Box>
  );
}
```

#### ProgressBar

```tsx
function ProgressBar({ percentage }: { percentage: number }) {
  const width = 20;
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  
  return (
    <Text>
      <Text color="green">{'█'.repeat(filled)}</Text>
      <Text dimColor>{'░'.repeat(empty)}</Text>
      <Text> {percentage}%</Text>
    </Text>
  );
}
```

#### UniverseDetailView

숫자 키(1~5)를 누르면 해당 Universe의 상세 뷰로 전환.

```tsx
function UniverseDetailView({ universe }: { universe: Universe }) {
  return (
    <Box flexDirection="column">
      <Text bold>Universe {universe.config.symbol}: {universe.config.name}</Text>
      <Text>Approach: {universe.config.approach}</Text>
      <Text>Optimization: {universe.config.optimizationAxis}</Text>
      <Box flexDirection="column" marginTop={1}>
        <Text bold>Recent Logs:</Text>
        {universe.logs.slice(-15).map((log, i) => (
          <Text key={i} dimColor={log.level === 'debug'}>
            [{formatTime(log.timestamp)}] {log.message}
          </Text>
        ))}
      </Box>
      <Text dimColor>Press ESC to go back</Text>
    </Box>
  );
}
```

#### PollensView

```tsx
function PollensView({ pollens }: { pollens: Pollen[] }) {
  return (
    <Box flexDirection="column">
      <Text bold>🌸 All Pollens ({pollens.length})</Text>
      {pollens.map(p => (
        <Box key={p.id} flexDirection="column" marginBottom={1}>
          <Text bold>[{p.id}] {p.title}</Text>
          <Text>Source: Universe {p.sourceSymbol} | Type: {p.type}</Text>
          <Text dimColor>{p.insight}</Text>
          {p.targets.map(t => (
            <Text key={t.universeId}>
              → {t.universeSymbol}: {t.status} {t.mutation ? `(${t.mutation})` : ''}
            </Text>
          ))}
        </Box>
      ))}
      <Text dimColor>Press ESC to go back</Text>
    </Box>
  );
}
```

### 대시보드 데이터 갱신

Session의 EventEmitter 이벤트를 구독하여 React state를 업데이트한다.

```tsx
function useLiveSession(session: Session) {
  const [, forceUpdate] = useReducer(x => x + 1, 0);
  
  useEffect(() => {
    const handler = () => forceUpdate();
    session.on('universe:progress', handler);
    session.on('universe:completed', handler);
    session.on('universe:failed', handler);
    session.on('pollen:created', handler);
    session.on('pollen:applied', handler);
    session.on('session:all-complete', handler);
    
    return () => {
      session.off('universe:progress', handler);
      session.off('universe:completed', handler);
      session.off('universe:failed', handler);
      session.off('pollen:created', handler);
      session.off('pollen:applied', handler);
      session.off('session:all-complete', handler);
    };
  }, [session]);
  
  return session;
}
```

### 대시보드 없이 실행 (`--no-dashboard`)

대시보드 대신 구조화된 로그 출력:

```
[22:00:01] [session] Session ses_abc123 started with 3 universes
[22:00:02] [α] Universe started (agent: claude)
[22:00:02] [β] Universe started (agent: codex)
[22:00:02] [γ] Universe started (agent: claude)
[22:15:30] [α] Commit: feat: initial project scaffolding
[22:34:12] [β] Commit: feat: add market research module
[23:47:00] [pollen] Entanglement: α → β,γ "베트남 간편인증 규제 완화"
...
```

---

## CLI Entry Point

### 파일: `src/index.ts`

```typescript
import { Command } from 'commander';

const program = new Command();

program
  .name('supe')
  .description('Superposition — Define the problem, explore all solutions simultaneously')
  .version('0.1.0');

program
  .command('run')
  .description('Start a new Superposition session')
  .requiredOption('--spec <path>', 'Path to spec file')
  .option('--universes <number>', 'Number of universes', '3')
  .option('--agent <type>', 'Default agent type')
  .option('--agents <list>', 'Per-universe agents (comma-separated)')
  .option('--timeout <duration>', 'Max duration', '10h')
  .option('--max-cost <usd>', 'Max total cost in USD', '30')
  .option('--pollen-interval <min>', 'Pollen cycle interval in minutes', '30')
  .option('--channel <id>', 'Slack channel ID')
  .option('--no-slack', 'Disable Slack')
  .option('--no-pollen', 'Disable cross-pollination')
  .option('--no-dashboard', 'Disable live dashboard')
  .option('--resume <session-id>', 'Resume a stopped session')
  .action(async (opts) => {
    const { runCommand } = await import('./cli/commands/run.js');
    await runCommand(opts);
  });

program
  .command('status')
  .description('Show session status')
  .argument('[session-id]', 'Session ID (default: latest)')
  .action(async (sessionId) => {
    const { statusCommand } = await import('./cli/commands/status.js');
    await statusCommand(sessionId);
  });

program
  .command('report')
  .description('Show morning report')
  .argument('[session-id]', 'Session ID (default: latest)')
  .action(async (sessionId) => {
    const { reportCommand } = await import('./cli/commands/report.js');
    await reportCommand(sessionId);
  });

program
  .command('list')
  .description('List all sessions')
  .action(async () => {
    const { listCommand } = await import('./cli/commands/list.js');
    await listCommand();
  });

program
  .command('stop')
  .description('Stop a running session')
  .argument('[session-id]', 'Session ID (default: latest running)')
  .action(async (sessionId) => {
    const { stopCommand } = await import('./cli/commands/stop.js');
    await stopCommand(sessionId);
  });

program
  .command('init')
  .description('Initialize Supe configuration')
  .action(async () => {
    const { initCommand } = await import('./cli/commands/init.js');
    await initCommand();
  });

program.parse();
```
