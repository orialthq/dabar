# 성경 데이터 출처와 파이프라인

## 원천
- **역본**: 성경전서 개역한글판 (대한성서공회 역, 1961) — 저작재산권 보호기간 만료
- **디지털 소스**: [bluesaurel/Korean-Bible-1961-KRV](https://github.com/bluesaurel/Korean-Bible-1961-KRV)
  - BSK(대한성서공회) 공식 데이터와 1:1 전수 대조 오차율 0% 명시
  - 고어 표기(세째, 한곳, 쁄라 등) 원문 보존

## 교차 검증 (2026-07 수행)
1. 독립 소스 2종(bluesaurel, yuhwan/Bible-krv) 절 단위 전수 비교 → 8,664절 차이 발견
2. 차이 패턴 분석: yuhwan 판본은 현대 맞춤법으로 수정된 텍스트("셋째", "한 곳")
3. holybible.or.kr 개역한글(RHV) 원문 대조 → 붙여쓰기·쉼표 구두점이 bluesaurel 판본과 일치
4. bluesaurel 판본 채택. 자체 무결성 검사: 66권 / 1,189장 / 31,102절, 장·절 번호 연속성, 빈 본문 0건 — 전부 통과

## 산출 포맷 (`public/bible/`)
- `books.json`: `[{ id, name, abbr, testament: "OT"|"NT", chapters }]`
- `{id}.json`: `{ id, name, chapters: string[][] }` — `chapters[장-1][절-1]` = 절 본문
- 책 ID: 소문자 3자 코드 (gen, exo, … rev)

## 불변 조건
- 본문은 소스에서 **무변형 복사**. 트림, 맞춤법 교정, 공백 정규화 일절 금지 (동일성유지권)
- 재생성이 필요하면 소스 레포를 클론해 동일 무결성 검사(정경 장 수, 절 연속성, 총 31,102절)를 통과시킬 것
