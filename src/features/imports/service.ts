import { validDate } from "../insights/service";
export type ImportRow = { id: string; date: string; amount: number; kind: "income" | "expense"; note: string; category: string; selected: boolean; error: string; duplicate: boolean };
export function parseStatementDate(text: string, format: "DMY" | "MDY" | "YMD") {
  const parts = text.trim().split(/[-/.]/).map(Number);
  if (parts.length !== 3) return "";
  const [a = 0, b = 0, c = 0] = parts;
  const [y, m, d] = format === "YMD" ? [a, b, c] : format === "DMY" ? [c, b, a] : [c, a, b];
  const result = `${y.toString().padStart(4, "0")}-${m.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
  return y >= 1900 && validDate(result) ? result : "";
}
export function parseAmount(value: string) {
  const raw = value.trim().replace(/^(?:₹|INR|Rs\.?|USD|EUR|GBP)\s*/i, "").replace(/,/g, "").replace(/\s*(?:DR|CR)$/i, "");
  if (!/^-?\d+(?:\.\d{1,3})?$/.test(raw)) return null;
  const n = Number(raw); return Number.isFinite(n) ? n : null;
}
export function fingerprint(row: { date: string; amount: number; kind: string; note: string }) { return [row.date, row.amount.toFixed(2), row.kind, row.note.trim().toLowerCase().replace(/\s+/g, " ")].join("|"); }
export function normalizeRow(raw: string[], map: { date: number; debit: number; credit: number; amount: number; note: number; format: "DMY" | "MDY" | "YMD" }, id: string): ImportRow {
  const date = parseStatementDate(raw[map.date] ?? "", map.format);
  const debit = map.debit < 0 ? null : parseAmount(raw[map.debit] ?? "");
  const credit = map.credit < 0 ? null : parseAmount(raw[map.credit] ?? "");
  const amount = map.amount < 0 ? null : parseAmount(raw[map.amount] ?? "");
  const ambiguous = (debit ?? 0) !== 0 && (credit ?? 0) !== 0;
  const value = Math.abs((debit ?? 0) !== 0 ? debit ?? 0 : (credit ?? 0) !== 0 ? credit ?? 0 : amount ?? 0);
  const error = !date ? "Review the date" : ambiguous ? "Both debit and credit are present" : value <= 0 ? "Review the amount" : "";
  return { id, date, amount: value, kind: (credit ?? 0) > 0 || (amount ?? 0) > 0 && map.debit < 0 && map.credit < 0 ? "income" : "expense", note: (raw[map.note] ?? "").slice(0, 200), category: "Other", selected: !error, error, duplicate: false };
}
export function parseQuickText(text: string) {
  const match = text.match(/(?:₹|INR|Rs\.?|spent|paid|received|credited|debited)\s*([\d,]+(?:\.\d{1,2})?)/i);
  const amount = parseAmount(match?.[1] ?? "");
  if (!amount || amount <= 0) return null;
  return { amount, kind: /received|credited|salary/i.test(text) ? "income" as const : "expense" as const, note: text.trim().slice(0, 200), category: /lunch|food|dinner|coffee/i.test(text) ? "Food" : "Other" };
}
/** Select only an explicitly labelled total, never a subtotal/tax or arbitrary number. */
export function receiptTotal(text: string) {
  const values = text.split(/\r?\n/).map(line => line.match(/^\s*(?:grand\s+total|total\s+(?:amount|paid|due)|amount\s+(?:paid|due)|total)\s*[:=-]?\s*(?:₹|INR|Rs\.?|USD|EUR|GBP)?\s*([\d,]+(?:\.\d{1,2})?)\s*$/i)?.[1]).filter((v): v is string => Boolean(v)).map(parseAmount).filter((v): v is number => v !== null && v > 0);
  const unique = [...new Set(values)]; return unique.length === 1 ? unique[0] ?? null : null;
}