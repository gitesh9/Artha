import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/core/auth/middleware";
import { RANGES, rangeStart, toISODate } from "@/shared/dates";
import { validDate } from "../insights/service";
export const wealthReportInput = z.object({ range: z.enum(RANGES), from: z.string().refine(validDate).optional(), to: z.string().refine(validDate).optional() }).refine(v => !v.from || !v.to || v.from <= v.to, "Choose ordered dates");
export const getWealthReport = createServerFn({ method: "GET" }).middleware([requireUser]).inputValidator(wealthReportInput).handler(async ({ data, context }) => {
  const { getDb } = await import("@/core/db/client"), { accountsRepo } = await import("../accounts/repository"), { transactionsRepo } = await import("../transactions/repository"), { planningRepo } = await import("./repository"), { settingsRepo } = await import("../settings/repository"), { getRates } = await import("@/core/integrations/currency"), { wealthHistory, incomeBySource } = await import("./wealth-service"); const db = await getDb();
  const [accounts, entries, records, settings] = await Promise.all([accountsRepo.list(db, context.userId), transactionsRepo.list(db, context.userId, {}, 100001), planningRepo.list(db, context.userId), settingsRepo.get(db, context.userId)]);
  if (entries.length > 100000) throw new Error("This report exceeds its safe entry limit; no incomplete total is shown.");
  const rates = await getRates(settings.baseCurrency), from = data.from ?? rangeStart(data.range), to = data.to ?? toISODate(new Date());
  return { baseCurrency: settings.baseCurrency, from, to, rates: { date: rates.date, source: rates.source, stale: rates.stale }, trend: wealthHistory(accounts, entries, records, rates, settings.baseCurrency, from, to), income: incomeBySource(entries, rates, settings.baseCurrency, from, to) };
});