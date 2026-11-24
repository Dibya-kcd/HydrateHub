import type React from "react";
import type {
  AuthUser,
  Bill,
  BillItem,
  BillingSettings,
  CartState,
  Customer,
  GstMode,
  InventoryBatch,
  InventoryDisposition,
  OrganizationProfile,
  PaymentAuditEntry,
  PaymentMode,
  PaymentRecord,
  Product,
  Promotion,
  Salesman,
  TabId,
  Trip,
  UserRole,
  Warehouse,
} from "../../../types";
import { todayISO } from "../../../utils/dateLocal";
import {
  deriveSalesmanSeriesCode,
  formatSalesmanDocNo,
  highestGstInvoiceSeq,
  isGstExcludedBill,
} from "../../../utils/invoiceCommon";
import {
  applyBillEditPaymentPlan,
  planBillEditPayments,
} from "../../../utils/paymentReversal";
import { stampChangedPayments } from "../../../utils/paymentStamp";
import {
  computePlanBillEditStock,
  resolveEditTripForBill,
} from "../../ledgerBillEditHelpers";
import type { computeCustomerLedger } from "../../ledgerCustomerCalculations";
import { addPaymentTombstones, reserveDocNumber } from "../../ledgerHelpers";

export const REASSIGN_KEY = "mrwater_oversold_reassign_v1";

export type ReassignSnapshot = {
  at: string;
  by: string;
  productId: number;
  fromWarehouseId: string;
  toWarehouseId: string;
  bills: {
    billId: number;
    items: { index: number; productId: number; batchAllocations?: any[] }[];
  }[];
};

export const readReassignStore = (): {
  log: any[];
  undo: ReassignSnapshot | null;
} => {
  try {
    const v = JSON.parse(localStorage.getItem(REASSIGN_KEY) || "null");
    return { log: Array.isArray(v?.log) ? v.log : [], undo: v?.undo || null };
  } catch {
    return { log: [], undo: null };
  }
};

export const writeReassignStore = (v: {
  log: any[];
  undo: ReassignSnapshot | null;
}) => {
  try {
    localStorage.setItem(
      REASSIGN_KEY,
      JSON.stringify({ log: v.log.slice(-200), undo: v.undo }),
    );
  } catch {}
};

export interface UseBillingActionsParams {
  allBills: Bill[];
  allBillsRef: React.MutableRefObject<Bill[]>;
  setBills: (u: Bill[] | ((prev: Bill[]) => Bill[])) => void;
  commitBillUpdates: (updatedById: Map<number, Bill>) => void;
  cart: CartState;
  setCart: React.Dispatch<React.SetStateAction<CartState>>;
  editingBillId: number | null;
  setEditingBillId: React.Dispatch<React.SetStateAction<number | null>>;
  setJustFinalizedBillId: React.Dispatch<React.SetStateAction<number | null>>;
  setJustFinalizedSplitIds: React.Dispatch<React.SetStateAction<number[]>>;
  products: Product[];
  warehouses: Warehouse[];
  defaultWarehouse: Warehouse | undefined;
  inventoryBatches: InventoryBatch[];
  promotions: Promotion[];
  setPromotions: React.Dispatch<React.SetStateAction<Promotion[]>>;
  trips: Trip[];
  setTrips: (u: Trip[] | ((prev: Trip[]) => Trip[])) => void;
  tripOfBill: (b: Bill) => Trip | null;
  orgProfile: OrganizationProfile;
  billingSettings: BillingSettings;
  salesmen?: Salesman[];
  gstMode: GstMode;
  customers: Customer[];
  payments: PaymentRecord[];
  paymentsRef?: React.MutableRefObject<PaymentRecord[]>;
  setPayments: React.Dispatch<React.SetStateAction<PaymentRecord[]>>;
  inventoryDispositions: InventoryDisposition[];
  addInventoryDisposition: (
    d: Omit<InventoryDisposition, "id" | "createdAt" | "costValue">,
  ) => { disposition: InventoryDisposition } | { error: string };
  deleteInventoryDisposition: (id: string) => void;
  stockShortfalls: (
    items: BillItem[],
    excludeBillId?: number | null,
    trip?: Trip | null,
    whId?: string,
  ) => {
    productId: number;
    productName: string;
    required: number;
    available: number;
  }[];
  allocateBatches: (
    items: BillItem[],
    billDate: string,
    whId?: string,
    excludeBillId?: number | null,
    trip?: Trip | null,
  ) => { items: BillItem[]; problems: string[] };
  fallbackWarehouseId: (product: Product) => string;
  remainingStock: (productId: number) => number;
  logPaymentAudit: (e: Omit<PaymentAuditEntry, "id" | "at" | "by">) => void;
  resolveMasterCustomerId: (name?: string, phone?: string) => string | undefined;
  findBillingCustomer: (name?: string, phone?: string) => Customer | undefined;
  getCustomerLedger: (
    customerNameOrId: string,
    customerPhone?: string,
    customerAltPhone?: string,
  ) => ReturnType<typeof computeCustomerLedger>;
  setCustomProductPrice: (
    productId: number,
    rate: number,
    customerName?: string,
  ) => void;
  currentUser: AuthUser | null;
  currentRole: UserRole | null;
  setTab: React.Dispatch<React.SetStateAction<TabId>>;
  notify: (message: string) => void;
}

export type NormalizedBillingParams = Omit<UseBillingActionsParams, "salesmen"> & {
  salesmen: Salesman[];
};

export function createBillingDocHelpers(params: NormalizedBillingParams) {
  const {
    allBillsRef,
    products,
    trips,
    billingSettings,
    salesmen,
    payments,
    paymentsRef,
    setPayments,
    stockShortfalls,
    allocateBatches,
    logPaymentAudit,
    notify,
  } = params;

  function getInvoicePrefix(): string {
    return (billingSettings?.invoicePrefix || "INV").trim() || "INV";
  }

  function nextNonGstDocNo(currentBills: Bill[]): string {
    let maxSeq = 0;
    for (const b of currentBills) {
      const dn = String(b.docNo || "");
      const m = dn.match(/^NG-(\d+)$/i);
      if (m) maxSeq = Math.max(maxSeq, Number(m[1]) || 0);
    }
    const seq = reserveDocNumber("non_gst_bill", maxSeq);
    return `NG-${seq}`;
  }

  function nextGstDocNo(currentBills: Bill[]): string {
    const prefix = getInvoicePrefix();
    const maxSeq = highestGstInvoiceSeq(
      currentBills,
      billingSettings || prefix,
      products,
    );
    const seq = reserveDocNumber("gst_bill", maxSeq);
    return `${prefix}-${seq}`;
  }

  function nextBillDocNumber(args: {
    billId?: number;
    isNonGst: boolean;
    salesmanName?: string;
    salesmanId?: string;
    currentBills: Bill[];
  }): string {
    const { isNonGst, salesmanName, salesmanId, currentBills } = args;
    if (billingSettings?.numberingMode === "per_salesman_series") {
      const matchedSalesman =
        (salesmen || []).find((s) => salesmanId && s.id === salesmanId) ||
        (salesmen || []).find(
          (s) =>
            salesmanName &&
            s.name.trim().toLowerCase() === salesmanName.trim().toLowerCase(),
        ) ||
        (salesmanName ? { id: salesmanId || "", name: salesmanName } : null);
      if (matchedSalesman) {
        const code = deriveSalesmanSeriesCode(
          matchedSalesman,
          salesmen,
          billingSettings,
        );
        const prefix = isNonGst ? "NG" : getInvoicePrefix();
        const seriesKey = `${isNonGst ? "bill_ng_sm_" : "bill_sm_"}${code}`;
        const pattern = new RegExp(`-${code}-(\\d+)$`, "i");
        let maxSeq = 0;
        for (const b of currentBills) {
          if (isNonGst !== isGstExcludedBill(b, products)) continue;
          const dn = String(b.docNo || "");
          const m = dn.match(pattern);
          if (m) maxSeq = Math.max(maxSeq, Number(m[1]) || 0);
        }
        const seq = reserveDocNumber(seriesKey, maxSeq);
        return formatSalesmanDocNo(prefix, code, seq);
      }
    }
    if (isNonGst) {
      return nextNonGstDocNo(currentBills);
    }
    return nextGstDocNo(currentBills);
  }

  function syncBillPaymentsOnEdit(
    bill: Bill,
    requestedPaid: number,
    opts: {
      date: string;
      mode: PaymentMode;
      note?: string;
      recordedBy: string;
      salesmanId?: string;
      advanceNote?: string;
      preserveExcessAsAdvance?: boolean;
    },
  ) {
    const currentPayments = paymentsRef?.current ?? payments;
    const stamp = Date.now();
    const nowIso = new Date(stamp).toISOString();
    let seq = 0;
    const plan = planBillEditPayments({
      payments: currentPayments,
      bill,
      targetPaid: bill.amountPaid,
      requestedPaid,
      today: todayISO(),
      nowIso,
      paymentDate: opts.date,
      mode: opts.mode,
      note: opts.note,
      recordedBy: opts.recordedBy,
      salesmanId: opts.salesmanId,
      newId: (tag = "edit") =>
        `pay_${stamp}_${tag}_${seq++}_${Math.random().toString(36).slice(2, 6)}`,
      reason: `Invoice #${bill.id} edited`,
      advanceNote: opts.advanceNote,
      preserveExcessAsAdvance: opts.preserveExcessAsAdvance ?? true,
    });

    const hasChanges =
      plan.newRows.length > 0 ||
      plan.updatedById.size > 0 ||
      plan.removedAdjustmentIds.length > 0 ||
      plan.identityUpdatesNeeded;

    if (hasChanges) {
      if (plan.removedAdjustmentIds.length > 0) {
        addPaymentTombstones(plan.removedAdjustmentIds);
      }
      if (paymentsRef) {
        paymentsRef.current = stampChangedPayments(
          currentPayments,
          applyBillEditPaymentPlan(currentPayments, bill, plan),
        );
      }
      setPayments((prev) => applyBillEditPaymentPlan(prev, bill, plan));
      for (const audit of plan.auditEntries) {
        logPaymentAudit(audit);
      }
    }

    if (plan.keptAsAdvance > 0.004) {
      notify(
        `Invoice total is now lower than what was received. ₹${plan.keptAsAdvance.toLocaleString("en-IN", { maximumFractionDigits: 2 })} was kept as an advance on the customer's account.`,
      );
    }

    return plan;
  }

  function planBillEditStock(updated: Bill, nextTrip: Trip | null) {
    return computePlanBillEditStock({
      updated,
      nextTrip,
      allBills: allBillsRef.current,
      trips,
      stockShortfalls,
      allocateBatches,
    });
  }

  function resolveEditTrip(updated: Bill): Trip | null {
    return resolveEditTripForBill(updated, allBillsRef.current, trips);
  }

  return {
    getInvoicePrefix,
    nextBillDocNumber,
    syncBillPaymentsOnEdit,
    planBillEditStock,
    resolveEditTrip,
  };
}

export type BillingDocHelpers = ReturnType<typeof createBillingDocHelpers>;
