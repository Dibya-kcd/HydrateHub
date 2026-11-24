import type React from "react";
import type { OversoldItem, ReassignSummary } from "../utils/oversoldDiagnostic";
import type {
  BillCostRepairPlan,
  CrossWarehouseShiftPlan,
  RepairApplyMode,
} from "../utils/billCostRepair";
import type { SupabaseConfig } from "../lib/supabase";
import type { BusinessExpenseRecord } from "../utils/storage";
import type {
  ActivityLogEntry,
  Audit,
  AuditEntry,
  AuditSession,
  AuthUser,
  Bill,
  BillCancellation,
  BillingSettings,
  CanonicalActionIntent,
  CartState,
  CategoryKey,
  Customer,
  DemoPresetId,
  ExistingCustomer,
  FontSize,
  GRN,
  GstMode,
  ImportRow,
  InvestigationReason,
  InventoryBatch,
  InventoryDisposition,
  OrganizationProfile,
  PaletteTokens,
  PaymentAuditEntry,
  PaymentMode,
  PaymentRecord,
  Product,
  Promotion,
  ReconciliationTransaction,
  Salesman,
  StickyTotalPosition,
  StockLedgerEntry,
  StockTransfer,
  SupplierCreditNote,
  SupplierScheme,
  SupplierSchemeApplication,
  TabId,
  Taxability,
  Trip,
  TripProductBreakdown,
  TripShortageInput,
  UserRole,
  Warehouse,
} from "../types";
import type { SalesReturnInputLine, SalesReturnResult } from "../utils/salesReturns";
import type { buildProductBatchLines } from "../utils/stockLocations";

/** Result of previewBillEdit(): used by the edit screen to explain what a save will (not) do. */
export interface BillEditPreview {
  /** True only when crates / products / godown / trip changed. Price, customer, date, paid = false. */
  stockChanged: boolean;
  changes: string[];
  /** Messages that would stop the save (empty = safe to save). */
  problems: string[];
  /** Set when the bill's trip is closed and the edit needs it reopened first. */
  reopenTripId?: number;
  /** Where this bill's stock was drawn from, for display. */
  source: {
    kind: "trip" | "warehouse";
    label: string;
    tripId?: number;
    tripStatus?: string;
    tripDate?: string;
    warehouseId?: string;
    warehouseLabel?: string;
  };
  /** What a save does to money already received on this invoice (receipts follow the invoice). */
  payment: {
    /** Receipts currently recorded against this invoice. */
    receivedBefore: number;
    /** What stays applied to the invoice after the save. */
    paidAfter: number;
    /** Received money that no longer fits the (lower) total and moves to the customer's advance. */
    keptAsAdvance: number;
    /** Receipts removed because "paid" was lowered on purpose (a correction, not a refund). */
    removedAsCorrection: number;
    /** Set when the receipts move to a different customer together with the invoice. */
    movedToCustomer?: string;
  };
}

/** Result of previewBillDelete(): what deleting an invoice does to stock and money, and what blocks it. */
export interface BillDeletePreview {
  billId: number;
  customer: string;
  total: number;
  cancelled: boolean;
  /** Crates that go back into stock (empty for a cancelled invoice: its stock was already released). */
  stockLines: { productId: number; productName: string; qty: number }[];
  totalCrates: number;
  /** Where that stock returns to: the trip's van balance or the godown the invoice was sold from. */
  stockDestination: string;
  /** Money received on the invoice (receipts, or the paid amount if no receipt rows exist). */
  receivedAmount: number;
  receiptRows: number;
  /** Reasons the delete is refused right now (empty = allowed). */
  blockers: string[];
  /** Set when the invoice's trip is closed and must be reopened first. */
  reopenTripId?: number;
}

/** How money already received on a deleted invoice is treated. */
export type BillDeletePaymentAction = "advance" | "remove";

export interface InwardStockParams {
  productId?: number;
  newProductName?: string;
  category?: CategoryKey;
  pack?: string;
  volume?: number;
  sku?: string;
  hsn?: string;
  taxability?: Taxability;
  gstRate?: number;
  cgstRate?: number;
  sgstRate?: number;

  supplierInvoiceNo?: string;
  supplierName?: string;
  inwardDate?: string;
  warehouseId?: string;
  billedQuantity: number;
  freeQuantity?: number;
  scheme?: string;
  costPrice?: number;
  wholesaleRate?: number;
  retailRate?: number;
  batchNumber?: string;
  mfgDate?: string;
  expiryDate?: string;
  notes?: string;
}

export interface PullFromCloudOptions {
  /** Background sync: ask a few tiny questions first and download everything only if the cloud changed. */
  auto?: boolean;
}

/** Result of a checkout that may have produced a GST invoice, a Non-GST cash memo, or both (linked by splitGroupId). */
export type SplitBillsResult = {
  gstBillId: number | null;
  nonGstBillId: number | null;
  splitGroupId: string;
  gstBill: Bill | null;
  nonGstBill: Bill | null;
};

export interface LedgerContextType {
  tab: TabId;
  setTab: (t: TabId) => void;

  // Inward (GRN) Single Source of Truth
  grns: GRN[];
  setGrns: React.Dispatch<React.SetStateAction<GRN[]>>;
  postGrn: (
    grnData: Omit<GRN, "id" | "grnNumber" | "createdAt" | "updatedAt">,
  ) => GRN;
  updateGrn: (
    id: string,
    updates: Partial<GRN>,
    meta?: { reason?: string },
  ) => void;
  deleteGrn: (id: string, reason?: string) => void;
  activeGrnToEdit: GRN | null;
  setActiveGrnToEdit: (grn: GRN | null) => void;
  loadSampleGrn?: () => void;

  // Products
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  addProduct: (p: Omit<Product, "id">) => void;
  updateProductField: (
    id: number,
    field: keyof Product,
    value: number | string | boolean,
  ) => void;
  updateProductFields: (id: number, patch: Partial<Omit<Product, "id">>) => void;
  bulkSetProductTaxability: (productIds: number[], taxability: Taxability) => number;
  deleteProduct: (id: number, reason?: string) => void;
  applyBulkImport: (rows: ImportRow[]) => void;
  receiveInwardStock: (
    params: InwardStockParams,
  ) => { productId: number; batchId: string } | undefined;
  productWarehouseStock: (
    productId: number,
  ) => { warehouseId: string; warehouseName: string; crates: number }[];
  /**
   * Owner-only. Moves a product's stock deduction on the selected bills from one godown to another by changing ONLY
   * the batch link on those lines. Totals, GST, costs, payments and dues are never touched. `dryRun` previews only.
   */
  reassignBillsProductWarehouse: (args: {
    productId: number;
    fromWarehouseId: string;
    toWarehouseId: string;
    billIds: number[];
    dryRun?: boolean;
  }) => ReassignSummary;
  /** Puts the batch links changed by the last reassignment back (other edits to those bills are kept). */
  undoLastOversoldReassign: () => { ok: boolean; restoredBills: number; error?: string };
  hasOversoldReassignUndo: boolean;
  /** Every (product x godown) whose true book balance is negative, with the math and contributing bills. Read-only. */
  oversoldReport: OversoldItem[];
  /** Foolproof per-warehouse batch/expiry lines for a product, derived live from inventoryBatches (never from the legacy p.warehouseId/batchNumber/expiry fields). */
  productBatchLines: (
    productId: number,
  ) => ReturnType<typeof buildProductBatchLines>;
  /** True if this product currently has (or has ever had) a batch in this warehouse — use this for warehouse filters, never p.warehouseId === selectedWarehouse. */
  productInWarehouse: (productId: number, warehouseId: string) => boolean;

  // Warehouses
  warehouses: Warehouse[];
  setWarehouses: React.Dispatch<React.SetStateAction<Warehouse[]>>;
  addWarehouse: (w: Omit<Warehouse, "id">) => string;
  updateWarehouse: (id: string, updates: Partial<Warehouse>) => void;
  deleteWarehouse: (id: string, reason?: string) => void;
  defaultWarehouse: Warehouse | undefined;

  // Batches
  inventoryBatches: InventoryBatch[];
  setInventoryBatches: React.Dispatch<React.SetStateAction<InventoryBatch[]>>;
  addBatch: (b: Omit<InventoryBatch, "id">) => string;
  updateBatch: (id: string, updates: Partial<InventoryBatch>) => void;
  deleteBatch: (id: string, reason?: string) => void;
  batchesForProduct: (
    productId: number,
    warehouseId?: string,
  ) => InventoryBatch[];
  warehouseStock: (warehouseId: string, productId?: number) => number;

  // Stock Transfers
  stockTransfers: StockTransfer[];
  /** Returns false if source stock is insufficient (negative stock not allowed). */
  addStockTransfer: (st: Omit<StockTransfer, "id">) => boolean;

  // Promotions
  promotions: Promotion[];
  setPromotions: React.Dispatch<React.SetStateAction<Promotion[]>>;
  addPromotion: (promo: Omit<Promotion, "id">) => void;
  updatePromotion: (id: number, promo: Omit<Promotion, "id">, reason?: string) => void;
  deletePromotion: (id: number, reason?: string) => void;

  // Supplier Schemes & Incentives (purchasing-side; independent of customer Promotions above)
  supplierSchemes: SupplierScheme[];
  addSupplierScheme: (
    s: Omit<SupplierScheme, "id" | "createdAt" | "updatedAt">,
  ) => SupplierScheme;
  updateSupplierScheme: (id: string, updates: Partial<SupplierScheme>, reason?: string) => void;
  deleteSupplierScheme: (id: string, reason?: string) => void;
  supplierSchemeApplications: SupplierSchemeApplication[];
  addSupplierSchemeApplication: (
    a: Omit<SupplierSchemeApplication, "id" | "createdAt">,
  ) => SupplierSchemeApplication;
  supplierCreditNotes: SupplierCreditNote[];
  addSupplierCreditNote: (
    n: Omit<SupplierCreditNote, "id" | "createdAt" | "updatedAt" | "status">,
  ) => SupplierCreditNote;
  updateSupplierCreditNote: (
    id: string,
    updates: Partial<SupplierCreditNote>,
  ) => void;
  deleteSupplierCreditNote: (id: string, reason?: string) => void;
  recordSupplierCreditNoteReceipt: (
    id: string,
    params: {
      actualAmount: number;
      creditNoteNumber?: string;
      creditNoteDate?: string;
      attachmentRef?: string;
      notes?: string;
    },
  ) => void;

  inventoryDispositions: InventoryDisposition[];
  expenses: BusinessExpenseRecord[];
  addExpense: (e: Omit<BusinessExpenseRecord, "id">) => BusinessExpenseRecord;
  updateExpense: (id: string, patch: Partial<Omit<BusinessExpenseRecord, "id">>, reason?: string) => void;
  deleteExpense: (id: string, rectificationReason?: string) => void;
  addInventoryDisposition: (
    d: Omit<
      InventoryDisposition,
      "id" | "createdAt" | "updatedAt" | "stockApplied" | "costValue"
    > & { costValue?: number; stockApplied?: boolean },
  ) =>
    | { ok: true; disposition: InventoryDisposition }
    | { ok: false; error: string };
  updateInventoryDisposition: (
    id: string,
    updates: Partial<InventoryDisposition>,
  ) => void;
  deleteInventoryDisposition: (
    id: string,
    opts?: { restoreStock?: boolean },
  ) => void;
  recordDispositionCompensation: (
    id: string,
    params: {
      compensatedAmount: number;
      creditNoteNumber?: string;
      creditNoteDate?: string;
      cnTaxableValue?: number;
      cnCgst?: number;
      cnSgst?: number;
      cnIgst?: number;
      cnTotal?: number;
      notes?: string;
      costValue?: number;
      /** If true, compensatedAmount is added to prior receipts (partial payment log). */
      appendPayment?: boolean;
      paymentNote?: string;
      attachmentRef?: string;
    },
  ) => void;

  // Smart Stock Reconciliation & Audit
  auditSessions: AuditSession[];
  createAuditSession: (params: {
    warehouseId?: string;
    warehouseName?: string;
    date: string;
    auditorName: string;
    referenceNote?: string;
    counts: { productId: number; physicalStock: number }[];
  }) => AuditSession;
  deleteAuditSession: (id: string, reason?: string) => void;
  /** Edit the header of an existing audit session (date, godown, auditor, note). */
  updateAuditSession: (
    id: string,
    updates: {
      date?: string;
      warehouseId?: string;
      warehouseName?: string;
      auditorName?: string;
      referenceNote?: string;
    },
  ) => void;
  /**
   * Add missing products / correct counts / remove entries on an existing session.
   * Entries already awaiting approval or applied are locked and left untouched.
   */
  saveAuditSessionCounts: (
    sessionId: string,
    counts: { productId: number; physicalStock: number }[],
    removeProductIds?: number[],
  ) => { updated: number; added: number; removed: number; locked: number };
  confirmSwap: (
    sessionId: string,
    varianceEntryId: string,
    params: {
      candidateProductId: number;
      quantity: number;
      matchScore?: number;
      notes?: string;
    },
  ) => void;
  rejectSuggestion: (sessionId: string, varianceEntryId: string) => void;
  keepAsSeparateVariance: (sessionId: string, varianceEntryId: string) => void;
  markUnderInvestigation: (
    sessionId: string,
    varianceEntryId: string,
    notes?: string,
  ) => void;
  selectInvestigationReason: (
    sessionId: string,
    varianceEntryId: string,
    params: {
      reason: InvestigationReason;
      notes?: string;
      attachmentRef?: string;
    },
  ) => void;
  approveReconciliation: (
    sessionId: string,
    varianceEntryId: string,
    approverName: string,
  ) => void;
  reconciliationTransactions: ReconciliationTransaction[];
  stockLedgerEntries: StockLedgerEntry[];

  // Bills & Billing
  bills: Bill[];
  getBillById: (id: number) => Bill | undefined;
  cart: CartState;
  setCart: React.Dispatch<React.SetStateAction<CartState>>;
  editingBillId: number | null;
  justFinalizedBillId: number | null;
  setJustFinalizedBillId: (id: number | null) => void;
  justFinalizedSplitIds: number[];
  setJustFinalizedSplitIds: (ids: number[]) => void;
  startEditBill: (bill: Bill) => void;
  cancelEditBill: () => void;
  finalizeBill: (
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
        /** the customer record the person picked; used as the bill's customer link instead of guessing from name + phone */
        customerId?: string;
      };
    },
  ) => number | null;
  finalizeSplitBills: (params: {
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
  }) => SplitBillsResult | null;
  updateBill: (
    bill: Bill,
    opts?: {
      comment?: string;
      /** What the user typed as paid BEFORE it was capped at the new total; lets received money above a lowered total be kept as an advance instead of vanishing. */
      requestedPaid?: number;
    },
  ) => boolean;
  /** Splits a mixed bill (containing both GST and Non-GST items) into a linked GST invoice (INV-) + Non-GST memo (NG-). */
  splitMixedBill: (
    billOrId: Bill | number,
    opts?: {
      comment?: string;
      requestedPaid?: number;
    },
  ) => { gstBill: Bill; nonGstBill: Bill } | null;
  /** Recalculate the saved total / taxable / GST of bills from their own lines and invoice discount. */
  repairBillTotals: (billIds: number[]) => { fixed: number; skipped: number };
  /** Clears stored tax on Non-GST bills where no tax was collected from customer */
  repairNonGstBillTaxes: (billIds: number[]) => { fixed: number; skipped: number };
  /** Converts retail / Non-GST bills with stored tax into B2C Tax Invoices */
  convertBillsToTaxInvoices: (billIds: number[]) => { fixed: number; skipped: number };
  /** Links matching stock batches and/or freezes costExGst on bills using estimated product cost; leaves totals, GST, dues, and payments untouched. */
  repairEstimatedBillCosts: (
    plan: BillCostRepairPlan,
    mode?: RepairApplyMode,
  ) => { fixedBills: number; fixedLines: number; linkedLines: number; frozenOnlyLines: number; fixedCases: number };
  /** Restores godown stock allocation on bills without a warehouse tag that were linked to a batch in another godown, while preserving frozen costExGst. */
  restoreCrossWarehouseAllocations: (
    plan: CrossWarehouseShiftPlan,
  ) => { restoredBills: number; restoredLines: number; restoredCases: number };
  /** Generates journal payments for bills marked as paid but missing a payment entry */
  repairMissingBillPayments: () => number;
  /** Assigns a fresh unique document number to a bill flagged for duplicate/collision, without changing totals/GST/stock */
  reassignBillDocNumber: (billId: number) => string | null;
  /** Registers deleted test numbers as Cancelled for GSTR-1 document series continuity */
  recordMissingSeriesAsCancelled: (missingIds: number[]) => number;
  /** Dry-run of a bill edit: what changed, whether live stock is affected, and what would block it. */
  previewBillEdit: (bill: Bill, requestedPaid?: number) => BillEditPreview;
  /** Dry-run of deleting an invoice: stock that returns, money held, and anything that blocks it. */
  previewBillDelete: (billId: number) => BillDeletePreview | null;
  recordPayment: (
    billId: number,
    amount: number,
    paymentDate?: string,
    mode?: PaymentMode,
    referenceNote?: string,
  ) => number;
  /** Deletes an invoice. Stock is derived from invoices, so it returns automatically; received money is kept as an advance (default) or removed. Returns false when refused. */
  deleteBill: (
    billId: number,
    opts?: { reason?: string; paymentAction?: BillDeletePaymentAction },
  ) => boolean;
  cancelBill: (billId: number, reason: string) => BillCancellation | null;
  /** Customer return against an invoice: credit reduces the bill's due; restocked crates go back to a godown, scrapped ones stay written off. */
  createSalesReturn: (
    billId: number,
    lines: SalesReturnInputLine[],
    reason: string,
  ) => SalesReturnResult;
  /** Cancel a saved customer return: restocked crates leave stock, the credit is reversed, the bill owes it again. */
  cancelSalesReturn: (
    billId: number,
    returnId: string,
    reason: string,
  ) => { ok: true } | { ok: false; error: string };
  /** Correct a saved customer return (same credit note number). */
  editSalesReturn: (
    billId: number,
    returnId: string,
    lines: SalesReturnInputLine[],
    reason: string,
    editNote: string,
  ) => SalesReturnResult;
  cancelledBills: Bill[];
  notice: string | null;
  notify: (message: string) => void;
  dismissNotice: () => void;
  syncBillsToCloud: () => Promise<{
    success: boolean;
    count: number;
    error?: string;
  }>;

  // Custom Product Rates (Persistent Previous Custom Price Memory)
  customProductPrices: Record<number, number>;
  customerProductPrices: Record<string, number>;
  getPreviousCustomPrice: (
    productId: number,
    customerName?: string,
  ) => number | null;
  setCustomProductPrice: (
    productId: number,
    rate: number,
    customerName?: string,
  ) => void;

  // Payments & Collections Ledger
  payments: PaymentRecord[];
  setPayments: React.Dispatch<React.SetStateAction<PaymentRecord[]>>;
  repairPaymentLinks: () => number;
  recordCustomerPayment: (
    customerName: string,
    amount: number,
    paymentDate: string,
    mode?: PaymentMode,
    referenceNote?: string,
    billId?: number,
    /** the customer record the money is from; keeps two shops with the same name apart */
    customerId?: string,
  ) => boolean;
  deletePayment: (paymentId: string, rectificationReason?: string) => void;
  updatePayment: (updated: PaymentRecord, reason?: string) => boolean;
  paymentAudit: PaymentAuditEntry[];
  getCustomerCreditSummary: (customerName: string) => {
    advance: number;
    overpaid: number;
    unpaidDue: number;
    refundable: number;
    canApply: boolean;
  };
  applyAdvanceToInvoices: (customerName: string, onlyBillId?: number) => number;
  recordCustomerRefund: (
    customerName: string,
    amount: number,
    paymentDate: string,
    mode?: PaymentMode,
    note?: string,
  ) => boolean;

  // Customers Master & Ledger
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  addCustomer: (
    customerData: Omit<Customer, "id" | "createdAt"> & { id?: string },
    options?: { useExistingOnPhoneMatch?: boolean },
  ) => Customer;
  customerNameClash: (
    customerId: string,
    name: string,
    opts?: { oldName?: string; phone?: string },
  ) => Customer | undefined;
  findBillingCustomer: (name?: string, phone?: string) => Customer | undefined;
  updateCustomer: (
    customer: Customer,
    syncLinkedBillsAndPayments?: boolean,
    previousIdentity?: { name: string; phone?: string },
  ) => Customer;
  deleteCustomer: (
    customerId: string,
    rectificationReason?: string,
    opts?: { removePayments?: boolean },
  ) => void;
  existingCustomers: ExistingCustomer[];
  startBillForCustomer: (customerName: string, customerPhone?: string) => void;
  getCustomerLedger: (customerNameOrId: string, customerPhone?: string, customerAltPhone?: string) => {
    customer?: Customer;
    bills: Bill[];
    payments: PaymentRecord[];
    totalBilled: number;
    totalReturns: number;
    netBilled: number;
    totalPaid: number;
    balanceDue: number;
    rawBalance: number;
    openingBalance: number;
    isOverLimit: boolean;
  };

  // Trips / Dispatch
  trips: Trip[];
  addTrip: (
    vehicle: string,
    date: string,
    loaded: Record<number, number>,
    warehouseId?: string,
    initialBillIds?: number[],
    salesman?: string,
    route?: string,
    salesmanId?: string,
    warehouseLoads?: Record<string, Record<number, number>>,
    driver?: string,
    driverPhone?: string,
    salesmanPhone?: string,
  ) => Trip;
  toggleBillAssignment: (tripId: number, billId: number) => string | null;
  unassignBillFromTrip: (tripId: number, billId: number) => void;
  autoAssignTripBills: (tripId: number) => number;
  saveReturn: (
    tripId: number,
    returned: Record<number, number>,
    shortageReasons?: Record<number, TripShortageInput>,
    cashHandedIn?: number | null,
    cashShortBooked?: number | null,
  ) => { ok: true } | { ok: false; error: string };
  /** Money the salesman paid back against a booked cash shortfall. */
  recordTripCashRecovery: (tripId: number, amount: number, note?: string, date?: string) => boolean;
  /** Forgive what the salesman still owes on a trip. */
  writeOffTripCashShort: (tripId: number) => void;
  reopenTrip: (tripId: number) => void;
  saveReturnDraft: (tripId: number, returned: Record<number, number>, cashHandedIn?: number | null) => void;
  updateTrip: (updated: Trip, reason?: string) => void;
  deleteTrip: (tripId: number, reason?: string) => void;
  syncTripsToCloud: () => Promise<{
    success: boolean;
    count: number;
    error?: string;
  }>;

  // Audits
  audits: Audit[];
  saveAudit: (
    counts: Record<number, number | string>,
    adjustStock: boolean,
    auditDate?: string,
    referenceNote?: string,
    warehouseId?: string,
  ) => void;
  deleteAudit: (id: number, reason?: string) => void;
  /** Batch-level stock audit (Inventory > Audit): one entry per batch, posted to live stock. Returns the audit id. */
  saveBatchAudit: (input: {
    date?: string;
    warehouseId: string;
    referenceNote?: string;
    lines: {
      productId: number;
      batchKey?: string;
      batchNumber?: string;
      expiryDate?: string;
      system: number;
      counted: number;
      kind?: AuditEntry["kind"];
      reason?: string;
    }[];
  }) => number | null;

  // System & Settings
  gstMode: GstMode;
  setGstMode: (m: GstMode) => void;

  fontSize: FontSize;
  setFontSize: (s: FontSize) => void;
  highContrast: boolean;
  setHighContrast: React.Dispatch<React.SetStateAction<boolean>>;
  lowVisionMode: boolean;
  setLowVisionMode: (val: boolean | ((prev: boolean) => boolean)) => void;
  toggleLowVisionMode: () => void;
  lowVisionStickyPosition: StickyTotalPosition;
  setLowVisionStickyPosition: React.Dispatch<
    React.SetStateAction<StickyTotalPosition>
  >;
  scale: number;
  palette: PaletteTokens;
  fz: (px: number, extra?: React.CSSProperties) => React.CSSProperties;

  // Organization & Settings
  orgProfile: OrganizationProfile;
  setOrgProfile: React.Dispatch<React.SetStateAction<OrganizationProfile>>;
  updateOrgProfile: (
    p: Partial<OrganizationProfile>,
  ) => Promise<{ success: boolean; cloudSynced: boolean; message?: string }>;
  pullOrgProfileFromCloud: () => Promise<{
    success: boolean;
    message?: string;
  }>;

  billingSettings: BillingSettings;
  setBillingSettings: React.Dispatch<React.SetStateAction<BillingSettings>>;
  updateBillingSettings: (
    s: Partial<BillingSettings>,
  ) => Promise<{ success: boolean; cloudSynced: boolean; message?: string }>;
  pullBillingSettingsFromCloud: () => Promise<{
    success: boolean;
    message?: string;
  }>;

  // Data management
  loadDemoPreset: (presetId: DemoPresetId) => void;
  exportBackup: () => void;
  importBackup: (jsonString: string) => { success: boolean; error?: string };
  clearTransactions: () => void;
  clearAllData: () => void;

  // Stock helpers
  soldByProduct: Record<number, number>;
  remainingStock: (productId: number) => number;
  bookStock: (productId: number) => number;
  stockAsOf: (productId: number, dateISO: string, warehouseId?: string) => number;
  activePromoFor: (productId: number) => Promotion | undefined;
  tripBreakdown: (trip: Trip) => {
    rows: TripProductBreakdown[];
    hasDiscrepancy: boolean;
  };
  getVehicleStock: (
    trip: Trip | null | undefined,
    productId: number,
  ) => { loaded: number; sold: number; available: number };

  // Totals
  totalOpening: number;
  totalRemaining: number;
  totalRevenue: number;
  totalCasesSold: number;
  totalOutstanding: number;
  tripsWithDiscrepancy: number;

  // Supabase Cloud Database Integration
  supabaseConfig: SupabaseConfig;
  supabaseStatus: {
    isConnected: boolean;
    isChecking: boolean;
    latencyMs: number;
    allTablesExist: boolean;
    lastSyncedAt: string | null;
    message: string;
    error?: string;
  };
  checkSupabaseConnection: () => Promise<void>;
  syncToCloud: (opts?: { full?: boolean }) => Promise<{ success: boolean; message: string }>;
  /** Plain call = full download (boot, manual Sync, after a conflict). `{ auto: true }` = background check first. */
  pullFromCloud: (opts?: PullFromCloudOptions) => Promise<{ success: boolean; message: string }>;
  saveCustomSupabaseCredentials: (url: string, key: string) => Promise<void>;
  clearCustomSupabaseCredentials: () => void;

  resetToDefault: () => void;
  cleanDatabase: () => void;
  deleteLocalDatabase: () => void;

  // Authentication & Salesmen (RBAC)
  salesmen: Salesman[];
  currentUser: AuthUser | null;
  currentRole: UserRole | null;
  activeSalesman: Salesman | null;
  loginAdmin: (
    email: string,
    pass: string,
  ) => Promise<{ success: boolean; error?: string }>;
  loginSalesman: (
    phone: string,
    pin: string,
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  addSalesman: (
    data: {
      name: string;
      phone: string;
      defaultVehicle?: string;
      active?: boolean;
    },
    pin: string,
  ) => Promise<{ success: boolean; error?: string }>;
  updateSalesman: (
    id: string,
    data: Partial<Salesman>,
    newPin?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  toggleSalesmanActive: (id: string) => Promise<void>;
  deleteSalesman: (id: string) => Promise<void>;

  // Global Activity Log & Single-Source Canonical Routing
  activityLogs: ActivityLogEntry[];
  mergedActivityLogs: ActivityLogEntry[];
  recordActivity: (input: {
    entityType: ActivityLogEntry["entityType"];
    entityId: string | number;
    entityLabel: string;
    action: ActivityLogEntry["action"];
    reason?: string;
    summary: string;
    sourceScreen?: string;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
  }) => ActivityLogEntry;
  pullActivityLogs: () => Promise<ActivityLogEntry[]>;
  flushActivityLogs: () => Promise<boolean>;
  pendingCanonicalAction: CanonicalActionIntent | null;
  openCanonicalAction: (intent: CanonicalActionIntent) => void;
  clearPendingCanonicalAction: () => void;
  returnFromCanonicalAction: (intent: CanonicalActionIntent) => void;
}
