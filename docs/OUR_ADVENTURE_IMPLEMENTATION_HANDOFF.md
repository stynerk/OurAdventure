# OurAdventure 개발 프로젝트 핸드오프 — Phase 1 / Firebase 인증 정책

작성일: 2026-10-19 · 갱신: PRD v1.1 승인 범위 · 상태: 미구현

> **최신 계약:** [PRD 0절](PHASE1_SHARED_ADVENTURE_SPEC.md#0-최신-승인-범위--2026-10-19)이 초기 기획보다 우선한다. 1A=가족·지인 리더포함10명/리더1명/활동공간당 여행1건, 1B=리더포함30명 확장 테스트, 1C=학교 개인제출·보고서 파일럿. 신규 그룹은 글·사진 공유 기록과 리더 일기/앨범 출력을 지원한다. 기존 로컬 사진은 자동 이전하지 않는다. 공유 저장 설계·비용·보관삭제는 미결정이며 목업을 구현 완료로 표시하지 않는다.

> **프로젝트 분리:** 현재 '가족여행-경주'에서는 기획/의사결정만 한다. 실제 코드, Firebase 프로젝트 설정, 테스트, PR 병합 및 배포는 별도 **Our Adventure** 개발 프로젝트에서 진행한다. ChatGPT 프로젝트 간 작업은 자동으로 이관되지 않으므로 이 문서를 직접 참조한다.

## 1. 확정된 MVP 방향

- 제품: 가족·친구·학교 모두 사용할 수 있는 Shared Adventure.
- **Phase 1:** 기존 경주 9개 Quest 재사용, 탐험방 생성, 초대 링크, 공동(shared)/개인별(individual) 완료, 진행 현황, individual 최종 제출.
- **Phase 2:** 코스/미션 신규 생성·수정. Phase 1 개발 범위에서 제외.
- 배포/구현: 기존 GitHub Pages 루트 `index.html` 및 기존 `gj-family-quest` 기록 보존. 신규 앱은 별도 경로/구성.
- 사진: 기존 로컬 사진 보존, 신규 그룹 공유 기록에 사진 포함. 저장소·용량·권한·보관삭제는 구현 전 설계한다. 학교 사진 평가/검수 기능은 약속하지 않는다.

### 2026-10-19 인증 정책 최종 수정 (중요)

| 구분 | 탐험방 리더(owner) | 일반 참여자(member) |
|---|---|---|
| 사용자에게 보이는 로그인 | **Google 로그인 필수** | **로그인/회원가입 화면 없음** |
| Firebase Auth | Google provider | **Anonymous Authentication(내부 익명 인증)** |
| 진입 흐름 | Google 로그인 → 방 생성/관리 | 초대 링크 → 별칭 → 익명 세션 → 참여 |
| ID | Firebase Auth `uid` | Firebase Anonymous Auth `uid` |
| 기록 복구 | 동일 Google 계정, 여러 기기 | 동일 브라우저의 보존된 세션에서만 기본 복구 |
| 권한 | 방별 owner + 필요한 경우 Quest 참여 | 방별 member, 자신/공동 기록만 수정 |

- **리더에게만 Google 로그인 UI를 제공한다.** 참여자에게 Google 로그인 팝업/버튼/가입 폼을 강제하지 않는다.
- Firebase Console에서는 로그인 제공자 **Google + Anonymous 두 종류**를 활성화한다. Anonymous는 사용자에게 보이는 '추가 로그인 수단'이 아니라 서버 권한 판정을 위한 내부 인증이다.
- 익명 참여의 `uid`는 별칭/출석번호가 아니다. 방별 멤버십은 Auth `uid`와 `roomId`로 판정한다.
- 이미 Google로 로그인한 리더가 다른 방에 참여하는 경우, 기존 Auth 세션을 유지하면서 **그 방에서는 member** 역할을 가질 수 있다. 멤버 참여를 위해 기존 Google 세션을 익명 세션으로 교체하지 않는다.
- **Google이 아닌 익명 계정으로는 방을 생성하거나 owner가 될 수 없다.** Firebase Security Rules/신뢰된 서버 로직에서 강제한다.
- 익명 세션은 기기/브라우저를 바꾸거나 저장 데이터를 삭제하면 복구가 보장되지 않는다. Phase 1에서는 교차기기 참여 기록 이전을 약속하지 않는다. 필요 시 Phase 2 이후 복구 코드/계정 연결을 별도 설계한다.
- 한 브라우저의 한 Auth 세션이 기본적으로 한 참여자다. 한 기기를 여러 학생이 번갈아 이용하는 운영은 **미지원/미검증**; 조별 참여 등 운영 방식 검증 필요.

## 2. Firebase 인프라 요구사항

- Firebase Authentication: Google(리더) + Anonymous(참여자) provider 활성화. 리더 Google OAuth 인증 도메인 구성.
- 익명 인증은 `signInAnonymously`로 내부 수행한다. 클라이언트는 인증 상태가 준비된 후 멤버 가입/Quest 쓰기를 수행하며, 인증 초기화 동안 중복 익명 계정을 생성하지 않는다.
- Firebase Auth 세션의 기본 브라우저 지속성(동일 출처) 테스트. Safari 개인정보 보호/시크릿 모드·스토리지 삭제에 대한 실패 상태 표시. Firebase 공식 문서: https://firebase.google.com/docs/auth/web/anonymous-auth
- Cloud Firestore 권한: 사용자가 로그인했다는 사실만으로 owner가 아니다. `rooms/{roomId}/members/{uid}` 등 방별 멤버십과 owner를 신뢰 가능한 처리/Firestore Security Rules로 검증.
- 방 생성: 인증된 Google uid만 owner로 지정 가능. 익명 uid 및 클라이언트가 임의로 지정한 role/ownerId로 방장 권한 획득 금지.
- 초대 링크: room join capability일 뿐 owner 권한이 아님. 무작위 높은 엔트로피 토큰, 링크 재발급/종료 정책, 등록 남용 방지 방안 검토.
- 가입: 인증된 익명 uid를 member에 바인딩하고 별칭은 표시 용도로만 저장. 일반 참여자에게 타인의 제출 내역/학교 명단/Google 이메일을 공개하지 않음.
- 스탬프: shared이면 room 스코프, individual이면 member uid 스코프. 중복 기록 방지, 제출 전 필수 Quest 검증, 방 종료 후 쓰기 차단.
- 데이터 모델(예시): `users/{uid}`(리더 프로필), `rooms/{roomId}`, `rooms/{roomId}/members/{uid}`, `.../progress`, `.../submissions`. 정확한 문서 경로/트랜잭션 설계는 개발 프로젝트에서 확정.
- 학생 개인정보: 익명 별칭 기본, 실명/이메일/얼굴 사진 불필요. 학교에서 실제 학생 식별/미참여자를 확인하려면 사전 지정 코드/명단 매핑이 별도 필요. 테스트에는 가상 번호만 사용.
- 공개 Firebase 웹 설정 키는 비밀 관리자 키와 다르다. 서비스 계정 JSON/API 관리자 비밀키를 저장소에 커밋하지 않는다.
- GitHub Pages는 정적 호스팅만 제공. 공유 데이터는 Firebase/Firestore가 필요. 리더 Google 로그인은 실제 배포 도메인과 iOS Safari/Android Chrome에서 검증한다.

## 3. 사용자 여정 및 화면

### 리더
1. Google 로그인 → '내 탐험방' 목록
2. 기존 경주 코스 선택 → 방 이름 → shared/individual 선택 → 방 생성
3. 초대 링크 복사/공유
4. 공동 스탬프 진행 또는 개인별 진행·제출 현황 보기
5. 방 종료 / 계정 재로그인 후 관리 복구

### 참여자
1. 초대 링크 열기 → 방 소개 → 별칭 입력 (**Google 로그인 요청 없음**)
2. 내부 익명 인증 → 방별 member 가입 → Quest 시작
3. Quest 수행 및 스탬프 기록. individual 완료 시 별도 제출
4. 같은 브라우저의 동일 익명 세션에서 새로고침/재접속 시 계속 진행
5. 새 브라우저·기기·저장소 삭제 시 기존 기록 복구는 초기 MVP에서 보장하지 않음

### 필수 화면
- 로그인 진입(방장 전용 Google)
- '내가 만든 탐험방' 목록(리더)
- 탐험방 생성
- 초대 링크 입장(별칭 중심)
- 구성원 게시판형 기록 작성·조회
- 리더 기록 선택·정렬·일기/앨범 출력(학교 보고서1C)
- Quest/스탬프 화면
- 방장 관리(공동 진행 또는 개인별 제출)
- 복구 불가/인증 실패/초대 만료/방 종료 오류 상태

## 4. 수용 기준 (Acceptance Criteria)

- [ ] 방 생성 시 Google 로그인이 필수이며 Google 세션에서만 owner 역할 획득 가능
- [ ] 비로그인 참여자는 초대 링크 → 별칭 입력만으로 입장(내부 Firebase 익명 계정 생성)
- [ ] 참여 과정 어디에도 Google 로그인 버튼/팝업이 나타나지 않음
- [ ] 같은 브라우저의 재접속에서 익명 uid/진행 상태 유지(스토리지 삭제 예외)
- [ ] 다른 브라우저의 익명 참가자에게 기존 기록이 자동 이관되지 않음을 명확히 안내
- [ ] 동일 닉네임 참가자라도 각기 고유 uid로 진행 상태가 분리됨
- [ ] 익명 계정에서 방장 만들기/role 변경/관리 API 접근 차단
- [ ] shared: 참가자 A가 획득한 Quest 스탬프가 B에게 반영되고 중복 완료는 1개만 기록
- [ ] individual: 개인별 완료/제출 분리, 필수 미션 완료 전에 제출 불가
- [ ] 계정 보안: invitation URL만으로 타인/owner 권한 획득 불가
- [ ] 기존 경주 루트 앱, 사용자 로컬 기록 및 공개 배포 유지
- [ ] 실제 학생 실명·사진 없이 가족 3명/테스트 참가자 5명으로 파일럿
- [ ] 구현 및 배포 결과/문제점은 Our Adventure 개발 프로젝트에서 보고

## 5. 제외 / 미결정

- Phase 1 제외: 코스 빌더, 동영상/원본 장기보관, 다른 소셜 로그인, 참가자 Google 강제 로그인, 익명 계정 기기 간 복구 기능.
- Unknown: Firebase 프로젝트 ID/보안 규칙 상세안/데이터 삭제 보관 정책/학교 학급 운영 방식.
- 중요한 제약: '로그인 없는 참여'는 **익명 Auth를 이용한 무마찰 입장**을 뜻하며, 신원 확인/학생 실명 증명은 제공하지 않는다.

## 6. 참고 및 개발 요청

- 상세 PRD: [Phase 1 Shared Adventure](./PHASE1_SHARED_ADVENTURE_SPEC.md)
- 기존 앱: [root index.html](../index.html)
- 기획 Draft PR: https://github.com/stynerk/OurAdventure/pull/2

### Our Adventure 개발 프로젝트에 보낼 시작 요청

> OurAdventure GitHub 저장소에서 `docs/OUR_ADVENTURE_IMPLEMENTATION_HANDOFF.md`와 `docs/PHASE1_SHARED_ADVENTURE_SPEC.md`, 기존 `index.html`을 읽고 Shared Adventure Phase 1 MVP를 구현해줘.
> **리더만 Firebase Google 로그인 필수**, **참여자는 로그인 UI 없이 초대 링크 + 별칭으로 참여**하고 내부적으로 Firebase Anonymous Authentication을 사용하도록 해.
> Firestore에는 방별 owner/member 권한, shared/individual 진행 상태, 완료·제출을 저장해. 익명 참가자는 방을 생성/관리할 수 없고 초대 링크나 닉네임만으로 권한 상승할 수 없도록 실제 보안 규칙/서버 로직으로 강제해.
> 기존 공개 경주 사이트는 보존하고 별도 경로에 구축해. 코스 생성/미션 편집은 Phase 2, 익명 참가자 교차기기 복구는 이번 범위 밖이야. 신규 그룹은 사진·글 공유 기록과 리더 출력까지 필요하며 PRD v1.1 0절의 단계/인원/미결정 정책을 먼저 읽어줘.
> Firebase 프로젝트 설정이 필요한 부분은 표시하고 PR, 테스트 및 배포 결과를 Our Adventure 개발 프로젝트에서 보고해.
