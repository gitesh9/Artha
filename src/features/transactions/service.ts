type ComparableEntry = { userId: string; accountId: string; kind: string; amountMinor: number; currency: string; category: string; note: string | null; occurredOn: string };
export function sameTransaction(a: ComparableEntry, b: ComparableEntry) {
  return a.userId === b.userId && a.accountId === b.accountId && a.kind === b.kind && a.amountMinor === b.amountMinor && a.currency === b.currency && a.category === b.category && a.note === b.note && String(a.occurredOn) === String(b.occurredOn);
}