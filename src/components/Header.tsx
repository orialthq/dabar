const LINKS = [
  { hash: "#/read", label: "읽다" },
  { hash: "#/search", label: "찾다" },
  { hash: "#/ask", label: "묻다" },
  { hash: "#/write", label: "새기다" },
];

interface Props {
  active: string; // "read" | "search" | ""
}

function Header({ active }: Props) {
  return (
    <header className="sticky top-0 z-10 bg-ink/95 backdrop-blur border-b border-hanji/10 px-6 py-4 md:px-12 flex items-center gap-6">
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
      <nav className="flex items-center gap-4 text-sm flex-1">
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
        <a
          href="#/settings"
          aria-label="설정"
          className={`ml-auto text-xs ${
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
