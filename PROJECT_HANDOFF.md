# OurAdventure — Project Handoff

기준일: 2026-10-04

## Source of Truth

- Repository: `stynerk/OurAdventure`
- Branch: `main`
- App: `index.html`
- Deploy: GitHub Pages via `.github/workflows/pages.yml`
- Public site: https://stynerk.github.io/OurAdventure/
- 최신 일정/미션 기준: `GYEONGJU_ITINERARY.md` (2026-10-04)
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

## 3-day Story

### Day 1 — 왕의 도시로 들어가라
1. 황성공원 김유신 장군 기마상 — 장군과의 만남 (딸의 요청으로 정식 우선 방문)
2. 경주읍성 — 성문 수호대
3. 대릉원 — 왕의 언덕

### Day 2 — 사라진 신라의 빛을 찾아라
4. 불국사 극락전 복돼지 — 복돼지의 인장 (등을 살짝 쓰다듬고 스냅샷)
5. 국립경주박물관 — 신라 보물
6. 동궁과 월지 — 달빛 궁전

### Day 3 — 별과 다리를 건너라
7. 첨성대 — 별 관찰자
8. 월정교 — 완주의 다리

불국사의 석가탑/다보탑 비교는 추가 관찰로 유지한다. 복돼지는 극락전 마당 석등 앞의 동상이며 현판 뒤 나무 조각은 만지는 대상이 아니다. 사진은 권장하되 완료 필수 조건은 유지하지 않는다.

첫날 늦게 도착하면 장군 동상을 우선하고 대릉원을 3일차로 옮긴다. 시간/체력에 따라 경주읍성은 축소 가능하다. 3+3+2 구성이나 모든 스탬프를 강제하지 않는다.

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
- Story Map은 현재 CSS/emoji 기반이며 동화책 지도 수준으로 개선 필요
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

