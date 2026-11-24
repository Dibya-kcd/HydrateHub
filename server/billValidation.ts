import {
  calcFindTripOfBill,
  calcGetVehicleStock,
  calcProductWarehouseStock,
  calcStockShortfalls,
} from "../src/context/ledgerStockCalculations";
import {
  computeCustomerLedger,
  computeExistingCustomers,
  resolveMasterCustomerIdInList,
} from "../src/context/ledgerCustomerCalculations";
import type {
  Audit,
  Bill,
  BillItem,
  CartState,
  Customer,
  InventoryBatch,
  InventoryDisposition,
  PaymentRecord,
  Product,
  StockLedgerEntry,
  Trip,
  Warehouse,
} from "../src/types";
import { applyBillExtra } from "../src/utils/billExtra";
import { normCustomerName, realLast10Phone } from "../src/utils/customerDedupe";
import { billBalance, billReturnCredit, restockedByProduct, round2 } from "../src/utils/salesReturns";
import { resolveBillWarehouseId } from "../src/utils/tripLoads";
import { getCollectionData } from "./supabaseStore";

export interface ServerLedgerValidationState {
  bills: any[];
  products: Product[];
  customers: Customer[];
  payments: PaymentRecord[];
  trips: Trip[];
  warehouses: Warehouse[];
  inventoryBatches: InventoryBatch[];
  stockLedgerEntries: StockLedgerEntry[];
  inventoryDispositions: InventoryDisposition[];
  audits: Audit[];
  existingBill?: any | null;
}

export type BillValidationResult =
  | { ok: true }
  | {
      ok: false;
      status: 409;
      code: "INSUFFICIENT_STOCK" | "CREDIT_LIMIT_EXCEEDED";
      error: string;
      shortfalls?: {
        productId: number;
        productName: string;
        available: number;
        required: number;
      }[];
    };

export function normalizeBillForValidation(raw: any): Bill {
  const base =
    raw && raw.amountPaid === undefined && raw.amount_paid !== undefined
      ? applyBillExtra(
          {
            ...raw,
            amountPaid: Number(raw.amount_paid) || 0,
            warehouseId: raw.warehouseId ?? raw.warehouse_id ?? "",
            salesmanId: raw.salesmanId ?? raw.salesman_id ?? undefined,
          },
          raw.extra,
        )
      : { ...(raw || {}) };

  const rawItems = Array.isArray(base.items) ? base.items : [];
  const items: BillItem[] = rawItems.map((it: any, idx: number) => ({
    ...it,
    key: it?.key ?? `${Number(it?.productId ?? it?.product_id ?? it?.id ?? idx)}`,
    productId: Number(it?.productId ?? it?.product_id ?? it?.id ?? 0),
    productName: String(it?.productName ?? it?.product_name ?? it?.name ?? `Product #${it?.productId ?? idx}`),
    qty: Number(it?.qty ?? it?.quantity ?? 0) || 0,
    freeQty: Number(it?.freeQty ?? it?.free_qty ?? 0) || 0,
  }));

  return {
    ...base,
    id: Number(base.id),
    retailer: String(base.retailer || base.customerName || base.customer_name || ""),
    phone: String(base.phone || ""),
    date: String(base.date || ""),
    total: Number(base.total || 0),
    amountPaid: Number(base.amountPaid !== undefined ? base.amountPaid : base.amount_paid || 0),
    warehouseId: base.warehouseId ?? base.warehouse_id ?? "",
    tripId: base.tripId !== undefined ? base.tripId : base.trip_id,
    customerId: base.customerId ?? base.customer_id,
    returns: Array.isArray(base.returns) ? base.returns : [],
    items,
  } as Bill;
}

function findMatchingCustomerForBill(bill: Bill, customers: Customer[]): Customer | undefined {
  if (bill.customerId) {
    const byId = customers.find((c) => c.id === bill.customerId);
    if (byId) return byId;
  }
  const resolvedId = resolveMasterCustomerIdInList(customers, bill.retailer, bill.phone);
  if (resolvedId) {
    const byResolved = customers.find((c) => c.id === resolvedId);
    if (byResolved) return byResolved;
  }
  const key = normCustomerName(bill.retailer);
  if (!key) return undefined;
  const matches = customers.filter(
    (c) =>
      normCustomerName(c.name) === key ||
      (c.aliases || []).some((a) => normCustomerName(a) === key),
  );
  if (matches.length === 1) return matches[0];
  const phone10 = realLast10Phone(bill.phone);
  if (matches.length > 1 && phone10) {
    const byPhone = matches.find(
      (c) => realLast10Phone(c.phone) === phone10 || realLast10Phone(c.altPhone) === phone10,
    );
    if (byPhone) return byPhone;
  }
  return matches[0];
}

function qtyByProductMap(items: BillItem[]): Record<number, number> {
  const m: Record<number, number> = {};
  for (const it of items) {
    const pid = Number(it.productId);
    if (!Number.isFinite(pid) || pid <= 0) continue;
    m[pid] = (m[pid] || 0) + (Number(it.qty) || 0);
  }
  return m;
}

export function validateBillAgainstLedger(
  candidateRaw: any,
  state: ServerLedgerValidationState,
): BillValidationResult {
  const candidate = normalizeBillForValidation(candidateRaw);
  const existing = state.existingBill ? normalizeBillForValidation(state.existingBill) : null;

  // Cancelling a bill or saving a cancelled invoice must always be allowed.
  if (
    candidate.status === "cancelled" ||
    Boolean((candidate as any).cancelled) ||
    Boolean(candidate.cancellation)
  ) {
    return { ok: true };
  }

  const activeBills = (state.bills || [])
    .map(normalizeBillForValidation)
    .filter(
      (b) =>
        b.status !== "cancelled" &&
        !Boolean((b as any).cancelled) &&
        !Boolean(b.cancellation),
    );

  // 1. Stock availability check (godown or active trip van)
  if (candidate.items.length > 0 && state.products.length > 0) {
    let shouldCheckStock = true;
    if (existing) {
      const sameTrip =
        (candidate.tripId ?? null) === (existing.tripId ?? null);
      const sameWarehouse =
        String(candidate.warehouseId || "") === String(existing.warehouseId || "");
      if (sameTrip && sameWarehouse) {
        const oldNeed = qtyByProductMap(existing.items);
        const newNeed = qtyByProductMap(candidate.items);
        const increased = Object.keys(newNeed).some(
          (pidStr) => newNeed[Number(pidStr)] > (oldNeed[Number(pidStr)] || 0),
        );
        if (!increased) {
          // Pure payment / return / price edit with identical or lower quantities
          shouldCheckStock = false;
        }
      }
    }

    if (shouldCheckStock) {
      const excludeBillId = existing ? Number(existing.id) : null;
      const matchedTrip = calcFindTripOfBill(candidate, state.trips);
      const defaultWarehouse = state.warehouses.find((w) => w.isDefault);
      const resolvedWarehouseId = resolveBillWarehouseId({
        trip: matchedTrip,
        cartWarehouseId: candidate.warehouseId,
        defaultWarehouseId: defaultWarehouse?.id,
        warehouses: state.warehouses,
      });

      const soldByProduct: Record<number, number> = {};
      for (const b of activeBills) {
        if (excludeBillId != null && Number(b.id) === excludeBillId) continue;
        for (const it of b.items) {
          soldByProduct[it.productId] =
            (soldByProduct[it.productId] || 0) + (Number(it.qty) || 0);
        }
      }

      const ledgerAdjByProduct: Record<number, number> = {};
      const ledgerAdjByProductWh: Record<string, number> = {};
      for (const e of state.stockLedgerEntries) {
        ledgerAdjByProduct[e.productId] =
          (ledgerAdjByProduct[e.productId] || 0) + (Number(e.quantity) || 0);
        if (e.warehouseId) {
          const k = `${e.productId}|${e.warehouseId}`;
          ledgerAdjByProductWh[k] =
            (ledgerAdjByProductWh[k] || 0) + (Number(e.quantity) || 0);
        }
      }
      for (const a of state.audits) {
        if (!a.adjusted) continue;
        for (const e of a.entries || []) {
          if (!e.warehouseId) continue;
          ledgerAdjByProduct[e.productId] =
            (ledgerAdjByProduct[e.productId] || 0) + (Number(e.diff) || 0);
          const k = `${e.productId}|${e.warehouseId}`;
          ledgerAdjByProductWh[k] =
            (ledgerAdjByProductWh[k] || 0) + (Number(e.diff) || 0);
        }
      }

      const restockByProduct = restockedByProduct(activeBills);
      const disposedByProduct: Record<number, number> = {};
      const disposedInWhByProduct: Record<string, number> = {};
      for (const d of state.inventoryDispositions) {
        if (d.stockApplied !== false) {
          disposedByProduct[d.productId] =
            (disposedByProduct[d.productId] || 0) + (Number(d.quantity) || 0);
          if (d.warehouseId) {
            const k = `${d.productId}|${d.warehouseId}`;
            disposedInWhByProduct[k] =
              (disposedInWhByProduct[k] || 0) + (Number(d.quantity) || 0);
          }
        }
      }

      const emptyCart: CartState = {
        retailer: "",
        phone: "",
        items: [],
        additionalDiscount: 0,
      };
      const emptyCartSold: Record<number, number> = {};

      const getVehicleStock = (trip: Trip | null | undefined, productId: number) =>
        calcGetVehicleStock(trip, productId, activeBills);

      const warehouseStock = (warehouseId: string, productId?: number): number => {
        if (productId) {
          const rows = calcProductWarehouseStock({
            productId,
            products: state.products,
            warehouses: state.warehouses,
            inventoryBatches: state.inventoryBatches,
            bills: activeBills,
            editingBillId: excludeBillId,
            ledgerAdjByProduct,
            ledgerAdjByProductWh,
            restockByProduct,
            soldByProduct,
            cartSoldByProduct: emptyCartSold,
            disposedByProduct,
            disposedInWhByProduct,
            cart: emptyCart,
            trips: state.trips,
          });
          if (!warehouseId) {
            return rows.reduce((sum, r) => sum + Math.max(0, r.crates), 0);
          }
          const match = rows.find((r) => r.warehouseId === warehouseId);
          return match ? Math.max(0, match.crates) : 0;
        }
        return 0;
      };

      const shortfalls = calcStockShortfalls({
        items: candidate.items,
        excludeBillId,
        trip: matchedTrip,
        warehouseId: resolvedWarehouseId,
        products: state.products,
        bills: activeBills,
        inventoryBatches: state.inventoryBatches,
        ledgerAdjByProduct,
        restockByProduct,
        disposedByProduct,
        getVehicleStock,
        warehouseStock,
      });

      if (shortfalls.length > 0) {
        const detail = shortfalls
          .map(
            (s) =>
              `${s.productName}: need ${s.required}, only ${Math.max(0, s.available)} available` +
              (matchedTrip ? ` on van (${matchedTrip.vehicle})` : ""),
          )
          .join("; ");
        return {
          ok: false,
          status: 409,
          code: "INSUFFICIENT_STOCK",
          error: `Cannot save this bill — insufficient stock: ${detail}`,
          shortfalls,
        };
      }
    }
  }

  // 2. Customer credit limit check
  const retailer = String(candidate.retailer || "").trim();
  const isCashParty =
    !retailer ||
    retailer.toLowerCase() === "cash sale" ||
    retailer.toLowerCase() === "spot cash";
  const thisCredit = Math.max(
    0,
    round2(
      (Number(candidate.total) || 0) -
        billReturnCredit(candidate) -
        (Number(candidate.amountPaid) || 0),
    ),
  );

  if (!isCashParty && thisCredit > 0.005) {
    const prevCredit = existing ? billBalance(existing) : 0;
    const creditNotIncreased = Boolean(existing && thisCredit <= prevCredit + 0.005);
    if (!creditNotIncreased) {
      const cust = findMatchingCustomerForBill(candidate, state.customers);
      const existingCustomers = computeExistingCustomers({
        customers: state.customers,
        bills: activeBills,
        payments: state.payments,
        hiddenCustNames: new Set(),
      });
      const existingMatch = existingCustomers.find(
        (ec) =>
          (cust && ec.id === cust.id) ||
          normCustomerName(ec.name) === normCustomerName(retailer),
      );
      const limit =
        Number(cust?.creditLimit) || Number(existingMatch?.creditLimit) || 0;

      if (limit > 0) {
        const led = computeCustomerLedger({
          customerNameOrId: cust?.id || retailer,
          customerPhone: candidate.phone,
          customers: state.customers,
          existingCustomers,
          bills: activeBills,
          payments: state.payments,
        });
        let existingDue = led.rawBalance;
        if (existing) {
          const eb = led.bills.find((b) => Number(b.id) === Number(existing.id));
          if (eb) existingDue -= billBalance(eb);
        }
        existingDue = Math.max(0, Math.round(existingDue * 100) / 100);
        if (existingDue + thisCredit > limit + 0.009) {
          return {
            ok: false,
            status: 409,
            code: "CREDIT_LIMIT_EXCEEDED",
            error:
              `Credit limit exceeded for ${retailer}. ` +
              `Limit ₹${limit.toLocaleString("en-IN")} · Already due ₹${existingDue.toLocaleString("en-IN", { maximumFractionDigits: 0 })} · ` +
              `This bill credit ₹${thisCredit.toLocaleString("en-IN", { maximumFractionDigits: 0 })}. ` +
              `Collect more payment or reduce the bill.`,
          };
        }
      }
    }
  }

  return { ok: true };
}

export async function loadServerValidationContext(): Promise<
  Omit<ServerLedgerValidationState, "existingBill" | "bills">
> {
  const [
    products,
    customers,
    payments,
    trips,
    warehouses,
    inventoryBatches,
    stockLedgerEntries,
    inventoryDispositions,
    audits,
  ] = await Promise.all([
    getCollectionData("products").catch(() => []),
    getCollectionData("customers").catch(() => []),
    getCollectionData("payments").catch(() => []),
    getCollectionData("trips").catch(() => []),
    getCollectionData("warehouses").catch(() => []),
    getCollectionData("inventory_batches").catch(() => []),
    getCollectionData("stock_ledger_entries").catch(() => []),
    getCollectionData("inventory_dispositions").catch(() => []),
    getCollectionData("audits").catch(() => []),
  ]);

  return {
    products: Array.isArray(products) ? products : [],
    customers: Array.isArray(customers) ? customers : [],
    payments: Array.isArray(payments) ? payments : [],
    trips: Array.isArray(trips) ? trips : [],
    warehouses: Array.isArray(warehouses) ? warehouses : [],
    inventoryBatches: Array.isArray(inventoryBatches) ? inventoryBatches : [],
    stockLedgerEntries: Array.isArray(stockLedgerEntries) ? stockLedgerEntries : [],
    inventoryDispositions: Array.isArray(inventoryDispositions)
      ? inventoryDispositions
      : [],
    audits: Array.isArray(audits) ? audits : [],
  };
}
