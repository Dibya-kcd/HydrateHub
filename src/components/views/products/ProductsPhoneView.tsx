import React from 'react';
import { Check, ChevronLeft, Plus, Search, X } from 'lucide-react';
import { CategoryKey, Product, TabId, Taxability, Warehouse } from '../../../types';
import type { LanguageCode } from '../../../i18n/translations';
import { CATS } from '../../../constants/initialData';
import { money, resolveProductGstRate, resolveProductHsn } from '../../../utils/billing';
import { nameFromMap } from '../../../hooks/useAutoOdiaName';
import { notify } from '../../../utils/toast';
import { PackIcon } from '../../common/PackIcon';
import { SizeChip } from '../../common/SizeChip';
import { LandedPreview, ProductFormState } from './productsShared';
import { ProductsPhoneForm } from './ProductsPhoneForm';

interface BatchLineView {
  key: string;
  batchNumber: string;
  warehouseName: string;
  availableQty: number;
  daysLeft: number | null;
}

interface ProductsPhoneViewProps {
  products: Product[];
  filtered: Product[];
  warehouses: Warehouse[];
  language: LanguageCode;
  productNameMap: Map<string, string>;
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  filterCat: string;
  setFilterCat: React.Dispatch<React.SetStateAction<string>>;
  formOpen: boolean;
  setFormOpen: React.Dispatch<React.SetStateAction<boolean>>;
  editingId: number | null;
  setEditingId: React.Dispatch<React.SetStateAction<number | null>>;
  form: ProductFormState;
  setForm: React.Dispatch<React.SetStateAction<ProductFormState>>;
  setField: <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) => void;
  formError: string | null;
  setFormError: React.Dispatch<React.SetStateAction<string | null>>;
  phoneFormBodyRef: React.RefObject<HTMLDivElement | null>;
  landedPreview: LandedPreview;
  toDelete: Product | null;
  setToDelete: React.Dispatch<React.SetStateAction<Product | null>>;
  bulkMode: boolean;
  setBulkMode: React.Dispatch<React.SetStateAction<boolean>>;
  selectedIds: number[];
  setSelectedIds: React.Dispatch<React.SetStateAction<number[]>>;
  detailProduct: Product | null;
  setDetailProductId: React.Dispatch<React.SetStateAction<number | null>>;
  toggleSelectProduct: (id: number) => void;
  openAdd: () => void;
  openEdit: (p: Product) => void;
  handleSave: () => void;
  deleteProduct: (id: number, reason?: string) => void;
  bulkSetProductTaxability: (ids: number[], taxability: Taxability) => number;
  remainingStock: (id: number) => number;
  productWarehouseStock: (id: number) => { warehouseName: string; crates: number }[];
  productBatchLines: (id: number) => BatchLineView[];
  setTab: (tab: TabId) => void;
}

export const ProductsPhoneView: React.FC<ProductsPhoneViewProps> = ({
  products,
  filtered,
  warehouses,
  language,
  productNameMap,
  searchTerm,
  setSearchTerm,
  filterCat,
  setFilterCat,
  formOpen,
  setFormOpen,
  editingId,
  setEditingId,
  form,
  setForm,
  setField,
  formError,
  setFormError,
  phoneFormBodyRef,
  landedPreview,
  toDelete,
  setToDelete,
  bulkMode,
  setBulkMode,
  selectedIds,
  setSelectedIds,
  detailProduct,
  setDetailProductId,
  toggleSelectProduct,
  openAdd,
  openEdit,
  handleSave,
  deleteProduct,
  bulkSetProductTaxability,
  remainingStock,
  productWarehouseStock,
  productBatchLines,
  setTab,
}) => {
  const [deleteReason, setDeleteReason] = React.useState("");
  React.useEffect(() => {
    setDeleteReason("");
  }, [toDelete?.id]);
  const delReasonOk = deleteReason.trim().length >= 4;

  const phoneDeleteSheet = toDelete ? (
    <div
      className="rt-bsheet-scrim"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ph-prod-del-title"
      onClick={() => setToDelete(null)}
    >
      <div
        className="rt-bsheet rt-bsheet--white space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="hh-grab" />
        <div>
          <h3
            id="ph-prod-del-title"
            className="text-[17px] font-extrabold"
            style={{ color: "var(--due)" }}
          >
            Delete product?
          </h3>
          <p className="text-[13px] text-slate-500 mt-1 leading-snug">
            Remove {toDelete.name} from products? Its stock batches ({remainingStock(toDelete.id)} cs) are removed too. Old bills that already contain it are not changed.
          </p>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-semibold text-slate-700 block">
              Reason for deleting *
            </label>
            <span className={`text-xs font-medium tabular-nums ${delReasonOk ? "text-emerald-700" : "text-amber-700"}`}>
              {deleteReason.trim().length}/4 min chars
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["Discontinued SKU", "Duplicate item", "Wrong entry", "Test product"].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setDeleteReason(preset)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                  deleteReason.trim().toLowerCase() === preset.toLowerCase()
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
          <textarea
            rows={2}
            value={deleteReason}
            onChange={(e) => setDeleteReason(e.target.value)}
            placeholder="e.g. Discontinued SKU, duplicate item, test entry"
            className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none font-sans"
          />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => setToDelete(null)}
            className="rt-btn-outline rt-btn-outline--primary"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!delReasonOk}
            onClick={() => {
              deleteProduct(toDelete.id, deleteReason.trim());
              setToDelete(null);
              setFormOpen(false);
              setEditingId(null);
              setDetailProductId(null);
            }}
            className="rt-btn rt-btn--due disabled:opacity-45 disabled:cursor-not-allowed"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  ) : null;

  /* ─── Phone Screen 3 & 4: New / Edit product form ─── */
  if (formOpen) {
    return (
      <ProductsPhoneForm
        editingId={editingId}
        form={form}
        setForm={setForm}
        setField={setField}
        formError={formError}
        setFormError={setFormError}
        phoneFormBodyRef={phoneFormBodyRef}
        landedPreview={landedPreview}
        warehouses={warehouses}
        products={products}
        setFormOpen={setFormOpen}
        setToDelete={setToDelete}
        handleSave={handleSave}
        phoneDeleteSheet={phoneDeleteSheet}
      />
    );
  }

  /* ─── Phone Screen 5: Product details (read-only overview) ─── */
  if (detailProduct) {
    const p = detailProduct;
    const liveStock = remainingStock(p.id);
    const whStock = productWarehouseStock(p.id).filter((r) => r.crates !== 0);
    const batchLines = productBatchLines(p.id);
    const visibleBatches = batchLines.filter((b) => b.availableQty > 0);
    const isNonGst = p.taxability === "non_gst";
    const gstFrac = isNonGst ? 0 : resolveProductGstRate(p);
    const landedCost =
      Number(p.landedCostPerCrate) ||
      Math.round(
        ((Number(p.cost) || 0) * (1 + gstFrac) +
          (Number(p.labourCost) || 0) +
          (Number(p.freightCost) || 0)) *
          100,
      ) / 100;
    const unitsPerCase = Math.max(1, Number(p.unitsPerCrate) || 1);
    const landedPerUnit =
      Number(p.landedCostPerUnit) || Math.round((landedCost / unitsPerCase) * 100) / 100;
    const retailAmt = Number(p.retail) || 0;
    const marginPct =
      landedCost > 0 && retailAmt > 0
        ? Math.round(((retailAmt - landedCost) / landedCost) * 100)
        : null;
    const whSummary =
      whStock.length > 0
        ? whStock.map((w) => `${w.warehouseName} ${w.crates}`).join(" · ")
        : "No batches";

    return (
      <div id="view-products" className="rt-flow-phone">
        <header className="hh-sales-top">
          <div className="hh-sales-top__row">
            <button
              type="button"
              className="rt-back-link min-w-0 flex-1"
              onClick={() => setDetailProductId(null)}
            >
              <ChevronLeft size={20} strokeWidth={2.5} aria-hidden="true" />
              <span className="truncate">{nameFromMap(productNameMap, p, language)}</span>
            </button>
            <span
              className={
                p.active !== false ? "hh-set-badge-green shrink-0" : "hh-set-badge-slate shrink-0"
              }
            >
              {p.active !== false ? "Active" : "Inactive"}
            </span>
          </div>
        </header>

        <div className="rt-flow-phone__body space-y-3">
          {/* Hero pricing & stock summary */}
          <div className="rt-card space-y-2.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-slate-500">
                  Retail rate
                </div>
                <div className="flex items-baseline gap-1 mt-0.5 tabular-nums">
                  <span className="text-[26px] font-black text-slate-900 leading-none">
                    ₹{money(retailAmt)}
                  </span>
                  <span className="text-[12px] font-semibold text-slate-500">
                    / case
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold text-slate-500">
                  Margin
                </div>
                <div
                  className="text-[16px] font-extrabold tabular-nums mt-1"
                  style={{
                    color:
                      marginPct != null && marginPct > 0
                        ? "var(--paid)"
                        : marginPct != null && marginPct < 0
                          ? "var(--due)"
                          : "var(--text)",
                  }}
                >
                  {marginPct != null ? `${marginPct}%` : "—"}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-2.5 grid grid-cols-3 gap-2">
              <div>
                <div className="text-xs font-semibold text-slate-500">In stock</div>
                <div className="text-[14px] font-extrabold text-slate-900 tabular-nums mt-0.5">
                  {liveStock} cs
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500">Reorder at</div>
                <div className="text-[14px] font-extrabold text-slate-900 tabular-nums mt-0.5">
                  {(p as any).reorderLevel ? `${(p as any).reorderLevel} cs` : "—"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold text-slate-500">Landed</div>
                <div className="text-[14px] font-extrabold text-slate-900 tabular-nums mt-0.5">
                  ₹{money(landedCost)}
                </div>
              </div>
            </div>
          </div>

          {/* Stock by godown */}
          <div className="rt-card space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13.5px] font-extrabold text-slate-900">
                Stock by godown
              </span>
              <span className="text-xs font-medium text-slate-500 truncate">
                {whSummary}
              </span>
            </div>

            {visibleBatches.length === 0 ? (
              <div className="text-[12.5px] text-slate-500 py-1">
                {liveStock > 0
                  ? `${liveStock} cs opening / unbatched stock`
                  : "No active batches in stock"}
              </div>
            ) : (
              <div className="divide-y divide-dashed divide-slate-200">
                {visibleBatches.map((b) => {
                  const days = b.daysLeft;
                  const badgeStyle =
                    days == null
                      ? null
                      : days < 0
                        ? { bg: "#fee2e2", fg: "#b91c1c", label: "Expired" }
                        : days <= 30
                          ? { bg: "#fef3c7", fg: "#92400e", label: `${days}d` }
                          : days <= 90
                            ? { bg: "#e0f2fe", fg: "#0369a1", label: `${days}d` }
                            : { bg: "#f1f5f9", fg: "#475569", label: `${days}d` };
                  return (
                    <div
                      key={b.key}
                      className="py-2 flex items-center justify-between gap-2 text-[12.5px]"
                    >
                      <span className="min-w-0 truncate text-slate-800">
                        <strong className="font-bold">{b.batchNumber}</strong> ·{" "}
                        {b.warehouseName}
                      </span>
                      <span className="shrink-0 inline-flex items-center gap-1.5 font-bold text-slate-900 tabular-nums">
                        <span>{b.availableQty} cs</span>
                        {badgeStyle && (
                          <span
                            className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: badgeStyle.bg, color: badgeStyle.fg }}
                          >
                            {badgeStyle.label}
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Codes and tax */}
          <div className="rt-card space-y-2">
            <div className="text-[13.5px] font-extrabold text-slate-900">
              Codes and tax
            </div>
            <div className="space-y-1.5 text-[12.5px]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">SKU</span>
                <span className="font-bold text-slate-900">{p.sku || "—"}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Brand</span>
                <span className="font-bold text-slate-900">{p.brand || "—"}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">HSN</span>
                <span className="font-bold text-slate-900 tabular-nums">
                  {isNonGst ? p.hsn || "Optional (Non-GST)" : resolveProductHsn(p) || "—"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">GST / Cess</span>
                <span className="font-bold text-slate-900 tabular-nums">
                  {isNonGst
                    ? "0% (Non-GST)"
                    : `${Math.round(gstFrac * 100)}% / 0%`}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Pack</span>
                <span className="font-bold text-slate-900">
                  {unitsPerCase} {p.pack || "pcs"} per case
                </span>
              </div>
            </div>
          </div>

          {/* Price list */}
          <div className="rt-card space-y-2">
            <div className="text-[13.5px] font-extrabold text-slate-900">
              Price list (₹ / case)
            </div>
            <div className="space-y-1.5 text-[12.5px]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">MRP (per unit)</span>
                <span className="font-bold text-slate-900 tabular-nums">
                  {(p as any).mrp ? money((p as any).mrp) : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Retail</span>
                <span className="font-bold text-slate-900 tabular-nums">
                  {money(p.retail || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Wholesale</span>
                <span className="font-bold text-slate-900 tabular-nums">
                  {money(p.wholesale || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Special</span>
                <span className="font-bold text-slate-900 tabular-nums">
                  {(p as any).special ? money((p as any).special) : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Cost */}
          <div className="rt-card space-y-2">
            <div className="text-[13.5px] font-extrabold text-slate-900">Cost</div>
            <div className="space-y-1.5 text-[12.5px]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">
                  {isNonGst ? "Purchase rate" : "Purchase rate (ex-GST)"}
                </span>
                <span className="font-bold text-slate-900 tabular-nums">
                  ₹{money(p.cost || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Labour + Freight</span>
                <span className="font-bold text-slate-900 tabular-nums">
                  ₹{money((Number(p.labourCost) || 0) + (Number(p.freightCost) || 0))}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Landed per case</span>
                <span className="font-bold text-slate-900 tabular-nums">
                  ₹{money(landedCost)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Landed per unit</span>
                <span className="font-bold text-slate-900 tabular-nums">
                  ₹{money(landedPerUnit)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="rt-flow-phone__footer grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => {
              setDetailProductId(null);
              setTab("grn");
            }}
            className="rt-btn-outline rt-btn-outline--primary"
          >
            Add stock
          </button>
          <button
            type="button"
            onClick={() => {
              setDetailProductId(null);
              openEdit(p);
            }}
            className="rt-btn"
          >
            Edit product
          </button>
        </div>
      </div>
    );
  }

  /* ─── Phone Screen 1 & 2: Products list & Bulk tax switch ─── */
  const nonGstCount = products.filter((p) => p.taxability === "non_gst").length;
  const isCompletelyEmpty = products.length === 0 && !searchTerm && filterCat === "all" && !bulkMode;

  return (
    <div id="view-products" className="w-full min-w-0 pb-28">
      <header className="hh-sales-top">
        <div className="hh-sales-top__row">
          <h1 className="hh-sales-top__title">Products</h1>
          <div className="flex items-center gap-1.5 shrink-0">
            {!isCompletelyEmpty && (
              <button
                type="button"
                onClick={() => {
                  setBulkMode((v) => !v);
                  setSelectedIds([]);
                }}
                className="hh-sales-top__pill"
                style={{ maxWidth: "none" }}
              >
                {bulkMode ? "Exit bulk switch" : "Bulk tax switch"}
              </button>
            )}
            {!bulkMode && (
              <button
                type="button"
                onClick={openAdd}
                aria-label="Add product"
                className="hh-sales-top__accent-plus"
              >
                <span className="hh-sales-top__accent-plus__circle">
                  <Plus size={18} strokeWidth={2.6} aria-hidden="true" />
                </span>
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="space-y-3">
        {isCompletelyEmpty ? (
          <div className="rt-card text-center py-10 px-5 space-y-3">
            <div className="flex justify-center">
              <PackIcon pack="bottle" name="soda" />
            </div>
            <div>
              <div className="text-[17px] font-extrabold text-slate-900">
                No products yet
              </div>
              <p className="text-[13px] text-slate-500 mt-1 max-w-xs mx-auto leading-snug">
                Add your beverages with HSN, GST rate and prices.
              </p>
            </div>
            <button type="button" onClick={openAdd} className="rt-btn w-full">
              <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
              <span>Add product</span>
            </button>
          </div>
        ) : (
          <>
            <div className="rt-search-bar">
              <Search size={16} className="text-slate-400 shrink-0" aria-hidden="true" />
              <input
                enterKeyHint="search"
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search name, brand, SKU"
                aria-label="Search products"
              />
              {searchTerm && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearchTerm("")}
                  className="p-1 text-slate-400 cursor-pointer shrink-0"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            <div
              className="flex gap-1.5 overflow-x-auto no-scrollbar"
              role="group"
              aria-label="Category filter"
            >
              <button
                type="button"
                aria-pressed={filterCat === "all"}
                onClick={() => setFilterCat("all")}
                className="rt-chip shrink-0"
              >
                All
              </button>
              <button
                type="button"
                aria-pressed={filterCat === "non_gst"}
                onClick={() => setFilterCat("non_gst")}
                className="rt-chip shrink-0"
              >
                Non-GST ({nonGstCount})
              </button>
              {(Object.keys(CATS) as CategoryKey[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={filterCat === k}
                  onClick={() => setFilterCat(k)}
                  className="rt-chip shrink-0"
                >
                  {CATS[k].name.split(/[\/&]/)[0].trim()}
                </button>
              ))}
            </div>

            {bulkMode && (
              <div className="rt-nongst-box space-y-2.5">
                <div className="text-[12.5px] font-semibold text-amber-950 leading-snug">
                  Tap products below to switch between{" "}
                  <strong className="font-bold">Non-GST Trading (NG-...)</strong> and{" "}
                  <strong className="font-bold">GST Taxable</strong>. ({selectedIds.length}{" "}
                  selected)
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const visibleIds = filtered.map((p) => p.id);
                    const allSelected =
                      visibleIds.length > 0 &&
                      visibleIds.every((id) => selectedIds.includes(id));
                    setSelectedIds(allSelected ? [] : visibleIds);
                  }}
                  className="w-full min-h-[38px] rounded-full bg-white border border-amber-400 text-[12.5px] font-bold text-amber-900 cursor-pointer"
                >
                  {filtered.length > 0 &&
                  filtered.every((p) => selectedIds.includes(p.id))
                    ? "Clear visible"
                    : `Select visible (${filtered.length})`}
                </button>
              </div>
            )}

            {filtered.length === 0 ? (
              <div className="rt-card text-center py-8 px-4 space-y-2.5">
                <div className="text-[15px] font-extrabold text-slate-900">
                  No products match
                </div>
                <div className="text-[12.5px] text-slate-500">
                  Try another search term or category filter.
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm("");
                    setFilterCat("all");
                  }}
                  className="rt-btn-outline rt-btn-outline--primary"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="space-y-2 hh-tgrid-2">
                {filtered.map((p) => {
                  const isSelected = selectedIds.includes(p.id);
                  const displayName = nameFromMap(productNameMap, p, language);
                  const subtitle =
                    [
                      p.brand,
                      p.sku,
                      CATS[p.category]?.name,
                      p.taxability === "non_gst" ? "0% GST (Trading)" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—";

                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        bulkMode ? toggleSelectProduct(p.id) : setDetailProductId(p.id)
                      }
                      className="rt-card w-full text-left flex items-center gap-2.5 cursor-pointer"
                      style={
                        bulkMode && isSelected
                          ? {
                              border: "1.5px solid #d97706",
                              background: "#fffdf5",
                            }
                          : undefined
                      }
                    >
                      {bulkMode && (
                        <span
                          className="shrink-0 inline-flex items-center justify-center rounded-md"
                          style={{
                            width: "20px",
                            height: "20px",
                            background: isSelected ? "#d97706" : "#ffffff",
                            border: isSelected ? "1.5px solid #d97706" : "1.5px solid #cbd5e1",
                            color: "#ffffff",
                          }}
                        >
                          {isSelected ? <Check size={14} strokeWidth={3} /> : null}
                        </span>
                      )}

                      <PackIcon pack={p.pack} name={p.name} />

                      <div className="min-w-0 flex-1">
                        <div className="text-[13.5px] font-extrabold text-slate-900 leading-snug break-words">
                          <span>{displayName}</span>{" "}
                          <SizeChip
                            volume={p.volume}
                            pack={p.pack}
                            name={displayName}
                            className="align-middle ml-1"
                          />
                          {p.taxability === "non_gst" && (
                            <span
                              className="inline-block align-middle ml-1.5 px-1.5 py-0.5 rounded-md text-xs font-bold"
                              style={{
                                background: "#fef3c7",
                                color: "#92400e",
                                border: "1px solid #f59e0b",
                              }}
                            >
                              Non-GST
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 leading-tight mt-0.5 break-words">
                          {subtitle}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-[14px] font-extrabold text-slate-900 tabular-nums">
                          ₹{money(p.retail || p.wholesale || 0)}
                        </div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                          RETAIL
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {filterCat === "non_gst" && filtered.length > 0 && (
              <p className="text-xs text-slate-500 px-0.5 leading-snug">
                Non-GST items print on a separate Cash Memo (NG-...) and stay out of GST returns.
              </p>
            )}
          </>
        )}
      </div>

      {bulkMode && selectedIds.length > 0 && (
        <div className="rt-bulk-dock">
          <span className="text-[12px] font-extrabold tabular-nums shrink-0">
            {selectedIds.length} selected
          </span>
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              type="button"
              onClick={() => {
                const count = bulkSetProductTaxability(selectedIds, "non_gst");
                notify(
                  `${count} product${count === 1 ? "" : "s"} marked Non-GST / Trading (0% GST).`,
                );
                setSelectedIds([]);
                setBulkMode(false);
              }}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer shrink-0"
              style={{
                background: "#f59e0b",
                color: "#101d3a",
                minHeight: "36px",
              }}
            >
              Mark Non-GST (0%)
            </button>
            <button
              type="button"
              onClick={() => {
                const count = bulkSetProductTaxability(selectedIds, "taxable");
                notify(
                  `${count} product${count === 1 ? "" : "s"} restored to GST Taxable.`,
                );
                setSelectedIds([]);
                setBulkMode(false);
              }}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer shrink-0"
              style={{
                background: "#22c55e",
                color: "#052e16",
                minHeight: "36px",
              }}
            >
              Mark GST Taxable
            </button>
          </div>
        </div>
      )}

      {phoneDeleteSheet}
    </div>
  );
};
