import { useEffect, useState } from "react";
import type { VerseRef } from "../types/journal";
import { resolveVerse } from "../lib/journal";

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
    <blockquote className="border-l-[6px] border-double border-dawn/60 pl-4 py-1">
      {resolved ? (
        <>
          <p className="font-serif text-[15px] leading-6 text-ink/85">
            {resolved.text}
          </p>
          <footer className="mt-1 flex items-center gap-3">
            <a
              href={`#/read/${refValue.bookId}/${refValue.chapter}/${refValue.verse}`}
              className="text-xs text-dawn"
            >
              {resolved.label} (개역한글)
            </a>
            {onRemove && (
              <button
                onClick={onRemove}
                className="text-xs text-ink/35 hover:text-ink/70"
              >
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
