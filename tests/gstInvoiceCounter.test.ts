import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import type { Bill, Product } from '../src/types';

process.env.MRWATER_TEST = '1';
process.env.API_AUTH_REQUIRED = 'false';

const memStorage = new Map<string, string>();
if (typeof (globalThis as any).localStorage === 'undefined') {
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

const {
  highestGstInvoiceSeq,
  parseGstSeriesSeq,
} = await import('../src/utils/invoiceCommon');
const { invoiceSeriesSummary } = await import('../src/utils/gstReports');
const { buildMissingSeriesCancelledBills } = await import(
  '../src/context/ledgerBillRepairHelpers'
);
const { planSplitMixedBill } = await import('../src/utils/mixedBillSplit');
const { reserveDocNumber } = await import('../src/context/ledgerHelpers');
const store = await import('../server/supabaseStore');
const { registerBillsAndDocNumbersRoutes } = await import(
  '../server/routes/billsAndDocNumbersRoutes'
);

const gstProduct: Product = {
  id: 8,
  name: 'E.H. VIBE CLEAR LEMON',
  category: 'vibe',
  wholesale: 220,
  retail: 240,
  gstRate: 0.4,
  taxability: 'taxable',
  hsn: '22021090',
  unitsPerCrate: 24,
};

const nonGstProduct: Product = {
  id: 26,
  name: 'TATA GLUCO',
  category: 'general',
  wholesale: 185,
  retail: 200,
  gstRate: 0,
  taxability: 'non_gst',
  hsn: '',
  unitsPerCrate: 24,
};

const makeBaseBill = (overrides: Partial<Bill>): Bill => ({
  id: 1,
  retailer: 'Test Store',
  phone: '9876543210',
  date: '2026-11-23',
  items: [
    {
      key: 'k1',
      productId: 8,
      productName: gstProduct.name,
      category: 'vibe',
      hsn: '22021090',
      taxability: 'taxable',
      gst: 40,
      priceType: 'Retail',
      qty: 1,
      rate: 240,
      gross: 240,
      freeQty: 0,
      chargeableQty: 1,
      discount: 0,
      amount: 240,
    },
  ],
  subtotal: 171.43,
  cgst: 34.29,
  sgst: 34.29,
  total: 240,
  discount: 0,
  amountPaid: 240,
  ...overrides,
});

test('parseGstSeriesSeq and highestGstInvoiceSeq isolate GST numbers from NG- and salesman series', () => {
  const b1 = makeBaseBill({ id: 101, docNo: 'INV-573', docSeries: 'gst' });
  const b2 = makeBaseBill({ id: 102, docNo: 'NG-12', docSeries: 'non_gst', gstExclude: true });
  const b3 = makeBaseBill({ id: 103, docNo: 'INV-S1-999', docSeries: 'gst' });
  const b4 = makeBaseBill({ id: 104, docNo: undefined }); // legacy GST bill without docNo
  const b5 = makeBaseBill({ id: 105, docNo: 'TAX-580', docSeries: 'gst' });

  assert.equal(parseGstSeriesSeq(b1, 'INV'), 573);
  assert.equal(parseGstSeriesSeq(b2, 'INV'), 0);
  assert.equal(parseGstSeriesSeq(b3, 'INV'), 0);
  assert.equal(parseGstSeriesSeq(b4, 'INV'), 104);
  assert.equal(parseGstSeriesSeq(b5, 'TAX'), 580);
  assert.equal(highestGstInvoiceSeq([b1, b2, b3, b4], 'INV', [gstProduct, nonGstProduct]), 573);
});

test('reserveDocNumber keeps gst_bill consecutive even when non_gst_bill and bill advance', () => {
  (globalThis as any).localStorage.clear();

  // Start after historical GST invoice INV-573 while internal bill.id is at 600
  const bills: Bill[] = [
    makeBaseBill({ id: 573, docNo: 'INV-573', docSeries: 'gst' }),
    makeBaseBill({ id: 600, docNo: 'NG-15', docSeries: 'non_gst', gstExclude: true }),
  ];

  const id1 = reserveDocNumber('bill', 600);
  const ng1 = reserveDocNumber('non_gst_bill', 15);
  const id2 = reserveDocNumber('bill', id1);
  const gst1 = reserveDocNumber('gst_bill', highestGstInvoiceSeq(bills, 'INV'));
  const id3 = reserveDocNumber('bill', id2);
  const ng2 = reserveDocNumber('non_gst_bill', ng1);
  const id4 = reserveDocNumber('bill', id3);
  const gst2 = reserveDocNumber('gst_bill', Math.max(highestGstInvoiceSeq(bills, 'INV'), gst1));

  assert.deepEqual([id1, id2, id3, id4], [601, 602, 603, 604]);
  assert.deepEqual([ng1, ng2], [16, 17]);
  assert.deepEqual([gst1, gst2], [574, 575]);
});

test('invoiceSeriesSummary audits separate GST doc numbers cleanly across standalone and transition series', () => {
  // Fresh separate-counter shop: Non-GST memos took internal IDs 101, 103; GST invoices are INV-1, INV-2
  const ng1 = makeBaseBill({ id: 101, docNo: 'NG-1', docSeries: 'non_gst', gstExclude: true });
  const gst1 = makeBaseBill({ id: 102, docNo: 'INV-1', docSeries: 'gst' });
  const ng2 = makeBaseBill({ id: 103, docNo: 'NG-2', docSeries: 'non_gst', gstExclude: true });
  const gst2 = makeBaseBill({ id: 104, docNo: 'INV-2', docSeries: 'gst' });

  const sepSummary = invoiceSeriesSummary([gst1, gst2], [], [ng1, gst1, ng2, gst2], [ng1, ng2], 'INV');
  assert.deepEqual(sepSummary, {
    from: 1,
    to: 2,
    numbers: 2,
    active: 2,
    cancelled: 0,
    missing: [],
  });

  // Transition from legacy shared counter (INV-101, NG-1 at id 102, INV-103) to new gst_bill (INV-104 at id 105)
  const leg101 = makeBaseBill({ id: 101, docNo: 'INV-101', docSeries: 'gst' });
  const legNg102 = makeBaseBill({ id: 102, docNo: 'NG-1', docSeries: 'non_gst', gstExclude: true });
  const leg103 = makeBaseBill({ id: 103, docNo: 'INV-103', docSeries: 'gst' });
  const newNg104 = makeBaseBill({ id: 104, docNo: 'NG-2', docSeries: 'non_gst', gstExclude: true });
  const newGst104 = makeBaseBill({ id: 105, docNo: 'INV-104', docSeries: 'gst' });

  const transSummary = invoiceSeriesSummary(
    [leg101, leg103, newGst104],
    [],
    [leg101, legNg102, leg103, newNg104, newGst104],
    [legNg102, newNg104],
    'INV',
  );
  assert.deepEqual(transSummary, {
    from: 101,
    to: 104,
    numbers: 3,
    active: 3,
    cancelled: 0,
    missing: [],
  });

  // Genuine missing GST invoice (INV-102 missing when no NG bill occupied 102)
  const gapSummary = invoiceSeriesSummary([leg101, leg103], [], [leg101, leg103], [], 'INV');
  assert.deepEqual(gapSummary?.missing, [102]);
});

test('buildMissingSeriesCancelledBills preserves GST docNo and avoids id collision with Non-GST bills', () => {
  const existingNg = makeBaseBill({ id: 102, docNo: 'NG-1', docSeries: 'non_gst', gstExclude: true });
  const existingGst = makeBaseBill({ id: 103, docNo: 'INV-103', docSeries: 'gst' });

  const created = buildMissingSeriesCancelledBills([102], [existingNg, existingGst], 'INV');
  assert.equal(created.length, 1);
  assert.equal(created[0].docNo, 'INV-102');
  assert.equal(created[0].docSeries, 'gst');
  assert.equal(created[0].status, 'cancelled');
  assert.notEqual(created[0].id, 102);
  assert.ok(created[0].id > 103);
});

test('planSplitMixedBill uses passed nextGstDocNo instead of internal nextBillId for reverse splits', () => {
  const mixedDraft = makeBaseBill({
    id: 600,
    docNo: 'NG-5',
    docSeries: 'non_gst',
    gstExclude: true,
    items: [
      makeBaseBill({}).items[0],
      {
        key: 'k2',
        productId: 26,
        productName: nonGstProduct.name,
        category: 'general',
        hsn: '',
        taxability: 'non_gst',
        gst: 0,
        priceType: 'Retail',
        qty: 1,
        rate: 200,
        gross: 200,
        freeQty: 0,
        chargeableQty: 1,
        discount: 0,
        amount: 200,
      },
    ],
    total: 440,
    amountPaid: 440,
  });
  const origNg = { ...mixedDraft, items: [mixedDraft.items[1]], total: 200, amountPaid: 200 };

  const plan = planSplitMixedBill({
    bill: mixedDraft,
    originalBill: origNg,
    products: [gstProduct, nonGstProduct],
    gstMode: 'inclusive',
    outputTaxOff: false,
    nextBillId: 605,
    nextNonGstDocNo: 'NG-6',
    nextGstDocNo: 'INV-12',
    invoicePrefix: 'INV',
    splitGroupId: 'split_1',
  });

  assert.ok(plan);
  assert.equal(plan.gstBill.id, 605);
  assert.equal(plan.gstBill.docNo, 'INV-12');
  assert.equal(plan.nonGstBill.id, 600);
  assert.equal(plan.nonGstBill.docNo, 'NG-5');
});

test('server /api/doc-numbers/reserve tracks gst_bill independently from orders internal IDs', async () => {
  for (const k of Object.keys(store.inMemoryCollections)) {
    delete store.inMemoryCollections[k];
  }
  await store.setCollectionData('orders', [
    { id: 101, docNo: 'INV-101', docSeries: 'gst', gstExclude: false, date: '2026-11-23', total: 100 },
    { id: 102, docNo: 'NG-1', docSeries: 'non_gst', gstExclude: true, date: '2026-11-23', total: 200 },
    { id: 103, docNo: 'NG-2', docSeries: 'non_gst', gstExclude: true, date: '2026-11-23', total: 200 },
  ]);
  await store.setCollectionData('doc_counters', {});
  await store.setCollectionData('doc_holds', {});

  const app = express();
  app.use(express.json());
  registerBillsAndDocNumbersRoutes(app);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address() as { port: number };
  const base = `http://127.0.0.1:${addr.port}`;

  try {
    const rGst = await fetch(`${base}/api/doc-numbers/reserve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sequence: 'gst_bill', deviceId: 'dev_a', floor: 0 }),
    });
    const jGst = (await rGst.json()) as any;
    assert.equal(jGst.success, true);
    assert.equal(jGst.number, 102);

    const rBill = await fetch(`${base}/api/doc-numbers/reserve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sequence: 'bill', deviceId: 'dev_a', floor: 0 }),
    });
    const jBill = (await rBill.json()) as any;
    assert.equal(jBill.success, true);
    assert.equal(jBill.number, 104);

    const rNg = await fetch(`${base}/api/doc-numbers/reserve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sequence: 'non_gst_bill', deviceId: 'dev_a', floor: 0 }),
    });
    const jNg = (await rNg.json()) as any;
    assert.equal(jNg.success, true);
    assert.equal(jNg.number, 3);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('server /api/doc-numbers/reserve ignores an inflated client floor (no holes in a consecutive series)', async () => {
  for (const k of Object.keys(store.inMemoryCollections)) delete store.inMemoryCollections[k];
  await store.setCollectionData('orders', [
    { id: 101, docNo: 'INV-101', docSeries: 'gst', gstExclude: false, date: '2026-11-23', total: 100 },
  ]);
  await store.setCollectionData('doc_counters', {});
  await store.setCollectionData('doc_holds', {});

  const app = express();
  app.use(express.json());
  registerBillsAndDocNumbersRoutes(app);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const reserve = async (deviceId: string, floor: number) =>
    ((await (await fetch(`${base}/api/doc-numbers/reserve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sequence: 'gst_bill', deviceId, floor }),
    })).json()) as any);
  try {
    const burn = await reserve('dev_bad', 9_999_999);
    assert.equal(burn.success, true);
    assert.ok(burn.number <= 101 + 200 + 1, `number ${burn.number} should stay within the head-room`);
    // a modest offline floor is still honoured
    const ok = await reserve('dev_ok', 150);
    assert.ok(ok.number > 150);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
