import {
  deleteBillFromSupabase,
  pushBillToSupabase,
  pushDeletionRecordsToSupabase,
  pushPaymentsToSupabase,
  pushTripToSupabase,
} from "../../../lib/supabase";
import { noOutputTax, resolveTaxRegime } from "../../../tax/appRegime";
import type { Bill, BillEditEntry, PaymentRecord } from "../../../types";
import { billEditLockReason } from "../../../utils/billEditLock";
import { todayISO } from "../../../utils/dateLocal";
import {
  cartTaxMix,
  isGstExcludedBill,
  makeBillClientUid,
} from "../../../utils/invoiceCommon";
import { planSplitMixedBill } from "../../../utils/mixedBillSplit";
import {
  applyBillEditPaymentPlan,
  planBillEditPayments,
} from "../../../utils/paymentReversal";
import { stampChangedPayments } from "../../../utils/paymentStamp";
import { saveOrders, savePayments } from "../../../utils/storage";
import { tripPrimaryWarehouseId, tripWarehouseIds } from "../../../utils/tripLoads";
import {
  billMoneySignature,
  computePreviewBillEdit,
  describeBillChanges,
} from "../../ledgerBillEditHelpers";
import { calcPreviewBillDelete } from "../../ledgerBillRepairHelpers";
import { last10Of } from "../../ledgerCustomerCalculations";
import {
  STORAGE_KEY,
  addBillTombstones,
  addPaymentTombstones,
  cloud,
  cloudFetch,
  emptyCart,
  getDeviceId,
  normCustName,
  reserveDocNumber,
  stampChangedBills,
} from "../../ledgerHelpers";
import type {
  BillDeletePaymentAction,
  BillDeletePreview,
  BillEditPreview,
} from "../../ledgerTypes";
import type {
  BillingDocHelpers,
  NormalizedBillingParams,
} from "./billingShared";

export function createBillEditDeleteSplitActions(
  params: NormalizedBillingParams,
  docHelpers: BillingDocHelpers,
  dropUntouchedReturnScrap: (billId: number) => void,
) {
  const {
    allBillsRef,
    setBills,
    setCart,
    editingBillId,
    setEditingBillId,
    products,
    warehouses,
    defaultWarehouse,
    inventoryBatches,
    trips,
    setTrips,
    tripOfBill,
    orgProfile,
    gstMode,
    payments,
    paymentsRef,
    setPayments,
    stockShortfalls,
    allocateBatches,
    logPaymentAudit,
    resolveMasterCustomerId,
    setCustomProductPrice,
    currentUser,
    notify,
  } = params;

  const {
    getInvoicePrefix,
    nextBillDocNumber,
    syncBillPaymentsOnEdit,
    planBillEditStock,
    resolveEditTrip,
  } = docHelpers;

  function previewBillEdit(
    updated: Bill,
    requestedPaid?: number,
  ): BillEditPreview {
    return computePreviewBillEdit({
      updated,
      requestedPaid,
      allBills: allBillsRef.current,
      trips,
      warehouses,
      defaultWarehouse,
      payments: paymentsRef?.current ?? payments,
      inventoryBatches,
      stockShortfalls,
      allocateBatches,
    });
  }

  function previewBillDelete(billId: number): BillDeletePreview | null {
    return calcPreviewBillDelete({
      billId,
      allBills: allBillsRef.current,
      payments: paymentsRef?.current ?? payments,
      warehouses,
      defaultWarehouse,
      findTripOfBill: tripOfBill,
    });
  }

  function deleteBill(
    billId: number,
    opts?: { reason?: string; paymentAction?: BillDeletePaymentAction },
  ): boolean {
    if ((import.meta as any)?.env?.VITE_ALLOW_BILL_DELETE !== "true") {
      notify(
        `Invoice #${billId} cannot be deleted. Cancel it instead (the invoice number is kept).`,
      );
      return false;
    }
    const currentBills = allBillsRef.current;
    const target = currentBills.find((b) => b.id === billId);
    if (!target) return false;
    const preview = previewBillDelete(billId);
    if (preview && preview.blockers.length > 0) {
      notify(
        `Invoice #${billId} was not deleted:\n` +
          preview.blockers.map((m) => `• ${m}`).join("\n"),
      );
      return false;
    }
    const reason = (opts?.reason || "").trim();
    const paymentAction: BillDeletePaymentAction =
      opts?.paymentAction === "remove" ? "remove" : "advance";
    const reasonSuffix = reason ? ` — Reason: ${reason}` : "";
    const summary: string[] = [`Invoice #${billId} deleted.`];
    dropUntouchedReturnScrap(billId);
    const currentPayments = paymentsRef?.current ?? payments;
    const heldRows = currentPayments.filter((p) => p.billId === billId);
    const held = heldRows.reduce((t, p) => t + (Number(p.amount) || 0), 0);
    const unjournaled = Math.max(
      0,
      Math.round(((Number(target.amountPaid) || 0) - held) * 100) / 100,
    );
    addBillTombstones([billId]);

    if (paymentAction === "remove") {
      const synthIds = [`pay_bill_${billId}`, `legacy_pay_${billId}`];
      const ids = Array.from(
        new Set([...heldRows.map((p) => p.id), ...synthIds]),
      );
      addPaymentTombstones(ids);
      const applyDeleteRemove = (list: PaymentRecord[]): PaymentRecord[] =>
        list.filter((p) => p.billId !== billId && !ids.includes(p.id));
      const nextPayments = applyDeleteRemove(currentPayments);
      if (paymentsRef) {
        paymentsRef.current = stampChangedPayments(currentPayments, nextPayments);
      }
      setPayments((prev) => applyDeleteRemove(prev));
      if (nextPayments.length === 0 && currentPayments.length > 0) {
        savePayments([]).catch(() => {});
        pushPaymentsToSupabase([], true).catch(() => {});
      }
      if (heldRows.length > 0) {
        heldRows.forEach((p) => {
          logPaymentAudit({
            action: "delete",
            paymentId: p.id,
            billId,
            customerName: p.customerName,
            amount: p.amount,
            note: `Invoice #${billId} deleted: receipt of ₹${p.amount} removed${reasonSuffix}`,
            before: p,
          });
          cloudFetch(`/api/payments/${encodeURIComponent(p.id)}`, {
            method: "DELETE",
          });
        });
        pushDeletionRecordsToSupabase(
          heldRows.map((p) => ({
            kind: "payment" as const,
            id: p.id,
            name: p.customerName,
            deletedAt: new Date().toISOString(),
            by: currentUser?.name || "Admin",
            reason,
            note: `₹${p.amount} on deleted invoice #${billId}`,
          })),
        ).catch(() => {});
      }
      if (held > 0 || unjournaled > 0) {
        summary.push(
          `₹${(held + unjournaled).toLocaleString("en-IN", { maximumFractionDigits: 2 })} received on it was removed from the customer's account.`,
        );
      }
    } else {
      const nowIso = new Date().toISOString();
      const advRow: PaymentRecord | null =
        unjournaled > 0.004
          ? {
              id: `pay_${Date.now()}_adv_${Math.random().toString(36).slice(2, 6)}`,
              customerName: target.retailer,
              customerPhone: target.phone,
              paymentDate: todayISO(),
              amount: unjournaled,
              mode: target.paymentMode || "cash",
              referenceNote: `Advance / on account (from deleted invoice #${billId})`,
              recordedBy: currentUser?.name || "Admin",
              isAdvance: true,
              createdAt: nowIso,
            }
          : null;
      if (heldRows.length > 0 || advRow) {
        const applyDeleteAdvance = (list: PaymentRecord[]): PaymentRecord[] => {
          const converted =
            heldRows.length > 0
              ? list.map((p) =>
                  p.billId === billId
                    ? {
                        ...p,
                        billId: undefined,
                        isAdvance: true,
                        updatedAt: nowIso,
                        referenceNote: [
                          p.referenceNote,
                          `Advance / on account (from deleted invoice #${billId})`,
                        ]
                          .filter(Boolean)
                          .join(" · "),
                      }
                    : p,
                )
              : list;
          return advRow ? [advRow, ...converted] : converted;
        };
        if (paymentsRef) {
          paymentsRef.current = stampChangedPayments(
            currentPayments,
            applyDeleteAdvance(currentPayments),
          );
        }
        setPayments((prev) => applyDeleteAdvance(prev));
      }
      if (heldRows.length > 0) {
        heldRows.forEach((p) =>
          logPaymentAudit({
            action: "invoice_deleted",
            paymentId: p.id,
            billId,
            customerName: p.customerName,
            amount: p.amount,
            note: `Invoice #${billId} deleted: ₹${p.amount} kept as customer advance${reasonSuffix}`,
            before: p,
          }),
        );
      }
      if (advRow) {
        logPaymentAudit({
          action: "invoice_deleted",
          paymentId: advRow.id,
          billId,
          customerName: target.retailer,
          amount: unjournaled,
          note: `Invoice #${billId} deleted: ₹${unjournaled} paid on the invoice kept as customer advance${reasonSuffix}`,
          after: advRow,
        });
      }
      if (held + unjournaled > 0.004) {
        summary.push(
          `₹${(held + unjournaled).toLocaleString("en-IN", { maximumFractionDigits: 2 })} already received on it was kept as an advance on the customer's account.`,
        );
      }
    }
    const remainingBills = currentBills.filter((b) => b.id !== billId);
    allBillsRef.current = remainingBills;
    saveOrders(remainingBills).catch(() => {});
    setBills((bs) => bs.filter((b) => b.id !== billId));
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
    cloud("deleteBillFromSupabase", deleteBillFromSupabase(billId));
    cloudFetch(`/api/bills/${billId}`, { method: "DELETE" });
    if (preview && preview.totalCrates > 0) {
      summary.push(
        `${preview.totalCrates} crate(s) are back in stock (${preview.stockDestination}).`,
      );
    }
    notify(summary.join(" "));
    return true;
  }

  function updateBill(
    updated: Bill,
    opts?: { comment?: string; requestedPaid?: number },
  ): boolean {
    const originalBill = allBillsRef.current.find((b) => b.id === updated.id);
    if (originalBill?.status === "cancelled") {
      notify("A cancelled invoice cannot be edited.");
      return false;
    }
    if ((originalBill?.returns || []).length > 0) {
      notify(
        "This invoice has customer returns against it, so it can no longer be edited.",
      );
      return false;
    }
    const lockedReason = billEditLockReason(originalBill || updated, todayISO());
    if (lockedReason) {
      notify(lockedReason);
      return false;
    }
    const billTrip = resolveEditTrip(updated);
    let editStockChanged = false;
    if (Array.isArray(updated.items)) {
      const plan = planBillEditStock(updated, billTrip);
      if (plan.problems.length > 0) {
        notify(
          "Cannot save these changes:\n" +
            plan.problems.map((m) => `• ${m}`).join("\n"),
        );
        return false;
      }
      editStockChanged = plan.stockChanged;
      updated = {
        ...updated,
        items: plan.items,
        tripId: updated.tripId ?? originalBill?.tripId ?? billTrip?.id,
      };
    }
    const requestedPaid = Math.max(
      0,
      Number(opts?.requestedPaid ?? updated.amountPaid) || 0,
    );
    updated = {
      ...updated,
      amountPaid: Math.min(requestedPaid, updated.total),
    };
    if (
      originalBill &&
      (normCustName(updated.retailer) !== normCustName(originalBill.retailer) ||
        last10Of(updated.phone || "") !== last10Of(originalBill.phone || ""))
    ) {
      updated = {
        ...updated,
        customerId: resolveMasterCustomerId(updated.retailer, updated.phone),
      };
    }
    if (
      originalBill &&
      !editStockChanged &&
      billMoneySignature(originalBill) === billMoneySignature(updated)
    ) {
      notify("No changes were made, so nothing was saved.");
      if (editingBillId === updated.id) {
        setEditingBillId(null);
        setCart(emptyCart());
      }
      return true;
    }
    if (billTrip) {
      const validWhIds = new Set(warehouses.map((w) => w.id));
      const tripWhIds = tripWarehouseIds(billTrip, validWhIds);
      const currentWh = String(updated.warehouseId || "").trim();
      if (
        tripWhIds.length > 0 &&
        (!currentWh || !tripWhIds.includes(currentWh))
      ) {
        const primaryWh = tripPrimaryWarehouseId(billTrip, validWhIds);
        if (primaryWh) {
          updated = { ...updated, warehouseId: primaryWh };
        }
      }
    }
    if (
      Array.isArray(updated.items) &&
      cartTaxMix(updated.items, products).allNonGst
    ) {
      const cleanTotal =
        Math.round(
          Math.max(
            0,
            updated.items.reduce((s, it) => s + (Number(it.amount) || 0), 0) -
              Math.max(0, Number(updated.additionalDiscount) || 0),
          ) * 100,
        ) / 100;
      const origWasNonGst =
        originalBill?.docSeries === "non_gst" ||
        originalBill?.gstExclude === true ||
        String(updated.docNo || originalBill?.docNo || "")
          .trim()
          .toUpperCase()
          .startsWith("NG-");
      const nextDocNo = origWasNonGst
        ? updated.docNo
        : nextBillDocNumber({
            billId: updated.id,
            isNonGst: true,
            salesmanName: updated.salesman,
            salesmanId: updated.salesmanId,
            currentBills: allBillsRef.current,
          });
      updated = {
        ...updated,
        docNo: nextDocNo,
        docSeries: "non_gst",
        gstExclude: true,
        invoiceType: "bill_of_supply",
        isGstInvoice: false,
        supplyType: "B2C",
        customerGstin: undefined,
        subtotal: cleanTotal,
        cgst: 0,
        sgst: 0,
        total: cleanTotal,
        amountPaid: Math.min(requestedPaid, cleanTotal),
      };
    }
    if (originalBill) {
      const entry: BillEditEntry = {
        at: new Date().toISOString(),
        by: currentUser?.name || "Admin",
        comment: (opts?.comment || "").trim() || "(no comment)",
        changes: describeBillChanges(originalBill, updated),
        stockChanged: editStockChanged,
        totalBefore: Number(originalBill.total) || 0,
        totalAfter: Number(updated.total) || 0,
        paidBefore: Number(originalBill.amountPaid) || 0,
        paidAfter: Number(updated.amountPaid) || 0,
      };
      updated = {
        ...updated,
        editHistory: [...(originalBill.editHistory || []), entry],
      };
    }
    if (Array.isArray(updated.items)) {
      for (const it of updated.items) {
        if (it.productId && typeof it.rate === "number" && it.rate >= 0) {
          setCustomProductPrice(it.productId, it.rate, updated.retailer);
        }
      }
    }
    syncBillPaymentsOnEdit(updated, requestedPaid, {
      date: updated.paymentDate || todayISO(),
      mode: updated.paymentMode || "cash",
      note: updated.paymentNote,
      recordedBy: currentUser?.name || "Admin",
      salesmanId: updated.salesmanId,
    });
    updated.updatedAt = new Date().toISOString();
    const nextUpdatedBills = stampChangedBills(
      allBillsRef.current,
      allBillsRef.current.map((b) => (b.id === updated.id ? updated : b)),
    );
    allBillsRef.current = nextUpdatedBills;
    saveOrders(nextUpdatedBills).catch(() => {});
    setBills((bs) => bs.map((b) => (b.id === updated.id ? updated : b)));
    if (editingBillId === updated.id) {
      setEditingBillId(null);
      setCart(emptyCart());
    }
    cloud("pushBillToSupabase", pushBillToSupabase(updated));
    cloudFetch("/api/bills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
    return true;
  }

  function splitMixedBill(
    billOrId: Bill | number,
    opts?: { comment?: string; requestedPaid?: number },
  ): { gstBill: Bill; nonGstBill: Bill } | null {
    const targetId = typeof billOrId === "number" ? billOrId : billOrId.id;
    const originalBill = allBillsRef.current.find((b) => b.id === targetId);
    if (!originalBill) {
      notify("Bill not found.");
      return null;
    }
    if (originalBill.status === "cancelled") {
      notify("A cancelled invoice cannot be split.");
      return null;
    }
    if ((originalBill.returns || []).length > 0) {
      notify(
        "This invoice has customer returns against it, so it cannot be auto-split.",
      );
      return null;
    }

    let draft: Bill = typeof billOrId === "number" ? originalBill : billOrId;
    if (!cartTaxMix(draft.items || [], products).hasMixed) {
      notify("This bill does not mix GST and Non-GST items.");
      return null;
    }

    const billTrip = resolveEditTrip(draft);
    const plan = planBillEditStock(draft, billTrip);
    if (plan.problems.length > 0) {
      notify(
        "Cannot split this bill:\n" +
          plan.problems.map((m) => `• ${m}`).join("\n"),
      );
      return null;
    }

    const batchCostById = new Map(
      inventoryBatches.map((b) => [
        b.id,
        Number(b.effectiveCostPrice) || Number(b.costPrice) || 0,
      ]),
    );
    const itemsWithCosts = plan.items.map((it) => {
      if (it.costExGst != null && Number(it.costExGst) > 0) return it;
      const prod = products.find((p) => p.id === it.productId);
      const fallback = Number(prod?.effectiveCost ?? prod?.cost) || 0;
      let q = 0;
      let c = 0;
      for (const a of it.batchAllocations || []) {
        const bc = batchCostById.get(a.batchId) || 0;
        const aq = Number(a.qty) || 0;
        if (aq > 0 && bc > 0) {
          q += aq;
          c += aq * bc;
        }
      }
      const cost = q > 0 ? c / q : fallback;
      return cost > 0
        ? { ...it, costExGst: Math.round(cost * 100) / 100 }
        : it;
    });

    let preparedWarehouseId = draft.warehouseId;
    if (billTrip) {
      const validWhIds = new Set(warehouses.map((w) => w.id));
      const tripWhIds = tripWarehouseIds(billTrip, validWhIds);
      const currentWh = String(preparedWarehouseId || "").trim();
      if (
        tripWhIds.length > 0 &&
        (!currentWh || !tripWhIds.includes(currentWh))
      ) {
        const primaryWh = tripPrimaryWarehouseId(billTrip, validWhIds);
        if (primaryWh) preparedWarehouseId = primaryWh;
      }
    }

    let preparedCustomerId = draft.customerId ?? originalBill.customerId;
    if (
      normCustName(draft.retailer) !== normCustName(originalBill.retailer) ||
      last10Of(draft.phone || "") !== last10Of(originalBill.phone || "")
    ) {
      preparedCustomerId = resolveMasterCustomerId(draft.retailer, draft.phone);
    }

    draft = {
      ...draft,
      items: itemsWithCosts,
      tripId: draft.tripId ?? originalBill.tripId ?? billTrip?.id,
      warehouseId: preparedWarehouseId,
      customerId: preparedCustomerId,
    };

    const effectiveDate = String(draft.date || todayISO()).slice(0, 10);
    const taxRegime = resolveTaxRegime(orgProfile, effectiveDate);
    const outputTaxOff = noOutputTax(taxRegime);

    const origWasNonGst =
      draft.gstExclude === true ||
      draft.docSeries === "non_gst" ||
      Boolean(draft.docNo && draft.docNo.toUpperCase().startsWith("NG-")) ||
      isGstExcludedBill(originalBill, products);
    const maxExistingId = allBillsRef.current.length
      ? Math.max(...allBillsRef.current.map((b) => b.id))
      : 100;
    const nextBillId = reserveDocNumber("bill", maxExistingId);
    const nonGstDocNo = !origWasNonGst
      ? nextBillDocNumber({
          billId: nextBillId,
          isNonGst: true,
          salesmanName: draft.salesman || originalBill.salesman,
          salesmanId: draft.salesmanId || originalBill.salesmanId,
          currentBills: allBillsRef.current,
        })
      : draft.docNo || `NG-${draft.id}`;
    const gstDocNo = origWasNonGst
      ? nextBillDocNumber({
          billId: nextBillId,
          isNonGst: false,
          salesmanName: draft.salesman || originalBill.salesman,
          salesmanId: draft.salesmanId || originalBill.salesmanId,
          currentBills: allBillsRef.current,
        })
      : undefined;
    const splitGroupId =
      originalBill.splitGroupId ||
      `split_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

    const splitPlan = planSplitMixedBill({
      bill: draft,
      originalBill,
      products,
      gstMode,
      outputTaxOff,
      nextBillId,
      nextNonGstDocNo: nonGstDocNo,
      nextGstDocNo: gstDocNo,
      invoicePrefix: getInvoicePrefix(),
      splitGroupId,
      editBy: currentUser?.name || "Admin",
      comment: opts?.comment,
      requestedPaid: opts?.requestedPaid,
      stockChanged: plan.stockChanged,
    });
    if (!splitPlan) return null;

    const {
      gstBill,
      nonGstBill,
      updatedBill,
      createdBill: rawCreatedBill,
      combinedTotal,
      requestedPaid,
    } = splitPlan;
    const splitDevId = getDeviceId();
    const createdBill: Bill = {
      ...rawCreatedBill,
      clientUid: rawCreatedBill.clientUid || makeBillClientUid(splitDevId),
      originDeviceId: rawCreatedBill.originDeviceId || splitDevId,
    };

    for (const it of itemsWithCosts) {
      if (it.productId && typeof it.rate === "number" && it.rate >= 0) {
        setCustomProductPrice(it.productId, it.rate, updatedBill.retailer);
      }
    }

    {
      const currentPayments = paymentsRef?.current ?? payments;
      const splitStamp = Date.now();
      const splitNowIso = new Date(splitStamp).toISOString();
      const splitToday = todayISO();
      let splitSeq = 0;
      const splitRecordedBy = currentUser?.name || "Admin";
      const r2 = (n: number) => Math.round(n * 100) / 100;

      const splitPayPlan = planBillEditPayments({
        payments: currentPayments,
        bill: updatedBill,
        targetPaid: updatedBill.amountPaid,
        requestedPaid,
        today: splitToday,
        nowIso: splitNowIso,
        paymentDate:
          updatedBill.paymentDate || updatedBill.date || splitToday,
        mode: updatedBill.paymentMode || "cash",
        note: updatedBill.paymentNote,
        recordedBy: splitRecordedBy,
        salesmanId: updatedBill.salesmanId,
        newId: (tag = "split") =>
          `pay_${splitStamp}_${tag}_${splitSeq++}_${Math.random().toString(36).slice(2, 6)}`,
        reason: `Invoice #${updatedBill.id} split into ${updatedBill.docNo || `#${updatedBill.id}`} and ${createdBill.docNo || `#${createdBill.id}`}`,
        preserveExcessAsAdvance: false,
      });

      const remainingRevByMode = new Map(splitPayPlan.reversedByMode);
      const extraRows: PaymentRecord[] = [];
      const extraAudits = [...splitPayPlan.auditEntries];

      if (createdBill.amountPaid > 0) {
        let splitLeft = r2(createdBill.amountPaid);
        for (const [revMode, revAmt] of remainingRevByMode.entries()) {
          if (splitLeft <= 0.004) break;
          if (revAmt <= 0.004) continue;
          const take = r2(Math.min(splitLeft, revAmt));
          remainingRevByMode.set(revMode, r2(revAmt - take));
          splitLeft = r2(splitLeft - take);
          const splitPay: PaymentRecord = {
            id: `pay_${splitStamp}_sp_${splitSeq++}_${Math.random().toString(36).slice(2, 6)}`,
            billId: createdBill.id,
            ...(createdBill.customerId
              ? { customerId: createdBill.customerId }
              : {}),
            customerName: createdBill.retailer,
            customerPhone: createdBill.phone,
            paymentDate: splitToday,
            amount: take,
            mode: revMode,
            entryKind: "receipt",
            referenceNote:
              createdBill.paymentNote ||
              `Payment split from ${updatedBill.docNo || `#${updatedBill.id}`} to ${createdBill.docNo || `#${createdBill.id}`}`,
            recordedBy: splitRecordedBy,
            salesmanId: createdBill.salesmanId,
            createdAt: splitNowIso,
            updatedAt: splitNowIso,
          };
          extraRows.push(splitPay);
        }
        if (splitLeft > 0.004) {
          const splitPay: PaymentRecord = {
            id: `pay_${splitStamp}_sp_${splitSeq++}_${Math.random().toString(36).slice(2, 6)}`,
            billId: createdBill.id,
            ...(createdBill.customerId
              ? { customerId: createdBill.customerId }
              : {}),
            customerName: createdBill.retailer,
            customerPhone: createdBill.phone,
            paymentDate:
              createdBill.paymentDate || createdBill.date || splitToday,
            amount: splitLeft,
            mode: createdBill.paymentMode || "cash",
            entryKind: "receipt",
            referenceNote:
              createdBill.paymentNote ||
              `Payment split from ${updatedBill.docNo || `#${updatedBill.id}`} to ${createdBill.docNo || `#${createdBill.id}`}`,
            recordedBy: splitRecordedBy,
            salesmanId: createdBill.salesmanId,
            createdAt: splitNowIso,
            updatedAt: splitNowIso,
          };
          extraRows.push(splitPay);
        }
      }

      const keepAsAdvance = r2(
        Math.min(requestedPaid, splitPayPlan.existingBillSum) - combinedTotal,
      );
      if (keepAsAdvance > 0.004) {
        let advLeft = keepAsAdvance;
        for (const [revMode, revAmt] of remainingRevByMode.entries()) {
          if (advLeft <= 0.004) break;
          if (revAmt <= 0.004) continue;
          const take = r2(Math.min(advLeft, revAmt));
          remainingRevByMode.set(revMode, r2(revAmt - take));
          advLeft = r2(advLeft - take);
          const advRow: PaymentRecord = {
            id: `pay_${splitStamp}_adv_${splitSeq++}_${Math.random().toString(36).slice(2, 6)}`,
            ...(updatedBill.customerId
              ? { customerId: updatedBill.customerId }
              : {}),
            customerName: updatedBill.retailer,
            customerPhone: updatedBill.phone,
            ...(updatedBill.salesmanId
              ? { salesmanId: updatedBill.salesmanId }
              : {}),
            paymentDate: splitToday,
            amount: take,
            mode: revMode,
            entryKind: "advance",
            referenceNote: `Advance / on account (split invoice #${updatedBill.id} total was reduced)`,
            recordedBy: splitRecordedBy,
            isAdvance: true,
            createdAt: splitNowIso,
            updatedAt: splitNowIso,
          };
          extraRows.push(advRow);
          extraAudits.push({
            action: "invoice_edited",
            paymentId: advRow.id,
            billId: updatedBill.id,
            customerName: updatedBill.retailer,
            amount: take,
            note: `Split invoice #${updatedBill.id} combined total reduced: ₹${take} kept as advance`,
            after: advRow,
          });
        }
        if (advLeft > 0.004) {
          const advRow: PaymentRecord = {
            id: `pay_${splitStamp}_adv_${splitSeq++}_${Math.random().toString(36).slice(2, 6)}`,
            ...(updatedBill.customerId
              ? { customerId: updatedBill.customerId }
              : {}),
            customerName: updatedBill.retailer,
            customerPhone: updatedBill.phone,
            ...(updatedBill.salesmanId
              ? { salesmanId: updatedBill.salesmanId }
              : {}),
            paymentDate: splitToday,
            amount: advLeft,
            mode: updatedBill.paymentMode || "cash",
            entryKind: "advance",
            referenceNote: `Advance / on account (split invoice #${updatedBill.id} total was reduced)`,
            recordedBy: splitRecordedBy,
            isAdvance: true,
            createdAt: splitNowIso,
            updatedAt: splitNowIso,
          };
          extraRows.push(advRow);
          extraAudits.push({
            action: "invoice_edited",
            paymentId: advRow.id,
            billId: updatedBill.id,
            customerName: updatedBill.retailer,
            amount: advLeft,
            note: `Split invoice #${updatedBill.id} combined total reduced: ₹${advLeft} kept as advance`,
            after: advRow,
          });
        }
      }

      const combinedPlan = {
        ...splitPayPlan,
        newRows: [...extraRows, ...splitPayPlan.newRows],
        auditEntries: extraAudits,
      };
      if (combinedPlan.removedAdjustmentIds.length > 0) {
        addPaymentTombstones(combinedPlan.removedAdjustmentIds);
      }
      if (
        combinedPlan.newRows.length > 0 ||
        combinedPlan.updatedById.size > 0 ||
        combinedPlan.removedAdjustmentIds.length > 0 ||
        combinedPlan.identityUpdatesNeeded
      ) {
        if (paymentsRef) {
          paymentsRef.current = stampChangedPayments(
            currentPayments,
            applyBillEditPaymentPlan(
              currentPayments,
              updatedBill,
              combinedPlan,
            ),
          );
        }
        setPayments((prev) =>
          applyBillEditPaymentPlan(prev, updatedBill, combinedPlan),
        );
        for (const audit of combinedPlan.auditEntries) {
          logPaymentAudit(audit);
        }
      }
    }

    allBillsRef.current = [
      createdBill,
      ...allBillsRef.current.map((b) =>
        b.id === updatedBill.id ? updatedBill : b,
      ),
    ];
    setBills((bs) => {
      const next = [
        createdBill,
        ...bs.map((b) => (b.id === updatedBill.id ? updatedBill : b)),
      ];
      try {
        saveOrders(next as any).catch(() => {});
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        parsed.bills = next;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      } catch {}
      return next;
    });

    if (billTrip) {
      setTrips((ts) =>
        ts.map((t) => {
          if (t.id !== billTrip.id) return t;
          if (t.billIds.includes(createdBill.id)) return t;
          const updatedT = { ...t, billIds: [...t.billIds, createdBill.id] };
          cloud("pushTripToSupabase", pushTripToSupabase(updatedT));
          return updatedT;
        }),
      );
    }

    if (editingBillId === targetId) {
      setEditingBillId(null);
      setCart(emptyCart());
    }

    cloud("pushBillToSupabase", pushBillToSupabase(updatedBill));
    cloud("pushBillToSupabase", pushBillToSupabase(createdBill));
    cloudFetch("/api/bills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedBill),
    });
    cloudFetch("/api/bills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createdBill),
    });

    return { gstBill, nonGstBill };
  }

  return {
    previewBillDelete,
    deleteBill,
    previewBillEdit,
    updateBill,
    splitMixedBill,
  };
}
