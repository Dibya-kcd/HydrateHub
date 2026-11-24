import { Bill, BillingSettings, Product, Salesman } from '../types';

/** Shared by the A4 invoice PDF, the 80mm receipt and the WhatsApp text, so all three agree. */
export function inrToWords(num: number): string {
  if (isNaN(num) || num <= 0) return 'Rupees Zero Only';

  const a = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convertTwoDigits = (n: number): string => {
    if (n === 0) return '';
    if (n < 20) return a[n];
    return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
  };

  const convertThreeDigits = (n: number): string => {
    const hundred = Math.floor(n / 100);
    const remainder = n % 100;
    let res = '';
    if (hundred > 0) res += a[hundred] + ' Hundred';
    if (remainder > 0) res += (res ? ' and ' : '') + convertTwoDigits(remainder);
    return res;
  };

  const whole = Math.floor(num);
  const paise = Math.round((num - whole) * 100);

  let crore = Math.floor(whole / 10000000);
  let lakh = Math.floor((whole % 10000000) / 100000);
  let thousand = Math.floor((whole % 100000) / 1000);
  let remainder = whole % 1000;

  let parts: string[] = [];
  if (crore > 0) parts.push(convertThreeDigits(crore) + ' Crore');
  if (lakh > 0) parts.push(convertThreeDigits(lakh) + ' Lakh');
  if (thousand > 0) parts.push(convertThreeDigits(thousand) + ' Thousand');
  if (remainder > 0) parts.push(convertThreeDigits(remainder));

  let res = 'Rupees ' + (parts.join(' ') || 'Zero');
  if (paise > 0) {
    res += ' and ' + convertTwoDigits(paise) + ' Paise';
  }
  return res + ' Only';
}

/**
 * True when a bill is a Non-GST / Trading memo that must be completely excluded
 * from all GST returns (GSTR-1, GSTR-3B, HSN, e-Way, CA packs) and tax invoice series.
 * It still remains active in stock, customer credit ledger, payments, and internal P&L.
 */
/** One definition of "this cart/bill line is Non-GST": the line says so, or its product master does. */
export function isLineNonGst(
  item: { productId?: number | string; taxability?: string },
  products?: Product[],
): boolean {
  if (item.taxability === 'non_gst') return true;
  if (!products || item.productId === undefined) return false;
  const p = products.find((x) => Number(x.id) === Number(item.productId));
  return p?.taxability === 'non_gst';
}

/** Splits a cart into GST-taxable and Non-GST lines using isLineNonGst. */
export function cartTaxMix<T extends { productId?: number | string; taxability?: string }>(
  items: T[],
  products?: Product[],
) {
  const nonGst = items.filter((it) => isLineNonGst(it, products));
  const taxable = items.filter((it) => !isLineNonGst(it, products));
  return {
    nonGst,
    taxable,
    hasMixed: nonGst.length > 0 && taxable.length > 0,
    allNonGst: items.length > 0 && taxable.length === 0,
  };
}

export function isGstExcludedBill(bill?: Partial<Bill> | null, products?: Product[]): boolean {
  if (!bill) return false;
  if (bill.gstExclude === true || bill.docSeries === 'non_gst') return true;
  if (bill.docNo && bill.docNo.toUpperCase().startsWith('NG-')) return true;
  const items = bill.items || [];
  if (items.length === 0) return false;
  const prodMap = products && products.length > 0
    ? new Map<number, Product>(products.map((p) => [Number(p.id), p]))
    : null;
  return items.every((it) => {
    if (it.taxability === 'non_gst') return true;
    const p = prodMap?.get(Number(it.productId));
    return p?.taxability === 'non_gst';
  });
}

/**
 * True when an active (non-cancelled) bill mixes at least one GST-taxable item
 * and at least one Non-GST item on the same document.
 */
export function isMixedTaxBill(bill?: Partial<Bill> | null, products?: Product[]): boolean {
  if (!bill || bill.status === 'cancelled' || (bill as any).cancelled) return false;
  const items = bill.items || [];
  if (items.length < 2) return false;
  return cartTaxMix(items, products).hasMixed;
}

export interface MixedTaxBillInfo {
  bill: Bill;
  nonGstLines: number;
  nonGstAmount: number;
  nonGstProductNames: string[];
  canAutoSplit: boolean;
}

/**
 * Finds active GST-series bills that also carry Non-GST items inside them
 * (for example, when a Non-GST product was added to an existing INV- bill via Edit Bill).
 */
export function findMixedTaxBills(
  bills: Bill[],
  products?: Product[],
): {
  entries: MixedTaxBillInfo[];
  billCount: number;
  lineCount: number;
  nonGstAmount: number;
} {
  const entries: MixedTaxBillInfo[] = [];
  let lineCount = 0;
  let totalNonGst = 0;

  for (const b of bills || []) {
    if (b.status === 'cancelled' || (b as any).cancelled) continue;
    if (isGstExcludedBill(b, products)) continue;
    const mix = cartTaxMix(b.items || [], products);
    if (!mix.hasMixed) continue;

    const gross = (b.items || []).reduce((s, it) => s + Math.max(0, Number(it.amount) || 0), 0);
    const extraDisc = Math.max(0, Number(b.additionalDiscount) || 0);
    const factor = gross > 0 && extraDisc > 0 ? Math.max(0, gross - extraDisc) / gross : 1;
    const rawNonGstAmt = mix.nonGst.reduce((s, it) => s + Math.max(0, Number(it.amount) || 0), 0);
    const nonGstAmount = Math.round(rawNonGstAmt * factor * 100) / 100;

    const names = Array.from(
      new Set(
        mix.nonGst
          .map((it) => String(it.productName || '').trim())
          .filter(Boolean),
      ),
    );
    const hasReturns = Array.isArray(b.returns) && b.returns.length > 0;

    entries.push({
      bill: b,
      nonGstLines: mix.nonGst.length,
      nonGstAmount,
      nonGstProductNames: names,
      canAutoSplit: !hasReturns,
    });
    lineCount += mix.nonGst.length;
    totalNonGst += nonGstAmount;
  }

  return {
    entries,
    billCount: entries.length,
    lineCount,
    nonGstAmount: Math.round(totalNonGst * 100) / 100,
  };
}

export function isBillGstInvoice(bill: Bill, invoiceFormat?: 'gst' | 'non_gst'): boolean {
  if (bill.gstExclude === true || bill.docSeries === 'non_gst') return false;
  // A bill issued by a composition / unregistered business can never be shown as a Tax Invoice, whatever format is asked for.
  if (bill.taxStamp && bill.taxStamp.registrationType !== 'regular') return false;
  if (invoiceFormat !== undefined) return invoiceFormat === 'gst';
  if (bill.invoiceType === 'tax_invoice' || bill.isGstInvoice === true) return true;
  if (bill.invoiceType === 'retail' || bill.invoiceType === 'bill_of_supply' || bill.isGstInvoice === false) return false;
  return bill.supplyType === 'B2B' && Boolean(bill.customerGstin);
}

/**
 * Canonical display number for a bill:
 * - Uses stored `bill.docNo` when present (`INV-105`, `NG-1`, `INV-S1-1`, etc.)
 * - Falls back to `NG-${bill.id}` for Non-GST memos or `${prefix}-${bill.id}` for legacy invoices without `docNo`
 */
export function formatBillNumber(
  bill: Pick<Bill, 'id' | 'docNo' | 'docSeries' | 'gstExclude' | 'invoiceType' | 'isGstInvoice' | 'supplyType' | 'customerGstin' | 'taxStamp'>,
  settingsOrPrefix?: BillingSettings | string | null,
  invoiceFormat?: 'gst' | 'non_gst',
): string {
  if (bill.docNo && bill.docNo.trim()) return bill.docNo.trim();
  if (bill.docSeries === 'non_gst' || bill.gstExclude === true) return `NG-${bill.id}`;
  const isGst = isBillGstInvoice(bill as Bill, invoiceFormat);
  const customPrefix =
    typeof settingsOrPrefix === 'string'
      ? settingsOrPrefix.trim()
      : (settingsOrPrefix?.invoicePrefix || '').trim();
  const prefix = customPrefix || (isGst ? 'INV' : 'RET');
  return `${prefix}-${bill.id}`;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Extracts the sequential invoice number used by the shared GST invoice series
 * (`INV-105` -> 105, or legacy `bill.id` when `docNo` was never stored).
 * Returns 0 for Non-GST memos (`NG-*`) and per-salesman sub-series (`INV-S1-12`).
 */
export function parseGstSeriesSeq(
  bill: Partial<Pick<Bill, 'id' | 'docNo' | 'docSeries' | 'gstExclude' | 'items'>> | null | undefined,
  settingsOrPrefix?: BillingSettings | string | null,
  products?: Product[],
): number {
  if (!bill) return 0;
  if (bill.docSeries === 'non_gst' || bill.gstExclude === true) return 0;
  if (products && Array.isArray((bill as Bill).items) && (bill as Bill).items.length > 0) {
    if (isGstExcludedBill(bill as Bill, products)) return 0;
  }
  const dn = String(bill.docNo || '').trim();
  if (!dn) {
    const fallback = Number(bill.id);
    return Number.isFinite(fallback) && fallback > 0 ? fallback : 0;
  }
  if (/^NG-/i.test(dn)) return 0;
  const rawPrefix =
    typeof settingsOrPrefix === 'string'
      ? settingsOrPrefix.trim()
      : (settingsOrPrefix?.invoicePrefix || '').trim();
  const cleanPrefix = rawPrefix || 'INV';
  const customMatch = dn.match(new RegExp(`^${escapeRegex(cleanPrefix)}-(\\d+)$`, 'i'));
  if (customMatch) return Number(customMatch[1]) || 0;
  const stdMatch = dn.match(/^(?:INV|RET)-(\d+)$/i);
  if (stdMatch) return Number(stdMatch[1]) || 0;
  return 0;
}

export function highestGstInvoiceSeq(
  bills: Bill[],
  settingsOrPrefix?: BillingSettings | string | null,
  products?: Product[],
): number {
  let maxSeq = 0;
  for (const b of bills || []) {
    const seq = parseGstSeriesSeq(b, settingsOrPrefix, products);
    if (seq > maxSeq) maxSeq = seq;
  }
  return maxSeq;
}

export function makeBillClientUid(deviceId?: string): string {
  const cleanDev = String(deviceId || 'dev').replace(/[^a-zA-Z0-9]/g, '').slice(-8) || 'dev';
  return `bu_${cleanDev}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Resolves a short 2-3 character uppercase alphanumeric series code for a salesman
 * (e.g. 'S1', 'RK'). Uses configured seriesCode / billingSettings map if set, else a deterministic fallback.
 */
export function deriveSalesmanSeriesCode(
  salesman?: Pick<Salesman, 'id' | 'name' | 'seriesCode'> | null,
  allSalesmen: Pick<Salesman, 'id' | 'name' | 'seriesCode'>[] = [],
  settings?: BillingSettings | null,
): string {
  const mappedCode = salesman?.id && settings?.salesmanSeriesCodes?.[salesman.id];
  const explicit = String(mappedCode || salesman?.seriesCode || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 3);
  if (explicit) return explicit;

  if (salesman?.id) {
    const idx = allSalesmen.findIndex((s) => s.id === salesman.id);
    if (idx >= 0) return `S${idx + 1}`.slice(0, 3);
  }

  const rawName = String(salesman?.name || '').trim().toUpperCase();
  const words = rawName.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const initials = `${words[0][0] || ''}${words[1][0] || ''}`.replace(/[^A-Z0-9]/g, '');
    if (initials.length >= 2) return initials.slice(0, 3);
  }
  const letters = rawName.replace(/[^A-Z0-9]/g, '');
  if (letters.length >= 2) return letters.slice(0, 3);
  return 'SM';
}

/**
 * Formats a per-salesman GST Rule 46(b) compliant document number (<= 16 chars, [A-Z0-9-]).
 * Example: formatSalesmanDocNo('INV', 'S1', 105) => 'INV-S1-105'
 */
export function formatSalesmanDocNo(prefix: string, seriesCode: string, seq: number): string {
  const seqStr = String(Math.max(1, Math.floor(Number(seq) || 1)));
  const cleanCode = (seriesCode.toUpperCase().replace(/[^A-Z0-9]/g, '') || 'S1').slice(0, 3);
  const rawPrefix = (prefix.toUpperCase().replace(/[^A-Z0-9]/g, '') || 'INV').slice(0, 6);
  // Overhead: '-' + cleanCode + '-' + seqStr
  const maxPrefixLen = Math.max(1, 16 - (cleanCode.length + 2 + seqStr.length));
  const finalPrefix = rawPrefix.slice(0, maxPrefixLen);
  const full = `${finalPrefix}-${cleanCode}-${seqStr}`;
  if (full.length <= 16) return full;
  return `${cleanCode}-${seqStr}`.slice(0, 16);
}

export interface DuplicateDocGroup {
  key: string;
  docNo: string;
  docSeries: 'gst' | 'non_gst';
  bills: Bill[];
  hasSyncCollision: boolean;
}

/**
 * Finds non-cancelled bills that share the exact same formatted document number within the same series
 * (GST vs Non-GST), or carry an unresolved sync collision flag.
 */
export function findDuplicateBillNumbers(
  bills: Bill[],
  settingsOrPrefix?: BillingSettings | string | null,
  products?: Product[],
): {
  groups: DuplicateDocGroup[];
  billIds: Set<number>;
  conflictCount: number;
} {
  const buckets = new Map<string, DuplicateDocGroup>();
  for (const b of bills || []) {
    if (!b || b.status === 'cancelled' || (b as any).cancelled || b.cancellation) continue;
    const isNg = isGstExcludedBill(b, products);
    const docSeries: 'gst' | 'non_gst' = isNg ? 'non_gst' : 'gst';
    const docNo = formatBillNumber(b, settingsOrPrefix, isNg ? 'non_gst' : 'gst');
    const key = `${docSeries}:${docNo.toUpperCase()}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.bills.push(b);
      if (b.duplicateNumberConflict) existing.hasSyncCollision = true;
    } else {
      buckets.set(key, {
        key,
        docNo,
        docSeries,
        bills: [b],
        hasSyncCollision: Boolean(b.duplicateNumberConflict),
      });
    }
  }

  const groups: DuplicateDocGroup[] = [];
  const billIds = new Set<number>();
  for (const g of buckets.values()) {
    if (g.bills.length > 1 || g.hasSyncCollision) {
      g.bills.sort((a, b) => Number(a.id) - Number(b.id));
      groups.push(g);
      for (const b of g.bills) billIds.add(Number(b.id));
    }
  }
  groups.sort((a, b) => a.docNo.localeCompare(b.docNo, undefined, { numeric: true }));
  return {
    groups,
    billIds,
    conflictCount: billIds.size,
  };
}

