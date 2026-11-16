# OurAdventure

여행지에서 그룹이 함께 장소마다 사진으로 스탬프를 모으고, 여행 후 결과 이미지로 남기는 **탐험형 모바일 여행 기록 서비스**.

Public site (기존 경주 프로토타입): https://stynerk.github.io/OurAdventure/

## 최신 기준 (2026-10-26)

- **[PRD v2 — 그룹 스탬프 투어](docs/product/PRD.md)** ← 현재 제품 기준. 이전 PRD와 충돌하면 v2가 우선한다.
- [AI 코스 구성 가이드](docs/product/AI_COURSE_GUIDE.md)
- [MVP 작업 목록 보관본](docs/archive/MVP_TICKETS.md) · [QA 체크리스트](docs/qa/QA_CHECKLIST_V2.md)
- [서비스PM 인수인계](docs/team/HANDOFF_SERVICE.md) · [개발PM 인수인계](docs/team/HANDOFF_DEV.md)

## 문서 지도 (구조 전환, 2026-11-17)

- 운영 진입점: [Claude 서비스PM 규칙](CLAUDE.md) · [Codex 개발PM 규칙](AGENTS.md)
- 제품: [PRD](docs/product/PRD.md) · [AI 코스 가이드](docs/product/AI_COURSE_GUIDE.md)
- QA: [체크리스트](docs/qa/QA_CHECKLIST_V2.md)
- 기술: [Firebase 설정](docs/tech/FIREBASE_SETUP.md) · [Firebase 기반](docs/tech/FIREBASE_FOUNDATION_SETUP.md) · [T0 스파이크 검토](docs/tech/T0_SPIKE_REVIEW.md) · [경주 AI 핸드오버](docs/tech/GYEONGJU_AI_HANDOFF.md)
- 참조: [경주 일정](docs/reference/GYEONGJU_ITINERARY.md)
- 팀 기록: [결정](docs/team/DECISIONS.md) · [시행착오](docs/team/LEARNINGS.md)
- 이전 인수인계: [보관본](docs/archive/HANDOFF.md). 기존 구현·검증 증거는 `docs/engineering/`에 보존한다.

이번에는 구조만 전환한다. 제품 기획·개발 재개는 onemorestep 제출(2026-11-25) 뒤 HJ가 정한다. MVP 티켓 T0~T12의 작업 원장은 [GitHub Issue](https://github.com/stynerk/OurAdventure/issues/35)로 이전했다. [이전 작업 목록](docs/archive/MVP_TICKETS.md)은 이력 보관본이다.

이전 기준 문서(이력 보존): [Phase 1 PRD v1.3](docs/archive/PHASE1_PRD.md) · [프로토타입·제품 기준](docs/archive/PROJECT_CONTEXT.md) · [검증 상태와 남은 QA](docs/archive/QA.md) · [Phase 1 상세 PRD](docs/archive/PHASE1_SHARED_ADVENTURE_SPEC.md) · [개발 핸드오프](docs/archive/OUR_ADVENTURE_IMPLEMENTATION_HANDOFF.md)

## Product in one line

**어디든 코스를 만들고 → 장소마다 사진으로 개인 스탬프 → 함께 보는 기록 → 리포트·인스타 이미지**

기존 프로토타입은 경주 가족여행용 단일 코스 앱이다(**동화 지도 + 짧은 관찰 Quest + 즉시 스탬프 + 사진 기반 원정기**). v2는 이 경험을 그룹과 임의 여행지로 넓힌다.

## Source of Truth

- Repo: `stynerk/OurAdventure`
- Branch: `main`
- 기존 앱: `index.html` (GitHub Pages, `.github/workflows/pages.yml`)
- 기존 앱 맥락 문서: [docs/archive/PROJECT_HANDOFF.md](./docs/archive/PROJECT_HANDOFF.md) · [docs/archive/PROJECT_INSTRUCTIONS.md](./docs/archive/PROJECT_INSTRUCTIONS.md) · [경주 코스](./docs/reference/GYEONGJU_ITINERARY.md)
