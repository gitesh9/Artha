// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// Never set ssr.external or resolve.external: the Worker has no runtime module resolution, so
// the build fails. Never add compression (compressPublicAssets, vite-plugin-compression):
// hosting already compresses at the edge.
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.

import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import netlify from "@netlify/vite-plugin-tanstack-start";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    // TanStack Start must run before JSX transformation
    tanstackStart(),

    // React and styling
    react(),
    tailwindcss(),

    // Netlify deployment adapter
    netlify(),

    // PWA
    VitePWA({
      strategies: "generateSW",
      filename: "sw.js",
      injectRegister: null,
      registerType: "autoUpdate",
      manifest: false,
      devOptions: { enabled: false },
      workbox: {
        cacheId: "artha",
        globPatterns: ["**/*.{js,css,svg,png,woff2,webmanifest}"],
        navigateFallback: null,
        cleanupOutdatedCaches: true,
        additionalManifestEntries: [
          { url: "/auth", revision: null },
        ],
      },
    }),
  ],

  resolve: {
    tsconfigPaths: true,
    dedupe: ["react", "react-dom"],
  },

  tanstackStart: {
    server: {
      entry: "server",
    },
  },
});
