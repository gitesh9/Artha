import { expect, it } from "vitest";
import { receiptTotal } from "@/features/imports/service";
it("receipt review uses an explicit total rather than item prices or tax", () => expect(receiptTotal("Lunch 200\nTax 10\nTOTAL INR 210.00\nThank you")).toBe(210));
it("conflicting receipt totals require manual review", () => expect(receiptTotal("TOTAL 210\nAmount paid 250")).toBeNull());
it("unlabelled item amounts are not treated as a receipt total", () => expect(receiptTotal("Milk 40\nBread 50\nTax 5")).toBeNull());