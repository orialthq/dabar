import type { BookMeta, BookData, SearchHit } from "../types/bible";

const BASE = import.meta.env.BASE_URL;

let booksPromise: Promise<BookMeta[]> | null = null;
const bookCache = new Map<string, Promise<BookData>>();

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}bible/${path}`);
  if (!res.ok) throw new Error(`성경 데이터를 불러오지 못했습니다: ${path}`);
  return res.json() as Promise<T>;
}

export function loadBooks(): Promise<BookMeta[]> {
  if (!booksPromise) booksPromise = fetchJson<BookMeta[]>("books.json");
  return booksPromise;
}

export function loadBook(id: string): Promise<BookData> {
  let p = bookCache.get(id);
  if (!p) {
    p = fetchJson<BookData>(`${id}.json`);
    bookCache.set(id, p);
  }
  return p;
}

const MAX_HITS = 300;

/** 전 권 키워드 검색. 최초 검색 시 전체 본문(약 4.5MB)을 받아 메모리에 캐시한다. */
export async function searchBible(
  query: string,
  onProgress?: (done: number, total: number) => void
): Promise<{ hits: SearchHit[]; truncated: boolean }> {
  const q = query.trim();
  if (!q) return { hits: [], truncated: false };
  const books = await loadBooks();
  const hits: SearchHit[] = [];
  let done = 0;
  let truncated = false;

  for (const meta of books) {
    const data = await loadBook(meta.id);
    for (let c = 0; c < data.chapters.length; c++) {
      const verses = data.chapters[c];
      for (let v = 0; v < verses.length; v++) {
        if (verses[v].includes(q)) {
          if (hits.length >= MAX_HITS) {
            truncated = true;
            break;
          }
          hits.push({ book: meta, chapter: c + 1, verse: v + 1, text: verses[v] });
        }
      }
      if (truncated) break;
    }
    done += 1;
    onProgress?.(done, books.length);
    if (truncated) break;
  }
  return { hits, truncated };
}
