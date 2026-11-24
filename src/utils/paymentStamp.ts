import type { PaymentRecord } from "../types";

/**
 * Every payment change must move the record's `updatedAt` forward. Sync decides "which copy is newer" only by that
 * stamp, so an edit that left it unchanged (for example turning a receipt of a deleted invoice into a customer advance)
 * could be overwritten by an older copy on another device, and the cloud's "changed since" check never saw it.
 */

/** Same text for the same content, whatever order the keys were written in; `updatedAt` is ignored. */
export function paymentContentKey(p: PaymentRecord): string {
  const o = p as unknown as Record<string, unknown>;
  const keys = Object.keys(o)
    .filter((k) => k !== "updatedAt" && o[k] !== undefined)
    .sort();
  return JSON.stringify(keys.map((k) => [k, o[k]]));
}

const stampOf = (p: Pick<PaymentRecord, "updatedAt" | "createdAt"> | undefined): number =>
  Date.parse(String(p?.updatedAt || p?.createdAt || "")) || 0;

/**
 * Returns `next` with `updatedAt` refreshed on every record whose content changed while its `updatedAt` stayed as it was.
 * Records that arrive with a newer stamp (downloaded from the cloud) and brand-new records are left alone.
 * Returns the same array when nothing needs stamping.
 */
export function stampChangedPayments(
  prev: PaymentRecord[],
  next: PaymentRecord[],
  now: Date = new Date(),
): PaymentRecord[] {
  if (next === prev || !Array.isArray(next) || !Array.isArray(prev) || prev.length === 0) return next;
  const before = new Map<string, PaymentRecord>();
  for (const p of prev) if (p && p.id != null) before.set(String(p.id), p);
  let out: PaymentRecord[] | null = null;
  next.forEach((n, i) => {
    if (!n || n.id == null) return;
    const old = before.get(String(n.id));
    if (!old || old === n) return;
    if ((n.updatedAt || "") !== (old.updatedAt || "")) return; // already carries its own newer stamp
    if (paymentContentKey(n) === paymentContentKey(old)) return;
    // Strictly later than anything this record has carried before, even if the clock is behind another device's.
    const stamp = new Date(Math.max(now.getTime(), stampOf(old) + 1)).toISOString();
    if (!out) out = next.slice();
    out[i] = { ...n, updatedAt: stamp };
  });
  return out || next;
}

/** True when `incoming` is strictly newer than `current` (equal stamps keep what this device already has). */
export function isNewerPayment(incoming: PaymentRecord, current: PaymentRecord | undefined): boolean {
  if (!current) return true;
  return stampOf(incoming) > stampOf(current);
}
