import { getSupabaseClient, isServerProxyMode, proxyFetch } from "./client";
import { dropDeletedFromList, writeCollectionMerged } from "./tombstonesAndSync";
import { todayISO } from "../../utils/dateLocal";
import type {
  PaymentAuditEntry,
  PaymentEntryKind,
  PaymentRecord,
} from "../../types";

function inferPaymentEntryKind(p: PaymentRecord): PaymentEntryKind {
  if (
    p.entryKind === "receipt" ||
    p.entryKind === "advance" ||
    p.entryKind === "refund" ||
    p.entryKind === "advance_adjustment"
  ) {
    return p.entryKind;
  }
  if (p.isRefund || (Number(p.amount) || 0) < 0) return "refund";
  if (
    p.billId &&
    (p.referenceNote || "").startsWith("Advance / credit adjusted")
  ) {
    return "advance_adjustment";
  }
  if (
    p.isAdvance ||
    (!p.billId && (p.referenceNote || "").includes("Advance / on account"))
  ) {
    return "advance";
  }
  return "receipt";
}

export function paymentToDbRow(p: PaymentRecord) {
  const createdAt = p.createdAt || new Date().toISOString();
  const updatedAt = p.updatedAt || createdAt;
  return {
    id: String(p.id),
    bill_id: p.billId ? Number(p.billId) : null,
    customer_id: p.customerId || null,
    customer_name: p.customerName || "",
    customer_phone: p.customerPhone || "",
    salesman_id: p.salesmanId || null,
    payment_date: p.paymentDate || String(createdAt).slice(0, 10) || todayISO(),
    amount: Number(p.amount) || 0,
    mode: p.mode || "cash",
    entry_kind: inferPaymentEntryKind(p),
    is_advance: Boolean(p.isAdvance),
    is_refund: Boolean(p.isRefund),
    is_advance_applied: Boolean(p.isAdvanceApplied),
    applied_amount: Number(p.appliedAmount) || 0,
    source_payment_id: p.sourcePaymentId || null,
    source_bill_id: p.sourceBillId ? Number(p.sourceBillId) : null,
    // Only reversal rows carry this column (migration 018), so every other row still saves if 018 has not been run.
    ...(p.reversalOf ? { reversal_of: String(p.reversalOf) } : {}),
    reference_note: p.referenceNote || "",
    recorded_by: p.recordedBy || "",
    deleted_at: null,
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

export function dbRowToPayment(r: any): PaymentRecord {
  const createdAt = r.created_at || r.createdAt || new Date().toISOString();
  const entryKind = r.entry_kind || r.entryKind;
  const rec: PaymentRecord = {
    id: String(r.id),
    ...(r.bill_id !== null && r.bill_id !== undefined
      ? { billId: Number(r.bill_id) }
      : {}),
    ...(r.customer_id ? { customerId: String(r.customer_id) } : {}),
    customerName: r.customer_name || r.customerName || "",
    customerPhone: r.customer_phone || r.customerPhone || "",
    ...(r.salesman_id ? { salesmanId: String(r.salesman_id) } : {}),
    paymentDate: r.payment_date || r.paymentDate || String(createdAt).slice(0, 10),
    amount: Number(r.amount) || 0,
    mode: (r.mode || "cash") as PaymentRecord["mode"],
    ...(entryKind ? { entryKind: entryKind as PaymentEntryKind } : {}),
    referenceNote: r.reference_note ?? r.referenceNote ?? "",
    recordedBy: r.recorded_by ?? r.recordedBy ?? "",
    isAdvance: Boolean(r.is_advance ?? r.isAdvance),
    ...(Boolean(r.is_advance_applied ?? r.isAdvanceApplied)
      ? { isAdvanceApplied: true }
      : {}),
    ...(Number(r.applied_amount ?? r.appliedAmount) > 0
      ? { appliedAmount: Number(r.applied_amount ?? r.appliedAmount) }
      : {}),
    ...(r.source_payment_id || r.sourcePaymentId
      ? { sourcePaymentId: String(r.source_payment_id || r.sourcePaymentId) }
      : {}),
    ...(r.source_bill_id !== null && r.source_bill_id !== undefined
      ? { sourceBillId: Number(r.source_bill_id) }
      : r.sourceBillId !== undefined
        ? { sourceBillId: Number(r.sourceBillId) }
        : {}),
    ...(Boolean(r.is_refund ?? r.isRefund) ? { isRefund: true } : {}),
    ...(r.reversal_of || r.reversalOf ? { reversalOf: String(r.reversal_of || r.reversalOf) } : {}),
    createdAt,
    ...(r.updated_at || r.updatedAt
      ? { updatedAt: r.updated_at || r.updatedAt }
      : {}),
  };
  return rec;
}

export function auditToDbRow(e: PaymentAuditEntry) {
  return {
    id: String(e.id),
    payment_id: e.paymentId || null,
    bill_id: e.billId ? Number(e.billId) : null,
    customer_name: e.customerName || "",
    action: e.action,
    amount: e.amount !== undefined && e.amount !== null ? Number(e.amount) : null,
    note: e.note || "",
    changed_by: e.by || "Admin",
    before_data: e.before ?? null,
    after_data: e.after ?? null,
    changed_at: e.at || new Date().toISOString(),
  };
}

export function dbRowToAudit(r: any): PaymentAuditEntry {
  return {
    id: String(r.id),
    at: r.changed_at || r.at || new Date().toISOString(),
    by: r.changed_by || r.by || "Admin",
    action: r.action,
    ...(r.payment_id || r.paymentId
      ? { paymentId: String(r.payment_id || r.paymentId) }
      : {}),
    ...(r.bill_id !== null && r.bill_id !== undefined
      ? { billId: Number(r.bill_id) }
      : r.billId !== undefined
        ? { billId: Number(r.billId) }
        : {}),
    ...(r.customer_name || r.customerName
      ? { customerName: r.customer_name || r.customerName }
      : {}),
    ...(r.amount !== null && r.amount !== undefined
      ? { amount: Number(r.amount) }
      : {}),
    ...(r.note ? { note: r.note } : {}),
    ...(r.before_data || r.before
      ? { before: (r.before_data || r.before) as PaymentRecord }
      : {}),
    ...(r.after_data || r.after
      ? { after: (r.after_data || r.after) as PaymentRecord }
      : {}),
  };
}

export async function softDeletePaymentsInSupabase(
  ids: string[],
  by = "Admin",
  reason = "",
): Promise<void> {
  const cleanIds = Array.from(new Set(ids.map((x) => String(x || "").trim()).filter(Boolean)));
  if (cleanIds.length === 0) return;

  if (isServerProxyMode()) {
    for (const id of cleanIds) {
      await proxyFetch(`/api/payments/${encodeURIComponent(id)}`, {
        method: "DELETE",
        body: JSON.stringify({ by: by || "Admin", reason: reason || "" }),
      });
    }
    return;
  }

  const client = getSupabaseClient();
  if (!client) return;
  try {
    const now = new Date().toISOString();
    await client
      .from("payments")
      .update({
        deleted_at: now,
        deleted_by: by || "Admin",
        delete_reason: reason || "",
        updated_at: now,
      })
      .in("id", cleanIds);
  } catch {
    // public.payments table may not be migrated yet (017)
  }
}

export async function pushPaymentAuditEntryToSupabase(
  entry: PaymentAuditEntry,
): Promise<void> {
  if (!entry?.id) return;
  if (isServerProxyMode()) {
    await proxyFetch("/api/payment-history", {
      method: "POST",
      body: JSON.stringify(entry),
    });
    return;
  }

  const client = getSupabaseClient();
  if (!client) return;
  try {
    await client
      .from("payment_history")
      .upsert(auditToDbRow(entry), { onConflict: "id" });
  } catch {
    // public.payment_history table may not be migrated yet (017)
  }
}

export async function pullPaymentHistoryFromSupabase(
  limit = 1000,
): Promise<PaymentAuditEntry[]> {
  if (isServerProxyMode()) {
    const res = await proxyFetch<{ success?: boolean; data?: any[] }>(
      `/api/payment-history?limit=${encodeURIComponent(String(limit))}`,
      { method: "GET" },
    );
    if (!res.ok || !Array.isArray(res.data?.data)) return [];
    return res.data.data.map(dbRowToAudit);
  }

  const client = getSupabaseClient();
  if (!client) return [];
  try {
    const { data, error } = await client
      .from("payment_history")
      .select("*")
      .order("changed_at", { ascending: false })
      .limit(limit);
    if (error || !Array.isArray(data)) return [];
    return data.map(dbRowToAudit);
  } catch {
    return [];
  }
}

/**
 * What this device last wrote to public.payments, by payment id. Only rows that differ are sent again, so a save that
 * touched one receipt no longer re-uploads every receipt ever recorded.
 */
const lastPushedRows = new Map<string, string>();

const rowKey = (row: ReturnType<typeof paymentToDbRow>, p: PaymentRecord) =>
  // created_at is invented when a record has none; leave it out of the comparison so such records are not re-sent each time
  JSON.stringify({ ...row, created_at: p.createdAt || "" });

/** Forget what was pushed (used by tests and after a deliberate "re-send everything"). */
export function resetPaymentPushCache(): void {
  lastPushedRows.clear();
}

/**
 * Pushes customer payments and settlements to Supabase cloud.
 *
 * Where the data goes now:
 *  1. public.payments (one row per receipt) is the main copy. Only rows that changed since this device's last push are sent.
 *  2. The shared list in app_collections['payments'] stays for older screens and the "has anything changed" check. The
 *     save path already writes it, and writeCollectionMerged skips a write that holds identical content.
 *  3. The old billing_settings 'collection_payments' mirror is no longer written (nothing reads it any more except as a last
 *     resort when the other two are empty). It used to re-upload the whole list on every save.
 *
 * Set VITE_PAYMENTS_LEGACY_MIRROR=true in a build to switch the old mirror back on.
 */
export async function pushPaymentsToSupabase(
  payments: PaymentRecord[],
  /** Set true only when the list was emptied on purpose (e.g. the last payment was deleted). */
  allowEmpty = false,
): Promise<void> {
  if (!payments || (payments.length === 0 && !allowEmpty)) return;
  if (isServerProxyMode()) {
    await proxyFetch("/api/payments", {
      method: "PUT",
      body: JSON.stringify({ payments }),
    });
    return;
  }

  const client = getSupabaseClient();
  if (!client) return;
  try {
    // Never write back a payment the owner already deleted (a stale device would resurrect it).
    payments = await dropDeletedFromList("payment", payments);
    if (payments.length === 0 && !allowEmpty) return;

    // 1. public.payments (additive; safe if migration 017 isn't applied yet): changed rows only
    try {
      if (payments.length > 0) {
        const keyed = payments.map((p) => {
          const row = paymentToDbRow(p);
          return { row, key: rowKey(row, p) };
        });
        const changed = keyed.filter((k) => lastPushedRows.get(k.row.id) !== k.key);
        // Reversal rows go in their own call: they need the reversal_of column (migration 018), and a missing column must
        // not stop the ordinary rows from saving.
        const groups = [
          changed.filter((c) => !("reversal_of" in c.row)),
          changed.filter((c) => "reversal_of" in c.row),
        ];
        for (const group of groups) {
          for (let i = 0; i < group.length; i += 500) {
            const chunk = group.slice(i, i + 500);
            const { error } = await client
              .from("payments")
              .upsert(chunk.map((c) => c.row), { onConflict: "id" });
            if (error) break;
            chunk.forEach((c) => lastPushedRows.set(c.row.id, c.key));
          }
        }
      }
    } catch {
      // public.payments table may not exist yet
    }

    // 2. public.app_collections (keeps the change check and older screens working)
    try {
      await writeCollectionMerged(client, "payments", payments);
    } catch {
      // app_collections table may not exist
    }

    // 3. Old mirror: off unless asked for
    if ((import.meta as any).env?.VITE_PAYMENTS_LEGACY_MIRROR === "true") {
      await client.from("billing_settings").upsert(
        {
          id: "collection_payments",
          data: { payments },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
    }
  } catch (e) {
    console.warn("Error persisting payments to Supabase:", e);
  }
}
