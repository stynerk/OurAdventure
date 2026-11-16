# 서비스PM 인수인계 — Our Adventure

마지막 갱신: 2026-11-17, #34 구조 전환 반영 (Cap)

## 지금 상태

- 현재 제품 기준은 [PRD v2](../product/PRD.md)와 [AI 코스 가이드](../product/AI_COURSE_GUIDE.md)다. 그룹을 재사용하고 여행마다 코스·장소를 만들며, 사진 저장으로 **개인별** 스탬프를 완료한다. 한 줄 느낌은 선택이고, 여행 뒤 리포트·인스타용 이미지를 남긴다. A의 완료가 B의 완료로 전파되면 안 된다.
- 2026-10-26 방향 전환과 이전 결정·검증의 원문은 [기존 HANDOFF 보관본](../archive/HANDOFF.md)에 남겼다. 오래된 '미구현'·'Storage 미설정' 문장은 당시 기록이며 현재 상태를 뜻하지 않는다.
- main에는 그룹·여행·초대·4탭·사진·추억·리포트·장소 편집의 누적 구현이 있다. [스택 통합 기록](../engineering/STACK_INTEGRATION.md)의 44개 단위/52개 서버 통합/SDK·브라우저·PNG 통과와 추천·AI QA 6개/실기기 PNG 1개 보류는 과거 기록이며 이번 세션에서 재실행하지 않았다. Google Places·AI 기능까지 완료된 것으로 표시하지 않는다.
- [2026-10-29 운영 연결 기록](../engineering/PRODUCTION_CONNECTION.md)은 당시 Blaze·운영 규칙·Functions 반영을 확인했다. [사진 저장 P0 기록](../engineering/PHOTO_SAVE_P0_20261103.md)은 11-03 당시 교차 서비스 IAM 누락과 실기기 성공 미확인을 기록한다. 이번에는 운영·결제·권한을 재조회하거나 변경하지 않았다. 요금제 전환·유료 API 신규 실행은 계속 HJ 승인 사항이다.
- 백업의 10-26 추가 인계에는 실행형 목업과 모의 DOM 검증이 있다. 목업은 현재 main에 복구하지 않았으며 `backup/2026-11-16-local`의 `mockup/`에만 보존되어 있다. 모의 로그인·초대는 서버 인증·다른 기기 공유·실기기 통과 증거가 아니다.
- 운영 구조는 Tony(서비스PM)·Cap(개발PM)이다. 이번에는 문서 구조만 전환하며 제품 기획·개발은 시작하지 않는다. 재개는 onemorestep 제출(2026-11-25) 뒤 HJ가 정한다. 성공 지표 수치 정의도 재개 시 서비스PM의 첫 작업이다.

## 구조 전환 Issue

| Issue | 상태 | 다음 |
|---|---|---|
| [#33](https://github.com/stynerk/OurAdventure/issues/33) | 백업·main 전환·이전 작업 트리 정리 완료, test-tools HJ 결정 대기 | test-tools는 손대지 않음 |
| [#34](https://github.com/stynerk/OurAdventure/issues/34) / [PR #32](https://github.com/stynerk/OurAdventure/pull/32) | setup/agents에 문서 이동·템플릿·링크·인계 보완 | 서비스PM 리뷰 후 QA |
| [#35](https://github.com/stynerk/OurAdventure/issues/35) | 미착수, TASK_READY 미수신 | MVP_TICKETS T0~T12 Issue 이전은 별도 착수 |

## 열린 결정

| 결정 | 현재 처리 | 근거 |
|---|---|---|
| test-tools 삭제·이동 | HJ 결정 전까지 원위치 보존 | #33·#34 댓글, 2026-11-17 지시 |
| 제품 작업 재개와 성공 지표 | 11-25 이후 HJ 결정 대기 | DECISIONS.md, hq 프로젝트 규칙 |
| 사진 저장 P0 실기기 성공 등 과거 미검증 | 최신 운영 상태와 해결 여부 재확인 필요 | 11-03 P0 기록; 이번 구조 전환 범위 밖 |

## 다음 할 일 (우선순위 순)

1. #32의 #34 추가 커밋을 리뷰하고 QA로 넘긴다. 서비스PM 승인과 QA 통과 전 병합하지 않는다.
2. #33 test-tools는 HJ 결정 전까지 보존한다. Tony의 `.worktrees/service`는 변경하지 않는다.
3. #34 뒤 #35를 ready/TASK_READY로 넘긴다. 제품 개발이나 스킬 이전을 함께 시작하지 않는다.

## 개발PM에게 전할 말

- 이번 PR은 기존 #32 하나를 사용한다. #32의 `.codex/agents/`와 루트 `index.html`·Pages workflow는 추가 변경하지 않는다.
- 인계 출처: 기존 main HANDOFF의 10-20/10-26 기록, 백업 `934c28b`의 10-26 추가 인계, 저장소의 10-28~11-03 구현·운영 기록. 날짜별 검증 범위를 현재 운영 성공으로 확대하지 않는다.
