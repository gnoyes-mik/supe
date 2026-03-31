# 데이터 모델

[English](./DATA_MODELS.md)

이 문서는 현재 모델 표면을 요약합니다. 정확한 타입은 `src/types.ts`를 확인하세요.

## Session

Session은 다음을 포함합니다:
- raw + parsed spec
- universe 목록
- session config
- pollen history
- report
- timestamp와 status

현재 특징:
- session status는 상위 lifecycle (`initializing`, `running`, `completed`, `failed`, `cancelled`)를 유지한다
- provider별 runtime detail은 session root가 아니라 universe별로 저장된다

## SessionConfig

현재 session config는 다음을 포함합니다:
- universe count + default agent
- base repo path
- dashboard enabled flag
- duration / cost / pollen 설정
- Slack enablement/config

## Universe

Universe는 다음을 포함합니다:
- config (approach, symbol, runtime, optimization axis)
- workdir / prompt path / git branch
- progress + metrics + logs
- pending pollens
- `runtimeSession`

## RuntimeSessionRecord

Universe별 runtime metadata:
- `provider`
- `transport`
- `externalSessionId`
- `state`
- `currentStep`
- `lastActivityAt`
- `lastSequence`
- `pendingQuestion`
- `pendingReply`
- `transcriptTail`

이것이 conversation runtime baseline의 핵심 persistence surface다.

## ParsedSpec / ProblemContract

`ParsedSpec`는 다음을 포함합니다:
- title
- problem statement
- constraints
- desired outputs
- success criteria
- domain
- additional context
- out-of-scope
- assumptions
- 정규화된 `problemContract`
- `universeConfigs`

`ProblemContract`는 universe 분기 전에 고정되는 공유 계약이다.

## Pollen

Pollen은 코드 patch가 아니라 재사용 가능한 발견을 모델링한다.
현재 type:
- `pattern`
- `data`
- `strategy`
- `warning`

Target은 relevance와 adoption/rejection 상태를 추적한다.

## Runtime event

Canonical runtime event는 `src/runtime/contracts.ts`에 있다.
포함되는 예:
- session start
- assistant delta/message
- tool start/finish
- file/commit update
- progress hint
- needs-user-input
- heartbeat
- completion/failure

## Report

Report는 여전히 comparison-first다.
주요 내용:
- 전체 session outcome
- universe별 결과
- ranking/comparison 데이터
- pollen 통계
