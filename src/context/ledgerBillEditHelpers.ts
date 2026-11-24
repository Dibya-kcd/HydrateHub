import {
  Bill,
  BillItem,
  InventoryBatch,
  PaymentRecord,
  Trip,
  Warehouse,
} from "../types";
import { resolveTripGodownDisplay } from "../utils/tripLoads";
import { normCustName } from "./ledgerHelpers";
import type { BillEditPreview } from "./ledgerTypes";
import { calcFindTripOfBill } from "./ledgerStockCalculations";

export function qtyByProduct(items: BillItem[]): Record<number, number> {
  const m: Record<number, number> = {};
  for (const it of items || [])
    m[it.productId] = (m[it.productId] || 0) + (Number(it.qty) || 0);
  return m;
}

// Re-apply the batch allocations an invoice already holds onto its (re-ordered / re-split) lines.
export function carryOverAllocations(
  lines: BillItem[],
  originalItems: BillItem[],
): BillItem[] {
  const pool: Record<number, { a: NonNullable<BillItem["batchAllocations"]>[number] }[]> = {};
  for (const o of originalItems)
    for (const a of o.batchAllocations || [])
      (pool[o.productId] ||= []).push({ a: { ...a } });
  const firstOrig = new Map<number, BillItem>();
  for (const o of originalItems)
    if (!firstOrig.has(o.productId)) firstOrig.set(o.productId, o);
  return lines.map((ln) => {
    const src = pool[ln.productId];
    if (!src || src.length === 0) {
      const o = firstOrig.get(ln.productId);
      return o
        ? {
            ...ln,
            batchNumber: o.batchNumber,
            expiryDate: o.expiryDate,
            batchAllocations: o.batchAllocations,
            costExGst: ln.costExGst ?? o.costExGst,
          }
        : ln;
    }
    let need = Number(ln.qty) || 0;
    const got: NonNullable<BillItem["batchAllocations"]> = [];
    while (need > 0 && src.length > 0) {
      const head = src[0].a;
      const take = Math.min(need, Number(head.qty) || 0);
      if (take > 0) {
        const ex = got.find((g) => g.batchId === head.batchId);
        if (ex) ex.qty += take;
        else got.push({ ...head, qty: take });
        head.qty = (Number(head.qty) || 0) - take;
        need -= take;
      }
      if ((Number(head.qty) || 0) <= 0) src.shift();
    }
    const o = firstOrig.get(ln.productId);
    return {
      ...ln,
      batchNumber:
        got.length > 0
          ? Array.from(new Set(got.map((g) => g.batchNumber))).join(", ")
          : ln.batchNumber,
      expiryDate: got[0]?.expiryDate ?? ln.expiryDate,
      batchAllocations: got.length > 0 ? got : ln.batchAllocations,
      costExGst: ln.costExGst ?? o?.costExGst,
    };
  });
}

/**
 * Everything about a bill that can change money, tax, stock, ledger or a report. Two bills with the
 * same signature are the same invoice for every report, so saving one over the other is a no-op.
 */
export function billMoneySignature(b: Bill): string {
  const r2 = (n: unknown) => Math.round((Number(n) || 0) * 100) / 100;
  return JSON.stringify({
    retailer: (b.retailer || "").trim(),
    phone: (b.phone || "").trim(),
    date: b.date || "",
    warehouseId: b.warehouseId || "",
    tripId: b.tripId ?? null,
    salesmanId: b.salesmanId || "",
    supplyType: b.supplyType || "",
    customerGstin: b.customerGstin || "",
    invoiceType: b.invoiceType || "",
    isGstInvoice: b.isGstInvoice ?? null,
    additionalDiscount: r2(b.additionalDiscount),
    subtotal: r2(b.subtotal),
    cgst: r2(b.cgst),
    sgst: r2(b.sgst),
    total: r2(b.total),
    roundOff: r2((b as any).roundOff),
    amountPaid: r2(b.amountPaid),
    paymentMode: b.paymentMode || "",
    paymentDate: b.paymentDate || "",
    paymentNote: b.paymentNote || "",
    items: (b.items || []).map((i) => [
      i.productId,
      r2(i.qty),
      r2((i as any).freeQty),
      r2(i.rate),
      r2(i.discount),
      r2(i.gst),
      r2(i.amount),
    ]),
  });
}

export function describeBillChanges(orig: Bill, upd: Bill): string[] {
  const out: string[] = [];
  const rs = (n: number) =>
    `₹${(Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  if ((orig.retailer || "").trim() !== (upd.retailer || "").trim())
    out.push(`Customer: ${orig.retailer} → ${upd.retailer}`);
  if ((orig.date || "") !== (upd.date || ""))
    out.push(`Date: ${orig.date} → ${upd.date}`);
  const o = new Map<number, { name: string; qty: number; amt: number; rate: number }>();
  for (const it of orig.items || []) {
    const e = o.get(it.productId) || { name: it.productName, qty: 0, amt: 0, rate: it.rate };
    e.qty += Number(it.qty) || 0;
    e.amt += Number(it.amount) || 0;
    o.set(it.productId, e);
  }
  const n = new Map<number, { name: string; qty: number; amt: number; rate: number }>();
  for (const it of upd.items || []) {
    const e = n.get(it.productId) || { name: it.productName, qty: 0, amt: 0, rate: it.rate };
    e.qty += Number(it.qty) || 0;
    e.amt += Number(it.amount) || 0;
    n.set(it.productId, e);
  }
  for (const [pid, a] of o) {
    const b = n.get(pid);
    if (!b) out.push(`Removed ${a.name} (${a.qty} cr)`);
    else {
      if (a.qty !== b.qty) out.push(`${a.name}: qty ${a.qty} → ${b.qty}`);
      if (Math.abs(a.rate - b.rate) > 0.004)
        out.push(`${a.name}: rate ${rs(a.rate)} → ${rs(b.rate)}`);
      else if (a.qty === b.qty && Math.abs(a.amt - b.amt) > 0.004)
        out.push(`${a.name}: amount ${rs(a.amt)} → ${rs(b.amt)}`);
    }
  }
  for (const [pid, b] of n)
    if (!o.has(pid)) out.push(`Added ${b.name} (${b.qty} cr)`);
  if (Math.abs((orig.total || 0) - (upd.total || 0)) > 0.004)
    out.push(`Total: ${rs(orig.total)} → ${rs(upd.total)}`);
  if (Math.abs((orig.amountPaid || 0) - (upd.amountPaid || 0)) > 0.004)
    out.push(`Paid: ${rs(orig.amountPaid)} → ${rs(upd.amountPaid)}`);
  const sameTrip =
    orig.tripId != null &&
    upd.tripId != null &&
    Number(orig.tripId) === Number(upd.tripId);
  if (!sameTrip && (orig.warehouseId || "") !== (upd.warehouseId || ""))
    out.push("Godown changed");
  if ((orig.phone || "") !== (upd.phone || "")) out.push("Phone changed");
  if ((orig.invoiceType || "") !== (upd.invoiceType || ""))
    out.push("Invoice format changed");
  return out;
}

export function resolveEditTripForBill(
  updated: Bill,
  allBills: Bill[],
  trips: Trip[],
): Trip | null {
  const original = allBills.find((b) => b.id === updated.id);
  if (updated.tripId != null) {
    const t = trips.find((x) => Number(x.id) === Number(updated.tripId));
    if (t) return t;
  }
  return original ? calcFindTripOfBill(original, trips) : null;
}

export function computePlanBillEditStock(params: {
  updated: Bill;
  nextTrip: Trip | null;
  allBills: Bill[];
  trips: Trip[];
  stockShortfalls: (
    items: BillItem[],
    excludeBillId?: number | null,
    trip?: Trip | null,
    warehouseId?: string,
  ) => {
    productId: number;
    productName: string;
    available: number;
    required: number;
  }[];
  allocateBatches: (
    items: BillItem[],
    billDate: string,
    warehouseId?: string | Record<number, string>,
    excludeBillId?: number | null,
    trip?: Trip | null,
  ) => { items: BillItem[]; problems: string[] };
}): {
  items: BillItem[];
  problems: string[];
  stockChanged: boolean;
  reopenTripId?: number;
} {
  const { updated, nextTrip, allBills, trips, stockShortfalls, allocateBatches } = params;
  const original = allBills.find((b) => b.id === updated.id);
  const problems: string[] = [];
  if (!original || !Array.isArray(updated.items))
    return { items: updated.items, problems, stockChanged: false };

  const origTrip = calcFindTripOfBill(original, trips);
  const oldQ = qtyByProduct(original.items);
  const newQ = qtyByProduct(updated.items);
  const routeChanged = nextTrip
    ? Number(nextTrip.id) !== Number(origTrip?.id ?? -1)
    : !!origTrip ||
      (original.warehouseId || "") !== (updated.warehouseId || "");

  const allPids = Array.from(
    new Set([...Object.keys(oldQ), ...Object.keys(newQ)].map(Number)),
  );
  const qtyChangedPids = allPids.filter(
    (pid) => (oldQ[pid] || 0) !== (newQ[pid] || 0),
  );
  const stockChanged = routeChanged || qtyChangedPids.length > 0;

  if (!stockChanged) {
    return {
      items: carryOverAllocations(updated.items, original.items),
      problems,
      stockChanged: false,
    };
  }

  if (nextTrip && nextTrip.status === "closed") {
    problems.push(
      `Trip #${nextTrip.id} (${nextTrip.vehicle}, ${nextTrip.date}) is closed. Reopen the trip first, then change quantities or products on this bill. Price, customer and payment edits do not need this.`,
    );
    return {
      items: updated.items,
      problems,
      stockChanged,
      reopenTripId: Number(nextTrip.id),
    };
  }

  const changedPids = new Set(routeChanged ? allPids : qtyChangedPids);
  const needMore = (pid: number) =>
    (newQ[pid] || 0) > 0 && (routeChanged || (newQ[pid] || 0) > (oldQ[pid] || 0));
  const toCheck = updated.items.filter(
    (it) => changedPids.has(it.productId) && needMore(it.productId),
  );
  if (toCheck.length > 0) {
    const shortfalls = stockShortfalls(
      toCheck,
      updated.id,
      nextTrip,
      updated.warehouseId,
    );
    for (const sh of shortfalls)
      problems.push(
        `${sh.productName}: need ${sh.required}, only ${Math.max(0, sh.available)} available` +
          (nextTrip
            ? ` on trip #${nextTrip.id} (${nextTrip.vehicle})`
            : " in the godown") +
          ". Add stock / adjust the trip load, or reduce the quantity.",
      );
    if (problems.length > 0)
      return { items: updated.items, problems, stockChanged };
  }

  const keepLines = updated.items.filter((it) => !changedPids.has(it.productId));
  const redoLines = updated.items.filter((it) => changedPids.has(it.productId));
  const keptDone = carryOverAllocations(keepLines, original.items);
  let redone = redoLines;
  if (redoLines.length > 0) {
    const fefo = allocateBatches(
      redoLines,
      updated.date,
      updated.warehouseId,
      updated.id,
      nextTrip,
    );
    if (fefo.problems.length > 0)
      return {
        items: updated.items,
        problems: fefo.problems,
        stockChanged,
      };
    redone = fefo.items;
  }
  const keptQ = [...keptDone];
  const redoQ = [...redone];
  const merged = updated.items.map((it) =>
    changedPids.has(it.productId) ? (redoQ.shift() as BillItem) : (keptQ.shift() as BillItem),
  );
  return { items: merged, problems, stockChanged };
}

export function computePreviewBillEdit(params: {
  updated: Bill;
  requestedPaid?: number;
  allBills: Bill[];
  trips: Trip[];
  warehouses: Warehouse[];
  defaultWarehouse?: Warehouse;
  payments: PaymentRecord[];
  inventoryBatches: InventoryBatch[];
  stockShortfalls: (
    items: BillItem[],
    excludeBillId?: number | null,
    trip?: Trip | null,
    warehouseId?: string,
  ) => {
    productId: number;
    productName: string;
    available: number;
    required: number;
  }[];
  allocateBatches: (
    items: BillItem[],
    billDate: string,
    warehouseId?: string | Record<number, string>,
    excludeBillId?: number | null,
    trip?: Trip | null,
  ) => { items: BillItem[]; problems: string[] };
}): BillEditPreview {
  const {
    updated,
    requestedPaid,
    allBills,
    trips,
    warehouses,
    defaultWarehouse,
    payments,
    inventoryBatches,
    stockShortfalls,
    allocateBatches,
  } = params;

  const original = allBills.find((b) => b.id === updated.id);
  const nextTrip = resolveEditTripForBill(updated, allBills, trips);
  const plan = computePlanBillEditStock({
    updated,
    nextTrip,
    allBills,
    trips,
    stockShortfalls,
    allocateBatches,
  });
  const whId = updated.warehouseId || original?.warehouseId || "";
  const wh = warehouses.find((w) => w.id === whId) || defaultWarehouse;
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const receiptRows = payments.filter((p) => p.billId === updated.id);
  const receivedBefore = r2(
    receiptRows.reduce((t, p) => t + (Number(p.amount) || 0), 0),
  );
  const typedPaid = Math.max(
    0,
    Number(requestedPaid ?? updated.amountPaid) || 0,
  );
  const paidAfter = Math.min(typedPaid, Number(updated.total) || 0);
  const keptAsAdvance = Math.max(
    0,
    r2(Math.min(typedPaid, receivedBefore) - paidAfter),
  );
  const removedAsCorrection = Math.max(
    0,
    r2(receivedBefore - paidAfter - keptAsAdvance),
  );
  const movesReceipts = receiptRows.some(
    (p) =>
      normCustName(p.customerName) !== normCustName(updated.retailer) ||
      (!!updated.phone && p.customerPhone !== updated.phone),
  );
  const tripWhInfo = nextTrip
    ? resolveTripGodownDisplay({
        trip: nextTrip,
        bill: updated,
        warehouses,
        inventoryBatches,
        includeLocation: true,
      })
    : null;
  const tripShortWhInfo = nextTrip
    ? resolveTripGodownDisplay({
        trip: nextTrip,
        bill: updated,
        warehouses,
        inventoryBatches,
        includeLocation: false,
      })
    : null;
  return {
    payment: {
      receivedBefore,
      paidAfter: r2(paidAfter),
      keptAsAdvance,
      removedAsCorrection,
      movedToCustomer: movesReceipts ? updated.retailer : undefined,
    },
    stockChanged: plan.stockChanged,
    changes: original ? describeBillChanges(original, updated) : [],
    problems: plan.problems,
    reopenTripId: plan.reopenTripId,
    source: nextTrip
      ? {
          kind: "trip",
          label: `Trip #${nextTrip.id} · ${nextTrip.vehicle} · ${nextTrip.date}${
            tripShortWhInfo?.label ? ` · ${tripShortWhInfo.label}` : ""
          }`,
          tripId: Number(nextTrip.id),
          tripStatus: nextTrip.status,
          tripDate: nextTrip.date,
          warehouseId: tripWhInfo?.primaryWarehouseId || nextTrip.warehouseId || undefined,
          warehouseLabel: tripWhInfo?.label || undefined,
        }
      : {
          kind: "warehouse",
          label: wh?.name || "Default godown",
          warehouseId: wh?.id,
          warehouseLabel: wh
            ? wh.location
              ? `${wh.name} (${wh.location})`
              : wh.name
            : undefined,
        },
  };
}
