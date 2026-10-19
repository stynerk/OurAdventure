# OurAdventure 개발 프로젝트 핸드오프 — Phase 1 / Firebase + Google 로그인

작성일: 2026-10-19
이 문서는 **기획 프로젝트에서 합의한 개발 인계 자료**이며, 구현 완료 보고서가 아니다.

## 프로젝트 역할 분리 (명시적 합의)

- **현재 '가족여행-경주' 대화/프로젝트:** 제품 전략, 기획, 요구사항, UX, 우선순위, 검증 기준 결정. 직접 구현·배포하지 않는다.
- **별도 'Our Adventure' 개발 프로젝트:** GitHub 코드 수정, Firebase 구성, 구현, 테스트, PR, 배포를 맡는다.
- ChatGPT 프로젝트 간 작업이나 대화는 자동 이동하지 않는다. 개발 프로젝트에서는 이 문서와 링크된 설계서를 직접 읽고 작업을 시작한다.
- 기존 경주 서비스 URL과 저장된 사용자 기록을 훼손하지 않는다.

## 확정된 기획 의사결정

1. 제품: 가족·친구·학교를 한 모델로 지원하는 **Shared Adventure**.
2. **Phase 1**: 기존 경주 9개 Quest를 사용한 탐험방 생성, 초대, 참여, 완료 동기화, 방장 관리 및 (individual 모드) 최종 제출.
3. **Phase 2**: 코스 생성/편집. Phase 1에 미리 포함하지 않는다.
4. 인증/회원 인프라: **Firebase Authentication**, 초기 로그인 제공자는 **Google 로그인 단 한 개**. 이메일·비밀번호, 카카오, 네이버 등을 초기 범위에 추가하지 않는다.
5. 초기 MVP 인증 UX: **리더와 참여자 모두 Google 로그인**으로 실사용 계정을 구분한다. 로그인하지 않은 사용자는 방 관리, 완료 저장·제출을 수행할 수 없다.
6. 링크는 '어느 방에 참여할지'를 나타내고, Google Auth의 `uid`는 '누구인지'를 나타낸다. `owner/member` 권한은 방별 멤버십으로 구분한다. 한 사용자가 방 A 리더이면서 방 B 멤버일 수 있다.
7. 진행 방식: `shared` (하나의 공동 스탬프북) / `individual` (참여자별 스탬프·제출). 방 생성 시 선택, 진행 중 변경 불가.
8. 사진은 초기 서버 업로드하지 않고 기존 기기 로컬에 둔다. **사진 업로드·검토는 Phase 1 P0에서 제외.**
9. 배포: 기존 `index.html`/GitHub Pages 루트는 보존. 신규 개발은 독립 경로/앱에서. Firebase Hosting으로 전환하는 결정은 후속 협의; GitHub Pages만으로도 정적 클라이언트는 제공 가능하나 Firestore와 규칙이 필요.

## Firebase 인프라 요구사항

- 프로젝트/웹 앱은 **Our Adventure 개발 프로젝트에서** 준비 및 설정. Firebase 프로젝트 ID는 아직 지정되지 않았음(Unknown).
- Firebase Auth: Google provider 활성화. 허가된 OAuth 도메인에 테스트·배포 호스트 등록. 인증 상태 변화, 로그인 실패/취소, 로그아웃, 재접속 복구 UX.
- Firestore: `users/{uid}`, `rooms/{roomId}`, `rooms/{roomId}/members/{uid}`, `.../progress`, `.../submissions` 등 개념적 구조를 상세 스펙과 대조하여 확정.
- 접근 규칙: 관리자 작업은 반드시 해당 방의 `owner`로 판정. 참여자의 개인 진행 및 제출은 소유자 본인만 수정. 관리 현황 읽기는 `owner`로 제한.
- **초대 URL이나 클라이언트에서 보낸 role만으로 owner를 만들면 안 된다.** 방 생성/가입을 신뢰 가능한 서버 처리 또는 안전하게 검증된 Firestore Security Rules로 구현.
- 완료/제출: 중복 요청 멱등성, 서버 기록 시간, 방 종료 이후 쓰기 차단, 필수 Quest 검증 필요.
- 개인정보: 학생 실명/이메일을 다른 방 사용자에게 공개하지 않음. Google 프로필 displayName을 공개 별칭으로 자동 노출하지 말고 별칭을 별도로 선택하도록 설계. 실제 학생 계정 데이터로 파일럿 시작하지 않음.
- Google 계정이 없거나 계정 사용이 제한된 저연령 학생은 현재 정책에서 참가 불가할 수 있음. 이는 **명시적인 MVP 제약**이므로 교사 인터뷰로 검증, 후속 단계에서 게스트/학교 계정 대안 재평가.
- 웹 `apiKey` 같은 Firebase 공개 클라이언트 구성과 관리자 비밀 키·서비스 계정은 다르다. 관리자 비밀·서비스 계정 JSON을 GitHub에 절대 커밋하지 않음.
- GitHub Pages에서 로그인 화면이 작동하는지는 실제 배포 도메인 및 브라우저(iOS Safari/Android Chrome) 테스트 후 확인. 리디렉션/팝업 선택은 Firebase 공식 문서와 배포 도메인 제약에 따라 구현 단계에서 검증.

## UI/동작 범위

### 리더
1. Google 로그인 → '내 탐험방' 리스트
2. 경주 역사 탐험 코스 선택 → 방 제목 입력 → shared/individual 선택 → 만들기
3. 초대 링크 복사/공유
4. 참여자 수, 공동 진행도 혹은 개인별 진행/제출 상태 보기
5. 방 종료

### 참여자
1. 초대 링크 열기 → Google 로그인 → 방 소개 → 별칭 설정 → 참여
2. 기존 경주 Quest를 순서 제약 없이 진행 → 스탬프 획득 → 여러 기기에서 동기화
3. individual 모드: 요구된 Quest 완료 후 '제출하기' → 제출 시간/상태 방장에게 표시
4. 재접속 시 동일 Google 계정으로 이전 기록 복구

### 핵심 화면
- 로그인/진입
- 내가 만든/참여 중인 탐험방 목록
- 탐험방 생성
- 초대 링크/참여 온보딩
- Quest/스탬프 진행
- 방장 관리 대시보드

## 수용 기준

- 방장: Google 로그인만으로 방 생성/재접속, 같은 계정으로 방장 권한 복구
- 참여자: Google 로그인 + 초대 링크로 member 가입, 동일 계정으로 이어서 진행
- 권한 검증: 참여자에게 방 삭제/관리/다른 사람 기록 수정 권한 없음 (UI 숨김뿐 아니라 Firestore 규칙/API에서 차단)
- shared: A가 완료한 스탬프가 B에게 반영, 동시 중복 처리해도 1개만 기록
- individual: A/B 진행 데이터 독립. 각자 필수 미션 충족 후 제출만 허용
- 로그인 상태 회복/로그아웃/다른 계정 로그인 테스트
- Firebase 설정 전 상태는 '설정 필요' 화면으로 정확히 표시; 실제 연결 전 가짜 완료 상태를 보여주지 않음
- 실제 교사/학생 개인정보·얼굴 사진을 수집하지 않고 가명 테스트
- 기존 루트 `index.html` 미변경, 기존 GitHub Pages 동작 유지
- 진행 완료/PR/배포 결과와 실제 테스트 URL 및 한계를 개발 프로젝트에서 별도 보고

## 관련 자료

- 기획 상세: [Phase 1 Shared Adventure 설계](./PHASE1_SHARED_ADVENTURE_SPEC.md)
- 기존 소스: [root index.html](../index.html)
- 이전 맥락: [Project Handoff](../PROJECT_HANDOFF.md)
- 기획 PR: https://github.com/stynerk/OurAdventure/pull/2

## 개발 프로젝트에 전달할 시작 요청 (복사 가능)

> OurAdventure 저장소를 기반으로 Shared Adventure Phase 1 MVP 구현을 시작해줘.
> 우선 `docs/OUR_ADVENTURE_IMPLEMENTATION_HANDOFF.md`와 `docs/PHASE1_SHARED_ADVENTURE_SPEC.md`, 기존 루트 `index.html`을 읽고 실제 코드 구조를 확인해.
> 기존 경주 공개 사이트는 변경하지 말고, 별도 앱 경로에서 Firebase Authentication Google 로그인 **한 가지**와 Firestore를 활용해 탐험방 생성/초대/참여/진행 동기화/방장 관리/개인별 제출을 구현해.
> 리더와 참여자 모두 Google 로그인 후 방별 owner/member 권한을 갖도록 해. 중요한 권한 판단은 Firestore Rules/서버에서 검증하고, 닉네임이나 초대 링크만으로 관리 권한을 주면 안 돼.
> 코스 생성 기능, 사진 서버 업로드, 다른 로그인 제공자는 Phase 1에 넣지 마.
> Firebase 프로젝트 설정 정보가 필요한 부분은 명확히 구분하고, 우선순위에 따라 단계별로 PR로 진행한 다음 실기기 테스트 및 배포 상태를 보고해.
