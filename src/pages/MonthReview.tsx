import { useEffect, useMemo, useState } from "react";
import type { Entry, VerseRef } from "../types/journal";
import { loadEntries, exportMarkdown, downloadText } from "../lib/journal";
import { themeOf } from "../lib/reflect";
import VerseQuote from "../components/VerseQuote";
import { ArrowLeft, CalendarDays, Download, Feather } from "lucide-react";

interface Props {
  ym: string; // "2026-07"
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${y}년 ${m}월`;
}

function inMonth(iso: string, ym: string): boolean {
  const d = new Date(iso);
  const [y, m] = ym.split("-").map(Number);
  return d.getFullYear() === y && d.getMonth() + 1 === m;
}

/** 월간 돌아보기 (v0.9.0) — 한 달의 새김과 말씀을 고서 판식으로 엮는다 */
function MonthReview({ ym }: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    setEntries(loadEntries().filter((e) => inMonth(e.createdAt, ym)));
  }, [ym]);

  const verses = useMemo(() => {
    const seen = new Set<string>();
    const out: VerseRef[] = [];
    for (const e of [...entries].reverse()) {
      for (const v of e.verses) {
        const k = `${v.bookId}:${v.chapter}:${v.verse}`;
        if (!seen.has(k)) {
          seen.add(k);
          out.push(v);
        }
      }
    }
    return out;
  }, [entries]);

  const topThemes = useMemo(() => {
    const count = new Map<string, number>();
    for (const e of entries) {
      const t = themeOf(e.id);
      if (t) count.set(t.label, (count.get(t.label) ?? 0) + 1);
    }
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [entries]);

  const onExport = async () => {
    const md = await exportMarkdown(entries);
    downloadText(`dabar-${ym}.md`, md);
  };

  return (
    <div className="page-shell">
      <a href="#/write" className="btn-ghost">
        <ArrowLeft size={15} strokeWidth={1.8} aria-hidden="true" />
        새김 목록
      </a>

      <div className="gyeseon mt-5 rounded-[1.25rem] px-6 py-8 md:px-10 md:py-10">
        <span className="icon-tile mx-auto">
          <CalendarDays size={19} strokeWidth={1.7} aria-hidden="true" />
        </span>
        <h1 className="mt-4 font-serif text-2xl font-semibold text-center tracking-[-0.03em]">
          {monthLabel(ym)}의 새김
        </h1>
        <div
          aria-hidden="true"
          className="mt-5 mx-auto h-px w-20 bg-gradient-to-r from-transparent via-ink/25 to-transparent"
        />
        <p className="mt-4 text-center text-sm text-ink/55">
          {entries.length}편의 새김 · {verses.length}곳의 말씀
          {topThemes.length > 0 &&
            ` · ${topThemes.map(([label]) => label).join(" · ")}`}
        </p>

        {entries.length === 0 ? (
          <p className="mt-10 text-center text-sm text-ink/45">
            이 달에는 새겨진 하루가 없습니다.
          </p>
        ) : (
          <>
            <ol className="mt-8 divide-y divide-ink/8 border-y border-ink/8">
              {[...entries].reverse().map((e) => {
                const theme = themeOf(e.id);
                return (
                  <li key={e.id}>
                    <a href={`#/write/${e.id}`} className="group block py-3.5">
                      <span className="text-[11px] text-ink/40">
                        {new Date(e.createdAt).toLocaleDateString("ko-KR", {
                          month: "long",
                          day: "numeric",
                          weekday: "short",
                        })}
                        {theme && <span className="ml-2 text-ink/35">{theme.label}</span>}
                      </span>
                      <p className="text-sm text-ink/75 group-hover:text-ink line-clamp-1">
                        {e.title || e.body}
                      </p>
                    </a>
                  </li>
                );
              })}
            </ol>

            {verses.length > 0 && (
              <>
                <h2 className="section-label mt-10">
                  <Feather size={15} strokeWidth={1.8} className="text-dawn" aria-hidden="true" />
                  이 달에 닿은 말씀
                </h2>
                <div className="mt-3 space-y-4">
                  {verses.map((v) => (
                    <VerseQuote key={`${v.bookId}-${v.chapter}-${v.verse}`} refValue={v} />
                  ))}
                </div>
              </>
            )}

            <div className="mt-10 text-center">
              <button
                onClick={() => void onExport()}
                className="btn-secondary !min-h-9 !text-xs"
              >
                <Download size={14} strokeWidth={1.8} aria-hidden="true" />
                이 달을 마크다운으로 내보내기
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default MonthReview;
