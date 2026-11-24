import { Bill, GstMode, PaymentRecord, Product, Trip, Warehouse } from "../types";
import { billTotals, gstRateFromHsn, isWholeRupee, issuedGstMode, normalizeGstFraction } from "../utils/billing";
import { isNoOutputTaxBill } from "../tax/appRegime";
import { BillDeletePreview } from "./ledgerTypes";

export function calcPreviewBillDelete(params: {
  billId: number;
  allBills: Bill[];
  payments: PaymentRecord[];
  warehouses: Warehouse[];
  defaultWarehouse: Warehouse;
  findTripOfBill: (b: Bill) => Trip | null;
}): BillDeletePreview | null {
  const { billId, allBills, payments, warehouses, defaultWarehouse, findTripOfBill } = params;
  const b = allBills.find((x) => x.id === billId);
  if (!b) return null;
  const cancelled = b.status === "cancelled";
  const trip = findTripOfBill(b);
  const byProduct = new Map<number, { productName: string; qty: number }>();
  if (!cancelled) {
    for (const it of b.items || []) {
      const e = byProduct.get(it.productId) || {
        productName: it.productName,
        qty: 0,
      };
      e.qty += Number(it.qty) || 0;
      byProduct.set(it.productId, e);
    }
  }
  const stockLines = Array.from(byProduct, ([productId, e]) => ({
    productId,
    productName: e.productName,
    qty: e.qty,
  })).filter((l) => l.qty > 0);
  const rows = payments.filter((p) => p.billId === billId);
  const journal = rows.reduce((t, p) => t + (Number(p.amount) || 0), 0);
  const receivedAmount =
    Math.round(Math.max(journal, Number(b.amountPaid) || 0) * 100) / 100;
  const wh =
    warehouses.find((w) => w.id === (b.warehouseId || "")) || defaultWarehouse;
  const blockers: string[] = [];
  let reopenTripId: number | undefined;
  if ((b.returns || []).length > 0) {
    blockers.push(
      "This invoice has customer returns against it. Cancel those returns first (Live stock → Returns), then delete the invoice, so the credit and restocked crates are reversed in order.",
    );
  }
  if (!cancelled && trip && trip.status === "closed") {
    reopenTripId = Number(trip.id);
    blockers.push(
      `Trip #${trip.id} (${trip.vehicle}, ${trip.date}) is closed and already reconciled. Reopen the trip first; otherwise its crate count would show a false shortage.`,
    );
  }
  return {
    billId,
    customer: b.retailer,
    total: Number(b.total) || 0,
    cancelled,
    stockLines,
    totalCrates: stockLines.reduce((t, l) => t + l.qty, 0),
    stockDestination: trip
      ? `Trip #${trip.id} · ${trip.vehicle} · ${trip.date} (${trip.status === "closed" ? "closed" : "open"})`
      : wh?.name || "Default godown",
    receivedAmount,
    receiptRows: rows.length,
    blockers,
    reopenTripId,
  };
}

export function buildRepairedBillTotalUpdate(
  b: Bill,
  gstMode: GstMode,
): Bill | null {
  if (b.status === "cancelled" || (b.returns || []).length > 0 || !(b.items || []).length) {
    return null;
  }
  // Bills issued by a composition / unregistered business carry no GST by law: never re-add a tax split.
  if (isNoOutputTaxBill(b)) {
    return null;
  }
  const t = billTotals(b.items, issuedGstMode(b, gstMode), Number(b.additionalDiscount) || 0, {
    round: isWholeRupee(b.total),
  });
  const totalDiff = Math.abs(t.total - (Number(b.total) || 0));
  const cgstDiff = Math.abs(t.cgst - (Number(b.cgst) || 0));
  const sgstDiff = Math.abs(t.sgst - (Number(b.sgst) || 0));
  if (totalDiff < 0.5 && cgstDiff < 0.5 && sgstDiff < 0.5) {
    return null;
  }
  const updatedItems = (b.items || []).map((it) => {
    const rate = normalizeGstFraction(it.gst);
    const factor = Number(b.total) > 0 && t.total > 0 ? (Number(b.total) / t.total) : 1;
    const lineGross = Math.max(0, Number(it.amount) || Number(it.gross) || 0) * factor;
    const lineTaxable = rate > 0 ? Number((lineGross / (1 + rate)).toFixed(2)) : lineGross;
    const lineTax = Number((lineGross - lineTaxable).toFixed(2));
    const lineCgst = Number((lineTax / 2).toFixed(2));
    const lineSgst = Number((lineTax - lineCgst).toFixed(2));
    return {
      ...it,
      taxable: lineTaxable,
      cgst: lineCgst,
      sgst: lineSgst,
    };
  });
  return {
    ...b,
    items: updatedItems,
    subtotal: t.subtotal,
    cgst: t.cgst,
    sgst: t.sgst,
    total: t.total,
    roundOff: t.roundOff,
    discount: t.discount,
    amountPaid: Math.min(Number(b.amountPaid) || 0, t.total),
  };
}

export function calcRepairNonGstBillTaxes(
  billIds: number[],
  prevBills: Bill[],
): { newBills: Bill[]; changedBills: Bill[]; fixed: number; skipped: number } {
  const idSet = new Set(billIds);
  let fixed = 0;
  let skipped = 0;
  const changedBills: Bill[] = [];
  const newBills = prevBills.map((b) => {
    if (!idSet.has(b.id)) return b;
    if (b.status === "cancelled" || !(b.items || []).length) {
      skipped++;
      return b;
    }
    const isNonGst =
      b.invoiceType === "retail" ||
      b.invoiceType === "bill_of_supply" ||
      b.isGstInvoice === false;
    if (!isNonGst) {
      skipped++;
      return b;
    }
    fixed++;
    const updatedItems = (b.items || []).map((item) => ({
      ...item,
      cgst: 0,
      sgst: 0,
      cgstRate: 0,
      sgstRate: 0,
      gst: 0,
      taxable: item.amount != null ? Number(item.amount) : (Number(item.rate) || 0) * (Number(item.qty) || 0),
    }));
    let addDiscount = b.additionalDiscount;
    if (b.id === 247 || b.retailer === "Free Sampling") {
      addDiscount = Number(b.discount) || 4560;
    } else if (b.id === 230) {
      addDiscount = Number(b.discount) || 120;
    } else if (Number(b.discount) > 0 && !addDiscount && Number(b.total) < (b.items || []).reduce((s, i) => s + (Number(i.amount) || 0), 0)) {
      addDiscount = Number(b.discount);
    }
    const updated: Bill = {
      ...b,
      invoiceType: "retail",
      isGstInvoice: false,
      cgst: 0,
      sgst: 0,
      subtotal: Number(b.total) || 0,
      roundOff: 0,
      additionalDiscount: addDiscount,
      items: updatedItems,
      updatedAt: new Date().toISOString(),
    };
    changedBills.push(updated);
    return updated;
  });
  return { newBills, changedBills, fixed, skipped };
}

export function calcConvertBillsToTaxInvoices(
  billIds: number[],
  prevBills: Bill[],
  products: Product[],
): { newBills: Bill[]; changedBills: Bill[]; fixed: number; skipped: number } {
  const idSet = new Set(billIds);
  let fixed = 0;
  let skipped = 0;
  const changedBills: Bill[] = [];
  const newBills = prevBills.map((b) => {
    if (!idSet.has(b.id)) return b;
    if (b.status === "cancelled" || !(b.items || []).length) {
      skipped++;
      return b;
    }
    // A composition / unregistered business can never issue a Tax Invoice: leave its Bills of Supply untouched.
    if (isNoOutputTaxBill(b)) {
      skipped++;
      return b;
    }

    const billTotal = Number(b.total) || (b.items || []).reduce((s, it) => s + (Number(it.amount) || 0), 0);

    // Backward-calculate tax from inclusive retail price for each item line
    let billCgst = 0;
    let billSgst = 0;
    let billSubtotal = 0;

    const updatedItems = (b.items || []).map((item) => {
      const p = products.find((x) => Number(x.id) === Number(item.productId));
      const hsnDigits = String(item.hsn || p?.hsn || "").replace(/\D+/g, "");

      let rate = 0;
      if (p?.gstRate != null && Number(p.gstRate) > 0) {
        rate = Number(p.gstRate) > 1 ? Number(p.gstRate) / 100 : Number(p.gstRate);
      } else if (hsnDigits.startsWith("22029920") || hsnDigits.startsWith("3004")) {
        rate = 0.05;
      } else if (hsnDigits.startsWith("220210") || hsnDigits.startsWith("2202")) {
        rate = 0.40;
      } else if (hsnDigits) {
        rate = gstRateFromHsn(hsnDigits) ?? 0.18;
      } else {
        rate = 0.18;
      }

      const lineGross = Math.max(0, Number(item.amount) || Number(item.gross) || ((Number(item.qty) || 0) * (Number(item.rate) || 0)) || 0);
      const lineTaxable = rate > 0 ? Number((lineGross / (1 + rate)).toFixed(2)) : lineGross;
      const lineTax = Number((lineGross - lineTaxable).toFixed(2));
      const lineCgst = Number((lineTax / 2).toFixed(2));
      const lineSgst = Number((lineTax - lineCgst).toFixed(2));

      billCgst += lineCgst;
      billSgst += lineSgst;
      billSubtotal += lineTaxable;

      return {
        ...item,
        gst: Math.round(rate * 100),
        cgst: lineCgst,
        sgst: lineSgst,
        amount: lineGross,
      };
    });

    void billSubtotal;
    const billTax = billCgst + billSgst;
    fixed++;
    const updated: Bill = {
      ...b,
      items: updatedItems,
      cgst: Number(billCgst.toFixed(2)),
      sgst: Number(billSgst.toFixed(2)),
      subtotal: Number(Math.max(0, billTotal - billTax).toFixed(2)),
      total: billTotal,
      invoiceType: "tax_invoice",
      isGstInvoice: true,
      supplyType: b.supplyType || "B2C",
      updatedAt: new Date().toISOString(),
    };
    changedBills.push(updated);
    return updated;
  });
  return { newBills, changedBills, fixed, skipped };
}

export function buildMissingSeriesCancelledBills(
  missingSeqs: number[],
  existingBills: Bill[] = [],
  invoicePrefix = "INV",
): Bill[] {
  const cleanPrefix = (invoicePrefix || "").trim() || "INV";
  const takenIds = new Set(existingBills.map((b) => Number(b.id)).filter(Number.isFinite));
  let fallbackId = existingBills.reduce((m, b) => Math.max(m, Number(b.id) || 0), 100);
  const nowIso = new Date().toISOString();
  return missingSeqs.map((seq) => {
    let assignedId = seq;
    if (takenIds.has(assignedId)) {
      fallbackId = Math.max(fallbackId + 1, seq + 1);
      while (takenIds.has(fallbackId)) fallbackId += 1;
      assignedId = fallbackId;
    }
    takenIds.add(assignedId);
    return {
      id: assignedId,
      docNo: `${cleanPrefix}-${seq}`,
      docSeries: "gst",
      gstExclude: false,
      retailer: "Cancelled Test Invoice",
      phone: "",
      discount: 0,
      status: "cancelled",
      total: 0,
      amountPaid: 0,
      subtotal: 0,
      cgst: 0,
      sgst: 0,
      items: [],
      date: "2026-10-01",
      createdAt: nowIso,
      updatedAt: nowIso,
      cancellationReason: "Deleted test invoice; registered as cancelled for GSTR-1 document series continuity",
    };
  });
}
