import { todayISO, toLocalISODate } from "../../src/utils/dateLocal";
import { resilientUpsert } from "../dbHelpers";
import {
  isSupabaseAvailable,
  supabase,
  withSupabaseTimeout,
} from "../supabaseStore";

export function sanitizeDate(val?: string | null): string | null {
  if (!val) return null;
  const trimmed = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return toLocalISODate(parsed);
  }
  return null;
}

export function ownedBySalesman(r: any, sid: string): boolean {
  const cleanSid = String(sid || "").trim();
  if (!cleanSid || !r || typeof r !== "object") return false;
  return (
    String(r.salesmanId || "").trim() === cleanSid ||
    String(r.salesman_id || "").trim() === cleanSid
  );
}

export function normalizePhoneDigits(p: any): string {
  return String(p || "").replace(/\D/g, "").slice(-10);
}

export function mapDbPaymentToApp(r: any) {
  const createdAt = r.created_at || r.createdAt || new Date().toISOString();
  const entryKind = r.entry_kind || r.entryKind;
  return {
    id: String(r.id),
    ...(r.bill_id !== null && r.bill_id !== undefined
      ? { billId: Number(r.bill_id) }
      : {}),
    ...(r.customer_id ? { customerId: String(r.customer_id) } : {}),
    customerName: r.customer_name || r.customerName || "",
    customerPhone: r.customer_phone || r.customerPhone || "",
    ...(r.salesman_id ? { salesmanId: String(r.salesman_id) } : {}),
    paymentDate: r.payment_date || r.paymentDate || sanitizeDate(createdAt) || todayISO(),
    amount: Number(r.amount) || 0,
    mode: r.mode || "cash",
    ...(entryKind ? { entryKind } : {}),
    referenceNote: r.reference_note ?? r.referenceNote ?? "",
    recordedBy: r.recorded_by ?? r.recordedBy ?? "",
    isAdvance: Boolean(r.is_advance ?? r.isAdvance),
    ...(Boolean(r.is_advance_applied ?? r.isAdvanceApplied)
      ? { isAdvanceApplied: true }
      : {}),
    ...(Number(r.applied_amount ?? r.appliedAmount) > 0
      ? { appliedAmount: Number(r.applied_amount ?? r.appliedAmount) }
      : {}),
    ...(r.source_payment_id || r.sourcePaymentId
      ? { sourcePaymentId: String(r.source_payment_id || r.sourcePaymentId) }
      : {}),
    ...(r.source_bill_id !== null && r.source_bill_id !== undefined
      ? { sourceBillId: Number(r.source_bill_id) }
      : r.sourceBillId !== undefined
        ? { sourceBillId: Number(r.sourceBillId) }
        : {}),
    ...(Boolean(r.is_refund ?? r.isRefund) ? { isRefund: true } : {}),
    ...(r.reversal_of || r.reversalOf
      ? { reversalOf: String(r.reversal_of || r.reversalOf) }
      : {}),
    createdAt,
    ...(r.updated_at || r.updatedAt
      ? { updatedAt: r.updated_at || r.updatedAt }
      : {}),
  };
}

export function mapAppPaymentToDb(p: any) {
  const createdAt = p?.createdAt || new Date().toISOString();
  return {
    id: String(p.id),
    bill_id: p.billId ? Number(p.billId) : null,
    customer_id: p.customerId || null,
    customer_name: p.customerName || "",
    customer_phone: p.customerPhone || "",
    salesman_id: p.salesmanId || null,
    payment_date: p.paymentDate || sanitizeDate(createdAt) || todayISO(),
    amount: Number(p.amount) || 0,
    mode: p.mode || "cash",
    entry_kind:
      p.entryKind ||
      (p.isRefund || (Number(p.amount) || 0) < 0
        ? "refund"
        : p.billId && String(p.referenceNote || "").startsWith("Advance / credit adjusted")
          ? "advance_adjustment"
          : p.isAdvance || (!p.billId && String(p.referenceNote || "").includes("Advance / on account"))
            ? "advance"
            : "receipt"),
    is_advance: Boolean(p.isAdvance),
    is_refund: Boolean(p.isRefund),
    is_advance_applied: Boolean(p.isAdvanceApplied),
    applied_amount: Number(p.appliedAmount) || 0,
    source_payment_id: p.sourcePaymentId || null,
    source_bill_id: p.sourceBillId ? Number(p.sourceBillId) : null,
    ...(p.reversalOf ? { reversal_of: String(p.reversalOf) } : {}),
    reference_note: p.referenceNote || "",
    recorded_by: p.recordedBy || "",
    deleted_at: null,
    created_at: createdAt,
    updated_at: p.updatedAt || createdAt,
  };
}

export function mapDbActivityToApp(r: any) {
  const rawRole = String(r.actor_role || r.actorRole || "admin");
  const actorRole =
    rawRole === "salesman" || rawRole === "system" ? rawRole : "admin";
  return {
    id: String(r.id),
    at: String(r.created_at || r.at || new Date().toISOString()),
    entityType: r.entity_type || r.entityType || "settings",
    entityId: String(r.entity_id ?? r.entityId ?? ""),
    entityLabel: String(r.entity_label ?? r.entityLabel ?? ""),
    action: r.action || "edit",
    actorName: String(r.actor_name || r.actorName || "Admin"),
    actorRole,
    ...(r.actor_phone || r.actorPhone
      ? { actorPhone: String(r.actor_phone || r.actorPhone) }
      : {}),
    sourceScreen: String(r.source_screen || r.sourceScreen || ""),
    ...(r.reason ? { reason: String(r.reason) } : {}),
    summary: String(r.summary || ""),
    ...(r.before_data !== undefined || r.before !== undefined
      ? { before: r.before_data ?? r.before }
      : {}),
    ...(r.after_data !== undefined || r.after !== undefined
      ? { after: r.after_data ?? r.after }
      : {}),
    ...(Array.isArray(r.changes) && r.changes.length > 0
      ? { changes: r.changes }
      : {}),
    syncStatus: "synced",
  };
}

export function mapAppActivityToDb(e: any) {
  return {
    id: String(e.id),
    entity_type: String(e.entityType || "settings"),
    entity_id: String(e.entityId ?? ""),
    entity_label: e.entityLabel || "",
    action: String(e.action || "edit"),
    actor_name: e.actorName || "Admin",
    actor_role: e.actorRole || "admin",
    actor_phone: e.actorPhone || "",
    source_screen: e.sourceScreen || "",
    reason: e.reason || "",
    summary: e.summary || "",
    before_data: e.before ?? null,
    after_data: e.after ?? null,
    changes: Array.isArray(e.changes) ? e.changes : [],
    created_at: e.at || new Date().toISOString(),
  };
}

export function mapPromotionCollectionItem(p: any) {
  const cfg = p?.config && typeof p.config === "object" ? p.config : {};
  const restoredType =
    p.type && !["bogo", "percent", "flat"].includes(p.type)
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
  const cleanIds = Array.isArray(rawIds)
    ? rawIds.map(Number).filter((n: number) => !isNaN(n))
    : [];
  return {
    ...p,
    id: Number(p.id),
    type: restoredType,
    productIds:
      cleanIds.length > 0
        ? cleanIds
        : Array.isArray(p.productIds)
          ? p.productIds.map(Number).filter((n: number) => !isNaN(n))
          : [],
    productGroup:
      Array.isArray(p.productGroup) && p.productGroup.length > 0
        ? p.productGroup.map(Number).filter((n: number) => !isNaN(n))
        : groupFromCfg.length > 0
          ? groupFromCfg
          : cleanIds,
    groupCategory: p.groupCategory ?? p.group_category ?? cfg.groupCategory ?? undefined,
    groupBrand: p.groupBrand ?? p.group_brand ?? cfg.groupBrand ?? undefined,
    freeItemRule:
      p.freeItemRule ?? p.free_item_rule ?? p.freeItem ?? cfg.freeItemRule ?? cfg.freeItem ?? "CHEAPEST_IN_GROUP",
    freeItem:
      p.freeItemRule ?? p.free_item_rule ?? p.freeItem ?? cfg.freeItemRule ?? cfg.freeItem ?? "CHEAPEST_IN_GROUP",
    customerChoiceProductId: p.customerChoiceProductId
      ? Number(p.customerChoiceProductId)
      : p.customer_choice_product_id
        ? Number(p.customer_choice_product_id)
        : cfg.customerChoiceProductId
          ? Number(cfg.customerChoiceProductId)
          : undefined,
    isActive: p.isActive !== undefined ? p.isActive !== false : p.is_active !== false,
  };
}

export function formatPromotionRowForServer(pr: any) {
  const cleanIds = (Array.isArray(pr.productIds) ? pr.productIds : pr.product_ids || [])
    .map(Number)
    .filter((n: number) => !isNaN(n));
  const cleanGroup = (
    Array.isArray(pr.productGroup) && pr.productGroup.length > 0
      ? pr.productGroup
      : Array.isArray(pr.config?.productGroup) && pr.config.productGroup.length > 0
        ? pr.config.productGroup
        : cleanIds
  )
    .map(Number)
    .filter((n: number) => !isNaN(n));
  const groupCat = pr.groupCategory ?? pr.group_category ?? pr.config?.groupCategory ?? null;
  const groupBr = pr.groupBrand ?? pr.group_brand ?? pr.config?.groupBrand ?? null;
  const fItemRule =
    pr.freeItemRule ??
    pr.free_item_rule ??
    pr.freeItem ??
    pr.config?.freeItemRule ??
    pr.config?.freeItem ??
    "CHEAPEST_IN_GROUP";
  const choicePid = pr.customerChoiceProductId
    ? Number(pr.customerChoiceProductId)
    : pr.customer_choice_product_id
      ? Number(pr.customer_choice_product_id)
      : pr.config?.customerChoiceProductId
        ? Number(pr.config.customerChoiceProductId)
        : null;

  const ALLOWED = new Set(["bogo", "percent", "flat"]);
  const safeDbType = ALLOWED.has(String(pr.type)) ? String(pr.type) : "bogo";

  return {
    id: Number(pr.id),
    name: pr.name || "",
    type: safeDbType,
    buy_qty: Number(pr.buyQty ?? pr.buy_qty ?? 0),
    free_qty: Number(pr.freeQty ?? pr.free_qty ?? 0),
    percent: Number(pr.percent ?? 0),
    flat_per_case: Number(pr.flatPerCase ?? pr.flat_per_case ?? 0),
    product_ids: cleanGroup.length > 0 ? cleanGroup : cleanIds,
    bundle_buy_type: pr.bundleBuyType ?? pr.bundle_buy_type ?? "any",
    required_distinct_types: Number(pr.requiredDistinctTypes ?? pr.required_distinct_types ?? 2),
    min_qty_per_type: Number(pr.minQtyPerType ?? pr.min_qty_per_type ?? 1),
    free_reward_choice: pr.freeRewardChoice ?? pr.free_reward_choice ?? "all_eligible",
    free_product_id: pr.freeProductId
      ? Number(pr.freeProductId)
      : pr.free_product_id
        ? Number(pr.free_product_id)
        : null,
    free_product_qty: Number(pr.freeProductQty ?? pr.free_product_qty ?? 1),
    product_group: cleanGroup,
    group_category: groupCat,
    group_brand: groupBr,
    free_item_rule: fItemRule,
    customer_choice_product_id: choicePid,
    is_active: pr.isActive !== undefined ? Boolean(pr.isActive) : pr.is_active !== undefined ? Boolean(pr.is_active) : true,
    config: {
      ...(pr.config && typeof pr.config === "object" ? pr.config : {}),
      productGroup: cleanGroup,
      groupCategory: groupCat,
      groupBrand: groupBr,
      freeItemRule: fItemRule,
      freeItem: fItemRule,
      customerChoiceProductId: choicePid,
      originalType: pr.type,
    },
  };
}

export function formatBatchRowForServer(b: any) {
  const qty = Number(b.quantity ?? 0);
  const costPrice = Number(b.costPrice ?? b.cost_price ?? 0);
  return {
    id: String(b.id),
    product_id: Number(b.productId ?? b.product_id),
    sku: String(b.sku || ""),
    batch_number: String(b.batchNumber ?? b.batch_number ?? ""),
    mfg_date: sanitizeDate(b.mfgDate ?? b.mfg_date),
    expiry_date: sanitizeDate(b.expiryDate ?? b.expiry_date),
    warehouse_id: (b.warehouseId ?? b.warehouse_id) || null,
    quantity: qty,
    billed_quantity: Number(b.billedQuantity ?? b.billed_quantity ?? qty),
    free_quantity: Number(b.freeQuantity ?? b.free_quantity ?? 0),
    cost_price: costPrice,
    effective_cost_price: Number(b.effectiveCostPrice ?? b.effective_cost_price ?? costPrice),
    landed_cost_per_crate: Number(b.landedCostPerCrate ?? b.landed_cost_per_crate ?? 0),
    mrp: Number(b.mrp || 0),
    scheme: String(b.scheme || ""),
    notes: String(b.notes || ""),
    supplier_invoice_no: String(b.supplierInvoiceNo ?? b.supplier_invoice_no ?? ""),
    supplier_name: String(b.supplierName ?? b.supplier_name ?? ""),
    inward_date: sanitizeDate(b.inwardDate ?? b.inward_date),
    updated_at: new Date().toISOString(),
  };
}

export function mapDbBatchRowToApp(r: any) {
  return {
    id: String(r.id),
    productId: Number(r.product_id),
    sku: r.sku || "",
    batchNumber: r.batch_number || "",
    mfgDate: r.mfg_date || "",
    expiryDate: r.expiry_date || "",
    warehouseId: r.warehouse_id || "",
    quantity: Number(r.quantity || 0),
    billedQuantity: Number(r.billed_quantity ?? r.quantity ?? 0),
    freeQuantity: Number(r.free_quantity || 0),
    costPrice: Number(r.cost_price || 0),
    effectiveCostPrice: Number(r.effective_cost_price ?? r.cost_price ?? 0),
    landedCostPerCrate: Number(r.landed_cost_per_crate || 0),
    mrp: Number(r.mrp || 0),
    scheme: r.scheme || "",
    notes: r.notes || "",
    supplierInvoiceNo: r.supplier_invoice_no || "",
    supplierName: r.supplier_name || "",
    inwardDate: r.inward_date || "",
  };
}

export function formatAuditRowForServer(a: any) {
  return {
    id: Number(a.id),
    date: a.date || todayISO(),
    warehouse_id: a.warehouseId ?? a.warehouse_id ?? "",
    entries: Array.isArray(a.entries) ? a.entries : [],
    adjusted: Boolean(a.adjusted),
  };
}

export function mapDbAuditRowToApp(r: any) {
  const wh = r.warehouse_id ?? r.warehouseId;
  return {
    id: Number(r.id),
    date: r.date,
    ...(wh ? { warehouseId: String(wh) } : {}),
    entries: Array.isArray(r.entries) ? r.entries : [],
    adjusted: Boolean(r.adjusted),
  };
}

export async function syncExtendedCollectionsToSupabase(raw: any): Promise<void> {
  if (!isSupabaseAvailable() || !raw || typeof raw !== "object") return;
  const now = new Date().toISOString();

  if (Array.isArray(raw.supplierSchemes) && raw.supplierSchemes.length > 0) {
    await resilientUpsert(
      supabase,
      "supplier_schemes",
      raw.supplierSchemes.map((s: any) => ({
        id: String(s.id),
        supplier_name: s.supplierName || s.supplier_name || "",
        name: s.name || "",
        scheme_type: s.schemeType || s.scheme_type || "free_goods",
        product_ids: s.productIds || s.product_ids || [],
        warehouse_id: s.warehouseId || s.warehouse_id || null,
        start_date: s.startDate || s.start_date || todayISO(),
        end_date: s.endDate || s.end_date || null,
        target_quantity: s.targetQuantity ?? s.target_quantity ?? null,
        incentive_rate: s.incentiveRate ?? s.incentive_rate ?? null,
        calculation_method: s.calculationMethod || s.calculation_method || null,
        active: s.active !== undefined ? Boolean(s.active) : true,
        notes: s.notes || "",
        created_at: s.createdAt || s.created_at || now,
        updated_at: s.updatedAt || s.updated_at || now,
      })),
      { onConflict: "id" },
    );
  }

  if (Array.isArray(raw.supplierSchemeApplications) && raw.supplierSchemeApplications.length > 0) {
    await resilientUpsert(
      supabase,
      "supplier_scheme_applications",
      raw.supplierSchemeApplications.map((a: any) => ({
        id: String(a.id),
        scheme_id: String(a.schemeId || a.scheme_id || ""),
        scheme_type: a.schemeType || a.scheme_type || "",
        grn_id: String(a.grnId || a.grn_id || ""),
        grn_line_id: String(a.grnLineId || a.grn_line_id || ""),
        product_id: Number(a.productId ?? a.product_id ?? 0),
        supplier_name: a.supplierName || a.supplier_name || "",
        supplier_invoice_no: a.supplierInvoiceNo || a.supplier_invoice_no || "",
        eligible_quantity: Number(a.eligibleQuantity ?? a.eligible_quantity ?? 0),
        free_quantity: Number(a.freeQuantity ?? a.free_quantity ?? 0),
        expected_benefit: Number(a.expectedBenefit ?? a.expected_benefit ?? 0),
        warehouse_id: a.warehouseId || a.warehouse_id || null,
        batch_id: a.batchId || a.batch_id || null,
        notes: a.notes || "",
        created_at: a.createdAt || a.created_at || now,
      })),
      { onConflict: "id" },
    );
  }

  if (Array.isArray(raw.supplierCreditNotes) && raw.supplierCreditNotes.length > 0) {
    await resilientUpsert(
      supabase,
      "supplier_credit_notes",
      raw.supplierCreditNotes.map((n: any) => ({
        id: String(n.id),
        supplier_name: n.supplierName || n.supplier_name || "Supplier",
        scheme_id: n.schemeId || n.scheme_id || null,
        grn_id: n.grnId || n.grn_id || null,
        product_id: n.productId
          ? Number(n.productId)
          : n.product_id
            ? Number(n.product_id)
            : null,
        period: n.period || null,
        credit_note_number: n.creditNoteNumber || n.credit_note_number || null,
        credit_note_date: sanitizeDate(n.creditNoteDate || n.credit_note_date),
        expected_amount: Number(n.expectedAmount ?? n.expected_amount ?? 0),
        actual_amount: Number(n.actualAmount ?? n.actual_amount ?? 0),
        status: n.status || "pending",
        attachment_ref: n.attachmentRef || n.attachment_ref || null,
        notes: n.notes || "",
        created_at: n.createdAt || n.created_at || now,
        updated_at: n.updatedAt || n.updated_at || now,
      })),
      { onConflict: "id" },
    );
  }

  if (Array.isArray(raw.auditSessions) && raw.auditSessions.length > 0) {
    await resilientUpsert(
      supabase,
      "audit_sessions",
      raw.auditSessions.map((s: any) => ({
        id: String(s.id),
        warehouse_id: s.warehouseId || s.warehouse_id || null,
        warehouse_name: s.warehouseName || s.warehouse_name || null,
        date: s.date || todayISO(),
        time: s.time || null,
        auditor_name: s.auditorName || s.auditor_name || "Admin",
        reference_note: s.referenceNote || s.reference_note || "",
        entries: Array.isArray(s.entries) ? s.entries : [],
        edit_log: Array.isArray(s.editLog) ? s.editLog : s.edit_log || [],
        created_at: s.createdAt || s.created_at || now,
        updated_at: s.updatedAt || s.updated_at || now,
      })),
      { onConflict: "id" },
    );
  }

  if (Array.isArray(raw.reconciliationTransactions) && raw.reconciliationTransactions.length > 0) {
    await resilientUpsert(
      supabase,
      "reconciliation_transactions",
      raw.reconciliationTransactions.map((t: any) => ({
        id: String(t.id),
        audit_session_id: String(t.auditSessionId || t.audit_session_id),
        variance_entry_id: String(t.varianceEntryId || t.variance_entry_id || ""),
        type: t.type,
        from_product_id: Number(t.fromProductId ?? t.from_product_id),
        to_product_id: t.toProductId
          ? Number(t.toProductId)
          : t.to_product_id
            ? Number(t.to_product_id)
            : null,
        quantity: Number(t.quantity || 0),
        reason_code: t.reasonCode || t.reason_code || null,
        match_score:
          t.matchScore !== undefined
            ? t.matchScore
            : t.match_score !== undefined
              ? t.match_score
              : null,
        notes: t.notes || "",
        identified_by: t.identifiedBy || t.identified_by || "",
        approved_by: t.approvedBy || t.approved_by || null,
        approved_at: t.approvedAt || t.approved_at || null,
        created_at: t.createdAt || t.created_at || now,
      })),
      { onConflict: "id" },
    );
  }

  if (Array.isArray(raw.stockLedgerEntries) && raw.stockLedgerEntries.length > 0) {
    await resilientUpsert(
      supabase,
      "stock_ledger_entries",
      raw.stockLedgerEntries.map((e: any) => ({
        id: String(e.id),
        product_id: Number(e.productId ?? e.product_id),
        warehouse_id: e.warehouseId || e.warehouse_id || null,
        quantity: Number(e.quantity || 0),
        transaction_type: e.transactionType || e.transaction_type || "audit_reconciliation",
        reference_audit_session_id:
          e.referenceAuditSessionId || e.reference_audit_session_id || null,
        reference_reconciliation_id:
          e.referenceReconciliationId || e.reference_reconciliation_id || null,
        reason: e.reason || "",
        user_id: e.userId || e.user_id || null,
        user_name: e.userName || e.user_name || null,
        timestamp: e.timestamp || now,
      })),
      { onConflict: "id" },
    );
  }
}

export async function fetchAllTableRows(
  table: string,
  orderCol: string,
  ascending = true,
): Promise<{ data: any[] | null; error: any }> {
  if (!isSupabaseAvailable()) return { data: null, error: null };
  const rows: any[] = [];
  const PAGE = 1000;
  for (let from = 0; from < 50000; from += PAGE) {
    const res: any = await withSupabaseTimeout(
      supabase
        .from(table)
        .select("*")
        .order(orderCol, { ascending })
        .range(from, from + PAGE - 1),
      3500,
    );
    if (res?.skipped) return { data: null, error: { message: "skipped" } };
    if (res?.error) return { data: null, error: res.error };
    const page = Array.isArray(res?.data) ? res.data : [];
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return { data: rows, error: null };
}
