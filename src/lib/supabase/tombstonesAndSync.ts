import { getSupabaseClient, isServerProxyMode, proxyFetch } from "./client";
import { fastHash } from "./pushCache";
import { resetTableCaches, resetRowCaches } from "../tableDelta";
import { fingerprintOf, shortHash } from "../../utils/syncGate";
import { dedupeSameShopCustomers } from "../../utils/customerDedupe";

/* ---- Cloud-synced deletion log --------------------------------------------------------------
 * Deleted payments / customers are recorded in the cloud (app_collections key "deleted_records"),
 * not only on the device that deleted them. Every device reads this list before it merges or
 * pushes, so a stale phone / tab / cache can never bring a deleted record back.
 * Each record also carries the owner's rectification comment.
 */
export interface DeletionRecord {
  kind: "payment" | "customer" | "expense" | "product" | "batch" | "warehouse" | "audit" | "promotion" | "salesman";
  id: string;
  /** Customer name (used to hide a customer that is only known from old bills). */
  name?: string;
  deletedAt: string;
  by?: string;
  /** Owner's rectification comment. */
  reason?: string;
  /** Extra facts worth keeping, e.g. amount of a deleted payment or an opening balance. */
  note?: string;
}

const DELETION_LOG_KEY = "deleted_records";

/** Ids of bills / GRNs / trips deleted on purpose (the server keeps these lists). null = could not be read. */
type TombstoneSets = {
  bills: Set<string>;
  grns: Set<string>;
  trips: Set<string>;
};
const TOMBSTONE_KEYS = ["deleted_bill_ids", "deleted_grn_ids", "deleted_trip_ids"];
/** A copy of what was read is trusted for this long at most, even if its timestamps still look the same. */
const READ_CACHE_MAX_AGE_MS = 5 * 60_000;
let tombstoneCache: { stamp: string; value: TombstoneSets; at: number } | null = null;

/**
 * Forget what the deletion-list readers remembered, so the next read downloads everything again.
 * Used by the manual "Sync" actions, and after this device records a deletion.
 */
export function resetCloudReadCaches(): void {
  resetTableCaches();
  resetRowCaches();
  tombstoneCache = null;
  deletionCache = emptyDeletionCache();
}

export async function pullTombstonesFromSupabase(): Promise<TombstoneSets | null> {
  if (isServerProxyMode()) {
    const res = await proxyFetch<{
      success?: boolean;
      data?: { bills?: any[]; grns?: any[]; trips?: any[] };
      bills?: any[];
      grns?: any[];
      trips?: any[];
    }>("/api/sync/tombstones", { method: "GET" });
    const payload = (res.data as any)?.data ?? res.data;
    if (!res.ok || !payload || typeof payload !== "object") {
      return tombstoneCache ? tombstoneCache.value : null;
    }
    const value: TombstoneSets = {
      bills: new Set((Array.isArray(payload.bills) ? payload.bills : []).map(String)),
      grns: new Set((Array.isArray(payload.grns) ? payload.grns : []).map(String)),
      trips: new Set((Array.isArray(payload.trips) ? payload.trips : []).map(String)),
    };
    tombstoneCache = { stamp: String(Date.now()), value, at: Date.now() };
    return value;
  }

  const client = getSupabaseClient();
  if (!client) return null;
  try {
    // Cheap check first: only the "last changed" times of the three lists. The lists themselves are downloaded
    // only when one of those times changed (or the remembered copy is a few minutes old).
    let stamp = "";
    try {
      const { data: heads, error: headError } = await client
        .from("app_collections")
        .select("key,updated_at")
        .in("key", TOMBSTONE_KEYS);
      if (!headError && heads) {
        stamp = TOMBSTONE_KEYS.map(
          (k) => `${k}:${(heads as any[]).find((r) => r.key === k)?.updated_at ?? ""}`,
        ).join("|");
      }
    } catch {
      stamp = "";
    }
    if (stamp && tombstoneCache && tombstoneCache.stamp === stamp && Date.now() - tombstoneCache.at < READ_CACHE_MAX_AGE_MS) {
      return tombstoneCache.value;
    }

    const { data: rows, error } = await client
      .from("app_collections")
      .select("key,data")
      .in("key", TOMBSTONE_KEYS);
    if (error || !rows) return tombstoneCache ? tombstoneCache.value : null;
    const dead = (key: string) =>
      new Set<string>(
        ((rows.find((r: any) => r.key === key)?.data as any[] | undefined) || []).map((x: any) => String(x)),
      );
    const value: TombstoneSets = {
      bills: dead("deleted_bill_ids"),
      grns: dead("deleted_grn_ids"),
      trips: dead("deleted_trip_ids"),
    };
    if (stamp) tombstoneCache = { stamp, value, at: Date.now() };
    return value;
  } catch {
    return tombstoneCache ? tombstoneCache.value : null;
  }
}

const DELETION_ROW_PREFIX = "deleted:";

interface DeletionCache {
  /** "last changed" time of the old shared list when it was read */
  legacyStamp: string | null;
  legacy: DeletionRecord[];
  rows: Map<string, DeletionRecord>;
  /** how many per-deletion rows existed when they were read */
  rowCount: number | null;
  /** when everything above was last read completely; 0 = not trustworthy, read again */
  at: number;
}
function emptyDeletionCache(): DeletionCache {
  return { legacyStamp: null, legacy: [], rows: new Map(), rowCount: null, at: 0 };
}
let deletionCache: DeletionCache = emptyDeletionCache();

function composeDeletionList(c: DeletionCache): DeletionRecord[] {
  const out = new Map<string, DeletionRecord>();
  const add = (r: any) => {
    if (r && r.kind && r.id) out.set(`${r.kind}:${r.id}`, r as DeletionRecord);
  };
  c.legacy.forEach(add);
  c.rows.forEach(add);
  return Array.from(out.values());
}

/**
 * Every deletion is kept as its own row (key "deleted:<kind>:<id>") so two devices deleting at the same moment can
 * never overwrite each other, which the old single shared list could. The old list is still read and written so the
 * server and older app versions keep working.
 *
 * The log only ever grows and used to be downloaded in full on every sync. Now a cheap check comes first (the old
 * list's "last changed" time and the number of per-deletion rows); the full log is downloaded again only if one of
 * them changed, or the remembered copy is a few minutes old. Nothing is ever written here.
 */
export async function pullDeletionLogFromSupabase(): Promise<DeletionRecord[]> {
  if (isServerProxyMode()) {
    const res = await proxyFetch<{
      success?: boolean;
      data?: { deletions?: DeletionRecord[] };
      deletions?: DeletionRecord[];
    }>(
      "/api/sync/tombstones",
      { method: "GET" },
    );
    const payload = (res.data as any)?.data ?? res.data;
    if (!res.ok || !Array.isArray(payload?.deletions)) {
      return composeDeletionList(deletionCache);
    }
    return payload.deletions;
  }

  const client = getSupabaseClient();
  if (!client) return [];
  const c = deletionCache;
  const stale = !c.at || Date.now() - c.at > READ_CACHE_MAX_AGE_MS;

  if (!stale) {
    try {
      const [head, count] = await Promise.all([
        client.from("app_collections").select("updated_at").eq("key", DELETION_LOG_KEY).maybeSingle(),
        client
          .from("app_collections")
          .select("key", { count: "exact", head: true })
          .like("key", `${DELETION_ROW_PREFIX}%`),
      ]);
      if (!head.error && !count.error && count.count !== null && count.count !== undefined) {
        const legacyStamp = String((head.data as any)?.updated_at ?? "");
        if (legacyStamp === c.legacyStamp && count.count === c.rowCount) {
          return composeDeletionList(c);
        }
      }
    } catch {
      // fall through to a full read
    }
  }

  // Full read (what every sync used to do).
  let legacy: DeletionRecord[] = c.legacy;
  let legacyStamp: string | null = c.legacyStamp;
  let legacyOk = false;
  try {
    const { data, error } = await client
      .from("app_collections")
      .select("data,updated_at")
      .eq("key", DELETION_LOG_KEY)
      .maybeSingle();
    if (!error) {
      legacy = Array.isArray((data as any)?.data) ? ((data as any).data as DeletionRecord[]) : [];
      legacyStamp = String((data as any)?.updated_at ?? "");
      legacyOk = true;
    }
  } catch {
    // the old list is optional now
  }

  const rows = new Map<string, DeletionRecord>();
  let rowsRead = 0;
  let rowsOk = false;
  try {
    const PAGE = 1000;
    rowsOk = true;
    for (let from = 0; from < 50000; from += PAGE) {
      const { data: page, error } = await client
        .from("app_collections")
        .select("data")
        .like("key", `${DELETION_ROW_PREFIX}%`)
        .order("key", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error || !page) {
        rowsOk = false;
        break;
      }
      rowsRead += page.length;
      page.forEach((row: any) => {
        const r = row?.data;
        if (r && r.kind && r.id) rows.set(`${r.kind}:${r.id}`, r as DeletionRecord);
      });
      if (page.length < PAGE) break;
    }
  } catch {
    rowsOk = false;
  }

  // Never forget a deletion because a read failed half way: keep what was remembered, add what was read.
  const next: DeletionCache = {
    legacyStamp,
    legacy,
    rows: rowsOk ? rows : new Map([...c.rows, ...rows]),
    rowCount: rowsOk ? rowsRead : null,
    at: legacyOk && rowsOk ? Date.now() : 0,
  };
  deletionCache = next;
  return composeDeletionList(next);
}

/* -------------------------------------------------------------------------
 * Concurrent-write protection for the shared lists kept in app_collections.
 * Each list is saved whole, so two devices saving close together used to overwrite each other. Now every device
 * remembers the cloud copy's time when it last read or wrote it; if the cloud copy is newer than that, somebody else
 * saved in between, and the two lists are combined (newest change per record wins, deletions honoured) instead of
 * one replacing the other.
 * ------------------------------------------------------------------------- */
export const collectionSeen = new Map<string, string>();
const MERGEABLE_COLLECTIONS = new Set([
  "bills",
  "trips",
  "payments",
  "customers",
  "products",
  "inventory_batches",
  "inward_grns",
]);
const changeStamp = (x: any) => Date.parse(String(x?.updatedAt || x?.updated_at || "")) || 0;

async function dropDeletedForCollection(key: string, list: any[]): Promise<any[]> {
  try {
    if (key === "payments") return await dropDeletedFromList("payment", list);
    if (key === "customers") {
      const alive = await dropDeletedFromList("customer", list);
      return dedupeSameShopCustomers(alive).customers;
    }
    if (key === "inventory_batches") return await dropDeletedFromList("batch", list);
    if (key === "products") {
      const log = await pullDeletionLogFromSupabase();
      const dead = new Set(log.filter((r) => r.kind === "product").map((r) => r.id));
      return dead.size
        ? list.filter((p) => !dead.has(`${p.id}|${String(p.name || "").trim().toUpperCase()}`))
        : list;
    }
    const t = await pullTombstonesFromSupabase();
    if (!t) return list;
    const set = key === "bills" ? t.bills : key === "inward_grns" ? t.grns : key === "trips" ? t.trips : null;
    return set ? list.filter((x) => !set.has(String(x?.id))) : list;
  } catch {
    return list;
  }
}

/** Combines a cloud list with this device's list: same record -> the later change stamp wins (ties keep ours). */
export function mergeConcurrentLists(remote: any[], local: any[]): any[] {
  const map = new Map<string, any>();
  remote.forEach((r) => r && r.id != null && map.set(String(r.id), r));
  local.forEach((l) => {
    if (!l || l.id == null) return;
    const theirs = map.get(String(l.id));
    map.set(String(l.id), theirs && changeStamp(theirs) > changeStamp(l) ? theirs : l);
  });
  return Array.from(map.values());
}

/**
 * Writes one app_collections list. When the list is one of the shared ones and the cloud copy changed since this
 * device last saw it, the lists are merged first. `guard` lets the caller add a timeout.
 */
const collectionHashes = new Map<string, string[]>();

function contentHash(value: any): string {
  try {
    return fastHash(JSON.stringify(value ?? null));
  } catch {
    return "";
  }
}

/** Remember what the cloud holds for a collection (called after a read), so an identical write-back can be skipped. */
export function noteCollectionContent(key: string, value: any) {
  const h = contentHash(value);
  if (h) collectionHashes.set(key, [h]);
}

export async function writeCollectionMerged(
  client: any,
  key: string,
  data: any,
  guard: <T>(p: PromiseLike<T>) => Promise<T> = (p) => Promise.resolve(p),
): Promise<{ error: any }> {
  if (isServerProxyMode()) {
    const res = await proxyFetch(`/api/collections/${encodeURIComponent(key)}`, {
      method: "PUT",
      body: JSON.stringify({ data }),
    });
    return { error: res.ok ? null : { message: res.error || "Failed to save collection" } };
  }
  // Identical to what the cloud already holds (or what we last wrote): nothing to save. After every download the app
  // writes its merged lists back; without this check each of those write-backs rewrote whole rows for no change.
  const dataHash = contentHash(data);
  if (dataHash && collectionHashes.get(key)?.includes(dataHash)) return { error: null };
  let outgoing = data;
  if (MERGEABLE_COLLECTIONS.has(key) && Array.isArray(data) && collectionSeen.has(key)) {
    try {
      const { data: row } = (await guard(
        client.from("app_collections").select("data,updated_at").eq("key", key).maybeSingle(),
      )) as any;
      const cloudTime = Date.parse(String(row?.updated_at || "")) || 0;
      const seenTime = Date.parse(collectionSeen.get(key) || "") || 0;
      if (row && Array.isArray(row.data) && cloudTime > seenTime) {
        outgoing = await dropDeletedForCollection(key, mergeConcurrentLists(row.data, data));
      }
    } catch {
      // could not check: fall back to a plain save, as before
    }
  }
  if (key === "customers" && Array.isArray(outgoing)) {
    outgoing = dedupeSameShopCustomers(outgoing).customers;
  }
  const stamp = new Date().toISOString();
  const res = (await guard(
    client.from("app_collections").upsert({ key, data: outgoing, updated_at: stamp }, { onConflict: "key" }),
  )) as any;
  if (!res?.error) {
    collectionSeen.set(key, stamp);
    const outHash = contentHash(outgoing);
    collectionHashes.set(key, [dataHash, outHash].filter(Boolean));
  }
  return { error: res?.error || null };
}

/**
 * "Has anything changed in the cloud?" - answered with a handful of tiny read-only requests instead of downloading
 * every table. Returns one short text that is the same until something changes, or null if it cannot be answered
 * (offline, or the database refuses the questions).
 *
 * What is looked at, and why only this:
 *  - bills and trips: how many rows, and when the newest one was last changed. These carry the busy day-to-day work
 *    (sales, payments on bills, trip changes) and are only rewritten when a record really changed.
 *  - godown stock records, products, batches, salesmen, warehouses: only how many rows (new or removed records).
 *  - deletions: the per-deletion rows and the "last changed" times of the deletion lists.
 * Also looked at (one request, timestamps only): the payments, customers and business_expenses lists. Other generic
 * collections are not, and are picked up by the regular safety download (see SAFETY_FULL_PULL_MS in src/utils/syncGate.ts).
 *
 * Nothing is written, and no rows are downloaded: counts use HEAD requests, the others fetch one timestamp.
 */
const PROBE_NEWEST_TABLES = ["bills", "trips"];
const PROBE_COUNT_TABLES = ["grns", "products", "inventory_batches", "salesmen", "warehouses"];
const PROBE_LIST_KEYS = ["payments", "customers", "business_expenses"];
let probeWarned = false;

export async function probeCloudChanges(): Promise<string | null> {
  if (isServerProxyMode()) {
    const res = await proxyFetch<{ success?: boolean; data?: string | null; fingerprint?: string | null }>(
      "/api/sync/probe",
      { method: "GET" },
    );
    if (!res.ok || !res.data) return null;
    if (typeof res.data.data === "string") return res.data.data;
    return res.data.fingerprint ?? null;
  }

  const client = getSupabaseClient();
  if (!client) return null;
  const parts: Record<string, string> = {};
  const failed: string[] = [];
  let answered = 0;

  const ask = async (name: string, run: () => PromiseLike<string>) => {
    try {
      parts[name] = await run();
      answered++;
    } catch {
      parts[name] = "?";
      failed.push(name);
    }
  };

  await Promise.all([
    ...PROBE_NEWEST_TABLES.map((table) =>
      ask(table, async () => {
        const { data, count, error } = await client
          .from(table)
          .select("updated_at", { count: "exact" })
          .order("updated_at", { ascending: false, nullsFirst: false })
          .limit(1);
        if (error) throw error;
        return `${count ?? "?"}|${(data as any)?.[0]?.updated_at ?? ""}`;
      }),
    ),
    ...PROBE_COUNT_TABLES.map((table) =>
      ask(table, async () => {
        const { count, error } = await client.from(table).select("*", { count: "exact", head: true });
        if (error) throw error;
        return String(count ?? "?");
      }),
    ),
    ask("deleted_rows", async () => {
      const { count, error } = await client
        .from("app_collections")
        .select("key", { count: "exact", head: true })
        .like("key", `${DELETION_ROW_PREFIX}%`);
      if (error) throw error;
      return String(count ?? "?");
    }),
    // Payments / customers / expenses: ONE tiny request (3 rows, key + timestamp only, no data). Safe now that identical
    // write-backs are skipped (writeCollectionMerged), so these timestamps only move on a real change.
    ask("shared_lists", async () => {
      const { data, error } = await client
        .from("app_collections")
        .select("key,updated_at")
        .in("key", PROBE_LIST_KEYS);
      if (error) throw error;
      return shortHash(((data as any[]) || []).map((r) => `${r.key}=${r.updated_at}`).sort().join(","));
    }),
    ask("deletion_lists", async () => {
      const { data, error } = await client
        .from("app_collections")
        .select("key,updated_at")
        .in("key", [DELETION_LOG_KEY, ...TOMBSTONE_KEYS]);
      if (error) throw error;
      const text = ((data as any[]) || [])
        .map((r) => `${r.key}=${r.updated_at}`)
        .sort()
        .join(",");
      return shortHash(text);
    }),
  ]);

  if (failed.length && !probeWarned) {
    probeWarned = true;
    console.warn(`[sync] change check could not read: ${failed.join(", ")} (those are only caught by the safety download)`);
  }
  if (answered === 0) return null;
  return fingerprintOf(parts);
}

/**
 * Records deletions in the cloud: one row per deletion (cannot be lost to a concurrent write), plus the old shared
 * list for compatibility. Returns false only if neither could be written.
 */
export async function pushDeletionRecordsToSupabase(
  records: DeletionRecord[],
): Promise<boolean> {
  if (!records.length) return false;
  if (isServerProxyMode()) {
    const res = await proxyFetch("/api/sync/deletions", {
      method: "POST",
      body: JSON.stringify({ records }),
    });
    resetCloudReadCaches();
    return res.ok;
  }

  const client = getSupabaseClient();
  if (!client) return false;
  let saved = false;
  try {
    const now = new Date().toISOString();
    const { error } = await client.from("app_collections").upsert(
      records.map((r) => ({
        key: `${DELETION_ROW_PREFIX}${r.kind}:${r.id}`,
        data: r,
        updated_at: now,
      })),
      { onConflict: "key" },
    );
    saved = !error;
  } catch {
    saved = false;
  }
  try {
    const { data, error: readError } = await client
      .from("app_collections")
      .select("data")
      .eq("key", DELETION_LOG_KEY)
      .maybeSingle();
    if (!readError) {
      const map = new Map<string, DeletionRecord>();
      (Array.isArray(data?.data) ? (data!.data as any[]) : []).forEach(
        (r) => r && r.kind && r.id && map.set(`${r.kind}:${r.id}`, r),
      );
      records.forEach((r) => map.set(`${r.kind}:${r.id}`, r));
      const { error } = await client.from("app_collections").upsert(
        {
          key: DELETION_LOG_KEY,
          data: Array.from(map.values()).slice(-20000),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" },
      );
      if (!error) saved = true;
    }
  } catch {
    // the per-record rows above are the source of truth
  }
  // this device just changed the log: the next read must see it
  resetCloudReadCaches();
  return saved;
}

/** Removes anything the cloud log says was deleted. If the log cannot be read, the list is returned as is. */
export async function dropDeletedFromList<T extends { id?: string }>(
  kind: DeletionRecord["kind"],
  list: T[],
): Promise<T[]> {
  if (!Array.isArray(list) || list.length === 0) return list;
  const log = await pullDeletionLogFromSupabase();
  const dead = new Set(log.filter((r) => r.kind === kind).map((r) => r.id));
  return dead.size ? list.filter((x) => !(x.id && dead.has(x.id))) : list;
}
