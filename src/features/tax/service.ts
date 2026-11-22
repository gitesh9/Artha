/** FY 2025-26 / AY 2026-27. Resident individual under 60, eligible salary and listed equity gains only. */
export const TAX_SOURCE = "https://www.incometax.gov.in/iec/foportal/help/individual/return-applicable-1";
export const LEGAL_SOURCES = { gifts: "https://www.incometaxindia.gov.in/w/section-56-64", clubbing: "https://www.incometaxindia.gov.in/pages/acts/income-tax-act.aspx", lrs: "https://www.rbi.org.in/scripts/FS_Notification.aspx?Id=9756" };
export const LEGAL_GUIDANCE = [
  "FY 2025-26: A HUF is a separate taxable entity where legally constituted. Merely moving personal assets into a HUF does not make their income exempt; Section 64(2) may club converted personal-property income back to the individual. Seek advice on constitution, corpus and records.",
  "Section 56(2)(x): monetary gifts from specified relatives and qualifying exceptions (including an individual's marriage or inheritance) can be exempt. For non-exempt monetary gifts exceeding ₹50,000 in aggregate in the year, the entire aggregate is generally taxable, not just the excess. Property gifts have separate rules. A friend is not automatically a specified relative.",
  "Section 64: transfers to a spouse, son's wife or a minor child can trigger clubbing, subject to statutory exceptions. An exempt receipt of a gift does not necessarily make subsequent investment income exempt from clubbing.",
  "RBI LRS: resident individuals can generally remit up to USD 250,000 per financial year for permitted purposes, with restrictions, bank checks and potentially TCS. This is not an allowance for HUFs or a tax exemption. Check current RBI directions before remitting.",
];
export function taxableMonetaryGifts(totalMinor: number, qualifiesForExemption: boolean) { return qualifiesForExemption || totalMinor <= 5000000 ? 0 : totalMinor; }
export const LRS_USD_LIMIT = 250000;
export type TaxInput = { salary: number; other: number; c80: number; dSelf: number; dParents: number; parentsSenior: boolean; nps: number; employerNps: number; exemptions: number; stcg: number; ltcg: number; year: string };
function slab(income: number, bands: [number, number][]) { let tax = 0, previous = 0; for (const [ceiling, rate] of bands) { tax += Math.max(0, Math.min(income, ceiling) - previous) * rate; previous = ceiling; } return Math.round(tax); }
export function estimateTax(input: TaxInput, regime: "old" | "new") {
  const numeric = Object.values(input).filter((v): v is number => typeof v === "number");
  if (numeric.length !== 10 || numeric.some(n => !Number.isSafeInteger(n) || n < 0)) return { available: false as const, reason: "Use finite, non-negative whole paise for every money input." };
  if (input.year !== "2025-26") return { available: false as const, reason: "This financial year has not been verified. Choose FY 2025-26; do not apply historical rules to a current-year return." };
  const standard = Math.min(input.salary, regime === "new" ? 7500000 : 5000000);
  const deductions = regime === "new" ? input.employerNps : Math.min(input.c80, 15000000) + Math.min(input.dSelf, 2500000) + Math.min(input.dParents, input.parentsSenior ? 5000000 : 2500000) + Math.min(input.nps, 5000000) + input.employerNps + input.exemptions;
  const taxable = Math.max(0, input.salary + input.other - standard - deductions), totalIncome = taxable + input.stcg + input.ltcg;
  if (totalIncome > 500000000 && (input.stcg > 0 || input.ltcg > 0)) return { available: false as const, reason: "Mixed capital gains above ₹50 lakh need a professional surcharge and marginal-relief allocation. Ordinary-income surcharge is supported." };
  const bands: [number, number][] = regime === "new" ? [[40000000, 0], [80000000, .05], [120000000, .1], [160000000, .15], [200000000, .2], [240000000, .25], [Infinity, .3]] : [[25000000, 0], [50000000, .05], [100000000, .2], [Infinity, .3]];
  const normal = slab(taxable, bands), special = Math.round(input.stcg * .2 + Math.max(0, input.ltcg - 12500000) * .125);
  let rebate = totalIncome <= (regime === "new" ? 120000000 : 50000000) ? Math.min(regime === "new" ? normal : normal + Math.round(input.stcg * .2), regime === "new" ? 6000000 : 1250000) : 0;
  if (regime === "new" && totalIncome > 120000000) rebate = Math.max(0, normal - (totalIncome - 120000000));
  const beforeCess = Math.max(0, normal + special - rebate);
  const surchargeRate = (income: number) => income <= 500000000 ? 0 : income <= 1000000000 ? .1 : income <= 2000000000 ? .15 : income <= 5000000000 || regime === "new" ? .25 : .37;
  const rawSurcharge = Math.round(beforeCess * surchargeRate(totalIncome));
  const thresholds = regime === "new" ? [500000000, 1000000000, 2000000000] : [500000000, 1000000000, 2000000000, 5000000000];
  const threshold = thresholds.filter(n => totalIncome > n).at(-1);
  const atThreshold = threshold === undefined ? 0 : slab(threshold, bands), cap = threshold === undefined ? Infinity : Math.round(atThreshold * (1 + surchargeRate(threshold))) + totalIncome - threshold;
  const surcharge = Math.max(0, Math.min(rawSurcharge, cap - beforeCess)), marginalRelief = rawSurcharge - surcharge, cess = Math.round((beforeCess + surcharge) * .04);
  return { available: true as const, taxable, totalIncome, standard, deductions, normal, special, rebate, surcharge, marginalRelief, cess, total: beforeCess + surcharge + cess };
}
export function advanceTaxPlan(totalMinor: number, tdsMinor: number, year: string) { const remaining = Math.max(0, totalMinor - tdsMinor); return { remaining, required: remaining >= 1000000, installments: advanceTaxDates(year).map(d => ({ ...d, amountMinor: remaining >= 1000000 ? Math.round(remaining * d.cumulative / 100) : 0 })) }; }
export function advanceTaxDates(year: string) { const start = Number(year.slice(0, 4)); return [{ date: `${start}-06-15`, cumulative: 15 }, { date: `${start}-09-15`, cumulative: 45 }, { date: `${start}-12-15`, cumulative: 75 }, { date: `${start + 1}-03-15`, cumulative: 100 }]; }