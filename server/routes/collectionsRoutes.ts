import type { Express } from "express";
import {
  getCollectionData,
  isSupabaseAvailable,
  listItemKey,
  readListFresh,
  setCollectionData,
  supabase,
  syncNormalizedRows,
  withSupabaseTimeout,
} from "../supabaseStore";
import { emitSyncEvent, type SyncTopic } from "../syncEvents";

function topicForCollectionKey(key: string): SyncTopic {
  if (key === "business_expenses") return "expenses";
  if (key === "schemes" || key === "supplier_schemes") return "schemes";
  if (key.startsWith("deleted_")) return "deletions";
  return "inventory";
}

function mapDbDispositionToApp(r: any) {
  return {
    id: String(r.id),
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
  };
}

function mapDbSupplierSchemeToApp(r: any) {
  return {
    id: String(r.id),
    supplierName: r.supplier_name || "",
    name: r.name || "",
    schemeType: r.scheme_type || "free_goods",
    productIds: Array.isArray(r.product_ids) ? r.product_ids.map(Number) : [],
    warehouseId: r.warehouse_id || undefined,
    startDate: r.start_date || "",
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
    active: r.active !== undefined ? Boolean(r.active) : true,
    notes: r.notes || "",
    createdAt: r.created_at || "",
    updatedAt: r.updated_at || "",
  };
}

function mapDbSupplierSchemeAppToApp(r: any) {
  return {
    id: String(r.id),
    schemeId: String(r.scheme_id || ""),
    schemeType: r.scheme_type || "",
    grnId: String(r.grn_id || ""),
    grnLineId: String(r.grn_line_id || ""),
    productId: Number(r.product_id || 0),
    supplierName: r.supplier_name || "",
    supplierInvoiceNo: r.supplier_invoice_no || "",
    eligibleQuantity: Number(r.eligible_quantity || 0),
    freeQuantity: Number(r.free_quantity || 0),
    expectedBenefit: Number(r.expected_benefit || 0),
    warehouseId: r.warehouse_id || undefined,
    batchId: r.batch_id || undefined,
    notes: r.notes || "",
    createdAt: r.created_at || "",
  };
}

export function registerCollectionsRoutes(app: Express) {
  // 4. GENERIC COLLECTIONS ROUTES
  app.get("/api/collections/:key", async (req, res) => {
    const { key } = req.params;
    try {
      if (key === "warehouses" && isSupabaseAvailable()) {
        const { data: whs, error } = (await withSupabaseTimeout(
          supabase.from("warehouses").select("*"),
          2500,
        )) as any;
        if (!error && Array.isArray(whs) && whs.length > 0) {
          return res.json({ success: true, key, data: whs });
        }
      }

      if (key === "supplier_schemes") {
        const data = await getCollectionData(key);
        if (Array.isArray(data) && data.length > 0) {
          return res.json({ success: true, key, data });
        }
        if (isSupabaseAvailable()) {
          try {
            const { data: rows, error } = (await withSupabaseTimeout(
              supabase
                .from("supplier_schemes")
                .select("*")
                .order("created_at", { ascending: false }),
              2500,
            )) as any;
            if (!error && Array.isArray(rows) && rows.length > 0) {
              const mapped = rows.map(mapDbSupplierSchemeToApp);
              await setCollectionData(key, mapped).catch(() => {});
              return res.json({ success: true, key, data: mapped });
            }
          } catch {
            // fallback to getCollectionData
          }
        }
      }

      if (key === "supplier_scheme_applications") {
        const data = await getCollectionData(key);
        if (Array.isArray(data) && data.length > 0) {
          return res.json({ success: true, key, data });
        }
        if (isSupabaseAvailable()) {
          try {
            const { data: rows, error } = (await withSupabaseTimeout(
              supabase
                .from("supplier_scheme_applications")
                .select("*")
                .order("created_at", { ascending: false }),
              2500,
            )) as any;
            if (!error && Array.isArray(rows) && rows.length > 0) {
              const mapped = rows.map(mapDbSupplierSchemeAppToApp);
              await setCollectionData(key, mapped).catch(() => {});
              return res.json({ success: true, key, data: mapped });
            }
          } catch {
            // fallback to getCollectionData
          }
        }
      }

      if (key === "inventory_dispositions") {
        const data = await getCollectionData(key);
        if (Array.isArray(data) && data.length > 0) {
          return res.json({ success: true, key, data });
        }
        if (isSupabaseAvailable()) {
          try {
            const { data: rows, error } = (await withSupabaseTimeout(
              supabase
                .from("inventory_dispositions")
                .select("*")
                .order("event_date", { ascending: false }),
              2500,
            )) as any;
            if (!error && Array.isArray(rows) && rows.length > 0) {
              const mapped = rows.map(mapDbDispositionToApp);
              await setCollectionData(key, mapped).catch(() => {});
              return res.json({ success: true, key, data: mapped });
            }
          } catch {
            // fallback to getCollectionData
          }
        }
      }

      if (key === "supplier_credit_notes") {
        const data = await getCollectionData(key);
        if (Array.isArray(data) && data.length > 0) {
          return res.json({ success: true, key, data });
        }
        if (isSupabaseAvailable()) {
          try {
            const { data: scns, error } = (await withSupabaseTimeout(
              supabase
                .from("supplier_credit_notes")
                .select("*")
                .order("created_at", { ascending: false }),
              2500,
            )) as any;
            if (!error && Array.isArray(scns) && scns.length > 0) {
              const mapped = scns.map((r: any) => ({
                id: String(r.id),
                supplierName: r.supplier_name || "",
                schemeId: r.scheme_id || undefined,
                grnId: r.grn_id || undefined,
                productId: r.product_id ? Number(r.product_id) : undefined,
                period: r.period || undefined,
                creditNoteNumber: r.credit_note_number || undefined,
                creditNoteDate: r.credit_note_date || undefined,
                expectedAmount: Number(r.expected_amount || 0),
                actualAmount: Number(r.actual_amount || 0),
                status: r.status || "pending",
                attachmentRef: r.attachment_ref || undefined,
                notes: r.notes || "",
                createdAt: r.created_at || "",
                updatedAt: r.updated_at || "",
              }));
              await setCollectionData(key, mapped).catch(() => {});
              return res.json({ success: true, key, data: mapped });
            }
          } catch {
            // fallback to getCollectionData
          }
        }
      }

      if (key === "audit_sessions") {
        const data = await getCollectionData(key);
        if (Array.isArray(data) && data.length > 0) {
          return res.json({ success: true, key, data });
        }
        if (isSupabaseAvailable()) {
          try {
            const { data: sess, error } = (await withSupabaseTimeout(
              supabase
                .from("audit_sessions")
                .select("*")
                .order("created_at", { ascending: false }),
              2500,
            )) as any;
            if (!error && Array.isArray(sess) && sess.length > 0) {
              const mapped = sess.map((r: any) => ({
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
              await setCollectionData(key, mapped).catch(() => {});
              return res.json({ success: true, key, data: mapped });
            }
          } catch {
            // fallback to getCollectionData
          }
        }
      }

      if (key === "stock_ledger_entries") {
        const data = await getCollectionData(key);
        if (Array.isArray(data) && data.length > 0) {
          return res.json({ success: true, key, data });
        }
        if (isSupabaseAvailable()) {
          try {
            const { data: sles, error } = (await withSupabaseTimeout(
              supabase
                .from("stock_ledger_entries")
                .select("*")
                .order("timestamp", { ascending: false }),
              2500,
            )) as any;
            if (!error && Array.isArray(sles) && sles.length > 0) {
              const mapped = sles.map((r: any) => ({
                id: String(r.id),
                productId: Number(r.product_id),
                warehouseId: r.warehouse_id || "",
                quantity: Number(r.quantity || 0),
                transactionType: r.transaction_type || "audit_reconciliation",
                referenceAuditSessionId:
                  r.reference_audit_session_id || undefined,
                referenceReconciliationId:
                  r.reference_reconciliation_id || undefined,
                reason: r.reason || "",
                userId: r.user_id || undefined,
                userName: r.user_name || undefined,
                timestamp: r.timestamp || "",
              }));
              await setCollectionData(key, mapped).catch(() => {});
              return res.json({ success: true, key, data: mapped });
            }
          } catch {
            // fallback to getCollectionData
          }
        }
      }

      if (key === "reconciliation_transactions") {
        const data = await getCollectionData(key);
        if (Array.isArray(data) && data.length > 0) {
          return res.json({ success: true, key, data });
        }
        if (isSupabaseAvailable()) {
          try {
            const { data: txns, error } = (await withSupabaseTimeout(
              supabase
                .from("reconciliation_transactions")
                .select("*")
                .order("created_at", { ascending: false }),
              2500,
            )) as any;
            if (!error && Array.isArray(txns) && txns.length > 0) {
              const mapped = txns.map((r: any) => ({
                id: String(r.id),
                auditSessionId: String(r.audit_session_id),
                varianceEntryId: String(r.variance_entry_id),
                type: r.type,
                fromProductId: Number(r.from_product_id),
                toProductId: r.to_product_id
                  ? Number(r.to_product_id)
                  : undefined,
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
              await setCollectionData(key, mapped).catch(() => {});
              return res.json({ success: true, key, data: mapped });
            }
          } catch {
            // fallback to getCollectionData
          }
        }
      }

      const data = await getCollectionData(key);
      return res.json({
        success: true,
        key,
        data: Array.isArray(data) ? data : [],
      });
    } catch (err: any) {
      console.error(`Error in GET /api/collections/${key}:`, err);
      return res.status(500).json({
        error: err.message || "Failed to fetch collection",
        key,
        data: [],
      });
    }
  });

  app.put("/api/collections/:key", async (req, res) => {
    const { key } = req.params;
    try {
      let collectionData =
        req.body?.data !== undefined ? req.body.data : req.body;

      if (["orders", "doc_counters", "doc_holds"].includes(key)) {
        return res.status(403).json({
          error: `Collection '${key}' is managed by its own endpoint and cannot be replaced here`,
        });
      }
      if (
        [
          "deleted_bill_ids",
          "deleted_grn_ids",
          "deleted_trip_ids",
          "deleted_records",
        ].includes(key) &&
        Array.isArray(collectionData)
      ) {
        const known = await readListFresh(key);
        const seen = new Set(known.map(listItemKey));
        collectionData = [
          ...known,
          ...collectionData.filter((x: any) => !seen.has(listItemKey(x))),
        ].slice(-20000);
      }
      const ok = await setCollectionData(key, collectionData);
      if (!ok) {
        return res
          .status(500)
          .json({ error: `Failed to save collection ${key} to Supabase` });
      }

      if (Array.isArray(collectionData) && collectionData.length > 0) {
        if (key === "audit_sessions") {
          await syncNormalizedRows(
            "audit_sessions",
            collectionData.map((s: any) => ({
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
            })),
          );
        } else if (key === "stock_ledger_entries") {
          await syncNormalizedRows(
            "stock_ledger_entries",
            collectionData.map((e: any) => ({
              id: e.id,
              product_id: e.productId,
              warehouse_id: e.warehouseId || null,
              quantity: e.quantity,
              transaction_type: e.transactionType || "audit_reconciliation",
              reference_audit_session_id: e.referenceAuditSessionId,
              reference_reconciliation_id: e.referenceReconciliationId,
              reason: e.reason,
              user_id: e.userId || null,
              user_name: e.userName || null,
              timestamp: e.timestamp,
            })),
          );
        } else if (key === "reconciliation_transactions") {
          await syncNormalizedRows(
            "reconciliation_transactions",
            collectionData.map((t: any) => ({
              id: t.id,
              audit_session_id: t.auditSessionId,
              variance_entry_id: t.varianceEntryId,
              type: t.type,
              from_product_id: t.fromProductId,
              to_product_id: t.toProductId || null,
              quantity: t.quantity,
              reason_code: t.reasonCode || null,
              match_score: t.matchScore !== undefined ? t.matchScore : null,
              notes: t.notes || "",
              identified_by: t.identifiedBy,
              approved_by: t.approvedBy || null,
              approved_at: t.approvedAt || null,
              created_at: t.createdAt,
            })),
          );
        } else if (key === "supplier_credit_notes") {
          await syncNormalizedRows(
            "supplier_credit_notes",
            collectionData.map((n: any) => ({
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
              credit_note_number:
                n.creditNoteNumber || n.credit_note_number || null,
              credit_note_date:
                n.creditNoteDate || n.credit_note_date || null,
              expected_amount: Number(
                n.expectedAmount ?? n.expected_amount ?? 0,
              ),
              actual_amount: Number(n.actualAmount ?? n.actual_amount ?? 0),
              status: n.status || "pending",
              attachment_ref: n.attachmentRef || n.attachment_ref || null,
              notes: n.notes || "",
              created_at:
                n.createdAt || n.created_at || new Date().toISOString(),
              updated_at:
                n.updatedAt || n.updated_at || new Date().toISOString(),
            })),
          );
        } else if (key === "supplier_schemes") {
          await syncNormalizedRows(
            "supplier_schemes",
            collectionData.map((s: any) => ({
              id: String(s.id),
              supplier_name: s.supplierName || s.supplier_name || "",
              name: s.name || "",
              scheme_type: s.schemeType || s.scheme_type || "free_goods",
              product_ids: s.productIds || s.product_ids || [],
              warehouse_id: s.warehouseId || s.warehouse_id || null,
              start_date: s.startDate || s.start_date,
              end_date: s.endDate || s.end_date || null,
              target_quantity:
                s.targetQuantity ?? s.target_quantity ?? null,
              incentive_rate:
                s.incentiveRate ?? s.incentive_rate ?? null,
              calculation_method:
                s.calculationMethod || s.calculation_method || null,
              active:
                s.active !== undefined ? Boolean(s.active) : true,
              notes: s.notes || "",
              created_at:
                s.createdAt || s.created_at || new Date().toISOString(),
              updated_at:
                s.updatedAt || s.updated_at || new Date().toISOString(),
            })),
          );
        } else if (key === "supplier_scheme_applications") {
          await syncNormalizedRows(
            "supplier_scheme_applications",
            collectionData.map((a: any) => ({
              id: String(a.id),
              scheme_id: String(a.schemeId || a.scheme_id || ""),
              scheme_type: a.schemeType || a.scheme_type || "",
              grn_id: String(a.grnId || a.grn_id || ""),
              grn_line_id: String(a.grnLineId || a.grn_line_id || ""),
              product_id: Number(a.productId ?? a.product_id ?? 0),
              supplier_name: a.supplierName || a.supplier_name || "",
              supplier_invoice_no:
                a.supplierInvoiceNo || a.supplier_invoice_no || "",
              eligible_quantity: Number(
                a.eligibleQuantity ?? a.eligible_quantity ?? 0,
              ),
              free_quantity: Number(a.freeQuantity ?? a.free_quantity ?? 0),
              expected_benefit: Number(
                a.expectedBenefit ?? a.expected_benefit ?? 0,
              ),
              warehouse_id: a.warehouseId || a.warehouse_id || null,
              batch_id: a.batchId || a.batch_id || null,
              notes: a.notes || "",
              created_at:
                a.createdAt || a.created_at || new Date().toISOString(),
            })),
          );
        } else if (key === "inventory_dispositions") {
          await syncNormalizedRows(
            "inventory_dispositions",
            collectionData.map((d: any) => ({
              id: String(d.id),
              disposition_type: d.dispositionType || d.disposition_type,
              product_id: Number(d.productId ?? d.product_id),
              product_name: d.productName || d.product_name || null,
              warehouse_id: d.warehouseId || d.warehouse_id,
              warehouse_name: d.warehouseName || d.warehouse_name || null,
              batch_id: d.batchId || d.batch_id || null,
              batch_number: d.batchNumber || d.batch_number || null,
              expiry_date: d.expiryDate || d.expiry_date || null,
              quantity: Number(d.quantity || 0),
              unit: d.unit || "case",
              cost_per_unit: Number(d.costPerUnit ?? d.cost_per_unit ?? 0),
              cost_value: Number(d.costValue ?? d.cost_value ?? 0),
              supplier_name: d.supplierName || d.supplier_name || null,
              grn_id: d.grnId || d.grn_id || null,
              supplier_invoice_no:
                d.supplierInvoiceNo || d.supplier_invoice_no || null,
              credit_note_number:
                d.creditNoteNumber || d.credit_note_number || null,
              credit_note_date:
                d.creditNoteDate || d.credit_note_date || null,
              cn_taxable_value: Number(
                d.cnTaxableValue ?? d.cn_taxable_value ?? 0,
              ),
              cn_cgst: Number(d.cnCgst ?? d.cn_cgst ?? 0),
              cn_sgst: Number(d.cnSgst ?? d.cn_sgst ?? 0),
              cn_igst: Number(d.cnIgst ?? d.cn_igst ?? 0),
              cn_total: Number(d.cnTotal ?? d.cn_total ?? 0),
              compensation_status:
                d.compensationStatus || d.compensation_status || "not_applicable",
              compensated_amount: Number(
                d.compensatedAmount ?? d.compensated_amount ?? 0,
              ),
              compensated_at: d.compensatedAt || d.compensated_at || null,
              distributed_to_name:
                d.distributedToName || d.distributed_to_name || null,
              distributed_to_phone:
                d.distributedToPhone || d.distributed_to_phone || null,
              salesman_id: d.salesmanId || d.salesman_id || null,
              salesman_name: d.salesmanName || d.salesman_name || null,
              reason: d.reason || "",
              notes: d.notes || "",
              reference_doc_no: d.referenceDocNo || d.reference_doc_no || null,
              attachment_ref: d.attachmentRef || d.attachment_ref || null,
              created_by: d.createdBy || d.created_by || null,
              approved_by: d.approvedBy || d.approved_by || null,
              event_date: d.eventDate || d.event_date,
              stock_applied: d.stockApplied ?? d.stock_applied ?? true,
              approval_status:
                d.approvalStatus || d.approval_status || "not_required",
              claim_scheme: d.claimScheme || d.claim_scheme || null,
              compensation_payments:
                d.compensationPayments || d.compensation_payments || [],
              ...(d.returnTracking || d.return_tracking
                ? { return_tracking: d.returnTracking || d.return_tracking }
                : {}),
              created_at:
                d.createdAt || d.created_at || new Date().toISOString(),
              updated_at:
                d.updatedAt || d.updated_at || new Date().toISOString(),
            })),
          );
        }
      }

      emitSyncEvent({ topic: topicForCollectionKey(key), key });
      return res.json({ success: true, key, data: collectionData });
    } catch (err: any) {
      console.error(`Error in PUT /api/collections/${key}:`, err);
      return res.status(500).json({
        error: err.message || "Failed to persist collection",
      });
    }
  });

  app.delete("/api/collections/:key/:id", async (req, res) => {
    const { key, id } = req.params;
    try {
      if (["orders", "doc_counters", "doc_holds"].includes(key)) {
        return res.status(403).json({
          error: `Collection '${key}' is managed by its own endpoint and cannot be deleted here`,
        });
      }
      const existing = await getCollectionData(key);
      if (Array.isArray(existing)) {
        const filtered = existing.filter(
          (item: any) => String(item?.id) !== String(id),
        );
        await setCollectionData(key, filtered);
      }

      if (
        isSupabaseAvailable() &&
        [
          "supplier_schemes",
          "supplier_credit_notes",
          "inventory_dispositions",
          "audit_sessions",
        ].includes(key)
      ) {
        await withSupabaseTimeout(
          supabase.from(key).delete().eq("id", String(id)),
          2500,
        ).catch(() => {});
      }

      emitSyncEvent({ topic: topicForCollectionKey(key), key });
      return res.json({ success: true, key, id });
    } catch (err: any) {
      return res.status(500).json({
        error: err.message || "Failed to delete collection item",
      });
    }
  });
}
