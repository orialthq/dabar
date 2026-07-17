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
import {
  ArrowRight,
  BookOpenText,
  CalendarDays,
  DatabaseBackup,
  Download,
  Feather,
  History,
  Plus,
  Upload,
} from "lucide-react";

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
    <div className="page-shell">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="page-kicker">
            <Feather size={14} strokeWidth={1.8} aria-hidden="true" />
            JOURNAL
          </p>
          <h1 className="page-title">새기다</h1>
          <p className="page-lead">
            오늘 있었던 일과, 그 하루에 닿은 말씀을 새깁니다.
          </p>
        </div>
        <a
          href="#/write/new"
          className="btn-primary shrink-0"
        >
          <Plus size={16} strokeWidth={2} aria-hidden="true" />
          새로 새기기
        </a>
      </div>

      {remembered.length > 0 && (
        <div className="surface mt-8 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-ink/9 bg-dawn/6 px-5 py-3.5">
            <History size={16} strokeWidth={1.8} className="text-dawn" aria-hidden="true" />
            <p className="font-serif text-sm font-semibold text-ink/70">돌아보기</p>
          </div>
          <ul className="divide-y divide-ink/8 px-5">
            {remembered.map(({ entry, label }) => (
              <li key={entry.id}>
                <a href={`#/write/${entry.id}`} className="group flex items-center gap-3 py-3.5">
                  <span className="min-w-0 flex-1">
                  <span className="text-[11px] text-dawn">{label}</span>
                  <p className="text-sm text-ink/70 group-hover:text-ink line-clamp-1">
                    {entry.title || entry.body}
                  </p>
                  </span>
                  <ArrowRight size={15} className="text-ink/25 transition group-hover:translate-x-0.5 group-hover:text-dawn" aria-hidden="true" />
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
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="mr-1 inline-flex items-center gap-1.5 text-[11px] font-medium text-ink/45">
              <CalendarDays size={14} strokeWidth={1.8} aria-hidden="true" />
              월간 돌아보기
            </span>
            {months.slice(0, 6).map((ym) => (
                <a key={ym} href={`#/write/month/${ym}`} className="tag hover:border-dawn/50 hover:text-dawn">
                  {parseInt(ym.slice(5), 10)}월
                </a>
            ))}
          </div>
        );
      })()}

      {themes.length > 1 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {themes.map((t) => (
            <button
              key={t.id}
              onClick={() => setThemeFilter(themeFilter === t.id ? null : t.id)}
              className="tag"
              data-active={themeFilter === t.id}
            >
              {t.label} {t.count}
            </button>
          ))}
        </div>
      )}

      {entries.length === 0 ? (
        <div className="empty-state mt-10">
          <span className="icon-tile mx-auto mb-4">
            <Feather size={20} strokeWidth={1.7} aria-hidden="true" />
          </span>
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
          <ol className="mt-8 space-y-3">
            {visible.map((e) => {
              const theme = themeOf(e.id);
              return (
                <li key={e.id}>
                  <a
                    href={`#/write/${e.id}`}
                    className="action-card group block p-5 md:p-6"
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
                        <span className="inline-flex items-center gap-1 text-[11px] text-dawn">
                          <BookOpenText size={12} strokeWidth={1.8} aria-hidden="true" />
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
                    <span className="mt-4 inline-flex items-center gap-1 text-[11px] font-medium text-ink/35 transition group-hover:text-dawn">
                      펼쳐 보기
                      <ArrowRight size={13} strokeWidth={1.8} aria-hidden="true" />
                    </span>
                  </a>
                </li>
              );
            })}
          </ol>
        </>
      )}

      <div className="mt-10 flex flex-wrap justify-end gap-2 border-t border-ink/9 pt-6">
        {entries.length > 0 && (
          <>
            <button
              onClick={() => void onExport()}
              disabled={exporting}
              className="btn-secondary !min-h-9 !px-3 !text-xs"
            >
              <Download size={14} strokeWidth={1.8} aria-hidden="true" />
              {exporting ? "내보내는 중…" : "마크다운으로 내보내기"}
            </button>
            <button
              onClick={onBackup}
              className="btn-secondary !min-h-9 !px-3 !text-xs"
            >
              <DatabaseBackup size={14} strokeWidth={1.8} aria-hidden="true" />
              백업 (JSON)
            </button>
          </>
        )}
        <button
          onClick={() => fileRef.current?.click()}
          className="btn-secondary !min-h-9 !px-3 !text-xs"
        >
          <Upload size={14} strokeWidth={1.8} aria-hidden="true" />
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
