import React from "react";
import {
  deleteBatchFromSupabase,
  deleteGrnFromSupabase,
  deleteProductFromSupabase,
  deleteWarehouseFromSupabase,
  pushBatchToSupabase,
  pushGrnEditLogToSupabase,
  pushInwardInvoiceToSupabase,
  pushProductToSupabase,
  pushWarehouseToSupabase,
} from "../../lib/supabase";
import { costBasisFor } from "../../tax/purchaseCost";
import type {
  AuthUser,
  Bill,
  GRN,
  GrnEditRecord,
  InventoryBatch,
  OrganizationProfile,
  Product,
  StockTransfer,
  Warehouse,
} from "../../types";
import {
  generateAutoSku,
  generateBatchNumber,
  gstRateFromHsn,
  inferUnitsPerCase,
  normalizeTo8DigitHsn,
  resolveItemLandedCrateCost,
} from "../../utils/billing";
import { stockCrateCost } from "../../tax/purchaseCost";
import { GrnValidationError, grnErrors, validateGrnDraft, type GrnDraft } from "../../utils/stockLocations";
import { reportSyncFailure, reportSyncSuccess, saveGrns, saveInventoryBatches, saveProducts } from "../../utils/storage";
import { buildCatalogFromGrns, cloud, diffGrn, reserveDocNumber } from "../ledgerHelpers";

export interface UseGrnAndWarehouseActionsParams {
  grns: GRN[];
  setGrns: React.Dispatch<React.SetStateAction<GRN[]>>;
  activeGrnToEdit: GRN | null;
  setActiveGrnToEdit: React.Dispatch<React.SetStateAction<GRN | null>>;
  products: Product[];
  productsRef: React.MutableRefObject<Product[]>;
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  inventoryBatches: InventoryBatch[];
  inventoryBatchesRef: React.MutableRefObject<InventoryBatch[]>;
  setInventoryBatches: React.Dispatch<React.SetStateAction<InventoryBatch[]>>;
  warehouses: Warehouse[];
  setWarehouses: React.Dispatch<React.SetStateAction<Warehouse[]>>;
  setStockTransfers: React.Dispatch<React.SetStateAction<StockTransfer[]>>;
  bills: Bill[];
  orgProfile: OrganizationProfile;
  currentUser: AuthUser | null;
  warehouseStock: (warehouseId: string, productId?: number) => number;
  notify: (message: string) => void;
  logDeletion: (kind: "product" | "batch" | "warehouse" | "audit" | "promotion" | "salesman", id: string, name?: string) => void;
  productDeletionKey: (p: { id: number; name?: string }) => string;
  setSupabaseStatus: React.Dispatch<React.SetStateAction<{
    isConnected: boolean;
    isChecking: boolean;
    latencyMs: number;
    allTablesExist: boolean;
    lastSyncedAt: string | null;
    message: string;
    error: string | undefined;
  }>>;
}

export function useGrnAndWarehouseActions({
  grns,
  setGrns,
  activeGrnToEdit,
  setActiveGrnToEdit,
  products,
  productsRef,
  setProducts,
  inventoryBatches,
  inventoryBatchesRef,
  setInventoryBatches,
  warehouses,
  setWarehouses,
  setStockTransfers,
  bills,
  orgProfile,
  currentUser,
  warehouseStock,
  notify,
  logDeletion,
  productDeletionKey,
  setSupabaseStatus,
}: UseGrnAndWarehouseActionsParams) {
  const postGrn = (
    grnData: Omit<GRN, "id" | "grnNumber" | "createdAt" | "updatedAt">,
  ): GRN => {
    const draft: GrnDraft = {
      warehouseId: grnData.warehouseId,
      supplierName: grnData.supplierName,
      invoiceNo: grnData.invoiceNo,
      items: grnData.items.map((it) => ({
        productId: it.productId,
        productName: it.productName,
        qty: it.qty,
        freeQty: it.freeQty,
        schemeMode: it.schemeMode,
        unitPrice: it.unitPrice,
        discountAmount: it.discountAmount,
        batchNumber: it.batchNumber,
        expiry: it.expiry,
        mfgDate: it.mfgDate,
      })),
    };
    const issues = validateGrnDraft(draft, {
      warehouses,
      grns,
      existingBatches: inventoryBatches,
    });
    if (grnErrors(issues).length > 0) {
      throw new GrnValidationError(issues);
    }

    const year = new Date().getFullYear();
    const grnPrefix = `GRN-${year}-`;
    const highestGrnSeq = grns.reduce((m, g) => {
      const n =
        g.grnNumber && g.grnNumber.startsWith(grnPrefix)
          ? parseInt(g.grnNumber.slice(grnPrefix.length), 10)
          : 0;
      return Number.isFinite(n) && n > m ? n : m;
    }, 0);
    const nextNum = reserveDocNumber(`grn-${year}`, highestGrnSeq);
    const grnNumber = `GRN-${year}-${String(nextNum).padStart(3, "0")}`;
    const id =
      "grn_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const now = new Date().toISOString();

    const newGrn: GRN = {
      ...grnData,
      id,
      grnNumber,
      createdAt: now,
      updatedAt: now,
      totalSupplierSchemeFreeQty: grnData.items.reduce(
        (s, it) => s + (Number(it.supplierSchemeFreeQty) || 0),
        0,
      ),
    };

    let nextCatalog: Product[] = [...productsRef.current];
    let maxProductId = nextCatalog.reduce((m, p) => Math.max(m, p.id), 0);
    const resolvedItems = newGrn.items.map((rawItem) => {
      const item = { ...rawItem };
      const existing = nextCatalog.find(
        (p) =>
          (item.productId && p.id === item.productId) ||
          p.name.trim().toLowerCase() === item.productName.trim().toLowerCase(),
      );

      if (!existing) {
        maxProductId++;
        const autoSku =
          item.sku ||
          generateAutoSku(
            item.productName,
            item.category || "energy",
            maxProductId,
          );
        const crateCost = stockCrateCost(item, costBasisFor(orgProfile, newGrn.inwardDate));
        const crateLanded = resolveItemLandedCrateCost(item);
        const isNonGstItem = item.taxability === "non_gst";
        const resolvedHsn = normalizeTo8DigitHsn(item.hsn, item.category, item.productName, item.taxability);
        nextCatalog.push({
          id: maxProductId,
          name: item.productName.trim().toUpperCase(),
          category: item.category || "energy",
          pack: item.pack || "PET",
          volume: item.volume || 150,
          packSize: item.packSize,
          unitsPerCrate:
            Number(item.unitsPerCrate) > 0
              ? Number(item.unitsPerCrate)
              : inferUnitsPerCase(`${item.productName} ${item.pack || ""}`, item.volume),
          wholesale:
            item.wholesaleRate ||
            Math.round((crateLanded || item.unitPrice) * 1.15),
          retail:
            item.retailRate ||
            Math.round((crateLanded || item.unitPrice) * 1.25),
          cost: item.unitPrice || crateCost,
          effectiveCost: crateCost,
          landedCostPerCrate: crateLanded,
          landedCostPerUnit: item.landedCostPerUnit,
          labourCost: item.labourCost,
          freightCost: item.freightCost,
          opening: 0,
          taxability: isNonGstItem ? "non_gst" : undefined,
          hsn: resolvedHsn,
          gstRate: isNonGstItem
            ? 0
            : (gstRateFromHsn(resolvedHsn) ?? ((item.cgstPercent || 0) + (item.sgstPercent || 0)) / 100),
          scheme: item.schemeText,
          sku: autoSku,
          warehouseId: newGrn.warehouseId,
          batchNumber:
            item.batchNumber || generateBatchNumber(item.productName),
          expiry: item.expiry,
          mfgDate: item.mfgDate,
        });
        item.productId = maxProductId;
      } else {
        const crateCost = stockCrateCost(item, costBasisFor(orgProfile, newGrn.inwardDate));
        const crateLanded = resolveItemLandedCrateCost(item);
        const isNonGstItem = item.taxability === "non_gst";
        item.productId = existing.id;
        nextCatalog = nextCatalog.map((p) =>
          p.id === existing.id
            ? {
                ...p,
                cost: item.unitPrice || crateCost || p.cost,
                effectiveCost: crateCost || p.effectiveCost,
                landedCostPerCrate:
                  crateLanded || p.landedCostPerCrate,
                landedCostPerUnit:
                  item.landedCostPerUnit || p.landedCostPerUnit,
                labourCost: item.labourCost ?? p.labourCost,
                freightCost: item.freightCost ?? p.freightCost,
                unitsPerCrate: item.unitsPerCrate || p.unitsPerCrate,
                packSize: item.packSize || p.packSize,
                ...(isNonGstItem
                  ? {
                      taxability: "non_gst" as const,
                      gstRate: 0,
                      hsn: String(item.hsn || p.hsn || "").trim(),
                    }
                  : item.hsn
                  ? {
                      hsn: normalizeTo8DigitHsn(item.hsn, p.category, p.name, p.taxability),
                      gstRate:
                        p.taxability === "non_gst"
                          ? 0
                          : (gstRateFromHsn(
                              normalizeTo8DigitHsn(item.hsn, p.category, p.name),
                            ) ?? p.gstRate),
                    }
                  : {}),
                wholesale: item.wholesaleRate || p.wholesale,
                retail: item.retailRate || p.retail,
                batchNumber: item.batchNumber || p.batchNumber,
                expiry: item.expiry || p.expiry,
                mfgDate: item.mfgDate || p.mfgDate,
                scheme: item.schemeText || p.scheme,
              }
            : p,
        );
      }
      return item;
    });
    if (resolvedItems.some((it) => !it.productId)) {
      throw new Error(
        "Could not resolve a product for every GRN line; nothing was posted.",
      );
    }
    newGrn.items = resolvedItems;
    productsRef.current = nextCatalog;
    setProducts(nextCatalog);

    const overallDisc = Math.max(0, Number(newGrn.overallDiscount) || 0);
    const lineDiscTotal = newGrn.items.reduce(
      (s, it) => s + (Number(it.discountAmount) || 0),
      0,
    );
    if (newGrn.totalLineDiscount == null)
      newGrn.totalLineDiscount = lineDiscTotal;
    if (newGrn.overallDiscount == null) newGrn.overallDiscount = overallDisc;
    const taxableBase = newGrn.items.reduce((s, it) => {
      const lineTaxable =
        Number(it.taxableAmount) ||
        Math.max(
          0,
          (Number(it.qty) || 0) * (Number(it.unitPrice) || 0) -
            (Number(it.discountAmount) || 0),
        );
      return s + lineTaxable;
    }, 0);

    const newBatchesList: InventoryBatch[] = newGrn.items.map((item) => {
      const received =
        (Number(item.totalReceivedQty) || 0) +
        (Number(item.supplierSchemeFreeQty) || 0);
      const lineTaxable =
        Number(item.taxableAmount) ||
        Math.max(
          0,
          (Number(item.qty) || 0) * (Number(item.unitPrice) || 0) -
            (Number(item.discountAmount) || 0),
        );
      const billDiscShare =
        taxableBase > 0 && overallDisc > 0
          ? (lineTaxable / taxableBase) * overallDisc
          : 0;
      const crateCost = stockCrateCost(item, costBasisFor(orgProfile, newGrn.inwardDate));
      let unitEff =
        item.supplierSchemeFreeQty &&
        item.supplierSchemeFreeQty > 0 &&
        item.totalReceivedQty > 0
          ? ((crateCost || 0) * item.totalReceivedQty) /
            (item.totalReceivedQty + item.supplierSchemeFreeQty)
          : crateCost || Number(item.unitPrice) || 0;
      if (received > 0 && billDiscShare > 0) {
        unitEff = Math.max(0, unitEff - billDiscShare / received);
      }
      const discNote =
        billDiscShare > 0 || (Number(item.discountAmount) || 0) > 0
          ? ` · disc line ₹${(Number(item.discountAmount) || 0).toFixed(2)} bill-share ₹${billDiscShare.toFixed(2)}`
          : "";
      return {
        id: `batch_${newGrn.id}_${item.id}`,
        productId: item.productId as number,
        sku: item.sku,
        batchNumber: item.batchNumber || generateBatchNumber(item.productName),
        supplierInvoiceNo: newGrn.invoiceNo,
        supplierName: newGrn.supplierName,
        inwardDate: newGrn.inwardDate,
        mfgDate: item.mfgDate,
        expiryDate: item.expiry || "2026-12-31",
        warehouseId: newGrn.warehouseId,
        quantity: received,
        billedQuantity: item.qty,
        freeQuantity: item.freeQty,
        supplierSchemeId: item.supplierSchemeId,
        supplierSchemeFreeQty: item.supplierSchemeFreeQty || undefined,
        costPrice: item.unitPrice || crateCost,
        effectiveCostPrice: Math.round(unitEff * 100) / 100,
        mrp: item.retailRate || item.unitPrice * 1.2,
        scheme: item.schemeText,
        cgstRate: item.taxability === "non_gst" ? 0 : item.cgstPercent,
        sgstRate: item.taxability === "non_gst" ? 0 : item.sgstPercent,
        hsn: normalizeTo8DigitHsn(item.hsn, item.category, item.productName, item.taxability),
        notes: `Inward: ${newGrn.grnNumber} · ${newGrn.supplierName}${discNote}`,
      };
    });
    const nextBatches = [...inventoryBatchesRef.current, ...newBatchesList];
    inventoryBatchesRef.current = nextBatches;
    setInventoryBatches(nextBatches);

    const updatedGrns = [newGrn, ...grns];
    setGrns(updatedGrns);

    saveGrns(updatedGrns).catch(() => {});
    saveProducts(nextCatalog).catch(() => {});
    saveInventoryBatches(nextBatches).catch(() => {});

    const targetWh =
      warehouses.find((w) => w.id === newGrn.warehouseId) || warehouses[0];

    pushInwardInvoiceToSupabase({
      grn: newGrn,
      products: nextCatalog,
      inventoryBatches: newBatchesList,
      allGrns: updatedGrns,
      warehouse: targetWh,
    })
      .then((res) => {
        if (res.cloudSynced) {
          reportSyncSuccess();
          setSupabaseStatus((prev) => ({
            ...prev,
            isConnected: true,
            lastSyncedAt: new Date().toLocaleTimeString(),
            message: `Inward invoice ${newGrn.invoiceNo || newGrn.grnNumber} saved to Supabase PostgreSQL database.`,
          }));
        } else {
          reportSyncFailure(
            `Inward invoice ${newGrn.invoiceNo || newGrn.grnNumber}`,
            res.message,
          );
          setSupabaseStatus((prev) => ({
            ...prev,
            message: `Inward invoice saved on this device but NOT to the cloud: ${res.message}`,
          }));
        }
      })
      .catch((err) => {
        console.error("Failed to sync GRN to Supabase:", err);
        reportSyncFailure(
          `Inward invoice ${newGrn.invoiceNo || newGrn.grnNumber}`,
          err,
        );
        setSupabaseStatus((prev) => ({
          ...prev,
          message: `Inward invoice saved on this device but NOT to the cloud: ${err?.message || err}`,
        }));
      });

    return newGrn;
  };

  const updateGrn = (
    id: string,
    updates: Partial<GRN>,
    meta?: { reason?: string },
  ) => {
    const existingGrn = grns.find((g) => g.id === id);
    if (!existingGrn) return;

    const mergedGrn: GRN = {
      ...existingGrn,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const editIssues = validateGrnDraft(
      {
        warehouseId: mergedGrn.warehouseId,
        supplierName: mergedGrn.supplierName,
        invoiceNo: mergedGrn.invoiceNo,
        items: mergedGrn.items.map((it) => ({
          productId: it.productId,
          productName: it.productName,
          qty: it.qty,
          freeQty: it.freeQty,
          schemeMode: it.schemeMode,
          unitPrice: it.unitPrice,
          discountAmount: it.discountAmount,
          batchNumber: it.batchNumber,
          expiry: it.expiry,
          mfgDate: it.mfgDate,
        })),
      },
      { warehouses, grns, existingBatches: inventoryBatches, editingGrnId: id },
    );
    if (grnErrors(editIssues).length > 0) {
      throw new GrnValidationError(editIssues);
    }

    if (
      mergedGrn.importWarnings?.some(
        (w) => !w.resolved && w.type === "cases_mismatch",
      )
    ) {
      const receivedNow = Number(mergedGrn.totalReceivedQty) || 0;
      mergedGrn.importWarnings = mergedGrn.importWarnings.map((w) =>
        !w.resolved &&
        w.type === "cases_mismatch" &&
        w.expected !== undefined &&
        receivedNow === w.expected
          ? {
              ...w,
              resolved: true,
              resolvedAt: mergedGrn.updatedAt,
              resolvedNote: `Count corrected to ${receivedNow} cs by ${currentUser?.name || "Admin"}`,
            }
          : w,
      );
    }

    const grnChanges = diffGrn(existingGrn, mergedGrn);
    if (grnChanges.length > 0) {
      const record: GrnEditRecord = {
        id:
          "ge_" +
          Date.now().toString(36) +
          Math.random().toString(36).slice(2, 5),
        at: mergedGrn.updatedAt,
        by: currentUser?.name || "Admin",
        reason: meta?.reason?.trim() || undefined,
        changes: grnChanges,
      };
      mergedGrn.editHistory = [...(existingGrn.editHistory || []), record];
      cloud(
        "pushGrnEditLogToSupabase",
        pushGrnEditLogToSupabase(mergedGrn, record),
      );
    }
    const normName = (n: string) => (n || "").trim().toLowerCase();
    const isThisGrnBatch = (b: InventoryBatch) =>
      b.id.startsWith(`batch_${id}_`) ||
      (b.supplierInvoiceNo === existingGrn.invoiceNo &&
        b.supplierName === existingGrn.supplierName);

    const rawTargetItems = updates.items || existingGrn.items;
    const targetWhId = updates.warehouseId || existingGrn.warehouseId;

    let nextCatalog: Product[] = [...productsRef.current];
    let maxProductId = nextCatalog.reduce((m, p) => Math.max(m, p.id), 0);
    const resolvedItems = rawTargetItems.map((rawItem) => {
      const item = { ...rawItem };
      const existing = nextCatalog.find(
        (p) =>
          (item.productId && p.id === item.productId) ||
          p.name.trim().toLowerCase() === item.productName.trim().toLowerCase(),
      );

      if (!existing) {
        maxProductId++;
        const autoSku =
          item.sku ||
          generateAutoSku(
            item.productName,
            item.category || "energy",
            maxProductId,
          );
        const crateCost = stockCrateCost(item, costBasisFor(orgProfile, mergedGrn.inwardDate));
        const crateLanded = resolveItemLandedCrateCost(item);
        const isNonGstItem = item.taxability === "non_gst";
        const resolvedHsn = normalizeTo8DigitHsn(item.hsn, item.category, item.productName, item.taxability);
        nextCatalog.push({
          id: maxProductId,
          name: item.productName.trim().toUpperCase(),
          category: item.category || "energy",
          pack: item.pack || "PET",
          volume: item.volume || 150,
          wholesale:
            item.wholesaleRate ||
            Math.round((crateLanded || item.unitPrice) * 1.15),
          retail:
            item.retailRate ||
            Math.round((crateLanded || item.unitPrice) * 1.25),
          cost: item.unitPrice || crateCost,
          effectiveCost: crateCost,
          landedCostPerCrate: crateLanded,
          labourCost: item.labourCost,
          freightCost: item.freightCost,
          opening: 0,
          taxability: isNonGstItem ? "non_gst" : undefined,
          hsn: resolvedHsn,
          gstRate: isNonGstItem
            ? 0
            : (gstRateFromHsn(resolvedHsn) ?? ((item.cgstPercent || 0) + (item.sgstPercent || 0)) / 100),
          scheme: item.schemeText,
          sku: autoSku,
          warehouseId: targetWhId,
          batchNumber:
            item.batchNumber || generateBatchNumber(item.productName),
          expiry: item.expiry,
          mfgDate: item.mfgDate,
        });
        item.productId = maxProductId;
      } else {
        const crateCost = stockCrateCost(item, costBasisFor(orgProfile, mergedGrn.inwardDate));
        const crateLanded = resolveItemLandedCrateCost(item);
        const isNonGstItem = item.taxability === "non_gst";
        item.productId = existing.id;
        nextCatalog = nextCatalog.map((p) =>
          p.id === existing.id
            ? {
                ...p,
                cost: item.unitPrice || crateCost || p.cost,
                name:
                  item.productName.trim() &&
                  normName(item.productName) !== normName(p.name) &&
                  !grns.some(
                    (g) =>
                      g.id !== id &&
                      g.items.some(
                        (it) => normName(it.productName) === normName(p.name),
                      ),
                  )
                    ? item.productName.trim()
                    : p.name,
                effectiveCost: crateCost || p.effectiveCost,
                landedCostPerCrate: crateLanded || p.landedCostPerCrate,
                labourCost: item.labourCost ?? p.labourCost,
                freightCost: item.freightCost ?? p.freightCost,
                ...(isNonGstItem
                  ? {
                      taxability: "non_gst" as const,
                      gstRate: 0,
                      hsn: String(item.hsn || p.hsn || "").trim(),
                    }
                  : {}),
                wholesale: item.wholesaleRate || p.wholesale,
                retail: item.retailRate || p.retail,
                batchNumber: item.batchNumber || p.batchNumber,
                expiry: item.expiry || p.expiry,
                mfgDate: item.mfgDate || p.mfgDate,
                scheme: item.schemeText || p.scheme,
              }
            : p,
        );
      }
      return item;
    });
    if (resolvedItems.some((it) => !it.productId)) {
      throw new Error(
        "Could not resolve a product for every GRN line; nothing was saved.",
      );
    }
    const targetItems = resolvedItems;
    mergedGrn.items = resolvedItems;
    productsRef.current = nextCatalog;
    setProducts(nextCatalog);

    const freshBatchesList: InventoryBatch[] = targetItems.map((item) => {
      const crateCost = stockCrateCost(item, costBasisFor(orgProfile, mergedGrn.inwardDate));
      return {
        id: `batch_${id}_${item.id}`,
        productId: item.productId as number,
        sku: item.sku,
        batchNumber: item.batchNumber || generateBatchNumber(item.productName),
        supplierInvoiceNo: mergedGrn.invoiceNo,
        supplierName: mergedGrn.supplierName,
        inwardDate: mergedGrn.inwardDate,
        mfgDate: item.mfgDate,
        expiryDate: item.expiry || "2026-12-31",
        warehouseId: targetWhId,
        quantity:
          item.totalReceivedQty + (Number(item.supplierSchemeFreeQty) || 0),
        billedQuantity: item.qty,
        freeQuantity: item.freeQty,
        supplierSchemeId: item.supplierSchemeId,
        supplierSchemeFreeQty: item.supplierSchemeFreeQty || undefined,
        costPrice: item.unitPrice || crateCost,
        effectiveCostPrice:
          item.supplierSchemeFreeQty &&
          item.supplierSchemeFreeQty > 0 &&
          item.totalReceivedQty > 0
            ? Math.round(((crateCost * item.totalReceivedQty) /
                (item.totalReceivedQty + item.supplierSchemeFreeQty)) * 100) / 100
            : crateCost,
        mrp: item.retailRate || item.unitPrice * 1.2,
        scheme: item.schemeText,
        cgstRate: item.taxability === "non_gst" ? 0 : item.cgstPercent,
        sgstRate: item.taxability === "non_gst" ? 0 : item.sgstPercent,
        hsn: normalizeTo8DigitHsn(item.hsn, item.category, item.productName, item.taxability),
        notes: `Inward (Updated): ${mergedGrn.grnNumber} · ${mergedGrn.supplierName}`,
      };
    });
    const nextBatches = [
      ...inventoryBatchesRef.current.filter((b) => !isThisGrnBatch(b)),
      ...freshBatchesList,
    ];
    inventoryBatchesRef.current = nextBatches;
    setInventoryBatches(nextBatches);

    const updatedGrns = grns.map((g) =>
      g.id === id
        ? {
            ...mergedGrn,
            totalSupplierSchemeFreeQty: targetItems.reduce(
              (s, it) => s + (Number(it.supplierSchemeFreeQty) || 0),
              0,
            ),
          }
        : g,
    );
    setGrns(updatedGrns);

    const usedAfter = (p: Product) =>
      updatedGrns.some((g) =>
        g.items.some(
          (it) =>
            (it.productId && it.productId === p.id) ||
            normName(it.productName) === normName(p.name),
        ),
      );
    const wasInThisGrnBefore = (p: Product) =>
      existingGrn.items.some(
        (it) =>
          (it.productId && it.productId === p.id) ||
          normName(it.productName) === normName(p.name),
      );
    const orphaned = products.filter(
      (p) => wasInThisGrnBefore(p) && !usedAfter(p),
    );
    const orphanDeleteIds = orphaned
      .filter(
        (p) => !bills.some((b) => b.items.some((it) => it.productId === p.id)),
      )
      .map((p) => p.id);
    const orphanZeroIds = orphaned
      .map((p) => p.id)
      .filter((pid) => !orphanDeleteIds.includes(pid));
    if (orphaned.length > 0) {
      setProducts((prev) =>
        prev
          .filter((p) => !orphanDeleteIds.includes(p.id))
          .map((p) =>
            orphanZeroIds.includes(p.id) ? { ...p, opening: 0 } : p,
          ),
      );
      orphanDeleteIds.forEach((pid) =>
        cloud("deleteProductFromSupabase", deleteProductFromSupabase(pid)),
      );
    }
    const freshBatchIds = new Set(
      targetItems.map((it) => `batch_${id}_${it.id}`),
    );
    inventoryBatches
      .filter((b) => isThisGrnBatch(b) && !freshBatchIds.has(b.id))
      .forEach((b) =>
        cloud("deleteBatchFromSupabase", deleteBatchFromSupabase(b.id)),
      );

    const targetWh =
      warehouses.find((w) => w.id === targetWhId) || warehouses[0];
    saveGrns(updatedGrns).catch(() => {});
    saveProducts(nextCatalog).catch(() => {});
    saveInventoryBatches(nextBatches).catch(() => {});
    pushInwardInvoiceToSupabase({
      grn: mergedGrn,
      products: nextCatalog,
      inventoryBatches: freshBatchesList,
      allGrns: updatedGrns,
      warehouse: targetWh,
    })
      .then((res) => {
        if (res && res.cloudSynced === false) {
          reportSyncFailure(`GRN ${mergedGrn.grnNumber} update`, res.message);
        } else {
          reportSyncSuccess();
        }
      })
      .catch((err) => {
        console.error("Failed to update GRN in Supabase:", err);
        reportSyncFailure(`GRN ${mergedGrn.grnNumber} update`, err);
      });
  };

  const deleteGrn = (id: string) => {
    const target = grns.find((g) => g.id === id);
    if (!target) return;

    const remainingGrns = grns.filter((g) => g.id !== id);

    const isTargetBatch = (b: InventoryBatch) =>
      b.id.startsWith(`batch_${id}_`) ||
      (b.supplierInvoiceNo === target.invoiceNo &&
        b.supplierName === target.supplierName);
    const removedBatches = inventoryBatches.filter(isTargetBatch);

    const norm = (n: string) => (n || "").trim().toLowerCase();
    const touchedIds = new Set<number>();
    const touchedNames = new Set<string>();
    target.items.forEach((it) => {
      if (it.productId) touchedIds.add(it.productId);
      touchedNames.add(norm(it.productName));
    });
    removedBatches.forEach((b) => touchedIds.add(b.productId));

    const stillInRemainingGrns = (p: Product) =>
      remainingGrns.some((g) =>
        g.items.some(
          (it) =>
            (it.productId && it.productId === p.id) ||
            norm(it.productName) === norm(p.name),
        ),
      );
    const usedInBills = (p: Product) =>
      bills.some((b) => b.items.some((it) => it.productId === p.id));

    const { products: rebuilt } = buildCatalogFromGrns(
      remainingGrns,
      warehouses,
      (d) => costBasisFor(orgProfile, d),
    );
    const rebuiltByName = new Map(rebuilt.map((p) => [norm(p.name), p]));

    const productsToDelete: number[] = [];
    const productsToUpdate: Product[] = [];
    const nextProducts: Product[] = [];
    for (const p of products) {
      const wasTouched = touchedIds.has(p.id) || touchedNames.has(norm(p.name));
      if (!wasTouched) {
        nextProducts.push(p);
        continue;
      }
      if (stillInRemainingGrns(p)) {
        const r = rebuiltByName.get(norm(p.name));
        const updated = r
          ? {
              ...p,
              opening: r.opening,
              cost: r.cost,
              effectiveCost: r.effectiveCost,
            }
          : p;
        productsToUpdate.push(updated);
        nextProducts.push(updated);
      } else if (usedInBills(p)) {
        const updated = { ...p, opening: 0 };
        productsToUpdate.push(updated);
        nextProducts.push(updated);
      } else {
        productsToDelete.push(p.id);
      }
    }

    setInventoryBatches((prev) => prev.filter((b) => !isTargetBatch(b)));
    setProducts(nextProducts);
    setGrns(remainingGrns);

    if (activeGrnToEdit?.id === id) {
      setActiveGrnToEdit(null);
    }

    cloud(
      "pushGrnEditLogToSupabase",
      pushGrnEditLogToSupabase(target, {
        id:
          "ge_" +
          Date.now().toString(36) +
          Math.random().toString(36).slice(2, 5),
        at: new Date().toISOString(),
        by: currentUser?.name || "Admin",
        reason: "GRN deleted",
        changes: [
          {
            scope: "header",
            field: "GRN",
            from: `${target.grnNumber} · Inv ${target.invoiceNo} · ₹${target.grandTotal}`,
            to: "Deleted",
          },
        ],
      }),
    );
    cloud("deleteGrnFromSupabase", deleteGrnFromSupabase(id, remainingGrns));
    removedBatches.forEach((b) => {
      logDeletion("batch", b.id);
      cloud("deleteBatchFromSupabase", deleteBatchFromSupabase(b.id));
    });
    productsToDelete.forEach((pid) => {
      const gone = products.find((p) => p.id === pid);
      if (gone) logDeletion("product", productDeletionKey(gone), gone.name);
      cloud("deleteProductFromSupabase", deleteProductFromSupabase(pid));
    });
    productsToUpdate.forEach((p) =>
      cloud("pushProductToSupabase", pushProductToSupabase(p)),
    );
    saveProducts(nextProducts);
    saveInventoryBatches(inventoryBatches.filter((b) => !isTargetBatch(b)));
    saveGrns(remainingGrns);
    fetch(`/api/grns/${id}`, { method: "DELETE" }).catch(() => {});
  };

  // Warehouse Management
  const addWarehouse = (w: Omit<Warehouse, "id">): string => {
    const id =
      "wh_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const isFirst = warehouses.length === 0;
    const newWh: Warehouse = {
      ...w,
      id,
      isDefault: isFirst ? true : Boolean(w.isDefault),
    };

    setWarehouses((prev) => {
      if (newWh.isDefault) {
        return [...prev.map((item) => ({ ...item, isDefault: false })), newWh];
      }
      return [...prev, newWh];
    });

    cloud("pushWarehouseToSupabase", pushWarehouseToSupabase(newWh));
    return id;
  };

  const updateWarehouse = (id: string, updates: Partial<Warehouse>) => {
    const currentWh = warehouses.find((w) => w.id === id);
    const updatedObj: Warehouse | null = currentWh
      ? { ...currentWh, ...updates }
      : null;
    setWarehouses((prev) =>
      prev.map((w) => {
        if (w.id === id) return updatedObj ?? { ...w, ...updates };
        if (updates.isDefault) return { ...w, isDefault: false };
        return w;
      }),
    );
    if (updatedObj) {
      cloud("pushWarehouseToSupabase", pushWarehouseToSupabase(updatedObj));
    }
  };

  const deleteWarehouse = (id: string) => {
    setWarehouses((prev) => prev.filter((w) => w.id !== id));
    logDeletion("warehouse", id);
    cloud("deleteWarehouseFromSupabase", deleteWarehouseFromSupabase(id));
  };

  // Batches Management
  const addBatch = (b: Omit<InventoryBatch, "id">): string => {
    const id =
      "batch_" +
      Date.now().toString(36) +
      Math.random().toString(36).slice(2, 6);
    const newBatch: InventoryBatch = { ...b, id };
    setInventoryBatches((prev) => [...prev, newBatch]);

    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === b.productId) {
          const updates: Partial<Product> = {};
          if (!p.batchNumber) updates.batchNumber = b.batchNumber;
          if (!p.expiry) updates.expiry = b.expiryDate;
          if (!p.mfgDate && b.mfgDate) updates.mfgDate = b.mfgDate;
          if (!p.warehouseId && b.warehouseId)
            updates.warehouseId = b.warehouseId;
          return { ...p, ...updates };
        }
        return p;
      }),
    );

    cloud("pushBatchToSupabase", pushBatchToSupabase(newBatch));
    return id;
  };

  const updateBatch = (id: string, updates: Partial<InventoryBatch>) => {
    const currentBatch = inventoryBatchesRef.current.find((b) => b.id === id);
    const updatedBatch: InventoryBatch | null = currentBatch
      ? { ...currentBatch, ...updates }
      : null;
    if (updatedBatch) {
      inventoryBatchesRef.current = inventoryBatchesRef.current.map((b) =>
        b.id === id ? updatedBatch : b,
      );
      setInventoryBatches((prev) =>
        prev.map((b) => (b.id === id ? updatedBatch : b)),
      );
    }
    if (updatedBatch) {
      cloud("pushBatchToSupabase", pushBatchToSupabase(updatedBatch));
    }
  };

  const deleteBatch = (id: string) => {
    const gone = inventoryBatches.find((b) => b.id === id);
    if (
      gone &&
      inventoryBatches.filter((b) => b.productId === gone.productId).length ===
        1
    ) {
      setProducts((ps) =>
        ps.map((p) => (p.id === gone.productId ? { ...p, opening: 0 } : p)),
      );
    }
    setInventoryBatches((prev) => prev.filter((b) => b.id !== id));
    logDeletion("batch", id);
    cloud("deleteBatchFromSupabase", deleteBatchFromSupabase(id));
  };

  const batchesForProduct = (
    productId: number,
    warehouseId?: string,
  ): InventoryBatch[] => {
    return inventoryBatches.filter((b) => {
      if (b.productId !== productId) return false;
      if (warehouseId && b.warehouseId !== warehouseId) return false;
      return true;
    });
  };

  // Stock Transfer — never allow moving more than source has (no negative stock).
  const addStockTransfer = (st: Omit<StockTransfer, "id">): boolean => {
    const qty = Math.floor(Number(st.quantity) || 0);
    if (qty <= 0) return false;
    if (!st.fromWarehouseId || !st.toWarehouseId) return false;
    if (st.fromWarehouseId === st.toWarehouseId) return false;

    const bn = (st.batchNumber || "").trim().toUpperCase();
    const byFefo = (a: InventoryBatch, b: InventoryBatch) => {
      const ea = (a.expiryDate || "9999-12-31").slice(0, 10);
      const eb = (b.expiryDate || "9999-12-31").slice(0, 10);
      if (ea !== eb) return ea.localeCompare(eb);
      return (a.inwardDate || "0000-01-01")
        .slice(0, 10)
        .localeCompare((b.inwardDate || "0000-01-01").slice(0, 10));
    };

    const current = inventoryBatches;
    let sourceCandidates: InventoryBatch[] = [];
    if (bn) {
      const match = current.find(
        (b) =>
          b.productId === st.productId &&
          b.warehouseId === st.fromWarehouseId &&
          (b.batchNumber || "").toUpperCase() === bn,
      );
      if (!match || (Number(match.quantity) || 0) < qty) {
        notify(
          `Cannot transfer ${qty} cases — insufficient stock in batch ${bn || "(none)"} at source.`,
        );
        return false;
      }
      sourceCandidates = [match];
    } else {
      sourceCandidates = current
        .filter(
          (b) =>
            b.productId === st.productId &&
            b.warehouseId === st.fromWarehouseId &&
            (Number(b.quantity) || 0) > 0,
        )
        .sort(byFefo);
      const totalPhysical = sourceCandidates.reduce(
        (s, b) => s + (Number(b.quantity) || 0),
        0,
      );
      const sellable = Math.max(0, warehouseStock(st.fromWarehouseId, st.productId));
      const available = Math.min(totalPhysical, sellable || totalPhysical);
      if (available < qty) {
        notify(
          `Cannot transfer ${qty} cases — only ${available} available at source. Negative stock is not allowed.`,
        );
        return false;
      }
      if (sourceCandidates.length === 0 && sellable < qty) {
        notify(
          `Cannot transfer ${qty} cases — insufficient stock at source.`,
        );
        return false;
      }
    }

    const id =
      "transfer_" +
      Date.now().toString(36) +
      Math.random().toString(36).slice(2, 6);
    const newTransfer: StockTransfer = {
      ...st,
      batchNumber: bn || st.batchNumber,
      quantity: qty,
      id,
    };
    setStockTransfers((prev) => [newTransfer, ...prev]);

    setInventoryBatches((prev) => {
      let remaining = qty;
      let next = [...prev];

      const moveFromBatch = (sourceBatch: InventoryBatch, take: number) => {
        if (take <= 0) return;
        next = next.map((b) =>
          b.id === sourceBatch.id
            ? { ...b, quantity: Math.max(0, (Number(b.quantity) || 0) - take) }
            : b,
        );
        const destBatch = next.find(
          (b) =>
            b.productId === st.productId &&
            b.warehouseId === st.toWarehouseId &&
            (b.batchNumber || "").toUpperCase() ===
              (sourceBatch.batchNumber || "").toUpperCase(),
        );
        if (destBatch) {
          next = next.map((b) =>
            b.id === destBatch.id
              ? { ...b, quantity: (Number(b.quantity) || 0) + take }
              : b,
          );
        } else {
          const destId =
            "batch_" +
            Date.now().toString(36) +
            Math.random().toString(36).slice(2, 6) +
            take;
          next = [
            ...next,
            {
              id: destId,
              productId: st.productId,
              batchNumber: sourceBatch.batchNumber,
              mfgDate: sourceBatch.mfgDate,
              expiryDate: sourceBatch.expiryDate,
              inwardDate: sourceBatch.inwardDate,
              warehouseId: st.toWarehouseId,
              quantity: take,
              costPrice: sourceBatch.costPrice,
              effectiveCostPrice: sourceBatch.effectiveCostPrice,
              sku: sourceBatch.sku,
              supplierInvoiceNo: sourceBatch.supplierInvoiceNo,
              supplierName: sourceBatch.supplierName,
              cgstRate: sourceBatch.cgstRate,
              sgstRate: sourceBatch.sgstRate,
              hsn: sourceBatch.hsn,
              mrp: sourceBatch.mrp,
              notes: `Transferred from ${st.fromWarehouseId}`,
            },
          ];
        }
      };

      if (bn) {
        const sourceBatch = next.find(
          (b) =>
            b.productId === st.productId &&
            b.warehouseId === st.fromWarehouseId &&
            (b.batchNumber || "").toUpperCase() === bn,
        );
        if (sourceBatch) moveFromBatch(sourceBatch, qty);
      } else {
        const ordered = next
          .filter(
            (b) =>
              b.productId === st.productId &&
              b.warehouseId === st.fromWarehouseId &&
              (Number(b.quantity) || 0) > 0,
          )
          .sort(byFefo);
        for (const src of ordered) {
          if (remaining <= 0) break;
          const have = Number(src.quantity) || 0;
          const take = Math.min(have, remaining);
          moveFromBatch(src, take);
          remaining -= take;
        }
      }
      return next;
    });

    return true;
  };

  return {
    postGrn,
    updateGrn,
    deleteGrn,
    addWarehouse,
    updateWarehouse,
    deleteWarehouse,
    addBatch,
    updateBatch,
    deleteBatch,
    batchesForProduct,
    addStockTransfer,
  };
}
