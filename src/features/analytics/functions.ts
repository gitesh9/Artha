import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/core/auth/middleware";
import { RANGES, rangeStart, toISODate } from "@/shared/dates";
import { validDate } from "../insights/service";

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .inputValidator(z.object({ range: z.enum(RANGES), from: z.string().refine(validDate).optional(), to: z.string().refine(validDate).optional() }).refine(v => !v.from || !v.to || v.from <= v.to, "Choose ordered dates"))
  .handler(async ({ data, context }) => {
    const { getDb } = await import("@/core/db/client");
    const { loadBaseTransactions } = await import("./convert.server");
    const { summarize, bucketByMonth } = await import("./service");
    const { baseCurrency, txs, rateInfo } = await loadBaseTransactions(await getDb(), context.userId, {
      from: data.from ?? rangeStart(data.range),
      to: data.to ?? toISODate(new Date()),
    });
    const s = summarize(txs);
    const monthly = ["6M", "1Y", "2Y", "ALL"].includes(data.range);
    return { baseCurrency, rateInfo, ...s, trend: monthly ? bucketByMonth(s.byDay) : s.byDay, trendUnit: monthly ? "month" : "day" };
  });

export const getCalendar = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .inputValidator(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }))
  .handler(async ({ data, context }) => {
    const { getDb } = await import("@/core/db/client");
    const { loadBaseTransactions } = await import("./convert.server");
    const { summarize } = await import("./service");
    const [y = 2000, m = 1] = data.month.split("-").map(Number);
    const { baseCurrency, txs } = await loadBaseTransactions(await getDb(), context.userId, {
      from: `${data.month}-01`,
      to: toISODate(new Date(y, m, 0)),
    });
    return { baseCurrency, ...summarize(txs) };
  });
