import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/public/scheduled")({ server: { handlers: { POST: async ({ request }) => {
  const secret = process.env["JOB_SECRET"];
  if (!secret || secret.length < 32 || request.headers.get("Authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const { getDb } = await import("@/core/db/client"); const { fxSnapshot, pushSubscription } = await import("@/core/db/schema"); const { eq } = await import("drizzle-orm"); const { getRates } = await import("@/core/integrations/currency"); const { pushInput, allowedPushEndpoint, istReminderDate } = await import("@/features/reminders/service"); const db = await getDb();
  const bases = await db.select().from(fxSnapshot); const fx = await Promise.all([...new Set(["INR", ...bases.map(row => row.base)])].map(base => getRates(base, undefined, true)));
  const date = istReminderDate(new Date()); let sent = 0, failed = 0;
  const pub = process.env["VAPID_PUBLIC_KEY"], key = process.env["VAPID_PRIVATE_KEY"], subject = process.env["VAPID_SUBJECT"];
  if (pub && key && subject && date) {
    const { default: webpush } = await import("web-push");
    for (const row of await db.select().from(pushSubscription)) { if (row.lastSentOn === date || !allowedPushEndpoint(row.endpoint)) continue; try { await webpush.sendNotification(pushInput.parse(row.subscription), JSON.stringify({ title: "Artha · evening check-in", body: "Take a moment to record today's income and expenses.", url: "/dashboard" }), { vapidDetails: { publicKey: pub, privateKey: key, subject }, TTL: 3600, timeout: 10000 }); await db.update(pushSubscription).set({ lastSentOn: date }).where(eq(pushSubscription.id, row.id)); sent++; } catch (e) { failed++; if (typeof e === "object" && e !== null && "statusCode" in e && (e.statusCode === 404 || e.statusCode === 410)) await db.delete(pushSubscription).where(eq(pushSubscription.id, row.id)); } }
  }
  return Response.json({ refreshedBases: fx.length, sent, failed }, { headers: { "Cache-Control": "no-store" } });
} } } });