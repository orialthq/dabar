import Header from "./components/Header";
import Landing from "./pages/Landing";
import Books from "./pages/Books";
import Chapter from "./pages/Chapter";
import Search from "./pages/Search";
import Journal from "./pages/Journal";
import Editor from "./pages/Editor";
import Ask from "./pages/Ask";
import Settings from "./pages/Settings";
import DesktopUpdate from "./components/DesktopUpdate";
import MonthReview from "./pages/MonthReview";
import { useHashRoute } from "./lib/router";

function App() {
  const route = useHashRoute();
  const section = route[0] ?? "";

  let page: JSX.Element;
  let light = false; // 읽기 화면은 한지(밝은) 배경

  if (section === "read" && route[1]) {
    const chapter = Math.max(1, parseInt(route[2] ?? "1", 10) || 1);
    const verse = route[3] ? parseInt(route[3], 10) || undefined : undefined;
    page = <Chapter bookId={route[1]} chapter={chapter} verse={verse} />;
    light = true;
  } else if (section === "read") {
    page = <Books />;
    light = true;
  } else if (section === "search") {
    page = <Search />;
    light = true;
  } else if (section === "ask") {
    page = <Ask />;
    light = true;
  } else if (section === "settings") {
    page = <Settings />;
    light = true;
  } else if (section === "write" && route[1] === "month" && route[2]) {
    page = <MonthReview ym={route[2]} />;
    light = true;
  } else if (section === "write" && route[1] === "new") {
    page = <Editor />;
    light = true;
  } else if (section === "write" && route[1]) {
    page = <Editor entryId={route[1]} />;
    light = true;
  } else if (section === "write") {
    page = <Journal />;
    light = true;
  } else {
    page = <Landing />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header active={section} />
      <main className={`flex-1 flex flex-col ${light ? "paper text-ink" : ""}`}>
        {page}
      </main>
      <footer
        className={`px-6 md:px-12 py-8 text-xs flex flex-col md:flex-row gap-2 md:gap-6 md:items-center ${
          light
            ? "paper text-ink/40 border-t-[4px] border-double border-ink/15"
            : "text-mist"
        }`}
      >
        <span>© 2026 OriAlt</span>
        <span>성경전서 개역한글판 (대한성서공회 역, 1961)</span>
        <span className="md:ml-auto flex items-center gap-4">
          <DesktopUpdate variant="footer" />
          <a
            href="https://orialthq.github.io/dabar/"
            target="_blank"
            rel="noreferrer"
            className="hover:text-dawn transition-colors"
          >
            orialthq.github.io/dabar
          </a>
        </span>
      </footer>
    </div>
  );
}

export default App;
