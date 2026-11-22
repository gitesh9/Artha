/**
 * Currency adapter. Swap the provider by implementing RatesProvider.
 * Default: Frankfurter (free, no key, ECB data). Rates are cached per server instance for 6h.
 */
export type Rates = { base: string; date: string; rates: Record<string, number>; source?: string; stale?: boolean };

export interface RatesProvider {
  latest(base: string): Promise<Rates>;
}

export const frankfurterProvider: RatesProvider = {
  async latest(base) {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${encodeURIComponent(base)}`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`Rates request failed: ${res.status}`);
    const json = (await res.json()) as Rates;
    if (!json.date || !json.rates || Object.values(json.rates).some(r => !Number.isFinite(r) || r <= 0)) throw new Error("Invalid exchange rates");
    return { ...json, source: "Frankfurter / ECB", stale: false, rates: { ...json.rates, [base]: 1 } };
  },
};

const cache = new Map<string, { at: number; value: Rates }>();
const TTL = 6 * 60 * 60 * 1000;

export async function getRates(base: string, provider: RatesProvider = frankfurterProvider, forceRefresh = false): Promise<Rates> {
  const hit = cache.get(base);
  if (!forceRefresh && hit && Date.now() - hit.at < TTL) return hit.value;
  let saved: Rates | undefined;
  if (provider === frankfurterProvider) {
    try {
      const { getDb } = await import("@/core/db/client"); const { fxSnapshot } = await import("@/core/db/schema"); const { eq } = await import("drizzle-orm");
      const row = (await (await getDb()).select().from(fxSnapshot).where(eq(fxSnapshot.base, base)).limit(1))[0];
      if (row) { saved = { base, date: row.rateDate, rates: row.rates, source: "Frankfurter / ECB", stale: true }; if (!forceRefresh && Date.now() - row.refreshedAt.getTime() < 86400000) return { ...saved, stale: false }; }
    } catch { /* A not-yet-migrated deployment can still fetch fresh public rates. */ }
  }
  try {
    const value = await provider.latest(base);
    cache.set(base, { at: Date.now(), value });
    if (provider === frankfurterProvider) {
      try { const { getDb } = await import("@/core/db/client"); const { fxSnapshot } = await import("@/core/db/schema"); await (await getDb()).insert(fxSnapshot).values({ base, rateDate: value.date, rates: value.rates }).onConflictDoUpdate({ target: fxSnapshot.base, set: { rateDate: value.date, rates: value.rates, refreshedAt: new Date() } }); } catch { /* Fresh rates remain usable if cache persistence fails. */ }
    }
    return value;
  } catch (e) {
    if (hit) return { ...hit.value, stale: true };
    if (saved) return saved;
    return { base, date: "", rates: { [base]: 1 }, source: "Base currency only — exchange service unavailable", stale: true };
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
