# Historical Slack Integration Reference

[English](./SLACK_INTEGRATION.md)

> 과거/참고 문서입니다. Slack 코드는 저장소에 남아 있지만, 현재 milestone의 주 검증 host surface는 아닙니다.

## 현재 구현 맥락

Supe는 현재 다음을 우선합니다:
- CLI
- MCP
- conversation runtime 실행
- Ink dashboard 가시성

Slack 지원은 코드베이스에 남아 있지만, 주 검증 상호작용 경로는 더 이상 Slack-first가 아닙니다.

## 왜 이 문서가 남아 있나

`src/slack/*`가 존재하는 이유와 원래 의도를 설명합니다:
- session-level notification
- universe별 progress thread
- pollen/entanglement 가시성
- 최종 report를 chat surface에 전달하는 흐름

## 현재 source of truth

Slack 작업을 할 때는 다음을 우선하세요:
- `src/slack/*`
- `src/app/runtime-service.ts`
- `src/core/orchestrator.ts`
- `src/types.ts`

일반 제품 동작은 이 문서보다 CLI/MCP/docs를 우선하세요.
