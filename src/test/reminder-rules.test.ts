import { expect, it } from "vitest";
import { allowedPushEndpoint, istReminderDate } from "@/features/reminders/service";
it("evening reminders are scheduled at 8 PM Asia/Kolkata", () => expect(istReminderDate(new Date("2026-11-21T14:30:00Z"))).toBe("2026-11-21"));
it("does not deliver the evening reminder outside its hour", () => expect(istReminderDate(new Date("2026-11-21T13:30:00Z"))).toBeNull());
it("push subscriptions cannot target arbitrary or local servers", () => { expect(allowedPushEndpoint("https://fcm.googleapis.com/fcm/send/test")).toBe(true); expect(allowedPushEndpoint("https://localhost/private")).toBe(false); expect(allowedPushEndpoint("https://fcm.googleapis.com.attacker.example/private")).toBe(false); });