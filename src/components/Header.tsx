import { useState } from "react";
import {
  BookOpenText,
  Feather,
  MessageCircleQuestion,
  Moon,
  Search,
  Settings,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { isDarkNow, setThemePref } from "../lib/theme";

const LINKS: { hash: string; route: string; label: string; icon: LucideIcon }[] = [
  { hash: "#/read", route: "read", label: "읽다", icon: BookOpenText },
  { hash: "#/search", route: "search", label: "찾다", icon: Search },
  { hash: "#/ask", route: "ask", label: "묻다", icon: MessageCircleQuestion },
  { hash: "#/write", route: "write", label: "새기다", icon: Feather },
];

interface Props {
  active: string;
}

function ThemeToggle() {
  const [dark, setDark] = useState(isDarkNow);
  const Icon = dark ? Sun : Moon;

  return (
    <button
      onClick={() => {
        const next = !dark;
        setThemePref(next ? "dark" : "light");
        setDark(next);
      }}
      aria-label={dark ? "밝게 보기" : "어둡게 보기"}
      title={dark ? "밝게 보기" : "어둡게 보기"}
      className="icon-btn-dark"
    >
      <Icon size={17} strokeWidth={1.8} />
    </button>
  );
}

function Header({ active }: Props) {
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a href="#/" className="flex items-center gap-2.5 shrink-0 group" aria-label="다바르 홈">
            <span className="brand-glyph" aria-hidden="true">ד</span>
            <span className="font-serif text-[17px] font-bold tracking-[-0.03em] text-hanji">
              다바르
            </span>
            <span className="hidden lg:inline text-[9px] text-mist/65 tracking-[0.2em] uppercase mt-0.5">
              dabar
            </span>
          </a>

          <nav className="desktop-nav ml-2" aria-label="주요 메뉴">
            {LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <a
                  key={link.hash}
                  href={link.hash}
                  className="nav-link"
                  data-active={active === link.route}
                  aria-current={active === link.route ? "page" : undefined}
                >
                  <Icon size={15} strokeWidth={1.8} aria-hidden="true" />
                  {link.label}
                </a>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-0.5">
            <ThemeToggle />
            <a
              href="#/settings"
              aria-label="설정"
              title="설정"
              className={`icon-btn-dark ${active === "settings" ? "!text-dawn !bg-dawn/10" : ""}`}
            >
              <Settings size={17} strokeWidth={1.8} />
            </a>
          </div>
        </div>
      </header>

      <nav className="mobile-nav" aria-label="주요 메뉴">
        {LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <a
              key={link.hash}
              href={link.hash}
              className="mobile-nav-link"
              data-active={active === link.route}
              aria-current={active === link.route ? "page" : undefined}
            >
              <Icon size={19} strokeWidth={1.7} aria-hidden="true" />
              <span>{link.label}</span>
            </a>
          );
        })}
      </nav>
    </>
  );
}

export default Header;
