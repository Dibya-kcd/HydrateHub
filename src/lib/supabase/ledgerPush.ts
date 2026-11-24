import {
  getSupabaseClient,
  isServerProxyMode,
  isValidUuid,
  proxyFetch,
  sanitizeDate,
  type SyncResult,
} from "./client";
import { changedOnlyClient, resilientSupabaseUpsert } from "./pushCache";
import { pushPaymentsToSupabase } from "./payments";
import {
  pushAuditSessionToSupabase,
  pushReconciliationTransactionToSupabase,
  pushStockLedgerEntryToSupabase,
  pushSupplierCreditNoteToSupabase,
  pushSupplierSchemeApplicationToSupabase,
  pushSupplierSchemeToSupabase,
} from "./inventoryAndSettings";
import { INIT_WAREHOUSES } from "../../constants/initialData";
import {
  billExtraFields,
  grnExtraFields,
  productExtraFields,
} from "../../utils/billExtra";
import {
  generateSkuId,
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
  GRN,
  InventoryBatch,
  OrganizationProfile,
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

export function formatBatchForSupabase(b: InventoryBatch) {
  return {
    id: String(b.id),
    product_id: Number(b.productId),
    sku: b.sku || "",
    batch_number: b.batchNumber,
    mfg_date: sanitizeDate(b.mfgDate),
    expiry_date: sanitizeDate(b.expiryDate),
    warehouse_id: b.warehouseId || null,
    quantity: Number(b.quantity || 0),
    billed_quantity: Number(b.billedQuantity ?? b.quantity ?? 0),
    free_quantity: Number(b.freeQuantity || 0),
    cost_price: Number(b.costPrice || 0),
    effective_cost_price: Number(b.effectiveCostPrice ?? b.costPrice ?? 0),
    landed_cost_per_crate: Number(b.landedCostPerCrate || 0),
    mrp: Number(b.mrp || 0),
    scheme: b.scheme || "",
    notes: b.notes || "",
    supplier_invoice_no: b.supplierInvoiceNo || "",
    supplier_name: b.supplierName || "",
    inward_date: sanitizeDate(b.inwardDate),
    updated_at: new Date().toISOString(),
  };
}

export function formatPromotionForSupabase(pr: Promotion) {
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
      : Array.isArray((pr as any).config?.productGroup) &&
          (pr as any).config.productGroup.length > 0
        ? (pr as any).config.productGroup
        : cleanIds
  )
    .map(Number)
    .filter((n: number) => !isNaN(n));

  const groupCat = pr.groupCategory ?? (pr as any).config?.groupCategory ?? null;
  const groupBr = pr.groupBrand ?? (pr as any).config?.groupBrand ?? null;
  const fItemRule =
    pr.freeItemRule ??
    pr.freeItem ??
    (pr as any).config?.freeItemRule ??
    (pr as any).config?.freeItem ??
    "CHEAPEST_IN_GROUP";
  const choicePid = pr.customerChoiceProductId
    ? Number(pr.customerChoiceProductId)
    : (pr as any).config?.customerChoiceProductId
      ? Number((pr as any).config.customerChoiceProductId)
      : null;

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
    product_group: cleanGroup,
    group_category: groupCat,
    group_brand: groupBr,
    free_item_rule: fItemRule,
    customer_choice_product_id: choicePid,
    is_active: pr.isActive !== false,
    config: promoConfig,
  };
}

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
    const batchPayload = data.inventoryBatches.map(formatBatchForSupabase);
    const { error: batchErr } = await resilientSupabaseUpsert(
      client,
      "inventory_batches",
      batchPayload,
      { onConflict: "id" },
    );
    if (!batchErr) {
      pushedCount.inventoryBatches = batchPayload.length;
    }
  }

  // 4. Upsert GRNs (Inward Consignments & Invoices)
  if (data.grns && data.grns.length > 0) {
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
      const { error: grnErr } = await resilientSupabaseUpsert(client, "grns", grnPayload, {
        onConflict: "id",
      });
      if (!grnErr) {
        pushedCount.grns = grnPayload.length;
      }
    } catch {
      // Table may not exist yet in schema
    }

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
    const promoPayload = data.promotions.map(formatPromotionForSupabase);
    const { error } = await resilientSupabaseUpsert(
      client,
      "promotions",
      promoPayload,
      { onConflict: "id" },
    );
    if (error) {
      console.warn("Promotions upsert warning:", error.message);
    }
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
      warehouse_id: a.warehouseId || "",
      entries: a.entries,
      adjusted: Boolean(a.adjusted),
    }));
    const { error } = await resilientSupabaseUpsert(
      client,
      "audits",
      auditPayload,
      { onConflict: "id" },
    );
    if (error) throw new Error(`Audits sync error: ${error.message}`);
    pushedCount.audits = auditPayload.length;
  }

  // 10. Upsert Organization Profile & Billing Settings
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

  // 11. Upsert Supplier Schemes & Incentives
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

  // 12. Upsert Smart Stock Reconciliation & Audit Sessions
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

  // 13. Upsert Payments & Collections
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
