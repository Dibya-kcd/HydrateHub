import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

process.env.MRWATER_TEST = "1";
process.env.API_AUTH_REQUIRED = "true";
process.env.APP_SESSION_SECRET = "test-session-secret-key-at-least-32-chars-long";
process.env.PIN_PEPPER = "test-pin-pepper-value";
process.env.ADMIN_PASSWORD = "stage-owner-secret-password";

const store = await import("../server/supabaseStore");
const { createSecurityAndAuthSetup } = await import("../server/authMiddleware");
const { registerBillsAndDocNumbersRoutes } = await import(
  "../server/routes/billsAndDocNumbersRoutes"
);
const { registerSystemRoutes } = await import("../server/routes/systemRoutes");
const { validateBillAgainstLedger } = await import("../server/billValidation");
const { formatBillForSupabase, formatTripForSupabase } = await import("../server/dbHelpers");
const { todayISO, toLocalISODate } = await import("../src/utils/dateLocal");

function buildBillApp() {
  const app = express();
  const setup = createSecurityAndAuthSetup();
  setup.applySecurityAndAuthMiddleware(app);
  registerSystemRoutes(app, setup.resolveAuth);
  registerBillsAndDocNumbersRoutes(app);
  return app;
}

async function startServer() {
  const app = buildBillApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const addr = server.address() as any;
  const baseUrl = `http://127.0.0.1:${addr.port}`;
  return { server, baseUrl };
}

async function loginAdmin(baseUrl: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/auth/admin-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: process.env.ADMIN_PASSWORD }),
  });
  const json = (await res.json()) as any;
  assert.equal(res.status, 200);
  assert.ok(json.token);
  return json.token;
}

function resetCollections() {
  for (const k of Object.keys(store.inMemoryCollections)) {
    delete store.inMemoryCollections[k];
  }
}

const SAMPLE_PRODUCT = {
  id: 101,
  name: "Spring Water 1L",
  sku: "SW-1L",
  mrp: 200,
  price: 150,
  stock: 10,
  category: "Water",
  gstRate: 5,
};

const SAMPLE_WAREHOUSE = {
  id: "wh-main",
  name: "Main Godown",
  type: "warehouse" as const,
  isDefault: true,
};

const SAMPLE_BATCH = {
  id: "batch-1",
  productId: 101,
  warehouseId: "wh-main",
  batchNumber: "B-101",
  quantity: 10,
  receivedDate: "2026-11-01",
};

const SAMPLE_CUSTOMER = {
  id: "cust-1",
  name: "Balaji Mart",
  phone: "9876543210",
  creditLimit: 500,
  openingBalance: 0,
};

test("validateBillAgainstLedger rejects oversold godown stock and allows within-stock edits", () => {
  const baseState = {
    bills: [
      {
        id: 1,
        retailer: "Walk-in Shop",
        date: "2026-11-20",
        warehouseId: "wh-main",
        total: 600,
        amountPaid: 600,
        items: [{ key: "101", productId: 101, productName: "Spring Water 1L", qty: 4, price: 150 }],
      },
    ],
    products: [SAMPLE_PRODUCT as any],
    customers: [SAMPLE_CUSTOMER as any],
    payments: [],
    trips: [],
    warehouses: [SAMPLE_WAREHOUSE as any],
    inventoryBatches: [SAMPLE_BATCH as any],
    stockLedgerEntries: [],
    inventoryDispositions: [],
    audits: [],
  };

  // Remaining stock = 10 - 4 = 6. Ordering 7 must fail.
  const overStock = validateBillAgainstLedger(
    {
      id: 2,
      retailer: "Another Store",
      date: "2026-11-21",
      warehouseId: "wh-main",
      total: 1050,
      amountPaid: 1050,
      items: [{ key: "101", productId: 101, productName: "Spring Water 1L", qty: 7, price: 150 }],
    },
    baseState,
  );
  assert.equal(overStock.ok, false);
  if (!overStock.ok) {
    assert.equal(overStock.status, 409);
    assert.equal(overStock.code, "INSUFFICIENT_STOCK");
  }

  // Cancelled bill never triggers stock rejection.
  const cancelled = validateBillAgainstLedger(
    {
      id: 3,
      retailer: "Another Store",
      date: "2026-11-21",
      status: "cancelled",
      warehouseId: "wh-main",
      total: 15000,
      amountPaid: 0,
      items: [{ key: "101", productId: 101, productName: "Spring Water 1L", qty: 100, price: 150 }],
    },
    baseState,
  );
  assert.equal(cancelled.ok, true);

  // Editing existing bill #1 from qty 4 up to 9 uses total 9 <= 10 available -> OK.
  const editOk = validateBillAgainstLedger(
    {
      ...baseState.bills[0],
      total: 1350,
      amountPaid: 1350,
      items: [{ key: "101", productId: 101, productName: "Spring Water 1L", qty: 9, price: 150 }],
    },
    { ...baseState, existingBill: baseState.bills[0] },
  );
  assert.equal(editOk.ok, true);
});

test("validateBillAgainstLedger enforces customer creditLimit considering existing unpaid balance", () => {
  const state = {
    bills: [
      {
        id: 10,
        customerId: "cust-1",
        retailer: "Balaji Mart",
        phone: "9876543210",
        date: "2026-11-20",
        warehouseId: "wh-main",
        total: 350,
        amountPaid: 0,
        items: [{ key: "101", productId: 101, productName: "Spring Water 1L", qty: 2, price: 175 }],
      },
    ],
    products: [{ ...SAMPLE_PRODUCT, stock: 50 } as any],
    customers: [SAMPLE_CUSTOMER as any], // creditLimit = 500
    payments: [],
    trips: [],
    warehouses: [SAMPLE_WAREHOUSE as any],
    inventoryBatches: [{ ...SAMPLE_BATCH, initialQty: 50, remainingQty: 50 } as any],
    stockLedgerEntries: [],
    inventoryDispositions: [],
    audits: [],
  };

  // Existing due = 350, limit = 500 -> adding 200 unpaid (350 + 200 = 550) exceeds limit.
  const overCredit = validateBillAgainstLedger(
    {
      id: 11,
      customerId: "cust-1",
      retailer: "Balaji Mart",
      phone: "9876543210",
      date: "2026-11-21",
      warehouseId: "wh-main",
      total: 200,
      amountPaid: 0,
      items: [{ key: "101", productId: 101, productName: "Spring Water 1L", qty: 1, price: 200 }],
    },
    state,
  );
  assert.equal(overCredit.ok, false);
  if (!overCredit.ok) {
    assert.equal(overCredit.status, 409);
    assert.equal(overCredit.code, "CREDIT_LIMIT_EXCEEDED");
  }

  // Collecting 100 upfront leaves 100 credit -> 350 + 100 = 450 <= 500 -> OK.
  const withinCredit = validateBillAgainstLedger(
    {
      id: 11,
      customerId: "cust-1",
      retailer: "Balaji Mart",
      phone: "9876543210",
      date: "2026-11-21",
      warehouseId: "wh-main",
      total: 200,
      amountPaid: 100,
      items: [{ key: "101", productId: 101, productName: "Spring Water 1L", qty: 1, price: 200 }],
    },
    state,
  );
  assert.equal(withinCredit.ok, true);
});

test("POST /api/bills and PUT /api/bills enforce stock and credit limit with 409 and no mutation", async () => {
  resetCollections();
  await store.setCollectionData("products", [SAMPLE_PRODUCT]);
  await store.setCollectionData("warehouses", [SAMPLE_WAREHOUSE]);
  await store.setCollectionData("inventory_batches", [SAMPLE_BATCH]);
  await store.setCollectionData("customers", [SAMPLE_CUSTOMER]);
  await store.setCollectionData("orders", []);
  await store.setCollectionData("payments", []);
  await store.setCollectionData("trips", []);

  const { server, baseUrl } = await startServer();
  try {
    const token = await loginAdmin(baseUrl);
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    // 1. Oversold POST -> 409 INSUFFICIENT_STOCK
    const stockFail = await fetch(`${baseUrl}/api/bills`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: 1001,
        retailer: "Balaji Mart",
        phone: "9876543210",
        date: "2026-11-22",
        warehouseId: "wh-main",
        total: 3000,
        amountPaid: 3000,
        items: [{ key: "101", productId: 101, productName: "Spring Water 1L", qty: 20, price: 150 }],
      }),
    });
    assert.equal(stockFail.status, 409);
    const stockJson = (await stockFail.json()) as any;
    assert.equal(stockJson.code, "INSUFFICIENT_STOCK");
    assert.equal((await store.getCollectionData("orders")).length, 0);

    // 2. Over-credit POST -> 409 CREDIT_LIMIT_EXCEEDED
    const creditFail = await fetch(`${baseUrl}/api/bills`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: 1002,
        customerId: "cust-1",
        retailer: "Balaji Mart",
        phone: "9876543210",
        date: "2026-11-22",
        warehouseId: "wh-main",
        total: 750,
        amountPaid: 100,
        items: [{ key: "101", productId: 101, productName: "Spring Water 1L", qty: 5, price: 150 }],
      }),
    });
    assert.equal(creditFail.status, 409);
    const creditJson = (await creditFail.json()) as any;
    assert.equal(creditJson.code, "CREDIT_LIMIT_EXCEEDED");
    assert.equal((await store.getCollectionData("orders")).length, 0);

    // 3. Valid POST -> 200
    const okRes = await fetch(`${baseUrl}/api/bills`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: 1003,
        customerId: "cust-1",
        retailer: "Balaji Mart",
        phone: "9876543210",
        date: "2026-11-22",
        warehouseId: "wh-main",
        total: 450,
        amountPaid: 0,
        items: [{ key: "101", productId: 101, productName: "Spring Water 1L", qty: 3, price: 150 }],
      }),
    });
    assert.equal(okRes.status, 201);
    assert.equal((await store.getCollectionData("orders")).length, 1);

    // 4. PUT /api/bills including an extra bill pushing customer past creditLimit -> 409
    const putFail = await fetch(`${baseUrl}/api/bills`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        bills: [
          {
            id: 1003,
            customerId: "cust-1",
            retailer: "Balaji Mart",
            phone: "9876543210",
            date: "2026-11-22",
            warehouseId: "wh-main",
            total: 450,
            amountPaid: 0,
            items: [{ key: "101", productId: 101, productName: "Spring Water 1L", qty: 3, price: 150 }],
          },
          {
            id: 1004,
            customerId: "cust-1",
            retailer: "Balaji Mart",
            phone: "9876543210",
            date: "2026-11-22",
            warehouseId: "wh-main",
            total: 300,
            amountPaid: 0,
            items: [{ key: "101", productId: 101, productName: "Spring Water 1L", qty: 2, price: 150 }],
          },
        ],
      }),
    });
    assert.equal(putFail.status, 409);
    const putJson = (await putFail.json()) as any;
    assert.equal(putJson.code, "CREDIT_LIMIT_EXCEEDED");
    assert.equal((await store.getCollectionData("orders")).length, 1);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("IST date helpers convert 00:00-05:29 IST UTC instants accurately and server has no UTC date fallbacks", () => {
  // 2026-11-22T18:35:00.000Z is 2026-11-23 00:05:00 IST (+05:30).
  const midnightIst = new Date("2026-11-22T18:35:00.000Z");
  assert.equal(toLocalISODate(midnightIst), "2026-11-23");
  assert.equal(toLocalISODate(new Date("2026-11-22T23:55:00.000Z")), "2026-11-23");

  const billRow = formatBillForSupabase({ id: 99, retailer: "Test", total: 100 });
  assert.equal(billRow.date, todayISO());

  const tripRow = formatTripForSupabase({ id: "t-99", vehicle: "OD02AB1234", salesman: "A" });
  assert.equal(tripRow.date, todayISO());

  // Static guard: no UTC date slice on new Date().toISOString() or bare .toISOString().slice(0, 10) in server/
  const serverDir = path.resolve(process.cwd(), "server");
  const walkTs = (dir: string): string[] => {
    const out: string[] = [];
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) out.push(...walkTs(p));
      else if (p.endsWith(".ts")) out.push(p);
    }
    return out;
  };
  for (const file of walkTs(serverDir)) {
    const txt = fs.readFileSync(file, "utf8");
    assert.equal(
      /new Date\(\)\.toISOString\(\)\.slice\(0,\s*10\)/.test(txt),
      false,
      `Found UTC date fallback in ${path.relative(process.cwd(), file)}`,
    );
  }
});
