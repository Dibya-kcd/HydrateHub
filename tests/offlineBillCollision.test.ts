import test from 'node:test';
import assert from 'node:assert/strict';
import {
  areSameBillIdentity,
  mergeBillLists,
  mergeBillListsWithConflictResolution,
} from '../src/utils/billMerge';
import {
  deriveSalesmanSeriesCode,
  findDuplicateBillNumbers,
  formatSalesmanDocNo,
} from '../src/utils/invoiceCommon';
import type { Bill, BillingSettings, Salesman } from '../src/types';

const makeBill = (id: number, over: Partial<Bill> = {}): Bill =>
  ({
    id,
    date: '2026-11-23',
    retailer: 'Sharma Store',
    phone: '9876543210',
    status: 'credit',
    items: [],
    subtotal: 500,
    cgst: 0,
    sgst: 0,
    total: 500,
    amountPaid: 0,
    additionalDiscount: 0,
    returns: [],
    ...over,
  }) as Bill;

test('Two offline devices issuing fallback #105 both survive merge and are flagged as duplicate GST invoice numbers', () => {
  const phoneABill = makeBill(105, {
    docNo: 'INV-105',
    retailer: 'Alpha Grocers',
    total: 1200,
    clientUid: 'bu_devA_105',
    originDeviceId: 'dev_A',
    salesman: 'Ramesh',
  });

  const phoneBBill = makeBill(105, {
    docNo: 'INV-105',
    retailer: 'Beta Mart',
    total: 850,
    clientUid: 'bu_devB_105',
    originDeviceId: 'dev_B',
    salesman: 'Suresh',
  });

  assert.equal(areSameBillIdentity(phoneABill, phoneBBill), false);

  const res = mergeBillListsWithConflictResolution([phoneABill], [phoneBBill], new Set());
  assert.equal(res.merged.length, 2, 'Neither offline invoice should overwrite the other');
  assert.equal(res.remapped.length, 1);
  assert.equal(res.remapped[0].oldId, 105);
  assert.equal(res.remapped[0].newId, 106);

  const b105 = res.merged.find((b) => b.id === 105);
  const b106 = res.merged.find((b) => b.id === 106);
  assert.ok(b105);
  assert.ok(b106);
  assert.equal(b105.retailer, 'Alpha Grocers');
  assert.equal(b106.retailer, 'Beta Mart');
  assert.equal(b106.collidedFromId, 105);
  assert.equal(b105.duplicateNumberConflict, true);
  assert.equal(b106.duplicateNumberConflict, true);

  const dupes = findDuplicateBillNumbers(res.merged);
  assert.equal(dupes.groups.length, 1);
  assert.equal(dupes.groups[0].docNo, 'INV-105');
  assert.equal(dupes.conflictCount, 2);

  // Subsequent sync of the original colliding incoming payload from Phone B matches by clientUid and updates #106 instead of creating #107
  const updatedPhoneBBill = { ...phoneBBill, total: 900, updatedAt: new Date(Date.now() + 60_000).toISOString() };
  const secondMerge = mergeBillListsWithConflictResolution(res.merged, [updatedPhoneBBill], new Set());
  assert.equal(secondMerge.merged.length, 2);
  assert.equal(secondMerge.remapped.length, 0);
  assert.equal(secondMerge.merged.find((b) => b.id === 106)?.total, 900);
});

test('Same logical bill edited on another device merges normally without creating a duplicate', () => {
  const original = makeBill(105, {
    docNo: 'INV-105',
    retailer: 'Alpha Grocers',
    total: 1200,
    clientUid: 'bu_devA_105',
    originDeviceId: 'dev_A',
    updatedAt: '2026-11-23T09:00:00.000Z',
  });
  const editedOnAdmin = makeBill(105, {
    docNo: 'INV-105',
    retailer: 'Alpha Grocers',
    total: 1350,
    clientUid: 'bu_devA_105',
    originDeviceId: 'dev_admin',
    updatedAt: '2026-11-23T11:00:00.000Z',
  });

  assert.equal(areSameBillIdentity(original, editedOnAdmin), true);
  const merged = mergeBillLists([original], [editedOnAdmin], new Set());
  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, 105);
  assert.equal(merged[0].total, 1350);
  assert.equal(merged[0].duplicateNumberConflict, undefined);
});

test('Per-salesman series offline bills stay GST Rule 46(b) compliant (<=16 chars) and avoid duplicate GST conflict when internal IDs collide', () => {
  const salesmen: Salesman[] = [
    { id: 'sm_1', name: 'Ramesh Kumar', active: true, seriesCode: 'S1' },
    { id: 'sm_2', name: 'Suresh Nair', active: true },
  ];
  const settings: BillingSettings = {
    invoicePrefix: 'INV',
    numberingMode: 'per_salesman_series',
    salesmanSeriesCodes: { sm_2: 'SN' },
  };

  const code1 = deriveSalesmanSeriesCode(salesmen[0], salesmen, settings);
  const code2 = deriveSalesmanSeriesCode(salesmen[1], salesmen, settings);
  assert.equal(code1, 'S1');
  assert.equal(code2, 'SN');

  const doc1 = formatSalesmanDocNo('INV', code1, 105);
  const doc2 = formatSalesmanDocNo('INV', code2, 105);
  assert.equal(doc1, 'INV-S1-105');
  assert.equal(doc2, 'INV-SN-105');
  assert.ok(doc1.length <= 16);
  assert.ok(doc2.length <= 16);

  // Even long sequence numbers clamp prefix cleanly to stay <= 16 chars
  const longDoc = formatSalesmanDocNo('MRWATER', 'S12', 1234567890);
  assert.ok(longDoc.length <= 16);

  // If both offline phones used fallback numeric id 105 while their display docNos differ (INV-S1-105 vs INV-SN-105),
  // both bills survive merge with distinct internal ids (105 and 106), and neither is flagged as a duplicate GST number.
  const s1Bill = makeBill(105, {
    docNo: doc1,
    retailer: 'Shop One',
    clientUid: 'bu_s1_105',
    originDeviceId: 'dev_s1',
  });
  const s2Bill = makeBill(105, {
    docNo: doc2,
    retailer: 'Shop Two',
    clientUid: 'bu_s2_105',
    originDeviceId: 'dev_s2',
  });

  const res = mergeBillListsWithConflictResolution([s1Bill], [s2Bill], new Set());
  assert.equal(res.merged.length, 2);
  const migrated = res.merged.find((b) => b.id === 106)!;
  assert.equal(migrated.docNo, 'INV-SN-105');
  assert.equal(migrated.duplicateNumberConflict, false);

  const dupes = findDuplicateBillNumbers(res.merged, settings);
  assert.equal(dupes.groups.length, 0);
  assert.equal(dupes.conflictCount, 0);
});
