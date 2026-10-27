# T0 스파이크 — AI 연결 실험

상태: 운영 구현 아님. 최신 기준은 [PRD v2](../docs/PRD_V2.md), [하이브리드 가이드](../docs/AI_COURSE_GUIDE.md), [T0 검토 보고](../docs/engineering/T0_SPIKE_REVIEW.md)다. 이 디렉터리의 기존 AI 장소 추천 실험은 지도 API 선정 전의 비교용 코드다. **AI가 장소를 만드는 현재 응답을 T4/T5의 운영 코스로 연결하지 않는다.** 지도 검색의 장소 ID를 고정하고 AI 4요소만 생성하는 구현은 T4/T5에서 별도로 진행한다.

기획·목업을 수정하지 않고 PRD v2 F2에 붙일 목적지 기반 AI 추천 API와 개발 확인 화면을 구현했다. 실제 그룹 서비스·Firebase 연동 전의 독립 기능이다.

## 실행

Node.js 22 이상에서 프로젝트 루트 기준으로 실행한다.

```powershell
node development/ai-course.cjs
```

접속: http://127.0.0.1:4174

실제 AI 호출에는 서버 프로세스의 `OPENAI_API_KEY`와 `OPENAI_MODEL` 환경변수가 모두 필요하다. 운영자 비밀 설정으로 주입하고 코드·브라우저·Discord에 키를 넣지 않는다. 모델을 설정하지 않으면 호출하지 않는다. 공급자·모델 최종 선택과 유료 호출은 이번 스파이크 PR에서 수행하지 않았다. 설정이 없으면 503과 안내를 표시하며 샘플 응답으로 대체하지 않는다.

서버는 로컬 루프백 전용이다. 고정 허용 Origin, 요청 크기 제한, 동시 요청 1개, 프로세스당 최대 20회 AI 시도 제한을 둔다. 공개 배포에는 실제 리더 인증·그룹 권한 검증·사용자별 과금 한도·영속적 요청 제한이 선행해야 한다. 로컬 프로세스 한도는 운영 비용 상한이 아니다.

## 동작

- 목적지와 1~7일 기간 → AI 장소 추천 → 장소명·순서·추가/삭제 → 확정.
- 입력 변경 시 이전 추천을 비우며, API 실패 시 기존 편집 내용을 보존한다.
- 기본 스탬프는 장소명·이모지다. AI 그림 생성이나 이미지 API 호출은 이번 기능에 포함하지 않는다.
- AI 추천은 위치·영업·예약·최적 동선을 검증한 데이터가 아니다. 리더가 방문 후보를 확인한 뒤 확정한다.
- 확정은 `new-trip-course.json` 파일을 내려받는다. 기존 그룹·여행·사진을 읽지 않으며 새 데이터의 records/completions는 항상 빈 배열이다. 실제 그룹의 새 여행 저장 API 연결은 후속이다.
- 여행명 100자·장소 20개·기간 7일은 개발 검증용 한도이며 정책 승인값이 아니다.

## API

`POST /api/courses/generate`, JSON: `{ "destination": "부산 해운대", "days": 2 }`

반환: `{ destination, days, title, places: [{ name, day, reason, icon }], source: "ai", verified: false }`

서버 측 JSON 형식·장소 중복·기간·장수 검증을 거친다. API 응답 원문·키를 클라이언트 오류에 포함하지 않는다. 사진·구성원·과거 기록을 AI에 전송하지 않는다.

## 검증

```powershell
node --test development/ai-course.test.cjs
```

검증 범위: 요청 형식·구조화 출력 계약·입력 검증·키 미설정·중복/잘못된 결과·거절/미완성/타임아웃/호출 한도 오류·HTTP Origin 제한·스크립트 구문. AI 응답은 테스트 대역으로 검증하며 실제 AI 호출·품질·브라우저 조작 검증과 구분한다.

공식 API 근거: [Responses](https://developers.openai.com/api/reference/resources/responses/methods/create), [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).
