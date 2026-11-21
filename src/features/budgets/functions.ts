import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/core/auth/middleware";
import { monthBounds } from "@/shared/dates";
import { toMinor } from "@/shared/money";

export const listBudgets = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const { getDb } = await import("@/core/db/client");
    const { budgetsRepo } = await import("./repository");
    const { loadBaseTransactions } = await import("../analytics/convert.server");
    const { summarize } = await import("../analytics/service");
    const { budgetStatus } = await import("./service");
    const db = await getDb();
    const { start, end } = monthBounds();
    const [budgets, { baseCurrency, txs }] = await Promise.all([
      budgetsRepo.list(db, context.userId),
      loadBaseTransactions(db, context.userId, { from: start, to: end, kind: "expense" }),
    ]);
    const spent = new Map(summarize(txs).byCategory.map((c) => [c.category, c.amount]));
    return {
      baseCurrency,
      budgets: budgets.map((b) => {
        const s = spent.get(b.category) ?? 0;
        return { id: b.id, category: b.category, limitMinor: b.monthlyLimitMinor, spentMinor: s, status: budgetStatus(s, b.monthlyLimitMinor) };
      }),
    };
  });

export const saveBudget = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .inputValidator(z.object({ category: z.string().min(1), limit: z.number().positive().finite() }))
  .handler(async ({ data, context }) => {
    const { getDb } = await import("@/core/db/client");
    const { budgetsRepo } = await import("./repository");
    const { settingsRepo } = await import("../settings/repository");
    const db = await getDb();
    const { baseCurrency } = await settingsRepo.get(db, context.userId);
    await budgetsRepo.upsert(db, context.userId, data.category, toMinor(data.limit, baseCurrency));
    return { ok: true };
  });

export const deleteBudget = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const { getDb } = await import("@/core/db/client");
    const { budgetsRepo } = await import("./repository");
    await budgetsRepo.remove(await getDb(), context.userId, data.id);
    return { ok: true };
  });
