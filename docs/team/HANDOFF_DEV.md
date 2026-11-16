# 개발PM 인수인계 — Our Adventure

마지막 갱신: 2026-11-17, #35 MVP 티켓 Issue 이전·문서 보관 반영 (Cap)

## 지금 상태

| Issue | 상태 | 브랜치·작업 트리 | 담당 |
|---|---|---|---|
| [#33](https://github.com/stynerk/OurAdventure/issues/33) | test-tools만 HJ 결정 대기, 그 외 정리 완료 | 본 폴더 main, 백업 backup/2026-11-16-local | Cap |
| [#34](https://github.com/stynerk/OurAdventure/issues/34) | 서비스PM 승인·독립 QA·CI 통과 후 PR #32 병합 및 Issue 종료 | main, issue-34 작업 트리 제거 완료 | implementer / qa / Cap |
| [#35](https://github.com/stynerk/OurAdventure/issues/35) | T0~T12 Issue 이전·문서 보관 PR 리뷰 요청 준비 | issue-35-mvp-issues, .worktrees/issue-35 | implementer / Cap 검증 |

- #35 기준 main은 `64df7a7`이다. #34의 PR #32 병합 커밋 `6d8a6829adc692391482ba79bc9e1f93a3528bb5`와 종료 인계가 포함된다. 본 폴더는 main을 유지하며 구현은 전용 작업 트리에서 진행한다.
- T0~T12 13개를 GitHub Issue #36~#48로 이전했다. 번호 대응과 완료 근거는 [이전 결과](https://github.com/stynerk/OurAdventure/issues/35) 및 [원문 보관본](../archive/MVP_TICKETS.md)에 남겼다. 모든 이전 Issue에 상태 라벨을 붙이지 않았으며 이번 이관으로 제품 구현을 시작하지 않는다.
- 완료·닫힘 6개: T2 [#38](https://github.com/stynerk/OurAdventure/issues/38), T3 [#39](https://github.com/stynerk/OurAdventure/issues/39), T6 [#42](https://github.com/stynerk/OurAdventure/issues/42), T7 [#43](https://github.com/stynerk/OurAdventure/issues/43), T9 [#45](https://github.com/stynerk/OurAdventure/issues/45), T10 [#46](https://github.com/stynerk/OurAdventure/issues/46). 열림 7개: T0 [#36](https://github.com/stynerk/OurAdventure/issues/36), T1 [#37](https://github.com/stynerk/OurAdventure/issues/37), T4 [#40](https://github.com/stynerk/OurAdventure/issues/40), T5 [#41](https://github.com/stynerk/OurAdventure/issues/41), T8 [#44](https://github.com/stynerk/OurAdventure/issues/44), T11 [#47](https://github.com/stynerk/OurAdventure/issues/47), T12 [#48](https://github.com/stynerk/OurAdventure/issues/48).
- `docs/archive/MVP_TICKETS.md`는 이전 작업 목록의 이력 보관본이다. 원문 단계·범위·AC·선행·진행 기록을 유지하고 이동에 필요한 상대 링크만 수정했다. T13~T15, 사용자 결정 및 MVP 제외 항목은 이번 13개 Issue 생성 범위 밖으로 원문에 보존했다.
- Tony의 `.worktrees/service`와 `.worktrees/test-tools`는 변경하지 않는다. test-tools는 #33 자동 승인 검토의 삭제 거절 후 HJ 결정 전까지 원위치 보존한다. 기존 미커밋 184개 파일은 백업 `934c28bd862abf2e686429ddb824fa7808ca2c6f`에 보존되어 있다.

## 티켓 상태의 근거와 경계

- 완료로 닫는 티켓은 T2·T3·T6·T7·T9·T10이다. 원 PR의 Draft/검토 완료 표기만으로 판정하지 않고 [누적 통합 PR #23](https://github.com/stynerk/OurAdventure/pull/23)과 main 포함·각 구현 문서의 AC/검증 근거를 확인한다. 각 Issue에 원 구현 PR과 누적 병합 PR을 연결한다.
- T0는 원 스파이크 [PR #6](https://github.com/stynerk/OurAdventure/pull/6)이 미병합이다. [T0 검토](../tech/T0_SPIKE_REVIEW.md)를 #34에서 복구한 것은 스파이크 코드 분리·병합 완료를 의미하지 않는다.
- T1은 인증 기반의 통합 구현과 후속 회귀 근거가 있으나 실제 Google 로그인·참여·재진입 검증이 남아 있다. T4·T5는 지도 검색·AI의 실제 연결/품질 검증이 완료되지 않았으므로 열어 둔다. [일정 후속 PR #30](https://github.com/stynerk/OurAdventure/pull/30)의 대역 테스트를 실제 Places/AI 성공으로 확대하지 않는다.
- T8은 사진 처리 구현·회귀와 [P0 후속 PR #31](https://github.com/stynerk/OurAdventure/pull/31)이 main에 반영되어도 운영 실기기 저장·스탬프·피드 성공 확인이 남아 있다. T11은 AC-6c의 iOS Safari·Android Chrome PNG 저장 확인이 남아 있으므로 열어 둔다.
- T12는 [기존 QA](../QA_RESULTS_V2.md)의 33 통과·6 실패·1 실기기 PNG 보류를 최종 pass로 바꾸지 않는다. 이번 이관은 실제 운영·실기기·외부 API를 재검증하지 않는다. 새 완료 조건을 만들지 않고 원문 AC의 남은 확인을 구분한다.

## 기존 제품·운영 상태의 출처

- [PRD v2](../product/PRD.md)가 이전 기준보다 우선한다. [기존 HANDOFF](../archive/HANDOFF.md)의 10-26 결정과 백업 추가 인계는 날짜별 기록이다. 백업의 `mockup/`은 main으로 복구하거나 실행하지 않았다.
- [스택 통합](../engineering/STACK_INTEGRATION.md)·[로딩 복구](../engineering/NAVIGATION_LOADING_FIX.md)·[운영 연결](../engineering/PRODUCTION_CONNECTION.md)·[사진 P0 조사](../engineering/PHOTO_SAVE_P0_20261103.md)는 당시 검증 범위다. 최신 원격 PR의 후속 기록과 날짜를 함께 보며 이번 세션의 운영 성공으로 표시하지 않는다.
- #34의 [CI #83](https://github.com/stynerk/OurAdventure/actions/runs/43972784742)는 단위·Firestore 통합·callable-client·사진·탐색 검사를 통과했다. 이는 #35에서 새로 제품 테스트를 실행했다는 뜻이 아니다. 제품 기획·개발 재개는 11-25 뒤 HJ가 정한다.

## 이번 검증

- 확인한 것: `node tests/check-doc-links.mjs`의 파일·Markdown 앵커 검사, `git diff --check`, 원문 보존·13개 대응표·보호 경로 확인. 최종 수치는 PR 보고에 남긴다.
- 보호 범위: main 대비 `.codex/agents/`, 루트 `index.html`, `assets/**`, `next/**`, `scripts/prepare-pages.mjs`, `.github/workflows/pages.yml` 변경 없음. 서비스 작업 트리·test-tools·스킬도 변경하지 않는다.
- 확인하지 못한 것: 운영·실기기·외부 URL 유효성 및 제품 테스트 재실행. 문서/작업 원장 이관이므로 새 기능 테스트는 수행하지 않는다.

## 다음 할 일

1. #35의 한 PR에 대응표·닫은 Issue의 병합 근거·링크 검사 결과를 남기고 REVIEW_REQUEST #35로 서비스PM 리뷰를 요청한다.
2. 서비스PM 승인과 QA 통과 후 병합한다. 그 전 #35를 완료로 닫지 않는다.
3. #33 test-tools는 HJ 결정 전 유지하며 `.claude/agents/` 내보내기는 합의된 별도 후속이다. 제품 개발·배포는 시작하지 않는다.

## 서비스PM 기술 보고

- 된 것: T0~T12 작업 원장을 GitHub Issue로 옮기고 원문 보관·역참조·개발 인계를 정리했다.
- 안 된 것: #35 서비스PM 리뷰·QA·병합, 열린 티켓의 구현/검증은 대기다.
- 위험: 병합된 구현과 미검증 운영·실기기 AC를 구분했다. 과거 기록을 현재 완료로 확대하지 않는다.
- 서비스PM이 정해야 할 것: #35 PR 리뷰 및 QA 이관 시점.
- 다음 작업: 리뷰 수정 요청 대응. 미완료 티켓은 재개 때 서비스PM이 ready로 넘긴다.
