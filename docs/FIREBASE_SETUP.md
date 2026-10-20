# Firebase setup — Our Adventures

확인일: 2026-10-20 (Asia/Seoul). 콘솔의 실제 관찰 기준이며 앱 구현·배포·E2E 통과를 뜻하지 않는다.

## 프로젝트 및 웹 앱

| 항목 | 확인 값 |
|---|---|
| 프로젝트 | Our Adventures |
| Project ID | `our-adventures-5ce50` |
| 프로젝트 번호 / messagingSenderId | `601062192289` |
| 요금제 | Spark |
| 웹 App ID | `1:601062192289:web:f2783ccb3e9d41d87cece0` |
| authDomain | `our-adventures-5ce50.firebaseapp.com` |
| SDK의 storageBucket 설정값 | `our-adventures-5ce50.firebasestorage.app` |

사용자가 열어둔 SDK 추가 화면에서 웹 앱 등록 완료와 앱1개를 확인했다. Firebase 웹 설정은 클라이언트 식별용이다. 관리자 키·서비스 계정·사용자 로그인 자격 증명을 저장하지 않는다. 이 문서에는 API 키를 복사하지 않았다. 앱 연결 시 프로젝트 설정의 해당 App ID와 SDK 구성을 사용한다.

storageBucket 문자열이 SDK에 있다는 사실은 버킷 생성/접근 가능의 증거가 아니다. 현재 Storage 화면은 요금제 업그레이드를 요구하며 버킷은 설정하지 않았다.

## 확인된 설정 및 미완료

| 영역 | 상태 | 증거/후속 |
|---|---|---|
| 웹 앱 등록 | 완료 확인 | SDK 추가 단계에 앱 등록 완료, 개요에1개 앱 |
| 익명 provider | 활성 확인 | Authentication 로그인 방법에 익명 사용 설정됨 |
| Google provider | 미설정 | 로그인 방법 목록은 익명만 존재 |
| GitHub Pages 인증 도메인 | 추가 완료 | 승인된 도메인 표에 `stynerk.github.io` Custom 확인 |
| 기본 인증 도메인 | 유지 | localhost, 프로젝트 firebaseapp.com/web.app |
| Firestore | 미생성 확인 | 데이터베이스 만들기 화면 표시 |
| 사진 Storage | 미설정 | 요금제 업그레이드 요구, 결제 연결 없음 |
| SDK 앱 연결 | 미구현 | 콘솔 등록과 실제 코드 초기화를 구분 |
| 그룹 권한/데이터/사진 E2E | 미실행 | 등록·provider 활성화만으로 완료 처리 금지 |

## 재개에 필요한 선택

1. Google OAuth 지원 연락처: 계정 이메일을 로그인 사용자에게 표시하는 동의 필요. 이전 자동 승인 검토에서 공개 연락처 선택을 거부했다. 주소는 공개 Git 문서에 기재하지 않는다.
2. Firestore 위치: Standard/(default)/서울 `asia-northeast3` 권고. 생성 후 위치 변경 불가이며 이전 자동 승인 검토에서 특정 리전 동의 부재로 거부했다. 실제 위치는 아직 정해지지 않았다.
3. 사진 저장: Firebase Storage를 선택하면 Blaze 요금제/결제 연결이 필요하다고 콘솔과 공식 문서가 안내한다. 사용량 기반 비용에 대한 승인·예산·사용량 제한은 미결정이며 임의 업그레이드하지 않는다. Firebase Storage 선택과 기존 Drive 실험 채택은 별도 결정이다.

공식 근거: https://firebase.google.com/docs/storage/web/start 및 https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024

## 이후 실행 순서

- 승인된 Google 지원 연락처로 provider 저장 후 사용 설정됨 확인.
- 승인된 리전으로 Firestore 생성. 기본 외부 읽기/쓰기 차단을 유지하고 멤버십 규칙은 코드·테스트로 별도 검증.
- 요금/사진 저장 선택 뒤 버킷·이미지 접근제어·용량·보관삭제 정책 설정.
- 기존 루트 앱·두 localStorage 키를 보존한 별도 앱에서 SDK 초기화, Google/익명 인증·초대·10명 한도·권한·사진·출력 E2E 검증.
- GitHub Pages는 기존 배포 유지. 웹 앱 등록 마법사의 Hosting/CLI 안내를 실제 배포 승인이나 배포 완료로 해석하지 않는다.
