import { useEffect, useState } from "react";
import type { Entry } from "../types/journal";
import { loadEntries, exportMarkdown, downloadText } from "../lib/journal";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

function Journal() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setEntries(loadEntries());
  }, []);

  const onExport = async () => {
    setExporting(true);
    try {
      const md = await exportMarkdown(entries);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadText(`dabar-saegim-${stamp}.md`, md);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 md:py-14">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl md:text-3xl font-semibold">
            새기다
          </h1>
          <p className="mt-2 text-sm text-ink/55">
            오늘 있었던 일과, 그 하루에 닿은 말씀의 기록.
          </p>
        </div>
        <a
          href="#/write/new"
          className="shrink-0 bg-dawn text-ink text-sm font-medium rounded-full px-5 py-2 hover:brightness-110 transition"
        >
          새로 새기기
        </a>
      </div>

      {entries.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="font-serif text-lg text-ink/60">
            아직 새긴 기록이 없습니다.
          </p>
          <p className="mt-2 text-sm text-ink/45">
            오늘 하루를 짧게라도 적어보세요. 기록이 쌓여 나의 신앙 연대기가
            됩니다.
          </p>
        </div>
      ) : (
        <>
          <ol className="mt-10 space-y-4">
            {entries.map((e) => (
              <li key={e.id}>
                <a
                  href={`#/write/${e.id}`}
                  className="block border border-ink/12 rounded-lg p-5 bg-white/40 hover:border-dawn/60 transition-colors"
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-xs text-ink/45">
                      {fmtDate(e.createdAt)}
                    </span>
                    {e.verses.length > 0 && (
                      <span className="text-[11px] text-dawn">
                        말씀 {e.verses.length}
                      </span>
                    )}
                  </div>
                  {e.title && (
                    <h2 className="mt-2 font-medium text-[15px]">{e.title}</h2>
                  )}
                  <p className="mt-1 text-sm leading-6 text-ink/70 line-clamp-3 whitespace-pre-line">
                    {e.body}
                  </p>
                </a>
              </li>
            ))}
          </ol>
          <div className="mt-10 flex justify-end">
            <button
              onClick={() => void onExport()}
              disabled={exporting}
              className="text-xs text-ink/50 hover:text-ink border border-ink/20 rounded px-3 py-1.5 disabled:opacity-50"
            >
              {exporting ? "내보내는 중…" : "마크다운으로 내보내기"}
            </button>
          </div>
          <p className="mt-3 text-right text-[11px] text-ink/35">
            기록은 이 브라우저에만 저장됩니다. 갈아타기 전에 내보내기를
            이용하세요.
          </p>
        </>
      )}
    </div>
  );
}

export default Journal;
