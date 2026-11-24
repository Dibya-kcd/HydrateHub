import { mergePaymentSources } from "../../utils/paymentMerge";
import {
  getSupabaseClient,
  isServerProxyMode,
  proxyFetch,
} from "./client";
import { dbRowToAudit, dbRowToPayment } from "./payments";
import { fetchRowIfChanged, fetchTableDelta } from "../tableDelta";
import { CATS, INIT_WAREHOUSES } from "../../constants/initialData";
import {
  applyBillExtra,
  applyGrnExtra,
  applyProductExtra,
} from "../../utils/billExtra";
import {
  generateSkuId,
  gstRateFromHsn,
  normalizeTo8DigitHsn,
  normalizeTrip,
} from "../../utils/billing";
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
  Trip,
  Warehouse,
} from "../../types";

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
        scheme: r.scheme || "",
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
        const hsnRate = extraTaxability === "non_gst" ? 0 : gstRateFromHsn(r.hsn);
        let gst =
          extraTaxability === "non_gst"
            ? 0
            : r.gst_rate !== undefined && r.gst_rate !== null
              ? Number(r.gst_rate)
              : (hsnRate ?? catDef?.gst ?? 0.18);
        if (extraTaxability !== "non_gst" && gst === 0.18) {
          if (hsnRate != null && hsnRate !== 0.18) gst = hsnRate;
          else if (hsnRate == null && !r.hsn && catDef && (catKey === "vibe" || catKey === "energy")) gst = catDef.gst;
        }

        const cost = Number(r.cost || 0);
        const effectiveCost = Number(r.effective_cost || cost);

        let landedCost = Number(r.landed_cost_per_crate || 0);
        if (!landedCost || landedCost <= 0) {
          const matchingBatch = result.inventoryBatches?.find(
            (b: any) => Number(b.productId) === Number(r.id) && Number(b.landedCostPerCrate) > 0,
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

    const grnMap = new Map<string, any>();

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
        ...(r.warehouse_id ? { warehouseId: String(r.warehouse_id) } : {}),
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
        approvalStatus: r.approval_status || "not_required",
        claimScheme: r.claim_scheme || undefined,
        compensationPayments: Array.isArray(r.compensation_payments)
          ? r.compensation_payments
          : [],
        returnTracking: r.return_tracking || undefined,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
    }

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
