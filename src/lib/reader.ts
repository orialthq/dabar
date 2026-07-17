/** 읽다 개편 (v0.7.0): 읽던 자리 기억 + 본문 글자 크기 */

const LAST_KEY = "dabar:lastread:v1";
const FONT_KEY = "dabar:readerfont:v1";

export interface LastRead {
  bookId: string;
  chapter: number;
}

export function saveLastRead(pos: LastRead): void {
  localStorage.setItem(LAST_KEY, JSON.stringify(pos));
}

export function loadLastRead(): LastRead | null {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<LastRead>;
    return typeof p.bookId === "string" && typeof p.chapter === "number"
      ? { bookId: p.bookId, chapter: p.chapter }
      : null;
  } catch {
    return null;
  }
}

/** 글자 크기 3단 — 본문/절번호 클래스 짝 */
export const FONT_STEPS = [
  { label: "보통", text: "text-[17px] leading-8", num: "leading-8" },
  { label: "크게", text: "text-[19px] leading-9", num: "leading-9" },
  { label: "아주 크게", text: "text-[22px] leading-10", num: "leading-10" },
] as const;

export function loadFontStep(): number {
  const n = parseInt(localStorage.getItem(FONT_KEY) ?? "0", 10);
  return n >= 0 && n < FONT_STEPS.length ? n : 0;
}

export function saveFontStep(n: number): void {
  localStorage.setItem(FONT_KEY, String(n));
}
