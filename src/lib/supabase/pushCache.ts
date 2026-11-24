import { getSupabaseConfig, isValidUuid } from "./client";

/* =========================================================================
 * Change-only pushes (keeps Supabase Disk IO low)
 *
 * "Sync to cloud" used to upsert EVERY row of every table each time, stamping a fresh updated_at on all of them.
 * That rewrote the whole database on every press and made every other device think everything had changed.
 * Now each row's content is fingerprinted (ignoring updated_at); a row is only sent when its fingerprint differs
 * from the one last pushed successfully. The fingerprints live in localStorage, per Supabase project.
 * ========================================================================= */
const PUSH_CACHE_KEY = "mrwater_push_hashes_v1";
const PUSH_CACHED_TABLES = new Set([
  "bills",
  "trips",
  "grns",
  "products",
  "inventory_batches",
  "salesmen",
  "promotions",
  "warehouses",
  "audits",
  "app_collections",
]);
interface PushCache {
  ref: string;
  h: Record<string, string>;
}
let pushCache: PushCache | null = null;
let pushCacheSaveTimer: ReturnType<typeof setTimeout> | null = null;

/** Small, fast, non-cryptographic 53-bit string hash (cyrb53). */
export function fastHash(str: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36) + ":" + str.length.toString(36);
}

function getPushCache(): PushCache {
  let ref = "";
  try {
    ref = getSupabaseConfig().projectRef;
  } catch {
    // ignore
  }
  if (pushCache && pushCache.ref === ref) return pushCache;
  let loaded: PushCache | null = null;
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(PUSH_CACHE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.ref === ref && parsed.h && typeof parsed.h === "object") loaded = parsed;
    }
  } catch {
    // ignore a damaged cache: it only means one extra full push
  }
  pushCache = loaded || { ref, h: {} };
  return pushCache;
}

function schedulePushCacheSave() {
  if (pushCacheSaveTimer || typeof localStorage === "undefined") return;
  pushCacheSaveTimer = setTimeout(() => {
    pushCacheSaveTimer = null;
    try {
      if (pushCache) localStorage.setItem(PUSH_CACHE_KEY, JSON.stringify(pushCache));
    } catch {
      // storage full: the cache is only an optimisation
    }
  }, 1500);
}

/** Forget what was pushed, so the next "Sync to cloud" sends everything once. */
export function clearPushCache() {
  pushCache = { ref: pushCache?.ref || "", h: {} };
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(PUSH_CACHE_KEY);
  } catch {
    // ignore
  }
}

function rowIdentity(table: string, row: any): string | null {
  if (!row || typeof row !== "object") return null;
  const id = table === "app_collections" ? row.key : row.id;
  return id === undefined || id === null ? null : `${table}|${id}`;
}

function rowFingerprint(row: any): string {
  const { updated_at: _ignored, ...rest } = row;
  try {
    return fastHash(JSON.stringify(rest));
  } catch {
    return "";
  }
}

/**
 * Wraps a Supabase client so that `.from(table).upsert(rows)` only sends rows whose content changed since the last
 * successful push. Everything else passes straight through. `force` sends every row (and refreshes the fingerprints).
 */
export function changedOnlyClient(client: any, force = false): any {
  return new Proxy(client, {
    get(target, prop) {
      const value = Reflect.get(target, prop, target);
      if (prop !== "from") return typeof value === "function" ? value.bind(target) : value;
      return (table: string) => {
        const builder = target.from(table);
        if (!PUSH_CACHED_TABLES.has(table)) return builder;
        return new Proxy(builder, {
          get(b, p) {
            const member = Reflect.get(b, p, b);
            if (p !== "upsert") return typeof member === "function" ? member.bind(b) : member;
            return (rows: any, opts?: any) => {
              const list: any[] = Array.isArray(rows) ? rows : [rows];
              if (list.length === 0 || list.some((r) => rowIdentity(table, r) === null)) {
                return b.upsert(rows, opts);
              }
              const cache = getPushCache();
              const pending: Array<[string, string]> = [];
              const changed = list.filter((r) => {
                const key = rowIdentity(table, r) as string;
                const fp = rowFingerprint(r);
                if (!force && fp && cache.h[key] === fp) return false;
                if (fp) pending.push([key, fp]);
                return true;
              });
              if (changed.length === 0) {
                return Promise.resolve({ data: null, error: null, count: null, status: 200, statusText: "unchanged" });
              }
              return (async () => {
                const res = await b.upsert(Array.isArray(rows) ? changed : changed[0], opts);
                if (!res?.error) {
                  pending.forEach(([k, fp]) => {
                    cache.h[k] = fp;
                  });
                  schedulePushCacheSave();
                }
                return res;
              })();
            };
          },
        });
      };
    },
  });
}

/**
 * Resilient upsert helper that handles PostgREST schema cache misses gracefully.
 * If PostgREST schema cache has not yet refreshed for newly added columns (e.g. 'salesman', 'salesman_id'),
 * it automatically detects the missing column, removes it, and retries the operation seamlessly.
 */
export async function resilientSupabaseUpsert(
  client: any,
  tableName: string,
  data: any | any[],
  options: { onConflict?: string } = { onConflict: "id" },
): Promise<{ error: any; data?: any }> {
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
      const chunk = currentRows.slice(i, i + BATCH_SIZE);
      const res = await resilientSupabaseUpsert(client, tableName, chunk, options);
      if (res.error) {
        batchError = res.error;
      }
    }
    return { error: batchError };
  }

  let lastError: any = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const payload = isArray ? currentRows : currentRows[0];
    const { error, data: resData } = await client
      .from(tableName)
      .upsert(payload, options);
    if (!error) {
      return { error: null, data: resData };
    }

    lastError = error;
    const msg = (error.message || "").toString();

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
