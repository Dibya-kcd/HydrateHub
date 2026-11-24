import { billEditLockReason } from "../../utils/billEditLock";
import React, { useState } from "react";
import {
  deleteBillFromSupabase,
  pushBillToSupabase,
  pushDeletionRecordsToSupabase,
  pushPaymentsToSupabase,
  pushTripToSupabase,
} from "../../lib/supabase";
import { checkSaleForRegime, noOutputTax, resolveTaxRegime, stripOutputTax } from "../../tax/appRegime";
import type {
  AuthUser,
  Bill,
  BillCancellation,
  BillEditEntry,
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
  ReturnTracking,
  Salesman,
  SalesReturn,
  ScrapAction,
  TabId,
  UserRole,
  Trip,
  Warehouse,
} from "../../types";
import {
  applyBillCostRepairPlan,
  applyCrossWarehouseRestorePlan,
  type BillCostRepairPlan,
  type CrossWarehouseShiftPlan,
  type RepairApplyMode,
} from "../../utils/billCostRepair";
import { billTotals } from "../../utils/billing";
import { todayISO } from "../../utils/dateLocal";
import {
  cartTaxMix,
  deriveSalesmanSeriesCode,
  formatBillNumber,
  formatSalesmanDocNo,
  highestGstInvoiceSeq,
  isGstExcludedBill,
  makeBillClientUid,
} from "../../utils/invoiceCommon";
import { planSplitMixedBill } from "../../utils/mixedBillSplit";
import {
  ReassignGuardError,
  type ReassignSummary,
  reassignBillsProductWarehouse as reassignBillsPure,
} from "../../utils/oversoldDiagnostic";
import { applyBillEditPaymentPlan, planBillEditPayments } from "../../utils/paymentReversal";
import { stampChangedPayments } from "../../utils/paymentStamp";
import {
  billBalance,
  buildSalesReturn,
  type SalesReturnInputLine,
  type SalesReturnResult,
} from "../../utils/salesReturns";
import { previewPricing, totalsMatch } from "../../utils/schemeEngine";
import { saveOrders, savePayments } from "../../utils/storage";
import {
  resolveBillWarehouseId,
  tripPrimaryWarehouseId,
  tripWarehouseIds,
} from "../../utils/tripLoads";
import {
  billMoneySignature,
  computePlanBillEditStock,
  computePreviewBillEdit,
  describeBillChanges,
  resolveEditTripForBill,
} from "../ledgerBillEditHelpers";
import {
  buildMissingSeriesCancelledBills,
  buildRepairedBillTotalUpdate,
  calcConvertBillsToTaxInvoices,
  calcPreviewBillDelete,
  calcRepairNonGstBillTaxes,
} from "../ledgerBillRepairHelpers";
import { last10Of } from "../ledgerCustomerCalculations";
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
} from "../ledgerHelpers";
import { calcMissingBillPaymentRows } from "../ledgerPaymentCalculations";
import type {
  BillDeletePaymentAction,
  BillDeletePreview,
  BillEditPreview,
  SplitBillsResult,
} from "../ledgerTypes";
import type { computeCustomerLedger } from "../ledgerCustomerCalculations";

const REASSIGN_KEY = "mrwater_oversold_reassign_v1";

type ReassignSnapshot = {
  at: string;
  by: string;
  productId: number;
  fromWarehouseId: string;
  toWarehouseId: string;
  bills: { billId: number; items: { index: number; productId: number; batchAllocations?: any[] }[] }[];
};

const readReassignStore = (): { log: any[]; undo: ReassignSnapshot | null } => {
  try {
    const v = JSON.parse(localStorage.getItem(REASSIGN_KEY) || "null");
    return { log: Array.isArray(v?.log) ? v.log : [], undo: v?.undo || null };
  } catch {
    return { log: [], undo: null };
  }
};

const writeReassignStore = (v: { log: any[]; undo: ReassignSnapshot | null }) => {
  try {
    localStorage.setItem(REASSIGN_KEY, JSON.stringify({ log: v.log.slice(-200), undo: v.undo }));
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
  ) => { productId: number; productName: string; required: number; available: number }[];
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
  setCustomProductPrice: (productId: number, rate: number, customerName?: string) => void;
  currentUser: AuthUser | null;
  currentRole: UserRole | null;
  setTab: React.Dispatch<React.SetStateAction<TabId>>;
  notify: (message: string) => void;
}

export function useBillingActions({
  allBills: _allBills,
  allBillsRef,
  setBills,
  commitBillUpdates,
  cart,
  setCart,
  editingBillId,
  setEditingBillId,
  setJustFinalizedBillId,
  setJustFinalizedSplitIds,
  products,
  warehouses,
  defaultWarehouse,
  inventoryBatches,
  promotions,
  setPromotions,
  trips,
  setTrips,
  tripOfBill,
  orgProfile,
  billingSettings,
  salesmen = [],
  gstMode,
  customers,
  payments,
  paymentsRef,
  setPayments,
  inventoryDispositions,
  addInventoryDisposition,
  deleteInventoryDisposition,
  stockShortfalls,
  allocateBatches,
  fallbackWarehouseId,
  remainingStock,
  logPaymentAudit,
  resolveMasterCustomerId,
  findBillingCustomer,
  getCustomerLedger,
  setCustomProductPrice,
  currentUser,
  currentRole,
  setTab,
  notify,
}: UseBillingActionsParams) {
  function startEditBill(bill: Bill) {
    if ((bill.returns || []).length > 0) {
      notify(
        "This invoice has customer returns against it, so it can no longer be edited.",
      );
      return;
    }
    setEditingBillId(bill.id);
    setCart({
      retailer: bill.retailer,
      phone: bill.phone,
      date: bill.date,
      items: bill.items.map((it) => ({ ...it })),
      warehouseId: bill.warehouseId || "",
      tripId: bill.tripId,
      vehicle: bill.vehicle,
      salesman: bill.salesman,
      additionalDiscount: bill.additionalDiscount || 0,
    });
    setTab("billing");
  }

  function cancelEditBill() {
    setEditingBillId(null);
    setCart(emptyCart());
  }

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
    const maxSeq = highestGstInvoiceSeq(currentBills, billingSettings || prefix, products);
    const seq = reserveDocNumber("gst_bill", maxSeq);
    return `${prefix}-${seq}`;
  }

  function nextBillDocNumber(params: {
    billId?: number;
    isNonGst: boolean;
    salesmanName?: string;
    salesmanId?: string;
    currentBills: Bill[];
  }): string {
    const { isNonGst, salesmanName, salesmanId, currentBills } = params;
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
        const code = deriveSalesmanSeriesCode(matchedSalesman, salesmen, billingSettings);
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

  function planBillEditStock(
    updated: Bill,
    nextTrip: Trip | null,
  ) {
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

  function finalizeBill(
    amountPaid?: number,
    tripId?: number,
    overallDiscount?: number,
    paymentDate?: string,
    paymentMode?: PaymentMode,
    paymentNote?: string,
    billDate?: string,
    extras?: {
      supplyType?: "B2C" | "B2B";
      customerGstin?: string;
      isRetrospective?: boolean;
      invoiceType?: "tax_invoice" | "bill_of_supply" | "retail";
      isGstInvoice?: boolean;
      docNo?: string;
      docSeries?: "gst" | "non_gst";
      gstExclude?: boolean;
      splitGroupId?: string;
      party?: {
        retailer?: string;
        phone?: string;
        salesman?: string;
        vehicle?: string;
        warehouseId?: string;
        customerId?: string;
      };
    },
  ): number | null {
    const effCart = extras?.party ? { ...cart, ...extras.party } : cart;
    const pickedCust = (() => {
      const pid = extras?.party?.customerId;
      if (!pid) return undefined;
      const c = customers.find((x) => x.id === pid);
      return c && normCustName(c.name) === normCustName(effCart.retailer) ? c : undefined;
    })();
    if (effCart.items.length === 0) return null;
    const effectiveBillDate =
      (billDate && billDate.trim()) ||
      (effCart.date && effCart.date.trim()) ||
      todayISO();
    const finalTripId = tripId !== undefined ? tripId : effCart.tripId;
    const matchedTrip = finalTripId
      ? trips.find((t) => Number(t.id) === Number(finalTripId))
      : null;
    const resolvedWarehouseId = resolveBillWarehouseId({
      trip: matchedTrip,
      cartWarehouseId: effCart.warehouseId,
      defaultWarehouseId: defaultWarehouse?.id,
      warehouses,
    });

    let fefo: { items: BillItem[]; problems: string[] };
    let cartEditStockChanged = false;
    const originalForEdit =
      editingBillId !== null
        ? allBillsRef.current.find((b) => b.id === editingBillId)
        : undefined;
    if (originalForEdit) {
      const plan = planBillEditStock(
        {
          ...originalForEdit,
          items: effCart.items,
          date: effectiveBillDate,
          warehouseId: resolvedWarehouseId || "",
          tripId: finalTripId || undefined,
        } as Bill,
        matchedTrip || null,
      );
      if (plan.problems.length > 0) {
        notify(
          "Cannot save these changes:\n" +
            plan.problems.map((m) => `• ${m}`).join("\n"),
        );
        return null;
      }
      cartEditStockChanged = plan.stockChanged;
      fefo = { items: plan.items, problems: [] };
    } else {
      const shortfalls = stockShortfalls(
        effCart.items,
        editingBillId,
        matchedTrip,
        resolvedWarehouseId,
      );
      if (shortfalls.length > 0) {
        notify(
          "Cannot save this bill — insufficient stock:\n" +
            shortfalls
              .map(
                (s) =>
                  `• ${s.productName}: need ${s.required}, only ${Math.max(0, s.available)} available` +
                  (matchedTrip ? ` on van (${matchedTrip.vehicle})` : ""),
              )
              .join("\n"),
        );
        return null;
      }

      fefo = allocateBatches(
        effCart.items,
        effectiveBillDate,
        resolvedWarehouseId,
        editingBillId,
        matchedTrip,
      );
      if (fefo.problems.length > 0) {
        notify(
          "Cannot save this bill:\n" +
            fefo.problems.map((m) => `• ${m}`).join("\n"),
        );
        return null;
      }
    }
    const batchCostById = new Map(
      inventoryBatches.map((b) => [
        b.id,
        Number(b.effectiveCostPrice) || Number(b.costPrice) || 0,
      ]),
    );
    const billItemsRaw = fefo.items.map((it) => {
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
    const allNonGstItems =
      billItemsRaw.length > 0 &&
      billItemsRaw.every((it) => {
        const prod = products.find((p) => p.id === it.productId);
        return it.taxability === "non_gst" || prod?.taxability === "non_gst";
      });
    const isNonGstSeries =
      allNonGstItems ||
      extras?.docSeries === "non_gst" ||
      extras?.gstExclude === true ||
      Boolean(extras?.docNo && extras.docNo.toUpperCase().startsWith("NG-"));

    const taxRegime = resolveTaxRegime(orgProfile, effectiveBillDate);
    const saleCheck =
      !isNonGstSeries && taxRegime.active
        ? checkSaleForRegime(orgProfile, {
            date: effectiveBillDate,
            customerGstin: extras?.customerGstin,
            items: effCart.items,
          })
        : null;
    if (saleCheck && !saleCheck.ok) {
      notify(
        "Cannot save this bill - GST rules:\n" + saleCheck.errors.map((e) => `• ${e.message}`).join("\n"),
      );
      return null;
    }
    const outputTaxOff = noOutputTax(taxRegime);
    if (outputTaxOff) {
      extras = { ...(extras || {}), invoiceType: "bill_of_supply", isGstInvoice: false };
    }
    const billItemsNorm = billItemsRaw.map((it) => {
      const prod = products.find((p) => p.id === it.productId);
      if (it.taxability === "non_gst" || prod?.taxability === "non_gst") {
        return {
          ...it,
          taxability: "non_gst" as const,
          gst: 0,
          cgstRate: 0,
          sgstRate: 0,
          cgst: 0,
          sgst: 0,
          taxable: Number(it.amount) || 0,
        };
      }
      return it;
    });
    if (isNonGstSeries) {
      extras = {
        ...(extras || {}),
        invoiceType: "bill_of_supply",
        isGstInvoice: false,
        supplyType: "B2C",
        customerGstin: undefined,
        docSeries: "non_gst",
        gstExclude: true,
      };
    }
    const forceOffTax =
      outputTaxOff ||
      isNonGstSeries ||
      extras?.invoiceType === "bill_of_supply" ||
      extras?.invoiceType === "retail" ||
      extras?.isGstInvoice === false;
    const billItems =
      outputTaxOff || isNonGstSeries ? stripOutputTax(billItemsNorm) : billItemsNorm;
    const discountToApply =
      overallDiscount !== undefined
        ? overallDiscount
        : effCart.additionalDiscount || 0;
    const totals = billTotals(
      billItems,
      forceOffTax ? "off" : gstMode,
      discountToApply,
    );
    const paid =
      amountPaid !== undefined
        ? Math.min(Math.max(0, amountPaid), totals.total)
        : totals.total;
    const isAnonymousParty =
      !effCart.retailer || effCart.retailer.trim().toLowerCase() === "cash sale";
    if (isAnonymousParty && totals.total - paid > 0.005) {
      notify(
        'An unpaid balance cannot be booked against "Cash Sale". Select or enter a customer for credit sales, or collect the full amount.',
      );
      return null;
    }

    {
      const retailer = (effCart.retailer || "").trim();
      const isCash =
        !retailer ||
        retailer.toLowerCase() === "cash sale" ||
        retailer.toLowerCase() === "spot cash";
      if (!isCash && paid < totals.total - 0.005) {
        const cust = pickedCust ?? findBillingCustomer(retailer, effCart.phone);
        const limit = Number(cust?.creditLimit) || 0;
        if (limit > 0) {
          const led = getCustomerLedger(cust?.id || retailer, effCart.phone);
          let existingDue = led.rawBalance;
          if (editingBillId != null) {
            const eb = led.bills.find((b) => b.id === editingBillId);
            if (eb) existingDue -= billBalance(eb);
          }
          existingDue = Math.max(0, Math.round(existingDue * 100) / 100);
          const thisCredit = Math.max(0, totals.total - paid);
          if (existingDue + thisCredit > limit + 0.009) {
            notify(
              `Credit limit exceeded for ${retailer}.\n` +
                `Limit ₹${limit.toLocaleString("en-IN")} · Already due ₹${existingDue.toLocaleString("en-IN", { maximumFractionDigits: 0 })} · ` +
                `This bill credit ₹${thisCredit.toLocaleString("en-IN", { maximumFractionDigits: 0 })}.\n` +
                `Collect more payment or reduce the bill.`,
            );
            return null;
          }
        }
      }
    }

    const resolvedSalesmanId =
      matchedTrip?.salesmanId ||
      (currentUser?.role === "salesman" ? currentUser.id : undefined) ||
      effCart.salesmanId;
    const resolvedSalesmanName =
      matchedTrip?.salesman ||
      (currentUser?.role === "salesman" ? currentUser.name : undefined) ||
      effCart.salesman;

    const activePaymentDate =
      paymentDate && paymentDate.trim()
        ? paymentDate.trim()
        : effectiveBillDate;
    const activePaymentMode = paymentMode || "cash";
    const activePaymentNote = paymentNote || undefined;

    if (editingBillId !== null) {
      const resolvedEditDocSeries: "gst" | "non_gst" = isNonGstSeries ? "non_gst" : "gst";
      const origDocNo = String(originalForEdit?.docNo || "").trim();
      const originalWasNonGst = originalForEdit
        ? originalForEdit.docSeries === "non_gst" ||
          originalForEdit.gstExclude === true ||
          origDocNo.toUpperCase().startsWith("NG-") ||
          isGstExcludedBill(originalForEdit, products)
        : false;
      const resolvedEditDocNo =
        extras?.docNo ||
        (resolvedEditDocSeries === "non_gst"
          ? originalWasNonGst
            ? origDocNo || `NG-${editingBillId}`
            : nextBillDocNumber({
                billId: editingBillId,
                isNonGst: true,
                salesmanName: resolvedSalesmanName,
                salesmanId: resolvedSalesmanId,
                currentBills: allBillsRef.current,
              })
          : !originalWasNonGst
            ? origDocNo || `${getInvoicePrefix()}-${editingBillId}`
            : nextBillDocNumber({
                billId: editingBillId,
                isNonGst: false,
                salesmanName: resolvedSalesmanName,
                salesmanId: resolvedSalesmanId,
                currentBills: allBillsRef.current,
              }));
      const updated: Bill = {
        ...totals,
        id: editingBillId,
        docNo: resolvedEditDocNo,
        docSeries: resolvedEditDocSeries,
        gstExclude: isNonGstSeries,
        splitGroupId: extras?.splitGroupId ?? originalForEdit?.splitGroupId,
        retailer: effCart.retailer || "Cash Sale",
        phone: effCart.phone,
        date: effectiveBillDate,
        items: billItems,
        amountPaid: paid,
        warehouseId: resolvedWarehouseId || "",
        tripId: finalTripId || undefined,
        vehicle: matchedTrip?.vehicle || effCart.vehicle || undefined,
        salesman: resolvedSalesmanName || undefined,
        salesmanId: resolvedSalesmanId || undefined,
        additionalDiscount: discountToApply,
        paymentDate: activePaymentDate,
        paymentMode: activePaymentMode,
        paymentNote: activePaymentNote,
        supplyType:
          !isNonGstSeries && extras?.supplyType === "B2B" && extras?.customerGstin ? "B2B" : "B2C",
        customerGstin:
          !isNonGstSeries && extras?.supplyType === "B2B"
            ? extras?.customerGstin || undefined
            : undefined,
        invoiceType: isNonGstSeries
          ? "bill_of_supply"
          : extras?.invoiceType ||
            (extras?.isGstInvoice === true
              ? "tax_invoice"
              : extras?.isGstInvoice === false
                ? "retail"
                : extras?.supplyType === "B2B" && extras?.customerGstin
                  ? "tax_invoice"
                  : "retail"),
        isGstInvoice: isNonGstSeries
          ? false
          : extras?.isGstInvoice !== undefined
            ? extras.isGstInvoice
            : extras?.invoiceType === "tax_invoice"
              ? true
              : extras?.invoiceType === "retail" || extras?.invoiceType === "bill_of_supply"
                ? false
                : extras?.supplyType === "B2B" && Boolean(extras?.customerGstin),
        isRetrospective: extras?.isRetrospective === true,
        ...(saleCheck?.stamp ? { taxStamp: saleCheck.stamp } : {}),
        editHistory: originalForEdit
          ? [
              ...(originalForEdit.editHistory || []),
              {
                at: new Date().toISOString(),
                by: currentUser?.name || "Admin",
                comment: "Edited from the billing screen",
                changes: describeBillChanges(originalForEdit, {
                  ...originalForEdit,
                  ...totals,
                  retailer: effCart.retailer || "Cash Sale",
                  date: effectiveBillDate,
                  items: billItems,
                  amountPaid: paid,
                } as Bill),
                stockChanged: cartEditStockChanged,
                totalBefore: Number(originalForEdit.total) || 0,
                totalAfter: Number(totals.total) || 0,
                paidBefore: Number(originalForEdit.amountPaid) || 0,
                paidAfter: Number(paid) || 0,
              } as BillEditEntry,
            ]
          : undefined,
      };
      for (const it of effCart.items) {
        if (
          it.productId &&
          it.customPriceEdited &&
          typeof it.rate === "number" &&
          it.rate >= 0
        ) {
          setCustomProductPrice(it.productId, it.rate, effCart.retailer);
        }
      }

      const nextEditBills = stampChangedBills(
        allBillsRef.current,
        allBillsRef.current.map((b) => (b.id === editingBillId ? updated : b)),
      );
      allBillsRef.current = nextEditBills;
      try {
        saveOrders(nextEditBills as any).catch(() => {});
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        parsed.bills = nextEditBills;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      } catch {}
      setBills((bs) => bs.map((b) => (b.id === editingBillId ? updated : b)));
      const id = editingBillId;
      setEditingBillId(null);
      setCart(emptyCart());
      setJustFinalizedSplitIds([]);
      setJustFinalizedBillId(id);

      syncBillPaymentsOnEdit(
        updated,
        amountPaid !== undefined ? Math.max(0, amountPaid) : totals.total,
        {
          date: activePaymentDate,
          mode: activePaymentMode,
          note: activePaymentNote,
          recordedBy: resolvedSalesmanName || currentUser?.name || "Admin",
          salesmanId: resolvedSalesmanId,
        },
      );

      setTrips((ts) =>
        ts.map((t) => {
          if (t.id === finalTripId || !t.billIds.includes(id)) return t;
          const updatedT = { ...t, billIds: t.billIds.filter((b) => b !== id) };
          cloud("pushTripToSupabase", pushTripToSupabase(updatedT));
          return updatedT;
        }),
      );

      if (finalTripId) {
        setTrips((ts) =>
          ts.map((t) => {
            if (t.id !== finalTripId) return t;
            if (t.billIds.includes(id)) return t;
            const updatedT = { ...t, billIds: [...t.billIds, id] };
            cloud("pushTripToSupabase", pushTripToSupabase(updatedT));
            return updatedT;
          }),
        );
      }

      cloud("pushBillToSupabase", pushBillToSupabase(updated));
      cloudFetch("/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });

      return id;
    } else {
      const nextId = reserveDocNumber(
        "bill",
        allBillsRef.current.length ? Math.max(...allBillsRef.current.map((b) => b.id)) : 100,
      );
      const resolvedDocSeries: "gst" | "non_gst" = isNonGstSeries ? "non_gst" : "gst";
      const resolvedDocNo =
        extras?.docNo ||
        nextBillDocNumber({
          billId: nextId,
          isNonGst: resolvedDocSeries === "non_gst",
          salesmanName: resolvedSalesmanName,
          salesmanId: resolvedSalesmanId,
          currentBills: allBillsRef.current,
        });
      const deviceId = getDeviceId();
      const newBill: Bill = {
        ...totals,
        id: nextId,
        docNo: resolvedDocNo,
        docSeries: resolvedDocSeries,
        gstExclude: isNonGstSeries,
        splitGroupId: extras?.splitGroupId,
        clientUid: makeBillClientUid(deviceId),
        originDeviceId: deviceId,
        retailer: effCart.retailer || "Cash Sale",
        phone: effCart.phone,
        customerId: pickedCust?.id ?? resolveMasterCustomerId(effCart.retailer, effCart.phone),
        date: effectiveBillDate,
        items: billItems,
        amountPaid: paid,
        warehouseId: resolvedWarehouseId || "",
        tripId: finalTripId || undefined,
        vehicle: matchedTrip?.vehicle || effCart.vehicle || undefined,
        salesman: resolvedSalesmanName || undefined,
        salesmanId: resolvedSalesmanId || undefined,
        additionalDiscount: discountToApply,
        paymentDate: activePaymentDate,
        paymentMode: activePaymentMode,
        paymentNote: activePaymentNote,
        supplyType:
          !isNonGstSeries && extras?.supplyType === "B2B" && extras?.customerGstin ? "B2B" : "B2C",
        customerGstin:
          !isNonGstSeries && extras?.supplyType === "B2B"
            ? extras?.customerGstin || undefined
            : undefined,
        invoiceType: isNonGstSeries
          ? "bill_of_supply"
          : extras?.invoiceType ||
            (extras?.isGstInvoice === true
              ? "tax_invoice"
              : extras?.isGstInvoice === false
                ? "retail"
                : extras?.supplyType === "B2B" && extras?.customerGstin
                  ? "tax_invoice"
                  : "retail"),
        isGstInvoice: isNonGstSeries
          ? false
          : extras?.isGstInvoice !== undefined
            ? extras.isGstInvoice
            : extras?.invoiceType === "tax_invoice"
              ? true
              : extras?.invoiceType === "retail" || extras?.invoiceType === "bill_of_supply"
                ? false
                : extras?.supplyType === "B2B" && Boolean(extras?.customerGstin),
        isRetrospective: extras?.isRetrospective === true,
        ...(saleCheck?.stamp ? { taxStamp: saleCheck.stamp } : {}),
      };

      if (billingSettings?.schemesEnabled === true) {
        const serverPreview = previewPricing(
          effCart.items,
          promotions,
          products,
          {
            customerName: effCart.retailer,
            customerPhone: effCart.phone,
            billDate: effectiveBillDate,
            schemesEnabled: true,
            autoApply: billingSettings.autoApplyPromotions !== false,
          },
        );
        const clientSchemeDisc = (effCart.items || []).reduce(
          (s, it) => s + (Number(it.discountAmount ?? it.discount) || 0),
          0,
        );
        if (!totalsMatch(clientSchemeDisc, serverPreview.schemeDiscountTotal, 0.05)) {
          notify(
            `Scheme totals recalculated at save (₹${serverPreview.schemeDiscountTotal.toFixed(2)}).`,
          );
        }
        newBill.schemeDiscountTotal = serverPreview.schemeDiscountTotal;
        newBill.schemesApplied = serverPreview.applications;
        newBill.youSaved = serverPreview.youSaved;
        newBill.schemesEnabledAtSave = true;
        newBill.schemeVersionMap = Object.fromEntries(
          serverPreview.applications.map((a) => [String(a.schemeId), a.schemeVersion]),
        );
        for (const app of serverPreview.applications) {
          if (app.status !== "applied") continue;
          setPromotions((prev) =>
            prev.map((p) =>
              Number(p.id) === Number(app.schemeId)
                ? { ...p, usedCount: (Number(p.usedCount) || 0) + 1 }
                : p,
            ),
          );
        }
      }

      for (const it of effCart.items) {
        if (
          it.productId &&
          it.customPriceEdited &&
          typeof it.rate === "number" &&
          it.rate >= 0
        ) {
          setCustomProductPrice(it.productId, it.rate, effCart.retailer);
        }
      }

      allBillsRef.current = [newBill, ...allBillsRef.current];
      setBills((bs) => {
        const next = [newBill, ...bs];
        try {
          saveOrders(next as any).catch(() => {});
          const raw = localStorage.getItem(STORAGE_KEY);
          const parsed = raw ? JSON.parse(raw) : {};
          parsed.bills = next;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        } catch {}
        return next;
      });
      setCart(emptyCart());
      setJustFinalizedSplitIds([]);
      setJustFinalizedBillId(nextId);

      if (paid > 0) {
        const newPay: PaymentRecord = {
          id: `pay_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          billId: nextId,
          customerName: newBill.retailer,
          customerPhone: newBill.phone,
          paymentDate: activePaymentDate,
          amount: paid,
          mode: activePaymentMode,
          referenceNote:
            activePaymentNote || `Initial payment on ${resolvedDocNo}`,
          recordedBy: resolvedSalesmanName || currentUser?.name || "Admin",
          salesmanId: resolvedSalesmanId,
          createdAt: new Date().toISOString(),
        };
        if (paymentsRef) {
          paymentsRef.current = stampChangedPayments(
            paymentsRef.current,
            [newPay, ...paymentsRef.current],
          );
        }
        setPayments((prev) => [newPay, ...prev]);
      }

      if (finalTripId) {
        setTrips((ts) =>
          ts.map((t) => {
            if (t.id !== finalTripId) return t;
            if (t.billIds.includes(nextId)) return t;
            const updatedT = { ...t, billIds: [...t.billIds, nextId] };
            cloud("pushTripToSupabase", pushTripToSupabase(updatedT));
            return updatedT;
          }),
        );
      }

      cloud("pushBillToSupabase", pushBillToSupabase(newBill));
      cloudFetch("/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newBill),
      });

      return nextId;
    }
  }

  function finalizeSplitBills(params: {
    amountPaid?: number;
    tripId?: number;
    overallDiscount?: number;
    paymentDate?: string;
    paymentMode?: PaymentMode;
    paymentNote?: string;
    billDate?: string;
    extras?: {
      supplyType?: "B2C" | "B2B";
      customerGstin?: string;
      isRetrospective?: boolean;
      invoiceType?: "tax_invoice" | "bill_of_supply" | "retail";
      isGstInvoice?: boolean;
      party?: {
        retailer?: string;
        phone?: string;
        salesman?: string;
        vehicle?: string;
        warehouseId?: string;
        customerId?: string;
      };
    };
  }): SplitBillsResult | null {
    const {
      amountPaid,
      tripId,
      overallDiscount,
      paymentDate,
      paymentMode,
      paymentNote,
      billDate,
    } = params;
    const extras = params.extras;
    const effCart = extras?.party ? { ...cart, ...extras.party } : cart;
    if (effCart.items.length === 0) return null;

    const isItemNonGst = (it: BillItem) => {
      const prod = products.find((p) => p.id === it.productId);
      return it.taxability === "non_gst" || prod?.taxability === "non_gst";
    };
    const gstCartItems = effCart.items.filter((it) => !isItemNonGst(it));
    const nonGstCartItems = effCart.items.filter((it) => isItemNonGst(it));

    if (nonGstCartItems.length === 0) {
      const id = finalizeBill(amountPaid, tripId, overallDiscount, paymentDate, paymentMode, paymentNote, billDate, extras);
      return id
        ? { gstBillId: id, nonGstBillId: null, splitGroupId: "", gstBill: allBillsRef.current.find((b) => b.id === id) ?? null, nonGstBill: null }
        : null;
    }
    if (gstCartItems.length === 0) {
      const id = finalizeBill(amountPaid, tripId, overallDiscount, paymentDate, paymentMode, paymentNote, billDate, {
        ...(extras || {}),
        docSeries: "non_gst",
        gstExclude: true,
        invoiceType: "bill_of_supply",
        isGstInvoice: false,
      });
      return id
        ? { gstBillId: null, nonGstBillId: id, splitGroupId: "", gstBill: null, nonGstBill: allBillsRef.current.find((b) => b.id === id) ?? null }
        : null;
    }

    const pickedCust = (() => {
      const pid = extras?.party?.customerId;
      if (!pid) return undefined;
      const c = customers.find((x) => x.id === pid);
      return c && normCustName(c.name) === normCustName(effCart.retailer) ? c : undefined;
    })();
    const effectiveBillDate =
      (billDate && billDate.trim()) ||
      (effCart.date && effCart.date.trim()) ||
      todayISO();
    const finalTripId = tripId !== undefined ? tripId : effCart.tripId;
    const matchedTrip = finalTripId
      ? trips.find((t) => Number(t.id) === Number(finalTripId))
      : null;
    const resolvedWarehouseId = resolveBillWarehouseId({
      trip: matchedTrip,
      cartWarehouseId: effCart.warehouseId,
      defaultWarehouseId: defaultWarehouse?.id,
      warehouses,
    });

    const shortfalls = stockShortfalls(
      effCart.items,
      null,
      matchedTrip,
      resolvedWarehouseId,
    );
    if (shortfalls.length > 0) {
      notify(
        "Cannot save split bills — insufficient stock:\n" +
          shortfalls
            .map(
              (s) =>
                `• ${s.productName}: need ${s.required}, only ${Math.max(0, s.available)} available` +
                (matchedTrip ? ` on van (${matchedTrip.vehicle})` : ""),
            )
            .join("\n"),
      );
      return null;
    }

    const fefo = allocateBatches(
      effCart.items,
      effectiveBillDate,
      resolvedWarehouseId,
      null,
      matchedTrip,
    );
    if (fefo.problems.length > 0) {
      notify(
        "Cannot save split bills:\n" + fefo.problems.map((m) => `• ${m}`).join("\n"),
      );
      return null;
    }

    const taxRegime = resolveTaxRegime(orgProfile, effectiveBillDate);
    const saleCheck = taxRegime.active
      ? checkSaleForRegime(orgProfile, {
          date: effectiveBillDate,
          customerGstin: extras?.customerGstin,
          items: gstCartItems,
        })
      : null;
    if (saleCheck && !saleCheck.ok) {
      notify(
        "Cannot save GST bill — GST rules:\n" +
          saleCheck.errors.map((e) => `• ${e.message}`).join("\n"),
      );
      return null;
    }
    const outputTaxOff = noOutputTax(taxRegime);

    const batchCostById = new Map(
      inventoryBatches.map((b) => [
        b.id,
        Number(b.effectiveCostPrice) || Number(b.costPrice) || 0,
      ]),
    );
    const withCosts = fefo.items.map((it) => {
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
      return cost > 0 ? { ...it, costExGst: Math.round(cost * 100) / 100 } : it;
    });

    const rawGstItems = withCosts.filter((it) => !isItemNonGst(it));
    const rawNonGstItems = withCosts.filter((it) => isItemNonGst(it)).map((it) => ({
      ...it,
      taxability: "non_gst" as const,
      gst: 0,
      cgstRate: 0,
      sgstRate: 0,
      cgst: 0,
      sgst: 0,
      taxable: Number(it.amount) || 0,
    }));

    const gstItems = outputTaxOff ? stripOutputTax(rawGstItems) : rawGstItems;
    const nonGstItems = stripOutputTax(rawNonGstItems);

    const totalDiscount =
      overallDiscount !== undefined
        ? Math.max(0, Number(overallDiscount) || 0)
        : Math.max(0, Number(effCart.additionalDiscount) || 0);
    const gstAmtSum = gstItems.reduce((s, it) => s + Math.max(0, Number(it.amount) || 0), 0);
    const nonGstAmtSum = nonGstItems.reduce((s, it) => s + Math.max(0, Number(it.amount) || 0), 0);
    const totalAmtSum = gstAmtSum + nonGstAmtSum;
    let gstDiscount =
      totalDiscount > 0 && totalAmtSum > 0
        ? Math.round((totalDiscount * (gstAmtSum / totalAmtSum)) * 100) / 100
        : 0;
    gstDiscount = Math.min(gstDiscount, gstAmtSum);
    const nonGstDiscount = Math.min(
      Math.max(0, Math.round((totalDiscount - gstDiscount) * 100) / 100),
      nonGstAmtSum,
    );

    const gstForceOff =
      outputTaxOff ||
      extras?.invoiceType === "bill_of_supply" ||
      extras?.invoiceType === "retail" ||
      extras?.isGstInvoice === false;
    const gstTotals = billTotals(gstItems, gstForceOff ? "off" : gstMode, gstDiscount);
    const nonGstTotals = billTotals(nonGstItems, "off", nonGstDiscount);
    const combinedTotal = Math.round((gstTotals.total + nonGstTotals.total) * 100) / 100;

    const totalPaid =
      amountPaid !== undefined
        ? Math.min(Math.max(0, amountPaid), combinedTotal)
        : combinedTotal;

    const isAnonymousParty =
      !effCart.retailer || effCart.retailer.trim().toLowerCase() === "cash sale";
    if (isAnonymousParty && combinedTotal - totalPaid > 0.005) {
      notify(
        'An unpaid balance cannot be booked against "Cash Sale". Select or enter a customer for credit sales, or collect the full amount.',
      );
      return null;
    }

    {
      const retailer = (effCart.retailer || "").trim();
      const isCash =
        !retailer ||
        retailer.toLowerCase() === "cash sale" ||
        retailer.toLowerCase() === "spot cash";
      if (!isCash && totalPaid < combinedTotal - 0.005) {
        const cust = pickedCust ?? findBillingCustomer(retailer, effCart.phone);
        const limit = Number(cust?.creditLimit) || 0;
        if (limit > 0) {
          const led = getCustomerLedger(cust?.id || retailer, effCart.phone);
          const existingDue = Math.max(0, Math.round(led.rawBalance * 100) / 100);
          const thisCredit = Math.max(0, combinedTotal - totalPaid);
          if (existingDue + thisCredit > limit + 0.009) {
            notify(
              `Credit limit exceeded for ${retailer}.\n` +
                `Limit ₹${limit.toLocaleString("en-IN")} · Already due ₹${existingDue.toLocaleString("en-IN", { maximumFractionDigits: 0 })} · ` +
                `Combined credit ₹${thisCredit.toLocaleString("en-IN", { maximumFractionDigits: 0 })}.\n` +
                `Collect more payment or reduce the bill.`,
            );
            return null;
          }
        }
      }
    }

    const gstPaid = Math.round(Math.min(totalPaid, gstTotals.total) * 100) / 100;
    const nonGstPaid = Math.round(
      Math.min(Math.max(0, totalPaid - gstPaid), nonGstTotals.total) * 100,
    ) / 100;

    const resolvedSalesmanId =
      matchedTrip?.salesmanId ||
      (currentUser?.role === "salesman" ? currentUser.id : undefined) ||
      effCart.salesmanId;
    const resolvedSalesmanName =
      matchedTrip?.salesman ||
      (currentUser?.role === "salesman" ? currentUser.name : undefined) ||
      effCart.salesman;
    const activePaymentDate =
      paymentDate && paymentDate.trim() ? paymentDate.trim() : effectiveBillDate;
    const activePaymentMode = paymentMode || "cash";
    const activePaymentNote = paymentNote || undefined;
    const resolvedCustomerId =
      pickedCust?.id ?? resolveMasterCustomerId(effCart.retailer, effCart.phone);

    const maxExistingId = allBillsRef.current.length
      ? Math.max(...allBillsRef.current.map((b) => b.id))
      : 100;
    const gstId = reserveDocNumber("bill", maxExistingId);
    const nonGstId = reserveDocNumber("bill", Math.max(maxExistingId, gstId));
    const gstDocNo = nextBillDocNumber({
      billId: gstId,
      isNonGst: false,
      salesmanName: resolvedSalesmanName,
      salesmanId: resolvedSalesmanId,
      currentBills: allBillsRef.current,
    });
    const nonGstDocNo = nextBillDocNumber({
      billId: nonGstId,
      isNonGst: true,
      salesmanName: resolvedSalesmanName,
      salesmanId: resolvedSalesmanId,
      currentBills: allBillsRef.current,
    });
    const splitGroupId = `split_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const deviceId = getDeviceId();

    const gstBill: Bill = {
      ...gstTotals,
      id: gstId,
      docNo: gstDocNo,
      docSeries: "gst",
      gstExclude: false,
      splitGroupId,
      clientUid: makeBillClientUid(deviceId),
      originDeviceId: deviceId,
      retailer: effCart.retailer || "Cash Sale",
      phone: effCart.phone,
      customerId: resolvedCustomerId,
      date: effectiveBillDate,
      items: gstItems,
      amountPaid: gstPaid,
      warehouseId: resolvedWarehouseId || "",
      tripId: finalTripId || undefined,
      vehicle: matchedTrip?.vehicle || effCart.vehicle || undefined,
      salesman: resolvedSalesmanName || undefined,
      salesmanId: resolvedSalesmanId || undefined,
      additionalDiscount: gstDiscount,
      paymentDate: activePaymentDate,
      paymentMode: activePaymentMode,
      paymentNote: activePaymentNote,
      supplyType: extras?.supplyType === "B2B" && extras?.customerGstin ? "B2B" : "B2C",
      customerGstin:
        extras?.supplyType === "B2B" ? extras?.customerGstin || undefined : undefined,
      invoiceType: outputTaxOff
        ? "bill_of_supply"
        : extras?.invoiceType ||
          (extras?.isGstInvoice === true
            ? "tax_invoice"
            : extras?.isGstInvoice === false
              ? "retail"
              : extras?.supplyType === "B2B" && extras?.customerGstin
                ? "tax_invoice"
                : "retail"),
      isGstInvoice: outputTaxOff
        ? false
        : extras?.isGstInvoice !== undefined
          ? extras.isGstInvoice
          : extras?.invoiceType === "tax_invoice"
            ? true
            : extras?.invoiceType === "retail" || extras?.invoiceType === "bill_of_supply"
              ? false
              : extras?.supplyType === "B2B" && Boolean(extras?.customerGstin),
      isRetrospective: extras?.isRetrospective === true,
      ...(saleCheck?.stamp ? { taxStamp: saleCheck.stamp } : {}),
    };

    const nonGstBill: Bill = {
      ...nonGstTotals,
      id: nonGstId,
      docNo: nonGstDocNo,
      docSeries: "non_gst",
      gstExclude: true,
      splitGroupId,
      clientUid: makeBillClientUid(deviceId),
      originDeviceId: deviceId,
      retailer: effCart.retailer || "Cash Sale",
      phone: effCart.phone,
      customerId: resolvedCustomerId,
      date: effectiveBillDate,
      items: nonGstItems,
      amountPaid: nonGstPaid,
      warehouseId: resolvedWarehouseId || "",
      tripId: finalTripId || undefined,
      vehicle: matchedTrip?.vehicle || effCart.vehicle || undefined,
      salesman: resolvedSalesmanName || undefined,
      salesmanId: resolvedSalesmanId || undefined,
      additionalDiscount: nonGstDiscount,
      paymentDate: activePaymentDate,
      paymentMode: activePaymentMode,
      paymentNote: activePaymentNote,
      supplyType: "B2C",
      customerGstin: undefined,
      invoiceType: "bill_of_supply",
      isGstInvoice: false,
      isRetrospective: extras?.isRetrospective === true,
    };

    if (billingSettings?.schemesEnabled === true) {
      const preview = previewPricing(effCart.items, promotions, products, {
        customerName: effCart.retailer,
        customerPhone: effCart.phone,
        billDate: effectiveBillDate,
        schemesEnabled: true,
        autoApply: billingSettings.autoApplyPromotions !== false,
      });
      const lineDisc = (items: BillItem[]) =>
        items.reduce((sum, it) => sum + (Number(it.discountAmount ?? it.discount) || 0), 0);
      const gstSchemeDisc = lineDisc(gstItems);
      const nonGstSchemeDisc = lineDisc(nonGstItems);
      const schemeDiscSum = gstSchemeDisc + nonGstSchemeDisc;
      const freeIds = (items: BillItem[]) => new Set(items.map((i) => Number(i.productId)));
      const gstIds = freeIds(gstItems);
      const applied = preview.applications.filter((a) => a.status === "applied");
      const stamp = (bill: Bill, billSchemeDisc: number, ids: Set<number>) => {
        const share = schemeDiscSum > 0 ? billSchemeDisc / schemeDiscSum : 0;
        const apps = applied
          .map((a) => {
            const isFreeHere = a.freeProductId !== undefined && ids.has(Number(a.freeProductId));
            const discountAmount = Math.round((Number(a.discountAmount) || 0) * share * 100) / 100;
            if (discountAmount <= 0 && !isFreeHere) return null;
            return { ...a, discountAmount, freeQty: isFreeHere ? a.freeQty : 0 };
          })
          .filter(Boolean) as typeof applied;
        bill.schemeDiscountTotal = Math.round(billSchemeDisc * 100) / 100;
        bill.schemesApplied = apps;
        bill.youSaved = Math.round(billSchemeDisc * 100) / 100;
        bill.schemesEnabledAtSave = true;
        bill.schemeVersionMap = Object.fromEntries(apps.map((a) => [String(a.schemeId), a.schemeVersion]));
      };
      stamp(gstBill, gstSchemeDisc, gstIds);
      stamp(nonGstBill, nonGstSchemeDisc, freeIds(nonGstItems));
      for (const app of applied) {
        setPromotions((prev) =>
          prev.map((p) =>
            Number(p.id) === Number(app.schemeId)
              ? { ...p, usedCount: (Number(p.usedCount) || 0) + 1 }
              : p,
          ),
        );
      }
    }

    for (const it of effCart.items) {
      if (
        it.productId &&
        it.customPriceEdited &&
        typeof it.rate === "number" &&
        it.rate >= 0
      ) {
        setCustomProductPrice(it.productId, it.rate, effCart.retailer);
      }
    }

    allBillsRef.current = [nonGstBill, gstBill, ...allBillsRef.current];
    setBills((bs) => {
      const next = [nonGstBill, gstBill, ...bs];
      try {
        saveOrders(next as any).catch(() => {});
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        parsed.bills = next;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      } catch {}
      return next;
    });
    setCart(emptyCart());
    setJustFinalizedBillId(gstId);
    setJustFinalizedSplitIds([gstId, nonGstId]);

    const newPayments: PaymentRecord[] = [];
    if (gstPaid > 0) {
      newPayments.push({
        id: `pay_${Date.now()}_g_${Math.random().toString(36).slice(2, 5)}`,
        billId: gstId,
        customerName: gstBill.retailer,
        customerPhone: gstBill.phone,
        paymentDate: activePaymentDate,
        amount: gstPaid,
        mode: activePaymentMode,
        referenceNote: activePaymentNote || `Initial payment on ${gstDocNo}`,
        recordedBy: resolvedSalesmanName || currentUser?.name || "Admin",
        salesmanId: resolvedSalesmanId,
        createdAt: new Date().toISOString(),
      });
    }
    if (nonGstPaid > 0) {
      newPayments.push({
        id: `pay_${Date.now()}_n_${Math.random().toString(36).slice(2, 5)}`,
        billId: nonGstId,
        customerName: nonGstBill.retailer,
        customerPhone: nonGstBill.phone,
        paymentDate: activePaymentDate,
        amount: nonGstPaid,
        mode: activePaymentMode,
        referenceNote: activePaymentNote || `Initial payment on ${nonGstDocNo}`,
        recordedBy: resolvedSalesmanName || currentUser?.name || "Admin",
        salesmanId: resolvedSalesmanId,
        createdAt: new Date().toISOString(),
      });
    }
    if (newPayments.length > 0) {
      if (paymentsRef) {
        paymentsRef.current = stampChangedPayments(
          paymentsRef.current,
          [...newPayments, ...paymentsRef.current],
        );
      }
      setPayments((prev) => [...newPayments, ...prev]);
    }

    if (finalTripId) {
      setTrips((ts) =>
        ts.map((t) => {
          if (t.id !== finalTripId) return t;
          const addIds = [gstId, nonGstId].filter((x) => !t.billIds.includes(x));
          if (addIds.length === 0) return t;
          const updatedT = { ...t, billIds: [...t.billIds, ...addIds] };
          cloud("pushTripToSupabase", pushTripToSupabase(updatedT));
          return updatedT;
        }),
      );
    }

    cloud("pushBillToSupabase", pushBillToSupabase(gstBill));
    cloud("pushBillToSupabase", pushBillToSupabase(nonGstBill));
    cloudFetch("/api/bills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(gstBill),
    });
    cloudFetch("/api/bills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nonGstBill),
    });

    return { gstBillId: gstId, nonGstBillId: nonGstId, splitGroupId, gstBill, nonGstBill };
  }

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
          if (rt && rt.sourceBillId === billId && d.batchId && !(skipReturnId && rt.sourceReturnId === skipReturnId))
            used[d.batchId] = (used[d.batchId] || 0) + (Number(d.quantity) || 0);
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
            compensationStatus: action === "company" ? "pending" : "not_applicable",
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
              (l) => `${l.productName}: ${l.restockQty} restocked / ${l.scrapQty} scrapped`,
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
      const give = (Number(l.restockQty) || 0) - (keepRestock[l.productId] || 0);
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
      return { ok: false, error: "Please write a short reason for cancelling this return." };
    const sentOut = returnDispositions(billId, returnId).filter(dispositionWithCompany);
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
        { ...ret, cancelledAt: now, cancelledBy: by, cancelReason: reason.trim() },
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
              (l) => `${l.productName}: ${l.restockQty} restocked / ${l.scrapQty} scrapped un-returned`,
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
    returnDispositions(billId, returnId).forEach((d) => deleteInventoryDisposition(d.id));
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
      return { ok: false, error: "Please write a short comment explaining this correction." };
    const sentOut = returnDispositions(billId, returnId).filter(dispositionWithCompany);
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
        .map((a) => inventoryBatches.find((b) => b.id === a.batchId)?.warehouseId)
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
      returns: (target.returns || []).map((r) => (r.id === returnId ? revised : r)),
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
    returnDispositions(billId, returnId).forEach((d) => deleteInventoryDisposition(d.id));
    recordReturnScrap(without, revised, resolveWh, returnId);
    notify(`Return ${old.creditNoteNo} corrected. Stock, credit and ledger now follow the new quantities.`);
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
    // A saved invoice is cancelled with a credit note, never deleted: the server refuses DELETE (405) so the number
    // series stays consecutive. This path used to remove the bill straight from the cloud and skip that rule. It stays
    // available only for developer data repair (VITE_ALLOW_BILL_DELETE=true).
    if ((import.meta as any)?.env?.VITE_ALLOW_BILL_DELETE !== "true") {
      notify(`Invoice #${billId} cannot be deleted. Cancel it instead (the invoice number is kept).`);
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
      const ids = Array.from(new Set([...heldRows.map((p) => p.id), ...synthIds]));
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
          cloudFetch(`/api/payments/${encodeURIComponent(p.id)}`, { method: "DELETE" });
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
      updated = { ...updated, customerId: resolveMasterCustomerId(updated.retailer, updated.phone) };
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
      if (tripWhIds.length > 0 && (!currentWh || !tripWhIds.includes(currentWh))) {
        const primaryWh = tripPrimaryWarehouseId(billTrip, validWhIds);
        if (primaryWh) {
          updated = { ...updated, warehouseId: primaryWh };
        }
      }
    }
    if (Array.isArray(updated.items) && cartTaxMix(updated.items, products).allNonGst) {
      const cleanTotal = Math.round(
        Math.max(
          0,
          updated.items.reduce((s, it) => s + (Number(it.amount) || 0), 0) -
            Math.max(0, Number(updated.additionalDiscount) || 0),
        ) * 100,
      ) / 100;
      const origWasNonGst =
        originalBill?.docSeries === "non_gst" ||
        originalBill?.gstExclude === true ||
        String(updated.docNo || originalBill?.docNo || "").trim().toUpperCase().startsWith("NG-");
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
      notify("This invoice has customer returns against it, so it cannot be auto-split.");
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
        "Cannot split this bill:\n" + plan.problems.map((m) => `• ${m}`).join("\n"),
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
      return cost > 0 ? { ...it, costExGst: Math.round(cost * 100) / 100 } : it;
    });

    let preparedWarehouseId = draft.warehouseId;
    if (billTrip) {
      const validWhIds = new Set(warehouses.map((w) => w.id));
      const tripWhIds = tripWarehouseIds(billTrip, validWhIds);
      const currentWh = String(preparedWarehouseId || "").trim();
      if (tripWhIds.length > 0 && (!currentWh || !tripWhIds.includes(currentWh))) {
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

    const { gstBill, nonGstBill, updatedBill, createdBill: rawCreatedBill, combinedTotal, requestedPaid } =
      splitPlan;
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

      const splitPlan = planBillEditPayments({
        payments: currentPayments,
        bill: updatedBill,
        targetPaid: updatedBill.amountPaid,
        requestedPaid,
        today: splitToday,
        nowIso: splitNowIso,
        paymentDate: updatedBill.paymentDate || updatedBill.date || splitToday,
        mode: updatedBill.paymentMode || "cash",
        note: updatedBill.paymentNote,
        recordedBy: splitRecordedBy,
        salesmanId: updatedBill.salesmanId,
        newId: (tag = "split") =>
          `pay_${splitStamp}_${tag}_${splitSeq++}_${Math.random().toString(36).slice(2, 6)}`,
        reason: `Invoice #${updatedBill.id} split into ${updatedBill.docNo || `#${updatedBill.id}`} and ${createdBill.docNo || `#${createdBill.id}`}`,
        preserveExcessAsAdvance: false,
      });

      const remainingRevByMode = new Map(splitPlan.reversedByMode);
      const extraRows: PaymentRecord[] = [];
      const extraAudits = [...splitPlan.auditEntries];

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
            ...(createdBill.customerId ? { customerId: createdBill.customerId } : {}),
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
            ...(createdBill.customerId ? { customerId: createdBill.customerId } : {}),
            customerName: createdBill.retailer,
            customerPhone: createdBill.phone,
            paymentDate: createdBill.paymentDate || createdBill.date || splitToday,
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

      const keepAsAdvance = r2(Math.min(requestedPaid, splitPlan.existingBillSum) - combinedTotal);
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
            ...(updatedBill.customerId ? { customerId: updatedBill.customerId } : {}),
            customerName: updatedBill.retailer,
            customerPhone: updatedBill.phone,
            ...(updatedBill.salesmanId ? { salesmanId: updatedBill.salesmanId } : {}),
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
            ...(updatedBill.customerId ? { customerId: updatedBill.customerId } : {}),
            customerName: updatedBill.retailer,
            customerPhone: updatedBill.phone,
            ...(updatedBill.salesmanId ? { salesmanId: updatedBill.salesmanId } : {}),
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
        ...splitPlan,
        newRows: [...extraRows, ...splitPlan.newRows],
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
            applyBillEditPaymentPlan(currentPayments, updatedBill, combinedPlan),
          );
        }
        setPayments((prev) => applyBillEditPaymentPlan(prev, updatedBill, combinedPlan));
        for (const audit of combinedPlan.auditEntries) {
          logPaymentAudit(audit);
        }
      }
    }

    allBillsRef.current = [
      createdBill,
      ...allBillsRef.current.map((b) => (b.id === updatedBill.id ? updatedBill : b)),
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

  function repairBillTotals(billIds: number[]): { fixed: number; skipped: number } {
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
        comment: "Saved totals and tax recalculated from the invoice lines and invoice discount (report audit fix)",
      });
      if (ok) fixed++;
      else skipped++;
    }
    return { fixed, skipped };
  }

  function repairNonGstBillTaxes(billIds: number[]): { fixed: number; skipped: number } {
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

  function convertBillsToTaxInvoices(billIds: number[]): { fixed: number; skipped: number } {
    const currentBills = allBillsRef.current;
    const res = calcConvertBillsToTaxInvoices(billIds, currentBills, products);
    const nextBills = stampChangedBills(currentBills, res.newBills);
    allBillsRef.current = nextBills;
    saveOrders(nextBills).catch(() => {});
    setBills((prev) => calcConvertBillsToTaxInvoices(billIds, prev, products).newBills);

    for (const b of res.changedBills) {
      cloud("pushBillToSupabase", pushBillToSupabase(b));
    }
    return { fixed: res.fixed, skipped: res.skipped };
  }

  function repairEstimatedBillCosts(
    plan: BillCostRepairPlan,
    mode: RepairApplyMode = "link_and_freeze",
  ): { fixedBills: number; fixedLines: number; linkedLines: number; frozenOnlyLines: number; fixedCases: number } {
    const res = applyBillCostRepairPlan({
      bills: allBillsRef.current,
      plan,
      mode,
    });
    if (res.changedBills.length === 0) {
      notify("All selected bill lines already have a saved batch or frozen cost.");
      return { fixedBills: 0, fixedLines: 0, linkedLines: 0, frozenOnlyLines: 0, fixedCases: 0 };
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

  const [hasOversoldReassignUndo, setHasOversoldReassignUndo] = useState<boolean>(
    () => !!readReassignStore().undo,
  );

  function reassignBillsProductWarehouse(args: {
    productId: number;
    fromWarehouseId: string;
    toWarehouseId: string;
    billIds: number[];
    dryRun?: boolean;
  }): ReassignSummary {
    const fail = (error: string): ReassignSummary => ({ ok: false, error, movedCases: 0, perBill: [], skipped: [] });
    if (!args.dryRun && currentRole !== "admin") return fail("Only the owner login can move bills between godowns.");
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
      const summary: ReassignSummary = { ok: true, movedCases: res.movedCases, perBill: res.perBill, skipped: res.skipped };
      if (args.dryRun) return summary;
      if (res.changedBills.length === 0) return { ...summary, ok: false, error: "Nothing could be moved for the selected bills." };

      const by = (currentUser as any)?.name || (currentUser as any)?.username || "owner";
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
            .map((it, index) => ({ index, productId: it.productId, batchAllocations: it.batchAllocations }))
            .filter((x) => x.productId === args.productId),
        })),
      };
      writeReassignStore({
        log: [
          ...store.log,
          ...res.perBill.map((p) => ({ at, by, billId: p.billId, productId: args.productId, from: args.fromWarehouseId, to: args.toWarehouseId, movedCases: p.movedCases })),
        ],
        undo: snapshot,
      });
      setHasOversoldReassignUndo(true);

      allBillsRef.current = res.updatedBills;
      setBills(res.updatedBills);
      saveOrders(res.updatedBills).catch(() => {});
      for (const b of res.changedBills) cloud("pushBillToSupabase", pushBillToSupabase(b));
      notify(
        `Moved ${res.movedCases} cases on ${res.changedBills.length} bill(s) to the other godown. Totals, GST, costs & payments unchanged. You can undo this from the inspector.`,
      );
      return summary;
    } catch (e) {
      if (e instanceof ReassignGuardError) return fail(e.message);
      return fail("Could not move the bills. Nothing was saved.");
    }
  }

  function undoLastOversoldReassign(): { ok: boolean; restoredBills: number; error?: string } {
    if (currentRole !== "admin") return { ok: false, restoredBills: 0, error: "Only the owner login can undo a godown move." };
    const store = readReassignStore();
    const snap = store.undo;
    if (!snap) return { ok: false, restoredBills: 0, error: "Nothing to undo." };
    const changed: Bill[] = [];
    const next = allBillsRef.current.map((b) => {
      const sb = snap.bills.find((x) => x.billId === b.id);
      if (!sb) return b;
      let touched = false;
      const items = b.items.map((it, index) => {
        const si = sb.items.find((x) => x.index === index && x.productId === it.productId);
        if (!si) return it;
        touched = true;
        const { batchAllocations: _cur, ...rest } = it as any;
        return si.batchAllocations ? { ...rest, batchAllocations: si.batchAllocations } : rest;
      });
      if (!touched) return b;
      const nb = { ...b, items } as Bill;
      changed.push(nb);
      return nb;
    });
    if (changed.length === 0) return { ok: false, restoredBills: 0, error: "Those bills have changed since the move; nothing was restored." };
    allBillsRef.current = next;
    setBills(next);
    saveOrders(next).catch(() => {});
    for (const b of changed) cloud("pushBillToSupabase", pushBillToSupabase(b));
    writeReassignStore({
      log: [...store.log, { at: new Date().toISOString(), by: (currentUser as any)?.name || "owner", undo: true, bills: changed.map((b) => b.id) }],
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
    const newRows = calcMissingBillPaymentRows(allBillsRef.current, currentPayments);
    if (newRows.length > 0) {
      if (paymentsRef) {
        paymentsRef.current = stampChangedPayments(
          currentPayments,
          [...newRows, ...currentPayments],
        );
      }
      setPayments((prev) => [...newRows, ...prev]);
    }
    return newRows.length;
  }

  function reassignBillDocNumber(billId: number): string | null {
    const target = allBillsRef.current.find((b) => b.id === billId);
    if (!target || target.status === "cancelled" || target.cancellation) return null;
    const isNonGst = isGstExcludedBill(target, products);
    const others = allBillsRef.current.filter(
      (b) => b.id !== billId && b.status !== "cancelled" && !b.cancellation,
    );
    const taken = new Set(
      others
        .filter((b) => isGstExcludedBill(b, products) === isNonGst)
        .map((b) =>
          formatBillNumber(b, billingSettings, isNonGst ? "non_gst" : "gst").toUpperCase(),
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
        let maxNum = highestGstInvoiceSeq(others, billingSettings || prefix, products);
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
    const nextBills = allBillsRef.current.map((b) => (b.id === billId ? updated : b));
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
    startEditBill,
    cancelEditBill,
    finalizeBill,
    finalizeSplitBills,
    cancelBill,
    createSalesReturn,
    cancelSalesReturn,
    editSalesReturn,
    previewBillDelete,
    deleteBill,
    previewBillEdit,
    updateBill,
    splitMixedBill,
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
