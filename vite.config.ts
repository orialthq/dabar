import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// GitHub Pages 프로젝트 페이지 기준 base.
// 커스텀 도메인(dabar.orialt.dev) 연결 시 "/"로 변경하고 public/CNAME 추가.
export default defineConfig({
  base: "/dabar/",
  plugins: [react(), tailwindcss()],
});
