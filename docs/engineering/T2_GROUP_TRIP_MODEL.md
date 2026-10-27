# T2 그룹·여행·개인 완료 구조

기준: PRD v2, MVP 작업 목록 T2. 이번 변경은 서버 데이터·권한 구조다. 사용자 화면·운영 Firebase 설정·실제 사진 업로드를 연결한 상태가 아니다.

## 데이터

```text
groups/{groupId}                         ownerId, memberIds, memberCount, capacity=10
  members/{uid}                         role, displayName, joinedAt
  trips/{tripId}                        title, destination, startDate, endDate, status
    places/{placeId}                    name, icon, postCount
    posts/{postId}                      uid, placeId|null, photo, feeling, status
    completions/{completionId}          uid, placeId, photoCount, completedAt
v2Requests/{requestHash}                 private: creation request/fingerprint
v2MediaClaims/{mediaHash}                private: published photo claim
```

그룹 멤버십은 모든 하위 여행의 접근 기준이다. 초대 구현(T6)은 구성원 문서·memberIds·memberCount를 같은 서버 트랜잭션에서 갱신해야 한다. 멤버십 제거를 추가할 때도 문서·목록·정원 수를 같은 트랜잭션으로 처리한다.

기존 rooms 및 경주 루트 앱은 유지한다. 기존 브라우저 기록을 읽거나 새 모델로 자동 이전하지 않는다.

## 서버 진입점

- createGroup: Google 인증 필수, 리더 본인을 정원에 포함. 같은 요청 ID 재시도는 같은 그룹 반환.
- createTrip: Google 인증 + 그룹 리더 필수. 새 여행·새 장소 ID를 생성하고 사진/완료 컬렉션을 복사하지 않는다. 장소 0개 허용. 같은 요청 재시도는 같은 여행 반환.
- addTripPlace: 그룹 리더 + 진행 중 여행. 기존 완료를 건드리지 않고 장소를 추가한다. 동일 요청 재시도와 전체 10개 한도를 검증한다.

uid·ownerId·memberIds·완료 상태는 클라이언트 입력으로 결정하지 않는다. 날짜·문자 길이·경로 ID·요청 내용 변경을 검사한다. 기획의 일차 배치·Google Places metadata·AI 문구는 T4/T5의 후속 구현이다.

## 사진과 완료의 경계

finalizeVerifiedPost는 서버 내부 함수로만 제공하며 callable 목록에는 넣지 않았다. T8에서 실제 Storage 사진을 확인하는 verifyPhoto를 연결해야 한다. 기본 verifier는 항상 거부하므로 클라이언트가 verified=true 또는 사진 URL을 보내도 새 모델의 완료를 만들 수 없다.

사진 검증을 통과한 뒤 게시글·사진 사용 claim·본인 completion·카운트를 한 Firestore 트랜잭션으로 반영한다. 완료 ID는 uid+placeId로 구분하고 group/trip 경로 아래에 둔다. 같은 장소의 새 사진은 photoCount를 늘리고 스탬프는 하나만 유지한다. 같은 요청의 재시도와 이미 게시한 사진의 재사용은 중복 집계하지 않는다. 자유 기록(placeId=null)은 스탬프를 만들지 않는다. 한 줄은 선택이며 최대 60자다.

T8 verifier는 저장소의 실제 객체·소유자·경로·형식·크기·변경 불가능한 이미지 식별을 확인해야 한다. 이번의 fixture verifier는 테스트 전용이다. 실제 Storage 기능이 완료됐다고 해석하지 않는다.

## 권한

Firestore에서 직접 쓰기는 리더 포함 모두 거부한다. 그룹·여행·장소·완료는 그룹 멤버만 읽는다. 게시글은 published 상태만 읽을 수 있다. 타인 원본 수정·삭제 및 역할 상승은 직접 요청으로 수행할 수 없다. 수정·삭제 서버 작업은 T9에서 별도 구현한다.

Firestore Rules는 사진 바이트 접근을 보호하지 않는다. 실제 이미지의 Storage Rules·제공 URL·접근 권한은 T8에서 함께 연결해야 한다. 종료 후 신규 사진·장소 쓰기는 서버에서 거부하고 기존 멤버의 읽기는 유지한다. 여행 종료 API/화면은 T10이며 이번 테스트는 서버 fixture로 종료 상태를 만든다.

## 검증 기록

- 로컬 npm test: 11/11 통과. 기존 앱 보존·패키징·생성 재시도·입력·모델 기본 권한·사진 내부 진입점 경계를 확인했다.
- 실제 Firestore emulator 검사는 tests/group-model.integration.test.mjs에 작성했다. 로컬 Java 미설치로 원격 CI에서 실행한다. CI의 실제 결과는 PR 설명과 실행 링크로 보고한다.
- 검사 범위: 그룹 재사용·빈 새 여행·생성 중복·같은 별칭 분리·그룹/여행 간 격리·사진 검증 실패·사진/요청 중복·자유 기록·장소 추가·종료 차단·비구성원/타인 원본/역할 위조 차단.
- 테스트용 demo 프로젝트만 사용한다. 운영 프로젝트·실사용 사진·실제 계정·유료 API는 사용하지 않는다.

이번 PR은 PR #3 위에 쌓는다. 사용자 승인 없이 main 병합·배포·데이터 마이그레이션·결제 전환을 수행하지 않는다.
