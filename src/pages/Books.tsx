import { useEffect, useState } from "react";
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
    return <p className="p-8 text-sm text-ink/70">{error} 새로고침해 주세요.</p>;
  if (!books)
    return <p className="p-8 text-sm text-ink/50">목차를 펴는 중…</p>;

  const sections = [
    { key: "OT", label: "구약", items: books.filter((b) => b.testament === "OT") },
    { key: "NT", label: "신약", items: books.filter((b) => b.testament === "NT") },
  ];

  return (
    <div className="max-w-5xl mx-auto px-6 md:px-12 py-10 md:py-14">
      <h1 className="font-serif text-2xl md:text-3xl font-semibold">읽다</h1>
      <p className="mt-2 text-sm text-ink/55">
        성경전서 개역한글판 · 66권 1,189장 31,102절
      </p>
      {(() => {
        const last = loadLastRead();
        const book = last && books.find((b) => b.id === last.bookId);
        if (!last || !book) return null;
        return (
          <a
            href={`#/read/${last.bookId}/${last.chapter}`}
            className="mt-6 inline-flex items-center gap-2 border border-dawn/50 bg-dawn/10 rounded-full px-5 py-2 text-sm text-ink hover:brightness-105 transition"
          >
            이어 읽기 — {book.name} {last.chapter}장 →
          </a>
        );
      })()}
      {sections.map((s) => (
        <section key={s.key} className="mt-10">
          <h2 className="text-xs tracking-widest text-ink/45 border-b border-ink/15 pb-2">
            {s.label} · {s.items.length}권
          </h2>
          <ul className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-2">
            {s.items.map((b) => (
              <li key={b.id}>
                <a
                  href={`#/read/${b.id}/1`}
                  className="flex items-baseline justify-between py-1.5 group"
                >
                  <span className="text-sm group-hover:text-dawn transition-colors">
                    {b.name}
                  </span>
                  <span className="text-[11px] text-ink/35">{b.chapters}장</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export default Books;
