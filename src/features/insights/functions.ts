import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/core/auth/middleware";
import { budgetAllowance, compareExpenses, dayCount, validDate } from "./service";

const date = z.string().refine(validDate, "Invalid date");
export const insightsInput = z.object({ from: date, to: date, compareFrom: date, compareTo: date, category: z.string().default(""), accountId: z.string().default("") }).superRefine((v, c) => {
  for (const [from, to] of [[v.from, v.to], [v.compareFrom, v.compareTo]]) {
    if (!from || !to || to < from || dayCount(from, to) > 1096) c.addIssue({ code: "custom", message: "Each comparison must be ordered and at most three years." });
  }
});
export const getInsights = createServerFn({ method: "GET" }).middleware([requireUser]).inputValidator(insightsInput).handler(async ({ data, context }) => {
  const { getDb } = await import("@/core/db/client");
  const { loadBaseTransactions } = await import("../analytics/convert.server");
  const { budgetsRepo } = await import("../budgets/repository");
  const db = await getDb();
  const filters = { kind: "expense", ...(data.category ? { category: data.category } : {}), ...(data.accountId ? { accountId: data.accountId } : {}) };
  const [a, b, budgets] = await Promise.all([
    loadBaseTransactions(db, context.userId, { ...filters, from: data.from, to: data.to }),
    loadBaseTransactions(db, context.userId, { ...filters, from: data.compareFrom, to: data.compareTo }), budgetsRepo.list(db, context.userId),
  ]);
  const comparison = compareExpenses(a.txs, b.txs, data.from, data.to, data.compareFrom, data.compareTo);
  return { ...comparison, baseCurrency: a.baseCurrency, rates: a.rateInfo,
    budgets: budgets.filter(b => !data.category || data.category === b.category).map(b => ({ category: b.category, allowance: budgetAllowance(b.monthlyLimitMinor, data.from, data.to), spent: comparison.current.byCategory.find(c => c.category === b.category)?.amount ?? 0 })),
    largest: a.txs.slice().sort((a, b) => b.amountMinor - a.amountMinor).slice(0, 5),
  };
});