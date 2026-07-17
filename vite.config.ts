import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages 프로젝트 페이지 기준 base.
// 커스텀 도메인(dabar.orialt.dev) 연결 시 "/"로 변경하고 public/CNAME 추가.
export default defineConfig({
  base: "/dabar/",
  build: {
    rollupOptions: {
      output: {
        // 큰 지연 로드 라이브러리에 안정된 청크 이름 — PWA 사전 캐시에서 제외하기 위함
        manualChunks: {
          webllm: ["@mlc-ai/web-llm"],
          transformers: ["@huggingface/transformers"],
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    // PWA (M7④): 홈 화면 설치 + 오프라인. SW 등록은 main.tsx에서 http(s)일 때만
    // 수동으로 한다 — 데스크톱(app://)에서는 등록하지 않는다.
    VitePWA({
      injectRegister: null,
      registerType: "autoUpdate",
      manifest: {
        name: "다바르 — 말씀, 그리고 일어난 일",
        short_name: "다바르",
        description:
          "오늘 있었던 일을 쓰면, 성경이 그 하루에 답합니다. 개역한글 리더·검색·묻다·신앙 저널.",
        lang: "ko",
        display: "standalone",
        theme_color: "#10151F",
        background_color: "#F7F3EA",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "pwa-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // 앱 셸(js/css/html/아이콘)만 사전 캐시. 큰 자원은 아래 런타임 캐시로.
        globPatterns: ["**/*.{js,css,html,svg,png}"],
        globIgnores: ["**/webllm-*.js"], // 6MB — 묻다 첫 사용 시 런타임 캐시
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /webllm-.*\.js$/.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "dabar-webllm-chunk",
              expiration: { maxEntries: 2 },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.includes("/bible/"),
            handler: "CacheFirst",
            options: {
              cacheName: "dabar-bible",
              expiration: { maxEntries: 80 },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.includes("/embeddings/"),
            handler: "CacheFirst",
            options: {
              cacheName: "dabar-embeddings",
              expiration: { maxEntries: 10 },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.endsWith(".wasm"),
            handler: "CacheFirst",
            options: {
              cacheName: "dabar-wasm",
              expiration: { maxEntries: 4 },
            },
          },
        ],
      },
    }),
  ],
});
