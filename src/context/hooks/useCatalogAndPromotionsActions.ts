import React from "react";
import { CATS } from "../../constants/initialData";
import {
  deleteBatchFromSupabase,
  deleteProductFromSupabase,
  deletePromotionFromSupabase,
  pushProductToSupabase,
  pushPromotionToSupabase,
} from "../../lib/supabase";
import type {
  CategoryKey,
  ImportRow,
  InventoryBatch,
  Product,
  Promotion,
  Taxability,
  Warehouse,
} from "../../types";
import {
  generateBatchNumber,
  generateSkuId,
  gstRateFromHsn,
  normalizeTo8DigitHsn,
  productTaxFields,
} from "../../utils/billing";
import { todayISO } from "../../utils/dateLocal";
import { saveInventoryBatches, saveProducts, saveSchemes } from "../../utils/storage";
import { cloud, cloudFetch, extractPromoProductIds, reserveDocNumber } from "../ledgerHelpers";
import type { InwardStockParams } from "../ledgerTypes";

export interface UseCatalogAndPromotionsActionsParams {
  products: Product[];
  productsRef: React.MutableRefObject<Product[]>;
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  inventoryBatches: InventoryBatch[];
  setInventoryBatches: React.Dispatch<React.SetStateAction<InventoryBatch[]>>;
  warehouses: Warehouse[];
  defaultWarehouse?: Warehouse;
  promotions: Promotion[];
  setPromotions: React.Dispatch<React.SetStateAction<Promotion[]>>;
  logDeletion: (kind: "product" | "batch" | "warehouse" | "audit" | "promotion" | "salesman", id: string, name?: string) => void;
  productDeletionKey: (p: { id: number; name?: string }) => string;
}

export function useCatalogAndPromotionsActions({
  products,
  productsRef,
  setProducts,
  inventoryBatches,
  setInventoryBatches,
  warehouses,
  defaultWarehouse,
  promotions,
  setPromotions,
  logDeletion,
  productDeletionKey,
}: UseCatalogAndPromotionsActionsParams) {
  function addProduct(p: Omit<Product, "id">) {
    const newId = reserveDocNumber("product", products.length ? Math.max(...products.map((x) => x.id)) : 0);
    const skuCode =
      p.sku && p.sku.trim()
        ? p.sku.trim().toUpperCase()
        : generateSkuId(p.name, p.category, newId);
    const batchNum =
      p.batchNumber && p.batchNumber.trim()
        ? p.batchNumber.trim().toUpperCase()
        : generateBatchNumber(p.name, p.scheme ? "SCH" : undefined);

    const assignedWh =
      p.warehouseId ||
      (defaultWarehouse ? defaultWarehouse.id : warehouses[0]?.id || "");
    const newProd: Product = {
      ...p,
      name: String(p.name || "").trim().toUpperCase(),
      id: newId,
      sku: skuCode,
      batchNumber: batchNum,
      warehouseId: assignedWh,
      expiry: p.expiry || "2026-12-31",
      ...productTaxFields(p),
      updatedAt: new Date().toISOString(),
    };
    setProducts((prev) => [...prev, newProd]);
    cloud("pushProductToSupabase", pushProductToSupabase(newProd));

    const batchId =
      "batch_" +
      Date.now().toString(36) +
      Math.random().toString(36).slice(2, 6);
    const newBatch: InventoryBatch = {
      id: batchId,
      productId: newId,
      sku: skuCode,
      batchNumber: batchNum,
      mfgDate: p.mfgDate,
      expiryDate: p.expiry || "2026-12-31",
      warehouseId: assignedWh,
      quantity: p.opening || 0,
      costPrice: p.cost,
      mrp: p.retail,
      scheme: p.scheme,
      effectiveCostPrice: p.effectiveCost || p.cost,
      landedCostPerCrate: newProd.landedCostPerCrate,
      hsn: newProd.hsn,
      cgstRate: newProd.taxability === "non_gst" ? 0 : undefined,
      sgstRate: newProd.taxability === "non_gst" ? 0 : undefined,
      notes: p.scheme
        ? `Registered with scheme: ${p.scheme}`
        : "Opening stock batch",
    };
    setInventoryBatches((prev) => [...prev, newBatch]);
  }

  function updateProductField(
    id: number,
    field: keyof Product,
    value: number | string | boolean,
  ) {
    const current = productsRef.current;
    const target = current.find((p) => p.id === id);
    if (!target) return;
    const mod = {
      ...target,
      [field]:
        field === "name"
          ? String(value || "").trim().toUpperCase()
          : typeof target[field] === "number" && typeof value !== "boolean"
            ? Number(value)
            : value,
      updatedAt: new Date().toISOString(),
    } as Product;
    const next = current.map((p) => (p.id === id ? mod : p));
    productsRef.current = next;
    setProducts(next);
    cloud("pushProductToSupabase", pushProductToSupabase(mod));
  }

  function updateProductFields(id: number, patch: Partial<Omit<Product, "id">>) {
    const current = productsRef.current;
    const target = current.find((p) => p.id === id);
    if (!target) return;
    const clean: Partial<Product> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      (clean as any)[k] = k === "name" ? String(v || "").trim().toUpperCase() : v;
    }
    const mod = { ...target, ...clean, updatedAt: new Date().toISOString() } as Product;
    const next = current.map((p) => (p.id === id ? mod : p));
    productsRef.current = next;
    setProducts(next);
    cloud("pushProductToSupabase", pushProductToSupabase(mod));
  }

  function bulkSetProductTaxability(productIds: number[], taxability: Taxability): number {
    const idSet = new Set(productIds.map(Number));
    if (idSet.size === 0) return 0;
    const now = new Date().toISOString();
    const current = productsRef.current;
    const modified: Product[] = [];
    const next = current.map((p) => {
      if (!idSet.has(Number(p.id))) return p;
      let mod: Product;
      if (taxability === "non_gst") {
        mod = {
          ...p,
          taxability: "non_gst",
          gstRate: 0,
          ratesIncludeGst: false,
          updatedAt: now,
        };
      } else {
        const hsn = normalizeTo8DigitHsn(p.hsn, p.category, p.name, "taxable");
        const gstRate =
          p.gstRate && Number(p.gstRate) > 0
            ? Number(p.gstRate)
            : (gstRateFromHsn(hsn) ?? CATS[p.category]?.gst ?? 0.18);
        mod = {
          ...p,
          taxability: "taxable",
          hsn,
          gstRate,
          updatedAt: now,
        };
      }
      modified.push(mod);
      return mod;
    });
    if (modified.length === 0) return 0;
    productsRef.current = next;
    setProducts(next);
    modified.forEach((m) => cloud("pushProductToSupabase", pushProductToSupabase(m)));
    return modified.length;
  }

  function deleteProduct(id: number) {
    const doomed = products.find((p) => p.id === id);
    if (doomed) logDeletion("product", productDeletionKey(doomed), doomed.name);
    const remainingProducts = products.filter((p) => p.id !== id);
    const removedBatches = inventoryBatches.filter((b) => b.productId === id);
    const remainingBatches = inventoryBatches.filter((b) => b.productId !== id);
    setProducts(remainingProducts);
    setInventoryBatches(remainingBatches);
    cloud("deleteProductFromSupabase", deleteProductFromSupabase(id));
    removedBatches.forEach((b) => {
      logDeletion("batch", b.id);
      cloud("deleteBatchFromSupabase", deleteBatchFromSupabase(b.id));
    });
    saveProducts(remainingProducts);
    saveInventoryBatches(remainingBatches);
  }

  function applyBulkImport(rows: ImportRow[]) {
    let nextId = products.length
      ? Math.max(...products.map((x) => x.id)) + 1
      : 1;
    const newItems: Product[] = [];
    const newBatches: InventoryBatch[] = [];
    const assignedWh = defaultWarehouse
      ? defaultWarehouse.id
      : warehouses[0]?.id || "";

    const updated = products.map((existing) => {
      const match = rows.find(
        (r) => r.name.toLowerCase() === existing.name.toLowerCase(),
      );
      if (match) {
        const batchNum =
          match.batchNumber && match.batchNumber.trim()
            ? match.batchNumber.trim().toUpperCase()
            : existing.batchNumber ||
              generateBatchNumber(match.name, match.scheme ? "SCH" : undefined);
        const skuCode =
          match.sku && match.sku.trim()
            ? match.sku.trim().toUpperCase()
            : existing.sku ||
              generateSkuId(existing.name, existing.category, existing.id);
        return {
          ...existing,
          sku: skuCode,
          opening: existing.opening + match.opening,
          cost: match.cost || existing.cost,
          retail: match.retail || existing.retail,
          wholesale: match.wholesale || existing.wholesale,
          expiry: match.expiry || existing.expiry,
          hsn: match.hsn ?? existing.hsn,
          taxability: match.taxability === "non_gst" ? "non_gst" : existing.taxability,
          gstRate: match.taxability === "non_gst" || existing.taxability === "non_gst" ? 0 : existing.gstRate,
          labourCost: match.labourCost ?? existing.labourCost,
          freightCost: match.freightCost ?? existing.freightCost,
          batchNumber: batchNum,
          scheme: match.scheme || existing.scheme,
        };
      }
      return existing;
    });

    for (const r of rows) {
      if (!updated.some((p) => p.name.toLowerCase() === r.name.toLowerCase())) {
        const batchNum =
          r.batchNumber && r.batchNumber.trim()
            ? r.batchNumber.trim().toUpperCase()
            : generateBatchNumber(r.name, r.scheme ? "SCH" : undefined);
        const prodId = nextId++;
        const skuCode =
          r.sku && r.sku.trim()
            ? r.sku.trim().toUpperCase()
            : generateSkuId(r.name, r.category, prodId);
        const isNonGstImport = r.taxability === "non_gst";
        const extraLanded = (Number(r.labourCost) || 0) + (Number(r.freightCost) || 0);
        const landedCost = r.cost > 0 ? Math.round((r.cost + extraLanded) * 100) / 100 : undefined;

        newItems.push({
          id: prodId,
          sku: skuCode,
          name: r.name.trim().toUpperCase(),
          category: r.category,
          volume: r.volume,
          pack: r.pack,
          expiry: r.expiry || "2026-12-31",
          opening: r.opening,
          cost: r.cost,
          effectiveCost: landedCost,
          landedCostPerCrate: landedCost,
          labourCost: r.labourCost,
          freightCost: r.freightCost,
          retail: r.retail,
          wholesale: r.wholesale,
          taxability: isNonGstImport ? "non_gst" : undefined,
          gstRate: isNonGstImport ? 0 : undefined,
          hsn: normalizeTo8DigitHsn(r.hsn, r.category, r.name, r.taxability),
          batchNumber: batchNum,
          scheme: r.scheme,
          warehouseId: assignedWh,
        });

        if (r.opening > 0) {
          newBatches.push({
            id:
              "batch_" +
              Date.now().toString(36) +
              Math.random().toString(36).slice(2, 6) +
              prodId,
            productId: prodId,
            sku: skuCode,
            batchNumber: batchNum,
            expiryDate: r.expiry || "2026-12-31",
            warehouseId: assignedWh,
            quantity: r.opening,
            costPrice: r.cost,
            effectiveCostPrice: landedCost || r.cost,
            landedCostPerCrate: landedCost,
            mrp: r.retail,
            scheme: r.scheme,
            cgstRate: isNonGstImport ? 0 : undefined,
            sgstRate: isNonGstImport ? 0 : undefined,
            hsn: normalizeTo8DigitHsn(r.hsn, r.category, r.name, r.taxability),
            notes: "Imported spreadsheet batch",
          });
        }
      }
    }

    setProducts([...updated, ...newItems]);
    if (newBatches.length > 0) {
      setInventoryBatches((prev) => [...prev, ...newBatches]);
    }
  }

  function receiveInwardStock(
    params: InwardStockParams,
  ): { productId: number; batchId: string } | undefined {
    let product = params.productId
      ? products.find((p) => p.id === params.productId)
      : undefined;
    if (!product && params.newProductName) {
      const matchExisting = products.find(
        (p) =>
          p.name.trim().toLowerCase() ===
          params.newProductName!.trim().toLowerCase(),
      );
      if (matchExisting) {
        product = matchExisting;
      }
    }

    const billedQty = Math.max(0, Number(params.billedQuantity) || 0);
    const freeQty = Math.max(0, Number(params.freeQuantity) || 0);
    const totalQty = billedQty + freeQty;

    const assignedWh =
      params.warehouseId ||
      product?.warehouseId ||
      (defaultWarehouse ? defaultWarehouse.id : warehouses[0]?.id || "");
    const exp = params.expiryDate || product?.expiry || "2026-12-31";

    let targetProductId = product ? product.id : 0;
    let targetSku = product?.sku || params.sku || "";

    if (!product && params.newProductName) {
      targetProductId = products.length
        ? Math.max(...products.map((x) => x.id)) + 1
        : 1;
      const catKey: CategoryKey = params.category || "energy";
      const catDef = CATS[catKey] || {
        name: "General",
        hsn: "22029990",
        gst: 0.18,
      };
      targetSku =
        params.sku ||
        generateSkuId(params.newProductName, catKey, targetProductId);
      const batchCode =
        params.batchNumber && params.batchNumber.trim()
          ? params.batchNumber.trim().toUpperCase()
          : generateBatchNumber(
              params.newProductName,
              params.scheme ? "SCH" : undefined,
            );

      const unitCost = Number(params.costPrice) || 158.57;
      const unitWholesale =
        Number(params.wholesaleRate) || Math.round(unitCost * 1.1);
      const unitRetail =
        Number(params.retailRate) || Math.round(unitCost * 1.25);
      const effectiveCost =
        totalQty > 0 ? (billedQty * unitCost) / totalQty : unitCost;

      const newProduct: Product = {
        id: targetProductId,
        sku: targetSku,
        name: params.newProductName.trim().toUpperCase(),
        category: catKey,
        volume: params.volume || 150,
        pack: params.pack || "PET",
        opening: totalQty,
        cost: unitCost,
        wholesale: unitWholesale,
        retail: unitRetail,
        effectiveCost,
        expiry: exp,
        mfgDate: params.mfgDate,
        batchNumber: batchCode,
        warehouseId: assignedWh,
        hsn:
          params.taxability === "non_gst"
            ? String(params.hsn || "").trim()
            : normalizeTo8DigitHsn(params.hsn || catDef.hsn, catKey, params.newProductName, params.taxability),
        taxability: params.taxability || "taxable",
        gstRate:
          params.taxability === "non_gst"
            ? 0
            : gstRateFromHsn(normalizeTo8DigitHsn(params.hsn || catDef.hsn, catKey, params.newProductName, params.taxability)) ??
              (params.gstRate !== undefined ? params.gstRate : catDef.gst),
        ...(params.taxability === "non_gst" ? { ratesIncludeGst: false } : {}),
        scheme: params.scheme,
      };

      setProducts((prev) => [...prev, newProduct]);
      product = newProduct;
    } else if (product) {
      targetProductId = product.id;
      targetSku =
        product.sku ||
        generateSkuId(product.name, product.category, product.id);
      const cost =
        params.costPrice !== undefined
          ? Number(params.costPrice)
          : product.cost;
      const effectiveCost = totalQty > 0 ? (billedQty * cost) / totalQty : cost;
      const batchNum =
        params.batchNumber && params.batchNumber.trim()
          ? params.batchNumber.trim().toUpperCase()
          : generateBatchNumber(
              product.name,
              params.scheme ? "SCH" : undefined,
            );

      setProducts((prev) =>
        prev.map((p) => {
          if (p.id === targetProductId) {
            return {
              ...p,
              opening: p.opening + totalQty,
              batchNumber: batchNum,
              sku: p.sku || targetSku,
              expiry: exp,
              cost: cost,
              effectiveCost: effectiveCost,
              scheme: params.scheme || p.scheme,
              warehouseId: assignedWh,
              wholesale:
                params.wholesaleRate !== undefined
                  ? Number(params.wholesaleRate)
                  : p.wholesale,
              retail:
                params.retailRate !== undefined
                  ? Number(params.retailRate)
                  : p.retail,
            };
          }
          return p;
        }),
      );
    } else {
      return undefined;
    }

    const finalBatchNumber =
      params.batchNumber && params.batchNumber.trim()
        ? params.batchNumber.trim().toUpperCase()
        : generateBatchNumber(
            product?.name || params.newProductName || "LOT",
            params.scheme ? "SCH" : undefined,
          );

    const cost = Number(params.costPrice) || (product ? product.cost : 158.57);
    const effectiveCost = totalQty > 0 ? (billedQty * cost) / totalQty : cost;

    const batchId =
      "batch_" +
      Date.now().toString(36) +
      Math.random().toString(36).slice(2, 6);
    const newBatch: InventoryBatch = {
      id: batchId,
      productId: targetProductId,
      sku: targetSku,
      batchNumber: finalBatchNumber,
      supplierInvoiceNo: params.supplierInvoiceNo,
      supplierName: params.supplierName,
      inwardDate: params.inwardDate || todayISO(),
      mfgDate: params.mfgDate,
      expiryDate: exp,
      warehouseId: assignedWh,
      quantity: totalQty,
      costPrice: cost,
      mrp: params.retailRate || (product ? product.retail : 190),
      scheme: params.scheme,
      billedQuantity: billedQty,
      freeQuantity: freeQty,
      effectiveCostPrice: effectiveCost,
      notes:
        params.notes ||
        (params.scheme
          ? `Inward scheme: ${params.scheme}`
          : "Inward stock receipt"),
      cgstRate: params.cgstRate,
      sgstRate: params.sgstRate,
      hsn: params.hsn || product?.hsn,
    };
    setInventoryBatches((prev) => [...prev, newBatch]);

    return { productId: targetProductId, batchId };
  }

  // Promotions CRUD
  function addPromotion(promo: Omit<Promotion, "id">) {
    const nextId = reserveDocNumber(
      "promotion",
      promotions.length ? Math.max(...promotions.map((p) => Number(p.id) || 0)) : 0,
    );
    const cleanProductIds = extractPromoProductIds(promo);
    const newPromo: Promotion = {
      ...promo,
      id: nextId,
      productIds: cleanProductIds,
      isActive: promo.isActive !== false,
    };
    setPromotions((prev) => {
      const updated = [...prev, newPromo];
      saveSchemes(updated as any).catch(() => {});
      return updated;
    });
    cloud("pushPromotionToSupabase", pushPromotionToSupabase(newPromo));
    cloudFetch("/api/schemes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newPromo),
    });
  }

  function updatePromotion(id: number, promo: Omit<Promotion, "id">) {
    const targetId = Number(id);
    const cleanProductIds = extractPromoProductIds(promo);
    const updatedPromo: Promotion = {
      ...promo,
      id: targetId,
      productIds: cleanProductIds,
      isActive: promo.isActive !== false,
    };
    setPromotions((prev) => {
      const updated = prev.map((p) =>
        Number(p.id) === targetId ? updatedPromo : p,
      );
      saveSchemes(updated as any).catch(() => {});
      return updated;
    });
    cloud("pushPromotionToSupabase", pushPromotionToSupabase(updatedPromo));
    cloudFetch("/api/schemes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedPromo),
    });
  }

  function deletePromotion(id: number) {
    const targetId = Number(id);
    logDeletion("promotion", String(targetId));
    setPromotions((prev) => {
      const updated = prev.filter((p) => Number(p.id) !== targetId);
      saveSchemes(updated as any).catch(() => {});
      return updated;
    });
    try {
      const raw = localStorage.getItem("mrwater_cache_schemes");
      if (raw) {
        const parsed = JSON.parse(raw);
        const list = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.data)
            ? parsed.data
            : null;
        if (list) {
          const cleaned = list.filter((s: any) => Number(s?.id) !== targetId);
          localStorage.setItem(
            "mrwater_cache_schemes",
            JSON.stringify(cleaned),
          );
        }
      }
    } catch {
      /* ignore */
    }
    cloud("deletePromotionFromSupabase", deletePromotionFromSupabase(targetId));
    cloudFetch(`/api/schemes/${targetId}`, { method: "DELETE" });
  }

  return {
    addProduct,
    updateProductField,
    updateProductFields,
    bulkSetProductTaxability,
    deleteProduct,
    applyBulkImport,
    receiveInwardStock,
    addPromotion,
    updatePromotion,
    deletePromotion,
  };
}
