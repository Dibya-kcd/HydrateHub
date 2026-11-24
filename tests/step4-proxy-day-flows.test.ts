import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import http from "node:http";

// Configure test env BEFORE importing server/auth modules
process.env.MRWATER_TEST = "1";
process.env.API_AUTH_REQUIRED = "true";
process.env.APP_SESSION_SECRET = "test-session-secret-key-at-least-32-chars-long";
process.env.PIN_PEPPER = "test-pin-pepper-value";
process.env.ADMIN_PASSWORD = "stage-owner-secret-password";

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

function buildTestServer() {
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

async function seedStagingData() {
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

  await store.setCollectionData("warehouses", [
    { id: "wh-1", name: "Main Depot", code: "WH-01", isDefault: true, updatedAt: "2026-11-20T08:00:00.000Z" },
  ]);

  await store.setCollectionData("products", [
    {
      id: 1,
      name: "AQUA 500ML CASE",
      category: "water",
      volume: 500,
      pack: "24x500ml",
      expiry: "",
      opening: 100,
      cost: 100,
      retail: 150,
      wholesale: 130,
      hsn: "22011010",
      gstRate: 18,
    },
  ]);

  await store.setCollectionData("inventory_batches", [
    {
      id: "batch-1",
      productId: 1,
      batchNumber: "B001",
      warehouseId: "wh-1",
      quantity: 100,
      costPrice: 100,
      mrp: 150,
    },
  ]);

  await store.setCollectionData("schemes", [
    {
      id: 10,
      name: "Buy 10 Get 1",
      type: "bogo",
      buyQty: 10,
      freeQty: 1,
      percent: 0,
      flatPerCase: 0,
      productIds: [1],
      isActive: true,
    },
  ]);

  await store.setCollectionData("customers", [
    { id: "cust-1", name: "Alpha Store", phone: "9000000001", createdBySalesmanId: "sm-1" },
    { id: "cust-2", name: "Beta Mart", phone: "9000000002", createdBySalesmanId: "sm-2" },
  ]);

  await store.setCollectionData("orders", [
    {
      id: 101,
      docNo: "INV-101",
      date: "2026-11-23",
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
      updatedAt: "2026-11-23T08:00:00.000Z",
    },
    {
      id: 102,
      docNo: "INV-102",
      date: "2026-11-23",
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
      updatedAt: "2026-11-23T08:05:00.000Z",
    },
  ]);

  await store.setCollectionData("trips", [
    {
      id: 201,
      vehicle: "KA01AB1234",
      salesmanId: "sm-1",
      salesman: "Ravi Kumar",
      date: "2026-11-23",
      warehouseId: "wh-1",
      loaded: { "1": 15 },
      returned: {},
      billIds: [101],
      status: "out",
      updatedAt: "2026-11-23T08:00:00.000Z",
    },
    {
      id: 202,
      vehicle: "KA01XY9999",
      salesmanId: "sm-2",
      salesman: "Suresh Babu",
      date: "2026-11-23",
      warehouseId: "wh-1",
      loaded: { "1": 25 },
      returned: {},
      billIds: [102],
      status: "out",
      updatedAt: "2026-11-23T08:05:00.000Z",
    },
  ]);

  await store.setCollectionData("payments", [
    {
      id: "pay-1",
      billId: 101,
      customerId: "cust-1",
      customerName: "Alpha Store",
      salesmanId: "sm-1",
      amount: 200,
      mode: "cash",
      createdAt: "2026-11-23T08:30:00.000Z",
    },
    {
      id: "pay-2",
      billId: 102,
      customerId: "cust-2",
      customerName: "Beta Mart",
      salesmanId: "sm-2",
      amount: 500,
      mode: "upi",
      createdAt: "2026-11-23T08:35:00.000Z",
    },
  ]);

  await store.setCollectionData("inward_grns", [
    { id: "grn-1", grnNumber: "GRN-01", invoiceNo: "SUP-1", supplierName: "Distributor", items: [] },
  ]);
  await store.setCollectionData("audits", [{ id: 1, date: "2026-11-22", entries: [], adjusted: false }]);
  await store.setCollectionData("business_expenses", [
    { id: "exp-1", category: "fuel", amount: 1800, date: "2026-11-23" },
  ]);
  await store.setCollectionData("inventory_dispositions", [
    {
      id: "disp-1",
      dispositionType: "free_sample",
      productId: 1,
      warehouseId: "wh-1",
      quantity: 2,
      salesmanId: "sm-1",
      eventDate: "2026-11-23",
    },
    {
      id: "disp-2",
      dispositionType: "damage",
      productId: 1,
      warehouseId: "wh-1",
      quantity: 3,
      salesmanId: "sm-2",
      eventDate: "2026-11-23",
    },
  ]);
  await store.setCollectionData("deleted_bill_ids", ["999"]);
  await store.setCollectionData("deleted_records", [
    { kind: "expense", id: "exp-old", name: "Owner Secret Expense", deletedAt: "2026-11-22T00:00:00.000Z" },
    { kind: "customer", id: "cust-secret", name: "Beta Private Shop", deletedAt: "2026-11-22T00:00:00.000Z" },
    { kind: "payment", id: "pay-del-1", name: "Alpha Store", deletedAt: "2026-11-22T00:00:00.000Z" },
  ]);
  await store.setCollectionData("billing_settings", {
    invoicePrefix: "INV",
    numberingMode: "central",
  });
  await store.setCollectionData("organization_profile", {
    name: "Hydrate Hub Staging Depot",
    phone: "9800000000",
    email: "owner@staging.local",
    address: "Bengaluru",
    gstin: "29ABCDE1234F1Z5",
    state: "Karnataka",
    stateCode: "29",
  });
}

test("Step 4A: Full Salesman Day with proxy flag ON issues zero direct Supabase calls and enforces isolation", async () => {
  await seedStagingData();
  const app = buildTestServer();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address() as any;
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  const outboundUrls: string[] = [];
  const originalFetch = globalThis.fetch;

  supabaseMod.setServerProxyModeForTest(true);
  authFetch.setApiSession(null);
  supabaseMod.resetCloudReadCaches();

  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    outboundUrls.push(rawUrl);
    if (rawUrl.includes("supabase.co")) {
      throw new Error(`Firewall violation: browser attempted direct Supabase call to ${rawUrl}`);
    }
    const target = typeof input === "string" && input.startsWith("/") ? `${baseUrl}${input}` : input;
    return originalFetch(target as any, init);
  };

  try {
    // Direct browser Supabase client must be disabled
    assert.equal(supabaseMod.getSupabaseClient(), null);

    // 1. Wrong PIN is rejected
    const badLogin = await supabaseMod.verifySalesmanPinSupabase("9876543210", "0000");
    assert.equal(badLogin.success, false);
    assert.equal(authFetch.readApiSession(), null);

    // 2. Valid salesman sign-in stores session and strips pinHash
    const goodLogin = await supabaseMod.verifySalesmanPinSupabase("9876543210", "1234");
    assert.equal(goodLogin.success, true);
    assert.equal(goodLogin.salesman?.id, "sm-1");
    assert.equal(goodLogin.salesman?.pinHash, "");
    assert.equal(goodLogin.salesman?.hasPin, true);
    assert.ok(authFetch.readApiSession()?.token);

    // 3. Change probe and full pull
    const fp = await supabaseMod.probeCloudChanges();
    assert.equal(typeof fp, "string");
    assert.ok(fp && fp.length > 4);

    const ledger = await supabaseMod.pullLedgerFromSupabase();
    assert.ok(ledger);
    assert.equal(ledger.products.length, 1);
    assert.equal(ledger.warehouses.length, 1);
    assert.equal(ledger.grns?.length ?? 0, 0, "Salesman must receive zero GRNs");
    assert.equal(ledger.audits?.length ?? 0, 0, "Salesman must receive zero stock audits");
    assert.deepEqual(ledger.bills.map((b) => b.id), [101]);
    assert.deepEqual(ledger.trips.map((t) => t.id), [201]);
    assert.deepEqual(ledger.payments?.map((p) => p.id), ["pay-1"]);
    assert.deepEqual(ledger.customers?.map((c) => c.id), ["cust-1"]);
    assert.deepEqual(ledger.salesmen?.map((s) => s.id), ["sm-1"]);
    assert.equal(ledger.salesmen?.[0]?.pinHash, "");

    // 4. Tombstones & deletion log unwrap cleanly and exclude confidential owner/peer data
    const tombs = await supabaseMod.pullTombstonesFromSupabase();
    assert.ok(tombs);
    assert.equal(tombs.bills.has("999"), true);
    assert.equal(tombs.grns.size, 0);

    const delLog = await supabaseMod.pullDeletionLogFromSupabase();
    assert.equal(delLog.some((d) => d.kind === "expense"), false);
    const foreignDel = delLog.find((d) => d.id === "cust-secret");
    assert.equal(foreignDel?.name, undefined, "Foreign deleted customer name must be stripped");

    // 5. Reserve & release document number
    const resNum = await supabaseMod.proxyFetch<{ success: boolean; sequence: string; number: number }>(
      "/api/doc-numbers/reserve",
      {
        method: "POST",
        body: JSON.stringify({ sequence: "bill", deviceId: "phone-ravi", floor: 100 }),
      },
    );
    assert.equal(resNum.ok, true, `reserve failed: ${JSON.stringify(resNum)}`);
    const reservedNo = Number(resNum.data?.number);
    assert.ok(reservedNo > 100);

    const relNum = await supabaseMod.proxyFetch("/api/doc-numbers/release", {
      method: "POST",
      body: JSON.stringify({ sequence: "bill", deviceId: "phone-ravi" }),
    });
    assert.equal(relNum.ok, true, `release failed: ${JSON.stringify(relNum)}`);

    // 6. Add new customer (limits zeroed & createdBySalesmanId stamped); reject editing existing customer
    const addCust = await supabaseMod.proxyFetch<{ success: boolean; data: any[] }>("/api/customers", {
      method: "POST",
      body: JSON.stringify({
        id: "cust-new-sm1",
        name: "Ganga Corner Store",
        phone: "9111111111",
        creditLimit: 50000,
        openingBalance: 12000,
      }),
    });
    assert.equal(addCust.ok, true, `addCust failed: ${JSON.stringify(addCust)}`);
    const savedNewCust = (await store.getCollectionData("customers")).find((c: any) => c.id === "cust-new-sm1");
    assert.equal(savedNewCust?.creditLimit, 0);
    assert.equal(savedNewCust?.openingBalance, 0);
    assert.equal(savedNewCust?.createdBySalesmanId, "sm-1");

    const editExistingCust = await supabaseMod.proxyFetch("/api/customers", {
      method: "POST",
      body: JSON.stringify({ id: "cust-2", name: "Hacked Beta Mart" }),
    });
    assert.equal(editExistingCust.ok, false);
    assert.equal(editExistingCust.status, 403);

    // 7. Create bill on own trip, record payment + payment history, update trip draft returns
    const createBill = await supabaseMod.pushBillToSupabase({
      id: 105,
      docNo: "INV-105",
      date: "2026-11-23",
      retailer: "Ganga Corner Store",
      customerId: "cust-new-sm1",
      phone: "9111111111",
      salesmanId: "sm-2", // Spoof attempt: server must force sm-1!
      salesman: "Ravi Kumar",
      items: [],
      subtotal: 300,
      cgst: 27,
      sgst: 27,
      total: 354,
      discount: 0,
      amountPaid: 0,
      returns: [],
    } as any);
    assert.equal(createBill.success, true);
    const saved105 = (await store.getCollectionData("orders")).find((b: any) => b.id === 105);
    assert.equal(saved105?.salesmanId, "sm-1", "Server must stamp caller salesmanId");

    // Attempt to tamper with sm-2's bill #102 must return 403
    const tamperBill = await supabaseMod.pushBillToSupabase({
      id: 102,
      date: "2026-11-23",
      retailer: "Beta Mart",
      items: [],
      subtotal: 1,
      cgst: 0,
      sgst: 0,
      total: 1,
      discount: 0,
      amountPaid: 0,
      returns: [],
    } as any);
    assert.equal(tamperBill.success, false);

    // Record payment via proxy
    await supabaseMod.pushPaymentsToSupabase([
      {
        id: "pay-sm1-new",
        billId: 105,
        customerId: "cust-new-sm1",
        customerName: "Ganga Corner Store",
        salesmanId: "sm-1",
        amount: 354,
        mode: "cash",
        createdAt: "2026-11-23T10:00:00.000Z",
      },
    ]);
    // Verify sm-2's pay-2 is NOT wiped!
    const allPaysAfter = await store.getCollectionData("payments");
    assert.equal(allPaysAfter.some((p: any) => p.id === "pay-2"), true);
    assert.equal(allPaysAfter.some((p: any) => p.id === "pay-sm1-new"), true);

    const payBillRes = await supabaseMod.proxyFetch("/api/bills/105/payment", {
      method: "POST",
      body: JSON.stringify({ amountPaid: 354, expectedAmountPaid: 0 }),
    });
    assert.equal(payBillRes.ok, true);

    const payPeerBillRes = await supabaseMod.proxyFetch("/api/bills/102/payment", {
      method: "POST",
      body: JSON.stringify({ amountPaid: 100 }),
    });
    assert.equal(payPeerBillRes.status, 403);

    await supabaseMod.pushPaymentAuditEntryToSupabase({
      id: "pa-sm1-1",
      at: "2026-11-23T10:01:00.000Z",
      by: "Spoofed Admin",
      action: "add",
      billId: 105,
      paymentId: "pay-sm1-new",
      amount: 354,
      customerName: "Ganga Corner Store",
    });
    const smPayHistory = await supabaseMod.pullPaymentHistoryFromSupabase();
    assert.equal(smPayHistory.some((h) => h.id === "pa-sm1-1" && h.by === "Ravi Kumar"), true);

    // Update trip draft returns
    const tripRes = await supabaseMod.pushTripToSupabase({
      id: 201,
      vehicle: "KA01AB1234",
      salesmanId: "sm-1",
      salesman: "Ravi Kumar",
      date: "2026-11-23",
      warehouseId: "wh-1",
      loaded: { "1": 15 },
      returned: {},
      draftReturned: { "1": 2 },
      billIds: [101, 105],
      status: "out",
    } as any);
    assert.equal(tripRes.success, true);

    // 8. Inventory disposition PUT response MUST NOT leak sm-2's disp-2!
    const smDispositionsRes = await supabaseMod.proxyFetch<{ success: boolean; data: any[] }>(
      "/api/collections/inventory_dispositions",
      {
        method: "PUT",
        body: JSON.stringify({
          data: [
            {
              id: "disp-sm1-new",
              dispositionType: "damage",
              productId: 1,
              warehouseId: "wh-1",
              quantity: 1,
              salesmanId: "sm-2", // Spoof attempt; server forces sm-1
              eventDate: "2026-11-23",
            },
          ],
        }),
      },
    );
    assert.equal(smDispositionsRes.ok, true);
    const returnedDispIds = (smDispositionsRes.data?.data || []).map((d: any) => d.id);
    assert.equal(returnedDispIds.includes("disp-sm1-new"), true);
    assert.equal(returnedDispIds.includes("disp-2"), false, "PUT response must never leak peer disposition disp-2");

    const smDispsFetched = await supabaseMod.fetchInventoryDispositionsFromSupabase();
    assert.equal(smDispsFetched.some((d) => d.id === "disp-2"), false);
    assert.equal(smDispsFetched.some((d) => d.id === "disp-sm1-new"), true);

    // 9. Activity log & sync signal with deviceId
    const actOk = await supabaseMod.pushActivityLogToSupabase({
      id: "act-sm1-day",
      at: "2026-11-23T11:00:00.000Z",
      entityType: "bill",
      entityId: "105",
      action: "create",
      actorName: "Ravi Kumar",
      actorRole: "salesman",
      summary: "Created INV-105",
    });
    assert.equal(actOk, true);

    const sigRes = await supabaseMod.proxyFetch("/api/sync/signal", {
      method: "POST",
      body: JSON.stringify({ fromDeviceId: "phone-ravi", deviceId: "phone-ravi", at: Date.now() }),
    });
    assert.equal(sigRes.ok, true);

    // 10. Owner-only APIs must fail with 403 for salesman
    const healthAsSm = await supabaseMod.testSupabaseConnection();
    assert.equal(healthAsSm.connected, false);
    assert.equal((await supabaseMod.proxyFetch("/api/grns")).status, 403);
    assert.equal((await supabaseMod.proxyFetch("/api/collections/business_expenses")).status, 403);
    assert.equal((await supabaseMod.proxyFetch("/api/salesmen", { method: "POST", body: "{}" })).status, 403);

    // Assert zero outbound calls touched supabase.co
    assert.equal(
      outboundUrls.some((u) => u.includes("supabase.co")),
      false,
      `Found direct Supabase URL calls: ${outboundUrls.filter((u) => u.includes("supabase.co")).join(", ")}`,
    );
  } finally {
    globalThis.fetch = originalFetch;
    supabaseMod.setServerProxyModeForTest(null);
    authFetch.setApiSession(null);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("Step 4B: Full Owner Day with proxy flag ON executes complete back-office lifecycle without Supabase calls", async () => {
  await seedStagingData();
  const app = buildTestServer();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address() as any;
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  const outboundUrls: string[] = [];
  const originalFetch = globalThis.fetch;

  supabaseMod.setServerProxyModeForTest(true);
  authFetch.setApiSession(null);
  supabaseMod.resetCloudReadCaches();

  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    outboundUrls.push(rawUrl);
    if (rawUrl.includes("supabase.co")) {
      throw new Error(`Firewall violation: browser attempted direct Supabase call to ${rawUrl}`);
    }
    const target = typeof input === "string" && input.startsWith("/") ? `${baseUrl}${input}` : input;
    return originalFetch(target as any, init);
  };

  try {
    assert.equal(supabaseMod.getSupabaseClient(), null);

    // 1. Admin login: wrong password rejected cleanly; valid password grants session
    const badAdmin = await authFetch.serverSignIn("admin", { password: "wrong-password" });
    assert.equal(badAdmin?.ok, false);
    assert.equal(authFetch.readApiSession(), null);

    const okAdmin = await authFetch.serverSignIn("admin", { password: process.env.ADMIN_PASSWORD! });
    assert.equal(okAdmin?.ok, true);
    assert.ok(authFetch.readApiSession()?.token);

    // 2. Health, probe, full pull
    const health = await supabaseMod.testSupabaseConnection();
    assert.equal(health.projectRef, "server-proxy");

    const fp = await supabaseMod.probeCloudChanges();
    assert.equal(typeof fp, "string");

    const ownerPull = await supabaseMod.pullLedgerFromSupabase();
    assert.ok(ownerPull);
    assert.equal(ownerPull.bills.length, 2);
    assert.equal(ownerPull.trips.length, 2);
    assert.equal(ownerPull.grns?.length, 1);
    assert.equal(ownerPull.audits?.length, 1);
    assert.equal(ownerPull.salesmen?.length, 2);
    assert.equal(ownerPull.salesmen?.every((s) => s.pinHash === ""), true);

    // 3. Products, Warehouses, Batches, Schemes CRUD
    await supabaseMod.pushProductToSupabase({
      id: 88,
      name: "ALKALINE 1L CASE",
      category: "water",
      volume: 1000,
      pack: "12x1L",
      expiry: "",
      opening: 25,
      cost: 220,
      retail: 320,
      wholesale: 280,
    });
    assert.equal((await store.getCollectionData("products")).some((p: any) => Number(p.id) === 88), true);

    await supabaseMod.pushWarehouseToSupabase({
      id: "wh-2",
      name: "South Godown",
      code: "WH-02",
      location: "Kormangala",
      manager: "Arun",
      phone: "9888888888",
      capacityCases: 500,
      isDefault: false,
      notes: "",
    });
    assert.equal((await store.getCollectionData("warehouses")).some((w: any) => w.id === "wh-2"), true);

    await supabaseMod.pushBatchToSupabase({
      id: "batch-2",
      productId: 88,
      batchNumber: "B-88",
      warehouseId: "wh-2",
      quantity: 25,
      costPrice: 220,
      mrp: 320,
    });
    assert.equal((await store.getCollectionData("inventory_batches")).some((b: any) => b.id === "batch-2"), true);

    await supabaseMod.pushPromotionToSupabase({
      id: 55,
      name: "Festive Flat 10",
      type: "flat",
      buyQty: 0,
      freeQty: 0,
      percent: 0,
      flatPerCase: 10,
      productIds: [88],
      isActive: true,
    });
    assert.equal((await store.getCollectionData("schemes")).some((s: any) => Number(s.id) === 55), true);

    // Clean up catalog entities
    await supabaseMod.deletePromotionFromSupabase(55);
    await supabaseMod.deleteBatchFromSupabase("batch-2");
    await supabaseMod.deleteWarehouseFromSupabase("wh-2");
    await supabaseMod.deleteProductFromSupabase(88);
    assert.equal((await store.getCollectionData("products")).some((p: any) => Number(p.id) === 88), false);

    // 4. Inward GRN + Edit Log + Delete
    const grnRes = await supabaseMod.pushInwardInvoiceToSupabase({
      grn: {
        id: "grn-owner-1",
        grnNumber: "GRN-100",
        invoiceNo: "SUP-100",
        supplierName: "PlantCo",
        inwardDate: "2026-11-23",
        warehouseId: "wh-1",
        warehouseName: "Main Depot",
        items: [],
        totalBilledQty: 10,
        totalFreeQty: 1,
        totalPaidQty: 10,
        totalReceivedQty: 11,
        totalTaxable: 1000,
        totalCgst: 90,
        totalSgst: 90,
        totalTax: 180,
        grandTotal: 1180,
        createdAt: "2026-11-23T09:00:00.000Z",
        updatedAt: "2026-11-23T09:00:00.000Z",
      },
      allGrns: [],
      products: [],
      inventoryBatches: [],
    });
    assert.equal(grnRes.success, true);
    await supabaseMod.pushGrnEditLogToSupabase(
      { id: "grn-owner-1", grnNumber: "GRN-100", invoiceNo: "SUP-100", supplierName: "PlantCo", editHistory: [{ id: "e1" }] } as any,
      { id: "e1", at: "2026-11-23T09:10:00.000Z", by: "Owner", reason: "Verified qty", changes: [] },
    );
    await supabaseMod.deleteGrnFromSupabase("grn-owner-1", []);
    assert.equal((await store.getCollectionData("inward_grns")).some((g: any) => g.id === "grn-owner-1"), false);

    // 5. Physical Audit, Smart Reconciliation & Ledger Entries + Supplier Schemes & Credit Notes
    await supabaseMod.pushAuditToSupabase({ id: 2, date: "2026-11-23", entries: [], adjusted: true });
    assert.equal((await store.getCollectionData("audits")).some((a: any) => a.id === 2), true);
    await supabaseMod.deleteAuditFromSupabase(2);

    await supabaseMod.pushAuditSessionToSupabase({
      id: "as-1",
      warehouseId: "wh-1",
      date: "2026-11-23",
      auditorName: "Owner",
      entries: [],
      createdAt: "2026-11-23T09:20:00.000Z",
      updatedAt: "2026-11-23T09:20:00.000Z",
    });
    await supabaseMod.pushReconciliationTransactionToSupabase({
      id: "rt-1",
      auditSessionId: "as-1",
      varianceEntryId: "ve-1",
      type: "shrinkage_writeoff",
      fromProductId: 1,
      quantity: 2,
      identifiedBy: "Owner",
      createdAt: "2026-11-23T09:25:00.000Z",
    });
    await supabaseMod.pushStockLedgerEntryToSupabase({
      id: "sle-1",
      productId: 1,
      warehouseId: "wh-1",
      quantity: -2,
      transactionType: "audit_reconciliation",
      referenceAuditSessionId: "as-1",
      referenceReconciliationId: "rt-1",
      reason: "Leakage",
      timestamp: "2026-11-23T09:25:00.000Z",
    });
    await supabaseMod.deleteAuditSessionFromSupabase("as-1");

    await supabaseMod.pushSupplierSchemeToSupabase({
      id: "ss-1",
      supplierName: "PlantCo",
      name: "Q4 Rebate",
      schemeType: "volume_rebate",
      productIds: [1],
      startDate: "2026-11-01",
      active: true,
      createdAt: "2026-11-23T09:30:00.000Z",
      updatedAt: "2026-11-23T09:30:00.000Z",
    });
    await supabaseMod.pushSupplierSchemeApplicationToSupabase({
      id: "ssa-1",
      schemeId: "ss-1",
      schemeType: "volume_rebate",
      grnId: "grn-1",
      grnLineId: "line-1",
      productId: 1,
      supplierName: "PlantCo",
      supplierInvoiceNo: "SUP-1",
      eligibleQuantity: 100,
      freeQuantity: 5,
      expectedBenefit: 500,
      createdAt: "2026-11-23T09:31:00.000Z",
    });
    await supabaseMod.pushSupplierCreditNoteToSupabase({
      id: "scn-1",
      supplierName: "PlantCo",
      schemeId: "ss-1",
      expectedAmount: 500,
      actualAmount: 500,
      status: "received",
      createdAt: "2026-11-23T09:32:00.000Z",
      updatedAt: "2026-11-23T09:32:00.000Z",
    });
    await supabaseMod.deleteSupplierCreditNoteFromSupabase("scn-1");
    await supabaseMod.deleteSupplierSchemeFromSupabase("ss-1");

    // 6. Business Expenses collection save & read
    const expSave = await supabaseMod.writeCollectionMerged(null, "business_expenses", [
      { id: "exp-1", category: "fuel", amount: 1800, date: "2026-11-23" },
      { id: "exp-2", category: "salary", amount: 15000, date: "2026-11-23" },
    ]);
    assert.equal(expSave.error, null);
    assert.equal((await store.getCollectionData("business_expenses")).length, 2);

    // 7. Staff CRUD: create salesman with PIN, verify hash stored cleanly and NEVER returned
    const createdSm = await supabaseMod.proxyFetch<{ success: boolean; data: any }>("/api/salesmen", {
      method: "POST",
      body: JSON.stringify({
        id: "sm-3",
        name: "Vikram Singh",
        phone: "9777777777",
        pin: "4321",
        active: true,
        defaultVehicle: "KA01CD5678",
      }),
    });
    assert.equal(createdSm.ok, true);
    assert.equal(createdSm.data?.data?.pinHash, "");
    assert.equal(createdSm.data?.data?.hasPin, true);
    const sm3Stored = (await store.getCollectionData("salesmen")).find((s: any) => s.id === "sm-3");
    assert.ok(String(sm3Stored?.pin_hash || "").startsWith("scrypt$"));

    // Toggle inactive & delete
    const deactSm = await supabaseMod.proxyFetch("/api/salesmen/sm-3", {
      method: "PUT",
      body: JSON.stringify({ active: false }),
    });
    assert.equal(deactSm.ok, true);
    const delSm = await supabaseMod.deleteSalesmanFromSupabase("sm-3");
    assert.equal(delSm.success, true);

    // 8. Soft delete payment, record deletion, verify settings & profile round-trip
    await supabaseMod.softDeletePaymentsInSupabase(["pay-2"], "Owner", "Bounced UPI");
    await supabaseMod.pushDeletionRecordsToSupabase([
      { kind: "payment", id: "pay-2", deletedAt: "2026-11-23T12:00:00.000Z", by: "Owner", reason: "Bounced UPI" },
    ]);
    const dels = await supabaseMod.pullDeletionLogFromSupabase();
    assert.equal(dels.some((d) => d.kind === "payment" && d.id === "pay-2"), true);

    const bsSave = await supabaseMod.pushBillingSettingsToSupabase({
      invoicePrefix: "HHINV",
      numberingMode: "per_salesman_series",
      salesmanSeriesCodes: { "sm-1": "RK" },
    });
    assert.equal(bsSave.success, true);
    const bsPull = await supabaseMod.pullBillingSettingsFromSupabase();
    assert.equal(bsPull.success, true);
    assert.equal(bsPull.settings?.invoicePrefix, "HHINV");

    const opSave = await supabaseMod.pushOrgProfileToSupabase({
      name: "Hydrate Hub Staging Depot Updated",
      phone: "9800000000",
      email: "owner@staging.local",
      address: "Bengaluru",
      gstin: "29ABCDE1234F1Z5",
      state: "Karnataka",
      stateCode: "29",
    } as any);
    assert.equal(opSave.success, true);
    const opPull = await supabaseMod.pullOrgProfileFromSupabase();
    assert.equal(opPull.success, true);
    assert.equal(opPull.profile?.name, "Hydrate Hub Staging Depot Updated");

    // Verify zero requests touched supabase.co
    assert.equal(
      outboundUrls.some((u) => u.includes("supabase.co")),
      false,
      `Found direct Supabase URL calls: ${outboundUrls.filter((u) => u.includes("supabase.co")).join(", ")}`,
    );
  } finally {
    globalThis.fetch = originalFetch;
    supabaseMod.setServerProxyModeForTest(null);
    authFetch.setApiSession(null);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
