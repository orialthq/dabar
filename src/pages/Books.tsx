import { useEffect, useState } from "react";
import { ArrowRight, BookMarked, BookOpenText, History } from "lucide-react";
import type { BookMeta } from "../types/bible";
import { loadBooks } from "../lib/bible";
import { loadLastRead } from "../lib/reader";

function Books() {
  const [books, setBooks] = useState<BookMeta[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBooks().then(setBooks).catch((e: Error) => setError(e.message));
  }, []);

  if (error)
    return <p className="page-shell text-sm text-ink/70">{error} 새로고침해 주세요.</p>;
  if (!books)
    return <p className="page-shell text-sm text-ink/50">목차를 펴는 중…</p>;

  const sections = [
    { key: "OT", label: "구약", sub: "오래된 언약", items: books.filter((b) => b.testament === "OT") },
    { key: "NT", label: "신약", sub: "새로운 언약", items: books.filter((b) => b.testament === "NT") },
  ];
  const last = loadLastRead();
  const lastBook = last && books.find((book) => book.id === last.bookId);

  return (
    <div className="page-shell-wide">
      <header className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <p className="page-kicker">
            <BookOpenText size={14} strokeWidth={1.8} aria-hidden="true" />
            BIBLE READER
          </p>
          <h1 className="page-title">읽다</h1>
          <p className="page-lead">성경전서 개역한글판 · 66권 1,189장 31,102절</p>
        </div>

        {last && lastBook && (
          <a
            href={`#/read/${last.bookId}/${last.chapter}`}
            className="surface group flex min-w-[17rem] items-center gap-3 px-4 py-3 transition hover:border-dawn/45"
          >
            <span className="icon-tile !h-10 !w-10 !rounded-xl">
              <History size={18} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-semibold tracking-[0.1em] text-ink/38">이어 읽기</span>
              <span className="mt-0.5 block truncate font-serif text-sm font-semibold">
                {lastBook.name} {last.chapter}장
              </span>
            </span>
            <ArrowRight size={16} className="text-ink/35 transition group-hover:translate-x-0.5 group-hover:text-dawn" aria-hidden="true" />
          </a>
        )}
      </header>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        {sections.map((section) => (
          <section key={section.key} className="surface overflow-hidden">
            <div className="flex items-center gap-3 border-b border-ink/9 bg-ink/[0.025] px-5 py-4 md:px-6">
              <BookMarked size={17} strokeWidth={1.7} className="text-dawn" aria-hidden="true" />
              <div>
                <h2 className="font-serif text-base font-semibold">{section.label}</h2>
                <p className="text-[10px] text-ink/38">{section.sub} · {section.items.length}권</p>
              </div>
            </div>
            <ul className="grid grid-cols-2 gap-x-3 p-4 sm:grid-cols-3 md:p-5 lg:grid-cols-2 xl:grid-cols-3">
              {section.items.map((book) => (
                <li key={book.id}>
                  <a
                    href={`#/read/${book.id}/1`}
                    className="group flex items-center justify-between rounded-xl px-3 py-2.5 transition hover:bg-dawn/8"
                  >
                    <span className="text-sm font-medium group-hover:text-dawn transition-colors">{book.name}</span>
                    <span className="text-[10px] tabular-nums text-ink/30">{book.chapters}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

export default Books;
