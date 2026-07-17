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
import VerseSuggest from "../components/VerseSuggest";
import MeditationPrompt from "../components/MeditationPrompt";
import SimilarEntries from "../components/SimilarEntries";
import { ArrowLeft, Feather, Link2, Save, Trash2 } from "lucide-react";

interface Props {
  entryId?: string; // 없으면 새 새김
}

const EMPTY: Draft = { title: "", body: "", verses: [] };

function Editor({ entryId }: Props) {
  const isNew = !entryId;
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [notFound, setNotFound] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [stamping, setStamping] = useState(false);
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
        기록을 찾을 수 없습니다. <a href="#/write" className="text-dawn">새김 목록으로</a>
      </p>
    );

  const canSave = draft.body.trim().length > 0;

  const onSave = () => {
    if (!canSave || stamping) return;
    saveEntry(
      { ...draft, title: draft.title.trim(), body: draft.body.trim() },
      entryId
    );
    if (isNew) clearDraft();
    // 낙관이 찍히는 순간 — 모션 축소 선호 시 곧바로 이동
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      navigate("/write");
      return;
    }
    setStamping(true);
    setTimeout(() => navigate("/write"), 850);
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
    <div className="page-shell">
      <div className="flex items-center justify-between">
        <a href="#/write" className="btn-ghost">
          <ArrowLeft size={15} strokeWidth={1.8} aria-hidden="true" />
          새김 목록
        </a>
        {!isNew && (
          <button
            onClick={onDelete}
            className="btn-ghost hover:!text-red-700"
          >
            <Trash2 size={14} strokeWidth={1.8} aria-hidden="true" />
            지우기
          </button>
        )}
      </div>

      <div className="editor-sheet">
        <p className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.12em] text-dawn">
          <Feather size={13} strokeWidth={1.8} aria-hidden="true" />
          {isNew ? "새로운 새김" : "새김 고치기"}
        </p>
        <input
          type="text"
          value={draft.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          placeholder="제목 (선택)"
          aria-label="제목"
          className="mt-6 w-full bg-transparent font-serif text-2xl font-semibold tracking-[-0.03em] placeholder:text-ink/22 focus:outline-none"
        />
        <div className="section-divider mt-5" />
        <textarea
          value={draft.body}
          onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
          placeholder="오늘 있었던 일을 적어보세요. 있는 그대로, 짧아도 좋습니다."
          aria-label="본문"
          rows={11}
          className="mt-5 w-full resize-y bg-transparent text-[15px] leading-8 placeholder:text-ink/25 focus:outline-none"
        />
      </div>

      {draft.verses.length > 0 && (
        <div className="mt-7 space-y-4">
          <p className="section-label">
            <Link2 size={15} strokeWidth={1.8} className="text-dawn" aria-hidden="true" />
            이 새김에 담긴 말씀
          </p>
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

      <div className="mt-8 space-y-3 border-t border-ink/9 pt-6">
        <div>
          <VerseSuggest
            body={draft.body}
            onPick={addVerse}
            onFallback={() => setShowPicker(true)}
          />
        </div>
        <div>
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
              className="btn-ghost !text-dawn"
            >
              <Link2 size={14} strokeWidth={1.8} aria-hidden="true" />
              말씀 붙이기
            </button>
          )}
        </div>
        <div>
          <MeditationPrompt
            body={draft.body}
            verses={draft.verses}
            onAppend={(q) =>
              setDraft((d) => ({
                ...d,
                body: `${d.body.trimEnd()}\n\n${q}\n`,
              }))
            }
          />
        </div>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <button
          onClick={onSave}
          disabled={!canSave}
          className="btn-primary"
        >
          <Save size={16} strokeWidth={1.8} aria-hidden="true" />
          새기기
        </button>
        {isNew && (
          <span className="text-[11px] text-ink/35">
            쓰다 만 새김도 자동으로 간직됩니다.
          </span>
        )}
      </div>

      {entryId && <SimilarEntries entryId={entryId} />}

      {stamping && (
        <div className="stamp-overlay" aria-hidden="true">
          <span className="stamp seal w-24 h-24 text-4xl">דבר</span>
        </div>
      )}
    </div>
  );
}

export default Editor;
