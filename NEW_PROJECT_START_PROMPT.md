# New Project Start Prompt

OurAdventure / 가족여행-경주 프로젝트를 이어서 진행해줘.

먼저 이 repo의 PROJECT_HANDOFF.md와 PROJECT_INSTRUCTIONS.md를 읽고, GitHub connector에서 stynerk/OurAdventure의 main 브랜치 index.html과 .github/workflows/pages.yml을 확인해. 현재 실행 소스는 GitHub가 source of truth이고, stynerk/myaibuilder는 과거 배포 실수이므로 무시해.

실제 여행은 2026-10-09~10-11이고 주 사용자는 초등학교 2학년 아이야. 제품의 핵심은 “동화 지도 + 짧은 관찰 Quest + 즉시 스탬프 + 사진 기반 가족 원정기”야.

지금부터는 새 기능을 무작정 늘리기보다 실제 모바일 사이트 수준으로 완성해줘. 우선순위는:
1) iPhone/Android에서 화면 전환과 터치 영역 QA
2) 카메라 촬영/사진 저장 UX QA 및 안정화
3) Quest 실사 이미지 정확성/로딩 안정성/사용권 점검
4) Story Map을 동화책 지도 수준으로 개선
5) Stamp/Memory Book의 보상감 강화
6) 여행 직전 운영시간/휴관 최종 반영

기존 7개 Quest와 3일 스토리 구조는 유지하되, 변경이 필요하면 변경 제안이라고 명확히 표시해. 버그를 발견하면 설명만 하지 말고 코드를 고치고 OurAdventure main에 반영한 뒤 GitHub Pages 배포 성공까지 확인해.

첫 작업으로 현재 GitHub 코드를 점검해서 여행 전 P0 문제 목록을 만들고, 가장 치명적인 문제부터 바로 수정해줘.
