import xirr from "xirr";
import type { FinancialRecord } from "./schema";
export function safeSurplus(liquid: number, bills: number, emis: number, emergency: number) { return Math.max(0, liquid - bills - emis - emergency); }
export function goalPlan(target: number, saved: number, months: number, income: number, expenses: number, buffer: number) {
  const shortfall = Math.max(0, target - saved), monthly = Math.ceil(shortfall / Math.max(1, months)), affordable = Math.max(0, income - expenses - buffer);
  return { shortfall, monthly, affordable, feasible: monthly <= affordable, monthsNeeded: affordable > 0 ? Math.ceil(shortfall / affordable) : null };
}
export function sip(monthly: number, years: number, annualPercent: number) {
  const n = Math.round(years * 12), r = annualPercent / 1200;
  const invested = monthly * n, value = r === 0 ? invested : Math.round(monthly * ((Math.pow(1 + r, n) - 1) / r) * (1 + r));
  return { invested, value, gain: value - invested };
}
export function splitBalances(records: FinancialRecord[], currency: string) {
  const balance = new Map<string, number>(); const add = (person: string, amount: number) => balance.set(person, (balance.get(person) ?? 0) + amount);
  for (const r of records.filter(r => r.payload.currency === currency)) {
    const p = r.payload;
    if (r.kind === "split" && p.participants.length > 0) {
      const share = Math.floor(p.amountMinor / p.participants.length), remainder = p.amountMinor % p.participants.length;
      p.participants.forEach((person, i) => add(person, -(share + (i < remainder ? 1 : 0)))); add(p.payer, p.amountMinor);
    } else if (r.kind === "settlement") { add(p.from, p.amountMinor); add(p.to, -p.amountMinor); }
  }
  return [...balance].map(([person, amountMinor]) => ({ person, amountMinor }));
}
export function portfolio(holding: FinancialRecord, records: FinancialRecord[]) {
  const p = holding.payload;
  const flows = records.filter(r => r.kind === "flow" && r.payload.linkedId === holding.id && r.payload.currency === p.currency).sort((a, b) => a.payload.date.localeCompare(b.payload.date));
  let cost = p.amountMinor, quantity = p.quantity, realized = 0, income = 0, invested = p.amountMinor, proceeds = 0;
  const cash = p.amountMinor > 0 ? [{ amount: -p.amountMinor, when: new Date(p.date) }] : [];
  for (const r of flows) { const f = r.payload; const outgoing = ["buy", "deposit", "fee"].includes(f.subtype);
    if (f.subtype === "valuation") continue;
    cash.push({ amount: outgoing ? -f.amountMinor : f.amountMinor, when: new Date(f.date) });
    if (outgoing) { invested += f.amountMinor; cost += f.amountMinor; if (f.subtype !== "fee") quantity += f.quantity; }
    else if (["sell", "withdraw"].includes(f.subtype)) { const fraction = quantity > 0 && f.quantity > 0 ? Math.min(1, f.quantity / quantity) : Math.min(1, cost > 0 ? f.amountMinor / cost : 0); const basis = Math.round(cost * fraction); realized += f.amountMinor - basis; cost -= basis; quantity = Math.max(0, quantity - f.quantity); proceeds += f.amountMinor; }
    else { income += f.amountMinor; proceeds += f.amountMinor; }
  }
  const valuations = flows.filter(r => r.payload.subtype === "valuation"); const valuation = valuations.at(-1);
  const value = valuation?.payload.amountMinor ?? p.valueMinor, valuationDate = valuation?.payload.date ?? p.date;
  cash.push({ amount: value, when: new Date(valuationDate) });
  let annualReturn: number | null = null;
  const valuationStale = flows.some(f => f.payload.subtype !== "valuation" && f.payload.date > valuationDate);
  try { if (!valuationStale) { const result = xirr(cash); if (Number.isFinite(result)) annualReturn = result; } } catch { /* Missing sign/date variation or no convergent root. */ }
  return { cost, quantity, realized, income, invested, proceeds, value, valuationDate, valuationStale, unrealized: value - cost, gain: value + proceeds - invested, xirr: annualReturn };
}
export function nextBillDate(date: string, months: number) { const original = new Date(`${date}T00:00:00Z`), day = original.getUTCDate(); original.setUTCDate(1); original.setUTCMonth(original.getUTCMonth() + months); const last = new Date(Date.UTC(original.getUTCFullYear(), original.getUTCMonth() + 1, 0)).getUTCDate(); original.setUTCDate(Math.min(day, last)); return original.toISOString().slice(0, 10); }
export function health(income: number, expense: number, emergency: number, monthlyNeeds: number, due: number, liquid: number) {
  if (income <= 0 || monthlyNeeds <= 0) return null;
  const saving = Math.max(0, Math.min(40, (income - expense) / income / 0.2 * 40));
  const buffer = Math.max(0, Math.min(40, emergency / (monthlyNeeds * 6) * 40));
  const coverage = due <= 0 ? 20 : Math.max(0, Math.min(20, liquid / due * 20));
  return { score: Math.round(saving + buffer + coverage), saving: Math.round(saving), buffer: Math.round(buffer), coverage: Math.round(coverage) };
}
export function recurringCandidates<T extends { note: string | null; amountMinor: number; occurredOn: string; kind: string; category: string; currency: string }>(txs: T[]) {
  const grouped = new Map<string, typeof txs>();
  for (const t of txs.filter(t => t.kind === "expense" && t.note)) { const key = `${t.note?.trim().toLowerCase()}|${t.amountMinor}|${t.currency}`; grouped.set(key, [...(grouped.get(key) ?? []), t]); }
  return [...grouped.values()].filter(rows => rows.length >= 3).filter(rows => { const dates = rows.map(r => Date.parse(r.occurredOn)).sort((a, b) => a - b); return dates.slice(1).every((d, i) => { const previous = dates[i]; return previous !== undefined && (d - previous) / 86400000 >= 25 && (d - previous) / 86400000 <= 35; }); }).map(rows => rows[0]).filter((r): r is NonNullable<typeof r> => Boolean(r));
}