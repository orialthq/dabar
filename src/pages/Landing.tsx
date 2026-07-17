import {
  ArrowRight,
  BookOpenText,
  Download,
  Feather,
  LockKeyhole,
  MessageCircleQuestion,
  Search,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import DesktopUpdate from "../components/DesktopUpdate";

const FEATURES: {
  step: string;
  title: string;
  desc: string;
  href: string;
  icon: LucideIcon;
}[] = [
  {
    step: "읽다",
    title: "말씀을 천천히",
    desc: "개역한글 전문을 책·장·절로 탐색합니다. 모든 구절은 원문 그대로 보여드립니다.",
    href: "#/read",
    icon: BookOpenText,
  },
  {
    step: "찾다",
    title: "표현과 뜻으로",
    desc: "기억나는 표현이나 마음에 품은 문장으로 성경 66권에서 말씀을 찾습니다.",
    href: "#/search",
    icon: Search,
  },
  {
    step: "묻다",
    title: "말씀 안에서",
    desc: "일상과 신앙의 물음을 적으면 관련 말씀을 펼쳐 함께 생각할 자리를 만듭니다.",
    href: "#/ask",
    icon: MessageCircleQuestion,
  },
  {
    step: "새기다",
    title: "하루를 오래도록",
    desc: "오늘의 사건과 닿은 말씀을 한데 남겨 나만의 신앙 연대기를 쌓습니다.",
    href: "#/write",
    icon: Feather,
  },
];

const DOWNLOAD_URL = "https://github.com/orialthq/dabar/releases/latest";
const isDesktop = typeof window !== "undefined" && Boolean(window.dabarDesktop);

function Landing() {
  return (
    <div className="flex-1 flex flex-col">
      <section className="heaven w-full">
        <div className="mx-auto grid w-[calc(100%-2rem)] max-w-[70rem] items-center gap-14 py-16 md:py-24 lg:grid-cols-[1.08fr_0.92fr] lg:py-28">
          <div>
            <p className="rise rise-1 inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] text-dawn uppercase">
              <Sparkles size={14} strokeWidth={1.7} aria-hidden="true" />
              말씀과 하루를 잇는 기록
            </p>
            <p
              lang="he"
              dir="rtl"
              aria-hidden="true"
              className="rise rise-1 mt-5 font-serif text-3xl text-dawn/75 select-none"
            >
              דָּבָר
            </p>
            <h1 className="rise rise-2 mt-4 font-serif text-[2.55rem] font-semibold leading-[1.24] tracking-[-0.045em] text-hanji md:text-[4rem]">
              오늘을 쓰고,
              <br />
              말씀 곁에 머뭅니다
            </h1>
            <p className="rise rise-3 mt-6 max-w-xl text-[15px] leading-7 text-mist md:text-base">
              히브리어 <em className="not-italic text-hanji">다바르</em>는 말씀과
              사건을 함께 뜻합니다. 오늘 일어난 일을 쓰고, 그 하루에 닿는 말씀을
              오래 간직해 보세요.
            </p>
            <div className="rise rise-4 mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#/write/new"
                className="inline-flex min-h-11 items-center gap-2 rounded-[0.9rem] bg-dawn px-5 text-sm font-semibold text-ink shadow-[0_10px_28px_rgb(217_142_50_/_0.2)] transition hover:-translate-y-0.5 hover:brightness-110"
              >
                <Feather size={17} strokeWidth={1.9} aria-hidden="true" />
                오늘 새기기
              </a>
              <a
                href="#/read"
                className="inline-flex min-h-11 items-center gap-2 rounded-[0.9rem] border border-hanji/18 bg-white/5 px-5 text-sm font-medium text-hanji transition hover:border-dawn/60 hover:bg-dawn/8 hover:text-dawn"
              >
                말씀 펼치기
                <ArrowRight size={16} strokeWidth={1.8} aria-hidden="true" />
              </a>
            </div>
          </div>

          <div className="rise rise-3 relative mx-auto w-full max-w-md lg:ml-auto">
            <div className="absolute -inset-6 rounded-[2rem] bg-dawn/8 blur-2xl" aria-hidden="true" />
            <div className="relative overflow-hidden rounded-[1.7rem] border border-hanji/12 bg-ink-soft/88 p-3 shadow-[0_28px_80px_rgb(0_0_0_/_0.32)] backdrop-blur">
              <div className="rounded-[1.25rem] border border-hanji/10 bg-hanji p-6 text-ink md:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-semibold tracking-[0.16em] text-dawn uppercase">
                      오늘의 새김
                    </p>
                    <p className="mt-2 font-serif text-xl font-semibold tracking-[-0.03em]">
                      하루와 말씀 사이
                    </p>
                  </div>
                  <span className="seal h-10 w-10 text-sm" aria-hidden="true">דבר</span>
                </div>
                <div className="mt-8 space-y-3" aria-hidden="true">
                  <div className="h-2 w-full rounded-full bg-ink/10" />
                  <div className="h-2 w-[88%] rounded-full bg-ink/10" />
                  <div className="h-2 w-[68%] rounded-full bg-ink/10" />
                </div>
                <div className="mt-8 rounded-r-xl border-l-[3px] border-dawn bg-dawn/7 px-4 py-3">
                  <p className="font-serif text-sm text-ink/72">말씀은 로컬 성경에서 그대로 펼쳐집니다.</p>
                  <p className="mt-1 text-[10px] text-ink/38">개역한글 · 본문 무변형</p>
                </div>
                <div className="mt-7 flex items-center gap-2 text-[11px] text-ink/42">
                  <LockKeyhole size={13} strokeWidth={1.8} aria-hidden="true" />
                  기록은 이 기기에만 머뭅니다
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="paper flex-1 px-4 py-16 text-ink md:py-24">
        <div className="mx-auto w-full max-w-[70rem]">
          <div className="max-w-2xl">
            <p className="page-kicker">FOUR VERBS</p>
            <h2 className="page-title">네 가지 동사로 이어집니다</h2>
            <p className="page-lead">
              읽고, 찾고, 묻고, 새기는 흐름이 한 화면 안에서 자연스럽게 이어집니다.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <a key={feature.step} href={feature.href} className="action-card group flex min-h-[17rem] flex-col p-6">
                  <span className="icon-tile">
                    <Icon size={20} strokeWidth={1.7} aria-hidden="true" />
                  </span>
                  <p className="mt-6 text-[11px] font-bold tracking-[0.12em] text-dawn">
                    {feature.step}
                  </p>
                  <h3 className="mt-2 font-serif text-lg font-semibold tracking-[-0.02em]">
                    {feature.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-ink/58">{feature.desc}</p>
                  <span className="mt-auto inline-flex items-center gap-1.5 pt-6 text-xs font-semibold text-ink/55 transition group-hover:text-dawn">
                    바로 가기
                    <ArrowRight size={14} strokeWidth={1.8} aria-hidden="true" />
                  </span>
                </a>
              );
            })}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_auto]">
            <div className="surface-soft flex items-start gap-4 p-5 md:items-center md:p-6">
              <span className="icon-tile !h-10 !w-10 !rounded-xl">
                <LockKeyhole size={18} strokeWidth={1.7} aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold">기록은 내 기기에, 말씀은 원문 그대로</p>
                <p className="mt-1 text-xs leading-5 text-ink/50">
                  새김은 브라우저에만 간직되며, 성경 본문은 로컬 개역한글 DB에서만 불러옵니다.
                </p>
              </div>
            </div>

            <div className="surface-soft flex min-w-[18rem] flex-wrap items-center gap-3 p-5 md:p-6">
              {isDesktop ? (
                <DesktopUpdate variant="hero" />
              ) : (
                <a href={DOWNLOAD_URL} target="_blank" rel="noreferrer" className="btn-secondary w-full">
                  <Download size={16} strokeWidth={1.8} aria-hidden="true" />
                  데스크톱 앱 받기
                </a>
              )}
            </div>
          </div>

          <p className="mt-8 text-[11px] leading-5 text-ink/38">
            성경 본문은 저작재산권 보호기간이 만료된 「성경전서 개역한글판」
            (대한성서공회 역, 1961)을 사용하며, 언제나 변형 없이 원문 그대로 표시합니다.
          </p>
        </div>
      </section>
    </div>
  );
}

export default Landing;
