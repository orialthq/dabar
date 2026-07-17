import { useEffect, useState } from "react";
import { Download, RefreshCw } from "lucide-react";

interface Props {
  /** hero: 랜딩 어두운 배경의 큰 버튼 · footer: 작은 상태 표시 */
  variant: "hero" | "footer";
}

type Status =
  | { kind: "idle" }
  | { kind: "uptodate"; current: string }
  | { kind: "available"; latest: string }
  | { kind: "installing"; percent: number }
  | { kind: "error" };

/**
 * 데스크톱 앱 전용 인앱 업데이트 (웹에서는 아무것도 렌더링하지 않음).
 * GitHub Releases 최신 버전을 확인하고, 클릭 한 번으로 내려받아 교체·재시작한다.
 */
function DesktopUpdate({ variant }: Props) {
  const desktop = window.dabarDesktop;
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  useEffect(() => {
    if (!desktop) return;
    let alive = true;
    desktop
      .checkUpdate()
      .then((r) => {
        if (!alive) return;
        setStatus(r.hasUpdate ? { kind: "available", latest: r.latest } : { kind: "uptodate", current: r.current });
      })
      .catch(() => {
        if (alive) setStatus({ kind: "error" });
      });
    return () => {
      alive = false;
    };
  }, [desktop]);

  if (!desktop) return null;

  const install = () => {
    setStatus({ kind: "installing", percent: 0 });
    desktop.onUpdateProgress((p) =>
      setStatus({ kind: "installing", percent: Math.round(p * 100) })
    );
    // 완료되면 앱이 스스로 재시작하므로 성공 후속 처리는 없다
    desktop.installUpdate().catch(() => setStatus({ kind: "error" }));
  };

  if (variant === "hero") {
    if (status.kind === "available")
      return (
        <button
          onClick={install}
          className="btn-primary w-full"
        >
          <Download size={16} strokeWidth={1.8} aria-hidden="true" />
          새 버전 v{status.latest} 받기
        </button>
      );
    if (status.kind === "installing")
      return (
        <span className="btn-secondary w-full">
          <RefreshCw size={15} className="animate-spin" aria-hidden="true" />
          업데이트 중 — {status.percent}% (완료되면 다시 열립니다)
        </span>
      );
    if (status.kind === "uptodate")
      return (
        <span className="btn-secondary w-full">
          최신 버전입니다 (v{status.current})
        </span>
      );
    if (status.kind === "error")
      return (
        <button
          onClick={install}
          className="btn-secondary w-full"
        >
          <RefreshCw size={15} strokeWidth={1.8} aria-hidden="true" />
          업데이트에 실패했습니다 — 다시 시도
        </button>
      );
    return null;
  }

  // footer variant — 안 쓰는 공간에 작은 상태 표시
  if (status.kind === "available")
    return (
      <button onClick={install} className="inline-flex items-center gap-1.5 text-dawn hover:brightness-110">
        <Download size={13} strokeWidth={1.8} aria-hidden="true" />
        새 버전 v{status.latest} 받기
      </button>
    );
  if (status.kind === "installing") return <span>업데이트 중 — {status.percent}%</span>;
  if (status.kind === "uptodate") return <span>v{status.current} · 최신</span>;
  if (status.kind === "error")
    return (
      <button onClick={install} className="text-dawn hover:brightness-110">
        업데이트 실패 · 다시 시도
      </button>
    );
  return null;
}

export default DesktopUpdate;
