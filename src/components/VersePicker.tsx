import { useState } from "react";
import type { SearchHit } from "../types/bible";
import type { VerseRef } from "../types/journal";
import { searchBible } from "../lib/bible";

interface Props {
  onPick: (ref: VerseRef) => void;
}

type Status =
  | { kind: "idle" }
  | { kind: "loading"; done: number; total: number }
  | { kind: "done"; hits: SearchHit[]; query: string };

const SHOW = 30;

function VersePicker({ onPick }: Props) {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const run = async () => {
    const q = input.trim();
    if (!q) return;
    setStatus({ kind: "loading", done: 0, total: 66 });
    const { hits } = await searchBible(q, (done, total) =>
      setStatus({ kind: "loading", done, total })
    );
    setStatus({ kind: "done", hits, query: q });
  };

  return (
    <div className="border border-ink/15 rounded-lg p-4 bg-white/40">
      <p className="text-xs text-ink/50">
        말씀 붙이기 — 키워드로 찾아 구절을 이 새김에 담습니다.
      </p>
      <div className="mt-2 flex gap-2">
        <input
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void run();
            }
          }}
          placeholder="예: 수고하고 무거운 짐"
          aria-label="구절 검색어"
          className="flex-1 bg-white/70 border border-ink/20 rounded px-3 py-1.5 text-sm placeholder:text-ink/30 focus:outline-none focus:border-dawn"
        />
        <button
          onClick={() => void run()}
          className="text-sm bg-ink text-hanji rounded px-4 hover:bg-ink-soft transition-colors"
        >
          찾기
        </button>
      </div>
      {status.kind === "loading" && (
        <p className="mt-3 text-xs text-ink/45">
          {status.done}/{status.total}권 살피는 중…
        </p>
      )}
      {status.kind === "done" && (
        <>
          <p className="mt-3 text-xs text-ink/45">
            {status.hits.length}개 구절
            {status.hits.length > SHOW && ` 중 ${SHOW}개 표시`}
            {status.hits.length === 0 &&
              " — 개역한글 표기(예: 세째)로 다시 시도해 보세요."}
          </p>
          <ul className="mt-2 max-h-56 overflow-y-auto divide-y divide-ink/8">
            {status.hits.slice(0, SHOW).map((h) => (
              <li key={`${h.book.id}-${h.chapter}-${h.verse}`}>
                <button
                  onClick={() =>
                    onPick({ bookId: h.book.id, chapter: h.chapter, verse: h.verse })
                  }
                  className="w-full text-left py-2 group"
                >
                  <span className="text-[11px] text-dawn">
                    {h.book.name} {h.chapter}:{h.verse}
                  </span>
                  <p className="font-serif text-sm leading-5 text-ink/75 group-hover:text-ink line-clamp-2">
                    {h.text}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export default VersePicker;
