import { isAdvanceAdjustmentRow } from "../utils/paymentAllocation";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  isServerProxyMode,
  pushBillToSupabase,
  pushDeletionRecordsToSupabase,
} from "../lib/supabase";
import { costBasisFor } from "../tax/purchaseCost";
import type {
  Audit,
  AuditSession,
  Bill,
  BillingSettings,
  CanonicalActionIntent,
  CartState,
  GRN,
  GstMode,
  InventoryBatch,
  InventoryDisposition,
  OrganizationProfile,
  Product,
  Promotion,
  ReconciliationTransaction,
  StockLedgerEntry,
  StockTransfer,
  SupplierCreditNote,
  SupplierScheme,
  SupplierSchemeApplication,
  TabId,
  Trip,
  Warehouse,
} from "../types";
import {
  normalizeTrip,
  setGstOnFreeCases,
  setRoundOffGrandTotal,
} from "../utils/billing";
import { setOdiaNameLookup, warmOdiaFont } from "../utils/odiaNameLookup";
import {
  loadCachedAuditSessions,
  loadCachedInventoryDispositions,
  loadCachedReconciliationTransactions,
  loadCachedStockLedgerEntries,
  loadCachedTrips,
} from "../utils/storage";
import { useAccessibilityAndPrefs } from "./hooks/useAccessibilityAndPrefs";
import { useActivityLogs } from "./hooks/useActivityLogs";
import { useAuditAndReconciliationActions } from "./hooks/useAuditAndReconciliationActions";
import { useAuthAndStaff } from "./hooks/useAuthAndStaff";
import { useBillingActions } from "./hooks/useBillingActions";
import { useCatalogAndPromotionsActions } from "./hooks/useCatalogAndPromotionsActions";
import { useCloudSync } from "./hooks/useCloudSync";
import { useCustomerAndPaymentActions } from "./hooks/useCustomerAndPaymentActions";
import { useDataManagementActions } from "./hooks/useDataManagementActions";
import { useDerivedStock } from "./hooks/useDerivedStock";
import { useExpenses } from "./hooks/useExpenses";
import { useGrnAndWarehouseActions } from "./hooks/useGrnAndWarehouseActions";
import { useSupplierSchemesAndDispositions } from "./hooks/useSupplierSchemesAndDispositions";
import { useTripActions } from "./hooks/useTripActions";
import {
  buildCatalogFromGrns,
  cloud,
  cloudFetch,
  emptyCart,
  extractCustomPricesFromBills,
  loadCachedCustomerProductPrices,
  loadCachedCustomProductPrices,
  loadInitialState,
  readDispositionTombstones,
  saveCachedCustomerProductPrices,
  saveCachedCustomProductPrices,
  stampChangedBills,
  stampChangedTrips,
} from "./ledgerHelpers";
import type { LedgerContextType, PullFromCloudOptions } from "./ledgerTypes";

export type {
  BillEditPreview,
  BillDeletePreview,
  BillDeletePaymentAction,
  InwardStockParams,
  LedgerContextType,
  PullFromCloudOptions,
  SplitBillsResult,
} from "./ledgerTypes";

/* ---- Payment & Customer safety helpers (module level) ---------------------------------------
 * Deleted payments & customers are remembered so that a later merge with a remote master or cached copy
 * cannot bring them back. The audit trail keeps who changed what.
 */
export {
  BILL_TOMBSTONE_KEY,
  readBillTombstones,
  addBillTombstones,
  withoutDeletedBills,
  PAYMENT_TOMBSTONE_KEY,
  PAYMENT_AUDIT_KEY,
  CUSTOMER_TOMBSTONE_KEY,
  EXPENSE_TOMBSTONE_KEY,
  readExpenseTombstones,
  addExpenseTombstones,
  normCustName,
  readPaymentTombstones,
  addPaymentTombstones,
  withoutDeletedPayments,
  readCustomerTombstones,
  addCustomerTombstones,
  withoutDeletedCustomers,
  CUSTOMER_HIDDEN_KEY,
  readHiddenCustomerNames,
  writeHiddenCustomerNames,
  pickNewerBill,
  productStampMs,
  newerProduct,
  tripFingerprint,
  stampChangedTrips,
  pickNewerTrip,
  stampChangedBills,
  mergeCustomersNewestWins,
  readPaymentAudit,
  DOC_COUNTER_KEY,
  readDocCounters,
  DOC_HELD_KEY,
  DOC_DEVICE_KEY,
  HELD_MAX_AGE_MS,
  getDeviceId,
  readHeldRaw,
  readHeldNumbers,
  writeHeld,
  docReservationInFlight,
  refillDocReservation,
  releaseDocReservations,
  reserveDocNumber,
  STORAGE_KEY,
  extractPromoProductIds,
  normalizePromotion,
  purgeLegacyLocalStorageKeys,
  DISP_TOMBSTONE_KEY,
  readDispositionTombstones,
  addDispositionTombstone,
  emptyCart,
  LINE_FIELD_LABELS,
  fmtVal,
  diffGrn,
  ensureUniqueGrnNumbers,
  buildCatalogFromGrns,
  loadInitialState,
  MRWATER_CUSTOM_PRODUCT_PRICES_KEY,
  MRWATER_CUSTOMER_PRODUCT_PRICES_KEY,
  loadCachedCustomProductPrices,
  saveCachedCustomProductPrices,
  loadCachedCustomerProductPrices,
  saveCachedCustomerProductPrices,
  extractCustomPricesFromBills,
  cloud,
  cloudFetch,
} from "./ledgerHelpers";

const LedgerContext = createContext<LedgerContextType | null>(null);

export const LedgerProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [initial] = useState(loadInitialState);

  const [tab, setTab] = useState<TabId>("dashboard");
  const [grns, setGrns] = useState<GRN[]>(initial.grns);
  const [activeGrnToEdit, setActiveGrnToEdit] = useState<GRN | null>(null);

  const [products, setProducts] = useState<Product[]>(initial.products);
  // Receipts look up saved Odia product names through this (see utils/odiaNameLookup).
  useEffect(() => {
    warmOdiaFont();
    setOdiaNameLookup((id, name) => {
      const key = (name || "").trim().toLowerCase();
      const hit = products.find(
        (p) =>
          (id !== undefined && p.id === id) ||
          (p.name || "").trim().toLowerCase() === key,
      );
      return hit?.nameOr || "";
    });
  }, [products]);

  const [warehouses, setWarehouses] = useState<Warehouse[]>(initial.warehouses);
  const defaultWarehouse = useMemo(() => {
    return warehouses.find((w) => w.isDefault) || warehouses[0];
  }, [warehouses]);

  const [inventoryBatches, setInventoryBatches] = useState<InventoryBatch[]>(
    initial.inventoryBatches,
  );
  // Latest products / batches, readable synchronously. Multi-step operations (post/edit GRN) need
  // the value they just computed, not whatever a React state updater may or may not have run yet.
  const productsRef = useRef<Product[]>(products);
  const inventoryBatchesRef = useRef<InventoryBatch[]>(inventoryBatches);
  productsRef.current = products;
  inventoryBatchesRef.current = inventoryBatches;

  const [stockTransfers, setStockTransfers] = useState<StockTransfer[]>(
    initial.stockTransfers,
  );
  const [promotions, setPromotions] = useState<Promotion[]>(initial.promotions);
  const [supplierSchemes, setSupplierSchemes] = useState<SupplierScheme[]>([]);
  const [supplierSchemeApplications, setSupplierSchemeApplications] = useState<
    SupplierSchemeApplication[]
  >([]);
  const [supplierCreditNotes, setSupplierCreditNotes] = useState<
    SupplierCreditNote[]
  >(() => {
    try {
      const raw = localStorage.getItem("mrwater_cache_supplier_credit_notes");
      const cached: SupplierCreditNote[] = raw ? JSON.parse(raw) : [];
      const tombstones = new Set<string>(
        JSON.parse(
          localStorage.getItem("deleted_supplier_credit_note_ids") || "[]",
        ),
      );
      return Array.isArray(cached)
        ? cached.filter((n) => !tombstones.has(n.id))
        : [];
    } catch {
      return [];
    }
  });

  const [inventoryDispositions, setInventoryDispositions] = useState<
    InventoryDisposition[]
  >(() =>
    loadCachedInventoryDispositions().filter(
      (d) => !readDispositionTombstones().has(d.id),
    ),
  );
  const [auditSessions, setAuditSessions] = useState<AuditSession[]>(() =>
    loadCachedAuditSessions(),
  );
  const [reconciliationTransactions, setReconciliationTransactions] = useState<
    ReconciliationTransaction[]
  >(() => loadCachedReconciliationTransactions());
  const [stockLedgerEntries, setStockLedgerEntries] = useState<
    StockLedgerEntry[]
  >(() => loadCachedStockLedgerEntries());

  // `allBills` holds every invoice, including cancelled ones (kept for GST/audit). `bills` is the
  // active subset that stock, dues, trips, payments and reports all read, so a cancelled invoice
  // drops out of every one of them automatically while its number stays consumed.
  const [allBills, setBillsRaw] = useState<Bill[]>(initial.bills);
  const setBills = useCallback(
    (u: Bill[] | ((prev: Bill[]) => Bill[])) =>
      setBillsRaw((prev) =>
        stampChangedBills(prev, typeof u === "function" ? (u as any)(prev) : u),
      ),
    [],
  );
  const bills = useMemo(
    () => allBills.filter((b) => b.status !== "cancelled"),
    [allBills],
  );
  const allBillsRef = useRef<Bill[]>(allBills);
  allBillsRef.current = allBills;
  const getBillById = useCallback(
    (id: number) => allBillsRef.current.find((b) => Number(b.id) === Number(id)),
    [],
  );
  const cancelledBills = useMemo(
    () => allBills.filter((b) => b.status === "cancelled"),
    [allBills],
  );

  // Lightweight in-app notice (replaces window.alert, which is blocked in PWA/iframe contexts).
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(null), 4500);
  }, []);
  const dismissNotice = useCallback(() => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    setNotice(null);
  }, []);

  // Persistent Custom Product Prices: Always remembers previous custom prices entered
  const [customProductPrices, setCustomProductPrices] = useState<
    Record<number, number>
  >(() => {
    const cached = loadCachedCustomProductPrices();
    const fromBills = extractCustomPricesFromBills(initial.bills || []);
    return { ...fromBills.productPrices, ...cached };
  });

  const [customerProductPrices, setCustomerProductPrices] = useState<
    Record<string, number>
  >(() => {
    const cached = loadCachedCustomerProductPrices();
    const fromBills = extractCustomPricesFromBills(initial.bills || []);
    return { ...fromBills.customerPrices, ...cached };
  });
  const customerProductPricesRef = useRef<Record<string, number>>(
    customerProductPrices,
  );
  customerProductPricesRef.current = customerProductPrices;

  const setCustomProductPrice = useCallback(
    (productId: number, rate: number, customerName?: string) => {
      if (!productId || typeof rate !== "number" || isNaN(rate) || rate < 0)
        return;

      const cleanCustomer = (customerName || "").trim().toLowerCase();
      if (cleanCustomer) {
        const custKey = `${cleanCustomer}_${productId}`;
        setCustomerProductPrices((prev) => {
          if (prev[custKey] === rate) return prev;
          const next = { ...prev, [custKey]: rate };
          saveCachedCustomerProductPrices(next);
          return next;
        });
      }
    },
    [],
  );

  const getPreviousCustomPrice = useCallback(
    (_productId: number, _customerName?: string): number | null => {
      return null;
    },
    [],
  );

  useEffect(() => {
    if (!bills || bills.length === 0) return;
    const extracted = extractCustomPricesFromBills(bills);

    setCustomProductPrices((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [k, v] of Object.entries(extracted.productPrices)) {
        const numK = Number(k);
        if (typeof v === "number" && !isNaN(v) && v > 0 && next[numK] !== v) {
          next[numK] = v;
          changed = true;
        }
      }
      if (changed) {
        saveCachedCustomProductPrices(next);
        return next;
      }
      return prev;
    });

    setCustomerProductPrices((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [k, v] of Object.entries(extracted.customerPrices)) {
        if (typeof v === "number" && !isNaN(v) && v > 0 && next[k] !== v) {
          next[k] = v;
          changed = true;
        }
      }
      if (changed) {
        saveCachedCustomerProductPrices(next);
        return next;
      }
      return prev;
    });
  }, [bills]);

  const [trips, setTripsRaw] = useState<Trip[]>(() => {
    const cached = loadCachedTrips();
    if (cached && cached.length > 0) {
      return cached.map(normalizeTrip);
    }
    return (initial.trips || []).map(normalizeTrip);
  });
  const setTrips = useCallback(
    (u: Trip[] | ((prev: Trip[]) => Trip[])) =>
      setTripsRaw((prev) =>
        stampChangedTrips(prev, typeof u === "function" ? (u as any)(prev) : u),
      ),
    [],
  );
  const [audits, setAudits] = useState<Audit[]>(initial.audits);
  const [gstMode, setGstMode] = useState<GstMode>(initial.gstMode);

  // Organization & Billing Settings
  const [orgProfile, setOrgProfile] = useState<OrganizationProfile>(
    initial.orgProfile,
  );

  // Sync Products and Batches whenever GRNs or Warehouses change (without wiping manually registered products)
  useEffect(() => {
    if (grns.length === 0) return;
    const { products: derivedProducts, batches: derivedBatches } =
      buildCatalogFromGrns(grns, warehouses, (d) => costBasisFor(orgProfile, d));
    if (derivedProducts.length > 0) {
      setProducts((prev) => {
        let changed = false;
        const merged = [...prev];
        for (const dp of derivedProducts) {
          const idx = merged.findIndex(
            (p) =>
              p.id === dp.id ||
              p.name.trim().toLowerCase() === dp.name.trim().toLowerCase() ||
              (p.sku && dp.sku && p.sku === dp.sku),
          );
          if (idx >= 0) {
            const cur = merged[idx];
            const nextSku = cur.sku || dp.sku;
            const nextBatch = cur.batchNumber || dp.batchNumber;
            if (
              cur.opening !== dp.opening ||
              cur.cost !== dp.cost ||
              cur.effectiveCost !== dp.effectiveCost ||
              cur.sku !== nextSku ||
              cur.batchNumber !== nextBatch
            ) {
              changed = true;
              merged[idx] = {
                ...cur,
                opening: dp.opening,
                cost: dp.cost,
                effectiveCost: dp.effectiveCost,
                sku: nextSku,
                batchNumber: nextBatch,
              };
            }
          } else {
            changed = true;
            merged.push(dp);
          }
        }
        return changed ? merged : prev;
      });
    }
    if (derivedBatches.length > 0) {
      setInventoryBatches((prev) => {
        let changed = false;
        const merged = [...prev];
        for (const db of derivedBatches) {
          const idx = merged.findIndex((b) => b.id === db.id);
          if (idx >= 0) {
            const cur = merged[idx];
            const nextHsn = cur.hsn || db.hsn;
            const nextCgst = cur.cgstRate ?? db.cgstRate;
            const nextSgst = cur.sgstRate ?? db.sgstRate;
            const nextEffCost = cur.effectiveCostPrice || db.effectiveCostPrice;
            const nextSupplier = cur.supplierName || db.supplierName;
            const nextInvNo = cur.supplierInvoiceNo || db.supplierInvoiceNo;
            if (
              cur.hsn !== nextHsn ||
              cur.cgstRate !== nextCgst ||
              cur.sgstRate !== nextSgst ||
              cur.effectiveCostPrice !== nextEffCost ||
              cur.supplierName !== nextSupplier ||
              cur.supplierInvoiceNo !== nextInvNo
            ) {
              changed = true;
              merged[idx] = {
                ...cur,
                hsn: nextHsn,
                cgstRate: nextCgst,
                sgstRate: nextSgst,
                effectiveCostPrice: nextEffCost,
                supplierName: nextSupplier,
                supplierInvoiceNo: nextInvNo,
              };
            }
          } else {
            changed = true;
            merged.push(db);
          }
        }
        return changed ? merged : prev;
      });
    }
  }, [
    grns,
    warehouses,
    orgProfile.gstRegistrationType,
    orgProfile.gstEngineStartDate,
  ]);

  const billingSettingsRef = useRef<BillingSettings | null>(null);
  const [billingSettings, setBillingSettings] = useState<BillingSettings>(
    initial.billingSettings,
  );
  billingSettingsRef.current = billingSettings;
  setGstOnFreeCases(billingSettings?.gstOnFreeCases);
  setRoundOffGrandTotal(billingSettings?.roundOffGrandTotal);

  // Cart & editing state
  const [cart, setCart] = useState<CartState>(emptyCart());
  const [editingBillId, setEditingBillId] = useState<number | null>(null);
  const [justFinalizedBillId, setJustFinalizedBillId] = useState<number | null>(
    null,
  );
  const [justFinalizedSplitIds, setJustFinalizedSplitIds] = useState<number[]>(
    [],
  );

  // Bridge ref populated once useCloudSync initializes below
  const pullFromCloudRef = useRef<
    (opts?: PullFromCloudOptions) => Promise<{ success: boolean; message: string }>
  >(async () => ({ success: false, message: "Not initialized" }));

  // Apply already-computed bill changes: keep the sync ref current, update React state, and push
  // each changed bill to the cloud. Side effects live here, never inside a state updater.
  function commitBillUpdates(updatedById: Map<number, Bill>) {
    if (updatedById.size === 0) return;
    const paidBefore = new Map<number, number>();
    for (const b of allBillsRef.current)
      if (updatedById.has(b.id)) paidBefore.set(b.id, Number(b.amountPaid) || 0);
    allBillsRef.current = stampChangedBills(
      allBillsRef.current,
      allBillsRef.current.map((b) => updatedById.get(b.id) ?? b),
    );
    setBills((bs) => bs.map((b) => updatedById.get(b.id) ?? b));
    updatedById.forEach((b) => {
      cloud("pushBillToSupabase", pushBillToSupabase(b));
      cloudFetch(`/api/bills/${b.id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountPaid: b.amountPaid,
          expectedAmountPaid: paidBefore.get(b.id),
        }),
      });
    });
  }

  // 1. Auth & Staff
  const auth = useAuthAndStaff({ setTab, notify, pullFromCloudRef });

  function logDeletion(
    kind: "product" | "batch" | "warehouse" | "audit" | "promotion" | "salesman",
    id: string,
    name?: string,
  ) {
    pushDeletionRecordsToSupabase([
      {
        kind,
        id,
        name,
        deletedAt: new Date().toISOString(),
        by: auth.currentUser?.name || "Admin",
      },
    ]).catch(() => {});
  }
  const productDeletionKey = (p: { id: number; name?: string }) =>
    `${p.id}|${String(p.name || "").trim().toUpperCase()}`;

  // 2. Business Expenses
  const expensesApi = useExpenses({
    currentUser: auth.currentUser,
    currentUserRef: auth.currentUserRef,
  });

  // 3. Accessibility & Display Prefs
  const prefs = useAccessibilityAndPrefs({
    initialFontSize: initial.fontSize,
    initialHighContrast: initial.highContrast,
    initialLowVisionMode: initial.lowVisionMode,
    initialLowVisionStickyPosition: initial.lowVisionStickyPosition,
  });

  // 4. Customer Master & Payment Ledger
  const customerPayments = useCustomerAndPaymentActions({
    initialBills: initial.bills,
    initialPayments: initial.payments,
    allBills,
    allBillsRef,
    bills,
    setBills,
    commitBillUpdates,
    currentUser: auth.currentUser,
    customerProductPricesRef,
    setCustomerProductPrices,
    setExpenses: expensesApi.setExpenses,
    setCart,
    setTab,
    notify,
  });

  // 5. Cloud Sync & Remote Persistence
  const cloudSync = useCloudSync({
    currentUser: auth.currentUser,
    currentRole: auth.currentRole,
    warehouses,
    setWarehouses,
    products,
    productsRef,
    setProducts,
    inventoryBatches,
    setInventoryBatches,
    grns,
    setGrns,
    payments: customerPayments.payments,
    setPayments: customerPayments.setPayments,
    setPaymentAudit: customerPayments.setPaymentAudit,
    stockTransfers,
    setStockTransfers,
    promotions,
    setPromotions,
    allBills,
    allBillsRef,
    setBillsRaw,
    trips,
    setTrips,
    setTripsRaw,
    audits,
    setAudits,
    orgProfile,
    setOrgProfile,
    billingSettings,
    billingSettingsRef,
    setBillingSettings,
    salesmen: auth.salesmen,
    setSalesmen: auth.setSalesmen,
    supplierSchemes,
    setSupplierSchemes,
    supplierSchemeApplications,
    setSupplierSchemeApplications,
    supplierCreditNotes,
    setSupplierCreditNotes,
    inventoryDispositions,
    setInventoryDispositions,
    auditSessions,
    setAuditSessions,
    reconciliationTransactions,
    setReconciliationTransactions,
    stockLedgerEntries,
    setStockLedgerEntries,
    customersRef: customerPayments.customersRef,
    setCustomers: customerPayments.setCustomers,
    syncDeletionLog: customerPayments.syncDeletionLog,
    refreshExpensesFromCloud: expensesApi.refreshExpensesFromCloud,
    reconcilePaymentsFromBills: customerPayments.reconcilePaymentsFromBills,
    productDeletionKey,
  });
  pullFromCloudRef.current = cloudSync.pullFromCloud;

  // 6. Derived Stock & Aggregates
  const derivedStock = useDerivedStock({
    products,
    warehouses,
    defaultWarehouse,
    inventoryBatches,
    bills,
    editingBillId,
    cart,
    promotions,
    audits,
    stockLedgerEntries,
    inventoryDispositions,
    trips,
  });

  // 7. GRN, Warehouse, Batch & Stock Transfers
  const grnWarehouseActions = useGrnAndWarehouseActions({
    grns,
    setGrns,
    activeGrnToEdit,
    setActiveGrnToEdit,
    products,
    productsRef,
    setProducts,
    inventoryBatches,
    inventoryBatchesRef,
    setInventoryBatches,
    warehouses,
    setWarehouses,
    setStockTransfers,
    bills,
    orgProfile,
    currentUser: auth.currentUser,
    warehouseStock: derivedStock.warehouseStock,
    notify,
    logDeletion,
    productDeletionKey,
    setSupabaseStatus: cloudSync.setSupabaseStatus,
  });

  // 8. Product Catalog & Promotions
  const catalogPromoActions = useCatalogAndPromotionsActions({
    products,
    productsRef,
    setProducts,
    inventoryBatches,
    setInventoryBatches,
    warehouses,
    defaultWarehouse,
    promotions,
    setPromotions,
    logDeletion,
    productDeletionKey,
  });

  // 9. Supplier Schemes, Credit Notes & Dispositions
  const supplierDispositionsActions = useSupplierSchemesAndDispositions({
    supplierSchemes,
    setSupplierSchemes,
    supplierSchemeApplications,
    setSupplierSchemeApplications,
    supplierCreditNotes,
    setSupplierCreditNotes,
    inventoryDispositions,
    setInventoryDispositions,
    inventoryBatchesRef,
    bills,
    productWarehouseStock: derivedStock.productWarehouseStock,
    notify,
  });

  // 10. Stock Audits & Reconciliation Sessions
  const auditActions = useAuditAndReconciliationActions({
    audits,
    setAudits,
    auditSessions,
    setAuditSessions,
    reconciliationTransactions,
    setReconciliationTransactions,
    setStockLedgerEntries,
    products,
    warehouses,
    defaultWarehouse,
    bookStock: derivedStock.bookStock,
    stockAsOf: derivedStock.stockAsOf,
    fallbackWarehouseId: derivedStock.fallbackWarehouseId,
    currentUser: auth.currentUser,
    currentRole: auth.currentRole,
    setSupabaseStatus: cloudSync.setSupabaseStatus,
    logDeletion,
  });

  // 11. Vehicle Dispatch & Trips
  const tripActions = useTripActions({
    trips,
    setTrips,
    deadTripIdsRef: cloudSync.deadTripIdsRef,
    bills,
    allBillsRef,
    setBills,
    products,
    warehouses,
    defaultWarehouse,
    salesmen: auth.salesmen,
    currentUser: auth.currentUser,
    inventoryDispositions,
    addInventoryDisposition:
      supplierDispositionsActions.addInventoryDisposition,
    updateInventoryDisposition:
      supplierDispositionsActions.updateInventoryDisposition,
    deleteInventoryDisposition:
      supplierDispositionsActions.deleteInventoryDisposition,
    notify,
  });

  // 12. Billing, Invoicing, Returns & Repair Tools
  const billingActions = useBillingActions({
    allBills,
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
    tripOfBill: tripActions.tripOfBill,
    orgProfile,
    billingSettings,
    salesmen: auth.salesmen,
    gstMode,
    customers: customerPayments.customers,
    payments: customerPayments.payments,
    paymentsRef: customerPayments.paymentsRef,
    setPayments: customerPayments.setPayments,
    inventoryDispositions,
    addInventoryDisposition:
      supplierDispositionsActions.addInventoryDisposition,
    deleteInventoryDisposition:
      supplierDispositionsActions.deleteInventoryDisposition,
    stockShortfalls: derivedStock.stockShortfalls,
    allocateBatches: derivedStock.allocateBatches,
    fallbackWarehouseId: derivedStock.fallbackWarehouseId,
    remainingStock: derivedStock.remainingStock,
    logPaymentAudit: customerPayments.logPaymentAudit,
    resolveMasterCustomerId: customerPayments.resolveMasterCustomerId,
    findBillingCustomer: customerPayments.findBillingCustomer,
    getCustomerLedger: customerPayments.getCustomerLedger,
    setCustomProductPrice,
    currentUser: auth.currentUser,
    currentRole: auth.currentRole,
    setTab,
    notify,
  });

  // 13. Backup, Demo Presets & Database Reset
  const dataManagement = useDataManagementActions({
    orgProfile,
    setOrgProfile,
    billingSettings,
    billingSettingsRef,
    setBillingSettings,
    grns,
    setGrns,
    products,
    setProducts,
    warehouses,
    setWarehouses,
    inventoryBatches,
    setInventoryBatches,
    stockTransfers,
    setStockTransfers,
    promotions,
    setPromotions,
    supplierSchemes,
    setSupplierSchemes,
    supplierSchemeApplications,
    setSupplierSchemeApplications,
    supplierCreditNotes,
    setSupplierCreditNotes,
    expenses: expensesApi.expenses,
    setExpenses: expensesApi.setExpenses,
    allBills,
    setBills,
    trips,
    setTrips,
    audits,
    setAudits,
    gstMode,
    setGstMode,
    payments: customerPayments.payments,
    setPayments: customerPayments.setPayments,
    setCustomers: customerPayments.setCustomers,
    setInventoryDispositions,
    setCart,
    setEditingBillId,
    setJustFinalizedBillId,
    setActiveGrnToEdit,
    setFontSize: prefs.setFontSize,
    setHighContrast: prefs.setHighContrast,
    pullFromCloud: cloudSync.pullFromCloud,
  });

  const loadSampleGrn = () => {
    // Deprecated: sample data removed to maintain a clean database
  };

  // 14. Global Activity Log + Single-Source Canonical Routing Intent
  const activityLogApi = useActivityLogs({
    currentUser: auth.currentUser,
    currentRole: auth.currentRole,
    activeSalesman: auth.activeSalesman,
    activeTab: tab,
    paymentAudit: customerPayments.paymentAudit,
    bills: allBills,
    grns,
  });

  useEffect(() => {
    const ready = isServerProxyMode()
      ? Boolean(auth.currentUser?.id)
      : Boolean(cloudSync.supabaseConfig?.url && cloudSync.supabaseConfig?.anonKey);
    if (ready) {
      void activityLogApi.pullActivityLogs();
      void activityLogApi.flushActivityLogs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudSync.supabaseConfig?.url, auth.currentUser?.id]);

  const [pendingCanonicalAction, setPendingCanonicalAction] =
    useState<CanonicalActionIntent | null>(null);

  const openCanonicalAction = useCallback((intent: CanonicalActionIntent) => {
    setPendingCanonicalAction(intent);
    setTab(intent.targetTab);
  }, []);

  const clearPendingCanonicalAction = useCallback(() => {
    setPendingCanonicalAction(null);
  }, []);

  const returnFromCanonicalAction = useCallback((intent: CanonicalActionIntent) => {
    setPendingCanonicalAction(null);
    if (intent.returnTab) {
      if (intent.returnTab === "customers" && intent.returnContextId) {
        try {
          window.sessionStorage.setItem("hh_return_customer_id", intent.returnContextId);
        } catch {
          /* ignore */
        }
      }
      setTab(intent.returnTab);
    }
  }, []);

  // Centralized audited mutation wrappers (captures before/after, reason, actor, and sourceScreen)
  const postGrnAudited: LedgerContextType["postGrn"] = (grnData) => {
    const created = grnWarehouseActions.postGrn(grnData);
    activityLogApi.recordActivity({
      entityType: "grn",
      entityId: created.id,
      entityLabel: `${created.grnNumber} · ${created.supplierName}`,
      action: "create",
      summary: `Posted GRN ${created.grnNumber} (+${created.totalReceivedQty} cs · ₹${created.grandTotal})`,
      after: {
        grnNumber: created.grnNumber,
        supplierName: created.supplierName,
        invoiceNo: created.invoiceNo,
        inwardDate: created.inwardDate,
        totalReceivedQty: created.totalReceivedQty,
        grandTotal: created.grandTotal,
      },
    });
    return created;
  };

  const updateGrnAudited: LedgerContextType["updateGrn"] = (id, updates, meta) => {
    const before = grns.find((g) => g.id === id);
    grnWarehouseActions.updateGrn(id, updates, meta);
    const label = before ? `${before.grnNumber} · ${updates.supplierName || before.supplierName}` : id;
    activityLogApi.recordActivity({
      entityType: "grn",
      entityId: id,
      entityLabel: label,
      action: "edit",
      reason: meta?.reason,
      summary: `Edited GRN ${before?.grnNumber || id}${updates.grandTotal !== undefined ? ` (₹${updates.grandTotal})` : ""}`,
      before: before
        ? {
            supplierName: before.supplierName,
            invoiceNo: before.invoiceNo,
            inwardDate: before.inwardDate,
            warehouseId: before.warehouseId,
            totalReceivedQty: before.totalReceivedQty,
            grandTotal: before.grandTotal,
          }
        : null,
      after: before
        ? {
            supplierName: updates.supplierName ?? before.supplierName,
            invoiceNo: updates.invoiceNo ?? before.invoiceNo,
            inwardDate: updates.inwardDate ?? before.inwardDate,
            warehouseId: updates.warehouseId ?? before.warehouseId,
            totalReceivedQty: updates.totalReceivedQty ?? before.totalReceivedQty,
            grandTotal: updates.grandTotal ?? before.grandTotal,
          }
        : (updates as Record<string, unknown>),
    });
  };

  const deleteGrnAudited: LedgerContextType["deleteGrn"] = (id, reason) => {
    const before = grns.find((g) => g.id === id);
    grnWarehouseActions.deleteGrn(id);
    if (before) {
      activityLogApi.recordActivity({
        entityType: "grn",
        entityId: id,
        entityLabel: `${before.grnNumber} · ${before.supplierName}`,
        action: "delete",
        reason,
        summary: `Deleted GRN ${before.grnNumber} (-${before.totalReceivedQty} cs · ₹${before.grandTotal})`,
        before: {
          grnNumber: before.grnNumber,
          supplierName: before.supplierName,
          invoiceNo: before.invoiceNo,
          totalReceivedQty: before.totalReceivedQty,
          grandTotal: before.grandTotal,
        },
        after: null,
      });
    }
  };

  const updateBillAudited: LedgerContextType["updateBill"] = (updated, opts) => {
    const before = allBillsRef.current.find((b) => b.id === updated.id);
    const ok = billingActions.updateBill(updated, opts);
    if (ok) {
      activityLogApi.recordActivity({
        entityType: "bill",
        entityId: updated.id,
        entityLabel: `${updated.docNo || `#${updated.id}`} · ${updated.retailer}`,
        action: "edit",
        reason: opts?.comment,
        summary: before
          ? `Edited invoice ${updated.docNo || `#${updated.id}`} (₹${before.total} → ₹${updated.total})`
          : `Edited invoice ${updated.docNo || `#${updated.id}`} (₹${updated.total})`,
        before: before
          ? {
              retailer: before.retailer,
              date: before.date,
              total: before.total,
              amountPaid: before.amountPaid,
              paymentMode: before.paymentMode,
              tripId: before.tripId ?? null,
            }
          : null,
        after: {
          retailer: updated.retailer,
          date: updated.date,
          total: updated.total,
          amountPaid: updated.amountPaid,
          paymentMode: updated.paymentMode,
          tripId: updated.tripId ?? null,
        },
      });
    }
    return ok;
  };

  const deleteBillAudited: LedgerContextType["deleteBill"] = (billId, opts) => {
    // A saved invoice is never deleted: it is cancelled (number kept, credit note issued). Delete stays only as the
    // engine behind tests and the explicit developer switch below.
    if ((import.meta as any).env?.VITE_ALLOW_BILL_DELETE !== "true") {
      notify("A saved invoice cannot be deleted. Cancel it instead: the invoice number is kept and a credit note is issued.");
      return false;
    }
    const before = allBillsRef.current.find((b) => b.id === billId);
    const ok = billingActions.deleteBill(billId, opts);
    if (ok && before) {
      activityLogApi.recordActivity({
        entityType: "bill",
        entityId: billId,
        entityLabel: `${before.docNo || `#${billId}`} · ${before.retailer}`,
        action: "delete",
        reason: opts?.reason,
        summary: `Deleted invoice ${before.docNo || `#${billId}`} (₹${before.total} · payments: ${opts?.paymentAction || "advance"})`,
        before: {
          retailer: before.retailer,
          date: before.date,
          total: before.total,
          amountPaid: before.amountPaid,
          tripId: before.tripId ?? null,
        },
        after: null,
      });
    }
    return ok;
  };

  const cancelBillAudited: LedgerContextType["cancelBill"] = (billId, reason) => {
    const before = allBillsRef.current.find((b) => b.id === billId);
    const cn = billingActions.cancelBill(billId, reason);
    if (cn && before) {
      activityLogApi.recordActivity({
        entityType: "bill",
        entityId: billId,
        entityLabel: `${before.docNo || `#${billId}`} · ${before.retailer}`,
        action: "cancel",
        reason,
        summary: `Cancelled invoice ${before.docNo || `#${billId}`} · issued ${cn.creditNoteNo} (₹${before.total})`,
        before: { status: before.status || "active", total: before.total, amountPaid: before.amountPaid },
        after: { status: "cancelled", creditNoteNo: cn.creditNoteNo, refundDue: cn.refundDue },
      });
    }
    return cn;
  };

  const finalizeBillAudited: LedgerContextType["finalizeBill"] = (...args) => {
    const createdId = billingActions.finalizeBill(...args);
    const created = createdId ? allBillsRef.current.find((b) => b.id === createdId) : undefined;
    if (created) {
      activityLogApi.recordActivity({
        entityType: "bill",
        entityId: created.id,
        entityLabel: `${created.docNo || `#${created.id}`} · ${created.retailer}`,
        action: "create",
        summary: `Created invoice ${created.docNo || `#${created.id}`} for ${created.retailer} (₹${created.total})`,
        after: {
          retailer: created.retailer,
          date: created.date,
          total: created.total,
          amountPaid: created.amountPaid,
          paymentMode: created.paymentMode,
        },
      });
    }
    return createdId;
  };

  const updatePaymentAudited: LedgerContextType["updatePayment"] = (updated, reason) => {
    const before = customerPayments.paymentsRef.current.find((p) => p.id === updated.id);
    const ok = customerPayments.updatePayment(updated, reason);
    if (!ok) return false;
    activityLogApi.recordActivity({
      entityType: "payment",
      entityId: updated.id,
      entityLabel: `${updated.customerName} · ₹${updated.amount}`,
      action: "edit",
      reason: reason || updated.referenceNote,
      summary: before
        ? `Edited payment (${before.customerName}: ₹${before.amount} ${before.mode} → ₹${updated.amount} ${updated.mode})`
        : `Edited payment for ${updated.customerName} (₹${updated.amount})`,
      before: before
        ? {
            customerName: before.customerName,
            amount: before.amount,
            mode: before.mode,
            paymentDate: before.paymentDate,
            billId: before.billId ?? null,
            referenceNote: before.referenceNote || "",
          }
        : null,
      after: {
        customerName: updated.customerName,
        amount: updated.amount,
        mode: updated.mode,
        paymentDate: updated.paymentDate,
        billId: updated.billId ?? null,
        referenceNote: updated.referenceNote || "",
      },
    });
    return true;
  };

  const deletePaymentAudited: LedgerContextType["deletePayment"] = (paymentId, rectificationReason) => {
    const before = customerPayments.paymentsRef.current.find((p) => p.id === paymentId);
    // Money records are never deleted. Only an "advance moved onto an invoice" row (an internal transfer) can be removed, to
    // undo that transfer; every real receipt or refund is reversed with a new entry instead.
    const isTransferRow = Boolean(before && isAdvanceAdjustmentRow(before));
    if (before && !isTransferRow) {
      const ok = customerPayments.reversePayment(paymentId, rectificationReason);
      if (ok) {
        activityLogApi.recordActivity({
          entityType: "payment",
          entityId: paymentId,
          entityLabel: `${before.customerName} · ₹${before.amount}`,
          action: "void",
          reason: rectificationReason,
          summary: `Reversed ${before.mode} payment of ₹${before.amount} from ${before.customerName} (original kept, opposite entry added)`,
          before: {
            customerName: before.customerName,
            amount: before.amount,
            mode: before.mode,
            paymentDate: before.paymentDate,
            billId: before.billId ?? null,
          },
          after: null,
        });
      }
      return;
    }
    const deleted = customerPayments.deletePayment(paymentId, rectificationReason);
    if (deleted && before) {
      activityLogApi.recordActivity({
        entityType: "payment",
        entityId: paymentId,
        entityLabel: `${before.customerName} · ₹${before.amount}`,
        action: "delete",
        reason: rectificationReason,
        summary: `Removed advance adjustment of ₹${before.amount} for ${before.customerName}`,
        before: {
          customerName: before.customerName,
          amount: before.amount,
          mode: before.mode,
          paymentDate: before.paymentDate,
          billId: before.billId ?? null,
        },
        after: null,
      });
    }
  };

  const recordCustomerPaymentAudited: LedgerContextType["recordCustomerPayment"] = (...args) => {
    const ok = customerPayments.recordCustomerPayment(...args);
    if (ok) {
      const [custName, amt, payDate, mode, refNote, billId] = args;
      activityLogApi.recordActivity({
        entityType: "payment",
        entityId: `pay_${Date.now()}`,
        entityLabel: `${custName} · ₹${amt}`,
        action: "create",
        reason: refNote,
        summary: `Recorded ${mode || "cash"} payment of ₹${amt} from ${custName}${billId ? ` (Inv #${billId})` : ""}`,
        after: { customerName: custName, amount: amt, paymentDate: payDate, mode: mode || "cash", billId: billId ?? null },
      });
    }
    return ok;
  };

  const addTripAudited: LedgerContextType["addTrip"] = (...args) => {
    const created = tripActions.addTrip(...args);
    activityLogApi.recordActivity({
      entityType: "trip",
      entityId: created.id,
      entityLabel: `Trip #${created.id} · ${created.vehicle}`,
      action: "create",
      summary: `Created trip #${created.id} (${created.vehicle}, ${created.date})`,
      after: { vehicle: created.vehicle, date: created.date, salesman: created.salesman || "", status: created.status },
    });
    return created;
  };

  const updateTripAudited: LedgerContextType["updateTrip"] = (updated, reason) => {
    const before = trips.find((t) => Number(t.id) === Number(updated.id));
    tripActions.updateTrip(updated);
    const beforeTotal = Object.values(before?.loaded || {}).reduce((s, v) => s + (Number(v) || 0), 0);
    const afterTotal = Object.values(updated.loaded || {}).reduce((s, v) => s + (Number(v) || 0), 0);
    activityLogApi.recordActivity({
      entityType: "trip",
      entityId: updated.id,
      entityLabel: `Trip #${updated.id} · ${updated.vehicle}`,
      action: before?.status === "closed" && updated.status !== "closed" ? "reopen" : "edit",
      reason,
      summary: `Edited Trip #${updated.id} (${updated.vehicle} · load ${beforeTotal} → ${afterTotal} cs)`,
      before: before
        ? { vehicle: before.vehicle, date: before.date, status: before.status, salesman: before.salesman || "", totalLoaded: beforeTotal }
        : null,
      after: { vehicle: updated.vehicle, date: updated.date, status: updated.status, salesman: updated.salesman || "", totalLoaded: afterTotal },
    });
  };

  const deleteTripAudited: LedgerContextType["deleteTrip"] = (tripId, reason) => {
    const before = trips.find((t) => Number(t.id) === Number(tripId));
    tripActions.deleteTrip(tripId);
    if (before) {
      const totalLoaded = Object.values(before.loaded || {}).reduce((s, v) => s + (Number(v) || 0), 0);
      activityLogApi.recordActivity({
        entityType: "trip",
        entityId: tripId,
        entityLabel: `Trip #${tripId} · ${before.vehicle}`,
        action: "delete",
        reason,
        summary: `Deleted Trip #${tripId} (${before.vehicle} · ${before.date} · ${totalLoaded} cs)`,
        before: { vehicle: before.vehicle, date: before.date, status: before.status, salesman: before.salesman || "", totalLoaded },
        after: null,
      });
    }
  };

  const reopenTripAudited: LedgerContextType["reopenTrip"] = (tripId) => {
    const before = trips.find((t) => Number(t.id) === Number(tripId));
    tripActions.reopenTrip(tripId);
    if (before) {
      activityLogApi.recordActivity({
        entityType: "trip",
        entityId: tripId,
        entityLabel: `Trip #${tripId} · ${before.vehicle}`,
        action: "reopen",
        summary: `Reopened Trip #${tripId} (${before.vehicle}) to active status`,
        before: { status: before.status },
        after: { status: "out" },
      });
    }
  };

  const updateExpenseAudited: LedgerContextType["updateExpense"] = (id, patch, reason) => {
    const before = expensesApi.expenses.find((e) => e.id === id);
    expensesApi.updateExpense(id, patch);
    activityLogApi.recordActivity({
      entityType: "expense",
      entityId: id,
      entityLabel: `${patch.paidTo || before?.paidTo || patch.category || before?.category || "Expense"} · ₹${patch.amount ?? before?.amount ?? 0}`,
      action: "edit",
      reason,
      summary: before
        ? `Edited expense (${before.category}: ₹${before.amount} → ₹${patch.amount ?? before.amount})`
        : `Edited expense ${id}`,
      before: before
        ? { category: before.category, amount: before.amount, date: before.date, mode: before.mode, paidTo: before.paidTo || "" }
        : null,
      after: before
        ? {
            category: patch.category ?? before.category,
            amount: patch.amount ?? before.amount,
            date: patch.date ?? before.date,
            mode: patch.mode ?? before.mode,
            paidTo: patch.paidTo ?? before.paidTo ?? "",
          }
        : (patch as Record<string, unknown>),
    });
  };

  const deleteExpenseAudited: LedgerContextType["deleteExpense"] = (id, rectificationReason) => {
    const before = expensesApi.expenses.find((e) => e.id === id);
    expensesApi.deleteExpense(id, rectificationReason);
    if (before) {
      activityLogApi.recordActivity({
        entityType: "expense",
        entityId: id,
        entityLabel: `${before.paidTo || before.category} · ₹${before.amount}`,
        action: "delete",
        reason: rectificationReason,
        summary: `Deleted ${before.category} expense of ₹${before.amount} (${before.date})`,
        before: { category: before.category, amount: before.amount, date: before.date, mode: before.mode, paidTo: before.paidTo || "" },
        after: null,
      });
    }
  };

  const updateCustomerAudited: LedgerContextType["updateCustomer"] = (cust, syncLinked, prevIdentity) => {
    const before = customerPayments.customers.find((c) => c.id === cust.id);
    const updated = customerPayments.updateCustomer(cust, syncLinked, prevIdentity);
    activityLogApi.recordActivity({
      entityType: "customer",
      entityId: updated.id,
      entityLabel: updated.name,
      action: "edit",
      summary: `Edited party profile: ${updated.name}`,
      before: before ? { name: before.name, phone: before.phone, openingBalance: before.openingBalance ?? 0, creditLimit: before.creditLimit ?? 0 } : null,
      after: { name: updated.name, phone: updated.phone, openingBalance: updated.openingBalance ?? 0, creditLimit: updated.creditLimit ?? 0 },
    });
    return updated;
  };

  const deleteCustomerAudited: LedgerContextType["deleteCustomer"] = (id, reason, opts) => {
    const before = customerPayments.customers.find((c) => c.id === id);
    customerPayments.deleteCustomer(id, reason, opts);
    if (before) {
      activityLogApi.recordActivity({
        entityType: "customer",
        entityId: id,
        entityLabel: before.name,
        action: "delete",
        reason,
        summary: `Deleted customer ${before.name}${opts?.removePayments ? " (with linked payments)" : ""}`,
        before: { name: before.name, phone: before.phone, openingBalance: before.openingBalance ?? 0 },
        after: null,
      });
    }
  };

  const updateProductFieldsAudited: LedgerContextType["updateProductFields"] = (id, patch) => {
    const before = products.find((p) => p.id === id);
    catalogPromoActions.updateProductFields(id, patch);
    if (before) {
      activityLogApi.recordActivity({
        entityType: "product",
        entityId: id,
        entityLabel: patch.name || before.name,
        action: "edit",
        summary: `Updated product ${before.name}`,
        before: { name: before.name, wholesale: before.wholesale, retail: before.retail, cost: before.cost, gstRate: before.gstRate ?? 0.18 },
        after: {
          name: patch.name ?? before.name,
          wholesale: patch.wholesale ?? before.wholesale,
          retail: patch.retail ?? before.retail,
          cost: patch.cost ?? before.cost,
          gstRate: patch.gstRate ?? before.gstRate ?? 0.18,
        },
      });
    }
  };

  const deleteProductAudited: LedgerContextType["deleteProduct"] = (id, reason) => {
    const before = products.find((p) => p.id === id);
    catalogPromoActions.deleteProduct(id);
    if (before) {
      activityLogApi.recordActivity({
        entityType: "product",
        entityId: id,
        entityLabel: before.name,
        action: "delete",
        reason,
        summary: `Deleted product ${before.name} (Wholesale ₹${before.wholesale})`,
        before: { name: before.name, sku: before.sku || "", wholesale: before.wholesale, retail: before.retail },
        after: null,
      });
    }
  };

  const deleteBatchAudited: LedgerContextType["deleteBatch"] = (id, reason) => {
    const before = inventoryBatches.find((b) => b.id === id);
    grnWarehouseActions.deleteBatch(id);
    if (before) {
      const pName = products.find((p) => p.id === before.productId)?.name || `Product #${before.productId}`;
      activityLogApi.recordActivity({
        entityType: "batch",
        entityId: id,
        entityLabel: `${pName} · ${before.batchNumber || "Batch"}`,
        action: "delete",
        reason,
        summary: `Deleted stock batch ${before.batchNumber || id} (${pName} · ${before.quantity} cs)`,
        before: { productId: before.productId, batchNumber: before.batchNumber, quantity: before.quantity, expiryDate: before.expiryDate },
        after: null,
      });
    }
  };

  const deleteWarehouseAudited: LedgerContextType["deleteWarehouse"] = (id, reason) => {
    const before = warehouses.find((w) => w.id === id);
    grnWarehouseActions.deleteWarehouse(id);
    if (before) {
      activityLogApi.recordActivity({
        entityType: "warehouse",
        entityId: id,
        entityLabel: before.name,
        action: "delete",
        reason,
        summary: `Deleted warehouse ${before.name}`,
        before: { name: before.name, location: before.location || "" },
        after: null,
      });
    }
  };

  const updatePromotionAudited: LedgerContextType["updatePromotion"] = (id, promo, reason) => {
    const before = promotions.find((p) => p.id === id);
    catalogPromoActions.updatePromotion(id, promo);
    activityLogApi.recordActivity({
      entityType: "promotion",
      entityId: id,
      entityLabel: promo.name,
      action: "edit",
      reason,
      summary: `Edited promotion "${promo.name}" (${promo.type})`,
      before: before ? { name: before.name, type: before.type, isActive: before.isActive ?? true } : null,
      after: { name: promo.name, type: promo.type, isActive: promo.isActive ?? true },
    });
  };

  const deletePromotionAudited: LedgerContextType["deletePromotion"] = (id, reason) => {
    const before = promotions.find((p) => p.id === id);
    catalogPromoActions.deletePromotion(id);
    if (before) {
      activityLogApi.recordActivity({
        entityType: "promotion",
        entityId: id,
        entityLabel: before.name,
        action: "delete",
        reason,
        summary: `Deleted promotion "${before.name}"`,
        before: { name: before.name, type: before.type },
        after: null,
      });
    }
  };

  const updateSupplierSchemeAudited: LedgerContextType["updateSupplierScheme"] = (id, updates, reason) => {
    const before = supplierSchemes.find((s) => s.id === id);
    supplierDispositionsActions.updateSupplierScheme(id, updates);
    activityLogApi.recordActivity({
      entityType: "supplierScheme",
      entityId: id,
      entityLabel: updates.name || before?.name || id,
      action: "edit",
      reason,
      summary: `Edited supplier scheme "${updates.name || before?.name || id}"`,
      before: before ? { name: before.name, active: before.active, supplierName: before.supplierName } : null,
      after: before ? { name: updates.name ?? before.name, active: updates.active ?? before.active, supplierName: updates.supplierName ?? before.supplierName } : (updates as Record<string, unknown>),
    });
  };

  const deleteSupplierSchemeAudited: LedgerContextType["deleteSupplierScheme"] = (id, reason) => {
    const before = supplierSchemes.find((s) => s.id === id);
    supplierDispositionsActions.deleteSupplierScheme(id);
    if (before) {
      activityLogApi.recordActivity({
        entityType: "supplierScheme",
        entityId: id,
        entityLabel: before.name,
        action: "delete",
        reason,
        summary: `Deleted supplier scheme "${before.name}"`,
        before: { name: before.name, supplierName: before.supplierName },
        after: null,
      });
    }
  };

  const deleteSupplierCreditNoteAudited: LedgerContextType["deleteSupplierCreditNote"] = (id, reason) => {
    const before = supplierCreditNotes.find((n) => n.id === id);
    supplierDispositionsActions.deleteSupplierCreditNote(id);
    if (before) {
      activityLogApi.recordActivity({
        entityType: "creditNote",
        entityId: id,
        entityLabel: `${before.creditNoteNumber || before.supplierName} · ₹${before.expectedAmount}`,
        action: "delete",
        reason,
        summary: `Deleted supplier credit note (${before.supplierName} · ₹${before.expectedAmount})`,
        before: { supplierName: before.supplierName, expectedAmount: before.expectedAmount, actualAmount: before.actualAmount, status: before.status },
        after: null,
      });
    }
  };

  const deleteAuditAudited: LedgerContextType["deleteAudit"] = (id, reason) => {
    const before = audits.find((a) => a.id === id);
    auditActions.deleteAudit(id);
    if (before) {
      activityLogApi.recordActivity({
        entityType: "audit",
        entityId: id,
        entityLabel: `Stock Audit · ${before.date}`,
        action: "delete",
        reason,
        summary: `Deleted stock audit from ${before.date} (${before.entries?.length || 0} SKUs)`,
        before: { date: before.date, adjusted: before.adjusted, entryCount: before.entries?.length || 0 },
        after: null,
      });
    }
  };

  const deleteAuditSessionAudited: LedgerContextType["deleteAuditSession"] = (id, reason) => {
    const before = auditSessions.find((s) => s.id === id);
    auditActions.deleteAuditSession(id);
    if (before) {
      activityLogApi.recordActivity({
        entityType: "audit",
        entityId: id,
        entityLabel: `Reconciliation · ${before.date}`,
        action: "delete",
        reason,
        summary: `Deleted reconciliation session (${before.date}${before.warehouseName ? ` · ${before.warehouseName}` : ""})`,
        before: { date: before.date, warehouseName: before.warehouseName || "", auditorName: before.auditorName },
        after: null,
      });
    }
  };

  const updateBillingSettingsAudited: LedgerContextType["updateBillingSettings"] = async (s) => {
    const before = { ...billingSettings };
    const res = await cloudSync.updateBillingSettings(s);
    if (res.success) {
      activityLogApi.recordActivity({
        entityType: "settings",
        entityId: "billing_settings",
        entityLabel: "Billing Settings",
        action: "edit",
        summary: `Updated billing configuration`,
        before: before as unknown as Record<string, unknown>,
        after: { ...before, ...s } as unknown as Record<string, unknown>,
      });
    }
    return res;
  };

  const syncToCloudAudited: LedgerContextType["syncToCloud"] = async (opts) => {
    const res = await cloudSync.syncToCloud(opts);
    await activityLogApi.flushActivityLogs();
    return res;
  };

  const pullFromCloudAudited: LedgerContextType["pullFromCloud"] = async (opts) => {
    const res = await cloudSync.pullFromCloud(opts);
    await activityLogApi.pullActivityLogs();
    return res;
  };

  return (
    <LedgerContext.Provider
      value={{
        tab,
        setTab,
        grns,
        setGrns,
        postGrn: postGrnAudited,
        updateGrn: updateGrnAudited,
        deleteGrn: deleteGrnAudited,
        activeGrnToEdit,
        setActiveGrnToEdit,
        loadSampleGrn,
        products,
        setProducts,
        addProduct: catalogPromoActions.addProduct,
        updateProductField: catalogPromoActions.updateProductField,
        updateProductFields: updateProductFieldsAudited,
        bulkSetProductTaxability: catalogPromoActions.bulkSetProductTaxability,
        deleteProduct: deleteProductAudited,
        applyBulkImport: catalogPromoActions.applyBulkImport,
        receiveInwardStock: catalogPromoActions.receiveInwardStock,
        productWarehouseStock: derivedStock.productWarehouseStock,
        oversoldReport: derivedStock.oversoldReport,
        reassignBillsProductWarehouse:
          billingActions.reassignBillsProductWarehouse,
        undoLastOversoldReassign: billingActions.undoLastOversoldReassign,
        hasOversoldReassignUndo: billingActions.hasOversoldReassignUndo,
        productBatchLines: derivedStock.productBatchLines,
        productInWarehouse: derivedStock.productInWarehouse,
        warehouses,
        setWarehouses,
        addWarehouse: grnWarehouseActions.addWarehouse,
        updateWarehouse: grnWarehouseActions.updateWarehouse,
        deleteWarehouse: deleteWarehouseAudited,
        defaultWarehouse,
        inventoryBatches,
        setInventoryBatches,
        addBatch: grnWarehouseActions.addBatch,
        updateBatch: grnWarehouseActions.updateBatch,
        deleteBatch: deleteBatchAudited,
        batchesForProduct: grnWarehouseActions.batchesForProduct,
        warehouseStock: derivedStock.warehouseStock,
        stockTransfers,
        addStockTransfer: grnWarehouseActions.addStockTransfer,
        promotions,
        setPromotions,
        addPromotion: catalogPromoActions.addPromotion,
        updatePromotion: updatePromotionAudited,
        deletePromotion: deletePromotionAudited,
        supplierSchemes,
        addSupplierScheme: supplierDispositionsActions.addSupplierScheme,
        updateSupplierScheme: updateSupplierSchemeAudited,
        deleteSupplierScheme: deleteSupplierSchemeAudited,
        supplierSchemeApplications,
        addSupplierSchemeApplication:
          supplierDispositionsActions.addSupplierSchemeApplication,
        supplierCreditNotes,
        addSupplierCreditNote:
          supplierDispositionsActions.addSupplierCreditNote,
        updateSupplierCreditNote:
          supplierDispositionsActions.updateSupplierCreditNote,
        deleteSupplierCreditNote: deleteSupplierCreditNoteAudited,
        recordSupplierCreditNoteReceipt:
          supplierDispositionsActions.recordSupplierCreditNoteReceipt,
        inventoryDispositions,
        expenses: expensesApi.expenses,
        addExpense: expensesApi.addExpense,
        updateExpense: updateExpenseAudited,
        deleteExpense: deleteExpenseAudited,
        addInventoryDisposition:
          supplierDispositionsActions.addInventoryDisposition,
        updateInventoryDisposition:
          supplierDispositionsActions.updateInventoryDisposition,
        deleteInventoryDisposition:
          supplierDispositionsActions.deleteInventoryDisposition,
        recordDispositionCompensation:
          supplierDispositionsActions.recordDispositionCompensation,
        auditSessions,
        createAuditSession: auditActions.createAuditSession,
        deleteAuditSession: deleteAuditSessionAudited,
        updateAuditSession: auditActions.updateAuditSession,
        saveAuditSessionCounts: auditActions.saveAuditSessionCounts,
        confirmSwap: auditActions.confirmSwap,
        rejectSuggestion: auditActions.rejectSuggestion,
        keepAsSeparateVariance: auditActions.keepAsSeparateVariance,
        markUnderInvestigation: auditActions.markUnderInvestigation,
        selectInvestigationReason: auditActions.selectInvestigationReason,
        approveReconciliation: auditActions.approveReconciliation,
        reconciliationTransactions,
        stockLedgerEntries,
        bills,
        getBillById,
        cart,
        setCart,
        editingBillId,
        justFinalizedBillId,
        setJustFinalizedBillId,
        justFinalizedSplitIds,
        setJustFinalizedSplitIds,
        startEditBill: billingActions.startEditBill,
        cancelEditBill: billingActions.cancelEditBill,
        finalizeBill: finalizeBillAudited,
        finalizeSplitBills: billingActions.finalizeSplitBills,
        updateBill: updateBillAudited,
        splitMixedBill: billingActions.splitMixedBill,
        repairBillTotals: billingActions.repairBillTotals,
        repairNonGstBillTaxes: billingActions.repairNonGstBillTaxes,
        convertBillsToTaxInvoices: billingActions.convertBillsToTaxInvoices,
        repairEstimatedBillCosts: billingActions.repairEstimatedBillCosts,
        restoreCrossWarehouseAllocations:
          billingActions.restoreCrossWarehouseAllocations,
        repairMissingBillPayments: billingActions.repairMissingBillPayments,
        reassignBillDocNumber: billingActions.reassignBillDocNumber,
        recordMissingSeriesAsCancelled:
          billingActions.recordMissingSeriesAsCancelled,
        previewBillEdit: billingActions.previewBillEdit,
        previewBillDelete: billingActions.previewBillDelete,
        recordPayment: customerPayments.recordPayment,
        deleteBill: deleteBillAudited,
        cancelBill: cancelBillAudited,
        createSalesReturn: billingActions.createSalesReturn,
        cancelSalesReturn: billingActions.cancelSalesReturn,
        editSalesReturn: billingActions.editSalesReturn,
        cancelledBills,
        notice,
        notify,
        dismissNotice,
        syncBillsToCloud: cloudSync.syncBillsToCloud,
        customProductPrices,
        customerProductPrices,
        getPreviousCustomPrice,
        setCustomProductPrice,
        payments: customerPayments.payments,
        setPayments: customerPayments.setPayments,
        recordCustomerPayment: recordCustomerPaymentAudited,
        repairPaymentLinks: customerPayments.repairPaymentLinks,
        deletePayment: deletePaymentAudited,
        updatePayment: updatePaymentAudited,
        paymentAudit: customerPayments.paymentAudit,
        getCustomerCreditSummary: customerPayments.getCustomerCreditSummary,
        applyAdvanceToInvoices: customerPayments.applyAdvanceToInvoices,
        recordCustomerRefund: customerPayments.recordCustomerRefund,
        customers: customerPayments.customers,
        setCustomers: customerPayments.setCustomers,
        addCustomer: customerPayments.addCustomer,
        updateCustomer: updateCustomerAudited,
        customerNameClash: customerPayments.customerNameClash,
        findBillingCustomer: customerPayments.findBillingCustomer,
        deleteCustomer: deleteCustomerAudited,
        existingCustomers: customerPayments.existingCustomers,
        startBillForCustomer: customerPayments.startBillForCustomer,
        getCustomerLedger: customerPayments.getCustomerLedger,
        trips,
        addTrip: addTripAudited,
        toggleBillAssignment: tripActions.toggleBillAssignment,
        unassignBillFromTrip: tripActions.unassignBillFromTrip,
        autoAssignTripBills: tripActions.autoAssignTripBills,
        saveReturn: tripActions.saveReturn,
        reopenTrip: reopenTripAudited,
        saveReturnDraft: tripActions.saveReturnDraft,
        recordTripCashRecovery: tripActions.recordTripCashRecovery,
        writeOffTripCashShort: tripActions.writeOffTripCashShort,
        updateTrip: updateTripAudited,
        deleteTrip: deleteTripAudited,
        syncTripsToCloud: cloudSync.syncTripsToCloud,
        audits,
        saveAudit: auditActions.saveAudit,
        saveBatchAudit: auditActions.saveBatchAudit,
        deleteAudit: deleteAuditAudited,
        gstMode,
        setGstMode,
        fontSize: prefs.fontSize,
        setFontSize: prefs.setFontSize,
        highContrast: prefs.highContrast,
        setHighContrast: prefs.setHighContrast,
        lowVisionMode: prefs.lowVisionMode,
        setLowVisionMode: prefs.setLowVisionMode,
        toggleLowVisionMode: prefs.toggleLowVisionMode,
        lowVisionStickyPosition: prefs.lowVisionStickyPosition,
        setLowVisionStickyPosition: prefs.setLowVisionStickyPosition,
        scale: prefs.scale,
        palette: prefs.palette,
        fz: prefs.fz,
        orgProfile,
        setOrgProfile,
        updateOrgProfile: cloudSync.updateOrgProfile,
        pullOrgProfileFromCloud: cloudSync.pullOrgProfileFromCloud,
        billingSettings,
        setBillingSettings,
        updateBillingSettings: updateBillingSettingsAudited,
        pullBillingSettingsFromCloud: cloudSync.pullBillingSettingsFromCloud,
        loadDemoPreset: dataManagement.loadDemoPreset,
        exportBackup: dataManagement.exportBackup,
        importBackup: dataManagement.importBackup,
        clearTransactions: dataManagement.clearTransactions,
        clearAllData: dataManagement.clearAllData,
        soldByProduct: derivedStock.soldByProduct,
        remainingStock: derivedStock.remainingStock,
        bookStock: derivedStock.bookStock,
        stockAsOf: derivedStock.stockAsOf,
        activePromoFor: derivedStock.activePromoFor,
        tripBreakdown: derivedStock.tripBreakdown,
        getVehicleStock: derivedStock.getVehicleStock,
        totalOpening: derivedStock.totalOpening,
        totalRemaining: derivedStock.totalRemaining,
        totalRevenue: derivedStock.totalRevenue,
        totalCasesSold: derivedStock.totalCasesSold,
        totalOutstanding: derivedStock.totalOutstanding,
        tripsWithDiscrepancy: derivedStock.tripsWithDiscrepancy,
        supabaseConfig: cloudSync.supabaseConfig,
        supabaseStatus: cloudSync.supabaseStatus,
        checkSupabaseConnection: cloudSync.checkSupabaseConnection,
        syncToCloud: syncToCloudAudited,
        pullFromCloud: pullFromCloudAudited,
        saveCustomSupabaseCredentials: cloudSync.saveCustomSupabaseCredentials,
        clearCustomSupabaseCredentials:
          cloudSync.clearCustomSupabaseCredentials,
        resetToDefault: dataManagement.resetToDefault,
        cleanDatabase: dataManagement.cleanDatabase,
        deleteLocalDatabase: dataManagement.deleteLocalDatabase,
        salesmen: auth.salesmen,
        currentUser: auth.currentUser,
        currentRole: auth.currentRole,
        activeSalesman: auth.activeSalesman,
        loginAdmin: auth.loginAdmin,
        loginSalesman: auth.loginSalesman,
        logout: auth.logout,
        addSalesman: auth.addSalesman,
        updateSalesman: auth.updateSalesman,
        toggleSalesmanActive: auth.toggleSalesmanActive,
        deleteSalesman: auth.deleteSalesman,
        activityLogs: activityLogApi.activityLogs,
        mergedActivityLogs: activityLogApi.mergedActivityLogs,
        recordActivity: activityLogApi.recordActivity,
        pullActivityLogs: activityLogApi.pullActivityLogs,
        flushActivityLogs: activityLogApi.flushActivityLogs,
        pendingCanonicalAction,
        openCanonicalAction,
        clearPendingCanonicalAction,
        returnFromCanonicalAction,
      }}
    >
      {children}
    </LedgerContext.Provider>
  );
};

export function useLedger(): LedgerContextType {
  const ctx = useContext(LedgerContext);
  if (!ctx) throw new Error("useLedger must be used within a LedgerProvider");
  return ctx;
}
