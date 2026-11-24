import { useState } from "react";
import { pushBillToSupabase } from "../../../lib/supabase";
import type { Bill } from "../../../types";
import {
  applyBillCostRepairPlan,
  applyCrossWarehouseRestorePlan,
  type BillCostRepairPlan,
  type CrossWarehouseShiftPlan,
  type RepairApplyMode,
} from "../../../utils/billCostRepair";
import {
  formatBillNumber,
  highestGstInvoiceSeq,
  isGstExcludedBill,
} from "../../../utils/invoiceCommon";
import {
  ReassignGuardError,
  type ReassignSummary,
  reassignBillsProductWarehouse as reassignBillsPure,
} from "../../../utils/oversoldDiagnostic";
import { stampChangedPayments } from "../../../utils/paymentStamp";
import { saveOrders } from "../../../utils/storage";
import {
  buildMissingSeriesCancelledBills,
  buildRepairedBillTotalUpdate,
  calcConvertBillsToTaxInvoices,
  calcRepairNonGstBillTaxes,
} from "../../ledgerBillRepairHelpers";
import {
  STORAGE_KEY,
  cloud,
  cloudFetch,
  reserveDocNumber,
  stampChangedBills,
} from "../../ledgerHelpers";
import { calcMissingBillPaymentRows } from "../../ledgerPaymentCalculations";
import {
  type BillingDocHelpers,
  type NormalizedBillingParams,
  type ReassignSnapshot,
  readReassignStore,
  writeReassignStore,
} from "./billingShared";

export function useBillRepairActions(
  params: NormalizedBillingParams,
  docHelpers: BillingDocHelpers,
  updateBill: (
    updated: Bill,
    opts?: { comment?: string; requestedPaid?: number },
  ) => boolean,
) {
  const {
    allBillsRef,
    setBills,
    editingBillId,
    products,
    warehouses,
    inventoryBatches,
    trips,
    billingSettings,
    gstMode,
    payments,
    paymentsRef,
    setPayments,
    currentUser,
    currentRole,
    notify,
  } = params;

  const { getInvoicePrefix, nextBillDocNumber } = docHelpers;

  const [hasOversoldReassignUndo, setHasOversoldReassignUndo] =
    useState<boolean>(() => !!readReassignStore().undo);

  function repairBillTotals(billIds: number[]): {
    fixed: number;
    skipped: number;
  } {
    let fixed = 0;
    let skipped = 0;
    for (const id of billIds) {
      const b = allBillsRef.current.find((x) => x.id === id);
      const updated = b ? buildRepairedBillTotalUpdate(b, gstMode) : null;
      if (!updated) {
        skipped++;
        continue;
      }
      const ok = updateBill(updated, {
        comment:
          "Saved totals and tax recalculated from the invoice lines and invoice discount (report audit fix)",
      });
      if (ok) fixed++;
      else skipped++;
    }
    return { fixed, skipped };
  }

  function repairNonGstBillTaxes(billIds: number[]): {
    fixed: number;
    skipped: number;
  } {
    const currentBills = allBillsRef.current;
    const res = calcRepairNonGstBillTaxes(billIds, currentBills);
    const nextBills = stampChangedBills(currentBills, res.newBills);
    allBillsRef.current = nextBills;
    saveOrders(nextBills).catch(() => {});
    setBills((prev) => calcRepairNonGstBillTaxes(billIds, prev).newBills);

    for (const b of res.changedBills) {
      cloud("pushBillToSupabase", pushBillToSupabase(b));
    }
    return { fixed: res.fixed, skipped: res.skipped };
  }

  function convertBillsToTaxInvoices(billIds: number[]): {
    fixed: number;
    skipped: number;
  } {
    const currentBills = allBillsRef.current;
    const res = calcConvertBillsToTaxInvoices(billIds, currentBills, products);
    const nextBills = stampChangedBills(currentBills, res.newBills);
    allBillsRef.current = nextBills;
    saveOrders(nextBills).catch(() => {});
    setBills((prev) =>
      calcConvertBillsToTaxInvoices(billIds, prev, products).newBills,
    );

    for (const b of res.changedBills) {
      cloud("pushBillToSupabase", pushBillToSupabase(b));
    }
    return { fixed: res.fixed, skipped: res.skipped };
  }

  function repairEstimatedBillCosts(
    plan: BillCostRepairPlan,
    mode: RepairApplyMode = "link_and_freeze",
  ): {
    fixedBills: number;
    fixedLines: number;
    linkedLines: number;
    frozenOnlyLines: number;
    fixedCases: number;
  } {
    const res = applyBillCostRepairPlan({
      bills: allBillsRef.current,
      plan,
      mode,
    });
    if (res.changedBills.length === 0) {
      notify("All selected bill lines already have a saved batch or frozen cost.");
      return {
        fixedBills: 0,
        fixedLines: 0,
        linkedLines: 0,
        frozenOnlyLines: 0,
        fixedCases: 0,
      };
    }
    allBillsRef.current = res.updatedBills;
    setBills(res.updatedBills);
    saveOrders(res.updatedBills).catch(() => {});
    for (const b of res.changedBills) {
      cloud("pushBillToSupabase", pushBillToSupabase(b));
    }
    notify(
      `Updated cost metadata on ${res.fixedBills} bill(s) (${res.fixedCases} cases): ` +
        (res.linkedLines > 0 ? `${res.linkedLines} batch-linked` : "") +
        (res.linkedLines > 0 && res.frozenOnlyLines > 0 ? ", " : "") +
        (res.frozenOnlyLines > 0 ? `${res.frozenOnlyLines} cost-frozen` : "") +
        ". Totals, GST, dues & payments unchanged.",
    );
    return {
      fixedBills: res.fixedBills,
      fixedLines: res.fixedLines,
      linkedLines: res.linkedLines,
      frozenOnlyLines: res.frozenOnlyLines,
      fixedCases: res.fixedCases,
    };
  }

  function restoreCrossWarehouseAllocations(
    plan: CrossWarehouseShiftPlan,
  ): { restoredBills: number; restoredLines: number; restoredCases: number } {
    const res = applyCrossWarehouseRestorePlan({
      bills: allBillsRef.current,
      plan,
    });
    if (res.changedBills.length === 0) {
      notify("No cross-godown batch shifts found.");
      return { restoredBills: 0, restoredLines: 0, restoredCases: 0 };
    }
    allBillsRef.current = res.updatedBills;
    setBills(res.updatedBills);
    saveOrders(res.updatedBills).catch(() => {});
    for (const b of res.changedBills) {
      cloud("pushBillToSupabase", pushBillToSupabase(b));
    }
    notify(
      `Restored exact godown stock on ${res.restoredBills} bill(s) (${res.restoredCases} cases). Frozen costs, totals, GST & payments unchanged.`,
    );
    return {
      restoredBills: res.restoredBills,
      restoredLines: res.restoredLines,
      restoredCases: res.restoredCases,
    };
  }

  function reassignBillsProductWarehouse(args: {
    productId: number;
    fromWarehouseId: string;
    toWarehouseId: string;
    billIds: number[];
    dryRun?: boolean;
  }): ReassignSummary {
    const fail = (error: string): ReassignSummary => ({
      ok: false,
      error,
      movedCases: 0,
      perBill: [],
      skipped: [],
    });
    if (!args.dryRun && currentRole !== "admin")
      return fail("Only the owner login can move bills between godowns.");
    try {
      const res = reassignBillsPure({
        bills: allBillsRef.current,
        billIds: args.billIds,
        productId: args.productId,
        fromWarehouseId: args.fromWarehouseId,
        toWarehouseId: args.toWarehouseId,
        products,
        warehouses,
        inventoryBatches,
        trips,
        lockedBillIds: editingBillId ? [editingBillId] : [],
      });
      const summary: ReassignSummary = {
        ok: true,
        movedCases: res.movedCases,
        perBill: res.perBill,
        skipped: res.skipped,
      };
      if (args.dryRun) return summary;
      if (res.changedBills.length === 0)
        return {
          ...summary,
          ok: false,
          error: "Nothing could be moved for the selected bills.",
        };

      const by =
        (currentUser as any)?.name ||
        (currentUser as any)?.username ||
        "owner";
      const at = new Date().toISOString();
      const store = readReassignStore();
      const snapshot: ReassignSnapshot = {
        at,
        by,
        productId: args.productId,
        fromWarehouseId: args.fromWarehouseId,
        toWarehouseId: args.toWarehouseId,
        bills: res.originalBills.map((ob) => ({
          billId: ob.id,
          items: ob.items
            .map((it, index) => ({
              index,
              productId: it.productId,
              batchAllocations: it.batchAllocations,
            }))
            .filter((x) => x.productId === args.productId),
        })),
      };
      writeReassignStore({
        log: [
          ...store.log,
          ...res.perBill.map((p) => ({
            at,
            by,
            billId: p.billId,
            productId: args.productId,
            from: args.fromWarehouseId,
            to: args.toWarehouseId,
            movedCases: p.movedCases,
          })),
        ],
        undo: snapshot,
      });
      setHasOversoldReassignUndo(true);

      allBillsRef.current = res.updatedBills;
      setBills(res.updatedBills);
      saveOrders(res.updatedBills).catch(() => {});
      for (const b of res.changedBills)
        cloud("pushBillToSupabase", pushBillToSupabase(b));
      notify(
        `Moved ${res.movedCases} cases on ${res.changedBills.length} bill(s) to the other godown. Totals, GST, costs & payments unchanged. You can undo this from the inspector.`,
      );
      return summary;
    } catch (e) {
      if (e instanceof ReassignGuardError) return fail(e.message);
      return fail("Could not move the bills. Nothing was saved.");
    }
  }

  function undoLastOversoldReassign(): {
    ok: boolean;
    restoredBills: number;
    error?: string;
  } {
    if (currentRole !== "admin")
      return {
        ok: false,
        restoredBills: 0,
        error: "Only the owner login can undo a godown move.",
      };
    const store = readReassignStore();
    const snap = store.undo;
    if (!snap)
      return { ok: false, restoredBills: 0, error: "Nothing to undo." };
    const changed: Bill[] = [];
    const next = allBillsRef.current.map((b) => {
      const sb = snap.bills.find((x) => x.billId === b.id);
      if (!sb) return b;
      let touched = false;
      const items = b.items.map((it, index) => {
        const si = sb.items.find(
          (x) => x.index === index && x.productId === it.productId,
        );
        if (!si) return it;
        touched = true;
        const { batchAllocations: _cur, ...rest } = it as any;
        return si.batchAllocations
          ? { ...rest, batchAllocations: si.batchAllocations }
          : rest;
      });
      if (!touched) return b;
      const nb = { ...b, items } as Bill;
      changed.push(nb);
      return nb;
    });
    if (changed.length === 0)
      return {
        ok: false,
        restoredBills: 0,
        error:
          "Those bills have changed since the move; nothing was restored.",
      };
    allBillsRef.current = next;
    setBills(next);
    saveOrders(next).catch(() => {});
    for (const b of changed) cloud("pushBillToSupabase", pushBillToSupabase(b));
    writeReassignStore({
      log: [
        ...store.log,
        {
          at: new Date().toISOString(),
          by: (currentUser as any)?.name || "owner",
          undo: true,
          bills: changed.map((b) => b.id),
        },
      ],
      undo: null,
    });
    setHasOversoldReassignUndo(false);
    notify(`Undid the godown move on ${changed.length} bill(s).`);
    return { ok: true, restoredBills: changed.length };
  }

  function recordMissingSeriesAsCancelled(missingIds: number[]): number {
    const newCancelled = buildMissingSeriesCancelledBills(
      missingIds,
      allBillsRef.current,
      getInvoicePrefix(),
    );
    const merged = stampChangedBills(
      allBillsRef.current,
      [...allBillsRef.current, ...newCancelled].sort((a, b) => a.id - b.id),
    );
    allBillsRef.current = merged;
    saveOrders(merged).catch(() => {});
    setBills((prev) => [...prev, ...newCancelled].sort((a, b) => a.id - b.id));

    for (const b of newCancelled) {
      cloud("pushBillToSupabase", pushBillToSupabase(b));
    }
    return newCancelled.length;
  }

  function repairMissingBillPayments(): number {
    const currentPayments = paymentsRef?.current ?? payments;
    const newRows = calcMissingBillPaymentRows(
      allBillsRef.current,
      currentPayments,
    );
    if (newRows.length > 0) {
      if (paymentsRef) {
        paymentsRef.current = stampChangedPayments(currentPayments, [
          ...newRows,
          ...currentPayments,
        ]);
      }
      setPayments((prev) => [...newRows, ...prev]);
    }
    return newRows.length;
  }

  function reassignBillDocNumber(billId: number): string | null {
    const target = allBillsRef.current.find((b) => b.id === billId);
    if (!target || target.status === "cancelled" || target.cancellation)
      return null;
    const isNonGst = isGstExcludedBill(target, products);
    const others = allBillsRef.current.filter(
      (b) => b.id !== billId && b.status !== "cancelled" && !b.cancellation,
    );
    const taken = new Set(
      others
        .filter((b) => isGstExcludedBill(b, products) === isNonGst)
        .map((b) =>
          formatBillNumber(
            b,
            billingSettings,
            isNonGst ? "non_gst" : "gst",
          ).toUpperCase(),
        ),
    );
    let candidate = nextBillDocNumber({
      billId,
      isNonGst,
      salesmanName: target.salesman,
      salesmanId: target.salesmanId,
      currentBills: others,
    });
    if (taken.has(candidate.toUpperCase())) {
      if (isNonGst) {
        let seq = reserveDocNumber("non_gst_bill", others.length + 1);
        while (taken.has(`NG-${seq}`)) seq += 1;
        candidate = `NG-${seq}`;
      } else {
        const prefix = getInvoicePrefix();
        let maxNum = highestGstInvoiceSeq(
          others,
          billingSettings || prefix,
          products,
        );
        for (const dn of taken) {
          const m = dn.match(/(\d+)$/);
          if (m) maxNum = Math.max(maxNum, Number(m[1]) || 0);
        }
        let seq = reserveDocNumber("gst_bill", maxNum);
        while (taken.has(`${prefix.toUpperCase()}-${seq}`)) seq += 1;
        candidate = `${prefix}-${seq}`;
      }
    }
    const updated: Bill = {
      ...target,
      docNo: candidate,
      duplicateNumberConflict: undefined,
      conflictNote: undefined,
      updatedAt: new Date().toISOString(),
    };
    const nextBills = allBillsRef.current.map((b) =>
      b.id === billId ? updated : b,
    );
    allBillsRef.current = nextBills;
    setBills((bs) => {
      const next = bs.map((b) => (b.id === billId ? updated : b));
      try {
        saveOrders(next as any).catch(() => {});
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        parsed.bills = next;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      } catch {}
      return next;
    });
    cloud("pushBillToSupabase", pushBillToSupabase(updated));
    cloudFetch("/api/bills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
    notify(`Assigned unique invoice number #${candidate}.`);
    return candidate;
  }

  return {
    repairBillTotals,
    repairNonGstBillTaxes,
    convertBillsToTaxInvoices,
    repairEstimatedBillCosts,
    restoreCrossWarehouseAllocations,
    hasOversoldReassignUndo,
    reassignBillsProductWarehouse,
    undoLastOversoldReassign,
    recordMissingSeriesAsCancelled,
    repairMissingBillPayments,
    reassignBillDocNumber,
  };
}
