// Pure text & 80mm-row builder for Payment Receipts (no jsPDF import, so startup chunks stay lean).
import type { OrganizationProfile, PaymentMode, PaymentRecord } from '../types';
import { formatPaymentId } from './beatReports';
import { money } from './billing';
import { todayISO } from './dateLocal';
import type { ReceiptRow } from './receiptText';

export interface PaymentReceiptBalanceInfo {
  /** Net customer balance till date (> 0 = due, 0 = settled, < 0 = advance credit). */
  rawBalance: number;
  /** Optional explicit "as of" date (YYYY-MM-DD). */
  asOfDate?: string;
}

/** Standard PDF fonts only know Latin-1: swap symbols that would print as junk. */
const plain = (s: string): string =>
  String(s ?? '')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u00b7\u2022\u2023]/g, '-')
    .replace(/\u00d7/g, 'x')
    .replace(/\u20b9/g, 'Rs ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/\s+/g, ' ')
    .trim();

export function resolveRemainingDueParts(rawBalance: number): {
  due: number;
  advance: number;
} {
  const rounded = Math.round((Number(rawBalance) || 0) * 100) / 100;
  return {
    due: rounded > 0.004 ? rounded : 0,
    advance: rounded < -0.004 ? Math.round(Math.abs(rounded) * 100) / 100 : 0,
  };
}

export function formatPaymentModeLabel(mode?: PaymentMode | string): string {
  switch (String(mode || 'cash').toLowerCase()) {
    case 'upi':
      return 'UPI / QR';
    case 'bank':
      return 'BANK / NEFT';
    case 'cheque':
      return 'CHEQUE';
    case 'other':
      return 'OTHER';
    default:
      return 'CASH';
  }
}

export function paymentReceiptPdfFilename(payment: PaymentRecord): string {
  const rcpId = formatPaymentId(payment.id).replace(/[^A-Za-z0-9_-]/g, '');
  const partySlug = plain(payment.customerName || 'Customer')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 28) || 'Customer';
  return `Receipt_${rcpId || 'PAY'}_${partySlug}_80mm.pdf`;
}

export function buildPaymentReceiptRows(
  payment: PaymentRecord,
  org?: OrganizationProfile,
  balanceInfo?: PaymentReceiptBalanceInfo,
): ReceiptRow[] {
  const rows: ReceiptRow[] = [];
  const isRefund = Boolean(payment.isRefund || payment.amount < 0);
  const absAmount = Math.abs(Number(payment.amount) || 0);
  const receiptDate = String(payment.paymentDate || payment.createdAt || todayISO()).slice(0, 10);
  const receiptNo = formatPaymentId(payment.id);

  // ---- Header ----------------------------------------------------------------
  rows.push({ k: 'title', text: plain(org?.name || 'Hydrate Hub').toUpperCase() });
  const address = [org?.address, org?.city].filter(Boolean).join(', ');
  if (address) rows.push({ k: 'center', text: plain(address), small: true });
  if (org?.phone) rows.push({ k: 'center', text: `Ph: ${plain(org.phone)}`, small: true });
  if (org?.gstin) rows.push({ k: 'center', text: `GSTIN: ${plain(org.gstin)}`, small: true });
  rows.push({ k: 'rule', style: 'dash' });

  rows.push({
    k: 'center',
    text: isRefund ? 'PAYMENT REFUND RECEIPT' : 'PAYMENT RECEIPT',
    bold: true,
  });
  rows.push({ k: 'kv', left: 'Receipt No', right: receiptNo, bold: true });
  rows.push({ k: 'kv', left: 'Date', right: receiptDate });
  rows.push({
    k: 'wrap',
    text: `Customer: ${plain(payment.customerName || 'Customer')}`,
    bold: true,
  });
  if (payment.customerPhone) {
    rows.push({ k: 'kv', left: 'Phone', right: plain(payment.customerPhone) });
  }
  rows.push({ k: 'rule', style: 'dash' });

  // ---- Payment Metadata ------------------------------------------------------
  rows.push({ k: 'kv', left: 'Mode', right: formatPaymentModeLabel(payment.mode), bold: true });
  rows.push({
    k: 'kv',
    left: 'Against',
    right: payment.billId ? `Invoice #${payment.billId}` : 'On account',
  });
  if (payment.referenceNote) {
    rows.push({ k: 'wrap', text: `Ref / Note: ${plain(payment.referenceNote)}`, small: true });
  }
  if (payment.recordedBy) {
    rows.push({ k: 'kv', left: 'Recorded By', right: plain(payment.recordedBy) });
  }

  // ---- Amount Paid / Refunded ------------------------------------------------
  rows.push({ k: 'rule', style: 'double' });
  rows.push({
    k: 'kv',
    left: isRefund ? 'Amount Refunded' : 'Amount Received',
    right: `Rs ${money(absAmount)}`,
    bold: true,
    big: true,
  });

  // ---- Remaining Total Due Till Date ----------------------------------------
  if (balanceInfo !== undefined && Number.isFinite(balanceInfo.rawBalance)) {
    const { due, advance } = resolveRemainingDueParts(balanceInfo.rawBalance);
    rows.push({ k: 'rule', style: 'dash' });
    if (due > 0) {
      rows.push({
        k: 'kv',
        left: 'Remaining Due (Till Date)',
        right: `Rs ${money(due)}`,
        bold: true,
        big: true,
      });
    } else if (advance > 0) {
      rows.push({
        k: 'kv',
        left: 'Remaining Due (Till Date)',
        right: 'Rs 0.00',
        bold: true,
      });
      rows.push({
        k: 'kv',
        left: 'Advance Credit',
        right: `Rs ${money(advance)}`,
        bold: true,
      });
    } else {
      rows.push({
        k: 'kv',
        left: 'Remaining Due (Till Date)',
        right: 'Rs 0.00 (Settled)',
        bold: true,
      });
    }
    const asOf = balanceInfo.asOfDate || todayISO();
    rows.push({ k: 'center', text: `Balance as of ${asOf}`, small: true });
  }

  // ---- Footer ----------------------------------------------------------------
  rows.push({ k: 'rule', style: 'double' });
  rows.push({
    k: 'center',
    text: isRefund ? 'Refund acknowledgment receipt.' : 'Thank you for your payment!',
    bold: true,
  });

  return rows;
}

export function buildPaymentReceiptCaption(
  payment: PaymentRecord,
  org?: OrganizationProfile,
  balanceInfo?: PaymentReceiptBalanceInfo,
): string {
  const orgName = org?.name || 'Hydrate Hub';
  const isRefund = Boolean(payment.isRefund || payment.amount < 0);
  const absAmount = Math.abs(Number(payment.amount) || 0);
  const receiptDate = String(payment.paymentDate || payment.createdAt || todayISO()).slice(0, 10);
  const receiptNo = formatPaymentId(payment.id);
  const modeLabel = formatPaymentModeLabel(payment.mode);

  const lines: string[] = [
    orgName,
    `${isRefund ? 'Refund Receipt' : 'Payment Receipt'} ${receiptNo} · ${receiptDate}`,
    `Customer: ${payment.customerName || 'Customer'}`,
    `${isRefund ? 'Refunded' : 'Paid'}: ₹${money(absAmount)} (${modeLabel})${payment.billId ? ` · INV-${payment.billId}` : ''}`,
  ];

  if (balanceInfo !== undefined && Number.isFinite(balanceInfo.rawBalance)) {
    const { due, advance } = resolveRemainingDueParts(balanceInfo.rawBalance);
    if (due > 0) {
      lines.push(`Remaining Total Due (Till Date): ₹${money(due)}`);
    } else if (advance > 0) {
      lines.push(`Remaining Total Due (Till Date): ₹0.00 (Advance: ₹${money(advance)})`);
    } else {
      lines.push(`Remaining Total Due (Till Date): ₹0.00 (Settled)`);
    }
  }

  lines.push('Thank you!');
  return lines.join('\n');
}
