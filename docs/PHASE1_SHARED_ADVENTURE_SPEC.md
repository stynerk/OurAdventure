# OurAdventure Phase 1 — Shared Adventure (탐험방 / 공동 참여)

> 작성: 2026-10-18 · 상태: 제품·UX·데이터 설계안 (구현 및 배포 전)
> 기준: stynerk/OurAdventure main, 기존 index.html과 PROJECT_HANDOFF.md
> 제품 결정: **코스 생성은 Phase 2**. Phase 1은 기존 경주 Quest의 다인 사용 / 관리 기능을 검증한다.

## 1. 제품 정의

**누구나 기존 코스로 탐험방을 만들고, 링크로 함께 참여하고, 진행 및 완료 상태를 확인한다.**

특정 사용자(교사) 전용 제품이 아니다. 가족/친구/학급을 동일한 기본 단위(Room)로 지원하되, **완료 상태의 소유자**를 모드로 분리한다.

### 검증할 가설
- H1: 방장은 90초 이내에 경주 코스로 탐험방을 만들고 링크를 공유할 수 있다.
- H2: 초대받은 사람은 계정 가입 없이 45초 이내에 참여할 수 있다.
- H3: 서로 다른 기기에서 퀘스트 완료 및 참여 현황이 올바르게 동기화된다.
- H4: 방장은 10초 이내에 완료자와 미완료자를 구분할 수 있다.

위 숫자는 목표치이지 검증된 사용성 지표가 아니다.

### 초기 고객 시나리오
| 시나리오 | 방장 | 참여자 | 진행 모드 | 완료 의미 |
|---|---|---|---|---|
| 경주 가족여행 | 부모 | 가족 2~4명 | shared | 가족의 공동 스탬프북 |
| 친구끼리 탐험 | 친구 1명 | 친구들 | shared 또는 individual | 함께 진행 또는 개인 기록 |
| 학교 현장학습 | 교사 | 학생/조 | individual | 참여자별 제출 여부 |

중요: '학교 사용'은 신분 인증 없는 별칭만으로 학생을 정확히 식별할 수 없다. 학교 테스트에는 출석번호/사전 부여 코드/조 번호 중 하나를 함께 사용한다.

## 2. 우선순위

### Phase 1 P0 (반드시)
1. 기존 경주 코스 선택 후 방 생성
2. 진행 모드 설정: shared(공동 스탬프) 또는 individual(참여자별 스탬프)
3. 읽기 가능한 참여 링크 및 QR 공유(최소 초기 버전은 링크 복사부터)
4. 참가자 닉네임 입력 / 게스트 참여 / 참여 세션 복구
5. Quest 완료 → 스탬프 기록 → 서버 동기화 → 다른 기기에 반영
6. 방장 전용 참여자 목록, 완료율, 최종 완료/제출 현황
7. 방장만 방 종료 가능; 종료 후 진행상태 읽기 전용
8. 별도 복구 수단을 가진 방장 인증과 참가자 권한 분리

### Phase 1 P1 (검증 후)
- QR 이미지 제공(링크 복사로 먼저 검증), 알림/미제출자 독촉, 개인 사진 공유, 오프라인 작업 큐, 조별 멤버십, 닉네임 수정 승인, 완료 결과 CSV
- 반응형 디자인 확장/알림 자동화는 사용성 근거가 생긴 후

### Phase 2 (명시적 제외)
- 자유 코스 생성/수정/게시, 장소 검색·지도 핀, 미션 에디터, AI 코스 추천, 교육과정 매칭, 다도시 코스 빌더
- 결제/랭킹/외부 공개 갤러리

## 3. 핵심 개념과 상태 소유권

- **Course**: 재사용 가능한 불변 콘텐츠 묶음. 초기에는 경주 기존 9개 Quest를 버전 고정하여 사용. Course와 Room은 1:N.
- **AdventureRoom**: 하나의 코스를 함께 진행하는 세션. 코스·진행모드·방장·참가 링크·상태 보유.
- **Participant**: 방에 소속된 참여 세션. 가입 없는 별칭은 식별자가 아니라 표시 이름.
- **QuestProgress**: 완료 상태 기록. shared이면 room 스코프에 1개, individual이면 participant 스코프에 각자 1개.
- **Submission**: individual 모드에서 최종 완료 버튼을 눌러 제출한 사건. 완료한 Quest의 합과 구분.
- **ActivityLog**: 누가 어떤 액션을 언제 기록했는지 간단한 서버 기록(최소 감사 추적).

### 두 진행 모드 규칙
| 동작 | shared | individual |
|---|---|---|
| Quest 완료 | 방 전체 스탬프 1개 획득 | 해당 참가자만 1개 획득 |
| 다른 사람의 완료 표시 | 같은 상태가 보임 | 다른 사람 기록을 덮어쓰지 않음 |
| 사진 | 본인 기기에만 보관(MVP) | 본인 기기에만 보관(MVP) |
| 최종 상태 | 방 전체 완료 | 참가자별 제출 |
| 방장 화면 | 공동 완료율, 참여자 수 | 참가자별 진행률/제출 여부 |
| 모드 변경 | 진행 시작 후 금지 | 진행 시작 후 금지 |

### 상태 전이
- Room: draft → open → closed (되돌리기/재오픈은 MVP 제외)
- Participant: joined → active (마지막 활동 표시) → submitted (individual) / left(optional)
- QuestProgress: absent → completed (중복 완료 요청은 서버가 멱등 처리)
- Submission: absent → submitted (individual, 요구 완료 조건을 만족할 때만)

필수 Quest를 모두 완료하면 '제출하기'가 활성화된다. 모든 스탬프 완료와 최종 제출은 별개의 이벤트다.

## 4. 정보 구조(IA) 및 사용자 여정

### 시작 진입
- /next/ — '탐험방 만들기' 또는 '초대 링크로 참여하기'
- /next/create — 코스 확인 → 방 이름 → 진행 모드 → 생성
- /next/r/:joinToken — 방 소개 → 참여 별칭(학교 테스트에는 코드/출석번호 포함) → 참여
- /next/r/:roomId/play — 기존 경주 퀘스트를 Room 데이터에 바인딩하여 사용
- /next/r/:roomId/progress — 참여자 본인 진행 현황
- /next/r/:roomId/manage — 방장 전용 요약 / 참여자 및 제출 현황
- /next/r/:roomId/complete — 스탬프북 완료 및 제출 확인

(실제 URL은 구현 시 프레임워크/라우터 선택에 따라 달라질 수 있다.)

### UX: 방장 — 생성 화면
~~~
[뒤로] 새 탐험방
[경주 역사 탐험] 9개 Quest · 기존 코스 사용
탐험방 이름 [우리 가족 경주 원정]
함께하는 방식
(●) 함께 완료    ( ) 각자 완료
  함께: 누가 완료하든 하나의 공동 스탬프북
  각자: 각자 스탬프를 모으고 마지막에 제출
[탐험방 만들기]
~~~

생성 완료:
~~~
우리 가족 경주 원정     [방장 관리]
초대 링크   our.../join/xxxx  [복사]
[참여자 0명]   [퀘스트 시작]
방장 전용 관리 주소 / 복구 방식은 별도 안내
~~~

### UX: 참여자 — 링크 입장
~~~
[우리 가족 경주 원정]
경주 역사 탐험 · 9개 Quest
초대받았어요!
별칭 [씩씩한 탐험가]
(학교/개별 제출 선택 시) 번호/참여 코드 [__]
[탐험 시작]
~~~

### UX: 탐험 화면
- 기존 v0.5의 홈/코스/스탬프/기록 패턴을 가능한 한 유지
- 상단에는 방 이름, 모드, 현재 완료 수와 동기화 상태 표시
- shared: '우리 방의 스탬프 3/9', individual: '내 스탬프 3/9'
- 다른 사람이 shared 스탬프를 완료하면 화면 갱신. 중복 클릭은 무해
- individual: 필수 미션 모두 완료되면 별도의 '완료 결과 제출' CTA 표시

### UX: 방장 — 관리 화면
~~~
[경주 역사 탐험]  참여자 28명   [초대 링크]
완료 21  진행 4  미참여 3
제출률 75%
참여자             Quest        최종 제출
01 / 파란 탐험가     9/9         제출 완료
02 / 초록별          4/9         진행 중
03 / 노란 토끼       0/9         미시작
[종료하기]  (확인 모달)
~~~

shared 모드의 방장 화면에는 개인별 제출률을 표시하지 않는다. '미참여'는 사전 참여자 명단이 없는 경우 정의할 수 없으므로 **개별 코드/명단이 있는 학교 모드에서만** 제공하고, 일반 방은 '입장한 참여자 수'만 표시한다.

## 5. 제안 데이터 모델 (구현 독립 초안)

~~~typescript
type Mode = "shared" | "individual";
type RoomStatus = "draft" | "open" | "closed";
type ParticipantRole = "owner" | "member";

interface Course {
  id: string;
  version: number;
  title: string;
  questIds: string[];            // 기존 경주 ID 유지
  requiredQuestIds: string[];    // 선택 미션 구분
}

interface AdventureRoom {
  id: string;
  courseId: string;
  courseVersion: number;         // 생성 시 스냅샷 버전
  title: string;
  mode: Mode;
  status: RoomStatus;
  ownerId: string;
  joinTokenHash: string;         // 원문 초대 토큰 DB 평문 저장 금지
  createdAt: string;
  closedAt?: string;
}

interface Participant {
  id: string;
  roomId: string;
  role: ParticipantRole;
  displayName: string;
  // 익명 참가자 세션: 별도 opaque secret 또는 서버 세션 사용
  // 학교에서만 필요한 출석/조 번호는 명시적 동의 및 최소 수집
  participantCode?: string;
  joinedAt: string;
  lastSeenAt?: string;
}

interface QuestProgress {
  roomId: string;
  questId: string;
  scopeType: "room" | "participant";
  scopeId: string;                // shared: roomId; individual: participantId
  completedAt: string;
  completedBy: string;            // shared에서 누가 완료했는지 기록
}

interface Submission {
  roomId: string;
  participantId: string;
  submittedAt: string;
  // 서버가 requiredQuestIds 완료를 검증한 다음 생성
}
~~~

### DB 유니크 제약 / 원자성
- QuestProgress UNIQUE(roomId, scopeType, scopeId, questId)
- Submission UNIQUE(roomId, participantId)
- Room 생성 시 코스 버전 고정. 콘텐츠 후속 수정이 이미 시작한 방의 완료 분모를 바꾸면 안 됨
- shared 완료는 서버 트랜잭션/유니크 제약으로 단일 스탬프만 적립
- client의 완료/제출 요청은 재시도로 중복 생성되지 않아야 함
- 개인 상태는 반드시 방 ID와 참가자 인증 스코프를 함께 검증

## 6. API 계약 초안 (서버 선택 전 논리 계약)

| Action | 주체 | 응답 / 보안 요구 |
|---|---|---|
| createRoom(courseId, mode, title) | 방장 | roomId, 참가 URL, 관리자 복구 수단 |
| joinRoom(joinToken, nickname, optional code) | 게스트 | participant session, room summary |
| getRoom(roomId) | 참가자 | 코스/방 상태; 권한 밖 참여자 목록 제외 |
| completeQuest(roomId, questId) | 참가자 | 갱신된 범위의 스탬프 상태 |
| getProgress(roomId) | 참가자 | shared면 공동, individual이면 본인 |
| submit(roomId) | 본인 참가자 | 필수 Quest 충족 시 서버 제출시간 |
| getManagement(roomId) | 방장 | 참여자별 완료/제출 현황 |
| closeRoom(roomId) | 방장 | 읽기전용 전환 |

초대 링크는 관리자 권한을 절대로 부여하지 않는다. 관리 URL이나 owner secret을 공유 링크에 합치지 않는다.

## 7. 인증·안전·개인정보 정책

**회원가입 없는 참여 ≠ 인증 없는 관리.**
- 참가자: 입장 시 강력한 불투명 세션 토큰을 발급하고 재접속 시 동일 참가자로 복구. 닉네임만으로 본인 판정 금지.
- 방장: 별도 인증/회복 수단. 초기 프로토타입에서는 관리자 비밀 링크를 사용할 수 있으나 링크 노출 및 분실 리스크를 명시하고, 학교 대상 실사용 전 더 강한 인증 검토.
- 학생별 식별: 자유/자동 닉네임만으로는 실제 출석부 미참여 인원을 알 수 없음. 학교 테스트는 사전 지정 코드/출석번호 맵이 필요.
- 사진: 기존 기기 로컬 보관 유지. Phase 1에서 사진 서버 업로드, 얼굴 사진 수집, 타인의 갤러리 노출 금지.
- 위치: GPS 수집 없음. 인증사진 및 위치 기반 자동 검증 없음.
- 데이터: 익명 별칭·완료 이벤트 최소 수집. 학생 본명/연락처/위치 수집 기본값 금지.
- 접근 제어: 방장만 전체 제출 현황 열람; 일반 참여자는 다른 참가자의 개인 완료 내역 열람 불가.
- 유출 대응: 초대 링크 재발급 / 방 종료 필요 여부 검증. 데이터 보관·삭제 정책 결정 전 실제 학생 정보 수집 금지.
- '오프라인 가능'은 별도 기능. 일시적 네트워크 오류 시 완료 전송 실패를 명시하고, 서버가 확정하지 않은 스탬프를 동기화 완료로 표시하지 않음.

## 8. 기존 v0.5 자산 재사용 및 기술 경계

현재 main/index.html 현황(2026-10-18 확인):
- Quest 정의, 화면/상태 로직, 스타일이 단일 HTML 파일에 혼합
- 현재 브라우저 저장 키: gj-family-quest
- 탐험대명 / Quest done 배열 / 사진 data URL / 추억 기록은 localStorage
- 사진 입력 capture=environment. 사진은 필수 미션이 아님
- 기존 배포 루트: https://stynerk.github.io/OurAdventure/

실행 전략:
1. root index.html 및 기존 localStorage는 **그대로 유지** (소스/사용자 기록 보존).
2. 별도 next/ 기반 신규 실험. 코드 복사보다는 Quest 데이터 추출/공통화.
3. 경주 코스를 1개 immutable seed Course로 등록.
4. UI 목업(가짜 데이터)과 실제 동기화 테스트는 구분. 목업만으로 '공동 사용 구현 완료'라고 하지 않는다.
5. GitHub Pages는 프런트 정적 호스팅. 여러 기기 간 공유에는 별도 데이터 저장소/인증/실시간 동기화 계층 필요 (백엔드 기술 스택은 아직 미결정).
6. 모바일 iOS Safari / Android Chrome에서 터치·카메라·동기화 회귀 QA.
7. 구버전의 화면 숨김 규칙 [hidden]{display:none!important} 회귀 금지.

## 9. 첫 실험 / 성공 기준

### Pilot A — 가족 공동 모드
- 3명이 링크로 입장, 2대 이상 기기로 테스트
- A가 Quest 완료 → B 기기에 5초 안에 공동 스탬프 반영 (온라인 환경 기준)
- 새로고침/재접속 후에도 완료 상태 유지
- 같은 Quest 동시 완료 시 1개만 기록

### Pilot B — 학교 개인 모드 (실학생 데이터 대신 테스트 코드)
- 교사가 개인 모드 방 생성 → 5명이 서로 다른 번호/코드로 참여
- 각각 다른 Quest 완료율 유지
- 9/9 완료 전에는 최종 제출 불가; 완료 이후 제출 가능
- 방장이 10초 안에 완료/미제출자 구분
- 일반 참가자 계정으로 관리 API 접근 차단

### 통과 조건
- 방 생성 완료 ≤90초 / 참가 완료 ≤45초 (초기 사용성 목표)
- 네트워크 정상 시 새 기기 반영 ≤5초
- 테스트 8명 중 진행도 섞임·권한 누출·중복 제출 0건
- 종료 이후 쓰기 요청 차단
- 두 Pilot 모두에서 방장이 기능을 구두 설명 없이 사용 가능

## 10. 단계별 구현 계획

| 단계 | 결과물 | 완료 기준 |
|---|---|---|
| 0. 제품 설계 | 이 문서, IA, 규칙, 화면 스케치 | 가족/학교의 다른 완료 의미 명시 |
| 1. 프런트 UX 목업 | 방 생성 / 링크 입장 / Quest / 방장 관리 | 시나리오 2개 클릭으로 체험 |
| 2. 백엔드 베이스 | Room/Participant/Progress/Submission, 세션·권한 | 교차기기 E2E 준비 |
| 3. 실동기화 | 완료/제출 및 실시간(또는 폴링) 반영 | 멱등성·복구 테스트 |
| 4. 파일럿 | 가족/교사 사용자 테스트 | 실사용 불편·리스크 기록 |
| 5. Phase 2 진입 판단 | 코스 빌더 우선순위 재평가 | 사용성/채택 근거 확보 |

## 11. 제품 의사결정 / Open Questions

| 질문 | 임시 기본값 | 변경 신호 |
|---|---|---|
| 가족 기본 모드 | shared | 각자 경쟁/독립 기록 요구 |
| 학교 기본 모드 | individual | 조별 기기 1대 운영이 일반적 |
| 초대 링크 | 방 단위 1개 | 학교 출석부 매핑 필요 |
| 닉네임 | 자동 추천 + 수정 | 사전 코드와 결합 필요 |
| 사진 | 기기 로컬 | 교사가 사진 검토해야 함 |
| 관리자 인증 | 프로토타입에서 별도 관리자 링크+복구 방법 | 실사용 단계 보안 강화 |
| 코스 | 기존 경주 9개 고정 | 코스 생성 실사용 수요 입증 |
| 실시간 반영 | 폴링도 초기 허용 | 다인 참여 밀도 증가 |

**중요한 불확실성:** 사용자들이 실제로 단체 '스탬프 투어 운영'을 반복할지는 아직 확인되지 않았다. 제품 확장성은 가설이다. 먼저 Room의 반복 사용 및 운영 편의성으로 검증한다.

## 12. 다음 구현 작업의 정의(DoD)

- [ ] /next/에 새 화면을 추가하고 루트 경주 사이트에 영향 없음
- [ ] 가족 shared 및 학교 individual 사용 흐름을 UI에서 구분
- [ ] 잘못된/만료된 초대 링크, 중복 닉네임, 새로고침, 방 종료 예외 처리
- [ ] 테스트 데이터는 실제 학생 개인정보/사진 대신 가명과 코드 사용
- [ ] 실제 교차기기 공유/권한 검증 전까지 Prototype(동기화 미구현)으로 표시
- [ ] iOS/Android 실제 모바일 확인
- [ ] 파일럿 결과로 Phase 2(코스 빌더) 개발 여부 판단
