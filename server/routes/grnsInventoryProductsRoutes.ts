import type { Express } from "express";
import {
  applyGrnExtra,
  applyProductExtra,
  grnExtraFields,
  productExtraFields,
} from "../../src/utils/billExtra";
import { detectPack, volumeFromName } from "../../src/utils/billing";
import { todayISO } from "../../src/utils/dateLocal";
import {
  addTombstone,
  mergeRecordLists,
  readTombstones,
} from "../dbHelpers";
import {
  getCollectionData,
  isSupabaseAvailable,
  setCollectionData,
  supabase,
  withSupabaseTimeout,
} from "../supabaseStore";
import { emitSyncEvent } from "../syncEvents";

export function registerGrnsInventoryProductsRoutes(app: Express) {
  // 2D. GRNS (GOODS RECEIVED NOTES / INWARD CONSIGNMENTS)
  app.get("/api/grns", async (_req, res) => {
    try {
      const deadGrnIds = await readTombstones("deleted_grn_ids");
      const { data: grns, error } = isSupabaseAvailable()
        ? ((await withSupabaseTimeout(
            supabase
              .from("grns")
              .select("*")
              .order("inward_date", { ascending: false }),
            2500,
          )) as any)
        : { data: null, error: null };

      if (!error && Array.isArray(grns) && grns.length > 0) {
        const formatted = grns.map((g: any) =>
          applyGrnExtra(
            {
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
            },
            g.extra,
          ),
        );
        return res.json({
          success: true,
          data: formatted.filter((g: any) => !deadGrnIds.has(String(g?.id))),
        });
      }

      let colGrns = await getCollectionData("inward_grns");
      if (!Array.isArray(colGrns) || colGrns.length === 0) {
        colGrns = await getCollectionData("grns");
      }
      if (Array.isArray(colGrns) && colGrns.length > 0) {
        return res.json({
          success: true,
          data: (colGrns as any[]).filter(
            (g: any) => !deadGrnIds.has(String(g?.id)),
          ),
        });
      }

      if (isSupabaseAvailable()) {
        try {
          const { data: setRes } = (await withSupabaseTimeout(
            supabase
              .from("billing_settings")
              .select("data")
              .eq("id", "inward_grns")
              .maybeSingle(),
            2500,
          )) as any;
          if (setRes?.data?.grns && Array.isArray(setRes.data.grns)) {
            return res.json({ success: true, data: setRes.data.grns });
          }
        } catch {
          // ignore
        }
      }

      return res.json({ success: true, data: [] });
    } catch (err: any) {
      console.error("Error in GET /api/grns:", err);
      return res
        .status(500)
        .json({ error: err.message || "Failed to fetch grns", data: [] });
    }
  });

  app.post("/api/grns", async (req, res) => {
    try {
      const g = req.body?.grn || req.body;
      if (!g || !g.id) {
        return res.status(400).json({ error: "Invalid GRN payload" });
      }

      {
        const storedList = await getCollectionData("inward_grns");
        const storedGrn = (Array.isArray(storedList) ? storedList : []).find(
          (x: any) => String(x.id) === String(g.id),
        );
        const edits = (x: any) =>
          Array.isArray(x?.editHistory) ? x.editHistory.length : 0;
        if (storedGrn && edits(storedGrn) > edits(g)) {
          return res
            .status(200)
            .json({ success: true, data: storedGrn, stale: true });
        }
        if ((await readTombstones("deleted_grn_ids")).has(String(g.id))) {
          const cur = await getCollectionData("deleted_grn_ids");
          await setCollectionData(
            "deleted_grn_ids",
            (Array.isArray(cur) ? cur : []).filter(
              (n: any) => String(n) !== String(g.id),
            ),
          );
        }
      }

      const grnPayload = {
        id: String(g.id),
        grn_number: g.grnNumber || g.id,
        invoice_no: g.invoiceNo || "",
        supplier_name: g.supplierName || "",
        supplier_gstin: g.supplierGstin || "",
        supplier_address: g.supplierAddress || "",
        supplier_phone: g.supplierPhone || "",
        supplier_email: g.supplierEmail || "",
        inward_date: g.inwardDate || todayISO(),
        vehicle_no: g.vehicleNo || "",
        warehouse_id: g.warehouseId || "",
        warehouse_name: g.warehouseName || "",
        items: Array.isArray(g.items) ? g.items : [],
        total_billed_qty: Number(g.totalBilledQty || 0),
        total_free_qty: Number(g.totalFreeQty || 0),
        total_paid_qty: Number(g.totalPaidQty || 0),
        total_received_qty: Number(g.totalReceivedQty || 0),
        total_taxable: Number(g.totalTaxable || 0),
        total_cgst: Number(g.totalCgst || 0),
        total_sgst: Number(g.totalSgst || 0),
        total_tax: Number(g.totalTax || 0),
        grand_total: Number(g.grandTotal || 0),
        inward_costs: g.inwardCosts || {},
        total_inward_cost: Number(g.totalInwardCost || 0),
        inward_cost_per_crate: Number(g.inwardCostPerCrate || 0),
        notes: g.notes || "",
        edit_history: g.editHistory || [],
        updated_at: new Date().toISOString(),
      };

      if (isSupabaseAvailable()) {
        const { error: upErr } = (await withSupabaseTimeout(
          supabase.from("grns").upsert(grnPayload, { onConflict: "id" }),
          2500,
        )) as any;
        if (upErr) {
          console.warn("Notice: public.grns upsert:", upErr.message);
        }

        if (Array.isArray(g.items) && g.items.length > 0) {
          const batchRows = g.items.map((it: any) => ({
            id: `batch_${g.id}_${it.id || it.productId}`,
            product_id: Number(it.productId),
            sku: it.sku || "",
            batch_number: it.batchNumber || `LOT-${g.invoiceNo || Date.now()}`,
            mfg_date: it.mfgDate || null,
            expiry_date: it.expiry || null,
            warehouse_id: g.warehouseId || null,
            quantity:
              Number(it.totalReceivedQty || it.qty || 0) +
              Number(it.supplierSchemeFreeQty || 0),
            cost_price: Number(it.unitPrice || 0),
            effective_cost_price: Number(
              it.effectiveCostPerUnit ||
                it.landedCostPerUnit ||
                it.unitPrice ||
                0,
            ),
            mrp: Number(it.retailRate || 0),
            notes: `GRN: ${g.grnNumber || g.id} · Inv: ${g.invoiceNo || ""}`,
            updated_at: new Date().toISOString(),
          }));
          await withSupabaseTimeout(
            supabase
              .from("inventory_batches")
              .upsert(batchRows, { onConflict: "id" }),
            2500,
          ).catch(() => {});
        }
      }

      const existing = await getCollectionData("inward_grns");
      const list = Array.isArray(existing) ? existing : [];
      const updated = [
        g,
        ...list.filter((x: any) => String(x.id) !== String(g.id)),
      ];
      await setCollectionData("inward_grns", updated);
      emitSyncEvent({ topic: "inventory", key: "inward_grns" });

      return res.status(201).json({ success: true, data: g });
    } catch (err: any) {
      console.error("Error in POST /api/grns:", err);
      return res
        .status(500)
        .json({ error: err.message || "Failed to save GRN" });
    }
  });

  app.put("/api/grns", async (req, res) => {
    try {
      const rawAll = Array.isArray(req.body?.grns)
        ? req.body.grns
        : Array.isArray(req.body?.data)
          ? req.body.data
          : Array.isArray(req.body)
            ? req.body
            : [];
      const deadGrns = await readTombstones("deleted_grn_ids");
      const raw = rawAll.filter((g: any) => !deadGrns.has(String(g?.id)));

      if (raw.length === 0) {
        return res.json({ success: true, count: 0 });
      }

      const storedGrns = await getCollectionData("inward_grns");
      const acceptedGrns = new Set<any>();
      const mergedGrns = mergeRecordLists(
        Array.isArray(storedGrns) ? storedGrns : [],
        raw,
        deadGrns,
        (cur, next) =>
          (Array.isArray(cur?.editHistory) ? cur.editHistory.length : 0) >
          (Array.isArray(next?.editHistory) ? next.editHistory.length : 0),
        acceptedGrns,
      );
      await setCollectionData("inward_grns", mergedGrns);
      const rawAccepted = raw.filter((g: any) => acceptedGrns.has(g));
      if (rawAccepted.length === 0) {
        return res.json({ success: true, count: 0 });
      }

      const payloads = rawAccepted.map((g: any) => ({
        id: String(g.id),
        grn_number: g.grnNumber || g.id,
        invoice_no: g.invoiceNo || "",
        supplier_name: g.supplierName || "",
        supplier_gstin: g.supplierGstin || "",
        supplier_address: g.supplierAddress || "",
        supplier_phone: g.supplierPhone || "",
        supplier_email: g.supplierEmail || "",
        inward_date: g.inwardDate || todayISO(),
        vehicle_no: g.vehicleNo || "",
        warehouse_id: g.warehouseId || "",
        warehouse_name: g.warehouseName || "",
        items: Array.isArray(g.items) ? g.items : [],
        total_billed_qty: Number(g.totalBilledQty || 0),
        total_free_qty: Number(g.totalFreeQty || 0),
        total_paid_qty: Number(g.totalPaidQty || 0),
        total_received_qty: Number(g.totalReceivedQty || 0),
        total_taxable: Number(g.totalTaxable || 0),
        total_cgst: Number(g.totalCgst || 0),
        total_sgst: Number(g.totalSgst || 0),
        total_tax: Number(g.totalTax || 0),
        grand_total: Number(g.grandTotal || 0),
        inward_costs: g.inwardCosts || {},
        total_inward_cost: Number(g.totalInwardCost || 0),
        inward_cost_per_crate: Number(g.inwardCostPerCrate || 0),
        notes: g.notes || "",
        edit_history: g.editHistory || [],
        extra: grnExtraFields(g),
        updated_at: new Date().toISOString(),
      }));

      if (isSupabaseAvailable()) {
        let up = (await withSupabaseTimeout(
          supabase.from("grns").upsert(payloads, { onConflict: "id" }),
          2500,
        )) as any;
        if (up?.error) {
          const noExtra = payloads.map(({ extra: _x, ...r }: any) => r);
          up = (await withSupabaseTimeout(
            supabase.from("grns").upsert(noExtra, { onConflict: "id" }),
            2500,
          )) as any;
          if (up?.error) {
            const noHistory = noExtra.map(
              ({ edit_history: _h, ...r }: any) => r,
            );
            await withSupabaseTimeout(
              supabase.from("grns").upsert(noHistory, { onConflict: "id" }),
              2500,
            ).catch(() => {});
          }
        }
      }
      emitSyncEvent({ topic: "inventory", key: "inward_grns" });
      return res.json({ success: true, count: payloads.length });
    } catch (err: any) {
      console.error("Error in PUT /api/grns:", err);
      return res
        .status(500)
        .json({ error: err.message || "Failed to update GRNs" });
    }
  });

  app.post("/api/grns/inward", async (req, res) => {
    try {
      const { grn, products, inventoryBatches, allGrns, warehouse } =
        req.body || {};
      if (!grn || !grn.id) {
        return res.status(400).json({ error: "Invalid GRN payload" });
      }

      const prodsList = Array.isArray(products) ? products : [];
      const batchList = Array.isArray(inventoryBatches) ? inventoryBatches : [];
      const existingGrns = await getCollectionData("inward_grns");
      const baseGrns = Array.isArray(allGrns)
        ? allGrns
        : Array.isArray(existingGrns)
          ? existingGrns
          : [];
      const updatedGrns = [
        grn,
        ...baseGrns.filter((x: any) => String(x?.id) !== String(grn.id)),
      ];
      await setCollectionData("inward_grns", updatedGrns);

      if (prodsList.length > 0) {
        await setCollectionData("products", prodsList);
      }
      if (batchList.length > 0) {
        await setCollectionData("inventory_batches", batchList);
      }
      if (warehouse && warehouse.id) {
        const curWhs = await getCollectionData("warehouses");
        const whList = Array.isArray(curWhs) ? curWhs : [];
        const hasWh = whList.some(
          (w: any) => String(w.id) === String(warehouse.id),
        );
        if (!hasWh) {
          await setCollectionData("warehouses", [...whList, warehouse]);
        }
      }

      if (isSupabaseAvailable()) {
        if (warehouse && warehouse.id) {
          await withSupabaseTimeout(
            supabase.from("warehouses").upsert(
              {
                id: String(warehouse.id),
                name: warehouse.name || "Default Warehouse",
                code: warehouse.code || "WH-01",
                location: warehouse.location || "",
                manager: warehouse.manager || "",
                phone: warehouse.phone || "",
                capacity_cases: Number(warehouse.capacityCases || 0),
                is_default: Boolean(warehouse.isDefault),
                notes: warehouse.notes || "",
                updated_at: new Date().toISOString(),
              },
              { onConflict: "id" },
            ),
            2500,
          ).catch(() => {});
        }

        if (prodsList.length > 0) {
          const prodRows = prodsList.map((p: any) => ({
            id: Number(p.id),
            sku: String(p.sku || `PRD-${p.id}`),
            name: String(p.name || "").trim().toUpperCase(),
            category: String(p.category || "energy"),
            volume: Number(p.volume) > 0 ? Number(p.volume) : volumeFromName(p.name) || 150,
            pack:
              p.pack && p.pack.trim() !== "" && p.pack !== "pcs"
                ? p.pack
                : detectPack(p.name),
            expiry: String(p.expiry || ""),
            batch_number: String(p.batchNumber || p.batch_number || ""),
            mfg_date: String(p.mfgDate || p.mfg_date || ""),
            warehouse_id: String(p.warehouseId || p.warehouse_id || ""),
            opening: Number(p.opening || 0),
            cost: Number(p.cost || 0),
            effective_cost: Number(p.effectiveCost || p.cost || 0),
            retail: Number(p.retail || 0),
            wholesale: Number(p.wholesale || 0),
            hsn: String(p.hsn || "2202"),
            gst_rate: Number(p.gstRate !== undefined ? p.gstRate : 0.18),
            scheme: String(p.scheme || ""),
            updated_at: String(p.updatedAt || new Date().toISOString()),
          }));
          await withSupabaseTimeout(
            supabase.from("products").upsert(
              prodRows.map((row: any, i: number) => {
                const extra = productExtraFields(prodsList[i]);
                return extra ? { ...row, extra } : row;
              }),
              { onConflict: "id" },
            ),
            3000,
          ).catch(() => {});
        }

        if (batchList.length > 0) {
          const batchRows = batchList.map((b: any) => ({
            id: String(b.id),
            product_id: Number(b.productId),
            sku: b.sku || "",
            batch_number: b.batchNumber || "",
            mfg_date: b.mfgDate || null,
            expiry_date: b.expiryDate || null,
            warehouse_id: b.warehouseId || null,
            quantity: Number(b.quantity || 0),
            cost_price: Number(b.costPrice || 0),
            effective_cost_price: Number(b.effectiveCostPrice || b.costPrice || 0),
            mrp: Number(b.mrp || 0),
            scheme: b.scheme || "",
            notes: b.notes || "",
            updated_at: new Date().toISOString(),
          }));
          await withSupabaseTimeout(
            supabase
              .from("inventory_batches")
              .upsert(batchRows, { onConflict: "id" }),
            3000,
          ).catch(() => {});
        }

        const grnRow = {
          id: String(grn.id),
          grn_number: grn.grnNumber || grn.id,
          invoice_no: grn.invoiceNo || "",
          supplier_name: grn.supplierName || "",
          supplier_gstin: grn.supplierGstin || "",
          supplier_address: grn.supplierAddress || "",
          supplier_phone: grn.supplierPhone || "",
          supplier_email: grn.supplierEmail || "",
          inward_date: grn.inwardDate || todayISO(),
          vehicle_no: grn.vehicleNo || "",
          warehouse_id: grn.warehouseId || "",
          warehouse_name: grn.warehouseName || "",
          items: Array.isArray(grn.items) ? grn.items : [],
          total_billed_qty: Number(grn.totalBilledQty || 0),
          total_free_qty: Number(grn.totalFreeQty || 0),
          total_paid_qty: Number(grn.totalPaidQty || 0),
          total_received_qty: Number(grn.totalReceivedQty || 0),
          total_taxable: Number(grn.totalTaxable || 0),
          total_cgst: Number(grn.totalCgst || 0),
          total_sgst: Number(grn.totalSgst || 0),
          total_tax: Number(grn.totalTax || 0),
          grand_total: Number(grn.grandTotal || 0),
          inward_costs: grn.inwardCosts || {},
          total_inward_cost: Number(grn.totalInwardCost || 0),
          inward_cost_per_crate: Number(grn.inwardCostPerCrate || 0),
          notes: grn.notes || "",
          edit_history: grn.editHistory || [],
          extra: grnExtraFields(grn),
          updated_at: new Date().toISOString(),
        };
        await withSupabaseTimeout(
          supabase.from("grns").upsert(grnRow, { onConflict: "id" }),
          3000,
        ).catch(() => {});
      }

      emitSyncEvent({ topic: "products" });
      emitSyncEvent({ topic: "batches" });
      emitSyncEvent({ topic: "inventory", key: "inward_grns" });
      if (warehouse) emitSyncEvent({ topic: "warehouses" });
      return res.json({ success: true, data: grn });
    } catch (err: any) {
      console.error("Error in POST /api/grns/inward:", err);
      return res.status(500).json({ error: err.message || "Failed to push inward invoice" });
    }
  });

  app.post("/api/grns/:id/edit-log", async (req, res) => {
    try {
      const { id } = req.params;
      const { grn, record } = req.body || {};
      const existing = await getCollectionData("inward_grns");
      const list = Array.isArray(existing) ? existing : [];
      if (grn && grn.id) {
        const next = [grn, ...list.filter((g: any) => String(g.id) !== String(id))];
        await setCollectionData("inward_grns", next);
      }
      if (isSupabaseAvailable()) {
        if (grn && Array.isArray(grn.editHistory)) {
          await withSupabaseTimeout(
            supabase
              .from("grns")
              .update({
                edit_history: grn.editHistory,
                updated_at: new Date().toISOString(),
              })
              .eq("id", String(id)),
            2500,
          ).catch(() => {});
        }
        if (record) {
          await withSupabaseTimeout(
            supabase.from("grn_edit_log").upsert(
              {
                id: String(record.id || `grn_edit_${Date.now()}`),
                grn_id: String(id),
                grn_number: grn?.grnNumber || "",
                invoice_no: grn?.invoiceNo || "",
                supplier_name: grn?.supplierName || "",
                edited_by: record.by || record.editedBy || "Owner",
                reason: record.reason || "",
                changes: Array.isArray(record.changes) ? record.changes : [],
                edited_at: record.at || record.editedAt || new Date().toISOString(),
              },
              { onConflict: "id" },
            ),
            2500,
          ).catch(() => {});
        }
      }
      emitSyncEvent({ topic: "inventory", key: "inward_grns" });
      return res.json({ success: true, id });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Failed to log GRN edit" });
    }
  });

  app.delete("/api/grns/:id", async (req, res) => {
    try {
      const { id } = req.params;
      if (isSupabaseAvailable()) {
        await withSupabaseTimeout(
          supabase.from("grns").delete().eq("id", id),
          2500,
        ).catch(() => {});
        await withSupabaseTimeout(
          supabase
            .from("inventory_batches")
            .delete()
            .like("id", `batch_${id}_%`),
          2500,
        ).catch(() => {});
      }

      const existing = await getCollectionData("inward_grns");
      if (Array.isArray(existing)) {
        const filtered = existing.filter(
          (g: any) => String(g.id) !== String(id),
        );
        await setCollectionData("inward_grns", filtered);
      }
      await addTombstone("deleted_grn_ids", String(id));
      emitSyncEvent({ topic: "inventory", key: "inward_grns" });
      emitSyncEvent({ topic: "deletions" });
      return res.json({ success: true, id });
    } catch (err: any) {
      console.error("Error in DELETE /api/grns:", err);
      return res
        .status(500)
        .json({ error: err.message || "Failed to delete GRN" });
    }
  });

  // 3. INVENTORY ITEMS ROUTES (PostgreSQL public.inventory_items)
  app.get("/api/inventory", async (_req, res) => {
    try {
      const { data: items, error } = isSupabaseAvailable()
        ? ((await withSupabaseTimeout(
            supabase
              .from("inventory_items")
              .select("*")
              .order("updated_at", { ascending: false }),
            2500,
          )) as any)
        : { data: null, error: null };

      if (!error && Array.isArray(items)) {
        return res.json({ success: true, data: items });
      }

      let colInv = await getCollectionData("inventory_items");
      if (!Array.isArray(colInv) || colInv.length === 0) {
        colInv = await getCollectionData("inventory");
      }

      if (Array.isArray(colInv) && colInv.length > 0) {
        return res.json({ success: true, data: colInv });
      }

      const { data: batches, error: batchErr } = isSupabaseAvailable()
        ? ((await withSupabaseTimeout(
            supabase.from("inventory_batches").select("*"),
            2500,
          )) as any)
        : { data: null, error: null };
      if (!batchErr && Array.isArray(batches) && batches.length > 0) {
        const mapped = batches.map((b) => ({
          id: b.id,
          product_id: String(b.product_id),
          stock_on_hand: b.quantity || 0,
          reserved_stock: 0,
          reorder_level: 10,
          warehouse_id: b.warehouse_id,
          batch_number: b.batch_number,
          mfg_date: b.mfg_date,
          expiry_date: b.expiry_date,
          unit_cost: b.cost_price || 0,
          updated_at: b.updated_at || new Date().toISOString(),
        }));
        return res.json({ success: true, data: mapped });
      }

      return res.json({ success: true, data: [] });
    } catch (err: any) {
      console.error("Error in GET /api/inventory:", err);
      return res
        .status(500)
        .json({ error: err.message || "Failed to fetch inventory", data: [] });
    }
  });

  app.post("/api/inventory/import", async (req, res) => {
    try {
      const { items, replaceAll } = req.body;
      const itemsList = Array.isArray(items) ? items : [];

      const formattedItems = itemsList.map((item: any, idx: number) => ({
        id: String(item.id || `inv_${Date.now()}_${idx}`),
        product_id: String(
          item.sku ||
            item.product_sku ||
            item.product_id ||
            item.productId ||
            item.id,
        ),
        stock_on_hand: Number(
          item.stock_on_hand ?? item.stockOnHand ?? item.quantity ?? 0,
        ),
        reserved_stock: Number(
          item.reserved_stock ?? item.reservedStock ?? 0,
        ),
        reorder_level: Number(item.reorder_level ?? item.reorderLevel ?? 10),
        warehouse_id: item.warehouse_id || item.warehouseId || null,
        warehouse_name: item.warehouse_name || item.warehouseName || null,
        warehouse_bay: item.warehouse_bay || item.warehouseBay || null,
        batch_number: item.batch_number || item.batchNumber || null,
        mfg_date: item.mfg_date || item.mfgDate || null,
        expiry_date: item.expiry_date || item.expiryDate || null,
        unit_cost: Number(item.unit_cost ?? item.unitCost ?? item.cost ?? 0),
        selling_scheme: item.selling_scheme || item.sellingScheme || null,
        selling_scheme_discount: Number(
          item.selling_scheme_discount ?? item.sellingSchemeDiscount ?? 0,
        ),
        selling_scheme_label:
          item.selling_scheme_label || item.sellingSchemeLabel || null,
        last_restocked:
          item.last_restocked ||
          item.lastRestocked ||
          new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      let savedToTable = false;
      if (isSupabaseAvailable()) {
        if (replaceAll) {
          const { error: delErr } = (await withSupabaseTimeout(
            supabase
              .from("inventory_items")
              .delete()
              .neq("id", "___NEVER_MATCH___"),
            2500,
          )) as any;
          if (!delErr) {
            if (formattedItems.length > 0) {
              const { error: insErr } = (await withSupabaseTimeout(
                supabase.from("inventory_items").insert(formattedItems),
                2500,
              )) as any;
              if (!insErr) savedToTable = true;
            } else {
              savedToTable = true;
            }
          }
        } else {
          if (formattedItems.length > 0) {
            const { error: upErr } = (await withSupabaseTimeout(
              supabase
                .from("inventory_items")
                .upsert(formattedItems, { onConflict: "id" }),
              2500,
            )) as any;
            if (!upErr) savedToTable = true;
          } else {
            savedToTable = true;
          }
        }
      }

      if (replaceAll) {
        await setCollectionData("inventory_items", formattedItems);
      } else {
        const existing = await getCollectionData("inventory_items");
        const list = Array.isArray(existing) ? existing : [];
        const map = new Map<string, any>();
        for (const ex of list) map.set(String(ex.id), ex);
        for (const it of formattedItems) map.set(String(it.id), it);
        await setCollectionData("inventory_items", Array.from(map.values()));
      }
      emitSyncEvent({ topic: "inventory", key: "inventory_items" });

      return res.json({
        success: true,
        count: formattedItems.length,
        savedToTable,
        message: `Imported ${formattedItems.length} inventory items to Supabase`,
      });
    } catch (err: any) {
      console.error("Error importing inventory:", err);
      return res
        .status(500)
        .json({ error: err.message || "Failed to import inventory" });
    }
  });

  app.put("/api/inventory/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = {
        ...req.body,
        updated_at: new Date().toISOString(),
      };

      if (isSupabaseAvailable()) {
        await withSupabaseTimeout(
          supabase.from("inventory_items").update(updates).eq("id", id),
          2500,
        ).catch(() => {});
      }

      const existing = await getCollectionData("inventory_items");
      if (Array.isArray(existing)) {
        const updated = existing.map((item: any) =>
          String(item.id) === String(id) ? { ...item, ...updates } : item,
        );
        await setCollectionData("inventory_items", updated);
      }
      emitSyncEvent({ topic: "inventory", key: "inventory_items" });

      return res.json({ success: true, id, updates });
    } catch (err: any) {
      console.error("Error updating inventory item:", err);
      return res
        .status(500)
        .json({ error: err.message || "Failed to update inventory item" });
    }
  });

  // PRODUCTS & BATCHES ROUTES (PostgreSQL public.products and public.inventory_batches)
  app.get("/api/products", async (_req, res) => {
    try {
      const { data: prods, error } = isSupabaseAvailable()
        ? ((await withSupabaseTimeout(
            supabase
              .from("products")
              .select("*")
              .order("id", { ascending: true }),
            2500,
          )) as any)
        : { data: null, error: null };

      if (!error && Array.isArray(prods) && prods.length > 0) {
        const formatted = prods.map((r: any) => {
          const detectedVol = volumeFromName(r.name);
          const vol =
            Number(r.volume) > 0 ? Number(r.volume) : detectedVol || 150;
          const pack =
            r.pack && r.pack.trim() !== "" && r.pack !== "pcs"
              ? r.pack
              : detectPack(r.name);
          return applyProductExtra(
            {
              id: Number(r.id),
              sku: r.sku || `PRD-${r.id}`,
              name: String(r.name || "")
                .trim()
                .toUpperCase(),
              category: r.category,
              volume: vol,
              pack,
              expiry: r.expiry || "",
              batchNumber: r.batch_number || "",
              mfgDate: r.mfg_date || "",
              warehouseId: r.warehouse_id || "",
              opening: Number(r.opening || 0),
              cost: Number(r.cost || 0),
              effectiveCost: Number(r.effective_cost || r.cost || 0),
              retail: Number(r.retail || 0),
              wholesale: Number(r.wholesale || 0),
              hsn: r.hsn || "2202",
              gstRate:
                r.gst_rate !== undefined && r.gst_rate !== null
                  ? Number(r.gst_rate)
                  : 0.18,
              scheme: r.scheme || "",
              updatedAt: r.updated_at || undefined,
            },
            r.extra,
          );
        });

        const prodsNeedingUpdate = prods.filter(
          (r: any) =>
            (r.name && r.name !== String(r.name).trim().toUpperCase()) ||
            !r.volume ||
            Number(r.volume) <= 0,
        );
        if (prodsNeedingUpdate.length > 0) {
          Promise.all(
            prodsNeedingUpdate.map((p: any) =>
              supabase
                .from("products")
                .update({
                  name: String(p.name).trim().toUpperCase(),
                  volume:
                    Number(p.volume) > 0
                      ? Number(p.volume)
                      : volumeFromName(p.name) || 150,
                  pack:
                    p.pack && p.pack.trim() !== "" && p.pack !== "pcs"
                      ? p.pack
                      : detectPack(p.name),
                  updated_at: new Date().toISOString(),
                })
                .eq("id", p.id),
            ),
          ).catch((e) => console.warn("Background product sync warning:", e));
        }

        return res.json({ success: true, data: formatted });
      }

      const colProds = await getCollectionData("products");
      const normalizedColProds = (
        Array.isArray(colProds) ? colProds : []
      ).map((p: any) => {
        const detectedVol = volumeFromName(p.name);
        const vol = Number(p.volume) > 0 ? Number(p.volume) : detectedVol || 150;
        const pack =
          p.pack && p.pack.trim() !== "" && p.pack !== "pcs"
            ? p.pack
            : detectPack(p.name);
        return {
          ...p,
          name: String(p.name || "")
            .trim()
            .toUpperCase(),
          volume: vol,
          pack,
        };
      });
      return res.json({
        success: true,
        data: normalizedColProds,
      });
    } catch (err: any) {
      console.error("Error in GET /api/products:", err);
      return res
        .status(500)
        .json({ error: err.message || "Failed to fetch products", data: [] });
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      const { products } = req.body;
      const prodsList = Array.isArray(products)
        ? products
        : req.body
          ? [req.body]
          : [];
      if (prodsList.length === 0) {
        return res.json({ success: true, count: 0 });
      }

      const payload = prodsList.map((p: any) => {
        const detectedVol = volumeFromName(p.name);
        const vol =
          Number(p.volume) > 0 ? Number(p.volume) : detectedVol || 150;
        const pack =
          p.pack && p.pack.trim() !== "" && p.pack !== "pcs"
            ? p.pack
            : detectPack(p.name);
        return {
          id: Number(p.id),
          sku: String(p.sku || `PRD-${p.id}`),
          name: String(p.name || "")
            .trim()
            .toUpperCase(),
          category: String(p.category || "energy"),
          volume: vol,
          pack,
          expiry: String(p.expiry || ""),
          batch_number: String(p.batchNumber || p.batch_number || ""),
          mfg_date: String(p.mfgDate || p.mfg_date || ""),
          warehouse_id: String(p.warehouseId || p.warehouse_id || ""),
          opening: Number(p.opening || 0),
          cost: Number(p.cost || 0),
          effective_cost: Number(
            p.effectiveCost || p.effective_cost || p.cost || 0,
          ),
          retail: Number(p.retail || 0),
          wholesale: Number(p.wholesale || 0),
          hsn: String(p.hsn || "2202"),
          gst_rate: Number(p.gstRate !== undefined ? p.gstRate : 0.18),
          scheme: String(p.scheme || ""),
          updated_at: String(
            p.updatedAt || p.updated_at || new Date().toISOString(),
          ),
        };
      });

      if (isSupabaseAvailable()) {
        let { error } = (await withSupabaseTimeout(
          supabase.from("products").upsert(
            payload.map((row: any, i: number) => {
              const extra = productExtraFields(prodsList[i]);
              return extra ? { ...row, extra } : row;
            }),
            { onConflict: "id" },
          ),
          2500,
        )) as any;
        if (error) {
          ({ error } = (await withSupabaseTimeout(
            supabase.from("products").upsert(payload, { onConflict: "id" }),
            2500,
          )) as any);
        }
        if (error) {
          const fallback = payload.map(
            ({
              sku: _s,
              batch_number: _b,
              mfg_date: _m,
              effective_cost: _e,
              hsn: _h,
              gst_rate: _g,
              scheme: _sc,
              ...rest
            }: any) => rest,
          );
          await withSupabaseTimeout(
            supabase.from("products").upsert(fallback, { onConflict: "id" }),
            2500,
          ).catch(() => {});
        }
      }

      const normalizedProdsList = prodsList.map((p: any) => {
        const detectedVol = volumeFromName(p.name);
        const vol =
          Number(p.volume) > 0 ? Number(p.volume) : detectedVol || 150;
        const pack =
          p.pack && p.pack.trim() !== "" && p.pack !== "pcs"
            ? p.pack
            : detectPack(p.name);
        return {
          ...p,
          volume: vol,
          pack,
        };
      });
      if (Array.isArray(products)) {
        await setCollectionData("products", normalizedProdsList);
      } else {
        const cur = await getCollectionData("products");
        const curList = Array.isArray(cur) ? cur : [];
        const byId = new Map<number, any>();
        for (const it of curList) byId.set(Number(it.id), it);
        for (const it of normalizedProdsList) byId.set(Number(it.id), it);
        await setCollectionData("products", Array.from(byId.values()));
      }
      emitSyncEvent({ topic: "products" });
      return res.json({ success: true, count: payload.length });
    } catch (err: any) {
      console.error("Error in POST /api/products:", err);
      return res
        .status(500)
        .json({ error: err.message || "Failed to save products" });
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isSupabaseAvailable()) {
        await withSupabaseTimeout(
          supabase.from("products").delete().eq("id", id),
          2500,
        ).catch(() => {});
      }
      const existing = await getCollectionData("products");
      if (Array.isArray(existing)) {
        await setCollectionData(
          "products",
          existing.filter((p: any) => Number(p.id) !== id),
        );
      }
      emitSyncEvent({ topic: "products" });
      return res.json({ success: true, id });
    } catch (err: any) {
      return res
        .status(500)
        .json({ error: err.message || "Failed to delete product" });
    }
  });

  app.get("/api/batches", async (_req, res) => {
    try {
      const { data: batches, error } = isSupabaseAvailable()
        ? ((await withSupabaseTimeout(
            supabase.from("inventory_batches").select("*"),
            2500,
          )) as any)
        : { data: null, error: null };
      if (!error && Array.isArray(batches) && batches.length > 0) {
        const formatted = batches.map((r: any) => ({
          id: String(r.id),
          productId: Number(r.product_id),
          sku: r.sku || "",
          batchNumber: r.batch_number || "",
          mfgDate: r.mfg_date || "",
          expiryDate: r.expiry_date || "",
          warehouseId: r.warehouse_id || "",
          quantity: Number(r.quantity || 0),
          costPrice: Number(r.cost_price || 0),
          mrp: Number(r.mrp || 0),
          scheme: r.scheme || "",
          effectiveCostPrice: Number(r.effective_cost_price || 0),
          notes: r.notes || "",
        }));
        return res.json({ success: true, data: formatted });
      }

      const colBatches = await getCollectionData("inventory_batches");
      return res.json({
        success: true,
        data: Array.isArray(colBatches) ? colBatches : [],
      });
    } catch (err: any) {
      console.error("Error in GET /api/batches:", err);
      return res
        .status(500)
        .json({ error: err.message || "Failed to fetch batches", data: [] });
    }
  });

  app.post("/api/batches", async (req, res) => {
    try {
      const { batches } = req.body;
      const batchList = Array.isArray(batches)
        ? batches
        : req.body
          ? [req.body]
          : [];
      if (batchList.length === 0) {
        return res.json({ success: true, count: 0 });
      }

      const payload = batchList.map((b: any) => ({
        id: String(b.id),
        product_id: Number(b.productId || b.product_id),
        sku: String(b.sku || ""),
        batch_number: String(b.batchNumber || b.batch_number || ""),
        mfg_date: b.mfgDate || b.mfg_date || null,
        expiry_date: b.expiryDate || b.expiry_date || null,
        warehouse_id: String(b.warehouseId || b.warehouse_id || ""),
        quantity: Number(b.quantity || 0),
        cost_price: Number(b.costPrice || b.cost_price || 0),
        mrp: Number(b.mrp || 0),
        scheme: String(b.scheme || ""),
        effective_cost_price: Number(
          b.effectiveCostPrice || b.effective_cost_price || 0,
        ),
        notes: String(b.notes || ""),
        updated_at: new Date().toISOString(),
      }));

      if (isSupabaseAvailable()) {
        const { error } = (await withSupabaseTimeout(
          supabase
            .from("inventory_batches")
            .upsert(payload, { onConflict: "id" }),
          2500,
        )) as any;
        if (error) {
          const fallback = payload.map(({ sku: _s, ...rest }: any) => rest);
          await withSupabaseTimeout(
            supabase
              .from("inventory_batches")
              .upsert(fallback, { onConflict: "id" }),
            2500,
          ).catch(() => {});
        }
      }

      if (Array.isArray(batches)) {
        await setCollectionData("inventory_batches", batchList);
      } else {
        const cur = await getCollectionData("inventory_batches");
        const curList = Array.isArray(cur) ? cur : [];
        const byId = new Map<string, any>();
        for (const it of curList) byId.set(String(it.id), it);
        for (const it of batchList) byId.set(String(it.id), it);
        await setCollectionData("inventory_batches", Array.from(byId.values()));
      }
      emitSyncEvent({ topic: "batches" });
      return res.json({ success: true, count: payload.length });
    } catch (err: any) {
      console.error("Error in POST /api/batches:", err);
      return res
        .status(500)
        .json({ error: err.message || "Failed to save batches" });
    }
  });

  app.delete("/api/batches/:id", async (req, res) => {
    try {
      const { id } = req.params;
      if (isSupabaseAvailable()) {
        await withSupabaseTimeout(
          supabase.from("inventory_batches").delete().eq("id", id),
          2500,
        ).catch(() => {});
      }
      const existing = await getCollectionData("inventory_batches");
      if (Array.isArray(existing)) {
        await setCollectionData(
          "inventory_batches",
          existing.filter((b: any) => String(b.id) !== String(id)),
        );
      }
      emitSyncEvent({ topic: "batches" });
      return res.json({ success: true, id });
    } catch (err: any) {
      return res
        .status(500)
        .json({ error: err.message || "Failed to delete batch" });
    }
  });
}
