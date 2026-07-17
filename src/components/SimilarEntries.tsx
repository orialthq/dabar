import { useEffect, useState } from "react";
import type { Entry } from "../types/journal";
import { loadEntries } from "../lib/journal";
import { canReflect, ensureVectors, similarEntries } from "../lib/reflect";
import { ArrowRight, History } from "lucide-react";

interface Props {
  entryId: string;
}

/** 이 새김과 닮은 지난 새김 (M7① 돌아보기) — 모델이 없으면 조용히 렌더링하지 않는다 */
function SimilarEntries({ entryId }: Props) {
  const [similar, setSimilar] = useState<Entry[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!(await canReflect())) return;
      const entries = loadEntries();
      const cur = entries.find((e) => e.id === entryId);
      if (!cur) return;
      // 현재 새김을 먼저 분석하고, 나머지도 조금씩 채운다
      await ensureVectors([cur, ...entries.filter((e) => e.id !== entryId)], 9);
      if (!alive) return;
      setSimilar(similarEntries(entryId, entries, 2));
    })().catch(() => {});
    return () => {
      alive = false;
    };
  }, [entryId]);

  if (similar.length === 0) return null;

  return (
    <div className="mt-10 border-t border-ink/9 pt-6">
      <p className="section-label">
        <History size={15} strokeWidth={1.8} className="text-dawn" aria-hidden="true" />
        닮은 새김
      </p>
      <ul className="mt-3 divide-y divide-ink/8">
        {similar.map((e) => (
          <li key={e.id}>
            <a href={`#/write/${e.id}`} className="group flex items-center gap-3 py-3">
              <span className="min-w-0 flex-1">
                <span className="text-[11px] text-ink/40">
                {new Date(e.createdAt).toLocaleDateString("ko-KR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
                </span>
                <p className="text-sm text-ink/70 group-hover:text-ink line-clamp-1">
                {e.title || e.body}
                </p>
              </span>
              <ArrowRight size={14} className="text-ink/25 group-hover:text-dawn" aria-hidden="true" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default SimilarEntries;
