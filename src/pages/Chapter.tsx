import { useEffect, useRef, useState } from "react";
import type { BookData, BookMeta } from "../types/bible";
import { loadBook, loadBooks } from "../lib/bible";
import { navigate } from "../lib/router";

interface Props {
  bookId: string;
  chapter: number;
  verse?: number;
}

function Chapter({ bookId, chapter, verse }: Props) {
  const [books, setBooks] = useState<BookMeta[] | null>(null);
  const [book, setBook] = useState<BookData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const highlightRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    loadBooks().then(setBooks).catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    setBook(null);
    loadBook(bookId).then(setBook).catch((e: Error) => setError(e.message));
  }, [bookId]);

  useEffect(() => {
    if (book && verse && highlightRef.current) {
      highlightRef.current.scrollIntoView({ block: "center" });
    }
  }, [book, verse]);

  if (error)
    return <p className="p-8 text-sm text-ink/70">{error} 새로고침해 주세요.</p>;
  if (!book || !books)
    return <p className="p-8 text-sm text-ink/50">말씀을 펴는 중…</p>;

  const meta = books.find((b) => b.id === bookId);
  const idx = books.findIndex((b) => b.id === bookId);
  const verses = book.chapters[chapter - 1];
  if (!meta || !verses)
    return <p className="p-8 text-sm text-ink/70">본문을 찾을 수 없습니다.</p>;

  const prev =
    chapter > 1
      ? { id: bookId, ch: chapter - 1, label: `${meta.abbr} ${chapter - 1}장` }
      : idx > 0
        ? {
            id: books[idx - 1].id,
            ch: books[idx - 1].chapters,
            label: `${books[idx - 1].abbr} ${books[idx - 1].chapters}장`,
          }
        : null;
  const next =
    chapter < meta.chapters
      ? { id: bookId, ch: chapter + 1, label: `${meta.abbr} ${chapter + 1}장` }
      : idx < books.length - 1
        ? { id: books[idx + 1].id, ch: 1, label: `${books[idx + 1].abbr} 1장` }
        : null;

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 md:py-14">
      <div className="flex items-center justify-between gap-4">
        <a href="#/read" className="text-xs text-ink/45 hover:text-dawn">
          ← 목차
        </a>
        <div className="flex items-center gap-2">
          <select
            aria-label="장 이동"
            className="text-sm bg-transparent border border-ink/20 rounded px-2 py-1"
            value={chapter}
            onChange={(e) => navigate(`/read/${bookId}/${e.target.value}`)}
          >
            {Array.from({ length: meta.chapters }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}장
              </option>
            ))}
          </select>
        </div>
      </div>

      <h1 className="mt-8 font-serif text-2xl md:text-3xl font-semibold text-center">
        {book.name} {chapter}장
      </h1>

      <ol className="mt-10 space-y-4">
        {verses.map((text, i) => {
          const n = i + 1;
          const hit = n === verse;
          return (
            <li
              key={n}
              ref={hit ? highlightRef : undefined}
              className={`flex gap-3 rounded-md ${hit ? "bg-dawn/15 -mx-3 px-3 py-2" : ""}`}
            >
              <span className="shrink-0 w-6 text-right text-[11px] leading-7 text-dawn/80 select-none">
                {n}
              </span>
              <p className="font-serif text-[17px] leading-7">{text}</p>
            </li>
          );
        })}
      </ol>

      <nav className="mt-14 flex items-center justify-between text-sm">
        {prev ? (
          <a href={`#/read/${prev.id}/${prev.ch}`} className="text-ink/60 hover:text-dawn">
            ← {prev.label}
          </a>
        ) : (
          <span />
        )}
        {next ? (
          <a href={`#/read/${next.id}/${next.ch}`} className="text-ink/60 hover:text-dawn">
            {next.label} →
          </a>
        ) : (
          <span />
        )}
      </nav>

      <p className="mt-12 text-center text-[11px] text-ink/35">
        성경전서 개역한글판 (대한성서공회 역, 1961)
      </p>
    </div>
  );
}

export default Chapter;
