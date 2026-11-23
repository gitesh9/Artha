import type { FinancialRecord } from "./schema";
import { nextBillDate } from "./service";
export const DEFAULT_PAYMENT_CHOICE = "unpaid" as const;
export function paymentShortfall(balanceMinor: number, amountMinor: number) { return Math.max(0, amountMinor - balanceMinor); }
export function cashflowAdvice(accounts: { id: string; name: string; currency: string; balanceMinor: number }[], records: { id: string; kind: string; payload: Omit<FinancialRecord["payload"], "currency"> & { currency: string } }[], expenses: { kind: string; currency: string; amountMinor: number; occurredOn: string }[], currency: string, today: string) {
  const end = new Date(Date.parse(today) + 30 * 86400000).toISOString().slice(0,10), soon = new Date(Date.parse(today) + 5 * 86400000).toISOString().slice(0,10), start = new Date(Date.parse(today) - 29 * 86400000).toISOString().slice(0,10);
  const available = accounts.filter(a => a.currency === currency);
  const bills = records.filter(r => r.kind === "bill" && !r.payload.paid && r.payload.currency === currency && r.payload.date <= end);
  // Monthly schedules may only hold their next occurrence. Reserve all dates within the horizon.
  let obligations = 0;
  for (const bill of bills) { const p = bill.payload; obligations += p.amountMinor + p.penaltyMinor; const repeats = ["monthly", "sip", "annual", "emi"].includes(p.subtype); if (repeats) { let next = nextBillDate(p.date,p.subtype === "annual" ? 12 : 1), count = 1; while (next <= end && count < (p.subtype === "emi" ? p.installmentsLeft : 1200)) { obligations += p.amountMinor; count++; next = nextBillDate(next,p.subtype === "annual" ? 12 : 1); } } }
  const monthlyExpense = expenses.filter(t => t.kind === "expense" && t.currency === currency && t.occurredOn >= start && t.occurredOn <= today).reduce((s,t) => s+t.amountMinor,0), buffer = Math.ceil(monthlyExpense / 30 * 15);
  const balance = available.reduce((s,a) => s+a.balanceMinor,0), surplus = Math.max(0, balance-obligations-buffer);
  const alerts = bills.filter(b => b.payload.date <= soon).flatMap(b => { const linked = available.find(a => a.id === b.payload.accountId); if (!linked) return []; const shortfall = paymentShortfall(linked.balanceMinor, b.payload.amountMinor + b.payload.penaltyMinor); return shortfall > 0 ? [{ id: b.id, name: b.payload.name, account: linked.name, shortfall, date: b.payload.date, alternatives: available.filter(a => a.id !== linked.id && a.balanceMinor >= shortfall).map(a => a.name) }] : []; });
  return { balance, obligations, buffer, surplus, suggestTransfer: currency === "INR" && monthlyExpense > 0 && surplus > 1000000, monthlyExpense, emergencyMin: monthlyExpense*3, emergencyMax: monthlyExpense*6, alerts, missingHistory: monthlyExpense === 0 };
}