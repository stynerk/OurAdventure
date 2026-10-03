# ChatGPT Project Instructions — OurAdventure

이 프로젝트는 `OurAdventure / 가족여행-경주` 모바일 웹 프로토타입을 실제 2026-10-09~10-11 경주 가족여행에서 사용 가능한 수준으로 완성하는 프로젝트다.

## Source of Truth

- GitHub: `stynerk/OurAdventure`
- Branch: `main`
- 실행 소스: `index.html`
- 배포: GitHub Pages
- 공개 URL: https://stynerk.github.io/OurAdventure/
- 공식 콘텐츠 참고: https://www.gyeongju.go.kr/ebookData/20260902_chi/index.html

`stynerk/myaibuilder`는 과거 배포 실수로 사용된 repo이므로 이 프로젝트에서는 무시한다.

## 사용자/목표

주 사용자는 초등학교 2학년 아이이며 부모는 보조 사용자다.

제품 목표:
- 아이가 여행을 탐험처럼 느끼고 스스로 다음 Quest를 열게 한다.
- 8개의 짧은 관찰 미션과 즉시 스탬프로 진행감을 준다.
- 사진과 완료 기록이 자동으로 가족 원정기가 되게 한다.

핵심 가치:
- 아이에게는 탐험
- 부모에게는 진행 장치
- 가족에게는 기록

## 제품 원칙

- Story First
- Child-led
- Visual before Text
- 3~5분 Short Mission / Fast Reward
- Action → Reward → Knowledge
- 사진은 권장하되 필수 아님
- 스킵/순서 변경 허용, 페널티 없음
- 지도는 길찾기용이 아니라 이야기/진행도용
- 초2 기준 짧은 문장, 큰 터치 영역

## MVP 제외

로그인, GPS, 길찾기, 결제, AI 추천, 소셜, 랭킹, 다도시 확장은 여행 전 MVP에 넣지 않는다.

## 작업 우선순위

1. 실제 모바일에서 안 깨지는 것
2. Quest 실사 이미지 정확성/로딩/사용권
3. 터치 영역
4. 카메라/사진 UX
5. 동화책 Story Map
6. 가족 원정기 완성도

## 구현 원칙

- 기존 코드를 추측하지 말고 GitHub 최신 `main/index.html`을 먼저 읽는다.
- 공개 사이트 버그는 수정 후 GitHub Pages 배포 성공까지 확인한다.
- 사용자가 관찰한 버그를 신규 기능보다 우선한다.
- `[hidden]{display:none!important}` 화면 숨김 처리는 회귀시키지 않는다.
- 사진 저장은 현재 브라우저 로컬 저장 구조이며, 용량 문제가 있으면 IndexedDB를 우선 검토한다.
- 외부 사진 URL은 깨질 수 있으므로 최종 여행 버전은 안정적인 asset 전략을 검토한다.

## 콘텐츠 원칙

각 Quest는 기본적으로 다음 순서를 따른다.

`이야기 → 오늘의 미션 → 실사 미리보기 → 여기 봐! → 한 줄 지식 → 사진 아이디어 → 촬영/완료`

공식 자료를 그대로 복사하지 말고 아이가 읽는 짧은 탐험 문장으로 재작성한다.

## 완료 보고 방식

가능하면 설명에 그치지 말고 실제 파일/코드를 수정하고 배포한다.

완료 보고에는 다음을 포함한다.
- 무엇을 바꿨는지
- GitHub 반영 여부
- Pages 배포 성공 여부
- 사용자가 지금 확인할 URL/테스트 포인트

## 2026-10-04 코스 변경

- 상세 일정은 [GYEONGJU_ITINERARY.md](./GYEONGJU_ITINERARY.md)를 따른다.
- 황성공원 김유신 장군 기마상을 첫날 정식 우선 방문지로 추가했다.
- 불국사 주 미션은 극락전 복돼지 동상 쓰다듬기 + 스냅샷이다. 두 탑 비교는 추가 관찰이다.
- 총 8개 장소/8개 스탬프, 3일 구성은 3+3+2다. 기존 완료/사진 기록은 유지한다.

