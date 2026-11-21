import { describe, expect, it } from "vitest";
import { formatMoney, fromMinor, minorFactor, toMinor } from "@/shared/money";
import { rangeStart } from "@/shared/dates";
import { convertMinor } from "@/core/integrations/currency";
import { budgetStatus } from "@/features/budgets/service";
import { summarize } from "@/features/analytics/service";

describe("money", () => {
  it("stores rupees as paise without float drift", () => {
    expect(toMinor(0.1 + 0.2, "INR")).toBe(30);
    expect(fromMinor(12345, "INR")).toBe(123.45);
  });
  it("formats INR in Indian grouping", () => {
    expect(formatMoney(12345600, "INR")).toBe("₹1,23,456.00");
  });
});

describe("currency conversion", () => {
  const rates = { base: "INR", date: "", rates: { INR: 1, USD: 0.012 } };
  it("converts 100 USD to INR at 1 INR = 0.012 USD", () => {
    expect(convertMinor(10000, "USD", "INR", rates, minorFactor)).toBe(833333);
  });
  it("returns null for unknown currency", () => {
    expect(convertMinor(100, "XYZ", "INR", rates, minorFactor)).toBeNull();
  });
});

describe("budgets", () => {
  it("warns at 80% of the limit", () => expect(budgetStatus(800, 1000)).toBe("warning"));
  it("is ok below 80%", () => expect(budgetStatus(799, 1000)).toBe("ok"));
  it("is over above 100%", () => expect(budgetStatus(1001, 1000)).toBe("over"));
});

describe("ranges", () => {
  const now = new Date(2026, 10, 17);
  it("1W covers the last 7 days including today", () => expect(rangeStart("1W", now)).toBe("2026-11-11"));
  it("3M goes back three months", () => expect(rangeStart("3M", now)).toBe("2026-08-17"));
  it("ALL has no start", () => expect(rangeStart("ALL", now)).toBeNull());
});

describe("summary", () => {
  it("computes savings rate from income and expense", () => {
    const s = summarize([
      { kind: "income", amountMinor: 10000, category: "Salary", occurredOn: "2026-11-01" },
      { kind: "expense", amountMinor: 2500, category: "Food", occurredOn: "2026-11-02" },
    ]);
    expect(s.net).toBe(7500);
    expect(s.savingsRate).toBe(0.75);
  });
});
