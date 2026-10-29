# 운영 연결 점검 — 2026-10-29

사용자의 Blaze 전환 완료 및 운영 연결·배포 진행 요청에 따라 실행했다. 배포 소스는 통합 브랜치 `engineering/stack-integration`의 `59efc52`이며, 아래 상태는 에뮬레이터가 아닌 지정 Firebase 프로젝트에 대한 실제 요청 결과다. 인증 정보와 SDK 키는 이 문서에 기록하지 않는다.

## 적용 및 확인

| 항목 | 결과 |
|---|---|
| Blaze | Cloud Billing 조회에서 billingEnabled=true |
| 웹 앱 | 기존에 등록한 웹 앱의 프로젝트 일치 확인 |
| 인증 | 익명 인증 활성, GitHub Pages 도메인 허용 확인 |
| 사진 저장소 | 기본 버킷 생성, 서울 ASIA-NORTHEAST3 확인 |
| 이미지 CORS | `https://stynerk.github.io`의 GET/HEAD 허용. 기존 CORS는 보존 |
| Firestore | 규칙·인덱스 배포 성공 |
| Storage | 그룹 멤버/본인 업로드·형식/용량·확정 상태 검증 규칙 배포 성공 |
| Functions | Node.js 22, 2세대, 서울 함수 21개 생성 성공 |

첫 배포는 Google 서비스 API 초기화 요청 실패로 중단됐다. 같은 배포 재시도에서 규칙과 함수 생성에 성공했다. CLI의 최종 종료 코드는 1이다. 마지막 실패는 **함수 배포 실패가 아니라 Artifact Registry 이미지 정리 정책 미설정**이다. 함수별 successful create operation 응답을 확인했으며, 실제 callable 요청도 아래와 같이 통과했다. `--force`나 임의의 이미지 삭제·보관기간 정책은 적용하지 않았다.

## 실제 운영 요청 검사

| 검사 | 결과 |
|---|---|
| 비로그인 Firestore 그룹 문서 접근 | 403 차단 |
| 비로그인 Storage 사진 접근 | 403 차단 |
| 비로그인 createGroup callable | 401 UNAUTHENTICATED |
| 익명 로그인 후 createGroup callable | 403 PERMISSION_DENIED |
| 검사에 사용한 임시 익명 계정 삭제 | 200 성공 |

운영 여행·그룹·사진 데이터는 생성하지 않았다. 위 검사는 정상 로그인 사용자의 전체 여행 흐름이나 사진 업로드 성공을 대신하지 않는다. 기능 전체는 기존 에뮬레이터·실제 SDK/브라우저 테스트 결과를 참고한다.

## 남은 연결

- Firebase CLI 로그인은 완료됐다. GitHub CLI 웹 승인은 아직 저장되지 않아 재요청했으며, Actions 변수 접근을 확인하지 못했다. 접근 거부를 변수 부재로 해석하지 않는다.
- `FIREBASE_WEB_CONFIG` 검증/반영, main 병합 및 Pages 배포는 아직 실행하지 않았다. 서버가 먼저 반영된 상태다.
- 웹 배포 후 Google 팝업 로그인·사진 업로드·GA 요청을 운영 화면에서 확인해야 한다. GA 관리 화면의 실제 수신은 별도 확인 사항이다.
- Artifact Registry 이미지 정리 정책은 별도 보관기간 결정이 필요하다.
- 기존 추천/AI QA 6개와 실기기 PNG 저장 확인 1개가 남아 있다.

기존 루트 앱과 저장 데이터는 변경하지 않았다. 로그인 토큰·서비스 계정 키·개인 계정 정보는 커밋하지 않는다.
