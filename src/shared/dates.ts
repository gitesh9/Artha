/** Date-range helpers for analytics. Dates are YYYY-MM-DD strings (local calendar days). */
export const RANGES = ["1W", "1M", "2M", "3M", "6M", "1Y", "2Y", "ALL"] as const;
export type RangeKey = (typeof RANGES)[number];

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Inclusive start date for a range ending today; null means no lower bound. */
export function rangeStart(range: RangeKey, now: Date = new Date()): string | null {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (range) {
    case "1W": d.setDate(d.getDate() - 6); break;
    case "1M": d.setMonth(d.getMonth() - 1); break;
    case "2M": d.setMonth(d.getMonth() - 2); break;
    case "3M": d.setMonth(d.getMonth() - 3); break;
    case "6M": d.setMonth(d.getMonth() - 6); break;
    case "1Y": d.setFullYear(d.getFullYear() - 1); break;
    case "2Y": d.setFullYear(d.getFullYear() - 2); break;
    case "ALL": return null;
  }
  return toISODate(d);
}

export function monthBounds(now: Date = new Date()): { start: string; end: string } {
  return {
    start: toISODate(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: toISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}
