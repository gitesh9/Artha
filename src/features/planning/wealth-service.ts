import type { FinancialRecord } from "./schema";
import { convertMinor, type Rates } from "@/core/integrations/currency";
import { minorFactor } from "@/shared/money";
type Account = { id: string; currency: string; openingBalanceMinor: number; createdAt: Date | string };
type Entry = { accountId: string; kind: string; amountMinor: number; currency: string; occurredOn: string; category: string };
/** Historical balances use the recorded opening date; valuations carry forward, never backward. */
export function wealthHistory(accounts: Account[], entries: Entry[], records: FinancialRecord[], rates: Rates, base: string, from: string | null, to: string) {
  const dateOf = (a: Account) => new Date(a.createdAt).toISOString().slice(0, 10);
  const dates = [...new Set([to, ...accounts.map(dateOf), ...entries.map(t => t.occurredOn), ...records.flatMap(r => [r.payload.date, ...r.payload.history.map(v => v.date)])])].filter(d => d <= to && (!from || d >= from)).sort();
  const convert = (amount: number, currency: string) => { const result = convertMinor(amount, currency, base, rates, minorFactor); if (result === null) throw new Error(`Exchange rate unavailable for ${currency}; totals are withheld.`); return result; };
  const relevant = records.filter(r => ["asset", "holding", "liability"].includes(r.kind) && !r.payload.accountId && !(r.kind === "asset" && r.payload.linkedId));
  return dates.map(date => {
    const bank = accounts.filter(a => dateOf(a) <= date).reduce((sum, a) => sum + convert(a.openingBalanceMinor + entries.filter(t => t.accountId === a.id && t.occurredOn <= date).reduce((net, t) => net + (["income", "transfer_in"].includes(t.kind) ? t.amountMinor : -t.amountMinor), 0), a.currency), 0);
    let assets = 0, liabilities = 0;
    for (const record of relevant) { const p = record.payload; const valuations = [...p.history, { date: p.date, amountMinor: p.valueMinor }, ...records.filter(f => f.kind === "flow" && f.payload.linkedId === record.id && f.payload.subtype === "valuation").map(f => ({ date: f.payload.date, amountMinor: f.payload.amountMinor }))].filter(v => v.date <= date).sort((a, b) => a.date.localeCompare(b.date)); const value = valuations.at(-1); if (!value) continue; const converted = convert(value.amountMinor, p.currency); if (record.kind === "liability") liabilities += converted; else assets += converted; }
    return { date, accounts: bank, assets, liabilities, net: bank + assets - liabilities };
  });
}
export function incomeBySource(entries: Entry[], rates: Rates, base: string, from: string | null, to: string) {
  const sums = new Map<string, number>();
  for (const t of entries.filter(t => t.kind === "income" && t.occurredOn <= to && (!from || t.occurredOn >= from))) { const amount = convertMinor(t.amountMinor, t.currency, base, rates, minorFactor); if (amount === null) throw new Error(`Exchange rate unavailable for ${t.currency}`); sums.set(t.category, (sums.get(t.category) ?? 0) + amount); }
  return [...sums].map(([source, amountMinor]) => ({ source, amountMinor })).sort((a, b) => b.amountMinor - a.amountMinor);
}