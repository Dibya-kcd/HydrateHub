import type { Bill, PaymentAuditEntry, PaymentMode, PaymentRecord } from "../types";
import {
  buildAdvanceRestoreRow,
  isAdvanceAdjustmentRow,
  isAdvanceRow,
  isRefundRow,
  signedPaymentAmount,
} from "./paymentAllocation";

/**
 * A recorded payment is never deleted: it is reversed with a NEW entry of the opposite amount that points back at it
 * (`reversalOf`). The original stays in the list, so the customer ledger, the collections report and the audit trail
 * always show what happened and when.
 */

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const normCust = (s?: string) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");

export const isReversalRow = (p: Pick<PaymentRecord, "reversalOf">): boolean => Boolean(p.reversalOf);

/** Ids of payments that already have a reversal entry. */
export function reversedPaymentIds(payments: Pick<PaymentRecord, "reversalOf">[]): Set<string> {
  const out = new Set<string>();
  for (const p of payments) if (p.reversalOf) out.add(String(p.reversalOf));
  return out;
}

/** A plain-language reason why this payment cannot be reversed right now, or null when it can. */
export function paymentReversalBlocker(
  target: PaymentRecord,
  payments: PaymentRecord[],
): string | null {
  if (target.reversalOf) {
    return "This entry is itself a reversal. To undo it, record the payment again as a new receipt.";
  }
  if (reversedPaymentIds(payments).has(String(target.id))) {
    return "This payment has already been reversed.";
  }
  if (isAdvanceAdjustmentRow(target)) {
    return "This row moves advance money onto an invoice. Use \"Remove advance from invoice\" to undo it.";
  }
  if (isAdvanceRow(target) && ((Number(target.appliedAmount) || 0) > 0 || target.isAdvanceApplied)) {
    return "Part of this advance has already been used on invoices. Undo those advance adjustments first, then reverse the advance.";
  }
  if (!(Math.abs(Number(target.amount) || 0) > 0)) return "This entry has no amount to reverse.";
  return null;
}

export function buildPaymentReversal(
  target: PaymentRecord,
  opts: { id: string; nowIso: string; today: string; by: string; reason: string },
): PaymentRecord {
  const amount = round2(-(Number(target.amount) || 0));
  const orig = Math.abs(round2(Number(target.amount) || 0));
  const dateRef = target.paymentDate || (target.createdAt || "").slice(0, 10);
  const ref = (target.referenceNote || "").trim();
  const row: PaymentRecord = {
    id: opts.id,
    ...(target.billId ? { billId: target.billId } : {}),
    ...(target.customerId ? { customerId: target.customerId } : {}),
    customerName: target.customerName,
    customerPhone: target.customerPhone || "",
    ...(target.salesmanId ? { salesmanId: target.salesmanId } : {}),
    paymentDate: opts.today,
    amount,
    mode: target.mode,
    entryKind: target.entryKind === "refund" ? "receipt" : target.entryKind || (isAdvanceRow(target) ? "advance" : "receipt"),
    referenceNote: `Reversal of ₹${orig} ${amount < 0 ? "receipt" : "refund"} dated ${dateRef}${ref ? ` (${ref})` : ""}${
      opts.reason ? ` — Reason: ${opts.reason}` : ""
    }`,
    recordedBy: opts.by,
    reversalOf: String(target.id),
    createdAt: opts.nowIso,
    updatedAt: opts.nowIso,
  };
  // Money that was held on account stays "on account": the opposite entry must count against the same advance pool.
  if (isAdvanceRow(target)) row.isAdvance = true;
  return row;
}

export type PaymentEditValidation =
  | { ok: true; kind: "in_place_adjustment" | "note_only" | "replace"; cleanCustomer: string; newAmount: number }
  | { ok: false; error?: string };

/**
 * Pure pre-flight check for `updatePayment`: ensures an edit is valid BEFORE reversing the old entry,
 * so a rejected edit never leaves a payment reversed or logs a phantom activity entry.
 */
export function validatePaymentEdit(
  updated: PaymentRecord,
  currentPayments: PaymentRecord[],
): PaymentEditValidation {
  const old = currentPayments.find((p) => p.id === updated.id);
  if (!old) return { ok: false };

  if (isAdvanceAdjustmentRow(old)) {
    if (old.isRefund) {
      return { ok: false, error: "A refund entry cannot be edited. Reverse it and record the refund again." };
    }
    return { ok: true, kind: "in_place_adjustment", cleanCustomer: old.customerName, newAmount: Number(updated.amount) || 0 };
  }

  if (old.isRefund || (Number(old.amount) || 0) < 0 || old.reversalOf) {
    return { ok: false, error: "A refund or reversal entry cannot be edited. Reverse it and record the entry again." };
  }
  if (reversedPaymentIds(currentPayments).has(String(old.id))) {
    return { ok: false, error: "This payment has been reversed, so it can no longer be edited." };
  }

  const amountChanged = Math.abs((Number(updated.amount) || 0) - (Number(old.amount) || 0)) > 0.004;
  const moneyChanged =
    amountChanged ||
    (updated.billId || 0) !== (old.billId || 0) ||
    (updated.mode || "") !== (old.mode || "") ||
    (updated.paymentDate || "") !== (old.paymentDate || "") ||
    (updated.customerName || "").trim() !== (old.customerName || "").trim();

  if (!moneyChanged) {
    if ((updated.referenceNote || "") === (old.referenceNote || "")) {
      return { ok: false };
    }
    return { ok: true, kind: "note_only", cleanCustomer: old.customerName, newAmount: Number(old.amount) || 0 };
  }

  const newAmount = round2(Number(updated.amount) || 0);
  if (!(newAmount > 0)) {
    return { ok: false, error: "Enter an amount above zero, or use Reverse to cancel this payment." };
  }
  const cleanCustomer = (updated.customerName || "").trim() || (old.customerName || "").trim();
  if (!cleanCustomer) {
    return { ok: false, error: "Customer name is required to record the corrected payment." };
  }
  const blocker = paymentReversalBlocker(old, currentPayments);
  if (blocker) {
    return { ok: false, error: blocker };
  }
  return { ok: true, kind: "replace", cleanCustomer, newAmount };
}

export interface BillEditPaymentPlan {
  newRows: PaymentRecord[];
  updatedById: Map<string, PaymentRecord>;
  removedAdjustmentIds: string[];
  auditEntries: Omit<PaymentAuditEntry, "id" | "at" | "by">[];
  keptAsAdvance: number;
  reversedByMode: Map<PaymentMode, number>;
  existingBillSum: number;
  identityUpdatesNeeded: boolean;
}

/**
 * Pure planner for updating payments when an invoice is edited.
 * Never deletes or shrinks real recorded receipts: when the bill's paid amount drops,
 * existing receipts are kept intact on their original dates and reversal rows are created
 * (plus a replacement receipt for the remaining amount if partially reduced).
 */
export function planBillEditPayments(params: {
  payments: PaymentRecord[];
  bill: Pick<Bill, "id" | "retailer" | "phone" | "customerId" | "total" | "paymentMode" | "salesmanId">;
  targetPaid: number;
  requestedPaid?: number;
  today: string;
  nowIso: string;
  paymentDate: string;
  mode: PaymentMode;
  note?: string;
  recordedBy: string;
  salesmanId?: string;
  newId: (tag?: string) => string;
  reason?: string;
  advanceNote?: string;
  preserveExcessAsAdvance?: boolean;
}): BillEditPaymentPlan {
  const {
    payments,
    bill,
    targetPaid,
    requestedPaid,
    today,
    nowIso,
    paymentDate,
    mode,
    note,
    recordedBy,
    salesmanId,
    newId,
    reason,
    advanceNote,
    preserveExcessAsAdvance = true,
  } = params;

  const paid = round2(Math.max(0, targetPaid));
  const reqPaid = requestedPaid !== undefined ? round2(Math.max(0, requestedPaid)) : paid;

  const refundIds = new Set<string>();
  for (const p of payments) {
    if (p?.id && isRefundRow(p)) refundIds.add(String(p.id));
  }
  const forBill = payments.filter(
    (p) =>
      p.billId === bill.id &&
      !isRefundRow(p) &&
      !(p.reversalOf && refundIds.has(String(p.reversalOf))),
  );
  const existingBillSum = round2(forBill.reduce((sum, p) => sum + signedPaymentAmount(p), 0));
  const delta = round2(paid - existingBillSum);

  const identityUpdatesNeeded = payments.some(
    (p) =>
      p.billId === bill.id &&
      (normCust(p.customerName) !== normCust(bill.retailer) ||
        (Boolean(bill.phone) && p.customerPhone !== bill.phone)),
  );

  const newRows: PaymentRecord[] = [];
  const updatedById = new Map<string, PaymentRecord>();
  const removedAdjustmentIds: string[] = [];
  const auditEntries: Omit<PaymentAuditEntry, "id" | "at" | "by">[] = [];
  const reversedByMode = new Map<PaymentMode, number>();
  let freedFromSourceAdv = 0;

  if (delta > 0.004) {
    const newPay: PaymentRecord = {
      id: newId("edit"),
      billId: bill.id,
      ...(bill.customerId ? { customerId: bill.customerId } : {}),
      customerName: bill.retailer,
      customerPhone: bill.phone || "",
      paymentDate: paymentDate || today,
      amount: delta,
      mode: mode || "cash",
      entryKind: "receipt",
      referenceNote: note || `Payment on Invoice #${bill.id} (edit)`,
      recordedBy,
      ...(salesmanId || bill.salesmanId ? { salesmanId: salesmanId || bill.salesmanId } : {}),
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    newRows.push(newPay);
    auditEntries.push({
      action: "record",
      paymentId: newPay.id,
      billId: bill.id,
      customerName: bill.retailer,
      amount: delta,
      note: `Payment of ₹${delta} recorded on Invoice #${bill.id} (edit)`,
      after: newPay,
    });
  } else if (delta < -0.004) {
    let toRemove = round2(-delta);
    const reversedIds = reversedPaymentIds(payments);

    // 1. Reverse real receipt rows (newest first) without mutating or deleting them.
    const reversibleReceipts = [...forBill]
      .filter(
        (p) =>
          signedPaymentAmount(p) > 0 &&
          !p.reversalOf &&
          !reversedIds.has(String(p.id)) &&
          !isAdvanceAdjustmentRow(p),
      )
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    const editReason = reason || `Invoice #${bill.id} edited`;
    for (const rec of reversibleReceipts) {
      if (toRemove <= 0.005) break;
      const amt = round2(Number(rec.amount) || 0);
      if (!(amt > 0)) continue;

      const revRow = buildPaymentReversal(rec, {
        id: newId("rev"),
        nowIso,
        today,
        by: recordedBy,
        reason: editReason,
      });
      if (bill.retailer) revRow.customerName = bill.retailer;
      if (bill.phone) revRow.customerPhone = bill.phone;
      newRows.push(revRow);

      auditEntries.push({
        action: "reverse",
        paymentId: rec.id,
        billId: bill.id,
        customerName: revRow.customerName,
        amount: revRow.amount,
        note:
          `Reversed ₹${amt} ${rec.mode || "cash"} receipt on invoice #${bill.id} (${editReason})` +
          ` (new entry ${revRow.id})`,
        before: rec,
        after: revRow,
      });

      const recMode = (rec.mode || "cash") as PaymentMode;
      if (amt <= toRemove + 0.005) {
        reversedByMode.set(recMode, round2((reversedByMode.get(recMode) || 0) + amt));
        toRemove = round2(toRemove - amt);
      } else {
        const remaining = round2(amt - toRemove);
        const recDate = rec.paymentDate || (rec.createdAt || "").slice(0, 10);
        const remRow: PaymentRecord = {
          id: newId("rem"),
          billId: bill.id,
          ...(rec.customerId || bill.customerId ? { customerId: rec.customerId || bill.customerId } : {}),
          customerName: bill.retailer || rec.customerName,
          customerPhone: bill.phone || rec.customerPhone || "",
          ...(rec.salesmanId || salesmanId || bill.salesmanId
            ? { salesmanId: rec.salesmanId || salesmanId || bill.salesmanId }
            : {}),
          paymentDate: today,
          amount: remaining,
          mode: recMode,
          entryKind: "receipt",
          referenceNote: `Remaining ₹${remaining} after invoice #${bill.id} edit (replaces ₹${amt} receipt dated ${recDate})`,
          recordedBy,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        newRows.push(remRow);
        auditEntries.push({
          action: "invoice_edited",
          paymentId: remRow.id,
          billId: bill.id,
          customerName: remRow.customerName,
          amount: remaining,
          note: `Remaining ₹${remaining} re-recorded on invoice #${bill.id} after ₹${toRemove} reduction`,
          after: remRow,
        });
        reversedByMode.set(recMode, round2((reversedByMode.get(recMode) || 0) + toRemove));
        toRemove = 0;
      }
    }

    // 2. If any reduction remains and was backed by an internal advance_adjustment, release that allocation cleanly.
    if (toRemove > 0.005) {
      const adjustments = [...forBill]
        .filter((p) => isAdvanceAdjustmentRow(p) && signedPaymentAmount(p) > 0 && !p.reversalOf)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

      for (const adj of adjustments) {
        if (toRemove <= 0.005) break;
        const adjAmt = round2(Number(adj.amount) || 0);
        if (!(adjAmt > 0)) continue;
        const take = round2(Math.min(adjAmt, toRemove));

        const src = adj.sourcePaymentId
          ? payments.find((p) => p.id === adj.sourcePaymentId)
          : undefined;
        const curSrc = src ? (updatedById.get(src.id) ?? src) : undefined;
        if (curSrc) {
          const srcTotal = Number(curSrc.amount) || 0;
          const nextApplied = Math.max(0, round2((Number(curSrc.appliedAmount) || 0) - take));
          updatedById.set(curSrc.id, {
            ...curSrc,
            appliedAmount: nextApplied,
            isAdvanceApplied: nextApplied >= srcTotal - 0.004 && nextApplied > 0.004,
            updatedAt: nowIso,
          });
          freedFromSourceAdv = round2(freedFromSourceAdv + take);
        } else if (preserveExcessAsAdvance && reqPaid > paid + 0.004) {
          const restored = buildAdvanceRestoreRow(
            { ...adj, amount: take },
            () => newId("advrst"),
            recordedBy,
          );
          newRows.push(restored);
          freedFromSourceAdv = round2(freedFromSourceAdv + take);
        }

        if (take >= adjAmt - 0.005) {
          removedAdjustmentIds.push(adj.id);
          auditEntries.push({
            action: "invoice_edited",
            paymentId: adj.id,
            billId: bill.id,
            customerName: adj.customerName,
            amount: adjAmt,
            note: `Invoice #${bill.id} edited: ₹${adjAmt} advance adjustment released back to customer account`,
            before: adj,
          });
        } else {
          const reducedAdj: PaymentRecord = {
            ...adj,
            amount: round2(adjAmt - take),
            updatedAt: nowIso,
          };
          updatedById.set(adj.id, reducedAdj);
          auditEntries.push({
            action: "invoice_edited",
            paymentId: adj.id,
            billId: bill.id,
            customerName: adj.customerName,
            amount: take,
            note: `Invoice #${bill.id} edited: ₹${take} of advance adjustment released back to customer account`,
            before: adj,
            after: reducedAdj,
          });
        }
        toRemove = round2(toRemove - take);
      }
    }
  }

  const rawKeptAsAdvance = preserveExcessAsAdvance
    ? Math.max(0, round2(Math.min(reqPaid, existingBillSum) - paid))
    : 0;
  const keptAsAdvance = rawKeptAsAdvance > 0.004 ? rawKeptAsAdvance : 0;
  let advToCreate = Math.max(0, round2(keptAsAdvance - freedFromSourceAdv));

  if (advToCreate > 0.004) {
    // Match the payment mode(s) of the reversed receipt(s) so daily collections net to zero on today's report.
    for (const [revMode, revAmt] of reversedByMode.entries()) {
      if (advToCreate <= 0.004) break;
      const take = round2(Math.min(advToCreate, revAmt));
      if (take <= 0.004) continue;
      advToCreate = round2(advToCreate - take);
      const advRow: PaymentRecord = {
        id: newId("adv"),
        ...(bill.customerId ? { customerId: bill.customerId } : {}),
        customerName: bill.retailer,
        customerPhone: bill.phone || "",
        ...(salesmanId || bill.salesmanId ? { salesmanId: salesmanId || bill.salesmanId } : {}),
        paymentDate: today,
        amount: take,
        mode: revMode,
        entryKind: "advance",
        referenceNote: advanceNote || `Advance / on account (invoice #${bill.id} total was reduced)`,
        recordedBy,
        isAdvance: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      newRows.push(advRow);
      auditEntries.push({
        action: "invoice_edited",
        paymentId: advRow.id,
        billId: bill.id,
        customerName: bill.retailer,
        amount: take,
        note: `Invoice #${bill.id} total reduced: ₹${take} already received kept as advance`,
        after: advRow,
      });
    }

    if (advToCreate > 0.004) {
      const advRow: PaymentRecord = {
        id: newId("adv"),
        ...(bill.customerId ? { customerId: bill.customerId } : {}),
        customerName: bill.retailer,
        customerPhone: bill.phone || "",
        ...(salesmanId || bill.salesmanId ? { salesmanId: salesmanId || bill.salesmanId } : {}),
        paymentDate: today,
        amount: advToCreate,
        mode: bill.paymentMode || mode || "cash",
        entryKind: "advance",
        referenceNote: advanceNote || `Advance / on account (invoice #${bill.id} total was reduced)`,
        recordedBy,
        isAdvance: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      newRows.push(advRow);
      auditEntries.push({
        action: "invoice_edited",
        paymentId: advRow.id,
        billId: bill.id,
        customerName: bill.retailer,
        amount: advToCreate,
        note: `Invoice #${bill.id} total reduced: ₹${advToCreate} already received kept as advance`,
        after: advRow,
      });
    }
  }

  return {
    newRows,
    updatedById,
    removedAdjustmentIds,
    auditEntries,
    keptAsAdvance,
    reversedByMode,
    existingBillSum,
    identityUpdatesNeeded,
  };
}

/**
 * Pure, idempotent state transition for `setPayments(prev => applyBillEditPaymentPlan(prev, bill, plan))`.
 * Contains zero side effects so React StrictMode double-invocation is completely safe.
 */
export function applyBillEditPaymentPlan(
  prev: PaymentRecord[],
  bill: Pick<Bill, "id" | "retailer" | "phone">,
  plan: BillEditPaymentPlan,
): PaymentRecord[] {
  const newIds = new Set(plan.newRows.map((r) => r.id));
  const allNewAlreadyPresent =
    plan.newRows.length === 0 || plan.newRows.every((r) => prev.some((p) => p.id === r.id));
  const needsIdentityOnPrev = prev.some(
    (p) =>
      p.billId === bill.id &&
      (normCust(p.customerName) !== normCust(bill.retailer) ||
        (Boolean(bill.phone) && p.customerPhone !== bill.phone)),
  );
  const hasUpdatesNeeded = Array.from(plan.updatedById.entries()).some(([id, next]) => {
    const cur = prev.find((p) => p.id === id);
    return cur && cur !== next && JSON.stringify(cur) !== JSON.stringify(next);
  });
  const hasRemovalsNeeded =
    plan.removedAdjustmentIds.length > 0 &&
    plan.removedAdjustmentIds.some((id) => prev.some((p) => p.id === id));

  if (allNewAlreadyPresent && !needsIdentityOnPrev && !hasUpdatesNeeded && !hasRemovalsNeeded) {
    return prev;
  }

  const removedSet = new Set(plan.removedAdjustmentIds);
  const base = prev
    .filter((p) => !removedSet.has(p.id) && !newIds.has(p.id))
    .map((p) => {
      let next = plan.updatedById.get(p.id) ?? p;
      if (
        next.billId === bill.id &&
        (normCust(next.customerName) !== normCust(bill.retailer) ||
          (Boolean(bill.phone) && next.customerPhone !== bill.phone))
      ) {
        next = {
          ...next,
          customerName: bill.retailer,
          customerPhone: bill.phone || next.customerPhone,
        };
      }
      return next;
    });
  return [...plan.newRows, ...base];
}

