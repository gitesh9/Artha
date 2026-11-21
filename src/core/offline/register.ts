/** Single app-shell registrar. Never register in development, iframe, or Lovable previews. */
export function refusesOfflineWorker(host: string, production: boolean, iframe: boolean, disabled: boolean) {
  const hostname = host.toLowerCase();
  return !production || iframe || disabled ||
    /^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+\.(?:lovable\.app|gpt-eng\.com|gptengineer\.run)$/.test(hostname) ||
    /^project--.+-dev\.(?:lovable\.app|gpt-eng\.com|gptengineer\.run)$/.test(hostname) ||
    ["lovableproject.com", "lovableproject-dev.com", "beta.lovable.dev"].some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}
export async function registerOfflineWorker() {
  if ("caches" in window) await caches.delete("artha-pages"); // Retire old plaintext financial navigation documents.
  if (!("serviceWorker" in navigator)) return;
  if (refusesOfflineWorker(window.location.hostname, import.meta.env.PROD, window.self !== window.top, new URLSearchParams(window.location.search).get("sw") === "off")) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.filter((r) => [r.active, r.installing, r.waiting].some((worker) => worker && new URL(worker.scriptURL).pathname === "/sw.js")).map((r) => r.unregister()));
    return;
  }
  const { registerSW } = await import("virtual:pwa-register");
  registerSW({ immediate: true });
}