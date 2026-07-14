# CLAUDE.md — dabar 작업 컨텍스트

## 프로젝트 개요
다바르(dabar): 일상을 쓰면 성경이 답하는 신앙 기록 웹앱. OriAlt(오리알트) 프로덕트.
스택: Vite + React 18 + TypeScript strict + Tailwind CSS 4. GitHub Pages 배포(`orialthq.github.io/dabar`). 100% 클라이언트 사이드, 비용 0원, 서버 없음.

네 가지 동사 = 제품 전체: **읽다**(개역한글 리더) · **찾다**(키워드 검색) · **묻다**(대화) · **새기다**(신앙 저널, 킬러 기능).

## 절대 규칙 (Do Not)
1. **성경 구절 본문을 LLM이 생성하거나 LLM 출력에서 복사해 표시하는 코드 금지.** 구절은 반드시 `public/bible/` 로컬 DB에서 조회해 원문 그대로 렌더링. LLM/검색은 참조(bookId, 장, 절)만 공급한다.
2. 본문 무변형(동일성유지권). 트림·맞춤법 교정·공백 정규화 금지. "세째", "한곳" 등 1961년 표기는 원문이다.
3. 역본은 개역한글판만. 타 역본 데이터 추가 금지(라이선스 필요).
4. 백엔드/서버/DB 서버 의존 코드 금지. 저장은 localStorage. 외부 네트워크 호출은 (a) 모델/임베딩 파일 다운로드 (b) 사용자가 설정에서 명시 선택한 엔진 호출, 이 둘뿐.
5. 교단 중립. 구원론·은사·종말론 등 갈리는 주제에서 특정 입장 단정 금지, 스스로 상고하도록 유도.
6. 마일스톤 범위를 넘는 구현 금지. 각 마일스톤 완료 시 멈추고 확인받는다.

## 아키텍처 요점
- 성경 데이터: `public/bible/books.json` + `{id}.json` (66권, 31,102절, 무결성 검증 완료 — 출처와 검증 과정은 `scripts/DATA.md`)
- 라우팅: 해시 기반 (`src/lib/router.ts`) — #/read, #/search, #/ask, #/write, #/settings (전부 구현됨)
- 새김: 참조만 저장(본문 저장 금지), 렌더 시 DB 해석 (`src/lib/journal.ts`)
- AI(M5): 말씀 추천 = **주제 앵커 하이브리드**(주제 분류 → 큐레이션 `scripts/themes.json` + 전 절 시맨틱 "발견" 슬롯 — 순수 dense는 골든셋 0/10 실측으로 기각, SPEC-M5 §5), 챗 = 엔진 추상화 `src/lib/engine.ts`(webllm Qwen3-4B 기본 / ollama / anthropic BYOK). 상세는 `SPEC-M5.md`
- 참조 검증(`src/lib/ask.ts resolveRefs`): AI 참조 → 공급 목록 화이트리스트 + DB 대조 → 무효 폐기. 역전 RAG(검색이 절 공급, LLM은 그 안에서만)와 함께 챗 레이어의 불변 구조

## 컨벤션
- TypeScript strict, `any` 금지. 컴포넌트 함수형+hooks, 파일당 하나, PascalCase
- Tailwind 유틸리티 우선. 토큰: ink #10151F · ink-soft #1B2230 · hanji #F7F3EA · hanji-dim #EFE9DB · dawn #D98E32 · mist #8A94A6
- 폰트: Noto Serif KR(말씀·디스플레이) · Pretendard(본문). 말씀 인용 블록은 serif + 출처 표기 "(책 장:절, 개역한글)"
- 커밋: `feat:`/`fix:`/`chore:`/`docs:` prefix, 한국어 본문 허용
- 검증: 빌드(`npm run build`) 통과 + SPEC-M5 §3 검증 기준 충족 후 마일스톤 종료

## 배포
- `main` push → GitHub Actions → GitHub Pages. vite base `/dabar/` (커스텀 도메인 전환 시 `/` + public/CNAME)
- 대용량 파일: 임베딩 샤드·모델은 GitHub 파일 100MB 제한 미만 유지. 모델 자체는 HuggingFace CDN에서 로드(리포에 넣지 않음)

## 마일스톤 현황
- [x] M1 스캐폴드 + 랜딩 + 배포 파이프라인
- [x] M2 개역한글 데이터 + 리더 + 검색
- [x] M3 새기다 — 기록 + 말씀 첨부 + 타임라인 + 마크다운 내보내기
- [x] M4 AI 연결 (BYOK) — 말씀 추천 + 묻다, 참조 전용 RAG
- [x] M5a 하이브리드 말씀 추천 (로컬, 전 사용자) — 주제 앵커 + 큐레이션 + 발견 슬롯, 골든셋 9/10
- [x] M5b WebLLM 챗 레이어 + 엔진 추상화 — 역전 RAG 묻다 + 묵상 질문, Qwen3-4B 기본
