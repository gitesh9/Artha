import { describe, expect, it } from "vitest";
import { resolveTheme } from "@/shared/components/ThemeProvider";

describe("Artha appearance preference", () => {
  it("defaults to dark when no preference is saved", () => {
    expect(resolveTheme(null)).toBe("dark");
  });
  it("keeps a saved light preference", () => {
    expect(resolveTheme("light")).toBe("light");
  });
  it("keeps a saved dark preference", () => {
    expect(resolveTheme("dark")).toBe("dark");
  });
});