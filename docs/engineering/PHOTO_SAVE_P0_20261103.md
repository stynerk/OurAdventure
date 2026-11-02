# P0 사진 저장 장애 조사와 복구 승인안

## 현재 판정

운영 Storage 서비스 계정에 `roles/firebaserules.firestoreServiceAgent` 역할이 없다. 현재 Storage 규칙은 `firestore.exists/get`으로 그룹 멤버와 진행 중 여행을 확인하므로 이 연결 권한이 없으면 정상 멤버도 Storage 요청이 거부될 수 있다. **누락 자체는 운영 IAM 조회로 확인했다. 사용자의 동일 로그인·동일 사진 요청을 직접 추적한 것은 아니며, 실기기 성공은 아직 확인하지 않았다.**

요청은 첫 업로드 전에 `getMetadata`를 실행한다. 여기서 권한 거부가 나면 업로드 바이트·`finalizePhoto`·Firestore 스탬프 저장까지 도달하지 않는다. 기존 화면은 업로드/확정 실패를 같은 문구로 표시해 이 구분이 보이지 않았다.

## 운영 읽기 전용 확인

2026-11-03 KST 조사. 사용자 사진·본문·토큰·실제 사용자 ID는 수집하거나 문서에 넣지 않았다.

| 확인 | 결과 | 의미 |
|---|---|---|
| `finalizePhoto`, `createTrip` | ACTIVE, 2026-11-01T02:10:05Z 갱신 | Functions가 모두 10월 29일 버전이라는 전제는 틀림 |
| Storage 규칙 | 10월 29일 배포본과 현재 파일 해시 일치 | 경로는 `groups/{g}/trips/{t}/uploads/{uid}/{photo}`, 서버·클라이언트와 일치 |
| Storage 서비스 계정 IAM | `roles/firebasestorage.serviceAgent`만 있음. Firestore 교차 서비스 역할 없음 | 우선 복구할 운영 설정 결함 |
| 버킷 사진 읽기 CORS | 앱 origin, GET/HEAD 허용 | 인증된 사진 다운로드용 설정 유지 |
| 실제 Firebase 업로드 API OPTIONS | HTTP 200, POST와 필요한 요청 헤더 허용 | 버킷 CORS에 POST를 임의 추가할 근거 없음 |
| ERROR 로그 | 첫 조회는 빈 목록, 후속 조회는 Logging API 500 | 로그 부재를 성공으로 간주하지 않음. 사용자 실패 요청과 상관관계 미확인 |
| 파일 제한 | JPEG/PNG/WebP, 0 초과 5MiB 이하. 클라이언트·서버·규칙 일치 | HEIC·과대 파일은 지원 밖. 이 검증은 업로드 시도 전이며, 사용자의 실제 원본 형식/크기는 캡처만으로 확인 불가 |

## PR 변경

- 화면에서 사진 업로드 실패 / 서버 확정 실패 / 기기 임시 저장 실패를 구분한다. 권한 거부·연결 시간 초과·저장소 한도를 안전한 고정 문구로 알리며 원시 오류의 경로·토큰은 표시하지 않는다.
- 같은 오류가 상단 공통 배너에 전파될 때도 정리된 문구만 전달한다. 사진 폼 아래 안내만 바꾸고 SDK의 객체 경로가 상단에 남는 경우도 브라우저 테스트로 차단한다.
- 실패한 사진과 느낌·요청 ID를 유지한다. 응답 유실은 이미 저장됐을 수 있다고 안내하며 같은 요청으로 확인한다. 오류 안내를 위해 새 사진/스탬프를 낙관적으로 만들지 않는다.
- 읽기 전용 `scripts/check-photo-production.mjs --project our-adventures-5ce50`을 추가한다. 실제 배포 규칙의 Firestore 사용과 운영 IAM을 함께 검사한다. IAM·규칙·결제·데이터를 바꾸지 않는다. 현재 운영에서는 역할 검사만 실패하며 정상 동작이다.
- 에뮬레이터는 Google IAM을 검증하지 못한다. 운영 사전 점검 없이 에뮬레이터 통과만으로 출시 판정한 것이 기존 QA의 공백이다.
- 브라우저 회귀에 Storage 메타데이터 403 → 확정 요청 없음 → 사진·느낌 보존 → 같은 요청 재시도 → 실제 에뮬레이터 업로드/확정/스탬프/추억 노출을 추가한다.

## 승인 후 실행할 복구

**이 PR은 머지·배포·IAM 변경을 실행하지 않는다.** PM 인계에서 해당 작업은 사용자 확인을 요구했으므로, 다음 구체적 변경의 승인이 필요하다.

1. 프로젝트 `our-adventures-5ce50`의 Firebase Storage 서비스 계정 **하나**에 `roles/firebaserules.firestoreServiceAgent` 역할을 추가한다. 사용자·앱 클라이언트 권한, 공개 읽기/쓰기, Storage/Firestore 규칙을 넓히지 않는다. 결제·키 추가는 필요하지 않다.
2. 읽기 전용 운영 사전 점검이 모두 통과하는지 확인한다. IAM 반영 시간을 감안해 재조회한다.
3. PR을 머지해 웹 오류 안내를 배포한다. 이 변경에는 Functions/Rules 배포가 필요하지 않다. 배포된 커밋·Pages 결과를 기록한다.
4. 기존 실패 사진을 **같은 요청으로 재시도**한다. 실제 iOS 또는 Android에서 저장 → 본인 스탬프 완료 → 추억 피드 사진 표시를 확인하고 성공 화면을 남긴다. 원본 사진을 지우거나 새 요청으로 반복 생성하지 않는다.
5. 계속 실패하면 새 화면의 실패 단계·코드와 발생 시각으로 사용자 허락하에 해당 요청의 운영 로그를 대조한다. 실제 성공 전 P0 종료로 표시하지 않는다.

### 승인 범위용 명령 예시 (실행 안 함)

```powershell
gcloud projects add-iam-policy-binding our-adventures-5ce50 --member="serviceAccount:service-601062192289@gcp-sa-firebasestorage.iam.gserviceaccount.com" --role="roles/firebaserules.firestoreServiceAgent" --condition=None
```

기존 IAM 정책 전체를 덮어쓰지 않고 해당 바인딩만 추가한다. 복구 후 운영 확인 없이 역할을 제거하면 다시 사진 접근이 막힐 수 있다.

## 검증·증거

- 단위 테스트 55개 통과. 누락/정상/다른 서비스 계정/조건부 역할의 사전 점검, 단계별 안내, 업로드 권한 거부 시 확정 미호출·동일 요청 재시도 포함.
- 운영 사전 점검: 교차 서비스 역할 ❌, 사진 읽기 CORS ✅, 확정 함수 ACTIVE ✅. 운영 IAM 변경은 아직 안 함.
- 서버·Storage 통합 55개(그룹 30, Storage 12, 기존 규칙 13), SDK·사진/스탬프/추억·리포트 PNG 및 30개 화면 회귀 통과. 신규 브라우저 실패 단계/재시도 검증 포함. 상단 오류 배너의 원시 경로 차단 수정 후 실제 SDK·그룹/사진/스탬프/추억 브라우저 최종 재검증도 통과했다.
- CI에 `npm run test:photos`를 추가해 Storage·사진 업로드 브라우저까지 실행한다. 운영 IAM은 에뮬레이터로 검증되지 않으므로 실제 배포 전 읽기 전용 사전 점검을 별도로 실행해야 한다. 에뮬레이터 캡처를 운영 성공 캡처로 사용하지 않는다.
- **남음:** 운영 권한 복구 승인, 머지·웹 배포 승인, 실제 휴대폰 성공 확인과 성공 화면. 이번 수정의 배포 커밋은 아직 없다.

캡처는 모두 합성 사진을 사용한 **에뮬레이터** 화면이다.

- [업로드 권한 거부](evidence/photo-p0/p0-photo-upload-permission-failure-390.png)
- [서버 확정 실패](evidence/photo-p0/p0-photo-confirmation-failure-390.png)
- [재시도 후 스탬프 완료](evidence/photo-p0/photo-complete-mobile.png)

참고: [Firebase 교차 서비스 규칙 권한](https://firebase.google.com/docs/rules/manage-deploy#manage_permissions_for_cross-service), [Storage 웹 오류 코드](https://firebase.google.com/docs/storage/web/handle-errors).
