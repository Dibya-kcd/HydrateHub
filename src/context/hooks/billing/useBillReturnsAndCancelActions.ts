import {
  pushBillToSupabase,
  pushTripToSupabase,
} from "../../../lib/supabase";
import type {
  Bill,
  BillCancellation,
  PaymentRecord,
  ReturnTracking,
  SalesReturn,
  ScrapAction,
} from "../../../types";
import { todayISO } from "../../../utils/dateLocal";
import { stampChangedPayments } from "../../../utils/paymentStamp";
import {
  buildSalesReturn,
  type SalesReturnInputLine,
  type SalesReturnResult,
} from "../../../utils/salesReturns";
import { saveOrders } from "../../../utils/storage";
import {
  cloud,
  cloudFetch,
  emptyCart,
  reserveDocNumber,
  stampChangedBills,
} from "../../ledgerHelpers";
import type { NormalizedBillingParams } from "./billingShared";

export function createBillReturnsAndCancelActions(
  params: NormalizedBillingParams,
) {
  const {
    allBillsRef,
    setBills,
    commitBillUpdates,
    setCart,
    editingBillId,
    setEditingBillId,
    products,
    warehouses,
    inventoryBatches,
    setTrips,
    payments,
    paymentsRef,
    setPayments,
    inventoryDispositions,
    addInventoryDisposition,
    deleteInventoryDisposition,
    fallbackWarehouseId,
    remainingStock,
    logPaymentAudit,
    currentUser,
    notify,
  } = params;

  function cancelBill(billId: number, reason: string): BillCancellation | null {
    const currentBills = allBillsRef.current;
    const target = currentBills.find((b) => b.id === billId);
    if (!target || target.status === "cancelled") return null;
    if ((target.returns || []).length > 0) {
      notify(
        "This invoice has customer returns against it, so it cannot be cancelled. The returns already credit the customer.",
      );
      return null;
    }
    const year = new Date().getFullYear();
    const prefix = `CN-${year}-`;
    const highest = currentBills.reduce((m, b) => {
      const no = b.cancellation?.creditNoteNo;
      const n =
        no && no.startsWith(prefix) ? parseInt(no.slice(prefix.length), 10) : 0;
      return Number.isFinite(n) && n > m ? n : m;
    }, 0);
    const seq = reserveDocNumber(`cn-${year}`, highest);
    const cancellation: BillCancellation = {
      creditNoteNo: `${prefix}${String(seq).padStart(3, "0")}`,
      date: todayISO(),
      reason: reason.trim() || "Cancelled",
      refundDue: Math.max(0, Number(target.amountPaid) || 0),
      cancelledBy: currentUser?.name || "Admin",
    };
    const cancelled: Bill = { ...target, status: "cancelled", cancellation };
    const nextBills = stampChangedBills(
      currentBills,
      currentBills.map((b) => (b.id === billId ? cancelled : b)),
    );
    allBillsRef.current = nextBills;
    saveOrders(nextBills).catch(() => {});
    setBills((bs) => bs.map((b) => (b.id === billId ? cancelled : b)));
    const currentPayments = paymentsRef?.current ?? payments;
    const releasedRows = currentPayments.filter((p) => p.billId === billId);
    if (releasedRows.length > 0) {
      const releaseForCancel = (list: PaymentRecord[]): PaymentRecord[] =>
        list.map((p) =>
          p.billId === billId
            ? {
                ...p,
                billId: undefined,
                isAdvance: true,
                referenceNote: [
                  p.referenceNote,
                  `Advance / on account (from cancelled invoice #${billId})`,
                ]
                  .filter(Boolean)
                  .join(" · "),
              }
            : p,
        );
      if (paymentsRef) {
        paymentsRef.current = stampChangedPayments(
          currentPayments,
          releaseForCancel(currentPayments),
        );
      }
      setPayments((prev) => releaseForCancel(prev));
      releasedRows.forEach((p) =>
        logPaymentAudit({
          action: "invoice_cancelled",
          paymentId: p.id,
          billId,
          customerName: p.customerName,
          amount: p.amount,
          note: `Invoice #${billId} cancelled: ₹${p.amount} kept as customer advance`,
          before: p,
        }),
      );
    }
    setTrips((ts) =>
      ts.map((t) => {
        if (!t.billIds.includes(billId)) return t;
        const updatedT = {
          ...t,
          billIds: t.billIds.filter((id) => id !== billId),
        };
        cloud("pushTripToSupabase", pushTripToSupabase(updatedT));
        return updatedT;
      }),
    );
    if (editingBillId === billId) {
      setEditingBillId(null);
      setCart(emptyCart());
    }
    cloud("pushBillToSupabase", pushBillToSupabase(cancelled));
    cloudFetch("/api/bills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cancelled),
    });
    return cancellation;
  }

  function recordReturnScrap(
    target: Bill,
    retValue: SalesReturn,
    resolveWh: (l: SalesReturnInputLine) => string | undefined,
    skipReturnId?: string,
  ) {
    try {
      const today = retValue.date;
      const billId = target.id;
      for (const line of retValue.lines) {
        let need = Number(line.scrapQty) || 0;
        if (need <= 0) continue;
        const action: ScrapAction = line.scrapAction || "undecided";
        const prod = products.find((x) => x.id === line.productId);
        const prodCost =
          Number((prod as any)?.effectiveCost ?? (prod as any)?.cost ?? 0) || 0;
        const whId = resolveWh({
          productId: line.productId,
          restockQty: 0,
          scrapQty: need,
        });
        const whName = warehouses.find((w) => w.id === whId)?.name;

        const used: Record<string, number> = {};
        for (const r of target.returns || [])
          for (const l of r.lines)
            for (const br of l.batchRestocks || [])
              used[br.batchId] = (used[br.batchId] || 0) + br.qty;
        for (const l of retValue.lines)
          if (l.productId === line.productId)
            for (const br of l.batchRestocks || [])
              used[br.batchId] = (used[br.batchId] || 0) + br.qty;
        for (const d of inventoryDispositions) {
          const rt = d.returnTracking;
          if (
            rt &&
            rt.sourceBillId === billId &&
            d.batchId &&
            !(skipReturnId && rt.sourceReturnId === skipReturnId)
          )
            used[d.batchId] =
              (used[d.batchId] || 0) + (Number(d.quantity) || 0);
        }

        const chunks: { batchId?: string; qty: number }[] = [];
        for (const it of target.items) {
          if (it.productId !== line.productId) continue;
          for (const a of it.batchAllocations || []) {
            if (need <= 0) break;
            const room = Math.max(
              0,
              (Number(a.qty) || 0) - (used[a.batchId] || 0),
            );
            const take = Math.min(room, need);
            if (take > 0) {
              chunks.push({ batchId: a.batchId, qty: take });
              used[a.batchId] = (used[a.batchId] || 0) + take;
              need -= take;
            }
          }
        }
        if (need > 0) chunks.push({ qty: need });

        for (const ch of chunks) {
          const batch = ch.batchId
            ? inventoryBatches.find((b) => b.id === ch.batchId)
            : undefined;
          const cost =
            Number(batch?.effectiveCostPrice ?? batch?.costPrice ?? 0) ||
            prodCost;
          const tracking: ReturnTracking = {
            sourceBillId: billId,
            sourceReturnId: retValue.id,
            creditNoteNo: retValue.creditNoteNo,
            customerName: target.retailer || "Walk-in",
            decision: action,
            stage: action === "discard" ? "discarded" : "held",
            discardedOn: action === "discard" ? today : undefined,
            log: [
              {
                date: today,
                stage: action === "discard" ? "discarded" : "held",
                note:
                  action === "company"
                    ? "Marked to send back to company"
                    : action === "discard"
                      ? "Marked to throw out"
                      : "Returned by customer — decision pending",
              },
            ],
          };
          addInventoryDisposition({
            dispositionType:
              action === "discard" ? "expired_writeoff" : "expiry_return",
            productId: line.productId,
            productName: line.productName,
            warehouseId: whId || warehouses[0]?.id || "",
            warehouseName: whName,
            batchId: ch.batchId,
            batchNumber: batch?.batchNumber,
            expiryDate: batch?.expiryDate,
            quantity: ch.qty,
            unit: "case",
            costPerUnit: cost,
            supplierName: batch?.supplierName,
            supplierInvoiceNo: batch?.supplierInvoiceNo,
            compensationStatus:
              action === "company" ? "pending" : "not_applicable",
            reason: retValue.reason,
            notes: `Customer return ${retValue.creditNoteNo} · ${target.retailer || "Walk-in"} · invoice #${billId}`,
            referenceDocNo: retValue.creditNoteNo,
            eventDate: today,
            createdBy: currentUser?.name || "Admin",
            stockApplied: false,
            returnTracking: tracking,
          } as any);
        }
      }
    } catch (e) {
      console.warn("Could not record scrap tracking for return", e);
    }
  }

  function createSalesReturn(
    billId: number,
    lines: SalesReturnInputLine[],
    reason: string,
  ): SalesReturnResult {
    const target = allBillsRef.current.find((b) => b.id === billId);
    if (!target) return { ok: false, error: "Invoice not found." };
    const year = new Date().getFullYear();
    const prefix = `SR-${year}-`;
    const highest = allBillsRef.current.reduce((m, b) => {
      let mm = m;
      for (const r of b.returns || []) {
        const n = r.creditNoteNo.startsWith(prefix)
          ? parseInt(r.creditNoteNo.slice(prefix.length), 10)
          : 0;
        if (Number.isFinite(n) && n > mm) mm = n;
      }
      return mm;
    }, 0);

    const resolveWh = (l: SalesReturnInputLine): string | undefined => {
      const valid = (id?: string) =>
        !!id && warehouses.some((w) => w.id === id);
      if (valid(l.warehouseId)) return l.warehouseId;
      if (valid(target.warehouseId)) return target.warehouseId;
      const it = target.items.find((i) => i.productId === l.productId);
      const batchWh = (it?.batchAllocations || [])
        .map(
          (a) => inventoryBatches.find((b) => b.id === a.batchId)?.warehouseId,
        )
        .find((id) => valid(id));
      if (batchWh) return batchWh;
      const p = products.find((x) => x.id === l.productId);
      return p ? fallbackWarehouseId(p) || undefined : undefined;
    };
    const resolved = lines.map((l) => ({
      ...l,
      warehouseId: (Number(l.restockQty) || 0) > 0 ? resolveWh(l) : undefined,
    }));

    const batchWarehouse = Object.fromEntries(
      inventoryBatches.map((b) => [b.id, b.warehouseId]),
    );
    const draft = buildSalesReturn(target, resolved, {
      id: "",
      creditNoteNo: "",
      date: "",
      reason,
      createdBy: currentUser?.name || "Admin",
      batchWarehouse,
    });
    if (!draft.ok) return draft;

    const seq = reserveDocNumber(`sr-${year}`, highest);
    const result = buildSalesReturn(target, resolved, {
      id: `sr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      creditNoteNo: `${prefix}${String(seq).padStart(3, "0")}`,
      date: todayISO(),
      reason,
      createdBy: currentUser?.name || "Admin",
      batchWarehouse,
    });
    if (!result.ok) return result;

    const createdBy = currentUser?.name || "Admin";
    const createdAt = new Date().toISOString();
    const updated: Bill = {
      ...target,
      returns: [...(target.returns || []), result.value],
      editHistory: [
        ...(target.editHistory || []),
        {
          at: createdAt,
          by: createdBy,
          comment: `Return ${result.value.creditNoteNo} created: ${result.value.reason}`,
          changes: [
            `Credit ₹${(Number(result.value.totalCredit) || 0).toLocaleString("en-IN")}`,
            ...result.value.lines.map(
              (l) =>
                `${l.productName}: ${l.restockQty} restocked / ${l.scrapQty} scrapped`,
            ),
          ],
          stockChanged: true,
          totalBefore: Number(target.total) || 0,
          totalAfter: Number(target.total) || 0,
          paidBefore: Number(target.amountPaid) || 0,
          paidAfter: Number(target.amountPaid) || 0,
        },
      ],
    };
    commitBillUpdates(new Map([[billId, updated]]));
    cloudFetch("/api/bills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });

    recordReturnScrap(target, result.value, resolveWh);
    return result;
  }

  function returnDispositions(billId: number, returnId: string) {
    return inventoryDispositions.filter(
      (d) =>
        d.returnTracking?.sourceBillId === billId &&
        d.returnTracking?.sourceReturnId === returnId,
    );
  }
  function dispositionWithCompany(d: (typeof inventoryDispositions)[number]) {
    const rt = d.returnTracking;
    return (
      rt?.stage === "sent" ||
      rt?.stage === "settled" ||
      rt?.stage === "rejected" ||
      d.compensationStatus === "settled" ||
      d.compensationStatus === "partial" ||
      d.compensationStatus === "rejected"
    );
  }
  function restockStillOnShelf(
    ret: SalesReturn,
    keepRestock: Record<number, number>,
  ): string | null {
    for (const l of ret.lines) {
      const give =
        (Number(l.restockQty) || 0) - (keepRestock[l.productId] || 0);
      if (give <= 0) continue;
      const have = remainingStock(l.productId);
      if (give > have)
        return `${l.productName}: ${give} crate(s) of this return went back on the shelf, but only ${have} are in stock now (the rest were sold again). Reverse or reduce that later sale first.`;
    }
    return null;
  }

  function cancelSalesReturn(
    billId: number,
    returnId: string,
    reason: string,
  ): { ok: true } | { ok: false; error: string } {
    const target = allBillsRef.current.find((b) => b.id === billId);
    const ret = target?.returns?.find((r) => r.id === returnId);
    if (!target || !ret) return { ok: false, error: "Return not found." };
    if (reason.trim().length < 3)
      return {
        ok: false,
        error: "Please write a short reason for cancelling this return.",
      };
    const sentOut = returnDispositions(billId, returnId).filter(
      dispositionWithCompany,
    );
    if (sentOut.length > 0)
      return {
        ok: false,
        error:
          "Scrapped crates of this return were already sent to the company / settled. Undo that in Expiry returns first, then cancel the return.",
      };
    const shelf = restockStillOnShelf(ret, {});
    if (shelf) return { ok: false, error: shelf };

    const by = currentUser?.name || "Admin";
    const now = new Date().toISOString();
    const updated: Bill = {
      ...target,
      returns: (target.returns || []).filter((r) => r.id !== returnId),
      cancelledReturns: [
        ...(target.cancelledReturns || []),
        {
          ...ret,
          cancelledAt: now,
          cancelledBy: by,
          cancelReason: reason.trim(),
        },
      ],
      editHistory: [
        ...(target.editHistory || []),
        {
          at: now,
          by,
          comment: `Return ${ret.creditNoteNo} cancelled: ${reason.trim()}`,
          changes: [
            `Credit ₹${(Number(ret.totalCredit) || 0).toLocaleString("en-IN")} reversed`,
            ...ret.lines.map(
              (l) =>
                `${l.productName}: ${l.restockQty} restocked / ${l.scrapQty} scrapped un-returned`,
            ),
          ],
          stockChanged: true,
          totalBefore: Number(target.total) || 0,
          totalAfter: Number(target.total) || 0,
          paidBefore: Number(target.amountPaid) || 0,
          paidAfter: Number(target.amountPaid) || 0,
        },
      ],
    };
    commitBillUpdates(new Map([[billId, updated]]));
    saveOrders(allBillsRef.current).catch(() => {});
    cloudFetch("/api/bills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
    returnDispositions(billId, returnId).forEach((d) =>
      deleteInventoryDisposition(d.id),
    );
    notify(
      `Return ${ret.creditNoteNo} cancelled. ₹${(Number(ret.totalCredit) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })} is owed on invoice #${billId} again and the restocked crates left stock.`,
    );
    return { ok: true };
  }

  function editSalesReturn(
    billId: number,
    returnId: string,
    lines: SalesReturnInputLine[],
    reason: string,
    editNote: string,
  ): SalesReturnResult {
    const target = allBillsRef.current.find((b) => b.id === billId);
    const old = target?.returns?.find((r) => r.id === returnId);
    if (!target || !old) return { ok: false, error: "Return not found." };
    if (editNote.trim().length < 3)
      return {
        ok: false,
        error: "Please write a short comment explaining this correction.",
      };
    const sentOut = returnDispositions(billId, returnId).filter(
      dispositionWithCompany,
    );
    if (sentOut.length > 0)
      return {
        ok: false,
        error:
          "Scrapped crates of this return were already sent to the company / settled, so it cannot be edited. Undo that in Expiry returns first.",
      };

    const without: Bill = {
      ...target,
      returns: (target.returns || []).filter((r) => r.id !== returnId),
    };
    const valid = (id?: string) => !!id && warehouses.some((w) => w.id === id);
    const resolveWh = (l: SalesReturnInputLine): string | undefined => {
      if (valid(l.warehouseId)) return l.warehouseId;
      if (valid(target.warehouseId)) return target.warehouseId;
      const it = target.items.find((i) => i.productId === l.productId);
      const bw = (it?.batchAllocations || [])
        .map(
          (a) => inventoryBatches.find((b) => b.id === a.batchId)?.warehouseId,
        )
        .find((id) => valid(id));
      if (bw) return bw;
      const p = products.find((x) => x.id === l.productId);
      return p ? fallbackWarehouseId(p) || undefined : undefined;
    };
    const resolved = lines.map((l) => ({
      ...l,
      warehouseId: (Number(l.restockQty) || 0) > 0 ? resolveWh(l) : undefined,
    }));
    const batchWarehouse = Object.fromEntries(
      inventoryBatches.map((b) => [b.id, b.warehouseId]),
    );
    const built = buildSalesReturn(without, resolved, {
      id: old.id,
      creditNoteNo: old.creditNoteNo,
      date: old.date,
      reason,
      createdBy: old.createdBy,
      batchWarehouse,
    });
    if (!built.ok) return built;

    const keep: Record<number, number> = {};
    for (const l of built.value.lines) keep[l.productId] = l.restockQty;
    const shelf = restockStillOnShelf(old, keep);
    if (shelf) return { ok: false, error: shelf };

    const by = currentUser?.name || "Admin";
    const now = new Date().toISOString();
    const revised: SalesReturn = {
      ...built.value,
      revisedAt: now,
      revisedBy: by,
      revisionNote: editNote.trim(),
    };
    const updated: Bill = {
      ...target,
      returns: (target.returns || []).map((r) =>
        r.id === returnId ? revised : r,
      ),
      editHistory: [
        ...(target.editHistory || []),
        {
          at: now,
          by,
          comment: `Return ${old.creditNoteNo} corrected: ${editNote.trim()}`,
          changes: [
            `Credit ₹${(Number(old.totalCredit) || 0).toLocaleString("en-IN")} → ₹${(Number(revised.totalCredit) || 0).toLocaleString("en-IN")}`,
          ],
          stockChanged: true,
          totalBefore: Number(target.total) || 0,
          totalAfter: Number(target.total) || 0,
          paidBefore: Number(target.amountPaid) || 0,
          paidAfter: Number(target.amountPaid) || 0,
        },
      ],
    };
    commitBillUpdates(new Map([[billId, updated]]));
    saveOrders(allBillsRef.current).catch(() => {});
    cloudFetch("/api/bills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
    returnDispositions(billId, returnId).forEach((d) =>
      deleteInventoryDisposition(d.id),
    );
    recordReturnScrap(without, revised, resolveWh, returnId);
    notify(
      `Return ${old.creditNoteNo} corrected. Stock, credit and ledger now follow the new quantities.`,
    );
    return { ok: true, value: revised };
  }

  function dropUntouchedReturnScrap(billId: number) {
    const mine = inventoryDispositions.filter(
      (d) => d.returnTracking?.sourceBillId === billId,
    );
    let kept = 0;
    for (const d of mine) {
      const rt = d.returnTracking!;
      const withCompany =
        rt.stage === "sent" ||
        rt.stage === "settled" ||
        rt.stage === "rejected" ||
        d.compensationStatus === "settled" ||
        d.compensationStatus === "partial" ||
        d.compensationStatus === "rejected";
      if (withCompany) kept += 1;
      else deleteInventoryDisposition(d.id);
    }
    if (kept > 0)
      notify(
        `${kept} expired-return record(s) already sent to the company were kept for your records.`,
      );
  }

  return {
    cancelBill,
    createSalesReturn,
    cancelSalesReturn,
    editSalesReturn,
    dropUntouchedReturnScrap,
  };
}
