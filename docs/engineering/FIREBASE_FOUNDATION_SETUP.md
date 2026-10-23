# 인증·그룹 기반 개발 및 운영 연결

작성: 2026-10-23. PR #3 기반 절차를 최신 main과 정합화했다. 실제 콘솔 관찰 기록은 [FIREBASE_SETUP.md](../FIREBASE_SETUP.md)를 우선한다. 운영 배포 완료나 새 과금 승인이 아니다.

## 로컬 실행

Node22 / Java21 기준이며 테스트는 `demo-our-adventure`만 사용한다.

```bash
npm ci --ignore-scripts
npm ci --ignore-scripts --prefix functions
npm test
npm run test:integration
npm run test:callable-client
npm run test:client
npx playwright install chromium --only-shell
npm run test:browser
```

표준 Functions emulator가 Unix socket 권한 등으로 실행되지 않으면 `npm run test:callable-http`로 실제 exported handler와 Auth/Firestore emulator를 연결할 수 있다. 이는 표준 Functions 런타임·실제 Google OAuth·운영 검증을 대신하지 않는다. 브라우저 테스트는 8080 포트를 사용하며 기존 `next/firebase-config.js`를 덮어쓰지 않는다.

브라우저 없이 SDK와 handler 연결만 검증하려면 `npm run test:callable-client`를 사용한다. CI에도 단위/Firestore 검사와 이 검사를 연결했다. 별도 Chromium을 쓸 경우 `PLAYWRIGHT_CHROMIUM_EXECUTABLE`로 경로를 지정한다.

수동 실행은 example config를 ignored `next/firebase-config.js`에 복사해 demo 설정과 `useEmulators=true`로 구성한다. Auth/Firestore/Functions emulator와 정적 서버를 실행하고 `/next/`에 접속한다.

## 운영 연결·롤백

- main에 기록된 프로젝트/provider/허용 도메인/서울 Firestore를 확인한다. 이미 구성된 항목을 무조건 재생성하지 않는다. 이번에는 콘솔 상태를 다시 확인하지 않았다.
- Functions v2 요금제·권한·비용 조건은 배포 전에 확인한다. Spark 기록을 운영 배포 가능·과금 승인으로 해석하지 않는다.
- 프로젝트를 명시해 Rules/Functions를 배포하고 버전을 기록한다. repository variable `FIREBASE_WEB_CONFIG`는 공개 웹 식별 필드만 사용한다. 관리자 키를 저장소·브라우저에 넣지 않는다.
- Pages 패키징은 root/자산/신규 앱만 포함한다. 개발 config·서버·문서·테스트는 제외한다. 설정이 없으면 새 앱은 준비 안내를 표시한다.
- 실제 Google 인증/취소·익명 참여·권한·종료·독립 기기를 별도 검증한다.
- 프런트 롤백은 변경 revert와 Pages 재배포다. 서버 접근 차단은 별도 대응이며 Rules를 느슨하게 풀지 않는다. 데이터 삭제는 별도 정책을 따른다.

## 생성 재시도와 참여 여행 재진입

- createRoom은 인증 uid별 요청 ID·내용 fingerprint·트랜잭션으로 중복을 방지한다. 같은 ID의 다른 내용은 거부한다.
- 서버 요청 기록에는 ownerId/roomId/fingerprint/시각만 보관한다. 초대 token 평문을 저장하지 않아 응답 유실 후 같은 방 ID를 회수하되 token은 재반환하지 않는다. 리더가 명시적으로 링크를 재발급한다. 재발급하면 기존 링크는 폐기된다.
- `oa-next-create-v1:<uid>`는 미확인 생성 요청이다. 새로고침·재시도에 같은 ID를 쓰며 성공 응답 후 제거한다. 저장 실패 시 네트워크 요청을 보내지 않는다. 입력 오류는 수정할 수 있도록 정리하고 네트워크 실패는 보존한다.
- 서버 멱등 요청 기록에는 TTL/자동삭제를 설정하지 않았다. 방 보관·삭제 정책을 결정할 때 수명·비용을 함께 정한다.
- `oa-next-rooms-v1:<uid>`는 이 브라우저의 room ID 힌트다. 권한 근거가 아니며 본인 멤버십·방 정보를 서버에서 재확인한 것만 표시한다. 서버 확인 실패 시 캐시된 방 내용으로 대체하지 않는다.
- 다른 기기·목록 소실·잃어버린 익명 세션의 복구는 보장하지 않는다. 계정 연결 UX·충돌 처리·소유권 보존 검증은 별도 작업이다.

일반 기본값은 shared·리더 포함10명이다. individual은1C 테스트 플래그이며 신규4탭·공동 기록·사진·리더 출력·캐시는 이 통합으로 완성되지 않는다.
