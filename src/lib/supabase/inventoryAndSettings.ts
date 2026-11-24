import {
  getSupabaseClient,
  isServerProxyMode,
  proxyFetch,
  sanitizeDate,
} from "./client";
import { resilientSupabaseUpsert } from "./pushCache";
import { productExtraFields } from "../../utils/billExtra";
import {
  generateSkuId,
  normalizeTo8DigitHsn,
  resolveProductGstRate,
} from "../../utils/billing";
import type {
  Audit,
  AuditSession,
  BillingSettings,
  GRN,
  GrnEditRecord,
  InventoryBatch,
  InventoryDisposition,
  OrganizationProfile,
  Product,
  Promotion,
  ReconciliationTransaction,
  StockLedgerEntry,
  SupplierCreditNote,
  SupplierScheme,
  SupplierSchemeApplication,
  Warehouse,
} from "../../types";

async function upsertCollectionItemProxy<T extends { id: string | number }>(
  key: string,
  item: T,
): Promise<{ success: boolean; error?: string }> {
  const curRes = await proxyFetch<{ success?: boolean; data?: any[] }>(
    `/api/collections/${encodeURIComponent(key)}`,
    { method: "GET" },
  );
  if (!curRes.ok) {
    return {
      success: false,
      error: curRes.error || `Failed to load ${key}`,
    };
  }
  const existing = Array.isArray(curRes.data?.data) ? curRes.data.data : [];
  const targetId = String(item.id);
  const next = [
    item,
    ...existing.filter((x: any) => String(x?.id) !== targetId),
  ];
  const putRes = await proxyFetch<{ success?: boolean; error?: string }>(
    `/api/collections/${encodeURIComponent(key)}`,
    {
      method: "PUT",
      body: JSON.stringify({ data: next }),
    },
  );
  if (!putRes.ok) {
    return {
      success: false,
      error: putRes.error || `Failed to save ${key}`,
    };
  }
  return { success: true };
}

/**
 * Pushes a single product to Supabase
 */
export async function pushProductToSupabase(p: Product): Promise<void> {
  if (isServerProxyMode()) {
    await proxyFetch("/api/products", {
      method: "POST",
      body: JSON.stringify(p),
    });
    return;
  }
  const client = getSupabaseClient();
  if (!client) return;
  try {
    const payload = {
      id: p.id,
      sku: p.sku || generateSkuId(p.name, p.category, p.id),
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
      effective_cost: p.effectiveCost || p.cost,
      retail: p.retail,
      wholesale: p.wholesale,
      hsn: normalizeTo8DigitHsn(p.hsn, p.category, p.name, p.taxability),
      gst_rate: resolveProductGstRate(p),
      scheme: p.scheme || "",
      updated_at: p.updatedAt || new Date().toISOString(),
    };
    // Only send `extra` when this product has something in it, so a device that has none never blanks the cloud's.
    const extra = productExtraFields(p);
    let { error } = await client
      .from("products")
      .upsert(extra ? { ...payload, extra } : { ...payload }, { onConflict: "id" });
    if (error && extra) {
      // `extra` column not added yet (migration 014): save the rest as before
      ({ error } = await client.from("products").upsert(payload, { onConflict: "id" }));
    }
    if (error) {
      // Base schema fallback
      const fallback = {
        id: p.id,
        sku: p.sku || generateSkuId(p.name, p.category, p.id),
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
        updated_at: p.updatedAt || new Date().toISOString(),
      };
      await client.from("products").upsert(fallback, { onConflict: "id" });
    }
  } catch (e) {
    console.warn("Failed to push product to Supabase:", e);
  }
}

/**
 * Deletes a product from Supabase
 */
export async function deleteProductFromSupabase(id: number): Promise<void> {
  if (isServerProxyMode()) {
    await proxyFetch(`/api/products/${encodeURIComponent(String(id))}`, {
      method: "DELETE",
    });
    return;
  }
  const client = getSupabaseClient();
  if (!client) return;
  try {
    await client.from("products").delete().eq("id", id);
  } catch (e) {
    console.warn("Failed to delete product from Supabase:", e);
  }
}

/**
 * Pushes a single warehouse to Supabase public.warehouses table
 */
export async function pushWarehouseToSupabase(
  w: Warehouse,
): Promise<{ success: boolean; error?: string }> {
  if (isServerProxyMode()) {
    const res = await proxyFetch("/api/warehouses", {
      method: "POST",
      body: JSON.stringify(w),
    });
    return res.ok ? { success: true } : { success: false, error: res.error };
  }
  const client = getSupabaseClient();
  if (!client)
    return { success: false, error: "Supabase client is not configured" };
  try {
    const { error } = await client.from("warehouses").upsert(
      {
        id: String(w.id),
        name: w.name,
        code: w.code || "",
        location: w.location || "",
        manager: w.manager || "",
        phone: w.phone || "",
        capacity_cases: Number(w.capacityCases || 0),
        is_default: Boolean(w.isDefault),
        notes: w.notes || "",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (error) {
      console.warn("Failed to upsert warehouse in Supabase:", error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (e: any) {
    console.warn("Failed to push warehouse to Supabase:", e);
    return { success: false, error: e?.message || "Network error" };
  }
}

/**
 * Deletes a warehouse from Supabase public.warehouses table
 */
export async function deleteWarehouseFromSupabase(id: string): Promise<void> {
  if (isServerProxyMode()) {
    await proxyFetch(`/api/warehouses/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    return;
  }
  const client = getSupabaseClient();
  if (!client) return;
  try {
    await client.from("warehouses").delete().eq("id", id);
  } catch (e) {
    console.warn("Failed to delete warehouse from Supabase:", e);
  }
}

/**
 * Supplier Scheme & Incentive System — upsert(onConflict:'id') on every push means a
 * repeated sync of the same record (e.g. two tabs, a retried request, an offline queue
 * replaying) can never insert a duplicate row; it just re-applies the same values.
 */
export async function pushSupplierSchemeToSupabase(
  s: SupplierScheme,
): Promise<{ success: boolean; error?: string }> {
  if (isServerProxyMode()) {
    return upsertCollectionItemProxy("supplier_schemes", s);
  }
  const client = getSupabaseClient();
  if (!client)
    return { success: false, error: "Supabase client is not configured" };
  try {
    const { error } = await client.from("supplier_schemes").upsert(
      {
        id: s.id,
        supplier_name: s.supplierName,
        name: s.name,
        scheme_type: s.schemeType,
        product_ids: s.productIds,
        warehouse_id: s.warehouseId || null,
        start_date: s.startDate,
        end_date: s.endDate || null,
        target_quantity: s.targetQuantity ?? null,
        incentive_rate: s.incentiveRate ?? null,
        calculation_method: s.calculationMethod || null,
        active: s.active,
        notes: s.notes || "",
        created_at: s.createdAt,
        updated_at: s.updatedAt,
      },
      { onConflict: "id" },
    );
    if (error) {
      console.warn(
        "Failed to upsert supplier scheme in Supabase:",
        error.message,
      );
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (e: any) {
    console.warn("Failed to push supplier scheme to Supabase:", e);
    return { success: false, error: e?.message || "Network error" };
  }
}

export async function deleteSupplierSchemeFromSupabase(
  id: string,
): Promise<void> {
  if (isServerProxyMode()) {
    await proxyFetch(`/api/collections/supplier_schemes/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    return;
  }
  const client = getSupabaseClient();
  if (!client) return;
  try {
    await client.from("supplier_schemes").delete().eq("id", id);
  } catch (e) {
    console.warn("Failed to delete supplier scheme from Supabase:", e);
  }
}

export async function pushSupplierSchemeApplicationToSupabase(
  a: SupplierSchemeApplication,
): Promise<{ success: boolean; error?: string }> {
  if (isServerProxyMode()) {
    return upsertCollectionItemProxy("supplier_scheme_applications", a);
  }
  const client = getSupabaseClient();
  if (!client)
    return { success: false, error: "Supabase client is not configured" };
  try {
    const { error } = await client.from("supplier_scheme_applications").upsert(
      {
        id: a.id,
        scheme_id: a.schemeId,
        scheme_type: a.schemeType,
        grn_id: a.grnId,
        grn_line_id: a.grnLineId,
        product_id: a.productId,
        supplier_name: a.supplierName,
        supplier_invoice_no: a.supplierInvoiceNo || "",
        eligible_quantity: a.eligibleQuantity,
        free_quantity: a.freeQuantity,
        expected_benefit: a.expectedBenefit,
        warehouse_id: a.warehouseId || null,
        batch_id: a.batchId || null,
        notes: a.notes || "",
        created_at: a.createdAt,
      },
      { onConflict: "id" },
    );
    if (error) {
      console.warn(
        "Failed to upsert supplier scheme application in Supabase:",
        error.message,
      );
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (e: any) {
    console.warn("Failed to push supplier scheme application to Supabase:", e);
    return { success: false, error: e?.message || "Network error" };
  }
}

export async function pushSupplierCreditNoteToSupabase(
  n: SupplierCreditNote,
): Promise<{ success: boolean; error?: string }> {
  if (isServerProxyMode()) {
    return upsertCollectionItemProxy("supplier_credit_notes", n);
  }
  const client = getSupabaseClient();
  if (!client)
    return { success: false, error: "Supabase client is not configured" };
  try {
    const { error } = await client.from("supplier_credit_notes").upsert(
      {
        id: n.id,
        supplier_name: n.supplierName,
        scheme_id: n.schemeId || null,
        grn_id: n.grnId || null,
        product_id: n.productId ?? null,
        period: n.period || null,
        credit_note_number: n.creditNoteNumber || null,
        credit_note_date: n.creditNoteDate || null,
        expected_amount: n.expectedAmount,
        actual_amount: n.actualAmount,
        status: n.status,
        attachment_ref: n.attachmentRef || null,
        notes: n.notes || "",
        created_at: n.createdAt,
        updated_at: n.updatedAt,
      },
      { onConflict: "id" },
    );
    if (error) {
      console.warn(
        "Failed to upsert supplier credit note in Supabase:",
        error.message,
      );
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (e: any) {
    console.warn("Failed to push supplier credit note to Supabase:", e);
    return { success: false, error: e?.message || "Network error" };
  }
}

export async function deleteSupplierCreditNoteFromSupabase(
  id: string,
): Promise<void> {
  if (isServerProxyMode()) {
    await proxyFetch(`/api/collections/supplier_credit_notes/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    return;
  }
  const client = getSupabaseClient();
  if (!client) return;
  try {
    await client.from("supplier_credit_notes").delete().eq("id", id);
  } catch (e) {
    console.warn("Failed to delete supplier credit note from Supabase:", e);
  }
}

export async function pushInventoryDispositionToSupabase(
  d: InventoryDisposition,
): Promise<{ success: boolean; error?: string }> {
  if (isServerProxyMode()) {
    return upsertCollectionItemProxy("inventory_dispositions", d);
  }
  const client = getSupabaseClient();
  if (!client)
    return { success: false, error: "Supabase client is not configured" };
  try {
    const { error } = await client.from("inventory_dispositions").upsert(
      {
        id: d.id,
        disposition_type: d.dispositionType,
        product_id: d.productId,
        product_name: d.productName || null,
        warehouse_id: d.warehouseId,
        warehouse_name: d.warehouseName || null,
        batch_id: d.batchId || null,
        batch_number: d.batchNumber || null,
        expiry_date: d.expiryDate || null,
        quantity: d.quantity,
        unit: d.unit || "case",
        cost_per_unit: d.costPerUnit,
        cost_value: d.costValue,
        supplier_name: d.supplierName || null,
        grn_id: d.grnId || null,
        supplier_invoice_no: d.supplierInvoiceNo || null,
        credit_note_number: d.creditNoteNumber || null,
        credit_note_date: d.creditNoteDate || null,
        cn_taxable_value: d.cnTaxableValue ?? 0,
        cn_cgst: d.cnCgst ?? 0,
        cn_sgst: d.cnSgst ?? 0,
        cn_igst: d.cnIgst ?? 0,
        cn_total: d.cnTotal ?? 0,
        compensation_status: d.compensationStatus,
        compensated_amount: d.compensatedAmount ?? 0,
        compensated_at: d.compensatedAt || null,
        distributed_to_name: d.distributedToName || null,
        distributed_to_phone: d.distributedToPhone || null,
        salesman_id: d.salesmanId || null,
        salesman_name: d.salesmanName || null,
        reason: d.reason || "",
        notes: d.notes || "",
        reference_doc_no: d.referenceDocNo || null,
        attachment_ref: d.attachmentRef || null,
        created_by: d.createdBy || null,
        approved_by: d.approvedBy || null,
        event_date: d.eventDate,
        stock_applied: d.stockApplied ?? true,
        approval_status: d.approvalStatus || "not_required",
        claim_scheme: d.claimScheme || null,
        compensation_payments: d.compensationPayments || [],
        // Only sent when present, so databases that have not run migration 008 keep working.
        ...(d.returnTracking ? { return_tracking: d.returnTracking } : {}),
        created_at: d.createdAt,
        updated_at: d.updatedAt,
      },
      { onConflict: "id" },
    );
    if (error) {
      console.warn(
        "Failed to upsert inventory disposition in Supabase:",
        error.message,
      );
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (e: any) {
    console.warn("Failed to push inventory disposition to Supabase:", e);
    return { success: false, error: e?.message || "Network error" };
  }
}

export async function deleteInventoryDispositionFromSupabase(
  id: string,
): Promise<void> {
  if (isServerProxyMode()) {
    await proxyFetch(`/api/collections/inventory_dispositions/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    return;
  }
  const client = getSupabaseClient();
  if (!client) return;
  try {
    await client.from("inventory_dispositions").delete().eq("id", id);
  } catch (e) {
    console.warn("Failed to delete inventory disposition from Supabase:", e);
  }
}

export async function fetchInventoryDispositionsFromSupabase(): Promise<
  InventoryDisposition[]
> {
  if (isServerProxyMode()) {
    const res = await proxyFetch<{ success?: boolean; data?: InventoryDisposition[] }>(
      "/api/collections/inventory_dispositions",
      { method: "GET" },
    );
    return res.ok && Array.isArray(res.data?.data) ? res.data.data : [];
  }
  const client = getSupabaseClient();
  if (!client) return [];
  try {
    const { data, error } = await client
      .from("inventory_dispositions")
      .select("*")
      .order("event_date", { ascending: false });
    if (error || !data) return [];
    return data.map((r: any) => ({
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
      approvalStatus: r.approval_status || "not_required",
      claimScheme: r.claim_scheme || undefined,
      compensationPayments: Array.isArray(r.compensation_payments)
        ? r.compensation_payments
        : [],
      returnTracking: r.return_tracking || undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  } catch {
    return [];
  }
}

/**
 * Smart Stock Reconciliation & Audit — same upsert(onConflict:'id') idempotency pattern
 * as the Supplier Scheme functions above, so a repeated sync can never duplicate an
 * audit session, a reconciliation transaction, or a ledger entry.
 */
export async function pushAuditSessionToSupabase(
  s: AuditSession,
): Promise<{ success: boolean; error?: string }> {
  if (isServerProxyMode()) {
    return upsertCollectionItemProxy("audit_sessions", s);
  }
  const client = getSupabaseClient();
  if (!client)
    return { success: false, error: "Supabase client is not configured" };
  try {
    const row = {
      id: s.id,
      warehouse_id: s.warehouseId || null,
      warehouse_name: s.warehouseName || null,
      date: s.date,
      time: s.time || null,
      auditor_name: s.auditorName,
      reference_note: s.referenceNote || "",
      entries: s.entries,
      edit_log: s.editLog || [],
      created_at: s.createdAt,
      updated_at: s.updatedAt,
    };
    let { error } = await client
      .from("audit_sessions")
      .upsert(row, { onConflict: "id" });
    if (error && /edit_log/i.test(error.message)) {
      // older table without the edit_log column: save without it rather than failing
      const { edit_log: _el, ...legacyRow } = row;
      ({ error } = await client
        .from("audit_sessions")
        .upsert(legacyRow, { onConflict: "id" }));
    }
    if (error) {
      console.warn(
        "Failed to upsert audit session in Supabase:",
        error.message,
      );
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (e: any) {
    console.warn("Failed to push audit session to Supabase:", e);
    return { success: false, error: e?.message || "Network error" };
  }
}

export async function deleteAuditSessionFromSupabase(
  id: string,
): Promise<void> {
  if (isServerProxyMode()) {
    await proxyFetch(`/api/collections/audit_sessions/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    return;
  }
  const client = getSupabaseClient();
  if (!client) return;
  try {
    await client.from("audit_sessions").delete().eq("id", id);
  } catch (e) {
    console.warn("Failed to delete audit session from Supabase:", e);
  }
}

export async function pushReconciliationTransactionToSupabase(
  t: ReconciliationTransaction,
): Promise<{ success: boolean; error?: string }> {
  if (isServerProxyMode()) {
    return upsertCollectionItemProxy("reconciliation_transactions", t);
  }
  const client = getSupabaseClient();
  if (!client)
    return { success: false, error: "Supabase client is not configured" };
  try {
    const { error } = await client.from("reconciliation_transactions").upsert(
      {
        id: t.id,
        audit_session_id: t.auditSessionId,
        variance_entry_id: t.varianceEntryId,
        type: t.type,
        from_product_id: t.fromProductId,
        to_product_id: t.toProductId ?? null,
        quantity: t.quantity,
        reason_code: t.reasonCode || null,
        match_score: t.matchScore ?? null,
        notes: t.notes || "",
        identified_by: t.identifiedBy,
        approved_by: t.approvedBy || null,
        approved_at: t.approvedAt || null,
        created_at: t.createdAt,
      },
      { onConflict: "id" },
    );
    if (error) {
      console.warn(
        "Failed to upsert reconciliation transaction in Supabase:",
        error.message,
      );
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (e: any) {
    console.warn("Failed to push reconciliation transaction to Supabase:", e);
    return { success: false, error: e?.message || "Network error" };
  }
}

export async function pushStockLedgerEntryToSupabase(
  e: StockLedgerEntry,
): Promise<{ success: boolean; error?: string }> {
  if (isServerProxyMode()) {
    return upsertCollectionItemProxy("stock_ledger_entries", e);
  }
  const client = getSupabaseClient();
  if (!client)
    return { success: false, error: "Supabase client is not configured" };
  try {
    const { error } = await client.from("stock_ledger_entries").upsert(
      {
        id: e.id,
        product_id: e.productId,
        warehouse_id: e.warehouseId || null,
        quantity: e.quantity,
        transaction_type: e.transactionType,
        reference_audit_session_id: e.referenceAuditSessionId,
        reference_reconciliation_id: e.referenceReconciliationId,
        reason: e.reason,
        user_id: e.userId || null,
        user_name: e.userName || null,
        timestamp: e.timestamp,
      },
      { onConflict: "id" },
    );
    if (error) {
      console.warn(
        "Failed to upsert stock ledger entry in Supabase:",
        error.message,
      );
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (e2: any) {
    console.warn("Failed to push stock ledger entry to Supabase:", e2);
    return { success: false, error: e2?.message || "Network error" };
  }
}

/**
 * Pushes an inventory batch to Supabase public.inventory_batches table
 */
export async function pushBatchToSupabase(
  b: InventoryBatch,
): Promise<{ success: boolean; error?: string }> {
  if (isServerProxyMode()) {
    const res = await proxyFetch("/api/batches", {
      method: "POST",
      body: JSON.stringify(b),
    });
    return res.ok ? { success: true } : { success: false, error: res.error };
  }
  const client = getSupabaseClient();
  if (!client)
    return { success: false, error: "Supabase client is not configured" };
  try {
    const payload: any = {
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
    const { error } = await resilientSupabaseUpsert(
      client,
      "inventory_batches",
      payload,
      { onConflict: "id" },
    );
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (e: any) {
    console.warn("Failed to push batch to Supabase:", e);
    return { success: false, error: e?.message || "Network error" };
  }
}

/**
 * Deletes an inventory batch from Supabase
 */
export async function deleteBatchFromSupabase(id: string): Promise<void> {
  if (isServerProxyMode()) {
    await proxyFetch(`/api/batches/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    return;
  }
  const client = getSupabaseClient();
  if (!client) return;
  try {
    await client.from("inventory_batches").delete().eq("id", id);
  } catch (e) {
    console.warn("Failed to delete batch from Supabase:", e);
  }
}

/**
 * Pushes physical audit to Supabase public.audits table
 */
export async function pushAuditToSupabase(
  a: Audit,
): Promise<{ success: boolean; error?: string }> {
  if (isServerProxyMode()) {
    const res = await proxyFetch("/api/audits", {
      method: "POST",
      body: JSON.stringify(a),
    });
    return res.ok ? { success: true } : { success: false, error: res.error };
  }
  const client = getSupabaseClient();
  if (!client)
    return { success: false, error: "Supabase client is not configured" };
  try {
    const { error } = await resilientSupabaseUpsert(
      client,
      "audits",
      {
        id: Number(a.id),
        date: a.date,
        warehouse_id: a.warehouseId || "",
        entries: a.entries,
        adjusted: Boolean(a.adjusted),
      },
      { onConflict: "id" },
    );
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || "Network error" };
  }
}

/**
 * Deletes physical audit from Supabase public.audits table
 */
export async function deleteAuditFromSupabase(id: number): Promise<void> {
  if (isServerProxyMode()) {
    await proxyFetch(`/api/audits/${encodeURIComponent(String(id))}`, {
      method: "DELETE",
    });
    return;
  }
  const client = getSupabaseClient();
  if (!client) return;
  try {
    await client.from("audits").delete().eq("id", id);
  } catch (e) {
    console.warn("Failed to delete audit from Supabase:", e);
  }
}

/**
 * Pushes Billing Settings to Supabase PostgreSQL table
 */
export async function pushBillingSettingsToSupabase(
  settings: BillingSettings,
): Promise<{ success: boolean; error?: string }> {
  if (isServerProxyMode()) {
    const res = await proxyFetch("/api/settings/billing", {
      method: "POST",
      body: JSON.stringify({ settings }),
    });
    return res.ok ? { success: true } : { success: false, error: res.error };
  }
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: "Supabase client is not configured." };
  }
  try {
    const { error } = await client.from("billing_settings").upsert(
      {
        id: "default",
        data: settings,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Network error" };
  }
}

/**
 * Pulls individual Billing Settings from Supabase PostgreSQL table
 */
export async function pullBillingSettingsFromSupabase(): Promise<{
  success: boolean;
  settings?: BillingSettings;
  error?: string;
}> {
  if (isServerProxyMode()) {
    const res = await proxyFetch<{ success?: boolean; data?: BillingSettings }>(
      "/api/settings/billing",
      { method: "GET" },
    );
    if (res.ok && res.data?.data) {
      return { success: true, settings: res.data.data };
    }
    return {
      success: false,
      error: res.error || "No billing settings found.",
    };
  }
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: "Supabase client is not configured." };
  }
  try {
    const { data, error } = await client
      .from("billing_settings")
      .select("*")
      .eq("id", "default")
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }
    if (!data) {
      return {
        success: false,
        error: "No billing settings record found in Supabase table yet.",
      };
    }

    if (data.data) {
      return { success: true, settings: data.data as BillingSettings };
    }
    return { success: false, error: "Billing settings data column is empty." };
  } catch (err: any) {
    return { success: false, error: err?.message || "Network error" };
  }
}

/**
 * Pushes a single promotional scheme to Supabase promotions table
 */
export async function pushPromotionToSupabase(pr: Promotion): Promise<void> {
  if (isServerProxyMode()) {
    await proxyFetch("/api/schemes", {
      method: "POST",
      body: JSON.stringify(pr),
    });
    return;
  }
  const client = getSupabaseClient();
  if (!client) return;
  try {
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

    // promotions.type check constraint often only allows ('bogo','percent','flat').
    // Store a safe DB type for the column, keep the real type in config.originalType
    // and always mirror the full object to app_collections (below).
    const ALLOWED_PROMO_TYPES = new Set(["bogo", "percent", "flat"]);
    const safeDbType = ALLOWED_PROMO_TYPES.has(String(pr.type))
      ? String(pr.type)
      : "bogo";

    const fullPayload = {
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

    const { error } = await resilientSupabaseUpsert(
      client,
      "promotions",
      fullPayload,
      { onConflict: "id" },
    );
    if (error) {
      console.warn("Failed to upsert to promotions table:", error.message);
    }

    // Always mirror to app_collections 'schemes' to guarantee zero data loss & perfect offline/online persistence
    try {
      const { data: col } = await client
        .from("app_collections")
        .select("*")
        .eq("key", "schemes")
        .maybeSingle();
      const currentList: any[] = Array.isArray(col?.data) ? col.data : [];
      const updatedPromo = {
        ...pr,
        id: Number(pr.id),
        type: pr.type,
        productIds: cleanGroup.length > 0 ? cleanGroup : cleanIds,
        productGroup: cleanGroup,
        groupCategory: groupCat,
        groupBrand: groupBr,
        freeItemRule: fItemRule,
        freeItem: fItemRule,
        customerChoiceProductId: choicePid,
        isActive: pr.isActive !== false,
        config: promoConfig,
      };
      const updatedList = [
        ...currentList.filter((s: any) => Number(s.id) !== Number(pr.id)),
        updatedPromo,
      ];
      await client.from("app_collections").upsert(
        {
          key: "schemes",
          data: updatedList,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" },
      );
    } catch {}
  } catch (e) {
    console.warn("Failed to push promotion to Supabase:", e);
  }
}

/**
 * Deletes a promotion from Supabase
 */
export async function deletePromotionFromSupabase(id: number): Promise<void> {
  if (isServerProxyMode()) {
    await proxyFetch(`/api/schemes/${encodeURIComponent(String(id))}`, {
      method: "DELETE",
    });
    return;
  }
  const client = getSupabaseClient();
  if (!client) return;
  try {
    await client.from("promotions").delete().eq("id", id);
    await client.from("promotional_schemes").delete().eq("id", id);
    // Also remove from app_collections schemes mirror
    const { data: col } = await client
      .from("app_collections")
      .select("*")
      .eq("key", "schemes")
      .single();
    if (col && Array.isArray(col.data)) {
      const updated = col.data.filter((s: any) => Number(s.id) !== Number(id));
      await client.from("app_collections").upsert({
        key: "schemes",
        data: updated,
        updated_at: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.warn("Failed to delete promotion from Supabase:", e);
  }
}

/**
 * Append-only change log for GRN corrections (grn_edit_log table). Best-effort: the same
 * history also lives inside each GRN (editHistory), so a missing table never loses data.
 */
export async function pushGrnEditLogToSupabase(
  grn: GRN,
  record: GrnEditRecord,
): Promise<void> {
  if (isServerProxyMode()) {
    await proxyFetch(`/api/grns/${encodeURIComponent(grn.id)}/edit-log`, {
      method: "POST",
      body: JSON.stringify({ grn, record }),
    });
    return;
  }
  const client = getSupabaseClient();
  if (!client) return;
  try {
    const { error } = await client.from("grn_edit_log").upsert(
      {
        id: record.id,
        grn_id: grn.id,
        grn_number: grn.grnNumber,
        invoice_no: grn.invoiceNo || "",
        supplier_name: grn.supplierName || "",
        edited_by: record.by,
        reason: record.reason || "",
        changes: record.changes,
        edited_at: record.at,
      },
      { onConflict: "id" },
    );
    if (error)
      console.warn(
        "grn_edit_log not saved (run the SQL migration):",
        error.message,
      );
  } catch (e) {
    console.warn("Failed to push GRN edit log:", e);
  }
}

/**
 * Deletes an inward GRN from Supabase
 */
export async function deleteGrnFromSupabase(
  id: string,
  remainingGrns: GRN[],
): Promise<void> {
  if (isServerProxyMode()) {
    await proxyFetch(`/api/grns/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    return;
  }
  const client = getSupabaseClient();
  if (!client) return;
  try {
    try {
      await client.from("grns").delete().eq("id", id);
    } catch {
      // ignore
    }
    await client.from("billing_settings").upsert(
      {
        id: "inward_grns",
        data: { grns: remainingGrns },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
  } catch (e) {
    console.warn("Failed to delete GRN from Supabase:", e);
  }
}

/**
 * Pushes individual Organization Profile to Supabase PostgreSQL table
 */
export async function pushOrgProfileToSupabase(
  profile: OrganizationProfile,
): Promise<{ success: boolean; error?: string }> {
  if (isServerProxyMode()) {
    const res = await proxyFetch("/api/settings/profile", {
      method: "POST",
      body: JSON.stringify({ profile }),
    });
    return res.ok ? { success: true } : { success: false, error: res.error };
  }
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: "Supabase client is not configured." };
  }
  try {
    const { error } = await client.from("organization_profile").upsert(
      {
        id: "default",
        data: profile,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Network error" };
  }
}

/**
 * Pulls individual Organization Profile from Supabase PostgreSQL table
 */
export async function pullOrgProfileFromSupabase(): Promise<{
  success: boolean;
  profile?: OrganizationProfile;
  error?: string;
}> {
  if (isServerProxyMode()) {
    const res = await proxyFetch<{ success?: boolean; data?: OrganizationProfile }>(
      "/api/settings/profile",
      { method: "GET" },
    );
    if (res.ok && res.data?.data) {
      return { success: true, profile: res.data.data };
    }
    return {
      success: false,
      error: res.error || "No profile record found.",
    };
  }
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: "Supabase client is not configured." };
  }
  try {
    const { data, error } = await client
      .from("organization_profile")
      .select("*")
      .eq("id", "default")
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }
    if (!data) {
      return {
        success: false,
        error: "No profile record found in Supabase table yet.",
      };
    }

    if (data.data) {
      return { success: true, profile: data.data as OrganizationProfile };
    }
    return { success: false, error: "Profile data column is empty." };
  } catch (err: any) {
    return { success: false, error: err?.message || "Network error" };
  }
}
