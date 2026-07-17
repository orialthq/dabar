import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// PWA 서비스워커 — 웹(http/https)에서만. 데스크톱(app://)은 electron-serve가 담당한다.
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  void import("virtual:pwa-register").then(({ registerSW }) =>
    registerSW({ immediate: true })
  );
}
