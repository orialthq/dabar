// 다바르 데스크톱 (M6) — 정적 웹앱을 app:// 프로토콜로 감싸는 최소 셸.
// 서버/백엔드 없음 (절대 규칙 4). 외부 네트워크는 웹 버전과 동일하게
// 모델·임베딩 다운로드와 사용자가 설정에서 선택한 엔진 호출뿐이다.

import { app, BrowserWindow, shell } from "electron";
import serve from "electron-serve";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
