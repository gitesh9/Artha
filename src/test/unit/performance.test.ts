/** Performance budgets for pure calculations on large data sets. */
import { describe, it, expect } from "vitest";
import { summarize, bucketByMonth } from "@/features/analytics/service";
import { compareExpenses } from "@/features/insights/service";
import { recurringCandidates } from "@/features/planning/service";
const day = (i: number) => new Date(Date.UTC(2020, 0, 1) + (i % 1800) * 86400000).toISOString().slice(0, 10);
const txs = Array.from({ length: 50000 }, (_, i) => ({ kind: i % 5 ? "expense" : "income", amountMinor: 100 + i, category: `C${i % 12}`, occurredOn: day(i), note: `n${i % 40}`, currency: "INR" }));
const time = (f: () => unknown) => { const t = performance.now(); f(); return performance.now() - t; };
describe("performance", () => {
  it("summarizes 50k entries under 300ms", () => expect(time(() => bucketByMonth(summarize(txs).byDay))).toBeLessThan(300));
  it("compares a year of data under 1.5s", () => expect(time(() => compareExpenses(txs.slice(0, 10000), txs.slice(10000, 20000), "2020-01-01", "2020-12-31", "2019-01-01", "2019-12-31"))).toBeLessThan(1500));
  it("recurring detection on 50k under 500ms", () => expect(time(() => recurringCandidates(txs))).toBeLessThan(500));
});
