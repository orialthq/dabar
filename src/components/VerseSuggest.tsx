import { useEffect, useRef, useState } from "react";
import type { VerseRef } from "../types/journal";
import { resolveVerse } from "../lib/journal";
import {
  isSemanticSupported,
  isSemanticReady,
  isSemanticCached,
  prepareSemantic,
  suggestVerses,
  type SemanticProgress,
  type Suggestion,
} from "../lib/semantic";

interface Props {
  body: string;
  onPick: (ref: VerseRef) => void;
  /** 시맨틱 검색을 쓸 수 없을 때 키워드 검색으로 폴백 */
  onFallback: () => void;
}

type Status =
  | { kind: "idle" }
  | { kind: "consent" } // 최초 1회 다운로드 안내
  | { kind: "preparing"; percent: number | null }
  | { kind: "searching" }
  | { kind: "done"; items: ResolvedSuggestion[] }
  | { kind: "error"; message: string };

interface ResolvedSuggestion extends Suggestion {
  label: string;
  text: string;
}

/** 참조를 로컬 성경 DB로 해석. 해석 불가 참조는 폐기한다 (본문의 단일 원천 = 로컬 DB). */
async function resolveSuggestions(items: Suggestion[]): Promise<ResolvedSuggestion[]> {
  const out: ResolvedSuggestion[] = [];
  for (const s of items) {
    const r = await resolveVerse(s.ref);
    if (r) out.push({ ...s, label: r.label, text: r.text });
  }
  return out;
}

function VerseSuggest({ body, onPick, onFallback }: Props) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const canSearch = body.trim().length >= 5;

  const run = async () => {
    setStatus({ kind: "searching" });
    try {
      const onProgress = (p: SemanticProgress) => {
        if (!alive.current) return;
        if (p.kind === "model") {
          setStatus({
            kind: "preparing",
            percent: p.total > 0 ? Math.round((p.loaded / p.total) * 100) : null,
          });
        }
      };
      const items = await suggestVerses(body, onProgress);
      const resolved = await resolveSuggestions(items);
      if (!alive.current) return;
      setStatus({ kind: "done", items: resolved });
    } catch {
      if (!alive.current) return;
      setStatus({
        kind: "error",
        message: "말씀 찾기가 열리지 않았습니다. 아래에서 키워드로 직접 찾아보세요.",
      });
    }
  };

  const start = async () => {
    if (!isSemanticSupported()) {
      setStatus({
        kind: "error",
        message: "이 브라우저에서는 열 수 없습니다. 아래에서 키워드로 직접 찾아보세요.",
      });
      return;
    }
    // 준비됐거나 이미 캐시에 있으면 바로 검색, 처음 받을 때만 다운로드 동의
    if (isSemanticReady() || (await isSemanticCached())) void run();
    else setStatus({ kind: "consent" });
  };

  const prepare = async () => {
    setStatus({ kind: "preparing", percent: null });
    try {
      await prepareSemantic((p) => {
        if (!alive.current || p.kind !== "model") return;
        setStatus({
          kind: "preparing",
          percent: p.total > 0 ? Math.round((p.loaded / p.total) * 100) : null,
        });
      });
      if (!alive.current) return;
      await run();
    } catch {
      if (!alive.current) return;
      setStatus({
        kind: "error",
        message: "준비가 끊겼습니다. 네트워크를 확인해 다시 시도하거나, 아래에서 키워드로 직접 찾아보세요.",
      });
    }
  };

  if (status.kind === "idle")
    return (
      <button
        onClick={() => void start()}
        disabled={!canSearch}
        className="text-sm text-dawn hover:brightness-110 disabled:opacity-40 disabled:hover:brightness-100"
        title={canSearch ? undefined : "기록을 조금 더 적으면 찾을 수 있어요"}
      >
        ✦ 이 하루에 닿는 말씀 찾기
      </button>
    );

  return (
    <div className="border border-ink/15 rounded-lg p-4 bg-white/40">
      {status.kind === "consent" && (
        <>
          <p className="text-sm text-ink/80">
            기록의 결을 읽어 말씀을 찾아드립니다.
          </p>
          <p className="mt-1 text-xs text-ink/50 leading-5">
            처음 한 번, 약 130MB를 내려받습니다 (Wi-Fi 권장). 이후에는 저장된 것을
            다시 쓰며, 기록은 이 기기 밖으로 나가지 않습니다.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={() => void prepare()}
              className="text-sm bg-ink text-hanji rounded px-4 py-1.5 hover:bg-ink-soft transition-colors"
            >
              준비하기
            </button>
            <button
              onClick={() => setStatus({ kind: "idle" })}
              className="text-xs text-ink/40 hover:text-ink/70"
            >
              다음에
            </button>
          </div>
        </>
      )}

      {status.kind === "preparing" && (
        <>
          <p className="text-xs text-ink/50">
            말씀 찾기 준비 중{status.percent !== null && ` — ${status.percent}%`}
          </p>
          <div className="mt-2 h-1 rounded bg-ink/10 overflow-hidden">
            <div
              className="h-full bg-dawn transition-all"
              style={{ width: `${status.percent ?? 5}%` }}
            />
          </div>
        </>
      )}

      {status.kind === "searching" && (
        <p className="text-xs text-ink/50">이 하루에 닿는 말씀을 찾는 중…</p>
      )}

      {status.kind === "done" && (
        <>
          <p className="text-xs text-ink/50">
            {status.items.length > 0
              ? "이 하루에 닿는 말씀입니다. 마음에 닿는 구절을 담아보세요."
              : "닿는 말씀을 찾지 못했습니다. 아래에서 키워드로 직접 찾아보세요."}
          </p>
          <ul className="mt-2 divide-y divide-ink/8">
            {status.items.map((s) => (
              <li key={`${s.ref.bookId}-${s.ref.chapter}-${s.ref.verse}`}>
                <button
                  onClick={() => onPick(s.ref)}
                  className="w-full text-left py-2.5 group"
                >
                  <span className="text-[11px] text-dawn">
                    {s.label} (개역한글)
                    <span className="ml-2 text-ink/35">
                      {s.kind === "curated" ? s.themeLabel : "발견"}
                    </span>
                  </span>
                  <p className="font-serif text-sm leading-6 text-ink/75 group-hover:text-ink">
                    {s.text}
                  </p>
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-center gap-4">
            <button
              onClick={() => void run()}
              className="text-xs text-ink/40 hover:text-ink/70"
            >
              다시 찾기
            </button>
            <button onClick={onFallback} className="text-xs text-ink/40 hover:text-ink/70">
              키워드로 직접 찾기
            </button>
          </div>
        </>
      )}

      {status.kind === "error" && (
        <>
          <p className="text-xs text-ink/60">{status.message}</p>
          <button
            onClick={onFallback}
            className="mt-2 text-sm text-dawn hover:brightness-110"
          >
            키워드로 찾기
          </button>
        </>
      )}
    </div>
  );
}

export default VerseSuggest;
