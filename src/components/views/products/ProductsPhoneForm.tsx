import React from 'react';
import { ChevronDown, X } from 'lucide-react';
import { CategoryKey, Product, Warehouse } from '../../../types';
import { CATS } from '../../../constants/initialData';
import { CASE_PACK_SIZES, gstRateFromHsn, money } from '../../../utils/billing';
import {
  GST_OPTIONS,
  LandedPreview,
  ProductFormState,
  rateToGstLabel,
} from './productsShared';

interface ProductsPhoneFormProps {
  editingId: number | null;
  form: ProductFormState;
  setForm: React.Dispatch<React.SetStateAction<ProductFormState>>;
  setField: <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) => void;
  formError: string | null;
  setFormError: React.Dispatch<React.SetStateAction<string | null>>;
  phoneFormBodyRef: React.RefObject<HTMLDivElement | null>;
  landedPreview: LandedPreview;
  warehouses: Warehouse[];
  products: Product[];
  setFormOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setToDelete: React.Dispatch<React.SetStateAction<Product | null>>;
  handleSave: () => void;
  phoneDeleteSheet: React.ReactNode;
}

export const ProductsPhoneForm: React.FC<ProductsPhoneFormProps> = ({
  editingId,
  form,
  setForm,
  setField,
  formError,
  setFormError,
  phoneFormBodyRef,
  landedPreview,
  warehouses,
  products,
  setFormOpen,
  setToDelete,
  handleSave,
  phoneDeleteSheet,
}) => {
  const hsnInvalid = Boolean(formError && formError.toLowerCase().includes("hsn"));
  const nameInvalid = Boolean(formError && formError.toLowerCase().includes("name"));
  const expectedGst = form.hsn.length >= 6 ? gstRateFromHsn(form.hsn) : null;
  const gstMismatch =
    form.taxability !== "non_gst" &&
    expectedGst != null &&
    rateToGstLabel(expectedGst) !== form.gstPct;

  return (
    <div id="view-products" className="rt-flow-phone">
      <header className="hh-sales-top">
        <div className="hh-sales-top__row">
          <h1 className="hh-sales-top__title">
            {editingId != null ? "Edit product" : "New product"}
          </h1>
          <button
            type="button"
            onClick={() => setFormOpen(false)}
            aria-label="Close"
            className="hh-sales-top__iconbtn"
          >
            <X size={20} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div ref={phoneFormBodyRef} className="rt-flow-phone__body space-y-2.5">
        {formError && <div className="rt-err-box">{formError}</div>}

        <div className={`rt-in${nameInvalid ? " rt-in--err" : ""}`}>
          <label className="rt-in__label" htmlFor="ph-prod-name">
            NAME (ENGLISH)
          </label>
          <input
            id="ph-prod-name"
            type="text"
            className="rt-in__control uppercase"
            value={form.name}
            onChange={(e) => {
              setField("name", e.target.value.toUpperCase());
              if (formError) setFormError(null);
            }}
            placeholder="e.g. APPLE FIZZ 250ML"
            autoFocus={editingId == null}
          />
        </div>

        <div className="rt-in">
          <label className="rt-in__label" htmlFor="ph-prod-name-or">
            NAME (ODIA / ଓଡ଼ିଆ), OPTIONAL
          </label>
          <input
            id="ph-prod-name-or"
            type="text"
            className="rt-in__control"
            value={form.nameOr}
            onChange={(e) => setField("nameOr", e.target.value)}
            placeholder="ଉଦାହରଣ: ଆପଲ୍ ଫିଜ୍"
            dir="auto"
          />
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="rt-in">
            <label className="rt-in__label" htmlFor="ph-prod-sku">
              SKU / CODE
            </label>
            <input
              id="ph-prod-sku"
              type="text"
              className="rt-in__control"
              value={form.sku}
              onChange={(e) => setField("sku", e.target.value)}
            />
          </div>
          <div className="rt-in">
            <label className="rt-in__label" htmlFor="ph-prod-brand">
              BRAND
            </label>
            <input
              id="ph-prod-brand"
              type="text"
              className="rt-in__control"
              value={form.brand}
              onChange={(e) => setField("brand", e.target.value)}
            />
          </div>
        </div>

        <div className="rt-in">
          <label className="rt-in__label" htmlFor="ph-prod-cat">
            CATEGORY
          </label>
          <input
            id="ph-prod-cat"
            type="text"
            className="rt-in__control"
            placeholder="Soft drink, Juice, Water..."
            value={form.categoryText}
            onChange={(e) => {
              const t = e.target.value;
              setField("categoryText", t);
              const lower = t.toLowerCase();
              let key: CategoryKey = "general";
              if (lower.includes("energy")) key = "energy";
              else if (lower.includes("soda") || lower.includes("carbon")) key = "vibe";
              else if (lower.includes("juice") || lower.includes("joos")) key = "joos";
              else if (lower.includes("water")) key = "water";
              setField("category", key);
              if (form.taxability !== "non_gst" && !form.hsn) {
                setField("hsn", CATS[key]?.hsn || "");
                setField("gstPct", rateToGstLabel(CATS[key]?.gst));
              }
            }}
          />
        </div>

        <div className={form.taxability === "non_gst" ? "rt-nongst-box space-y-2.5" : "rt-in space-y-2.5"}>
          <div>
            <div className="rt-in__label">TAX APPLICABILITY</div>
            <p className="text-xs text-slate-600 mt-0.5 leading-snug">
              {form.taxability === "non_gst"
                ? "Non-GST / Trading item: 0% GST, prints on separate Cash Memo (NG-...) & excluded from GST returns."
                : "GST taxable item: HSN & GST slab apply normally."}
            </p>
          </div>
          <div className="hh-set-seg2" role="group" aria-label="Tax applicability">
            <button
              type="button"
              aria-pressed={form.taxability !== "non_gst"}
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
              className="hh-set-seg2__btn"
            >
              GST Taxable
            </button>
            <button
              type="button"
              aria-pressed={form.taxability === "non_gst"}
              onClick={() => {
                setForm((f) => ({
                  ...f,
                  taxability: "non_gst",
                  gstPct: "0%",
                  cessPct: "0",
                  ratesIncludeGst: false,
                }));
                if (formError && formError.toLowerCase().includes("hsn")) {
                  setFormError(null);
                }
              }}
              className="hh-set-seg2__btn"
            >
              Non-GST / Trading
            </button>
          </div>
        </div>

        <div className={`rt-in${hsnInvalid ? " rt-in--err" : ""}`}>
          <label className="rt-in__label" htmlFor="ph-prod-hsn">
            {form.taxability === "non_gst" ? "HSN (OPTIONAL FOR NON-GST)" : "HSN"}
          </label>
          <input
            id="ph-prod-hsn"
            type="text"
            inputMode="numeric"
            className="rt-in__control"
            value={form.hsn}
            placeholder={form.taxability === "non_gst" ? "Optional" : "e.g. 22021090"}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9]/g, "");
              setField("hsn", v);
              if (formError && formError.toLowerCase().includes("hsn")) {
                setFormError(null);
              }
              if (form.taxability !== "non_gst") {
                const known = v.length === 8 ? gstRateFromHsn(v) : null;
                if (known != null) setField("gstPct", rateToGstLabel(known));
              }
            }}
          />
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="rt-in">
            <label className="rt-in__label" htmlFor="ph-prod-gst">
              GST %
            </label>
            {form.taxability === "non_gst" ? (
              <div className="rt-in__control flex items-center text-slate-500">
                0% (Non-GST)
              </div>
            ) : (
              <div className="rt-in__select-wrap">
                <select
                  id="ph-prod-gst"
                  className="rt-in__control"
                  value={form.gstPct}
                  onChange={(e) => setField("gstPct", e.target.value)}
                >
                  {(GST_OPTIONS.includes(form.gstPct)
                    ? GST_OPTIONS
                    : [...GST_OPTIONS, form.gstPct]
                  ).map((g) => (
                    <option key={g} value={g}>
                      {g}
                      {GST_OPTIONS.includes(g) ? "" : " (old rate)"}
                    </option>
                  ))}
                </select>
                <ChevronDown size={15} className="rt-in__select-chev" aria-hidden="true" />
              </div>
            )}
          </div>

          <div className="rt-in">
            <label className="rt-in__label" htmlFor="ph-prod-cess">
              CESS %
            </label>
            <input
              id="ph-prod-cess"
              type="text"
              inputMode="decimal"
              disabled={form.taxability === "non_gst"}
              className="rt-in__control disabled:text-slate-400"
              value={form.taxability === "non_gst" ? "0" : form.cessPct}
              onChange={(e) => setField("cessPct", e.target.value)}
            />
          </div>
        </div>

        {gstMismatch && (
          <p className="text-xs font-medium text-amber-800 px-0.5 -mt-1">
            HSN {form.hsn} is normally {rateToGstLabel(expectedGst)} - check the rate.
          </p>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          <div className="rt-in">
            <label className="rt-in__label" htmlFor="ph-prod-unit">
              UNIT
            </label>
            <input
              id="ph-prod-unit"
              type="text"
              className="rt-in__control"
              value={form.unit}
              onChange={(e) => setField("unit", e.target.value)}
            />
          </div>
          <div className="rt-in">
            <label className="rt-in__label" htmlFor="ph-prod-upc">
              UNITS PER CASE
            </label>
            <input
              id="ph-prod-upc"
              type="text"
              inputMode="numeric"
              className="rt-in__control"
              value={form.unitsPerCase}
              onChange={(e) => setField("unitsPerCase", e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {CASE_PACK_SIZES.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={String(n) === String(form.unitsPerCase)}
              onClick={() => setField("unitsPerCase", String(n))}
              className="rt-chip shrink-0"
              style={{ minHeight: "32px", padding: "0 11px", fontSize: "12px" }}
            >
              {n} pcs
            </button>
          ))}
        </div>

        <div className="rt-in">
          <label className="rt-in__label" htmlFor="ph-prod-mrp">
            MRP
          </label>
          <input
            id="ph-prod-mrp"
            type="text"
            inputMode="decimal"
            className="rt-in__control tabular-nums"
            value={form.mrp}
            onChange={(e) => setField("mrp", e.target.value)}
          />
        </div>

        {form.taxability !== "non_gst" && (
          <div className="flex items-center justify-between gap-3 py-1 px-0.5">
            <span className="text-[13.5px] font-bold text-slate-900">
              Rates include GST
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={form.ratesIncludeGst}
              aria-label="Rates include GST"
              onClick={() => setField("ratesIncludeGst", !form.ratesIncludeGst)}
              className="hh-switch"
            >
              <span className="hh-switch__thumb" />
            </button>
          </div>
        )}

        <div className="rt-in">
          <label className="rt-in__label" htmlFor="ph-prod-cost">
            {form.taxability === "non_gst"
              ? "PURCHASE RATE (₹/CASE)"
              : form.ratesIncludeGst
                ? "PURCHASE RATE INCL. GST (₹/CASE)"
                : "PURCHASE RATE EX-GST (₹/CASE)"}
          </label>
          <input
            id="ph-prod-cost"
            type="text"
            inputMode="decimal"
            className="rt-in__control tabular-nums"
            value={form.purchaseRate}
            onChange={(e) => setField("purchaseRate", e.target.value)}
          />
        </div>

        <div className="hh-set-section-lbl pt-1">
          HANDLING &amp; AUTO-DECIDED LANDED COST
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="rt-in">
            <label className="rt-in__label" htmlFor="ph-prod-labour">
              LABOUR (₹ / CASE)
            </label>
            <input
              id="ph-prod-labour"
              type="text"
              inputMode="decimal"
              className="rt-in__control tabular-nums"
              placeholder="0"
              value={form.labourCost}
              onChange={(e) => setField("labourCost", e.target.value)}
            />
          </div>
          <div className="rt-in">
            <label className="rt-in__label" htmlFor="ph-prod-freight">
              FREIGHT (₹ / CASE)
            </label>
            <input
              id="ph-prod-freight"
              type="text"
              inputMode="decimal"
              className="rt-in__control tabular-nums"
              placeholder="0"
              value={form.freightCost}
              onChange={(e) => setField("freightCost", e.target.value)}
            />
          </div>
        </div>

        <div className="rt-landed-card space-y-2">
          <div>
            <div className="rt-in__label" style={{ color: "var(--primary)" }}>
              AUTO LANDED COST
            </div>
            <div className="flex items-baseline gap-1.5 mt-0.5 tabular-nums">
              <span className="text-[22px] font-black text-slate-900 leading-tight">
                ₹{money(landedPreview.landedPerCase)}
              </span>
              <span className="text-[12px] font-semibold text-slate-500">
                / case
              </span>
            </div>
            <div className="text-xs text-slate-600 mt-1 tabular-nums leading-snug">
              {landedPreview.isNonGst
                ? `Base ₹${money(landedPreview.exGstBase)} + Labour ₹${money(landedPreview.labour)} + Freight ₹${money(landedPreview.freight)} · Non-GST`
                : `Ex-GST ₹${money(landedPreview.exGstBase)} + GST ₹${money(landedPreview.gstAmtPerCase)} + Labour ₹${money(landedPreview.labour)} + Freight ₹${money(landedPreview.freight)}`}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-2 space-y-1 text-[12.5px]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500 font-medium">Per unit</span>
              <span className="font-extrabold text-slate-900 tabular-nums">
                ₹{money(landedPreview.landedPerUnit)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500 font-medium">
                Effective cost (ex-GST)
              </span>
              <span className="font-extrabold text-slate-900 tabular-nums">
                ₹{money(landedPreview.effectiveCost)}
              </span>
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
              className="rt-link-btn w-full justify-center"
            >
              Suggest rates from landed cost
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="rt-in">
            <label className="rt-in__label" htmlFor="ph-prod-retail">
              RETAIL RATE
            </label>
            <input
              id="ph-prod-retail"
              type="text"
              inputMode="decimal"
              className="rt-in__control tabular-nums"
              value={form.retailRate}
              onChange={(e) => setField("retailRate", e.target.value)}
            />
          </div>
          <div className="rt-in">
            <label className="rt-in__label" htmlFor="ph-prod-ws">
              WHOLESALE RATE
            </label>
            <input
              id="ph-prod-ws"
              type="text"
              inputMode="decimal"
              className="rt-in__control tabular-nums"
              value={form.wholesaleRate}
              onChange={(e) => setField("wholesaleRate", e.target.value)}
            />
          </div>
        </div>

        <div className="rt-in">
          <label className="rt-in__label" htmlFor="ph-prod-special">
            SPECIAL RATE
          </label>
          <input
            id="ph-prod-special"
            type="text"
            inputMode="decimal"
            className="rt-in__control tabular-nums"
            value={form.specialRate}
            onChange={(e) => setField("specialRate", e.target.value)}
          />
        </div>

        {editingId == null && (
          <>
            <div className="hh-set-section-lbl pt-1">
              OPENING STOCK (NEW PRODUCTS ONLY)
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="rt-in">
                <label className="rt-in__label" htmlFor="ph-prod-opening">
                  OPENING CASES
                </label>
                <input
                  id="ph-prod-opening"
                  type="text"
                  inputMode="numeric"
                  className="rt-in__control tabular-nums"
                  placeholder="0"
                  value={form.opening}
                  onChange={(e) => setField("opening", e.target.value)}
                />
              </div>
              <div className="rt-in">
                <label className="rt-in__label" htmlFor="ph-prod-wh">
                  WAREHOUSE
                </label>
                <div className="rt-in__select-wrap">
                  <select
                    id="ph-prod-wh"
                    className="rt-in__control"
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
                  <ChevronDown size={15} className="rt-in__select-chev" aria-hidden="true" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="rt-in">
                <label className="rt-in__label" htmlFor="ph-prod-batch">
                  BATCH / LOT NO. (OPTIONAL)
                </label>
                <input
                  id="ph-prod-batch"
                  type="text"
                  className="rt-in__control font-mono"
                  placeholder="Auto-generated if blank"
                  value={form.batchNumber}
                  onChange={(e) => setField("batchNumber", e.target.value)}
                />
              </div>
              <div className="rt-in">
                <label className="rt-in__label" htmlFor="ph-prod-expiry">
                  EXPIRY DATE (OPTIONAL)
                </label>
                <input
                  id="ph-prod-expiry"
                  type="date"
                  className="rt-in__control"
                  value={form.expiry}
                  onChange={(e) => setField("expiry", e.target.value)}
                />
              </div>
            </div>
          </>
        )}

        <div className="rt-in">
          <label className="rt-in__label" htmlFor="ph-prod-reorder">
            REORDER LEVEL
          </label>
          <input
            id="ph-prod-reorder"
            type="text"
            inputMode="numeric"
            className="rt-in__control tabular-nums"
            value={form.reorderLevel}
            onChange={(e) => setField("reorderLevel", e.target.value)}
          />
        </div>

        <div className="rt-in">
          <label className="rt-in__label" htmlFor="ph-prod-img">
            IMAGE URL
          </label>
          <input
            id="ph-prod-img"
            type="text"
            className="rt-in__control"
            placeholder="https://..."
            value={form.imageUrl}
            onChange={(e) => setField("imageUrl", e.target.value)}
          />
        </div>

        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between gap-3 py-0.5">
            <span className="text-[13.5px] font-bold text-slate-900">
              Returnable crates / bottles
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={form.returnable}
              aria-label="Returnable crates / bottles"
              onClick={() => setField("returnable", !form.returnable)}
              className="hh-switch"
            >
              <span className="hh-switch__thumb" />
            </button>
          </div>
          <div className="flex items-center justify-between gap-3 py-0.5">
            <span className="text-[13.5px] font-bold text-slate-900">
              Active
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={form.active}
              aria-label="Active"
              onClick={() => setField("active", !form.active)}
              className="hh-switch"
            >
              <span className="hh-switch__thumb" />
            </button>
          </div>
        </div>

        {editingId != null && (
          <>
            <div className="rt-noti">
              Stock, batches and expiry are managed in Inventory. Editing a product never changes them.
            </div>
            <button
              type="button"
              onClick={() => {
                const target = products.find((x) => x.id === editingId);
                if (target) setToDelete(target);
              }}
              className="hh-set-btn-danger-outline w-full"
            >
              Delete product
            </button>
          </>
        )}
      </div>

      <div className="rt-flow-phone__footer grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => setFormOpen(false)}
          className="rt-btn-outline rt-btn-outline--primary"
        >
          Cancel
        </button>
        <button type="button" onClick={handleSave} className="rt-btn">
          {editingId != null ? "Save changes" : "Save product"}
        </button>
      </div>

      {phoneDeleteSheet}
    </div>
  );
};
