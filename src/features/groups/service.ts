import { z } from "zod";
import { CURRENCIES } from "@/shared/money";
import { payloadSchema } from "../planning/schema";
export const createGroupInput = z.object({ name: z.string().trim().min(1).max(80), currency: z.enum(CURRENCIES) });
export const groupIdInput = z.object({ groupId: z.string().uuid() });
export const inviteInput = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) });
export const memberInput = groupIdInput.extend({ userId: z.string().min(1).max(100), approve: z.boolean() });
export const entryInput = groupIdInput.extend({ id: z.string().uuid(), kind: z.enum(["split", "settlement"]), payload: payloadSchema });
export function assertParticipants(kind: string, payload: z.infer<typeof payloadSchema>, members: string[], currency: string) { if (payload.currency !== currency || payload.amountMinor <= 0) throw new Error("Use a positive amount in the group's currency"); const required = kind === "split" ? [...payload.participants, payload.payer] : [payload.from, payload.to]; if (!required.length || required.some(id => !members.includes(id))) throw new Error("Every participant must be an approved group member"); if (kind === "split" && (!payload.participants.includes(payload.payer) || new Set(payload.participants).size !== payload.participants.length)) throw new Error("Include the payer once among the participants"); if (kind === "settlement" && payload.from === payload.to) throw new Error("Choose two different members"); }
export async function hashInvite(token: string) { return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)))).map(n => n.toString(16).padStart(2, "0")).join(""); }