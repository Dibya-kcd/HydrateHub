import React from 'react';
import { AlertCircle, Check, Gift, Package, Plus } from 'lucide-react';
import { CATS } from '../../../constants/initialData';
import { CategoryKey, GRN, Product, SupplierScheme } from '../../../types';
import { money } from '../../../utils/billing';
import { defaultLineState, DraftLineState, DraftMetrics } from './inwardTypes';

interface InwardLineItemFormProps {
  lineFormRef: React.RefObject<HTMLDivElement | null>;
  editingIndex: number | null;
  setEditingIndex: React.Dispatch<React.SetStateAction<number | null>>;
  initialGrnToEdit?: GRN | null;
  setShowAddForm: React.Dispatch<React.SetStateAction<boolean>>;
  draftLine: DraftLineState;
  setDraftLine: React.Dispatch<React.SetStateAction<DraftLineState>>;
  palette: { line: string; navy: string; ink: string; amber: string };
  labelStyle: React.CSSProperties;
  products: Product[];
  matchingProduct?: Product;
  similarProduct?: Product;
  computedSku: string;
  handleSelectExisting: (prodId: number) => void;
  handleCategoryChange: (cat: CategoryKey) => void;
  metrics: DraftMetrics;
  draftPreviewInwardPerCrate: number;
  supplierSchemes: SupplierScheme[];
  lineValidationError: string | null;
  setLineValidationError: React.Dispatch<React.SetStateAction<string | null>>;
  handleAddDraftToReview: () => void;
}

export const InwardLineItemForm: React.FC<InwardLineItemFormProps> = ({
  lineFormRef,
  editingIndex,
  setEditingIndex,
  initialGrnToEdit,
  setShowAddForm,
  draftLine,
  setDraftLine,
  palette,
  labelStyle,
  products,
  matchingProduct,
  similarProduct,
  computedSku,
  handleSelectExisting,
  handleCategoryChange,
  metrics,
  draftPreviewInwardPerCrate,
  supplierSchemes,
  lineValidationError,
  setLineValidationError,
  handleAddDraftToReview,
}) => {
  return (
    <div
      ref={lineFormRef}
      className={`bg-white rounded-2xl border shadow-sm p-4 transition-all ${
        editingIndex !== null
          ? 'border-amber-400 ring-2 ring-amber-200 bg-amber-50/20'
          : 'border-black/5'
      }`}
    >
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-black/5">
        <div className="font-semibold text-sm flex items-center gap-2 text-slate-900">
          <Package size={16} className={editingIndex !== null ? 'text-amber-600' : 'text-[var(--primary)]'} />
          <span>
            {editingIndex !== null
              ? `✏️ Edit Item #${editingIndex + 1}: ${draftLine.productName}`
              : '+ Add product'}
          </span>
          {editingIndex !== null && (
            <span className="text-xs px-2 py-0.5 font-bold rounded bg-amber-500 text-white">
              Modifying Row #{editingIndex + 1}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {initialGrnToEdit && editingIndex === null && (
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-2 py-1 text-xs text-slate-500 hover:text-slate-800 border rounded cursor-pointer"
            >
              Hide Form
            </button>
          )}
        </div>
        <div className="flex border-2 p-0.5" style={{ borderColor: palette.line }}>
          <button
            type="button"
            onClick={() => setDraftLine((prev) => ({ ...prev, isNewProduct: false }))}
            className="px-2.5 py-1 text-xs font-bold cursor-pointer"
            style={{
              backgroundColor: !draftLine.isNewProduct ? palette.navy : 'transparent',
              color: !draftLine.isNewProduct ? '#FFFFFF' : palette.ink,
            }}
          >
            Existing Product
          </button>
          <button
            type="button"
            onClick={() => setDraftLine((prev) => ({ ...prev, isNewProduct: true }))}
            className="px-2.5 py-1 text-xs font-bold cursor-pointer"
            style={{
              backgroundColor: draftLine.isNewProduct ? palette.navy : 'transparent',
              color: draftLine.isNewProduct ? '#FFFFFF' : palette.ink,
            }}
          >
            + New Product
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-3">
        {!draftLine.isNewProduct ? (
          <div className="md:col-span-2">
            <label style={labelStyle}>Pick Existing Beverage</label>
            <select
              value={draftLine.selectedProductId || ''}
              onChange={(e) => handleSelectExisting(Number(e.target.value))}
              className="w-full border-2 px-3 py-1.5 text-sm font-semibold"
              style={{ borderColor: palette.line }}
            >
              <option value="">-- Choose Product --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="md:col-span-2">
            <label style={labelStyle}>Product Description *</label>
            <input
              value={draftLine.productName}
              onChange={(e) => {
                setDraftLine((prev) => ({ ...prev, productName: e.target.value.toUpperCase() }));
                if (lineValidationError) setLineValidationError(null);
              }}
              placeholder="e.g. CAMPA POWER UP 150ML"
              className="w-full border-2 px-3 py-1.5 font-bold text-sm uppercase"
              style={{ borderColor: palette.line }}
            />
            {matchingProduct && (
              <div className="text-xs text-emerald-700 font-semibold mt-1 flex items-center gap-1">
                <span>✓ Matches catalog product — will reuse SKU {matchingProduct.sku}</span>
              </div>
            )}
            {similarProduct && (
              <div className="mt-2 p-2 bg-amber-50 border border-amber-300 rounded text-xs text-amber-900 flex items-center justify-between gap-2">
                <div>
                  Similar product exists: <strong>{similarProduct.name}</strong> ({similarProduct.pack})
                </div>
                <button
                  type="button"
                  onClick={() => handleSelectExisting(similarProduct.id)}
                  className="px-2 py-0.5 bg-amber-200 hover:bg-amber-300 text-amber-950 font-bold rounded text-xs cursor-pointer"
                >
                  Use Existing
                </button>
              </div>
            )}
          </div>
        )}

        <div>
          <label style={labelStyle}>Category</label>
          <select
            value={draftLine.category}
            onChange={(e) => handleCategoryChange(e.target.value as CategoryKey)}
            className="w-full border-2 px-3 py-1.5 text-sm"
            style={{ borderColor: palette.line }}
          >
            {Object.entries(CATS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={labelStyle}>Auto SKU Preview</label>
          <div
            className="border-2 px-3 py-1.5 font-mono font-bold text-sm flex items-center justify-between"
            style={{ borderColor: palette.line, backgroundColor: `${palette.navy}08` }}
          >
            <span>{computedSku}</span>
            <span className="text-xs font-bold text-gray-500">Auto</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-100">
        <div className="inline-flex rounded-xl bg-slate-100 p-0.5 border border-slate-200">
          <button
            type="button"
            onClick={() =>
              setDraftLine((prev) => {
                const catDef = CATS[prev.category] || { hsn: '22021090', gst: 0.4 };
                const half = Math.round(((catDef.gst * 100) / 2) * 10) / 10;
                return {
                  ...prev,
                  taxability: 'taxable',
                  hsn: prev.hsn || catDef.hsn,
                  cgstPercent: prev.cgstPercent === 0 && prev.sgstPercent === 0 ? half : prev.cgstPercent,
                  sgstPercent: prev.cgstPercent === 0 && prev.sgstPercent === 0 ? half : prev.sgstPercent,
                };
              })
            }
            className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
              draftLine.taxability !== 'non_gst'
                ? 'bg-[var(--primary)] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            GST Product
          </button>
          <button
            type="button"
            onClick={() =>
              setDraftLine((prev) => ({
                ...prev,
                taxability: 'non_gst',
                isGstIncluded: false,
                cgstPercent: 0,
                sgstPercent: 0,
              }))
            }
            className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
              draftLine.taxability === 'non_gst'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Non-GST (0% Tax)
          </button>
        </div>
        {draftLine.taxability !== 'non_gst' ? (
          <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={draftLine.isGstIncluded}
              onChange={(e) => setDraftLine((p) => ({ ...p, isGstIncluded: e.target.checked }))}
              className="rounded border-slate-300 accent-[var(--primary)]"
            />
            Entered rate includes GST
          </label>
        ) : (
          <span className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">
            Bought &amp; sold without GST · Excluded from GST reports
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-3">
        <div>
          <label style={labelStyle}>
            {draftLine.taxability === 'non_gst' ? 'HSN (Optional)' : 'HSN Code'}
          </label>
          <input
            value={draftLine.hsn}
            onChange={(e) => setDraftLine((prev) => ({ ...prev, hsn: e.target.value }))}
            placeholder={draftLine.taxability === 'non_gst' ? 'Optional' : '22021090'}
            className="w-full border-2 px-3 py-1.5 text-sm font-mono"
            style={{ borderColor: palette.line }}
          />
        </div>
        <div>
          <label style={labelStyle}>Billed Qty (Cases)</label>
          <input
            type="number" inputMode="numeric"
            min="1"
            value={draftLine.qty}
            onChange={(e) =>
              setDraftLine((prev) => ({ ...prev, qty: Math.max(1, Number(e.target.value) || 0) }))
            }
            className="w-full border-2 px-3 py-1.5 text-sm font-bold"
            style={{ borderColor: palette.line }}
          />
        </div>
        <div>
          <label style={labelStyle}>
            {draftLine.taxability === 'non_gst'
              ? 'Unit Price (₹/Case)'
              : draftLine.isGstIncluded
                ? 'Rate incl. GST (₹/Case)'
                : 'Rate ex-GST (₹/Case)'}
          </label>
          <input
            type="number" inputMode="decimal"
            step="0.01"
            value={draftLine.unitPrice}
            onChange={(e) =>
              setDraftLine((prev) => ({ ...prev, unitPrice: Number(e.target.value) || 0 }))
            }
            className="w-full border-2 px-3 py-1.5 text-sm font-bold"
            style={{ borderColor: palette.line }}
          />
        </div>
        <div>
          <label style={labelStyle}>Units / Case</label>
          <input
            type="number"
            inputMode="numeric"
            min="1"
            value={draftLine.unitsPerCrate}
            onChange={(e) =>
              setDraftLine((prev) => ({ ...prev, unitsPerCrate: Math.max(1, Number(e.target.value) || 1) }))
            }
            className="w-full border-2 px-3 py-1.5 text-sm font-mono"
            style={{ borderColor: palette.line }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
        <div>
          <label style={labelStyle}>Batch / Lot No.</label>
          <input
            value={draftLine.batchNumber}
            onChange={(e) => setDraftLine((prev) => ({ ...prev, batchNumber: e.target.value }))}
            placeholder="Auto-generated if blank"
            className="w-full border-2 px-3 py-1.5 text-sm font-mono"
            style={{ borderColor: palette.line }}
          />
        </div>
        <div>
          <label style={labelStyle}>Expiry Date</label>
          <input
            type="date"
            value={draftLine.expiry}
            onChange={(e) => setDraftLine((prev) => ({ ...prev, expiry: e.target.value }))}
            className="w-full border-2 px-3 py-1.5 text-sm"
            style={{ borderColor: palette.line }}
          />
        </div>
      </div>

      {/* Scheme section */}
      <div
        className="p-3 border-2 mb-3 text-xs rounded-lg"
        style={{ borderColor: palette.amber, backgroundColor: `${palette.amber}0a` }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
          <span className="font-bold flex items-center gap-1.5">
            <Gift size={15} style={{ color: palette.amber }} />
            Scheme / Free Crates / Discount
            <span className="text-xs font-semibold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded">
              Included in Bill · Zero Double-Count
            </span>
          </span>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { key: 'none', label: 'No Scheme' },
                { key: 'b2g1', label: 'Buy X Get Y Free' },
                { key: 'free_cases', label: 'Free Crates' },
                { key: 'discount_percent', label: '% Discount' },
                { key: 'discount_flat', label: 'Flat ₹/Case' },
              ] as const
            ).map((st) => (
              <label
                key={st.key}
                className={`flex items-center gap-1 font-bold px-2 py-0.5 rounded cursor-pointer text-xs ${
                  draftLine.schemeType === st.key
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'bg-white text-slate-700 border border-slate-200'
                }`}
              >
                <input
                  type="radio"
                  checked={draftLine.schemeType === st.key}
                  onChange={() => setDraftLine((p) => ({ ...p, schemeType: st.key }))}
                  className="sr-only"
                />
                <span>{st.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Scheme Billing Mode Selector */}
        {(draftLine.schemeType === 'b2g1' || draftLine.schemeType === 'free_cases') && (
          <div className="mb-2 p-2 bg-white border border-amber-200 rounded flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-xs text-slate-700">
              <strong>Billing Mode:</strong>{' '}
              {draftLine.schemeMode === 'inclusive'
                ? 'Free crates are part of the billed case count. Godown receives billed quantity.'
                : 'Bonus crates are extra on top of invoice. Godown receives billed + free.'}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setDraftLine((p) => ({ ...p, schemeMode: 'inclusive' }))}
                className={`px-2 py-0.5 text-xs font-bold rounded cursor-pointer ${
                  draftLine.schemeMode === 'inclusive'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                Included in Bill (Standard)
              </button>
              <button
                type="button"
                onClick={() => setDraftLine((p) => ({ ...p, schemeMode: 'additive' }))}
                className={`px-2 py-0.5 text-xs font-bold rounded cursor-pointer ${
                  draftLine.schemeMode === 'additive'
                    ? 'bg-purple-700 text-white'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                Extra on Top (Bonus)
              </button>
            </div>
          </div>
        )}

        {draftLine.schemeType === 'b2g1' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end mb-2">
            <div className="flex items-center gap-2">
              <span>
                Buy (X):
                <input
                  type="number" inputMode="numeric"
                  min="1"
                  value={draftLine.schemeBuyQty}
                  onChange={(e) =>
                    setDraftLine((p) => ({ ...p, schemeBuyQty: Math.max(1, Number(e.target.value) || 1), freeQty: undefined }))
                  }
                  className="w-14 ml-1 border px-1.5 py-0.5 font-bold"
                />
              </span>
              <span>
                Get (Y):
                <input
                  type="number" inputMode="numeric"
                  min="1"
                  value={draftLine.schemeFreeQty}
                  onChange={(e) =>
                    setDraftLine((p) => ({ ...p, schemeFreeQty: Math.max(1, Number(e.target.value) || 1), freeQty: undefined }))
                  }
                  className="w-14 ml-1 border px-1.5 py-0.5 font-bold"
                />
              </span>
            </div>
            <div>
              <span className="font-semibold text-slate-600 block mb-0.5">Free Crates:</span>
              <input
                type="number" inputMode="numeric"
                min="0"
                value={metrics.freeQty}
                onChange={(e) =>
                  setDraftLine((p) => ({ ...p, freeQty: Math.max(0, Number(e.target.value) || 0) }))
                }
                className="w-20 border px-1.5 py-0.5 font-bold text-emerald-800 bg-emerald-50 border-emerald-300"
              />
            </div>
            <div className="text-right text-xs text-slate-600">
              Paid: <strong className="text-sky-700">{metrics.paidQty} cs</strong> · Free:{' '}
              <strong className="text-emerald-700">{metrics.freeQty} cs</strong> · Inward:{' '}
              <strong className="text-slate-900">{metrics.totalReceivedQty} cs</strong>
            </div>
          </div>
        )}

        {draftLine.schemeType === 'free_cases' && (
          <div className="flex items-center gap-4 mb-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">Free Crates on Bill:</span>
              <input
                type="number" inputMode="numeric"
                min="0"
                value={draftLine.freeQty ?? draftLine.schemeFreeQty ?? 0}
                onChange={(e) =>
                  setDraftLine((p) => ({
                    ...p,
                    freeQty: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
                className="w-20 border px-1.5 py-0.5 font-bold text-emerald-800 bg-emerald-50 border-emerald-300"
              />
            </div>
            <div className="flex items-center gap-1">
              {[1, 2, 5, 10].map((add) => (
                <button
                  key={add}
                  type="button"
                  onClick={() =>
                    setDraftLine((p) => ({ ...p, freeQty: (p.freeQty || 0) + add }))
                  }
                  className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  +{add} cs
                </button>
              ))}
            </div>
            <span className="font-bold text-amber-700 ml-auto">
              Discount Savings: −₹{money(metrics.discountAmount)}
            </span>
          </div>
        )}

        {draftLine.schemeType === 'discount_percent' && (
          <div className="flex items-center gap-3 mb-2">
            <span>
              Discount %:
              <input
                type="number" inputMode="decimal"
                min="0"
                max="100"
                step="0.1"
                value={draftLine.schemeDiscountPercent}
                onChange={(e) =>
                  setDraftLine((p) => ({ ...p, schemeDiscountPercent: Number(e.target.value) || 0 }))
                }
                className="w-16 ml-1 border px-1.5 py-0.5 font-bold"
              />
            </span>
            <span className="font-bold text-amber-700">
              Discount Amount: −₹{money(metrics.discountAmount)}
            </span>
          </div>
        )}

        {draftLine.schemeType === 'discount_flat' && (
          <div className="flex items-center gap-3 mb-2">
            <span>
              Flat discount per case (₹):
              <input
                type="number" inputMode="numeric"
                min="0"
                step="1"
                value={draftLine.schemeFlatDiscountPerCase}
                onChange={(e) =>
                  setDraftLine((p) => ({ ...p, schemeFlatDiscountPerCase: Number(e.target.value) || 0 }))
                }
                className="w-20 ml-1 border px-1.5 py-0.5 font-bold"
              />
            </span>
            <span className="font-bold text-amber-700">
              Discount Amount: −₹{money(metrics.discountAmount)}
            </span>
          </div>
        )}

        {/* Physical Godown Inward Stock Verification Banner */}
        <div className="p-2 bg-white border border-emerald-500/40 rounded flex items-center justify-between text-xs mt-2 flex-wrap gap-1.5">
          <span className="text-slate-700">
            Physical Stock entering Godown:{' '}
            <strong className="text-emerald-800 text-sm font-mono">{metrics.totalReceivedQty} crates</strong>
            <span className="text-xs text-slate-500 ml-1">
              ({metrics.paidQty} paid + {metrics.freeQty} free)
            </span>
          </span>
          <span className="font-bold text-sky-700 font-mono text-xs tabular-nums">
            Auto Landed: ₹{money(metrics.landedCostPerCrate)}/cs · ₹{money(metrics.landedCostPerBottle)}/unit
            {draftPreviewInwardPerCrate > 0 && (
              <span className="text-xs font-medium text-emerald-700 ml-1">
                (incl. +₹{money(draftPreviewInwardPerCrate)}/cs handling)
              </span>
            )}
          </span>
        </div>

        {/* Supplier Scheme (additive layer, independent of the invoice scheme above) */}
        <div className="mt-2 p-2 bg-amber-50/60 border border-amber-200 rounded-md space-y-1.5">
          <label className="text-xs font-semibold text-amber-900 block">Supplier Scheme (optional)</label>
          <select
            value={draftLine.supplierSchemeId || draftLine.pendingCreditSchemeId || ''}
            onChange={(e) => {
              const scheme = supplierSchemes.find((s) => s.id === e.target.value);
              setDraftLine((p) => ({
                ...p,
                supplierSchemeId: scheme?.schemeType === 'free_goods' ? scheme.id : undefined,
                pendingCreditSchemeId: scheme?.schemeType === 'pending_credit' ? scheme.id : undefined,
              }));
            }}
            className="text-xs border px-2 py-1 rounded w-full"
            title="Attach a named Supplier Scheme — free goods add on top of the qty above; pending credit flags this line for a future credit note"
          >
            <option value="">No Supplier Scheme</option>
            {supplierSchemes
              .filter((s) => s.active && s.schemeType !== 'volume_incentive')
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.schemeType === 'free_goods' ? 'Free Goods' : 'Pending Credit'} — {s.name}
                </option>
              ))}
          </select>
          {draftLine.supplierSchemeId && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <span className="text-slate-600">Additive free CASE (on top of {draftLine.qty} billed):</span>
              <input
                type="number" inputMode="numeric"
                min="0"
                value={draftLine.supplierSchemeFreeQty ?? 0}
                onChange={(e) =>
                  setDraftLine((p) => ({ ...p, supplierSchemeFreeQty: Math.max(0, Number(e.target.value) || 0) }))
                }
                className="w-16 border px-1 py-0.5 rounded text-right font-mono shrink-0"
              />
              <span className="font-bold text-emerald-700 basis-full sm:basis-auto">
                = {metrics.totalReceivedQty + (draftLine.supplierSchemeFreeQty || 0)} cases physically received
              </span>
            </div>
          )}
          {draftLine.pendingCreditSchemeId && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-600">Expected supplier credit (₹):</span>
              <input
                type="number" inputMode="decimal"
                min="0"
                value={draftLine.pendingCreditExpectedAmount ?? 0}
                onChange={(e) =>
                  setDraftLine((p) => ({ ...p, pendingCreditExpectedAmount: Math.max(0, Number(e.target.value) || 0) }))
                }
                className="w-24 border px-1 py-0.5 rounded text-right font-mono"
              />
            </div>
          )}
        </div>

        <div className="mt-2 pt-2 border-t flex items-center justify-between font-medium flex-wrap gap-2">
          <span>
            Landed Price:{' '}
            <strong className="tabular-nums">
              ₹{money(metrics.landedCostPerCrate)}/case · ₹{money(metrics.landedCostPerBottle)}/unit
            </strong>
          </span>
          <span>
            Tax Rate:{' '}
            <strong>
              {draftLine.taxability === 'non_gst'
                ? '0% (Non-GST)'
                : `${draftLine.cgstPercent + draftLine.sgstPercent}%`}
            </strong>
          </span>
          <span className="font-bold text-green-700 tabular-nums">
            Line Total: ₹{money(metrics.lineTotal)}
          </span>
        </div>
      </div>

      {lineValidationError && (
        <div className="mb-3 p-2.5 rounded bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0" />
          <span>{lineValidationError}</span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleAddDraftToReview}
          className="flex-1 py-2.5 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer rounded-xl transition-colors shadow-sm"
          style={{
            backgroundColor: editingIndex !== null ? '#d97706' : palette.navy,
            color: '#FFFFFF',
          }}
        >
          {editingIndex !== null ? <Check size={16} /> : <Plus size={16} />}
          {editingIndex !== null ? `Save Changes to Item #${editingIndex + 1}` : 'Add Line to Invoice'}
        </button>
        {editingIndex !== null && (
          <button
            type="button"
            onClick={() => {
              setEditingIndex(null);
              if (initialGrnToEdit) setShowAddForm(false);
              setDraftLine(defaultLineState());
            }}
            className="px-4 py-2.5 border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-sm font-semibold rounded-xl cursor-pointer"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};
