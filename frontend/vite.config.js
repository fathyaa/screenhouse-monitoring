import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  server: {
    host: true,
    port: 5174,
    proxy: {
      // REST → app-service (hindari hardcode IP WiFi di .env)
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
      // Socket.IO → monitoring-service (WebSocket lewat origin Vite yang sama)
      "/socket.io": {
        target: "http://127.0.0.1:3001",
        ws: true,
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src/pwa",
      filename: "sw.js",
      registerType: "autoUpdate",
      includeAssets: ["icon-512.png", "logo-bibitlive.png", "apple-touch-icon.png", "pwa-192x192.png", "pwa-512x512.png", "pwa-512-maskable.png"],
      manifest: {
        name: "BibitLive",
        short_name: "BibitLive",
        description: "Pantau kondisi bibit padi di screenhouse secara realtime",
        theme_color: "#0f2d18",
        background_color: "#0f2d18",
        display: "standalone",
        orientation: "portrait-primary",
        start_url: "/petani",
        scope: "/",
        lang: "id",
        categories: ["productivity", "utilities"],
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "pwa-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        shortcuts: [
          {
            name: "Dashboard",
            short_name: "Dashboard",
            url: "/petani",
            icons: [{ src: "pwa-192x192.png", sizes: "192x192" }],
          },
          {
            name: "Peringatan",
            short_name: "Alert",
            url: "/petani/peringatan",
            icons: [{ src: "pwa-192x192.png", sizes: "192x192" }],
          },
        ],
      },
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,svg,png,woff2,mp3}"],
      },
      devOptions: {
        enabled: true,
        type: "module",
      },
    }),
  ],
});
