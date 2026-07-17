import { useEffect, useMemo, useRef, useState } from "react";
import type { Entry } from "../types/journal";
import {
  loadEntries,
  exportMarkdown,
  exportBackup,
  importBackup,
  downloadText,
} from "../lib/journal";
import { anniversaries, canReflect, ensureVectors, themeOf } from "../lib/reflect";

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
  const [themeFilter, setThemeFilter] = useState<string | null>(null);
  const [vecTick, setVecTick] = useState(0); // 벡터 캐시 갱신 시 뱃지 리렌더

  useEffect(() => {
    setEntries(loadEntries());
  }, []);

  // 모델이 준비돼 있으면 조용히 새김 벡터·주제를 채워 나간다 (한 번에 8개씩)
  useEffect(() => {
    if (entries.length === 0) return;
    let alive = true;
    (async () => {
      if (!(await canReflect())) return;
      const done = await ensureVectors(entries);
      if (alive && done > 0) setVecTick((t) => t + 1);
    })().catch(() => {});
    return () => {
      alive = false;
    };
  }, [entries]);

  const remembered = useMemo(() => anniversaries(entries), [entries]);

  // 주제 연대기: 캐시된 주제 라벨 수집
  const themes = useMemo(() => {
    void vecTick;
    const seen = new Map<string, { label: string; count: number }>();
    for (const e of entries) {
      const t = themeOf(e.id);
      if (!t) continue;
      const cur = seen.get(t.id);
      seen.set(t.id, { label: t.label, count: (cur?.count ?? 0) + 1 });
    }
    return [...seen.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.count - a.count);
  }, [entries, vecTick]);

  const visible = useMemo(() => {
    if (!themeFilter) return entries;
    return entries.filter((e) => themeOf(e.id)?.id === themeFilter);
  }, [entries, themeFilter, vecTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const onBackup = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadText(`dabar-backup-${stamp}.json`, exportBackup(entries));
  };

  const onImportFile = async (file: File) => {
    try {
      const r = importBackup(await file.text());
      setEntries(loadEntries());
      setImportMsg(
        `가져왔습니다 — 새로 ${r.added}편, 갱신 ${r.updated}편, 그대로 ${r.kept}편.`
      );
    } catch (e) {
      setImportMsg(e instanceof Error ? e.message : "가져오지 못했습니다.");
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
            오늘 있었던 일과, 그 하루에 닿은 말씀을 새깁니다.
          </p>
        </div>
        <a
          href="#/write/new"
          className="shrink-0 bg-dawn text-ink text-sm font-medium rounded-full px-5 py-2 hover:brightness-110 transition"
        >
          새로 새기기
        </a>
      </div>

      {remembered.length > 0 && (
        <div className="mt-8 gyeseon rounded-sm px-5 py-4">
          <p className="font-serif text-sm font-semibold text-ink/70">돌아보기</p>
          <ul className="mt-2 space-y-2">
            {remembered.map(({ entry, label }) => (
              <li key={entry.id}>
                <a href={`#/write/${entry.id}`} className="group block">
                  <span className="text-[11px] text-dawn">{label}</span>
                  <p className="text-sm text-ink/70 group-hover:text-ink line-clamp-1">
                    {entry.title || entry.body}
                  </p>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(() => {
        const months: string[] = [];
        for (const e of entries) {
          const d = new Date(e.createdAt);
          const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          if (!months.includes(ym)) months.push(ym);
        }
        if (months.length === 0) return null;
        return (
          <p className="mt-6 text-[11px] text-ink/40">
            월간 돌아보기:{" "}
            {months.slice(0, 6).map((ym, i) => (
              <span key={ym}>
                {i > 0 && " · "}
                <a href={`#/write/month/${ym}`} className="hover:text-dawn">
                  {parseInt(ym.slice(5), 10)}월
                </a>
              </span>
            ))}
          </p>
        );
      })()}

      {themes.length > 1 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {themes.map((t) => (
            <button
              key={t.id}
              onClick={() => setThemeFilter(themeFilter === t.id ? null : t.id)}
              className={`text-[11px] rounded-full px-3 py-1 border transition-colors ${
                themeFilter === t.id
                  ? "border-dawn bg-dawn/15 text-ink"
                  : "border-ink/15 text-ink/50 hover:border-ink/35"
              }`}
            >
              {t.label} {t.count}
            </button>
          ))}
        </div>
      )}

      {entries.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="font-serif text-lg text-ink/60">
            아직 새겨진 하루가 없습니다.
          </p>
          <p className="mt-2 text-sm text-ink/45">
            오늘 하루를 짧게라도 적어보세요. 새김이 쌓여 나의 신앙 연대기가
            됩니다.
          </p>
        </div>
      ) : (
        <>
          <ol className="mt-8 space-y-4">
            {visible.map((e) => {
              const theme = themeOf(e.id);
              return (
                <li key={e.id}>
                  <a
                    href={`#/write/${e.id}`}
                    className="block border border-ink/12 rounded-lg p-5 bg-white/40 hover:border-dawn/60 transition-colors"
                  >
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="text-xs text-ink/45">
                        {fmtDate(e.createdAt)}
                        {theme && (
                          <span className="ml-2 text-[11px] text-ink/35">
                            {theme.label}
                          </span>
                        )}
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
              );
            })}
          </ol>
        </>
      )}

      <div className="mt-10 flex flex-wrap justify-end gap-2">
        {entries.length > 0 && (
          <>
            <button
              onClick={() => void onExport()}
              disabled={exporting}
              className="text-xs text-ink/50 hover:text-ink border border-ink/20 rounded px-3 py-1.5 disabled:opacity-50"
            >
              {exporting ? "내보내는 중…" : "마크다운으로 내보내기"}
            </button>
            <button
              onClick={onBackup}
              className="text-xs text-ink/50 hover:text-ink border border-ink/20 rounded px-3 py-1.5"
            >
              백업 (JSON)
            </button>
          </>
        )}
        <button
          onClick={() => fileRef.current?.click()}
          className="text-xs text-ink/50 hover:text-ink border border-ink/20 rounded px-3 py-1.5"
        >
          백업 가져오기
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onImportFile(f);
            e.target.value = "";
          }}
        />
      </div>
      {importMsg && (
        <p className="mt-3 text-right text-[11px] text-ink/55">{importMsg}</p>
      )}
      <p className="mt-3 text-right text-[11px] text-ink/35">
        새김은 이 기기(브라우저)에만 머뭅니다. 기기를 옮길 때는 백업(JSON)으로
        내보내고, 새 기기에서 가져오세요.
      </p>
    </div>
  );
}

export default Journal;
