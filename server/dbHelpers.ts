import { billExtraFields } from "../src/utils/billExtra";
import { todayISO } from "../src/utils/dateLocal";
import { findOverReturns, describeOverReturn } from "../src/utils/tripReturns";
import {
  supabase,
  isSupabaseAvailable,
  withSupabaseTimeout,
  getCollectionData,
  readListFresh,
  setCollectionData,
} from "./supabaseStore";

export function isValidUuid(val: any): boolean {
  if (typeof val !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    val.trim(),
  );
}

/**
 * Resilient upsert helper that handles PostgREST schema cache misses gracefully,
 * bounded by strict timeouts and circuit breaker to prevent server hangs during Supabase downtime.
 */
export async function resilientUpsert(
  client: any,
  tableName: string,
  data: any | any[],
  options: { onConflict?: string } = { onConflict: "id" },
): Promise<{ error: any; data?: any }> {
  if (!isSupabaseAvailable()) {
    return { error: null, data: [] };
  }

  const isArray = Array.isArray(data);
  let currentRows: any[] = isArray ? [...data] : [{ ...data }];

  currentRows = currentRows.map((row) => {
    const copy = { ...row };
    if (
      "salesman_id" in copy &&
      copy.salesman_id &&
      !isValidUuid(copy.salesman_id)
    ) {
      copy.salesman_id = null;
    }
    return copy;
  });

  // Chunk large batches to avoid Supabase / Postgres statement timeouts
  if (isArray && currentRows.length > 25) {
    const BATCH_SIZE = 25;
    let batchError: any = null;
    for (let i = 0; i < currentRows.length; i += BATCH_SIZE) {
      if (!isSupabaseAvailable()) break;
      const chunk = currentRows.slice(i, i + BATCH_SIZE);
      const res = await resilientUpsert(client, tableName, chunk, options);
      if (res.error) {
        batchError = res.error;
        const errMsg = String(res.error?.message || "");
        if (
          errMsg.includes("520") ||
          errMsg.includes("<!DOCTYPE") ||
          errMsg.includes("upstream request timeout") ||
          errMsg.includes("502") ||
          errMsg.includes("503") ||
          errMsg.includes("504") ||
          errMsg.includes("fetch failed") ||
          errMsg.includes("timeout")
        ) {
          break; // Stop trying subsequent chunks on provider outage!
        }
      }
    }
    return { error: batchError };
  }

  let lastError: any = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    if (!isSupabaseAvailable()) break;
    const payload = isArray ? currentRows : currentRows[0];
    const { error, data: resData } = await withSupabaseTimeout(
      client.from(tableName).upsert(payload, options),
      3500,
    );
    if (!error) {
      return { error: null, data: resData };
    }

    lastError = error;
    const msg = (error.message || "").toString();

    // If it's a provider 520, HTML error, or timeout, do NOT loop or retry
    if (
      msg.includes("520") ||
      msg.includes("<!DOCTYPE") ||
      msg.includes("upstream request timeout") ||
      msg.includes("502") ||
      msg.includes("503") ||
      msg.includes("504") ||
      msg.includes("fetch failed") ||
      msg.includes("timeout")
    ) {
      lastError = {
        message:
          "Supabase upstream service temporarily unavailable (Cloudflare 520 / timeout). Local storage active.",
      };
      break;
    }

    const cacheMatch = msg.match(/Could not find the '([^']+)' column/i);
    const colMatch = msg.match(/column "([^"]+)" of relation/i);
    const missingCol = cacheMatch?.[1] || colMatch?.[1];

    if (missingCol) {
      console.warn(
        `[Supabase] Table '${tableName}' missing column '${missingCol}' in schema cache. Stripping '${missingCol}' and retrying upsert...`,
      );
      currentRows = currentRows.map((row) => {
        const { [missingCol]: _omit, ...rest } = row;
        return rest;
      });
      continue;
    }

    if (
      msg.toLowerCase().includes("schema cache") &&
      (msg.toLowerCase().includes("salesman") ||
        msg.toLowerCase().includes(tableName))
    ) {
      console.warn(
        `[Supabase] Schema cache issue on '${tableName}': ${msg}. Retrying without salesman columns...`,
      );
      currentRows = currentRows.map((row) => {
        const { salesman: _s, salesman_id: _sid, ...rest } = row;
        return rest;
      });
      continue;
    }

    break;
  }

  return { error: lastError };
}

export function formatBillForSupabase(b: any) {
  const rawSalesmanId = b.salesmanId || b.salesman_id || null;
  const validSalesmanId = isValidUuid(rawSalesmanId) ? rawSalesmanId : null;
  return {
    id: Number(b.id),
    retailer: b.retailer || b.customerName || b.customer_name || "Cash Sale",
    phone: b.phone || null,
    date: b.date || todayISO(),
    subtotal: Number(b.subtotal || 0),
    cgst: Number(b.cgst || 0),
    sgst: Number(b.sgst || 0),
    total: Number(b.total || 0),
    discount: Number(b.discount || 0),
    amount_paid: Number(
      b.amountPaid !== undefined ? b.amountPaid : b.amount_paid || 0,
    ),
    cancellation: b.cancellation ?? null,
    returns:
      Array.isArray(b.returns) && b.returns.length > 0 ? b.returns : null,
    cancelled_returns: (() => {
      const v = b.cancelledReturns ?? b.cancelled_returns;
      return Array.isArray(v) && v.length > 0 ? v : null;
    })(),
    edit_history: (() => {
      const v = b.editHistory ?? b.edit_history;
      return Array.isArray(v) && v.length > 0 ? v : null;
    })(),
    supply_type: (b.supplyType ?? b.supply_type) === "B2B" ? "B2B" : "B2C",
    customer_gstin: b.customerGstin || b.customer_gstin || null,
    is_retrospective: (b.isRetrospective ?? b.is_retrospective) === true,
    warehouse_id: b.warehouseId || b.warehouse_id || null,
    salesman_id: validSalesmanId,
    salesman: b.salesman || "",
    items: Array.isArray(b.items) ? b.items : [],
    extra: billExtraFields(b),
    updated_at: new Date().toISOString(),
  };
}

// Nested JSON (per-godown loads, shortage reasons) must keep its shape, unlike parseDictSafe which flattens to numbers.
export function parseJsonObjSafe(val: any): Record<string, any> {
  let p = val;
  if (typeof p === "string") {
    try {
      p = JSON.parse(p);
    } catch {
      return {};
    }
  }
  return p && typeof p === "object" && !Array.isArray(p) ? p : {};
}

export function parseDictSafe(val: any): Record<string, number> {
  if (!val) return {};
  let p = val;
  if (typeof p === "string") {
    try {
      p = JSON.parse(p);
    } catch {
      return {};
    }
  }
  if (!p || typeof p !== "object") return {};
  const res: Record<string, number> = {};
  for (const [k, v] of Object.entries(p)) {
    const numK = Number(k);
    const numV = Number(v);
    if (!isNaN(numK)) {
      res[String(numK)] = isNaN(numV) ? 0 : numV;
    }
  }
  return res;
}

export function parseBillIdsSafe(val: any): number[] {
  if (!val) return [];
  let p = val;
  if (typeof p === "string") {
    try {
      p = JSON.parse(p);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(p)) return [];
  return p.map((x) => Number(x)).filter((x) => !isNaN(x));
}

export function formatTripForSupabase(t: any) {
  const rawSalesmanId = t.salesmanId || t.salesman_id || null;
  const validSalesmanId = isValidUuid(rawSalesmanId) ? rawSalesmanId : null;
  const status = t.status === "closed" ? "closed" : "out";
  const loaded = parseDictSafe(t.loaded);
  // Always preserve recorded returns safely
  const returned = parseDictSafe(t.returned);
  const rawBillIds = t.billIds ?? t.bill_ids ?? [];
  const bill_ids = parseBillIdsSafe(rawBillIds);

  return {
    id: Number(t.id),
    vehicle: t.vehicle || "",
    salesman_id: validSalesmanId,
    salesman: t.salesman || "",
    salesman_phone: t.salesmanPhone || t.salesman_phone || null,
    date: t.date || todayISO(),
    warehouse_id: t.warehouseId || t.warehouse_id || null,
    loaded,
    returned,
    draft_returned:
      status === "closed"
        ? {}
        : parseDictSafe(t.draftReturned ?? t.draft_returned),
    cash_short_booked:
      Number(t.cashShortBooked ?? t.cash_short_booked) > 0
        ? Number(t.cashShortBooked ?? t.cash_short_booked)
        : null,
    cash_recoveries: Array.isArray(t.cashRecoveries ?? t.cash_recoveries)
      ? t.cashRecoveries ?? t.cash_recoveries
      : [],
    cash_short_written_off:
      (t.cashShortWrittenOff ?? t.cash_short_written_off) === true,
    cash_handed_in:
      Number.isFinite(Number(t.cashHandedIn ?? t.cash_handed_in)) &&
      (t.cashHandedIn ?? t.cash_handed_in) != null &&
      (t.cashHandedIn ?? t.cash_handed_in) !== ""
        ? Number(t.cashHandedIn ?? t.cash_handed_in)
        : null,
    bill_ids,
    status,
    route: t.route || null,
    driver: t.driver || null,
    driver_phone: t.driverPhone || t.driver_phone || null,
    warehouse_loads: parseJsonObjSafe(t.warehouseLoads ?? t.warehouse_loads),
    shortage_reasons: parseJsonObjSafe(
      t.shortageReasons ?? t.shortage_reasons,
    ),
    // the device's own change time, so every copy can tell which one is newer
    updated_at: String(
      t.updatedAt || t.updated_at || new Date().toISOString(),
    ),
  };
}

export async function tripReturnProblem(
  stored: any,
  next: any,
): Promise<string | null> {
  if (!next || next.status !== "closed") return null;
  const changed =
    !stored ||
    stored.status !== "closed" ||
    JSON.stringify(stored.returned || {}) !==
      JSON.stringify(next.returned || {});
  if (!changed) return null;
  const orders = await getCollectionData("orders");
  const over = findOverReturns(
    {
      id: Number(next.id),
      billIds: next.billIds ?? next.bill_ids ?? [],
      loaded: next.loaded,
    },
    Array.isArray(orders) ? orders : [],
    next.returned,
  );
  return over.length > 0
    ? over.map((o) => describeOverReturn(o)).join(" ")
    : null;
}

// The phone says which version of a record it started from. If the stored copy is newer, another device
// saved in between and this save would silently overwrite that work.
export function changedSinceBase(req: any, stored: any): boolean {
  const base = Date.parse(String(req.headers?.["x-base-updated-at"] || ""));
  const had = Date.parse(String(stored?.updatedAt || stored?.updated_at || ""));
  return Number.isFinite(base) && Number.isFinite(had) && had > base;
}

export const tripStamp = (t: any) =>
  Date.parse(String(t?.updatedAt || t?.updated_at || "")) || 0;

// Keep the stored trip when it was changed more recently than the copy being sent (an old phone or a replayed
// offline save must not undo newer work), and never let an old copy re-open a closed trip.
export const tripStaleReopen = (cur: any, next: any) =>
  (cur?.status === "closed" &&
    next?.status !== "closed" &&
    !(tripStamp(next) > tripStamp(cur))) ||
  (!!cur && tripStamp(next) > 0 && tripStamp(cur) > tripStamp(next));

export function formatWarehouseForSupabase(w: any) {
  const rawCode = w.code ? String(w.code).trim() : "";
  const idStr = String(w.id || `wh-${Date.now()}`);
  const safeCode =
    rawCode || `WH-${idStr.replace(/\D/g, "").slice(-4) || "01"}`;

  return {
    id: idStr,
    name: w.name || "Default Warehouse",
    code: safeCode,
    location: w.location || "",
    manager: w.manager || "",
    phone: w.phone || "",
    capacity_cases: Number(w.capacityCases || w.capacity_cases || 0),
    is_default: Boolean(w.isDefault || w.is_default),
    notes: w.notes || "",
    updated_at: new Date().toISOString(),
  };
}

/**
 * Merge a device's list into the stored one instead of replacing it (used for the server-side copy of trips
 * and GRNs): records made on another device are kept, deleted ones (tombstones) stay deleted, and
 * `keepStored` decides when the stored copy of the SAME record is the newer one.
 */
export function mergeRecordLists(
  stored: any[],
  incoming: any[],
  deleted: Set<string>,
  keepStored: (cur: any, next: any) => boolean,
  accepted?: Set<any>,
) {
  const byId = new Map<string, any>();
  for (const r of stored) {
    const id = String(r?.id);
    if (r?.id !== undefined && !deleted.has(id)) byId.set(id, r);
  }
  for (const r of incoming) {
    const id = String(r?.id);
    if (r?.id === undefined || deleted.has(id)) continue;
    const cur = byId.get(id);
    if (cur && keepStored(cur, r)) continue;
    byId.set(id, r);
    accepted?.add(r);
  }
  return Array.from(byId.values());
}

export const readTombstones = async (key: string) =>
  new Set<string>((await readListFresh(key)).map((x: any) => String(x)));

export const readDeletedRecordIds = async (kind: string) =>
  new Set<string>(
    (await readListFresh("deleted_records"))
      .filter((r: any) => r?.kind === kind)
      .map((r: any) => String(r.id)),
  );

export const addTombstone = async (key: string, id: string) => {
  const raw = await getCollectionData(key);
  const list = Array.isArray(raw) ? raw : [];
  if (!list.map(String).includes(id)) {
    await setCollectionData(key, [...list, id].slice(-20000));
  }
};
