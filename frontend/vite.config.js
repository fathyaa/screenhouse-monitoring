import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src/pwa",
      filename: "sw.js",
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "apple-touch-icon.png", "pwa-192x192.png", "pwa-512x512.png"],
      manifest: {
        name: "Screenhouse Monitoring",
        short_name: "Screenhouse",
        description: "Pantau kondisi screenhouse pembibitan padi secara realtime",
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
            src: "pwa-512x512.png",
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
