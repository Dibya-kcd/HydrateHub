import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { detectPack, volumeFromName } from "../src/utils/billing";

dotenv.config();
try {
  if (fs.existsSync(".env.example")) {
    dotenv.config({ path: ".env.example" });
  }
} catch {
  // ignore
}

// Path resolution compatible with both ESM (tsx) and CJS (esbuild bundle)
const getDirname = () => {
  if (typeof __dirname !== "undefined") return __dirname;
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {
    return process.cwd();
  }
};
const rawDir = getDirname();
export const _appDirname = fs.existsSync(path.join(rawDir, "package.json"))
  ? rawDir
  : path.resolve(rawDir, "..");

// Supabase Database Connection
// Automated test runs (MRWATER_TEST=1 or NODE_ENV=test) must NEVER touch the live database or the real data
// cache: the Supabase URL points at a closed local port and nothing is read from / written to data/collections.json.
export const IS_TEST_RUN =
  process.env.MRWATER_TEST === "1" || process.env.NODE_ENV === "test";

// No database address or key is built in for production: they must come from the environment (startupProblems()
// stops the server before it serves anything if they are missing). Outside production a missing value simply
// points at a closed local port, so a forgotten setting can never silently talk to someone else's database.
const SUPABASE_URL = IS_TEST_RUN
  ? "http://127.0.0.1:9"
  : process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "http://127.0.0.1:9";

const isValidSupabaseKey = (k?: string | null): boolean => {
  if (!k) return false;
  const trimmed = k.trim();
  return (
    trimmed !== "" &&
    !trimmed.includes("CHANGE-ME") &&
    !trimmed.startsWith("YOUR_") &&
    !trimmed.startsWith("MY_") &&
    !trimmed.startsWith("missing-")
  );
};

const rawServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const rawAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const SUPABASE_KEY =
  (isValidSupabaseKey(rawServiceKey) ? rawServiceKey!.trim() : "") ||
  (isValidSupabaseKey(rawAnonKey) ? rawAnonKey!.trim() : "") ||
  "missing-supabase-key";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// Circuit breaker and timeout protection for remote Supabase calls
let supabaseCircuitOpenUntil = 0;
let consecutiveSupabaseErrors = 0;

export function isSupabaseAvailable(): boolean {
  if (IS_TEST_RUN) return false;
  if (!isValidSupabaseKey(SUPABASE_KEY) || SUPABASE_URL === "http://127.0.0.1:9") {
    return false;
  }
  if (Date.now() < supabaseCircuitOpenUntil) {
    return false;
  }
  return true;
}

export function recordSupabaseSuccess() {
  consecutiveSupabaseErrors = 0;
  supabaseCircuitOpenUntil = 0;
}

export function recordSupabaseFailure(error: any) {
  consecutiveSupabaseErrors++;
  const raw = String(error?.message || error || "");
  const isOutage =
    raw.includes("520") ||
    raw.includes("<!DOCTYPE") ||
    raw.includes("upstream request timeout") ||
    raw.includes("502") ||
    raw.includes("503") ||
    raw.includes("504") ||
    raw.includes("fetch failed") ||
    raw.includes("ECONNREFUSED") ||
    raw.includes("ETIMEDOUT") ||
    raw.includes("timeout") ||
    consecutiveSupabaseErrors >= 3;

  if (isOutage) {
    // Open circuit for 30 seconds so all subsequent requests respond immediately without blocking
    supabaseCircuitOpenUntil = Date.now() + 30000;
    console.warn(
      `[Supabase Circuit Breaker] Remote endpoint degraded or unreachable. Bypassing Supabase calls for 30s to prevent timeouts.`,
    );
  }
}

export async function withSupabaseTimeout<T>(
  promise: Promise<T> | any,
  timeoutMs = 4000,
  fallbackValue: T = { error: null, data: null, skipped: true } as any,
): Promise<T> {
  if (!isSupabaseAvailable()) {
    return fallbackValue;
  }

  let timer: NodeJS.Timeout | null = null;
  try {
    const timeoutPromise = new Promise<T>((resolve) => {
      timer = setTimeout(() => {
        recordSupabaseFailure("upstream request timeout");
        resolve(fallbackValue);
      }, timeoutMs);
    });

    const result = await Promise.race([
      Promise.resolve(promise).catch((err) => {
        recordSupabaseFailure(err);
        return fallbackValue;
      }),
      timeoutPromise,
    ]);

    if ((result as any)?.error) {
      recordSupabaseFailure((result as any).error);
    } else if (!(result as any)?.skipped) {
      recordSupabaseSuccess();
    }
    return result;
  } catch (err: any) {
    recordSupabaseFailure(err);
    return fallbackValue;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Persistent disk cache for collections to guarantee zero data loss during cloud outages or restarts
const COLLECTIONS_FILE = path.join(_appDirname, "data", "collections.json");

function loadDiskCollections(): Record<string, any> {
  if (IS_TEST_RUN) return {};
  // After cleaning the database, set IGNORE_DISK_CACHE=1 once and restart: the old local copy is set aside
  // (renamed, not deleted) so stale test rows in it can never be served or pushed back to Supabase.
  if (process.env.IGNORE_DISK_CACHE === "1") {
    try {
      if (fs.existsSync(COLLECTIONS_FILE)) {
        fs.renameSync(COLLECTIONS_FILE, `${COLLECTIONS_FILE}.old-${Date.now()}`);
        console.log("[Storage] IGNORE_DISK_CACHE=1: old data/collections.json moved aside. Starting from the database.");
      }
    } catch (err) {
      console.warn("[Storage] Could not set the disk cache aside:", err);
    }
    return {};
  }
  try {
    if (fs.existsSync(COLLECTIONS_FILE)) {
      const raw = fs.readFileSync(COLLECTIONS_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.products)) {
        parsed.products = parsed.products.map((p: any) => {
          const detectedVol = volumeFromName(p.name);
          const vol = Number(p.volume) > 0 ? Number(p.volume) : (detectedVol || 150);
          const pack = p.pack && p.pack.trim() !== "" && p.pack !== "pcs" ? p.pack : detectPack(p.name);
          return {
            ...p,
            name: String(p.name || "").trim().toUpperCase(),
            volume: vol,
            pack,
          };
        });
      }
      return parsed;
    }
  } catch (err) {
    console.warn("[Storage] Error reading disk collections:", err);
  }
  return {};
}

let diskSaveTimer: NodeJS.Timeout | null = null;
function writeDiskCollectionsSync() {
  if (IS_TEST_RUN) return;
  try {
    const dir = path.dirname(COLLECTIONS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(
      COLLECTIONS_FILE,
      JSON.stringify(inMemoryCollections, null, 2),
      "utf-8",
    );
  } catch (err) {
    console.warn("[Storage] Error persisting disk collections:", err);
  }
}
export function persistDiskCollections() {
  if (IS_TEST_RUN) return;
  if (diskSaveTimer) clearTimeout(diskSaveTimer);
  diskSaveTimer = setTimeout(() => {
    diskSaveTimer = null;
    writeDiskCollectionsSync();
  }, 200);
}
export function flushDiskCollectionsNow() {
  if (IS_TEST_RUN) return;
  if (diskSaveTimer) {
    clearTimeout(diskSaveTimer);
    diskSaveTimer = null;
  }
  writeDiskCollectionsSync();
}

// In-memory collections fallback cache, pre-seeded from disk
export const inMemoryCollections: Record<string, any> = loadDiskCollections();

export function reloadDiskCollections(): Record<string, any> {
  const loaded = loadDiskCollections();
  for (const k of Object.keys(inMemoryCollections)) {
    delete inMemoryCollections[k];
  }
  Object.assign(inMemoryCollections, loaded);
  return inMemoryCollections;
}

// Helper for generic collections persistence
export async function getCollectionData(key: string): Promise<any> {
  // 1. Check in-memory / disk cache first (instant local-first resolution)
  if (
    inMemoryCollections[key] !== undefined &&
    inMemoryCollections[key] !== null
  ) {
    return inMemoryCollections[key];
  }

  if (!isSupabaseAvailable()) {
    return [];
  }

  // 2. Try public.app_collections with strict timeout
  try {
    const { data, error } = await withSupabaseTimeout(
      supabase
        .from("app_collections")
        .select("data")
        .eq("key", key)
        .maybeSingle(),
      2500,
    );

    if (!error && data && data.data !== undefined) {
      inMemoryCollections[key] = data.data;
      persistDiskCollections();
      return data.data;
    }
  } catch {
    // ignore
  }

  // 3. Fallback to billing_settings with strict timeout
  try {
    const { data, error } = await withSupabaseTimeout(
      supabase
        .from("billing_settings")
        .select("data")
        .eq("id", `collection_${key}`)
        .maybeSingle(),
      2500,
    );

    if (!error && data && data.data) {
      const val = data.data.items !== undefined ? data.data.items : data.data;
      inMemoryCollections[key] = val;
      persistDiskCollections();
      return val;
    }
  } catch {
    // ignore
  }

  return inMemoryCollections[key] !== undefined ? inMemoryCollections[key] : [];
}

// Deletion lists (deleted_bill_ids, deleted_records, ...) are also written straight to Supabase (devices, SQL
// clean-up), which this server's in-memory copy never sees. readListFresh() merges the two (short cache) so a
// delete made anywhere is honoured here, and a stale cache can never bring a deleted record back.
const freshListCache = new Map<string, { at: number; list: any[] }>();
export const listItemKey = (x: any) =>
  x && typeof x === "object" ? `${x.kind}:${x.id}` : String(x);
export async function readListFresh(key: string): Promise<any[]> {
  const hit = freshListCache.get(key);
  if (hit && Date.now() - hit.at < 10000) return hit.list;
  const local = await getCollectionData(key);
  const list: any[] = Array.isArray(local) ? [...local] : [];
  if (isSupabaseAvailable()) {
    try {
      const { data, error } = (await withSupabaseTimeout(
        supabase
          .from("app_collections")
          .select("data")
          .eq("key", key)
          .maybeSingle(),
        2500,
      )) as any;
      if (!error && data && Array.isArray(data.data)) {
        const seen = new Set(list.map(listItemKey));
        let added = false;
        for (const x of data.data) {
          if (!seen.has(listItemKey(x))) {
            list.push(x);
            seen.add(listItemKey(x));
            added = true;
          }
        }
        if (added) {
          inMemoryCollections[key] = list;
          persistDiskCollections();
        }
      }
    } catch {
      // Supabase unreachable: the local copy is all we have
    }
  }
  freshListCache.set(key, { at: Date.now(), list });
  return list;
}

export async function setCollectionData(key: string, rawData: any): Promise<boolean> {
  freshListCache.delete(key);
  const data = rawData !== undefined ? rawData : [];
  inMemoryCollections[key] = data;
  persistDiskCollections();

  if (!isSupabaseAvailable()) {
    return true; // Local memory and disk updated successfully
  }

  // Non-blocking best-effort Supabase sync
  withSupabaseTimeout(
    supabase.from("app_collections").upsert(
      {
        key,
        data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    ),
    2500,
  )
    .then(({ error }) => {
      if (error) {
        // Fallback to billing_settings
        withSupabaseTimeout(
          supabase.from("billing_settings").upsert(
            {
              id: `collection_${key}`,
              data: { items: data },
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id" },
          ),
          2500,
        ).then(({ error: e2 }: any) => {
          if (e2) console.warn(`[Supabase] Could not save collection '${key}': ${String(e2.message || e2).slice(0, 150)}`);
        }).catch(() => {});
      }
    })
    .catch(() => {});

  return true;
}

/**
 * Best-effort normalized-table sync with timeout and circuit-breaker.
 */
export async function syncNormalizedRows(table: string, rows: any[]): Promise<void> {
  if (!rows.length || !isSupabaseAvailable()) return;
  try {
    const { error } = await withSupabaseTimeout(
      supabase.from(table).upsert(rows, { onConflict: "id" }),
      2500,
    );
    if (error) {
      console.warn(
        `[Supabase] Normalized sync to ${table} skipped: ${error.message || "Timeout"}`,
      );
    }
  } catch (err: any) {
    console.warn(
      `[Supabase] Normalized sync to ${table} threw: ${err?.message || err}`,
    );
  }
}

// Helper to mutate inventory in PostgreSQL
export async function updateInventoryItemStock(
  productId: string | number,
  deltaOnHand: number,
  deltaReserved: number,
): Promise<void> {
  const pid = String(productId);

  // 1. Try updating public.inventory_items
  try {
    const { data: item, error } = await supabase
      .from("inventory_items")
      .select("*")
      .eq("product_id", pid)
      .limit(1)
      .maybeSingle();

    if (!error && item) {
      const newOnHand = Math.max(
        0,
        Number(item.stock_on_hand || 0) + deltaOnHand,
      );
      const newReserved = Math.max(
        0,
        Number(item.reserved_stock || 0) + deltaReserved,
      );
      await supabase
        .from("inventory_items")
        .update({
          stock_on_hand: newOnHand,
          reserved_stock: newReserved,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
      return;
    }
  } catch {
    // fallback
  }

  // 2. Fallback: update collection 'inventory_items'
  try {
    const items = await getCollectionData("inventory_items");
    if (Array.isArray(items)) {
      let updated = false;
      const newItems = items.map((it: any) => {
        if (String(it.product_id || it.productId) === pid) {
          updated = true;
          return {
            ...it,
            stock_on_hand: Math.max(
              0,
              Number(it.stock_on_hand || it.stockOnHand || 0) + deltaOnHand,
            ),
            reserved_stock: Math.max(
              0,
              Number(it.reserved_stock || it.reservedStock || 0) +
                deltaReserved,
            ),
            updated_at: new Date().toISOString(),
          };
        }
        return it;
      });
      if (updated) {
        await setCollectionData("inventory_items", newItems);
      }
    }
  } catch {
    // ignore
  }
}
