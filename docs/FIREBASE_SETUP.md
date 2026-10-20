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
| Google provider | 활성 확인 | Google·익명 모두 사용 설정됨. 공개 이름 Our Adventures 및 사용자가 승인한 지원 연락처 저장 |
| GitHub Pages 인증 도메인 | 추가 완료 | 승인된 도메인 표에 `stynerk.github.io` Custom 확인 |
| 기본 인증 도메인 | 유지 | localhost, 프로젝트 firebaseapp.com/web.app |
| Firestore | 생성 완료 | Standard / `(default)` / `asia-northeast3`(서울). 생성 후 데이터 화면에서 위치 확인 |
| 사진 Storage | 미설정 | 요금제 업그레이드 요구, 결제 연결 없음 |
| SDK 앱 연결 | 미구현 | 콘솔 등록과 실제 코드 초기화를 구분 |
| 그룹 권한/데이터/사진 E2E | 미실행 | 등록·provider 활성화만으로 완료 처리 금지 |

## 승인 및 실행 기록

2026-10-20 사용자가 지원 이메일 공개와 Firestore 서울 리전 생성을 명시적으로 승인했다. 이전 자동 승인 검토의 동의 부족은 이 승인으로 해소되었으며, 승인 후 콘솔에서 두 설정을 적용했다. 개인 이메일 주소는 공개 문서에 복사하지 않는다.

- Google 및 익명 provider 모두 사용 설정됨 확인.
- Standard `(default)` 데이터베이스를 서울 `asia-northeast3`에 생성 완료.
- 게시된 초기 규칙: `allow read, write: if false;`. 모든 클라이언트 읽기/쓰기 차단. 멤버십 허용 규칙은 아직 구현하지 않았다.
- 예약 백업은 활성화하지 않았다. Spark 유지, 결제 연결/Blaze 전환 없음.
- 앱 SDK 연결, 실제 로그인 및 그룹 E2E는 미실행.

## 사진 저장 비용 검토안 — 미승인

Firebase Storage 신규 기본 버킷에는 Blaze가 필요하다. 서울 버킷에 미국 일부 리전의 Always Free를 적용해 무료라고 가정하지 않는다. 비용은 저장 용량·요청·다운로드 전송량으로 산정한다.

계산용 가정(제품 정책 아님): 그룹당 사진100장 × 장당1MiB, 10명이 전체 사진을 월1회 읽기, 90일 보관.

| 월 신규 그룹 | 정상 상태 저장량(3개월분) | 당월 신규 사진 전체를 10명이 읽는 전송량 |
|---|---|---|
| 1개 | 약0.293GiB | 약0.977GiB |
| 10개 | 약2.93GiB | 약9.77GiB |
| 100개 | 약29.3GiB | 약97.7GiB |

과거 사진 재열람·재시도·썸네일/삭제 보존본·출력 다운로드는 추가 사용량이다. 서울 지역 단가와 한국 대상 전송 단가를 공식 계산기에 반영하기 전에는 월 청구액을 확정하지 않는다. 제안: 소규모 파일럿부터 시작하고 월 예산 검토선 $5, 알림50/80/100%를 두되 이는 강제 지출 상한이 아니다. 업로드 한도·멤버십 검증·비정상 트래픽 차단도 별도 구현해야 한다. 예산·요금제·보관 기간 모두 미승인이다.

공식 근거:
- https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024
- https://cloud.google.com/storage/pricing
- https://firebase.google.com/pricing

## 이후 실행 순서

- 완료된 인증·Firestore 설정을 기준으로 SDK 초기화 및 멤버십 규칙을 코드·테스트로 구현. 초기 deny-all을 검증된 규칙으로 교체하기 전에는 앱에서 DB에 접근할 수 없음.
- 요금/사진 저장 선택 뒤 버킷·이미지 접근제어·용량·보관삭제 정책 설정.
- 기존 루트 앱·두 localStorage 키를 보존한 별도 앱에서 SDK 초기화, Google/익명 인증·초대·10명 한도·권한·사진·출력 E2E 검증.
- GitHub Pages는 기존 배포 유지. 웹 앱 등록 마법사의 Hosting/CLI 안내를 실제 배포 승인이나 배포 완료로 해석하지 않는다.
