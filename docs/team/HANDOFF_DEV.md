# 개발PM 인수인계 — Our Adventure

마지막 갱신: 2026-11-17, #35 독립 QA·CI 통과 및 PR #49 병합 완료 (Cap)

## 지금 상태

| Issue | 상태 | 브랜치·작업 트리 | 담당 |
|---|---|---|---|
| [#33](https://github.com/stynerk/OurAdventure/issues/33) | test-tools만 HJ 결정 대기, 그 외 정리 완료 | 본 폴더 main, 백업 backup/2026-11-16-local | Cap |
| [#34](https://github.com/stynerk/OurAdventure/issues/34) | 서비스PM 승인·독립 QA·CI 통과 후 PR #32 병합 및 Issue 종료 | main, issue-34 작업 트리 제거 완료 | implementer / qa / Cap |
| [#35](https://github.com/stynerk/OurAdventure/issues/35) | 서비스PM 승인·독립 QA·CI 통과 후 PR #49 병합, Issue 종료 | main, issue-35 작업 트리 제거 완료 | implementer / qa / Cap |

- #35 기준 main은 `64df7a7`이었다. 승인된 head `b8ff342f2cd95d55e84e51b83ecd0a7d6f7c053a`를 merge commit 방식으로 PR #49에 병합했다. 병합 커밋은 `ed5dccc8c9f87dae8eb5d3832801b7b48411ba11`이며 본 폴더 main에 fast-forward로 반영했다. 깨끗한 issue-35 작업 트리는 제거했다.
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

- 독립 QA pass: `node tests/check-doc-links.mjs`에서 Markdown 63개·로컬 링크 246개·오류 0개. 없는 파일·앵커 fixture 2개를 검출하고 `_to_delete/` 경유 정리 후 오류 0개와 clean 복귀를 확인했다. 원문은 내부 상대 링크 3개 외 동일하고 13개 대응표·역참조·diff check를 확인했다.
- 원격 13개 Issue의 원문 범위·AC·단계, closed 6/open 7, 상태 라벨 없음, 유료 4개 승인 첫 줄, 닫힌 티켓의 병합 근거를 QA에서 재조회했다. [PR CI #86](https://github.com/stynerk/OurAdventure/actions/runs/43975589197)의 firestore 전체 success를 확인한 뒤 서비스PM 승인 및 사용자 병합 지시대로 #49를 병합했다. #35 자동 종료를 확인했다.
- 보호 범위: main 대비 `.codex/agents/`, 루트 `index.html`, `assets/**`, `next/**`, `scripts/prepare-pages.mjs`, `.github/workflows/pages.yml` 변경 없음. 서비스 작업 트리·test-tools·스킬도 변경하지 않는다.
- 확인하지 못한 것: 운영·실기기·외부 URL 유효성 및 로컬 제품 테스트 재실행. 제품 회귀는 위 CI 결과와 구분한다. 문서/작업 원장 이관으로 제품 QA 항목은 해당 없음이다.

## 다음 할 일

1. 구조 전환 #34·#35는 완료했다. 열린 T0/T1/T4/T5/T8/T11/T12는 구현·검증을 시작하지 않고 서비스PM의 재개 지시를 기다린다.
2. 미완료 티켓의 ready 라벨은 제품 재개 때 Tony가 지정한다. 기획·개발 재개는 11-25 뒤 HJ가 정한다.
3. #33 test-tools는 HJ 결정 전 유지하며 `.claude/agents/` 내보내기는 합의된 별도 후속이다. 제품 개발·배포는 시작하지 않는다.

## 서비스PM 기술 보고

- 된 것: T0~T12 작업 원장 이전과 원문 보관·역참조 수정 후 서비스PM 승인·독립 QA·CI 성공을 확인해 PR #49를 merge commit으로 병합했다. #35 종료·main 갱신·작업 트리 정리를 마쳤다.
- 안 된 것: 열린 티켓의 구현/검증과 #33 test-tools 결정은 대기다.
- 위험: 병합된 구현과 미검증 운영·실기기 AC를 구분했다. 과거 기록을 현재 완료로 확대하지 않는다.
- 서비스PM이 정해야 할 것: HJ 재개 결정 후 미완료 티켓의 착수 시점.
- 다음 작업: 재개 지시 대기. 제품 개발·배포는 시작하지 않는다.
