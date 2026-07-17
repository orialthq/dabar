import { useState } from "react";
import type { SearchHit } from "../types/bible";
import { searchBible } from "../lib/bible";
import { resolveVerse } from "../lib/journal";
import {
  isSemanticSupported,
  isSemanticReady,
  isSemanticCached,
  semanticSearch,
  type SemanticProgress,
} from "../lib/semantic";
import { ArrowUpRight, Info, Search as SearchIcon, Sparkles, TextSearch, Wifi } from "lucide-react";

type Mode = "keyword" | "semantic";

interface SemanticResult {
  label: string; // "시편 23:1"
  href: string;
  text: string;
}

type Status =
  | { kind: "idle" }
  | { kind: "loading"; done: number; total: number }
  | { kind: "done"; hits: SearchHit[]; truncated: boolean; query: string }
  | { kind: "sem-consent" }
  | { kind: "sem-loading"; percent: number | null }
  | { kind: "sem-done"; results: SemanticResult[]; query: string }
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
  const [mode, setMode] = useState<Mode>("keyword");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const runKeyword = async (q: string) => {
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

  const runSemantic = async (q: string) => {
    setStatus({ kind: "sem-loading", percent: null });
    try {
      const onProgress = (p: SemanticProgress) => {
        if (p.kind === "model" && p.total > 0)
          setStatus({ kind: "sem-loading", percent: Math.round((p.loaded / p.total) * 100) });
      };
      const hits = await semanticSearch(q, 20, onProgress);
      const results: SemanticResult[] = [];
      for (const h of hits) {
        const r = await resolveVerse(h.ref);
        if (r)
          results.push({
            label: r.label,
            text: r.text,
            href: `#/read/${h.ref.bookId}/${h.ref.chapter}/${h.ref.verse}`,
          });
      }
      setStatus({ kind: "sem-done", results, query: q });
    } catch {
      setStatus({
        kind: "error",
        message: "뜻으로 찾기가 끊겼습니다. 네트워크를 확인해 다시 시도해 보세요.",
      });
    }
  };

  const run = async () => {
    const q = input.trim();
    if (!q) return;
    if (mode === "keyword") return runKeyword(q);
    if (!isSemanticSupported()) {
      setStatus({
        kind: "error",
        message: "이 브라우저에서는 뜻으로 찾기를 열 수 없습니다. 키워드로 찾아보세요.",
      });
      return;
    }
    if (isSemanticReady() || (await isSemanticCached())) return runSemantic(q);
    setStatus({ kind: "sem-consent" });
  };

  return (
    <div className="page-shell">
      <p className="page-kicker">
        <SearchIcon size={14} strokeWidth={1.8} aria-hidden="true" />
        BIBLE SEARCH
      </p>
      <h1 className="page-title">찾다</h1>
      <p className="page-lead">
        {mode === "keyword"
          ? "키워드로 성경 전체(개역한글)에서 구절을 찾습니다."
          : "문장으로 물으면, 뜻이 닿는 구절을 성경 전체에서 찾습니다."}
      </p>

      <div className="segmented mt-7">
        {(
          [
            ["keyword", "말씀으로 찾기"],
            ["semantic", "뜻으로 찾기"],
          ] as [Mode, string][]
        ).map(([m, label]) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setStatus({ kind: "idle" });
            }}
            className="segmented-button"
            data-active={mode === m}
          >
            {m === "keyword" ? (
              <TextSearch size={14} strokeWidth={1.8} aria-hidden="true" />
            ) : (
              <Sparkles size={14} strokeWidth={1.8} aria-hidden="true" />
            )}
            {label}
          </button>
        ))}
      </div>

      <div className="surface mt-4 flex gap-2 p-2">
        <div className="relative min-w-0 flex-1">
          <SearchIcon size={17} strokeWidth={1.7} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/30" aria-hidden="true" />
          <input
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) void run();
            }}
            placeholder={
              mode === "keyword" ? "예: 두려워 말라" : "예: 마음이 무거운 날에 붙들 말씀"
            }
            aria-label="검색어"
            className="field !border-0 !bg-transparent !pl-10 !shadow-none"
          />
        </div>
        <button
          onClick={() => void run()}
          className="btn-primary shrink-0"
        >
          <SearchIcon size={16} strokeWidth={1.8} aria-hidden="true" />
          찾기
        </button>
      </div>

      <div className="mt-10">
        {status.kind === "idle" && (
          <div className="surface-soft flex items-start gap-3 p-4 text-sm text-ink/45">
            <Info size={16} strokeWidth={1.7} className="mt-0.5 shrink-0 text-dawn" aria-hidden="true" />
            <p>
            {mode === "keyword"
              ? "첫 검색 시 성경 전체 본문(약 4.5MB)을 내려받아 이후 검색은 즉시 이루어집니다."
              : "말씀의 뜻을 읽어 찾아드립니다. 처음 한 번은 준비물(약 130MB)을 내려받습니다."}
            </p>
          </div>
        )}
        {status.kind === "loading" && (
          <div className="surface-soft p-4">
            <p className="text-sm text-ink/50">{status.done}/{status.total}권 살피는 중…</p>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-ink/8">
              <div className="h-full bg-dawn transition-all" style={{ width: `${(status.done / status.total) * 100}%` }} />
            </div>
          </div>
        )}
        {status.kind === "sem-consent" && (
          <div className="surface p-5">
            <span className="icon-tile mb-4">
              <Wifi size={19} strokeWidth={1.7} aria-hidden="true" />
            </span>
            <p className="text-sm text-ink/80">뜻으로 찾기는 기록의 결을 읽는 준비가 필요합니다.</p>
            <p className="mt-1 text-xs text-ink/50 leading-5">
              처음 한 번, 약 130MB를 내려받습니다 (Wi-Fi 권장). 이후에는 저장된 것을 다시
              쓰며, 검색어는 이 기기 밖으로 나가지 않습니다.
            </p>
            <button
              onClick={() => void runSemantic(input.trim())}
              className="btn-primary mt-4"
            >
              준비하고 찾기
            </button>
          </div>
        )}
        {status.kind === "sem-loading" && (
          <div className="surface-soft p-4">
            <p className="text-sm text-ink/50">
              말씀의 결을 살피는 중{status.percent !== null && ` — ${status.percent}%`}
            </p>
            <div className="mt-3 h-1 rounded-full bg-ink/10 overflow-hidden">
              <div
                className="h-full bg-dawn transition-all"
                style={{ width: `${status.percent ?? 5}%` }}
              />
            </div>
          </div>
        )}
        {status.kind === "error" && (
          <p className="text-sm text-ink/70">{status.message}</p>
        )}
        {status.kind === "sem-done" && (
          <>
            <p className="section-label">
              &ldquo;{status.query}&rdquo; — 뜻이 닿는 구절 {status.results.length}개
            </p>
            <ol className="mt-4 border-t border-ink/9">
              {status.results.map((r) => (
                <li key={r.label}>
                  <a href={r.href} className="result-row group">
                    <span className="flex items-center justify-between text-xs font-semibold text-dawn">
                      {r.label}
                      <ArrowUpRight size={14} className="opacity-0 transition group-hover:opacity-100" aria-hidden="true" />
                    </span>
                    <p className="mt-1.5 font-serif text-[15px] leading-7 text-ink/80">{r.text}</p>
                  </a>
                </li>
              ))}
            </ol>
          </>
        )}
        {status.kind === "done" && (
          <>
            <p className="section-label">
              &ldquo;{status.query}&rdquo; — {status.hits.length}개 구절
              {status.truncated && " (상위 300개까지 표시)"}
            </p>
            <ol className="mt-4 border-t border-ink/9">
              {status.hits.map((h) => (
                <li key={`${h.book.id}-${h.chapter}-${h.verse}`}>
                  <a
                    href={`#/read/${h.book.id}/${h.chapter}/${h.verse}`}
                    className="result-row group"
                  >
                    <span className="flex items-center justify-between text-xs font-semibold text-dawn">
                      <span>{h.book.name} {h.chapter}:{h.verse}</span>
                      <ArrowUpRight size={14} className="opacity-0 transition group-hover:opacity-100" aria-hidden="true" />
                    </span>
                    <p className="mt-1.5 font-serif text-[15px] leading-7 text-ink/80">
                      <Highlight text={h.text} query={status.query} />
                    </p>
                  </a>
                </li>
              ))}
            </ol>
            {status.hits.length === 0 && (
              <p className="mt-4 text-sm text-ink/45">
                해당 표현이 없습니다. 개역한글은 1961년 표기를 사용합니다 — 예:
                &ldquo;셋째&rdquo;가 아니라 &ldquo;세째&rdquo;. 문장으로 찾고 싶다면
                &ldquo;뜻으로 찾기&rdquo;를 눌러보세요.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default Search;
