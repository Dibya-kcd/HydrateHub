/**
 * ONE definition of "collection / received" for every screen (Home, Reports overview,
 * Reports mobile home, Daily collection, and Customer receipts).
 *
 * Rules (matching utils/beatReports.ts collectReceipts):
 *   1. Cancelled bills are ignored.
 *   2. Non-'credit', non-advance-adjustment rows in `payments` are counted on their receipt date
 *      (`paymentDate || createdAt`), including reversal entries (e.g. Cash -> UPI edits) and
 *      customer refunds (negative signed amounts), so reversed receipts and refunds are always
 *      deducted accurately without ever double-counting or dropping edits.
 *   3. Any live bill with NO positive non-refund payment rows (older / pre-ledger data)
 *      falls back to `Math.min(billNetTotal(b), Number(b.amountPaid) || 0)` on `b.date`,
 *      unless `b.paymentMode === 'credit'`.
 *
 * Read-only: nothing is written anywhere.
 */
import type { Bill, PaymentRecord } from '../types';
import { isAdvanceAdjustmentRow, isRefundRow, signedPaymentAmount } from './paymentAllocation';
import { billNetTotal, round2 } from './salesReturns';

export interface CollectionSummary {
  /** Net money collected in the period (gross receipts minus reversals and refunds). */
  total: number;
  /** Receipts net of reversals, before refunds. */
  grossTotal: number;
  /** Net customer refunds issued in the period (positive magnitude). */
  refunded: number;
  refundCash: number;
  refundNonCash: number;
  cash: number;
  upi: number;
  cheque: number;
  bank: number;
  other: number;
  /** UPI + bank + other (non-cash, non-cheque electronic/other). */
  digital: number;
  /** Everything other than cash (upi + bank + cheque + other), so `cash + nonCash === total`. */
  nonCash: number;
  /** Number of receipt / fallback-paid-bill entries counted. */
  count: number;
}

const isLiveBill = (b: Bill): boolean =>
  b.status !== 'cancelled' && !b.cancelled && !b.cancellation;

export function summarizeCollections(args: {
  bills?: Bill[] | null;
  payments?: PaymentRecord[] | null;
  inPeriod: (dateStr: string) => boolean;
}): CollectionSummary {
  const { bills, payments, inPeriod } = args;
  const liveBills = (bills || []).filter(isLiveBill);
  const billsWithRows = new Set<number>();
  const refundIds = new Set<string>();
  const reversedInPeriod = new Set<string>();

  for (const p of payments || []) {
    if (p.id && isRefundRow(p)) refundIds.add(String(p.id));
    if (p.reversalOf && p.mode !== 'credit') {
      const pDate = String(p.paymentDate || p.createdAt || '').slice(0, 10);
      if (pDate && inPeriod(pDate)) {
        reversedInPeriod.add(String(p.reversalOf));
      }
    }
  }

  let cash = 0;
  let upi = 0;
  let cheque = 0;
  let bank = 0;
  let other = 0;
  let refundCash = 0;
  let refundNonCash = 0;
  let count = 0;

  const addMode = (mode: string | undefined, amt: number, countReceipt = true) => {
    const m = (mode || 'cash').toLowerCase();
    if (m === 'cash') cash += amt;
    else if (m === 'upi') upi += amt;
    else if (m === 'cheque') cheque += amt;
    else if (m === 'bank') bank += amt;
    else other += amt;
    if (countReceipt) count += 1;
  };

  for (const p of payments || []) {
    const signedAmt = signedPaymentAmount(p);
    const isRef = isRefundRow(p);
    if (!isRef && signedAmt > 0 && p.billId) {
      billsWithRows.add(p.billId);
    }
    if (signedAmt === 0 || p.mode === 'credit' || isAdvanceAdjustmentRow(p)) {
      continue;
    }
    const pDate = String(p.paymentDate || p.createdAt || '').slice(0, 10);
    if (!pDate || !inPeriod(pDate)) continue;

    const m = (p.mode || 'cash').toLowerCase();
    const isRefundReversal = Boolean(p.reversalOf && refundIds.has(String(p.reversalOf)));

    if (isRef) {
      const mag = Math.abs(signedAmt);
      if (m === 'cash') refundCash += mag;
      else refundNonCash += mag;
      addMode(p.mode, -mag, false);
      continue;
    }

    if (isRefundReversal) {
      const mag = Math.abs(signedAmt);
      if (m === 'cash') refundCash -= mag;
      else refundNonCash -= mag;
      addMode(p.mode, mag, false);
      continue;
    }

    const isReversedHere = Boolean(p.id && reversedInPeriod.has(String(p.id)));
    addMode(p.mode, signedAmt, !p.reversalOf && signedAmt > 0 && !isReversedHere);
  }

  for (const b of liveBills) {
    if (billsWithRows.has(b.id)) continue;
    const paid = Math.min(billNetTotal(b), Math.max(0, Number(b.amountPaid) || 0));
    const mode = b.paymentMode || 'cash';
    const bDate = String(b.date || '').slice(0, 10);
    if (paid <= 0 || mode === 'credit' || !bDate || !inPeriod(bDate)) continue;
    addMode(mode, paid, true);
  }

  const rCash = round2(cash);
  const rUpi = round2(upi);
  const rCheque = round2(cheque);
  const rBank = round2(bank);
  const rOther = round2(other);
  const digital = round2(rUpi + rBank + rOther);
  const nonCash = round2(rUpi + rBank + rCheque + rOther);
  const total = round2(rCash + nonCash);
  const rRefundCash = round2(refundCash);
  const rRefundNonCash = round2(refundNonCash);
  const refunded = round2(rRefundCash + rRefundNonCash);
  const grossTotal = round2(total + refunded);

  return {
    total,
    grossTotal,
    refunded,
    refundCash: rRefundCash,
    refundNonCash: rRefundNonCash,
    cash: rCash,
    upi: rUpi,
    cheque: rCheque,
    bank: rBank,
    other: rOther,
    digital,
    nonCash,
    count,
  };
}
