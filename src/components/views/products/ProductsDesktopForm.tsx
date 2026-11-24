import React from 'react';
import { Trash2, X } from 'lucide-react';
import { CategoryKey, Product, Warehouse } from '../../../types';
import { CATS } from '../../../constants/initialData';
import { CASE_PACK_SIZES, gstRateFromHsn, money } from '../../../utils/billing';
import {
  Field,
  GST_OPTIONS,
  LandedPreview,
  ProductFormState,
  rateToGstLabel,
  ToggleRow,
} from './productsShared';

interface ProductsDesktopFormProps {
  editingId: number | null;
  form: ProductFormState;
  setForm: React.Dispatch<React.SetStateAction<ProductFormState>>;
  setField: <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) => void;
  formError: string | null;
  landedPreview: LandedPreview;
  warehouses: Warehouse[];
  products: Product[];
  setFormOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setToDelete: React.Dispatch<React.SetStateAction<Product | null>>;
  handleSave: () => void;
}

export const ProductsDesktopForm: React.FC<ProductsDesktopFormProps> = ({
  editingId,
  form,
  setForm,
  setField,
  formError,
  landedPreview,
  warehouses,
  products,
  setFormOpen,
  setToDelete,
  handleSave,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-[var(--bg)] flex flex-col">
      <div className="sticky top-0 z-10 bg-[var(--bg)] border-b border-black/5 px-4 sm:px-6 py-3 flex items-center justify-between max-w-none lg:max-w-3xl mx-auto w-full">
        <h1 className="text-lg font-bold text-slate-900">
          {editingId != null ? "Edit product" : "New product"}
        </h1>
        <button
          type="button"
          onClick={() => setFormOpen(false)}
          className="p-2 rounded-full hover:bg-black/5 cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-slate-600" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 pb-28 max-w-none lg:max-w-3xl mx-auto w-full space-y-4">
        {formError && (
          <div className="text-sm font-medium text-rose-700 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
            {formError}
          </div>
        )}

        <Field label="Name (English)">
          <input
            className="crate-input uppercase"
            value={form.name}
            onChange={(e) => setField("name", e.target.value.toUpperCase())}
            autoFocus
          />
        </Field>

        <Field label="Name (Odia / ଓଡ଼ିଆ) — optional">
          <input
            className="crate-input"
            value={form.nameOr}
            onChange={(e) => setField("nameOr", e.target.value)}
            placeholder="ଉଦାହରଣ: ଆପଲ୍ ଫିଜ୍"
            dir="auto"
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="SKU / Code">
            <input
              className="crate-input"
              value={form.sku}
              onChange={(e) => setField("sku", e.target.value)}
            />
          </Field>
          <Field label="Brand">
            <input
              className="crate-input"
              value={form.brand}
              onChange={(e) => setField("brand", e.target.value)}
            />
          </Field>
        </div>

        {/* Tax regime toggle */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Tax Applicability
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {form.taxability === "non_gst"
                  ? "Non-GST / Trading item: 0% GST, prints on separate Cash Memo (NG-...) & excluded from GST returns."
                  : "GST taxable item: HSN & GST slab apply normally."}
              </p>
            </div>
            <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setForm((f) => {
                    const inferred = f.hsn.length === 8 ? gstRateFromHsn(f.hsn) : null;
                    const fallback = inferred ?? CATS[f.category]?.gst ?? 0.18;
                    return {
                      ...f,
                      taxability: "taxable",
                      gstPct: f.gstPct === "0%" ? rateToGstLabel(fallback) : f.gstPct,
                    };
                  });
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  form.taxability !== "non_gst"
                    ? "bg-[var(--primary)] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                GST Product
              </button>
              <button
                type="button"
                onClick={() => {
                  setForm((f) => ({
                    ...f,
                    taxability: "non_gst",
                    gstPct: "0%",
                    cessPct: "0",
                    ratesIncludeGst: false,
                  }));
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  form.taxability === "non_gst"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Non-GST Product
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Category">
            <input
              className="crate-input"
              placeholder="Soft drink, Juice, Water..."
              value={form.categoryText}
              onChange={(e) => {
                const t = e.target.value;
                setField("categoryText", t);
                const lower = t.toLowerCase();
                let key: CategoryKey = "general";
                if (lower.includes("energy")) key = "energy";
                else if (lower.includes("soda") || lower.includes("carbon"))
                  key = "vibe";
                else if (lower.includes("juice") || lower.includes("joos"))
                  key = "joos";
                else if (lower.includes("water")) key = "water";
                setField("category", key);
                if (form.taxability !== "non_gst" && !form.hsn) {
                  setField("hsn", CATS[key]?.hsn || "");
                  setField("gstPct", rateToGstLabel(CATS[key]?.gst));
                }
              }}
            />
          </Field>
          <Field label={form.taxability === "non_gst" ? "HSN (optional for Non-GST)" : "HSN"}>
            <input
              className="crate-input"
              value={form.hsn}
              inputMode="numeric"
              placeholder={form.taxability === "non_gst" ? "Optional" : "e.g. 22021090"}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9]/g, "");
                setField("hsn", v);
                if (form.taxability !== "non_gst") {
                  const known = v.length === 8 ? gstRateFromHsn(v) : null;
                  if (known != null) setField("gstPct", rateToGstLabel(known));
                }
              }}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="GST %">
            {form.taxability === "non_gst" ? (
              <div className="crate-input bg-slate-50 text-slate-500 font-semibold flex items-center justify-between">
                <span>0% (Non-GST)</span>
                <span className="text-xs uppercase tracking-wide text-amber-700">Tax Free</span>
              </div>
            ) : (
              <>
                <select
                  className="crate-input"
                  value={form.gstPct}
                  onChange={(e) => setField("gstPct", e.target.value)}
                >
                  {(GST_OPTIONS.includes(form.gstPct) ? GST_OPTIONS : [...GST_OPTIONS, form.gstPct]).map((g) => (
                    <option key={g} value={g}>
                      {g}
                      {GST_OPTIONS.includes(g) ? "" : " (old rate - please change)"}
                    </option>
                  ))}
                </select>
                {(() => {
                  const expect = form.hsn.length >= 6 ? gstRateFromHsn(form.hsn) : null;
                  if (expect == null || rateToGstLabel(expect) === form.gstPct) return null;
                  return (
                    <p className="text-xs text-amber-700 mt-1">
                      HSN {form.hsn} is normally {rateToGstLabel(expect)} - check the rate.
                    </p>
                  );
                })()}
              </>
            )}
          </Field>
          <Field label="Cess %">
            <input
              className="crate-input disabled:bg-slate-50 disabled:text-slate-400"
              inputMode="decimal"
              disabled={form.taxability === "non_gst"}
              value={form.taxability === "non_gst" ? "0" : form.cessPct}
              onChange={(e) => setField("cessPct", e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Unit">
            <input
              className="crate-input"
              value={form.unit}
              onChange={(e) => setField("unit", e.target.value)}
            />
          </Field>
          <Field label="Units per case">
            <input
              className="crate-input"
              inputMode="numeric"
              value={form.unitsPerCase}
              onChange={(e) => setField("unitsPerCase", e.target.value)}
            />
            <div className="flex gap-1.5 mt-1.5">
              {CASE_PACK_SIZES.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setField("unitsPerCase", String(n))}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border cursor-pointer ${
                    String(n) === String(form.unitsPerCase)
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-700 border-slate-300"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="MRP">
            <input
              className="crate-input"
              inputMode="decimal"
              value={form.mrp}
              onChange={(e) => setField("mrp", e.target.value)}
            />
          </Field>
          <Field label={form.taxability === "non_gst" ? "Purchase rate (₹/case)" : form.ratesIncludeGst ? "Purchase rate incl. GST (₹/case)" : "Purchase rate ex-GST (₹/case)"}>
            <input
              className="crate-input tabular-nums"
              inputMode="decimal"
              value={form.purchaseRate}
              onChange={(e) => setField("purchaseRate", e.target.value)}
            />
          </Field>
        </div>

        {/* Manual Labour & Freight + Auto-Decided Landed Price */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Handling &amp; Auto-Decided Landed Cost
            </span>
            {form.taxability !== "non_gst" && (
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.ratesIncludeGst}
                  onChange={(e) => setField("ratesIncludeGst", e.target.checked)}
                  className="rounded border-slate-300 accent-[var(--primary)]"
                />
                Purchase rate includes GST
              </label>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Labour (₹ / case)">
              <input
                className="crate-input tabular-nums"
                inputMode="decimal"
                placeholder="0"
                value={form.labourCost}
                onChange={(e) => setField("labourCost", e.target.value)}
              />
            </Field>
            <Field label="Freight (₹ / case)">
              <input
                className="crate-input tabular-nums"
                inputMode="decimal"
                placeholder="0"
                value={form.freightCost}
                onChange={(e) => setField("freightCost", e.target.value)}
              />
            </Field>
          </div>
          <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                Auto Landed Cost
              </div>
              <div className="flex items-baseline gap-2.5 mt-0.5 tabular-nums">
                <span className="text-base font-bold text-slate-900">
                  ₹{money(landedPreview.landedPerCase)} <span className="text-xs font-medium text-slate-500">/ case</span>
                </span>
                <span className="text-xs font-semibold text-emerald-800">
                  ₹{money(landedPreview.landedPerUnit)} / unit ({landedPreview.unitsPerCase} pcs)
                </span>
              </div>
              <div className="text-xs text-slate-600 mt-0.5 tabular-nums">
                {landedPreview.isNonGst
                  ? `Base ₹${money(landedPreview.exGstBase)} + Labour ₹${money(landedPreview.labour)} + Freight ₹${money(landedPreview.freight)} · Non-GST`
                  : `Ex-GST ₹${money(landedPreview.exGstBase)} + GST ₹${money(landedPreview.gstAmtPerCase)} + Labour ₹${money(landedPreview.labour)} + Freight ₹${money(landedPreview.freight)}`}
              </div>
            </div>
            {landedPreview.landedPerCase > 0 && (
              <button
                type="button"
                onClick={() => {
                  const baseForMargin = landedPreview.landedPerCase;
                  const ws = Math.round(baseForMargin * 1.15);
                  const rt = Math.round(baseForMargin * 1.25);
                  setForm((f) => ({
                    ...f,
                    wholesaleRate: String(ws),
                    retailRate: String(rt),
                  }));
                }}
                className="shrink-0 px-3 py-1.5 rounded-xl bg-white border border-emerald-300 text-emerald-800 text-xs font-semibold hover:bg-emerald-100/70 cursor-pointer"
              >
                Apply +15% W/S · +25% Retail
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Retail rate">
            <input
              className="crate-input tabular-nums"
              inputMode="decimal"
              value={form.retailRate}
              onChange={(e) => setField("retailRate", e.target.value)}
            />
          </Field>
          <Field label="Wholesale rate">
            <input
              className="crate-input tabular-nums"
              inputMode="decimal"
              value={form.wholesaleRate}
              onChange={(e) => setField("wholesaleRate", e.target.value)}
            />
          </Field>
        </div>

        {editingId == null && (
          <div className="rounded-2xl border border-slate-200 bg-white p-3.5 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Initial Opening Stock (Optional · Individual Entry)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Opening cases">
                <input
                  className="crate-input tabular-nums"
                  inputMode="numeric"
                  placeholder="0"
                  value={form.opening}
                  onChange={(e) => setField("opening", e.target.value)}
                />
              </Field>
              <Field label="Warehouse">
                <select
                  className="crate-input"
                  value={form.warehouseId}
                  onChange={(e) => setField("warehouseId", e.target.value)}
                >
                  <option value="">Default godown</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Batch / Lot no. (optional)">
                <input
                  className="crate-input font-mono"
                  placeholder="Auto-generated if blank"
                  value={form.batchNumber}
                  onChange={(e) => setField("batchNumber", e.target.value)}
                />
              </Field>
              <Field label="Expiry date (optional)">
                <input
                  type="date"
                  className="crate-input"
                  value={form.expiry}
                  onChange={(e) => setField("expiry", e.target.value)}
                />
              </Field>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Special rate">
            <input
              className="crate-input"
              inputMode="decimal"
              value={form.specialRate}
              onChange={(e) => setField("specialRate", e.target.value)}
            />
          </Field>
          <Field label="Reorder level">
            <input
              className="crate-input"
              inputMode="numeric"
              value={form.reorderLevel}
              onChange={(e) => setField("reorderLevel", e.target.value)}
            />
          </Field>
        </div>

        <Field label="Image URL">
          <input
            className="crate-input"
            value={form.imageUrl}
            onChange={(e) => setField("imageUrl", e.target.value)}
          />
        </Field>

        <div className="space-y-3 pt-1">
          <ToggleRow
            label="Returnable crates / bottles"
            on={form.returnable}
            onChange={(v) => setField("returnable", v)}
          />
          <ToggleRow
            label="Active"
            on={form.active}
            onChange={(v) => setField("active", v)}
          />
        </div>
      </div>

      <div className="sticky bottom-0 z-10 bg-[var(--bg)] border-t border-black/5 px-4 sm:px-6 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={handleSave}
          className="w-full max-w-none lg:max-w-3xl mx-auto block py-3.5 rounded-2xl bg-[var(--primary)] text-white font-semibold text-base shadow-sm cursor-pointer active:scale-[0.99]"
        >
          Save product
        </button>
        {editingId != null && (
          <button
            type="button"
            onClick={() => {
              const target = products.find((x) => x.id === editingId);
              if (!target) return;
              setFormOpen(false);
              setToDelete(target);
            }}
            className="w-full max-w-none lg:max-w-3xl mx-auto mt-2 flex items-center justify-center gap-2 py-3 rounded-2xl border border-red-200 bg-white text-red-600 font-semibold text-sm cursor-pointer active:scale-[0.99]"
          >
            <Trash2 className="w-4 h-4" />
            Delete product
          </button>
        )}
      </div>

      <style>{`
        .crate-input {
          width: 100%;
          padding: 0.65rem 0.9rem;
          border-radius: 0.85rem;
          border: 1px solid rgba(0,0,0,0.08);
          background: #fff;
          font-size: 0.9rem;
          color: #1e293b;
          outline: none;
        }
        .crate-input:focus {
          border-color: rgba(13, 74, 58, 0.45);
          box-shadow: 0 0 0 3px rgba(13, 74, 58, 0.12);
        }
      `}</style>
    </div>
  );
};
