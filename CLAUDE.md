# CLAUDE.md — dabar 작업 컨텍스트

## 프로젝트 개요
다바르(dabar): 일상을 쓰면 성경이 답하는 신앙 기록 웹앱. OriAlt(오리알트) 프로덕트.
스택: Vite + React 18 + TypeScript strict + Tailwind CSS 4. GitHub Pages 배포. 100% 클라이언트 사이드, 비용 0원.

## 절대 규칙 (Do Not)
1. **성경 구절을 LLM이 생성/암기로 출력하는 코드 금지.** 구절은 반드시 로컬 JSON DB에서 조회해 원문 그대로 렌더링한다. 요약·의역·재구성 표시 금지.
2. 본문 변형 금지(동일성유지권). 맞춤법 교정, 띄어쓰기 수정도 금지.
3. 역본은 개역한글판만. 개역개정 등 타 역본 데이터 추가 금지(라이선스 필요).
4. 백엔드/서버 의존 코드 금지. Cloud Functions, DB 서버 없음. 저장은 localStorage.
5. 사용자 API 키는 localStorage에만 저장, 외부 전송은 Anthropic/OpenAI API 호출 외 금지.
6. 마일스톤 범위를 넘는 구현 금지. 각 마일스톤 완료 시 멈추고 확인받는다.

## 컨벤션
- TypeScript strict, `any` 금지
- 컴포넌트: 함수형 + hooks, 파일당 하나, PascalCase
- 스타일: Tailwind 유틸리티 우선. 토큰은 `src/index.css`의 `@theme` 참조 (ink/hanji/dawn/mist)
- 커밋: `feat:`, `fix:`, `chore:`, `docs:` prefix, 한국어 본문 허용
- 성경 데이터 타입: `src/types/bible.ts`에 집중 (M2에서 생성)

## 디자인 토큰
ink #10151F · ink-soft #1B2230 · hanji #F7F3EA · hanji-dim #EFE9DB · dawn #D98E32 · mist #8A94A6
폰트: Noto Serif KR(디스플레이/말씀) · Pretendard(본문)
말씀 인용 블록은 항상 serif + 출처 표기(책 장:절, 개역한글).

## 배포
- `main` push → GitHub Actions → Pages 자동 배포
- vite base: `/dabar/` (커스텀 도메인 전환 시 `/` + public/CNAME)

## 마일스톤 현황
- [x] M1 스캐폴드 + 랜딩 셸 + 배포 파이프라인
- [ ] M2 개역한글 데이터 + 리더 + 검색
- [ ] M3 새김 기록 (localStorage)
- [ ] M4 AI 연결 (BYOK)
