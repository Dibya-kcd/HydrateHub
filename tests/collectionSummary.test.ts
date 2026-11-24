import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeCollections } from '../src/utils/collectionSummary';
import { collectReceipts, makeBeatResolver } from '../src/utils/beatReports';
import type { Bill, PaymentRecord } from '../src/types';

const makeBill = (id: number, over: Partial<Bill> = {}): Bill =>
  ({
    id,
    date: '2026-11-10',
    retailer: 'Sri Balaji Stores',
    status: 'paid',
    items: [],
    subtotal: 1000,
    cgst: 0,
    sgst: 0,
    total: 1000,
    amountPaid: 0,
    additionalDiscount: 0,
    returns: [],
    ...over,
  }) as Bill;

const makePayment = (id: string, over: Partial<PaymentRecord> = {}): PaymentRecord =>
  ({
    id,
    customerName: 'Sri Balaji Stores',
    amount: 0,
    mode: 'cash',
    paymentDate: '2026-11-10',
    createdAt: '2026-11-10T10:00:00Z',
    ...over,
  }) as PaymentRecord;

test('summarizeCollections matches collectReceipts across same-period later payments, advances, refunds, and cancelled bills', () => {
  const bills: Bill[] = [
    // Bill 1: paid partly upfront (cash) and partly on a later date in same month (upi)
    makeBill(1, { date: '2026-11-05', total: 1000, amountPaid: 1000, paymentMode: 'cash' }),
    // Bill 2: legacy paid bill with no payment rows
    makeBill(2, { date: '2026-11-08', total: 500, amountPaid: 500, paymentMode: 'upi' }),
    // Bill 3: cancelled bill with stale amountPaid (must be ignored)
    makeBill(3, { date: '2026-11-09', status: 'cancelled', total: 900, amountPaid: 900, paymentMode: 'cash' }),
    // Bill 4: October bill collected in November
    makeBill(4, { date: '2026-10-20', total: 800, amountPaid: 800, paymentMode: 'credit' }),
  ];

  const payments: PaymentRecord[] = [
    // Upfront cash on Bill 1 (05 Nov)
    makePayment('p1', { billId: 1, amount: 400, mode: 'cash', paymentDate: '2026-11-05' }),
    // Later UPI on Bill 1 (12 Nov) — previously double-counted in ReportsMobileHome/ReportsOverview!
    makePayment('p2', { billId: 1, amount: 600, mode: 'upi', paymentDate: '2026-11-12' }),
    // Collection in Nov for Oct Bill 4 — previously missing on Home!
    makePayment('p3', { billId: 4, amount: 800, mode: 'cheque', paymentDate: '2026-11-15' }),
    // Advance / on-account receipt in Nov — previously missing on Home!
    makePayment('p4', { billId: undefined, isAdvance: true, amount: 250, mode: 'bank', paymentDate: '2026-11-18' }),
    // Advance adjustment row (moving existing credit onto a bill) — NOT new cash collected
    makePayment('p5', {
      billId: 1,
      amount: 100,
      mode: 'cash',
      paymentDate: '2026-11-19',
      referenceNote: 'Advance / credit adjusted against invoice #1',
    }),
    // Refund — NOT collected money
    makePayment('p6', { billId: 1, isRefund: true, amount: 150, mode: 'cash', paymentDate: '2026-11-19' }),
  ];

  const inNov = (d: string) => d.startsWith('2026-11');
  const summary = summarizeCollections({ bills, payments, inPeriod: inNov });

  // Expected in Nov:
  // p1 (400 cash) + p2 (600 upi) + Bill 2 fallback (500 upi) + p3 (800 cheque) + p4 (250 bank) = 2550 gross
  // minus p6 refund (-150 cash) = 2400 net total (250 cash, 2150 nonCash)
  assert.equal(summary.cash, 250);
  assert.equal(summary.upi, 1100);
  assert.equal(summary.cheque, 800);
  assert.equal(summary.bank, 250);
  assert.equal(summary.nonCash, 2150);
  assert.equal(summary.grossTotal, 2550);
  assert.equal(summary.refunded, 150);
  assert.equal(summary.refundCash, 150);
  assert.equal(summary.refundNonCash, 0);
  assert.equal(summary.total, 2400);
  assert.equal(summary.cash + summary.nonCash, summary.total);

  // Must equal collectReceipts total for the exact same period!
  const resolver = makeBeatResolver([], []);
  const receiptsTotal = collectReceipts({ bills, payments, resolver })
    .filter((r) => inNov(r.date))
    .reduce((s, r) => s + r.amount, 0);
  assert.equal(summary.total, receiptsTotal);
});

test('summarizeCollections caps legacy bill fallback at billNetTotal after sales returns and ignores credit mode', () => {
  const bills: Bill[] = [
    makeBill(10, {
      date: '2026-11-10',
      total: 1000,
      amountPaid: 1000,
      paymentMode: 'cash',
      returns: [{ id: 'r1', date: '2026-11-10', totalCredit: 200, lines: [] } as any],
    }),
    makeBill(11, {
      date: '2026-11-10',
      total: 600,
      amountPaid: 600,
      paymentMode: 'credit',
    }),
  ];

  const summary = summarizeCollections({
    bills,
    payments: [],
    inPeriod: (d) => d === '2026-11-10',
  });

  assert.equal(summary.total, 800);
  assert.equal(summary.cash, 800);
});

test('Jafru grocery: changing payment mode from cash to UPI cancels cash and counts only UPI', () => {
  const bills: Bill[] = [
    makeBill(20, {
      retailer: 'Jafru grocery',
      date: '2026-11-23',
      total: 1000,
      amountPaid: 1000,
      paymentMode: 'cash',
    }),
  ];

  const payments: PaymentRecord[] = [
    makePayment('pay_j1', {
      customerName: 'Jafru grocery',
      billId: 20,
      amount: 1000,
      mode: 'cash',
      paymentDate: '2026-11-23',
    }),
    makePayment('pay_j1_rev', {
      customerName: 'Jafru grocery',
      billId: 20,
      amount: -1000,
      mode: 'cash',
      paymentDate: '2026-11-23',
      reversalOf: 'pay_j1',
      entryKind: 'reversal',
    }),
    makePayment('pay_j2', {
      customerName: 'Jafru grocery',
      billId: 20,
      amount: 1000,
      mode: 'upi',
      paymentDate: '2026-11-23',
    }),
  ];

  const onDay = (d: string) => d === '2026-11-23';
  const summary = summarizeCollections({ bills, payments, inPeriod: onDay });

  assert.equal(summary.cash, 0);
  assert.equal(summary.upi, 1000);
  assert.equal(summary.total, 1000);
  assert.equal(summary.count, 1);

  const resolver = makeBeatResolver([], []);
  const receipts = collectReceipts({ bills, payments, resolver }).filter((r) => onDay(r.date));
  assert.equal(
    receipts.filter((r) => r.mode === 'cash').reduce((s, r) => s + r.amount, 0),
    0,
  );
  assert.equal(
    receipts.filter((r) => r.mode === 'upi').reduce((s, r) => s + r.amount, 0),
    1000,
  );
  assert.equal(
    receipts.reduce((s, r) => s + r.amount, 0),
    1000,
  );
});

test('refunds (negative or legacy positive) deduct cleanly once and refund reversals restore total', () => {
  const bills: Bill[] = [
    makeBill(30, {
      retailer: 'Jafru grocery',
      date: '2026-11-23',
      total: 500,
      amountPaid: 500,
      paymentMode: 'upi',
    }),
  ];

  const payments: PaymentRecord[] = [
    makePayment('p_upi', {
      customerName: 'Jafru grocery',
      billId: 30,
      amount: 500,
      mode: 'upi',
      paymentDate: '2026-11-23',
    }),
    // Standard negative-stored cash refund
    makePayment('p_ref_neg', {
      customerName: 'Jafru grocery',
      amount: -200,
      mode: 'cash',
      isRefund: true,
      entryKind: 'refund',
      paymentDate: '2026-11-23',
    }),
    // Legacy positive-stored refund row
    makePayment('p_ref_pos', {
      customerName: 'Jafru grocery',
      amount: 100,
      mode: 'cash',
      isRefund: true,
      entryKind: 'refund',
      paymentDate: '2026-11-23',
    }),
    // Reversal of the -200 refund (+200 cash back)
    makePayment('p_ref_rev', {
      customerName: 'Jafru grocery',
      amount: 200,
      mode: 'cash',
      reversalOf: 'p_ref_neg',
      entryKind: 'reversal',
      paymentDate: '2026-11-23',
    }),
  ];

  const onDay = (d: string) => d === '2026-11-23';
  const summary = summarizeCollections({ bills, payments, inPeriod: onDay });

  // Gross UPI = 500; refunds = 200 + 100 - 200 = 100 cash
  assert.equal(summary.grossTotal, 500);
  assert.equal(summary.refunded, 100);
  assert.equal(summary.refundCash, 100);
  assert.equal(summary.upi, 500);
  assert.equal(summary.cash, -100);
  assert.equal(summary.total, 400);

  const resolver = makeBeatResolver([], []);
  const receiptsTotal = collectReceipts({ bills, payments, resolver })
    .filter((r) => onDay(r.date))
    .reduce((s, r) => s + r.amount, 0);
  assert.equal(receiptsTotal, 400);
});
