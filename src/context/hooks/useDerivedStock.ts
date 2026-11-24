import { useCallback, useMemo } from "react";
import type {
  Audit,
  Bill,
  BillItem,
  CartState,
  InventoryBatch,
  InventoryDisposition,
  Product,
  Promotion,
  StockLedgerEntry,
  Trip,
  Warehouse,
} from "../../types";
import { diagnoseOversoldGodowns } from "../../utils/oversoldDiagnostic";
import { billBalance, billNetTotal, restockedByProduct, returnedQtyByProduct } from "../../utils/salesReturns";
import { buildProductBatchLines, productHasBatchInWarehouse } from "../../utils/stockLocations";
import { extractPromoProductIds } from "../ledgerHelpers";
import {
  calcAllocateBatches,
  calcBaseStockFor,
  calcFallbackWarehouseId,
  calcGetVehicleStock,
  calcProductWarehouseStock,
  calcStockAsOf,
  calcStockShortfalls,
  calcTripBreakdown,
} from "../ledgerStockCalculations";

export interface UseDerivedStockParams {
  products: Product[];
  warehouses: Warehouse[];
  defaultWarehouse?: Warehouse;
  inventoryBatches: InventoryBatch[];
  bills: Bill[];
  editingBillId: number | null;
  cart: CartState;
  promotions: Promotion[];
  audits: Audit[];
  stockLedgerEntries: StockLedgerEntry[];
  inventoryDispositions: InventoryDisposition[];
  trips: Trip[];
}

export function useDerivedStock({
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
}: UseDerivedStockParams) {
  const activePromoFor = useCallback(
    (productId: number): Promotion | undefined => {
      const targetPid = Number(productId);
      const targetProd = products.find((pr) => Number(pr.id) === targetPid);
      // Only ACTIVE schemes from the promotions store apply at billing.
      const active = promotions.filter((p) => p.isActive !== false);
      // Prioritize newest / most recently created or updated schemes first
      const activeNewest = [...active].reverse();

      // 1. Direct match on non-bundle schemes with explicit productIds containing targetPid
      const specificSingle = activeNewest.find((p) => {
        if (p.type === "bundle" || p.type === "group_buy_n_get_m_free") return false;
        const ids = extractPromoProductIds(p);
        return ids.length > 0 && ids.some((id) => Number(id) === targetPid);
      });
      if (specificSingle) return specificSingle;

      // 1b. Direct match on group schemes (group_buy_n_get_m_free)
      const groupMatch = activeNewest.find((p) => {
        if (p.type !== "group_buy_n_get_m_free") return false;
        const ids = extractPromoProductIds(p);
        if (ids.length > 0 && ids.some((id) => Number(id) === targetPid)) return true;
        if (targetProd && p.groupCategory && targetProd.category?.toLowerCase() === p.groupCategory.toLowerCase()) return true;
        if (targetProd && p.groupBrand && targetProd.brand?.toLowerCase() === p.groupBrand.toLowerCase()) return true;
        return false;
      });
      if (groupMatch) return groupMatch;

      // 2. Direct match on bundle schemes with explicit productIds containing targetPid
      const specificBundle = activeNewest.find((p) => {
        if (p.type !== "bundle") return false;
        const ids = extractPromoProductIds(p);
        return ids.length > 0 && ids.some((id) => Number(id) === targetPid);
      });
      if (specificBundle) return specificBundle;

      // 3. Direct match on schemes where freeProductId is targetPid
      const rewardBundle = activeNewest.find((p) => {
        return p.freeProductId && Number(p.freeProductId) === targetPid;
      });
      if (rewardBundle) return rewardBundle;

      // 4. Storewide non-bundle schemes (productIds is empty)
      const storewideSingle = activeNewest.find((p) => {
        if (p.type === "bundle") return false;
        const ids = extractPromoProductIds(p);
        return ids.length === 0;
      });
      if (storewideSingle) return storewideSingle;

      // 5. Storewide bundle schemes (productIds is empty)
      return activeNewest.find((p) => {
        const ids = extractPromoProductIds(p);
        return ids.length === 0;
      });
    },
    [promotions, products],
  );

  // Sold calculation excludes the currently edited bill
  const soldByProduct = useMemo(() => {
    const map: Record<number, number> = {};
    for (const b of bills) {
      if (b.id === editingBillId) continue;
      for (const it of b.items) {
        // it.qty represents the total physical crates dispatched/billed (e.g. 4 crates: 3 paid + 1 free)
        const totalCrates = Number(it.qty) || 0;
        map[it.productId] = (map[it.productId] || 0) + totalCrates;
      }
    }
    return map;
  }, [bills, editingBillId]);

  const cartSoldByProduct = useMemo(() => {
    const map: Record<number, number> = {};
    for (const it of cart.items) {
      // it.qty represents the total physical crates in the bill
      const totalCrates = Number(it.qty) || 0;
      map[it.productId] = (map[it.productId] || 0) + totalCrates;
    }
    return map;
  }, [cart.items]);

  // Smart Reconciliation ledger adjustments, summed per product (and per product+warehouse).
  const ledgerAdjByProduct = useMemo(() => {
    const m: Record<number, number> = {};
    for (const e of stockLedgerEntries)
      m[e.productId] = (m[e.productId] || 0) + (Number(e.quantity) || 0);
    for (const a of audits) {
      if (!a.adjusted) continue;
      for (const e of a.entries)
        if (e.warehouseId)
          m[e.productId] = (m[e.productId] || 0) + (Number(e.diff) || 0);
    }
    return m;
  }, [stockLedgerEntries, audits]);

  const ledgerAdjByProductWh = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of stockLedgerEntries) {
      if (!e.warehouseId) continue;
      const k = `${e.productId}|${e.warehouseId}`;
      m[k] = (m[k] || 0) + (Number(e.quantity) || 0);
    }
    for (const a of audits) {
      if (!a.adjusted) continue;
      for (const e of a.entries) {
        if (!e.warehouseId) continue;
        const k = `${e.productId}|${e.warehouseId}`;
        m[k] = (m[k] || 0) + (Number(e.diff) || 0);
      }
    }
    return m;
  }, [stockLedgerEntries, audits]);

  // Crates customers returned that went back on the shelf (scrapped crates never come back).
  const restockByProduct = useMemo(() => restockedByProduct(bills), [bills]);

  // Disposed stock (damage, expiry returns, return to supplier, free near-expiry issue)
  const disposedByProduct = useMemo(() => {
    const m: Record<number, number> = {};
    for (const d of inventoryDispositions) {
      if (d.stockApplied !== false) {
        m[d.productId] = (m[d.productId] || 0) + (Number(d.quantity) || 0);
      }
    }
    return m;
  }, [inventoryDispositions]);

  const disposedInWhByProduct = useMemo(() => {
    const m: Record<string, number> = {};
    for (const d of inventoryDispositions) {
      if (d.stockApplied !== false) {
        const k = `${d.productId}|${d.warehouseId}`;
        m[k] = (m[k] || 0) + (Number(d.quantity) || 0);
      }
    }
    return m;
  }, [inventoryDispositions]);

  function baseStockFor(p: Product): number {
    return calcBaseStockFor(p, inventoryBatches);
  }

  // FEFO batch allocation for a bill (earliest expiry first; same expiry → oldest inward).
  const allocateBatches = useCallback(
    (
      items: BillItem[],
      billDate: string,
      warehouseId?: string | Record<number, string>,
      excludeBillId?: number | null,
      trip?: Trip | null,
    ): { items: BillItem[]; problems: string[] } =>
      calcAllocateBatches({
        items,
        billDate,
        warehouseId,
        excludeBillId,
        trip,
        bills,
        inventoryBatches,
        warehouses,
        defaultWarehouse,
      }),
    [bills, inventoryBatches, warehouses, defaultWarehouse],
  );

  // Warehouse a sale is charged to when it names no valid one.
  const fallbackWarehouseId = useCallback(
    (p: Product): string => calcFallbackWarehouseId(p, warehouses),
    [warehouses],
  );

  // Real-time crate counts across warehouses for a product.
  const productWarehouseStock = useCallback(
    (
      productId: number,
    ): { warehouseId: string; warehouseName: string; crates: number }[] =>
      calcProductWarehouseStock({
        productId,
        products,
        warehouses,
        inventoryBatches,
        bills,
        editingBillId,
        ledgerAdjByProduct,
        ledgerAdjByProductWh,
        restockByProduct,
        soldByProduct,
        cartSoldByProduct,
        disposedByProduct,
        disposedInWhByProduct,
        cart,
        trips,
      }),
    [
      products,
      warehouses,
      inventoryBatches,
      bills,
      editingBillId,
      ledgerAdjByProduct,
      ledgerAdjByProductWh,
      restockByProduct,
      soldByProduct,
      cartSoldByProduct,
      disposedByProduct,
      disposedInWhByProduct,
      cart,
      trips,
    ],
  );

  const remainingStock = useCallback(
    (productId: number): number => {
      const rows = productWarehouseStock(productId);
      return rows.reduce((sum, row) => sum + Math.max(0, row.crates), 0);
    },
    [productWarehouseStock],
  );

  const oversoldReport = useMemo(
    () =>
      diagnoseOversoldGodowns({
        products,
        warehouses,
        inventoryBatches,
        bills: bills.filter((b) => b.id !== editingBillId),
        audits,
        stockLedgerEntries,
        inventoryDispositions,
        trips,
        cartSoldByProduct,
        cartWarehouseId: cart.warehouseId,
        cartTripId: cart.tripId,
      }),
    [products, warehouses, inventoryBatches, bills, editingBillId, audits, stockLedgerEntries, inventoryDispositions, trips, cartSoldByProduct, cart.warehouseId, cart.tripId],
  );

  const stockAsOf = useCallback(
    (productId: number, dateISO: string, warehouseId?: string): number => {
      const current = warehouseId
        ? (productWarehouseStock(productId).find((r) => r.warehouseId === warehouseId)?.crates ?? 0)
        : remainingStock(productId);
      return calcStockAsOf({
        productId,
        dateISO,
        warehouseId,
        products,
        warehouses,
        inventoryBatches,
        bills,
        audits,
        stockLedgerEntries,
        inventoryDispositions,
        trips,
        currentStock: current,
      });
    },
    [
      productWarehouseStock,
      remainingStock,
      products,
      warehouses,
      inventoryBatches,
      bills,
      audits,
      stockLedgerEntries,
      inventoryDispositions,
      trips,
    ],
  );

  const bookStock = useCallback(
    (productId: number): number => {
      return remainingStock(productId);
    },
    [remainingStock],
  );

  const productBatchLines = useCallback(
    (productId: number) => {
      const availableByWarehouse: Record<string, number> = {};
      for (const row of productWarehouseStock(productId)) {
        availableByWarehouse[row.warehouseId] = Math.max(0, row.crates);
      }
      const soldByBatchId: Record<string, number> = {};
      for (const b of bills) {
        if (b.id === editingBillId) continue;
        for (const it of b.items) {
          if (it.productId !== productId) continue;
          let left = Number(it.qty) || 0;
          for (const a of it.batchAllocations || []) {
            const take = Math.min(left, Number(a.qty) || 0);
            if (take > 0) {
              soldByBatchId[a.batchId] = (soldByBatchId[a.batchId] || 0) + take;
              left -= take;
            }
          }
        }
      }
      const auditAdjByKey: Record<string, number> = {};
      for (const a of audits) {
        if (!a.adjusted) continue;
        for (const e of a.entries) {
          if (e.productId !== productId || !e.batchKey) continue;
          auditAdjByKey[e.batchKey] = (auditAdjByKey[e.batchKey] || 0) + (Number(e.diff) || 0);
        }
      }
      return buildProductBatchLines(
        productId,
        inventoryBatches,
        warehouses,
        availableByWarehouse,
        new Date(),
        soldByBatchId,
        auditAdjByKey,
      );
    },
    [inventoryBatches, warehouses, productWarehouseStock, bills, editingBillId, audits],
  );

  const productInWarehouse = useCallback(
    (productId: number, warehouseId: string) =>
      productHasBatchInWarehouse(productId, inventoryBatches, warehouseId),
    [inventoryBatches],
  );

  const totalOpening = useMemo(() => {
    return products.reduce((s, p) => {
      return s + baseStockFor(p);
    }, 0);
  }, [products, inventoryBatches]);

  const totalRemaining = useMemo(
    () => products.reduce((s, p) => s + remainingStock(p.id), 0),
    [products, remainingStock],
  );

  const warehouseStock = useCallback(
    (warehouseId: string, productId?: number): number => {
      if (!warehouseId) {
        if (productId) return Math.max(0, remainingStock(productId));
        return totalRemaining;
      }
      if (productId) {
        const match = productWarehouseStock(productId).find(
          (item) => item.warehouseId === warehouseId,
        );
        return match ? Math.max(0, match.crates) : 0;
      }
      return products.reduce((sum, p) => {
        const match = productWarehouseStock(p.id).find(
          (item) => item.warehouseId === warehouseId,
        );
        return sum + (match ? Math.max(0, match.crates) : 0);
      }, 0);
    },
    [remainingStock, totalRemaining, productWarehouseStock, products],
  );

  const tripBreakdown = useCallback(
    (trip: Trip) => calcTripBreakdown(trip, bills, products),
    [bills, products],
  );

  const getVehicleStock = useCallback(
    (trip: Trip | null | undefined, productId: number) =>
      calcGetVehicleStock(trip, productId, bills),
    [bills],
  );

  const stockShortfalls = useCallback(
    (
      items: BillItem[],
      excludeBillId?: number | null,
      trip?: Trip | null,
      warehouseId?: string,
    ): {
      productId: number;
      productName: string;
      available: number;
      required: number;
    }[] =>
      calcStockShortfalls({
        items,
        excludeBillId,
        trip,
        warehouseId,
        products,
        bills,
        inventoryBatches,
        ledgerAdjByProduct,
        restockByProduct,
        disposedByProduct,
        getVehicleStock,
        warehouseStock,
      }),
    [
      products,
      bills,
      inventoryBatches,
      ledgerAdjByProduct,
      restockByProduct,
      disposedByProduct,
      getVehicleStock,
      warehouseStock,
    ],
  );

  const totalRevenue = useMemo(
    () => bills.reduce((s, b) => s + billNetTotal(b), 0),
    [bills],
  );

  const totalCasesSold = useMemo(
    () =>
      bills.reduce((s, b) => {
        const back = Object.values(returnedQtyByProduct(b)).reduce(
          (a, q) => a + q,
          0,
        );
        return s + b.items.reduce((s2, i) => s2 + i.qty, 0) - back;
      }, 0),
    [bills],
  );

  const totalOutstanding = useMemo(
    () => bills.reduce((s, b) => s + billBalance(b), 0),
    [bills],
  );

  const tripsWithDiscrepancy = useMemo(
    () => trips.filter((t) => tripBreakdown(t).hasDiscrepancy).length,
    [trips, bills, products],
  );

  return {
    activePromoFor,
    soldByProduct,
    cartSoldByProduct,
    ledgerAdjByProduct,
    ledgerAdjByProductWh,
    restockByProduct,
    disposedByProduct,
    disposedInWhByProduct,
    stockShortfalls,
    allocateBatches,
    fallbackWarehouseId,
    productWarehouseStock,
    remainingStock,
    oversoldReport,
    stockAsOf,
    bookStock,
    productBatchLines,
    productInWarehouse,
    totalOpening,
    totalRemaining,
    warehouseStock,
    totalRevenue,
    totalCasesSold,
    totalOutstanding,
    tripBreakdown,
    getVehicleStock,
    tripsWithDiscrepancy,
  };
}
