import { mergePaymentSources } from "../../src/utils/paymentMerge";
import type { Express } from "express";
import {
  applyBillExtra,
  applyGrnExtra,
  applyProductExtra,
  grnExtraFields,
  productExtraFields,
} from "../../src/utils/billExtra";
import {
  detectPack,
  generateSkuId,
  gstRateFromHsn,
  normalizeTo8DigitHsn,
  normalizeTrip,
  parseBillIds,
  parseJsonDict,
  resolveProductGstRate,
  volumeFromName,
} from "../../src/utils/billing";
import { CATS, INIT_WAREHOUSES } from "../../src/constants/initialData";
import { todayISO } from "../../src/utils/dateLocal";
import { fingerprintOf, shortHash } from "../../src/utils/syncGate";
import { formatSalesmanResponse, formatSalesmanStored } from "../authMiddleware";
import {
  formatBillForSupabase,
  formatTripForSupabase,
  formatWarehouseForSupabase,
  readTombstones,
  resilientUpsert,
} from "../dbHelpers";
import {
  flushDiskCollectionsNow,
  getCollectionData,
  isSupabaseAvailable,
  readListFresh,
  setCollectionData,
  supabase,
  syncNormalizedRows,
  withSupabaseTimeout,
} from "../supabaseStore";
import { MONITORED_DB_TABLES } from "../../src/lib/supabase/client";
import { addSyncClient, emitSyncEvent } from "../syncEvents";
import {
  fetchAllTableRows,
  formatAuditRowForServer,
  formatBatchRowForServer,
  formatPromotionRowForServer,
  mapAppActivityToDb,
  mapAppPaymentToDb,
  mapDbActivityToApp,
  mapDbAuditRowToApp,
  mapDbBatchRowToApp,
  mapDbPaymentToApp,
  mapPromotionCollectionItem,
  normalizePhoneDigits,
  ownedBySalesman,
  sanitizeDate,
  syncExtendedCollectionsToSupabase,
} from "./syncHelpers";

const HEALTH_TABLES = MONITORED_DB_TABLES;

const TOMBSTONE_KEYS = [
  "deleted_bill_ids",
  "deleted_grn_ids",
  "deleted_trip_ids",
];

export function registerSyncAndActivityRoutes(
  app: Express,
  resolveAuth: (req: any) => Promise<any>,
) {
  // 1. Server-proxied Supabase health probe (owner-only)
  app.get("/api/supabase/health", async (req, res) => {
    const who = (req as any).authUser || (await resolveAuth(req).catch(() => null));
    if (who?.r === "salesman") {
      return res.status(403).json({ error: "Only the administrator can do this.", code: "ADMIN_ONLY" });
    }
    const started = Date.now();
    const emptyTables: Record<string, boolean> = Object.fromEntries(
      HEALTH_TABLES.map((t) => [t, false]),
    );
    if (!isSupabaseAvailable()) {
      return res.json({
        connected: false,
        url: "",
        projectRef: "server-proxy",
        latencyMs: Date.now() - started,
        tablesReady: emptyTables,
        missingTables: [...HEALTH_TABLES],
        allTablesExist: false,
        message: "Local-first storage is active. Cloud database is not configured or temporarily unavailable.",
      });
    }

    try {
      const checks = await Promise.all(
        HEALTH_TABLES.map(async (tableName) => {
          try {
            const probeColumn = tableName === "app_collections" ? "key" : "id";
            const { error, skipped }: any = await withSupabaseTimeout(
              supabase.from(tableName).select(probeColumn).limit(1),
              2500,
            );
            if (skipped) return false;
            if (error) {
              const msg = String(error.message || "");
              if (
                error.code === "PGRST205" ||
                error.code === "42P01" ||
                msg.includes("Could not find the table") ||
                msg.includes("does not exist") ||
                msg.includes("520") ||
                msg.includes("timeout") ||
                msg.includes("<!DOCTYPE")
              ) {
                return false;
              }
            }
            return true;
          } catch {
            return false;
          }
        }),
      );
      const tablesReady: Record<string, boolean> = {};
      HEALTH_TABLES.forEach((name, idx) => {
        tablesReady[name] = checks[idx];
      });
      const missingTables = HEALTH_TABLES.filter((name) => !tablesReady[name]);
      const allTablesExist = missingTables.length === 0;
      return res.json({
        connected: true,
        url: "",
        projectRef: "server-proxy",
        latencyMs: Date.now() - started,
        tablesReady,
        missingTables,
        allTablesExist,
        message: allTablesExist
          ? "Connected via secure server proxy. All database tables are ready."
          : `Connected via server proxy, but ${missingTables.length} table(s) are missing (${missingTables.join(", ")}). Please run the SQL setup script to initialize them.`,
      });
    } catch (err: any) {
      return res.json({
        connected: false,
        url: "",
        projectRef: "server-proxy",
        latencyMs: Date.now() - started,
        tablesReady: emptyTables,
        missingTables: [...HEALTH_TABLES],
        allTablesExist: false,
        message: err?.message || "Failed to probe Supabase database.",
        error: err?.message || "Database probe error",
      });
    }
  });

  // 2. Cheap change probe (role-scoped so salesmen never inspect expenses or others' data)
  app.get("/api/sync/probe", async (req, res) => {
    try {
      const who = (req as any).authUser || (await resolveAuth(req).catch(() => null));
      const isSalesman = who?.r === "salesman";
      const sid = String(who?.sid || "").trim();

      const parts: Record<string, string> = {};
      const maxStamp = (rows: any[]) => {
        let best = "";
        for (const r of rows) {
          const st = String(r?.updatedAt || r?.updated_at || r?.createdAt || r?.created_at || "");
          if (st > best) best = st;
        }
        return best;
      };

      const localOrdersRaw = await getCollectionData("orders").catch(() => []);
      const localOrders = Array.isArray(localOrdersRaw)
        ? isSalesman
          ? localOrdersRaw.filter((b: any) => ownedBySalesman(b, sid))
          : localOrdersRaw
        : [];
      const localTripsRaw = await getCollectionData("trips").catch(() => []);
      const localTrips = Array.isArray(localTripsRaw)
        ? isSalesman
          ? localTripsRaw.filter((t: any) => ownedBySalesman(t, sid))
          : localTripsRaw
        : [];
      const localPaymentsRaw = await getCollectionData("payments").catch(() => []);
      const localPayments = Array.isArray(localPaymentsRaw)
        ? isSalesman
          ? localPaymentsRaw.filter((p: any) => ownedBySalesman(p, sid))
          : localPaymentsRaw
        : [];

      if (isSupabaseAvailable()) {
        const billQuery = isSalesman
          ? supabase
              .from("bills")
              .select("updated_at", { count: "exact" })
              .eq("salesman_id", sid)
              .order("updated_at", { ascending: false, nullsFirst: false })
              .limit(1)
          : supabase
              .from("bills")
              .select("updated_at", { count: "exact" })
              .order("updated_at", { ascending: false, nullsFirst: false })
              .limit(1);

        const tripQuery = isSalesman
          ? supabase
              .from("trips")
              .select("updated_at", { count: "exact" })
              .eq("salesman_id", sid)
              .order("updated_at", { ascending: false, nullsFirst: false })
              .limit(1)
          : supabase
              .from("trips")
              .select("updated_at", { count: "exact" })
              .order("updated_at", { ascending: false, nullsFirst: false })
              .limit(1);

        const countTables = isSalesman
          ? ["products", "inventory_batches", "warehouses"]
          : ["grns", "products", "inventory_batches", "salesmen", "warehouses"];

        const listKeys = isSalesman
          ? ["payments", "customers"]
          : ["payments", "customers", "business_expenses"];

        const [bRes, tRes, delCountRes, listRes, tombRes, ...cRes] = await Promise.all([
          withSupabaseTimeout(billQuery, 2500),
          withSupabaseTimeout(tripQuery, 2500),
          withSupabaseTimeout(
            isSalesman
              ? supabase
                  .from("app_collections")
                  .select("key", { count: "exact", head: true })
                  .like("key", "deleted:%")
                  .not("key", "like", "deleted:expense:%")
              : supabase
                  .from("app_collections")
                  .select("key", { count: "exact", head: true })
                  .like("key", "deleted:%"),
            2500,
          ),
          withSupabaseTimeout(
            supabase.from("app_collections").select("key,updated_at").in("key", listKeys),
            2500,
          ),
          withSupabaseTimeout(
            supabase
              .from("app_collections")
              .select("key,updated_at")
              .in("key", ["deleted_records", ...(isSalesman ? ["deleted_bill_ids", "deleted_trip_ids"] : TOMBSTONE_KEYS)]),
            2500,
          ),
          ...countTables.map((tbl) =>
            withSupabaseTimeout(supabase.from(tbl).select("*", { count: "exact", head: true }), 2500).then(
              (r: any) => ({ tbl, r }),
            ),
          ),
        ]);

        const billsLocalSuffix = `${localOrders.length}:${maxStamp(localOrders)}`;
        const tripsLocalSuffix = `${localTrips.length}:${maxStamp(localTrips)}`;
        parts.bills = `${(bRes as any)?.count ?? "?"}|${(bRes as any)?.data?.[0]?.updated_at ?? ""}|${billsLocalSuffix}`;
        parts.trips = `${(tRes as any)?.count ?? "?"}|${(tRes as any)?.data?.[0]?.updated_at ?? ""}|${tripsLocalSuffix}`;
        for (const item of cRes as any[]) {
          parts[item.tbl] = String(item.r?.count ?? "?");
        }
        parts.deleted_rows = String((delCountRes as any)?.count ?? "?");
        parts.shared_lists = shortHash(
          `${((listRes as any)?.data || []).map((r: any) => `${r.key}=${r.updated_at}`).sort().join(",")}|p=${localPayments.length}:${maxStamp(localPayments)}`,
        );
        parts.deletion_lists = shortHash(
          ((tombRes as any)?.data || []).map((r: any) => `${r.key}=${r.updated_at}`).sort().join(","),
        );
      } else {
        const prods = await getCollectionData("products").catch(() => []);
        const batches = await getCollectionData("inventory_batches").catch(() => []);
        const whs = await getCollectionData("warehouses").catch(() => []);
        const delRecs = await readListFresh("deleted_records").catch(() => []);
        const custs = await getCollectionData("customers").catch(() => []);
        const tombBills = await readTombstones("deleted_bill_ids").catch(() => new Set<string>());
        const tombTrips = await readTombstones("deleted_trip_ids").catch(() => new Set<string>());

        parts.bills = `${localOrders.length}|${maxStamp(localOrders)}`;
        parts.trips = `${localTrips.length}|${maxStamp(localTrips)}`;
        parts.products = String(Array.isArray(prods) ? prods.length : 0);
        parts.inventory_batches = String(Array.isArray(batches) ? batches.length : 0);
        parts.warehouses = String(Array.isArray(whs) ? whs.length : 0);
        if (!isSalesman) {
          const grns = await getCollectionData("inward_grns").catch(() => []);
          const sm = await getCollectionData("salesmen").catch(() => []);
          const exp = await getCollectionData("business_expenses").catch(() => []);
          const tombGrns = await readTombstones("deleted_grn_ids").catch(() => new Set<string>());
          parts.grns = String(Array.isArray(grns) ? grns.length : 0);
          parts.salesmen = String(Array.isArray(sm) ? sm.length : 0);
          parts.shared_lists = shortHash(
            `pay=${localPayments.length}:${maxStamp(localPayments)},cust=${Array.isArray(custs) ? custs.length : 0}:${maxStamp(Array.isArray(custs) ? custs : [])},exp=${Array.isArray(exp) ? exp.length : 0}:${maxStamp(Array.isArray(exp) ? exp : [])}`,
          );
          parts.deletion_lists = shortHash(
            `b=${tombBills.size},g=${tombGrns.size},t=${tombTrips.size},d=${delRecs.length}`,
          );
        } else {
          const ownCusts = Array.isArray(custs)
            ? custs.filter((c: any) => !c?.createdBySalesmanId || String(c.createdBySalesmanId) === sid)
            : [];
          parts.shared_lists = shortHash(
            `pay=${localPayments.length}:${maxStamp(localPayments)},cust=${ownCusts.length}:${maxStamp(ownCusts)}`,
          );
          parts.deletion_lists = shortHash(
            `b=${tombBills.size},t=${tombTrips.size},d=${delRecs.filter((r: any) => r?.kind !== "expense").length}`,
          );
        }
      }

      return res.json({ success: true, data: fingerprintOf(parts) });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || "Probe failed", data: null });
    }
  });

  // 3. Full ledger pull (server proxies Supabase + local collections; salesmen filtered by authMiddleware)
  app.get("/api/sync/pull", async (req, res) => {
    try {
      const who = (req as any).authUser || (await resolveAuth(req).catch(() => null));
      const isSalesman = who?.r === "salesman";
      const result: Record<string, any> = {};

      if (isSupabaseAvailable()) {
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
          inwardGrnColRes,
          paySettingRes,
          payColRes,
          payTableRes,
          payHistRes,
          salesmanRes,
          auditSessRes,
          reconRes,
          stockLedRes,
          dispRes,
          scnRes,
          schemeRes,
          schemesColRes,
          custColRes,
        ] = await Promise.all([
          withSupabaseTimeout(supabase.from("warehouses").select("*").order("name", { ascending: true }), 3000),
          fetchAllTableRows("products", "id", true),
          fetchAllTableRows("inventory_batches", "created_at", true),
          withSupabaseTimeout(supabase.from("promotions").select("*").order("id", { ascending: true }), 3000),
          fetchAllTableRows("bills", "id", true),
          fetchAllTableRows("trips", "id", true),
          isSalesman
            ? Promise.resolve({ data: [], error: null })
            : withSupabaseTimeout(supabase.from("audits").select("*").order("id", { ascending: true }), 3000),
          withSupabaseTimeout(supabase.from("organization_profile").select("*").eq("id", "default").maybeSingle(), 2500),
          withSupabaseTimeout(supabase.from("billing_settings").select("*").eq("id", "default").maybeSingle(), 2500),
          isSalesman ? Promise.resolve({ data: [], error: null }) : fetchAllTableRows("grns", "id", true),
          isSalesman
            ? Promise.resolve({ data: null, error: null })
            : withSupabaseTimeout(supabase.from("billing_settings").select("*").eq("id", "inward_grns").maybeSingle(), 2500),
          isSalesman
            ? Promise.resolve({ data: null, error: null })
            : withSupabaseTimeout(supabase.from("app_collections").select("*").eq("key", "inward_grns").maybeSingle(), 2500),
          withSupabaseTimeout(supabase.from("billing_settings").select("*").eq("id", "collection_payments").maybeSingle(), 2500),
          withSupabaseTimeout(supabase.from("app_collections").select("*").eq("key", "payments").maybeSingle(), 2500),
          fetchAllTableRows("payments", "payment_date", false).catch(() => ({ data: null, error: true })),
          withSupabaseTimeout(supabase.from("payment_history").select("*").order("changed_at", { ascending: false }).limit(1000), 2500).catch(() => ({ data: null, error: true })),
          fetchAllTableRows("salesmen", "name", true),
          isSalesman ? Promise.resolve({ data: [], error: null }) : fetchAllTableRows("audit_sessions", "created_at", false),
          isSalesman ? Promise.resolve({ data: [], error: null }) : fetchAllTableRows("reconciliation_transactions", "created_at", false),
          isSalesman ? Promise.resolve({ data: [], error: null }) : fetchAllTableRows("stock_ledger_entries", "timestamp", false),
          fetchAllTableRows("inventory_dispositions", "event_date", false),
          isSalesman ? Promise.resolve({ data: [], error: null }) : fetchAllTableRows("supplier_credit_notes", "created_at", false),
          isSalesman ? Promise.resolve({ data: [], error: null }) : fetchAllTableRows("supplier_schemes", "created_at", false),
          withSupabaseTimeout(supabase.from("app_collections").select("*").eq("key", "schemes").maybeSingle(), 2500),
          withSupabaseTimeout(supabase.from("app_collections").select("*").eq("key", "customers").maybeSingle(), 2500),
        ]);

        if (!(whRes as any)?.error && Array.isArray((whRes as any)?.data) && (whRes as any).data.length > 0) {
          result.warehouses = (whRes as any).data.map((r: any) => ({
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
        }

        if (!batchRes.error && Array.isArray(batchRes.data) && batchRes.data.length > 0) {
          result.inventoryBatches = batchRes.data.map(mapDbBatchRowToApp);
        }

        if (!prodRes.error && Array.isArray(prodRes.data) && prodRes.data.length > 0) {
          result.products = prodRes.data.map((r: any) => {
            const catKey = r.category as keyof typeof CATS;
            const catDef = CATS?.[catKey];
            const extraTaxability = r.extra && typeof r.extra === "object" ? r.extra.taxability : undefined;
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
              if (matchingBatch) landedCost = Number(matchingBatch.landedCostPerCrate);
            }
            if (!landedCost || landedCost <= 0) {
              landedCost = Math.round(cost * (1 + gst) * 100) / 100;
            }
            return applyProductExtra(
              {
                id: Number(r.id),
                updatedAt: r.updated_at || undefined,
                sku: r.sku || generateSkuId(r.name, r.category, Number(r.id)),
                name: String(r.name || "").trim().toUpperCase(),
                category: r.category,
                volume: Number(r.volume || volumeFromName(r.name) || 0),
                pack: r.pack || detectPack(r.name),
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
                hsn:
                  extraTaxability === "non_gst"
                    ? String(r.hsn || "").trim()
                    : normalizeTo8DigitHsn(r.hsn || catDef?.hsn, r.category, r.name, extraTaxability),
                gstRate: gst,
                scheme: r.scheme || "",
              },
              r.extra,
            );
          });
        }

        if (!isSalesman) {
          const grnMap = new Map<string, any>();
          const sGrns = (inwardGrnSettingRes as any)?.data?.data?.grns;
          if (Array.isArray(sGrns)) {
            sGrns.forEach((g: any) => {
              if (g && (g.id || g.invoiceNo || g.grnNumber)) {
                grnMap.set(String(g.id || g.invoiceNo || g.grnNumber), g);
              }
            });
          }
          const cGrnsRaw = (inwardGrnColRes as any)?.data?.data;
          const cGrns = Array.isArray(cGrnsRaw) ? cGrnsRaw : cGrnsRaw?.grns;
          if (Array.isArray(cGrns)) {
            cGrns.forEach((g: any) => {
              if (g && (g.id || g.invoiceNo || g.grnNumber)) {
                grnMap.set(String(g.id || g.invoiceNo || g.grnNumber), g);
              }
            });
          }
          if (!grnRes.error && Array.isArray(grnRes.data) && grnRes.data.length > 0) {
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
              const k = String(mapped.id || mapped.invoiceNo || mapped.grnNumber);
              grnMap.set(k, { ...(grnMap.get(k) || {}), ...applyGrnExtra(mapped, g.extra) });
            });
          }
          if (grnMap.size > 0) {
            result.grns = Array.from(grnMap.values()).sort((a, b) =>
              String(b.inwardDate || b.createdAt || "").localeCompare(String(a.inwardDate || a.createdAt || "")),
            );
          }
        }

        // Payments
        const colPaysRaw = (payColRes as any)?.data?.data;
        const tablePays = !(payTableRes as any)?.error && Array.isArray((payTableRes as any)?.data) ? (payTableRes as any).data : [];
        const legacyPays = (paySettingRes as any)?.data?.data?.payments;
        const mergedPays = mergePaymentSources<any>({
          legacy: Array.isArray(legacyPays) ? legacyPays : null,
          collection: colPaysRaw ?? null,
          tableRows: tablePays,
          mapRow: mapDbPaymentToApp,
        });
        if (mergedPays.length > 0) {
          result.payments = mergedPays.sort((a, b) =>
            String(b.paymentDate || b.createdAt || "").localeCompare(String(a.paymentDate || a.createdAt || "")),
          );
        }

        if (!(payHistRes as any)?.error && Array.isArray((payHistRes as any)?.data) && (payHistRes as any).data.length > 0) {
          result.paymentAudit = (payHistRes as any).data.map((r: any) => ({
            id: String(r.id),
            at: r.changed_at,
            by: r.changed_by || "Admin",
            action: r.action,
            ...(r.payment_id ? { paymentId: String(r.payment_id) } : {}),
            ...(r.bill_id !== null && r.bill_id !== undefined ? { billId: Number(r.bill_id) } : {}),
            ...(r.customer_name ? { customerName: r.customer_name } : {}),
            ...(r.amount !== null && r.amount !== undefined ? { amount: Number(r.amount) } : {}),
            ...(r.note ? { note: r.note } : {}),
            ...(r.before_data ? { before: r.before_data } : {}),
            ...(r.after_data ? { after: r.after_data } : {}),
          }));
        }

        const colSchemesRaw = (schemesColRes as any)?.data?.data;
        if (Array.isArray(colSchemesRaw) && colSchemesRaw.length > 0) {
          result.promotions = colSchemesRaw.map(mapPromotionCollectionItem);
        } else if (!(promoRes as any)?.error && Array.isArray((promoRes as any)?.data)) {
          result.promotions = (promoRes as any).data.map(mapPromotionCollectionItem);
        }

        if (!billRes.error && Array.isArray(billRes.data) && billRes.data.length > 0) {
          result.bills = billRes.data.map((r: any) =>
            applyBillExtra(
              {
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
                returns: Array.isArray(r.returns) && r.returns.length > 0 ? r.returns : undefined,
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
              },
              r.extra,
            ),
          );
        }

        if (!tripRes.error && Array.isArray(tripRes.data) && tripRes.data.length > 0) {
          result.trips = tripRes.data.map(normalizeTrip);
        }

        if (!salesmanRes.error && Array.isArray(salesmanRes.data) && salesmanRes.data.length > 0) {
          // NEVER return pin_hash or pinHash to the browser.
          result.salesmen = salesmanRes.data.map(formatSalesmanResponse);
        }

        if (!isSalesman && !(auditRes as any)?.error && Array.isArray((auditRes as any)?.data) && (auditRes as any).data.length > 0) {
          result.audits = (auditRes as any).data.map(mapDbAuditRowToApp);
        }

        if (!(orgRes as any)?.error && (orgRes as any)?.data?.data) {
          result.orgProfile = (orgRes as any).data.data;
        }
        if (!(setRes as any)?.error && (setRes as any)?.data?.data) {
          result.billingSettings = (setRes as any).data.data;
        }

        if (Array.isArray((custColRes as any)?.data?.data)) {
          result.customers = (custColRes as any).data.data;
        }

        if (!isSalesman && !auditSessRes.error && Array.isArray(auditSessRes.data) && auditSessRes.data.length > 0) {
          result.auditSessions = auditSessRes.data.map((r: any) => ({
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
        }

        if (!isSalesman && !reconRes.error && Array.isArray(reconRes.data) && reconRes.data.length > 0) {
          result.reconciliationTransactions = reconRes.data.map((r: any) => ({
            id: String(r.id),
            auditSessionId: String(r.audit_session_id),
            varianceEntryId: String(r.variance_entry_id),
            type: r.type,
            fromProductId: Number(r.from_product_id),
            toProductId: r.to_product_id ? Number(r.to_product_id) : undefined,
            quantity: Number(r.quantity || 0),
            reasonCode: r.reason_code || undefined,
            matchScore: r.match_score !== null && r.match_score !== undefined ? Number(r.match_score) : undefined,
            notes: r.notes || "",
            identifiedBy: r.identified_by || "",
            approvedBy: r.approved_by || undefined,
            approvedAt: r.approved_at || undefined,
            createdAt: r.created_at || "",
          }));
        }

        if (!isSalesman && !stockLedRes.error && Array.isArray(stockLedRes.data) && stockLedRes.data.length > 0) {
          result.stockLedgerEntries = stockLedRes.data.map((r: any) => ({
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
        }

        if (!dispRes.error && Array.isArray(dispRes.data) && dispRes.data.length > 0) {
          result.inventoryDispositions = dispRes.data.map((r: any) => ({
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

        if (!isSalesman && !scnRes.error && Array.isArray(scnRes.data) && scnRes.data.length > 0) {
          result.supplierCreditNotes = scnRes.data.map((r: any) => ({
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

        if (!isSalesman && !schemeRes.error && Array.isArray(schemeRes.data) && schemeRes.data.length > 0) {
          result.supplierSchemes = schemeRes.data.map((r: any) => ({
            id: String(r.id),
            supplierName: r.supplier_name,
            name: r.name,
            schemeType: r.scheme_type,
            productIds: Array.isArray(r.product_ids) ? r.product_ids.map(Number) : [],
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
      }

      // Fill any gaps from local/collection cache (e.g. test runs or disk cache)
      const colFallback = async (key: string) => {
        const v = await getCollectionData(key).catch(() => null);
        return v;
      };
      const maybeFillArr = async (field: string, colKey: string, mapFn?: (v: any[]) => any[]) => {
        if (Array.isArray(result[field]) && result[field].length > 0) return;
        const v = await colFallback(colKey);
        if (Array.isArray(v) && v.length > 0) result[field] = mapFn ? mapFn(v) : v;
      };
      await maybeFillArr("warehouses", "warehouses");
      await maybeFillArr("products", "products");
      await maybeFillArr("inventoryBatches", "inventory_batches");
      await maybeFillArr("promotions", "schemes", (xs) => xs.map(mapPromotionCollectionItem));
      await maybeFillArr("bills", "orders");
      await maybeFillArr("trips", "trips", (xs) => xs.map(normalizeTrip));
      await maybeFillArr("payments", "payments");
      await maybeFillArr("paymentAudit", "payment_history");
      await maybeFillArr("customers", "customers");
      await maybeFillArr("inventoryDispositions", "inventory_dispositions");
      await maybeFillArr("salesmen", "salesmen", (xs) => xs.map(formatSalesmanResponse));
      if (!isSalesman) {
        await maybeFillArr("grns", "inward_grns");
        await maybeFillArr("audits", "audits");
        await maybeFillArr("auditSessions", "audit_sessions");
        await maybeFillArr("reconciliationTransactions", "reconciliation_transactions");
        await maybeFillArr("stockLedgerEntries", "stock_ledger_entries");
        await maybeFillArr("supplierCreditNotes", "supplier_credit_notes");
        await maybeFillArr("supplierSchemes", "supplier_schemes");
      }
      if (!result.orgProfile) {
        const org = await colFallback("organization_profile");
        if (org && typeof org === "object" && !Array.isArray(org)) result.orgProfile = org;
      }
      if (!result.billingSettings) {
        const bs = await colFallback("billing_settings");
        if (bs && typeof bs === "object" && !Array.isArray(bs)) result.billingSettings = bs;
      }

      return res.json({ success: true, data: result });
    } catch (err: any) {
      console.error("Error in GET /api/sync/pull:", err);
      return res.status(500).json({ error: err?.message || "Sync pull failed", data: null });
    }
  });

  // 4. Owner-only full ledger push (never overwrites non-empty salesman PIN hashes with "")
  app.post("/api/sync/push", async (req, res) => {
    try {
      const who = (req as any).authUser || (await resolveAuth(req).catch(() => null));
      if (who?.r === "salesman") {
        return res.status(403).json({ error: "Only the administrator can do this.", code: "ADMIN_ONLY" });
      }
      const raw = req.body?.data && typeof req.body.data === "object" ? req.body.data : req.body;
      if (!raw || typeof raw !== "object") {
        return res.status(400).json({ error: "Invalid sync push payload" });
      }

      const [deadBills, deadGrns, deadTrips] = await Promise.all([
        readTombstones("deleted_bill_ids"),
        readTombstones("deleted_grn_ids"),
        readTombstones("deleted_trip_ids"),
      ]);

      const bills = (Array.isArray(raw.bills) ? raw.bills : []).filter((b: any) => !deadBills.has(String(b?.id)));
      const grns = Array.isArray(raw.grns) ? raw.grns.filter((g: any) => !deadGrns.has(String(g?.id))) : undefined;
      const trips = (Array.isArray(raw.trips) ? raw.trips : []).filter((t: any) => !deadTrips.has(String(t?.id)));
      const warehouses = Array.isArray(raw.warehouses) && raw.warehouses.length > 0 ? raw.warehouses : INIT_WAREHOUSES;
      const products = Array.isArray(raw.products) ? raw.products : [];
      const inventoryBatches = Array.isArray(raw.inventoryBatches) ? raw.inventoryBatches : [];
      const promotions = Array.isArray(raw.promotions) ? raw.promotions : [];
      const audits = Array.isArray(raw.audits) ? raw.audits : [];
      const payments = Array.isArray(raw.payments) ? raw.payments : undefined;
      const incomingSalesmen = Array.isArray(raw.salesmen) ? raw.salesmen : undefined;

      const pushedCount = {
        warehouses: warehouses.length,
        products: products.length,
        inventoryBatches: inventoryBatches.length,
        grns: grns ? grns.length : 0,
        promotions: promotions.length,
        bills: bills.length,
        trips: trips.length,
        audits: audits.length,
        payments: payments ? payments.length : 0,
        salesmen: incomingSalesmen ? incomingSalesmen.length : 0,
        supplierSchemes: Array.isArray(raw.supplierSchemes) ? raw.supplierSchemes.length : 0,
        supplierSchemeApplications: Array.isArray(raw.supplierSchemeApplications) ? raw.supplierSchemeApplications.length : 0,
        supplierCreditNotes: Array.isArray(raw.supplierCreditNotes) ? raw.supplierCreditNotes.length : 0,
      };

      // Update local/disk collections first so test runs and local-first caches stay authoritative
      await setCollectionData("warehouses", warehouses);
      if (products.length) await setCollectionData("products", products);
      if (inventoryBatches.length) await setCollectionData("inventory_batches", inventoryBatches);
      if (grns && grns.length) await setCollectionData("inward_grns", grns);
      if (promotions.length) await setCollectionData("schemes", promotions);
      if (bills.length) await setCollectionData("orders", bills);
      if (trips.length) await setCollectionData("trips", trips);
      if (audits.length) await setCollectionData("audits", audits);
      if (raw.orgProfile) await setCollectionData("organization_profile", raw.orgProfile);
      if (raw.billingSettings) await setCollectionData("billing_settings", raw.billingSettings);
      if (payments) await setCollectionData("payments", payments);
      if (Array.isArray(raw.supplierSchemes)) await setCollectionData("supplier_schemes", raw.supplierSchemes);
      if (Array.isArray(raw.supplierSchemeApplications)) await setCollectionData("supplier_scheme_applications", raw.supplierSchemeApplications);
      if (Array.isArray(raw.supplierCreditNotes)) await setCollectionData("supplier_credit_notes", raw.supplierCreditNotes);
      if (Array.isArray(raw.auditSessions)) await setCollectionData("audit_sessions", raw.auditSessions);
      if (Array.isArray(raw.reconciliationTransactions)) await setCollectionData("reconciliation_transactions", raw.reconciliationTransactions);
      if (Array.isArray(raw.stockLedgerEntries)) await setCollectionData("stock_ledger_entries", raw.stockLedgerEntries);

      // Preserve stored salesman PIN hashes whenever incoming salesman objects have empty pinHash
      let resolvedSalesmen: any[] = [];
      if (incomingSalesmen && incomingSalesmen.length > 0) {
        const storedLocal = await getCollectionData("salesmen");
        const existingList: any[] = Array.isArray(storedLocal) ? [...storedLocal] : [];
        if (isSupabaseAvailable()) {
          const { data: dbSm }: any = await withSupabaseTimeout(
            supabase.from("salesmen").select("id,phone,pin_hash"),
            2500,
          );
          if (Array.isArray(dbSm)) {
            for (const row of dbSm) existingList.push(row);
          }
        }
        const byId = new Map<string, any>();
        const byPhone = new Map<string, any>();
        for (const ex of existingList) {
          if (!ex) continue;
          const h = String(ex.pin_hash || ex.pinHash || "").trim();
          if (ex.id && (h || !byId.has(String(ex.id)))) byId.set(String(ex.id), ex);
          const ph = normalizePhoneDigits(ex.phone);
          if (ph && (h || !byPhone.has(ph))) byPhone.set(ph, ex);
        }

        resolvedSalesmen = incomingSalesmen.map((s: any) => {
          const match = byId.get(String(s.id)) || byPhone.get(normalizePhoneDigits(s.phone));
          const preservedHash =
            String(s.pinHash || s.pin_hash || "").trim() ||
            String(match?.pin_hash || match?.pinHash || "").trim();
          return formatSalesmanStored(
            {
              id: s.id,
              name: s.name,
              phone: s.phone,
              active: s.active,
              defaultVehicle: s.defaultVehicle,
              createdAt: s.createdAt,
              updatedAt: s.updatedAt || new Date().toISOString(),
            },
            preservedHash,
          );
        });
        await setCollectionData("salesmen", resolvedSalesmen);
      }

      // Mirror to Supabase tables using service key
      if (isSupabaseAvailable()) {
        await resilientUpsert(supabase, "warehouses", warehouses.map(formatWarehouseForSupabase), { onConflict: "id" });

        if (products.length > 0) {
          const prodRows = products.map((p: any, i: number) => ({
            id: Number(p.id),
            sku: p.sku || generateSkuId(p.name, p.category, Number(p.id)),
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
            extra: productExtraFields(products[i]),
            updated_at: p.updatedAt || new Date().toISOString(),
          }));
          await resilientUpsert(supabase, "products", prodRows, { onConflict: "id" });
        }

        if (inventoryBatches.length > 0) {
          const batchRows = inventoryBatches.map(formatBatchRowForServer);
          await resilientUpsert(supabase, "inventory_batches", batchRows, { onConflict: "id" });
        }

        if (grns && grns.length > 0) {
          const grnRows = grns.map((g: any) => ({
            id: g.id,
            grn_number: g.grnNumber,
            invoice_no: g.invoiceNo || "",
            supplier_name: g.supplierName || "",
            supplier_gstin: g.supplierGstin || "",
            supplier_address: g.supplierAddress || "",
            supplier_phone: g.supplierPhone || "",
            supplier_email: g.supplierEmail || "",
            inward_date: sanitizeDate(g.inwardDate) || todayISO(),
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
          await resilientUpsert(supabase, "grns", grnRows, { onConflict: "id" });
          await withSupabaseTimeout(
            supabase.from("billing_settings").upsert(
              { id: "inward_grns", data: { grns }, updated_at: new Date().toISOString() },
              { onConflict: "id" },
            ),
            2500,
          );
        }

        if (promotions.length > 0) {
          const promoRows = promotions.map(formatPromotionRowForServer);
          await resilientUpsert(supabase, "promotions", promoRows, { onConflict: "id" });
        }

        if (bills.length > 0) {
          await resilientUpsert(supabase, "bills", bills.map(formatBillForSupabase), { onConflict: "id" });
        }
        if (trips.length > 0) {
          await resilientUpsert(supabase, "trips", trips.map(formatTripForSupabase), { onConflict: "id" });
        }

        if (resolvedSalesmen.length > 0) {
          const smRows = resolvedSalesmen.map((s: any) => ({
            id: s.id,
            name: s.name,
            phone: s.phone,
            ...(s.pin_hash ? { pin_hash: s.pin_hash } : {}),
            active: s.active !== undefined ? Boolean(s.active) : true,
            default_vehicle: s.defaultVehicle || s.default_vehicle || "",
            updated_at: new Date().toISOString(),
          }));
          await resilientUpsert(supabase, "salesmen", smRows, { onConflict: "id" });
        }

        if (audits.length > 0) {
          await resilientUpsert(
            supabase,
            "audits",
            audits.map(formatAuditRowForServer),
            { onConflict: "id" },
          );
        }

        if (raw.orgProfile) {
          await withSupabaseTimeout(
            supabase.from("organization_profile").upsert(
              { id: "default", data: raw.orgProfile, updated_at: new Date().toISOString() },
              { onConflict: "id" },
            ),
            2500,
          );
        }
        if (raw.billingSettings) {
          await withSupabaseTimeout(
            supabase.from("billing_settings").upsert(
              { id: "default", data: raw.billingSettings, updated_at: new Date().toISOString() },
              { onConflict: "id" },
            ),
            2500,
          );
        }
        if (payments && payments.length > 0) {
          await syncNormalizedRows("payments", payments.filter((p: any) => p?.id).map(mapAppPaymentToDb));
        }
        await syncExtendedCollectionsToSupabase(raw);
      }

      emitSyncEvent({ topic: "bills" });
      emitSyncEvent({ topic: "trips" });
      emitSyncEvent({ topic: "payments" });
      emitSyncEvent({ topic: "products" });
      emitSyncEvent({ topic: "schemes" });
      emitSyncEvent({ topic: "settings" });
      flushDiskCollectionsNow();

      return res.json({ success: true, pushedCount });
    } catch (err: any) {
      console.error("Error in POST /api/sync/push:", err);
      return res.status(500).json({ error: err?.message || "Sync push failed" });
    }
  });

  // 5. Combined tombstones & deletion log reader
  app.get("/api/sync/tombstones", async (_req, res) => {
    try {
      const [bills, grns, trips, log] = await Promise.all([
        readTombstones("deleted_bill_ids"),
        readTombstones("deleted_grn_ids"),
        readTombstones("deleted_trip_ids"),
        readListFresh("deleted_records"),
      ]);

      const delMap = new Map<string, any>();
      for (const r of Array.isArray(log) ? log : []) {
        if (r && r.kind && r.id) delMap.set(`${r.kind}:${r.id}`, r);
      }

      if (isSupabaseAvailable()) {
        try {
          const PAGE = 1000;
          for (let from = 0; from < 50000; from += PAGE) {
            const { data: page, error }: any = await withSupabaseTimeout(
              supabase
                .from("app_collections")
                .select("data")
                .like("key", "deleted:%")
                .order("key", { ascending: true })
                .range(from, from + PAGE - 1),
              2500,
            );
            if (error || !Array.isArray(page)) break;
            for (const row of page) {
              const r = row?.data;
              if (r && r.kind && r.id) delMap.set(`${r.kind}:${r.id}`, r);
            }
            if (page.length < PAGE) break;
          }
        } catch {
          // ignore
        }
      }

      return res.json({
        success: true,
        data: {
          bills: Array.from(bills),
          grns: Array.from(grns),
          trips: Array.from(trips),
          deletions: Array.from(delMap.values()),
        },
      });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || "Failed to read tombstones", data: null });
    }
  });

  // 6. Owner-only deletion record logger
  app.post("/api/sync/deletions", async (req, res) => {
    try {
      const who = (req as any).authUser || (await resolveAuth(req).catch(() => null));
      if (who?.r === "salesman") {
        return res.status(403).json({ error: "Only the administrator can do this.", code: "ADMIN_ONLY" });
      }
      const incoming = Array.isArray(req.body?.records)
        ? req.body.records
        : Array.isArray(req.body)
          ? req.body
          : req.body && req.body.kind && req.body.id
            ? [req.body]
            : [];
      if (incoming.length === 0) {
        return res.json({ success: true, count: 0 });
      }
      const existing = await readListFresh("deleted_records");
      const map = new Map<string, any>();
      for (const r of existing) {
        if (r && r.kind && r.id) map.set(`${r.kind}:${r.id}`, r);
      }
      for (const r of incoming) {
        if (r && r.kind && r.id) map.set(`${r.kind}:${r.id}`, r);
      }
      await setCollectionData("deleted_records", Array.from(map.values()).slice(-20000));
      if (isSupabaseAvailable()) {
        const now = new Date().toISOString();
        await withSupabaseTimeout(
          supabase.from("app_collections").upsert(
            incoming
              .filter((r: any) => r?.kind && r?.id)
              .map((r: any) => ({
                key: `deleted:${r.kind}:${r.id}`,
                data: r,
                updated_at: now,
              })),
            { onConflict: "key" },
          ),
          2500,
        ).catch(() => {});
      }
      flushDiskCollectionsNow();
      emitSyncEvent({ topic: "deletions" });
      return res.json({ success: true, count: incoming.length });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || "Failed to record deletions" });
    }
  });

  // 7. Authenticated Server-Sent Events stream (replaces direct browser Supabase Realtime)
  app.get("/api/sync/events", async (req, res) => {
    const who = (req as any).authUser || (await resolveAuth(req).catch(() => null));
    const deviceId = String(req.query?.deviceId || "").trim().slice(0, 64) || undefined;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const remove = addSyncClient({
      res,
      role: who?.r === "salesman" ? "salesman" : "admin",
      sid: who?.sid ? String(who.sid) : undefined,
      deviceId,
    });
    req.on("close", remove);
  });

  // 8. Broadcast change signal to other devices via SSE
  app.post("/api/sync/signal", async (req, res) => {
    const who = (req as any).authUser || (await resolveAuth(req).catch(() => null));
    const fromDeviceId = String(req.body?.fromDeviceId || req.body?.deviceId || "").trim().slice(0, 64) || undefined;
    emitSyncEvent({
      topic: "signal",
      fromDeviceId,
      salesmanId: who?.r === "salesman" ? String(who.sid || "") : undefined,
    });
    return res.json({ success: true });
  });

  // 9. Activity logs read/write (replaces direct browser public.activity_logs calls)
  app.get("/api/activity-logs", async (req, res) => {
    try {
      const limit = Math.min(2000, Math.max(1, Number(req.query?.limit) || 1000));
      const byId = new Map<string, any>();

      const localList = await getCollectionData("activity_logs").catch(() => []);
      if (Array.isArray(localList)) {
        for (const item of localList) {
          if (item?.id) byId.set(String(item.id), mapDbActivityToApp(item));
        }
      }

      if (isSupabaseAvailable()) {
        try {
          const { data, error }: any = await withSupabaseTimeout(
            supabase
              .from("activity_logs")
              .select("*")
              .order("created_at", { ascending: false })
              .limit(limit),
            2500,
          );
          if (!error && Array.isArray(data)) {
            for (const r of data) {
              if (!r?.id) continue;
              const entry = mapDbActivityToApp(r);
              byId.set(entry.id, entry);
            }
          }
        } catch {
          // activity_logs table may not exist yet
        }

        try {
          const { data: colRow }: any = await withSupabaseTimeout(
            supabase.from("app_collections").select("data").eq("key", "activity_logs").maybeSingle(),
            2000,
          );
          if (Array.isArray(colRow?.data)) {
            for (const item of colRow.data) {
              if (!item?.id) continue;
              const entry = mapDbActivityToApp(item);
              if (!byId.has(entry.id)) byId.set(entry.id, entry);
            }
          }
        } catch {
          // optional fallback
        }
      }

      const list = Array.from(byId.values())
        .sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")))
        .slice(0, limit);
      return res.json({ success: true, data: list });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || "Failed to fetch activity logs", data: [] });
    }
  });

  app.post("/api/activity-logs", async (req, res) => {
    try {
      const who = (req as any).authUser || (await resolveAuth(req).catch(() => null));
      const entriesRaw = Array.isArray(req.body?.entries)
        ? req.body.entries
        : Array.isArray(req.body)
          ? req.body
          : req.body && req.body.id
            ? [req.body]
            : [];
      const entries = entriesRaw.filter((e: any) => e && e.id && e.action);
      if (entries.length === 0) {
        return res.status(400).json({ error: "Invalid activity log entry" });
      }

      const existing = await getCollectionData("activity_logs").catch(() => []);
      const byId = new Map<string, any>();
      if (Array.isArray(existing)) {
        for (const item of existing) {
          if (item?.id) byId.set(String(item.id), item);
        }
      }
      for (const e of entries) {
        byId.set(String(e.id), { ...e, syncStatus: "synced" });
      }
      const next = Array.from(byId.values())
        .sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")))
        .slice(0, 1000);
      await setCollectionData("activity_logs", next);

      if (isSupabaseAvailable()) {
        const rows = entries.map(mapAppActivityToDb);
        for (let i = 0; i < rows.length; i += 200) {
          await withSupabaseTimeout(
            supabase.from("activity_logs").upsert(rows.slice(i, i + 200), { onConflict: "id" }),
            2500,
          ).catch(() => {});
        }
      }

      emitSyncEvent({
        topic: "activity",
        salesmanId: who?.r === "salesman" ? String(who.sid || "") : undefined,
      });

      return res.status(201).json({
        success: true,
        data: entries.length === 1 ? entries[0] : entries,
        count: entries.length,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || "Failed to save activity log" });
    }
  });
}
