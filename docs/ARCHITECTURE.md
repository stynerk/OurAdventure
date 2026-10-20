# Shared Adventure — Engineering Architecture

기준: 2026-10-19 · 구현 브랜치 `engineering/shared-adventure-firebase` · 운영 배포 전

## 근거와 범위

- 확인한 main 기준 커밋: `00e78ef`. 루트 `index.html`, `gj-family-quest` 및 사진/일기 저장 방식은 변경하지 않았다.
- Phase 1 명세와 인증 핸드오프는 `feature/shared-adventure-phase1-plan-20261018`에서 가져왔다. 해당 기획 PR #2의 병합을 의미하지 않는다.
- 최신 사용자 지침의 그룹 확장/인증 방향을 적용한다. 루트의 과거 문서에 있는 ‘로그인 제외’는 기존 가족 앱에만 적용한다.
- `/next/`: 프레임워크 없는 ES modules, 기존 9개 Quest 콘텐츠의 버전 고정 JSON 재사용. 콘텐츠 생성/편집, 사진 업로드, 익명 계정 기기 간 복구 제외.
- 이 구현은 기존 화면 전체의 포팅이 아니다. 기존 여행 일기/사진/시간표는 원래 앱에서 계속 제공한다. 새 앱은 그룹 생성·참여·Quest·제출·관리 검증에 집중한다.

## 구조 / 선택 이유

| 계층 | 구현 | 이유 / 비용 |
|---|---|---|
| 프런트 | GitHub Pages `/next/`, 해시 라우팅 | 기존 정적 호스팅 유지, SPA rewrite 불필요 |
| 인증 | Google owner / Anonymous member | 참여자에게 로그인 UI 없이 인증 UID 부여 |
| 읽기 | Firestore SDK + onSnapshot | 그룹 공동 진행 실시간 반영; 읽기 비용 발생 |
| 쓰기 | 7개 callable Functions, Node 22, 서울 리전 | 초대 해시 검증·원자적 완료·제출을 한 경계에서 통제; 함수 운영/요금 필요 |
| 권한 | Rules는 직접 쓰기 전면 차단, Functions는 매 요청 서버 검증 | Admin SDK가 Rules를 우회하므로 서버 자체 검증 필수 |
| 코스 | `next/course.json`, `functions/course.json` | root 원본을 수정하지 않고 동일 JSON 추출; 다음 버전은 새 ID로 발행 |

Callable 요청에는 SDK가 인증 토큰을 첨부한다. 서버는 `request.auth`를 신뢰 경계로 사용하며 클라이언트의 `uid/ownerId/role` 값을 사용하지 않는다. 참고: https://firebase.google.com/docs/functions/callable

## Firestore 데이터

| 경로 | 주요 데이터 | 클라이언트 읽기 |
|---|---|---|
| `rooms/{roomId}` | ownerId, title, mode, status, courseVersion, questIds, requiredQuestIds, sharedDone, memberCount, capacity, createdAt/closedAt | 해당 방 member. ownerId 조건의 방장 목록 query 허용 |
| `rooms/{roomId}/members/{uid}` | role, displayName, participantCode, done[], submittedAt, joinedAt/lastSeenAt | 본인 또는 방장; 목록은 방장만 |
| `rooms/{roomId}/activity/{eventId}` | type, uid, questId, 서버 시각 | 방장만 |
| `invites/{sha256(token)}` | roomId | 불가 |
| `roomSecrets/{roomId}` | 현재 inviteHash | 불가 |

- 9개로 제한된 코스라 individual progress와 submission을 member 문서에 합쳤다. 논리 개념은 유지하되 과도한 서브컬렉션과 다중 읽기를 줄였다. 방 생성 시 requiredQuestIds를 스냅샷하므로 제출 시 클라이언트 코스 조작은 무효다.
- shared 완료는 room 문서의 `sharedDone`, individual 완료는 본인 member의 `done`을 서버 트랜잭션으로 갱신한다. 동일 미션은 멱등이며 감사 이벤트도 한 번만 생성한다.
- 참여자 가입은 기존 멤버를 덮어쓰지 않는다. 동일 별칭은 허용한다. participantCode는 선택 필드이며 신원 증명이나 중복 방지 수단이 아니다.
- `lastSeenAt`은 individual 완료/제출 등 일부 쓰기 시각이다. 접속 상태/위치 추적이나 온라인 표시로 해석하지 않는다.
- 방 생성은 draft를 저장하지 않고 생성 트랜잭션에서 곧바로 open으로 만든다. 이후 open → closed만 지원한다.
- 학교 제출 요약은 member만 분모로 사용하고 방장은 별도 표시한다. 방장도 자신의 Quest를 진행할 수 있다. 명단이 없으므로 미입장 학생 수를 계산하지 않는다.

## 요청 계약

| Function | 인증 / 검사 | 결과 |
|---|---|---|
| createRoom | Google provider, 제목 ≤60자, 알려진 courseId, 유효 mode | roomId, 원문 token (일회 응답) |
| previewInvite | 높은 엔트로피 token 검증, open 상태 | title/mode/questCount/roomId만. 가입 전 미리보기 |
| joinRoom | 인증 UID, 유효 초대, open, 정원 | member 생성 또는 기존 member 유지 |
| completeQuest | 인증 + 멤버십, open, 고정 questId | 공동 또는 본인 스탬프만 갱신 |
| submit | 인증 + 멤버십, individual, open, 서버의 필수 미션 충족 | 서버 제출 시각, 중복 무해 |
| closeRoom | owner + 멤버십 | 되돌릴 수 없는 closed, 중복 무해 |
| rotateInvite | owner + 멤버십, open | 새 token, 기존 token 폐기, 기존 멤버 유지 |

방 ID나 초대 토큰은 관리 권한을 주지 않는다. mode 변경 API는 없다. 종료·완료·가입은 room 읽기를 포함하는 트랜잭션으로 경합한다. Security Rules 참고: https://firebase.google.com/docs/firestore/security/rules-conditions

## 프런트 세션 및 실패 처리

- Auth 초기화를 기다린 후, 세션이 없을 때만 signInAnonymously. 이미 Google 세션이면 유지한다.
- 기존 익명 참가자가 방장이 되려는 경우 linkWithPopup으로 UID 보존을 시도한다. 기존 Google 계정과 충돌 시 자동 세션 교체하지 않고 SDK 오류를 표시한다. 이 복구 UX는 추가 검증 필요.
- auth 변경/라우트 이탈 시 listener 정리. 사용자 입력은 HTML 이스케이프한다.
- 초대 원문은 Firestore에 저장하지 않는다. URL fragment에 넣고 referrer를 차단한다. 새로고침한 방장이 다시 공유하려면 링크를 재발급한다. 기존 링크를 조회해서 복원하지 않는다.
- 서버 응답 전에는 완료를 낙관적으로 표시하지 않는다. 오프라인 큐/동기화 성공 보장 없음. 서버 캐시 상태를 구분한다.
- 운영 설정이 없거나 초기화가 실패하면 안내와 기존 앱 링크 표시. 실시간 읽기 권한 오류는 별도 실패 화면 표시.

## 운영 전 미해결 사항

- Unknown: 실제 Firebase 프로젝트 ID, Console 권한, 요금제, OAuth 도메인, 운영 설정. 실제 Google popup/모바일/교차기기 성능은 별도 검증 필요.
- 서버 함수 정원 100명, 인스턴스 상한 3개는 개발 기본값이며 사용자 승인된 제품 정책이 아니다.
- App Check, 사용자별 생성/가입 속도 제한, 익명 계정/데이터 정리 및 보관 정책은 아직 미구현이다. 방 정원과 초대 재발급은 남용을 완전히 막지 못한다. 공개 운영 전에 보완해야 한다.
- 공개 인터넷에 previewInvite를 노출하면 유효한 토큰 보유자는 방 제목을 볼 수 있다. 방 이름에도 실제 학생 정보 입력 금지.
- 별도 Firebase 프로젝트에서 emulator → 가상 사용자 파일럿 → 운영 배포 순으로 진행한다. 기존 가족 사이트에는 새 앱 진입 CTA를 추가하지 않았다.
