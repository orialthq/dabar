import { useState } from "react";
import type { EngineKind, EngineSettings } from "../lib/engine";
import { loadEngineSettings, saveEngineSettings, isWebGpuAvailable } from "../lib/engine";
import { loadThemePref, setThemePref, type ThemePref } from "../lib/theme";
import {
  Cloud,
  Laptop,
  Monitor,
  Moon,
  Save,
  Server,
  Settings as SettingsIcon,
  Sun,
  type LucideIcon,
} from "lucide-react";

const THEMES: { value: ThemePref; label: string }[] = [
  { value: "system", label: "시스템" },
  { value: "light", label: "한지" },
  { value: "dark", label: "새벽" },
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

const ENGINE_ICONS: Record<EngineKind, LucideIcon> = {
  webllm: Laptop,
  ollama: Server,
  anthropic: Cloud,
};

const THEME_ICONS: Record<ThemePref, LucideIcon> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

const inputCls =
  "field mt-1";

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
    <div className="page-shell">
      <p className="page-kicker">
        <SettingsIcon size={14} strokeWidth={1.8} aria-hidden="true" />
        PREFERENCES
      </p>
      <h1 className="page-title">설정</h1>

      <div className="surface mt-8 p-5 md:p-6">
        <h2 className="section-label">화면</h2>
        <div className="segmented mt-4 flex w-full">
          {THEMES.map((t) => {
            const Icon = THEME_ICONS[t.value];
            return (
              <button
                key={t.value}
                onClick={() => {
                  setThemePref(t.value);
                  setTheme(t.value);
                }}
                className="segmented-button flex-1 justify-center"
                data-active={theme === t.value}
              >
                <Icon size={14} strokeWidth={1.8} aria-hidden="true" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <h2 className="section-label mt-10">묻다의 응답 방식</h2>
      <p className="mt-1 text-xs text-ink/50">
        묻다의 응답을 어디에서 만들지 고릅니다. 말씀 찾기(새기다)는 언제나 기기 안에서 동작합니다.
      </p>

      <div className="mt-6 space-y-3">
        {ENGINES.map((e) => {
          const Icon = ENGINE_ICONS[e.kind];
          return (
          <label
            key={e.kind}
            className={`surface block cursor-pointer p-5 transition ${
              s.kind === e.kind ? "!border-dawn/65 !bg-dawn/5" : "hover:!border-ink/25"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="icon-tile !h-10 !w-10 !rounded-xl">
                <Icon size={18} strokeWidth={1.7} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1 text-sm font-semibold">{e.name}</span>
              <input
                type="radio"
                name="engine"
                checked={s.kind === e.kind}
                onChange={() => update({ kind: e.kind })}
                className="accent-[#D98E32]"
              />
            </div>
            <p className="mt-3 text-xs text-ink/55 leading-5">{e.desc}</p>

            {s.kind === "webllm" && e.kind === "webllm" && (
              <div className="mt-4 border-t border-ink/8 pt-4 space-y-2">
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
                    className={inputCls}
                  >
                    <option value="Qwen3-4B-q4f16_1-MLC">Qwen3 4B (기본, 약 2.3GB)</option>
                    <option value="Qwen3.5-4B-q4f16_1-MLC">Qwen3.5 4B (약 2.5GB)</option>
                    <option value="Qwen3-1.7B-q4f16_1-MLC">Qwen3 1.7B (가벼움, 약 1.1GB)</option>
                  </select>
                </label>
              </div>
            )}

            {s.kind === "ollama" && e.kind === "ollama" && (
              <div className="mt-4 grid grid-cols-1 gap-3 border-t border-ink/8 pt-4 md:grid-cols-2">
                <label className="block text-xs text-ink/50">
                  서버 주소
                  <input
                    type="text"
                    value={s.ollamaUrl}
                    onChange={(ev) => update({ ollamaUrl: ev.target.value })}
                    placeholder="http://localhost:11434"
                    className={inputCls}
                  />
                </label>
                <label className="block text-xs text-ink/50">
                  모델 이름
                  <input
                    type="text"
                    value={s.ollamaModel}
                    onChange={(ev) => update({ ollamaModel: ev.target.value })}
                    placeholder="qwen3:4b"
                    className={inputCls}
                  />
                </label>
              </div>
            )}

            {s.kind === "anthropic" && e.kind === "anthropic" && (
              <div className="mt-4 space-y-3 border-t border-ink/8 pt-4">
                <label className="block text-xs text-ink/50">
                  API 키
                  <input
                    type="password"
                    value={s.anthropicKey}
                    onChange={(ev) => update({ anthropicKey: ev.target.value })}
                    placeholder="sk-ant-..."
                    autoComplete="off"
                    className={inputCls}
                  />
                </label>
                <label className="block text-xs text-ink/50">
                  모델
                  <input
                    type="text"
                    value={s.anthropicModel}
                    onChange={(ev) => update({ anthropicModel: ev.target.value })}
                    className={inputCls}
                  />
                </label>
                <p className="text-[11px] text-ink/40 leading-4">
                  키는 이 브라우저(localStorage)에만 저장됩니다. 공용 기기에서는 사용하지 마세요.
                </p>
              </div>
            )}
          </label>
          );
        })}
      </div>

      <div className="mt-8 flex items-center gap-3">
        <button
          onClick={onSave}
          className="btn-primary"
        >
          <Save size={16} strokeWidth={1.8} aria-hidden="true" />
          저장
        </button>
        {saved && <span className="text-xs text-ink/45">저장되었습니다.</span>}
      </div>
    </div>
  );
}

export default Settings;
