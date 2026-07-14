/**
 * 챗 엔진 추상화 (M5b).
 * generate(system, messages) → text 인터페이스 하나로 세 구현을 통일한다:
 * - webllm: 브라우저 내 실행(WebGPU, 기본). 대화가 기기 밖으로 나가지 않는다.
 * - ollama: 로컬 서버(개발·파워유저용).
 * - anthropic: BYOK — 사용자가 설정에서 명시 선택한 경우에만 외부 전송 (절대 규칙 4).
 * 어떤 구현도 성경 본문을 생성·표시하지 않는다. 본문 렌더링은 항상 로컬 DB (절대 규칙 1).
 */

export type EngineKind = "webllm" | "ollama" | "anthropic";

export interface EngineSettings {
  kind: EngineKind;
  webllmModel: string;
  ollamaUrl: string;
  ollamaModel: string;
  anthropicKey: string;
  anthropicModel: string;
}

export const ENGINE_DEFAULTS: EngineSettings = {
  kind: "webllm",
  webllmModel: "Qwen3-4B-q4f16_1-MLC", // SPEC-M5 기본. 설정에서 교체 가능
  ollamaUrl: "http://localhost:11434",
  ollamaModel: "qwen3:4b",
  anthropicKey: "",
  anthropicModel: "claude-haiku-4-5-20251001",
};

const SETTINGS_KEY = "dabar:engine:v1";

export function loadEngineSettings(): EngineSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...ENGINE_DEFAULTS };
    return { ...ENGINE_DEFAULTS, ...(JSON.parse(raw) as Partial<EngineSettings>) };
  } catch {
    return { ...ENGINE_DEFAULTS };
  }
}

export function saveEngineSettings(s: EngineSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export type EngineProgress = { text: string; progress: number }; // progress 0~1

export interface GenerateOptions {
  /** 스트리밍 토큰 콜백 — 누적 텍스트가 아니라 증분 조각을 전달 */
  onToken?: (delta: string) => void;
  /** webllm 모델 다운로드/로드 진행 */
  onProgress?: (p: EngineProgress) => void;
  /** 기본 0.7 — 형식이 엄격한 출력(묵상 질문 등)은 낮춰서 안정화 */
  temperature?: number;
}

/** Qwen3 계열 thinking 블록 제거 (enable_thinking=false와 이중 안전장치) */
function stripThink(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

export function isWebGpuAvailable(): boolean {
  return "gpu" in navigator;
}

// ---- webllm ----
type MLCEngine = {
  chat: {
    completions: {
      create(req: unknown): Promise<AsyncIterable<{
        choices: { delta: { content?: string | null } }[];
      }>>;
    };
  };
};

let mlcEnginePromise: Promise<MLCEngine> | null = null;
let mlcEngineModel: string | null = null;

function loadWebllm(model: string, onProgress?: (p: EngineProgress) => void): Promise<MLCEngine> {
  if (!mlcEnginePromise || mlcEngineModel !== model) {
    mlcEngineModel = model;
    mlcEnginePromise = (async () => {
      const { CreateMLCEngine } = await import("@mlc-ai/web-llm");
      const engine = await CreateMLCEngine(model, {
        initProgressCallback: (r: { text: string; progress: number }) =>
          onProgress?.({ text: r.text, progress: r.progress }),
      });
      return engine as unknown as MLCEngine;
    })();
    mlcEnginePromise.catch(() => {
      mlcEnginePromise = null;
      mlcEngineModel = null;
    });
  }
  return mlcEnginePromise;
}

export function isWebllmLoaded(model: string): boolean {
  return mlcEnginePromise !== null && mlcEngineModel === model;
}

async function generateWebllm(
  s: EngineSettings,
  system: string,
  messages: ChatMessage[],
  opts: GenerateOptions
): Promise<string> {
  const engine = await loadWebllm(s.webllmModel, opts.onProgress);
  const chunks = await engine.chat.completions.create({
    messages: [{ role: "system", content: system }, ...messages],
    stream: true,
    temperature: opts.temperature ?? 0.7,
    max_tokens: 1024,
    extra_body: { enable_thinking: false },
  });
  let full = "";
  let inThink = false;
  for await (const chunk of chunks) {
    const delta = chunk.choices[0]?.delta.content ?? "";
    if (!delta) continue;
    full += delta;
    // 스트리밍 중 think 블록은 사용자에게 흘리지 않는다
    if (delta.includes("<think>")) inThink = true;
    if (!inThink) opts.onToken?.(delta);
    if (delta.includes("</think>")) inThink = false;
  }
  return stripThink(full);
}

// ---- ollama ----
async function generateOllama(
  s: EngineSettings,
  system: string,
  messages: ChatMessage[],
  opts: GenerateOptions
): Promise<string> {
  const res = await fetch(`${s.ollamaUrl.replace(/\/$/, "")}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: s.ollamaModel,
      messages: [{ role: "system", content: system }, ...messages],
      stream: true,
      think: false,
      options: { temperature: opts.temperature ?? 0.7 },
    }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`ollama 응답 오류 (${res.status}) — 서버와 모델(${s.ollamaModel})을 확인하세요`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let full = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const j = JSON.parse(line) as { message?: { content?: string }; error?: string };
      if (j.error) throw new Error(`ollama: ${j.error}`);
      const delta = j.message?.content ?? "";
      if (delta) {
        full += delta;
        opts.onToken?.(delta);
      }
    }
  }
  return stripThink(full);
}

// ---- anthropic (BYOK) ----
async function generateAnthropic(
  s: EngineSettings,
  system: string,
  messages: ChatMessage[]
): Promise<string> {
  if (!s.anthropicKey) throw new Error("설정에서 Anthropic API 키를 입력하세요");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": s.anthropicKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: s.anthropicModel,
      max_tokens: 1024,
      system,
      messages,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API 오류 (${res.status}): ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { content: { type: string; text?: string }[] };
  return data.content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("")
    .trim();
}

/** 설정된 엔진으로 생성. 반환 텍스트에 성경 본문 인용이 있어도 표시는 참조 해석(로컬 DB)만 사용할 것. */
export async function generate(
  system: string,
  messages: ChatMessage[],
  opts: GenerateOptions = {}
): Promise<string> {
  const s = loadEngineSettings();
  switch (s.kind) {
    case "webllm":
      return generateWebllm(s, system, messages, opts);
    case "ollama":
      return generateOllama(s, system, messages, opts);
    case "anthropic":
      return generateAnthropic(s, system, messages);
  }
}
