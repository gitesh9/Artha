import { defineConfig, type Plugin } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { VitePWA, type VitePWAOptions } from "vite-plugin-pwa";

// Netlify's emulator patches globals during import. Do not load it in Vite dev:
// Vite owns SSR/assets locally; Netlify CLI is only a proxy, not a second SSR server.
export const offlineBuildOptions = {
    strategies: "generateSW",
    outDir: "dist/client",
    filename: "sw.js",
    injectRegister: null,
    registerType: "autoUpdate",
    manifest: false,
    devOptions: { enabled: false },
    workbox: {
      cacheId: "artha",
      globPatterns: ["**/*.{js,mjs,wasm,css,svg,png,woff2,webmanifest,gz}", "offline.html"],
      globIgnores: ["**/server/**"],
      navigateFallback: null,
      cleanupOutdatedCaches: true,
      importScripts: ["/push-events.js"],
      maximumFileSizeToCacheInBytes: 8000000,
      runtimeCaching: [{
        urlPattern: ({ request, url }) => request.mode === "navigate" &&
          !/^\/(?:api|_serverFn|reset-password|~oauth|auth)(?:\/|$)/.test(url.pathname),
        handler: "NetworkFirst",
        options: {
          cacheName: "artha-navigation",
          // Never persist real HTML; offline recovery uses only the static shell.
          cacheableResponse: { statuses: [] },
          precacheFallback: { fallbackURL: "/offline.html" },
        },
      }],
    },
  } satisfies Partial<VitePWAOptions>;

export default defineConfig(async ({ command }) => {
  const pwa = VitePWA(offlineBuildOptions);
  const finishOfflineBuild: Plugin = {
    name: "artha:pwa-after-prerender",
    apply: "build",
    // TanStack creates the shell after both environment builds. Regenerate with
    // its content hash so upgrades cannot leave an old unrevisioned shell behind.
    buildApp: { order: "post", async handler() {
      const plugin = pwa.find((entry) => entry.name === "vite-plugin-pwa") as (Plugin & { api?: { generateSW: () => Promise<unknown> } }) | undefined;
      if (!plugin?.api) throw new Error("PWA generation API unavailable");
      await plugin.api.generateSW();
    } },
  };
  return {
  plugins: [
    tsConfigPaths(),
    tanstackStart({
      server: { entry: "server" },
      // Build a data-free bootstrap document, not a cached signed-in page.
      spa: { enabled: true, maskPath: "/auth", prerender: { outputPath: "/offline", autoSubfolderIndex: false } },
    }),

    // React and styling
    react(),
    tailwindcss(),

    // Netlify deployment adapter
    command === "build" ? (await import("@netlify/vite-plugin-tanstack-start")).default() : null,

    ...pwa,
    finishOfflineBuild,
  ],

  resolve: {
    dedupe: ["react", "react-dom"],
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    // Permit the editor's preview proxy, not arbitrary hosts.
    allowedHosts: [".lovable.app", ".lovableproject.com", ".lovableproject-dev.com", ".gpt-eng.com", ".gptengineer.run"],
  },
  };
});
