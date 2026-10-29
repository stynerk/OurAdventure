# T9 추억 피드 — 2026-10-28

PR #16의 `0cb35e5` 위 `engineering/memory-feed`. 기존 루트 앱과 로컬 가족 여행 자료는 변경하지 않는다. 운영 배포는 하지 않는다.

## 동작

- 추억 탭에서 published Post만 서버 최신순(`createdAt desc`, 문서 ID desc)으로 12개씩 조회한다. 장소·자유 기록·사람 필터를 서버 쿼리에 함께 적용하고 동일 조건의 문서 커서로 다음 페이지를 읽는다. 일부 기록을 먼저 제한한 뒤 클라이언트 필터로 누락시키지 않는다. 필터용 인덱스 4종을 `firestore.indexes.json`에 포함했다.
- 사진은 인증된 Storage `getBlob`으로 읽어 메모리 Blob URL로 표시한다. 공개 다운로드 URL·토큰을 피드나 GA에 저장하지 않는다. 다른 여행/계정 전환과 로그아웃 때 Blob URL을 폐기한다. 읽기 실패 사진에는 안내를 표시한다.
- 자유 기록은 장소 없이 사진과 선택 한 줄 느낌(최대 60자)을 남긴다. T8의 업로드·IndexedDB 보존·동일 요청 재시도·서버 확정을 재사용하며 스탬프는 만들지 않는다.
- 본인 기록의 한 줄 느낌을 수정한다. 사진 교체나 장소 이동은 하지 않으며 삭제 후 새 기록을 남기는 흐름이다. 서버 revision 검사로 오래된 화면의 덮어쓰기를 막고 requestId로 수정 응답 유실 재시도를 처리한다. 빈 느낌도 허용한다.
- 본인 기록 삭제 전 확인을 받는다. 게시물 삭제 상태·공개 manifest 회수·여행/장소 사진 수·본인 completion 감소/제거를 하나의 Firestore 트랜잭션으로 확정한다. 같은 삭제를 재시도해도 개수를 다시 빼지 않는다. 다른 사람의 completion은 건드리지 않는다.
- 삭제 후 서버가 해당 Storage 세대의 실제 파일을 정리한다. 파일 정리에 실패해도 읽기 권한은 먼저 회수되며 cleanupPending을 반환한다. 현재 화면에서 정리 재시도가 가능하다. 서버 tombstone과 중복 방지 claim은 유지해 삭제한 요청/사진의 재게시를 막는다.
- 종료 여행은 필터·페이지 열람만 가능하고 자유 작성·수정·삭제 UI는 없다. 서버도 종료 상태를 트랜잭션에서 확인한다. 리더에게 타인 기록 편집 권한은 없다.

## 권한과 분석

Firestore는 기존처럼 그룹 멤버에게 published 기록만 허용하고 직접 쓰기는 전부 거부한다. Storage의 본인 임시 파일 읽기는 공개 manifest가 아직 없을 때만 허용한다. deleted manifest가 생기면 파일 작성자도 더는 읽을 수 없다. 비멤버와 타인/리더의 수정·삭제 요청은 서버에서 거부한다.

PM `docs/ANALYTICS_SPEC.md`(docs/analytics-spec 브랜치)를 확인했다. `free_post_create(has_line)`, `post_delete(was_stamp)`, `feed_view(post_count_bucket)`를 허용 목록으로 추가했다. 작성/삭제 성공 이벤트는 서버 응답 뒤에만 보낸다. 느낌·사진·파일명·UID·필터의 사람/장소 ID는 전송하지 않는다. 로컬 에뮬레이터는 실제 GA 전송을 하지 않는다.

## 검증 방법

`npm test`: 단위·계약·패키징 29개. `npm run test:memories`: Auth/Firestore/Storage demo 에뮬레이터에서 실제 Storage/권한 통합 10개, 기존 그룹/Room 통합 33개, 실제 SDK와 Chromium 시나리오. 공용 photo 검증 runner를 확장해 T8 회귀도 포함한다. Java 21과 Playwright Chromium이 필요하다.

통합 검증은 비멤버/미인증 열람, 미확정 공개 차단, 리더 포함 타인 수정·삭제 거부, 직접 Firestore 쓰기 거부, 수정 중복/충돌, 동시 삭제와 마지막 사진 취소, 타인의 완료 보존, 실제 파일 삭제, 물리 삭제 실패 시 본인 포함 읽기 회수와 재시도, 종료 후 서버 쓰기 거부를 확인한다. 최종 브라우저 실행 결과와 원격 CI는 PR에 별도 기록한다.

브라우저는 실제 SDK/callable HTTP handler와 demo Auth/Firestore/Storage를 사용했다. 외부 CDN 지연이 반복돼 최종 실행에서는 공식 gstatic의 동일 Firebase 13.0.0 JS 파일을 작업공간에 캐시해 전달했다. Storage/API 권한 응답은 대체하지 않았다. 로컬 JVM은 T8과 같은 제한 메모리·`-Xint` 설정으로 실행했다. 실제 배포 런타임·물리 카메라·운영 GA 수신 검증과 구분한다.

최종 Chromium 전체 실행은 종료 코드 0으로 통과했다. 실제 인증 사진 3개 렌더, 수정 응답 유실 재시도, 느낌 없는 자유 기록과 스탬프 비생성, 타인 작성 화면의 편집 버튼 비노출, 리더 서버 변경 거부, 필터 조합, 같은 생성 시각의 16개 기록 페이지 조회/중복 없음, 마지막 사진 삭제 후 본인 0/1, 종료 4탭과 기존 초대 회귀, GA 순서를 확인했다. 피드 새로고침은 상단 기록 수도 동기화하고 종료 상태가 확인되면 읽기 전용 화면을 다시 연다.

스크린샷: [최신순 피드](screenshots/t9-memory-feed-mobile.png), [필터·자유 기록](screenshots/t9-filtered-memory-mobile.png), [마지막 사진 삭제](screenshots/t9-last-stamp-deleted-mobile.png), [종료 후 열람](screenshots/t9-ended-readonly-mobile.png). 사진은 테스트용 생성 이미지다.

## 남은 범위

Blaze 이후 운영 Storage·Functions·Rules·쿼리 인덱스와 CORS 배포/검증, 물리 iOS/Android 촬영, 운영 GA 실수신은 미실행이다. 사진 교체·HEIC 변환·리포트/결과 이미지는 이 변경에 포함하지 않는다. 사진 파일 정리 실패 뒤 화면을 닫은 경우나 업로드 후 확정하지 않은 파일의 주기적 정리 작업은 아직 없으며 비공개 파일이 남을 수 있다. 서버 tombstone/중복 claim의 보관 정책은 후속으로 정해야 한다. 자동 정리가 구축됐다고 보고하지 않는다.
