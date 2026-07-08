const FEATURES = [
  {
    step: "읽다",
    title: "성경 읽기와 검색",
    desc: "개역한글 전문을 책·장·절로 탐색하고 키워드로 찾아 읽습니다. 모든 구절은 원문 그대로, 한 글자도 바꾸지 않고 보여줍니다.",
    milestone: "M2",
  },
  {
    step: "묻다",
    title: "말씀에 묻기",
    desc: "궁금한 키워드를 묻거나, 내가 이해한 문맥이 맞는지 확인합니다. 답은 언제나 실제 구절과 함께 돌아옵니다.",
    milestone: "M4",
  },
  {
    step: "새기다",
    title: "다바르 기록",
    desc: "오늘 있었던 일을 씁니다. 그 하루에 닿는 말씀을 만나고, 나만의 통찰을 남깁니다. 기록이 쌓여 나의 신앙 연대기가 됩니다.",
    milestone: "M3",
  },
];

function App() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* 헤더 */}
      <header className="flex items-center justify-between px-6 py-5 md:px-12">
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-xl font-bold tracking-tight">
            다바르
          </span>
          <span className="text-xs text-mist tracking-widest uppercase">
            dabar
          </span>
        </div>
        <span className="text-xs text-mist border border-mist/30 rounded-full px-3 py-1">
          만드는 중 · by OriAlt
        </span>
      </header>

      {/* 히어로 — 한 단어, 두 개의 뜻 */}
      <main className="flex-1">
        <section className="px-6 md:px-12 pt-16 pb-24 md:pt-24 md:pb-32 max-w-4xl mx-auto text-center">
          <p
            lang="he"
            dir="rtl"
            aria-hidden="true"
            className="rise rise-1 font-serif text-6xl md:text-8xl text-dawn/90 select-none"
          >
            דָּבָר
          </p>
          <h1 className="rise rise-2 mt-8 font-serif text-3xl md:text-5xl font-semibold leading-snug md:leading-snug">
            말씀,
            <br className="md:hidden" /> 그리고 일어난 일
          </h1>
          <p className="rise rise-3 mt-6 text-mist text-base md:text-lg leading-relaxed max-w-2xl mx-auto">
            히브리어 <em className="not-italic text-hanji">다바르</em>는 하나의
            단어로 두 가지를 뜻합니다. <b className="text-hanji">말씀</b>, 그리고{" "}
            <b className="text-hanji">사건</b>. 오늘 당신에게 일어난 일을 쓰면,
            성경이 그 하루에 답합니다.
          </p>
          <p className="rise rise-4 mt-10 font-serif text-sm md:text-base text-dawn tracking-wide">
            당신의 다바르를, 다바르로.
          </p>
        </section>

        {/* 세 가지 동사 */}
        <section className="bg-hanji text-ink px-6 md:px-12 py-20 md:py-28">
          <div className="max-w-5xl mx-auto">
            <h2 className="font-serif text-2xl md:text-3xl font-semibold">
              세 가지 동사로 충분합니다
            </h2>
            <div className="mt-12 grid gap-10 md:grid-cols-3">
              {FEATURES.map((f) => (
                <article key={f.step} className="flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b border-ink/15 pb-3">
                    <span className="font-serif text-xl font-semibold">
                      {f.step}
                    </span>
                    <span className="text-[11px] tracking-widest text-ink/40">
                      {f.milestone}
                    </span>
                  </div>
                  <h3 className="font-medium">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-ink/70">{f.desc}</p>
                </article>
              ))}
            </div>
            <p className="mt-14 text-xs text-ink/45 leading-relaxed">
              지금은 터를 닦는 단계입니다(M1). 성경 본문은 저작재산권 보호기간이
              만료된 「성경전서 개역한글판」을 사용하며, 본문은 언제나 변형 없이
              원문 그대로 표시합니다.
            </p>
          </div>
        </section>
      </main>

      {/* 푸터 */}
      <footer className="px-6 md:px-12 py-8 text-xs text-mist flex flex-col md:flex-row gap-2 md:gap-6 md:items-center">
        <span>© 2026 OriAlt</span>
        <span>성경전서 개역한글판 (대한성서공회 역, 1961)</span>
        <span className="md:ml-auto">dabar.orialt.dev</span>
      </footer>
    </div>
  );
}

export default App;
