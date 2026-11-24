import { Bill, Customer, PaymentRecord } from "../types";
import {
  billPaymentGaps,
  isAdvanceRow,
  isRefundRow,
  remainingAdvanceAmount,
  signedPaymentAmount,
} from "../utils/paymentAllocation";
import { billBalance, billRefundDue } from "../utils/salesReturns";
import { todayISO } from "../utils/dateLocal";
import { readBillTombstones, readPaymentTombstones } from "./ledgerHelpers";

export function calcReconcilePaymentsFromBills(
  currentPayments: PaymentRecord[],
  billsList: Bill[],
): PaymentRecord[] {
  const deadBillIds = readBillTombstones();
  const activeBillIds = new Set<number>();
  for (const b of billsList) {
    if (b.status === "cancelled" || b.cancelled || deadBillIds.has(Number(b.id))) continue;
    activeBillIds.add(Number(b.id));
  }
  const refundIds = new Set<string>();
  for (const p of currentPayments) {
    if (p?.id && isRefundRow(p)) refundIds.add(String(p.id));
  }
  const isRefundOrRev = (p: PaymentRecord) =>
    isRefundRow(p) || Boolean(p.reversalOf && refundIds.has(String(p.reversalOf)));

  const map = new Map<string, PaymentRecord>();
  currentPayments.forEach((p) => {
    if (!p || !p.id) return;
    // Drop synthetic pay_bill_ / legacy_pay_ rows whose bill was deleted or cancelled
    if (
      (p.id.startsWith("pay_bill_") || p.id.startsWith("legacy_pay_")) &&
      p.billId &&
      !activeBillIds.has(Number(p.billId))
    ) {
      return;
    }
    map.set(p.id, p);
  });

  // Group active non-cancelled bills by customer name
  const billsByCust = new Map<string, Bill[]>();
  for (const b of billsList) {
    if (b.status === "cancelled" || b.cancelled || deadBillIds.has(Number(b.id))) continue;
    const k = (b.retailer || "Cash Sale").trim().toLowerCase();
    const list = billsByCust.get(k) || [];
    list.push(b);
    billsByCust.set(k, list);
  }

  // Reconcile per customer AND per invoice. (Comparing customer totals let an advance hide an
  // invoice's missing payment row, or get a correct row deleted.)
  billsByCust.forEach((custBills, custKey) => {
    const billIds = new Set(custBills.map((b) => b.id));
    const custPhones = new Set(
      custBills
        .map((b) => (b.phone || "").trim().replace(/\D/g, ""))
        .filter((ph) => ph.length >= 7),
    );
    const custPayments = currentPayments.filter(
      (p) =>
        (p.billId && billIds.has(p.billId)) ||
        (p.customerName || "").trim().toLowerCase() === custKey ||
        (p.customerPhone && custPhones.has((p.customerPhone || "").trim().replace(/\D/g, ""))),
    );

    // Seed a row only for the part of an invoice's "paid" that no row backs.
    const tombstones = readPaymentTombstones();
    for (const gap of billPaymentGaps(custBills, custPayments)) {
      const b = custBills.find((x) => x.id === gap.billId);
      if (!b) continue;
      let id = `pay_bill_${b.id}`;
      if (map.has(id)) id = `${id}_${Math.round(gap.shortfall * 100)}`;
      // CRITICAL: If owner explicitly deleted/rectified this payment, never regenerate it
      if (
        tombstones.has(id) ||
        tombstones.has(`pay_bill_${b.id}`) ||
        tombstones.has(`legacy_pay_${b.id}`)
      ) {
        continue;
      }
      map.set(id, {
        id,
        billId: b.id,
        customerName: b.retailer || "Cash Sale",
        customerPhone: b.phone || "",
        paymentDate:
          b.paymentDate ||
          (b.date ? b.date.slice(0, 10) : todayISO()),
        amount: gap.shortfall,
        mode: b.paymentMode || "cash",
        referenceNote: b.paymentNote || `Upfront payment on Invoice #${b.id}`,
        recordedBy: b.salesman || "Admin",
        salesmanId: b.salesmanId,
        createdAt: b.date || new Date().toISOString(),
      });
    }

    // Remove an auto-seeded row only when ITS OWN invoice has more rows than it says is paid.
    for (const b of custBills) {
      const rows = custPayments.filter((p) => p.billId === b.id && !isRefundOrRev(p));
      const linkedSum = rows.reduce((t, p) => t + signedPaymentAmount(p), 0);
      let surplus = linkedSum - (Number(b.amountPaid) || 0);

      // If real non-synthetic rows already cover amountPaid, remove synthetic pay_bill_ row
      const realRows = rows.filter((p) => !p.id.startsWith("pay_bill_") && !p.id.startsWith("legacy_pay_"));
      const realSum = realRows.reduce((t, p) => t + signedPaymentAmount(p), 0);
      if (realSum >= (Number(b.amountPaid) || 0) - 0.005) {
        map.delete(`pay_bill_${b.id}`);
      }

      if (surplus <= 0.005) continue;
      for (const sp of rows.filter((p) => p.id.startsWith("pay_bill_"))) {
        if (surplus <= 0.005) break;
        if ((Number(sp.amount) || 0) <= surplus + 0.005) {
          map.delete(sp.id);
          surplus -= Number(sp.amount) || 0;
        }
      }
    }
  });

  return Array.from(map.values()).sort((a, b) => {
    const da = a.paymentDate || a.createdAt || "";
    const db = b.paymentDate || b.createdAt || "";
    return db.localeCompare(da);
  });
}

export function calcCustomerCreditSummary(params: {
  ledBills: Bill[];
  ledPayments: PaymentRecord[];
  rawBalance: number;
  allBills: Bill[];
  allPayments: PaymentRecord[];
}) {
  const { ledBills, ledPayments, rawBalance, allBills, allPayments } = params;
  const realIds = new Set(allPayments.map((p) => p.id));
  const latest = (b: Bill) => allBills.find((x) => x.id === b.id) ?? b;
  const liveBills = ledBills
    .map(latest)
    .filter((b) => b.status !== "cancelled" && !b.cancelled);
  const advance = Math.max(
    0,
    Math.round(
      ledPayments
        .filter((p) => realIds.has(p.id) && isAdvanceRow(p))
        .reduce((t, p) => {
          const amt = Number(p.amount) || 0;
          return t + (amt < 0 ? amt : remainingAdvanceAmount(p));
        }, 0) * 100,
    ) / 100,
  );
  const overpaid =
    Math.round(
      liveBills.reduce((t, b) => t + billRefundDue(b), 0) * 100,
    ) / 100;
  const unpaidDue =
    Math.round(liveBills.reduce((t, b) => t + billBalance(b), 0) * 100) / 100;
  const refundable = Math.max(0, Math.round(-rawBalance * 100) / 100);
  return {
    advance,
    overpaid,
    unpaidDue,
    refundable,
    canApply: unpaidDue > 0.004 && advance + overpaid > 0.004,
  };
}

export interface AdvanceAllocationPlanResult {
  applied: number;
  errorMessage?: string;
  newRows: PaymentRecord[];
  appliedAuditRows: PaymentRecord[];
  billUpdates: Map<number, Bill>;
  appliedByAdvId: Map<string, number>;
  nowIso: string;
}

export function calcAdvanceAllocationPlan(params: {
  ledCustomer?: Customer | null;
  ledBills: Bill[];
  ledPayments: PaymentRecord[];
  allBills: Bill[];
  allPayments: PaymentRecord[];
  onlyBillId?: number;
  recordedBy: string;
}): AdvanceAllocationPlanResult {
  const {
    ledCustomer,
    ledBills,
    ledPayments,
    allBills,
    allPayments,
    onlyBillId,
    recordedBy,
  } = params;
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const latest = (b: Bill) => allBills.find((x) => x.id === b.id) ?? b;
  const liveBills = ledBills
    .map(latest)
    .filter((b) => b.status !== "cancelled" && !b.cancelled);
  const realIds = new Set(allPayments.map((p) => p.id));
  const advRows = ledPayments
    .filter((p) => realIds.has(p.id) && isAdvanceRow(p))
    .sort((a, b) => ((a.paymentDate || "") > (b.paymentDate || "") ? 1 : -1));
  const advNet = r2(
    advRows.reduce((t, p) => {
      const amt = Number(p.amount) || 0;
      return t + (amt < 0 ? amt : remainingAdvanceAmount(p));
    }, 0),
  );
  let advLeft = Math.max(0, advNet);
  const posAdvRem = new Map<string, number>();
  for (const r of advRows) {
    const rem = remainingAdvanceAmount(r);
    if (rem > 0.004) posAdvRem.set(r.id, rem);
  }

  const overpaid = liveBills
    .map((b) => ({ b, e: billRefundDue(b) }))
    .filter((x) => x.e > 0.004);
  const overLeft = new Map(overpaid.map((x) => [x.b.id, x.e]));
  const targets = liveBills
    .filter(
      (b) =>
        billBalance(b) > 0.004 && (onlyBillId == null || b.id === onlyBillId),
    )
    .sort((a, b) => ((a.date || "") > (b.date || "") ? 1 : -1));

  const stamp = Date.now();
  const nowIso = new Date(stamp).toISOString();

  if (advLeft + r2(Array.from(overLeft.values()).reduce((t, v) => t + v, 0)) <= 0.004) {
    return {
      applied: 0,
      errorMessage: "This customer has no advance or credit to adjust.",
      newRows: [],
      appliedAuditRows: [],
      billUpdates: new Map(),
      appliedByAdvId: new Map(),
      nowIso,
    };
  }
  if (targets.length === 0) {
    return {
      applied: 0,
      errorMessage: "This customer has no unpaid invoice to adjust the credit against.",
      newRows: [],
      appliedAuditRows: [],
      billUpdates: new Map(),
      appliedByAdvId: new Map(),
      nowIso,
    };
  }

  let seq = 0;
  const newRows: PaymentRecord[] = [];
  const appliedAuditRows: PaymentRecord[] = [];
  const billUpdates = new Map<number, Bill>();
  const appliedByAdvId = new Map<string, number>();
  const fromOver = new Map<number, number>();
  let applied = 0;

  for (const t of targets) {
    let need = billBalance(t);
    let usedForBill = 0;

    // 1. Allocate from remaining unapplied advance rows (oldest first) while keeping original amount intact
    if (advLeft > 0.004) {
      for (const advRow of advRows) {
        if (need <= 0.004 || advLeft <= 0.004) break;
        const rem = posAdvRem.get(advRow.id) || 0;
        if (rem <= 0.004) continue;
        const take = r2(Math.min(rem, advLeft, need));
        if (take <= 0.004) continue;
        posAdvRem.set(advRow.id, r2(rem - take));
        advLeft = r2(advLeft - take);
        need = r2(need - take);
        usedForBill = r2(usedForBill + take);
        appliedByAdvId.set(advRow.id, r2((appliedByAdvId.get(advRow.id) || 0) + take));
        const adjRow: PaymentRecord = {
          id: `pay_${stamp}_adj${seq++}_${Math.random().toString(36).slice(2, 6)}`,
          billId: t.id,
          customerId: advRow.customerId || ledCustomer?.id,
          customerName: t.retailer,
          customerPhone: t.phone,
          paymentDate: todayISO(),
          amount: take,
          mode: "other",
          entryKind: "advance_adjustment",
          sourcePaymentId: advRow.id,
          referenceNote: `Advance / credit adjusted against invoice #${t.id}`,
          recordedBy,
          createdAt: new Date(stamp + seq).toISOString(),
          updatedAt: new Date(stamp + seq).toISOString(),
        };
        newRows.push(adjRow);
        appliedAuditRows.push(adjRow);
      }
    }

    // 2. Allocate from overpaid invoices (after returns) via balanced transfer pairs
    for (const [obId, left] of Array.from(overLeft.entries())) {
      if (need <= 0.004) break;
      const take = r2(Math.min(left, need));
      if (take <= 0.004) continue;
      overLeft.set(obId, r2(left - take));
      need = r2(need - take);
      usedForBill = r2(usedForBill + take);
      fromOver.set(obId, r2((fromOver.get(obId) || 0) + take));
      const outRow: PaymentRecord = {
        id: `pay_${stamp}_ovrout${seq++}_${Math.random().toString(36).slice(2, 6)}`,
        billId: obId,
        customerId: ledCustomer?.id,
        customerName: t.retailer,
        customerPhone: t.phone,
        paymentDate: todayISO(),
        amount: -take,
        mode: "other",
        entryKind: "advance_adjustment",
        sourceBillId: obId,
        referenceNote: `Advance / credit transferred from invoice #${obId} to #${t.id}`,
        recordedBy,
        createdAt: new Date(stamp + seq).toISOString(),
        updatedAt: new Date(stamp + seq).toISOString(),
      };
      const inRow: PaymentRecord = {
        id: `pay_${stamp}_adj${seq++}_${Math.random().toString(36).slice(2, 6)}`,
        billId: t.id,
        customerId: ledCustomer?.id,
        customerName: t.retailer,
        customerPhone: t.phone,
        paymentDate: todayISO(),
        amount: take,
        mode: "other",
        entryKind: "advance_adjustment",
        sourceBillId: obId,
        referenceNote: `Advance / credit adjusted against invoice #${t.id} (from #${obId})`,
        recordedBy,
        createdAt: new Date(stamp + seq).toISOString(),
        updatedAt: new Date(stamp + seq).toISOString(),
      };
      newRows.push(inRow, outRow);
      appliedAuditRows.push(inRow);
    }

    if (usedForBill <= 0.004) continue;
    applied = r2(applied + usedForBill);
    billUpdates.set(t.id, { ...t, amountPaid: r2((t.amountPaid || 0) + usedForBill) });
  }

  if (applied > 0.004) {
    fromOver.forEach((amt, obId) => {
      const ob = liveBills.find((b) => b.id === obId);
      if (!ob) return;
      billUpdates.set(obId, {
        ...ob,
        amountPaid: Math.max(0, r2((ob.amountPaid || 0) - amt)),
      });
    });
  }

  return {
    applied,
    newRows,
    appliedAuditRows,
    billUpdates,
    appliedByAdvId,
    nowIso,
  };
}

export function calcMissingBillPaymentRows(
  allBills: Bill[],
  payments: PaymentRecord[],
): PaymentRecord[] {
  const refundIds = new Set<string>();
  payments.forEach((p) => {
    if (p?.id && isRefundRow(p)) refundIds.add(String(p.id));
  });
  const existingPaidByBill = new Map<number, number>();
  payments.forEach((p) => {
    if (isRefundRow(p) || (p.reversalOf && refundIds.has(String(p.reversalOf)))) return;
    if (p.billId) {
      existingPaidByBill.set(
        Number(p.billId),
        (existingPaidByBill.get(Number(p.billId)) || 0) + signedPaymentAmount(p),
      );
    }
  });

  const newRows: PaymentRecord[] = [];
  allBills.forEach((b) => {
    if (b.status === "cancelled" || b.cancelled) return;
    const bPaid = Number(b.amountPaid) || 0;
    if (bPaid <= 0) return;
    const recorded = existingPaidByBill.get(b.id) || 0;
    const diff = Math.round((bPaid - recorded) * 100) / 100;
    if (diff > 0.5) {
      newRows.push({
        id: `pay_bill_${b.id}_sync_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        billId: b.id,
        customerName: b.retailer || (b as any).customerName || "Customer",
        customerPhone: b.phone || "",
        amount: diff,
        mode: (b.paymentMode as any) || "cash",
        paymentDate: b.date || todayISO(),
        createdAt: new Date().toISOString(),
        recordedBy: "Auto-Reconcile",
        referenceNote: `Synchronized from Invoice INV-${b.id} paid amount`,
      });
    }
  });
  return newRows;
}
