# T13 Firebase Analytics 연결 — 2026-10-27

기준: PM [데이터 트래킹 명세 PR #10](https://github.com/stynerk/OurAdventure/pull/10). 기획 문서 수정 없이 `/next` 개발 코드에 연결한다. T3 브랜치 후속이며 공개 배포는 하지 않는다.

## 현재 연결한 이벤트

| 이벤트 | 서버 확정 또는 실행 시점 | 파라미터 |
|---|---|---|
| `login` | Google 로그인·익명 계정 연결 성공 | `method=google` |
| `group_create` | 새 그룹 생성 응답 | 그룹 ID, 리더 |
| `group_open` | 그룹·여행 목록 서버 조회 성공 | 그룹 ID, 역할, `trip_count` 구간 |
| `trip_create_start` | 권한 확인 후 빈 여행 생성 폼 열기 | 그룹 ID, 리더, `draft` |
| `trip_create` | 새 여행 생성 응답 | 그룹·여행 ID, 리더, `active`, 장소·일수 구간, `ai_used=false` |
| `past_trip_open` | 종료된 여행·장소 서버 조회 성공 | 그룹·여행 ID, 역할, `ended`, 종료 경과일 구간 |

공통: `app_version=v2.0.0`, `schema_version=1`; 사용자 속성은 `auth_type=google/anonymous`만 설정하고 로그아웃 시 비운다. Firebase UID, 이메일, 별칭은 보내지 않는다. ID는 서버가 만든 Firestore 자동 ID 형식만 허용한다.

장소·여행 개수 구간: `0`, `1-3`, `4-6`, `7-10`, `11+`. 일수: `1`, `2-3`, `4-7`, `8+`. 종료 경과일: `0`, `1-7`, `8-30`, `31+`, 종료 시각이 없으면 `unknown`.

직접 입력 목적지는 시·도 수준을 보장할 수 없어 `destination_region`을 보내지 않는다. T4 지도 추천에서 정규화된 지역을 확보한 뒤 연결한다. T6 초대, T7 탭, T8 사진, T5 AI, T10 종료·리포트, T11 이미지 이벤트도 실제 기능 구현 시 연결한다. 구형 Room 미션을 v2 사진 완료로 집계하지 않는다.

보조 이벤트: `page_view(screen_name)`는 현재 그룹·여행 및 구형 화면의 고정 이름만, `logout`은 로그아웃 성공, `operation_error(operation,error_code)`는 허용된 callable 이름과 정규화 오류 코드만 전송한다. 오류 메시지는 보내지 않는다. 화면 조회 이벤트는 시도 횟수이고 성공한 상세 조회는 `group_open`/`past_trip_open`으로 구분한다.

생성 응답의 `replayed=true`는 성공 이벤트를 재전송하지 않는다. 따라서 응답 유실 후 재시도에서는 생성 집계가 누락될 수 있다. GA는 이용 흐름 분석용이며 생성 총수의 원장은 Firestore다. 서버 전송·정확한 집계는 후속이다.

## 설정과 전송 보호

- 배포 스크립트가 공개 웹 설정의 `measurementId`를 검증·보존한다. 없으면 SDK를 불러오지 않고 기존 앱은 동작한다.
- 초기 설정부터 `send_page_view=false`, 고정 서비스 URL·제목·빈 referrer를 지정한다. 수동 이벤트에도 고정 URL을 넣어 hash의 초대 토큰·ID와 query 유입을 방지한다.
- Google 신호와 광고 개인화를 코드에서 끈다. 사용자 ID는 설정하지 않는다.
- `analytics.mjs`의 이벤트별 허용 목록으로만 전송한다. 본문·좌표·사진·URL·임의 파라미터는 버린다.
- 에뮬레이터는 실제 GA에 전송하지 않는다. SDK 로드·지원 확인·전송 실패가 여행 기능에 오류를 전파하지 않는다.
- 디버그는 실제 설정에서 `analyticsDebug=true`일 때만 `debug_mode`를 붙인다. 배포 기본값은 false다.

## 실제 GA에서 남은 확인

1. Firebase 웹 앱 설정의 실제 `measurementId`를 기존 GitHub `FIREBASE_WEB_CONFIG` 공개 설정 JSON에 포함한다. 속성 번호나 스트림 번호를 측정 ID 대신 넣지 않는다. 이 작업에서 기존 비밀 설정을 읽거나 변경하지 않았다.
2. GA 웹 스트림의 향상된 측정은 끈다. 자동 페이지·폼·외부 링크 수집은 이 허용 목록을 거치지 않으므로, 수동 이벤트만 사용한다. 기존 별도 gtag/GTM 태그가 있으면 중복 전송도 확인한다.
3. GA 관리 화면의 Google 신호·광고 설정과 보관 2개월은 실제 콘솔에서 확인한다. 코드 설정만으로 보관 기간이 바뀌지 않는다.
4. 배포 승인 후 테스트용 환경에서 DebugView로 위 흐름과 URL·파라미터를 확인한다. 디버그 설정을 제거한다. 역할·상태·개수 구간 등을 GA 보고서에서 사용하려면 이벤트 범위 맞춤 측정기준으로 등록한다. 무작위 ID는 고유 값이 많으므로 일반 보고서 측정기준 등록은 피한다.

## 검증

로컬 `npm test`: 20개 통과. Analytics SDK 대역으로 허용·금지 파라미터, 원문·토큰 제거, 구간, 사용자 속성 초기화, 에뮬레이터 제외, 차단·오프라인 실패, 배포 산출물의 측정 ID 보존을 검사했다. 화면 컨트롤러 대역으로 그룹 열기 → 여행 생성 시작 → 지난 여행 열기의 이벤트 순서와 권한 실패·이전 화면 응답에서 미전송을 확인했다. 실제 GA 수신·관리 설정·공개 배포는 확인하지 않았다.

로컬 Playwright + Auth/Firestore 에뮬레이터에서 실제 Firebase SDK·callable HTTP 검증도 통과했다. 그룹 생성, 별개의 여행 생성, 빈 새 여행, 종료 여행 열람, 응답 유실 후 중복 없는 복구, 멤버·외부인의 권한, 로그아웃을 확인했다. 에뮬레이터에서는 GA 네트워크 전송을 비활성화했으므로 이 결과는 실제 GA 수신 검증과 구분한다. 기존 잠금 파일의 설치본을 워크스페이스 내 읽기용 디렉터리 연결로 재사용했으며 의존성을 변경하지 않았다.

공식 근거: [Firebase 웹 시작](https://firebase.google.com/docs/analytics/web/get-started), [이벤트 기록](https://firebase.google.com/docs/analytics/web/events), [수동 페이지 조회](https://developers.google.com/analytics/devguides/collection/ga4/views), [개인 식별 정보 제외](https://support.google.com/analytics/answer/6366371), [향상된 측정](https://support.google.com/analytics/answer/9216061).
