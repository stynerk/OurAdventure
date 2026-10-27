# QA 1차 결과 — 그룹 스탬프 투어 V2

2026-10-28(KST). 기준: [체크리스트 40개 항목](QA_CHECKLIST_V2.md), PR #18 `fd8cdfec00b325fa1a9b7f3dc2d326690d3dc165` 위 `engineering/qa-v2`. 기능 코드는 수정하지 않았다. QA용 테스트·테스트 서버·증거·이 문서만 추가/수정한다. 머지·배포·결제·운영 권한 변경은 수행하지 않는다.

## 판정 범위

✅는 이번 에뮬레이터/데스크톱 Chromium에서 확인한 범위의 통과다. 실기기 통과를 뜻하지 않는다. ❌는 요구 기능 미구현 또는 화면 흐름 미충족이다. ⏭는 이 1차 환경에서 실행할 수 없어 보류한 항목이다(원본 체크리스트의 “해당 없음”을 제품 요구 제외로 해석하지 않는다). 한 항목의 일부만 충족하면 ❌로 판정했다.

Windows, Node 24.20.0, Java 21, demo Auth/Firestore/Storage, Playwright Chromium의 독립 브라우저 컨텍스트로 리더·멤버·비멤버를 구분했다. 320/390px 뷰포트이며 물리 휴대폰이나 WebKit 검증은 아니다. 실제 Firebase 13.0.0 SDK와 exported callable HTTP handler를 사용한다. 로컬 HTTP harness는 운영 Cloud Run/Functions 인프라 검증을 대신하지 않는다. 모델 통합의 사진 검증 fixture와 실제 Storage 업로드 통합/브라우저 검증도 구분한다. 사진·계정·저장 기록은 합성 테스트 자료다.

## 결과표

아래 파일의 테스트 이름 또는 `PASS QA …` 로그가 근거다. 새 스크린샷·관찰값·실행 로그·의존성 조사는 [QA 증거 폴더](engineering/qa-v2/)에 보관한다.

### A. 로그인·그룹

| ID | 결과 | 근거 | 남은 확인 |
|---|---|---|---|
| A1 | ✅ | [group-contract.test.mjs](../tests/group-contract.test.mjs) `group and trip creation reject unauthenticated and anonymous requests before DB use`: 그룹 및 여행 null 인증 거부 | 실제 Google OAuth는 운영 확인 |
| A2 | ✅ | [groups-browser.mjs](../tests/groups-browser.mjs) `PASS QA A2`: 만들기 버튼 연속 `.click()` 2회(두 번째는 disabled 제어) 후 DB 그룹 1개; [group-model.integration.test.mjs](../tests/group-model.integration.test.mjs) `concurrent group retries are idempotent; request ID cannot change its content` | 실기기 터치 감각은 후속. 강제 submit 별도 관찰은 아래 참조 |
| A3 | ✅ | [groups-browser.mjs](../tests/groups-browser.mjs) `PASS QA A3`: localStorage/Auth IndexedDB 보존 후 컨텍스트 종료·재생성, 같은 그룹 및 여행 3개 목록 복원 | Safari 저장 공간 회수·실제 앱 강제 종료 별도 |

### B. 여행·코스

| ID | 결과 | 근거 | 남은 확인 |
|---|---|---|---|
| B1 | ✅ | [groups-browser.mjs](../tests/groups-browser.mjs) `blankTrip`, `fresh empty forms, zero places and closed-trip reentry`; [group-model.integration.test.mjs](../tests/group-model.integration.test.mjs) `group is reusable; new trips have no posts or completions and can have zero places` | 없음(이번 범위) |
| B2 | ❌ | [4개 목적지 관찰값](engineering/qa-v2/observations.json), [여행 생성 화면](engineering/qa-v2/course-gaps.png): 목적지·수동 장소만 있고 추천 동작 없음. [groups.mjs](../next/groups.mjs) `tripForm`/`sendCreation`에 추천 API 연결 없음 | 추천 연결 구현 후 지도 공급자의 실제 장소·해외 결과 검증 필요 |
| B3 | ❌ | 같은 관찰값/여행 생성 화면: “추천 결과 없음” 상태와 그 상태에 따른 직접 입력 안내 없음. 일반 수동 입력란을 무추천 상태 처리로 인정하지 않음 | 추천 연결과 빈 결과 UX 구현 필요 |
| B4 | ✅ | [groups-browser.mjs](../tests/groups-browser.mjs): 대릉원·첨성대 생성 후 두 역할의 `.stamp-tile strong` 배열이 같은 입력 순서인지 검사; [trip-views.test.mjs](../tests/trip-views.test.mjs) 개인별 도장 계산 | 없음(이번 범위) |
| B5 | ✅ | [groups-browser.mjs](../tests/groups-browser.mjs) `PASS QA B5`: 장소 0개에서 스탬프 제어 없음·자유 기록 진입 존재; [group-model.integration.test.mjs](../tests/group-model.integration.test.mjs) `free photos are posts but never create a stamp; feeling may be omitted` | 실제 카메라 권한은 실기기 |
| B6 | ❌ | [여행 생성 화면](engineering/qa-v2/course-gaps.png), [관찰값](engineering/qa-v2/observations.json): AI 생성 시작·로딩·실패 상태가 없음. 수동 여행 생성 성공과 AI 실패 fallback은 다른 검증 | AI 연결 및 지연/실패 fallback 구현 필요 |
| B7 | ❌ | [groups.mjs](../next/groups.mjs) `tripForm`/`sendCreation`: 장소 이름을 직접 서버에 전달하며 AI 후보 목록·응답 필터가 없음 | 승인된 장소 집합으로 응답 제한하는 연결 및 변조 테스트 필요 |
| B8 | ❌ | [관찰값](engineering/qa-v2/observations.json): 경주·부산·제주·서울 각각에서 AI 생성 진입이 없어 문구 4회 품질 검증을 수행할 수 없음. 스파이크/고정 문구를 현재 앱 생성 결과로 취급하지 않음 | 기능 연결 후 4도시 실제 생성·위험 표현·운영정보 단정 검토 필요 |
| B9 | ❌ | [groups-browser.mjs](../tests/groups-browser.mjs) `QA FINDING B2/B3/B6/B7/B8/B9`, [관찰값](engineering/qa-v2/observations.json): 목적지 변경 시 이전 수동 장소가 남음. 추천/AI 결과의 목적지별 상태 초기화도 미구현 | 초기화·이전 비동기 응답 폐기 구현 후 재검증 |
| B10 | ❌ | [장소 관리 화면](engineering/qa-v2/place-management-gap.png): 관리 화면에 장소 추가 UI 없음. 서버 부분은 [group-model.integration.test.mjs](../tests/group-model.integration.test.mjs) `adding a place preserves prior individual completion and is retry safe` 통과하지만 사용자 흐름 미충족 | 추가 UI 구현 및 두 역할 화면 갱신 검증 필요. 현재 화면은 서버에서 다시 읽는 구조 |
| B11 | ❌ | 같은 관리 화면/관찰값과 [group-contract.test.mjs](../tests/group-contract.test.mjs) callable 목록: 장소 삭제 UI·삭제 callable·사진 존재 시 확인 흐름 없음 | 사진 있는 장소 삭제 확인·기록 처리 정책과 서버 구현 필요 |

### C. 초대·참여

| ID | 결과 | 근거 | 남은 확인 |
|---|---|---|---|
| C1 | ✅ | [group-model.integration.test.mjs](../tests/group-model.integration.test.mjs) `AC-3a: two simultaneous joins at nine members commit exactly one final seat`; [groups-browser.mjs](../tests/groups-browser.mjs) `full race clears introduction` 초과 안내 | 물리 2대 동시 터치는 후속, 트랜잭션 경쟁은 실행 |
| C2 | ✅ | [group-model.integration.test.mjs](../tests/group-model.integration.test.mjs) `AC-3b: concurrent duplicate reentry never increases membership or overwrites nickname, even when full`; 브라우저 반복 링크 재진입 | 익명 계정의 다른 기기 복구를 보장하지 않음 |
| C3 | ✅ | [group-model.integration.test.mjs](../tests/group-model.integration.test.mjs) `AC-3c: invalid and full links reveal only state`; [groups-browser.mjs](../tests/groups-browser.mjs) full/malformed/revoked 화면 그룹 내용 제거 | 없음(이번 범위) |
| C4 | ✅ | [groups-browser.mjs](../tests/groups-browser.mjs) 초대 화면의 `다른 기기에서는 이어서 쓰기 어려울 수 있어요.` 확인 | 없음(이번 범위) |

### D. 사진 스탬프

| ID | 결과 | 근거 | 남은 확인 |
|---|---|---|---|
| D1 | ✅ | [groups-browser.mjs](../tests/groups-browser.mjs) finalize gate: 실제 업로드 후 서버 저장 전 `내 스탬프 미완료`, posts/completions 0; [photo-storage.integration.test.mjs](../tests/photo-storage.integration.test.mjs) `AC-4a/4b/4c/4f/5b` | 실제 이동통신 지연 별도 |
| D2 | ✅ | [groups-browser.mjs](../tests/groups-browser.mjs): 메타데이터 조회가 아닌 Storage `upload` 바이트 요청을 `internetdisconnected`로 중단했는지 검사, 파일 미리보기 보존·동일 요청 재시도 성공; finalize 응답 유실 후 새로고침에서도 느낌/사진 복원 | 실제 비행기 모드·OS 백그라운드 중단 후속 |
| D3 | ✅ | [photo-storage.integration.test.mjs](../tests/photo-storage.integration.test.mjs) `AC-4a/4b/4c/4f/5b`; [groups-browser.mjs](../tests/groups-browser.mjs) A 완료 후 B의 `내 스탬프 0/1` | 없음(이번 범위) |
| D4 | ✅ | 같은 Storage 테스트 동시 finalize 3회/기록 1개; [groups-browser.mjs](../tests/groups-browser.mjs) submit 연타·응답 유실 재시도 후 photos/completions 수 검사 | 없음(이번 범위) |
| D5 | ✅ | [groups-browser.mjs](../tests/groups-browser.mjs) `PASS QA D5`, [같은 계정 화면](engineering/qa-v2/same-account.png): 독립 컨텍스트가 같은 Google 에뮬레이터 UID로 로그인 후 동일 `1/1` 조회 | 물리 다른 기기·실제 OAuth에서 재확인; 익명 UID 새 생성은 대상 아님 |
| D6 | ✅ | [group-model.integration.test.mjs](../tests/group-model.integration.test.mjs) `same nickname does not share completion; trips and groups are isolated`; Storage setup에서도 A/B는 같은 별칭 | 없음(이번 범위) |
| D7 | ✅ | [photo-storage.integration.test.mjs](../tests/photo-storage.integration.test.mjs) `QA D7: exactly sixty Unicode characters publish, sixty-one rejects without an extra post`; 기존 optional-line 테스트·[photo-upload.test.mjs](../tests/photo-upload.test.mjs) 길이 검증 | IME·모바일 입력 조합은 실기기. 60/61 경계는 한글 문자로 실행 |

### E. 함께 보기·기록

| ID | 결과 | 근거 | 남은 확인 |
|---|---|---|---|
| E1 | ✅ | [group-model.integration.test.mjs](../tests/group-model.integration.test.mjs) `rules deny outsiders, role escalation, completion forgery and peer post mutation`; [photo-storage.integration.test.mjs](../tests/photo-storage.integration.test.mjs) `T9 AC-5a/5b` 비멤버 Firestore/Storage 직접 읽기 거부 | 운영 Rules/Storage 배포 상태 별도 |
| E2 | ✅ | [groups-browser.mjs](../tests/groups-browser.mjs) 업로드 후 finalize 전 타인 Storage 읽기 거부; [photo-storage.integration.test.mjs](../tests/photo-storage.integration.test.mjs) pending feed/bytes 비노출 | 없음(이번 범위) |
| E3 | ✅ | [photo-storage.integration.test.mjs](../tests/photo-storage.integration.test.mjs) `T9 AC-5c: other member, leader, outsider and unauthenticated caller cannot edit/delete another author; direct writes denied`; 브라우저 리더 callable 거부 | 없음(이번 범위) |
| E4 | ✅ | 같은 파일 `T9 concurrent own deletion/retry removes only own last stamp`; [groups-browser.mjs](../tests/groups-browser.mjs) 마지막 사진 삭제 후 스탬프 `0/1` | 없음(이번 범위) |

### F. 종료·결과물

| ID | 결과 | 근거 | 남은 확인 |
|---|---|---|---|
| F1 | ✅ | [group-model.integration.test.mjs](../tests/group-model.integration.test.mjs) `AC-6a: endTrip rejects members and outsiders` 및 `T11 AC-6a: only ended-trip leader can configure results`; [report-browser.mjs](../tests/report-browser.mjs) 비리더 구성 차단·저장 전 권한 재확인 | 실제 운영 권한/배포 별도 |
| F2 | ✅ | [photo-storage.integration.test.mjs](../tests/photo-storage.integration.test.mjs) `ended trip denies new Storage uploads` / `T9 closed trip rejects own edit/delete/free create`; [groups-browser.mjs](../tests/groups-browser.mjs) 종료 후 양 역할 4탭 읽기·작성 없음 | 없음(이번 범위) |
| F3 | ✅ | [report-browser.mjs](../tests/report-browser.mjs) `zero photos cannot preview or download a blank image`, `actual Storage read failure blocks PNG and preserves selected photos for retry` | 실기기 메모리 부족·디코더 차이는 후속 |
| F4 | ⏭ | 물리 iOS Safari·Android Chrome 미보유. [report-browser.mjs](../tests/report-browser.mjs)의 데스크톱 Chromium PNG 다운로드 성공을 모바일 저장 성공으로 대체하지 않음 | 실기기 2종에서 피드/스토리 각 저장·파일/사진 앱 열기·취소 확인 |
| F5 | ✅ | [report-browser.mjs](../tests/report-browser.mjs) `PASS REPORT AC-6d`, `PASS REPORT REVIEW`: 두 템플릿×두 크기 및 여행 이름 표시 1종, 미리보기/다운로드 SHA-256·정확한 크기·그려진 한국어/옵션 텍스트 검사 | OS별 한글 폰트/다운로드 실물 비교는 F4와 함께 |

### G. 화면 구성·지난 여행

| ID | 결과 | 근거 | 남은 확인 |
|---|---|---|---|
| G1 | ✅ | [groups-browser.mjs](../tests/groups-browser.mjs) 양 역할 nav 링크 4개·각 탭 전환; [trip-views.test.mjs](../tests/trip-views.test.mjs) `closed trips retain all four routes` | 실기기 safe area 후속 |
| G2 | ✅ | [trip-views.test.mjs](../tests/trip-views.test.mjs) `member DOM excludes management and direct management route does not read group details`; [groups-browser.mjs](../tests/groups-browser.mjs) 멤버 버튼 DOM 없음·직접 경로 거부 | 없음(이번 범위) |
| G3 | ✅ | [groups-browser.mjs](../tests/groups-browser.mjs) `newly ended trip retains four read-only tabs for both roles`; [report-browser.mjs](../tests/report-browser.mjs) 리더/멤버 종료 리포트; [trip-views.test.mjs](../tests/trip-views.test.mjs) 종료 작성/관리 버튼 없음 | 없음(이번 범위) |
| G4 | ✅ | [groups-browser.mjs](../tests/groups-browser.mjs) 두 여행 생성 후 첫 여행 종료·지난 여행에서 재진입, A3 재시작 후에도 세 여행 링크 조회 | 없음(이번 범위) |

### H. 기존 앱 보존

| ID | 결과 | 근거 | 남은 확인 |
|---|---|---|---|
| H1 | ✅ | [course.test.mjs](../tests/course.test.mjs) 루트 index 정규화 SHA-256 고정 검증; [groups-browser.mjs](../tests/groups-browser.mjs) `PASS QA H1`: 루트에서 합성 이전 기록 복원·4탭·9스탬프·퀘스트 열기; [루트 화면](engineering/qa-v2/legacy-root.png) | 기존 외부 실사 URL·물리 카메라·A4 인쇄 전체는 이번 회귀 범위 밖 |
| H2 | ✅ | [groups-browser.mjs](../tests/groups-browser.mjs) `PASS QA H2`: 두 저장 키에 sentinel 합성 값을 넣은 뒤 V2 생성·재시작·사진/삭제·종료와 루트 읽기 후 문자열 바이트 동일; [session.test.mjs](../tests/session.test.mjs) 기존 키 격리 | 실이용자 데이터를 읽거나 사용하지 않음 |

## 합계와 후속

**40개 = ✅ 31 / ❌ 8 / ⏭ 1.** 체크리스트와 자동 테스트 개수는 다르다. 자동 테스트 프로세스가 성공해도 아직 연결하지 않은 기능 8개를 통과로 보지 않는다.

❌ 목록은 B2 추천/실재 장소, B3 무추천 안내, B6 AI 로딩/실패 fallback, B7 후보 장소 제한, B8 네 도시 AI 문구 품질, B9 목적지 변경 초기화, B10 장소 추가 사용자 흐름, B11 장소 삭제 확인이다. B10의 서버 API 보존/재시도만 통과했다. 기능 수정 금지 범위에 따라 고치지 않았다. PM이 코스/AI 연결 작업과 장소 관리 작업으로 분리해 우선순위를 정한 뒤 후속 구현에서 재검증해야 한다.

실기기에서만 최종 판정할 항목은 F4(필수 보류)다. A3 저장소 유지, C1 실제 두 기기 동시 조작, D2 비행기 모드/백그라운드, D5 실제 같은 계정 재로그인, D7 IME/카메라, G1 safe area, F5 한글 폰트는 에뮬레이터 통과 범위에 덧붙일 실기기 점검이다. 운영에서만 확인할 항목은 실제 Google OAuth/허용 도메인·배포 Functions/Rules/Storage 접근·GA 수신이다. 실제 Storage 운영 업로드/다운로드는 프로젝트 요금제/Blaze와 운영 설정이 준비된 뒤 확인해야 한다. B2·B8은 기능 연결 후 실제 지도/AI 공급자 결과 품질·쿼터도 확인한다. 이들은 이번 실행에서 운영으로 연결하지 않았다.

## 실행 및 재현

- `npm test`: 단위/계약/패키징 35개.
- `npm run test:reports`: demo Auth/Firestore/Storage 안에서 Storage 11개(60/61 경계 추가), 그룹 24개, Room 13개 = 통합 48개, 실제 SDK와 그룹/리포트 Chromium을 순차 실행한다. 로컬 Windows에서는 작업공간 Java/Chromium/공식 SDK 캐시와 제한 메모리 런처를 사용했다. 통합 48개 성공 뒤 브라우저 테스트를 수정했으므로 최종 UI/PNG는 같은 에뮬레이터에서 `node tests/qa-browser-verify.mjs`로 분리 재실행했다. 실제 증거는 [통합 로그](engineering/qa-v2/integration.log), [최종 브라우저 로그](engineering/qa-v2/verification.log), [environment.json](engineering/qa-v2/environment.json)에 있다.
- `npm audit --json`, `npm ls @grpc/grpc-js @opentelemetry/core fast-uri uuid --all --json`: 읽기 전용 의존성 조사. audit 종료 코드 1은 아래 알려진 경고 검출이며 테스트 실행 실패와 별개다.
- 새 QA 브라우저 관찰은 `tests/groups-browser.mjs`에서 기존 회귀와 함께 실행된다. `QA FINDING`은 발견 사실 기록이며 미구현 요구의 통과 assertion이 아니다. 실패 시 결과표를 고치고 기능 코드는 바꾸지 않는다.

운영 배포 CI와 구분해 위는 로컬 실행이다. 자동 승인 검토가 크레딧 부족으로 최초 실행을 거부했으나 사용자 한도 복구 안내 후 같은 허용 작업을 재시도했다. 시스템 권한/검토를 우회하지 않았다.

초기 브라우저 실행에서 테스트가 SDK에 없는 `setMaxUploadRetryTime` 함수를 호출해 중단됐다. SDK의 실제 `maxUploadRetryTime` setter로 테스트만 수정하고 다시 실행했다. 초기 증거의 그룹·Storage·Room 통합 48개는 통과했지만 그 실행 전체를 통과로 보고하지 않는다.

두 번째 시도는 장애 주입 대상을 resumable 명령 헤더로만 골라 작은 PNG의 multipart 업로드를 중단하지 못했다. 저장 자체는 성공했으나 재시도 버튼을 기다리던 테스트가 시간 초과했다. [해당 시도](engineering/qa-v2/retry-attempt.log)를 남기고 Storage POST 업로드 요청을 중단하도록 테스트를 바로잡았다. 메타데이터 GET은 허용해 업로드 단계 장애인지 검증한다. 물리 네트워크의 부분 전송 검증을 완료했다는 뜻은 아니다.

체크리스트 외 추가 관찰: 버튼의 disabled 제어를 우회해 같은 폼에 합성 `submit` 이벤트를 연속 dispatch하면 두 번째 FormData가 비어 `undefined.trim` 예외가 발생한다. 그룹은 여전히 1개였다. [초기 실행 관찰](engineering/qa-v2/initial-attempt.log)에 남겼다. 이는 일반 버튼 연속 클릭 A2와 구분하는 입력 방어 이슈이며 기능 코드는 수정하지 않았다. 호출 전 폼 값 존재 검사/처리 중 제출 무시를 후속 검토해야 한다. 이번 40개 결과 합계에는 별도 항목을 추가하지 않았다.

## 루트 개발 의존성 경고 11건: 영향과 정리 계획

[npm audit 원문](engineering/qa-v2/npm-audit.json), [설치 의존 경로](engineering/qa-v2/dependency-paths.json). 높음 5·보통 6·치명적 0이며 “11건”은 audit가 경고한 패키지 수다. 같은 원인에 따른 상위 패키지 경고를 독립된 공격 11개로 합산하지 않는다. 루트 package.json의 직접 의존성은 모두 devDependencies다.

| 패키지 | 심각도 | 현재 경로·영향 | 정리 계획(이번에는 미실행) |
|---|---|---|---|
| @grpc/grpc-js | 높음 | 루트 firebase → @firebase/firestore → 1.9.16. 특정 TLS 인증 컨텍스트/서버 오류 처리 취약점. Node 테스트 SDK 경로 | Firebase SDK가 지원하는 수정된 gRPC 해석 경로 확인 후 별도 lockfile 갱신 후보 검증 |
| @firebase/firestore | 높음 | 위 gRPC의 상위 패키지 경고. 루트 테스트의 Node Firestore 클라이언트 | SDK 호환성·에뮬레이터 Rules/트랜잭션 재검증 |
| @firebase/firestore-compat | 높음 | firebase 패키지의 compat 전파 경고 | 현재 앱이 modular SDK를 사용한다는 사실과 패키지 전체 audit 결과를 구분, SDK 갱신과 함께 검증 |
| firebase | 높음 | 루트 직접 개발 의존성, 위 Firestore 전파 | 앱 CDN 버전과 테스트 SDK 버전 호환 계획을 별도 작성 |
| @firebase/rules-unit-testing | 높음 | 루트 직접 개발 의존성, firebase 전파 | Firebase/Rules 테스트 peer 의존성 호환 조합으로 함께 검증 |
| @opentelemetry/core | 보통 | firebase-tools → @google-cloud/pubsub → 1.30.1. W3C Baggage 파싱의 메모리 할당 문제 | CLI가 지원하는 core 수정 버전 경로 확인, 에뮬레이터 시작/종료 및 CLI 회귀 |
| @google-cloud/pubsub | 보통 | 위 OpenTelemetry의 상위 패키지 경고, CLI 경로 | firebase-tools 갱신 후보와 함께 확인 |
| uuid | 보통 | firebase-tools → gaxios → uuid 9.0.1. 일부 v3/v5/v6 buffer 사용 시 경계 검사 문제 | CLI 의존 경로의 수정 버전 확인; 앱 crypto.randomUUID 사용과 구분 |
| gaxios | 보통 | firebase-tools 아래 6.7.1, 위 uuid 전파 | CLI 인증/요청 회귀 포함 갱신 검증 |
| firebase-tools | 보통 | 루트 개발/에뮬레이터·배포 CLI. Pub/Sub·gaxios 경고 전파 | 별도 브랜치에서 지원되는 CLI 버전 조합 조사 후 승인된 변경만 적용 |
| fast-uri | 보통 | firebase-tools → ajv → 3.1.8. URI scheme/host/path 정규화 관련 | 수정 범위(현재 advisory는 3.1.9 이상)와 ajv 호환성 검증 후 lockfile 갱신 후보 평가 |

루트 node_modules는 Pages 공개 파일에 포함하지 않는다([course.test.mjs](../tests/course.test.mjs) 패키징 검사). 실제 브라우저는 [next/app.js](../next/app.js)의 공식 gstatic Firebase 13.0.0 modular SDK를 로드하므로 Node gRPC 패키지를 브라우저에 직접 번들하지 않는다. 이것으로 운영 앱 전체가 안전하다고 결론 내리지 않는다. Functions는 별도 package/lockfile의 운영 의존성이므로 이번 “루트 11건” 조사를 Functions 전체 audit로 확장해 주장하지 않는다. 설치 트리의 firebase-admin/CLI 다른 경로에는 gRPC 1.14.6도 있어, 모든 gRPC 사본을 취약 버전으로 뭉뚱그리지 않는다.

정리 순서는 (1) 이 경로·버전 증거 고정, (2) 별도 의존성 브랜치에서 상위 SDK/CLI의 공식 지원 조합과 lockfile diff 검토, (3) 작은 범위별 변경 후보 수립, (4) 동일 단위/Rules/Storage/SDK/브라우저 재검증과 audit 비교, (5) 검토 후 별도 PR이다. `npm audit fix --force`가 제안하는 Firebase 9.14.0·Rules 테스트 2.0.7·CLI 14.23.0 방향은 현재 고정 버전의 단순 보안 업그레이드로 취급하지 않는다. 이 PR에서 npm install/update/audit fix·override·package/lockfile 변경은 하지 않았다.
