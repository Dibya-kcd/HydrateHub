import {
  Audit,
  Bill,
  BillItem,
  CartState,
  InventoryBatch,
  InventoryDisposition,
  Product,
  StockLedgerEntry,
  Trip,
  TripProductBreakdown,
  Warehouse,
} from "../types";
import { billBelongsToTrip } from "../utils/billing";
import { todayISO } from "../utils/dateLocal";
import { restockDestinations } from "../utils/salesReturns";
import { tripPrimaryWarehouseId } from "../utils/tripLoads";

export function calcFindTripOfBill(b: Bill, trips: Trip[]): Trip | null {
  if (b.tripId != null) {
    const t = trips.find((x) => Number(x.id) === Number(b.tripId));
    if (t) return t;
  }
  return (
    trips.find((x) => (x.billIds || []).map(Number).includes(Number(b.id))) ||
    null
  );
}

// Received stock for a product: the opening figure only applies while the product has never had
// any batch row. Once batches exist they supersede it, even if they have since dropped to zero,
// otherwise the old opening number reappears as phantom stock.
export function calcBaseStockFor(
  p: Product,
  inventoryBatches: InventoryBatch[],
): number {
  const rows = inventoryBatches.filter((b) => b.productId === p.id);
  if (rows.length === 0) return Number(p.opening) || 0;
  return rows.reduce((sum, b) => sum + (Number(b.quantity) || 0), 0);
}

// Warehouse a sale is charged to when it names no valid one (old bills, carts with no godown
// picked yet): the product's home warehouse, else the default godown, else the first one. Sales
// must always land SOMEWHERE, otherwise they are never subtracted from any godown.
export function calcFallbackWarehouseId(
  p: Product,
  warehouses: Warehouse[],
): string {
  const valid = (id?: string) => !!id && warehouses.some((w) => w.id === id);
  if (valid(p.warehouseId)) return p.warehouseId as string;
  const def = warehouses.find((w) => w.isDefault);
  return def?.id || warehouses[0]?.id || "";
}

export function calcGetVehicleStock(
  trip: Trip | null | undefined,
  productId: number,
  bills: Bill[],
): { loaded: number; sold: number; available: number } {
  if (!trip) {
    return { loaded: 0, sold: 0, available: 0 };
  }
  const pid = Number(productId);
  const loadedMap =
    typeof trip.loaded === "object" && trip.loaded !== null
      ? trip.loaded
      : {};
  const loaded = Number(loadedMap[pid] ?? loadedMap[String(pid)] ?? 0) || 0;

  // Collect all bills assigned to this trip (by trip.billIds or bill.tripId)
  let sold = 0;
  for (const b of bills) {
    if (!billBelongsToTrip(trip, b)) continue;

    for (const it of b.items) {
      if (Number(it.productId) === pid) {
        sold += Number(it.qty) || 0;
      }
    }
  }

  // CRITICAL: A trip with status 'out' (in transit or reopened) has NOT returned inventory to warehouse!
  // Returned counts ONLY apply to closed / reconciled trips.
  const returnedMap =
    typeof trip.returned === "object" && trip.returned !== null
      ? trip.returned
      : {};
  // Crates "returned" only leave the van once the trip is closed. A trip that is out (or was
  // reopened) can still carry an old returned map; subtracting it made van stock look empty.
  const returned =
    trip.status === "closed"
      ? Number(returnedMap[pid] ?? returnedMap[String(pid)] ?? 0) || 0
      : 0;

  // When a trip is closed/completed, remaining stock is NOT on the van!
  // Loaded vs (Sold + Returned) is strictly for discrepancy reconciliation.
  // Available to sell on an active vehicle is Math.max(0, loaded - sold - returned).
  const available =
    trip.status === "closed"
      ? 0
      : Math.max(0, loaded - sold - returned);
  return { loaded, sold, available };
}

export function calcTripBreakdown(
  trip: Trip,
  bills: Bill[],
  products: Product[],
): { rows: TripProductBreakdown[]; hasDiscrepancy: boolean } {
  const soldByProductForTrip: Record<number, number> = {};
  for (const b of bills) {
    if (billBelongsToTrip(trip, b)) {
      for (const it of b.items) {
        const pId = Number(it.productId);
        soldByProductForTrip[pId] =
          (soldByProductForTrip[pId] || 0) + (Number(it.qty) || 0);
      }
    }
  }

  const loadedMap =
    typeof trip.loaded === "object" && trip.loaded !== null
      ? trip.loaded
      : {};
  const returnedMap =
    typeof trip.returned === "object" && trip.returned !== null
      ? trip.returned
      : {};

  const allProductIds = Array.from(
    new Set([
      ...Object.keys(loadedMap).map(Number),
      ...Object.keys(returnedMap).map(Number),
      ...Object.keys(soldByProductForTrip).map(Number),
    ]),
  ).filter((id) => !isNaN(id) && id > 0);

  const rows: TripProductBreakdown[] = allProductIds.map((pid) => {
    const product = products.find((p) => Number(p.id) === pid);
    const loaded =
      Number(loadedMap[pid] ?? loadedMap[String(pid)] ?? 0) || 0;
    const sold = soldByProductForTrip[pid] || 0;
    // If trip is 'out' (reopened or out for delivery), returns are not applied
    const returned =
      trip.status === "closed"
        ? Number(returnedMap[pid] ?? returnedMap[String(pid)] ?? 0) || 0
        : 0;
    const discrepancy =
      trip.status === "closed" ? loaded - sold - returned : 0;
    return {
      productId: pid,
      name: product ? product.name : `Product #${pid}`,
      loaded,
      sold,
      returned,
      discrepancy,
      volume: product?.volume,
      pack: product?.pack,
      unitsPerCrate: product?.unitsPerCrate,
    };
  });
  const hasDiscrepancy =
    trip.status === "closed" && rows.some((r) => r.discrepancy !== 0);
  return { rows, hasDiscrepancy };
}

export function calcStockShortfalls(params: {
  items: BillItem[];
  excludeBillId?: number | null;
  trip?: Trip | null;
  warehouseId?: string;
  products: Product[];
  bills: Bill[];
  inventoryBatches: InventoryBatch[];
  ledgerAdjByProduct: Record<number, number>;
  restockByProduct: Record<number, number>;
  disposedByProduct: Record<number, number>;
  getVehicleStock: (
    trip: Trip | null | undefined,
    productId: number,
  ) => { loaded: number; sold: number; available: number };
  warehouseStock?: (warehouseId: string, productId?: number) => number;
}): {
  productId: number;
  productName: string;
  available: number;
  required: number;
}[] {
  const {
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
  } = params;

  const need: Record<number, number> = {};
  for (const it of items)
    need[it.productId] = (need[it.productId] || 0) + (Number(it.qty) || 0);
  const out: {
    productId: number;
    productName: string;
    available: number;
    required: number;
  }[] = [];
  for (const key of Object.keys(need)) {
    const pid = Number(key);
    const p = products.find((x) => x.id === pid);
    if (!p) continue;

    let available = 0;
    if (trip) {
      // Vehicle / Van trip stock: check stock on the assigned van
      const vs = getVehicleStock(trip, pid);
      let vanAvail = Math.max(0, vs.available);
      // If updating an existing bill that was on this trip, add back what it already used
      if (excludeBillId != null) {
        const eb = bills.find((b) => b.id === excludeBillId);
        if (eb && billBelongsToTrip(trip, eb)) {
          for (const bi of eb.items) {
            if (Number(bi.productId) === pid) {
              vanAvail += Number(bi.qty) || 0;
            }
          }
        }
      }
      available = vanAvail;
    } else {
      // Warehouse / depot sale
      let soldElsewhere = 0;
      for (const b of bills) {
        if (excludeBillId != null && b.id === excludeBillId) continue;
        for (const bi of b.items)
          if (bi.productId === pid) soldElsewhere += Number(bi.qty) || 0;
      }
      const totalGodownStock =
        calcBaseStockFor(p, inventoryBatches) +
        (ledgerAdjByProduct[pid] || 0) +
        (restockByProduct[pid] || 0) -
        (disposedByProduct[pid] || 0) -
        soldElsewhere;

      if (warehouseId && typeof warehouseStock === "function") {
        let whAvail = warehouseStock(warehouseId, pid);
        if (excludeBillId != null) {
          const eb = bills.find((b) => b.id === excludeBillId);
          if (eb && eb.warehouseId === warehouseId) {
            for (const bi of eb.items) {
              if (Number(bi.productId) === pid) {
                whAvail += Number(bi.qty) || 0;
              }
            }
          }
        }
        available = Math.max(whAvail, totalGodownStock);
      } else {
        available = totalGodownStock;
      }
    }

    if (need[pid] > available)
      out.push({
        productId: pid,
        productName: p.name,
        available,
        required: need[pid],
      });
  }
  return out;
}

export function calcAllocateBatches(params: {
  items: BillItem[];
  billDate: string;
  warehouseId?: string | Record<number, string>;
  excludeBillId?: number | null;
  trip?: Trip | null;
  bills: Bill[];
  inventoryBatches: InventoryBatch[];
  warehouses: Warehouse[];
  defaultWarehouse?: Warehouse;
}): { items: BillItem[]; problems: string[] } {
  const {
    items,
    billDate,
    warehouseId,
    excludeBillId,
    trip,
    bills,
    inventoryBatches,
    warehouses,
    defaultWarehouse,
  } = params;

  const problems: string[] = [];
  const today = (billDate || todayISO()).slice(0, 10);
  // FEFO: expiryDate ascending; tie-break by inwardDate ascending
  const byFefo = (a: InventoryBatch, b: InventoryBatch) => {
    const ea = (a.expiryDate || "9999-12-31").slice(0, 10);
    const eb = (b.expiryDate || "9999-12-31").slice(0, 10);
    if (ea !== eb) return ea.localeCompare(eb);
    return (a.inwardDate || "0000-01-01")
      .slice(0, 10)
      .localeCompare((b.inwardDate || "0000-01-01").slice(0, 10));
  };

  // Sold per batch (from allocations) and legacy unallocated sold per product, from other bills.
  const usedByBatch: Record<string, number> = {};
  const legacyByProduct: Record<number, number> = {};
  for (const b of bills) {
    if (excludeBillId != null && b.id === excludeBillId) continue;
    for (const it of b.items) {
      if (it.batchAllocations && it.batchAllocations.length > 0) {
        for (const a of it.batchAllocations)
          usedByBatch[a.batchId] = (usedByBatch[a.batchId] || 0) + a.qty;
      } else {
        legacyByProduct[it.productId] =
          (legacyByProduct[it.productId] || 0) + (Number(it.qty) || 0);
      }
    }
  }

  // Crates a customer returned and that were restocked are sellable again: credit them back to
  // the batch they came from (or, for older bills with no batch trail, to the product's pool).
  for (const b of bills) {
    if (excludeBillId != null && b.id === excludeBillId) continue;
    for (const r of b.returns || []) {
      for (const l of r.lines) {
        let traced = 0;
        for (const br of l.batchRestocks || []) {
          usedByBatch[br.batchId] = Math.max(
            0,
            (usedByBatch[br.batchId] || 0) - br.qty,
          );
          traced += br.qty;
        }
        const rest = (Number(l.restockQty) || 0) - traced;
        if (rest > 0)
          legacyByProduct[l.productId] = Math.max(
            0,
            (legacyByProduct[l.productId] || 0) - rest,
          );
      }
    }
  }

  // Working remaining per batch, with legacy sales consumed earliest-expiry first.
  const remaining: Record<string, number> = {};
  const productIds = Array.from(new Set(items.map((i) => i.productId)));
  for (const pid of productIds) {
    const rows = inventoryBatches
      .filter((b) => b.productId === pid)
      .sort(byFefo);
    let legacy = legacyByProduct[pid] || 0;
    for (const r of rows) {
      let rem = (Number(r.quantity) || 0) - (usedByBatch[r.id] || 0);
      const take = Math.min(Math.max(rem, 0), legacy);
      rem -= take;
      legacy -= take;
      remaining[r.id] = rem;
    }
  }

  // ---- Multi-warehouse van support -------------------------------------------------
  const batchWhById = new Map(
    inventoryBatches.map((b) => [b.id, b.warehouseId]),
  );
  const tripLoads: Record<string, Record<number, number>> = {};
  if (trip) {
    const wl = trip.warehouseLoads || {};
    for (const [whId, pMap] of Object.entries(wl)) {
      for (const [pidStr, q] of Object.entries(pMap || {})) {
        if (Number(q) > 0)
          (tripLoads[whId] ||= {})[Number(pidStr)] = Number(q);
      }
    }
    const explained: Record<number, number> = {};
    for (const pMap of Object.values(tripLoads)) {
      for (const [pidStr, q] of Object.entries(pMap)) {
        explained[Number(pidStr)] = (explained[Number(pidStr)] || 0) + q;
      }
    }
    const loadedMap = (
      typeof trip.loaded === "object" && trip.loaded !== null
        ? trip.loaded
        : {}
    ) as Record<number, number>;
    const primaryWh =
      trip.warehouseId ||
      defaultWarehouse?.id ||
      warehouses[0]?.id ||
      "wh-default";
    for (const [pidStr, q] of Object.entries(loadedMap)) {
      const pid = Number(pidStr);
      const extra = (Number(q) || 0) - (explained[pid] || 0);
      if (extra > 0) {
        (tripLoads[primaryWh] ||= {})[pid] =
          ((tripLoads[primaryWh] || {})[pid] || 0) + extra;
      }
    }
  }
  const quotaLeft: Record<string, number> = {};
  if (trip && Object.keys(tripLoads).length > 0) {
    for (const [whId, pMap] of Object.entries(tripLoads)) {
      for (const [pidStr, q] of Object.entries(pMap))
        quotaLeft[`${pidStr}|${whId}`] = q;
    }
    const whOrder = Object.keys(tripLoads);
    for (const b of bills) {
      if (excludeBillId != null && b.id === excludeBillId) continue;
      if (!billBelongsToTrip(trip, b)) continue;
      for (const it of b.items) {
        let left = Number(it.qty) || 0;
        for (const a of it.batchAllocations || []) {
          const wh = batchWhById.get(a.batchId);
          const take = Math.min(left, Number(a.qty) || 0);
          if (wh && take > 0) {
            const k = `${it.productId}|${wh}`;
            if (k in quotaLeft)
              quotaLeft[k] = Math.max(0, quotaLeft[k] - take);
            left -= take;
          }
        }
        // Old bill with no batch trail: assume it drew from the van's godowns in load order.
        for (const wh of whOrder) {
          if (left <= 0) break;
          const k = `${it.productId}|${wh}`;
          if (!(k in quotaLeft)) continue;
          const take = Math.min(left, quotaLeft[k]);
          quotaLeft[k] -= take;
          left -= take;
        }
      }
    }
  }
  const tripHasProduct = (pid: number) =>
    Object.values(tripLoads).some((pMap) => (Number(pMap[pid]) || 0) > 0);

  const out = items.map((it) => {
    const all = inventoryBatches.filter((b) => b.productId === it.productId);
    if (all.length === 0) return it; // legacy/opening-only product: nothing to allocate

    // Ordered passes of candidate batches. `capped` passes are limited by the van quota per godown.
    let passes: { batches: InventoryBatch[]; capped: boolean }[];
    if (trip && tripHasProduct(it.productId)) {
      const tripWhs = new Set(
        Object.entries(tripLoads)
          .filter(([, pMap]) => (Number(pMap[it.productId]) || 0) > 0)
          .map(([whId]) => whId),
      );
      const inTrip = all.filter((b) => tripWhs.has(b.warehouseId));
      const others = all.filter((b) => !tripWhs.has(b.warehouseId));
      passes = [
        { batches: [...inTrip].sort(byFefo), capped: true },
        { batches: [...inTrip].sort(byFefo), capped: false },
        { batches: [...others].sort(byFefo), capped: false },
      ];
    } else {
      const targetWh =
        typeof warehouseId === "object" && warehouseId !== null
          ? warehouseId[it.productId]
          : warehouseId;
      const inWh = targetWh
        ? all.filter((b) => b.warehouseId === targetWh)
        : [];
      const others = targetWh
        ? all.filter((b) => b.warehouseId !== targetWh)
        : [];
      passes = [
        {
          batches: [...(inWh.length > 0 ? inWh : all)].sort(byFefo),
          capped: false,
        },
        ...(inWh.length > 0 && others.length > 0
          ? [{ batches: [...others].sort(byFefo), capped: false }]
          : []),
      ];
    }

    let need = Number(it.qty) || 0;
    const allocations: NonNullable<BillItem["batchAllocations"]> = [];
    const expiredSeen = new Set<string>();
    let expiredSkipped = 0;
    for (const pass of passes) {
      for (const b of pass.batches) {
        if (need <= 0) break;
        const rem = remaining[b.id] ?? 0;
        if (rem <= 0) continue;
        if (b.expiryDate && b.expiryDate.slice(0, 10) < today) {
          if (!expiredSeen.has(b.id)) {
            expiredSeen.add(b.id);
            expiredSkipped += rem;
          }
          continue;
        }
        const qKey = `${it.productId}|${b.warehouseId}`;
        const cap = pass.capped
          ? (quotaLeft[qKey] ?? 0)
          : Number.POSITIVE_INFINITY;
        const take = Math.min(rem, need, cap);
        if (take <= 0) continue;
        const existing = allocations.find((a) => a.batchId === b.id);
        if (existing) existing.qty += take;
        else
          allocations.push({
            batchId: b.id,
            batchNumber: b.batchNumber,
            expiryDate: b.expiryDate,
            qty: take,
          });
        remaining[b.id] = rem - take;
        if (qKey in quotaLeft)
          quotaLeft[qKey] = Math.max(0, quotaLeft[qKey] - take);
        need -= take;
      }
      if (need <= 0) break;
    }

    if (need > 0 && all.length > 0) {
      const nonExpired = all.filter(
        (b) => !b.expiryDate || b.expiryDate.slice(0, 10) >= today,
      );
      const candidatePool = nonExpired.length > 0 ? nonExpired : all;
      const fallbackBatch =
        candidatePool.find(
          (b) => b.warehouseId && tripLoads[b.warehouseId],
        ) || candidatePool[0];

      if (fallbackBatch) {
        const existing = allocations.find(
          (a) => a.batchId === fallbackBatch.id,
        );
        if (existing) {
          existing.qty += need;
        } else {
          allocations.push({
            batchId: fallbackBatch.id,
            batchNumber: fallbackBatch.batchNumber || fallbackBatch.id,
            expiryDate: fallbackBatch.expiryDate,
            qty: need,
          });
        }
        remaining[fallbackBatch.id] =
          (remaining[fallbackBatch.id] ?? 0) - need;
        need = 0;
      }
    }

    if (need > 0) {
      if (trip) {
        allocations.push({
          batchId: `trip_${trip.id}_${it.productId}`,
          batchNumber: `VAN-${trip.vehicle}`,
          expiryDate: it.expiryDate || "2027-12-31",
          qty: need,
        });
        need = 0;
      } else {
        problems.push(
          expiredSkipped > 0
            ? `${it.productName}: ${expiredSkipped} in stock but expired (only non-expired stock can be sold)`
            : `${it.productName}: short by ${need} in batch stock`,
        );
        return it;
      }
    }
    return {
      ...it,
      batchNumber: Array.from(
        new Set(allocations.map((a) => a.batchNumber)),
      ).join(", "),
      expiryDate: allocations[0]?.expiryDate,
      batchAllocations: allocations,
    };
  });
  return { items: out, problems };
}

export function calcProductWarehouseStock(params: {
  productId: number;
  products: Product[];
  warehouses: Warehouse[];
  inventoryBatches: InventoryBatch[];
  bills: Bill[];
  editingBillId: number | null;
  ledgerAdjByProduct: Record<number, number>;
  ledgerAdjByProductWh: Record<string, number>;
  restockByProduct: Record<number, number>;
  soldByProduct: Record<number, number>;
  cartSoldByProduct: Record<number, number>;
  disposedByProduct: Record<number, number>;
  disposedInWhByProduct: Record<string, number>;
  cart: CartState;
  trips: Trip[];
}): { warehouseId: string; warehouseName: string; crates: number }[] {
  const {
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
  } = params;

  const p = products.find((x) => x.id === productId);
  if (!p) return [];

  if (warehouses.length === 0 || warehouses.length === 1) {
    const baseStock =
      calcBaseStockFor(p, inventoryBatches) +
      (ledgerAdjByProduct[productId] || 0) +
      (restockByProduct[productId] || 0);
    const rem = Math.max(
      0,
      baseStock -
        (soldByProduct[productId] || 0) -
        (cartSoldByProduct[productId] || 0) -
        (disposedByProduct[productId] || 0),
    );
    const wId = warehouses[0]?.id || "default";
    const wName = warehouses[0]?.name || "Main Depot";
    return [{ warehouseId: wId, warehouseName: wName, crates: rem }];
  }

  const fallbackWh = calcFallbackWarehouseId(p, warehouses);
  const validWhIds = new Set(warehouses.map((w) => w.id));
  const whOf = (id?: string) => (id && validWhIds.has(id) ? id : fallbackWh);
  const batchWh = new Map(inventoryBatches.map((b) => [b.id, b.warehouseId]));

  const soldInWh: Record<string, number> = {};
  const addSold = (whId: string, qty: number) => {
    soldInWh[whId] = (soldInWh[whId] || 0) + qty;
  };
  for (const b of bills) {
    if (b.id === editingBillId) continue;
    for (const it of b.items) {
      if (it.productId !== productId) continue;
      let left = Number(it.qty) || 0;
      for (const a of it.batchAllocations || []) {
        const wh = batchWh.get(a.batchId);
        if (!wh) continue;
        const take = Math.min(left, Number(a.qty) || 0);
        if (take > 0) {
          addSold(wh, take);
          left -= take;
        }
      }
      if (left > 0) {
        const tr = calcFindTripOfBill(b, trips);
        const tripWh = tr ? tripPrimaryWarehouseId(tr, validWhIds) : "";
        addSold(tripWh || whOf(b.warehouseId), left);
      }
    }
  }
  const cartQty = cartSoldByProduct[productId] || 0;
  if (cartQty > 0) {
    const cartTrip =
      cart.tripId != null
        ? trips.find((t) => Number(t.id) === Number(cart.tripId))
        : null;
    const cartWh = cartTrip
      ? tripPrimaryWarehouseId(cartTrip, validWhIds) || whOf(cart.warehouseId)
      : whOf(cart.warehouseId);
    addSold(cartWh, cartQty);
  }

  const restockedInWh: Record<string, number> = {};
  for (const b of bills) {
    const billTrip = (b.returns || []).length > 0 ? calcFindTripOfBill(b, trips) : null;
    const billFallbackWh =
      (b.warehouseId && validWhIds.has(b.warehouseId) ? b.warehouseId : "") ||
      (billTrip ? tripPrimaryWarehouseId(billTrip, validWhIds) : "");
    for (const r of b.returns || []) {
      for (const l of r.lines) {
        if (l.productId === productId && l.restockQty > 0) {
          for (const d of restockDestinations(l, billFallbackWh || b.warehouseId)) {
            const wh = whOf(d.warehouseId);
            restockedInWh[wh] = (restockedInWh[wh] || 0) + d.qty;
          }
        }
      }
    }
  }

  return warehouses.map((w) => {
    const batchSum = inventoryBatches
      .filter((b) => b.productId === productId && b.warehouseId === w.id)
      .reduce((sum, b) => sum + (Number(b.quantity) || 0), 0);

    const dispWh = disposedInWhByProduct[`${productId}|${w.id}`] || 0;
    const base =
      (inventoryBatches.some((b) => b.productId === productId)
        ? batchSum
        : p.warehouseId === w.id
          ? p.opening
          : 0) +
      (ledgerAdjByProductWh[`${productId}|${w.id}`] || 0) +
      (restockedInWh[w.id] || 0) -
      dispWh;
    return {
      warehouseId: w.id,
      warehouseName: w.name,
      crates: base - (soldInWh[w.id] || 0),
    };
  });
}

export function calcStockAsOf(params: {
  productId: number;
  dateISO: string;
  warehouseId?: string;
  products: Product[];
  warehouses: Warehouse[];
  inventoryBatches: InventoryBatch[];
  bills: Bill[];
  audits: Audit[];
  stockLedgerEntries: StockLedgerEntry[];
  inventoryDispositions: InventoryDisposition[];
  trips: Trip[];
  currentStock: number;
}): number {
  const {
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
    currentStock,
  } = params;

  const day = String(dateISO || "").slice(0, 10);
  if (!day || day >= todayISO()) return currentStock;
  const later = (d?: string) => String(d || "").slice(0, 10) > day;
  const p = products.find((x) => x.id === productId);
  const fallbackWh = p ? calcFallbackWarehouseId(p, warehouses) : "";
  const validWhIds = new Set(warehouses.map((w) => w.id));
  const whOf = (id?: string) => (id && validWhIds.has(id) ? id : fallbackWh);
  const batchWh = new Map(inventoryBatches.map((b) => [b.id, b.warehouseId]));
  const inScope = (wh?: string) => !warehouseId || whOf(wh) === warehouseId;

  let sold = 0;
  let restocked = 0;
  for (const b of bills) {
    if (later(b.date)) {
      for (const it of b.items) {
        if (it.productId !== productId) continue;
        let left = Number(it.qty) || 0;
        for (const a of it.batchAllocations || []) {
          const take = Math.min(left, Number(a.qty) || 0);
          if (take > 0) {
            if (inScope(batchWh.get(a.batchId))) sold += take;
            left -= take;
          }
        }
        if (left > 0) {
          const tr = calcFindTripOfBill(b, trips);
          const tripWh = tr ? tripPrimaryWarehouseId(tr, validWhIds) : "";
          if (inScope(tripWh || b.warehouseId)) sold += left;
        }
      }
    }
    const billTrip = (b.returns || []).length > 0 ? calcFindTripOfBill(b, trips) : null;
    const billFallbackWh =
      (b.warehouseId && validWhIds.has(b.warehouseId) ? b.warehouseId : "") ||
      (billTrip ? tripPrimaryWarehouseId(billTrip, validWhIds) : "");
    for (const r of b.returns || []) {
      if (!later(r.date)) continue;
      for (const l of r.lines) {
        if (l.productId !== productId || !(l.restockQty > 0)) continue;
        for (const d of restockDestinations(l, billFallbackWh || b.warehouseId)) {
          if (inScope(d.warehouseId)) restocked += d.qty;
        }
      }
    }
  }
  const received = inventoryBatches
    .filter(
      (b) =>
        b.productId === productId &&
        !String(b.id).startsWith("batch_xfer_") &&
        later(b.inwardDate) &&
        (!warehouseId || b.warehouseId === warehouseId),
    )
    .reduce((sum, b) => sum + (Number(b.quantity) || 0), 0);
  let adjusted = 0;
  for (const a of audits) {
    if (!a.adjusted || !later(a.date)) continue;
    for (const e of a.entries) {
      if (e.productId !== productId) continue;
      if (warehouseId && e.warehouseId !== warehouseId) continue;
      adjusted += Number(e.diff) || 0;
    }
  }
  let ledgerLater = 0;
  for (const e of stockLedgerEntries) {
    if (e.productId !== productId || !later(e.timestamp)) continue;
    if (warehouseId && e.warehouseId !== warehouseId) continue;
    ledgerLater += Number(e.quantity) || 0;
  }
  let writtenOffLater = 0;
  for (const d of inventoryDispositions) {
    if (d.productId !== productId || d.stockApplied === false || !later(d.eventDate)) continue;
    if (warehouseId && d.warehouseId !== warehouseId) continue;
    writtenOffLater += Number(d.quantity) || 0;
  }
  return Math.max(0, currentStock + sold - received - restocked - adjusted - ledgerLater + writtenOffLater);
}
