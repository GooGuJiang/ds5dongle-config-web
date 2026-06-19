import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

const appVersion = "0.2.5";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["pwa-icon.svg", "pwa-192x192.png", "pwa-512x512.png"],
      manifest: {
        name: "DS5 Dongle Web",
        short_name: "DS5 Web",
        description: "DS5 Bridge HID device configuration tool with offline access.",
        theme_color: "#111827",
        background_color: "#f5f7fa",
        display: "standalone",
        start_url: ".",
        scope: ".",
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
          {
            src: "pwa-icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        cacheId: `ds5dongle-config-web-${appVersion}`,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff2}"],
        globIgnores: ["**/bundle-stats.html"],
        navigateFallback: "index.html",
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "react-vendor",
              test: /node_modules[\\/](react|react-dom)[\\/]/,
              priority: 40,
            },
            {
              name: "radix-vendor",
              test: /node_modules[\\/](@radix-ui|radix-ui|@floating-ui)[\\/]/,
              priority: 30,
            },
            {
              name: "ui-vendor",
              test: /node_modules[\\/](lucide-react|react-icons|motion|react-hot-toast|class-variance-authority|clsx|tailwind-merge)[\\/]/,
              priority: 25,
            },
            {
              name: "i18n-vendor",
              test: /node_modules[\\/](i18next|i18next-browser-languagedetector|react-i18next)[\\/]/,
              priority: 20,
            },
            {
              name: "pwa-vendor",
              test: /node_modules[\\/]workbox-window[\\/]/,
              priority: 20,
            },
            {
              name: "vendor",
              test: /node_modules[\\/]/,
              priority: 10,
              maxSize: 180 * 1024,
            },
          ],
        },
      },
    },
  },
});
