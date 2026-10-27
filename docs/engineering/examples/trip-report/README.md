# 앱에서 저장한 PNG 예시

Auth/Firestore/Storage demo 에뮬레이터와 Chromium에서 실제 앱의 PNG 저장 버튼으로 다운로드한 파일이다. 테스트용 합성 풍경과 가상 별칭만 사용했다. 미리보기와 다운로드의 SHA-256 일치, 정확한 크기, PNG EXIF/text chunk 부재를 브라우저 테스트에서 확인했다. 파일별 크기·해시는 [files.json](files.json)에 있다.

| 형식 | 사진 그리드 | 도장판 |
|---|---|---|
| 피드 1080×1350 | [PNG](report-grid-feed.png) | [PNG](report-board-feed.png) |
| 스토리 1080×1920 | [PNG](report-grid-story.png) | [PNG](report-board-story.png) |

실제 이용자 사진이나 운영 데이터가 아니다. 사진 픽셀 자체의 개인정보/위치를 자동 탐지·삭제한 결과라는 뜻은 아니다.

PM 검토 반영: 한국어 문구·별칭만의 사진 캡션·하단 Our Adventure를 적용했다. 위 4종은 여행 이름 기본 꺼짐이다. [여행 이름 표시 예시](report-board-story-title.png)는 리더가 옵션을 켠 경우이며 가상 이름을 사용한다. 이 파일도 실제 다운로드와 미리보기 해시가 일치한다.
