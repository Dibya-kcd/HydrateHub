import { Bill, BillingSettings, OrganizationProfile, Trip, TripStatus } from '../../types';
import { todayISO } from '../dateLocal';
import { formatBillNumber, isBillGstInvoice } from '../invoiceCommon';
import { tripPrimaryWarehouseId } from '../tripLoads';
import { money, parseBillIds, parseJsonDict } from './formatAndSku';
import { cgstSgstLabels, nonGstSummary, statusOf } from './taxSettingsAndRules';

/** Display values for invoice: free / scheme lines as 100% discount or free stock. */
export function freeStockInvoiceDisplay(it: {
  qty: number;
  rate: number;
  gross?: number;
  discount?: number;
  amount?: number;
  freeQty?: number;
  isBundleFreeItem?: boolean;
  promoLabel?: string | null;
}) {
  const rate = Number(it.rate) || 0;
  const qty = Number(it.qty) || 0;
  const freeQty = Number(it.freeQty) || 0;
  const isFreeLine = !!it.isBundleFreeItem || (qty > 0 && Number(it.amount) === 0 && freeQty >= qty);
  const notionalGross = Number(it.gross) > 0 ? Number(it.gross) : rate * Math.max(qty, freeQty || qty);
  const storedDiscount = Number(it.discount) || 0;

  if (isFreeLine || it.isBundleFreeItem) {
    const gross = notionalGross > 0 ? notionalGross : rate * qty;
    return {
      isFreeStock: true as const,
      label: 'FREE STOCK · 100% scheme discount',
      shortLabel: '100% FREE',
      qtyLabel: String(qty || freeQty || 0),
      freeLabel: String(qty || freeQty || 0),
      rate,
      gross,
      discount: gross,
      discountLabel: '100%',
      amount: 0,
      schemeNote: it.promoLabel || 'Scheme free issue',
    };
  }

  if (freeQty > 0) {
    const freeValue = rate * freeQty;
    const gross = Number(it.gross) > 0 ? Number(it.gross) : rate * qty;
    const discount = storedDiscount > 0 ? storedDiscount : freeValue;
    const chargeableQty = Math.max(0, qty - freeQty);
    return {
      isFreeStock: false as const,
      label: `Includes ${freeQty} free in total ${qty} crates (${chargeableQty} billed + ${freeQty} free)`,
      shortLabel: `${freeQty} FREE (INCL.)`,
      qtyLabel: String(qty),
      freeLabel: `${freeQty} incl.`,
      rate,
      gross,
      discount,
      discountLabel: discount > 0 ? `−₹` : '—',
      amount: Number(it.amount) || 0,
      schemeNote: it.promoLabel
        ? it.promoLabel.replace(/\+([0-9]+)\s*(?:extra\s*)?free(?:\s*crates)?/gi, '$1 free incl.')
        : `Includes ${freeQty} free in ${qty} cs`,
    };
  }

  const gross = Number(it.gross) > 0 ? Number(it.gross) : rate * qty;
  return {
    isFreeStock: false as const,
    label: '',
    shortLabel: '',
    qtyLabel: String(qty),
    freeLabel: '—',
    rate,
    gross,
    discount: storedDiscount,
    discountLabel: storedDiscount > 0 ? '−₹' : '—',
    amount: Number(it.amount) || 0,
    schemeNote: it.promoLabel || '',
  };
}

function wrapMonospaceText(text: string, maxWidth: number): string[] {
  const words = String(text || 'Item').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return ['Item'];
  const lines: string[] = [];
  let current = '';
  for (let word of words) {
    while (word.length > maxWidth) {
      if (current) {
        lines.push(current);
        current = '';
      }
      lines.push(word.slice(0, maxWidth));
      word = word.slice(maxWidth);
    }
    if (!word) continue;
    if (!current) {
      current = word;
    } else if (current.length + 1 + word.length <= maxWidth) {
      current += ' ' + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : ['Item'];
}

function fitMonospaceAmount(value: number, width: number): string {
  const num = Number(value) || 0;
  const fixed = num.toFixed(2);
  if (fixed.length <= width) return fixed;
  return String(Math.round(num));
}

function formatMonospaceReceipt(bill: Bill, isGst: boolean = true): string {
  const colItem = 14;
  const colQty = 4;
  const colRate = 7;
  const colAmt = 8;
  // 14 + 1 + 4 + 1 + 7 + 1 + 8 = 36 chars (fits cleanly in mobile WhatsApp monospace bubbles)
  const totalWidth = colItem + 1 + colQty + 1 + colRate + 1 + colAmt;

  const header = `${'ITEM'.padEnd(colItem)}|${'QTY'.padStart(colQty)}|${'RATE'.padStart(colRate)}|${'AMOUNT'.padStart(colAmt)}`;
  const colRule = `${'-'.repeat(colItem)}+${'-'.repeat(colQty)}+${'-'.repeat(colRate)}+${'-'.repeat(colAmt)}`;
  const divLine = '-'.repeat(totalWidth);
  const dblLine = '='.repeat(totalWidth);

  const lines: string[] = [header, colRule];

  (bill.items || []).forEach((it) => {
    const d = freeStockInvoiceDisplay(it);
    const rawName = String(it.productName || 'Item').replace(/\s+/g, ' ').trim();
    const qtyStr = String(it.qty).padStart(colQty);
    const rateStr = fitMonospaceAmount(d.rate, colRate).padStart(colRate);
    const amtStr = (d.isFreeStock ? 'FREE' : fitMonospaceAmount(d.amount, colAmt)).padStart(colAmt);
    const colsTail = `|${qtyStr}|${rateStr}|${amtStr}`;

    if (rawName.length <= colItem) {
      lines.push(`${rawName.padEnd(colItem)}${colsTail}`);
    } else {
      for (const nameLine of wrapMonospaceText(rawName, totalWidth)) {
        lines.push(nameLine);
      }
      lines.push(`${''.padEnd(colItem)}${colsTail}`);
    }

    if (d.isFreeStock) {
      lines.push('  -> FREE STOCK (100% discount)');
    } else if (it.freeQty > 0) {
      const paidQty = Math.max(0, it.qty - it.freeQty);
      lines.push(`  -> ${it.freeQty} free (${paidQty} billed + ${it.freeQty} free)`);
    }
    if (d.discount > 0 && !d.isFreeStock) {
      lines.push(`  -> Scheme disc: Rs ${money(d.discount)}`);
    }
  });

  lines.push(divLine);

  const formatSummaryRow = (label: string, val: string) => {
    const gap = Math.max(1, totalWidth - label.length - val.length);
    return `${label}${' '.repeat(gap)}${val}`;
  };

  if (isGst) {
    lines.push(formatSummaryRow('Gross Subtotal:', `Rs ${money(bill.subtotal)}`));
    if (bill.additionalDiscount && bill.additionalDiscount > 0) {
      lines.push(formatSummaryRow('Special Discount:', `-Rs ${money(bill.additionalDiscount)}`));
    }
    if (bill.discount > (bill.additionalDiscount || 0)) {
      lines.push(formatSummaryRow('Scheme Savings:', `-Rs ${money(bill.discount - (bill.additionalDiscount || 0))}`));
    }
    if (bill.cgst > 0 || bill.sgst > 0) {
      const gstLbl = cgstSgstLabels(bill.items || []);
      lines.push(formatSummaryRow(gstLbl.cgst + ':', `Rs ${money(bill.cgst)}`));
      lines.push(formatSummaryRow(gstLbl.sgst + ':', `Rs ${money(bill.sgst)}`));
    }
    if (Math.abs(Number(bill.roundOff) || 0) >= 0.005) {
      const ro = Number(bill.roundOff) || 0;
      lines.push(formatSummaryRow('Round off:', `${ro < 0 ? '-' : '+'}Rs ${money(Math.abs(ro))}`));
    }
  } else {
    // Non-GST (B2C) copy: tax-inclusive prices only, no GST split.
    const ng = nonGstSummary(bill);
    lines.push(formatSummaryRow('Items Value:', `Rs ${money(ng.itemsValue)}`));
    if (ng.schemeDiscount > 0) {
      lines.push(formatSummaryRow('Scheme Savings:', `-Rs ${money(ng.schemeDiscount)}`));
    }
    if (ng.specialDiscount > 0) {
      lines.push(formatSummaryRow('Special Discount:', `-Rs ${money(ng.specialDiscount)}`));
    }
    if (ng.taxAdjustment > 0.05) {
      lines.push(formatSummaryRow('Taxes:', `Rs ${money(ng.taxAdjustment)}`));
    }
  }

  lines.push(dblLine);
  lines.push(formatSummaryRow('TOTAL PAYABLE:', `Rs ${money(bill.total)}`));
  lines.push(formatSummaryRow('Amount Paid:', `Rs ${money(bill.amountPaid)}`));
  const st = statusOf(bill.total, bill.amountPaid);
  lines.push(formatSummaryRow('Balance Due:', `Rs ${money(st.balance)}`));

  return ['```', ...lines, '```'].join('\n');
}

export function buildBillText(
  bill: Bill,
  org?: OrganizationProfile,
  settings?: BillingSettings,
  invoiceFormat?: 'gst' | 'non_gst'
): string {
  const isGst = isBillGstInvoice(bill, invoiceFormat);

  const st = statusOf(bill.total, bill.amountPaid);
  const billNo = formatBillNumber(bill, settings, invoiceFormat);
  const isNonGstSeries = bill.gstExclude === true || bill.docSeries === 'non_gst';

  const orgName = (org?.name || 'MrWater').trim();
  const orgTagline = (org?.tagline || 'Authorized Wholesale Beverage Distributor').trim();
  const orgPhone = (org?.phone || '').trim();
  const orgGstin = (org?.gstin || '').trim();
  const orgFssai = (org?.fssai || '').trim();
  const isB2b = isGst && bill.supplyType === 'B2B' && Boolean(bill.customerGstin);

  const out: string[] = [];

  if (isGst) {
    out.push(`*TAX INVOICE — ${orgName.toUpperCase()}*`);
    out.push(`_(${isB2b ? 'GST B2B Tax Invoice' : 'GST Tax Invoice'})_`);
  } else if (isNonGstSeries) {
    out.push(`*CASH MEMO / TRADING BILL — ${orgName.toUpperCase()}*`);
    out.push(`_(Non-GST / 0% Tax)_`);
  } else {
    out.push(`*RETAIL BILL / CASH MEMO — ${orgName.toUpperCase()}*`);
    out.push(`_(Non-GST / Bill of Supply)_`);
  }
  if (orgTagline) out.push(`_${orgTagline}_`);
  if (org?.address) out.push(`Address: ${org.address}${org.city ? `, ${org.city}` : ''}`);
  const orgMeta = [
    orgPhone ? `Phone: ${orgPhone}` : '',
    orgGstin ? `GSTIN: ${orgGstin}` : '',
    orgFssai ? `FSSAI: ${orgFssai}` : '',
  ].filter(Boolean);
  if (orgMeta.length > 0) out.push(orgMeta.join(' | '));

  out.push('------------------------------------');
  out.push(`*${isGst ? 'Tax Invoice' : 'Bill No'}:* #${billNo}`);
  out.push(`*Date:* ${bill.date}`);
  out.push(`*Billed To:* *${(bill.retailer || 'Cash Retailer').toUpperCase()}*`);
  if (isGst && bill.customerGstin) {
    out.push(`*Buyer GSTIN:* ${bill.customerGstin}`);
  }
  if (bill.phone) out.push(`*Party Contact:* ${bill.phone}`);
  out.push('------------------------------------');

  // Monospace aligned row-and-column receipt table
  out.push(formatMonospaceReceipt(bill, isGst));

  // Settlement & Status summary
  out.push('');
  out.push(`*Payment Status:* *${st.label.toUpperCase()}*`);
  if (st.balance > 0) {
    out.push(`*Pending Balance:* ₹${money(st.balance)}`);
  } else {
    out.push(`*Full Payment Received:* ₹${money(bill.amountPaid)}`);
  }

  if (org?.upiId || org?.bankName) {
    out.push('');
    out.push('*Settlement Details:*');
    if (org.upiId) out.push(`- UPI ID: *${org.upiId}*`);
    if (org.bankName) {
      out.push(`- Bank: ${org.bankName} (A/c: ${org.accountNumber || '-'}, IFSC: ${org.ifsc || '-'})`);
    }
  }

  if (org?.invoiceTerms) {
    out.push('');
    out.push(`_Terms: ${org.invoiceTerms}_`);
  }
  out.push('_Thank you for your business!_');

  return out.join('\n');
}

/**
 * Normalizes any Trip record from remote DB, JSON API, or local storage into a consistent Trip structure.
 * Crucially:
 * - If status is 'out' (ongoing or reopened trip), 'returned' is empty because crates are live in the van.
 * - Product IDs in 'loaded' and 'returned' are coerced to numbers.
 * - Bill IDs are coerced to numbers.
 */
/** What the salesman still owes from this trip's cash shortfall (0 when none was booked, repaid or written off). */
export function tripCashDue(t: Pick<Trip, 'status' | 'cashShortBooked' | 'cashRecoveries' | 'cashShortWrittenOff'>): number {
  if (t.status !== 'closed' || !(Number(t.cashShortBooked) > 0) || t.cashShortWrittenOff) return 0;
  const paid = (t.cashRecoveries || []).reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  return Math.max(0, Math.round((Number(t.cashShortBooked) - paid) * 100) / 100);
}

export function normalizeTrip(raw: any): Trip {
  if (!raw || typeof raw !== 'object') {
    return {
      id: 1,
      vehicle: 'Delivery Van',
      date: todayISO(),
      loaded: {},
      returned: {},
      billIds: [],
      status: 'out',
    };
  }

  const loaded = parseJsonDict(raw.loaded);
  const status: TripStatus = raw.status === 'closed' ? 'closed' : 'out';
  // If trip is 'out' (reopened or out for delivery), goods are active in the van; returns do not subtract
  const returned = status === 'closed' ? parseJsonDict(raw.returned) : {};
  const rawBillIds = raw.billIds ?? raw.bill_ids;
  const billIds = parseBillIds(rawBillIds);

  let warehouseLoads: Record<string, Record<number, number>> | undefined = undefined;
  const rawWhLoads = raw.warehouseLoads ?? raw.warehouse_loads;
  if (rawWhLoads) {
    let parsedWh: any = rawWhLoads;
    if (typeof rawWhLoads === 'string') {
      try {
        parsedWh = JSON.parse(rawWhLoads);
      } catch {
        parsedWh = null;
      }
    }
    if (parsedWh && typeof parsedWh === 'object' && !Array.isArray(parsedWh)) {
      warehouseLoads = {};
      for (const [whId, pMap] of Object.entries(parsedWh)) {
        if (pMap && typeof pMap === 'object') {
          warehouseLoads[whId] = parseJsonDict(pMap);
        }
      }
    }
  }

  // If the trip has no total for a product but warehouseLoads does, the van total is the SUM over
  // all godowns it was loaded from (older code only kept the first godown's crates).
  if (warehouseLoads) {
    const sums: Record<number, number> = {};
    for (const pMap of Object.values(warehouseLoads)) {
      for (const [pidStr, qty] of Object.entries(pMap)) {
        const pid = Number(pidStr);
        sums[pid] = (sums[pid] || 0) + (Number(qty) || 0);
      }
    }
    for (const [pidStr, sum] of Object.entries(sums)) {
      const pid = Number(pidStr);
      if (!(Number(loaded[pid]) > 0)) loaded[pid] = sum;
    }
  }

  // Drafts only exist while the trip is open; closing a trip turns them into `returned`.
  const draftReturned = status === 'out' ? parseJsonDict(raw.draftReturned ?? raw.draft_returned) : {};
  let cashRecoveries: NonNullable<Trip['cashRecoveries']> = [];
  {
    let rec: any = raw.cashRecoveries ?? raw.cash_recoveries;
    if (typeof rec === 'string') {
      try {
        rec = JSON.parse(rec);
      } catch {
        rec = [];
      }
    }
    if (Array.isArray(rec)) {
      cashRecoveries = rec
        .filter((r: any) => r && Number(r.amount) > 0)
        .map((r: any) => ({
          id: String(r.id || `rec_${Math.random().toString(36).slice(2, 10)}`),
          date: String(r.date || '').slice(0, 10),
          amount: Number(r.amount),
          ...(r.note ? { note: String(r.note) } : {}),
        }));
    }
  }
  let shortageReasons: Trip['shortageReasons'] = undefined;
  let rawReasons: any = raw.shortageReasons ?? raw.shortage_reasons;
  if (typeof rawReasons === 'string') {
    try {
      rawReasons = JSON.parse(rawReasons);
    } catch {
      rawReasons = null;
    }
  }
  if (rawReasons && typeof rawReasons === 'object' && !Array.isArray(rawReasons)) {
    const okReasons = ['broken', 'short_loaded', 'sold_not_billed', 'other'];
    const out: NonNullable<Trip['shortageReasons']> = {};
    for (const [pidStr, e] of Object.entries<any>(rawReasons)) {
      const pid = Number(pidStr);
      if (!pid || !e || !okReasons.includes(e.reason)) continue;
      out[pid] = {
        reason: e.reason,
        qty: Number(e.qty) || 0,
        note: e.note ? String(e.note) : undefined,
        dispositionId: e.dispositionId ? String(e.dispositionId) : undefined,
        ...(e.missing && okReasons.includes(e.missing.reason) && e.missing.reason !== 'broken'
          ? {
              missing: {
                reason: e.missing.reason,
                qty: Number(e.missing.qty) || 0,
                note: e.missing.note ? String(e.missing.note) : undefined,
                dispositionId: e.missing.dispositionId ? String(e.missing.dispositionId) : undefined,
              },
            }
          : {}),
      };
    }
    if (Object.keys(out).length > 0) shortageReasons = out;
  }

  return {
    id: Number(raw.id) || Date.now(),
    vehicle: String(raw.vehicle || ''),
    salesman: raw.salesman || '',
    salesmanId: raw.salesmanId || raw.salesman_id || undefined,
    salesmanPhone: String(raw.salesmanPhone ?? raw.salesman_phone ?? '').trim() || undefined,
    route: raw.route || undefined,
    driver: raw.driver || undefined,
    driverPhone: String(raw.driverPhone ?? raw.driver_phone ?? '').trim() || undefined,
    date: raw.date || todayISO(),
    loaded,
    returned,
    billIds,
    status,
    warehouseId:
      String(raw.warehouseId || raw.warehouse_id || '').trim() ||
      tripPrimaryWarehouseId({ warehouseId: '', warehouseLoads }),
    warehouseLoads,
    ...(shortageReasons ? { shortageReasons } : {}),
    ...(raw.updatedAt || raw.updated_at ? { updatedAt: String(raw.updatedAt || raw.updated_at) } : {}),
    ...(Number(raw.cashShortBooked ?? raw.cash_short_booked) > 0
      ? { cashShortBooked: Number(raw.cashShortBooked ?? raw.cash_short_booked) }
      : {}),
    ...(cashRecoveries.length > 0 ? { cashRecoveries } : {}),
    ...((raw.cashShortWrittenOff ?? raw.cash_short_written_off) === true ? { cashShortWrittenOff: true } : {}),
    ...(Number.isFinite(Number(raw.cashHandedIn ?? raw.cash_handed_in)) && (raw.cashHandedIn ?? raw.cash_handed_in) !== null && (raw.cashHandedIn ?? raw.cash_handed_in) !== ''
      ? { cashHandedIn: Number(raw.cashHandedIn ?? raw.cash_handed_in) }
      : {}),
    ...(status === 'out' && Object.keys(draftReturned).length > 0 ? { draftReturned } : {}),
  };
}

/**
 * Does this bill count against this trip's load sheet?
 * A bill that carries a tripId belongs ONLY to that trip. A bill with no tripId belongs to the
 * trip(s) that list it in billIds. (Counting "tripId matches OR listed in billIds" let one bill
 * hit two trips' sold totals, which showed up as false load/sold/return discrepancies.)
 */
export function billBelongsToTrip(
  trip: Pick<Trip, 'id' | 'billIds'>,
  bill: { id: number; tripId?: number | null },
): boolean {
  if (bill.tripId != null && Number(bill.tripId) > 0) {
    return Number(bill.tripId) === Number(trip.id);
  }
  return (Array.isArray(trip.billIds) ? trip.billIds : [])
    .map(Number)
    .includes(Number(bill.id));
}

/**
 * Bills that may be auto-attached to a trip by date: same day, not already on another trip, and
 * (when both sides say so) the same salesman and the same van. Without this, "attach today's
 * bills" pulled in every other salesman's bills and inflated this trip's sold quantities.
 */
export function attachableBillsForTrip<
  B extends { id: number; date: string; tripId?: number | null; salesmanId?: string; vehicle?: string },
>(
  trip: { id?: number; date: string; salesmanId?: string; vehicle?: string },
  bills: B[],
  allTrips: Pick<Trip, 'id' | 'billIds'>[],
): B[] {
  const onOtherTrip = new Set<number>();
  for (const t of allTrips) {
    if (trip.id != null && Number(t.id) === Number(trip.id)) continue;
    for (const id of t.billIds || []) onOtherTrip.add(Number(id));
  }
  const norm = (v?: string) => (v || '').trim().toLowerCase();
  return bills.filter((b) => {
    if (b.date !== trip.date) return false;
    if (b.tripId != null && Number(b.tripId) > 0 && Number(b.tripId) !== Number(trip.id ?? -1)) return false;
    if (onOtherTrip.has(Number(b.id))) return false;
    // A bill with no salesman AND no van is a warehouse / counter sale (the billing screen only
    // stamps those fields for van sales). It must never be pulled onto a trip just because the
    // date matches, otherwise the trip shows crates "sold" that never left the godown.
    const belongsByStamp = b.tripId != null && Number(b.tripId) > 0 && Number(b.tripId) === Number(trip.id ?? -1);
    if (!belongsByStamp && !b.salesmanId && !norm(b.vehicle)) return false;
    if (trip.salesmanId && b.salesmanId && trip.salesmanId !== b.salesmanId) return false;
    if (norm(trip.vehicle) && norm(b.vehicle) && norm(trip.vehicle) !== norm(b.vehicle)) return false;
    return true;
  });
}
