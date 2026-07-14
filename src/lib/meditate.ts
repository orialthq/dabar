import type { VerseRef } from "../types/journal";
import type { GenerateOptions } from "./engine";
import { generate } from "./engine";
import { resolveVerse } from "./journal";

/**
 * 묵상 질문 생성 (M5b). 새김에 첨부된 구절(로컬 DB 본문)과 기록을 근거로
 * 열린 질문 2~3개를 만든다. 질문만 생성하며 구절 본문 인용은 금지 —
 * 표시가 필요한 구절은 이미 새김에 첨부되어 로컬 DB로 렌더링되고 있다.
 */

const SYSTEM_PROMPT = `너는 "다바르"의 안내자다. 사용자의 일기와 함께 제공되는 개역한글 성경 구절을 바탕으로, 스스로 묵상하도록 돕는 열린 질문을 만든다.

반드시 지켜라:
1. 질문 2~3개만 출력하라. 각 질문은 한 문장, 한 줄에 하나씩, 앞에 "- "를 붙여라. 다른 텍스트(인사, 설명, 머리말)는 출력하지 마라.
2. 성경 구절 본문을 인용하거나 재작성하지 마라. 필요하면 "(책이름 장:절)" 참조로만 언급하라.
3. 정답을 암시하는 질문이 아니라, 기록한 사람이 자기 삶과 말씀을 잇대어 생각하게 하는 질문을 만들어라.
4. 교단마다 견해가 갈리는 주제로 끌고 가지 마라. 따뜻한 존댓말을 사용하라.`;

/** LLM 출력에서 질문 줄만 추출 */
function parseQuestions(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.replace(/^[-*\d.)\s]+/, "").trim())
    .filter((l) => l.length > 5 && l.includes("?"))
    .slice(0, 3);
}

export async function meditationQuestions(
  body: string,
  verses: VerseRef[],
  opts: GenerateOptions = {}
): Promise<string[]> {
  const resolved = [];
  for (const ref of verses) {
    const r = await resolveVerse(ref);
    if (r) resolved.push(r);
  }
  const verseBlock =
    resolved.length > 0
      ? `함께 새긴 구절 (개역한글):\n${resolved.map((r) => `- (${r.label}) ${r.text}`).join("\n")}\n\n`
      : "";
  const user = `${verseBlock}오늘의 기록:\n${body.trim()}\n\n이 기록을 위한 묵상 질문을 만들어라.`;
  const text = await generate(SYSTEM_PROMPT, [{ role: "user", content: user }], {
    temperature: 0.5,
    ...opts,
  });
  const questions = parseQuestions(text);
  if (questions.length === 0) throw new Error("질문을 만들지 못했습니다. 다시 시도해 보세요.");
  return questions;
}
