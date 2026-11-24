import test from "node:test";
import assert from "node:assert/strict";
import {
  applyBillEditPaymentPlan,
  buildPaymentReversal,
  paymentReversalBlocker,
  planBillEditPayments,
  reversedPaymentIds,
  validatePaymentEdit,
} from "../src/utils/paymentReversal";
import { billPaymentGaps, sumCustomerRecordedPaid } from "../src/utils/paymentAllocation";
import { calcReconcilePaymentsFromBills, calcCustomerCreditSummary } from "../src/context/ledgerPaymentCalculations";
import { summarizeCollections } from "../src/utils/collectionSummary";
import { collectReceipts, makeBeatResolver } from "../src/utils/beatReports";
import type { Bill, PaymentRecord } from "../src/types";

const pay = (over: Partial<PaymentRecord> = {}): PaymentRecord => ({
  id: "pay_1", billId: 7, customerName: "Sharma Store", customerPhone: "9876543210", paymentDate: "2026-11-10",
  amount: 600, mode: "upi", entryKind: "receipt", referenceNote: "UTR 123", recordedBy: "Asha", createdAt: "2026-11-10T08:00:00.000Z", ...over,
});
const opts = { id: "pay_rev_1", nowIso: "2026-11-22T10:00:00.000Z", today: "2026-11-22", by: "Admin", reason: "Wrong party" };

test("reversal is a new opposite entry linked to the original, dated today", () => {
  const r = buildPaymentReversal(pay(), opts);
  assert.equal(r.amount, -600);
  assert.equal(r.billId, 7);
  assert.equal(r.reversalOf, "pay_1");
  assert.equal(r.paymentDate, "2026-11-22");
  assert.equal(r.mode, "upi");
  assert.match(r.referenceNote!, /Reversal of ₹600 receipt dated 2026-11-10 \(UTR 123\) — Reason: Wrong party/);
  assert.ok(!r.isAdvance);
});

test("a reversed bill receipt leaves nothing to re-seed and nets to zero on the invoice", () => {
  const orig = pay();
  const rev = buildPaymentReversal(orig, opts);
  const bill: any = { id: 7, retailer: "Sharma Store", phone: "9876543210", date: "2026-11-10", total: 1000, subtotal: 1000, amountPaid: 0, items: [] };
  assert.deepEqual(billPaymentGaps([bill], [orig, rev]), []);
  const out = calcReconcilePaymentsFromBills([orig, rev], [bill]);
  assert.equal(out.length, 2, "both rows stay in the history");
  assert.equal(out.reduce((t, p) => t + p.amount, 0), 0);
});

test("a reversed advance keeps counting against the advance pool", () => {
  const adv = pay({ id: "adv_1", billId: undefined, isAdvance: true, entryKind: "advance", amount: 500 });
  const rev = buildPaymentReversal(adv, opts);
  assert.equal(rev.isAdvance, true);
  assert.equal(rev.billId, undefined);
  const s = calcCustomerCreditSummary({ ledBills: [], ledPayments: [adv, rev], rawBalance: 0, allBills: [], allPayments: [adv, rev] });
  assert.equal(s.advance, 0);
  assert.equal(sumCustomerRecordedPaid([adv, rev]), 0);
});

test("a legacy advance flagged only by its note is still treated as an advance when reversed", () => {
  const adv = pay({ id: "adv_old", billId: undefined, isAdvance: undefined, entryKind: undefined, referenceNote: "Advance / on account", amount: 300 });
  assert.equal(buildPaymentReversal(adv, opts).isAdvance, true);
});

test("reversing a refund gives back a positive entry", () => {
  const refund = pay({ id: "ref_1", billId: undefined, amount: -200, isRefund: true, entryKind: "refund", isAdvance: true });
  const r = buildPaymentReversal(refund, opts);
  assert.equal(r.amount, 200);
  assert.equal(r.entryKind, "receipt");
});

test("blockers: twice, a reversal, an advance adjustment, an applied advance", () => {
  const orig = pay();
  const rev = buildPaymentReversal(orig, opts);
  assert.equal(paymentReversalBlocker(orig, [orig]), null);
  assert.match(paymentReversalBlocker(orig, [orig, rev])!, /already been reversed/);
  assert.match(paymentReversalBlocker(rev, [orig, rev])!, /itself a reversal/);
  assert.match(paymentReversalBlocker(pay({ entryKind: "advance_adjustment" }), [])!, /advance money onto an invoice/);
  assert.match(
    paymentReversalBlocker(pay({ billId: undefined, isAdvance: true, appliedAmount: 100 }), [])!,
    /already been used on invoices/,
  );
  assert.deepEqual([...reversedPaymentIds([orig, rev])], ["pay_1"]);
});

test("reversing an auto-created pay_bill_ row is not undone by the reconcile pass", () => {
  const synth = pay({ id: "pay_bill_7", amount: 1000, referenceNote: "Upfront payment on Invoice #7" });
  const rev = buildPaymentReversal(synth, opts);
  const bill: any = { id: 7, retailer: "Sharma Store", phone: "9876543210", date: "2026-11-10", total: 1000, subtotal: 1000, amountPaid: 0, items: [] };
  const out = calcReconcilePaymentsFromBills([synth, rev], [bill]);
  assert.equal(out.length, 2);
  assert.equal(out.reduce((t, p) => t + p.amount, 0), 0);
  // a second pass must not change anything either
  assert.equal(calcReconcilePaymentsFromBills(out, [bill]).length, 2);
});

test("editing a bill with lower total preserves 1 Nov cash receipt, adds reversal + advance so today nets to 0", () => {
  const nov1Cash = pay({
    id: "pay_nov1",
    billId: 10,
    customerName: "Kiran Mart",
    paymentDate: "2026-11-01",
    amount: 1000,
    mode: "cash",
    entryKind: "receipt",
    createdAt: "2026-11-01T10:00:00.000Z",
  });
  const editedBill = {
    id: 10,
    retailer: "Kiran Mart",
    phone: "9876543210",
    date: "2026-11-01",
    total: 800,
    subtotal: 800,
    amountPaid: 800,
    paymentMode: "upi" as const,
    items: [],
    returns: [],
  } as unknown as Bill;

  let seq = 0;
  const plan = planBillEditPayments({
    payments: [nov1Cash],
    bill: editedBill,
    targetPaid: 800,
    requestedPaid: 1000,
    today: "2026-11-15",
    nowIso: "2026-11-15T11:00:00.000Z",
    paymentDate: "2026-11-15",
    mode: "upi",
    recordedBy: "Admin",
    newId: (tag = "edit") => `pay_${tag}_${++seq}`,
    reason: "Invoice #10 edited",
  });

  const nextPayments = applyBillEditPaymentPlan([nov1Cash], editedBill, plan);

  // StrictMode idempotency: running updater twice leaves state identical
  assert.deepEqual(applyBillEditPaymentPlan(nextPayments, editedBill, plan), nextPayments);
  assert.equal(plan.removedAdjustmentIds.length, 0);

  // Original 1 Nov row is untouched
  const keptOrig = nextPayments.find((p) => p.id === "pay_nov1")!;
  assert.equal(keptOrig.amount, 1000);
  assert.equal(keptOrig.paymentDate, "2026-11-01");
  assert.equal(keptOrig.mode, "cash");

  // Reversal row + audit trail were created
  const revRow = nextPayments.find((p) => p.reversalOf === "pay_nov1")!;
  assert.ok(revRow, "must create a reversal row pointing at pay_nov1");
  assert.equal(revRow.amount, -1000);
  assert.equal(revRow.paymentDate, "2026-11-15");
  assert.equal(revRow.mode, "cash");
  assert.equal(plan.keptAsAdvance, 200);
  assert.ok(plan.auditEntries.some((a) => a.action === "reverse" && a.paymentId === "pay_nov1"));
  assert.ok(plan.auditEntries.some((a) => a.action === "invoice_edited" && a.amount === 200));

  // 1 Nov collection report stays exactly ₹1,000 cash
  const nov1Col = summarizeCollections({
    bills: [editedBill],
    payments: nextPayments,
    inPeriod: (d) => d === "2026-11-01",
  });
  assert.equal(nov1Col.total, 1000);
  assert.equal(nov1Col.cash, 1000);

  // Today (15 Nov) collection report gains ₹0 (no phantom ₹200 cash, no mode skew)
  const todayCol = summarizeCollections({
    bills: [editedBill],
    payments: nextPayments,
    inPeriod: (d) => d === "2026-11-15",
  });
  assert.equal(todayCol.total, 0);
  assert.equal(todayCol.cash, 0);
  assert.equal(todayCol.upi, 0);

  // Full period total stays ₹1,000 cash and count is 2 (800 receipt + 200 advance)
  const monthCol = summarizeCollections({
    bills: [editedBill],
    payments: nextPayments,
    inPeriod: (d) => d.startsWith("2026-11"),
  });
  assert.equal(monthCol.total, 1000);
  assert.equal(monthCol.cash, 1000);

  // Customer ledger & credit summary reflect ₹800 on bill and ₹200 advance
  assert.equal(sumCustomerRecordedPaid(nextPayments), 1000);
  const credit = calcCustomerCreditSummary({
    ledBills: [editedBill],
    ledPayments: nextPayments,
    rawBalance: 800 - 1000,
    allBills: [editedBill],
    allPayments: nextPayments,
  });
  assert.equal(credit.advance, 200);
  assert.equal(credit.unpaidDue, 0);
  assert.deepEqual(billPaymentGaps([editedBill], nextPayments), []);
  assert.equal(calcReconcilePaymentsFromBills(nextPayments, [editedBill]).length, nextPayments.length);
  const receipts = collectReceipts({
    bills: [editedBill],
    payments: nextPayments,
    resolver: makeBeatResolver([], []),
  });
  assert.equal(receipts.reduce((t, r) => t + r.amount, 0), 1000);
});

test("editing a bill to reduce paid amount (no advance kept) creates reversals across multiple modes and supports subsequent edits", () => {
  const cashPay = pay({
    id: "pay_1",
    billId: 25,
    paymentDate: "2026-11-01",
    amount: 600,
    mode: "cash",
    createdAt: "2026-11-01T09:00:00.000Z",
  });
  const upiPay = pay({
    id: "pay_2",
    billId: 25,
    paymentDate: "2026-11-05",
    amount: 400,
    mode: "upi",
    createdAt: "2026-11-05T09:00:00.000Z",
  });
  const bill = {
    id: 25,
    retailer: "Sharma Store",
    phone: "9876543210",
    date: "2026-11-01",
    total: 1000,
    subtotal: 1000,
    amountPaid: 300,
    paymentMode: "cash" as const,
    items: [],
    returns: [],
  } as unknown as Bill;

  let seq = 0;
  const plan1 = planBillEditPayments({
    payments: [cashPay, upiPay],
    bill,
    targetPaid: 300,
    today: "2026-11-12",
    nowIso: "2026-11-12T10:00:00.000Z",
    paymentDate: "2026-11-12",
    mode: "cash",
    recordedBy: "Admin",
    newId: (tag = "e") => `p1_${tag}_${++seq}`,
  });
  const afterFirst = applyBillEditPaymentPlan([cashPay, upiPay], bill, plan1);

  assert.equal(plan1.keptAsAdvance, 0);
  // Original receipts untouched
  assert.equal(afterFirst.find((p) => p.id === "pay_1")!.amount, 600);
  assert.equal(afterFirst.find((p) => p.id === "pay_2")!.amount, 400);
  // Historical day collections preserved
  assert.equal(
    summarizeCollections({ bills: [bill], payments: afterFirst, inPeriod: (d) => d === "2026-11-01" }).cash,
    600,
  );
  assert.equal(
    summarizeCollections({ bills: [bill], payments: afterFirst, inPeriod: (d) => d === "2026-11-05" }).upi,
    400,
  );
  // Net on 12 Nov = -400 UPI - 300 Cash = -700
  const day12 = summarizeCollections({ bills: [bill], payments: afterFirst, inPeriod: (d) => d === "2026-11-12" });
  assert.equal(day12.total, -700);
  assert.equal(day12.upi, -400);
  assert.equal(day12.cash, -300);
  assert.deepEqual(billPaymentGaps([bill], afterFirst), []);

  // Second edit lowers remaining paid from 300 to 0 cleanly
  const billZero = { ...bill, amountPaid: 0 };
  const plan2 = planBillEditPayments({
    payments: afterFirst,
    bill: billZero,
    targetPaid: 0,
    today: "2026-11-18",
    nowIso: "2026-11-18T10:00:00.000Z",
    paymentDate: "2026-11-18",
    mode: "cash",
    recordedBy: "Admin",
    newId: (tag = "e") => `p2_${tag}_${++seq}`,
  });
  const afterSecond = applyBillEditPaymentPlan(afterFirst, billZero, plan2);
  assert.equal(sumCustomerRecordedPaid(afterSecond), 0);
  assert.deepEqual(billPaymentGaps([billZero], afterSecond), []);
  // Replacement receipt from first edit can now be found as reversed in second edit
  const remRow = afterFirst.find((p) => p.billId === 25 && p.amount === 300)!;
  assert.ok(reversedPaymentIds(afterSecond).has(remRow.id));
});

test("editing a bill paid via internal advance_adjustment releases appliedAmount cleanly without duplicate advance", () => {
  const adv = pay({
    id: "adv_src",
    billId: undefined,
    isAdvance: true,
    entryKind: "advance",
    amount: 500,
    appliedAmount: 500,
    isAdvanceApplied: true,
    paymentDate: "2026-11-01",
    mode: "cash",
  });
  const adj = pay({
    id: "adj_1",
    billId: 30,
    sourcePaymentId: "adv_src",
    entryKind: "advance_adjustment",
    amount: 500,
    mode: "other",
    paymentDate: "2026-11-05",
    referenceNote: "Advance / credit adjusted against invoice #30",
  });
  const bill = {
    id: 30,
    retailer: "Sharma Store",
    phone: "9876543210",
    date: "2026-11-05",
    total: 300,
    subtotal: 300,
    amountPaid: 300,
    paymentMode: "cash" as const,
    items: [],
    returns: [],
  } as unknown as Bill;

  let seq = 0;
  const plan = planBillEditPayments({
    payments: [adv, adj],
    bill,
    targetPaid: 300,
    requestedPaid: 500,
    today: "2026-11-15",
    nowIso: "2026-11-15T10:00:00.000Z",
    paymentDate: "2026-11-15",
    mode: "cash",
    recordedBy: "Admin",
    newId: (tag = "e") => `padj_${tag}_${++seq}`,
  });

  const nextPayments = applyBillEditPaymentPlan([adv, adj], bill, plan);
  const updatedAdv = nextPayments.find((p) => p.id === "adv_src")!;
  assert.equal(updatedAdv.appliedAmount, 300);
  assert.equal(updatedAdv.isAdvanceApplied, false);
  // No spurious extra advance row created since freeing 200 on adv_src already restored ₹200 advance
  assert.equal(sumCustomerRecordedPaid(nextPayments), 500);
  const credit = calcCustomerCreditSummary({
    ledBills: [bill],
    ledPayments: nextPayments,
    rawBalance: 300 - 500,
    allBills: [bill],
    allPayments: nextPayments,
  });
  assert.equal(credit.advance, 200);
});

test("validatePaymentEdit rejects invalid or already-reversed edits before any reversal can happen", () => {
  const orig = pay({ id: "pay_1", amount: 600, mode: "cash", referenceNote: "UTR 1" });
  const rev = buildPaymentReversal(orig, opts);

  // Already reversed -> rejected
  const vReversed = validatePaymentEdit({ ...orig, amount: 700 }, [orig, rev]);
  assert.equal(vReversed.ok, false);
  assert.match((vReversed as { ok: false; error?: string }).error!, /already been reversed|no longer be edited/);

  // Editing a reversal or refund row -> rejected
  const vRevRow = validatePaymentEdit({ ...rev, amount: -500 }, [orig, rev]);
  assert.equal(vRevRow.ok, false);
  const refund = pay({ id: "ref_1", billId: undefined, amount: -100, isRefund: true, entryKind: "refund" });
  assert.equal(validatePaymentEdit({ ...refund, amount: -50 }, [refund]).ok, false);

  // Applied advance -> rejected before reversal
  const appliedAdv = pay({ id: "adv_used", billId: undefined, isAdvance: true, entryKind: "advance", amount: 500, appliedAmount: 200 });
  const vAdv = validatePaymentEdit({ ...appliedAdv, amount: 600 }, [appliedAdv]);
  assert.equal(vAdv.ok, false);
  assert.match((vAdv as { ok: false; error?: string }).error!, /already been used/);

  // Zero/negative replacement amount -> rejected
  const vZero = validatePaymentEdit({ ...orig, amount: 0 }, [orig]);
  assert.equal(vZero.ok, false);
  assert.match((vZero as { ok: false; error?: string }).error!, /above zero/);

  // Unknown payment id or no-op edit -> rejected (no phantom activity log)
  assert.equal(validatePaymentEdit({ ...orig, id: "missing_id" }, [orig]).ok, false);
  assert.equal(validatePaymentEdit({ ...orig }, [orig]).ok, false);

  // Note-only change -> allowed in-place
  const vNote = validatePaymentEdit({ ...orig, referenceNote: "Updated UTR" }, [orig]);
  assert.deepEqual(vNote, { ok: true, kind: "note_only", cleanCustomer: "Sharma Store", newAmount: 600 });

  // Whitespace updated.customerName falls back cleanly to old.customerName instead of failing mid-edit
  const vModeChange = validatePaymentEdit({ ...orig, customerName: "   ", mode: "upi" }, [orig]);
  assert.deepEqual(vModeChange, { ok: true, kind: "replace", cleanCustomer: "Sharma Store", newAmount: 600 });
});


