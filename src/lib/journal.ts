import type { Entry, Draft, VerseRef } from "../types/journal";
import { loadBook, loadBooks } from "./bible";

const ENTRIES_KEY = "dabar:entries:v1";
const DRAFT_KEY = "dabar:draft:v1";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function loadEntries(): Entry[] {
  const entries = read<Entry[]>(ENTRIES_KEY, []);
  return [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function persist(entries: Entry[]): void {
  localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
}

export function getEntry(id: string): Entry | undefined {
  return loadEntries().find((e) => e.id === id);
}

export function saveEntry(draft: Draft, id?: string): Entry {
  const entries = loadEntries();
  const now = new Date().toISOString();
  if (id) {
    const existing = entries.find((e) => e.id === id);
    if (existing) {
      const updated: Entry = { ...existing, ...draft, updatedAt: now };
      persist(entries.map((e) => (e.id === id ? updated : e)));
      return updated;
    }
  }
  const entry: Entry = {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    ...draft,
  };
  persist([entry, ...entries]);
  return entry;
}

export function deleteEntry(id: string): void {
  persist(loadEntries().filter((e) => e.id !== id));
}

export function loadDraft(): Draft | null {
  return read<Draft | null>(DRAFT_KEY, null);
}

export function saveDraft(draft: Draft): void {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export function clearDraft(): void {
  localStorage.removeItem(DRAFT_KEY);
}

/** 구절 본문을 로컬 DB에서 해석 (원문 무변형) */
export async function resolveVerse(
  ref: VerseRef
): Promise<{ label: string; text: string } | null> {
  const [books, book] = await Promise.all([loadBooks(), loadBook(ref.bookId)]);
  const meta = books.find((b) => b.id === ref.bookId);
  const text = book.chapters[ref.chapter - 1]?.[ref.verse - 1];
  if (!meta || text === undefined) return null;
  return { label: `${meta.name} ${ref.chapter}:${ref.verse}`, text };
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

/** 전체 새김을 마크다운으로 내보내기 */
export async function exportMarkdown(entries: Entry[]): Promise<string> {
  const lines: string[] = ["# 다바르 새김", ""];
  for (const e of [...entries].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt)
  )) {
    lines.push(`## ${fmtDate(e.createdAt)}${e.title ? ` — ${e.title}` : ""}`, "");
    if (e.body.trim()) lines.push(e.body.trim(), "");
    for (const ref of e.verses) {
      const r = await resolveVerse(ref);
      if (r) lines.push(`> ${r.text}`, `> — ${r.label} (개역한글)`, "");
    }
  }
  lines.push("---", "", "성경전서 개역한글판 (대한성서공회 역, 1961)", "");
  return lines.join("\n");
}

export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
