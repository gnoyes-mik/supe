# Ralphthon 참가 신청서 — 답변 초안

> 각 항목의 내용을 Google Form에 복사하여 사용

---

## 팀 이름

Supe

---

## 팀 인원

Solo

---

## 팀 대표 이름 / 이메일 / 휴대폰

(직접 기입)

---

## 팀 소개 (LinkedIn, X, Github 프로필 등 웹에 게시된 링크 필수)

GitHub: https://github.com/gnoyes-mik
프로젝트 Repo: https://github.com/gnoyes-mik/supe

---

## 어떤 백그라운드를 가지고 있는지 소개해주세요

백엔드 엔지니어 (채권 유동화, 기업 신용평가 도메인 경험). Claude Max $200 + GPT Pro $200 구독 중이며, Claude Code를 매일 업무에 활용하고 있습니다. Ralph Loop을 실무에서 적극 사용 중이며, 에이전트 오케스트레이션에 대한 경험과 아이디어를 가지고 있습니다.

---

## 해커톤에서 구현할 아이디어를 설명해주세요

### Supe (Superposition) — 멀티버스 오케스트레이션 엔진

**"이제 기획서도 필요 없습니다. 풀고 싶은 문제만 정의하세요."**

Ralph Loop은 에이전트를 돌려놓고 자는 것을 가능하게 했지만, "어떤 방식으로 풀지"는 여전히 사람이 결정해야 하고, 하나를 골라 베팅해야 합니다.

Supe는 이 제약을 제거합니다:

1. 사용자는 풀고 싶은 문제(spec.md)만 작성합니다
2. Supe가 문제를 분석하여 의미 있게 다른 N개의 접근법을 자동 설계합니다
3. 각 접근법을 독립된 Universe(평행우주)에서 에이전트가 Ralph Loop으로 자율 실행합니다
4. 30분마다 Cross-Pollination이 일어납니다 — 한 Universe의 핵심 발견을 다른 Universe에 패턴 수준으로 전파하고, 도입 여부는 각 Universe가 스스로 판단합니다
5. 아침에 Morning Report로 N개 결과를 비교하여 최선을 선택합니다

핵심 차별점은 Cross-Pollination입니다. 단순 병렬 실행이 아니라, Universe들이 서로의 장점을 자율적으로 흡수하며 진화합니다. 코드 복사가 아닌 아이디어의 자연선택입니다.

도메인 무관 — 개발뿐 아니라 마케팅 전략, 사업 전략, 피치덱 등 의사결정이 있는 모든 곳에 적용됩니다.

해커톤 밤에 2가지를 동시 실행합니다:
- 개발: "실시간 할 일 관리 앱" → 3개 Universe가 다른 스택으로 밤새 개발
- 비개발: "AI 스타트업 한국 시장 진출 전략" → 3개 Universe가 다른 전략 리포트 작성

아침에 Morning Report를 열면 각 Universe의 결과물 + Cross-Pollination으로 교류된 인사이트 추적 내역까지 확인할 수 있습니다.

---

## 코딩 에이전트 구독 플랜

- [x] Claude Max $200
- [x] GPT Pro $200

---

## 평소 코딩 에이전트를 어떻게 사용하고 있는지 설명해주세요 (300자 이하 권장)

매일 Claude Code를 주력으로 사용합니다. Ralph Loop 패턴으로 PROMPT.md 기반 자율 실행을 자주 활용하며, 복잡한 작업은 태스크를 분해하여 에이전트 체이닝으로 처리합니다. GPT Pro는 Claude와 다른 관점이 필요할 때 병행합니다. Supe의 설계 문서 8개도 에이전트와 협업하여 작성했으며, 이 프로젝트 자체가 "에이전트가 추측 없이 구현 가능한 수준의 문서"를 목표로 했습니다.

---

## .claude/ 폴더

zip 파일로 첨부. GitHub repo에도 포함: https://github.com/gnoyes-mik/supe
