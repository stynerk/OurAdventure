# Engineering → Orchestrator / Product / UX / QA

2026-10-20 · PR #3 인증·그룹·참여 기반 / PRD v1.1 반영

## Summary / Deliverables

- 기존 main root 앱과 기록 저장키를 보존하고 `next/`에 신규 그룹 앱 추가.
- `next/course.json`, `functions/course.json`: root 경주 9개 Quest 고정 스냅샷.
- `functions/service.cjs`, `functions/index.cjs`: 생성·초대 확인·가입·완료·제출·종료·초대 재발급.
- `firestore.rules`: 방별 멤버/방장 읽기 제한, 직접 쓰기 전면 차단.
- `tests/`, CI: 단위·Rules/동시성·SDK·브라우저 검증과 실행 스크립트.
- `docs/ARCHITECTURE.md`, `FIREBASE_SETUP.md`, `QA.md`: 설계, 연결/롤백, 검증 근거.
- Pages workflow를 공개 파일 선별 패키징으로 수정. 운영 Firebase config는 명시적 repository variable로 생성.

## Decisions / 승인된 제품 방향

- 리더 Google / 참여자 로그인 UI 없는 Anonymous Auth, 방별 owner/member 권한.
- 경주 고정 코스, shared/individual, 개인별 최종 제출, 종료 후 읽기 전용.
- 코스 빌더·익명 세션 기기 간 복구 제외. 신규 공동 글/사진 기록과 리더 출력은 최신1A 요구로 승인됐으나 이번 기반 구현에는 없다.

## 구현상 선택 / 제품 확정과 구분

- aggregate member 문서에 개인 progress/submission 저장; 서버 트랜잭션 사용.
- 독립 `/next/`와 해시 라우터, draft 저장 없이 open 생성.
- 정원 총10명(방장 포함)을 서버에서 원자 강제한다. 30명은1B 검증 목표이며 현재 일반 출시 한도가 아니다. Functions maxInstances=3은 개발 기본값.
- 개별 제출 요약의 분모는 일반 member만 포함. 방장의 자신의 진행은 별도 행으로 표시.
- 초대 토큰 원문 복원 불가. 새로고침 후 공유하려면 재발급; 이전 링크는 폐기된다.

## Validation

- 자동 검사3개 + Firestore 통합 검사11개. 상세 결과는 QA_PHASE1_FOUNDATION.md에 기록한다.
- 실제 callable handler를 로컬 HTTP에서 실행한 SDK/브라우저 흐름 통과. 표준 Functions emulator는 환경 Unix socket 권한 때문에 차단됨.
- 자세한 범위와 미검증 항목은 QA_PHASE1_FOUNDATION.md. 실서비스/실제 Google OAuth 통과로 표현하지 않는다.

## Risks / Next Actions

| 담당 | 다음 작업 | 완료 기준 |
|---|---|---|
| Orchestrator / Engineering | Firebase 프로젝트 ID·요금제·Console 접근권한 확인 | 실제 배포 대상과 책임자 식별 |
| Engineering | Google/Anonymous 활성화, 허용 도메인, Rules/Functions 및 Pages 연결 | 실제 인증·생성·참여·권한 동작 검증 |
| Product / Orchestrator | 데이터 보관·삭제, 공유 사진/게시글 저장 계약, 요청 제한·App Check 정책 | 사진 저장·공유·리더 출력 구현, 공개 파일럿 운영 경계 확정 |
| UX & Content | 실기기에서 링크 입장·초대 재발급·계정 충돌·오프라인 UX 검토 | 설명 없이 방 생성/참여 및 진행 가능 |
| QA & Research | 가족 3명 + 가상 참여자 5명 테스트, 모바일 실기기 | 상태 혼합·권한 누출·중복 제출 0건, 목표 시간 측정 |

## Release state

로컬 코드와 테스트가 준비된 상태다. 개발 브랜치/PR 상태는 GitHub에서 확인한다. `main` 병합, 운영 Firebase 설정·배포, Pages 실제 신규 경로 배포 및 사용자 파일럿은 수행하지 않았다. 기존 공개 사이트는 이번 개발 브랜치 작업으로 변경되지 않는다.

## 최신 범위 동기화

main `0eaac19`를 통합했다. 공통 HANDOFF/QA와 최신 PRD/개발 인계를 덮어쓰지 않고 이번 상세 기록을 docs/engineering/ 아래로 분리했다. individual/제출은1C 후속 플래그로 격리했다. 현재 인증·참여 기반이 테스트됐다는 의미이며1A 공유 기록/리더 출력의 완료나 출시 가능 판정이 아니다.
