/** Central query keys so mutations can invalidate everything money-related in one call. */
import type { QueryClient } from "@tanstack/react-query";
export const qk = {
  accounts: ["accounts"] as const,
  settings: ["settings"] as const,
  dashboard: (range: string) => ["money", "dashboard", range] as const,
  transactions: (f: object) => ["money", "transactions", f] as const,
  calendar: (month: string) => ["money", "calendar", month] as const,
  budgets: ["money", "budgets"] as const,
};
export const invalidateMoney = (qc: QueryClient) =>
  Promise.all([qc.invalidateQueries({ queryKey: ["money"] }), qc.invalidateQueries({ queryKey: qk.accounts })]);
