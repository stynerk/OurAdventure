# Engineering QA — Shared Adventure Phase 1

2026-10-19 · 테스트 데이터는 가상 별칭/코드 및 demo 프로젝트만 사용

## 결과

| 검사 | 결과 | 범위 / 한계 |
|---|---|---|
| `npm test` | 3/3 통과 | root 파일 해시·9개 Quest 일치, JS 구문·hidden 회귀, 공개 파일만 패키징 |
| `npm run test:integration` | 10/10 통과 | 실제 Firestore emulator + Rules, Node 22, Java 21, Firebase CLI 15.34.0 |
| Firebase SDK 3세션 | 통과 | Auth emulator의 Google 테스트 자격/익명 인증, 실제 callable wrapper의 토큰 검증, 가입·공동 스탬프 listener·종료 후 차단 |
| Chromium 390×844, 3개 격리 context | 통과 | 로그인 UI 없는 참여, 공동 스탬프 반영, 새로고침/익명 세션 유지, 개인별 9개 완료·제출 분리, 방장 관리, 종료 후 UI 차단, 가로 넘침 없음 |
| 표준 Functions emulator의 HTTP 종단 테스트 | 환경 차단 | Unix socket `listen EPERM /tmp/fire_emu_*.sock`. 배포 환경의 함수 실패로 판정하지 않으며 표준 emulator 통과로 보고하지 않음 |
| 실제 exported callable handler의 로컬 HTTP 테스트 | 통과 | `tests/callable-http.mjs`: 동일 handler를 Express TCP 서버에서 실행. Auth/Firestore emulator와 실제 SDK 사용. Cloud Functions/Cloud Run 런타임 검증은 아님 |
| Functions 운영 의존성 audit | 취약점 0 | `npm audit --omit=dev --prefix functions` 실행 시점 기준 |
| 실제 Google 로그인 팝업 / OAuth 도메인 | 미검증 | 테스트는 Auth emulator의 가짜 Google 자격 사용 |
| iOS Safari / Android Chrome 실기기 | 미검증 | Chromium 모바일 viewport는 실기기를 대체하지 않음 |
| 운영 Firebase / 교차기기 5초 SLO / 사용자 파일럿 | 미실행 | 운영 프로젝트 설정이 없고 성능 목표는 아직 가설 |

## 통합 테스트 상세

1. 익명 계정 방 생성 차단 / Google provider 검사 / 임의 코스 차단.
2. 초대 미리보기 최소 정보만 반환 / 잘못된 token 및 경로 주입 차단.
3. 중복 가입 멱등 / 기존 role·이름·진행 보존 / 참여자 수 중복 증가 방지.
4. 동일 shared Quest 동시 완료 요청 4개 → 스탬프·감사 이벤트 각각 1개.
5. individual 상태 분리 / 9개 필수 완료 전 제출 거절 / 중복 제출 1개.
6. 방장만 초대 재발급 / 이전 초대 무효 / 기존 멤버 진행 유지.
7. 방장만 종료 / 종료 후 완료·제출·가입·재발급 모두 거절.
8. 정원 경합 시 정원 초과 방지 / 별칭 입력 검증.
9. 방 ID만 아는 비회원의 변경·관리 차단.
10. Rules: 비로그인·비멤버·타인 개인 기록·참여자 목록·초대 해시 읽기 차단, 본인/방장 읽기 허용, 방장 포함 모든 직접 쓰기 차단.

예상된 PERMISSION_DENIED 로그는 위 negative test에서 발생한다.

## 재현

```bash
npm ci --ignore-scripts
npm ci --ignore-scripts --prefix functions
npm test
npm run test:integration
npx playwright install chromium --only-shell
npm run test:callable-http
```

- Node 22, Java 21 권장. 프런트는 Firebase CDN 13.0.0 고정, 서버 Admin 14.5.0 / Functions 7.4.0.
- 이 환경의 최신 Chromium 다운로드 파일이 비정상이라 설치 가능한 Chromium 134(headless shell v1161)를 `PLAYWRIGHT_CHROMIUM_EXECUTABLE`로 지정했다. 현재 버전 Chrome 검증으로 간주하지 않는다.
- E2E runner는 demo Auth + Firestore emulator 안에서만 실행한다. HTTP proxy 사용 환경에서는 브라우저에도 proxy 설정을 전달하며 테스트 context에만 HTTPS 인증서 오류 무시를 적용한다. 제품 코드의 보안 설정은 변경하지 않는다.
- 원본 변경 방지는 기준 커밋 `00e78ef`의 root SHA-256을 사용한다. 향후 원본의 의도된 수정은 해당 테스트 기준과 코스 버전을 함께 검토해야 한다.

## 출시 전 남은 검증

- 대상 Firebase 설정/Google 허용 도메인 및 실제 로그인·로그아웃·계정 연결 충돌 처리.
- 실기기 2대 이상, 가족 3명/개별 테스트 5명, 동일 Quest 동시 완료, 중복 별칭, 종료 직전 경합.
- 실제 학생 정보 없이 테스트. 사전 명단이 없으면 미입장 인원을 보여주지 않는다.
- App Check/요청 제한 및 데이터 보관·삭제 정책을 확정하고 적용.
- GitHub Pages와 Firebase Functions/Rules 배포는 각각 결과 확인. 이번 로컬 테스트는 운영 배포 성공을 의미하지 않는다.
