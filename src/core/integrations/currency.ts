/**
 * Currency adapter. Swap the provider by implementing RatesProvider.
 * Default: Frankfurter (free, no key, ECB data). Rates are cached per server instance for 6h.
 */
export type Rates = { base: string; date: string; rates: Record<string, number> };

export interface RatesProvider {
  latest(base: string): Promise<Rates>;
}

export const frankfurterProvider: RatesProvider = {
  async latest(base) {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${encodeURIComponent(base)}`);
    if (!res.ok) throw new Error(`Rates request failed: ${res.status}`);
    const json = (await res.json()) as Rates;
    return { ...json, rates: { ...json.rates, [base]: 1 } };
  },
};

const cache = new Map<string, { at: number; value: Rates }>();
const TTL = 6 * 60 * 60 * 1000;

export async function getRates(base: string, provider: RatesProvider = frankfurterProvider): Promise<Rates> {
  const hit = cache.get(base);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  try {
    const value = await provider.latest(base);
    cache.set(base, { at: Date.now(), value });
    return value;
  } catch (e) {
    if (hit) return hit.value; // stale is better than nothing
    console.error(e);
    return { base, date: "", rates: { [base]: 1 } };
  }
}

/**
 * Convert minor units between currencies using rates quoted as 1 base = r units.
 * Returns null when a rate is missing.
 */
export function convertMinor(
  minor: number,
  from: string,
  to: string,
  rates: Rates,
  factor: (c: string) => number,
): number | null {
  if (from === to) return minor;
  const rFrom = rates.rates[from];
  const rTo = rates.rates[to];
  if (!rFrom || !rTo) return null;
  const major = minor / factor(from);
  const inBase = major / rFrom;
  return Math.round(inBase * rTo * factor(to));
}
