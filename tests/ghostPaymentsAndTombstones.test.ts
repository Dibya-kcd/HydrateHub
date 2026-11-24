import test from "node:test";
import assert from "node:assert/strict";
import {
  collectCancelledRestores,
  mergeBillLists,
} from "../src/utils/billMerge";
import {
  isPaymentFromDeletedCustomerId,
  looksLikeDuplicateOrMistakeReason,
} from "../src/utils/ghostPayments";
import type { Bill, Customer, PaymentRecord } from "../src/types";

const makeBill = (id: number, overrides: Partial<Bill> = {}): Bill => ({
  id,
  invNo: `INV-${id}`,
  date: "2026-11-18",
  retailer: "Ramesh Traders",
  phone: "9876543210",
  items: [],
  total: 1000,
  gstMode: "gst",
  paymentMode: "cash",
  amountPaid: 500,
  ...overrides,
});

const makeCustomer = (id: string, overrides: Partial<Customer> = {}): Customer => ({
  id,
  name: "Ramesh Traders",
  phone: "9876543210",
  createdAt: "2026-01-01T00:00:00Z",
  ...overrides,
});

const makePayment = (id: string, overrides: Partial<PaymentRecord> = {}): PaymentRecord => ({
  id,
  customerName: "Ramesh Traders",
  customerPhone: "9876543210",
  amount: 500,
  mode: "cash",
  createdAt: "2026-11-18T10:00:00Z",
  ...overrides,
});

test("billMerge: deleted active duplicate bills never resurrect via PUT sync", () => {
  const deletedIds = new Set<number>([101, 102]);
  const staleIncoming = [
    makeBill(101), // active deleted duplicate from stale tab/outbox
    makeBill(102, { status: "cancelled", cancelled: true, cancellation: { reason: "GST cancel", by: "Admin", at: "2026-11-18T11:00:00Z" } }),
    makeBill(103), // genuinely new bill
  ];

  const restored = collectCancelledRestores(staleIncoming, deletedIds);
  assert.deepEqual(restored, [102]);
  assert.equal(deletedIds.has(101), true, "active deleted bill 101 must remain tombstoned");
  assert.equal(deletedIds.has(102), false, "explicitly cancelled bill 102 is kept for GST series");

  const stored = [makeBill(100), makeBill(101)]; // even if 101 lingered in stored cache
  const merged = mergeBillLists(stored, staleIncoming, deletedIds);
  const mergedIds = merged.map((b) => b.id);
  assert.equal(mergedIds.includes(101), false, "tombstoned active bill 101 must stay excluded");
  assert.equal(mergedIds.includes(102), true, "cancelled bill 102 stays for GST series");
  assert.equal(mergedIds.includes(103), true, "active bill 103 is kept");
  assert.equal(mergedIds.includes(100), true, "active bill 100 is kept");
});

test("looksLikeDuplicateOrMistakeReason identifies duplicate/mistake comments", () => {
  assert.equal(looksLikeDuplicateOrMistakeReason("duplicate bill"), true);
  assert.equal(looksLikeDuplicateOrMistakeReason("Dup entry"), true);
  assert.equal(looksLikeDuplicateOrMistakeReason("entered by mistake"), true);
  assert.equal(looksLikeDuplicateOrMistakeReason("wrong customer double billing"), true);
  assert.equal(looksLikeDuplicateOrMistakeReason("test bill"), true);
  assert.equal(looksLikeDuplicateOrMistakeReason("Customer rescheduled delivery"), false);
});

test("isPaymentFromDeletedCustomerId blocks bleed-over onto surviving duplicate customer", () => {
  const deletedIds = new Set(["cust-dup-1"]);
  const activeIds = new Set(["cust-surviving"]);
  const liveBillIds = new Set([10]);

  assert.equal(
    isPaymentFromDeletedCustomerId(
      { customerId: "cust-dup-1", billId: undefined },
      deletedIds,
      activeIds,
      liveBillIds,
    ),
    true,
  );
  assert.equal(
    isPaymentFromDeletedCustomerId(
      { customerId: "cust-dup-1", billId: 10 },
      deletedIds,
      activeIds,
      liveBillIds,
    ),
    false,
    "payment attached to a live bill remains accounted for on that bill",
  );
  assert.equal(
    isPaymentFromDeletedCustomerId(
      { customerId: "cust-surviving", billId: undefined },
      deletedIds,
      activeIds,
      liveBillIds,
    ),
    false,
  );
});

