import { describe, it, expect } from "vitest";
import { previousPeriod, dayCount, monthPeriod, compareExpenses, budgetAllowance } from "@/features/insights/service";
import { normalizeRow, parseStatementDate, fingerprint, parseQuickText } from "@/features/imports/service";
import { safeSurplus, goalPlan, sip, splitBalances, portfolio, nextBillDate } from "@/features/planning/service";
import { recordInput, payloadSchema } from "@/features/planning/schema";
import { estimateTax, taxableMonetaryGifts, LRS_USD_LIMIT, type TaxInput } from "@/features/tax/service";
import { navigationSchema } from "@/features/assistant/service";
import { encryptExport, decryptExport } from "@/features/backup/encryption";
import { backupSchema } from "@/features/backup/schema";
describe("Insights baselines", () => {
  it("compares November 1–21 with a non-overlapping 21-day period", () => expect(previousPeriod("2026-11-01", "2026-11-21")).toEqual({ from: "2026-10-11", to: "2026-10-31" }));
  it("counts leap February as 29 days", () => expect(dayCount("2024-02-01", monthPeriod("2024-02").to)).toBe(29));
  it("does not invent a percentage without baseline spending", () => expect(compareExpenses([{ kind: "expense", amountMinor: 25000, category: "Food", occurredOn: "2026-11-01" }], [], "2026-11-01", "2026-11-01", "2026-10-31", "2026-10-31").percent).toBeNull());
  it("prorates monthly budget separately from historical change", () => expect(budgetAllowance(300000, "2026-11-01", "2026-11-15")).toBe(150000));
});
describe("Statement review", () => {
  it("uses chosen DMY instead of silently guessing", () => expect(parseStatementDate("03/04/2026", "DMY")).toBe("2026-04-03"));
  it("rejects impossible dates", () => expect(parseStatementDate("31/02/2026", "DMY")).toBe(""));
  it("excludes unresolved rows when both debit and credit exist", () => { const r = normalizeRow(["21/11/2026", "Lunch", "250", "250"], { date: 0, note: 1, debit: 2, credit: 3, amount: -1, format: "DMY" }, "id"); expect(r.selected).toBe(false); expect(r.error).toBe("Both debit and credit are present"); });
  it("treats repeat imports with normalized notes as likely duplicates", () => expect(fingerprint({ date: "2026-11-21", amount: 250, kind: "expense", note: " Lunch " })).toBe(fingerprint({ date: "2026-11-21", amount: 250, kind: "expense", note: "lunch" })));
  it("proposes the amount from natural-language lunch entry", () => expect(parseQuickText("spent 250 on lunch")?.amount).toBe(250));
});
describe("Planning money rules", () => {
  it("monthly bills on January 31 clamp to February 28 instead of skipping February", () => expect(nextBillDate("2026-01-31", 1)).toBe("2026-02-28"));
  it("reserves bills EMIs and emergency buffer before surplus", () => expect(safeSurplus(10000000, 1000000, 2000000, 5000000)).toBe(2000000));
  it("never recommends negative surplus", () => expect(safeSurplus(100, 200, 0, 0)).toBe(0));
  it("calculates goal allocation and shortfall", () => expect(goalPlan(60000000, 12000000, 12, 10000000, 5000000, 1000000)).toEqual({ shortfall: 48000000, monthly: 4000000, affordable: 4000000, feasible: true, monthsNeeded: 12 }));
  it("SIP zero-return preserves exactly the invested amount", () => expect(sip(100000, 10, 0).value).toBe(12000000));
  it("equal splits conserve every minor unit", () => { const record = recordInput.parse({ id: "11111111-1111-4111-8111-111111111111", kind: "split", payload: { name: "Dinner", currency: "INR", date: "2026-11-21", amountMinor: 100, participants: ["A", "B", "C"], payer: "A" } }); const b = splitBalances([record], "INR"); expect(b.reduce((s, r) => s + r.amountMinor, 0)).toBe(0); expect(b.find(r => r.person === "A")?.amountMinor).toBe(66); });
  it("XIRR uses dated cashflows and one-year terminal value", () => { const holding = recordInput.parse({ id: "11111111-1111-4111-8111-111111111111", kind: "holding", payload: { name: "FD", currency: "INR", date: "2025-11-21", amountMinor: 1000000, valueMinor: 1000000 } }); const valuation = recordInput.parse({ id: "22222222-2222-4222-8222-222222222222", kind: "flow", payload: { name: "Value", currency: "INR", date: "2026-11-21", amountMinor: 1100000, linkedId: holding.id, subtype: "valuation" } }); expect(portfolio(holding, [valuation]).xirr).toBeCloseTo(.1, 5); });
});
const tax: TaxInput = { salary: 127500000, other: 0, c80: 0, dSelf: 0, dParents: 0, parentsSenior: false, nps: 0, employerNps: 0, exemptions: 0, stcg: 0, ltcg: 0, year: "2025-26" };
describe("Versioned Indian rules", () => {
  it("rejects negative salary instead of calculating an invented tax refund", () => expect(estimateTax({ ...tax, salary: -1 }, "new").available).toBe(false));
  it("old regime ordinary rebate can cover qualifying 111A tax but not 112A gains", () => expect(estimateTax({ ...tax, salary: 0, stcg: 1000000 }, "old")).toMatchObject({ available: true, total: 0 }));
  it("new regime FY2025-26 has zero ordinary tax at ₹12.75 lakh salary", () => expect(estimateTax(tax, "new")).toMatchObject({ available: true, total: 0, standard: 7500000 }));
  it("does not give capital-gains tax the ordinary rebate", () => expect(estimateTax({ ...tax, salary: 0, stcg: 10000000 }, "new")).toMatchObject({ total: 2080000 }));
  it("does not reuse historical tax rules for an unverified year", () => expect(estimateTax({ ...tax, year: "2026-27" }, "new").available).toBe(false));
  it("non-exempt monetary gifts at ₹50,000 are not taxable", () => expect(taxableMonetaryGifts(5000000, false)).toBe(0));
  it("above ₹50,000 the whole non-exempt gift aggregate is taxable", () => expect(taxableMonetaryGifts(5000100, false)).toBe(5000100));
  it("specified exemptions bypass the non-exempt gift threshold", () => expect(taxableMonetaryGifts(10000000, true)).toBe(0));
  it("LRS resident individual limit is USD250000 per financial year", () => expect(LRS_USD_LIMIT).toBe(250000));
});
it("assistant rejects arbitrary navigation destinations", () => expect(navigationSchema.safeParse({ target: "https://attacker.example", draft: {} }).success).toBe(false));
it("record money cannot contain fractional paise", () => expect(payloadSchema.safeParse({ name: "Goal", date: "2026-11-21", currency: "INR", amountMinor: .1 }).success).toBe(false));
it("encrypted exports reject wrong passphrases and restore correct values", async () => { const data = backupSchema.parse({ version: 1, id: "11111111-1111-4111-8111-111111111111", exportedAt: "2026-11-21T20:00:00.000Z", baseCurrency: "INR", accounts: [], transactions: [], budgets: [], records: [] }); const encrypted = await encryptExport(data, "long-export-passphrase"); expect(JSON.stringify(encrypted)).not.toContain("exportedAt"); await expect(decryptExport(encrypted, "wrong-long-passphrase")).rejects.toThrow(); expect(await decryptExport(encrypted, "long-export-passphrase")).toEqual(data); });