# 데이터 모델

[English](./DATA_MODELS.md)

이 문서는 **현재 구현된 모델 표면**을 요약합니다.
정확한 현재 타입은 `src/types.ts`를 확인하세요.

## 핵심 개념

### Session
Session은 다음을 포함합니다:
- raw spec
- parsed spec
- universes
- config
- pollen history
- report
- timestamp와 status

### ParsedSpec
현재 parsed spec는 다음을 포함합니다:
- `title`
- `problemStatement`
- `constraints`
- `desiredOutputs`
- `successCriteria`
- `domain`
- `additionalContext`
- `outOfScope`
- `assumptions`
- `problemContract`
- `universeConfigs`

### ProblemContract
모든 universe가 공유하는 정규화된 계약:
- problem statement
- required outputs
- hard constraints
- success criteria
- out-of-scope items
- assumptions

### Universe
Universe는 다음을 포함합니다:
- config (approach, runtime, optimization axis)
- workdir
- prompt path
- progress
- metrics
- logs
- pending pollens

Universe runtime assignment는 `ParsedSpec.universeConfigs`에 구체화됩니다. `--agents`가 제공되면 session 생성 전에 round-robin 방식으로 runtime assignment가 확장됩니다.

### Pollen
Pollen은 다음을 포함합니다:
- 추상화된 insight
- type (`pattern`, `data`, `strategy`, `warning`)
- source metadata
- deterministic evaluation metadata
- target별 relevance/evaluation state

### Report
현재 report model은 comparison-first입니다.
다음을 포함합니다:
- `summary`
- `universeResults`
- `rankings`
- `pollenStats`
- `comparisonSummary`

현재는 winner recommendation이 1차 산출물 모델이 아닙니다.

## 공개 계약 레이어

추가 app-layer public type은 다음에 있습니다:
- `src/app/contracts.ts`

중요한 public 구조:
- JSON envelope
- session artifact paths
- universe artifact paths
- host capabilities registry
- runtime adapter contracts

설정은 per-universe runtime selection과 별도로 analysis backend도 모델링합니다. 현재 구현된 local analysis backend는 `claude-cli`, `codex-cli`입니다.

## 영속 산출물

Session root 저장물:
- `session.json`
- `spec.md`
- `parsed-spec.json`
- `problem-contract.json`
- `report.json`

Universe root 저장물:
- `PROMPT.md`
- `solution-spec.md`
- `verification-spec.md`
- `DONE.md`
- `.supe/universe.json`
- `.supe/logs.jsonl`

## 머신 리더블 스키마

현재 schema 파일:
- `schemas/cli/session-envelope.schema.json`
- `schemas/cli/clarification-required.schema.json`
- `schemas/mcp/session-tools.schema.json`

## 소스 오브 트루스

정확한 field와 enum은 다음을 확인하세요:
- `src/types.ts`
- `src/app/contracts.ts`
