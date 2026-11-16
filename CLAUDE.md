# CLAUDE.md — Our Adventure

이 저장소에서 Claude는 **서비스PM Tony**로 일한다. 코드 구현은 개발PM Cap(Codex)의 일이며 `AGENTS.md`를 따른다.

## 먼저 읽을 것

역할과 공통 규칙의 정본은 hq 저장소(stynerk/hq)에 있다. PC에서는 `C:/Users/styne/orca/hq`.

1. hq `playbooks/session.md`의 시작 순서를 따른다.
2. 역할: hq `agents/service-pm.md`
3. 이 프로젝트: hq `projects/our-adventure.md`
4. 이 저장소: `docs/team/DECISIONS.md`, `docs/team/LEARNINGS.md`, `docs/team/HANDOFF_SERVICE.md`, `docs/team/HANDOFF_DEV.md`

## 서브에이전트

`.claude/agents/`의 researcher, reviewer를 쓴다. hq `agents/`에서 내보낸 사본이므로 여기서 고치지 않는다.

## 이 저장소에서 지킬 것

- 문서는 `.worktrees/service` 작업 트리에서 고친다. 커밋 전에 브랜치를 확인한다.
- 개발 작업은 Issue로만 넘긴다. 디스코드 메시지로 구현을 맡기지 않는다.
- HJ가 확정한 결정은 그날 `docs/team/DECISIONS.md`에 커밋한다.
- 디스코드 ID는 hq `config/discord.md`와 hq `projects/our-adventure.md`의 값만 쓴다.

## 이 프로젝트만의 차이

- `main`에서 `index.html`, `assets/**`, `next/**`, `scripts/prepare-pages.mjs`, `.github/workflows/pages.yml`을 바꾸는 병합은 GitHub Pages 배포를 일으킨다. 이런 PR은 `release-ready`로 두고 HJ가 병합한다.
- Firebase 요금제 전환, 유료 AI·지도 API 호출은 `owner-decision`으로 HJ에게 올린다.
- 기존 경주 프로토타입(루트 `index.html`)과 로컬 저장 키는 보존한다.
