import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import http from "node:http";

// Must run before importing server modules so IS_TEST_RUN / authConfig capture test settings.
process.env.MRWATER_TEST = "1";
process.env.API_AUTH_REQUIRED = "true";
process.env.APP_SESSION_SECRET = "test-session-secret-key-at-least-32-chars-long";
process.env.PIN_PEPPER = "test-pin-pepper-value";

// Minimal localStorage shim for browser modules running in Node
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

const serverAuth = await import("../server-auth");
const store = await import("../server/supabaseStore");
const { createSecurityAndAuthSetup } = await import("../server/authMiddleware");
const { registerSystemRoutes } = await import("../server/routes/systemRoutes");
const { registerSyncAndActivityRoutes } = await import("../server/routes/syncAndActivityRoutes");
const { registerSettingsWarehousesAuditsRoutes } = await import(
  "../server/routes/settingsWarehousesAuditsRoutes"
);
const { registerBillsAndDocNumbersRoutes } = await import(
  "../server/routes/billsAndDocNumbersRoutes"
);
const { registerTripsAndSalesmenRoutes } = await import(
  "../server/routes/tripsAndSalesmenRoutes"
);
const { registerCustomersSchemesPaymentsRoutes } = await import(
  "../server/routes/customersSchemesPaymentsRoutes"
);
const { registerGrnsInventoryProductsRoutes } = await import(
  "../server/routes/grnsInventoryProductsRoutes"
);
const { registerCollectionsRoutes } = await import("../server/routes/collectionsRoutes");

const authFetch = await import("../src/lib/authFetch");
const supabaseMod = await import("../src/lib/supabase");

function createTestApp() {
  const app = express();
  const setup = createSecurityAndAuthSetup();
  setup.applySecurityAndAuthMiddleware(app);
  registerSystemRoutes(app, setup.resolveAuth);
  registerSyncAndActivityRoutes(app, setup.resolveAuth);
  registerSettingsWarehousesAuditsRoutes(app);
  registerBillsAndDocNumbersRoutes(app);
  registerTripsAndSalesmenRoutes(app, {
    authCfg: setup.authCfg,
    activeCache: setup.activeCache,
    findSalesmanRecord: setup.findSalesmanRecord,
    upgradePinHash: setup.upgradePinHash,
  });
  registerCustomersSchemesPaymentsRoutes(app);
  registerGrnsInventoryProductsRoutes(app);
  registerCollectionsRoutes(app);
  return app;
}

async function seedCollections() {
  for (const k of Object.keys(store.inMemoryCollections)) {
    delete store.inMemoryCollections[k];
  }
  const s1Hash = await serverAuth.hashPinSecure("1234", process.env.PIN_PEPPER!);
  const s2Hash = await serverAuth.hashPinSecure("5678", process.env.PIN_PEPPER!);
  await store.setCollectionData("salesmen", [
    {
      id: "sm-1",
      name: "Ravi Kumar",
      phone: "9876543210",
      pin_hash: s1Hash,
      pinHash: s1Hash,
      active: true,
      defaultVehicle: "KA01AB1234",
      createdAt: "2026-11-01T08:00:00.000Z",
      updatedAt: "2026-11-01T08:00:00.000Z",
    },
    {
      id: "sm-2",
      name: "Suresh Babu",
      phone: "9988776655",
      pin_hash: s2Hash,
      pinHash: s2Hash,
      active: true,
      defaultVehicle: "KA01XY9999",
      createdAt: "2026-11-01T08:00:00.000Z",
      updatedAt: "2026-11-01T08:00:00.000Z",
    },
  ]);
  await store.setCollectionData("orders", [
    {
      id: 101,
      docNo: "INV-101",
      date: "2026-11-20",
      retailer: "Alpha Store",
      customerId: "cust-1",
      phone: "9000000001",
      salesmanId: "sm-1",
      salesman: "Ravi Kumar",
      items: [],
      subtotal: 500,
      cgst: 45,
      sgst: 45,
      total: 590,
      discount: 0,
      amountPaid: 0,
      updatedAt: "2026-11-20T10:00:00.000Z",
    },
    {
      id: 102,
      docNo: "INV-102",
      date: "2026-11-20",
      retailer: "Beta Mart",
      customerId: "cust-2",
      phone: "9000000002",
      salesmanId: "sm-2",
      salesman: "Suresh Babu",
      items: [],
      subtotal: 800,
      cgst: 72,
      sgst: 72,
      total: 944,
      discount: 0,
      amountPaid: 0,
      updatedAt: "2026-11-20T10:05:00.000Z",
    },
  ]);
  await store.setCollectionData("trips", [
    {
      id: 201,
      vehicle: "KA01AB1234",
      salesmanId: "sm-1",
      salesman: "Ravi Kumar",
      date: "2026-11-20",
      warehouseId: "wh-1",
      loaded: { "1": 10 },
      returned: {},
      billIds: [101],
      status: "out",
      updatedAt: "2026-11-20T09:00:00.000Z",
    },
    {
      id: 202,
      vehicle: "KA01XY9999",
      salesmanId: "sm-2",
      salesman: "Suresh Babu",
      date: "2026-11-20",
      warehouseId: "wh-1",
      loaded: { "1": 20 },
      returned: {},
      billIds: [102],
      status: "out",
      updatedAt: "2026-11-20T09:05:00.000Z",
    },
  ]);
  await store.setCollectionData("payments", [
    {
      id: "pay-1",
      billId: 101,
      customerId: "cust-1",
      customerName: "Alpha Store",
      salesmanId: "sm-1",
      amount: 300,
      mode: "cash",
      createdAt: "2026-11-20T11:00:00.000Z",
    },
    {
      id: "pay-2",
      billId: 102,
      customerId: "cust-2",
      customerName: "Beta Mart",
      salesmanId: "sm-2",
      amount: 400,
      mode: "upi",
      createdAt: "2026-11-20T11:05:00.000Z",
    },
  ]);
  await store.setCollectionData("customers", [
    { id: "cust-1", name: "Alpha Store", phone: "9000000001", createdBySalesmanId: "sm-1" },
    { id: "cust-2", name: "Beta Mart", phone: "9000000002" },
  ]);
  await store.setCollectionData("inward_grns", [
    { id: "grn-1", grnNumber: "GRN-01", invoiceNo: "SUP-1", supplierName: "Supplier A", items: [] },
  ]);
  await store.setCollectionData("business_expenses", [
    { id: "exp-1", category: "fuel", amount: 1500, date: "2026-11-20" },
  ]);
  await store.setCollectionData("inventory_dispositions", [
    { id: "disp-1", dispositionType: "free_sample", productId: 1, warehouseId: "wh-1", quantity: 2, salesmanId: "sm-1", eventDate: "2026-11-20" },
    { id: "disp-2", dispositionType: "damage", productId: 1, warehouseId: "wh-1", quantity: 3, salesmanId: "sm-2", eventDate: "2026-11-20" },
  ]);
  await store.setCollectionData("activity_logs", [
    {
      id: "act-1",
      at: "2026-11-20T11:00:00.000Z",
      entityType: "bill",
      entityId: "101",
      action: "create",
      actorName: "Ravi Kumar",
      actorRole: "salesman",
      summary: "Created INV-101",
    },
    {
      id: "act-2",
      at: "2026-11-20T11:05:00.000Z",
      entityType: "bill",
      entityId: "102",
      action: "create",
      actorName: "Suresh Babu",
      actorRole: "salesman",
      summary: "Created INV-102",
    },
  ]);
  await store.setCollectionData("deleted_records", [
    { kind: "expense", id: "exp-old", name: "Secret Expense", deletedAt: "2026-11-19T00:00:00.000Z" },
    { kind: "customer", id: "cust-foreign", name: "Secret Beta Customer", deletedAt: "2026-11-19T00:00:00.000Z" },
    { kind: "payment", id: "pay-del-1", name: "Alpha Store", deletedAt: "2026-11-19T00:00:00.000Z" },
  ]);
  await store.setCollectionData("deleted_bill_ids", ["999"]);
  await store.setCollectionData("products", [
    { id: 1, name: "AQUA 500ML CASE", category: "water", volume: 500, pack: "24x500ml", cost: 100, retail: 150, wholesale: 130, opening: 50 },
  ]);
  await store.setCollectionData("warehouses", [
    { id: "wh-1", name: "Main Depot", code: "WH-01" },
  ]);
}

test("proxyMode flag defaults to false and toggles cleanly for tests", () => {
  supabaseMod.setServerProxyModeForTest(null);
  assert.equal(supabaseMod.isServerProxyMode(), false);
  supabaseMod.setServerProxyModeForTest(true);
  assert.equal(supabaseMod.isServerProxyMode(), true);
  assert.equal(supabaseMod.getSupabaseClient(), null);
  supabaseMod.setServerProxyModeForTest(false);
  assert.equal(supabaseMod.isServerProxyMode(), false);
});

test("server-auth policy and salesman response filters isolate owner & peer data", () => {
  assert.equal(serverAuth.salesmanPolicy("GET", "/api/sync/probe").allow, true);
  assert.equal(serverAuth.salesmanPolicy("GET", "/api/sync/pull").allow, true);
  assert.equal(serverAuth.salesmanPolicy("GET", "/api/sync/tombstones").allow, true);
  assert.equal(serverAuth.salesmanPolicy("GET", "/api/sync/events").allow, true);
  assert.equal(serverAuth.salesmanPolicy("POST", "/api/sync/signal").allow, true);
  assert.equal(serverAuth.salesmanPolicy("GET", "/api/activity-logs").allow, true);
  assert.equal(serverAuth.salesmanPolicy("POST", "/api/activity-logs").allow, true);

  assert.equal(serverAuth.salesmanPolicy("GET", "/api/supabase/health").allow, false);
  assert.equal(serverAuth.salesmanPolicy("POST", "/api/sync/push").allow, false);
  assert.equal(serverAuth.salesmanPolicy("POST", "/api/sync/deletions").allow, false);
  assert.equal(serverAuth.salesmanPolicy("GET", "/api/collections/business_expenses").allow, false);
  assert.equal(serverAuth.salesmanPolicy("GET", "/api/grns").allow, false);

  const ctx = {
    sid: "sm-1",
    name: "Ravi Kumar",
    bills: [{ id: 101, salesmanId: "sm-1", customerId: "cust-1", retailer: "Alpha Store" }],
    trips: [{ id: 201, salesmanId: "sm-1" }],
    payments: [{ id: "pay-1", billId: 101, customerId: "cust-1", salesmanId: "sm-1" }],
    customers: [{ id: "cust-1", name: "Alpha Store", createdBySalesmanId: "sm-1" }],
  };

  const pulled = serverAuth.filterSalesmanResponse(
    "sync-pull",
    {
      data: {
        grns: [{ id: "grn-1" }],
        audits: [{ id: 1 }],
        bills: [
          { id: 101, salesmanId: "sm-1" },
          { id: 102, salesmanId: "sm-2" },
        ],
        salesmen: [
          { id: "sm-1", name: "Ravi", pin_hash: "secret1" },
          { id: "sm-2", name: "Suresh", pin_hash: "secret2" },
        ],
      },
    },
    ctx,
  );
  assert.deepEqual(pulled.data.grns, []);
  assert.deepEqual(pulled.data.audits, []);
  assert.deepEqual(pulled.data.bills.map((b: any) => b.id), [101]);
  assert.equal(pulled.data.salesmen.length, 1);
  assert.equal(pulled.data.salesmen[0].id, "sm-1");
  assert.equal(pulled.data.salesmen[0].pinHash, "");
  assert.equal("pin_hash" in pulled.data.salesmen[0], false);

  const tombs = serverAuth.filterSalesmanResponse(
    "sync-tombstones",
    {
      data: {
        bills: ["1"],
        grns: ["g1"],
        trips: ["t1"],
        deletions: [
          { kind: "expense", id: "e1", name: "Fuel" },
          { kind: "customer", id: "cust-other", name: "Private Shop" },
          { kind: "customer", id: "cust-1", name: "Alpha Store" },
        ],
      },
    },
    ctx,
  );
  assert.deepEqual(tombs.data.grns, []);
  assert.equal(tombs.data.deletions.length, 2);
  assert.equal(tombs.data.deletions[0].id, "cust-other");
  assert.equal(tombs.data.deletions[0].name, undefined);
  assert.equal(tombs.data.deletions[1].name, "Alpha Store");
});

test("Express routes + client proxy wrappers work end-to-end with strict role enforcement and PIN preservation", async () => {
  await seedCollections();
  const app = createTestApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address() as any;
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  const secret = process.env.APP_SESSION_SECRET!;
  const adminToken = serverAuth.signToken({ r: "admin", n: "Owner" }, secret);
  const salesmanToken = serverAuth.signToken({ r: "salesman", sid: "sm-1", n: "Ravi Kumar" }, secret);

  const originalFetch = globalThis.fetch;
  try {
    // 1. Unauthenticated access rejected
    const unauth = await originalFetch(`${baseUrl}/api/sync/pull`);
    assert.equal(unauth.status, 401);

    // 2. Salesman enforcement on server routes
    const sHeaders = { Authorization: `Bearer ${salesmanToken}`, "Content-Type": "application/json" };
    assert.equal((await originalFetch(`${baseUrl}/api/supabase/health`, { headers: sHeaders })).status, 403);
    assert.equal((await originalFetch(`${baseUrl}/api/sync/push`, { method: "POST", headers: sHeaders, body: "{}" })).status, 403);
    assert.equal((await originalFetch(`${baseUrl}/api/sync/deletions`, { method: "POST", headers: sHeaders, body: "{}" })).status, 403);
    assert.equal((await originalFetch(`${baseUrl}/api/collections/business_expenses`, { headers: sHeaders })).status, 403);

    const smProbe = await (await originalFetch(`${baseUrl}/api/sync/probe`, { headers: sHeaders })).json();
    assert.equal(smProbe.success, true);
    assert.equal(typeof smProbe.data, "string");

    const smList = await (await originalFetch(`${baseUrl}/api/salesmen`, { headers: sHeaders })).json();
    assert.equal(smList.data.length, 1);
    assert.equal(smList.data[0].id, "sm-1");
    assert.equal(smList.data[0].pinHash, "");
    assert.equal(smList.data[0].hasPin, true);
    assert.equal("pin_hash" in smList.data[0], false);

    const smPull = await (await originalFetch(`${baseUrl}/api/sync/pull`, { headers: sHeaders })).json();
    assert.deepEqual(smPull.data.grns, []);
    assert.deepEqual(smPull.data.bills.map((b: any) => b.id), [101]);
    assert.deepEqual(smPull.data.trips.map((t: any) => t.id), [201]);
    assert.deepEqual(smPull.data.payments.map((p: any) => p.id), ["pay-1"]);
    assert.deepEqual(smPull.data.inventoryDispositions.map((d: any) => d.id), ["disp-1"]);
    assert.deepEqual(smPull.data.customers.map((c: any) => c.id), ["cust-1"]);

    const smTombs = await (await originalFetch(`${baseUrl}/api/sync/tombstones`, { headers: sHeaders })).json();
    assert.equal(smTombs.data.deletions.some((d: any) => d.kind === "expense"), false);

    // Salesman activity log: allowed for own record, denied for sm-2's bill
    const badAct = await originalFetch(`${baseUrl}/api/activity-logs`, {
      method: "POST",
      headers: sHeaders,
      body: JSON.stringify({
        id: "act-bad",
        entityType: "bill",
        entityId: "102",
        action: "edit",
        summary: "Try edit other bill",
      }),
    });
    assert.equal(badAct.status, 403);

    const goodAct = await originalFetch(`${baseUrl}/api/activity-logs`, {
      method: "POST",
      headers: sHeaders,
      body: JSON.stringify({
        id: "act-good",
        at: "2026-11-20T12:00:00.000Z",
        entityType: "bill",
        entityId: "101",
        action: "edit",
        actorName: "Spoofed Admin",
        actorRole: "admin",
        summary: "Updated own bill",
      }),
    });
    assert.equal(goodAct.status, 201);
    const smActs = await (await originalFetch(`${baseUrl}/api/activity-logs`, { headers: sHeaders })).json();
    assert.equal(smActs.data.some((a: any) => a.id === "act-2"), false);
    assert.equal(smActs.data.find((a: any) => a.id === "act-good")?.actorRole, "salesman");

    // 3. Client proxy wrappers through mocked relative fetch -> live test server as owner
    supabaseMod.setServerProxyModeForTest(true);
    authFetch.setApiSession(adminToken, Date.now() + 3600_000);
    globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const target =
        typeof input === "string" && input.startsWith("/") ? `${baseUrl}${input}` : input;
      return originalFetch(target as any, init);
    };

    const health = await supabaseMod.testSupabaseConnection();
    assert.equal(health.projectRef, "server-proxy");

    const salesmen = await supabaseMod.fetchSalesmenFromSupabase();
    assert.equal(salesmen.length, 2);
    assert.equal(salesmen[0].pinHash, "");
    assert.equal(salesmen[0].hasPin, true);

    const pushed = await supabaseMod.pushLedgerToSupabase({
      warehouses: [{ id: "wh-1", name: "Main Depot", code: "WH-01", location: "", manager: "", phone: "", capacityCases: 0, isDefault: true, notes: "" }],
      products: [{ id: 1, name: "AQUA 500ML CASE", category: "water", volume: 500, pack: "24x500ml", expiry: "", cost: 100, retail: 150, wholesale: 130, opening: 50 }],
      inventoryBatches: [],
      grns: [],
      promotions: [],
      bills: [
        { id: 999, retailer: "Deleted Ghost", phone: "", date: "2026-11-20", subtotal: 10, cgst: 0, sgst: 0, total: 10, discount: 0, amountPaid: 0, items: [] } as any,
        { id: 101, retailer: "Alpha Store", phone: "9000000001", date: "2026-11-20", subtotal: 500, cgst: 45, sgst: 45, total: 590, discount: 0, amountPaid: 0, items: [] } as any,
      ],
      trips: [],
      audits: [],
      orgProfile: { name: "Hydrate Hub", phone: "9876543210", email: "owner@example.com", address: "", gstin: "", state: "Karnataka", stateCode: "29" } as any,
      billingSettings: { invoicePrefix: "INV", numberingMode: "central" } as any,
      salesmen: [
        { id: "sm-1", name: "Ravi Kumar Updated", phone: "9876543210", pinHash: "", active: true, defaultVehicle: "KA01AB1234", createdAt: "", updatedAt: "" },
      ],
    });
    assert.equal(pushed.success, true);

    // Server must preserve stored pin_hash when pushLedger sends pinHash: "" and drop tombstoned bill #999
    const storedSalesmen = await store.getCollectionData("salesmen");
    const sm1Stored = storedSalesmen.find((s: any) => s.id === "sm-1");
    assert.equal(sm1Stored.name, "Ravi Kumar Updated");
    assert.ok(String(sm1Stored.pin_hash || "").startsWith("scrypt$"), "Stored PIN hash must be preserved");
    const storedBills = await store.getCollectionData("orders");
    assert.equal(storedBills.some((b: any) => b.id === 999), false, "Tombstoned bill 999 must be dropped");

    const pulledOwner = await supabaseMod.pullLedgerFromSupabase();
    assert.ok(pulledOwner);
    assert.equal(pulledOwner.salesmen?.every((s) => s.pinHash === ""), true);

    // Product create & delete via proxy
    await supabaseMod.pushProductToSupabase({
      id: 77,
      name: "SPARKLING WATER 1L",
      category: "water",
      volume: 1000,
      pack: "12x1L",
      expiry: "",
      opening: 10,
      cost: 200,
      retail: 300,
      wholesale: 260,
    });
    assert.equal((await store.getCollectionData("products")).some((p: any) => Number(p.id) === 77), true);
    await supabaseMod.deleteProductFromSupabase(77);
    assert.equal((await store.getCollectionData("products")).some((p: any) => Number(p.id) === 77), false);

    // Inventory disposition upsert & delete via proxy
    await supabaseMod.pushInventoryDispositionToSupabase({
      id: "disp-99",
      dispositionType: "free_sample",
      productId: 1,
      warehouseId: "wh-1",
      quantity: 4,
      unit: "case",
      costPerUnit: 100,
      costValue: 400,
      compensationStatus: "not_applicable",
      reason: "Demo",
      eventDate: "2026-11-23",
      stockApplied: true,
      createdAt: "2026-11-23T00:00:00.000Z",
      updatedAt: "2026-11-23T00:00:00.000Z",
    });
    const fetchedDisps = await supabaseMod.fetchInventoryDispositionsFromSupabase();
    assert.equal(fetchedDisps.some((d) => d.id === "disp-99"), true);
    await supabaseMod.deleteInventoryDispositionFromSupabase("disp-99");
    assert.equal(
      (await supabaseMod.fetchInventoryDispositionsFromSupabase()).some((d) => d.id === "disp-99"),
      false,
    );

    // Activity logs batch & pull via proxy
    const actSaved = await supabaseMod.pushActivityLogsBatchToSupabase([
      {
        id: "act-owner-1",
        at: "2026-11-23T01:00:00.000Z",
        entityType: "settings",
        entityId: "default",
        action: "edit",
        actorName: "Owner",
        actorRole: "admin",
        summary: "Updated billing settings",
      },
    ]);
    assert.equal(actSaved, true);
    const ownerActs = await supabaseMod.pullActivityLogsFromSupabase();
    assert.equal(ownerActs.some((a) => a.id === "act-owner-1"), true);

    // Payment soft delete & deletion log record
    await supabaseMod.softDeletePaymentsInSupabase(["pay-1"], "Owner", "Duplicate receipt");
    const paysAfter = await store.getCollectionData("payments");
    assert.equal(paysAfter.some((p: any) => p.id === "pay-1"), false);
    const tombAfter = await supabaseMod.pullDeletionLogFromSupabase();
    assert.equal(
      tombAfter.some((r) => r.kind === "payment" && r.id === "pay-1" && r.reason === "Duplicate receipt"),
      true,
    );

    // Inward GRN push & edit log
    const inwardOk = await supabaseMod.pushInwardInvoiceToSupabase({
      grn: {
        id: "grn-2",
        grnNumber: "GRN-02",
        invoiceNo: "SUP-2",
        supplierName: "Supplier B",
        inwardDate: "2026-11-23",
        warehouseId: "wh-1",
        warehouseName: "Main Depot",
        items: [],
        totalBilledQty: 0,
        totalFreeQty: 0,
        totalPaidQty: 0,
        totalReceivedQty: 0,
        totalTaxable: 0,
        totalCgst: 0,
        totalSgst: 0,
        totalTax: 0,
        grandTotal: 0,
        createdAt: "2026-11-23T00:00:00.000Z",
        updatedAt: "2026-11-23T00:00:00.000Z",
      },
      allGrns: [],
      products: [],
      inventoryBatches: [],
    });
    assert.equal(inwardOk.success, true);
    await supabaseMod.pushGrnEditLogToSupabase(
      { id: "grn-2", grnNumber: "GRN-02", invoiceNo: "SUP-2", supplierName: "Supplier B", editHistory: [{ id: "e1" }] } as any,
      { id: "e1", at: "2026-11-23T02:00:00.000Z", by: "Owner", reason: "Fix qty", changes: [] },
    );
    const savedGrn2 = (await store.getCollectionData("inward_grns")).find((g: any) => g.id === "grn-2");
    assert.equal(savedGrn2?.editHistory?.length, 1);

    // Salesman delete via proxy
    const delSm = await supabaseMod.deleteSalesmanFromSupabase("sm-2");
    assert.equal(delSm.success, true);
    assert.equal((await store.getCollectionData("salesmen")).some((s: any) => s.id === "sm-2"), false);

    // Direct Supabase Auth and direct PIN fallback must remain disabled in proxy mode
    const adminDirect = await supabaseMod.signInAdminSupabase("owner@example.com", "secret");
    assert.equal(adminDirect.success, false);
    globalThis.fetch = async () => {
      throw new Error("Server offline");
    };
    const pinFail = await supabaseMod.verifySalesmanPinSupabase("9876543210", "1234");
    assert.equal(pinFail.success, false);
    assert.match(pinFail.error || "", /Could not reach the server/i);
  } finally {
    globalThis.fetch = originalFetch;
    supabaseMod.setServerProxyModeForTest(null);
    authFetch.setApiSession(null);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
