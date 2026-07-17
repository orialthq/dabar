import { useEffect, useRef, useState } from "react";
import type { VerseRef } from "../types/journal";
import type { ChatMessage } from "../lib/engine";
import {
  loadEngineSettings,
  isWebGpuAvailable,
  isWebllmLoaded,
  isWebllmCached,
} from "../lib/engine";
import { buildContext, ask } from "../lib/ask";
import { prepareSemantic } from "../lib/semantic";
import VerseQuote from "../components/VerseQuote";
import {
  Cpu,
  MessageCircleQuestion,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

interface Turn {
  question: string;
  answer: string; // 스트리밍 중에는 부분 텍스트
  refs: VerseRef[];
  pending: boolean;
  error?: string;
}

type Gate =
  | { kind: "checking" }
  | { kind: "unsupported" } // webllm 선택 + WebGPU 없음
  | { kind: "consent" } // webllm 최초 다운로드 동의
  | { kind: "loading"; text: string; progress: number }
  | { kind: "ready" };

function Ask() {
  const settings = loadEngineSettings();
  const [gate, setGate] = useState<Gate>(() => {
    if (settings.kind === "webllm" && !isWebGpuAvailable()) return { kind: "unsupported" };
    if (settings.kind === "webllm" && !isWebllmLoaded(settings.webllmModel))
      return { kind: "checking" };
    return { kind: "ready" };
  });

  // 처음 받을 때만 동의 카드 — 캐시에 있으면 바로 사용
  useEffect(() => {
    if (gate.kind !== "checking") return;
    let alive = true;
    isWebllmCached(settings.webllmModel).then((cached) => {
      if (alive) setGate(cached ? { kind: "ready" } : { kind: "consent" });
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const busy = turns.some((t) => t.pending);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  const run = async () => {
    const question = input.trim();
    if (!question || busy) return;
    setInput("");
    setTurns((ts) => [...ts, { question, answer: "", refs: [], pending: true }]);
    try {
      // 임베딩 검색 준비(추천과 모델 공유, 이미 준비됐으면 즉시) → 관련 절 공급
      await prepareSemantic();
      const supplied = await buildContext(question);
      const history: ChatMessage[] = turns.flatMap((t) => [
        { role: "user" as const, content: t.question },
        { role: "assistant" as const, content: t.answer },
      ]);
      const result = await ask(question, history, supplied, {
        onToken: (delta) =>
          setTurns((ts) =>
            ts.map((t, i) => (i === ts.length - 1 ? { ...t, answer: t.answer + delta } : t))
          ),
        onProgress: (p) => setGate({ kind: "loading", text: p.text, progress: p.progress }),
      });
      setGate({ kind: "ready" });
      setTurns((ts) =>
        ts.map((t, i) =>
          i === ts.length - 1
            ? { ...t, answer: result.answer, refs: result.refs, pending: false }
            : t
        )
      );
    } catch (e) {
      setGate({ kind: "ready" });
      setTurns((ts) =>
        ts.map((t, i) =>
          i === ts.length - 1
            ? { ...t, pending: false, error: e instanceof Error ? e.message : "답을 만들지 못했습니다. 다시 물어봐 주세요." }
            : t
        )
      );
    }
  };

  if (gate.kind === "unsupported")
    return (
      <div className="page-shell">
        <p className="page-kicker">
          <MessageCircleQuestion size={14} strokeWidth={1.8} aria-hidden="true" />
          ASK
        </p>
        <h1 className="page-title">묻다</h1>
        <div className="surface mt-6 p-5">
          <p className="text-sm text-ink/70 leading-6">
          기본 응답 방식(내 기기에서 실행)은 WebGPU 지원 브라우저가 필요한데, 이 브라우저에서는
          사용할 수 없습니다. 최신 Chrome/Edge/Safari로 열거나,{" "}
          <a href="#/settings" className="text-dawn">
            설정
          </a>
          에서 다른 응답 방식(Ollama·Anthropic)을 선택하세요.
          </p>
          <p className="mt-3 text-xs text-ink/45">
          읽다·찾다·새기다(말씀 추천 포함)는 이 브라우저에서도 모두 동작합니다.
          </p>
        </div>
      </div>
    );

  return (
    <div className="page-shell flex min-h-[76vh] flex-col">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="page-kicker">
            <MessageCircleQuestion size={14} strokeWidth={1.8} aria-hidden="true" />
            ASK
          </p>
          <h1 className="page-title">묻다</h1>
        </div>
        <a href="#/settings" className="btn-secondary !min-h-9 !px-3 !text-[11px]">
          <Settings size={14} strokeWidth={1.8} aria-hidden="true" />
          {settings.kind === "webllm" ? "내 기기" : settings.kind === "ollama" ? "Ollama" : "Anthropic"}
        </a>
      </div>
      <p className="page-lead !mt-2 !text-xs">
        일상과 신앙의 물음을 적어보세요. 관련 말씀을 찾아 그 안에서 함께 생각합니다.
        답은 참고일 뿐, 말씀 앞에서 스스로 상고하세요.
      </p>

      {gate.kind === "consent" && (
        <div className="surface mt-6 p-5">
          <span className="icon-tile mb-4">
            <ShieldCheck size={19} strokeWidth={1.7} aria-hidden="true" />
          </span>
          <p className="text-sm text-ink/80">묻다는 기기 안에서 동작하는 언어 모델을 사용합니다.</p>
          <p className="mt-1 text-xs text-ink/50 leading-5">
            처음 한 번, 약 2.3GB를 내려받습니다 (Wi-Fi 필수 권장). 이후에는 저장된 것을 다시 쓰며,
            대화는 이 기기 밖으로 나가지 않습니다. 첫 질문 시 다운로드가 시작됩니다.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={() => setGate({ kind: "ready" })}
              className="btn-primary !min-h-9"
            >
              알겠어요
            </button>
            <a href="#/settings" className="btn-ghost">
              다른 응답 방식 쓰기
            </a>
          </div>
        </div>
      )}

      <div className="mt-8 flex-1 space-y-9">
        {turns.map((t, i) => (
          <div key={i}>
            <div className="flex justify-end">
              <p className="max-w-[88%] rounded-[1rem_1rem_0.25rem_1rem] bg-ink px-4 py-3 text-sm leading-6 text-hanji shadow-sm">
                {t.question}
              </p>
            </div>
            <div className="mt-4 flex gap-3">
              <span className="icon-tile !h-8 !w-8 !rounded-lg">
                <Sparkles size={15} strokeWidth={1.7} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
              {t.error ? (
                <p className="text-xs text-red-800/80">{t.error}</p>
              ) : (
                <>
                  <p className="text-[15px] leading-7 whitespace-pre-wrap">
                    {t.answer}
                    {t.pending && <span className="text-ink/30"> ▍</span>}
                  </p>
                  {t.refs.length > 0 && (
                    <div className="mt-4 space-y-3">
                      {t.refs.map((r) => (
                        <VerseQuote key={`${r.bookId}-${r.chapter}-${r.verse}`} refValue={r} />
                      ))}
                    </div>
                  )}
                </>
              )}
              </div>
            </div>
          </div>
        ))}
        {gate.kind === "loading" && (
          <div className="surface-soft p-4">
            <p className="flex items-center gap-2 text-xs text-ink/50">
              <Cpu size={14} strokeWidth={1.7} className="text-dawn" aria-hidden="true" />
              응답 준비 중 — {Math.round(gate.progress * 100)}%
            </p>
            <div className="mt-2 h-1 rounded bg-ink/10 overflow-hidden">
              <div className="h-full bg-dawn transition-all" style={{ width: `${gate.progress * 100}%` }} />
            </div>
            <p className="mt-1 text-[10px] text-ink/30 truncate">{gate.text}</p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="surface sticky bottom-4 mt-8 flex gap-2 p-2 shadow-[0_18px_45px_rgb(16_21_31_/_0.12)]">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void run();
            }
          }}
          placeholder="마음에 품은 물음을 적어보세요"
          aria-label="질문"
          disabled={busy}
          className="field !border-0 !bg-transparent !shadow-none"
        />
        <button
          onClick={() => void run()}
          disabled={busy || !input.trim()}
          className="btn-primary !h-11 !w-11 shrink-0 !px-0"
          aria-label="묻기"
        >
          <Send size={17} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export default Ask;
