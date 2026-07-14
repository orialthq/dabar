import type { VerseRef } from "../types/journal";
import type { ChatMessage, GenerateOptions } from "./engine";
import { generate } from "./engine";
import { loadBooks } from "./bible";
import { resolveVerse } from "./journal";
import { retrieveForAsk } from "./semantic";

/**
 * 역전 RAG (M5b, SPEC-M5).
 * LLM에게 성경 참조를 묻지 않는다. 임베딩 검색이 관련 절(참조+본문)을 공급하고,
 * LLM은 공급된 절 안에서만 근거를 골라 답한다. 답변에 인용된 참조는
 * 공급 목록 화이트리스트 + 로컬 DB 대조를 통과한 것만 렌더링한다 (resolveRefs).
 */

export interface SuppliedVerse {
  ref: VerseRef;
  label: string; // "시편 23:1"
  text: string;
}

const SYSTEM_PROMPT = `너는 "다바르"의 안내자다. 사용자가 일상과 신앙에 대해 물으면, 함께 제공되는 개역한글 성경 구절 목록 안에서만 근거를 골라 따뜻한 존댓말로 답한다.

반드시 지켜라:
1. 성경 구절 본문을 그대로 인용하거나 재작성하지 마라. 구절을 언급할 때는 반드시 "(책이름 장:절)" 형태의 참조로만 표기하라. 예: (시편 23:1)
2. 제공된 구절 목록에 없는 성경 참조를 만들어내지 마라.
3. 교단마다 견해가 갈리는 주제(구원론·은사·종말론 등)에서는 특정 입장을 단정하지 말고, 관련 구절을 참조로 안내하며 스스로 상고하도록 권하라.
4. 정답을 선언하기보다 질문자가 말씀 앞에서 스스로 생각하도록 돕는 어조를 유지하라.
5. 답변은 간결하게, 3~6문장 정도로.`;

/** 질문과 관련된 절을 임베딩 검색으로 수집해 본문까지 해석 */
export async function buildContext(question: string): Promise<SuppliedVerse[]> {
  const refs = await retrieveForAsk(question);
  const out: SuppliedVerse[] = [];
  for (const ref of refs) {
    const r = await resolveVerse(ref);
    if (r) out.push({ ref, label: r.label, text: r.text });
  }
  return out;
}

function contextBlock(supplied: SuppliedVerse[]): string {
  return supplied.map((s) => `- (${s.label}) ${s.text}`).join("\n");
}

export interface AskTurn {
  question: string;
  answer: string;
  refs: VerseRef[]; // 검증 통과한 인용 참조
}

/**
 * LLM 답변에서 "(책이름 장:절)" 참조를 추출해 이중 검증:
 * ① 공급 목록(화이트리스트)에 있는가 ② 로컬 DB에 실존하는가. 실패한 참조는 폐기.
 */
export async function resolveRefs(
  answer: string,
  supplied: SuppliedVerse[]
): Promise<VerseRef[]> {
  const books = await loadBooks();
  const byName = new Map<string, string>();
  for (const b of books) {
    byName.set(b.name, b.id);
    byName.set(b.abbr, b.id);
  }
  const found: VerseRef[] = [];
  const seen = new Set<string>();
  const re = /([가-힣]+)\s*(\d+)\s*:\s*(\d+)/g;
  for (const m of answer.matchAll(re)) {
    const bookId = byName.get(m[1]);
    if (!bookId) continue;
    const ref: VerseRef = { bookId, chapter: parseInt(m[2], 10), verse: parseInt(m[3], 10) };
    const key = `${ref.bookId}:${ref.chapter}:${ref.verse}`;
    if (seen.has(key)) continue;
    // 화이트리스트: 공급된 절만 인정 (모델이 지어낸 참조 차단)
    if (!supplied.some((s) => s.ref.bookId === ref.bookId && s.ref.chapter === ref.chapter && s.ref.verse === ref.verse))
      continue;
    if (!(await resolveVerse(ref))) continue; // DB 실존 재확인
    seen.add(key);
    found.push(ref);
  }
  return found;
}

/** 한 턴 질문. history는 직전 대화(참조 블록 없이 답변 텍스트만). */
export async function ask(
  question: string,
  history: ChatMessage[],
  supplied: SuppliedVerse[],
  opts: GenerateOptions = {}
): Promise<AskTurn> {
  const user = `참고 구절 (개역한글):
${contextBlock(supplied)}

질문: ${question}`;
  const answer = await generate(SYSTEM_PROMPT, [...history, { role: "user", content: user }], opts);
  const refs = await resolveRefs(answer, supplied);
  return { question, answer, refs };
}
