import { describe, it, expect } from "vitest";
import { safeReturnPath } from "@/core/offline/return-path";
describe("post-unlock return path", () => {
  it("keeps private page with query", () => expect(safeReturnPath("/transactions?tag=hospital")).toBe("/transactions?tag=hospital"));
  it("blocks external URLs", () => { expect(safeReturnPath("https://evil.com")).toBeUndefined(); expect(safeReturnPath("//evil.com")).toBeUndefined(); });
  it("blocks auth/vault loops", () => { expect(safeReturnPath("/local-vault")).toBeUndefined(); expect(safeReturnPath("/auth")).toBeUndefined(); });
  it("ignores non-strings", () => expect(safeReturnPath(5)).toBeUndefined());
});
