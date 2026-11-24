import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { readApiSession } from "../authFetch";
import { isServerProxyMode, setServerProxyModeForTest } from "./proxyMode";

export { isServerProxyMode, setServerProxyModeForTest };

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  projectRef: string;
  isConfigured: boolean;
}

const STORAGE_CONFIG_KEY = "mrwater_supabase_custom_credentials";

export interface ProxyFetchOptions extends RequestInit {
  timeoutMs?: number;
}

/**
 * Authenticated JSON helper used when isServerProxyMode() is enabled.
 * Always attaches stored session token (also safe in Node tests without installAuthFetch).
 */
export async function proxyFetch<T = any>(
  path: string,
  init: ProxyFetchOptions = {},
): Promise<{ ok: boolean; status: number; data: T | null; error?: string; code?: string }> {
  const { timeoutMs = 15000, headers: rawHeaders, ...rest } = init;
  const headers = new Headers(rawHeaders || {});
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (rest.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const session = readApiSession();
  if (session?.token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${session.token}`);
  }

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const res = await fetch(path, {
      ...rest,
      headers,
      signal: init.signal || controller?.signal,
    });
    if (timer) clearTimeout(timer);

    const text = await res.text().catch(() => "");
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        data: json,
        error: json?.error || text || `HTTP ${res.status}`,
        code: json?.code,
      };
    }

    return {
      ok: true,
      status: res.status,
      data: json as T,
    };
  } catch (err: any) {
    if (timer) clearTimeout(timer);
    return {
      ok: false,
      status: 0,
      data: null,
      error: err?.message || "Network request failed",
    };
  }
}

/**
 * True when the code is running inside the automated test scripts (scripts/test-*.ts), which mount the real
 * LedgerProvider under jsdom. Those runs must NEVER reach the live database: before this guard the hard-coded
 * fallback URL below let `npm test` push test bills, trips, products and GRNs into the production Supabase project.
 */
function isTestRun(): boolean {
  try {
    if ((globalThis as any).process?.env?.MRWATER_TEST === "1") return true;
    if (typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent || "")) return true;
  } catch {
    // ignore
  }
  return false;
}

export function getSupabaseConfig(): SupabaseConfig {
  if (isTestRun()) {
    return { url: "", anonKey: "", projectRef: "test", isConfigured: false };
  }
  const envUrl =
    import.meta.env.VITE_SUPABASE_URL ||
    "https://psizakmtxppariejawbd.supabase.co";
  const envKey =
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    "sb_publishable_3D3tfJOS10gkL0lJ6qQT1Q_Lvux1S9W";

  let customUrl = "";
  let customKey = "";

  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(STORAGE_CONFIG_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        customUrl = parsed.url || "";
        customKey = parsed.anonKey || "";
      }
    } catch {
      // ignore
    }
  }

  const finalUrl = (customUrl || envUrl || "").trim();
  const finalKey = (customKey || envKey || "").trim();

  // Check for dummy or missing placeholder keys
  const isInvalidPlaceholder =
    !finalKey ||
    finalKey === "YOUR_SUPABASE_ANON_KEY" ||
    finalKey === "MY_SUPABASE_ANON_KEY" ||
    finalKey.includes("CHANGE-ME") ||
    finalKey.startsWith("missing-") ||
    finalKey.trim() === "";

  let projectRef = "psizakmtxppariejawbd";
  try {
    if (finalUrl) {
      const parsedUrl = new URL(finalUrl);
      projectRef = parsedUrl.hostname.split(".")[0] || "psizakmtxppariejawbd";
    }
  } catch {
    // fallback
  }

  return {
    url: finalUrl,
    anonKey: finalKey,
    projectRef,
    isConfigured: Boolean(finalUrl && finalKey && !isInvalidPlaceholder),
  };
}

let cachedClient: SupabaseClient | null = null;
let cachedConfigKey = "";

export function getSupabaseClient(): SupabaseClient | null {
  if (isServerProxyMode()) {
    return null;
  }
  const config = getSupabaseConfig();
  if (!config.isConfigured) {
    return null;
  }

  const configKey = `${config.url}_${config.anonKey}`;
  if (cachedClient && cachedConfigKey === configKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    cachedConfigKey = configKey;
    return cachedClient;
  } catch (err) {
    console.error("Failed to create Supabase client:", err);
    return null;
  }
}

export function saveSupabaseCustomConfig(url: string, anonKey: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(
      STORAGE_CONFIG_KEY,
      JSON.stringify({ url: url.trim(), anonKey: anonKey.trim() }),
    );
    cachedClient = null;
    cachedConfigKey = "";
  }
}

export function clearSupabaseCustomConfig(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_CONFIG_KEY);
    cachedClient = null;
    cachedConfigKey = "";
  }
}

export interface ConnectionTestResult {
  connected: boolean;
  url: string;
  projectRef: string;
  latencyMs: number;
  tablesReady: {
    warehouses: boolean;
    products: boolean;
    inventory_batches: boolean;
    stock_transfers: boolean;
    promotions: boolean;
    bills: boolean;
    trips: boolean;
    audits: boolean;
    organization_profile: boolean;
    billing_settings: boolean;
    inventory_items?: boolean;
    app_collections?: boolean;
    salesmen?: boolean;
  };
  allTablesExist: boolean;
  message: string;
  error?: string;
}

export async function testSupabaseConnection(): Promise<ConnectionTestResult> {
  const emptyTables = {
    warehouses: false,
    products: false,
    inventory_batches: false,
    stock_transfers: false,
    promotions: false,
    bills: false,
    trips: false,
    audits: false,
    organization_profile: false,
    billing_settings: false,
    salesmen: false,
  };

  if (isServerProxyMode()) {
    const startTime = Date.now();
    const res = await proxyFetch<any>("/api/supabase/health", { method: "GET" });
    if (res.ok && res.data) {
      const d = res.data;
      return {
        connected: Boolean(d.connected),
        url: d.url || "/api",
        projectRef: d.projectRef || "server-proxy",
        latencyMs: Number(d.latencyMs ?? Date.now() - startTime),
        tablesReady: d.tablesReady || emptyTables,
        allTablesExist: Boolean(d.allTablesExist),
        message:
          d.message ||
          "Connected to Supabase via Express server proxy.",
        ...(d.error ? { error: d.error } : {}),
      };
    }
    return {
      connected: false,
      url: "/api",
      projectRef: "server-proxy",
      latencyMs: Date.now() - startTime,
      tablesReady: emptyTables,
      allTablesExist: false,
      message: res.error || "Unable to verify Supabase connection via server proxy.",
      error: res.error,
    };
  }

  const config = getSupabaseConfig();
  const client = getSupabaseClient();

  if (!client) {
    return {
      connected: false,
      url: config.url,
      projectRef: config.projectRef,
      latencyMs: 0,
      tablesReady: emptyTables,
      allTablesExist: false,
      message:
        "Local-first storage is active. Cloud synchronization requires custom Supabase credentials.",
      error: undefined,
    };
  }

  const startTime = Date.now();

  try {
    const checkTable = async (tableName: string): Promise<boolean> => {
      try {
        const checkPromise = client.from(tableName).select("id").limit(1);
        const timeoutPromise = new Promise<{ error: any }>((resolve) =>
          setTimeout(() => resolve({ error: { message: "timeout" } }), 2000),
        );
        const { error } = await Promise.race([checkPromise, timeoutPromise]);
        if (error) {
          if (
            error.code === "PGRST205" ||
            String(error.message || "").includes("Could not find the table")
          ) {
            return false;
          }
          if (
            String(error.message || "").includes("520") ||
            String(error.message || "").includes("timeout") ||
            String(error.message || "").includes("<!DOCTYPE")
          ) {
            return false;
          }
        }
        return true;
      } catch {
        return false;
      }
    };

    const overallCheck = Promise.all([
      checkTable("warehouses"),
      checkTable("products"),
      checkTable("inventory_batches"),
      checkTable("stock_transfers"),
      checkTable("promotions"),
      checkTable("bills"),
      checkTable("trips"),
      checkTable("audits"),
      checkTable("organization_profile"),
      checkTable("billing_settings"),
      checkTable("inventory_items"),
      checkTable("app_collections"),
      checkTable("salesmen"),
    ]);

    const overallTimeout = new Promise<boolean[]>((_, reject) =>
      setTimeout(() => reject(new Error("Supabase connection timeout")), 3500),
    );

    const [
      whOk,
      productsOk,
      batchesOk,
      transfersOk,
      promosOk,
      billsOk,
      tripsOk,
      auditsOk,
      orgOk,
      settingsOk,
      invItemsOk,
      collectionsOk,
      salesmenOk,
    ] = await Promise.race([overallCheck, overallTimeout]);

    const latencyMs = Date.now() - startTime;
    const tablesReady = {
      warehouses: whOk,
      products: productsOk,
      inventory_batches: batchesOk,
      stock_transfers: transfersOk,
      promotions: promosOk,
      bills: billsOk,
      trips: tripsOk,
      audits: auditsOk,
      organization_profile: orgOk,
      billing_settings: settingsOk,
      inventory_items: invItemsOk,
      app_collections: collectionsOk,
      salesmen: salesmenOk,
    };

    const allTablesExist = Object.values(tablesReady).every(Boolean);

    return {
      connected: true,
      url: config.url,
      projectRef: config.projectRef,
      latencyMs,
      tablesReady,
      allTablesExist,
      message: allTablesExist
        ? "Connected to Supabase PostgreSQL database. All tables, warehouse schemas, and RLS policies are active."
        : "Connected to Supabase project endpoint. Please run the SQL setup script to initialize missing tables.",
    };
  } catch (err: any) {
    const rawMsg = String(err?.message || err || "");
    const cleanMsg =
      rawMsg.includes("520") ||
      rawMsg.includes("<!DOCTYPE") ||
      rawMsg.includes("timeout")
        ? "Supabase service temporarily unavailable or timing out. Local-first storage active."
        : `Failed to connect to Supabase: ${rawMsg}`;

    return {
      connected: false,
      url: config.url,
      projectRef: config.projectRef,
      latencyMs: Date.now() - startTime,
      tablesReady: emptyTables,
      allTablesExist: false,
      message: cleanMsg,
      error: cleanMsg,
    };
  }
}

export function sanitizeDate(val?: string): string | null {
  if (!val) return null;
  const trimmed = val.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return null;
}

export interface SyncResult {
  success: boolean;
  message?: string;
  pushedCount?: {
    warehouses: number;
    products: number;
    inventoryBatches: number;
    grns: number;
    promotions: number;
    bills: number;
    trips: number;
    audits: number;
    payments?: number;
    salesmen?: number;
    supplierSchemes?: number;
    supplierSchemeApplications?: number;
    supplierCreditNotes?: number;
  };
}

/**
 * Validate UUID format
 */
export function isValidUuid(val: any): boolean {
  if (typeof val !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    val.trim(),
  );
}
