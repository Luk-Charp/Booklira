import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: [
        "favicon.svg",
        "favicon.ico",
        "robots.txt",
        "sitemap.xml",
        "google48f0f2b1af079126.html",
      ],
      manifest: {
        name: "Booklira",
        short_name: "Booklira",
        description: "Ma bibliothèque personnelle",
        theme_color: "#211814",
        background_color: "#211814",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,

        // Ne jamais conserver index.html dans le precache :
        // il pourrait référencer des bundles supprimés lors d'un nouveau déploiement.
        globPatterns: ["**/*.{js,css,ico,png,svg,woff,woff2,xml,txt}"],
        globIgnores: ["**/index.html"],

        // Les navigations récupèrent toujours la dernière version du HTML.
        // Cela évite qu'une PWA serve une ancienne page avec des fichiers JS/CSS absents.
        navigateFallback: null,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "booklira-pages",
              networkTimeoutSeconds: 5,
            },
          },
        ],
      },
    }),
  ],
});
