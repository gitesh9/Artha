/** Pure analytics: no I/O, easy to unit test. Input amounts must already be in the base currency. */
export type BaseTx = { kind: string; amountMinor: number; category: string; occurredOn: string; note?: string | null };

export function summarize(txs: BaseTx[]) {
  let income = 0, expense = 0;
  const byCategory = new Map<string, number>();
  const byDay = new Map<string, { income: number; expense: number }>();
  for (const t of txs) {
    if (t.kind !== "income" && t.kind !== "expense") continue;
    const day = byDay.get(t.occurredOn) ?? { income: 0, expense: 0 };
    if (t.kind === "income") { income += t.amountMinor; day.income += t.amountMinor; }
    else {
      expense += t.amountMinor; day.expense += t.amountMinor;
      byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amountMinor);
    }
    byDay.set(t.occurredOn, day);
  }
  return {
    income, expense, net: income - expense,
    savingsRate: income > 0 ? (income - expense) / income : 0,
    byCategory: [...byCategory].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
    byDay: [...byDay].map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date)),
  };
}

/** Group daily points into months (YYYY-MM) when the range is long, so charts stay readable. */
export function bucketByMonth(byDay: { date: string; income: number; expense: number }[]) {
  const m = new Map<string, { income: number; expense: number }>();
  for (const d of byDay) {
    const k = d.date.slice(0, 7);
    const v = m.get(k) ?? { income: 0, expense: 0 };
    v.income += d.income; v.expense += d.expense; m.set(k, v);
  }
  return [...m].map(([date, v]) => ({ date, ...v }));
}
