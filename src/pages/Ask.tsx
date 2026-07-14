import { useEffect, useRef, useState } from "react";
import type { VerseRef } from "../types/journal";
import type { ChatMessage } from "../lib/engine";
import { loadEngineSettings, isWebGpuAvailable, isWebllmLoaded } from "../lib/engine";
import { buildContext, ask } from "../lib/ask";
import { prepareSemantic } from "../lib/semantic";
import VerseQuote from "../components/VerseQuote";

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
  const needsConsent = settings.kind === "webllm" && !isWebllmLoaded(settings.webllmModel);
  const [gate, setGate] = useState<Gate>(() => {
    if (settings.kind === "webllm" && !isWebGpuAvailable()) return { kind: "unsupported" };
    return needsConsent ? { kind: "consent" } : { kind: "ready" };
  });
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
            ? { ...t, pending: false, error: e instanceof Error ? e.message : "오류가 발생했습니다" }
            : t
        )
      );
    }
  };

  if (gate.kind === "unsupported")
    return (
      <div className="max-w-2xl mx-auto px-6 py-14">
        <h1 className="font-serif text-xl font-semibold">묻다</h1>
        <p className="mt-4 text-sm text-ink/70 leading-6">
          기본 엔진(내 기기에서 실행)은 WebGPU 지원 브라우저가 필요한데, 이 브라우저에서는
          사용할 수 없습니다. 최신 Chrome/Edge/Safari로 열거나,{" "}
          <a href="#/settings" className="text-dawn">
            설정
          </a>
          에서 다른 엔진(Ollama·Anthropic)을 선택하세요.
        </p>
        <p className="mt-3 text-xs text-ink/45">
          읽다·찾다·새기다(말씀 추천 포함)는 이 브라우저에서도 모두 동작합니다.
        </p>
      </div>
    );

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 md:py-14 flex flex-col min-h-[70vh]">
      <div className="flex items-baseline justify-between">
        <h1 className="font-serif text-xl font-semibold">묻다</h1>
        <a href="#/settings" className="text-xs text-ink/40 hover:text-dawn">
          엔진: {settings.kind === "webllm" ? "내 기기" : settings.kind} · 설정
        </a>
      </div>
      <p className="mt-1 text-xs text-ink/50">
        일상과 신앙의 물음을 적어보세요. 관련 말씀을 찾아 그 안에서 함께 생각합니다.
        답은 참고일 뿐, 말씀 앞에서 스스로 상고하세요.
      </p>

      {gate.kind === "consent" && (
        <div className="mt-6 border border-ink/15 rounded-lg p-4 bg-white/40">
          <p className="text-sm text-ink/80">묻다는 기기 안에서 동작하는 언어 모델을 사용합니다.</p>
          <p className="mt-1 text-xs text-ink/50 leading-5">
            처음 한 번, 약 2.3GB를 내려받습니다 (Wi-Fi 필수 권장). 이후에는 저장된 것을 다시 쓰며,
            대화는 이 기기 밖으로 나가지 않습니다. 첫 질문 시 다운로드가 시작됩니다.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={() => setGate({ kind: "ready" })}
              className="text-sm bg-ink text-hanji rounded px-4 py-1.5 hover:bg-ink-soft transition-colors"
            >
              알겠어요
            </button>
            <a href="#/settings" className="text-xs text-ink/40 hover:text-ink/70">
              다른 엔진 쓰기
            </a>
          </div>
        </div>
      )}

      <div className="flex-1 mt-6 space-y-8">
        {turns.map((t, i) => (
          <div key={i}>
            <p className="text-sm text-ink/60 bg-hanji-dim rounded-lg px-4 py-2.5 inline-block">
              {t.question}
            </p>
            <div className="mt-3">
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
        ))}
        {gate.kind === "loading" && (
          <div>
            <p className="text-xs text-ink/50">모델 준비 중 — {Math.round(gate.progress * 100)}%</p>
            <div className="mt-2 h-1 rounded bg-ink/10 overflow-hidden">
              <div className="h-full bg-dawn transition-all" style={{ width: `${gate.progress * 100}%` }} />
            </div>
            <p className="mt-1 text-[10px] text-ink/30 truncate">{gate.text}</p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="mt-8 flex gap-2">
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
          placeholder="예: 요즘 기도가 잘 안 되는데 어떻게 해야 할까요?"
          aria-label="질문"
          disabled={busy}
          className="flex-1 bg-white/70 border border-ink/20 rounded-full px-4 py-2.5 text-sm placeholder:text-ink/30 focus:outline-none focus:border-dawn disabled:opacity-50"
        />
        <button
          onClick={() => void run()}
          disabled={busy || !input.trim()}
          className="bg-ink text-hanji text-sm rounded-full px-5 hover:bg-ink-soft transition-colors disabled:opacity-40"
        >
          묻기
        </button>
      </div>
    </div>
  );
}

export default Ask;
