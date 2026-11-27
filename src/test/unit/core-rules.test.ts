/** Pure business-rule tests. Add a `describe` per feature; keep one rule per `it`. */
import { describe, it, expect } from "vitest";
import { toMinor, fromMinor, formatMoney, minorFactor } from "@/shared/money";
import { transactionTags, taggedNote } from "@/features/transactions/tags";
import { transferAmounts, pairedId } from "@/features/transactions/transfer-service";
import { summarize, bucketByMonth } from "@/features/analytics/service";
import { validDate, dayCount, previousPeriod, monthPeriod, compareExpenses, budgetAllowance } from "@/features/insights/service";
import { parseStatementDate, parseAmount, fingerprint, normalizeRow, parseQuickText, receiptTotal } from "@/features/imports/service";
import { budgetStatus } from "@/features/budgets/service";
import { safeSurplus, goalPlan, sip, nextBillDate, health, recurringCandidates } from "@/features/planning/service";
import { paymentShortfall, DEFAULT_PAYMENT_CHOICE } from "@/features/planning/cashflow-service";
import { estimateTax, advanceTaxPlan, advanceTaxDates, taxableMonetaryGifts, type TaxInput } from "@/features/tax/service";
import { allowedPushEndpoint, istReminderDate } from "@/features/reminders/service";
import { assertParticipants, hashInvite } from "@/features/groups/service";

describe("money", () => {
  it("stores rupees as paise", () => expect(toMinor(12.34, "INR")).toBe(1234));
  it("avoids float drift", () => expect(toMinor(0.1 + 0.2, "INR")).toBe(30));
  it("JPY has no minor unit", () => { expect(minorFactor("JPY")).toBe(1); expect(toMinor(500, "JPY")).toBe(500); });
  it("round-trips", () => expect(fromMinor(toMinor(999.99, "USD"), "USD")).toBe(999.99));
  it("formats INR in Indian grouping", () => expect(formatMoney(12345600, "INR")).toBe("₹1,23,456.00"));
  it("formats negative amounts", () => expect(formatMoney(-500, "INR")).toContain("5.00"));
});

describe("tags", () => {
  it("extracts lowercase unique tags", () => expect(transactionTags("Visit #Hospital #hospital #dentist")).toEqual(["hospital", "dentist"]));
  it("handles empty notes", () => { expect(transactionTags(null)).toEqual([]); expect(transactionTags("")).toEqual([]); });
  it("appends new tags without duplicates", () => expect(taggedNote("Fuel #car", "#car petrol")).toBe("Fuel #car #petrol"));
  it("accepts commas", () => expect(taggedNote("", "a,b")).toBe("#a #b"));
  it("rejects invalid characters", () => expect(() => taggedNote("x", "bad!tag")).toThrow());
  it("rejects more than 20 tags", () => expect(() => taggedNote("", Array.from({ length: 21 }, (_, i) => `t${i}`).join(" "))).toThrow());
  it("rejects notes over 200 chars", () => expect(() => taggedNote("a".repeat(198), "tag")).toThrow());
});

describe("transfers", () => {
  const a = { id: "a", currency: "INR" }, b = { id: "b", currency: "INR" }, u = { id: "u", currency: "USD" };
  it("same currency mirrors amount", () => expect(transferAmounts(a, b, 100)).toEqual({ outgoing: 10000, incoming: 10000 }));
  it("blocks same account", () => expect(() => transferAmounts(a, a, 1)).toThrow());
  it("blocks zero/negative", () => { expect(() => transferAmounts(a, b, 0)).toThrow(); expect(() => transferAmounts(a, b, -5)).toThrow(); });
  it("cross currency needs received amount", () => { expect(() => transferAmounts(a, u, 100)).toThrow(); expect(transferAmounts(a, u, 8300, 100)).toEqual({ outgoing: 830000, incoming: 10000 }); });
  it("paired id is deterministic v4-shaped UUID", async () => {
    const x = await pairedId("abc"); expect(x).toBe(await pairedId("abc")); expect(x).not.toBe(await pairedId("abd"));
    expect(x).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe("analytics", () => {
  const txs = [
    { kind: "income", amountMinor: 100000, category: "Salary", occurredOn: "2026-01-01" },
    { kind: "expense", amountMinor: 30000, category: "Food", occurredOn: "2026-01-02" },
    { kind: "expense", amountMinor: 10000, category: "Health", occurredOn: "2026-02-02" },
    { kind: "transfer_out", amountMinor: 50000, category: "Transfer", occurredOn: "2026-01-03" },
  ];
  const s = summarize(txs);
  it("totals income/expense excluding transfers", () => { expect(s.income).toBe(100000); expect(s.expense).toBe(40000); expect(s.net).toBe(60000); });
  it("savings rate", () => expect(s.savingsRate).toBeCloseTo(0.6));
  it("categories sorted desc", () => expect(s.byCategory.map(c => c.category)).toEqual(["Food", "Health"]));
  it("zero income gives 0 rate", () => expect(summarize([]).savingsRate).toBe(0));
  it("buckets by month", () => expect(bucketByMonth(s.byDay)).toEqual([{ date: "2026-01", income: 100000, expense: 30000 }, { date: "2026-02", income: 0, expense: 10000 }]));
});

describe("insights periods", () => {
  it("validates dates", () => { expect(validDate("2026-02-29")).toBe(false); expect(validDate("2024-02-29")).toBe(true); expect(validDate("26-1-1")).toBe(false); });
  it("counts inclusive days", () => expect(dayCount("2026-01-01", "2026-01-31")).toBe(31));
  it("rejects reversed range", () => expect(() => dayCount("2026-02-01", "2026-01-01")).toThrow());
  it("previous period equal length", () => expect(previousPeriod("2026-03-01", "2026-03-10")).toEqual({ from: "2026-02-19", to: "2026-02-28" }));
  it("month period handles leap Feb", () => expect(monthPeriod("2024-02")).toEqual({ from: "2024-02-01", to: "2024-02-29" }));
  it("compare computes delta and percent", () => {
    const r = compareExpenses([{ kind: "expense", amountMinor: 300, category: "Food", occurredOn: "2026-02-01" }], [{ kind: "expense", amountMinor: 200, category: "Food", occurredOn: "2026-01-01" }], "2026-02-01", "2026-02-28", "2026-01-01", "2026-01-31");
    expect(r.delta).toBe(100); expect(r.percent).toBe(50); expect(r.pace).toHaveLength(31); expect(r.pace[30]?.current).toBeNull();
  });
  it("percent null when no previous spend", () => expect(compareExpenses([], [], "2026-01-01", "2026-01-01", "2025-12-31", "2025-12-31").percent).toBeNull());
  it("full-month allowance equals limit", () => expect(budgetAllowance(31000, "2026-01-01", "2026-01-31")).toBe(31000));
});

describe("imports", () => {
  it("parses DMY/MDY/YMD", () => { expect(parseStatementDate("05/03/2026", "DMY")).toBe("2026-03-05"); expect(parseStatementDate("03/05/2026", "MDY")).toBe("2026-03-05"); expect(parseStatementDate("2026-03-05", "YMD")).toBe("2026-03-05"); });
  it("rejects impossible dates", () => { expect(parseStatementDate("31/02/2026", "DMY")).toBe(""); expect(parseStatementDate("garbage", "DMY")).toBe(""); });
  it("parses Indian amounts", () => { expect(parseAmount("₹1,23,456.50")).toBe(123456.5); expect(parseAmount("Rs. 200 DR")).toBe(200); expect(parseAmount("abc")).toBeNull(); });
  it("fingerprint normalises whitespace/case", () => expect(fingerprint({ date: "2026-01-01", amount: 5, kind: "expense", note: " Big  Bazaar " })).toBe(fingerprint({ date: "2026-01-01", amount: 5, kind: "expense", note: "big bazaar" })));
  const map = { date: 0, debit: 1, credit: 2, amount: -1, note: 3, format: "DMY" as const };
  it("debit row becomes expense", () => expect(normalizeRow(["01/01/2026", "500", "", "Fuel"], map, "1")).toMatchObject({ kind: "expense", amount: 500, selected: true }));
  it("credit row becomes income", () => expect(normalizeRow(["01/01/2026", "", "900", "Salary"], map, "1").kind).toBe("income"));
  it("both debit and credit flagged", () => expect(normalizeRow(["01/01/2026", "5", "5", "x"], map, "1")).toMatchObject({ selected: false, error: "Both debit and credit are present" }));
  it("bad date deselected", () => expect(normalizeRow(["bad", "5", "", "x"], map, "1").selected).toBe(false));
  it("quick text detects income", () => expect(parseQuickText("Salary credited 50,000")).toMatchObject({ amount: 50000, kind: "income" }));
  it("quick text food category", () => expect(parseQuickText("spent 250 on lunch")).toMatchObject({ category: "Food", kind: "expense" }));
  it("quick text without amount", () => expect(parseQuickText("hello")).toBeNull());
  it("receipt picks labelled total only", () => { expect(receiptTotal("Subtotal 90\nTax 10\nTotal: ₹100")).toBe(100); expect(receiptTotal("Item 50\nItem 20")).toBeNull(); });
  it("receipt with conflicting totals is ambiguous", () => expect(receiptTotal("Total 100\nGrand total 120")).toBeNull());
});

describe("budgets", () => {
  it("ok below 80%", () => expect(budgetStatus(79, 100)).toBe("ok"));
  it("warning at 80%", () => expect(budgetStatus(80, 100)).toBe("warning"));
  it("warning at exactly 100%", () => expect(budgetStatus(100, 100)).toBe("warning"));
  it("over above 100%", () => expect(budgetStatus(101, 100)).toBe("over"));
  it("zero limit is over", () => expect(budgetStatus(0, 0)).toBe("over"));
});

describe("planning", () => {
  it("surplus never negative", () => { expect(safeSurplus(100, 50, 20, 10)).toBe(20); expect(safeSurplus(10, 50, 0, 0)).toBe(0); });
  it("goal plan feasibility", () => expect(goalPlan(120000, 20000, 10, 50000, 30000, 5000)).toMatchObject({ shortfall: 100000, monthly: 10000, affordable: 15000, feasible: true, monthsNeeded: 7 }));
  it("goal unaffordable", () => expect(goalPlan(1000, 0, 1, 10, 20, 0)).toMatchObject({ feasible: false, monthsNeeded: null }));
  it("sip zero return", () => expect(sip(1000, 1, 0)).toEqual({ invested: 12000, value: 12000, gain: 0 }));
  it("sip positive return grows", () => expect(sip(1000, 10, 12).value).toBeGreaterThan(230000));
  it("next bill clamps month end", () => { expect(nextBillDate("2026-01-31", 1)).toBe("2026-02-28"); expect(nextBillDate("2024-01-31", 1)).toBe("2024-02-29"); expect(nextBillDate("2026-12-15", 1)).toBe("2027-01-15"); });
  it("health null without income", () => expect(health(0, 0, 0, 1, 0, 0)).toBeNull());
  it("health perfect score", () => expect(health(100, 80, 600, 100, 0, 0)?.score).toBe(100));
  it("recurring detection needs 3 monthly", () => {
    const t = (d: string) => ({ note: "Netflix", amountMinor: 64900, occurredOn: d, kind: "expense", category: "Bills", currency: "INR" });
    expect(recurringCandidates([t("2026-01-05"), t("2026-02-05"), t("2026-03-05")])).toHaveLength(1);
    expect(recurringCandidates([t("2026-01-05"), t("2026-02-05")])).toHaveLength(0);
    expect(recurringCandidates([t("2026-01-05"), t("2026-01-10"), t("2026-02-05")])).toHaveLength(0);
  });
});

describe("obligation safety", () => {
  it("default choice is unpaid", () => expect(DEFAULT_PAYMENT_CHOICE).toBe("unpaid"));
  it("shortfall", () => { expect(paymentShortfall(500, 800)).toBe(300); expect(paymentShortfall(900, 800)).toBe(0); });
});

describe("tax FY2025-26", () => {
  const base: TaxInput = { salary: 0, other: 0, c80: 0, dSelf: 0, dParents: 0, parentsSenior: false, nps: 0, employerNps: 0, exemptions: 0, stcg: 0, ltcg: 0, year: "2025-26" };
  it("₹12.75L salary is nil under new regime", () => expect(estimateTax({ ...base, salary: 127500000 }, "new")).toMatchObject({ available: true, total: 0 }));
  it("₹10L new regime fully rebated", () => expect(estimateTax({ ...base, salary: 100000000 }, "new")).toMatchObject({ normal: 3250000, total: 0 }));
  it("₹20L new regime tax", () => { const r = estimateTax({ ...base, salary: 207500000 }, "new"); expect(r.available && r.total).toBe(Math.round(20000000 * 1.04)); });
  it("old regime caps 80C at 1.5L", () => { const r = estimateTax({ ...base, salary: 100000000, c80: 50000000 }, "old"); expect(r.available && r.deductions).toBe(15000000); });
  it("rejects unverified year", () => expect(estimateTax({ ...base, year: "2026-27" }, "new").available).toBe(false));
  it("rejects negatives", () => expect(estimateTax({ ...base, salary: -1 }, "new").available).toBe(false));
  it("advance tax under ₹10k not required", () => expect(advanceTaxPlan(1500000, 600000, "2025-26").required).toBe(false));
  it("advance tax instalments cumulative", () => expect(advanceTaxPlan(2000000, 0, "2025-26").installments.map(i => i.amountMinor)).toEqual([300000, 900000, 1500000, 2000000]));
  it("advance tax dates", () => expect(advanceTaxDates("2025-26").at(-1)?.date).toBe("2026-03-15"));
  it("gifts ≤ ₹50k untaxed", () => { expect(taxableMonetaryGifts(5000000, false)).toBe(0); expect(taxableMonetaryGifts(5000100, false)).toBe(5000100); expect(taxableMonetaryGifts(9e9, true)).toBe(0); });
});

describe("reminders", () => {
  it("accepts known push hosts only", () => { expect(allowedPushEndpoint("https://fcm.googleapis.com/x")).toBe(true); expect(allowedPushEndpoint("https://evil.com/x")).toBe(false); expect(allowedPushEndpoint("http://fcm.googleapis.com/x")).toBe(false); });
  it("fires only at 8 PM IST", () => { expect(istReminderDate(new Date("2026-01-01T14:30:00Z"))).toBe("2026-01-01"); expect(istReminderDate(new Date("2026-01-01T13:00:00Z"))).toBeNull(); });
});

describe("groups", () => {
  const p = (x: object) => ({ currency: "INR", amountMinor: 100, participants: ["a", "b"], payer: "a", from: "a", to: "b", ...x }) as never;
  it("valid split passes", () => expect(() => assertParticipants("split", p({}), ["a", "b"], "INR")).not.toThrow());
  it("non-member rejected", () => expect(() => assertParticipants("split", p({ participants: ["a", "c"] }), ["a", "b"], "INR")).toThrow());
  it("wrong currency rejected", () => expect(() => assertParticipants("split", p({ currency: "USD" }), ["a", "b"], "INR")).toThrow());
  it("self settlement rejected", () => expect(() => assertParticipants("settlement", p({ to: "a" }), ["a", "b"], "INR")).toThrow());
  it("invite hash is sha-256 hex", async () => expect(await hashInvite("x")).toMatch(/^[a-f0-9]{64}$/));
});
