import { useState } from "react";
import type { EngineKind, EngineSettings } from "../lib/engine";
import { loadEngineSettings, saveEngineSettings, isWebGpuAvailable } from "../lib/engine";
import { loadThemePref, setThemePref, type ThemePref } from "../lib/theme";

const THEMES: { value: ThemePref; label: string }[] = [
  { value: "system", label: "시스템 따르기" },
  { value: "light", label: "밝게 (한지)" },
  { value: "dark", label: "어둡게 (새벽)" },
];

const ENGINES: { kind: EngineKind; name: string; desc: string }[] = [
  {
    kind: "webllm",
    name: "내 기기에서 실행 (기본)",
    desc: "브라우저 안에서 동작합니다. 대화가 기기 밖으로 나가지 않습니다. 최초 1회 모델 다운로드(약 2.3GB)와 WebGPU 지원 브라우저가 필요합니다.",
  },
  {
    kind: "ollama",
    name: "Ollama (로컬 서버)",
    desc: "내 컴퓨터의 Ollama 서버를 사용합니다. 대화는 이 컴퓨터 안에서만 오갑니다.",
  },
  {
    kind: "anthropic",
    name: "Anthropic API (내 키 사용)",
    desc: "내 API 키로 Anthropic에 연결합니다. 선택 시 질문 내용이 Anthropic 서버로 전송됩니다.",
  },
];

const inputCls =
  "w-full bg-white/70 border border-ink/20 rounded px-3 py-1.5 text-sm placeholder:text-ink/30 focus:outline-none focus:border-dawn";

function Settings() {
  const [s, setS] = useState<EngineSettings>(loadEngineSettings);
  const [saved, setSaved] = useState(false);
  const [theme, setTheme] = useState<ThemePref>(loadThemePref);

  const update = (patch: Partial<EngineSettings>) => {
    setS((prev) => ({ ...prev, ...patch }));
    setSaved(false);
  };

  const onSave = () => {
    saveEngineSettings(s);
    setSaved(true);
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 md:py-14">
      <h1 className="font-serif text-xl font-semibold">설정</h1>

      <h2 className="mt-6 text-sm font-medium">화면</h2>
      <div className="mt-2 flex gap-2">
        {THEMES.map((t) => (
          <button
            key={t.value}
            onClick={() => {
              setThemePref(t.value);
              setTheme(t.value);
            }}
            className={`text-xs rounded-full px-4 py-1.5 border transition-colors ${
              theme === t.value
                ? "border-dawn bg-dawn/15 text-ink"
                : "border-ink/15 text-ink/50 hover:border-ink/35"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <h2 className="mt-8 text-sm font-medium">묻다</h2>
      <p className="mt-1 text-xs text-ink/50">
        묻다의 응답을 어디에서 만들지 고릅니다. 말씀 찾기(새기다)는 언제나 기기 안에서 동작합니다.
      </p>

      <div className="mt-6 space-y-3">
        {ENGINES.map((e) => (
          <label
            key={e.kind}
            className={`block border rounded-lg p-4 cursor-pointer transition-colors ${
              s.kind === e.kind ? "border-dawn bg-white/50" : "border-ink/15 bg-white/30 hover:border-ink/30"
            }`}
          >
            <div className="flex items-center gap-3">
              <input
                type="radio"
                name="engine"
                checked={s.kind === e.kind}
                onChange={() => update({ kind: e.kind })}
                className="accent-[#D98E32]"
              />
              <span className="text-sm font-medium">{e.name}</span>
            </div>
            <p className="mt-1.5 ml-7 text-xs text-ink/55 leading-5">{e.desc}</p>

            {s.kind === "webllm" && e.kind === "webllm" && (
              <div className="mt-3 ml-7 space-y-2">
                {!isWebGpuAvailable() && (
                  <p className="text-xs text-red-800/80">
                    이 브라우저는 WebGPU를 지원하지 않습니다. 다른 엔진을 선택하세요.
                  </p>
                )}
                <label className="block text-xs text-ink/50">
                  모델
                  <select
                    value={s.webllmModel}
                    onChange={(ev) => update({ webllmModel: ev.target.value })}
                    className={`mt-1 ${inputCls}`}
                  >
                    <option value="Qwen3-4B-q4f16_1-MLC">Qwen3 4B (기본, 약 2.3GB)</option>
                    <option value="Qwen3.5-4B-q4f16_1-MLC">Qwen3.5 4B (약 2.5GB)</option>
                    <option value="Qwen3-1.7B-q4f16_1-MLC">Qwen3 1.7B (가벼움, 약 1.1GB)</option>
                  </select>
                </label>
              </div>
            )}

            {s.kind === "ollama" && e.kind === "ollama" && (
              <div className="mt-3 ml-7 grid grid-cols-1 md:grid-cols-2 gap-2">
                <label className="block text-xs text-ink/50">
                  서버 주소
                  <input
                    type="text"
                    value={s.ollamaUrl}
                    onChange={(ev) => update({ ollamaUrl: ev.target.value })}
                    placeholder="http://localhost:11434"
                    className={`mt-1 ${inputCls}`}
                  />
                </label>
                <label className="block text-xs text-ink/50">
                  모델 이름
                  <input
                    type="text"
                    value={s.ollamaModel}
                    onChange={(ev) => update({ ollamaModel: ev.target.value })}
                    placeholder="qwen3:4b"
                    className={`mt-1 ${inputCls}`}
                  />
                </label>
              </div>
            )}

            {s.kind === "anthropic" && e.kind === "anthropic" && (
              <div className="mt-3 ml-7 space-y-2">
                <label className="block text-xs text-ink/50">
                  API 키
                  <input
                    type="password"
                    value={s.anthropicKey}
                    onChange={(ev) => update({ anthropicKey: ev.target.value })}
                    placeholder="sk-ant-..."
                    autoComplete="off"
                    className={`mt-1 ${inputCls}`}
                  />
                </label>
                <label className="block text-xs text-ink/50">
                  모델
                  <input
                    type="text"
                    value={s.anthropicModel}
                    onChange={(ev) => update({ anthropicModel: ev.target.value })}
                    className={`mt-1 ${inputCls}`}
                  />
                </label>
                <p className="text-[11px] text-ink/40 leading-4">
                  키는 이 브라우저(localStorage)에만 저장됩니다. 공용 기기에서는 사용하지 마세요.
                </p>
              </div>
            )}
          </label>
        ))}
      </div>

      <div className="mt-8 flex items-center gap-3">
        <button
          onClick={onSave}
          className="bg-ink text-hanji text-sm rounded-full px-6 py-2.5 hover:bg-ink-soft transition-colors"
        >
          저장
        </button>
        {saved && <span className="text-xs text-ink/45">저장되었습니다.</span>}
      </div>
    </div>
  );
}

export default Settings;
