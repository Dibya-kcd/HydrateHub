import { isNewerPayment } from "../../utils/paymentStamp";
import React, { useEffect, useRef, useState } from "react";
import { DEFAULT_BILLING_SETTINGS } from "../../constants/initialData";
import { openSyncEventStream } from "../../lib/authFetch";
import {
  clearSupabaseCustomConfig,
  getSupabaseClient,
  getSupabaseConfig,
  isServerProxyMode,
  probeCloudChanges,
  pullBillingSettingsFromSupabase,
  pullDeletionLogFromSupabase,
  pullLedgerFromSupabase,
  pullOrgProfileFromSupabase,
  pullTombstonesFromSupabase,
  pushBillToSupabase,
  pushOrgProfileToSupabase,
  pushLedgerToSupabase,
  pushTripToSupabase,
  resetCloudReadCaches,
  saveSupabaseCustomConfig,
  testSupabaseConnection,
  type SupabaseConfig,
} from "../../lib/supabase";
import { holdSyncSignal, releaseSyncSignal, startSyncSignal } from "../../lib/syncSignal";
import { costBasisFor } from "../../tax/purchaseCost";
import type {
  Audit,
  AuditSession,
  AuthUser,
  Bill,
  BillingSettings,
  Customer,
  GRN,
  InventoryBatch,
  InventoryDisposition,
  OrganizationProfile,
  PaymentAuditEntry,
  PaymentRecord,
  Product,
  Promotion,
  ReconciliationTransaction,
  Salesman,
  StockLedgerEntry,
  StockTransfer,
  SupplierCreditNote,
  SupplierScheme,
  SupplierSchemeApplication,
  Trip,
  UserRole,
  Warehouse,
} from "../../types";
import { keepLocalProductFields } from "../../utils/billExtra";
import { generateBatchNumber, generateSkuId, normalizeTrip, productTaxFields, resolveItemLandedCrateCost } from "../../utils/billing";
import {
  cacheBillingSettingsLocally,
  loadAuditSessions,
  loadCachedBillingSettings,
  loadCustomers,
  loadGrns,
  loadInventory,
  loadInventoryBatches,
  loadInventoryDispositions,
  loadOrders,
  loadProducts,
  loadReconciliationTransactions,
  loadSchemes,
  loadStockLedgerEntries,
  loadSupplierCreditNotes,
  loadSupplierSchemeApplications,
  loadSupplierSchemes,
  loadTrips,
  loadWarehouses,
  saveAuditSessions,
  saveDailyVehicleTrip,
  saveGrns,
  saveInventory,
  saveInventoryBatches,
  saveInventoryDispositions,
  saveOrders,
  saveOrgProfile,
  saveProducts,
  saveReconciliationTransactions,
  saveSchemes,
  saveStockLedgerEntries,
  saveSupplierCreditNotes,
  saveSupplierSchemes,
  saveTrips,
  saveWarehouses,
  saveBillingSettings,
  type InventoryItem,
} from "../../utils/storage";
import { fetchInventoryDispositionsFromSupabase } from "../../lib/supabase";
import {
  canCheckNow,
  createGateState,
  decideAutoPull,
  EVENT_DEBOUNCE_MS,
  MIN_CHECK_GAP_MS,
  noteDecision,
  POLL_INTERVAL_MS,
  SETTLE_MS,
} from "../../utils/syncGate";
import { flushBackupCopies, scheduleBackupCopy } from "../ledgerBackupQueue";
import {
  STORAGE_KEY,
  addBillTombstones,
  buildCatalogFromGrns,
  cloud,
  dedupeSameShopCustomers,
  ensureUniqueGrnNumbers,
  mergeBillsPreservingCollisions,
  mergeCustomersNewestWins,
  newerProduct,
  normCustName,
  pickNewerTrip,
  productStampMs,
  purgeLegacyLocalStorageKeys,
  readBillTombstones,
  readDispositionTombstones,
  readHeldNumbers,
  refillDocReservation,
  releaseDocReservations,
  withoutDeletedBills,
  withoutDeletedCustomers,
  withoutDeletedPayments,
  normalizePromotion,
} from "../ledgerHelpers";
import type { PullFromCloudOptions } from "../ledgerTypes";

// One gate for the whole browser tab (the provider is mounted once). See src/utils/syncGate.ts.
const cloudSyncGate = createGateState();
let cloudPullInFlight: {
  promise: Promise<{ success: boolean; message: string }>;
  auto: boolean;
  startedAt: number;
} | null = null;

export interface UseCloudSyncParams {
  currentUser?: AuthUser | null;
  currentRole?: UserRole | null;
  warehouses: Warehouse[];
  setWarehouses: React.Dispatch<React.SetStateAction<Warehouse[]>>;
  products: Product[];
  productsRef: React.MutableRefObject<Product[]>;
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  inventoryBatches: InventoryBatch[];
  setInventoryBatches: React.Dispatch<React.SetStateAction<InventoryBatch[]>>;
  grns: GRN[];
  setGrns: React.Dispatch<React.SetStateAction<GRN[]>>;
  payments: PaymentRecord[];
  setPayments: React.Dispatch<React.SetStateAction<PaymentRecord[]>>;
  setPaymentAudit: React.Dispatch<React.SetStateAction<PaymentAuditEntry[]>>;
  stockTransfers: StockTransfer[];
  setStockTransfers: React.Dispatch<React.SetStateAction<StockTransfer[]>>;
  promotions: Promotion[];
  setPromotions: React.Dispatch<React.SetStateAction<Promotion[]>>;
  allBills: Bill[];
  allBillsRef: React.MutableRefObject<Bill[]>;
  setBillsRaw: React.Dispatch<React.SetStateAction<Bill[]>>;
  trips: Trip[];
  setTrips: (u: Trip[] | ((prev: Trip[]) => Trip[])) => void;
  setTripsRaw: React.Dispatch<React.SetStateAction<Trip[]>>;
  audits: Audit[];
  setAudits: React.Dispatch<React.SetStateAction<Audit[]>>;
  orgProfile: OrganizationProfile;
  setOrgProfile: React.Dispatch<React.SetStateAction<OrganizationProfile>>;
  billingSettings: BillingSettings;
  billingSettingsRef: React.MutableRefObject<BillingSettings | null>;
  setBillingSettings: React.Dispatch<React.SetStateAction<BillingSettings>>;
  salesmen: Salesman[];
  setSalesmen: React.Dispatch<React.SetStateAction<Salesman[]>>;
  supplierSchemes: SupplierScheme[];
  setSupplierSchemes: React.Dispatch<React.SetStateAction<SupplierScheme[]>>;
  supplierSchemeApplications: SupplierSchemeApplication[];
  setSupplierSchemeApplications: React.Dispatch<React.SetStateAction<SupplierSchemeApplication[]>>;
  supplierCreditNotes: SupplierCreditNote[];
  setSupplierCreditNotes: React.Dispatch<React.SetStateAction<SupplierCreditNote[]>>;
  inventoryDispositions: InventoryDisposition[];
  setInventoryDispositions: React.Dispatch<React.SetStateAction<InventoryDisposition[]>>;
  auditSessions: AuditSession[];
  setAuditSessions: React.Dispatch<React.SetStateAction<AuditSession[]>>;
  reconciliationTransactions: ReconciliationTransaction[];
  setReconciliationTransactions: React.Dispatch<React.SetStateAction<ReconciliationTransaction[]>>;
  stockLedgerEntries: StockLedgerEntry[];
  setStockLedgerEntries: React.Dispatch<React.SetStateAction<StockLedgerEntry[]>>;
  customersRef: React.MutableRefObject<Customer[]>;
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  syncDeletionLog: () => Promise<Awaited<ReturnType<typeof pullDeletionLogFromSupabase>>>;
  refreshExpensesFromCloud: () => Promise<void>;
  reconcilePaymentsFromBills: (currentPayments: PaymentRecord[], billsList: Bill[]) => PaymentRecord[];
  productDeletionKey: (p: { id: number; name?: string }) => string;
}

export function useCloudSync({
  currentUser = null,
  currentRole = null,
  warehouses,
  setWarehouses,
  products,
  productsRef,
  setProducts,
  inventoryBatches,
  setInventoryBatches,
  grns,
  setGrns,
  payments,
  setPayments,
  setPaymentAudit,
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
  salesmen,
  setSalesmen,
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
  customersRef,
  setCustomers,
  syncDeletionLog,
  refreshExpensesFromCloud,
  reconcilePaymentsFromBills,
  productDeletionKey,
}: UseCloudSyncParams) {
  const [supabaseConfig, setSupabaseConfigState] =
    useState<SupabaseConfig>(getSupabaseConfig);
  const [supabaseStatus, setSupabaseStatus] = useState({
    isConnected: false,
    isChecking: false,
    latencyMs: 0,
    allTablesExist: false,
    lastSyncedAt: null as string | null,
    message: "Testing Supabase database connection...",
    error: undefined as string | undefined,
  });

  const isInitialMountRef = useRef(true);
  const deadTripIdsRef = useRef<Set<number>>(new Set());

  const checkSupabaseConnection = async () => {
    setSupabaseStatus((prev) => ({ ...prev, isChecking: true }));
    try {
      const result = await testSupabaseConnection();
      setSupabaseStatus({
        isConnected: result.connected,
        isChecking: false,
        latencyMs: result.latencyMs,
        allTablesExist: result.allTablesExist,
        lastSyncedAt: null,
        message: result.message,
        error: result.error,
      });
    } catch (err: any) {
      setSupabaseStatus({
        isConnected: false,
        isChecking: false,
        latencyMs: 0,
        allTablesExist: false,
        lastSyncedAt: null,
        message: "Could not connect to Supabase endpoint.",
        error: err?.message || String(err),
      });
    }
  };

  useEffect(() => {
    if (isServerProxyMode()) {
      if (!currentUser || currentRole === "salesman") return;
    }
    checkSupabaseConnection();
  }, [currentUser?.id, currentRole]);

  const syncToCloud = async (opts?: { full?: boolean }): Promise<{
    success: boolean;
    message: string;
  }> => {
    try {
      const res = await pushLedgerToSupabase({
        warehouses,
        products,
        inventoryBatches,
        grns,
        payments,
        stockTransfers,
        promotions,
        bills: allBills,
        trips,
        audits,
        orgProfile,
        billingSettings,
        salesmen,
        supplierSchemes,
        supplierSchemeApplications,
        supplierCreditNotes,
      }, { full: opts?.full === true });
      const nowStr = new Date().toLocaleTimeString();
      setSupabaseStatus((prev) => ({
        ...prev,
        isConnected: true,
        lastSyncedAt: nowStr,
        message: `Successfully synchronized ${res.pushedCount?.products ?? 0} products, ${res.pushedCount?.grns ?? 0} invoices, ${res.pushedCount?.payments ?? 0} payments, ${res.pushedCount?.bills ?? 0} bills to Supabase.`,
      }));
      return {
        success: true,
        message: `Synchronized to Supabase (${res.pushedCount?.products ?? 0} products, ${res.pushedCount?.grns ?? 0} invoices, ${res.pushedCount?.payments ?? 0} payments, ${res.pushedCount?.bills ?? 0} bills).`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || "Failed to sync with Supabase database.",
      };
    }
  };

  // Saving is held back until the first cloud pull is done.
  useEffect(() => {
    const t = setTimeout(() => {
      isInitialMountRef.current = false;
    }, 20000);
    return () => clearTimeout(t);
  }, []);

  // Doc reservations for invoice, trip, product, promotion, audit numbers
  useEffect(() => {
    const highest = allBills.length ? Math.max(...allBills.map((b) => b.id)) : 100;
    if ((Number(readHeldNumbers()["bill"]) || 0) <= highest) {
      void refillDocReservation("bill", highest);
    }
  }, [allBills.length]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onHide = () => releaseDocReservations();
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        const highest = allBillsRef.current.length ? Math.max(...allBillsRef.current.map((b) => b.id)) : 100;
        void refillDocReservation("bill", highest);
      }
    };
    window.addEventListener("pagehide", onHide);
    window.addEventListener("pageshow", onShow);
    return () => {
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("pageshow", onShow);
    };
  }, []);

  useEffect(() => {
    const highest = Math.max(
      0,
      ...trips.map((t) => Number(t.id) || 0),
      ...Array.from(deadTripIdsRef.current),
    );
    if ((Number(readHeldNumbers()["trip"]) || 0) <= highest) {
      void refillDocReservation("trip", highest);
    }
  }, [trips.length]);

  useEffect(() => {
    const seqs: [string, number][] = [
      ["product", Math.max(0, ...products.map((p) => Number(p.id) || 0))],
      ["promotion", Math.max(0, ...promotions.map((p) => Number(p.id) || 0))],
    ];
    const held = readHeldNumbers();
    for (const [seq, highest] of seqs) {
      if ((Number(held[seq]) || 0) <= highest) void refillDocReservation(seq, highest);
    }
  }, [products.length, promotions.length]);

  useEffect(() => {
    const highest = Math.max(0, ...audits.map((a) => Number(a.id) || 0));
    if ((Number(readHeldNumbers()["audit"]) || 0) <= highest) {
      void refillDocReservation("audit", highest);
    }
  }, [audits.length]);

  const pullFromCloudFull = async (): Promise<{
    success: boolean;
    message: string;
  }> => {
    try {
      const delLog = await syncDeletionLog().catch(
        () => [] as Awaited<ReturnType<typeof pullDeletionLogFromSupabase>>,
      );

      const remote = await pullLedgerFromSupabase().catch(() => null);

      let [
        serverOrders,
        serverWarehouses,
        serverSchemes,
        _serverInventory,
        serverProducts,
        serverBatches,
        serverTrips,
        serverGrns,
      ] = await Promise.all([
        loadOrders().catch(() => []),
        loadWarehouses().catch(() => []),
        loadSchemes().catch(() => []),
        loadInventory().catch(() => []),
        loadProducts().catch(() => []),
        loadInventoryBatches().catch(() => []),
        loadTrips().catch(() => []),
        loadGrns().catch(() => []),
      ]);

      const dead = await pullTombstonesFromSupabase().catch(() => null);
      if (dead) {
        const deadBillNums = Array.from(dead.bills)
          .map(Number)
          .filter((n) => Number.isFinite(n) && n > 0);
        if (deadBillNums.length > 0) addBillTombstones(deadBillNums);
        dead.trips.forEach((x: any) => {
          const n = Number(x);
          if (Number.isFinite(n) && n > 0) deadTripIdsRef.current.add(n);
        });
        const localDeadBills = readBillTombstones();
        const liveBill = (b: any) =>
          b?.status === "cancelled" ||
          Boolean(b?.cancellation) ||
          (!dead.bills.has(String(b?.id)) && !localDeadBills.has(Number(b?.id)));
        const liveGrn = (g: any) => !dead.grns.has(String(g?.id));
        const liveTrip = (t: any) => t?.status === "out" || !dead.trips.has(String(t?.id));
        if (remote) {
          if (remote.bills) remote.bills = remote.bills.filter(liveBill);
          if (remote.grns) remote.grns = remote.grns.filter(liveGrn);
          if (remote.trips) remote.trips = remote.trips.filter(liveTrip);
        }
        serverOrders = (serverOrders as any[]).filter(liveBill) as typeof serverOrders;
        serverGrns = (serverGrns as any[]).filter(liveGrn) as typeof serverGrns;
        serverTrips = (serverTrips as any[]).filter(liveTrip) as typeof serverTrips;
        setBillsRaw((prev) => (prev.some((b) => !liveBill(b)) ? prev.filter(liveBill) : prev));
        setTrips((prev) => (prev.some((t) => !liveTrip(t)) ? prev.filter(liveTrip) : prev));
        setGrns((prev) => (prev.some((g) => !liveGrn(g)) ? prev.filter(liveGrn) : prev));
      } else {
        const localDeadBills = readBillTombstones();
        if (localDeadBills.size > 0) {
          const liveLocal = (b: any) =>
            b?.status === "cancelled" || Boolean(b?.cancellation) || !localDeadBills.has(Number(b?.id));
          if (remote?.bills) remote.bills = remote.bills.filter(liveLocal);
          serverOrders = (serverOrders as any[]).filter(liveLocal) as typeof serverOrders;
          setBillsRaw((prev) => (prev.some((b) => !liveLocal(b)) ? prev.filter(liveLocal) : prev));
        }
      }

      const deadProductKeys = new Set(delLog.filter((r) => r.kind === "product").map((r) => r.id));
      const deadBatchIds = new Set(delLog.filter((r) => r.kind === "batch").map((r) => r.id));
      const deadWarehouseIds = new Set(delLog.filter((r) => r.kind === "warehouse").map((r) => r.id));
      const productAlive = (p: any) => !deadProductKeys.has(productDeletionKey(p));
      const batchAlive = (b: any) => !deadBatchIds.has(String(b?.id));
      const warehouseAlive = (w: any) => !deadWarehouseIds.has(String(w?.id));
      const deadPromotionIds = new Set(delLog.filter((r) => r.kind === "promotion").map((r) => r.id));
      const deadSalesmanIds = new Set(delLog.filter((r) => r.kind === "salesman").map((r) => r.id));
      const promotionAlive = (x: any) => !deadPromotionIds.has(String(x?.id));
      const salesmanAlive = (x: any) => !deadSalesmanIds.has(String(x?.id));
      if (deadPromotionIds.size || deadSalesmanIds.size) {
        if (remote) {
          if (remote.promotions) remote.promotions = (remote.promotions as any[]).filter(promotionAlive) as any;
          if (remote.salesmen) remote.salesmen = remote.salesmen.filter(salesmanAlive);
        }
        serverSchemes = (serverSchemes as any[]).filter(promotionAlive) as typeof serverSchemes;
        setPromotions((prev) => (prev.some((x) => !promotionAlive(x)) ? prev.filter(promotionAlive) : prev));
        setSalesmen((prev) => (prev.some((x) => !salesmanAlive(x)) ? prev.filter(salesmanAlive) : prev));
      }
      if (deadProductKeys.size || deadBatchIds.size || deadWarehouseIds.size) {
        if (remote) {
          if (remote.products) remote.products = remote.products.filter(productAlive);
          if (remote.inventoryBatches) remote.inventoryBatches = remote.inventoryBatches.filter(batchAlive);
          if (remote.warehouses) remote.warehouses = remote.warehouses.filter(warehouseAlive);
        }
        serverProducts = (serverProducts as any[]).filter(productAlive) as typeof serverProducts;
        serverBatches = (serverBatches as any[]).filter(batchAlive) as typeof serverBatches;
        serverWarehouses = (serverWarehouses as any[]).filter(warehouseAlive) as typeof serverWarehouses;
        setProducts((prev) => (prev.some((p) => !productAlive(p)) ? prev.filter(productAlive) : prev));
        setInventoryBatches((prev) => (prev.some((b) => !batchAlive(b)) ? prev.filter(batchAlive) : prev));
        setWarehouses((prev) => (prev.some((w) => !warehouseAlive(w)) ? prev.filter(warehouseAlive) : prev));
      }

      if (remote) {
        if (remote.warehouses && remote.warehouses.length > 0) {
          const incoming = remote.warehouses;
          setWarehouses((prev) => {
            const have = new Set(incoming.map((w: any) => String(w.id)));
            return [...incoming, ...prev.filter((w) => !have.has(String(w.id)) && warehouseAlive(w))];
          });
        } else if (serverWarehouses && serverWarehouses.length > 0) {
          setWarehouses(serverWarehouses as any);
        }

        const allFoundGrns = [
          ...(Array.isArray(remote.grns) ? remote.grns : []),
          ...(Array.isArray(serverGrns) ? serverGrns : []),
        ];

        if (allFoundGrns.length > 0) {
          const mergedGrns = ensureUniqueGrnNumbers(
            (() => {
              const map = new Map<string, GRN>();
              grns
                .filter((g) => !dead || !dead.grns.has(String(g.id)))
                .forEach((g) => map.set(g.id, g));
              allFoundGrns.forEach((g) => map.set(g.id, g));
              return Array.from(map.values());
            })(),
          );
          setGrns(mergedGrns);
          saveGrns(mergedGrns).catch(() => {});
          const { products: derivedProducts, batches: derivedBatches } =
            buildCatalogFromGrns(mergedGrns, remote.warehouses || warehouses, (d) => costBasisFor(orgProfile, d));
          const candidateProducts = (() => {
            const map = new Map<number, Product>();
            const nameMap = new Map<string, Product>();
            derivedProducts.forEach((p) => {
              map.set(p.id, p);
              nameMap.set(p.name.trim().toLowerCase(), p);
            });
            const sourceList = [
              ...(Array.isArray(serverProducts) ? serverProducts : []),
              ...(Array.isArray(remote.products) ? remote.products : []),
            ];
            sourceList.forEach((p: any) => {
              const d = map.get(p.id) || nameMap.get(String(p.name || '').trim().toLowerCase());
              const eff = (d?.effectiveCost && d.effectiveCost > 0)
                ? d.effectiveCost
                : Number(p.effectiveCost) || Number(p.cost) || d?.cost || 0;
              const landed = (d?.landedCostPerCrate && d.landedCostPerCrate > 0)
                ? d.landedCostPerCrate
                : (p.landedCostPerCrate && Number(p.landedCostPerCrate) > 0)
                  ? Number(p.landedCostPerCrate)
                  : resolveItemLandedCrateCost({ ...p, unitPrice: p.cost });
              const fromCloud = {
                ...p,
                name: String(p.name || '').trim().toUpperCase(),
                cost: d?.cost || p.cost,
                effectiveCost: eff,
                landedCostPerCrate: landed,
                ...productTaxFields(p),
              };
              const mine = productsRef.current.find((x) => x.id === p.id);
              map.set(
                p.id,
                keepLocalProductFields(
                  mine && productStampMs(mine) > productStampMs(p)
                    ? {
                        ...fromCloud,
                        ...mine,
                        cost: fromCloud.cost,
                        effectiveCost: fromCloud.effectiveCost,
                        landedCostPerCrate: fromCloud.landedCostPerCrate,
                      }
                    : fromCloud,
                  p,
                  mine,
                ),
              );
            });
            productsRef.current.forEach((p) => {
              if (productAlive(p) && !map.has(p.id)) map.set(p.id, p);
            });
            return Array.from(map.values()).map((p) => ({
              ...p,
              name: String(p.name || '').trim().toUpperCase(),
            }));
          })();
          if (candidateProducts.length > 0) {
            setProducts(candidateProducts);
            saveProducts(candidateProducts).catch(() => {});
          } else {
            setProducts(derivedProducts);
          }
          const resolvedBatches = (() => {
            const rawBatches =
              remote.inventoryBatches && remote.inventoryBatches.length > 0
                ? remote.inventoryBatches
                : serverBatches && serverBatches.length > 0
                  ? (serverBatches as any)
                  : derivedBatches;
            const cloudGrnIds = new Set(allFoundGrns.map((g: any) => String(g.id)));
            const localOnlyGrnIds = mergedGrns.map((g) => String(g.id)).filter((id) => !cloudGrnIds.has(id));
            const haveBatch = new Set(rawBatches.map((b: any) => String(b.id)));
            const unsent = derivedBatches.filter(
              (d) =>
                !haveBatch.has(String(d.id)) &&
                batchAlive(d) &&
                localOnlyGrnIds.some((gid) => String(d.id).includes(gid)),
            );
            return [...rawBatches, ...unsent].map((b: any) => {
              const dB = derivedBatches.find((d) => d.id === b.id);
              let eff = dB?.effectiveCostPrice || Number(b.effectiveCostPrice);
              const cost = dB?.costPrice || Number(b.costPrice);
              if (!eff || eff < 30) {
                eff = dB?.effectiveCostPrice || cost;
              }
              return {
                ...b,
                costPrice: cost,
                effectiveCostPrice: eff || cost,
                landedCostPerCrate: dB?.landedCostPerCrate || b.landedCostPerCrate,
              };
            });
          })();
          setInventoryBatches(resolvedBatches);
        } else {
          const candidateProducts = (() => {
            const map = new Map<number, Product>();
            productsRef.current.filter(productAlive).forEach((p) => map.set(p.id, p));
            if (Array.isArray(serverProducts)) {
              serverProducts.forEach((p: any) => {
                const cur = map.get(p.id);
                map.set(p.id, keepLocalProductFields(newerProduct(cur, p), p, cur));
              });
            }
            if (Array.isArray(remote.products)) {
              remote.products.forEach((p: any) => {
                const cur = map.get(p.id);
                map.set(p.id, keepLocalProductFields(newerProduct(cur, p), p, cur));
              });
            }
            return Array.from(map.values()).map((p) => ({
              ...p,
              name: String(p.name || '').trim().toUpperCase(),
              ...productTaxFields(p),
            }));
          })();
          if (candidateProducts.length > 0) {
            setProducts(candidateProducts);
            saveProducts(candidateProducts).catch(() => {});
          }
          if (remote.inventoryBatches && remote.inventoryBatches.length > 0) {
            setInventoryBatches(remote.inventoryBatches);
          } else if (serverBatches && serverBatches.length > 0) {
            setInventoryBatches(serverBatches as any);
          }
        }

        if (remote.stockTransfers) {
          const incoming = remote.stockTransfers;
          setStockTransfers((prev) => {
            const have = new Set(incoming.map((t) => String(t.id)));
            return [...incoming, ...prev.filter((t) => !have.has(String(t.id)))];
          });
        }
        if (Array.isArray(remote.promotions) && remote.promotions.length > 0) {
          const mappedPromos = (
            Array.isArray(remote.promotions) ? remote.promotions : []
          ).map((p: any) => normalizePromotion(p));
          setPromotions(mappedPromos);
          saveSchemes(mappedPromos as any).catch(() => {});
        } else if (serverSchemes && serverSchemes.length > 0) {
          const mappedPromos = (
            Array.isArray(serverSchemes) ? serverSchemes : []
          ).map((p: any) => normalizePromotion(p));
          setPromotions(mappedPromos);
          saveSchemes(mappedPromos as any).catch(() => {});
        }

        let pullRemappedBills: { oldId: number; newId: number; bill: Bill }[] = [];
        let mergedBillsSnapshot: Bill[] | null = null;
        if (remote.bills && remote.bills.length > 0) {
          const tombstones = readBillTombstones();
          const probe = mergeBillsPreservingCollisions(
            allBillsRef.current,
            remote.bills,
            tombstones,
          );
          pullRemappedBills = probe.remapped;
          mergedBillsSnapshot = probe.bills;
          allBillsRef.current = probe.bills;
          setBillsRaw((prev) => mergeBillsPreservingCollisions(prev, remote.bills!, tombstones).bills);
        } else if (serverOrders && serverOrders.length > 0) {
          const tombstones = readBillTombstones();
          const probe = mergeBillsPreservingCollisions(
            allBillsRef.current,
            serverOrders as Bill[],
            tombstones,
          );
          pullRemappedBills = probe.remapped;
          mergedBillsSnapshot = probe.bills;
          allBillsRef.current = probe.bills;
          setBillsRaw((prev) => mergeBillsPreservingCollisions(prev, serverOrders as Bill[], tombstones).bills);
        }

        if (pullRemappedBills.length > 0) {
          pullRemappedBills.forEach((r) => {
            cloud("pushBillToSupabase", pushBillToSupabase(r.bill));
          });
          setPayments((prev) =>
            prev.map((p) => {
              const hit = pullRemappedBills.find(
                (r) =>
                  Number(p.billId) === r.oldId &&
                  (!p.customerName ||
                    normCustName(p.customerName) === normCustName(r.bill.retailer)),
              );
              return hit ? { ...p, billId: hit.newId, updatedAt: new Date().toISOString() } : p;
            }),
          );
          setTripsRaw((prev) =>
            prev.map((t) => {
              let changed = false;
              const nextIds = (t.billIds || []).map((bid) => {
                const hit = pullRemappedBills.find(
                  (r) => Number(bid) === r.oldId && (!r.bill.tripId || r.bill.tripId === t.id),
                );
                if (hit) {
                  changed = true;
                  return hit.newId;
                }
                return bid;
              });
              if (!changed) return t;
              const nextT = { ...t, billIds: Array.from(new Set(nextIds)) };
              cloud("pushTripToSupabase", pushTripToSupabase(nextT));
              return nextT;
            }),
          );
        }

        if (remote.payments && remote.payments.length > 0) {
          setPayments((prev) => {
            const map = new Map<string, PaymentRecord>();
            prev.forEach((p) => map.set(p.id, p));
            withoutDeletedPayments<PaymentRecord>(remote.payments!).forEach((p) => {
              // Newest copy wins; a copy with the same stamp keeps what this device already has.
              if (isNewerPayment(p, map.get(p.id))) map.set(p.id, p);
            });
            return reconcilePaymentsFromBills(
              Array.from(map.values()),
              withoutDeletedBills(mergedBillsSnapshot || remote.bills || allBills),
            );
          });
        } else if (remote.bills && remote.bills.length > 0) {
          setPayments((prev) =>
            reconcilePaymentsFromBills(prev, withoutDeletedBills(mergedBillsSnapshot || remote.bills!)),
          );
        }
        if (remote.paymentAudit && remote.paymentAudit.length > 0) {
          setPaymentAudit((prev) => {
            const map = new Map<string, PaymentAuditEntry>();
            prev.forEach((item) => map.set(item.id, item));
            remote.paymentAudit!.forEach((item) => map.set(item.id, item));
            return Array.from(map.values())
              .sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")))
              .slice(0, 1000);
          });
        }

        const incomingTrips =
          remote.trips && remote.trips.length > 0
            ? remote.trips
            : serverTrips && serverTrips.length > 0
              ? (serverTrips as any[])
              : null;

        if (incomingTrips) {
          setTripsRaw((prev) => {
            const map = new Map<number, Trip>();
            prev.forEach((t) => map.set(Number(t.id), t));
            incomingTrips.forEach((t: any) => {
              const id = Number(t.id);
              map.set(id, pickNewerTrip(map.get(id), normalizeTrip(t)));
            });
            return Array.from(map.values()).sort(
              (a, b) => Number(b.id) - Number(a.id),
            );
          });
        }

        const deadAuditIds = new Set(delLog.filter((r) => r.kind === "audit").map((r) => r.id));
        if ((remote.audits && remote.audits.length > 0) || deadAuditIds.size > 0) {
          const incoming = (remote.audits || []).filter((a) => !deadAuditIds.has(String(a.id)));
          setAudits((prev) => {
            const map = new Map<number, Audit>();
            prev.filter((a) => !deadAuditIds.has(String(a.id))).forEach((a) => map.set(Number(a.id), a));
            incoming.forEach((a) => map.set(Number(a.id), a));
            return Array.from(map.values()).sort((a, b) => Number(b.id) - Number(a.id));
          });
        }

        if (remote.salesmen && remote.salesmen.length > 0) {
          setSalesmen(remote.salesmen);
        }

        if (remote.orgProfile) {
          setOrgProfile(remote.orgProfile);
        } else if (orgProfile && !(isServerProxyMode() && currentRole === "salesman")) {
          cloud(
            "pushOrgProfileToSupabase",
            pushOrgProfileToSupabase(orgProfile),
          );
        }

        if (remote.billingSettings) {
          const current = billingSettingsRef.current;
          const localToUse = loadCachedBillingSettings() || current;
          const remoteTime = remote.billingSettings?.updatedAt ? new Date(remote.billingSettings.updatedAt).getTime() : 0;
          const localTime = localToUse?.updatedAt ? new Date(localToUse.updatedAt).getTime() : 0;

          if (localTime > remoteTime && !(isServerProxyMode() && currentRole === "salesman")) {
            saveBillingSettings(localToUse).catch(() => {});
            if (localToUse !== current) setBillingSettings(localToUse);
          } else {
            const merged = { ...DEFAULT_BILLING_SETTINGS, ...remote.billingSettings };
            if (JSON.stringify(merged) !== JSON.stringify(current)) setBillingSettings(merged);
          }
        } else if (billingSettingsRef.current && !(isServerProxyMode() && currentRole === "salesman")) {
          saveBillingSettings(billingSettingsRef.current).catch(() => {});
        }

        if (remote.auditSessions && remote.auditSessions.length > 0) {
          setAuditSessions((prev) => {
            const map = new Map(prev.map((s) => [s.id, s]));
            remote.auditSessions!.forEach((s) => map.set(s.id, s));
            const merged = Array.from(map.values());
            saveAuditSessions(merged).catch(() => {});
            return merged;
          });
        }

        if (
          remote.reconciliationTransactions &&
          remote.reconciliationTransactions.length > 0
        ) {
          setReconciliationTransactions((prev) => {
            const map = new Map(prev.map((t) => [t.id, t]));
            remote.reconciliationTransactions!.forEach((t) => map.set(t.id, t));
            const merged = Array.from(map.values());
            saveReconciliationTransactions(merged).catch(() => {});
            return merged;
          });
        }

        if (remote.stockLedgerEntries && remote.stockLedgerEntries.length > 0) {
          setStockLedgerEntries((prev) => {
            const map = new Map(prev.map((e) => [e.id, e]));
            remote.stockLedgerEntries!.forEach((e) => map.set(e.id, e));
            const merged = Array.from(map.values());
            saveStockLedgerEntries(merged).catch(() => {});
            return merged;
          });
        }

        if (
          remote.inventoryDispositions &&
          remote.inventoryDispositions.length > 0
        ) {
          setInventoryDispositions((prev) => {
            const map = new Map(prev.map((d) => [d.id, d]));
            remote.inventoryDispositions!.forEach((d: any) => {
              if (!readDispositionTombstones().has(d.id)) map.set(d.id, d);
            });
            const merged = Array.from(map.values());
            saveInventoryDispositions(merged).catch(() => {});
            return merged;
          });
        }

        if (
          remote.supplierCreditNotes &&
          remote.supplierCreditNotes.length > 0
        ) {
          let tombstones = new Set<string>();
          try {
            tombstones = new Set(
              JSON.parse(
                localStorage.getItem("deleted_supplier_credit_note_ids") ||
                  "[]",
              ),
            );
          } catch {}
          setSupplierCreditNotes((prev) => {
            const map = new Map<string, SupplierCreditNote>();
            remote.supplierCreditNotes!.forEach((n: any) => {
              if (!tombstones.has(n.id) && n.id !== "scn_mun0c32l27o8") map.set(n.id, n);
            });
            prev.forEach((n) => {
              if (!tombstones.has(n.id) && n.id !== "scn_mun0c32l27o8" && !map.has(n.id)) {
                map.set(n.id, n);
              }
            });
            const dedupMap = new Map<string, SupplierCreditNote>();
            for (const n of map.values()) {
              const dispMatch = (n.notes || "").match(/Linked disposition (disp_[a-z0-9]+)/i);
              const key = dispMatch
                ? `disp_${dispMatch[1]}`
                : n.creditNoteNumber
                  ? `cn_${(n.supplierName || "").trim().toLowerCase()}_${n.creditNoteNumber.trim().toLowerCase()}`
                  : n.id;
              if (!dedupMap.has(key)) {
                dedupMap.set(key, n);
              } else {
                const existing = dedupMap.get(key)!;
                if ((n.actualAmount > 0 && existing.actualAmount === 0) || (n.creditNoteNumber && !existing.creditNoteNumber)) {
                  dedupMap.set(key, n);
                }
              }
            }
            const merged = Array.from(dedupMap.values());
            saveSupplierCreditNotes(merged).catch(() => {});
            return merged;
          });
        }

        if (remote.supplierSchemes && remote.supplierSchemes.length > 0) {
          setSupplierSchemes((prev) => {
            const map = new Map(prev.map((s) => [s.id, s]));
            remote.supplierSchemes!.forEach((s: any) => map.set(s.id, s));
            const merged = Array.from(map.values());
            saveSupplierSchemes(merged).catch(() => {});
            return merged;
          });
        }
      } else {
        if (serverWarehouses && serverWarehouses.length > 0)
          setWarehouses(serverWarehouses as any);
        if (serverSchemes && serverSchemes.length > 0)
          setPromotions(
            (Array.isArray(serverSchemes) ? serverSchemes : []).map(
              (p: any) => normalizePromotion(p),
            ) as any,
          );
        if (serverOrders && serverOrders.length > 0) {
          const tombstones = readBillTombstones();
          const probe = mergeBillsPreservingCollisions(
            allBillsRef.current,
            serverOrders as Bill[],
            tombstones,
          );
          allBillsRef.current = probe.bills;
          setBillsRaw((prev) =>
            mergeBillsPreservingCollisions(prev, serverOrders as Bill[], tombstones).bills,
          );
          if (probe.remapped.length > 0) {
            probe.remapped.forEach((r) => {
              cloud("pushBillToSupabase", pushBillToSupabase(r.bill));
            });
          }
        }
        if (serverProducts && serverProducts.length > 0)
          setProducts((prev) => {
            const mineById = new Map(prev.map((x) => [x.id, x]));
            return (serverProducts as Product[]).map((p) =>
              keepLocalProductFields(
                {
                  ...p,
                  name: String(p.name || '').trim().toUpperCase(),
                  ...productTaxFields(p),
                },
                p,
                mineById.get(p.id),
              ),
            );
          });
        if (serverBatches && serverBatches.length > 0)
          setInventoryBatches(serverBatches as any);
        if (serverTrips && serverTrips.length > 0)
          setTripsRaw((prev) => {
            const map = new Map<number, Trip>();
            (serverTrips as any[]).forEach((t) => map.set(Number(t.id), normalizeTrip(t)));
            prev.forEach((t) => {
              map.set(Number(t.id), pickNewerTrip(t, map.get(Number(t.id)) ?? t));
            });
            return Array.from(map.values()).sort((a, b) => Number(b.id) - Number(a.id));
          });
      }

      isInitialMountRef.current = false;

      const nowStr = new Date().toLocaleTimeString();
      setSupabaseStatus((prev) => ({
        ...prev,
        isConnected: true,
        lastSyncedAt: nowStr,
        message: "Successfully pulled latest records from Supabase database.",
      }));

      return {
        success: true,
        message: "Latest records pulled from Supabase successfully.",
      };
    } catch (err: any) {
      isInitialMountRef.current = false;
      return {
        success: false,
        message: err?.message || "Failed to fetch data from Supabase.",
      };
    }
  };

  const pullFromCloud = async (
    opts?: PullFromCloudOptions,
  ): Promise<{ success: boolean; message: string }> => {
    const auto = !!opts && (opts as PullFromCloudOptions).auto === true;
    const gate = cloudSyncGate;
    const now = Date.now();

    if (cloudPullInFlight) {
      if (auto || now - cloudPullInFlight.startedAt < 5000) return cloudPullInFlight.promise;
      await cloudPullInFlight.promise.catch(() => {});
    }

    if (auto) {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        return { success: true, message: "Offline: nothing to check" };
      }
      if (!canCheckNow(gate, now)) return { success: true, message: "Checked a moment ago" };
    }
    gate.lastCheckAt = now;

    const probe = await probeCloudChanges().catch(() => null);

    if (auto) {
      const decision = decideAutoPull(gate, probe, Date.now());
      noteDecision(gate, decision);
      console.info(`[sync] background check: ${decision.pull ? "downloading" : "skipped"} (${decision.reason})`);
      if (!decision.pull) return { success: true, message: `No cloud changes (${decision.reason})` };
    } else {
      resetCloudReadCaches();
      gate.changedStreak = 0;
    }

    if (cloudPullInFlight) return cloudPullInFlight.promise;

    holdSyncSignal();
    const promise = pullFromCloudFull();
    cloudPullInFlight = { promise, auto, startedAt: Date.now() };
    try {
      const result = await promise;
      if (result.success) {
        gate.lastFullPullAt = Date.now();
        gate.settling = true;
        setTimeout(() => {
          probeCloudChanges()
            .then((p) => {
              gate.baseline = p ?? gate.baseline;
            })
            .catch(() => {})
            .finally(() => {
              gate.settling = false;
            });
        }, SETTLE_MS);
      }
      return result;
    } finally {
      releaseSyncSignal(SETTLE_MS + 2000);
      if (cloudPullInFlight && cloudPullInFlight.promise === promise) cloudPullInFlight = null;
    }
  };

  const pullFromCloudRef = useRef(pullFromCloud);
  pullFromCloudRef.current = pullFromCloud;

  // Startup purge + initial pull + cross-tab / window focus / visibility / interval polling
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        JSON.parse(raw);
        purgeLegacyLocalStorageKeys();
      }
    } catch (e) {
      console.warn("Notice while inspecting local storage:", e);
    }

    if (isServerProxyMode() && !currentUser?.id) return;

    pullFromCloud();

    const autoSync = () => {
      pullFromCloud({ auto: true }).catch(() => {});
    };

    let burstTimer: ReturnType<typeof setTimeout> | null = null;
    const autoSyncSoon = (delay: number = EVENT_DEBOUNCE_MS) => {
      if (burstTimer) clearTimeout(burstTimer);
      const wait = Math.max(delay, cloudSyncGate.lastCheckAt + MIN_CHECK_GAP_MS - Date.now());
      burstTimer = setTimeout(() => {
        burstTimer = null;
        autoSync();
      }, wait);
    };

    const stopSignal = startSyncSignal(() => autoSyncSoon(1500));

    const handleFocus = () => autoSync();
    window.addEventListener("focus", handleFocus);

    const handleVisible = () => {
      if (document.visibilityState === "visible") autoSync();
    };
    document.addEventListener("visibilitychange", handleVisible);

    let syncChannel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        syncChannel = new BroadcastChannel("mrwater_ledger_sync");
        syncChannel.onmessage = (event) => {
          if (event.data?.type === "REFRESH_DATA") autoSyncSoon();
        };
      }
    } catch {}

    const handleStorage = (e: StorageEvent) => {
      if (
        e.key &&
        (e.key.startsWith("mrwater_") || e.key.includes("orders") || e.key.includes("trips") || e.key.includes("customers"))
      ) {
        autoSyncSoon();
      }
    };
    window.addEventListener("storage", handleStorage);

    const handleBillReassigned = (ev: Event) => {
      const detail = (ev as CustomEvent)?.detail;
      const oldId = Number(detail?.oldId);
      const newId = Number(detail?.newId);
      const reassignedBill = detail?.bill as Bill | undefined;
      if (!Number.isFinite(oldId) || !Number.isFinite(newId) || !reassignedBill) return;

      const matchesOldLocalBill = (b: Bill) =>
        (detail?.clientUid && b.clientUid === detail.clientUid) ||
        (Number(b.id) === oldId && normCustName(b.retailer) === normCustName(reassignedBill.retailer));

      setBillsRaw((prev) => {
        const replaced = prev.map((b) => (matchesOldLocalBill(b) ? { ...b, ...reassignedBill, id: newId } : b));
        const hasNew = replaced.some((b) => Number(b.id) === newId);
        const next = hasNew ? replaced : [{ ...reassignedBill, id: newId }, ...replaced];
        return next.sort((a, b) => Number(b.id) - Number(a.id));
      });
      allBillsRef.current = allBillsRef.current
        .map((b) => (matchesOldLocalBill(b) ? { ...b, ...reassignedBill, id: newId } : b))
        .sort((a, b) => Number(b.id) - Number(a.id));

      setPayments((prev) =>
        prev.map((p) =>
          Number(p.billId) === oldId &&
          (!p.customerName || normCustName(p.customerName) === normCustName(reassignedBill.retailer))
            ? { ...p, billId: newId, updatedAt: new Date().toISOString() }
            : p,
        ),
      );
      setTripsRaw((prev) =>
        prev.map((t) => {
          if (reassignedBill.tripId && t.id !== reassignedBill.tripId) return t;
          if (!(t.billIds || []).includes(oldId)) return t;
          const nextT = {
            ...t,
            billIds: Array.from(new Set(t.billIds.map((bid) => (Number(bid) === oldId ? newId : bid)))),
          };
          cloud("pushTripToSupabase", pushTripToSupabase(nextT));
          return nextT;
        }),
      );
      cloud("pushBillToSupabase", pushBillToSupabase({ ...reassignedBill, id: newId }));
    };
    window.addEventListener("mrwater:bill-reassigned", handleBillReassigned);

    const autoSyncInterval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") autoSync();
    }, POLL_INTERVAL_MS);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisible);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("mrwater:bill-reassigned", handleBillReassigned);
      clearInterval(autoSyncInterval);
      stopSignal();
      if (burstTimer) clearTimeout(burstTimer);
      if (syncChannel) syncChannel.close();
    };
  }, [currentUser?.id]);

  // Realtime: when customers / schemes / expenses change, refresh local state
  // In server proxy mode, uses authenticated SSE stream (/api/sync/events) instead of direct Supabase Realtime.
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (isServerProxyMode()) {
      if (!currentUser?.id) return;
      const stopSse = openSyncEventStream((ev) => {
        try {
          if (ev.topic === "customers" || ev.topic === "deletions") {
            syncDeletionLog()
              .then(() => (ev.topic === "customers" ? loadCustomers() : null))
              .then((remote) => {
                if (remote && Array.isArray(remote)) {
                  const merged = dedupeSameShopCustomers(
                    withoutDeletedCustomers(
                      mergeCustomersNewestWins(customersRef.current, remote),
                    ),
                  ).customers;
                  customersRef.current = merged;
                  setCustomers(merged);
                }
              })
              .catch(() => {});
          } else if (ev.topic === "expenses" && currentRole !== "salesman") {
            refreshExpensesFromCloud().catch(() => {});
          } else if (ev.topic === "schemes") {
            loadSchemes()
              .then((remote) => {
                if (remote && Array.isArray(remote)) {
                  setPromotions(remote as any);
                }
              })
              .catch(() => {});
          } else if (
            ev.topic === "bills" ||
            ev.topic === "trips" ||
            ev.topic === "payments" ||
            ev.topic === "products" ||
            ev.topic === "batches" ||
            ev.topic === "warehouses" ||
            ev.topic === "settings" ||
            ev.topic === "inventory" ||
            ev.topic === "salesmen"
          ) {
            pullFromCloudRef.current({ auto: true }).catch(() => {});
          }
        } catch {
          // ignore
        }
      });
      return () => {
        stopSse();
      };
    }

    try {
      if (window.self !== window.top) return;
    } catch {
      return;
    }

    const client = getSupabaseClient();
    if (!client) return;

    let channel: any = null;
    try {
      channel = client
        .channel("mrwater-realtime-collections")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "app_collections" },
          (payload: any) => {
            try {
              const key = payload?.new?.key ?? payload?.old?.key;
              if (key === "customers" || key === "deleted_records") {
                syncDeletionLog()
                  .then(() => (key === "customers" ? loadCustomers() : null))
                  .then((remote) => {
                    if (remote && Array.isArray(remote)) {
                      const merged = dedupeSameShopCustomers(
                        withoutDeletedCustomers(
                          mergeCustomersNewestWins(customersRef.current, remote),
                        ),
                      ).customers;
                      customersRef.current = merged;
                      setCustomers(merged);
                    }
                  })
                  .catch(() => {});
              } else if (key === "business_expenses") {
                refreshExpensesFromCloud().catch(() => {});
              } else if (key === "schemes") {
                loadSchemes()
                  .then((remote) => {
                    if (remote && Array.isArray(remote)) {
                      setPromotions(remote as any);
                    }
                  })
                  .catch(() => {});
              }
            } catch {
              // ignore
            }
          },
        )
        .subscribe((status: string) => {
          if (status === "SUBSCRIBED") {
            console.info("[Realtime] Subscribed to app_collections changes");
          }
        });
    } catch {
      // Realtime unavailable in sandboxed / offline environment
    }

    return () => {
      try {
        if (channel) client.removeChannel(channel);
      } catch {
        /* ignore */
      }
    };
  }, [currentUser?.id, currentRole]);

  // Auto-persist all bills & backup copies
  const isBillsMountedRef = useRef(false);
  useEffect(() => {
    if (!isBillsMountedRef.current) {
      isBillsMountedRef.current = true;
      return;
    }
    saveOrders(allBills as any).catch(() => {});
    scheduleBackupCopy("bills", () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        parsed.bills = allBills;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      } catch {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          const parsed = raw ? JSON.parse(raw) : {};
          delete parsed.bills;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        } catch {}
      }
    });
  }, [allBills]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onHide = () => flushBackupCopies();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushBackupCopies();
    };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
      flushBackupCopies();
    };
  }, []);

  const isGrnsMountedRef = useRef(false);
  useEffect(() => {
    if (!isGrnsMountedRef.current) {
      isGrnsMountedRef.current = true;
      return;
    }
    if (grns && grns.length > 0) {
      saveGrns(grns).catch(() => {});
      scheduleBackupCopy("grns", () => {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          const parsed = raw ? JSON.parse(raw) : {};
          parsed.grns = grns;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        } catch {}
      });
    }
  }, [grns]);

  const isDispositionsMountedRef = useRef(false);
  useEffect(() => {
    if (!isDispositionsMountedRef.current) {
      isDispositionsMountedRef.current = true;
      return;
    }
    saveInventoryDispositions(inventoryDispositions).catch(() => {});
  }, [inventoryDispositions]);

  const isAuditMountedRef = useRef(false);
  useEffect(() => {
    if (!isAuditMountedRef.current) {
      isAuditMountedRef.current = true;
      return;
    }
    saveAuditSessions(auditSessions).catch(() => {});
  }, [auditSessions]);

  const isReconciliationTxnsMountedRef = useRef(false);
  useEffect(() => {
    if (!isReconciliationTxnsMountedRef.current) {
      isReconciliationTxnsMountedRef.current = true;
      return;
    }
    saveReconciliationTransactions(reconciliationTransactions).catch(() => {});
  }, [reconciliationTransactions]);

  const isStockLedgerMountedRef = useRef(false);
  useEffect(() => {
    if (!isStockLedgerMountedRef.current) {
      isStockLedgerMountedRef.current = true;
      return;
    }
    saveStockLedgerEntries(stockLedgerEntries).catch(() => {});
  }, [stockLedgerEntries]);

  useEffect(() => {
    if (isServerProxyMode() && !currentUser?.id) return;
    loadInventoryDispositions()
      .then((remote) => {
        if (remote && remote.length > 0) {
          setInventoryDispositions((prev) => {
            const map = new Map(prev.map((d) => [d.id, d]));
            remote.forEach((d) => {
              if (!readDispositionTombstones().has(d.id)) map.set(d.id, d);
            });
            return Array.from(map.values());
          });
        } else {
          fetchInventoryDispositionsFromSupabase()
            .then((rows) => {
              if (rows && rows.length > 0) {
                setInventoryDispositions((prev) => {
                  const map = new Map(prev.map((d) => [d.id, d]));
                  rows.forEach((d) => {
                    if (!readDispositionTombstones().has(d.id))
                      map.set(d.id, d);
                  });
                  return Array.from(map.values());
                });
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {});

    if (isServerProxyMode() && currentRole === "salesman") return;

    loadSupplierSchemes()
      .then((remote) => {
        if (Array.isArray(remote) && remote.length > 0) {
          setSupplierSchemes((prev) => {
            const map = new Map(prev.map((s) => [s.id, s]));
            remote.forEach((s) => map.set(s.id, s));
            return Array.from(map.values());
          });
        }
      })
      .catch(() => {});
    loadSupplierSchemeApplications()
      .then((remote) => {
        if (Array.isArray(remote) && remote.length > 0) {
          setSupplierSchemeApplications((prev) => {
            const map = new Map(prev.map((a) => [a.id, a]));
            remote.forEach((a) => map.set(a.id, a));
            return Array.from(map.values());
          });
        }
      })
      .catch(() => {});
    loadSupplierCreditNotes()
      .then((remote) => {
        if (Array.isArray(remote) && remote.length > 0) {
          let tombstones = new Set<string>();
          try {
            tombstones = new Set(
              JSON.parse(
                localStorage.getItem("deleted_supplier_credit_note_ids") ||
                  "[]",
              ),
            );
          } catch {}
          setSupplierCreditNotes((prev) => {
            const map = new Map(prev.map((n) => [n.id, n]));
            remote.forEach((n) => {
              if (!tombstones.has(n.id)) {
                map.set(n.id, n);
              }
            });
            return Array.from(map.values());
          });
        }
      })
      .catch(() => {});
    loadAuditSessions()
      .then((remote) => {
        if (Array.isArray(remote) && remote.length > 0) {
          setAuditSessions((prev) => {
            const map = new Map(prev.map((s) => [s.id, s]));
            remote.forEach((s) => map.set(s.id, s));
            return Array.from(map.values());
          });
        }
      })
      .catch(() => {});
    loadReconciliationTransactions()
      .then((remote) => {
        if (Array.isArray(remote) && remote.length > 0) {
          setReconciliationTransactions((prev) => {
            const map = new Map(prev.map((t) => [t.id, t]));
            remote.forEach((t) => map.set(t.id, t));
            return Array.from(map.values());
          });
        }
      })
      .catch(() => {});
    loadStockLedgerEntries()
      .then((remote) => {
        if (Array.isArray(remote) && remote.length > 0) {
          setStockLedgerEntries((prev) => {
            const map = new Map(prev.map((e) => [e.id, e]));
            remote.forEach((e) => map.set(e.id, e));
            return Array.from(map.values());
          });
        }
      })
      .catch(() => {});
  }, [currentUser?.id, currentRole]);

  // Sync state mutations to storage & Supabase backend
  useEffect(() => {
    if (isInitialMountRef.current) return;
    saveOrders(allBills);
  }, [allBills]);

  useEffect(() => {
    if (isInitialMountRef.current) return;
    saveWarehouses(warehouses);
  }, [warehouses]);

  useEffect(() => {
    if (isInitialMountRef.current) return;
    saveSchemes(promotions);
  }, [promotions]);

  useEffect(() => {
    if (isInitialMountRef.current) return;
    saveTrips(trips);
    if (trips.length > 0) {
      saveDailyVehicleTrip(trips[0]);
    }
  }, [trips]);

  useEffect(() => {
    if (isInitialMountRef.current) return;
    cacheBillingSettingsLocally(billingSettings);
  }, [billingSettings]);

  useEffect(() => {
    if (isInitialMountRef.current) return;
    saveOrgProfile(orgProfile);
  }, [orgProfile]);

  const hadProductsRef = useRef(false);
  const hadBatchesRef = useRef(false);
  useEffect(() => {
    if (isInitialMountRef.current) return;
    if (products.length > 0) hadProductsRef.current = true;
    if (products.length > 0 || hadProductsRef.current) {
      saveProducts(products);
    }
  }, [products]);

  useEffect(() => {
    if (isInitialMountRef.current) return;
    if (inventoryBatches.length > 0) hadBatchesRef.current = true;
    if (inventoryBatches.length > 0 || hadBatchesRef.current) {
      saveInventoryBatches(inventoryBatches);
    }
  }, [inventoryBatches]);

  useEffect(() => {
    if (isInitialMountRef.current) return;
    if (products.length > 0) {
      const invItems: InventoryItem[] = products.map((p) => {
        const matchingBatches = inventoryBatches.filter(
          (b) => b.productId === p.id,
        );
        const totalStock = matchingBatches.reduce(
          (acc, b) => acc + (b.quantity || 0),
          0,
        );
        const latestBatch = matchingBatches[0];
        const prodSku = p.sku || generateSkuId(p.name, p.category, p.id);
        const batchLot =
          latestBatch?.batchNumber ||
          p.batchNumber ||
          generateBatchNumber(p.name);
        const mfg = latestBatch?.mfgDate || p.mfgDate || "";
        const exp = latestBatch?.expiryDate || p.expiry || "";

        return {
          id: `inv_${prodSku}`,
          product_id: prodSku,
          productId: prodSku,
          sku: prodSku,
          stock_on_hand:
            matchingBatches.length > 0 ? totalStock : p.opening || 0,
          stockOnHand: matchingBatches.length > 0 ? totalStock : p.opening || 0,
          reserved_stock: 0,
          reservedStock: 0,
          reorder_level: 10,
          reorderLevel: 10,
          warehouse_id: latestBatch?.warehouseId || p.warehouseId || "",
          warehouseId: latestBatch?.warehouseId || p.warehouseId || "",
          warehouseName: "",
          warehouseBay: "",
          batch_number: batchLot,
          batchNumber: batchLot,
          mfg_date: mfg,
          mfgDate: mfg,
          expiry_date: exp,
          expiryDate: exp,
          unit_cost: p.cost || 0,
          unitCost: p.cost || 0,
          selling_scheme: p.scheme || "",
          sellingScheme: p.scheme || "",
          selling_scheme_discount: 0,
          sellingSchemeDiscount: 0,
          selling_scheme_label: p.scheme || "",
          sellingSchemeLabel: p.scheme || "",
          last_restocked: latestBatch?.inwardDate || new Date().toISOString(),
          lastRestocked: latestBatch?.inwardDate || new Date().toISOString(),
        };
      });
      saveInventory(invItems);
    }
  }, [products, inventoryBatches]);

  const saveCustomSupabaseCredentials = async (url: string, key: string) => {
    saveSupabaseCustomConfig(url, key);
    setSupabaseConfigState(getSupabaseConfig());
    await checkSupabaseConnection();
  };

  const clearCustomSupabaseCredentials = () => {
    clearSupabaseCustomConfig();
    setSupabaseConfigState(getSupabaseConfig());
    checkSupabaseConnection();
  };

  const updateOrgProfile = async (
    updates: Partial<OrganizationProfile>,
  ): Promise<{ success: boolean; cloudSynced: boolean; message?: string }> => {
    const updatedProfile: OrganizationProfile = { ...orgProfile, ...updates };
    setOrgProfile(updatedProfile);

    try {
      const res = await pushOrgProfileToSupabase(updatedProfile);
      if (res.success) {
        return {
          success: true,
          cloudSynced: true,
          message: "Saved locally and synchronized to Supabase PostgreSQL",
        };
      } else {
        return {
          success: true,
          cloudSynced: false,
          message:
            res.error || "Saved locally (Supabase table not found or offline)",
        };
      }
    } catch (e: any) {
      return {
        success: true,
        cloudSynced: false,
        message: e?.message || "Saved locally",
      };
    }
  };

  const pullOrgProfileFromCloud = async (): Promise<{
    success: boolean;
    message?: string;
  }> => {
    try {
      const res = await pullOrgProfileFromSupabase();
      if (res.success && res.profile) {
        setOrgProfile(res.profile);
        return {
          success: true,
          message: "Loaded profile from Supabase PostgreSQL.",
        };
      }
      return {
        success: false,
        message: res.error || "Could not fetch profile from Supabase.",
      };
    } catch (e: any) {
      return { success: false, message: e?.message || "Network error" };
    }
  };

  const updateBillingSettings = async (
    updates: Partial<BillingSettings>,
  ): Promise<{ success: boolean; cloudSynced: boolean; message?: string }> => {
    const updated: BillingSettings = {
      ...billingSettings,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    setBillingSettings(updated);
    try {
      const ok = await saveBillingSettings(updated);
      return ok
        ? {
            success: true,
            cloudSynced: true,
            message: "Saved locally and synchronized to Supabase billing_settings table!",
          }
        : {
            success: true,
            cloudSynced: false,
            message: "Saved on this device. It will sync when the connection is back.",
          };
    } catch (e: any) {
      return {
        success: true,
        cloudSynced: false,
        message: e?.message || "Saved locally",
      };
    }
  };

  const pullBillingSettingsFromCloud = async (): Promise<{
    success: boolean;
    message?: string;
  }> => {
    try {
      const res = await pullBillingSettingsFromSupabase();
      if (res.success && res.settings) {
        setBillingSettings(res.settings);
        return {
          success: true,
          message: "Loaded billing settings from Supabase PostgreSQL.",
        };
      }
      return {
        success: false,
        message: res.error || "Could not fetch billing settings from Supabase.",
      };
    } catch (e: any) {
      return { success: false, message: e?.message || "Network error" };
    }
  };

  const syncBillsToCloud = async (): Promise<{
    success: boolean;
    count: number;
    error?: string;
  }> => {
    try {
      let count = 0;
      for (const bill of allBills) {
        const res = await pushBillToSupabase(bill);
        if (res.success) count++;
      }
      await saveOrders(allBills);
      return { success: true, count };
    } catch (e: any) {
      return { success: false, count: 0, error: e?.message || "Sync failed" };
    }
  };

  const syncTripsToCloud = async (): Promise<{
    success: boolean;
    count: number;
    error?: string;
  }> => {
    try {
      let count = 0;
      for (const trip of trips) {
        const norm = normalizeTrip(trip);
        const res = await pushTripToSupabase(norm);
        if (res.success) count++;
      }
      const remote = await pullLedgerFromSupabase().catch(() => null);
      if (remote?.trips && remote.trips.length > 0) {
        const normalizedRemote = remote.trips.map(normalizeTrip);
        const byId = new Map<number, Trip>();
        normalizedRemote.forEach((t) => byId.set(Number(t.id), t));
        trips.forEach((t) => {
          const theirs = byId.get(Number(t.id));
          byId.set(Number(t.id), pickNewerTrip(normalizeTrip(t), theirs ?? normalizeTrip(t)));
        });
        const mergedTrips = Array.from(byId.values()).sort((a, b) => Number(b.id) - Number(a.id));
        setTripsRaw(mergedTrips);
        await saveTrips(mergedTrips);
      } else {
        await saveTrips(trips.map(normalizeTrip));
      }
      return { success: true, count };
    } catch (e: any) {
      return { success: false, count: 0, error: e?.message || "Sync failed" };
    }
  };

  return {
    supabaseConfig,
    supabaseStatus,
    setSupabaseStatus,
    checkSupabaseConnection,
    syncToCloud,
    pullFromCloudFull,
    pullFromCloud,
    pullFromCloudRef,
    saveCustomSupabaseCredentials,
    clearCustomSupabaseCredentials,
    deadTripIdsRef,
    isInitialMountRef,
    updateOrgProfile,
    pullOrgProfileFromCloud,
    updateBillingSettings,
    pullBillingSettingsFromCloud,
    syncBillsToCloud,
    syncTripsToCloud,
  };
}
