import { useEffect, useRef, useState } from "react";
import type { Draft, VerseRef } from "../types/journal";
import {
  getEntry,
  saveEntry,
  deleteEntry,
  loadDraft,
  saveDraft,
  clearDraft,
} from "../lib/journal";
import { navigate } from "../lib/router";
import VerseQuote from "../components/VerseQuote";
import VersePicker from "../components/VersePicker";

interface Props {
  entryId?: string; // 없으면 새 새김
}

const EMPTY: Draft = { title: "", body: "", verses: [] };

function Editor({ entryId }: Props) {
  const isNew = !entryId;
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [notFound, setNotFound] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    if (entryId) {
      const e = getEntry(entryId);
      if (!e) {
        setNotFound(true);
        return;
      }
      setDraft({ title: e.title, body: e.body, verses: e.verses });
    } else {
      const d = loadDraft();
      if (d) setDraft(d);
    }
    loaded.current = true;
  }, [entryId]);

  // 새 새김은 유실 방지를 위해 초안 자동 저장
  useEffect(() => {
    if (!isNew || !loaded.current) return;
    const t = setTimeout(() => saveDraft(draft), 400);
    return () => clearTimeout(t);
  }, [draft, isNew]);

  if (notFound)
    return (
      <p className="p-8 text-sm text-ink/70">
        기록을 찾을 수 없습니다. <a href="#/write" className="text-dawn">목록으로</a>
      </p>
    );

  const canSave = draft.body.trim().length > 0;

  const onSave = () => {
    if (!canSave) return;
    saveEntry(
      { ...draft, title: draft.title.trim(), body: draft.body.trim() },
      entryId
    );
    if (isNew) clearDraft();
    navigate("/write");
  };

  const onDelete = () => {
    if (!entryId) return;
    if (window.confirm("이 새김을 지울까요? 되돌릴 수 없습니다.")) {
      deleteEntry(entryId);
      navigate("/write");
    }
  };

  const addVerse = (ref: VerseRef) => {
    setDraft((d) =>
      d.verses.some(
        (v) =>
          v.bookId === ref.bookId && v.chapter === ref.chapter && v.verse === ref.verse
      )
        ? d
        : { ...d, verses: [...d.verses, ref] }
    );
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 md:py-14">
      <div className="flex items-center justify-between">
        <a href="#/write" className="text-xs text-ink/45 hover:text-dawn">
          ← 새김 목록
        </a>
        {!isNew && (
          <button
            onClick={onDelete}
            className="text-xs text-ink/40 hover:text-red-700"
          >
            지우기
          </button>
        )}
      </div>

      <input
        type="text"
        value={draft.title}
        onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
        placeholder="제목 (선택)"
        aria-label="제목"
        className="mt-8 w-full bg-transparent font-serif text-xl font-semibold placeholder:text-ink/25 focus:outline-none"
      />
      <textarea
        value={draft.body}
        onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
        placeholder="오늘 있었던 일을 적어보세요. 있는 그대로, 짧아도 좋습니다."
        aria-label="본문"
        rows={10}
        className="mt-4 w-full bg-transparent text-[15px] leading-7 placeholder:text-ink/25 focus:outline-none resize-y"
      />

      {draft.verses.length > 0 && (
        <div className="mt-6 space-y-4">
          {draft.verses.map((v, i) => (
            <VerseQuote
              key={`${v.bookId}-${v.chapter}-${v.verse}`}
              refValue={v}
              onRemove={() =>
                setDraft((d) => ({
                  ...d,
                  verses: d.verses.filter((_, j) => j !== i),
                }))
              }
            />
          ))}
        </div>
      )}

      <div className="mt-8">
        {showPicker ? (
          <VersePicker
            onPick={(ref) => {
              addVerse(ref);
              setShowPicker(false);
            }}
          />
        ) : (
          <button
            onClick={() => setShowPicker(true)}
            className="text-sm text-dawn hover:brightness-110"
          >
            + 말씀 붙이기
          </button>
        )}
      </div>

      <div className="mt-12 flex items-center gap-3">
        <button
          onClick={onSave}
          disabled={!canSave}
          className="bg-ink text-hanji text-sm rounded-full px-6 py-2.5 hover:bg-ink-soft transition-colors disabled:opacity-40"
        >
          새기기
        </button>
        {isNew && (
          <span className="text-[11px] text-ink/35">
            초안은 자동으로 임시 저장됩니다.
          </span>
        )}
      </div>
    </div>
  );
}

export default Editor;
