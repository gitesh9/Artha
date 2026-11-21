/** Budget rules: warn at 80% of the monthly limit, "over" above 100%. */
export const BUDGET_WARN_RATIO = 0.8;
export type BudgetStatus = "ok" | "warning" | "over";

export function budgetStatus(spentMinor: number, limitMinor: number): BudgetStatus {
  if (limitMinor <= 0) return "over";
  const r = spentMinor / limitMinor;
  if (r > 1) return "over";
  if (r >= BUDGET_WARN_RATIO) return "warning";
  return "ok";
}
