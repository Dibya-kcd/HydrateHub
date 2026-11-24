import { BalanceStatus, Bill, BillItem, BillTotals, GstMode } from '../../types';
import { normalizeGstFraction } from './productMeta';

/**
 * Value (at the invoice rate, GST-inclusive in inclusive mode) of the FREE scheme cases carried
 * inside a line. Under the invoice method used by this business, GST is charged on this value too:
 * the free-case value is deducted from the taxable amount only, not from the tax.
 */
let GST_ON_FREE_CASES = true;

/** Set from Settings (billing.gstOnFreeCases). Default true = GST also on free scheme cases. */
export function setGstOnFreeCases(v: boolean | undefined | null) {
  GST_ON_FREE_CASES = v !== false;
}

/**
 * "Round off grand total" (Settings > Billing). When ON, the invoice total is rounded to the nearest
 * rupee and the difference is kept in `roundOff` (shown on the invoice). Before this the setting was
 * saved but never used.
 */
let ROUND_OFF_GRAND_TOTAL = false;

export function setRoundOffGrandTotal(v: boolean | undefined | null) {
  ROUND_OFF_GRAND_TOTAL = v !== false;
}

export function getRoundOffGrandTotal(): boolean {
  return ROUND_OFF_GRAND_TOTAL;
}

/** True when an amount is already a whole number of rupees (a bill issued with round-off). */
export function isWholeRupee(n: number | undefined | null): boolean {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  return Math.abs(v - Math.round(v)) < 0.005;
}

export function getGstOnFreeCases(): boolean {
  return GST_ON_FREE_CASES;
}

/**
 * Lowest selling rate per PAID case (ex-GST) that still recovers the cost of a "buy N get M free" scheme.
 * Cost per case is ex-GST landed cost. e.g. buy 2 get 1 -> cost x 1.5; buy 1 get 1 -> cost x 2.
 */
export function breakEvenPaidRate(costExGstPerCase: number, buyN: number, getM: number): number {
  const n = Math.max(1, Number(buyN) || 1);
  const m = Math.max(0, Number(getM) || 0);
  return Math.round((Math.max(0, costExGstPerCase) * (n + m) / n) * 100) / 100;
}

/**
 * Lowest GST-INCLUSIVE rate per PAID case to charge so the taxable revenue still covers the cost of the
 * (n + m) cases handed over. Follows the active GST-on-free-cases rule: when GST is also charged on the
 * free cases, part of the price goes to tax on goods you gave away, so the price must be higher.
 * Returns null when no price can recover the cost (tax on free cases eats the whole paid amount).
 */
export function breakEvenInclPaidRate(costExGstPerCase: number, buyN: number, getM: number, gstFraction: number): number | null {
  const n = Math.max(1, Number(buyN) || 1);
  const m = Math.max(0, Number(getM) || 0);
  const c = Math.max(0, costExGstPerCase);
  const g = Math.max(0, gstFraction);
  const k = GST_ON_FREE_CASES ? ((n + m) * g) / (1 + g) : (n * g) / (1 + g);
  const denom = n - k;
  if (denom <= 0.0001) return null;
  return Math.round(((c * (n + m)) / denom) * 100) / 100;
}

/**
 * Lowest rate per case (ex-GST) when the deal is entered as ONE custom price for `cases` physical cases
 * (e.g. price of 2 divided over 3 cases) -> the cost itself. Provided for symmetry in the UI.
 */
export function breakEvenCustomRate(costExGstPerCase: number): number {
  return Math.round(Math.max(0, costExGstPerCase) * 100) / 100;
}

export function freeSchemeValue(
  it: Pick<BillItem, 'freeQty' | 'rate' | 'discount'>,
): number {
  if (!GST_ON_FREE_CASES) return 0;
  const free = Number(it.freeQty) || 0;
  const rate = Number(it.rate) || 0;
  if (free <= 0 || rate <= 0) return 0;
  const value = free * rate;
  const disc = Number(it.discount) || 0;
  // the stored discount may also hold a trade (percent/flat) discount; only the free-case part counts
  return Math.max(0, disc > 0 ? Math.min(value, disc) : value);
}

export interface LineTaxDetail {
  rate: number; // fraction
  taxable: number;
  tax: number;
  cgst: number;
  sgst: number;
  total: number; // what the customer pays for the line
}

/**
 * Taxable / tax split of a line's NET billed value (e.g. after returns reduced it), keeping the
 * same proportions as the full line. Used by the profit reports.
 */
export function scaledTaxSplit(
  item: Pick<BillItem, 'amount' | 'freeQty' | 'rate' | 'discount'>,
  netBilled: number,
  rate: number,
): { taxable: number; tax: number } {
  const full = lineTaxDetail(item, rate, 'inclusive', 1);
  const ratio = full.total > 0 ? netBilled / full.total : 1;
  return { taxable: full.taxable * ratio, tax: full.tax * ratio };
}

/**
 * Tax split for one bill line. `factor` scales the line for an invoice-level (trade) discount.
 *  inclusive: amount is GST-inclusive. Tax = GST on (amount + free-case value); taxable = amount - tax.
 *  exclusive: amount is ex-GST.        Tax = rate x (amount + free-case value); total = amount + tax.
 */
export function lineTaxDetail(
  item: Pick<BillItem, 'amount' | 'freeQty' | 'rate' | 'discount' | 'taxability'>,
  rate: number,
  mode: 'inclusive' | 'exclusive' = 'inclusive',
  factor = 1,
): LineTaxDetail {
  const amt = Math.max(0, Number(item.amount) || 0) * factor;
  if (item.taxability === 'non_gst') {
    return { rate: 0, taxable: amt, tax: 0, cgst: 0, sgst: 0, total: amt };
  }
  const free = freeSchemeValue(item) * factor;
  const g = normalizeGstFraction(rate);
  if (g <= 0) return { rate: 0, taxable: amt, tax: 0, cgst: 0, sgst: 0, total: amt };
  const base = amt + free;
  if (mode === 'exclusive') {
    const tax = base * g;
    return { rate: g, taxable: amt, tax, cgst: tax / 2, sgst: tax / 2, total: amt + tax };
  }
  const tax = Math.min(amt, base - base / (1 + g));
  return { rate: g, taxable: amt - tax, tax, cgst: tax / 2, sgst: tax / 2, total: amt };
}

/**
 * Weighted-average half-rate (CGST or SGST %) for invoice labels.
 * Mixed-rate bills show the blended % instead of a hardcoded 6%.
 */
export function billGstHalfRatePercent(items: { amount: number; gst: number }[]): number {
  let taxBase = 0;
  let weighted = 0;
  for (const i of items) {
    const g = normalizeGstFraction(i.gst);
    const amt = Math.max(0, Number(i.amount) || 0);
    if (g <= 0 || amt <= 0) continue;
    taxBase += amt;
    weighted += amt * (g / 2) * 100;
  }
  if (taxBase <= 0) return 0;
  return Math.round((weighted / taxBase) * 100) / 100;
}

export function cgstSgstLabels(items: { amount: number; gst: number }[]): { cgst: string; sgst: string } {
  // Mixed slabs (e.g. 40% and 5% on one bill): never print a blended %. The per-rate tax summary
  // carries the rates; the totals row is just CGST / SGST.
  const rates = new Set<number>();
  for (const i of items) {
    const g = normalizeGstFraction(i.gst);
    if (g > 0 && Number(i.amount) > 0) rates.add(Math.round(g * 10000));
  }
  if (rates.size !== 1) return { cgst: 'CGST', sgst: 'SGST' };
  const half = Math.round(([...rates][0] / 2)) / 100;
  const s = Number.isInteger(half) ? String(half) : half.toFixed(2).replace(/\.?0+$/, '');
  return { cgst: `CGST (${s}%)`, sgst: `SGST (${s}%)` };
}

/**
 * The GST treatment a saved bill was issued with, so re-calculating it (an edit, a repair) gives the
 * same tax it had. A bill saved with no tax charged stays tax-free, unless none of its lines was taxable
 * (then new taxed lines follow the app-wide setting).
 */
export function issuedGstMode(
  bill: { cgst?: number; sgst?: number; total?: number; items?: { gst?: number }[]; gstExclude?: boolean; docSeries?: string },
  appMode: GstMode = 'inclusive'
): GstMode {
  if (bill.gstExclude || bill.docSeries === 'non_gst') return 'off';
  const cgst = Number(bill.cgst);
  const sgst = Number(bill.sgst);
  const noTaxCharged = Number.isFinite(cgst) && Number.isFinite(sgst) && cgst + sgst < 0.005 && Number(bill.total) > 0;
  if (!noTaxCharged) return 'inclusive';
  const hadTaxedLine = (bill.items || []).some((i) => normalizeGstFraction(i.gst as number) > 0);
  return hadTaxedLine ? 'off' : appMode;
}

export function billTotals(
  items: BillItem[],
  gstMode: GstMode = 'inclusive',
  additionalDiscount: number = 0,
  opts?: { round?: boolean }
): BillTotals {
  const t = billTotalsUnrounded(items, gstMode, additionalDiscount);
  const doRound = opts?.round ?? ROUND_OFF_GRAND_TOTAL;
  if (!doRound) return t;
  const rounded = Math.round(t.total);
  const roundOff = Math.round((rounded - t.total) * 100) / 100;
  return Math.abs(roundOff) < 0.005 ? t : { ...t, total: rounded, roundOff };
}

function billTotalsUnrounded(
  items: BillItem[],
  gstMode: GstMode = 'inclusive',
  additionalDiscount: number = 0
): BillTotals {
  const gross = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const lineDiscount = items.reduce((s, i) => s + (Number(i.discount) || 0), 0);
  const extraDisc = Math.max(0, Number(additionalDiscount) || 0);
  const discount = lineDiscount + extraDisc;
  const effectiveGross = Math.max(0, gross - extraDisc);

  if (gstMode === 'off') {
    return {
      subtotal: effectiveGross,
      cgst: 0,
      sgst: 0,
      total: effectiveGross,
      discount,
      additionalDiscount: extraDisc,
    };
  }

  // An invoice-level (trade) discount scales every line, including its tax.
  const factor = gross > 0 ? effectiveGross / gross : 1;
  // Prices are GST-inclusive. Old data / settings saying 'exclusive' must never add tax on top.
  const mode = 'inclusive' as const;
  let taxable = 0;
  let cgst = 0;
  let sgst = 0;
  let total = 0;
  for (const i of items) {
    const d = lineTaxDetail(i, i.gst, mode, factor);
    taxable += d.taxable;
    cgst += d.cgst;
    sgst += d.sgst;
    total += d.total;
  }
  return {
    subtotal: Math.max(0, taxable),
    cgst,
    sgst,
    total: Math.max(0, total),
    discount,
    additionalDiscount: extraDisc,
  };
}

export function statusOf(total: number, paid: number): BalanceStatus {
  const bal = Math.round((total - paid) * 100) / 100;
  if (bal <= 0) return { label: 'Paid', balanceKey: 'good', balance: Math.max(bal, 0) };
  if (paid <= 0) return { label: 'Credit', balanceKey: 'bad', balance: bal };
  return { label: 'Partial', balanceKey: 'warn', balance: bal };
}

/**
 * Customer-facing summary for the Non-GST (B2C retail) copy of a bill.
 * Every figure is the tax-inclusive price the customer actually pays, so the rows
 * always add up: itemsValue - schemeDiscount - specialDiscount (+ taxAdjustment) = total.
 * `taxAdjustment` is only non-zero for bills raised in "exclusive" GST mode, where the
 * tax is added on top of the line amounts.
 */
export function nonGstSummary(bill: Bill) {
  const itemsValue = (bill.items || []).reduce(
    (sum, it) => sum + (Number(it.gross) || (Number(it.qty) || 0) * (Number(it.rate) || 0)),
    0
  );
  const specialDiscount = Math.max(0, Number(bill.additionalDiscount) || 0);
  const schemeDiscount = Math.max(0, (Number(bill.discount) || 0) - specialDiscount);
  const net = itemsValue - schemeDiscount - specialDiscount;
  const rawAdj = (Number(bill.total) || 0) - net;
  const taxAdjustment = Math.abs(rawAdj) > 0.5 ? rawAdj : 0;
  return { itemsValue, schemeDiscount, specialDiscount, taxAdjustment, total: Number(bill.total) || 0 };
}
