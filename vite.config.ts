// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// Never set ssr.external or resolve.external: the Worker has no runtime module resolution, so
// the build fails. Never add compression (compressPublicAssets, vite-plugin-compression):
// hosting already compresses at the edge.
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import netlify from '@netlify/vite-plugin-tanstack-start'


export default defineConfig({
  vite: {
    plugins: [VitePWA({
      strategies: "generateSW", filename: "sw.js", injectRegister: null, registerType: "autoUpdate",
      manifest: false, devOptions: { enabled: false },
      workbox: {
        cacheId: "artha", globPatterns: ["**/*.{js,css,svg,png,woff2,webmanifest}"],
        navigateFallback: null, cleanupOutdatedCaches: true,
        // Public, data-free HTML boots client routing even when /dashboard was only visited via SPA navigation.
        additionalManifestEntries: [{ url: "/auth", revision: null }],
        runtimeCaching: [
          { urlPattern: ({ request, url }) => request.mode === "navigate" && !url.pathname.startsWith("/api/") && !url.pathname.startsWith("/_serverFn/") && !url.pathname.startsWith("/~oauth") && url.pathname !== "/reset-password", handler: "NetworkOnly", options: { plugins: [{ handlerDidError: async () => (await caches.match("/auth")) ?? Response.error() }] } },
          { urlPattern: ({ url }) => url.origin === self.location.origin && /\/assets\/.+[-.][A-Za-z0-9_-]{8,}\.(js|css|woff2|png|svg)$/.test(url.pathname), handler: "CacheFirst", options: { cacheName: "artha-assets", expiration: { maxEntries: 150, maxAgeSeconds: 2592000 }, cacheableResponse: { statuses: [200] } } },
        ],
      },
    })
    tanstackStart(),
    netlify(),
    ],
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
