// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { generateSW } from "workbox-build";
import { offlineBuildOptions } from "../../vite.config";

let fixture: string | undefined;
afterEach(async () => { if (fixture) await rm(fixture, { recursive: true, force: true }); });

describe("offline startup privacy", () => {
  it("fetches navigation online first without caching live HTML, excluding security endpoints", () => {
    const rule = offlineBuildOptions.workbox.runtimeCaching[0];
    if (!rule) throw new Error("Missing navigation rule");
    expect(rule.handler).toBe("NetworkFirst");
    expect(rule.options.cacheableResponse.statuses).toEqual([]);
    expect(rule.options.precacheFallback.fallbackURL).toBe("/offline.html");
    const match = (path: string) => {
      const url = new URL(`https://artha.example${path}`);
      const request = new Request(url);
      // Only browsers create navigation Requests; simulate that readonly mode.
      Object.defineProperty(request, "mode", { value: "navigate" });
      return rule.urlPattern({ request, url, sameOrigin: true, event: {} as Parameters<typeof rule.urlPattern>[0]["event"] });
    };
    for (const path of ["/api/auth/get-session", "/_serverFn/private", "/reset-password", "/~oauth", "/auth"]) expect(match(path)).toBe(false);
    expect(match("/dashboard")).toBe(true);
  });

  it("generates a revisioned shell and excludes live financial HTML and JSON from precache", async () => {
    fixture = await mkdtemp(join(tmpdir(), "artha-worker-test-"));
    const shell = "data-free bootstrap fixture";
    await Promise.all([
      writeFile(join(fixture, "offline.html"), shell),
      writeFile(join(fixture, "dashboard.html"), "private financial page"),
      writeFile(join(fixture, "snapshot.json"), "private financial snapshot"),
      writeFile(join(fixture, "app-hashed.js"), "export const app = true"),
      writeFile(join(fixture, "pdf-worker.mjs"), "export const reader = true"),
      writeFile(join(fixture, "ocr.wasm"), new Uint8Array([0, 97, 115, 109])),
      writeFile(join(fixture, "eng.traineddata.gz"), "reading data fixture"),
    ]);
    await generateSW({ ...offlineBuildOptions.workbox, globDirectory: fixture, swDest: join(fixture, "sw.js") });
    const worker = await readFile(join(fixture, "sw.js"), "utf8");
    expect(worker).toContain("offline.html");
    expect(worker).toContain(createHash("md5").update(shell).digest("hex"));
    expect(worker).not.toContain("dashboard.html");
    expect(worker).not.toContain("snapshot.json");
    expect(worker).toContain("pdf-worker.mjs");
    expect(worker).toContain("ocr.wasm");
    expect(worker).toContain("eng.traineddata.gz");
  }, 30000);
});