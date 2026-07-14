// 다바르 데스크톱 (M6) — 정적 웹앱을 app:// 프로토콜로 감싸는 최소 셸.
// 서버/백엔드 없음 (절대 규칙 4). 외부 네트워크는 웹 버전과 동일하게
// 모델·임베딩 다운로드와 사용자가 설정에서 선택한 엔진 호출뿐이다.

import { app, BrowserWindow, shell, ipcMain } from "electron";
import serve from "electron-serve";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createWriteStream } from "node:fs";
import { rm } from "node:fs/promises";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const loadURL = serve({ directory: path.join(__dirname, "..", "dist-desktop") });

const SMOKE = process.env.DABAR_SMOKE === "1";

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 720,
    minHeight: 560,
    title: "다바르",
    backgroundColor: "#F7F3EA", // hanji
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // 외부 링크는 앱 안이 아니라 기본 브라우저로
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) shell.openExternal(url);
    return { action: "deny" };
  });

  void loadURL(win);

  if (process.env.DABAR_SMOKE_UPDATE === "1") {
    win.webContents.on("did-finish-load", async () => {
      try {
        const r = await win.webContents.executeJavaScript("window.dabarDesktop.checkUpdate()");
        console.log("UPDATE_CHECK " + JSON.stringify(r));
        if (process.env.DABAR_SMOKE_INSTALL === "1" && r.hasUpdate) {
          console.log("UPDATE_INSTALLING");
          await win.webContents.executeJavaScript("window.dabarDesktop.installUpdate()");
        } else {
          app.exit(0);
        }
      } catch (e) {
        console.error("UPDATE_FAIL " + String(e));
        app.exit(1);
      }
    });
  }

  if (SMOKE) {
    win.webContents.on("did-finish-load", async () => {
      try {
        const result = await win.webContents.executeJavaScript(`
          (async () => {
            const books = await fetch('/bible/books.json').then(r => r.json());
            const meta = await fetch('/embeddings/meta.json').then(r => r.json());
            const gen = await fetch('/bible/gen.json').then(r => r.json());
            return {
              title: document.title,
              books: books.length,
              embeddings: meta.total,
              gen11: gen.chapters[0][0],
              webgpu: 'gpu' in navigator,
              cacheApi: typeof caches !== 'undefined',
            };
          })()
        `);
        console.log("SMOKE_RESULT " + JSON.stringify(result));
        app.exit(0);
      } catch (e) {
        console.error("SMOKE_FAIL " + String(e));
        app.exit(1);
      }
    });
  }
}

// ---- 인앱 업데이트 (무서명 배포라 electron-updater 대신 직접 구현) ----
// GitHub Releases 최신 태그와 앱 버전을 비교하고, 사용자가 누르면
// mac: dmg 다운로드 → 마운트 → /Applications 교체 → 재시작
// win: 설치 exe 다운로드 → 실행(NSIS가 교체) → 종료
const REPO = "orialthq/dabar";

function cmpSemver(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  }
  return 0;
}

async function fetchLatest() {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`릴리스 확인 실패 (${res.status})`);
  const rel = await res.json();
  const latest = String(rel.tag_name ?? "").replace(/^v/, "");
  const suffix =
    process.platform === "darwin"
      ? `-mac-${process.arch === "arm64" ? "arm64" : "x64"}.dmg`
      : `-win-x64.exe`;
  const asset = (rel.assets ?? []).find((a) => a.name.endsWith(suffix));
  return { latest, assetUrl: asset?.browser_download_url ?? null, assetSize: asset?.size ?? 0 };
}

async function download(url, dest, onProgress) {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`다운로드 실패 (${res.status})`);
  const total = Number(res.headers.get("content-length")) || 0;
  const out = createWriteStream(dest);
  let done = 0;
  for await (const chunk of res.body) {
    out.write(chunk);
    done += chunk.length;
    onProgress?.(total > 0 ? done / total : 0);
  }
  await new Promise((resolve, reject) => out.end((e) => (e ? reject(e) : resolve())));
}

function registerUpdateIpc() {
  ipcMain.handle("dabar:version", () => app.getVersion());

  ipcMain.handle("dabar:check-update", async () => {
    const current = app.getVersion();
    const { latest, assetUrl } = await fetchLatest();
    return {
      current,
      latest,
      hasUpdate: Boolean(latest) && cmpSemver(latest, current) > 0 && Boolean(assetUrl),
    };
  });

  ipcMain.handle("dabar:install-update", async (event) => {
    const { latest, assetUrl } = await fetchLatest();
    if (!assetUrl) throw new Error("이 플랫폼용 설치 파일을 찾지 못했습니다");
    const progress = (p) => event.sender.send("dabar:update-progress", p);

    if (process.platform === "darwin") {
      const dmg = path.join(app.getPath("temp"), `dabar-${latest}.dmg`);
      await download(assetUrl, dmg, progress);
      const mnt = `/Volumes/DabarUpdate-${latest}`;
      await execFileAsync("hdiutil", ["attach", dmg, "-nobrowse", "-quiet", "-mountpoint", mnt]);
      const aside = `/Applications/.Dabar-old-${Date.now()}.app`;
      try {
        // 실행 중인 앱은 지우지 말고 옆으로 이름을 바꾼 뒤(원자적) 새 번들을 복사한다.
        // 옛 번들 삭제는 베스트에포트 — 실행 중 프로세스가 잡고 있어도 다음 단계에 지장 없음.
        await execFileAsync("mv", ["/Applications/Dabar.app", aside]).catch(() => {});
        await execFileAsync("cp", ["-R", `${mnt}/Dabar.app`, "/Applications/"]);
        rm(aside, { recursive: true, force: true }).catch(() => {});
      } finally {
        await execFileAsync("hdiutil", ["detach", mnt, "-quiet"]).catch(() => {});
        await rm(dmg, { force: true }).catch(() => {}); // 설치 파일 정리
      }
      app.relaunch({ execPath: "/Applications/Dabar.app/Contents/MacOS/Dabar" });
      app.exit(0);
    } else {
      const exe = path.join(app.getPath("temp"), `dabar-setup-${latest}.exe`);
      await download(assetUrl, exe, progress);
      // NSIS 설치기가 앱 종료·교체·재실행을 담당. 설치기 파일은 OS 임시 폴더라 재부팅 시 정리된다.
      spawn(exe, [], { detached: true, stdio: "ignore" }).unref();
      app.exit(0);
    }
    return true;
  });
}

app.whenReady().then(() => {
  registerUpdateIpc();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
