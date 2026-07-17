import { useEffect, useState } from "react";
import type { VerseRef } from "../types/journal";
import { resolveVerse } from "../lib/journal";
import { shareVerseCard } from "../lib/card";
import { ImageDown, Quote, X } from "lucide-react";

interface Props {
  refValue: VerseRef;
  onRemove?: () => void;
}

function VerseQuote({ refValue, onRemove }: Props) {
  const [resolved, setResolved] = useState<{ label: string; text: string } | null>(
    null
  );

  useEffect(() => {
    let alive = true;
    resolveVerse(refValue).then((r) => {
      if (alive) setResolved(r);
    });
    return () => {
      alive = false;
    };
  }, [refValue]);

  return (
    <blockquote className="verse-quote">
      {resolved ? (
        <>
          <div className="flex gap-3">
            <Quote size={16} strokeWidth={1.6} className="mt-1 shrink-0 text-dawn/65" aria-hidden="true" />
            <p className="font-serif text-[15px] leading-7 text-ink/85">{resolved.text}</p>
          </div>
          <footer className="mt-1 flex items-center gap-3">
            <a
              href={`#/read/${refValue.bookId}/${refValue.chapter}/${refValue.verse}`}
              className="ml-7 text-xs font-medium text-dawn"
            >
              {resolved.label} (개역한글)
            </a>
            <button
              onClick={() =>
                void shareVerseCard(
                  resolved.text,
                  resolved.label
                ).catch(() => {})
              }
              className="btn-ghost !min-h-7 !px-1.5 !text-[11px]"
            >
              <ImageDown size={12} strokeWidth={1.8} aria-hidden="true" />
              카드로 저장
            </button>
            {onRemove && (
              <button
                onClick={onRemove}
                className="btn-ghost !min-h-7 !px-1.5 !text-[11px]"
              >
                <X size={12} strokeWidth={1.8} aria-hidden="true" />
                빼기
              </button>
            )}
          </footer>
        </>
      ) : (
        <p className="text-xs text-ink/35">구절 불러오는 중…</p>
      )}
    </blockquote>
  );
}

export default VerseQuote;
