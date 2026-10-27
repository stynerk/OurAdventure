# T8 사진 저장·개인 스탬프 — 2026-10-28

사용자 요청: PR #14 위 `engineering/photo-stamp`. 운영 배포 없이 Firebase Auth/Firestore/Storage 에뮬레이터에서 개발한다. PR #14에는 별도 커밋 3196434로 종료 여행의 다음 탐험을 숨겼다.

## 저장 흐름과 실패 복구

스탬프 상세에서 촬영 또는 갤러리 사진 1장을 선택하고 선택 사항인 한 줄 느낌을 입력한다. JPEG/PNG/WebP, 0바이트 초과·최대 5MiB이며 느낌은 서버에서 Unicode 문자 60자까지 검사한다. 파일과 느낌·uploadId·requestId를 계정/그룹/여행/장소별 IndexedDB에 먼저 보관한다. 보관에 실패하면 업로드를 시작하지 않는다.

Storage 업로드 완료 전에는 완료를 표시하지 않는다. 완료 후 `finalizePhoto` callable로 저장 확정을 요청한다. 실제 Storage 파일의 메타데이터·크기·MIME·파일 시그니처를 서버가 확인하고, 인증 UID와 그룹 멤버십·여행 상태·장소를 검사한다. 클라이언트의 uid·verified·사진 경로 주장은 사용하지 않는다.

하나의 Firestore 트랜잭션에서 published Post, 미디어 중복 사용 claim, 공개 허용 manifest, 본인 StampCompletion, 장소/여행 개수를 갱신한다. 이 응답을 받은 뒤에만 본인 완료와 기록 수를 화면에 반영한다. 타인의 완료는 변경하지 않는다. 같은 장소에 새 사진을 남기면 사진만 추가하고 스탬프는 하나를 유지한다.

연타는 같은 진행 Promise와 요청 ID를 사용한다. 업로드 실패 시 같은 파일/ID로 재시도하며, 업로드는 성공하고 확정에 실패한 경우 파일을 다시 올리지 않는다. 응답만 유실된 경우도 같은 서버 요청으로 기존 결과를 반환한다. 새로고침 후 IndexedDB에서 같은 파일·느낌·요청을 복구한다. 저장 결과가 불확실한 동안 입력을 잠가 다른 내용으로 같은 ID를 보내지 않는다. 성공 또는 로그아웃 시 해당 계정의 보류 자료를 정리한다. 파일은 브라우저 저장소를 지우면 복구할 수 없다.

## Storage 규칙과 공개 시점

경로는 `groups/{group}/trips/{trip}/uploads/{authUid}/{uploadId}`다.

- 그룹 멤버이면서 본인 UID 경로이고 진행 중 여행일 때만 새 파일 생성 가능.
- MIME 세 가지와 5MiB 한도를 Rules에서도 강제한다. 서버도 크기·MIME·시그니처를 다시 확인한다.
- 기존 객체가 없다는 조건을 명시하며 덮어쓰기·메타데이터 변경·클라이언트 삭제·목록 조회는 금지한다. 업로드/검증/확정 사이 파일 교체를 방지한다.
- 임시 파일은 본인만 읽는다. 타 멤버는 서버만 작성하는 `uploads/{uid}/items/{uploadId}` manifest가 published일 때만 읽는다. 비멤버는 읽을 수 없다. manifest와 완료·게시물의 직접 클라이언트 조작도 기존 Firestore Rules에서 거부한다.
- 앱은 인증된 `getBlob` 계열 읽기를 사용하며 `getDownloadURL` 또는 공개 다운로드 URL을 게시물/응답/GA에 저장하지 않는다. Firebase가 관리하는 다운로드 토큰 자체의 존재와 앱의 인증 읽기 검증을 구분한다.
- 여행 종료 뒤 새 업로드와 새 서버 확정을 거부한다. 이미 저장된 결과의 동일 재시도는 추가 쓰기 없이 반환할 수 있다. 저장 완료 사진은 그룹 멤버가 계속 읽는다.

## 분석 이벤트

PM `docs/ANALYTICS_SPEC.md`(PR #10)에 맞춰 PR #11의 공통 Analytics 모듈을 재사용하고 현재 앱에 연결했다. 이번 브랜치 안에서 photo_select, stamp_complete, stamp_complete_fail 및 추가 사진의 photo_add를 호출한다. 스탬프 완료는 서버 응답 이후 요청당 한 번만 기록한다.

| 이벤트 | 파라미터 |
|---|---|
| photo_select | source=camera/gallery |
| stamp_complete | place_index, has_line, line_length_bucket=0/1-20/21-40/41-60, upload_bucket=under_2s/2-5s/5-15s/15s+, stamps_done/stamps_total 구간 |
| stamp_complete_fail | reason=upload/save/offline/ended, retry boolean |

공통은 무작위 그룹/여행 ID, 역할, 상태, 버전이다. 파일명·사진/경로·UID·별칭·느낌 본문은 허용 목록에서 제외한다. 에뮬레이터는 실제 GA에 보내지 않는다. 브라우저 검증은 이벤트 수집 대역으로 순서/시점을 확인했고 단위 테스트는 실제 필터를 검사한다. 운영 GA 실수신 검증과 구분한다.

## 실행과 검증

Java 21, Node 22 이상, `npm ci --ignore-scripts`, `npm ci --ignore-scripts --prefix functions`, Playwright Chromium 설치 후 `npm test`, `npm run test:photos`를 실행한다. photo runner는 demo 프로젝트와 auth/firestore/storage만 사용한다. 운영 자격증명 환경 변수는 전달하지 않는다.

단위·계약·패키징 27개, 기존 Firestore/Room 통합 33개, 실제 Storage/Rules 통합 4개, 실제 SDK와 Chromium 시나리오를 수행했다. 최종 결과와 원격 CI는 PR에 기록한다.

- AC-4a: 업로드 후 확정 요청을 보류한 동안 완료/게시물 없음. 업로드 실패·확정 실패의 파일/느낌 보존, 새로고침 후 동일 요청 복구.
- AC-4b: A 완료 후 B의 같은 장소는 미완료, 인증 UID가 저장 주체.
- AC-4c: 연타·동시 확정·서버 응답만 유실한 재시도에서 게시물/완료 1개. 새 사진 추가 시 같은 스탬프의 photoCount만 증가.
- AC-4f: 느낌 없이 저장 성공, 61자와 파일 형식/용량 위반 거부.
- AC-5b: 실제 업로드된 파일도 manifest 확정 전 다른 멤버의 getBlob/metadata 읽기 거부. 확정 후 멤버 읽기 성공, 비멤버/위조 manifest/타인 쓰기 거부.
- 종료 회귀: 종료 여행 다음 탐험 없음, 4탭 읽기 전용, 새 Storage 업로드·확정 거부.

로컬 JVM native 메모리 문제로 일부 재실행이 중단됐다. 테스트 프로세스에만 힙 주소/메모리·CPU 수를 지정하고 테스트 파일 격리 프로세스를 줄였다. 최종 Chromium 전체 회귀는 JIT를 끈 `-Xint -Xms32m -Xmx192m -XX:HeapBaseMinAddress=8g -XX:ActiveProcessorCount=2 -XX:ReservedCodeCacheSize=32m -Xss512k`로 끝까지 통과했다. 동시 요청 테스트 자체는 유지했다. Java 오류 덤프는 커밋하지 않는다.

스크린샷: [선택](screenshots/t8-photo-selected-mobile.png), [확정 대기](screenshots/t8-photo-awaiting-confirmation-mobile.png), [저장 완료](screenshots/t8-photo-complete-mobile.png), [종료 후 읽기 전용](screenshots/t8-ended-readonly-mobile.png). 테스트용 생성 사진만 사용했다.

## 운영 전 남은 범위

Blaze·버킷 생성·Storage Rules/Functions 배포·교차 서비스 Firestore 접근·웹/서버 버킷 이름 일치는 운영 전 확인해야 한다. bucket은 공개 Firebase storageBucket과 서버 PHOTO_STORAGE_BUCKET/기본 Firebase 설정을 맞춘다. 물리 iOS/Android 촬영·HEIC 변환은 미검증이며 HEIC은 현재 지원하지 않는다. 실제 사진 피드 썸네일·편집/삭제·미확정 객체의 자동 정리는 T9/보관 정책 범위다. 리포트·PNG는 포함하지 않는다. main 머지·공개 배포·과금·운영 설정 변경은 하지 않았다.
