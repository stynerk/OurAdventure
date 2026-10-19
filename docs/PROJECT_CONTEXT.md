# Our Adventure — 최신 프로토타입 및 제품 기준

기준일: 2026-10-19 (Asia/Seoul). 이 문서는 기존 공개 앱의 인계 기준이며 신규 기능 구현 완료를 뜻하지 않는다.

## 읽기 순서와 근거

1. 이 문서 → [HANDOFF.md](HANDOFF.md) → [QA.md](QA.md).
2. 기존 실행 소스: main `00e78efe474cd18138871ef085e05188457a63c6`의 `index.html`.
3. 신규 제품 PRD: 기획 브랜치 `feature/shared-adventure-phase1-plan-20261018`, 커밋 `048c4c10e811fc437b0c27ce62e53353caab46cc`의 `docs/PHASE1_SHARED_ADVENTURE_SPEC.md`, `docs/OUR_ADVENTURE_IMPLEMENTATION_HANDOFF.md`.
4. Drive 실험: `experiment/family-drive-pilot`, `5d4d187722c527d5933be92cf339864da12641a6`의 `experiments/DRIVE_PILOT_SETUP.md`와 `drive-pilot.html`.

3개 원격 브랜치를 재귀 조회했다. main에 PRD.md라는 파일은 없으며 PROJECT_HANDOFF.md / PROJECT_INSTRUCTIONS.md / GYEONGJU_ITINERARY.md가 기존 제품 문서 역할을 한다. 최신 그룹 PRD는 위 기획 브랜치에 있다. PR #2는 기획 문서 2개만 있는 Draft/미병합이며 Firebase·그룹 기능 구현·테스트·배포는 미착수로 명시되어 있다. PR #1은 별도 Drive 실험 Draft다.

공개 URL: https://stynerk.github.io/OurAdventure/
공개 HTML 직접 조회 결과 main/index.html과 68,564 bytes 전체 일치.
SHA-256: bc3ebfb4390f68f432bee3884616baa989ea8e04b60a35800cc24b49288921d8
배포 근거: https://github.com/stynerk/OurAdventure/actions/runs/38203316037 (success, head 00e78ef).
HTML 일치는 브라우저 실행 QA나 모든 이미지의 로딩 검증을 뜻하지 않는다.

## 현재 구현 기능 인벤토리

| 영역 | 현재 구현 | 보존 계약 |
|---|---|---|
| 온보딩 | 추천 이름 6개, 직접 입력, 재방문 복귀 | 아이 중심 짧은 문장·큰 터치 영역 |
| 탐험 | 지도/코스/스탬프/추억 4탭, 다음 미완료 Quest | 지도는 탐험 진행도이며 GPS/길찾기 아님 |
| 코스 | 3일 챕터·현지 시간표·식사/휴식 및 주의 안내 | 날짜/예약/휴관은 2026년 경주 여행의 과거 정보 |
| Quest | 이야기·미션·관찰·지식·사진 아이디어·출처·미리보기 | 사진 없이 완료 가능, 순서 강제/스킵 페널티 없음 |
| 사진 | 촬영과 갤러리/파일 입력 분리, 재촬영·교체 | 장변 최대720px/JPEG .65, 서버 업로드 없음 |
| 스탬프 | 완료 축하, 중복 완료 방지, 완료율 | 현재 주요9/선택0; 과거 기록은 분모 제외 |
| 추억 | A album/B scrapbook/C journal, 기본 C | 템플릿 전환·상세 기록 접기·실시간 미리보기 |
| 일기 | 공통 소감3개 각50자, album 대표사진, journal 별점0~5 | 별도 초안 저장 키 보존 |
| 출력 | A4 2480×3508 PNG 생성·미리보기·다운로드·window.print | 기존 사진/완료 기록을 출력 시 변경하지 않음 |
| 공유 | OG/Twitter 메타데이터·1200×630 일러스트 | 이미지 출처는 assets/SOURCES.md |
| 이전 코스 | kimyusin / kimyusin-tomb / eupseong 보관 | archivedRecords 표시·출력, 현재9스탬프와 분리 |

### 현재 9개 Quest (선택 미션 0개)

| 일차 | ID | 내용 |
|---|---|---|
| 1 | daereungwon | 대릉원 |
| 1 | cheomseongdae | 첨성대 |
| 1 | wolseong | 월성·석빙고 |
| 1 | donggung | 동궁과 월지 |
| 2 | bulguksa | 불국사 |
| 2 | seokguram | 석굴암 |
| 2 | craft | 민속공예촌 공예 체험 |
| 2 | woljeonggyo | 월정교 |
| 3 | museum | 국립경주박물관 |

구형 문서의 4+4+1 나열에서 동궁과 월지가 누락됐으나 현재 코드는 포함한다. optional 지원 코드만 있고 현재 optional Quest는 없다. 첫 고정 Course의 requiredQuestIds는 위 9개로 구현 계약에 명시할 필요가 있다.

## 데이터 및 기술 계약

단일 HTML/CSS/inline JS, 빌드 단계·Firebase·로그인·서비스워커 없음.

- `gj-family-quest`: {team, done:[], photos:{id:dataURL}, memories:{id:text}, archivedRecords:[{id,title,memory,photo}]}.
- `gj-family-diary-template`: {hero, template, rating, diaryReflection, diaryLearned, diaryAgain}.
- 저장은 브라우저 localStorage이며 계정/기기 간 동기화·복구 기능은 없다.
- 사진 저장은 후보 데이터를 먼저 저장한 뒤 state에 반영하여 실패 시 이전 사진을 보존한다. 일반 save()/완료 처리에는 같은 보장이 없다(QA.md).
- resetAll()은 첫 번째 키만 제거한다. 일기 초안까지 전부 초기화한다고 안내하면 안 된다.
- `[hidden]{display:none!important}` 보존. 루트 앱·두 저장 키·기존 자산을 임의 삭제/변경하지 않는다.
- 신규 그룹 앱은 별도 경로와 별도 저장 namespace. 같은 origin의 localStorage가 공유된다는 점 유의.
- 사진/배경 출처는 assets/SOURCES.md. 일부 외부 Wikimedia 이미지/공식 링크에 의존하며 현재 로딩·사용권 전면 재검증은 미실행.
- `.github/workflows/pages.yml`은 main의 index.html 또는 workflow 변경만 push 자동 배포한다. next/**, assets/** 단독 변경은 현재 자동 배포 대상이 아니다. 업로드 범위는 저장소 전체 `.`. 신규 앱 도입시 trigger/base path/build output을 검토한다.

## 최신 제품 결정과 미구현 범위

Room 공통 모델, shared(공동)/individual(개인) 완료. 리더 Google 로그인 필수, 일반 참여자는 링크+별칭 및 내부 Anonymous Auth. Google 로그인한 기존 사용자는 다른 방에서 member가 될 때 세션을 익명으로 덮어쓰지 않는다. 권한은 방별 owner/member로 서버/Rules에서 검증한다.

Phase1: 고정 경주 코스·방 생성·초대·진행 동기화·관리·개인 제출·종료. Phase2: 코스 생성/미션 편집. 사진 서버 업로드·익명 교차기기 복구는 제외. 기존 사진 출력 경험을 삭제해도 된다는 뜻은 아니다.

학교 전용 플랫폼으로 확정한 것이 아니다. 학교 1인/1조 운영, 명단 매핑, 보관삭제, 초대 정책, 제출 후 수정, Firebase 프로젝트/규칙은 미결정. 명단 없는 방은 미입장 학생을 알 수 없다. 내 탐험방 목록은 개발 핸드오프 필수 화면이나 상세 IA에는 빠져 있으므로 UX 계약에서 정합화한다.

학교 수요·반복 사용·90초 방생성/45초 입장/5초 반영/10초 현황 파악은 검증 전 가설·목표다.

## 구현과 과거 운영 결정의 차이

코드의 고정 일정은 첫날11:30 점심/13:30 대릉원이며, 사용자가 실제15:30 도착/첨성대 시작으로 바꾼 대화와 다르다. 어린이박물관 제외·공예 예약 미확정 코드와 이전 예약 완료 대화도 차이가 있다. 이 인계는 실제 구현을 기록하며 최신 운영 사실이나 사용자 승인으로 승격하지 않는다. 실여행 기록을 소급 수정하지 말고 일반 코스와 실제 활동 기록의 구분을 Product에서 결정한다.

## Drive 실험 격리

drive.file·Google Picker, 장변1600 JPEG 실험. OAuth 설정/실업로드/두 계정 자동조회/실기기 검증 미실행. 폴더 공유만으로 다른 계정 파일 자동 조회를 보장하지 않는다. 현재 main과 구형 기반이 다르므로 통째 병합하지 말고 통과 후 필요한 코드만 선택 통합한다. 신규 Phase1 사진 정책과 별개 R&D다.
