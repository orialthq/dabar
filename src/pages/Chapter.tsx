import { useEffect, useRef, useState } from "react";
import type { BookData, BookMeta } from "../types/bible";
import { loadBook, loadBooks } from "../lib/bible";
import { navigate } from "../lib/router";
import { loadDraft, saveDraft } from "../lib/journal";
import { FONT_STEPS, loadFontStep, saveFontStep, saveLastRead } from "../lib/reader";
import { shareVerseCard } from "../lib/card";

interface Props {
  bookId: string;
  chapter: number;
  verse?: number;
}

function Chapter({ bookId, chapter, verse }: Props) {
  const [books, setBooks] = useState<BookMeta[] | null>(null);
  const [book, setBook] = useState<BookData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fontStep, setFontStep] = useState(loadFontStep);
  const [selected, setSelected] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const highlightRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    loadBooks().then(setBooks).catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    setBook(null);
    setSelected(null);
    loadBook(bookId).then(setBook).catch((e: Error) => setError(e.message));
  }, [bookId]);

  // 읽던 자리 기억 (이어 읽기)
  useEffect(() => {
    saveLastRead({ bookId, chapter });
    setSelected(null);
  }, [bookId, chapter]);

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

  const font = FONT_STEPS[fontStep];

  const cycleFont = () => {
    const n = (fontStep + 1) % FONT_STEPS.length;
    setFontStep(n);
    saveFontStep(n);
  };

  /** 이 절을 품고 새 새김 열기 — 쓰던 초안이 있으면 거기에 담는다 */
  const keepVerse = (n: number) => {
    const draft = loadDraft() ?? { title: "", body: "", verses: [] };
    if (
      !draft.verses.some(
        (v) => v.bookId === bookId && v.chapter === chapter && v.verse === n
      )
    ) {
      draft.verses = [...draft.verses, { bookId, chapter, verse: n }];
    }
    saveDraft(draft);
    navigate("/write/new");
  };

  const copyVerse = async (n: number) => {
    try {
      await navigator.clipboard.writeText(
        `${verses[n - 1]} (${meta.name} ${chapter}:${n}, 개역한글)`
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 클립보드 미지원 — 조용히 무시 */
    }
  };

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
          <button
            onClick={cycleFont}
            aria-label="글자 크기"
            title={`글자 크기: ${font.label}`}
            className="text-sm border border-ink/20 rounded px-2 py-1 text-ink/60 hover:border-dawn hover:text-dawn transition-colors"
          >
            가<span className="text-[10px] align-top">{fontStep + 1}</span>
          </button>
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
      <div
        aria-hidden="true"
        className="mt-4 mx-auto w-24 border-t-[3px] border-double border-ink/25"
      />

      <ol className="mt-10 space-y-4">
        {verses.map((text, i) => {
          const n = i + 1;
          const hit = n === verse;
          const isSel = n === selected;
          return (
            <li
              key={n}
              ref={hit ? highlightRef : undefined}
              className={`rounded-md ${hit ? "bg-dawn/15 -mx-3 px-3 py-2" : ""} ${
                isSel ? "bg-hanji-dim -mx-3 px-3 py-2" : ""
              }`}
            >
              <button
                onClick={() => setSelected(isSel ? null : n)}
                className="flex gap-3 w-full text-left"
                aria-label={`${n}절 선택`}
              >
                <span
                  className={`shrink-0 w-6 text-right text-[11px] ${font.num} text-dawn/80 select-none`}
                >
                  {n}
                </span>
                <p className={`font-serif ${font.text}`}>{text}</p>
              </button>
              {isSel && (
                <div className="mt-2 ml-9 flex items-center gap-4 text-sm">
                  <button
                    onClick={() => keepVerse(n)}
                    className="text-dawn hover:brightness-110"
                  >
                    ✦ 새김에 담기
                  </button>
                  <button
                    onClick={() => void copyVerse(n)}
                    className="text-ink/50 hover:text-ink"
                  >
                    {copied ? "복사했습니다" : "복사"}
                  </button>
                  <button
                    onClick={() =>
                      void shareVerseCard(
                        verses[n - 1],
                        `${meta.name} ${chapter}:${n}`
                      ).catch(() => {})
                    }
                    className="text-ink/50 hover:text-ink"
                  >
                    카드로 저장
                  </button>
                </div>
              )}
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
