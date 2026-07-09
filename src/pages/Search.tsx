import { useState } from "react";
import type { SearchHit } from "../types/bible";
import { searchBible } from "../lib/bible";

type Status =
  | { kind: "idle" }
  | { kind: "loading"; done: number; total: number }
  | { kind: "done"; hits: SearchHit[]; truncated: boolean; query: string }
  | { kind: "error"; message: string };

function Highlight({ text, query }: { text: string; query: string }) {
  const parts = text.split(query);
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>
          {p}
          {i < parts.length - 1 && (
            <mark className="bg-dawn/25 text-inherit rounded-sm px-0.5">
              {query}
            </mark>
          )}
        </span>
      ))}
    </>
  );
}

function Search() {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const run = async () => {
    const q = input.trim();
    if (!q) return;
    setStatus({ kind: "loading", done: 0, total: 66 });
    try {
      const { hits, truncated } = await searchBible(q, (done, total) =>
        setStatus({ kind: "loading", done, total })
      );
      setStatus({ kind: "done", hits, truncated, query: q });
    } catch (e) {
      setStatus({ kind: "error", message: (e as Error).message });
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 md:py-14">
      <h1 className="font-serif text-2xl md:text-3xl font-semibold">찾다</h1>
      <p className="mt-2 text-sm text-ink/55">
        키워드로 성경 전체(개역한글)에서 구절을 찾습니다.
      </p>

      <div className="mt-8 flex gap-2">
        <input
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void run();
          }}
          placeholder="예: 두려워 말라"
          aria-label="검색어"
          className="flex-1 bg-white/60 border border-ink/20 rounded-lg px-4 py-2.5 text-[15px] placeholder:text-ink/30 focus:outline-none focus:border-dawn"
        />
        <button
          onClick={() => void run()}
          className="bg-ink text-hanji rounded-lg px-5 text-sm hover:bg-ink-soft transition-colors"
        >
          찾기
        </button>
      </div>

      <div className="mt-8">
        {status.kind === "idle" && (
          <p className="text-sm text-ink/40">
            첫 검색 시 성경 전체 본문(약 4.5MB)을 내려받아 이후 검색은 즉시
            이루어집니다.
          </p>
        )}
        {status.kind === "loading" && (
          <p className="text-sm text-ink/50">
            {status.done}/{status.total}권 살피는 중…
          </p>
        )}
        {status.kind === "error" && (
          <p className="text-sm text-ink/70">{status.message}</p>
        )}
        {status.kind === "done" && (
          <>
            <p className="text-sm text-ink/55">
              &ldquo;{status.query}&rdquo; — {status.hits.length}개 구절
              {status.truncated && " (상위 300개까지 표시)"}
            </p>
            <ol className="mt-6 space-y-5">
              {status.hits.map((h) => (
                <li key={`${h.book.id}-${h.chapter}-${h.verse}`}>
                  <a
                    href={`#/read/${h.book.id}/${h.chapter}/${h.verse}`}
                    className="block group"
                  >
                    <span className="text-xs text-dawn font-medium">
                      {h.book.name} {h.chapter}:{h.verse}
                    </span>
                    <p className="mt-1 font-serif text-[15px] leading-6 text-ink/85 group-hover:text-ink">
                      <Highlight text={h.text} query={status.query} />
                    </p>
                  </a>
                </li>
              ))}
            </ol>
            {status.hits.length === 0 && (
              <p className="mt-4 text-sm text-ink/45">
                해당 표현이 없습니다. 개역한글은 1961년 표기를 사용합니다 — 예:
                &ldquo;셋째&rdquo;가 아니라 &ldquo;세째&rdquo;.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default Search;
