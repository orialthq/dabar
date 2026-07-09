const FEATURES = [
  {
    step: "읽다",
    title: "성경 읽기",
    desc: "개역한글 전문을 책·장·절로 탐색합니다. 모든 구절은 원문 그대로, 한 글자도 바꾸지 않고 보여줍니다.",
    href: "#/read",
    open: true,
  },
  {
    step: "찾다",
    title: "말씀 검색",
    desc: "궁금한 키워드로 성경 전체에서 구절을 찾습니다. 66권 어디에 그 말씀이 있는지 한 번에 확인합니다.",
    href: "#/search",
    open: true,
  },
  {
    step: "새기다",
    title: "다바르 기록",
    desc: "오늘 있었던 일을 씁니다. 그 하루에 닿는 말씀을 붙이고, 나만의 통찰을 남깁니다. 기록이 쌓여 나의 신앙 연대기가 됩니다.",
    href: "#/write",
    open: true,
  },
];

function Landing() {
  return (
    <>
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
        <div className="rise rise-4 mt-10 flex items-center justify-center gap-4">
          <a
            href="#/read"
            className="bg-dawn text-ink font-medium rounded-full px-6 py-2.5 text-sm hover:brightness-110 transition"
          >
            성경 읽기
          </a>
          <a
            href="#/search"
            className="border border-hanji/25 text-hanji rounded-full px-6 py-2.5 text-sm hover:border-dawn hover:text-dawn transition"
          >
            말씀 검색
          </a>
        </div>
      </section>

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
                    {f.open ? "열림" : "준비 중"}
                  </span>
                </div>
                <h3 className="font-medium">{f.title}</h3>
                <p className="text-sm leading-relaxed text-ink/70">{f.desc}</p>
                {f.open && (
                  <a href={f.href} className="text-sm text-dawn font-medium mt-1">
                    바로 가기 →
                  </a>
                )}
              </article>
            ))}
          </div>
          <p className="mt-14 text-xs text-ink/45 leading-relaxed">
            성경 본문은 저작재산권 보호기간이 만료된 「성경전서 개역한글판」
            (대한성서공회 역, 1961)을 사용하며, 언제나 변형 없이 원문 그대로
            표시합니다.
          </p>
        </div>
      </section>
    </>
  );
}

export default Landing;
