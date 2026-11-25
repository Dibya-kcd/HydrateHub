import { getSupabaseClient, isServerProxyMode, writeCollectionMerged, collectionSeen, noteCollectionContent } from "../../lib/supabase";
import { announceCloudChange } from "../../lib/syncSignal";
import {
  fetchWithTimeout,
  getConsecutiveFailures,
  notifySyncStatus,
  withTimeout,
} from "./syncState";

/* =========================================================================
 * Unsaved-writes outbox. A save that fails (no signal, server asleep, timeout) is kept ON THE DEVICE, so closing
 * the app cannot lose it. It is retried when the connection returns, every 30 seconds, and at every app start,
 * and the banner shows how many are waiting. Items remember who saved them: a phone shared by two people never
 * uploads one person's bills under the other's login.
 * ========================================================================= */
type WriteMethod = "POST" | "PUT" | "DELETE";
interface PendingWrite {
  url: string;
  method: WriteMethod;
  payload?: any;
  /** Last-changed time of the record as this device last saw it (sent as X-Base-Updated-At). */
  baseUpdatedAt?: string;
  userId: string;
  billId?: number;
  attempts: number;
  savedAt: number;
}
const OUTBOX_KEY = "mrwater_outbox_v1";

function loadOutbox(): Map<string, PendingWrite> {
  try {
    if (typeof localStorage === "undefined") return new Map();
    const raw = localStorage.getItem(OUTBOX_KEY);
    return new Map(raw ? (JSON.parse(raw) as [string, PendingWrite][]) : []);
  } catch {
    return new Map();
  }
}

// Latest payload per key wins: whole-list writes carry everything, single-record writes replace the older copy.
const pendingWrites = new Map<string, PendingWrite>(loadOutbox());
let flushingPending = false;
let outboxUser = "";
let storageRole: "admin" | "salesman" | "" = "";

function persistOutbox() {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(Array.from(pendingWrites.entries())));
  } catch {
    /* storage full or unavailable: the in-memory queue still works for this session */
  }
  notifySyncStatus({ pendingCount: ownPendingCount() });
}

function ownPendingCount(): number {
  let n = 0;
  for (const w of pendingWrites.values()) if (!outboxUser || w.userId === outboxUser) n++;
  return n;
}

/** Who is signed in on this device. Starts the retry as soon as somebody is. */
export function setStorageUser(userId: string | null, role?: "admin" | "salesman" | null) {
  outboxUser = userId || "";
  storageRole = role || "";
  notifySyncStatus({ pendingCount: ownPendingCount() });
  if (outboxUser) setTimeout(() => void flushPendingWrites(), 1500);
}

// What a salesman's login may write (the server enforces the same list). Anything else the app would try
// from a salesman phone (catalogue lists, settings, ...) is skipped instead of failing forever.
const SALESMAN_WRITABLE = /^\/api\/(bills|orders|create_order_with_schemes|payments|payment-history|activity-logs|trips|customers|sync\/signal|doc-numbers\/(reserve|release)|collections\/(stock_transactions|inventory_dispositions))(\/|$)/;
const salesmanMayWrite = (url: string) => SALESMAN_WRITABLE.test(url.split("?")[0]);

/** Errors a retry cannot fix are reported once and not queued. 401 stays queued: the person just has to sign in. */
function isRetryable(status: number): boolean {
  return ![400, 403, 404, 405, 409, 413, 422].includes(status);
}

export function pendingWriteCount(): number {
  return ownPendingCount();
}

// Bill saves that are on their way right now (not failed, not finished). -1 = a whole-list save.
const inflightBillWrites = new Map<string, number>();
const BILL_URL = /^\/api\/(bills|orders|create_order_with_schemes)$/;

/** True while any bill (optionally one of `billIds`) has not reached the cloud. Closing a trip waits for this. */
export function hasUnsavedBills(billIds?: (number | string)[]): boolean {
  const want = billIds ? new Set(billIds.map(Number)) : null;
  for (const id of inflightBillWrites.values()) {
    if (id === -1 || !want || want.has(id)) return true;
  }
  for (const w of pendingWrites.values()) {
    if (w.billId === undefined && !/^\/api\/(bills|orders)$/.test(w.url)) continue;
    if (!/^\/api\/(bills|orders|create_order_with_schemes)$/.test(w.url)) continue;
    if (w.method === "PUT") return true; // a whole-list save: it may hold any bill
    if (!want || (w.billId !== undefined && want.has(Number(w.billId)))) return true;
  }
  return false;
}

// Last-changed time of each record as this device last saw it, to catch "two phones edited the same record".
const seenStamps = new Map<string, string>();
const kindOfUrl = (url: string): string | null => {
  const m = /^\/api\/(bills|orders|trips|customers|payments)$/.exec(url.split("?")[0]);
  return m ? (m[1] === "orders" ? "bills" : m[1]) : null;
};
const stampOf = (r: any): string => String(r?.updatedAt || r?.updated_at || "");
export function recordSeen(kind: "bills" | "trips" | "customers" | "payments", list: any[] | null | undefined) {
  if (!Array.isArray(list)) return;
  for (const r of list) {
    const st = stampOf(r);
    if (r && r.id !== undefined && st) seenStamps.set(`${kind}:${r.id}`, st);
  }
}

function serverMessage(txt: string, status: number): string {
  try {
    const j = JSON.parse(txt);
    if (j?.error) return String(j.error);
  } catch {
    /* not JSON */
  }
  return txt ? `HTTP ${status}: ${txt.slice(0, 160)}` : `HTTP ${status}`;
}

interface SendOptions {
  key?: string;
  billId?: number;
  headers?: Record<string, string>;
}

/**
 * Sends one write. On success it leaves the outbox; on a temporary failure it stays (or joins) the outbox; on a
 * conflict or a refusal it is reported to the person and dropped, because repeating it cannot succeed.
 */
export async function sendWrite(
  url: string,
  method: WriteMethod,
  payload: any,
  opts: SendOptions = {},
): Promise<boolean> {
  const key = opts.key || `${method} ${url}`;
  if (storageRole === "salesman" && !salesmanMayWrite(url)) return true;
  const trackBill = method !== "DELETE" && BILL_URL.test(url.split("?")[0]);
  if (trackBill) inflightBillWrites.set(key, opts.billId ?? -1);
  try {
    return await sendWriteInner(url, method, payload, opts, key);
  } finally {
    if (trackBill) inflightBillWrites.delete(key);
  }
}

async function sendWriteInner(
  url: string,
  method: WriteMethod,
  payload: any,
  opts: SendOptions,
  key: string,
): Promise<boolean> {
  const kind = kindOfUrl(url);
  const recId = payload && typeof payload === "object" && !Array.isArray(payload) ? payload.id : undefined;
  const existing = pendingWrites.get(key);
  // Two payments saved offline for the same bill collapse into one write of the final total; it must still start
  // from the total the server had before the FIRST of them.
  if (
    existing?.payload?.expectedAmountPaid !== undefined &&
    payload && typeof payload === "object" && !Array.isArray(payload)
  ) {
    payload = { ...payload, expectedAmountPaid: existing.payload.expectedAmountPaid };
  }
  const baseUpdatedAt =
    existing?.baseUpdatedAt ||
    (method === "POST" && kind && recId !== undefined ? seenStamps.get(`${kind}:${recId}`) : undefined);

  const queue = (attempts: number) => {
    pendingWrites.set(key, {
      url,
      method,
      payload,
      baseUpdatedAt,
      userId: outboxUser,
      billId: opts.billId,
      attempts,
      savedAt: existing?.savedAt || Date.now(),
    });
    persistOutbox();
  };
  const unqueue = () => {
    if (pendingWrites.delete(key)) persistOutbox();
  };

  if (!isServerProxyMode() && isStaticDeployment() && staticCollectionKey(url)) {
    notifySyncStatus({ isSyncing: true });
    const ok = await saveToStaticCollection(url, payload);
    if (ok) {
      unqueue();
      // GitHub Pages saves go straight to Supabase: tell the other devices too (tiny message, no data).
      announceCloudChange();
    } else queue((existing?.attempts || 0) + 1);
    return ok;
  }

  try {
    notifySyncStatus({ isSyncing: true });
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(payload !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(opts.headers || {}),
      ...(baseUpdatedAt ? { "X-Base-Updated-At": baseUpdatedAt } : {}),
    };
    const res = await fetchWithTimeout(url, {
      method,
      headers,
      ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      const msg = serverMessage(txt, res.status);
      if (!isRetryable(res.status)) {
        unqueue();
        if (res.status === 409 && typeof window !== "undefined") {
          // Somebody else changed it first: tell the person, and let the app fetch the newer copy.
          window.dispatchEvent(new CustomEvent("mrwater:sync-conflict", { detail: { url, message: msg } }));
        }
        notifySyncStatus({
          isSyncing: false,
          consecutiveFailures: Math.min(getConsecutiveFailures() + 1, 10),
          lastError: res.status === 409 ? `Not saved: ${msg}` : `${method} ${url}: ${msg}`,
        });
        return false;
      }
      throw new Error(`HTTP ${res.status}: ${txt || res.statusText}`);
    }

    // Remember the stamp the server now holds, so this device's next edit is compared against it.
    if (kind && recId !== undefined) {
      let stamp = stampOf(payload);
      try {
        const j = await res.clone().json();
        stamp = stampOf(j?.data) || stamp;
        if (j?.reassignedId && typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("mrwater:bill-reassigned", {
              detail: {
                oldId: Number(recId),
                newId: Number(j.reassignedId),
                bill: j.bill || j.data,
                clientUid: payload?.clientUid,
              },
            }),
          );
        }
      } catch {
        /* no body */
      }
      if (stamp) seenStamps.set(`${kind}:${recId}`, stamp);
    }
    unqueue();
    notifySyncStatus({
      isSyncing: false,
      consecutiveFailures: 0,
      lastSuccessfulSync: new Date().toISOString(),
      lastError: null,
    });
    // Tell the other devices (a tiny message, no data) so they check for changes now rather than at their next timer.
    announceCloudChange();
    return true;
  } catch (err: any) {
    console.warn(`[Storage] Server ${method} failed for ${url}:`, err.message);
    queue((existing?.attempts || 0) + 1);
    notifySyncStatus({
      isSyncing: false,
      consecutiveFailures: Math.min(getConsecutiveFailures() + 1, 10),
      lastError: err.message || `Failed to sync ${url}`,
    });
    return false;
  }
}

export async function flushPendingWrites(): Promise<void> {
  if (flushingPending || pendingWrites.size === 0 || !outboxUser) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  flushingPending = true;
  try {
    for (const [key, w] of Array.from(pendingWrites.entries())) {
      if (w.userId !== outboxUser) continue; // belongs to somebody else who used this phone
      const ok = await sendWrite(w.url, w.method, w.payload, { key, billId: w.billId });
      if (!ok && pendingWrites.has(key)) break; // still offline: keep order, try again later
    }
  } finally {
    flushingPending = false;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    void flushPendingWrites();
  });
  const outboxRetryTimer = setInterval(() => {
    if (pendingWrites.size > 0) void flushPendingWrites();
  }, 30000);
  (outboxRetryTimer as any)?.unref?.();
}

const STATIC_API_COLLECTIONS: Record<string, string> = {
  "/api/bills": "bills",
  "/api/trips": "trips",
  "/api/settings/billing": "billing_settings",
  "/api/settings/profile": "organization_profile",
  "/api/collections/partners": "partners",
  "/api/collections/supplier_schemes": "supplier_schemes",
  "/api/collections/supplier_scheme_applications":
    "supplier_scheme_applications",
  "/api/collections/supplier_credit_notes": "supplier_credit_notes",
  "/api/collections/business_expenses": "business_expenses",
  "/api/collections/audit_sessions": "audit_sessions",
  "/api/collections/reconciliation_transactions": "reconciliation_transactions",
  "/api/collections/stock_ledger_entries": "stock_ledger_entries",
  "/api/inventory": "inventory",
  "/api/inventory/import": "inventory",
  "/api/collections/stock_transactions": "stock_transactions",
  "/api/warehouses": "warehouses",
  "/api/collections/warehouse_bays": "warehouse_bays",
  "/api/schemes": "schemes",
  "/api/collections/vehicle_trip": "vehicle_trip",
  "/api/products": "products",
  "/api/batches": "inventory_batches",
  "/api/salesmen": "salesmen",
  "/api/payments": "payments",
  "/api/grns": "inward_grns",
  "/api/customers": "customers",
};

export function isStaticDeployment(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host.endsWith(".github.io") || host === "github.io";
}

function staticCollectionKey(url: string): string | null {
  try {
    const path =
      new URL(url, window.location.origin).pathname.replace(/\/+$/, "") || "/";
    return STATIC_API_COLLECTIONS[path] || null;
  } catch {
    return null;
  }
}

function extractStaticPayload(path: string, payload: any): any {
  if (path === "/api/bills") return payload?.bills ?? payload ?? [];
  if (path === "/api/trips") return payload?.trips ?? payload ?? [];
  if (path === "/api/settings/billing")
    return payload?.settings ?? payload ?? null;
  if (path === "/api/settings/profile")
    return payload?.profile ?? payload ?? null;
  if (path === "/api/inventory/import") return payload?.items ?? payload ?? [];
  if (path === "/api/warehouses") return payload?.warehouses ?? payload ?? [];
  if (path === "/api/products") return payload?.products ?? payload ?? [];
  if (path === "/api/batches") return payload?.batches ?? payload ?? [];
  if (path === "/api/salesmen") return payload?.salesmen ?? payload ?? [];
  if (path === "/api/payments") return payload?.payments ?? payload ?? [];
  if (path === "/api/customers") return payload?.customers ?? payload?.data ?? payload ?? [];
  if (path.startsWith("/api/collections/"))
    return payload?.data ?? payload ?? [];
  if (path === "/api/schemes") return payload?.schemes ?? payload ?? [];
  if (path === "/api/grns") return payload?.grns ?? payload?.data ?? payload ?? [];
  return payload;
}

async function fetchFromStaticCollection<T>(url: string): Promise<T | null> {
  const key = staticCollectionKey(url);
  if (!key) return null;
  const client = getSupabaseClient();
  if (!client) {
    notifySyncStatus({ lastError: "Supabase is not configured" });
    return null;
  }

  try {
    const { data, error } = (await withTimeout(
      client.from("app_collections").select("data,updated_at").eq("key", key).maybeSingle(),
    )) as any;
    if (error) throw error;
    if (data?.updated_at) collectionSeen.set(key, String(data.updated_at));

    // No row yet = the cloud knows nothing, which is not the same as "empty": return null so the
    // caller keeps this device's own copy instead of overwriting it with an empty list.
    if (!data) return null;
    const value =
      data.data ??
      (key === "billing_settings" || key === "organization_profile"
        ? null
        : []);
    noteCollectionContent(key, value);
    notifySyncStatus({
      consecutiveFailures: 0,
      lastSuccessfulSync: new Date().toISOString(),
      lastError: null,
    });
    return value as T;
  } catch (err: any) {
    const message = err?.message || "Supabase collection read failed";
    console.warn(`[Storage] Supabase read failed for ${key} (using local cache):`, message);
    return null;
  }
}

async function saveToStaticCollection(
  url: string,
  payload: any,
): Promise<boolean> {
  const key = staticCollectionKey(url);
  if (!key) return false;
  const client = getSupabaseClient();
  if (!client) {
    notifySyncStatus({ lastError: "Supabase is not configured" });
    return false;
  }

  try {
    const path =
      new URL(url, window.location.origin).pathname.replace(/\/+$/, "") || "/";
    const data = extractStaticPayload(path, payload);
    const { error } = await writeCollectionMerged(client, key, data, withTimeout);
    if (error) throw error;

    notifySyncStatus({
      isSyncing: false,
      consecutiveFailures: 0,
      lastSuccessfulSync: new Date().toISOString(),
      lastError: null,
    });
    return true;
  } catch (err: any) {
    const message = err?.message || "Supabase collection write failed";
    console.warn(`[Storage] Supabase write failed for ${key}:`, message);
    notifySyncStatus({
      isSyncing: false,
      consecutiveFailures: Math.min(getConsecutiveFailures() + 1, 10),
      lastError: message,
    });
    return false;
  }
}

export async function fetchFromServer<T>(url: string): Promise<T | null> {
  // GitHub Pages is static hosting: /api/* does not exist there. Use Supabase
  // directly through app_collections instead of repeatedly calling dead routes.
  if (!isServerProxyMode() && isStaticDeployment() && staticCollectionKey(url)) {
    return fetchFromStaticCollection<T>(url);
  }

  try {
    const res = await fetchWithTimeout(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const json = await res.json();
    notifySyncStatus({
      consecutiveFailures: 0,
      lastSuccessfulSync: new Date().toISOString(),
      lastError: null,
    });
    if (json && typeof json === "object" && "data" in json) {
      return json.data as T;
    }
    return json as T;
  } catch (err: any) {
    // Read failures on startup/background poll fall back to local localStorage cache safely
    console.warn(`[Storage] Server fetch failed for ${url} (falling back to local cache):`, err.message);
    return null;
  }
}

export async function postOrPutServer(url: string, method: "POST" | "PUT", payload: any): Promise<boolean> {
  return sendWrite(url, method, payload);
}
