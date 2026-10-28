# 데이터 트래킹 명세 — Firebase Analytics

작성일: 2026-10-27 · 담당: PM(Claude) · 구현: Codex · 기준: [PRD v2](PRD_V2.md) 8장 성공 지표

도구: Google Analytics for Firebase(GA4) 웹 SDK, `/next` 앱에서 `logEvent`로 보낸다.
목적: 파일럿 성공 지표를 측정하고, 막히는 단계(퍼널 이탈)를 찾는다. 광고·리마케팅에는 쓰지 않는다.

## 1. 원칙

- **사람을 특정하는 값은 보내지 않는다.** 이름·별칭·이메일·한 줄 느낌 본문·사진·직접 입력한 장소명·좌표는 금지.
- ID는 앱이 만든 무작위 ID(`group_id`, `trip_id`)만 쓴다. 숫자·길이는 구간(bucket)으로 보낸다.
- 목적지는 **시·도 수준**(`destination_region`, 예: 경주, 부산, 오사카)만 보낸다.
- 아이가 쓰는 서비스이므로 Google 신호·광고 개인화는 끈다(`allow_google_signals=false`, `allow_ad_personalization_signals=false`). 데이터 보관 기간은 최소(2개월)로 둔다.
- 이름 규칙: 소문자 `snake_case`, 이벤트명 40자 이내, 이벤트당 파라미터 25개 이내, 문자열 값 100자 이내(GA4 제한).
- 서버 확정 뒤에만 성공 이벤트를 보낸다(예: 사진 저장 완료 후 `stamp_complete`). 실패는 `*_fail` 이벤트로 따로 보낸다.

## 2. 공통 파라미터

모든 이벤트에 붙인다(값이 있는 경우).

| 파라미터 | 값 | 설명 |
|---|---|---|
| `role` | `leader` · `member` | 현재 그룹에서의 역할 |
| `group_id` | 무작위 ID | |
| `trip_id` | 무작위 ID | |
| `trip_status` | `draft` · `active` · `ended` | |
| `app_version` | 예: `v2.0.0` | 배포 버전 |

사용자 속성(user property): `auth_type` = `google` · `anonymous`.

## 3. 이벤트 목록

### 시작·그룹 (F1)

| 이벤트 | 시점 | 파라미터 |
|---|---|---|
| `login` (GA4 권장) | Google 로그인 성공 | `method=google` |
| `group_create` | 그룹 생성 서버 확정 | — |
| `group_open` | 그룹 화면 진입 | `trip_count` |

### 여행·코스 생성 (F2)

| 이벤트 | 시점 | 파라미터 |
|---|---|---|
| `trip_create_start` | "새 여행 만들기" 누름 | — |
| `place_suggest` | 목적지로 장소 추천 결과 받음 | `destination_region`, `provider=google_places`, `result_count`, `result=ok·empty·error` |
| `place_edit` | 장소 추가·삭제·순서 변경 | `action=add·remove·reorder`, `source=suggested·manual` |
| `ai_mission_generate` | AI 4요소 생성 결과 | `place_count`, `result=success·fallback·error`, `retry_count`, `latency_bucket` |
| `ai_mission_edit` | 리더가 AI 문구 수정 | `field=stamp_name·question·observation·photo_idea` |
| `trip_create` | 여행 생성 서버 확정 | `destination_region`, `place_count`, `days`, `ai_used=true·false` |

### 초대·참여 (F3)

| 이벤트 | 시점 | 파라미터 |
|---|---|---|
| `share` (GA4 권장) | 초대 링크 복사·공유 | `method=copy·native_share`, `content_type=invite` |
| `invite_open` | 초대 링크로 진입 | `link_state=valid·invalid·full·ended` |
| `member_join` | 참여 서버 확정 | `member_count_bucket` (1–3·4–6·7–10) |
| `member_join_fail` | 참여 실패 | `reason=full·invalid·network` |

### 여행 중 (F4·F5·F7)

| 이벤트 | 시점 | 파라미터 |
|---|---|---|
| `screen_view` (자동/권장) | 탭·화면 진입 | `screen_name=map·course·stamps·memory·stamp_detail·report·share_image` |
| `stamp_open` | 스탬프 상세 열기 | `place_index`, `already_done=true·false` |
| `photo_select` | 사진 찍기/고르기 완료 | `source=camera·gallery` |
| `stamp_complete` | 사진 저장 서버 확정 → 본인 스탬프 완료 | `place_index`, `has_line`, `line_length_bucket` (0·1–20·21–40·41–60), `upload_bucket` (속도 구간), `stamps_done`, `stamps_total` |
| `stamp_complete_fail` | 저장 실패 | `reason=upload·save·offline·ended`, `retry=true·false` |
| `photo_add` | 이미 완료한 스탬프에 사진 추가 | `place_index` |
| `free_post_create` | 자유 기록 저장 확정 | `has_line` |
| `post_delete` | 본인 기록 삭제 | `was_stamp=true·false` |
| `feed_view` | 추억 피드 진입 | `post_count_bucket` |

### 종료·결과 (F6)

| 이벤트 | 시점 | 파라미터 |
|---|---|---|
| `trip_end` | 리더가 종료 확정 | `days`, `place_count`, `member_count_bucket`, `photo_count_bucket`, `completion_rate_bucket` |
| `report_view` | 리포트 화면 진입 | — (공통 파라미터만) |
| `share_image_create` | 인스타 이미지 미리보기 생성 | `format=feed·story`, `template=board·grid`, `photo_count` |
| `share_image_save` | PNG 저장 | `format`, `template`, `result=ok·error` |
| `past_trip_open` | 종료된 여행 다시 열기 | `days_since_end_bucket` |

## 4. 성공 지표 연결 (PRD v2 8장)

| 지표 | 계산 |
|---|---|
| 리더 생성 ~ 링크 공유 3분 이내 | 같은 세션의 `trip_create_start` → `share(content_type=invite)` 시간 차 |
| 멤버 링크 ~ 참여 45초 이내 | `invite_open(link_state=valid)` → `member_join` 시간 차 |
| 리더 외 사진 올린 멤버 비율 | 여행별 `stamp_complete(role=member)` 고유 사용자 수 ÷ 참여 멤버 수 |
| 멤버당 스탬프 완료율 | `trip_end.completion_rate_bucket` + 여행별 `stamp_complete` 집계 |
| 결과 이미지 저장 | `trip_end` 이후 `share_image_save(result=ok)` 발생 여부 |
| AI 코스 품질 | `ai_mission_generate.result` 비율, 여행당 `ai_mission_edit` 횟수 |
| 업로드 안정성 | `stamp_complete_fail` ÷ (`stamp_complete` + `stamp_complete_fail`) |

퍼널: `trip_create_start` → `trip_create` → `share` → `invite_open` → `member_join` → `stamp_complete` → `trip_end` → `share_image_save`

## 5. 구현 메모 (Codex)

- 이벤트 이름·파라미터를 한 파일(예: `next/analytics.mjs`)에 상수로 모으고, 금지 파라미터(이름·별칭·본문·좌표)를 거르는 함수로만 보낸다.
- 개발·에뮬레이터에서는 debug mode로 보내고, 테스트에서는 전송 함수를 가짜로 바꿔 이벤트 순서·파라미터를 검사한다.
- 서버에서만 아는 값(AI 생성 지연 등)은 callable 응답에 담아 클라이언트가 보낸다. 서버 측 전송(Measurement Protocol)은 후속.
- 측정 실패가 앱 동작을 막지 않게 한다(전송 오류는 무시).

## 6. 결정 필요

| 항목 | 상태 | 비고 |
|---|---|---|
| Firebase 프로젝트에 Google Analytics 연결 | **완료 (2026-10-27 사용자)** — GA4 속성 `560925037`, 웹 스트림 `16210593808` | 웹 앱 설정에 `measurementId` 반영 필요(Codex) |
| GA4 속성 설정: Google 신호 끄기·광고 개인화 끄기·데이터 보관 2개월 | 미확인 | GA 관리 화면 설정 → 사용자 승인 후 진행 |
| 아동 이용 관련 동의 문구 | 미결정 | 개인을 특정하지 않는 통계만 수집하지만, 공개 파일럿 전 안내 문구 확정 필요 |
| BigQuery 내보내기 | 후속 | 파일럿 데이터가 쌓인 뒤 판단 |
