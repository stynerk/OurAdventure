# Firebase 연결 / 실행 / 롤백

2026-10-20 · 인증·참여 기반,1A 공유 기록/출력 미구현 · 실제 프로젝트 연결 및 운영 배포 미실행

## 로컬 준비

Node 22, Java 21 및 npm이 필요하다.

```bash
npm ci --ignore-scripts
npm ci --ignore-scripts --prefix functions
npm test
npm run test:integration
```

SDK 종단 테스트는 실제 계정 대신 demo Auth 자격 증명을 사용한다.

```bash
npm run test:client
npx playwright install chromium --only-shell
npm run test:browser
```

표준 Functions emulator가 Unix socket `EPERM`으로 동작하지 않는 제한 환경에서는 `npm run test:callable-http`를 사용한다. 동일한 exported callable handler를 로컬 HTTP 서버에서 실행하고 실제 Auth/Firestore emulator와 연결한다. 이는 표준 Functions emulator 또는 운영 배포 검증을 대신하지 않으며 결과를 구분해서 보고한다.

브라우저 테스트는 로컬 8080 포트를 사용하고, 기존 `next/firebase-config.js`가 있으면 덮어쓰지 않고 중단한다. 새 demo 설정을 만들고 테스트 종료 시 삭제한다. 필요하면 설치된 Chromium 실행 파일을 `PLAYWRIGHT_CHROMIUM_EXECUTABLE`로 지정한다. 실제 운영 키/계정은 테스트에 사용하지 않는다.

수동 로컬 실행:

```bash
cp next/firebase-config.example.js next/firebase-config.js
# demo-our-adventure, demo-key 등 demo 설정 + useEmulators=true로 편집
npx firebase emulators:start --project demo-our-adventure --only auth,firestore,functions
# 별도 터미널
npm run serve
```

http://localhost:8080/next/ 로 접속한다. 해시 URL이므로 Pages에서도 동일 경로를 사용한다. 루트 가족 앱의 localStorage는 새 코드에서 읽거나 쓰지 않는다.

## 실제 Firebase 프로젝트 연결 (미실행)

1. 대상 프로젝트/과금 계정 확인. callable Functions 사용 조건과 예산을 확인한다. 이 저장소에는 실제 프로젝트 ID가 없다.
2. Firestore 생성 및 위치 선택. 함수 기본 리전은 `asia-northeast3`이므로 DB 위치와 함께 검토한다.
3. Auth Google + Anonymous 활성화, Google 지원 이메일과 허용 도메인 `stynerk.github.io` 설정.
4. 웹 앱을 등록하고 공개 web config(apiKey, authDomain, projectId, appId)를 얻는다. 서비스 계정 JSON은 저장소·Pages·브라우저에 넣지 않는다.
5. Console 접근권한이 있는 환경에서 CLI 로그인 후 대상 ID를 명시하여 배포한다. 아래 명령은 안내이며 이 작업에서는 실행하지 않았다.

```bash
firebase deploy --project YOUR_PROJECT --only firestore:rules,functions
```

6. 로컬 확인은 ignored `next/firebase-config.js`에 공개 설정을 넣고 `useEmulators=false`로 한다.
7. GitHub repository variable `FIREBASE_WEB_CONFIG`에 공개 config JSON을 넣는다. Pages workflow는 이 값으로 운영 설정을 생성한다. 설정이 비어 있으면 새 경로는 준비 안내만 표시하고 기존 앱은 유지된다.
8. Rules와 함수의 배포 버전, Google 실제 로그인, 익명 세션, 관리 권한, closed-room 차단을 확인한다. 코드의 현재 App Check/속도 제한/보관 정책 공백은 ARCHITECTURE.md 참고. 공유 글/사진 및 리더 출력도 미구현이므로 이 안내는 출시 승인이나 즉시 공개 배포 지시가 아니다.
9. 개발 PR을 검토·병합한 뒤 Pages deployment 결과와 실제 `/next/` URL을 확인한다. 브랜치 push/PR 생성은 운영 배포가 아니다.

## 공개 파일 패키징

`node scripts/prepare-pages.mjs`는 root index + assets + next 실행 파일만 `public/`에 넣는다. 서버 함수/문서/테스트/node_modules/개발 config를 복사하지 않는다. 공개 설정은 환경 변수에서 지정한 4개 필드만 생성한다. 기존 workflow의 전체 저장소 업로드를 교체했다.

## 롤백

- 신규 프런트 문제: 해당 PR의 Pages 관련 변경을 revert 후 main Pages 배포. root 앱 내용과 기존 로컬 기록은 변경되지 않았다.
- Firebase 문제: 우선 참여 링크 공유와 새 앱 진입을 중단한다. 이미 공개된 정적 프런트 롤백만으로 함수 접근이 차단되지는 않는다. 함수 비활성화/직전 버전 재배포 또는 대상 방 close 등 서버 대응이 별도로 필요하다.
- Rules를 느슨하게 만들어 임시 복구하지 않는다. 이전 검증 버전으로 되돌린다.
- 데이터 삭제·익명 계정 정리는 별도 보관 정책 확정 후 수행한다. 이번 작업에서 실제 사용자 데이터 조작은 하지 않았다.

## 개인 모드 후속 파일럿

운영 기본값은 shared이며 방장 포함10명으로 제한한다. individual은1C용으로 남겨두되 기본 비활성화했다. 제한된 개발 환경에서만 서버 `ENABLE_INDIVIDUAL_PILOT=true`와 프런트 `enableIndividualPilot=true`를 함께 설정한다. 테스트용 HTTP runner는 이를 명시적으로 활성화한다. 30명용 설정이나 그룹 사진 저장은 아직 구현하지 않았다.
