import { useState } from "react";
import { isDarkNow, setThemePref } from "../lib/theme";

const LINKS = [
  { hash: "#/read", label: "읽다" },
  { hash: "#/search", label: "찾다" },
  { hash: "#/ask", label: "묻다" },
  { hash: "#/write", label: "새기다" },
];

interface Props {
  active: string; // "read" | "search" | ""
}

/** 밝게/어둡게 빠른 전환 — 세밀한 선택(시스템 따르기)은 설정에 */
function ThemeToggle() {
  const [dark, setDark] = useState(isDarkNow);
  return (
    <button
      onClick={() => {
        const next = !dark;
        setThemePref(next ? "dark" : "light");
        setDark(next);
      }}
      aria-label={dark ? "밝게 보기" : "어둡게 보기"}
      title={dark ? "밝게 보기" : "어둡게 보기"}
      className="ml-auto text-sm text-mist/70 hover:text-hanji transition-colors leading-none"
    >
      {dark ? "☀" : "☾"}
    </button>
  );
}

function Header({ active }: Props) {
  return (
    <header className="sticky top-0 z-10 bg-ink/95 backdrop-blur border-b border-hanji/10 px-4 py-4 md:px-12 flex items-center gap-4 md:gap-6">
      <a href="#/" className="flex items-center gap-2.5 shrink-0">
        <svg viewBox="0 0 64 64" aria-hidden="true" className="w-6 h-6 rounded-md">
          <rect width="64" height="64" rx="14" fill="#1B2230" />
          <g fill="#D98E32">
            <rect x="18" y="18" width="28" height="7.5" rx="1.5" />
            <rect x="37.5" y="23" width="7.5" height="22" rx="1.5" />
            <circle cx="29" cy="34.5" r="3" />
          </g>
          <rect x="18" y="50" width="28" height="1.6" rx="0.8" fill="#F7F3EA" opacity="0.45" />
        </svg>
        <span className="font-serif text-lg font-bold tracking-tight text-hanji">
          다바르
        </span>
        <span className="hidden md:inline text-[10px] text-mist tracking-widest uppercase self-center mt-0.5">
          dabar
        </span>
      </a>
      <nav className="flex items-center gap-3 md:gap-4 text-sm flex-1 whitespace-nowrap">
        {LINKS.map((l) => (
          <a
            key={l.hash}
            href={l.hash}
            className={
              l.hash === `#/${active}`
                ? "text-dawn font-medium"
                : "text-mist hover:text-hanji transition-colors"
            }
          >
            {l.label}
          </a>
        ))}
        <ThemeToggle />
        <a
          href="#/settings"
          aria-label="설정"
          className={`text-xs ${
            active === "settings" ? "text-dawn" : "text-mist/70 hover:text-hanji"
          } transition-colors`}
        >
          설정
        </a>
      </nav>
    </header>
  );
}

export default Header;
