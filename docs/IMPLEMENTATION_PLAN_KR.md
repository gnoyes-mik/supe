# Historical Implementation Plan

[English](./IMPLEMENTATION_PLAN.md)

> 과거/참고 문서입니다. 현재 구현은 원래의 해커톤 구현 계획을 넘어섰고, 병합된 Phase 0-6 conversation-runtime baseline을 포함합니다.

## 현재 이 문서의 역할

이 문서는 Supe가 처음에 어떤 시간 압박과 순서로 만들어질 것으로 예상되었는지 보여주는 historical context입니다.
현재 저장소 상태의 active source of truth는 아닙니다.

## 원래 계획 이후 달라진 점

현재 구현에는 다음이 포함됩니다:
- contract-first runtime boundary
- Codex / Claude 모두에 대한 conversation-session 실행
- Ink dashboard-first TTY presentation
- provider-neutral reply/control flow
- runtime layer와 통합된 MCP / JSON contract surface

## 현재 source of truth

우선 순위:
1. `README.md` / `README_KR.md`
2. `docs/OVERVIEW*.md`
3. `docs/ARCHITECTURE*.md`
4. `docs/CLI_SPEC*.md`
5. `docs/DATA_MODELS*.md`
6. `src/`와 자동화 테스트
