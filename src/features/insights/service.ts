import { summarize, type BaseTx } from "../analytics/service";

export const DAY = 86400000;
export function validDate(s: string) { return /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s; }
export function dayCount(from: string, to: string) { if (!validDate(from) || !validDate(to) || to < from) throw new Error("Choose valid ordered dates."); return Math.round((Date.parse(to) - Date.parse(from)) / DAY) + 1; }
export function previousPeriod(from: string, to: string) {
  const n = dayCount(from, to);
  return { from: new Date(Date.parse(from) - n * DAY).toISOString().slice(0, 10), to: new Date(Date.parse(from) - DAY).toISOString().slice(0, 10) };
}
export function monthPeriod(month: string) {
  const from = `${month}-01`;
  if (!validDate(from)) throw new Error("Choose a valid month.");
  const d = new Date(from); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0);
  return { from, to: d.toISOString().slice(0, 10) };
}
export function compareExpenses(current: BaseTx[], previous: BaseTx[], from: string, to: string, compareFrom: string, compareTo: string) {
  const a = summarize(current), b = summarize(previous);
  const days = dayCount(from, to), earlierDays = dayCount(compareFrom, compareTo);
  const categories = [...new Set([...a.byCategory, ...b.byCategory].map(c => c.category))].map(category => {
    const now = a.byCategory.find(c => c.category === category)?.amount ?? 0;
    const before = b.byCategory.find(c => c.category === category)?.amount ?? 0;
    return { category, current: now, previous: before, change: now - before };
  }).sort((a, b) => b.change - a.change);
  let total = 0, earlier = 0;
  const pace = Array.from({ length: Math.max(days, earlierDays) }, (_, i) => {
    const date = new Date(Date.parse(from) + i * DAY).toISOString().slice(0, 10);
    const earlierDate = new Date(Date.parse(compareFrom) + i * DAY).toISOString().slice(0, 10);
    total += a.byDay.find(d => d.date === date)?.expense ?? 0;
    earlier += b.byDay.find(d => d.date === earlierDate)?.expense ?? 0;
    return { day: i + 1, current: i < days ? total : null, previous: i < earlierDays ? earlier : null };
  });
  return { current: a, previous: b, days, earlierDays, dailyAverage: Math.round(a.expense / days), earlierDailyAverage: Math.round(b.expense / earlierDays), delta: a.expense - b.expense, percent: b.expense > 0 ? (a.expense - b.expense) / b.expense * 100 : null, categories, pace };
}
export function budgetAllowance(limit: number, from: string, to: string) {
  let allowance = 0;
  for (let t = Date.parse(from); t <= Date.parse(to); t += DAY) {
    const d = new Date(t);
    allowance += limit / new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  }
  return Math.round(allowance);
}