import { mergePaymentSources } from "../../utils/paymentMerge";
import {
  getSupabaseClient,
  isServerProxyMode,
  isValidUuid,
  proxyFetch,
  sanitizeDate,
  type SyncResult,
} from "./client";
import { changedOnlyClient, resilientSupabaseUpsert } from "./pushCache";
import { dbRowToAudit, dbRowToPayment, pushPaymentsToSupabase } from "./payments";
import {
  pushAuditSessionToSupabase,
  pushReconciliationTransactionToSupabase,
  pushStockLedgerEntryToSupabase,
  pushSupplierCreditNoteToSupabase,
  pushSupplierSchemeApplicationToSupabase,
  pushSupplierSchemeToSupabase,
} from "./inventoryAndSettings";
import { fetchRowIfChanged, fetchTableDelta } from "../tableDelta";
import { CATS, INIT_WAREHOUSES } from "../../constants/initialData";
import {
  applyBillExtra,
  applyGrnExtra,
  applyProductExtra,
  billExtraFields,
  grnExtraFields,
  productExtraFields,
} from "../../utils/billExtra";
import {
  generateSkuId,
  gstRateFromHsn,
  normalizeTo8DigitHsn,
  normalizeTrip,
  parseBillIds,
  parseJsonDict,
  resolveProductGstRate,
} from "../../utils/billing";
import { todayISO } from "../../utils/dateLocal";
import type {
  Audit,
  AuditSession,
  Bill,
  BillingSettings,
  CategoryKey,
  GRN,
  InventoryBatch,
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
  Warehouse,
} from "../../types";

/**
 * Pushes local ledger state to Supabase PostgreSQL database
 */
export async function pushLedgerToSupabase(data: {
  warehouses: Warehouse[];
  products: Product[];
  inventoryBatches: InventoryBatch[];
  grns?: GRN[];
  stockTransfers?: StockTransfer[];
  promotions: Promotion[];
  bills: Bill[];
  trips: Trip[];
  audits: Audit[];
  orgProfile: OrganizationProfile;
  billingSettings: BillingSettings;
  payments?: PaymentRecord[];
  salesmen?: Salesman[];
  supplierSchemes?: SupplierScheme[];
  supplierSchemeApplications?: SupplierSchemeApplication[];
  supplierCreditNotes?: SupplierCreditNote[];
  auditSessions?: AuditSession[];
  reconciliationTransactions?: ReconciliationTransaction[];
  stockLedgerEntries?: StockLedgerEntry[];
}, options: { full?: boolean } = {}): Promise<SyncResult> {
  if (isServerProxyMode()) {
    const res = await proxyFetch<SyncResult>(
      "/api/sync/push",
      {
        method: "POST",
        timeoutMs: 30000,
        body: JSON.stringify({ data, options }),
      },
    );
    if (!res.ok) {
      throw new Error(res.error || "Failed to push ledger via server proxy.");
    }
    return {
      success: Boolean(res.data?.success ?? true),
      pushedCount: res.data?.pushedCount,
    };
  }
  const rawClient = getSupabaseClient();
  if (!rawClient) {
    throw new Error("Supabase client is not configured.");
  }
  // Only rows whose content changed are sent (options.full = send everything once and refresh the fingerprints).
  const client = changedOnlyClient(rawClient, options.full === true);

  // Never re-create what was deleted: drop bills / GRNs / trips that are on the cloud deletion lists.
  try {
    const { data: rows } = await client
      .from("app_collections")
      .select("key,data")
      .in("key", ["deleted_bill_ids", "deleted_grn_ids", "deleted_trip_ids"]);
    const dead = (key: string) =>
      new Set<string>(
        ((rows || []).find((r: any) => r.key === key)?.data as any[] | undefined || []).map((x: any) => String(x)),
      );
    const deadBills = dead("deleted_bill_ids");
    const deadGrns = dead("deleted_grn_ids");
    const deadTrips = dead("deleted_trip_ids");
    data = {
      ...data,
      bills: (data.bills || []).filter((b) => !deadBills.has(String(b.id))),
      grns: data.grns ? data.grns.filter((g) => !deadGrns.has(String(g.id))) : data.grns,
      trips: (data.trips || []).filter((t) => !deadTrips.has(String(t.id))),
    };
  } catch {
    // deletion lists unavailable: continue with the data as given
  }

  const pushedCount = {
    warehouses: 0,
    products: 0,
    inventoryBatches: 0,
    grns: 0,
    promotions: 0,
    bills: 0,
    trips: 0,
    audits: 0,
    payments: 0,
    salesmen: 0,
    supplierSchemes: 0,
    supplierSchemeApplications: 0,
    supplierCreditNotes: 0,
    auditSessions: 0,
    reconciliationTransactions: 0,
    stockLedgerEntries: 0,
  };

  // 1. Upsert Warehouses first to satisfy foreign key constraints in inventory_batches
  const whToUpsert =
    data.warehouses.length > 0 ? data.warehouses : INIT_WAREHOUSES;
  const whPayload = whToUpsert.map((w) => ({
    id: w.id,
    name: w.name,
    code: w.code,
    location: w.location || "",
    manager: w.manager || "",
    phone: w.phone || "",
    capacity_cases: w.capacityCases || 0,
    is_default: Boolean(w.isDefault),
    notes: w.notes || "",
    updated_at: new Date().toISOString(),
  }));
  const { error: whErr } = await client
    .from("warehouses")
    .upsert(whPayload, { onConflict: "id" });
  if (whErr) console.warn(`Warehouses sync notice: ${whErr.message}`);
  else pushedCount.warehouses = whPayload.length;

  // 2. Upsert Products
  if (data.products.length > 0) {
    const productPayload = data.products.map((p) => ({
      id: p.id,
      sku: p.sku || generateSkuId(p.name, p.category, p.id),
      name: p.name,
      category: p.category,
      volume: p.volume,
      pack: p.pack,
      expiry: p.expiry || "",
      batch_number: p.batchNumber || "",
      mfg_date: p.mfgDate || "",
      warehouse_id: p.warehouseId || "",
      opening: p.opening,
      cost: p.cost,
      effective_cost: p.effectiveCost || p.cost,
      retail: p.retail,
      wholesale: p.wholesale,
      hsn: p.hsn || "",
      gst_rate: resolveProductGstRate(p),
      scheme: p.scheme || "",
      updated_at: p.updatedAt || new Date().toISOString(),
    }));
    // Product-master fields (units per crate, brand, returnable, active, rates-include-GST) go in `extra`.
    // If the column is not there yet (migration 014 not run) retry without it, then fall back to the base columns.
    const productPayloadWithExtra = productPayload.map((row, i) => ({
      ...row,
      extra: productExtraFields(data.products[i]),
    }));
    let { error } = await client
      .from("products")
      .upsert(productPayloadWithExtra, { onConflict: "id" });
    if (error) {
      ({ error } = await client
        .from("products")
        .upsert(productPayload, { onConflict: "id" }));
    }
    if (error) {
      // Fallback in case schema does not yet have newly added columns
      const fallbackPayload = data.products.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        volume: p.volume,
        pack: p.pack,
        expiry: p.expiry,
        batch_number: p.batchNumber || "",
        mfg_date: p.mfgDate || "",
        warehouse_id: p.warehouseId || "",
        opening: p.opening,
        cost: p.cost,
        retail: p.retail,
        wholesale: p.wholesale,
        updated_at: p.updatedAt || new Date().toISOString(),
      }));
      const { error: fallbackErr } = await client
        .from("products")
        .upsert(fallbackPayload, { onConflict: "id" });
      if (fallbackErr)
        throw new Error(`Products sync error: ${fallbackErr.message}`);
    }
    pushedCount.products = productPayload.length;
  }

  // 3. Upsert Inventory Batches
  if (data.inventoryBatches.length > 0) {
    const batchPayload = data.inventoryBatches.map((b) => ({
      id: b.id,
      product_id: b.productId,
      sku: b.sku || "",
      batch_number: b.batchNumber,
      mfg_date: sanitizeDate(b.mfgDate),
      expiry_date: sanitizeDate(b.expiryDate),
      warehouse_id: b.warehouseId || null,
      quantity: b.quantity || 0,
      cost_price: b.costPrice || 0,
      mrp: b.mrp || 0,
      notes: b.notes || "",
      updated_at: new Date().toISOString(),
    }));
    const { error } = await client
      .from("inventory_batches")
      .upsert(batchPayload, { onConflict: "id" });
    if (error) {
      // Fallback if sku column not yet in inventory_batches
      const fallbackBatchPayload = batchPayload.map(
        ({ sku: _sku, ...rest }) => rest,
      );
      await client
        .from("inventory_batches")
        .upsert(fallbackBatchPayload, { onConflict: "id" });
    }
    pushedCount.inventoryBatches = batchPayload.length;
  }

  // 4. Upsert GRNs (Inward Consignments & Invoices)
  if (data.grns && data.grns.length > 0) {
    // A. Attempt to upsert directly to grns table
    try {
      const grnPayload = data.grns.map((g) => ({
        id: g.id,
        grn_number: g.grnNumber,
        invoice_no: g.invoiceNo || "",
        supplier_name: g.supplierName || "",
        supplier_gstin: g.supplierGstin || "",
        supplier_address: g.supplierAddress || "",
        supplier_phone: g.supplierPhone || "",
        supplier_email: g.supplierEmail || "",
        inward_date:
          sanitizeDate(g.inwardDate) || todayISO(),
        vehicle_no: g.vehicleNo || "",
        warehouse_id: g.warehouseId || "",
        warehouse_name: g.warehouseName || "",
        items: g.items,
        total_billed_qty: g.totalBilledQty || 0,
        total_free_qty: g.totalFreeQty || 0,
        total_paid_qty: g.totalPaidQty || 0,
        total_received_qty: g.totalReceivedQty || 0,
        total_taxable: g.totalTaxable || 0,
        total_cgst: g.totalCgst || 0,
        total_sgst: g.totalSgst || 0,
        total_tax: g.totalTax || 0,
        grand_total: g.grandTotal || 0,
        inward_costs: g.inwardCosts || {},
        total_inward_cost: g.totalInwardCost || 0,
        inward_cost_per_crate: g.inwardCostPerCrate || 0,
        notes: g.notes || "",
        edit_history: g.editHistory || [],
        extra: grnExtraFields(g),
        updated_at: new Date().toISOString(),
      }));
      // Columns that do not exist yet (edit_history, extra) are dropped automatically so the GRN always saves.
      const { error: grnErr } = await resilientSupabaseUpsert(client, "grns", grnPayload, {
        onConflict: "id",
      });
      if (!grnErr) {
        pushedCount.grns = grnPayload.length;
      }
    } catch {
      // Table may not exist yet in schema
    }

    // B. Mirror in billing_settings with id: 'inward_grns' to guarantee persistence
    try {
      await client.from("billing_settings").upsert(
        {
          id: "inward_grns",
          data: { grns: data.grns },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
      if (pushedCount.grns === 0) {
        pushedCount.grns = data.grns.length;
      }
    } catch (e) {
      console.warn("Mirror inward_grns in billing_settings warning:", e);
    }
  }

  // 5. Upsert Promotions
  if (data.promotions.length > 0) {
    const promoPayload = data.promotions.map((pr) => {
      const cleanIds = (
        Array.isArray(pr.productIds)
          ? pr.productIds
          : (pr as any).product_ids || []
      )
        .map(Number)
        .filter((n: number) => !isNaN(n));

      const cleanGroup = (
        Array.isArray(pr.productGroup) && pr.productGroup.length > 0
          ? pr.productGroup
          : Array.isArray((pr as any).config?.productGroup) && (pr as any).config.productGroup.length > 0
          ? (pr as any).config.productGroup
          : cleanIds
      )
        .map(Number)
        .filter((n: number) => !isNaN(n));

      const groupCat = pr.groupCategory ?? (pr as any).config?.groupCategory ?? null;
      const groupBr = pr.groupBrand ?? (pr as any).config?.groupBrand ?? null;
      const fItemRule = pr.freeItemRule ?? pr.freeItem ?? (pr as any).config?.freeItemRule ?? (pr as any).config?.freeItem ?? "CHEAPEST_IN_GROUP";
      const choicePid = pr.customerChoiceProductId ? Number(pr.customerChoiceProductId) : ((pr as any).config?.customerChoiceProductId ? Number((pr as any).config.customerChoiceProductId) : null);

      const promoConfig = {
        ...(pr.config || {}),
        productGroup: cleanGroup,
        groupCategory: groupCat,
        groupBrand: groupBr,
        freeItemRule: fItemRule,
        freeItem: fItemRule,
        customerChoiceProductId: choicePid,
        originalType: pr.type,
      };

      // Safe DB type for check constraint; real type kept in config.originalType
      const ALLOWED = new Set(["bogo", "percent", "flat"]);
      const safeDbType = ALLOWED.has(String(pr.type)) ? String(pr.type) : "bogo";

      return {
        id: Number(pr.id),
        name: pr.name,
        type: safeDbType,
        buy_qty: pr.buyQty || 0,
        free_qty: pr.freeQty || 0,
        percent: pr.percent || 0,
        flat_per_case: pr.flatPerCase || 0,
        product_ids: cleanGroup.length > 0 ? cleanGroup : cleanIds,
        bundle_buy_type: pr.bundleBuyType || "any",
        required_distinct_types: pr.requiredDistinctTypes || 2,
        min_qty_per_type: pr.minQtyPerType || 1,
        free_reward_choice: pr.freeRewardChoice || "all_eligible",
        free_product_id: pr.freeProductId ? Number(pr.freeProductId) : null,
        free_product_qty: pr.freeProductQty || 1,
        is_active: pr.isActive !== false,
        config: promoConfig,
      };
    });
    const { error } = await client
      .from("promotions")
      .upsert(promoPayload, { onConflict: "id" });
    if (error) {
      console.warn(
        "Promotions upsert with full schema warning, attempting fallback without bundle columns:",
        error.message,
      );
      const fallbackPromoPayload = promoPayload.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type, // already safeDbType
        buy_qty: p.buy_qty,
        free_qty: p.free_qty,
        percent: p.percent,
        flat_per_case: p.flat_per_case,
        product_ids: p.product_ids,
        config: p.config,
      }));
      await client
        .from("promotions")
        .upsert(fallbackPromoPayload, { onConflict: "id" });
    }
    // Also mirror to app_collections 'schemes' to guarantee zero data loss
    try {
      await client.from("app_collections").upsert(
        {
          key: "schemes",
          data: data.promotions,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" },
      );
    } catch {}
    pushedCount.promotions = promoPayload.length;
  }

  // 6. Upsert Bills
  if (data.bills.length > 0) {
    const billPayload = data.bills.map((b) => ({
      id: b.id,
      retailer: b.retailer,
      phone: b.phone || null,
      date: b.date,
      subtotal: b.subtotal,
      cgst: b.cgst,
      sgst: b.sgst,
      total: b.total,
      discount: b.discount,
      amount_paid: b.amountPaid,
      cancellation: b.cancellation ?? null,
      returns: b.returns && b.returns.length > 0 ? b.returns : null,
      cancelled_returns: b.cancelledReturns && b.cancelledReturns.length > 0 ? b.cancelledReturns : null,
      edit_history: b.editHistory && b.editHistory.length > 0 ? b.editHistory : null,
      warehouse_id: b.warehouseId || null,
      salesman_id: isValidUuid(b.salesmanId) ? b.salesmanId : null,
      salesman: b.salesman || null,
      supply_type: b.supplyType || "B2C",
      customer_gstin: b.customerGstin || null,
      is_retrospective: b.isRetrospective === true,
      extra: billExtraFields(b),
      items: b.items,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await resilientSupabaseUpsert(
      client,
      "bills",
      billPayload,
      { onConflict: "id" },
    );
    if (error) throw new Error(`Bills sync error: ${error.message}`);
    pushedCount.bills = billPayload.length;
  }

  // 7. Upsert Trips
  if (data.trips.length > 0) {
    const tripPayload = data.trips.map((t) => ({
      id: t.id,
      vehicle: t.vehicle,
      salesman_id: isValidUuid(t.salesmanId) ? t.salesmanId : null,
      salesman: t.salesman || null,
      salesman_phone: t.salesmanPhone || null,
      date: t.date,
      warehouse_id: t.warehouseId || null,
      loaded: parseJsonDict(t.loaded),
      warehouse_loads: t.warehouseLoads || {},
      shortage_reasons: t.shortageReasons || {},
      route: t.route || null,
      driver: t.driver || null,
      driver_phone: t.driverPhone || null,
      returned: t.status === "closed" ? parseJsonDict(t.returned) : {},
      draft_returned: t.status === "closed" ? {} : parseJsonDict(t.draftReturned),
      cash_handed_in: t.cashHandedIn ?? null,
      cash_short_booked: t.cashShortBooked ?? null,
      cash_recoveries: t.cashRecoveries || [],
      cash_short_written_off: t.cashShortWrittenOff === true,
      bill_ids: parseBillIds(t.billIds),
      status: t.status || "out",
      updated_at: t.updatedAt || new Date().toISOString(),
    }));
    const { error } = await resilientSupabaseUpsert(
      client,
      "trips",
      tripPayload,
      { onConflict: "id" },
    );
    if (error) throw new Error(`Trips sync error: ${error.message}`);
    pushedCount.trips = tripPayload.length;
  }

  // 8. Upsert Salesmen
  if (data.salesmen && data.salesmen.length > 0) {
    try {
      const salesmanPayload = data.salesmen.map((s) => ({
        id: s.id,
        name: s.name,
        phone: s.phone,
        pin_hash: s.pinHash,
        active: s.active !== undefined ? Boolean(s.active) : true,
        default_vehicle: s.defaultVehicle || "",
        updated_at: new Date().toISOString(),
      }));
      const { error: smErr } = await client
        .from("salesmen")
        .upsert(salesmanPayload, { onConflict: "id" });
      if (smErr) console.warn("Salesmen sync notice:", smErr.message);
      else pushedCount.salesmen = salesmanPayload.length;
    } catch (e) {
      console.warn("Salesmen sync exception:", e);
    }
  }

  // 9. Upsert Audits
  if (data.audits.length > 0) {
    const auditPayload = data.audits.map((a) => ({
      id: a.id,
      date: a.date,
      entries: a.entries,
      adjusted: Boolean(a.adjusted),
    }));
    const { error } = await client
      .from("audits")
      .upsert(auditPayload, { onConflict: "id" });
    if (error) throw new Error(`Audits sync error: ${error.message}`);
    pushedCount.audits = auditPayload.length;
  }

  // 9. Upsert Organization Profile & Billing Settings
  const { error: orgErr } = await client.from("organization_profile").upsert({
    id: "default",
    data: data.orgProfile,
    updated_at: new Date().toISOString(),
  });
  if (orgErr)
    console.warn(`Organization profile sync notice: ${orgErr.message}`);

  const { error: setErr } = await client.from("billing_settings").upsert({
    id: "default",
    data: data.billingSettings,
    updated_at: new Date().toISOString(),
  });
  if (setErr) console.warn(`Billing settings sync notice: ${setErr.message}`);

  // 10. Upsert Supplier Schemes & Incentives (idempotent per-record upserts — reuses
  // the same functions individual CRUD actions call, so a full "sync now" and a normal
  // add/edit can never diverge in how a record is written).
  if (data.supplierSchemes && data.supplierSchemes.length > 0) {
    let ok = 0;
    for (const s of data.supplierSchemes) {
      const res = await pushSupplierSchemeToSupabase(s);
      if (res.success) ok++;
    }
    pushedCount.supplierSchemes = ok;
  }
  if (
    data.supplierSchemeApplications &&
    data.supplierSchemeApplications.length > 0
  ) {
    let ok = 0;
    for (const a of data.supplierSchemeApplications) {
      const res = await pushSupplierSchemeApplicationToSupabase(a);
      if (res.success) ok++;
    }
    pushedCount.supplierSchemeApplications = ok;
  }
  if (data.supplierCreditNotes && data.supplierCreditNotes.length > 0) {
    let ok = 0;
    for (const n of data.supplierCreditNotes) {
      const res = await pushSupplierCreditNoteToSupabase(n);
      if (res.success) ok++;
    }
    pushedCount.supplierCreditNotes = ok;
  }

  // 11. Upsert Smart Stock Reconciliation & Audit Sessions
  if (data.auditSessions && data.auditSessions.length > 0) {
    let ok = 0;
    for (const s of data.auditSessions) {
      const res = await pushAuditSessionToSupabase(s);
      if (res.success) ok++;
    }
    pushedCount.auditSessions = ok;
  }
  if (
    data.reconciliationTransactions &&
    data.reconciliationTransactions.length > 0
  ) {
    let ok = 0;
    for (const t of data.reconciliationTransactions) {
      const res = await pushReconciliationTransactionToSupabase(t);
      if (res.success) ok++;
    }
    pushedCount.reconciliationTransactions = ok;
  }
  if (data.stockLedgerEntries && data.stockLedgerEntries.length > 0) {
    let ok = 0;
    for (const e of data.stockLedgerEntries) {
      const res = await pushStockLedgerEntryToSupabase(e);
      if (res.success) ok++;
    }
    pushedCount.stockLedgerEntries = ok;
  }

  // 12. Upsert Payments & Collections
  if (data.payments && data.payments.length > 0) {
    try {
      await pushPaymentsToSupabase(data.payments);
      pushedCount.payments = data.payments.length;
    } catch (e) {
      console.warn("Payments sync notice:", e);
    }
  }

  return {
    success: true,
    pushedCount,
  };
}

/**
 * Pushes a single Inward Consignment (GRN) and its derived products & batches
 * immediately and directly to the Supabase PostgreSQL database.
 */
export async function pushInwardInvoiceToSupabase(params: {
  grn: GRN;
  products: Product[];
  inventoryBatches: InventoryBatch[];
  allGrns: GRN[];
  warehouse?: Warehouse;
}): Promise<{
  success: boolean;
  cloudSynced: boolean;
  message: string;
  error?: string;
}> {
  if (isServerProxyMode()) {
    const res = await proxyFetch("/api/grns/inward", {
      method: "POST",
      timeoutMs: 30000,
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      return {
        success: false,
        cloudSynced: false,
        message: res.error || "Failed to persist invoice via server proxy",
        error: res.error,
      };
    }
    return {
      success: true,
      cloudSynced: true,
      message: `Invoice ${params.grn.grnNumber} (${params.grn.invoiceNo}) successfully stored via server proxy!`,
    };
  }
  const client = getSupabaseClient();
  if (!client) {
    return {
      success: true,
      cloudSynced: false,
      message: "Supabase client is not configured.",
      error: "Client not configured",
    };
  }

  try {
    // 1. Ensure target warehouse exists in Supabase
    if (params.warehouse) {
      await client.from("warehouses").upsert(
        {
          id: params.warehouse.id,
          name: params.warehouse.name,
          code: params.warehouse.code,
          location: params.warehouse.location || "",
          manager: params.warehouse.manager || "",
          phone: params.warehouse.phone || "",
          capacity_cases: params.warehouse.capacityCases || 0,
          is_default: Boolean(params.warehouse.isDefault),
          notes: params.warehouse.notes || "",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
    } else {
      // Seed default warehouses if none exist
      const { count } = await client
        .from("warehouses")
        .select("*", { count: "exact", head: true });
      if (!count || count === 0) {
        await client.from("warehouses").upsert(
          INIT_WAREHOUSES.map((w) => ({
            id: w.id,
            name: w.name,
            code: w.code,
            location: w.location || "",
            is_default: Boolean(w.isDefault),
            updated_at: new Date().toISOString(),
          })),
          { onConflict: "id" },
        );
      }
    }

    // 2. Upsert all products created or updated by this inward invoice
    if (params.products.length > 0) {
      const productPayload = params.products.map((p) => ({
        id: p.id,
        sku: p.sku || generateSkuId(p.name, p.category, p.id),
        name: String(p.name || "").trim().toUpperCase(),
        category: p.category,
        volume: p.volume,
        pack: p.pack,
        expiry: p.expiry || "",
        batch_number: p.batchNumber || "",
        mfg_date: p.mfgDate || "",
        warehouse_id: p.warehouseId || "",
        opening: p.opening,
        cost: p.cost,
        effective_cost: p.effectiveCost || p.cost,
        retail: p.retail,
        wholesale: p.wholesale,
        hsn: p.hsn || "",
        gst_rate: resolveProductGstRate(p),
        scheme: p.scheme || "",
        updated_at: new Date().toISOString(),
      }));
      let { error: prodErr } = await client
        .from("products")
        .upsert(
          productPayload.map((row, i) => ({ ...row, extra: productExtraFields(params.products[i]) })),
          { onConflict: "id" },
        );
      if (prodErr) {
        // `extra` column not added yet (migration 014): save the rest as before
        ({ error: prodErr } = await client
          .from("products")
          .upsert(productPayload, { onConflict: "id" }));
      }
      if (prodErr) {
        // Fallback for older schema
        const fallbackPayload = params.products.map((p) => ({
          id: p.id,
          name: String(p.name || "").trim().toUpperCase(),
          category: p.category,
          volume: p.volume,
          pack: p.pack,
          expiry: p.expiry,
          batch_number: p.batchNumber || "",
          mfg_date: p.mfgDate || "",
          warehouse_id: p.warehouseId || "",
          opening: p.opening,
          cost: p.cost,
          retail: p.retail,
          wholesale: p.wholesale,
          updated_at: new Date().toISOString(),
        }));
        await client
          .from("products")
          .upsert(fallbackPayload, { onConflict: "id" });
      }
    }

    // 3. Upsert inventory batches into inventory_batches table
    if (params.inventoryBatches.length > 0) {
      const batchPayload = params.inventoryBatches.map((b) => ({
        id: b.id,
        product_id: b.productId,
        sku: b.sku || "",
        batch_number: b.batchNumber,
        mfg_date: sanitizeDate(b.mfgDate),
        expiry_date: sanitizeDate(b.expiryDate),
        warehouse_id: b.warehouseId || null,
        quantity: b.quantity || 0,
        cost_price: b.costPrice || 0,
        mrp: b.mrp || 0,
        notes: b.notes || "",
        updated_at: new Date().toISOString(),
      }));
      const { error: batchErr } = await client
        .from("inventory_batches")
        .upsert(batchPayload, { onConflict: "id" });
      if (batchErr) {
        const fallbackBatchPayload = batchPayload.map(
          ({ sku: _sku, ...rest }) => rest,
        );
        await client
          .from("inventory_batches")
          .upsert(fallbackBatchPayload, { onConflict: "id" });
      }
    }

    // 4. Persist GRN record in Supabase:
    // Try public.grns table first
    const grnPayload = {
      id: params.grn.id,
      grn_number: params.grn.grnNumber,
      invoice_no: params.grn.invoiceNo || "",
      supplier_name: params.grn.supplierName || "",
      supplier_gstin: params.grn.supplierGstin || "",
      supplier_address: params.grn.supplierAddress || "",
      supplier_phone: params.grn.supplierPhone || "",
      supplier_email: params.grn.supplierEmail || "",
      inward_date:
        sanitizeDate(params.grn.inwardDate) ||
        todayISO(),
      vehicle_no: params.grn.vehicleNo || "",
      warehouse_id: params.grn.warehouseId || "",
      warehouse_name: params.grn.warehouseName || "",
      items: params.grn.items,
      total_billed_qty: params.grn.totalBilledQty || 0,
      total_free_qty: params.grn.totalFreeQty || 0,
      total_paid_qty: params.grn.totalPaidQty || 0,
      total_received_qty: params.grn.totalReceivedQty || 0,
      total_taxable: params.grn.totalTaxable || 0,
      total_cgst: params.grn.totalCgst || 0,
      total_sgst: params.grn.totalSgst || 0,
      total_tax: params.grn.totalTax || 0,
      grand_total: params.grn.grandTotal || 0,
      inward_costs: params.grn.inwardCosts || {},
      total_inward_cost: params.grn.totalInwardCost || 0,
      inward_cost_per_crate: params.grn.inwardCostPerCrate || 0,
      notes: params.grn.notes || "",
      edit_history: params.grn.editHistory || [],
      extra: grnExtraFields(params.grn),
      updated_at: new Date().toISOString(),
    };

    try {
      // Columns that do not exist yet (edit_history, extra) are dropped automatically so the GRN always saves.
      await resilientSupabaseUpsert(client, "grns", grnPayload, { onConflict: "id" });
    } catch {
      // grns table might not exist yet
    }

    // Always mirror the complete list of GRNs in billing_settings for foolproof persistence
    // Fetch and merge with existing so previous invoices are never overwritten
    try {
      const { data: existingSet } = await client
        .from("billing_settings")
        .select("data")
        .eq("id", "inward_grns")
        .maybeSingle();
      const existingList = Array.isArray(existingSet?.data?.grns)
        ? existingSet.data.grns
        : [];
      const mergedMap = new Map<string, any>();
      existingList.forEach((g: any) => {
        if (g && (g.id || g.invoiceNo || g.grnNumber)) {
          mergedMap.set(String(g.id || g.invoiceNo || g.grnNumber), g);
        }
      });
      params.allGrns.forEach((g) => {
        if (g && (g.id || g.invoiceNo || g.grnNumber)) {
          mergedMap.set(String(g.id || g.invoiceNo || g.grnNumber), g);
        }
      });
      const combinedGrns = Array.from(mergedMap.values());

      await client.from("billing_settings").upsert(
        {
          id: "inward_grns",
          data: { grns: combinedGrns },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
    } catch (e) {
      console.warn("Error mirroring inward_grns:", e);
    }

    return {
      success: true,
      cloudSynced: true,
      message: `Invoice ${params.grn.grnNumber} (${params.grn.invoiceNo}) successfully stored in Supabase PostgreSQL database!`,
    };
  } catch (err: any) {
    console.error("Error pushing inward invoice to Supabase:", err);
    return {
      success: false,
      cloudSynced: false,
      message: err?.message || "Failed to persist invoice to Supabase",
      error: err?.message,
    };
  }
}

/**
 * Fetches all ledger data from Supabase database tables
 */
export async function pullLedgerFromSupabase(): Promise<{
  warehouses?: Warehouse[];
  products?: Product[];
  inventoryBatches?: InventoryBatch[];
  grns?: GRN[];
  stockTransfers?: StockTransfer[];
  promotions?: Promotion[];
  bills?: Bill[];
  trips?: Trip[];
  audits?: Audit[];
  payments?: PaymentRecord[];
  paymentAudit?: PaymentAuditEntry[];
  orgProfile?: OrganizationProfile;
  billingSettings?: BillingSettings;
  salesmen?: Salesman[];
  auditSessions?: AuditSession[];
  reconciliationTransactions?: ReconciliationTransaction[];
  stockLedgerEntries?: StockLedgerEntry[];
} | null> {
  if (isServerProxyMode()) {
    const res = await proxyFetch<{ success?: boolean; data?: any }>(
      "/api/sync/pull",
      { method: "GET", timeoutMs: 30000 },
    );
    if (!res.ok || !res.data?.data) return null;
    const d = res.data.data;
    return Object.keys(d).length > 0 ? d : null;
  }
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const [
      whRes,
      prodRes,
      batchRes,
      promoRes,
      billRes,
      tripRes,
      auditRes,
      orgRes,
      setRes,
      grnRes,
      inwardGrnSettingRes,
      inwardGrnAppCollectionRes,
      paymentsSettingRes,
      paymentsAppCollectionRes,
      paymentsTableRes,
      paymentHistoryRes,
      salesmanRes,
      auditSessionsRes,
      reconciliationTransactionsRes,
      stockLedgerEntriesRes,
      auditSessionsSettingRes,
      stockLedgerSettingRes,
      reconciliationTransactionsSettingRes,
      dispositionsRes,
      creditNotesRes,
      schemesRes,
      schemesAppCollectionRes,
    ] = await Promise.all([
      client.from("warehouses").select("*").order("name", { ascending: true }),
      fetchTableDelta(client, { table: "products", idCol: "id", cursorCol: "updated_at", orderCol: "id", ascending: true }),
      fetchTableDelta(client, { table: "inventory_batches", idCol: "id", cursorCol: "updated_at", orderCol: "created_at", ascending: true }),
      client.from("promotions").select("*").order("id", { ascending: true }),
      fetchTableDelta(client, { table: "bills", idCol: "id", cursorCol: "updated_at", orderCol: "id", ascending: true }),
      fetchTableDelta(client, { table: "trips", idCol: "id", cursorCol: "updated_at", orderCol: "id", ascending: true }),
      client.from("audits").select("*").order("id", { ascending: true }),
      client
        .from("organization_profile")
        .select("*")
        .eq("id", "default")
        .maybeSingle(),
      client
        .from("billing_settings")
        .select("*")
        .eq("id", "default")
        .maybeSingle(),
      fetchTableDelta(client, { table: "grns", idCol: "id", cursorCol: "updated_at", orderCol: "id", ascending: true }),
      fetchRowIfChanged(client, "billing_settings", "id", "inward_grns"),
      fetchRowIfChanged(client, "app_collections", "key", "inward_grns"),
      fetchRowIfChanged(client, "billing_settings", "id", "collection_payments"),
      fetchRowIfChanged(client, "app_collections", "key", "payments"),
      fetchTableDelta(client, { table: "payments", idCol: "id", cursorCol: "updated_at", orderCol: "payment_date", ascending: false }).catch(() => ({ data: null, error: true })),
      Promise.resolve(client.from("payment_history").select("*").order("changed_at", { ascending: false }).limit(1000)).catch(() => ({ data: null, error: true })),
      fetchTableDelta(client, { table: "salesmen", idCol: "id", cursorCol: "updated_at", orderCol: "name", ascending: true }),
      fetchTableDelta(client, { table: "audit_sessions", idCol: "id", cursorCol: "updated_at", orderCol: "created_at", ascending: false }),
      fetchTableDelta(client, { table: "reconciliation_transactions", idCol: "id", cursorCol: "created_at", orderCol: "created_at", ascending: false }),
      fetchTableDelta(client, { table: "stock_ledger_entries", idCol: "id", cursorCol: "timestamp", orderCol: "timestamp", ascending: false }),
      fetchRowIfChanged(client, "billing_settings", "id", "collection_audit_sessions"),
      fetchRowIfChanged(client, "billing_settings", "id", "collection_stock_ledger_entries"),
      fetchRowIfChanged(client, "billing_settings", "id", "collection_reconciliation_transactions"),
      fetchTableDelta(client, { table: "inventory_dispositions", idCol: "id", cursorCol: "updated_at", orderCol: "event_date", ascending: false }),
      fetchTableDelta(client, { table: "supplier_credit_notes", idCol: "id", cursorCol: "updated_at", orderCol: "created_at", ascending: false }),
      fetchTableDelta(client, { table: "supplier_schemes", idCol: "id", cursorCol: "updated_at", orderCol: "created_at", ascending: false }),
      // Full scheme objects (group / bundle / free-item rules) live here —
      // promotions table may only hold a constrained subset of types.
      fetchRowIfChanged(client, "app_collections", "key", "schemes"),
    ]);

    const result: any = {};

    if (!whRes.error && whRes.data && whRes.data.length > 0) {
      result.warehouses = whRes.data.map((r: any) => ({
        id: String(r.id),
        name: r.name,
        code: r.code || "",
        location: r.location || "",
        manager: r.manager || "",
        phone: r.phone || "",
        capacityCases: Number(r.capacity_cases || 0),
        isDefault: Boolean(r.is_default),
        notes: r.notes || "",
      }));
    } else {
      // Seed initial base warehouses so that foreign key constraints never fail
      try {
        await client.from("warehouses").upsert(
          INIT_WAREHOUSES.map((w) => ({
            id: w.id,
            name: w.name,
            code: w.code,
            location: w.location || "",
            is_default: Boolean(w.isDefault),
            updated_at: new Date().toISOString(),
          })),
          { onConflict: "id" },
        );
        result.warehouses = INIT_WAREHOUSES;
      } catch {
        // ignore if table not accessible yet
      }
    }

    if (!batchRes.error && batchRes.data && batchRes.data.length > 0) {
      result.inventoryBatches = batchRes.data.map((r: any) => ({
        id: String(r.id),
        productId: Number(r.product_id),
        sku: r.sku || "",
        batchNumber: r.batch_number,
        mfgDate: r.mfg_date || "",
        expiryDate: r.expiry_date || "",
        warehouseId: r.warehouse_id || "",
        quantity: Number(r.quantity || 0),
        billedQuantity: Number(r.billed_quantity || r.quantity || 0),
        freeQuantity: Number(r.free_quantity || 0),
        costPrice: Number(r.cost_price || 0),
        effectiveCostPrice: Number(r.effective_cost_price || r.cost_price || 0),
        landedCostPerCrate: Number(r.landed_cost_per_crate || 0),
        mrp: Number(r.mrp || 0),
        notes: r.notes || "",
        supplierInvoiceNo: r.supplier_invoice_no || "",
        supplierName: r.supplier_name || "",
        inwardDate: r.inward_date || "",
      }));
    }

    if (!prodRes.error && prodRes.data && prodRes.data.length > 0) {
      result.products = prodRes.data.map((r: any) => {
        const catKey = r.category as CategoryKey;
        const catDef = CATS?.[catKey];
        const extraTaxability =
          r.extra && typeof r.extra === "object" ? (r.extra as any).taxability : undefined;
        // Standard beverage GST: 40% for energy & vibe, 5% for joos, 18% for water
        // Non-GST / trading products stay strictly at 0% GST and keep their HSN untouched.
        const hsnRate = extraTaxability === "non_gst" ? 0 : gstRateFromHsn(r.hsn);
        let gst =
          extraTaxability === "non_gst"
            ? 0
            : r.gst_rate !== undefined && r.gst_rate !== null
              ? Number(r.gst_rate)
              : (hsnRate ?? catDef?.gst ?? 0.18);
        if (extraTaxability !== "non_gst" && gst === 0.18) {
          if (hsnRate != null && hsnRate !== 0.18) gst = hsnRate;
          else if (hsnRate == null && !r.hsn && catDef && (catKey === 'vibe' || catKey === 'energy')) gst = catDef.gst;
        }

        const cost = Number(r.cost || 0);
        const effectiveCost = Number(r.effective_cost || cost);

        // Find genuine landed cost from batch records if available
        let landedCost = Number(r.landed_cost_per_crate || 0);
        if (!landedCost || landedCost <= 0) {
          const matchingBatch = result.inventoryBatches?.find(
            (b: any) => Number(b.productId) === Number(r.id) && Number(b.landedCostPerCrate) > 0
          );
          if (matchingBatch) {
            landedCost = Number(matchingBatch.landedCostPerCrate);
          }
        }
        if (!landedCost || landedCost <= 0) {
          landedCost = Math.round(cost * (1 + gst) * 100) / 100;
        }

        return applyProductExtra({
          id: Number(r.id),
          updatedAt: r.updated_at || undefined,
          sku: r.sku || generateSkuId(r.name, r.category, Number(r.id)),
          name: String(r.name || "").trim().toUpperCase(),
          category: r.category,
          volume: Number(r.volume || 0),
          pack: r.pack || "",
          expiry: r.expiry || "",
          batchNumber: r.batch_number || "",
          mfgDate: r.mfg_date || "",
          warehouseId: r.warehouse_id || "",
          opening: Number(r.opening || 0),
          cost,
          effectiveCost,
          landedCostPerCrate: landedCost,
          retail: Number(r.retail || 0),
          wholesale: Number(r.wholesale || 0),
          hsn: extraTaxability === "non_gst"
            ? String(r.hsn || "").trim()
            : normalizeTo8DigitHsn(r.hsn || catDef?.hsn, r.category, r.name, extraTaxability),
          gstRate: gst,
          scheme: r.scheme || "",
        }, r.extra);
      });
    }

    // Process Inward Consignments / Invoices (GRNs) from all Supabase sources
    const grnMap = new Map<string, any>();

    // 1. Inward GRNs from billing_settings mirror
    if (
      !inwardGrnSettingRes.error &&
      inwardGrnSettingRes.data?.data &&
      Array.isArray(inwardGrnSettingRes.data.data.grns)
    ) {
      inwardGrnSettingRes.data.data.grns.forEach((g: any) => {
        if (g && (g.id || g.invoiceNo || g.grnNumber)) {
          const key = String(g.id || g.invoiceNo || g.grnNumber);
          grnMap.set(key, g);
        }
      });
    }

    // 2. Inward GRNs from app_collections
    if (
      !inwardGrnAppCollectionRes.error &&
      inwardGrnAppCollectionRes.data?.data
    ) {
      const list = Array.isArray(inwardGrnAppCollectionRes.data.data)
        ? inwardGrnAppCollectionRes.data.data
        : inwardGrnAppCollectionRes.data.data.grns;
      if (Array.isArray(list)) {
        list.forEach((g: any) => {
          if (g && (g.id || g.invoiceNo || g.grnNumber)) {
            const key = String(g.id || g.invoiceNo || g.grnNumber);
            grnMap.set(key, g);
          }
        });
      }
    }

    // 3. GRNs from public.grns table
    if (!grnRes.error && grnRes.data && grnRes.data.length > 0) {
      grnRes.data.forEach((g: any) => {
        const mapped: any = {
          id: String(g.id),
          grnNumber: g.grn_number || g.id,
          invoiceNo: g.invoice_no || "",
          supplierName: g.supplier_name || "",
          supplierGstin: g.supplier_gstin || "",
          supplierAddress: g.supplier_address || "",
          supplierPhone: g.supplier_phone || "",
          supplierEmail: g.supplier_email || "",
          inwardDate: g.inward_date || "",
          vehicleNo: g.vehicle_no || "",
          warehouseId: g.warehouse_id || "",
          warehouseName: g.warehouse_name || "",
          items: Array.isArray(g.items) ? g.items : [],
          totalBilledQty: Number(g.total_billed_qty || 0),
          totalFreeQty: Number(g.total_free_qty || 0),
          totalPaidQty: Number(g.total_paid_qty || 0),
          totalReceivedQty: Number(g.total_received_qty || 0),
          totalTaxable: Number(g.total_taxable || 0),
          totalCgst: Number(g.total_cgst || 0),
          totalSgst: Number(g.total_sgst || 0),
          totalTax: Number(g.total_tax || 0),
          grandTotal: Number(g.grand_total || 0),
          inwardCosts: g.inward_costs || undefined,
          totalInwardCost: Number(g.total_inward_cost || 0),
          inwardCostPerCrate: Number(g.inward_cost_per_crate || 0),
          notes: g.notes || "",
          editHistory: Array.isArray(g.edit_history) ? g.edit_history : [],
          createdAt: g.created_at || new Date().toISOString(),
          updatedAt: g.updated_at || new Date().toISOString(),
        };
        const key = String(mapped.id || mapped.invoiceNo || mapped.grnNumber);
        // The table row only has the main columns: keep what the full mirror copy knows (place of supply, billed-to,
        // overall discount, ...) and let the saved `extra` fields and the real columns win over it.
        grnMap.set(key, { ...(grnMap.get(key) || {}), ...applyGrnExtra(mapped, g.extra) });
      });
    }

    if (grnMap.size > 0) {
      result.grns = Array.from(grnMap.values()).sort((a, b) => {
        const da = a.inwardDate || a.createdAt || "";
        const db = b.inwardDate || b.createdAt || "";
        return db.localeCompare(da);
      });
    }

    // Process Payments & Collections from Supabase (merge billing_settings, app_collections, and public.payments)
    const mergedPayments = mergePaymentSources<PaymentRecord>({
      legacy:
        !paymentsSettingRes.error && Array.isArray(paymentsSettingRes.data?.data?.payments)
          ? paymentsSettingRes.data.data.payments
          : null,
      collection: !paymentsAppCollectionRes.error ? paymentsAppCollectionRes.data?.data : null,
      tableRows:
        !(paymentsTableRes as any)?.error && Array.isArray((paymentsTableRes as any)?.data)
          ? (paymentsTableRes as any).data
          : [],
      mapRow: dbRowToPayment,
    });
    if (mergedPayments.length > 0) {
      result.payments = mergedPayments.sort((a, b) => {
        const da = a.paymentDate || a.createdAt || "";
        const db = b.paymentDate || b.createdAt || "";
        return db.localeCompare(da);
      });
    }
    if (
      !(paymentHistoryRes as any)?.error &&
      Array.isArray((paymentHistoryRes as any)?.data) &&
      (paymentHistoryRes as any).data.length > 0
    ) {
      result.paymentAudit = (paymentHistoryRes as any).data.map(dbRowToAudit);
    }

    // Prefer full scheme objects from app_collections (preserves group_buy_n_get_m_free,
    // bundle, freeItemRule, productGroup, etc.). Fall back to promotions table only
    // when the collection is empty — and restore originalType from config when present.
    const colSchemesRaw =
      !schemesAppCollectionRes?.error && schemesAppCollectionRes?.data
        ? (schemesAppCollectionRes.data as any)?.data
        : null;
    if (Array.isArray(colSchemesRaw) && colSchemesRaw.length > 0) {
      result.promotions = colSchemesRaw.map((p: any) => {
        const cfg = p?.config && typeof p.config === "object" ? p.config : {};
        const restoredType =
          p.type &&
          !["bogo", "percent", "flat"].includes(p.type)
            ? p.type
            : cfg.originalType || p.type || "bogo";
        const groupFromCfg = Array.isArray(cfg.productGroup)
          ? cfg.productGroup.map(Number).filter((n: number) => !isNaN(n))
          : [];
        const rawIds =
          p.productGroup ??
          p.product_group ??
          p.productIds ??
          p.product_ids ??
          groupFromCfg;
        let cleanIds: number[] = [];
        if (Array.isArray(rawIds)) {
          cleanIds = rawIds.map(Number).filter((n: number) => !isNaN(n));
        }
        return {
          ...p,
          id: Number(p.id),
          type: restoredType,
          productIds: cleanIds.length > 0 ? cleanIds : (Array.isArray(p.productIds) ? p.productIds.map(Number).filter((n: number) => !isNaN(n)) : []),
          productGroup:
            Array.isArray(p.productGroup) && p.productGroup.length > 0
              ? p.productGroup.map(Number).filter((n: number) => !isNaN(n))
              : groupFromCfg.length > 0
                ? groupFromCfg
                : cleanIds,
          groupCategory: p.groupCategory ?? cfg.groupCategory ?? undefined,
          groupBrand: p.groupBrand ?? cfg.groupBrand ?? undefined,
          freeItemRule:
            p.freeItemRule ??
            p.freeItem ??
            cfg.freeItemRule ??
            cfg.freeItem ??
            "CHEAPEST_IN_GROUP",
          freeItem:
            p.freeItemRule ??
            p.freeItem ??
            cfg.freeItemRule ??
            cfg.freeItem ??
            "CHEAPEST_IN_GROUP",
          customerChoiceProductId: p.customerChoiceProductId
            ? Number(p.customerChoiceProductId)
            : cfg.customerChoiceProductId
              ? Number(cfg.customerChoiceProductId)
              : undefined,
          isActive: p.isActive !== false,
        };
      });
    } else if (!promoRes.error && Array.isArray(promoRes.data)) {
      result.promotions = promoRes.data.map((r: any) => {
        const cfg = r?.config && typeof r.config === "object" ? r.config : {};
        const rawIds =
          r.product_ids ?? r.productIds ?? r.product_id ?? r.productId ?? cfg.productGroup;
        let cleanIds: number[] = [];
        if (Array.isArray(rawIds)) {
          cleanIds = rawIds.map(Number).filter((n: number) => !isNaN(n));
        } else if (typeof rawIds === "string") {
          try {
            const parsed = JSON.parse(rawIds);
            if (Array.isArray(parsed))
              cleanIds = parsed.map(Number).filter((n: number) => !isNaN(n));
            else
              cleanIds = rawIds
                .split(",")
                .map((s: string) => Number(s.trim()))
                .filter((n: number) => !isNaN(n));
          } catch {
            cleanIds = rawIds
              .split(",")
              .map((s: string) => Number(s.trim()))
              .filter((n: number) => !isNaN(n));
          }
        } else if (typeof rawIds === "number" && !isNaN(rawIds)) {
          cleanIds = [rawIds];
        }

        // Restore extended types that were forced to 'bogo' for the DB check constraint
        const restoredType =
          cfg.originalType ||
          (r.type && !["bogo", "percent", "flat"].includes(String(r.type))
            ? r.type
            : r.type) ||
          "bogo";

        return {
          id: Number(r.id),
          name: r.name,
          type: restoredType,
          buyQty: Number(r.buy_qty ?? r.buyQty ?? 0),
          freeQty: Number(r.free_qty ?? r.freeQty ?? 0),
          percent: Number(r.percent || 0),
          flatPerCase: Number(r.flat_per_case ?? r.flatPerCase ?? 0),
          productIds: cleanIds,
          isActive:
            r.is_active !== undefined
              ? Boolean(r.is_active)
              : r.isActive !== undefined
                ? Boolean(r.isActive)
                : true,
          bundleBuyType: r.bundle_buy_type ?? r.bundleBuyType ?? "any",
          requiredDistinctTypes: Number(
            r.required_distinct_types ?? r.requiredDistinctTypes ?? 2,
          ),
          minQtyPerType: Number(r.min_qty_per_type ?? r.minQtyPerType ?? 1),
          freeRewardChoice:
            r.free_reward_choice ?? r.freeRewardChoice ?? "all_eligible",
          freeProductId: r.free_product_id
            ? Number(r.free_product_id)
            : r.freeProductId
              ? Number(r.freeProductId)
              : undefined,
          freeProductQty: Number(r.free_product_qty ?? r.freeProductQty ?? 1),
          productGroup:
            Array.isArray(cfg.productGroup) && cfg.productGroup.length > 0
              ? cfg.productGroup.map(Number).filter((n: number) => !isNaN(n))
              : r.product_group ?? r.productGroup ?? cleanIds,
          groupCategory:
            r.group_category ?? r.groupCategory ?? cfg.groupCategory ?? undefined,
          groupBrand:
            r.group_brand ?? r.groupBrand ?? cfg.groupBrand ?? undefined,
          freeItemRule:
            r.free_item_rule ??
            r.freeItemRule ??
            cfg.freeItemRule ??
            cfg.freeItem ??
            "CHEAPEST_IN_GROUP",
          freeItem:
            r.free_item_rule ??
            r.freeItemRule ??
            cfg.freeItemRule ??
            cfg.freeItem ??
            "CHEAPEST_IN_GROUP",
          customerChoiceProductId: r.customer_choice_product_id
            ? Number(r.customer_choice_product_id)
            : r.customerChoiceProductId
              ? Number(r.customerChoiceProductId)
              : cfg.customerChoiceProductId
                ? Number(cfg.customerChoiceProductId)
                : undefined,
          config: cfg,
        };
      });
    }

    if (!billRes.error && billRes.data && billRes.data.length > 0) {
      result.bills = billRes.data.map((r: any) => applyBillExtra({
        id: Number(r.id),
        retailer: r.retailer,
        supplyType: r.supply_type === "B2B" ? "B2B" : "B2C",
        customerGstin: r.customer_gstin || undefined,
        isRetrospective: r.is_retrospective === true,
        phone: r.phone || "",
        date: r.date,
        subtotal: Number(r.subtotal || 0),
        cgst: Number(r.cgst || 0),
        sgst: Number(r.sgst || 0),
        total: Number(r.total || 0),
        discount: Number(r.discount || 0),
        amountPaid: Number(r.amount_paid || 0),
        status: r.cancellation ? "cancelled" : undefined,
        cancellation: r.cancellation || undefined,
        returns:
          Array.isArray(r.returns) && r.returns.length > 0
            ? r.returns
            : undefined,
        cancelledReturns:
          Array.isArray(r.cancelled_returns) && r.cancelled_returns.length > 0
            ? r.cancelled_returns
            : undefined,
        editHistory:
          Array.isArray(r.edit_history) && r.edit_history.length > 0
            ? r.edit_history
            : undefined,
        warehouseId: r.warehouse_id || "",
        salesman: r.salesman || "",
        salesmanId: r.salesman_id || undefined,
        items: Array.isArray(r.items) ? r.items : [],
      }, r.extra));
    }

    if (!tripRes.error && tripRes.data && tripRes.data.length > 0) {
      result.trips = tripRes.data.map(normalizeTrip);
    }

    if (!salesmanRes.error && salesmanRes.data && salesmanRes.data.length > 0) {
      result.salesmen = salesmanRes.data.map((r: any) => ({
        id: String(r.id),
        name: r.name || "",
        phone: r.phone || "",
        pinHash: r.pin_hash || r.pinHash || "",
        active: r.active !== undefined ? Boolean(r.active) : true,
        defaultVehicle: r.default_vehicle || r.defaultVehicle || "",
        createdAt: r.created_at || "",
        updatedAt: r.updated_at || "",
      }));
    }

    if (!auditRes.error && auditRes.data && auditRes.data.length > 0) {
      result.audits = auditRes.data.map((r: any) => ({
        id: Number(r.id),
        date: r.date,
        entries: Array.isArray(r.entries) ? r.entries : [],
        adjusted: Boolean(r.adjusted),
      }));
    }

    if (!orgRes.error && orgRes.data && orgRes.data.data) {
      result.orgProfile = orgRes.data.data;
    }

    if (!setRes.error && setRes.data && setRes.data.data) {
      result.billingSettings = setRes.data.data;
    }

    // Process Audit Sessions (Smart Reconciliation)
    if (
      !auditSessionsRes.error &&
      auditSessionsRes.data &&
      auditSessionsRes.data.length > 0
    ) {
      result.auditSessions = auditSessionsRes.data.map((r: any) => ({
        id: String(r.id),
        warehouseId: r.warehouse_id || "",
        warehouseName: r.warehouse_name || "",
        date: r.date || "",
        time: r.time || "",
        auditorName: r.auditor_name || "",
        referenceNote: r.reference_note || "",
        entries: Array.isArray(r.entries) ? r.entries : [],
        editLog: Array.isArray(r.edit_log) ? r.edit_log : [],
        createdAt: r.created_at || "",
        updatedAt: r.updated_at || "",
      }));
    } else if (
      !auditSessionsSettingRes.error &&
      auditSessionsSettingRes.data &&
      auditSessionsSettingRes.data.data &&
      Array.isArray(auditSessionsSettingRes.data.data.items) &&
      auditSessionsSettingRes.data.data.items.length > 0
    ) {
      result.auditSessions = auditSessionsSettingRes.data.data.items;
    }

    // Process Reconciliation Transactions
    if (
      !reconciliationTransactionsRes.error &&
      reconciliationTransactionsRes.data &&
      reconciliationTransactionsRes.data.length > 0
    ) {
      result.reconciliationTransactions =
        reconciliationTransactionsRes.data.map((r: any) => ({
          id: String(r.id),
          auditSessionId: String(r.audit_session_id),
          varianceEntryId: String(r.variance_entry_id),
          type: r.type,
          fromProductId: Number(r.from_product_id),
          toProductId: r.to_product_id ? Number(r.to_product_id) : undefined,
          quantity: Number(r.quantity || 0),
          reasonCode: r.reason_code || undefined,
          matchScore:
            r.match_score !== null && r.match_score !== undefined
              ? Number(r.match_score)
              : undefined,
          notes: r.notes || "",
          identifiedBy: r.identified_by || "",
          approvedBy: r.approved_by || undefined,
          approvedAt: r.approved_at || undefined,
          createdAt: r.created_at || "",
        }));
    } else if (
      !reconciliationTransactionsSettingRes.error &&
      reconciliationTransactionsSettingRes.data &&
      reconciliationTransactionsSettingRes.data.data &&
      Array.isArray(reconciliationTransactionsSettingRes.data.data.items) &&
      reconciliationTransactionsSettingRes.data.data.items.length > 0
    ) {
      result.reconciliationTransactions =
        reconciliationTransactionsSettingRes.data.data.items;
    }

    // Process Stock Ledger Entries
    if (
      !stockLedgerEntriesRes.error &&
      stockLedgerEntriesRes.data &&
      stockLedgerEntriesRes.data.length > 0
    ) {
      result.stockLedgerEntries = stockLedgerEntriesRes.data.map((r: any) => ({
        id: String(r.id),
        productId: Number(r.product_id),
        warehouseId: r.warehouse_id || "",
        quantity: Number(r.quantity || 0),
        transactionType: r.transaction_type || "audit_reconciliation",
        referenceAuditSessionId: r.reference_audit_session_id || undefined,
        referenceReconciliationId: r.reference_reconciliation_id || undefined,
        reason: r.reason || "",
        userId: r.user_id || undefined,
        userName: r.user_name || undefined,
        timestamp: r.timestamp || "",
      }));
    } else if (
      !stockLedgerSettingRes.error &&
      stockLedgerSettingRes.data &&
      stockLedgerSettingRes.data.data &&
      Array.isArray(stockLedgerSettingRes.data.data.items) &&
      stockLedgerSettingRes.data.data.items.length > 0
    ) {
      result.stockLedgerEntries = stockLedgerSettingRes.data.data.items;
    }

    // Process Inventory Dispositions
    if (
      !dispositionsRes.error &&
      dispositionsRes.data &&
      dispositionsRes.data.length > 0
    ) {
      result.inventoryDispositions = dispositionsRes.data.map((r: any) => ({
        id: r.id,
        dispositionType: r.disposition_type,
        productId: Number(r.product_id),
        productName: r.product_name || undefined,
        warehouseId: r.warehouse_id,
        warehouseName: r.warehouse_name || undefined,
        batchId: r.batch_id || undefined,
        batchNumber: r.batch_number || undefined,
        expiryDate: r.expiry_date || undefined,
        quantity: Number(r.quantity) || 0,
        unit: r.unit === "unit" ? "unit" : "case",
        costPerUnit: Number(r.cost_per_unit) || 0,
        costValue: Number(r.cost_value) || 0,
        supplierName: r.supplier_name || undefined,
        grnId: r.grn_id || undefined,
        supplierInvoiceNo: r.supplier_invoice_no || undefined,
        creditNoteNumber: r.credit_note_number || undefined,
        creditNoteDate: r.credit_note_date || undefined,
        cnTaxableValue: Number(r.cn_taxable_value) || 0,
        cnCgst: Number(r.cn_cgst) || 0,
        cnSgst: Number(r.cn_sgst) || 0,
        cnIgst: Number(r.cn_igst) || 0,
        cnTotal: Number(r.cn_total) || 0,
        compensationStatus: r.compensation_status || "not_applicable",
        compensatedAmount: Number(r.compensated_amount) || 0,
        compensatedAt: r.compensated_at || undefined,
        distributedToName: r.distributed_to_name || undefined,
        distributedToPhone: r.distributed_to_phone || undefined,
        salesmanId: r.salesman_id || undefined,
        salesmanName: r.salesman_name || undefined,
        reason: r.reason || "",
        notes: r.notes || undefined,
        referenceDocNo: r.reference_doc_no || undefined,
        attachmentRef: r.attachment_ref || undefined,
        createdBy: r.created_by || undefined,
        approvedBy: r.approved_by || undefined,
        eventDate: r.event_date,
        stockApplied: r.stock_applied !== false,
        returnTracking: r.return_tracking || undefined,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
    }

    // Process Supplier Credit Notes
    if (
      !creditNotesRes.error &&
      creditNotesRes.data &&
      creditNotesRes.data.length > 0
    ) {
      result.supplierCreditNotes = creditNotesRes.data.map((r: any) => ({
        id: String(r.id),
        supplierName: r.supplier_name,
        schemeId: r.scheme_id || undefined,
        grnId: r.grn_id || undefined,
        productId: r.product_id ? Number(r.product_id) : undefined,
        period: r.period || undefined,
        creditNoteNumber: r.credit_note_number || undefined,
        creditNoteDate: r.credit_note_date || undefined,
        expectedAmount: Number(r.expected_amount) || 0,
        actualAmount: Number(r.actual_amount) || 0,
        status: r.status,
        attachmentRef: r.attachment_ref || undefined,
        notes: r.notes || "",
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
    }

    // Process Supplier Schemes
    if (!schemesRes.error && schemesRes.data && schemesRes.data.length > 0) {
      result.supplierSchemes = schemesRes.data.map((r: any) => ({
        id: String(r.id),
        supplierName: r.supplier_name,
        name: r.name,
        schemeType: r.scheme_type,
        productIds: Array.isArray(r.product_ids)
          ? r.product_ids.map(Number)
          : [],
        warehouseId: r.warehouse_id || undefined,
        startDate: r.start_date,
        endDate: r.end_date || undefined,
        targetQuantity:
          r.target_quantity !== null && r.target_quantity !== undefined
            ? Number(r.target_quantity)
            : undefined,
        incentiveRate:
          r.incentive_rate !== null && r.incentive_rate !== undefined
            ? Number(r.incentive_rate)
            : undefined,
        calculationMethod: r.calculation_method || undefined,
        active: Boolean(r.active),
        notes: r.notes || "",
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
    }

    return Object.keys(result).length > 0 ? result : null;
  } catch (err) {
    console.error("Failed to pull ledger from Supabase:", err);
    return null;
  }
}
