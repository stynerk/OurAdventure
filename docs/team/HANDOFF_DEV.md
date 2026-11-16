# 개발PM 인수인계 — Our Adventure

마지막 갱신: 2026-11-17, #34 QA·CI 통과 및 PR #32 병합 완료 (Cap)

## 지금 상태

| Issue | 상태 | 브랜치·작업 트리 | 담당 |
|---|---|---|---|
| [#33](https://github.com/stynerk/OurAdventure/issues/33) | test-tools만 HJ 결정 대기, 그 외 정리 완료 | 본 폴더 main, 백업 backup/2026-11-16-local | Cap |
| [#34](https://github.com/stynerk/OurAdventure/issues/34) | 서비스PM 승인·독립 QA pass·CI success, PR #32 병합 및 Issue 종료 | main, issue-34 작업 트리 제거 완료 | implementer / qa / Cap |
| [#35](https://github.com/stynerk/OurAdventure/issues/35) | 미착수 | 아직 배정 없음 | 서비스PM TASK_READY 대기 |

- 본 폴더는 main이며 PR #32 병합 커밋 `6d8a6829adc692391482ba79bc9e1f93a3528bb5`를 fast-forward로 반영했다. 이전 미커밋 184개 파일은 백업 `934c28bd862abf2e686429ddb824fa7808ca2c6f`에 커밋·push했다. Tony의 `.worktrees/service`와 `.worktrees/test-tools`는 유지한다. test-tools의 인증·운영 파일 유실 위험으로 전체 삭제가 자동 승인 검토에서 거절됐고, 이후 HJ가 결정 전 보존을 지시했다.
- #34는 기존 PR #32의 setup/agents에 `db8e26f`를 더해 완료했다. 제품·QA·기술·참조·이전 문서를 git mv로 이동하고 hq 기준 .github 템플릿을 추가했다. 기존 운영 파일은 누락된 문서 지도·보존 규칙·인계만 보완했다. 별도 PR, 제품 개발, 스킬 이전은 없다. QA 완료 후 issue-34 작업 트리를 제거했고, 병합 결과를 이 인계에 기록했다.

## 기존 제품·기술 상태의 출처와 경계

- [PRD v2](../product/PRD.md)가 이전 기준보다 우선한다. 그룹 ⊃ 여행 ⊃ 장소, 사진 확정 후 개인별 스탬프, 한 줄 느낌 선택, 여행별 격리·결과 이미지 흐름이다. [기존 HANDOFF](../archive/HANDOFF.md)의 10-26 결정과 백업의 최신 개인완료 인계를 반영했다.
- 백업 `934c28b`의 `mockup/`은 로컬 모의 로그인·초대·개인 완료·PNG/인쇄 체험이다. 당시 모의 DOM 검사 기록이 있으나 main으로 복구하지 않았고 이번 세션에서 실행하지 않았다. 서버 연동·실제 브라우저·모바일 카메라·출력 통과를 의미하지 않는다.
- [스택 통합](../engineering/STACK_INTEGRATION.md)은 그룹·여행·초대·4탭·사진·추억·리포트·UI·장소 편집과 Analytics·QA 통합을 기록한다. 당시 단위 44개·서버 통합 52개·SDK/브라우저/PNG 통과, 추천·AI QA 6개·실기기 PNG 1개 보류다. [로딩 복구 후속](../engineering/NAVIGATION_LOADING_FIX.md)은 10-30의 단위 47개와 에뮬레이터 OAuth/읽기 복구 검증 범위를 설명한다. 이번 변경에서 재실행한 결과가 아니다.
- [운영 연결 기록](../engineering/PRODUCTION_CONNECTION.md)은 10-29 당시 Blaze 확인과 서울 Storage·규칙·Functions 반영 기록이다. 오래된 HANDOFF의 Spark/Storage 미설정·앱 미구현 문장은 당시 스냅샷이다. [11-03 사진 P0](../engineering/PHOTO_SAVE_P0_20261103.md)의 IAM 누락·실기기 미확인과 현재 main의 오류 안내 구현을 구분한다. 이번에는 운영 호출·설정·IAM·배포·결제를 수행하지 않았다.
- [T0 검토](../tech/T0_SPIKE_REVIEW.md)는 main에 없던 문서를 백업의 원문에서 복구하고 상대 링크만 갱신한 것이다. 기존 실험 코드·목업·API 호출을 운영으로 가져오지 않았다. 공급자·가격 표는 당시 검토 기록이며 신규 선정·유료 호출 승인이 아니다.

## 검증

- 확인한 것: 독립 QA에서 `node tests/check-doc-links.mjs`로 Markdown 63개·로컬 링크 244개·오류 0개, 없는 파일·앵커 2개를 넣은 극단값에서 오류 검출 및 제거 후 clean 복귀를 확인했다. `git diff --check`, 이동 21개·보호 경로 diff·hq 템플릿 3개 원문 일치도 통과했다.
- [PR CI #83](https://github.com/stynerk/OurAdventure/actions/runs/43972784742)의 firestore job 전체 success를 병합 전에 확인했다. 단위·Firestore 통합·callable-client·사진·탐색 검사가 포함된다. 승인된 head는 `db8e26fae25ad6bf37ade5319b222d1fa6c745f4`이며 같은 head를 지정해 병합했다.
- 확인하지 못한 것: 실제 운영·물리 기기·외부 URL 유효성. 로컬 제품 테스트는 재실행하지 않았고 위 CI 결과로 구분한다.
- 보호 범위: #32 최초 커밋 대비 `.codex/agents/` 추가 변경 없음. main 대비 루트 `index.html`, `assets/**`, `next/**`, `scripts/prepare-pages.mjs`, `.github/workflows/pages.yml` 변경 없음. `docs/MVP_TICKETS.md`는 #35 전까지 기존 위치에 둔다.

## 다음 할 일 (우선순위 순)

1. #34 완료와 QA_RESULT pass를 서비스PM에게 보고한다. 서비스PM이 #35를 TASK_READY로 넘기면 그때 착수한다.
2. #33 test-tools HJ 결정 대기. 삭제·이동을 재시도하지 않는다.
3. #35는 TASK_READY 후 진행한다. 제품 기획·개발 재개는 11-25 뒤 HJ가 정한다.

## 서비스PM 기술 보고

- 된 것: 기존 #32에 문서 구조·템플릿·링크·역할별 인계를 보완하고 서비스PM 승인·독립 QA·CI 통과 후 병합했다. #34는 닫혔고 본 폴더 main 갱신과 작업 트리 정리를 마쳤다.
- 안 된 것: #33 test-tools 결정, #35는 대기다. Claude 서브에이전트 내보내기는 서비스PM 합의대로 이번 Issue 범위 밖이다.
- 위험: 과거 검증·요금제 기록을 현재 운영 성공으로 오인하지 않도록 날짜·출처를 구분했다.
- 서비스PM이 정해야 할 것: #35 ready/TASK_READY 이관 시점.
- 다음 작업: #35 인계 대기. 제품 개발·배포는 시작하지 않는다.
