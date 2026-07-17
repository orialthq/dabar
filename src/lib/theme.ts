/** 다크 모드 (v0.7.0) — 새벽·밤 묵상을 위한 어두운 한지. 시스템 연동 + 명시 선택. */

export type ThemePref = "system" | "light" | "dark";

const KEY = "dabar:theme:v1";
const media = () => window.matchMedia("(prefers-color-scheme: dark)");

export function loadThemePref(): ThemePref {
  const v = localStorage.getItem(KEY);
  return v === "light" || v === "dark" ? v : "system";
}

export function isDarkNow(): boolean {
  return document.documentElement.classList.contains("dark");
}

function apply(pref: ThemePref): void {
  const dark = pref === "dark" || (pref === "system" && media().matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function setThemePref(pref: ThemePref): void {
  localStorage.setItem(KEY, pref);
  apply(pref);
}

/** 앱 시작 시 1회 — 저장된 선호 적용 + 시스템 변경 추적 */
export function initTheme(): void {
  apply(loadThemePref());
  media().addEventListener("change", () => {
    if (loadThemePref() === "system") apply("system");
  });
}
