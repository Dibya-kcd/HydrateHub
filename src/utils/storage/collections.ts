import {
  AuditSession,
  AuthUser,
  Customer,
  InventoryDisposition,
  PaymentRecord,
  ReconciliationTransaction,
  Salesman,
  StockLedgerEntry,
  SupplierCreditNote,
  SupplierScheme,
  SupplierSchemeApplication,
} from "../../types";
import { dropDeletedFromList } from "../../lib/supabase";
import {
  BusinessExpenseRecord,
  DailyVehicleTrip,
  InventoryItem,
  Order,
  Partner,
  PromotionalScheme,
  STORAGE_KEYS,
  StockTransaction,
  Warehouse,
  WarehouseBay,
} from "./types";
import { readLocalCache, writeLocalCache } from "./syncState";
import { fetchFromServer, postOrPutServer, recordSeen } from "./outboxAndTransport";

/* -------------------------------------------------------------------------
 * Shared list/heal helpers to remove repeated load / save / loadCached blocks
 * while preserving exact storage keys, merge order, and sync semantics.
 * ------------------------------------------------------------------------- */
async function loadList<T>(
  url: string,
  cacheKey: string,
  opts?: {
    seenKind?: "bills" | "trips" | "customers" | "payments";
    tombstoneKind?: "payment" | "customer";
  },
): Promise<T[]> {
  const raw = await fetchFromServer<T[]>(url);
  if (raw !== null && Array.isArray(raw)) {
    const serverData = opts?.tombstoneKind
      ? await dropDeletedFromList(opts.tombstoneKind, raw)
      : raw;
    writeLocalCache(cacheKey, serverData);
    if (opts?.seenKind) recordSeen(opts.seenKind, serverData);
    return serverData;
  }
  return readLocalCache<T[]>(cacheKey, []);
}

async function loadAndHealList<T extends { id: string }>(
  url: string,
  cacheKey: string,
): Promise<T[]> {
  const localData = readLocalCache<T[]>(cacheKey, []);
  const serverData = await fetchFromServer<T[]>(url);
  if (serverData !== null && Array.isArray(serverData)) {
    if (serverData.length > 0) {
      const map = new Map(localData.map((row) => [row.id, row]));
      serverData.forEach((row) => map.set(row.id, row));
      const merged = Array.from(map.values());
      writeLocalCache(cacheKey, merged);
      return merged;
    } else if (localData.length > 0) {
      // Server returned empty collection but local cache has records -> heal the server collection
      postOrPutServer(url, "PUT", { data: localData });
      return localData;
    }
  }
  return localData;
}

/* =========================================================================
 * 1. ORDERS
 * ========================================================================= */
export function loadCachedOrders(): Order[] {
  return readLocalCache<Order[]>(STORAGE_KEYS.orders, []);
}

export async function loadOrders(): Promise<Order[]> {
  return loadList<Order>("/api/bills", STORAGE_KEYS.orders, { seenKind: "bills" });
}

export async function saveOrders(orders: Order[]): Promise<void> {
  writeLocalCache(STORAGE_KEYS.orders, orders);
  // Persist to server via /api/bills which syncs to Supabase public.bills
  postOrPutServer("/api/bills", "PUT", { bills: orders });
}

/* =========================================================================
 * 1B. DELIVERY TRIPS (Supabase public.trips)
 * ========================================================================= */
export async function loadTrips(): Promise<any[]> {
  return loadList<any>("/api/trips", STORAGE_KEYS.trips, { seenKind: "trips" });
}

export function loadCachedTrips(): any[] {
  return readLocalCache<any[]>(STORAGE_KEYS.trips, []);
}

export async function saveTrips(trips: any[]): Promise<void> {
  writeLocalCache(STORAGE_KEYS.trips, trips);
  postOrPutServer("/api/trips", "PUT", { trips });
}

/* =========================================================================
 * 1C. SETTINGS (Supabase public.billing_settings & organization_profile)
 * ========================================================================= */
export function loadCachedBillingSettings(): any | null {
  return readLocalCache<any | null>(STORAGE_KEYS.billing_settings, null);
}

export async function loadBillingSettings(): Promise<any | null> {
  const serverData = await fetchFromServer<any>("/api/settings/billing");
  if (serverData !== null) {
    writeLocalCache(STORAGE_KEYS.billing_settings, serverData);
    return serverData;
  }
  return readLocalCache<any | null>(STORAGE_KEYS.billing_settings, null);
}

/** Remember the billing settings on THIS device only (nothing is sent anywhere). */
export function cacheBillingSettingsLocally(settings: any): void {
  writeLocalCache(STORAGE_KEYS.billing_settings, settings);
  try {
    if (typeof localStorage !== "undefined") {
      const legacyKey = "mrwater_distribution_ledger_v4";
      const raw = localStorage.getItem(legacyKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        parsed.billingSettings = settings;
        localStorage.setItem(legacyKey, JSON.stringify(parsed));
      }
    }
  } catch {}
}

/**
 * THE one way billing settings are saved: this device first, then the server (which writes billing_settings in
 * Supabase). Resolves true only when the server accepted it; false means "kept on this device, will retry".
 */
export async function saveBillingSettings(settings: any): Promise<boolean> {
  cacheBillingSettingsLocally(settings);
  return postOrPutServer("/api/settings/billing", "POST", { settings });
}

export async function loadOrgProfile(): Promise<any | null> {
  const serverData = await fetchFromServer<any>("/api/settings/profile");
  if (serverData !== null) {
    writeLocalCache(STORAGE_KEYS.org_profile, serverData);
    return serverData;
  }
  return readLocalCache<any | null>(STORAGE_KEYS.org_profile, null);
}

export async function saveOrgProfile(profile: any): Promise<void> {
  writeLocalCache(STORAGE_KEYS.org_profile, profile);
  postOrPutServer("/api/settings/profile", "POST", { profile });
}

/* =========================================================================
 * 1D. PAYMENTS & COLLECTIONS (Supabase / Local Cache)
 * ========================================================================= */
export function loadCachedPayments(): PaymentRecord[] {
  return readLocalCache<PaymentRecord[]>(STORAGE_KEYS.payments, []);
}

export async function loadPayments(): Promise<PaymentRecord[]> {
  return loadList<PaymentRecord>("/api/payments", STORAGE_KEYS.payments, {
    tombstoneKind: "payment",
    seenKind: "payments",
  });
}

export async function savePayments(payments: PaymentRecord[]): Promise<void> {
  writeLocalCache(STORAGE_KEYS.payments, payments);
  const safe = await dropDeletedFromList("payment", payments).catch(() => payments);
  postOrPutServer("/api/payments", "PUT", { payments: safe });
}

/* =========================================================================
 * 1E. CUSTOMERS & RETAILERS MASTER (Supabase / Local Cache)
 * ========================================================================= */
export function loadCachedCustomers(): Customer[] {
  return readLocalCache<Customer[]>(STORAGE_KEYS.customers, []);
}

export async function loadCustomers(): Promise<Customer[]> {
  return loadList<Customer>("/api/customers", STORAGE_KEYS.customers, {
    tombstoneKind: "customer",
    seenKind: "customers",
  });
}

export async function saveCustomers(customers: Customer[]): Promise<void> {
  writeLocalCache(STORAGE_KEYS.customers, customers);
  const safe = await dropDeletedFromList("customer", customers).catch(() => customers);
  postOrPutServer("/api/customers", "PUT", { customers: safe });
}

/* =========================================================================
 * 1F. GRNS & INWARD INVOICES (Supabase public.grns & collections)
 * ========================================================================= */
export function loadCachedGrns(): any[] {
  return readLocalCache<any[]>(STORAGE_KEYS.grns, []);
}

export async function loadGrns(): Promise<any[]> {
  return loadList<any>("/api/grns", STORAGE_KEYS.grns);
}

export async function saveGrns(grns: any[]): Promise<void> {
  writeLocalCache(STORAGE_KEYS.grns, grns);
  postOrPutServer("/api/grns", "PUT", { grns });
}

/* =========================================================================
 * 2. PARTNERS (Retailers, Customers, Suppliers)
 * ========================================================================= */
export async function loadPartners(): Promise<Partner[]> {
  return loadList<Partner>("/api/collections/partners", STORAGE_KEYS.partners);
}

export async function savePartners(partners: Partner[]): Promise<void> {
  writeLocalCache(STORAGE_KEYS.partners, partners);
  postOrPutServer("/api/collections/partners", "PUT", { data: partners });
}

/* =========================================================================
 * SUPPLIER SCHEME & INCENTIVE SYSTEM (generic app_collections-backed, mirrors Partners)
 * ========================================================================= */
export function loadCachedSupplierSchemes(): SupplierScheme[] {
  return readLocalCache<SupplierScheme[]>(STORAGE_KEYS.supplier_schemes, []);
}

export async function loadSupplierSchemes(): Promise<SupplierScheme[]> {
  return loadList<SupplierScheme>(
    "/api/collections/supplier_schemes",
    STORAGE_KEYS.supplier_schemes,
  );
}

export async function saveSupplierSchemes(schemes: SupplierScheme[]): Promise<void> {
  writeLocalCache(STORAGE_KEYS.supplier_schemes, schemes);
  postOrPutServer("/api/collections/supplier_schemes", "PUT", { data: schemes });
}

export async function loadSupplierSchemeApplications(): Promise<SupplierSchemeApplication[]> {
  return loadList<SupplierSchemeApplication>(
    "/api/collections/supplier_scheme_applications",
    STORAGE_KEYS.supplier_scheme_applications,
  );
}

export async function saveSupplierSchemeApplications(
  apps: SupplierSchemeApplication[],
): Promise<void> {
  writeLocalCache(STORAGE_KEYS.supplier_scheme_applications, apps);
  postOrPutServer("/api/collections/supplier_scheme_applications", "PUT", { data: apps });
}

export function loadCachedSupplierCreditNotes(): SupplierCreditNote[] {
  return readLocalCache<SupplierCreditNote[]>(STORAGE_KEYS.supplier_credit_notes, []);
}

export async function loadSupplierCreditNotes(): Promise<SupplierCreditNote[]> {
  return loadList<SupplierCreditNote>(
    "/api/collections/supplier_credit_notes",
    STORAGE_KEYS.supplier_credit_notes,
  );
}

export async function saveSupplierCreditNotes(notes: SupplierCreditNote[]): Promise<void> {
  writeLocalCache(STORAGE_KEYS.supplier_credit_notes, notes);
  postOrPutServer("/api/collections/supplier_credit_notes", "PUT", { data: notes });
}

/* =========================================================================
 * SMART STOCK RECONCILIATION & AUDIT (generic app_collections-backed, mirrors above)
 * ========================================================================= */
export async function loadInventoryDispositions(): Promise<InventoryDisposition[]> {
  return loadList<InventoryDisposition>(
    "/api/collections/inventory_dispositions",
    STORAGE_KEYS.inventory_dispositions,
  );
}

export async function saveInventoryDispositions(rows: InventoryDisposition[]): Promise<void> {
  writeLocalCache(STORAGE_KEYS.inventory_dispositions, rows);
  postOrPutServer("/api/collections/inventory_dispositions", "PUT", { data: rows });
}

export function loadCachedInventoryDispositions(): InventoryDisposition[] {
  return readLocalCache<InventoryDisposition[]>(STORAGE_KEYS.inventory_dispositions, []);
}

/* =========================================================================
 * BUSINESS EXPENSES (Business reports -> Profit & loss), app_collections-backed
 * ========================================================================= */
/** Newest edit wins; entries in `dead` (deleted by the owner) are always dropped. */
export function mergeExpenseLists(
  dead: Set<string>,
  ...lists: BusinessExpenseRecord[][]
): BusinessExpenseRecord[] {
  const map = new Map<string, BusinessExpenseRecord>();
  for (const l of lists) {
    for (const r of l || []) {
      if (!r || !r.id || dead.has(r.id)) continue;
      const cur = map.get(r.id);
      if (!cur || (Date.parse(r.updatedAt || "") || 0) > (Date.parse(cur.updatedAt || "") || 0)) {
        map.set(r.id, r);
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

export function loadCachedBusinessExpenses(): BusinessExpenseRecord[] {
  return readLocalCache<BusinessExpenseRecord[]>(STORAGE_KEYS.business_expenses, []);
}

export async function loadBusinessExpenses(): Promise<BusinessExpenseRecord[]> {
  return loadList<BusinessExpenseRecord>(
    "/api/collections/business_expenses",
    STORAGE_KEYS.business_expenses,
  );
}

/**
 * Saves the expense list WITHOUT overwriting what other devices added: the server copy is read first,
 * merged (newest edit wins, deleted ids dropped) and only then written. Returns the merged list so the
 * caller can show entries that were added elsewhere.
 */
export async function saveBusinessExpenses(
  rows: BusinessExpenseRecord[],
  dead: Set<string> = new Set(),
): Promise<BusinessExpenseRecord[]> {
  let merged = mergeExpenseLists(dead, rows);
  try {
    const server = await fetchFromServer<BusinessExpenseRecord[]>(
      "/api/collections/business_expenses",
    );
    if (Array.isArray(server)) merged = mergeExpenseLists(dead, server, rows);
  } catch {
    /* keep the local list */
  }
  writeLocalCache(STORAGE_KEYS.business_expenses, merged);
  postOrPutServer("/api/collections/business_expenses", "PUT", { data: merged });
  return merged;
}

export function loadCachedAuditSessions(): AuditSession[] {
  return readLocalCache<AuditSession[]>(STORAGE_KEYS.audit_sessions, []);
}

export function loadCachedReconciliationTransactions(): ReconciliationTransaction[] {
  return readLocalCache<ReconciliationTransaction[]>(
    STORAGE_KEYS.reconciliation_transactions,
    [],
  );
}

export function loadCachedStockLedgerEntries(): StockLedgerEntry[] {
  return readLocalCache<StockLedgerEntry[]>(STORAGE_KEYS.stock_ledger_entries, []);
}

export async function loadAuditSessions(): Promise<AuditSession[]> {
  return loadAndHealList<AuditSession>(
    "/api/collections/audit_sessions",
    STORAGE_KEYS.audit_sessions,
  );
}

export async function saveAuditSessions(sessions: AuditSession[]): Promise<void> {
  writeLocalCache(STORAGE_KEYS.audit_sessions, sessions);
  postOrPutServer("/api/collections/audit_sessions", "PUT", { data: sessions });
}

export async function loadReconciliationTransactions(): Promise<ReconciliationTransaction[]> {
  return loadAndHealList<ReconciliationTransaction>(
    "/api/collections/reconciliation_transactions",
    STORAGE_KEYS.reconciliation_transactions,
  );
}

export async function saveReconciliationTransactions(
  txns: ReconciliationTransaction[],
): Promise<void> {
  writeLocalCache(STORAGE_KEYS.reconciliation_transactions, txns);
  postOrPutServer("/api/collections/reconciliation_transactions", "PUT", { data: txns });
}

export async function loadStockLedgerEntries(): Promise<StockLedgerEntry[]> {
  return loadAndHealList<StockLedgerEntry>(
    "/api/collections/stock_ledger_entries",
    STORAGE_KEYS.stock_ledger_entries,
  );
}

export async function saveStockLedgerEntries(entries: StockLedgerEntry[]): Promise<void> {
  writeLocalCache(STORAGE_KEYS.stock_ledger_entries, entries);
  postOrPutServer("/api/collections/stock_ledger_entries", "PUT", { data: entries });
}

/* =========================================================================
 * 3. INVENTORY ITEMS (PostgreSQL public.inventory_items)
 * ========================================================================= */
export async function loadInventory(): Promise<InventoryItem[]> {
  return loadList<InventoryItem>("/api/inventory", STORAGE_KEYS.inventory);
}

export async function saveInventory(
  inventory: InventoryItem[],
  replaceAll = false,
): Promise<void> {
  writeLocalCache(STORAGE_KEYS.inventory, inventory);
  // Sync to PostgreSQL via POST /api/inventory/import
  postOrPutServer("/api/inventory/import", "POST", {
    items: inventory,
    replaceAll,
  });
}

export const syncInventoryToServer = saveInventory;

/* =========================================================================
 * 4. STOCK TRANSACTIONS
 * ========================================================================= */
export async function loadStockTransactions(): Promise<StockTransaction[]> {
  return loadList<StockTransaction>(
    "/api/collections/stock_transactions",
    STORAGE_KEYS.stock_transactions,
  );
}

export async function saveStockTransactions(transactions: StockTransaction[]): Promise<void> {
  writeLocalCache(STORAGE_KEYS.stock_transactions, transactions);
  postOrPutServer("/api/collections/stock_transactions", "PUT", { data: transactions });
}

/* =========================================================================
 * 5. WAREHOUSES
 * ========================================================================= */
export async function loadWarehouses(): Promise<Warehouse[]> {
  return loadList<Warehouse>("/api/warehouses", STORAGE_KEYS.warehouses);
}

export async function saveWarehouses(warehouses: Warehouse[]): Promise<void> {
  writeLocalCache(STORAGE_KEYS.warehouses, warehouses);
  postOrPutServer("/api/warehouses", "PUT", { warehouses });
}

/* =========================================================================
 * 6. WAREHOUSE BAYS
 * ========================================================================= */
export async function loadWarehouseBays(): Promise<WarehouseBay[]> {
  return loadList<WarehouseBay>(
    "/api/collections/warehouse_bays",
    STORAGE_KEYS.warehouse_bays,
  );
}

export async function saveWarehouseBays(bays: WarehouseBay[]): Promise<void> {
  writeLocalCache(STORAGE_KEYS.warehouse_bays, bays);
  postOrPutServer("/api/collections/warehouse_bays", "PUT", { data: bays });
}

/* =========================================================================
 * 7. PROMOTIONAL SCHEMES
 * ========================================================================= */
export async function loadSchemes(): Promise<PromotionalScheme[]> {
  return loadList<PromotionalScheme>("/api/schemes", STORAGE_KEYS.schemes);
}

export async function saveSchemes(schemes: PromotionalScheme[]): Promise<void> {
  writeLocalCache(STORAGE_KEYS.schemes, schemes);
  // Sync to server schemes endpoint (persists to Supabase promotions table)
  postOrPutServer("/api/schemes", "PUT", { schemes });
}

/* =========================================================================
 * 8. DAILY VEHICLE TRIP
 * ========================================================================= */
export async function loadDailyVehicleTrip(): Promise<DailyVehicleTrip | null> {
  const serverData = await fetchFromServer<DailyVehicleTrip | null>(
    "/api/collections/vehicle_trip",
  );
  if (serverData !== null) {
    writeLocalCache(STORAGE_KEYS.vehicle_trip, serverData);
    return serverData;
  }
  return readLocalCache<DailyVehicleTrip | null>(STORAGE_KEYS.vehicle_trip, null);
}

export async function saveDailyVehicleTrip(trip: DailyVehicleTrip): Promise<void> {
  writeLocalCache(STORAGE_KEYS.vehicle_trip, trip);
  postOrPutServer("/api/collections/vehicle_trip", "PUT", { data: trip });
}

/* =========================================================================
 * 9. PRODUCTS & INVENTORY BATCHES (PostgreSQL products and inventory_batches)
 * ========================================================================= */
export async function loadProducts(): Promise<any[]> {
  return loadList<any>("/api/products", STORAGE_KEYS.products);
}

export async function saveProducts(products: any[]): Promise<void> {
  writeLocalCache(STORAGE_KEYS.products, products);
  postOrPutServer("/api/products", "POST", { products });
}

export async function loadInventoryBatches(): Promise<any[]> {
  return loadList<any>("/api/batches", STORAGE_KEYS.inventory_batches);
}

export async function saveInventoryBatches(batches: any[]): Promise<void> {
  writeLocalCache(STORAGE_KEYS.inventory_batches, batches);
  postOrPutServer("/api/batches", "POST", { batches });
}

/* =========================================================================
 * 10. SALESMEN & AUTH SESSION
 * ========================================================================= */
export function loadCachedSalesmen(): Salesman[] {
  return readLocalCache<Salesman[]>(STORAGE_KEYS.salesmen, []);
}

export async function loadSalesmen(): Promise<Salesman[]> {
  return loadList<Salesman>("/api/salesmen", STORAGE_KEYS.salesmen);
}

export async function saveSalesmen(salesmen: Salesman[]): Promise<void> {
  writeLocalCache(STORAGE_KEYS.salesmen, salesmen);
}

export function loadCachedAuthUser(): AuthUser | null {
  return readLocalCache<AuthUser | null>(STORAGE_KEYS.auth_user, null);
}

export function saveCachedAuthUser(user: AuthUser | null): void {
  writeLocalCache(STORAGE_KEYS.auth_user, user);
}
