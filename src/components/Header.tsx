const LINKS = [
  { hash: "#/read", label: "읽다" },
  { hash: "#/search", label: "찾다" },
  { hash: "#/write", label: "새기다" },
];

interface Props {
  active: string; // "read" | "search" | ""
}

function Header({ active }: Props) {
  return (
    <header className="sticky top-0 z-10 bg-ink/95 backdrop-blur border-b border-hanji/10 px-6 py-4 md:px-12 flex items-center gap-6">
      <a href="#/" className="flex items-baseline gap-2 shrink-0">
        <span className="font-serif text-lg font-bold tracking-tight text-hanji">
          다바르
        </span>
        <span className="hidden md:inline text-[10px] text-mist tracking-widest uppercase">
          dabar
        </span>
      </a>
      <nav className="flex items-center gap-4 text-sm">
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
      </nav>
    </header>
  );
}

export default Header;
