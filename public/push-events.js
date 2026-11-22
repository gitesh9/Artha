/* Generic notification messages only. Financial values and auth are never cached here. */
self.addEventListener("push", event => {
  let message = { title: "Artha", body: "Time to review your entries." };
  try { if (event.data) message = { ...message, ...event.data.json() }; } catch { /* Use safe generic fallback. */ }
  event.waitUntil(self.registration.showNotification(String(message.title).slice(0, 100), { body: String(message.body).slice(0, 300), icon: "/icon-192.png", tag: "artha-evening", data: { url: "/dashboard" } }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => { const existing = clients.find(c => new URL(c.url).origin === self.location.origin); return existing ? existing.focus() : self.clients.openWindow("/dashboard"); }));
});