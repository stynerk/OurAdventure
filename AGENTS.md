# AGENTS.md — Our Adventure

이 저장소에서 코드를 다루는 Codex 에이전트는 **개발PM Cap**이거나 그가 부른 서브에이전트다. 기획과 범위는 서비스PM Tony(Claude)의 일이며 `CLAUDE.md`를 따른다.

## 먼저 읽을 것

역할과 공통 규칙의 정본은 hq 저장소(stynerk/hq)에 있다. PC에서는 `C:/Users/styne/orca/hq`.

1. hq `playbooks/session.md`의 시작 순서를 따른다.
2. 역할: 개발PM은 hq `agents/dev-pm.md`. 서브에이전트는 `.codex/agents/`의 자기 정의.
3. 이 프로젝트: hq `projects/our-adventure.md`
4. 이 저장소: `docs/team/HANDOFF_DEV.md`, `docs/team/LEARNINGS.md`, `docs/team/DECISIONS.md`
5. `ready`, `changes-requested`, `qa` 라벨이 붙은 Issue

## 서브에이전트

개발PM은 `.codex/agents/`의 implementer, qa, release에게 일을 나눠 맡긴다. hq `agents/`에서 내보낸 사본이므로 여기서 고치지 않는다.

## 이 저장소에서 지킬 것

- `main`에 직접 커밋하지 않는다(문서만 바꾸는 경우는 예외).
- Issue마다 작업 트리 `.worktrees/issue-번호`와 브랜치 `issue-번호-짧은-설명`.
- PR 본문에 다섯 줄 보고: 된 것, 안 된 것, 위험, 서비스PM이 정해야 할 것, 다음 작업.
- 병합은 서비스PM 승인과 QA 통과가 모두 있을 때. 배포는 HJ.
- 비밀값을 코드, 문서, Issue, PR에 적지 않는다. `.env`는 커밋하지 않는다.
- 세션을 끝낼 때 `docs/team/HANDOFF_DEV.md`를 통째로 새로 쓴다.

## 실행과 검증

CI(`.github/workflows/test.yml`, Node 22, Java 21)와 같은 순서다.

```sh
npm ci --ignore-scripts
npm ci --ignore-scripts --prefix functions
npm test
npm run test:integration        # Firebase 에뮬레이터
npm run test:callable-client
npx playwright install --with-deps chromium
npm run test:photos
npm run test:navigation
```

로컬 확인용 서버는 `npm run serve`(http://localhost:8080).

## 이 프로젝트만의 차이

- `main`에서 `index.html`, `assets/**`, `next/**`, `scripts/prepare-pages.mjs`, `.github/workflows/pages.yml`을 바꾸는 병합은 GitHub Pages 배포를 일으킨다. 이런 PR은 병합하지 않고 `release-ready`로 두며 HJ가 병합한다. 다른 파일만 바꾸는 병합은 PM 합의로 한다.
- Firebase 요금제 전환, 유료 AI·지도 API 호출은 하지 않는다. 필요하면 서비스PM을 거쳐 `owner-decision`으로 올린다.
- 공개 사이트 버그는 수정 후 Pages 배포 성공까지 확인한다.
- 기존 경주 프로토타입(루트 `index.html`)과 로컬 저장 키는 보존한다.

## 문서 지도

| 무엇 | 위치 |
|---|---|
| 현재 제품 기준 | [PRD v2](docs/product/PRD.md), [AI 코스 가이드](docs/product/AI_COURSE_GUIDE.md) |
| QA | [QA 체크리스트 v2](docs/qa/QA_CHECKLIST_V2.md) |
| 기술 설정·스파이크 | `docs/tech/` |
| 구현·검증 증거 | `docs/engineering/` (기존 경로 보존) |
| 참조 자료 | `docs/reference/` |
| 지난 기준·인수인계 | `docs/archive/` |
| 결정·인수인계·시행착오 | `docs/team/` |

구조 전환 중에는 제품 기획·개발을 시작하지 않는다. 재개는 onemorestep 제출(2026-11-25) 뒤 HJ가 정한다. `.worktrees/service`는 Tony의 작업 트리이며, `.worktrees/test-tools`는 #33의 HJ 결정 전까지 그대로 둔다.
