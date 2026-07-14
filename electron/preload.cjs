// 데스크톱 전용 브릿지 — 렌더러가 업데이트 확인/설치를 요청할 수 있는 최소 표면.
// window.dabarDesktop 존재 여부로 웹/데스크톱을 구분한다.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("dabarDesktop", {
  version: () => ipcRenderer.invoke("dabar:version"),
  checkUpdate: () => ipcRenderer.invoke("dabar:check-update"),
  installUpdate: () => ipcRenderer.invoke("dabar:install-update"),
  onUpdateProgress: (cb) => {
    ipcRenderer.on("dabar:update-progress", (_e, p) => cb(p));
  },
});
