# OurAdventure — Project Handoff

기준일: 2026-10-05

## Source of Truth

- Repository: `stynerk/OurAdventure`
- Branch: `main`
- App: `index.html`
- Deploy: GitHub Pages via `.github/workflows/pages.yml`
- Public site: https://stynerk.github.io/OurAdventure/
- 최신 일정/미션 기준: `GYEONGJU_ITINERARY.md` (2026-10-05)
- 최신 실행 소스는 main/index.html에서 확인한다.

> `stynerk/myaibuilder`는 초기에 실수로 배포한 repo이므로 이 프로젝트에서는 사용하지 않는다.

## Product

초등학교 2학년 아이가 2026-10-09~10-11 경주 가족여행을 ‘탐험’처럼 주도하도록 만드는 모바일 웹 프로토타입.

핵심 경험:

`동화 지도 → 짧은 관찰 Quest → 실사 미리보기 → 사진 → 즉시 스탬프 → 가족 원정기`

핵심 가치:

- 아이에게는 탐험
- 부모에게는 진행 장치
- 가족에게는 기록

## Product Principles

- Story First
- Child-led
- Visual before Text
- 3~5분 Short Mission / Fast Reward
- Action → Reward → Knowledge
- 사진은 권장하지만 필수 아님
- 스킵/순서 변경 허용, 페널티 없음
- 지도는 길찾기용이 아니라 이야기/진행도용
- 초2 기준 짧은 문장, 큰 터치 영역

## 2026-10-05 경주 현지 코스

상세 시간표는 [GYEONGJU_ITINERARY.md](./GYEONGJU_ITINERARY.md)를 따른다. 서울 출발·이동·귀경은 앱에서 제외한다.

- 금요일: 점심·숙소 짐 보관 → 대릉원·황리단길 → 첨성대 → 월성·석빙고 → 저녁 → 동궁과 월지 → 숙소.
- 토요일: 불국사 → 석굴암 → 점심 → 민속공예촌 공예 체험 → 보문호 휴식 → 저녁 → 월정교 → 숙소.
- 일요일: 체크아웃 → 박물관 도착 준비(09:30) → 본관 관람(10:00–11:30) → 성동시장 점심·기념품(11:30–12:30).
- 9개 미션(4+4+1): 대릉원, 첨성대, 월성·석빙고 / 불국사, 석굴암, 공예 체험, 월정교 / 박물관.
- 김유신 묘·경주읍성은 현재 코스에서 제외. 이전 동상·묘·읍성 완료 기록과 사진은 이전 코스 기록으로 보존하고 현재 스탬프 수에 포함하지 않는다.
- 불국사는 극락전 마당 복돼지 쓰다듬기 + 스냅샷 유지. 석굴암 사진은 관람 후 바깥에서 촬영한다.
- 공예 체험: 10/10 14:00–16:00 계획, 공방·체험 종류·예약 미확정.
- 박물관: 10:00 개관. 어린이박물관은 공식 임시휴관(별도 공지 시까지) 안내에 따라 제외하고 신라역사관·성덕대왕신종으로 구성한다. 여행 직전 재확인한다.
- 식사·숙소·현지 이동·휴식은 시간표에 표시하되 스탬프를 강제하지 않는다. 모든 시각은 계획이며 대기·이동·가족 컨디션에 따라 조정한다.

## Quest Content Pattern

각 Quest는 다음 순서를 기본으로 한다.

`이야기 → 오늘의 미션 → 실사 미리보기 → 여기 봐! → 한 줄 지식 → 사진 아이디어 → 촬영/완료`

공식 콘텐츠 참고:
https://www.gyeongju.go.kr/ebookData/20260902_chi/index.html

공식 자료를 그대로 복사하지 않고 초2가 읽는 탐험 문장으로 재작성한다.

## Current Implementation Notes

- 탐험대 이름/완료 상태/사진을 브라우저 로컬에 저장
- 카메라는 `input type=file accept=image/* capture=environment`
- 사진은 서버 업로드가 아니며 Quest 완료의 필수 조건이 아님
- 현재 사진 data URL을 localStorage에 저장하므로 용량 리스크 있음
- Story Map은 날짜별 2열 CSS/emoji 카드. 각 챕터는 현지 시간표 전체를 표시하고 미션 방문지를 연결한다.
- 월성·석굴암·공예 체험은 실사 사진을 임의로 대체하지 않고 아이콘과 관찰 안내를 표시한다. 실사 자산 보완은 후속 작업이다.
- 외부 실사 이미지 URL은 핫링크/라이선스/안정성 최종 점검 필요

## Known Critical Fix

공개 배포 초기에 hidden 화면이 아래로 이어져 보이는 버그가 있었다.

원인:
`.onboarding { display:grid }`가 hidden 동작보다 우선.

유지해야 할 수정:
`[hidden]{display:none!important}`

Fix commit:
`60d6649616408568543a6b5fcc6d9808cbe0c696`

## P0 Before Trip

1. iPhone Safari / Android Chrome 실기기 QA
2. 화면 전환/터치 영역 회귀 테스트
3. 카메라/사진 촬영·선택·재촬영 QA
4. 실사 이미지 로딩 안정성 및 사용권 점검
5. 사진 저장 안정화 검토 (IndexedDB)
6. Story Map 시각 품질 강화
7. 2026-10-08 공식 운영시간/휴관 최종 확인

## Non-goals Before Trip

- 로그인
- GPS/길찾기
- 결제
- AI 추천
- 소셜/랭킹
- 다도시 확장

## New Project Startup

새 ChatGPT Project/Work에서는 가장 먼저 이 repo의 `main/index.html`과 workflow를 읽고 현재 코드 상태를 기준으로 작업한다.

첫 작업 권장:

> 현재 GitHub 코드를 점검해서 여행 전 P0 문제 목록을 만들고, 가장 치명적인 문제부터 실제 코드 수정 → main 반영 → GitHub Pages 배포 성공 확인까지 진행한다.
