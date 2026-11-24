import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { BillItem, PaletteTokens, PriceType, Product, Promotion } from '../../../types';
import { money } from '../../../utils/billing';
import { isLineNonGst } from '../../../utils/invoiceCommon';
import { sizeStripe } from '../../../utils/sizeColor';
import { notify } from '../../../utils/toast';
import { SizeChip } from '../SizeChip';

interface EditBillItemsSectionProps {
  items: BillItem[];
  products: Product[];
  palette: PaletteTokens;
  activePromoForProduct: (productId: number) => Promotion | null;
  updateLineItem: (
    index: number,
    updates: { qty?: number; rate?: number; priceType?: PriceType; toggleScheme?: boolean },
  ) => void;
  removeLineItem: (index: number) => void;
  isAddingProduct: boolean;
  setIsAddingProduct: (val: boolean) => void;
  selectedProductId: number;
  setSelectedProductId: (id: number) => void;
  draftPriceType: PriceType;
  setDraftPriceType: (pt: PriceType) => void;
  draftQty: number;
  setDraftQty: React.Dispatch<React.SetStateAction<number>>;
  draftCustomRate: string;
  setDraftCustomRate: (val: string) => void;
  draftProduct: Product | undefined;
  addDraftItem: () => void;
  remainingStock: (productId: number) => number;
}

export const EditBillItemsSection: React.FC<EditBillItemsSectionProps> = ({
  items,
  products,
  palette,
  activePromoForProduct,
  updateLineItem,
  removeLineItem,
  isAddingProduct,
  setIsAddingProduct,
  selectedProductId,
  setSelectedProductId,
  draftPriceType,
  setDraftPriceType,
  draftQty,
  setDraftQty,
  draftCustomRate,
  setDraftCustomRate,
  draftProduct,
  addDraftItem,
  remainingStock,
}) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm tracking-tight text-stone-900">
          Billed Products ({items.length})
        </h3>
      </div>

      {items.length === 0 ? (
        <div
          className="p-8 text-center rounded-xl border-2 border-dashed opacity-70"
          style={{ borderColor: palette.line }}
        >
          <p className="font-medium text-sm">No products on this bill.</p>
          <p className="text-xs opacity-75 mt-1">Use the form below to add products.</p>
        </div>
      ) : (
        <>
          {/* Mobile: one card per product (the wide table below is for tablet / desktop) */}
          <div className="md:hidden space-y-3">
            {items.map((it, idx) => {
              const product = products.find((p) => p.id === it.productId);
              const promo = activePromoForProduct(it.productId);
              const isPromoActive = !it.schemeSkipped && Boolean(it.promoLabel || promo);
              const priceType = it.priceType || 'Retail';
              return (
                <div
                  key={`m-${it.productId}-${idx}`}
                  className="rounded-2xl border bg-white shadow-sm overflow-hidden"
                  style={{ borderColor: palette.line, ...sizeStripe(product?.volume, it.productName) }}
                >
                  <div className="p-3 space-y-3">
                    {/* Name + remove */}
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 shrink-0 size-6 rounded-full bg-stone-100 text-xs font-bold text-stone-500 flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-stone-900 leading-snug break-words">
                          {it.productName}{' '}
                          <SizeChip volume={product?.volume} pack={product?.pack} name={it.productName} />
                          {isLineNonGst(it, products) && (
                            <span className="ml-1.5 inline-block px-1.5 py-0.5 rounded text-xs font-bold uppercase tracking-wide bg-amber-100 text-amber-800 border border-amber-200 align-middle">
                              Non-GST
                            </span>
                          )}
                        </div>
                        {product && (
                          <div className="text-xs text-stone-500 mt-0.5">
                            Default: ₹{product.retail} Ret · ₹{product.wholesale} Whls
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLineItem(idx)}
                        className="shrink-0 size-9 -mr-1 -mt-1 rounded-full text-red-500 hover:bg-red-50 active:bg-red-100 flex items-center justify-center"
                        title="Remove line item"
                        aria-label={`Remove ${it.productName}`}
                        id={`m-remove-line-${idx}`}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>

                    {/* Sale type: segmented toggle */}
                    <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-stone-100">
                      {(['Retail', 'Wholesale'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => updateLineItem(idx, { priceType: t as PriceType })}
                          className={`py-1.5 rounded-lg text-xs font-bold transition-colors ${
                            priceType === t ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500'
                          }`}
                          id={`m-edit-line-type-${idx}-${t}`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>

                    {/* Qty stepper + Rate */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-1">Qty (Cases)</div>
                        <div className="flex items-stretch rounded-xl border overflow-hidden bg-white" style={{ borderColor: palette.line }}>
                          <button
                            type="button"
                            onClick={() => updateLineItem(idx, { qty: it.qty - 1 })}
                            disabled={it.qty <= 1}
                            className="w-11 h-11 text-lg font-bold bg-stone-100 active:bg-stone-200 disabled:opacity-30"
                            aria-label="Decrease quantity"
                            id={`m-edit-qty-minus-${idx}`}
                          >
                            −
                          </button>
                          <input
                            type="number"
                            inputMode="numeric"
                            min="1"
                            value={it.qty}
                            onChange={(e) =>
                              updateLineItem(idx, { qty: Math.max(1, parseInt(e.target.value) || 1) })
                            }
                            className="min-w-0 flex-1 text-center text-base font-bold focus:outline-none"
                            id={`m-edit-qty-input-${idx}`}
                          />
                          <button
                            type="button"
                            onClick={() => updateLineItem(idx, { qty: it.qty + 1 })}
                            className="w-11 h-11 text-lg font-bold bg-stone-100 active:bg-stone-200"
                            aria-label="Increase quantity"
                            id={`m-edit-qty-plus-${idx}`}
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-1">Rate (₹)</div>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 font-bold">₹</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            value={it.rate}
                            onChange={(e) =>
                              updateLineItem(idx, { rate: Math.max(0, parseFloat(e.target.value) || 0) })
                            }
                            className="w-full h-11 pl-7 pr-2 text-base font-bold border rounded-xl focus:outline-none focus:ring-1 bg-white"
                            style={{ borderColor: palette.line }}
                            id={`m-edit-rate-input-${idx}`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Scheme */}
                    {promo && (
                      <label className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isPromoActive}
                          onChange={(e) => updateLineItem(idx, { toggleScheme: e.target.checked })}
                          className="mt-0.5 size-4 rounded"
                        />
                        <span className="text-xs">
                          <span className="font-bold text-amber-800">{promo.name}</span>
                          {isPromoActive && it.freeQty > 0 && (
                            <span className="block text-green-700 font-bold">
                              {it.freeQty} Free Case{it.freeQty !== 1 ? 's' : ''} (incl.)
                            </span>
                          )}
                          {isPromoActive && it.discount > 0 && (
                            <span className="block text-stone-600">Save ₹{money(it.discount)}</span>
                          )}
                        </span>
                      </label>
                    )}
                  </div>

                  {/* Line total */}
                  <div
                    className="flex items-center justify-between px-3 py-2 border-t"
                    style={{ backgroundColor: palette.cream, borderColor: palette.line }}
                  >
                    <span className="text-xs font-bold uppercase tracking-wider opacity-70">Line total</span>
                    <span className="text-base font-extrabold">₹{money(it.amount)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div
            className="hidden md:block border-2 rounded-xl overflow-hidden shadow-sm"
            style={{ borderColor: palette.line }}
          >
            <div className="overflow-x-auto overscroll-x-contain rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full min-w-[700px] text-xs text-left border-collapse">
                <thead
                  className="border-b uppercase tracking-wider font-bold opacity-80"
                  style={{
                    backgroundColor: palette.cream,
                    borderColor: palette.line,
                  }}
                >
                  <tr>
                    <th className="px-3 py-2.5 whitespace-nowrap">#</th>
                    <th className="px-3 py-2.5 whitespace-nowrap min-w-[150px]">Product Name</th>
                    <th className="px-3 py-2.5 whitespace-nowrap">Type</th>
                    <th className="px-3 py-2.5 w-32 whitespace-nowrap">Qty (Cases)</th>
                    <th className="px-3 py-2.5 w-28 whitespace-nowrap">Rate (₹)</th>
                    <th className="px-3 py-2.5 whitespace-nowrap">Scheme / Free</th>
                    <th className="px-3 py-2.5 text-right whitespace-nowrap">Line Total</th>
                    <th className="px-2 py-2.5 text-center w-10 whitespace-nowrap"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {items.map((it, idx) => {
                    const product = products.find((p) => p.id === it.productId);
                    const promo = activePromoForProduct(it.productId);
                    const isPromoActive = !it.schemeSkipped && Boolean(it.promoLabel || promo);

                    return (
                      <tr
                        key={`${it.productId}-${idx}`}
                        className="hover:bg-stone-50/50 transition-colors"
                      >
                        <td className="px-3 py-2.5 font-bold opacity-50">{idx + 1}</td>
                        <td className="px-3 py-2.5 font-semibold text-stone-900" style={sizeStripe(product?.volume, it.productName)}>
                          <div>
                            {it.productName}{' '}
                            <SizeChip volume={product?.volume} pack={product?.pack} name={it.productName} />
                            {isLineNonGst(it, products) && (
                              <span className="ml-1.5 inline-block px-1.5 py-0.5 rounded text-xs font-bold uppercase tracking-wide bg-amber-100 text-amber-800 border border-amber-200 align-middle">
                                Non-GST
                              </span>
                            )}
                          </div>
                          {product && (
                            <div className="text-xs opacity-60">
                              Default: ₹{product.retail} Ret / ₹{product.wholesale} Whls
                            </div>
                          )}
                        </td>
                        {/* Sale Type Selector */}
                        <td className="px-3 py-2.5">
                          <select
                            value={it.priceType || 'Retail'}
                            onChange={(e) =>
                              updateLineItem(idx, {
                                priceType: e.target.value as PriceType,
                              })
                            }
                            className="px-2 py-1 text-xs border rounded font-medium bg-white"
                            style={{ borderColor: palette.line }}
                            id={`edit-line-type-${idx}`}
                          >
                            <option value="Retail">Retail</option>
                            <option value="Wholesale">Wholesale</option>
                          </select>
                        </td>

                        {/* Inline Quantity with +/- Tactile Buttons */}
                        <td className="px-3 py-2.5">
                          <div className="inline-flex items-center rounded-lg border overflow-hidden bg-white shadow-sm" style={{ borderColor: palette.line }}>
                            <button
                              type="button"
                              onClick={() => updateLineItem(idx, { qty: it.qty - 1 })}
                              disabled={it.qty <= 1}
                              className="px-2 py-1 font-bold text-xs bg-stone-100 hover:bg-stone-200 disabled:opacity-30 transition-colors"
                              title="Decrease quantity by 1"
                              id={`edit-qty-minus-${idx}`}
                            >
                              -
                            </button>
                            <input
                              type="number" inputMode="numeric"
                              min="1"
                              value={it.qty}
                              onChange={(e) =>
                                updateLineItem(idx, {
                                  qty: Math.max(1, parseInt(e.target.value) || 1),
                                })
                              }
                              className="w-12 text-center text-xs font-bold py-1 focus:outline-none"
                              id={`edit-qty-input-${idx}`}
                            />
                            <button
                              type="button"
                              onClick={() => updateLineItem(idx, { qty: it.qty + 1 })}
                              className="px-2 py-1 font-bold text-xs bg-stone-100 hover:bg-stone-200 transition-colors"
                              title="Increase quantity by 1"
                              id={`edit-qty-plus-${idx}`}
                            >
                              +
                            </button>
                          </div>
                        </td>

                        {/* Inline Rate/Price Editor */}
                        <td className="px-3 py-2.5">
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 opacity-50 font-bold">
                              ₹
                            </span>
                            <input
                              type="number" inputMode="decimal"
                              step="0.01"
                              min="0"
                              value={it.rate}
                              onChange={(e) =>
                                updateLineItem(idx, {
                                  rate: Math.max(0, parseFloat(e.target.value) || 0),
                                })
                              }
                              className="w-24 pl-5 pr-2 py-1 text-xs font-bold border rounded-lg focus:outline-none focus:ring-1"
                              style={{
                                borderColor: palette.line,
                                backgroundColor: '#ffffff',
                              }}
                              id={`edit-rate-input-${idx}`}
                            />
                          </div>
                        </td>

                        {/* Scheme & Free cases */}
                        <td className="px-3 py-2.5">
                          {promo ? (
                            <div className="space-y-1">
                              <label className="inline-flex items-center gap-1 cursor-pointer text-xs font-medium">
                                <input
                                  type="checkbox"
                                  checked={isPromoActive}
                                  onChange={(e) =>
                                    updateLineItem(idx, {
                                      toggleScheme: e.target.checked,
                                    })
                                  }
                                  className="rounded"
                                />
                                <span className="text-amber-700 font-bold">
                                  {promo.name}
                                </span>
                              </label>
                              {isPromoActive && it.freeQty > 0 && (
                                <div className="text-xs text-green-700 font-bold">
                                  {it.freeQty} Free Case{it.freeQty !== 1 ? 's' : ''} (incl.)
                                </div>
                              )}
                              {isPromoActive && it.discount > 0 && (
                                <div className="text-xs opacity-75">
                                  Save ₹{money(it.discount)}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="opacity-40 italic text-xs">No active scheme</span>
                          )}
                        </td>

                        {/* Line Total */}
                        <td className="px-3 py-2.5 text-right font-bold text-sm">
                          ₹{money(it.amount)}
                        </td>

                        {/* Remove button */}
                        <td className="px-2 py-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => removeLineItem(idx)}
                            className="p-1 rounded text-red-500 hover:bg-red-50 transition-colors"
                            title="Remove line item"
                            id={`remove-line-${idx}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Space-Saving Link to Add Product (Collapsed by default per mobile-first request) */}
      {!isAddingProduct ? (
        <button
          type="button"
          onClick={() => setIsAddingProduct(true)}
          className="w-full py-2.5 px-3 rounded-xl border-2 border-dashed border-sky-400 bg-sky-50/70 hover:bg-sky-100 text-sky-800 text-xs sm:text-sm font-black flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99] shadow-xs"
          id="edit-modal-show-add-product-btn"
        >
          <Plus size={16} className="text-sky-600" />
          <span>Add Another Product to this Bill</span>
        </button>
      ) : (
        <div
          className="p-3.5 sm:p-4 rounded-xl border-2 space-y-3 bg-sky-50/50 shadow-sm"
          style={{
            borderColor: palette.line,
          }}
        >
          <div className="flex items-center justify-between pb-2 border-b border-sky-200">
            <span className="text-xs font-black uppercase tracking-wider text-sky-950 flex items-center gap-1.5">
              <Plus size={14} className="text-sky-600" />
              <span>Add Product to Bill</span>
            </span>
            <button
              type="button"
              onClick={() => setIsAddingProduct(false)}
              className="text-xs font-bold text-stone-500 hover:text-stone-800 px-2 py-0.5 rounded cursor-pointer"
            >
              ✕ Cancel
            </button>
          </div>

          {/* Available Products Selector */}
          <div className="space-y-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600">
              Select Product ({products.length} Available)
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs font-semibold border rounded-lg bg-white text-stone-900 focus:outline-none focus:ring-1 focus:border-sky-600"
              style={{ borderColor: palette.line }}
              id="edit-modal-add-product-select"
            >
              {products.map((p) => {
                const stock = remainingStock(p.id);
                return (
                  <option key={p.id} value={p.id}>
                    {p.name} (Stock: {stock} cs | Ret: ₹{p.retail} | Whls: ₹{p.wholesale})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Price Type, Qty & Rate - Mobile Friendly Responsive Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
            {/* Price Type Segmented */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">
                Sale Type
              </label>
              <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-stone-100 border border-stone-200">
                {(['Retail', 'Wholesale'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setDraftPriceType(t)}
                    className={`py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                      draftPriceType === t ? 'bg-white shadow-xs text-stone-900' : 'text-stone-500'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Qty with Stepper */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">
                Quantity (Cases)
              </label>
              <div className="flex items-stretch rounded-lg border overflow-hidden bg-white" style={{ borderColor: palette.line }}>
                <button
                  type="button"
                  onClick={() => setDraftQty((q) => Math.max(1, q - 1))}
                  disabled={draftQty <= 1}
                  className="w-10 h-9 font-bold text-sm bg-stone-100 active:bg-stone-200 disabled:opacity-30 cursor-pointer"
                  aria-label="Decrease draft quantity"
                >
                  −
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  value={draftQty}
                  onChange={(e) => setDraftQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="min-w-0 flex-1 text-center text-xs font-bold focus:outline-none"
                  id="edit-modal-draft-qty"
                />
                <button
                  type="button"
                  onClick={() => setDraftQty((q) => q + 1)}
                  className="w-10 h-9 font-bold text-sm bg-stone-100 active:bg-stone-200 cursor-pointer"
                  aria-label="Increase draft quantity"
                >
                  +
                </button>
              </div>
            </div>

            {/* Rate */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">
                Rate (₹ / Case)
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-xs">₹</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  placeholder="Rate ₹"
                  value={draftCustomRate}
                  onChange={(e) => setDraftCustomRate(e.target.value)}
                  className="w-full h-9 pl-6 pr-2 text-xs font-bold border rounded-lg bg-white focus:outline-none focus:ring-1"
                  style={{ borderColor: palette.line }}
                  id="edit-modal-draft-rate"
                  title="Rate per case"
                />
              </div>
            </div>
          </div>

          {/* Add to Bill Button */}
          <div className="pt-1 flex gap-2">
            <button
              type="button"
              onClick={() => {
                addDraftItem();
                notify(`Added ${draftProduct?.name || 'item'} to bill!`, 'success');
              }}
              className="flex-1 py-2.5 px-4 rounded-xl text-xs font-black text-white shadow-sm transition-all hover:opacity-90 flex items-center justify-center gap-1.5 cursor-pointer"
              style={{ backgroundColor: palette.navy }}
              id="edit-modal-add-item-btn"
            >
              <Plus size={16} />
              <span>Add Item to Bill</span>
            </button>
            <button
              type="button"
              onClick={() => setIsAddingProduct(false)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
