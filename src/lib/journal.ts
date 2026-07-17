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

// ---- JSON 백업·가져오기 (M7③) ----

interface BackupFile {
  app: "dabar";
  format: 1;
  exportedAt: string;
  entries: Entry[];
}

/** 새김 전체를 복원 가능한 JSON으로 직렬화 */
export function exportBackup(entries: Entry[]): string {
  const backup: BackupFile = {
    app: "dabar",
    format: 1,
    exportedAt: new Date().toISOString(),
    entries,
  };
  return JSON.stringify(backup, null, 2);
}

function isValidEntry(e: unknown): e is Entry {
  if (typeof e !== "object" || e === null) return false;
  const o = e as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.createdAt === "string" &&
    typeof o.updatedAt === "string" &&
    typeof o.title === "string" &&
    typeof o.body === "string" &&
    Array.isArray(o.verses) &&
    o.verses.every(
      (v) =>
        typeof v === "object" &&
        v !== null &&
        typeof (v as VerseRef).bookId === "string" &&
        typeof (v as VerseRef).chapter === "number" &&
        typeof (v as VerseRef).verse === "number"
    )
  );
}

export interface ImportResult {
  added: number;
  updated: number;
  kept: number;
}

/**
 * 백업 JSON을 현재 새김과 병합. id 기준 — 없으면 추가, 있으면 updatedAt이 최신인 쪽 유지.
 * 형식이 아니면 예외를 던진다 (기존 새김은 건드리지 않음).
 */
export function importBackup(text: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("JSON 파일이 아닙니다.");
  }
  const b = parsed as Partial<BackupFile>;
  if (b.app !== "dabar" || !Array.isArray(b.entries)) {
    throw new Error("다바르 백업 파일이 아닙니다.");
  }
  const incoming = b.entries.filter(isValidEntry);
  if (incoming.length !== b.entries.length) {
    throw new Error("백업 안에 손상된 새김이 있어 중단했습니다. 파일을 확인해 주세요.");
  }
  const current = new Map(loadEntries().map((e) => [e.id, e]));
  const result: ImportResult = { added: 0, updated: 0, kept: 0 };
  for (const e of incoming) {
    const mine = current.get(e.id);
    if (!mine) {
      current.set(e.id, e);
      result.added++;
    } else if (e.updatedAt > mine.updatedAt) {
      current.set(e.id, e);
      result.updated++;
    } else {
      result.kept++;
    }
  }
  persist([...current.values()].sort((a, b2) => b2.createdAt.localeCompare(a.createdAt)));
  return result;
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
