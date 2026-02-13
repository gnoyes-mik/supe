# Slack Integration

> Slack은 Supe의 주요 사용자 인터페이스이자 실시간 로그 뷰어다. 각 Universe가 별도 스레드에 실시간 기록하고, 메인 채널에는 Entanglement 이벤트와 Morning Report가 포스팅된다.

---

## Slack App 설정

### 필요한 권한 (OAuth Scopes)

**Bot Token Scopes:**
- `chat:write` — 메시지 전송
- `chat:write.customize` — 사용자명/아이콘 커스터마이징
- `channels:read` — 채널 정보 읽기
- `channels:history` — 채널 메시지 히스토리 읽기

**App-Level Token:**
- Socket Mode 활성화 (Slack Events를 WebSocket으로 수신)
- `connections:write` scope

### 슬래시 커맨드

| Command | Description |
|---------|-------------|
| `/supe` | Supe 세션 관리 (하위 명령 포함) |

### 환경변수

```
SUPE_SLACK_BOT_TOKEN=xoxb-...    # Bot User OAuth Token
SUPE_SLACK_APP_TOKEN=xapp-...    # App-Level Token (Socket Mode)
```

---

## 파일: `src/slack/app.ts`

Slack Bolt 앱 초기화.

```typescript
import { App } from '@slack/bolt';

export function createSlackApp(config: SlackConfig): App {
  const app = new App({
    token: config.botToken,
    appToken: config.appToken,
    socketMode: true,
  });

  return app;
}
```

---

## 메시지 구조

### Thread 매핑 규칙

```
Slack Channel (#supe)
│
├── [Main Message] 세션 시작 알림 (thread anchor)
│   ├── Reply: Entanglement event 1
│   ├── Reply: Entanglement event 2
│   └── Reply: Morning Report
│
├── [Thread α] Universe α 전용 스레드
│   ├── 시작 메시지
│   ├── 진행 업데이트 1
│   ├── 진행 업데이트 2
│   ├── Pollen 수신 알림
│   └── 완료 메시지
│
├── [Thread β] Universe β 전용 스레드
│   └── ...
│
└── [Thread γ] Universe γ 전용 스레드
    └── ...
```

### 규칙:
- 메인 메시지: 세션 시작 시 채널에 하나만 포스팅. `ts`를 저장하여 나중에 reply(Entanglement, Report)에 사용.
- Universe 스레드: 각 Universe마다 별도 메시지를 채널에 포스팅 → 그 메시지의 `ts`를 thread_ts로 사용하여 해당 Universe의 모든 업데이트를 reply로 기록.

---

## 파일: `src/slack/messages.ts`

모든 Slack 메시지 포맷을 정의하는 파일. Block Kit JSON 구조를 반환하는 함수들.

### 1. 세션 시작 메시지

세션이 시작될 때 메인 채널에 포스팅.

```typescript
export function sessionStartMessage(session: Session): ChatPostMessageArguments {
  return {
    channel: session.slack!.channel,
    text: `🌌 Superposition 시작: ${session.spec.parsed.title}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `🌌 Superposition: ${session.spec.parsed.title}`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Problem:* ${session.spec.parsed.problemStatement}`
        }
      },
      {
        type: 'divider'
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: session.universes.map(u =>
            `• 🧵 *Universe ${u.config.symbol}*: ${u.config.name}\n   _${u.config.approach.slice(0, 100)}_`
          ).join('\n\n')
        }
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Session: \`${session.id}\` | Universes: ${session.universes.length} | Pollen Interval: ${session.config.pollenIntervalMs / 60000}min`
          }
        ]
      }
    ]
  };
}
```

### 2. Universe 스레드 시작 메시지

각 Universe의 스레드 앵커 메시지. 채널에 직접 포스팅된다 (reply 아님).

```typescript
export function universeThreadMessage(universe: Universe, session: Session): ChatPostMessageArguments {
  return {
    channel: session.slack!.channel,
    text: `🌀 Universe ${universe.config.symbol}: ${universe.config.name}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `🌀 Universe ${universe.config.symbol}: ${universe.config.name}`
        }
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Approach:*\n${universe.config.approach}` },
          { type: 'mrkdwn', text: `*Agent:* ${universe.config.agent}\n*Optimizing:* ${universe.config.optimizationAxis}` }
        ]
      },
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: `이 스레드에서 Universe ${universe.config.symbol}의 진행 상황을 실시간으로 확인할 수 있습니다.` }
        ]
      }
    ]
  };
}
```

### 3. Universe 진행 업데이트

해당 Universe의 스레드에 reply로 포스팅. **모든 변경을 올리면 너무 많으므로 throttle 적용.**

```typescript
export function universeProgressUpdate(
  universe: Universe,
  session: Session,
  detail: string
): ChatPostMessageArguments {
  return {
    channel: session.slack!.channel,
    thread_ts: session.slack!.threadTsMap[universe.id],
    text: `[${universe.config.symbol}] ${detail}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${formatTime()}* — ${detail}`
        }
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Progress: ${universe.progress.percentage}% | Files: ${universe.progress.filesCreated} | Commits: ${universe.progress.totalCommits} | Cost: $${universe.progress.estimatedCostUsd.toFixed(2)}`
          }
        ]
      }
    ]
  };
}
```

### 진행 업데이트 Throttle 규칙

모든 이벤트를 스레드에 올리면 노이즈가 된다. 다음 기준으로 throttle:

| 이벤트 | Slack 포스팅 여부 |
|--------|-----------------|
| 새 커밋 감지 | **Yes** — 커밋 메시지 포스팅 |
| 에이전트 iteration 시작/종료 | **No** — 너무 빈번 |
| 에러 발생 | **Yes** — 에러 내용 포스팅 |
| Pollen 수신 (주입) | **Yes** — Pollen 내용 포스팅 |
| Pollen 적용/거부 확인 | **Yes** — 결과 포스팅 |
| 진행률 변경 (10% 단위) | **Yes** — 10%, 20%, ... 단위로 |
| Universe 완료 | **Yes** — 최종 요약 포스팅 |

구현 방식: `lastSlackPostAt` 타임스탬프를 관리하여, 같은 종류의 이벤트는 최소 2분 간격으로 포스팅.

### 4. 커밋 감지 업데이트

```typescript
export function commitDetectedMessage(
  universe: Universe,
  session: Session,
  commitMessage: string,
  commitHash: string
): ChatPostMessageArguments {
  return {
    channel: session.slack!.channel,
    thread_ts: session.slack!.threadTsMap[universe.id],
    text: `[${universe.config.symbol}] Commit: ${commitMessage}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `📝 \`${commitHash.slice(0, 7)}\` ${commitMessage}`
        }
      }
    ]
  };
}
```

### 5. Entanglement 이벤트 (메인 스레드에 reply)

Pollen이 생성되어 다른 Universe에 전파될 때 메인 메시지에 reply.

```typescript
export function entanglementMessage(
  pollen: Pollen,
  targets: PollenTarget[],
  session: Session
): ChatPostMessageArguments {
  const appliedTargets = targets.filter(t => t.status !== 'rejected');
  const targetSymbols = appliedTargets.map(t => t.universeSymbol).join(', ');

  return {
    channel: session.slack!.channel,
    thread_ts: session.slack!.mainMessageTs,
    text: `🔗 Entanglement: ${pollen.sourceSymbol} → ${targetSymbols}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🔗 *Entanglement*: Universe ${pollen.sourceSymbol} → ${targetSymbols}\n*${pollen.title}*`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `> ${pollen.insight}`
        }
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Pollen: \`${pollen.id}\` | Type: ${pollen.type} | Abstraction: ${pollen.abstractionLevel}`
          }
        ]
      }
    ]
  };
}
```

### 6. Pollen 수신 알림 (타겟 Universe 스레드에 reply)

```typescript
export function pollenReceivedMessage(
  pollen: Pollen,
  target: PollenTarget,
  session: Session
): ChatPostMessageArguments {
  return {
    channel: session.slack!.channel,
    thread_ts: session.slack!.threadTsMap[target.universeId],
    text: `🌸 Pollen received from ${pollen.sourceSymbol}: ${pollen.title}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🌸 *Pollen from Universe ${pollen.sourceSymbol}*: ${pollen.title}\nRelevance: ${target.relevance}\n\n> _${pollen.insight}_\n\n_This hint has been added to PROMPT.md. The agent will decide whether to adopt it._`
        }
      }
    ]
  };
}
```

### 7. Pollen 적용 결과 (타겟 Universe 스레드에 reply)

```typescript
export function pollenAdoptionMessage(
  pollen: Pollen,
  target: PollenTarget,
  session: Session
): ChatPostMessageArguments {
  const statusEmoji = target.status === 'applied' ? '✅' : 
                      target.status === 'adapted' ? '🔄' : '❌';
  const statusText = target.status === 'applied' ? 'Applied as-is' :
                     target.status === 'adapted' ? `Adapted: ${target.mutation}` :
                     `Not adopted`;

  return {
    channel: session.slack!.channel,
    thread_ts: session.slack!.threadTsMap[target.universeId],
    text: `${statusEmoji} Pollen ${pollen.id}: ${statusText}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${statusEmoji} *Pollen \`${pollen.id}\`*: ${statusText}`
        }
      }
    ]
  };
}
```

### 8. Morning Report (메인 메시지에 reply)

```typescript
export function morningReportMessage(
  report: Report,
  session: Session
): ChatPostMessageArguments {
  // Universe 비교 테이블 구성
  const headerRow = `| | ${report.universeResults.map(u => `*${u.symbol} ${u.name}*`).join(' | ')} |`;
  const divider = `|---|${report.universeResults.map(() => '---').join('|')}|`;
  
  const rows = [
    `| Status | ${report.universeResults.map(u => u.status === 'completed' ? '✅' : '⚠️').join(' | ')} |`,
    `| Files | ${report.universeResults.map(u => u.metrics?.totalFiles ?? '-').join(' | ')} |`,
    `| Commits | ${report.universeResults.map(u => u.metrics?.totalCommits ?? '-').join(' | ')} |`,
    `| Cost | ${report.universeResults.map(u => u.metrics ? `$${u.metrics.estimatedCostUsd.toFixed(2)}` : '-').join(' | ')} |`,
    `| Pollen Sent | ${report.universeResults.map(u => u.metrics?.pollenEmitted ?? '-').join(' | ')} |`,
    `| Pollen Used | ${report.universeResults.map(u => u.metrics?.pollenApplied ?? '-').join(' | ')} |`,
  ];

  // 도메인별 추가 행
  if (session.spec.parsed.domain === 'software-development') {
    rows.push(
      `| LoC | ${report.universeResults.map(u => u.metrics?.linesOfCode ?? '-').join(' | ')} |`,
      `| Build | ${report.universeResults.map(u => u.metrics?.buildSuccess === true ? '✅' : u.metrics?.buildSuccess === false ? '❌' : '-').join(' | ')} |`,
    );
  } else {
    rows.push(
      `| Pages | ${report.universeResults.map(u => u.metrics?.documentPages ?? '-').join(' | ')} |`,
      `| Sections | ${report.universeResults.map(u => u.metrics?.sectionCount ?? '-').join(' | ')} |`,
    );
  }

  const table = [headerRow, divider, ...rows].join('\n');

  // Entanglement 하이라이트
  const entanglements = report.pollenStats.notableEntanglements
    .map(e => `• ${e.description}`)
    .join('\n');

  return {
    channel: session.slack!.channel,
    thread_ts: session.slack!.mainMessageTs,
    text: `☀️ Morning Report: ${session.spec.parsed.title}`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `☀️ Morning Report` }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: report.summary
        }
      },
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: table
        }
      },
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*🔗 Notable Entanglements*\n${entanglements || '_No cross-pollination events_'}`
        }
      },
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*🏆 Recommendation*\nUniverse *${report.recommendation.winnerSymbol}*: ${report.recommendation.reason}`
        }
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Session: \`${session.id}\` | Total Cost: $${report.universeResults.reduce((sum, u) => sum + (u.metrics?.estimatedCostUsd ?? 0), 0).toFixed(2)} | Duration: ${formatDuration(session.startedAt, report.generatedAt)}`
          }
        ]
      }
    ]
  };
}
```

---

## 파일: `src/slack/handlers.ts`

Session의 이벤트를 Slack 메시지로 변환하는 핸들러.

```typescript
export function registerSlackHandlers(session: Session, slackApp: App): void {
  const postMessage = async (msg: ChatPostMessageArguments) => {
    try {
      return await slackApp.client.chat.postMessage(msg);
    } catch (err) {
      console.error('Slack post failed:', err);
      // Slack 실패는 세션을 중단시키지 않음
    }
  };

  // Universe 시작
  session.on('universe:started', async ({ universeId, symbol }) => {
    // 이미 setup 단계에서 스레드가 생성되어 있으므로, 시작 메시지만 reply
    const universe = session.universes.find(u => u.id === universeId)!;
    await postMessage({
      channel: session.slack!.channel,
      thread_ts: session.slack!.threadTsMap[universeId],
      text: `🚀 Universe ${symbol} 실행 시작 (Agent: ${universe.config.agent})`
    });
  });

  // Universe 진행 (커밋 감지 시)
  // Throttle: 마지막 포스팅 후 2분 경과해야 다음 포스팅
  const lastPostMap = new Map<string, number>();
  
  session.on('universe:progress', async ({ universeId, symbol, progress }) => {
    const now = Date.now();
    const lastPost = lastPostMap.get(universeId) ?? 0;
    
    // 10% 단위 변경 또는 2분 경과 시에만 포스팅
    if (now - lastPost < 120_000) return;
    
    lastPostMap.set(universeId, now);
    const universe = session.universes.find(u => u.id === universeId)!;
    await postMessage(universeProgressUpdate(universe, session, progress.currentPhase));
  });

  // Pollen 생성 (Entanglement)
  session.on('pollen:created', async ({ pollen }) => {
    const targets = pollen.targets.filter(t => t.status !== 'rejected');
    if (targets.length > 0) {
      await postMessage(entanglementMessage(pollen, targets, session));
    }
  });

  // Pollen 주입
  session.on('pollen:injected', async ({ pollenId, targetUniverseId, targetSymbol }) => {
    const pollen = session.pollens.find(p => p.id === pollenId)!;
    const target = pollen.targets.find(t => t.universeId === targetUniverseId)!;
    await postMessage(pollenReceivedMessage(pollen, target, session));
  });

  // Pollen 적용 결과
  session.on('pollen:applied', async ({ pollenId, targetUniverseId }) => {
    const pollen = session.pollens.find(p => p.id === pollenId)!;
    const target = pollen.targets.find(t => t.universeId === targetUniverseId)!;
    await postMessage(pollenAdoptionMessage(pollen, target, session));
  });

  // Universe 완료
  session.on('universe:completed', async ({ universeId, symbol, metrics }) => {
    const universe = session.universes.find(u => u.id === universeId)!;
    await postMessage({
      channel: session.slack!.channel,
      thread_ts: session.slack!.threadTsMap[universeId],
      text: `✅ Universe ${symbol} 완료!`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: [
              `✅ *Universe ${symbol} 완료!*`,
              `Files: ${metrics.totalFiles} | Commits: ${metrics.totalCommits}`,
              `Cost: $${metrics.estimatedCostUsd.toFixed(2)} | Duration: ${formatDuration(universe.startedAt!, universe.completedAt!)}`,
              `Pollen Sent: ${metrics.pollenEmitted} | Used: ${metrics.pollenApplied}`
            ].join('\n')
          }
        }
      ]
    });
  });

  // Universe 실패
  session.on('universe:failed', async ({ universeId, symbol, error, restartCount }) => {
    await postMessage({
      channel: session.slack!.channel,
      thread_ts: session.slack!.threadTsMap[universeId],
      text: `⚠️ Universe ${symbol} error: ${error} (restart ${restartCount}/3)`
    });
  });

  // Morning Report
  session.on('session:all-complete', async ({ report }) => {
    await postMessage(morningReportMessage(report, session));
  });
}
```

---

## 세션 초기화 시 Slack 설정 흐름

```typescript
async function initializeSlack(session: Session, slackApp: App): Promise<void> {
  // 1. 메인 메시지 포스팅
  const mainMsg = await slackApp.client.chat.postMessage(
    sessionStartMessage(session)
  );
  session.slack!.mainMessageTs = mainMsg.ts!;

  // 2. 각 Universe의 스레드 앵커 메시지 포스팅
  for (const universe of session.universes) {
    const threadMsg = await slackApp.client.chat.postMessage(
      universeThreadMessage(universe, session)
    );
    session.slack!.threadTsMap[universe.id] = threadMsg.ts!;
  }

  // 3. 이벤트 핸들러 등록
  registerSlackHandlers(session, slackApp);
}
```
