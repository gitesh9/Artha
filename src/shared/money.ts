/** Money helpers. All stored amounts are integer minor units (e.g. paise) to avoid float errors. */
export const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "JPY", "AUD", "CAD"] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Currencies with no minor unit. */
const ZERO_DECIMAL = new Set(["JPY"]);
export const minorFactor = (currency: string) => (ZERO_DECIMAL.has(currency) ? 1 : 100);

export function toMinor(amount: number, currency: string): number {
  return Math.round(amount * minorFactor(currency));
}
export function fromMinor(minor: number, currency: string): number {
  return minor / minorFactor(currency);
}
export function formatMoney(minor: number, currency: string, opts: { compact?: boolean } = {}): string {
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    notation: opts.compact ? "compact" : "standard",
    maximumFractionDigits: opts.compact ? 1 : ZERO_DECIMAL.has(currency) ? 0 : 2,
  }).format(fromMinor(minor, currency));
}
