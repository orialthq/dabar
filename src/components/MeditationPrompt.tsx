import { useState } from "react";
import type { VerseRef } from "../types/journal";
import { loadEngineSettings, isWebGpuAvailable, isWebllmLoaded, type EngineProgress } from "../lib/engine";
import { meditationQuestions } from "../lib/meditate";
import { ArrowDownToLine, DownloadCloud, MessageCircleQuestion, RotateCcw } from "lucide-react";

interface Props {
  body: string;
  verses: VerseRef[];
  /** 질문을 기록 본문에 덧붙이기 */
  onAppend: (question: string) => void;
}

type Status =
  | { kind: "idle" }
  | { kind: "consent" }
  | { kind: "loading"; progress: number | null }
  | { kind: "done"; questions: string[] }
  | { kind: "error"; message: string };

/** 새김에 담긴 말씀으로 묵상 질문 2~3개를 생성 (M5b, 엔진 설정 공유) */
function MeditationPrompt({ body, verses, onAppend }: Props) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const available = verses.length > 0 && body.trim().length >= 5;

  const run = async () => {
    setStatus({ kind: "loading", progress: null });
    try {
      const questions = await meditationQuestions(body, verses, {
        onProgress: (p: EngineProgress) =>
          setStatus({ kind: "loading", progress: p.progress }),
      });
      setStatus({ kind: "done", questions });
    } catch (e) {
      setStatus({
        kind: "error",
        message: e instanceof Error ? e.message : "묵상 질문을 만들지 못했습니다",
      });
    }
  };

  const start = () => {
    const s = loadEngineSettings();
    if (s.kind === "webllm") {
      if (!isWebGpuAvailable()) {
        setStatus({
          kind: "error",
          message: "이 브라우저에서는 열 수 없습니다. 설정에서 다른 응답 방식을 선택하세요.",
        });
        return;
      }
      if (!isWebllmLoaded(s.webllmModel)) {
        setStatus({ kind: "consent" });
        return;
      }
    }
    void run();
  };

  if (!available && status.kind === "idle") return null;

  if (status.kind === "idle")
    return (
      <button onClick={start} className="btn-ghost !text-dawn">
        <MessageCircleQuestion size={15} strokeWidth={1.8} aria-hidden="true" />
        이 말씀으로 묵상 질문 받기
      </button>
    );

  return (
    <div className="surface p-4 md:p-5">
      {status.kind === "consent" && (
        <>
          <span className="icon-tile mb-4">
            <DownloadCloud size={19} strokeWidth={1.7} aria-hidden="true" />
          </span>
          <p className="text-xs text-ink/50 leading-5">
            묵상 질문은 기기 안에서 동작하는 언어 모델을 사용합니다. 처음 한 번, 약 2.3GB를
            내려받습니다 (Wi-Fi 권장). 대화는 이 기기 밖으로 나가지 않습니다.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={() => void run()}
              className="btn-primary !min-h-9"
            >
              준비하고 받기
            </button>
            <button
              onClick={() => setStatus({ kind: "idle" })}
              className="btn-ghost"
            >
              다음에
            </button>
          </div>
        </>
      )}

      {status.kind === "loading" && (
        <>
          <p className="text-xs text-ink/50">
            묵상 질문 준비 중
            {status.progress !== null && ` — ${Math.round(status.progress * 100)}%`}
          </p>
          <div className="mt-2 h-1 rounded bg-ink/10 overflow-hidden">
            <div
              className="h-full bg-dawn transition-all"
              style={{ width: `${(status.progress ?? 0.05) * 100}%` }}
            />
          </div>
        </>
      )}

      {status.kind === "done" && (
        <>
          <p className="text-xs text-ink/50">말씀 곁에 머무르며, 하나를 골라 이어 적어보세요.</p>
          <ul className="mt-3 space-y-1">
            {status.questions.map((q) => (
              <li key={q}>
                <button
                  onClick={() => onAppend(q)}
                  className="group flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm leading-6 text-ink/75 hover:bg-dawn/6 hover:text-ink"
                  title="기록에 덧붙이기"
                >
                  <span className="flex-1">{q}</span>
                  <ArrowDownToLine size={14} strokeWidth={1.8} className="mt-1 shrink-0 text-dawn opacity-50 group-hover:opacity-100" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          <button
            onClick={() => void run()}
            className="btn-ghost mt-2"
          >
            <RotateCcw size={13} strokeWidth={1.8} aria-hidden="true" />
            다시 받기
          </button>
        </>
      )}

      {status.kind === "error" && (
        <p className="text-xs text-ink/60">
          {status.message}{" "}
          <a href="#/settings" className="text-dawn">
            설정
          </a>
        </p>
      )}
    </div>
  );
}

export default MeditationPrompt;
