import React, { useMemo, useRef, useState } from "react";
import { SizeChip } from "../common/SizeChip";
import { PackIcon } from "../common/PackIcon";
import { CheckSquare, Layers, Plus, Search, Square } from "lucide-react";
import { useLedger } from "../../context/LedgerContext";
import { useLanguage } from "../../i18n/LanguageContext";
import { useAutoOdiaNameMap, nameFromMap } from "../../hooks/useAutoOdiaName";
import { CategoryKey, Product } from "../../types";
import { CATS } from "../../constants/initialData";
import { detectPack, money, resolveProductGstRate, resolveProductHsn, volumeFromName } from "../../utils/billing";
import { ConfirmModal } from "../ui";
import { notify } from "../../utils/toast";
import { useIsMobile } from "../../hooks/useIsMobile";
import {
  Chip,
  emptyProductForm,
  gstToRate,
  hsnLooksValid,
  ProductFormState,
  rateToGstLabel,
} from "./products/productsShared";
import { ProductsPhoneView } from "./products/ProductsPhoneView";
import { ProductsDesktopForm } from "./products/ProductsDesktopForm";

export const ProductsView: React.FC = () => {
  const isPhone = useIsMobile(1023);
  const {
    products,
    warehouses,
    addProduct,
    updateProductFields,
    bulkSetProductTaxability,
    deleteProduct,
    remainingStock,
    productWarehouseStock,
    productBatchLines,
    setTab,
  } = useLedger();
  const { language } = useLanguage();
  const productNameMap = useAutoOdiaNameMap(products || []);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProductFormState>(emptyProductForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Product | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [detailProductId, setDetailProductId] = useState<number | null>(null);
  const phoneFormBodyRef = useRef<HTMLDivElement>(null);

  const toggleSelectProduct = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return products.filter((p) => {
      if (filterCat === "non_gst") {
        if (p.taxability !== "non_gst") return false;
      } else if (filterCat !== "all" && p.category !== filterCat) {
        return false;
      }
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.nameOr || "").toLowerCase().includes(q) ||
        (p.sku || "").toLowerCase().includes(q) ||
        (p.brand || "").toLowerCase().includes(q) ||
        (p.hsn || "").includes(q)
      );
    });
  }, [products, searchTerm, filterCat]);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyProductForm());
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditingId(p.id);
    const isNonGst = p.taxability === "non_gst";
    setForm({
      name: p.name || "",
      nameOr: p.nameOr || "",
      sku: p.sku || "",
      brand: p.brand || "",
      category: p.category || "general",
      categoryText: CATS[p.category]?.name || "",
      taxability: isNonGst ? "non_gst" : "taxable",
      hsn: resolveProductHsn(p),
      gstPct: isNonGst ? "0%" : rateToGstLabel(resolveProductGstRate(p)),
      cessPct: "0",
      unit: p.pack || "pcs",
      unitsPerCase: String(p.unitsPerCrate ?? 1),
      mrp: "0",
      purchaseRate: String(p.cost ?? 0),
      labourCost: String(p.labourCost ?? 0),
      freightCost: String(p.freightCost ?? 0),
      retailRate: String(p.retail ?? 0),
      wholesaleRate: String(p.wholesale ?? 0),
      specialRate: "0",
      reorderLevel: "0",
      imageUrl: "",
      ratesIncludeGst: !isNonGst && p.ratesIncludeGst === true,
      opening: String(p.opening ?? 0),
      warehouseId: p.warehouseId || "",
      batchNumber: p.batchNumber || "",
      expiry: p.expiry || "",
      returnable: p.returnable === true,
      active: p.active !== false,
    });
    setFormError(null);
    setFormOpen(true);
  };

  const setField = <K extends keyof ProductFormState>(
    key: K,
    value: ProductFormState[K],
  ) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const landedPreview = useMemo(() => {
    const isNonGst = form.taxability === "non_gst";
    const rawRate = Math.max(0, Number(form.purchaseRate) || 0);
    const gstFrac = isNonGst ? 0 : gstToRate(form.gstPct);
    const exGstBase =
      !isNonGst && form.ratesIncludeGst && gstFrac > 0
        ? rawRate / (1 + gstFrac)
        : rawRate;
    const gstAmtPerCase = isNonGst ? 0 : exGstBase * gstFrac;
    const labour = Math.max(0, Number(form.labourCost) || 0);
    const freight = Math.max(0, Number(form.freightCost) || 0);
    const landedPerCase = Math.round((exGstBase + gstAmtPerCase + labour + freight) * 100) / 100;
    const unitsPerCase = Math.max(1, Number(form.unitsPerCase) || 1);
    const landedPerUnit = Math.round((landedPerCase / unitsPerCase) * 100) / 100;
    const effectiveCost = Math.round((exGstBase + labour + freight) * 100) / 100;
    return {
      isNonGst,
      exGstBase: Math.round(exGstBase * 100) / 100,
      gstAmtPerCase: Math.round(gstAmtPerCase * 100) / 100,
      labour,
      freight,
      landedPerCase,
      landedPerUnit,
      effectiveCost,
      unitsPerCase,
    };
  }, [form.taxability, form.purchaseRate, form.gstPct, form.ratesIncludeGst, form.labourCost, form.freightCost, form.unitsPerCase]);

  const handleSave = () => {
    const name = form.name.trim().toUpperCase();
    if (!name) {
      setFormError("Product name is required");
      phoneFormBodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const cat = form.category;
    const isNonGst = form.taxability === "non_gst";
    const hsnClean = form.hsn.trim();
    if (!isNonGst && !hsnLooksValid(hsnClean)) {
      setFormError("Enter the full 8-digit HSN code, e.g. 22021090");
      phoneFormBodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const detectedVol = volumeFromName(name);
    const existingVol = editingId != null ? products.find((p) => p.id === editingId)?.volume : undefined;
    const finalVolume = Number(existingVol) > 0 ? Number(existingVol) : (detectedVol || 150);
    const pack = form.unit.trim() && form.unit.trim() !== "pcs" ? form.unit.trim() : detectPack(name);
    const openingQty = Math.max(0, Number(form.opening) || 0);

    const payload: Omit<Product, "id"> = {
      name,
      nameOr: form.nameOr.trim() || undefined,
      sku: form.sku.trim() || undefined,
      brand: form.brand.trim(),
      category: cat,
      taxability: isNonGst ? "non_gst" : "taxable",
      hsn: hsnClean,
      gstRate: isNonGst ? 0 : gstToRate(form.gstPct),
      pack,
      unitsPerCrate: Math.max(1, Number(form.unitsPerCase) || 1),
      cost: Number(form.purchaseRate) || 0,
      labourCost: landedPreview.labour,
      freightCost: landedPreview.freight,
      effectiveCost: landedPreview.effectiveCost,
      landedCostPerCrate: landedPreview.landedPerCase,
      landedCostPerUnit: landedPreview.landedPerUnit,
      retail: Number(form.retailRate) || 0,
      wholesale: Number(form.wholesaleRate) || 0,
      volume: finalVolume,
      expiry: form.expiry.trim() || "",
      opening: openingQty,
      warehouseId: form.warehouseId || undefined,
      batchNumber: form.batchNumber.trim() || undefined,
      returnable: !!form.returnable,
      active: form.active !== false,
      ratesIncludeGst: !isNonGst && !!form.ratesIncludeGst,
    };

    if (editingId != null) {
      // Editing a catalog SKU must not overwrite existing batch stock or expiry dates.
      const { opening: _opening, expiry: _expiry, warehouseId: _wh, batchNumber: _bn, ...edited } = payload;
      updateProductFields(editingId, edited);
    } else {
      addProduct(payload);
    }
    setFormOpen(false);
    setEditingId(null);
  };

  const detailProduct = useMemo(
    () => (detailProductId != null ? products.find((x) => x.id === detailProductId) || null : null),
    [detailProductId, products],
  );

  if (isPhone) {
    return (
      <ProductsPhoneView
        products={products}
        filtered={filtered}
        warehouses={warehouses}
        language={language}
        productNameMap={productNameMap}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        filterCat={filterCat}
        setFilterCat={setFilterCat}
        formOpen={formOpen}
        setFormOpen={setFormOpen}
        editingId={editingId}
        setEditingId={setEditingId}
        form={form}
        setForm={setForm}
        setField={setField}
        formError={formError}
        setFormError={setFormError}
        phoneFormBodyRef={phoneFormBodyRef}
        landedPreview={landedPreview}
        toDelete={toDelete}
        setToDelete={setToDelete}
        bulkMode={bulkMode}
        setBulkMode={setBulkMode}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        detailProduct={detailProduct}
        setDetailProductId={setDetailProductId}
        toggleSelectProduct={toggleSelectProduct}
        openAdd={openAdd}
        openEdit={openEdit}
        handleSave={handleSave}
        deleteProduct={deleteProduct}
        bulkSetProductTaxability={bulkSetProductTaxability}
        remainingStock={remainingStock}
        productWarehouseStock={productWarehouseStock}
        productBatchLines={productBatchLines}
        setTab={setTab}
      />
    );
  }

  /* ─── New / Edit product form ─── */
  if (formOpen) {
    return (
      <ProductsDesktopForm
        editingId={editingId}
        form={form}
        setForm={setForm}
        setField={setField}
        formError={formError}
        landedPreview={landedPreview}
        warehouses={warehouses}
        products={products}
        setFormOpen={setFormOpen}
        setToDelete={setToDelete}
        handleSave={handleSave}
      />
    );
  }

  /* ─── Catalogue list ─── */
  return (
    <div className="hh-view w-full min-w-0 pb-24">
      <div className="w-full min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Products
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {products.length} product{products.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setBulkMode((v) => !v);
                setSelectedIds([]);
              }}
              className={`px-3 py-2 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 border cursor-pointer transition ${
                bulkMode
                  ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                  : "bg-white text-slate-700 border-black/10 hover:bg-slate-50"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{bulkMode ? "Exit Bulk Switch" : "Bulk Tax Switch"}</span>
            </button>
            <button
              type="button"
              onClick={openAdd}
              className="size-10 sm:size-11 rounded-full bg-[var(--primary)] text-white flex items-center justify-center shadow-md cursor-pointer active:scale-95"
              aria-label="Add product"
            >
              <Plus className="w-5 h-5" strokeWidth={2.5} />
            </button>
          </div>
        </div>

        <div className="relative mt-3 mb-3">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input enterKeyHint="search"
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search name, brand, SKU"
            className="w-full pl-10 pr-4 py-2.5 rounded-full bg-white border border-black/8 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/25 focus:border-[var(--primary)]/40"
          />
        </div>

        <div className="flex gap-2 mb-3 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Chip
            active={filterCat === "all"}
            onClick={() => setFilterCat("all")}
            label="All"
          />
          <Chip
            active={filterCat === "non_gst"}
            onClick={() => setFilterCat("non_gst")}
            label={`Non-GST (${products.filter((p) => p.taxability === "non_gst").length})`}
          />
          {(Object.keys(CATS) as CategoryKey[]).map((k) => (
            <Chip
              key={k}
              active={filterCat === k}
              onClick={() => setFilterCat(k)}
              label={CATS[k].name.split(/[\/&]/)[0].trim()}
            />
          ))}
        </div>

        {bulkMode && (
          <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50/80 px-3.5 py-2.5 flex items-center justify-between gap-2 flex-wrap">
            <div className="text-xs font-semibold text-amber-950">
              Tap products below to switch between <span className="font-bold">Non-GST Trading (NG-...)</span> and <span className="font-bold">GST Taxable</span>. ({selectedIds.length} selected)
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const visibleIds = filtered.map((p) => p.id);
                  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
                  setSelectedIds(allSelected ? [] : visibleIds);
                }}
                className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-xs font-semibold text-amber-900 cursor-pointer"
              >
                {filtered.length > 0 && filtered.every((p) => selectedIds.includes(p.id)) ? "Clear visible" : `Select visible (${filtered.length})`}
              </button>
            </div>
          </div>
        )}

        {filtered.length === 0 ? (
          <div data-card-tone="neutral" className="rounded-2xl border shadow-sm px-6 py-12 text-center">
            <p className="text-base font-bold text-slate-900">No products yet</p>
            <p className="text-sm text-slate-500 mt-1.5 max-w-xs mx-auto">
              Add your beverages with HSN, GST rate and prices.
            </p>
          </div>
        ) : (
          <ul className="hh-list-grid">
            {filtered.map((p) => {
              const isSelected = selectedIds.includes(p.id);
              const cardTone =
                bulkMode && isSelected
                  ? "warning"
                  : p.taxability === "non_gst"
                    ? "warning"
                    : p.category === "energy"
                      ? "profit"
                      : p.category === "joos"
                        ? "received"
                        : p.category === "vibe"
                          ? "due"
                          : "sales";
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => (bulkMode ? toggleSelectProduct(p.id) : openEdit(p))}
                    data-card-tone={cardTone}
                    className={`w-full text-left rounded-2xl border shadow-sm px-3.5 sm:px-4 py-3 flex items-center gap-2.5 sm:gap-3 cursor-pointer active:scale-[0.99] transition ${
                      bulkMode && isSelected
                        ? "ring-2 ring-amber-500/40"
                        : ""
                    }`}
                  >
                    {bulkMode && (
                      <span className="shrink-0 text-amber-700">
                        {isSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-slate-400" />}
                      </span>
                    )}
                    <PackIcon pack={p.pack} name={p.name} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] sm:text-base font-bold text-slate-900 leading-snug break-words">
                        {nameFromMap(productNameMap, p, language)}{' '}
                        <SizeChip volume={p.volume} pack={p.pack} name={nameFromMap(productNameMap, p, language)} className="align-middle ml-1" />
                        {p.taxability === "non_gst" && (
                          <span className="inline-block align-middle ml-1.5 px-1.5 py-0.5 rounded-md text-xs font-bold bg-white/85 text-amber-800 border border-amber-200">
                            Non-GST
                          </span>
                        )}
                      </div>
                      <div className="text-xs sm:text-xs text-slate-600 leading-tight mt-0.5 break-words">
                        {[
                          p.brand,
                          p.sku,
                          CATS[p.category]?.name,
                          p.taxability === "non_gst" ? "0% GST (Trading)" : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-extrabold text-slate-900 tabular-nums">
                        ₹{money(p.retail || p.wholesale || 0)}
                      </div>
                      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        retail
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {bulkMode && selectedIds.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-xl bg-slate-900 text-white rounded-2xl shadow-xl px-4 py-3 flex items-center justify-between gap-2.5 flex-wrap">
          <span className="text-xs font-bold tabular-nums">{selectedIds.length} selected</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const count = bulkSetProductTaxability(selectedIds, "non_gst");
                notify(`${count} product${count === 1 ? "" : "s"} marked Non-GST / Trading (0% GST).`);
                setSelectedIds([]);
                setBulkMode(false);
              }}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold cursor-pointer"
            >
              Mark Non-GST (0%)
            </button>
            <button
              type="button"
              onClick={() => {
                const count = bulkSetProductTaxability(selectedIds, "taxable");
                notify(`${count} product${count === 1 ? "" : "s"} restored to GST Taxable.`);
                setSelectedIds([]);
                setBulkMode(false);
              }}
              className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-bold cursor-pointer"
            >
              Mark GST Taxable
            </button>
          </div>
        </div>
      )}

      {toDelete && (
        <ConfirmModal
          isOpen
          title="Delete product?"
          subtitle={`${toDelete.name}${toDelete.sku ? ` · ${toDelete.sku}` : ""}`}
          message={`Remove ${toDelete.name} from products? Its stock batches are removed too. Old bills that already contain it are not changed.`}
          impactItems={[
            {
              label: "Product",
              detail: toDelete.name,
              qtyChange: `${remainingStock(toDelete.id)} cs in stock`,
            },
          ]}
          rectificationPrompt="Reason for deleting product *"
          rectificationPlaceholder="e.g. Discontinued SKU, duplicate item, test entry"
          reasonPresets={["Discontinued SKU", "Duplicate item", "Wrong entry", "Test product"]}
          commentMinLength={4}
          confirmButtonLabel="Delete Product"
          variant="danger"
          onConfirm={() => {}}
          onConfirmWithComment={(reason) => {
            deleteProduct(toDelete.id, reason);
            setToDelete(null);
          }}
          onClose={() => setToDelete(null)}
        />
      )}
    </div>
  );
};
