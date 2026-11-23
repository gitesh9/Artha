import { z } from "zod";
import { CURRENCIES } from "@/shared/money";
import { validDate } from "../insights/service";
export const RECORD_KINDS = ["asset", "liability", "holding", "flow", "goal", "contribution", "bill", "salary", "split", "settlement", "scenario", "income-source", "comparison", "forecast"] as const;
export type RecordKind = typeof RECORD_KINDS[number];
const minor = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const date = z.string().refine(validDate);
export const payloadSchema = z.object({
  name: z.string().trim().min(1).max(80), currency: z.enum(CURRENCIES), amountMinor: minor,
  date, note: z.string().max(500).default(""), linkedId: z.string().uuid().optional(),
  subtype: z.enum(["other", "stock", "mutual-fund", "fd", "gold", "ppf", "buy", "sell", "deposit", "withdraw", "dividend", "interest", "fee", "valuation", "monthly", "annual", "emi", "sip", "income", "expense"]).default("other"),
  quantity: z.number().finite().min(0).default(0), targetMinor: minor.default(0), valueMinor: minor.default(0),
  paid: z.boolean().default(false), accountId: z.string().optional(), category: z.string().max(40).default("Other"),
  paymentStatus: z.enum(["unpaid", "missed", "bounced"]).default("unpaid"), penaltyMinor: minor.default(0),
  installmentsLeft: z.number().int().min(1).max(600).default(1),
  participants: z.array(z.string().trim().min(1).max(60)).max(30).default([]), payer: z.string().max(60).default(""),
  from: z.string().max(60).default(""), to: z.string().max(60).default(""),
  history: z.array(z.object({ date, amountMinor: minor })).max(500).default([]),
  inputs: z.record(z.string().max(40), z.union([z.number().finite(), z.string().max(100)])).default({}),
}).strict();
export const recordInput = z.object({ id: z.string().uuid(), kind: z.enum(RECORD_KINDS), payload: payloadSchema });
export type FinancialRecord = z.infer<typeof recordInput>;