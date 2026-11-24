import React from 'react';
import {
  CheckCircle2,
  Pencil,
  RefreshCw,
  Search,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { Product, Promotion } from '../../../types';
import { schemeLabel } from '../../../utils/billing';
import { ConfirmModal } from '../../ui';

interface PromotionsDesktopViewProps {
  promotions: Promotion[];
  filteredPromotions: Promotion[];
  products: Product[];
  categories: string[];
  brands: string[];
  statusMsg: string | null;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  showAddPromo: boolean;
  setShowAddPromo: (b: boolean) => void;
  editingPromoId: number | null;
  setEditingPromoId: (id: number | null) => void;
  draftPromo: Omit<Promotion, 'id'>;
  setDraftPromo: React.Dispatch<React.SetStateAction<Omit<Promotion, 'id'>>>;
  promoToDelete: Promotion | null;
  setPromoToDelete: (p: Promotion | null) => void;
  isSyncingSchemes: boolean;
  startEdit: (p: Promotion) => void;
  cancelEdit: () => void;
  handleSave: (e: React.FormEvent) => void;
  handleSyncDatabase: () => void;
  toggleSchemeActive: (p: Promotion) => void;
  toggleProduct: (productId: number) => void;
  deletePromotion: (id: number, reason?: string) => void;
}

export const PromotionsDesktopView: React.FC<PromotionsDesktopViewProps> = ({
  promotions,
  filteredPromotions,
  products,
  categories,
  brands,
  statusMsg,
  searchQuery,
  setSearchQuery,
  showAddPromo,
  setShowAddPromo,
  editingPromoId,
  setEditingPromoId,
  draftPromo,
  setDraftPromo,
  promoToDelete,
  setPromoToDelete,
  isSyncingSchemes,
  startEdit,
  cancelEdit,
  handleSave,
  handleSyncDatabase,
  toggleSchemeActive,
  toggleProduct,
  deletePromotion,
}) => {
  return (
    <div id="view-promotions" className="hh-view mw-workspace min-w-0 max-w-full space-y-4 pb-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Promotions</h1>
        </div>
      </div>

      {statusMsg && (
        <div
          id="promotions-sync-alert"
          className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900 px-3.5 py-2.5 text-sm font-semibold flex items-center gap-2"
        >
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Two-column workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 items-start">
        {/* LEFT: summary + create */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-3 min-w-0">
          <div data-card-tone="profit" className="rounded-2xl border shadow-xs p-4 sm:p-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-purple-900/70 mb-3">
              Promotion summary
            </h2>
            <div className="grid grid-cols-2 gap-3 mb-1">
              <div className="text-center rounded-xl bg-white/80 border border-black/5 py-3 px-2">
                <div className="text-3xl font-extrabold text-slate-900 tabular-nums">{promotions.length}</div>
                <div className="text-xs font-semibold text-slate-500 mt-1">Total offers</div>
              </div>
              <div className="text-center rounded-xl bg-white/80 border border-black/5 py-3 px-2">
                <div className="text-3xl font-extrabold text-emerald-700 tabular-nums">
                  {promotions.filter((p) => p.isActive !== false).length}
                </div>
                <div className="text-xs font-semibold text-slate-500 mt-1">Live now</div>
              </div>
            </div>
            <div className="border-t border-black/5 mt-4 pt-4">
              {!showAddPromo ? (
                <button
                  type="button"
                  id="btn-open-new-scheme"
                  onClick={() => {
                    setEditingPromoId(null);
                    setDraftPromo({
                      name: '',
                      type: 'bogo',
                      buyQty: 2,
                      freeQty: 1,
                      percent: 10,
                      flatPerCase: 15,
                      productIds: [],
                      isActive: true,
                      bundleBuyType: 'any',
                      requiredDistinctTypes: 2,
                      minQtyPerType: 1,
                      freeRewardChoice: 'all_eligible',
                      freeProductId: undefined,
                      freeProductQty: 1,
                      productGroup: [],
                      groupCategory: '',
                      groupBrand: '',
                      freeItemRule: 'CHEAPEST_IN_GROUP',
                      freeItem: 'CHEAPEST_IN_GROUP',
                      customerChoiceProductId: undefined,
                    });
                    setShowAddPromo(true);
                  }}
                  className="w-full py-2.5 rounded-xl bg-[var(--primary)] hover:bg-[#0a342b] text-white text-sm font-semibold cursor-pointer transition-colors"
                >
                  Create an offer
                </button>
              ) : (
                <form id="form-promo" onSubmit={handleSave} className="space-y-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-900">
                      {editingPromoId ? 'Edit offer' : 'Create an offer'}
                    </h3>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 px-2 py-1 rounded-lg border border-black/8 cursor-pointer"
                    >
                      <X size={13} /> Close
                    </button>
                  </div>

                  <div>
                    <label htmlFor="promo-name" className="block text-xs font-semibold text-slate-600 mb-1">
                      Offer name
                    </label>
                    <input
                      id="promo-name"
                      required
                      value={draftPromo.name}
                      onChange={(e) => setDraftPromo({ ...draftPromo, name: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
                      placeholder="e.g. Diwali Deal"
                    />
                  </div>

                  <div>
                    <span className="block text-xs font-semibold text-slate-600 mb-1.5">Promotion Type</span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {(
                        [
                          { id: 'bogo' as const, label: 'Buy X Get X' },
                          { id: 'buy_x_get_different_free' as const, label: 'Buy A Get B Free' },
                          { id: 'group_buy_n_get_m_free' as const, label: 'Group Buy N Get M' },
                          { id: 'bundle' as const, label: 'Combo Bundle' },
                          { id: 'percent' as const, label: 'Percent off' },
                          { id: 'flat' as const, label: 'Flat off' },
                        ] as const
                      ).map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setDraftPromo((prev) => ({
                              ...prev,
                              type: t.id,
                              freeItemRule: prev.freeItemRule || 'CHEAPEST_IN_GROUP',
                            }));
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-colors text-center ${
                            draftPromo.type === t.id
                              ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {draftPromo.type === 'percent' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Percent off (%)</label>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={1}
                        max={100}
                        value={draftPromo.percent}
                        onChange={(e) => setDraftPromo({ ...draftPromo, percent: Number(e.target.value) })}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                      />
                    </div>
                  )}

                  {draftPromo.type === 'flat' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Flat off per case (₹)</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={draftPromo.flatPerCase}
                        onChange={(e) => setDraftPromo({ ...draftPromo, flatPerCase: Number(e.target.value) })}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                      />
                    </div>
                  )}

                  {draftPromo.type === 'bogo' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Buy qty</label>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          value={draftPromo.buyQty}
                          onChange={(e) => setDraftPromo({ ...draftPromo, buyQty: Number(e.target.value) })}
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Free qty</label>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          value={draftPromo.freeQty}
                          onChange={(e) => setDraftPromo({ ...draftPromo, freeQty: Number(e.target.value) })}
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                        />
                      </div>
                    </div>
                  )}

                  {draftPromo.type === 'buy_x_get_different_free' && (
                    <div className="space-y-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">Buy A → Get B Free Rule</span>
                        <span className="text-xs text-slate-500 font-medium">Distinct reward SKU</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">
                            Buy Qty (Item A)
                          </label>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            value={draftPromo.buyQty}
                            onChange={(e) => setDraftPromo({ ...draftPromo, buyQty: Number(e.target.value) })}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">
                            Free Qty (Item B)
                          </label>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            value={draftPromo.freeQty}
                            onChange={(e) =>
                              setDraftPromo({
                                ...draftPromo,
                                freeQty: Number(e.target.value),
                                freeProductQty: Number(e.target.value),
                              })
                            }
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          Free Reward Product (Product B) *
                        </label>
                        <select
                          required
                          value={draftPromo.freeProductId || ''}
                          onChange={(e) =>
                            setDraftPromo({
                              ...draftPromo,
                              freeProductId: e.target.value ? Number(e.target.value) : undefined,
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                        >
                          <option value="">-- Choose Free Product --</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} (₹{p.retail}/cs)
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          Trigger Product(s) (Product A) *
                        </label>
                        <div className="max-h-28 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1.5 space-y-1">
                          {products.map((p) => {
                            const on = (draftPromo.productIds || []).map(Number).includes(Number(p.id));
                            return (
                              <label
                                key={p.id}
                                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 cursor-pointer text-xs"
                              >
                                <input
                                  type="checkbox"
                                  checked={on}
                                  onChange={() => toggleProduct(p.id)}
                                  className="rounded border-slate-300"
                                />
                                <span className="text-slate-700 font-medium break-words leading-snug">{p.name}</span>
                              </label>
                            );
                          })}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          {draftPromo.productIds.length === 0
                            ? 'Select at least one trigger product'
                            : `${draftPromo.productIds.length} trigger product(s) selected`}
                        </p>
                      </div>
                    </div>
                  )}

                  {draftPromo.type === 'group_buy_n_get_m_free' && (
                    <div className="space-y-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">Group Scheme Rules</span>
                        <span className="text-xs text-teal-700 font-medium">Aggregated cart count</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">
                            Buy N (Across Group)
                          </label>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            value={draftPromo.buyQty}
                            onChange={(e) => setDraftPromo({ ...draftPromo, buyQty: Number(e.target.value) })}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                            placeholder="e.g. 2"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">
                            Get M Free
                          </label>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            value={draftPromo.freeQty}
                            onChange={(e) =>
                              setDraftPromo({
                                ...draftPromo,
                                freeQty: Number(e.target.value),
                                freeProductQty: Number(e.target.value),
                              })
                            }
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                            placeholder="e.g. 1"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          Free Item Rule (Configurable)
                        </label>
                        <select
                          value={draftPromo.freeItemRule || 'CHEAPEST_IN_GROUP'}
                          onChange={(e) =>
                            setDraftPromo({
                              ...draftPromo,
                              freeItemRule: e.target.value as any,
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                        >
                          <option value="CHEAPEST_IN_GROUP">
                            CHEAPEST_IN_GROUP (Default - Protects profit margin)
                          </option>
                          <option value="SAME_AS_LAST_ADDED">
                            SAME_AS_LAST_ADDED (Last group product added to cart)
                          </option>
                          <option value="SPECIFIC_PRODUCT">
                            SPECIFIC_PRODUCT (Designate specific product)
                          </option>
                          <option value="CUSTOMER_CHOICE_FROM_GROUP">
                            CUSTOMER_CHOICE_FROM_GROUP (Cashier/customer choice at checkout)
                          </option>
                        </select>
                      </div>

                      {draftPromo.freeItemRule === 'SPECIFIC_PRODUCT' && (
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">
                            Designated Free Product *
                          </label>
                          <select
                            required
                            value={draftPromo.freeProductId || ''}
                            onChange={(e) =>
                              setDraftPromo({
                                ...draftPromo,
                                freeProductId: e.target.value ? Number(e.target.value) : undefined,
                              })
                            }
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                          >
                            <option value="">-- Choose Free Product --</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Category Tag</label>
                          <select
                            value={draftPromo.groupCategory || ''}
                            onChange={(e) => setDraftPromo({ ...draftPromo, groupCategory: e.target.value })}
                            className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                          >
                            <option value="">All Categories</option>
                            {categories.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Brand Tag</label>
                          <select
                            value={draftPromo.groupBrand || ''}
                            onChange={(e) => setDraftPromo({ ...draftPromo, groupBrand: e.target.value })}
                            className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                          >
                            <option value="">All Brands</option>
                            {brands.map((b) => (
                              <option key={b} value={b}>
                                {b}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-semibold text-slate-600">
                            Select Group Products (or leave empty for all in tag)
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const allIds = products.map((p) => p.id);
                              setDraftPromo((prev) => ({
                                ...prev,
                                productIds: prev.productIds?.length === allIds.length ? [] : allIds,
                                productGroup: prev.productGroup?.length === allIds.length ? [] : allIds,
                              }));
                            }}
                            className="text-xs font-semibold text-[var(--primary)] hover:underline"
                          >
                            {draftPromo.productIds.length === products.length ? 'Deselect all' : 'Select all'}
                          </button>
                        </div>
                        <div className="max-h-28 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1.5 space-y-1">
                          {products.map((p) => {
                            const on = (draftPromo.productIds || []).map(Number).includes(Number(p.id));
                            return (
                              <label
                                key={p.id}
                                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 cursor-pointer text-xs"
                              >
                                <input
                                  type="checkbox"
                                  checked={on}
                                  onChange={() => toggleProduct(p.id)}
                                  className="rounded border-slate-300"
                                />
                                <span className="text-slate-700 font-medium break-words leading-snug">{p.name}</span>
                                <span className="text-slate-400 text-xs ml-auto">₹{p.retail}</span>
                              </label>
                            );
                          })}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          {draftPromo.productIds.length} product(s) explicitly included in this group
                        </p>
                      </div>
                    </div>
                  )}

                  {draftPromo.type === 'bundle' && (
                    <div className="space-y-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">
                            Distinct Types Req.
                          </label>
                          <input
                            type="number"
                            inputMode="decimal"
                            min={1}
                            value={draftPromo.requiredDistinctTypes || 2}
                            onChange={(e) =>
                              setDraftPromo({ ...draftPromo, requiredDistinctTypes: Number(e.target.value) })
                            }
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">
                            Min Qty Per Type
                          </label>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            value={draftPromo.minQtyPerType || 1}
                            onChange={(e) =>
                              setDraftPromo({ ...draftPromo, minQtyPerType: Number(e.target.value) })
                            }
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Free Qty Awarded</label>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          value={draftPromo.freeProductQty || 1}
                          onChange={(e) =>
                            setDraftPromo({
                              ...draftPromo,
                              freeProductQty: Number(e.target.value),
                              freeQty: Number(e.target.value),
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Offer preview</label>
                    <input
                      readOnly
                      value={schemeLabel({ ...draftPromo, id: 0 } as Promotion, products) || 'Configure offer above'}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-700"
                    />
                  </div>

                  {draftPromo.type !== 'buy_x_get_different_free' &&
                    draftPromo.type !== 'group_buy_n_get_m_free' && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                          Apply to products (optional)
                        </label>
                        <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 p-2 space-y-1">
                          {products.length === 0 ? (
                            <p className="text-xs text-slate-400 px-1 py-2">No products added yet</p>
                          ) : (
                            products.map((p) => {
                              const on = (draftPromo.productIds || []).map(Number).includes(Number(p.id));
                              return (
                                <label
                                  key={p.id}
                                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-xs"
                                >
                                  <input
                                    type="checkbox"
                                    checked={on}
                                    onChange={() => toggleProduct(p.id)}
                                    className="rounded border-slate-300"
                                  />
                                  <span className="text-slate-700 font-medium break-words leading-snug">{p.name}</span>
                                </label>
                              );
                            })
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">Leave empty to apply to all products</p>
                      </div>
                    )}

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-[var(--primary)] hover:bg-[#0a342b] text-white text-sm font-semibold cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 size={16} />
                    {editingPromoId ? 'Save changes' : 'Publish offer'}
                  </button>
                </form>
              )}
            </div>
          </div>

          <button
            type="button"
            id="btn-sync-promotions-db"
            onClick={handleSyncDatabase}
            disabled={isSyncingSchemes}
            className="w-full text-xs font-semibold text-slate-500 hover:text-slate-800 py-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={12} className={`inline mr-1 ${isSyncingSchemes ? 'animate-spin' : ''}`} />
            {isSyncingSchemes ? 'Syncing…' : 'Sync schemes to cloud'}
          </button>
        </div>

        {/* RIGHT: offers list */}
        <div className="lg:col-span-7 xl:col-span-8 min-w-0">
          <div data-card-tone="neutral" className="rounded-2xl border shadow-xs overflow-hidden">
            <div className="px-4 sm:px-5 py-3 border-b border-black/5 flex items-center justify-between gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Offers</h2>
              <span className="text-xs text-slate-500 font-semibold tabular-nums">
                {filteredPromotions.length} shown
              </span>
            </div>

            <div className="px-4 sm:px-5 py-2.5 border-b border-black/5">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  enterKeyHint="search"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search offers…"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                />
              </div>
            </div>

            <div className="p-3 sm:p-4 space-y-2.5">
              {filteredPromotions.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm text-slate-500">
                  {promotions.length === 0
                    ? 'No offers yet. Create your first offer on the left.'
                    : 'No offers match your search.'}
                </div>
              ) : (
                filteredPromotions.map((p) => {
                  const live = p.isActive !== false;
                  const detail = schemeLabel(p, products);
                  return (
                    <div
                      key={p.id}
                      data-card-tone={live ? 'received' : 'neutral'}
                      className="rounded-2xl border shadow-xs px-3.5 sm:px-4 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3 transition-shadow"
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div
                          className={`hh-icon-badge shrink-0 ${
                            live ? 'hh-icon-badge--green' : 'hh-icon-badge--slate'
                          }`}
                        >
                          <Tag size={18} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-900 break-words leading-snug">{p.name}</div>
                          <div className="text-xs text-slate-600 mt-0.5 leading-snug">{detail}</div>
                          {p.endDate && (
                            <div className="text-xs text-slate-400 mt-0.5">
                              Valid until {p.endDate}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:gap-3 shrink-0 self-end sm:self-center">
                        <span
                          className={`text-xs font-bold uppercase tracking-wide ${
                            live ? 'text-teal-600' : 'text-slate-400'
                          }`}
                        >
                          {live ? 'Live' : 'Paused'}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleSchemeActive(p)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                            live
                              ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                              : 'bg-[var(--primary)] border-[var(--primary)] text-white hover:brightness-110'
                          }`}
                        >
                          {live ? 'Pause' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          onClick={() => startEdit(p)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                          title="Edit"
                          aria-label={`Edit ${p.name}`}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPromoToDelete(p)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                          title="Delete"
                          aria-label={`Delete ${p.name}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={!!promoToDelete}
        onClose={() => setPromoToDelete(null)}
        onConfirm={() => {}}
        onConfirmWithComment={(reason) => {
          if (promoToDelete) {
            deletePromotion(promoToDelete.id, reason);
            setPromoToDelete(null);
          }
        }}
        title="Delete Trade Promotion Scheme"
        subtitle={promoToDelete?.name}
        message={`Deleting scheme "${promoToDelete?.name}" immediately removes it from trade billing and logs this action.`}
        rectificationPrompt="Reason for deleting scheme *"
        rectificationPlaceholder="e.g. Offer expired, replaced by new scheme, duplicate setup"
        reasonPresets={['Offer expired', 'Replaced by new scheme', 'Duplicate setup', 'Entered by mistake']}
        commentMinLength={4}
        confirmButtonLabel="Delete Scheme"
        variant="danger"
      />
    </div>
  );
};
