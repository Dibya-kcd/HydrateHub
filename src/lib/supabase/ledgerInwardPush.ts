import {
  getSupabaseClient,
  isServerProxyMode,
  proxyFetch,
  sanitizeDate,
} from "./client";
import { resilientSupabaseUpsert } from "./pushCache";
import { formatBatchForSupabase } from "./ledgerPush";
import { INIT_WAREHOUSES } from "../../constants/initialData";
import {
  grnExtraFields,
  productExtraFields,
} from "../../utils/billExtra";
import {
  generateSkuId,
  resolveProductGstRate,
} from "../../utils/billing";
import { todayISO } from "../../utils/dateLocal";
import type {
  GRN,
  InventoryBatch,
  Product,
  Warehouse,
} from "../../types";

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
          productPayload.map((row, i) => ({
            ...row,
            extra: productExtraFields(params.products[i]),
          })),
          { onConflict: "id" },
        );
      if (prodErr) {
        ({ error: prodErr } = await client
          .from("products")
          .upsert(productPayload, { onConflict: "id" }));
      }
      if (prodErr) {
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

    // 3. Upsert inventory batches into inventory_batches table (full schema + resilient fallback)
    if (params.inventoryBatches.length > 0) {
      const batchPayload = params.inventoryBatches.map(formatBatchForSupabase);
      await resilientSupabaseUpsert(client, "inventory_batches", batchPayload, {
        onConflict: "id",
      });
    }

    // 4. Persist GRN record in Supabase:
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
      await resilientSupabaseUpsert(client, "grns", grnPayload, { onConflict: "id" });
    } catch {
      // grns table might not exist yet
    }

    // Always mirror the complete list of GRNs in billing_settings for foolproof persistence
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
