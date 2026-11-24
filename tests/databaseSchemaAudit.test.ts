import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import http from "node:http";

process.env.MRWATER_TEST = "1";
process.env.API_AUTH_REQUIRED = "true";
process.env.APP_SESSION_SECRET = "test-session-secret-key-at-least-32-chars-long";
process.env.PIN_PEPPER = "test-pin-pepper-value";

const memStorage = new Map<string, string>();
if (typeof (globalThis as any).localStorage === "undefined") {
  (globalThis as any).localStorage = {
    getItem: (k: string) => (memStorage.has(k) ? memStorage.get(k)! : null),
    setItem: (k: string, v: string) => {
      memStorage.set(k, String(v));
    },
    removeItem: (k: string) => {
      memStorage.delete(k);
    },
    clear: () => memStorage.clear(),
  };
}

const { MONITORED_DB_TABLES, testSupabaseConnection, setServerProxyModeForTest } = await import(
  "../src/lib/supabase/client"
);
const { COMPLETE_SQL_SCHEMA_SCRIPT } = await import("../src/lib/supabase/schemaSql");
const authFetch = await import("../src/lib/authFetch");
const serverAuth = await import("../server-auth");
const { createSecurityAndAuthSetup } = await import("../server/authMiddleware");
const { registerSystemRoutes } = await import("../server/routes/systemRoutes");
const { registerSyncAndActivityRoutes } = await import("../server/routes/syncAndActivityRoutes");
const { registerGrnsInventoryProductsRoutes } = await import(
  "../server/routes/grnsInventoryProductsRoutes"
);
const { registerSettingsWarehousesAuditsRoutes } = await import(
  "../server/routes/settingsWarehousesAuditsRoutes"
);
const {
  formatBatchRowForServer,
  mapDbBatchRowToApp,
  formatPromotionRowForServer,
  mapPromotionCollectionItem,
  formatAuditRowForServer,
  mapDbAuditRowToApp,
} = await import("../server/routes/syncHelpers");
const { formatBatchForSupabase, formatPromotionForSupabase } = await import(
  "../src/lib/supabase/ledgerPush"
);

const ROOT = path.resolve(import.meta.dirname, "..");

function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectTsFiles(full));
    } else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function validateSqlSchema(sql: string, label: string) {
  const createPositions = new Map<string, number>();
  const createMatches = [...sql.matchAll(/CREATE TABLE IF NOT EXISTS\s+public\.([a-z0-9_]+)/gi)];
  for (const m of createMatches) {
    const tbl = m[1].toLowerCase();
    assert.equal(
      createPositions.has(tbl),
      false,
      `${label}: duplicate CREATE TABLE IF NOT EXISTS public.${tbl}`,
    );
    createPositions.set(tbl, m.index ?? -1);
  }

  for (const tbl of MONITORED_DB_TABLES) {
    assert.ok(
      createPositions.has(tbl),
      `${label}: missing CREATE TABLE IF NOT EXISTS public.${tbl}`,
    );
  }

  // Every ALTER TABLE / CREATE INDEX / CREATE POLICY / COMMENT / VIEW on public.<tbl>
  // must appear strictly AFTER CREATE TABLE IF NOT EXISTS public.<tbl>.
  const refPatterns = [
    /ALTER TABLE\s+public\.([a-z0-9_]+)/gi,
    /CREATE INDEX IF NOT EXISTS\s+[a-z0-9_]+\s+ON\s+public\.([a-z0-9_]+)/gi,
    /CREATE POLICY\s+"[^"]+"\s+ON\s+public\.([a-z0-9_]+)/gi,
    /DROP POLICY IF EXISTS\s+"[^"]+"\s+ON\s+public\.([a-z0-9_]+)/gi,
    /FROM\s+public\.([a-z0-9_]+)/gi,
  ];
  for (const pattern of refPatterns) {
    for (const m of sql.matchAll(pattern)) {
      const tbl = m[1].toLowerCase();
      const refIdx = m.index ?? -1;
      const createIdx = createPositions.get(tbl);
      assert.ok(
        createIdx !== undefined && createIdx >= 0,
        `${label}: references public.${tbl} without creating it`,
      );
      assert.ok(
        refIdx > createIdx,
        `${label}: statement referencing public.${tbl} at offset ${refIdx} appears before CREATE TABLE at offset ${createIdx}`,
      );
    }
  }

  // Critical repair columns must be present in both SQL scripts
  const requiredFragments = [
    "public.inventory_batches ADD COLUMN IF NOT EXISTS sku",
    "public.inventory_batches ADD COLUMN IF NOT EXISTS effective_cost_price",
    "public.inventory_batches ADD COLUMN IF NOT EXISTS scheme",
    "public.products ADD COLUMN IF NOT EXISTS extra",
    "public.grns ADD COLUMN IF NOT EXISTS extra",
    "public.grns ADD COLUMN IF NOT EXISTS edit_history",
    "public.bills ADD COLUMN IF NOT EXISTS extra",
    "public.bills ADD COLUMN IF NOT EXISTS cancelled_returns",
    "public.bills ADD COLUMN IF NOT EXISTS edit_history",
    "public.bills ADD COLUMN IF NOT EXISTS supply_type",
    "public.bills ADD COLUMN IF NOT EXISTS scheme_discount_total",
    "public.trips ADD COLUMN IF NOT EXISTS warehouse_loads",
    "public.trips ADD COLUMN IF NOT EXISTS shortage_reasons",
    "public.trips ADD COLUMN IF NOT EXISTS draft_returned",
    "public.promotions ADD COLUMN IF NOT EXISTS is_active",
    "public.promotions ADD COLUMN IF NOT EXISTS config",
    "public.payments ADD COLUMN IF NOT EXISTS reversal_of",
    "public.inventory_dispositions ADD COLUMN IF NOT EXISTS approval_status",
    "public.inventory_dispositions ADD COLUMN IF NOT EXISTS return_tracking",
    "public.supplier_credit_notes ADD COLUMN IF NOT EXISTS taxable_value",
    "public.audit_sessions ADD COLUMN IF NOT EXISTS edit_log",
  ];
  for (const frag of requiredFragments) {
    assert.ok(sql.includes(frag), `${label}: missing "${frag}"`);
  }
  // Live-DB safety invariants: never mutate existing data, truncate, drop tables, or drop policies
  const forbiddenPatterns: Array<[RegExp, string]> = [
    [/\bUPDATE\s+public\./gi, "UPDATE public.*"],
    [/\bDELETE\s+FROM\s+/gi, "DELETE FROM"],
    [/\bINSERT\s+INTO\s+/gi, "INSERT INTO"],
    [/\bTRUNCATE\s+/gi, "TRUNCATE"],
    [/\bDROP\s+TABLE\b/gi, "DROP TABLE"],
    [/\bDROP\s+POLICY\b/gi, "DROP POLICY"],
  ];
  for (const [pat, name] of forbiddenPatterns) {
    assert.equal(
      pat.test(sql),
      false,
      `${label}: forbidden mutating/destructive SQL detected (${name}) — schema script must be safe on live realtime DB`,
    );
  }

  // All RLS enable & policy statements must use idempotent DO $$ guards (no bare ENABLE ROW LEVEL SECURITY / CREATE POLICY)
  const rlsGuardCount = (sql.match(/SELECT c\.relrowsecurity FROM pg_class c/g) || []).length;
  assert.equal(
    rlsGuardCount,
    MONITORED_DB_TABLES.length,
    `${label}: expected ${MONITORED_DB_TABLES.length} idempotent RLS guards`,
  );
  const policyGuardCount = (sql.match(/IF NOT EXISTS \(SELECT 1 FROM pg_policies/g) || []).length;
  assert.equal(
    policyGuardCount,
    MONITORED_DB_TABLES.length,
    `${label}: expected ${MONITORED_DB_TABLES.length} idempotent policy guards`,
  );
}

test("migrations/supabase-schema.sql and COMPLETE_SQL_SCHEMA_SCRIPT define all queried tables in valid order and stay strictly aligned", () => {
  const migrationSql = fs.readFileSync(path.join(ROOT, "migrations", "supabase-schema.sql"), "utf8");
  assert.equal(
    migrationSql.trim(),
    COMPLETE_SQL_SCHEMA_SCRIPT.trim(),
    "migrations/supabase-schema.sql and COMPLETE_SQL_SCHEMA_SCRIPT in src/lib/supabase/schemaSql.ts must stay identical",
  );
  validateSqlSchema(migrationSql, "migrations/supabase-schema.sql");
  validateSqlSchema(COMPLETE_SQL_SCHEMA_SCRIPT, "COMPLETE_SQL_SCHEMA_SCRIPT");

  // Every static .from("table") referenced in src/ and server/ must exist in MONITORED_DB_TABLES & SQL scripts
  const codeFiles = [...collectTsFiles(path.join(ROOT, "src")), ...collectTsFiles(path.join(ROOT, "server"))];
  const queriedTables = new Set<string>();
  for (const file of codeFiles) {
    const content = fs.readFileSync(file, "utf8");
    for (const m of content.matchAll(/\.from\(\s*["']([a-z0-9_]+)["']\s*\)/g)) {
      queriedTables.add(m[1]);
    }
  }

  assert.ok(queriedTables.size >= 20, "Expected at least 20 static .from(...) tables across src/ and server/");
  for (const tbl of queriedTables) {
    assert.ok(
      (MONITORED_DB_TABLES as readonly string[]).includes(tbl),
      `Table "${tbl}" is queried via .from("${tbl}") in app code but missing from MONITORED_DB_TABLES`,
    );
    assert.ok(
      migrationSql.includes(`CREATE TABLE IF NOT EXISTS public.${tbl}`),
      `Table "${tbl}" is missing from migrations/supabase-schema.sql`,
    );
    assert.ok(
      COMPLETE_SQL_SCHEMA_SCRIPT.includes(`CREATE TABLE IF NOT EXISTS public.${tbl}`),
      `Table "${tbl}" is missing from COMPLETE_SQL_SCHEMA_SCRIPT`,
    );
  }
});

test("activityLogs, collectionsRoutes, and customersSchemesPaymentsRoutes use valid columns and constraints", () => {
  const actSrc = fs.readFileSync(path.join(ROOT, "src", "lib", "supabase", "activityLogs.ts"), "utf8");
  assert.equal(actSrc.includes('.eq("name", "activity_logs")'), false, "Must query app_collections by key, not name");
  assert.equal(actSrc.includes('.select("items")'), false, "Must select data from app_collections, not items");
  assert.ok(actSrc.includes('.eq("key", "activity_logs")'));
  assert.ok(actSrc.includes('.select("data")'));

  const colRoutes = fs.readFileSync(path.join(ROOT, "server", "routes", "collectionsRoutes.ts"), "utf8");
  assert.equal(colRoutes.includes('"free_qty"'), false, "supplier_schemes CHECK expects free_goods, not free_qty");

  const cspRoutes = fs.readFileSync(
    path.join(ROOT, "server", "routes", "customersSchemesPaymentsRoutes.ts"),
    "utf8",
  );
  assert.equal(
    cspRoutes.includes(".upsert(fullScheme,"),
    false,
    "promotional_schemes upsert must map snake_case columns instead of camelCase fullScheme",
  );
});

test("server health endpoint & testSupabaseConnection monitor all 27 tables cleanly and report missingTables", async () => {
  const clientSrc = fs.readFileSync(path.join(ROOT, "src", "lib", "supabase", "client.ts"), "utf8");
  assert.equal(
    clientSrc.includes('client.from(tableName).select("id")'),
    false,
    "Health check must probe app_collections with 'key' instead of nonexistent 'id'",
  );
  assert.ok(
    clientSrc.includes("pqjvumdrybjqxrqstams.supabase.co"),
    "Default Supabase fallback URL must use latest project pqjvumdrybjqxrqstams.supabase.co",
  );
  for (const dir of ["src", "server"]) {
    for (const file of collectTsFiles(path.join(ROOT, dir))) {
      const text = fs.readFileSync(file, "utf8");
      assert.equal(
        text.includes("psizakmtxppariejawbd"),
        false,
        `${path.relative(ROOT, file)} must not reference old Supabase project psizakmtxppariejawbd`,
      );
    }
  }

  const syncSrc = fs.readFileSync(path.join(ROOT, "server", "routes", "syncAndActivityRoutes.ts"), "utf8");
  assert.equal(
    syncSrc.includes('supabase.from(tableName).select("id")'),
    false,
    "Server /api/supabase/health must probe app_collections with 'key' instead of nonexistent 'id'",
  );

  const app = express();
  const setup = createSecurityAndAuthSetup();
  setup.applySecurityAndAuthMiddleware(app);
  registerSystemRoutes(app, setup.resolveAuth);
  registerSyncAndActivityRoutes(app, setup.resolveAuth);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address() as any;
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  const originalFetch = globalThis.fetch;
  try {
    const adminToken = serverAuth.signToken(
      { r: "admin", n: "Owner" },
      process.env.APP_SESSION_SECRET!,
    );
    setServerProxyModeForTest(true);
    authFetch.setApiSession(adminToken, Date.now() + 3600_000);

    // 1. Live server /api/supabase/health check when offline/test mode reports all 27 monitored tables
    globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const target = typeof input === "string" && input.startsWith("/") ? `${baseUrl}${input}` : input;
      return originalFetch(target as any, init);
    };

    const res = await testSupabaseConnection();
    assert.equal(res.allTablesExist, false);
    assert.equal(Object.keys(res.tablesReady).length, MONITORED_DB_TABLES.length);
    for (const t of MONITORED_DB_TABLES) {
      assert.equal(res.tablesReady[t], false);
    }
    assert.deepEqual(res.missingTables, [...MONITORED_DB_TABLES]);

    // 2. Partial missing-tables response passed through testSupabaseConnection
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          connected: true,
          latencyMs: 42,
          tablesReady: Object.fromEntries(
            MONITORED_DB_TABLES.map((t) => [t, t !== "inventory_dispositions" && t !== "activity_logs"]),
          ),
          allTablesExist: false,
          message: "Partial schema",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )) as any;

    const partial = await testSupabaseConnection();
    assert.equal(partial.connected, true);
    assert.equal(partial.allTablesExist, false);
    assert.deepEqual(partial.missingTables, ["activity_logs", "inventory_dispositions"]);
  } finally {
    globalThis.fetch = originalFetch;
    setServerProxyModeForTest(null);
    authFetch.setApiSession(null);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("client & server batch, promotion, and audit mappers preserve extended fields", () => {
  const sampleBatch = {
    id: "batch-101",
    productId: 42,
    sku: "SKU-42",
    batchNumber: "B-2026-01",
    mfgDate: "2026-01-10",
    expiryDate: "2026-10-10",
    warehouseId: "wh-main",
    quantity: 55,
    billedQuantity: 50,
    freeQuantity: 5,
    costPrice: 120,
    effectiveCostPrice: 109.09,
    landedCostPerCrate: 128.5,
    mrp: 180,
    scheme: "10+1",
    notes: "Fresh inward",
    supplierInvoiceNo: "INV-998",
    supplierName: "Bisleri Plant",
    inwardDate: "2026-01-11",
  };

  const clientBatchRow = formatBatchForSupabase(sampleBatch as any);
  const serverBatchRow = formatBatchRowForServer(sampleBatch);
  assert.equal(clientBatchRow.scheme, "10+1");
  assert.equal(clientBatchRow.billed_quantity, 50);
  assert.equal(clientBatchRow.free_quantity, 5);
  assert.equal(clientBatchRow.landed_cost_per_crate, 128.5);
  assert.equal(serverBatchRow.scheme, "10+1");
  assert.equal(serverBatchRow.supplier_invoice_no, "INV-998");
  const roundtripBatch = mapDbBatchRowToApp(serverBatchRow);
  assert.equal(roundtripBatch.scheme, "10+1");
  assert.equal(roundtripBatch.billedQuantity, 50);
  assert.equal(roundtripBatch.freeQuantity, 5);
  assert.equal(roundtripBatch.landedCostPerCrate, 128.5);
  assert.equal(roundtripBatch.supplierName, "Bisleri Plant");

  const samplePromo = {
    id: 707,
    name: "Group Combo Deal",
    type: "bundle_group",
    buyQty: 10,
    freeQty: 1,
    productIds: [1, 2],
    productGroup: [1, 2, 3],
    groupCategory: "Water",
    groupBrand: "MrWater",
    freeItemRule: "CUSTOMER_CHOICE",
    customerChoiceProductId: 3,
    isActive: true,
    config: { note: "custom" },
  };
  const clientPromoRow = formatPromotionForSupabase(samplePromo as any);
  const serverPromoRow = formatPromotionRowForServer(samplePromo);
  assert.equal(clientPromoRow.type, "bogo");
  assert.equal(serverPromoRow.type, "bogo");
  assert.deepEqual(clientPromoRow.product_group, [1, 2, 3]);
  assert.deepEqual(serverPromoRow.product_group, [1, 2, 3]);
  assert.equal(serverPromoRow.free_item_rule, "CUSTOMER_CHOICE");
  assert.equal(serverPromoRow.customer_choice_product_id, 3);
  assert.equal(serverPromoRow.config.originalType, "bundle_group");
  const restoredPromo = mapPromotionCollectionItem(serverPromoRow);
  assert.equal(restoredPromo.type, "bundle_group");
  assert.deepEqual(restoredPromo.productGroup, [1, 2, 3]);
  assert.equal(restoredPromo.customerChoiceProductId, 3);
  assert.equal(restoredPromo.isActive, true);

  const sampleAudit = {
    id: 9001,
    date: "2026-04-01",
    warehouseId: "wh-branch-2",
    entries: [{ productId: 42, system: 10, physical: 9, variance: -1 }],
    adjusted: true,
  };
  const dbAudit = formatAuditRowForServer(sampleAudit);
  assert.equal(dbAudit.warehouse_id, "wh-branch-2");
  const appAudit = mapDbAuditRowToApp(dbAudit);
  assert.equal(appAudit.warehouseId, "wh-branch-2");
  assert.equal(appAudit.adjusted, true);
});

test("Express sync, batches, and audits routes preserve fields end-to-end without loss", async () => {
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  const setup = createSecurityAndAuthSetup();
  setup.applySecurityAndAuthMiddleware(app);
  registerSyncAndActivityRoutes(app, setup.resolveAuth);
  registerGrnsInventoryProductsRoutes(app);
  registerSettingsWarehousesAuditsRoutes(app);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address() as any;
  const baseUrl = `http://127.0.0.1:${addr.port}`;
  const adminToken = serverAuth.signToken(
    { r: "admin", n: "Owner" },
    process.env.APP_SESSION_SECRET!,
  );
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${adminToken}`,
  };

  try {
    const pushRes = await fetch(`${baseUrl}/api/sync/push`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        data: {
          warehouses: [{ id: "wh-1", name: "Main", code: "MAIN" }],
          inventoryBatches: [
            {
              id: "b-1",
              productId: 11,
              batchNumber: "LOT-1",
              warehouseId: "wh-1",
              quantity: 22,
              billedQuantity: 20,
              freeQuantity: 2,
              landedCostPerCrate: 95.5,
              scheme: "10+1",
            },
          ],
          promotions: [
            {
              id: 55,
              name: "Mix Promo",
              type: "bundle_group",
              productIds: [11],
              productGroup: [11, 12],
              freeItemRule: "CHEAPEST_IN_GROUP",
              isActive: true,
            },
          ],
          audits: [
            {
              id: 301,
              date: "2026-04-02",
              warehouseId: "wh-1",
              entries: [],
              adjusted: false,
            },
          ],
          supplierSchemes: [
            {
              id: "ss-1",
              supplierName: "Plant A",
              name: "Q1 Scheme",
              schemeType: "free_goods",
              productIds: [11],
              startDate: "2026-01-01",
              active: true,
            },
          ],
          auditSessions: [
            {
              id: "as-1",
              warehouseId: "wh-1",
              date: "2026-04-02",
              auditorName: "Admin",
              entries: [],
            },
          ],
        },
      }),
    });
    assert.equal(pushRes.status, 200);
    const pushJson = (await pushRes.json()) as any;
    assert.equal(pushJson.success, true);
    assert.equal(pushJson.pushedCount.supplierSchemes, 1);

    const pullRes = await fetch(`${baseUrl}/api/sync/pull`, { headers });
    assert.equal(pullRes.status, 200);
    const pullJson = (await pullRes.json()) as any;
    assert.equal(pullJson.data.inventoryBatches[0].scheme, "10+1");
    assert.equal(pullJson.data.inventoryBatches[0].freeQuantity, 2);
    assert.equal(pullJson.data.promotions[0].type, "bundle_group");
    assert.deepEqual(pullJson.data.promotions[0].productGroup, [11, 12]);
    assert.equal(pullJson.data.audits[0].warehouseId, "wh-1");
    assert.equal(pullJson.data.supplierSchemes[0].id, "ss-1");
    assert.equal(pullJson.data.auditSessions[0].id, "as-1");

    const batchPost = await fetch(`${baseUrl}/api/batches`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: "b-2",
        productId: 12,
        batchNumber: "LOT-2",
        warehouseId: "wh-1",
        quantity: 33,
        billedQuantity: 30,
        freeQuantity: 3,
        scheme: "10+1",
      }),
    });
    assert.equal(batchPost.status, 200);
    const batchGet = await fetch(`${baseUrl}/api/batches`, { headers });
    const batchList = ((await batchGet.json()) as any).data as any[];
    const b2 = batchList.find((x) => x.id === "b-2");
    assert.ok(b2);
    assert.equal(b2.scheme, "10+1");
    assert.equal(b2.freeQuantity, 3);

    const auditPost = await fetch(`${baseUrl}/api/audits`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: 302,
        date: "2026-04-03",
        warehouseId: "wh-2",
        entries: [],
        adjusted: true,
      }),
    });
    assert.equal(auditPost.status, 201);
    const auditGet = await fetch(`${baseUrl}/api/audits`, { headers });
    const auditList = ((await auditGet.json()) as any).data as any[];
    const a302 = auditList.find((x) => Number(x.id) === 302);
    assert.ok(a302);
    assert.equal(a302.warehouseId, "wh-2");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
