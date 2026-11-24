/**
 * One shared rule for combining the three places a payment can live: the old billing_settings mirror, the shared
 * `payments` collection, and the `payments` table. Used by both the browser pull (lib/supabase/ledgerSync.ts) and
 * the server pull (server/routes/syncAndActivityRoutes.ts) so the two can never disagree again.
 *
 * Rules
 *  - Newest `updatedAt` (falling back to `createdAt`) wins per payment id; a tie goes to the later source.
 *  - The old mirror is read only when neither the collection nor the table answered, so a stale mirror can never
 *    bring back an older version of a receipt. A collection counts as "answered" when it exists, even if empty
 *    (an empty list means every receipt was deleted, not "no data").
 *  - A table row with `deleted_at` removes the payment only if the delete is not older than the payment's last edit.
 *    A receipt re-saved after the delete mark stays.
 */

export const paymentTime = (p: any): number =>
  Date.parse(String(p?.updatedAt || p?.createdAt || "")) || 0;

/** The payments array inside a collection value, which may be a bare array or `{ payments: [...] }`. */
export function paymentsFromCollection(raw: any): any[] | null {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object" && Array.isArray(raw.payments)) return raw.payments;
  return null;
}

export interface PaymentSources<T = any> {
  /** billing_settings.payments (old mirror); pass null if unavailable. */
  legacy?: any[] | null;
  /** Raw `payments` collection value (array or `{ payments }`); pass null if the read failed or it does not exist. */
  collection?: any;
  /** Rows of the `payments` table (already checked for a read error); pass [] if unavailable. */
  tableRows?: any[] | null;
  /** Converts a table row to the app shape. */
  mapRow: (row: any) => T;
}

export function mergePaymentSources<T extends { id?: any }>(src: PaymentSources<T>): T[] {
  const map = new Map<string, T>();
  const put = (p: any) => {
    if (!p?.id) return;
    const key = String(p.id);
    const cur = map.get(key);
    if (!cur || paymentTime(p) >= paymentTime(cur)) map.set(key, p);
  };
  const colList = paymentsFromCollection(src.collection);
  const rows = Array.isArray(src.tableRows) ? src.tableRows : [];

  const answered = colList !== null || rows.length > 0;
  if (!answered && Array.isArray(src.legacy)) src.legacy.forEach(put);
  if (colList) colList.forEach(put);

  for (const r of rows) {
    if (!r?.id) continue;
    const id = String(r.id);
    if (r.deleted_at) {
      const cur = map.get(id);
      const deletedAt = Date.parse(String(r.deleted_at)) || 0;
      if (cur && deletedAt >= paymentTime(cur)) map.delete(id);
      continue;
    }
    put(src.mapRow(r));
  }
  return Array.from(map.values());
}
