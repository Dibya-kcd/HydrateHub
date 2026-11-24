export interface Order {
  id: string | number;
  orderNumber?: string;
  retailer?: string;
  customerName?: string;
  phone?: string;
  date?: string;
  status?: "pending" | "confirmed" | "delivered" | "cancelled" | string;
  items: any[];
  subtotal?: number;
  cgst?: number;
  sgst?: number;
  total?: number;
  discount?: number;
  amountPaid?: number;
  warehouseId?: string;
  [key: string]: any;
}

export interface Partner {
  id: string | number;
  name: string;
  type?: "customer" | "supplier" | "retailer" | "distributor" | string;
  phone?: string;
  email?: string;
  address?: string;
  gstin?: string;
  city?: string;
  balance?: number;
  [key: string]: any;
}

export interface InventoryItem {
  id: string;
  product_id?: string;
  stock_on_hand?: number;
  reserved_stock?: number;
  reorder_level?: number;
  warehouse_id?: string | null;
  warehouse_name?: string | null;
  warehouse_bay?: string | null;
  batch_number?: string | null;
  mfg_date?: string | null;
  expiry_date?: string | null;
  unit_cost?: number;
  selling_scheme?: string | null;
  selling_scheme_discount?: number | null;
  selling_scheme_label?: string | null;
  last_restocked?: string | null;
  updated_at?: string;

  // Interoperability camelCase aliases
  productId?: string | number;
  stockOnHand?: number;
  reservedStock?: number;
  reorderLevel?: number;
  warehouseId?: string;
  warehouseName?: string;
  warehouseBay?: string;
  batchNumber?: string;
  mfgDate?: string;
  expiryDate?: string;
  unitCost?: number;
  sellingScheme?: string;
  sellingSchemeDiscount?: number;
  sellingSchemeLabel?: string;
  lastRestocked?: string;
  [key: string]: any;
}

export interface StockTransaction {
  id: string | number;
  date: string;
  productId?: string | number;
  product_id?: string | number;
  type: "inward" | "outward" | "adjustment" | "transfer" | "delivery" | string;
  quantity: number;
  referenceNote?: string;
  warehouseId?: string;
  batchNumber?: string;
  [key: string]: any;
}

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  location?: string;
  manager?: string;
  phone?: string;
  capacityCases?: number;
  isDefault?: boolean;
  notes?: string;
  [key: string]: any;
}

export interface WarehouseBay {
  id: string;
  warehouseId: string;
  warehouse_id?: string;
  name: string;
  code?: string;
  capacity?: number;
  notes?: string;
  [key: string]: any;
}

export interface PromotionalScheme {
  id: string | number;
  name: string;
  type: string;
  buyQty?: number;
  freeQty?: number;
  percent?: number;
  flatPerCase?: number;
  productIds?: any[];
  description?: string;
  [key: string]: any;
}

export interface DailyVehicleTrip {
  id?: string | number;
  date?: string;
  vehicle?: string;
  driver?: string;
  warehouseId?: string;
  loaded?: Record<string | number, number>;
  returned?: Record<string | number, number>;
  billIds?: (string | number)[];
  status?: string;
  notes?: string;
  [key: string]: any;
}

export interface SyncStatus {
  isOnline: boolean;
  consecutiveFailures: number;
  lastSuccessfulSync: string | null;
  lastError: string | null;
  isSyncing: boolean;
  hasPersistentFailure: boolean;
  /** Saves that did not reach the cloud yet and are kept on this device to be retried. */
  pendingCount: number;
}

export type BusinessExpenseRecord = {
  id: string;
  date: string;
  category: string;
  amount: number;
  note: string;
  /** employee / vendor the money was paid to (used for salary budget) */
  paidTo?: string;
  /** Optional link to the trip this cost belongs to (fuel, driver, toll ...). */
  tripId?: number;
  tripLabel?: string;
  /**
   * Soft foreign keys — optional so existing realtime rows stay valid.
   * When present they mirror Sell (bills) style links: party / invoice / receipt.
   */
  customerId?: string;
  billId?: number;
  paymentId?: string;
  /** How the expense was paid (cash / upi / bank / cheque / other). */
  mode?: string;
  referenceNote?: string;
  /** Last edit time; the newest edit wins when devices merge. */
  updatedAt?: string;
};

export const STORAGE_KEYS = {
  orders: "mrwater_cache_orders",
  partners: "mrwater_cache_partners",
  inventory: "mrwater_cache_inventory",
  stock_transactions: "mrwater_cache_stock_transactions",
  warehouses: "mrwater_cache_warehouses",
  warehouse_bays: "mrwater_cache_warehouse_bays",
  schemes: "mrwater_cache_schemes",
  vehicle_trip: "mrwater_cache_vehicle_trip",
  trips: "mrwater_cache_trips",
  billing_settings: "mrwater_cache_billing_settings",
  org_profile: "mrwater_cache_org_profile",
  products: "mrwater_cache_products",
  inventory_batches: "mrwater_cache_inventory_batches",
  salesmen: "mrwater_cache_salesmen",
  auth_user: "mrwater_cache_auth_user",
  payments: "mrwater_cache_payments",
  customers: "mrwater_cache_customers",
  supplier_schemes: "mrwater_cache_supplier_schemes",
  supplier_scheme_applications: "mrwater_cache_supplier_scheme_applications",
  supplier_credit_notes: "mrwater_cache_supplier_credit_notes",
  audit_sessions: "mrwater_cache_audit_sessions",
  reconciliation_transactions: "mrwater_cache_reconciliation_transactions",
  stock_ledger_entries: "mrwater_cache_stock_ledger_entries",
  inventory_dispositions: "mrwater_cache_inventory_dispositions",
  business_expenses: "mrwater_cache_business_expenses",
  grns: "mrwater_cache_grns",
} as const;
