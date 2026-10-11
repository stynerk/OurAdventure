# 가족 Drive 사진 연결 실험

2026-10-03. 기존 여행 앱을 변경하지 않고 두 부모 계정 사이의 업로드/조회 가능성을 먼저 검증한다.

## 준비

1. Google Cloud 프로젝트를 만들거나 선택한다. Google Drive API와 Google Picker API를 활성화한다.
2. Google Auth Platform에서 앱을 설정하고, 테스트 중이면 부모 두 계정을 테스트 사용자로 등록한다. Drive 권한은 `https://www.googleapis.com/auth/drive.file`을 사용한다.
3. OAuth 웹 애플리케이션 Client ID를 만든다. Authorized JavaScript origins에는 테스트 페이지를 제공하는 정확한 origin을 등록한다. 예: `http://localhost:8080` 또는 `https://stynerk.github.io`. 경로는 넣지 않는다.
4. Picker용 API key를 만들고 실제 테스트 origin의 HTTP referrer 및 필요한 API로 제한한다. Google Cloud 프로젝트 **번호**를 확인한다. 프로젝트 ID 문자열과 다르다.
5. 테스트용 Drive 폴더를 만들고 부모 두 계정에 편집 권한을 준다. 공개 링크 공유는 사용하지 않는다.
6. `drive-pilot.html`을 HTTP로 제공하고 Client ID, API key, 프로젝트 번호를 입력한다. Client Secret, 비밀번호, access/refresh token은 입력하거나 공유하지 않는다.

## 로컬 실행

저장소 루트에서 `python -m http.server 8080`을 실행하고 `http://localhost:8080/experiments/drive-pilot.html`을 연다. 다른 휴대폰이나 다른 도메인에서 테스트하려면 그 실제 origin의 HTTPS 호스팅과 OAuth 설정이 필요하다. 현재 main 앱에는 배포되지 않았다.

## 테스트

- A 계정: Drive 연결 → Picker로 가족 폴더 선택 → 사진 선택 → 압축 용량 확인 → 업로드. 실제 Drive 파일을 확인한다.
- B 계정: 같은 Cloud 앱, 같은 공유 폴더를 Picker로 선택 → 앱이 볼 수 있는 사진 목록 확인 → A의 사진 표시 여부 기록.
- B의 사진을 올리고 A에서도 같은 테스트를 수행한다.
- 다른 계정의 사진이 자동 조회되지 않으면 '다른 가족 사진 직접 선택'으로 개별 파일 접근을 허용해 조회한다. 이 경우 자동 가족 앨범 가설은 실패한 것으로 기록한다. `drive.file`을 전체 Drive 권한으로 자동 확장하지 않는다.
- 편집 권한 없는 폴더, 취소한 팝업, 만료 토큰, 끊긴 네트워크에서 완료로 잘못 표시되지 않는지 확인한다.
- iPhone Safari / Android Chrome에서 카메라 사진과 HEIC 선택의 변환 가능성을 확인한다. 브라우저가 읽지 못하는 파일은 오류가 표시된다.

## 합격 기준

두 계정의 사진이 개별 파일 재선택 없이 자동 조회되며, 업로드 완료로 표시된 모든 사진이 실제 Drive에 존재해야 한다. 실패 시 대표 부모 계정의 서버 중계 방식 또는 별도 저장소를 재검토한다. 이 실험 결과 없이 가족 사진 공유 완료라고 보고하지 않는다.

## 구현 범위 및 한계

- 사진 긴 변 1,600px, JPEG 압축. 700KB 목표, 1MB 초과 시 업로드 거절. 휴대폰 원본은 변경하지 않는다.
- Drive OAuth 토큰은 메모리에만 보관하고 만료되면 다시 연결한다. Google OAuth 동의가 앱의 가족 로그인/멤버십을 대신하지 않는다.
- 성공 응답 이후에만 저장 완료 표시. 테스트 페이지에는 IndexedDB 대기열이 없으며 새로고침하면 업로드 전 사진을 잃는다. 여행 앱 통합 전에 반드시 별도 구현한다.
- 업로드 자동 재시도는 없다. 통신 실패 직후에는 Drive 파일 생성 여부를 확인하고 수동으로 재시도한다. 응답 유실 시 중복 파일 생성 가능성은 후속 고유 ID/조회 설계 대상이다.
- 가족 그룹, 스탬프 동기화, 기존 사진 마이그레이션, 대표 사진 교체/삭제는 아직 통합하지 않았다.
- 문법 검사 통과. 실제 OAuth, 업로드, 두 계정 조회, 실기기 테스트는 Cloud 설정값이 없어 미실행.

## 배포 시 주의

현재 Pages workflow는 index.html 및 workflow 변경만 감지한다. 이 테스트나 assets 추가만으로 배포되지 않는다. 공개 배포가 필요하면 main 통합 후 workflow_dispatch를 실행하거나 paths에 experiments/**를 추가한다.

## 공식 참고

- https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- https://developers.google.com/workspace/drive/picker/guides/web-picker
- https://developers.google.com/identity/oauth2/web/guides/use-token-model
- https://developers.google.com/workspace/drive/api/guides/folder
