# 개요

[English](./OVERVIEW.md)

Supe는 **비교 중심(comparison-first) 멀티 유니버스 오케스트레이션 엔진**입니다.
사용자는 Supe를 최상위 진입점으로 사용하고, Supe는 유니버스별 내부 런타임으로 Claude Code와 Codex를 활용할 수 있습니다. 분석/제어 플레인도 이제 local CLI 우선으로 동작합니다.

## 현재 구현 형태

- Supe가 주 진입점이다
- 각 universe는 서로 다른 접근을 시도하는 실행 샌드박스다
- 산출물은 markdown 중심이다 (`solution-spec.md`, `verification-spec.md`)
- 비교가 1급 개념이며 winner 자동 선택은 핵심이 아니다
- 현재 host surface는 CLI, MCP, 최소 Claude plugin surface를 포함한다
- local CLI 분석 백엔드는 현재 `claude-cli`, `codex-cli`를 지원한다
- 혼합 런타임 세션은 `--agents`를 통해 `claude` / `codex`를 round-robin 배정한다

## 핵심 원칙

- 문제를 한 번 정의한다
- 유니버스가 분기되기 전에 문제 계약을 고정한다
- 계약 드리프트는 막되, 해결 방식의 다양성은 허용한다
- 재사용 가능한 인사이트만 공유한다
- 마지막에는 유니버스를 명시적으로 비교한다

## 현재 surface

### CLI
구현됨:
- run / status / report / list / stop / resume
- setup / doctor / contracts
- JSON + non-interactive 지원

### MCP
구현됨:
- stdio MCP server
- contract + doctor + session lifecycle tool

### Claude plugin
최소 형태로 구현됨:
- `.claude-plugin/plugin.json`
- `skills/`
- `.mcp.json`

## 산출물

### Universe outputs
- `solution-spec.md`
- `verification-spec.md`
- `DONE.md`

### Session outputs
- `parsed-spec.json`
- `problem-contract.json`
- `report.json`

## 현재 한계

- 실제 Claude plugin install은 아직 end-to-end 검증되지 않았다
- 장시간 local CLI 세션에서 최종 산출물이 안정적으로 생성되는지 추가 검증이 필요하다
- 긴 준비 단계 전체를 덮는 stop/timeout 동작은 추가 하드닝이 필요하다

## 소스 오브 트루스

현재 시스템 상태를 확인할 때는 다음을 우선한다:
1. `src/`
2. `schemas/`
3. 테스트 증거

이 문서는 구현 기준으로 짧고 명확하게 유지한다.
