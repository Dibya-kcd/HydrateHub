import { getSupabaseClient, isServerProxyMode, isValidUuid, proxyFetch } from "./client";
import { resilientSupabaseUpsert } from "./pushCache";
import { resetCloudReadCaches } from "./tombstonesAndSync";
import { billExtraFields } from "../../utils/billExtra";
import { parseBillIds, parseJsonDict } from "../../utils/billing";
import type { Bill, Trip } from "../../types";

/**
 * Pushes a single bill to Supabase
 */
export async function pushBillToSupabase(
  b: Bill,
): Promise<{ success: boolean; error?: string }> {
  if (isServerProxyMode()) {
    const res = await proxyFetch("/api/bills", {
      method: "POST",
      body: JSON.stringify(b),
    });
    return res.ok ? { success: true } : { success: false, error: res.error || "Failed to push bill" };
  }

  const client = getSupabaseClient();
  if (!client)
    return { success: false, error: "Supabase client is not configured" };
  try {
    const payload = {
      id: b.id,
      retailer: b.retailer,
      phone: b.phone || null,
      date: b.date,
      subtotal: b.subtotal,
      cgst: b.cgst,
      sgst: b.sgst,
      total: b.total,
      discount: b.discount,
      amount_paid: b.amountPaid,
      cancellation: b.cancellation ?? null,
      returns: b.returns && b.returns.length > 0 ? b.returns : null,
      cancelled_returns: b.cancelledReturns && b.cancelledReturns.length > 0 ? b.cancelledReturns : null,
      edit_history: b.editHistory && b.editHistory.length > 0 ? b.editHistory : null,
      warehouse_id: b.warehouseId || null,
      salesman_id: isValidUuid(b.salesmanId) ? b.salesmanId : null,
      salesman: b.salesman || null,
      supply_type: b.supplyType || "B2C",
      customer_gstin: b.customerGstin || null,
      is_retrospective: b.isRetrospective === true,
      extra: billExtraFields(b),
      items: b.items,
      updated_at: new Date().toISOString(),
    };
    const { error } = await resilientSupabaseUpsert(client, "bills", payload, {
      onConflict: "id",
    });
    if (error) {
      console.warn("Failed to push bill to Supabase:", error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (e: any) {
    console.warn("Failed to push bill to Supabase:", e);
    return { success: false, error: e?.message || "Network error" };
  }
}

/**
 * Deletes a bill from Supabase
 */
export async function deleteBillFromSupabase(id: number): Promise<void> {
  if (isServerProxyMode()) {
    await proxyFetch(`/api/bills/${encodeURIComponent(String(id))}`, {
      method: "DELETE",
    });
    resetCloudReadCaches();
    return;
  }

  const client = getSupabaseClient();
  if (!client) return;
  try {
    await client.from("bills").delete().eq("id", id);
  } catch (e) {
    console.warn("Failed to delete bill from Supabase:", e);
  }
  try {
    const { data, error } = await client
      .from("app_collections")
      .select("data")
      .eq("key", "deleted_bill_ids")
      .maybeSingle();
    if (!error) {
      const existing = Array.isArray(data?.data) ? (data!.data as any[]).map(Number) : [];
      if (!existing.includes(Number(id))) {
        await client.from("app_collections").upsert(
          {
            key: "deleted_bill_ids",
            data: [...existing, Number(id)].slice(-20000),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" },
        );
      }
      resetCloudReadCaches();
    }
  } catch (e) {
    console.warn("Failed to record deleted_bill_ids in Supabase:", e);
  }
}

/**
 * Pushes a single delivery trip to Supabase public.trips table
 */
export async function pushTripToSupabase(
  t: Trip,
): Promise<{ success: boolean; error?: string }> {
  if (isServerProxyMode()) {
    const res = await proxyFetch("/api/trips", {
      method: "POST",
      body: JSON.stringify(t),
    });
    return res.ok ? { success: true } : { success: false, error: res.error || "Failed to push trip" };
  }

  const client = getSupabaseClient();
  if (!client)
    return { success: false, error: "Supabase client is not configured" };
  try {
    const payload = {
      id: t.id,
      vehicle: t.vehicle,
      salesman_id: isValidUuid(t.salesmanId) ? t.salesmanId : null,
      salesman: t.salesman || null,
      salesman_phone: t.salesmanPhone || null,
      date: t.date,
      warehouse_id: t.warehouseId || null,
      loaded: parseJsonDict(t.loaded),
      // Per-godown split of the van load (warehouse -> product -> crates). Without this column a
      // multi-warehouse trip collapses to its single primary warehouse after a reload/sync.
      warehouse_loads: t.warehouseLoads || {},
      shortage_reasons: t.shortageReasons || {},
      route: t.route || null,
      driver: t.driver || null,
      driver_phone: t.driverPhone || null,
      returned: t.status === "closed" ? parseJsonDict(t.returned) : {},
      draft_returned: t.status === "closed" ? {} : parseJsonDict(t.draftReturned),
      cash_handed_in: t.cashHandedIn ?? null,
      cash_short_booked: t.cashShortBooked ?? null,
      cash_recoveries: t.cashRecoveries || [],
      cash_short_written_off: t.cashShortWrittenOff === true,
      bill_ids: parseBillIds(t.billIds),
      status: t.status || "out",
      updated_at: t.updatedAt || new Date().toISOString(),
    };
    const { error } = await resilientSupabaseUpsert(client, "trips", payload, {
      onConflict: "id",
    });
    if (error) {
      console.warn("Failed to upsert trip in Supabase:", error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (e: any) {
    console.warn("Failed to push trip to Supabase:", e);
    return { success: false, error: e?.message || "Network error" };
  }
}

/**
 * Deletes a delivery trip from Supabase public.trips table
 */
export async function deleteTripFromSupabase(id: number): Promise<void> {
  if (isServerProxyMode()) {
    await proxyFetch(`/api/trips/${encodeURIComponent(String(id))}`, {
      method: "DELETE",
    });
    return;
  }

  const client = getSupabaseClient();
  if (!client) return;
  try {
    await client.from("trips").delete().eq("id", id);
  } catch (e) {
    console.warn("Failed to delete trip from Supabase:", e);
  }
}
