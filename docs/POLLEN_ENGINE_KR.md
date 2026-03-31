# Historical Pollen Engine Reference

[English](./POLLEN_ENGINE.md)

> 과거/참고 문서입니다. 정확한 현재 동작은 `src/pollen/*`, `src/core/orchestrator.ts`, `src/types.ts`, 자동화 테스트를 우선하세요.

## 현재 구현 맥락

Pollen은 여전히 유니버스 간 인사이트 공유 메커니즘이지만, 이제 더 큰 conversation-runtime 구조 안에 포함되어 있습니다.

현재 구현에서 중요한 점:
- pollen은 **추상화된 인사이트**로 공유되며 코드 patch 자체를 복사하지 않습니다
- 각 universe는 pollen을 채택/거부할지 자율적으로 결정합니다
- pollen 상태는 session/universe orchestration 상태의 일부로 저장됩니다
- 혼합 provider universe (`claude` / `codex`)도 같은 중립 모델로 pollen을 공유합니다

## 왜 historical 문서인가

이 문서는 원래의 개념적 분리를 설명하기 위해 남아 있습니다:
- **Analyst** — 재사용 가능한 인사이트 발견
- **Pollinator** — 적절한 타겟에 힌트 주입
- **Tracker** — 채택/변형/거부 추적

이 개념적 분리는 현재도 `src/pollen/*` 모듈 구조를 이해하는 데 유효합니다.

## 현재 source of truth

우선 순위:
- `src/pollen/analyst.ts`
- `src/pollen/pollinator.ts`
- `src/pollen/tracker.ts`
- `src/core/orchestrator.ts`
- `src/types.ts`
- 자동화 테스트
