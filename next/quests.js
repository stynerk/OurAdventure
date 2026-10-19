// Course v1 is intentionally fixed. Course creation/editing is Phase 2.
// IDs match the existing root index.html, to preserve future migration options.
export const COURSE_ID = "gyeongju-2026-v1";
export const COURSE_TITLE = "경주 역사 탐험";
export const QUESTS = Object.freeze([
  { id: "daereungwon", day: 1, icon: "👑", place: "대릉원", title: "왕의 언덕", mission: "크고 작은 신라 고분을 비교하고 마음에 드는 봉분 하나를 골라보자." },
  { id: "cheomseongdae", day: 1, icon: "⭐", place: "첨성대", title: "별 관찰자", mission: "첨성대 가운데 네모난 창을 찾아 손가락으로 프레임을 만들어보자." },
  { id: "wolseong", day: 1, icon: "🧊", place: "월성·석빙고", title: "얼음 창고", mission: "월성 숲길에서 석빙고 입구와 둥근 지붕을 관찰해보자." },
  { id: "donggung", day: 1, icon: "🌙", place: "동궁과 월지", title: "달빛 궁전", mission: "연못에 비친 궁전의 모습을 찾아보자." },
  { id: "bulguksa", day: 2, icon: "🐷", place: "불국사", title: "복돼지의 인장", mission: "극락전 마당 복돼지를 찾아 소원을 떠올려보자. 현장 안내를 우선해." },
  { id: "seokguram", day: 2, icon: "🪷", place: "석굴암", title: "돌 속의 미소", mission: "안에서는 눈으로만 관찰하고 밖에서 기억한 손 모양을 따라 해보자." },
  { id: "craft", day: 2, icon: "🎨", place: "민속공예촌", title: "우리 손의 보물", mission: "공방에서 작품을 만들고 가장 마음에 드는 부분을 설명해보자. 예약 상태 확인이 필요해." },
  { id: "woljeonggyo", day: 2, icon: "🌉", place: "월정교", title: "불빛 다리", mission: "월정교의 지붕과 물에 비친 불빛을 찾아보자." },
  { id: "museum", day: 3, icon: "🏺", place: "국립경주박물관", title: "신라 보물", mission: "전시실에서 가장 마음에 드는 신라 유물을 골라보자." },
]);
export const QUEST_IDS = Object.freeze(QUESTS.map((quest) => quest.id));
