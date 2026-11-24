import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeCollections } from '../src/utils/collectionSummary';
import { buildDueInvoices, collectReceipts, makeBeatResolver } from '../src/utils/beatReports';
import {
  billPaymentGaps,
  splitUnlinkedPayments,
  sumCustomerRecordedPaid,
} from '../src/utils/paymentAllocation';
import {
  calcMissingBillPaymentRows,
  calcReconcilePaymentsFromBills,
} from '../src/context/ledgerPaymentCalculations';
import { computeCustomerDetailLedger } from '../src/components/views/customers/useCustomerDetailLedger';
import type { Bill, ExistingCustomer, PaymentRecord } from '../src/types';

const makeBill = (id: number, over: Partial<Bill> = {}): Bill =>
  ({
    id,
    date: '2026-11-23',
    retailer: 'Jafru grocery',
    phone: '9876543210',
    status: 'paid',
    items: [],
    subtotal: 1000,
    cgst: 0,
    sgst: 0,
    total: 1000,
    amountPaid: 1000,
    additionalDiscount: 0,
    paymentMode: 'upi',
    returns: [],
    ...over,
  }) as Bill;

const makePayment = (id: string, over: Partial<PaymentRecord> = {}): PaymentRecord =>
  ({
    id,
    customerName: 'Jafru grocery',
    customerPhone: '9876543210',
    amount: 0,
    mode: 'cash',
    paymentDate: '2026-11-23',
    createdAt: '2026-11-23T10:00:00Z',
    ...over,
  }) as PaymentRecord;

test('Cash -> UPI mode switch + refund on Jafru grocery never spawns dummy pay_bill_* rows or double-deducts', () => {
  const bill = makeBill(20, { total: 1000, amountPaid: 1000, paymentMode: 'upi' });
  const payments: PaymentRecord[] = [
    makePayment('pay_cash_1', {
      billId: 20,
      amount: 1000,
      mode: 'cash',
    }),
    makePayment('pay_cash_1_rev', {
      billId: 20,
      amount: -1000,
      mode: 'cash',
      reversalOf: 'pay_cash_1',
      entryKind: 'reversal',
    }),
    makePayment('pay_upi_2', {
      billId: 20,
      amount: 1000,
      mode: 'upi',
    }),
    // Refund of 200 tied to the same bill (both negative and reversed refund cases tested separately)
    makePayment('pay_ref_1', {
      billId: 20,
      amount: -200,
      mode: 'cash',
      isRefund: true,
      entryKind: 'refund',
    }),
  ];

  // 1. Collection summary deducts the 200 refund cleanly once, keeps cash = -200, upi = 1000, total = 800, count = 1 receipt
  const summary = summarizeCollections({
    bills: [bill],
    payments,
    inPeriod: (d) => d === '2026-11-23',
  });
  assert.equal(summary.grossTotal, 1000);
  assert.equal(summary.refunded, 200);
  assert.equal(summary.upi, 1000);
  assert.equal(summary.cash, -200);
  assert.equal(summary.total, 800);
  assert.equal(summary.count, 1);

  // 2. Beat receipts match exact net 800 total (0 cash receipt + 1000 upi - 200 cash refund)
  const resolver = makeBeatResolver([], []);
  const receipts = collectReceipts({ bills: [bill], payments, resolver });
  assert.equal(receipts.reduce((s, r) => s + r.amount, 0), 800);

  // 3. No phantom gaps or synthetic pay_bill_* / legacy_pay_* dummy rows created because refunds do NOT reduce bill's paid allocation
  assert.deepEqual(billPaymentGaps([bill], payments), []);
  assert.deepEqual(calcMissingBillPaymentRows([bill], payments), []);
  const reconciled = calcReconcilePaymentsFromBills(payments, [bill]);
  assert.equal(
    reconciled.some((p) => p.id.startsWith('pay_bill_') || p.id.startsWith('legacy_pay_')),
    false,
    'Refund on a paid bill must not synthesize pay_bill_ or legacy_pay_ rows',
  );
  assert.equal(reconciled.length, payments.length);

  // 4. splitUnlinkedPayments leaves all rows untouched
  let seq = 0;
  const split = splitUnlinkedPayments(payments, () => [bill], () => `new_${++seq}`);
  assert.equal(split.changed, 0);
  assert.equal(split.payments.length, payments.length);

  // 5. buildDueInvoices sees bill 20 as settled (due = 0), not falsely unpaid by 200 due to bill-linked refund
  const dueRes = buildDueInvoices({
    bills: [bill],
    payments,
    customers: [],
    beats: [],
    today: '2026-11-23',
  });
  assert.equal(dueRes.rows.length, 0);
});

test('computeCustomerDetailLedger deducts legacy positive & negative refunds once and avoids double-counting linked advance adjustments', () => {
  const bill = makeBill(40, { total: 1000, amountPaid: 800, status: 'credit', paymentMode: 'upi' });
  const adv = makePayment('adv_1', {
    billId: undefined,
    amount: 500,
    mode: 'upi',
    isAdvance: true,
    entryKind: 'advance',
    appliedAmount: 300,
    paymentDate: '2026-11-20',
  });
  const adj = makePayment('adj_1', {
    billId: 40,
    amount: 300,
    mode: 'other',
    entryKind: 'advance_adjustment',
    sourcePaymentId: 'adv_1',
    referenceNote: 'Advance / credit adjusted against invoice #40',
    paymentDate: '2026-11-21',
  });
  const cashPay = makePayment('p_cash', {
    billId: 40,
    amount: 500,
    mode: 'cash',
    paymentDate: '2026-11-22',
  });
  // Legacy positive-stored refund row of 100 should have cash impact -100 (raising customer balance back up by 100)
  const legacyRefund = makePayment('p_ref_legacy', {
    billId: undefined,
    amount: 100,
    mode: 'cash',
    isRefund: true,
    entryKind: 'refund',
    paymentDate: '2026-11-23',
  });

  const custPayments = [adv, adj, cashPay, legacyRefund];
  // Net paid = 500 (adv) + 500 (cashPay) - 100 (legacyRefund) = 900 (adj of 300 skipped because adv_1 is present)
  const totalPaid = sumCustomerRecordedPaid(custPayments);
  assert.equal(totalPaid, 900);

  const customer: ExistingCustomer = {
    id: 'cust_jafru',
    name: 'Jafru grocery',
    phone: '9876543210',
    totalBills: 1,
    totalBilled: 1000,
    totalPaid: 900,
    balanceDue: 100,
    lastBillDate: '2026-11-23',
  };

  const res = computeCustomerDetailLedger({
    customer,
    language: 'en',
    customerNameMap: new Map(),
    customerTypeById: new Map(),
    customerTypeByName: new Map(),
    ledgerFilter: 'all',
    getCustomerLedger: () => ({
      customer,
      bills: [bill],
      payments: custPayments,
      openingBalance: 0,
      totalBilled: 1000,
      totalReturns: 0,
      totalPaid: 900,
      balanceDue: 100,
      rawBalance: 100,
      isOverLimit: false,
    }),
    getCustomerCreditSummary: () => ({
      advance: 200,
      overpaid: 0,
      unpaidDue: 100,
      refundable: 0,
      canApply: true,
    }),
  });

  const lastEntry = res.entriesWithBalance[res.entriesWithBalance.length - 1];
  assert.equal(lastEntry.runningBalance, 100);
});
