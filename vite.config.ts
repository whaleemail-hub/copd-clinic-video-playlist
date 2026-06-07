import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/copd-clinic-video-playlist/",
  plugins: [react()],
});
