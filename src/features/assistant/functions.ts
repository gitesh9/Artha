import { createServerFn } from "@tanstack/react-start";
import { requireUser } from "@/core/auth/middleware";
import { chatInput } from "./service";
import { monthPeriod } from "../insights/service";
export const askAssistant = createServerFn({ method: "POST" }).middleware([requireUser]).inputValidator(chatInput).handler(async ({ data, context }) => {
  const key = process.env.OPENROUTER_API_KEY, model = process.env.OPENROUTER_MODEL;
  if (!key) throw new Error("OpenRouter is not configured. Your finances remain available without AI.");
  let report: unknown = null;
  if (data.includeReport) { const { getDb } = await import("@/core/db/client"); const { loadBaseTransactions } = await import("../analytics/convert.server"); const { summarize } = await import("../analytics/service"); const period = monthPeriod(data.month); const rows = await loadBaseTransactions(await getDb(), context.userId, { from: period.from, to: period.to }); report = { month: data.month, currency: rows.baseCurrency, ...summarize(rows.txs), rates: rows.rateInfo }; }
  const { converse } = await import("./adapter.server"); return converse(data.messages, report, key, model);
});
