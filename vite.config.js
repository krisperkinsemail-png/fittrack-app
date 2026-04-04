import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico,webmanifest}"],
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: "AI Fit",
        short_name: "AI Fit",
        description: "A mobile-first nutrition, weight, and workout tracker.",
        start_url: "/",
        display: "standalone",
        background_color: "#f3f6fb",
        theme_color: "#10212d",
        icons: [
          {
            src: "/app-icon.png",
            sizes: "1024x1024",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
});
