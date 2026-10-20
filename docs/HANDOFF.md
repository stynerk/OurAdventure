# Engineering → Orchestrator / Product / UX / QA

2026-10-19 · Shared Adventure Phase 1

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
- 사진 업로드·코스 빌더·익명 세션 기기 간 복구 제외.

## 구현상 선택 / 제품 확정과 구분

- aggregate member 문서에 개인 progress/submission 저장; 서버 트랜잭션 사용.
- 독립 `/next/`와 해시 라우터, draft 저장 없이 open 생성.
- 정원 총 100명(방장 포함), Functions maxInstances=3은 파일럿용 개발 기본값. 부하/비용 검증 후 조정 필요.
- 개별 제출 요약의 분모는 일반 member만 포함. 방장의 자신의 진행은 별도 행으로 표시.
- 초대 토큰 원문 복원 불가. 새로고침 후 공유하려면 재발급; 이전 링크는 폐기된다.

## Validation

- 자동 검사 3개 + Firestore 통합 검사 10개 통과.
- 실제 callable handler를 로컬 HTTP에서 실행한 SDK/브라우저 흐름 통과. 표준 Functions emulator는 환경 Unix socket 권한 때문에 차단됨.
- 자세한 범위와 미검증 항목은 QA.md. 실서비스/실제 Google OAuth 통과로 표현하지 않는다.

## Risks / Next Actions

| 담당 | 다음 작업 | 완료 기준 |
|---|---|---|
| Orchestrator / Engineering | Firebase 프로젝트 ID·요금제·Console 접근권한 확인 | 실제 배포 대상과 책임자 식별 |
| Engineering | Google/Anonymous 활성화, 허용 도메인, Rules/Functions 및 Pages 연결 | 실제 인증·생성·참여·권한 동작 검증 |
| Product / Orchestrator | 데이터 보관·삭제, 정원, 요청 제한·App Check 정책 | 공개 파일럿 운영 경계 확정 및 필요한 코드 반영 |
| UX & Content | 실기기에서 링크 입장·초대 재발급·계정 충돌·오프라인 UX 검토 | 설명 없이 방 생성/참여 및 진행 가능 |
| QA & Research | 가족 3명 + 가상 참여자 5명 테스트, 모바일 실기기 | 상태 혼합·권한 누출·중복 제출 0건, 목표 시간 측정 |

## Release state

로컬 코드와 테스트가 준비된 상태다. 개발 브랜치/PR 상태는 GitHub에서 확인한다. `main` 병합, 운영 Firebase 설정·배포, Pages 실제 신규 경로 배포 및 사용자 파일럿은 수행하지 않았다. 기존 공개 사이트는 이번 개발 브랜치 작업으로 변경되지 않는다.
