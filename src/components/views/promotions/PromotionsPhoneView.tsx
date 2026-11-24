import React from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { notify } from '../../../utils/toast';
import { Product, Promotion, PromotionType } from '../../../types';
import { schemeLabel } from '../../../utils/billing';
import { PackIcon } from '../../common/PackIcon';

interface PromotionsPhoneViewProps {
  promotions: Promotion[];
  filteredPromotions: Promotion[];
  products: Product[];
  categories: string[];
  brands: string[];
  statusMsg: string | null;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  showAddPromo: boolean;
  editingPromoId: number | null;
  draftPromo: Omit<Promotion, 'id'>;
  setDraftPromo: React.Dispatch<React.SetStateAction<Omit<Promotion, 'id'>>>;
  promoToDelete: Promotion | null;
  setPromoToDelete: (p: Promotion | null) => void;
  isSyncingSchemes: boolean;
  mobileStep: 1 | 2 | 3;
  setMobileStep: React.Dispatch<React.SetStateAction<1 | 2 | 3>>;
  mobileScopeMode: 'products' | 'category' | 'brand';
  setMobileScopeMode: (m: 'products' | 'category' | 'brand') => void;
  mobileProdQuery: string;
  setMobileProdQuery: (q: string) => void;
  openMobileCreate: () => void;
  startEdit: (p: Promotion) => void;
  cancelEdit: () => void;
  handleSave: (e: React.FormEvent) => void;
  handleSyncDatabase: () => void;
  toggleSchemeActive: (p: Promotion) => void;
  toggleProduct: (productId: number) => void;
  deletePromotion: (id: number, reason?: string) => void;
}

export const PromotionsPhoneView: React.FC<PromotionsPhoneViewProps> = ({
  promotions,
  filteredPromotions,
  products,
  categories,
  brands,
  statusMsg,
  searchQuery,
  setSearchQuery,
  showAddPromo,
  editingPromoId,
  draftPromo,
  setDraftPromo,
  promoToDelete,
  setPromoToDelete,
  isSyncingSchemes,
  mobileStep,
  setMobileStep,
  mobileScopeMode,
  setMobileScopeMode,
  mobileProdQuery,
  setMobileProdQuery,
  openMobileCreate,
  startEdit,
  cancelEdit,
  handleSave,
  handleSyncDatabase,
  toggleSchemeActive,
  toggleProduct,
  deletePromotion,
}) => {
  const [deleteReason, setDeleteReason] = React.useState('');
  React.useEffect(() => {
    setDeleteReason('');
  }, [promoToDelete?.id]);
  const delReasonOk = deleteReason.trim().length >= 4;
  const liveCount = promotions.filter((p) => p.isActive !== false).length;
  const selectedIds = (draftPromo.productIds || []).map(Number);
  const matchingProducts = products.filter((p) => {
    const q = mobileProdQuery.trim().toLowerCase();
    return !q || p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q) || (p.brand || '').toLowerCase().includes(q);
  });
  const selectedProductsList = matchingProducts.filter((p) => selectedIds.includes(Number(p.id)));
  const unselectedProductsList = matchingProducts.filter((p) => !selectedIds.includes(Number(p.id)));

  const previewText = (() => {
    const base = schemeLabel({ ...draftPromo, id: 0 } as Promotion, products);
    const selectedNames = selectedIds
      .map((id) => products.find((p) => p.id === id)?.name)
      .filter(Boolean) as string[];
    const targetStr =
      selectedNames.length > 0
        ? selectedNames.slice(0, 2).join(' or ') + (selectedNames.length > 2 ? ` +${selectedNames.length - 2} more` : '')
        : draftPromo.groupCategory
          ? `${draftPromo.groupCategory} category`
          : draftPromo.groupBrand
            ? `${draftPromo.groupBrand} brand`
            : 'any eligible product';

    if (draftPromo.type === 'bogo' && (draftPromo.buyQty || 0) > 0 && (draftPromo.freeQty || 0) > 0) {
      const bq = Number(draftPromo.buyQty) || 1;
      const fq = Number(draftPromo.freeQty) || 1;
      const sampleCart = bq * 2 + Math.min(5, Math.max(1, Math.floor(bq / 2)));
      const earned = Math.floor(sampleCart / bq) * fq;
      return `Buy ${bq} ${bq === 1 ? 'case' : 'cases'} of ${targetStr}, get ${fq} ${fq === 1 ? 'case' : 'cases'} free. A cart of ${sampleCart} cases earns ${earned} free ${earned === 1 ? 'case' : 'cases'}.`;
    }
    return base || 'Configure offer rule in steps 1 and 2.';
  })();

  const ruleSummaryVal = (() => {
    if (draftPromo.type === 'bogo') return `${draftPromo.freeQty || 1} per ${draftPromo.buyQty || 1} cases`;
    if (draftPromo.type === 'buy_x_get_different_free') return `${draftPromo.freeQty || 1} free per ${draftPromo.buyQty || 1}`;
    if (draftPromo.type === 'group_buy_n_get_m_free') return `${draftPromo.freeQty || 1} free per ${draftPromo.buyQty || 1}`;
    if (draftPromo.type === 'bundle') return `${draftPromo.freeProductQty || draftPromo.freeQty || 1} free on ${draftPromo.requiredDistinctTypes || 2}+ types`;
    if (draftPromo.type === 'percent') return `${draftPromo.percent || 0}% discount`;
    return `₹${draftPromo.flatPerCase || 0} / case`;
  })();

  const appliesSummaryVal = (() => {
    if (selectedIds.length > 0) {
      const names = selectedIds.map((id) => products.find((p) => p.id === id)?.name).filter(Boolean);
      return names.length <= 2 ? names.join(', ') : `${names.slice(0, 2).join(', ')} +${names.length - 2} more`;
    }
    if (draftPromo.groupCategory) return `Category: ${draftPromo.groupCategory}`;
    if (draftPromo.groupBrand) return `Brand: ${draftPromo.groupBrand}`;
    return 'All products';
  })();

  const promoTypeOptions: { id: PromotionType; label: string }[] = [
    { id: 'bogo', label: 'Buy qty, get free qty' },
    { id: 'buy_x_get_different_free', label: 'Distinct reward SKU (a different product)' },
    { id: 'group_buy_n_get_m_free', label: 'Group scheme rules (aggregated cart count)' },
    { id: 'bundle', label: 'Combo Bundle' },
    { id: 'percent', label: 'Percent off' },
    { id: 'flat', label: 'Flat off' },
  ];

  const goNextFromStep1 = () => {
    if (!draftPromo.name.trim()) {
      notify('Please enter an offer name.');
      return;
    }
    if (draftPromo.type === 'buy_x_get_different_free' && !draftPromo.freeProductId) {
      notify('Please choose the Free Reward Product (Product B).');
      return;
    }
    if (
      draftPromo.type === 'group_buy_n_get_m_free' &&
      draftPromo.freeItemRule === 'SPECIFIC_PRODUCT' &&
      !draftPromo.freeProductId
    ) {
      notify('Please choose the Designated Free Product.');
      return;
    }
    setMobileStep(2);
  };

  const goNextFromStep2 = () => {
    if (draftPromo.type === 'buy_x_get_different_free' && selectedIds.length === 0) {
      notify('Please select at least one trigger product (Product A).');
      return;
    }
    if (draftPromo.type === 'group_buy_n_get_m_free') {
      const hasProducts = selectedIds.length > 0 || (draftPromo.productGroup && draftPromo.productGroup.length > 0);
      const hasTag = !!draftPromo.groupCategory || !!draftPromo.groupBrand;
      if (!hasProducts && !hasTag) {
        notify('Please select products or a category/brand tag for this group.');
        return;
      }
    }
    setMobileStep(3);
  };

  const applyCategoryTag = (cat: string) => {
    const catProductIds = cat ? products.filter((p) => p.category === cat).map((p) => Number(p.id)) : [];
    setDraftPromo((prev) => ({
      ...prev,
      groupCategory: cat,
      groupBrand: '',
      productIds: prev.type === 'group_buy_n_get_m_free' ? prev.productIds : catProductIds,
    }));
  };

  const applyBrandTag = (brand: string) => {
    const brandProductIds = brand ? products.filter((p) => p.brand === brand).map((p) => Number(p.id)) : [];
    setDraftPromo((prev) => ({
      ...prev,
      groupBrand: brand,
      groupCategory: '',
      productIds: prev.type === 'group_buy_n_get_m_free' ? prev.productIds : brandProductIds,
    }));
  };

  return (
    <div id="view-promotions" className="hh-view min-w-0 max-w-full pb-24">
      <header className="hh-sales-top">
        <div className="hh-sales-top__row">
          <h1 className="hh-sales-top__title">Promotions</h1>
          <button
            type="button"
            id="btn-open-new-scheme"
            onClick={openMobileCreate}
            className="hh-sales-top__iconbtn"
            aria-label="New offer"
          >
            <Plus size={22} strokeWidth={2.5} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="space-y-3">
        {statusMsg && (
          <div id="promotions-sync-alert" className="rt-notice rt-notice--paid flex items-center gap-2">
            <CheckCircle2 size={16} className="shrink-0" style={{ color: 'var(--paid)' }} />
            <span>{statusMsg}</span>
          </div>
        )}

        <div className="rt-kv-grid">
          <div className="rt-kv">
            <div className="rt-kv__label">Total offers</div>
            <div className="rt-kv__val">{promotions.length}</div>
          </div>
          <div className="rt-kv">
            <div className="rt-kv__label">Live now</div>
            <div className="rt-kv__val" style={{ color: 'var(--received)' }}>
              {liveCount}
            </div>
          </div>
        </div>

        <div className="rt-search-bar">
          <Search size={17} style={{ color: 'var(--text-2)' }} aria-hidden="true" />
          <input
            enterKeyHint="search"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search offers…"
            aria-label="Search offers"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="p-1 min-w-0 min-h-0 border-0 bg-transparent text-[var(--text-2)] cursor-pointer"
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {filteredPromotions.length === 0 ? (
          <div className="rt-card text-center py-8">
            <Tag size={26} className="mx-auto mb-2" style={{ color: 'var(--text-2)' }} aria-hidden="true" />
            <p className="text-sm font-bold text-[var(--text)]">
              {promotions.length === 0 ? 'No offers yet' : 'No offers match your search'}
            </p>
            <p className="text-xs text-[var(--text-2)] mt-1">
              {promotions.length === 0 ? 'Tap + above to create your first trade offer.' : 'Try a different keyword or clear search.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5 hh-tgrid-2">
            {filteredPromotions.map((p) => {
              const live = p.isActive !== false;
              const detail = schemeLabel(p, products);
              const prodIds = (p.productIds || (p as any).product_ids || []).map(Number);
              const prodNames = prodIds
                .map((id: number) => products.find((prod) => prod.id === id)?.name)
                .filter(Boolean) as string[];
              const prodSummary =
                prodNames.length > 0
                  ? prodNames.slice(0, 2).join(', ') + (prodNames.length > 2 ? ` +${prodNames.length - 2}` : '')
                  : p.groupCategory
                    ? `Category: ${p.groupCategory}`
                    : p.groupBrand
                      ? `Brand: ${p.groupBrand}`
                      : '';
              const dateMeta = [p.startDate && p.endDate ? `${p.startDate} – ${p.endDate}` : p.endDate ? `Until ${p.endDate}` : '']
                .filter(Boolean)
                .join('');
              const subLine = [prodSummary, dateMeta].filter(Boolean).join(' · ');

              return (
                <div
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => startEdit(p)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      startEdit(p);
                    }
                  }}
                  className={`rt-offer-card cursor-pointer ${live ? '' : 'rt-offer-card--muted'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] font-bold text-[var(--text)] leading-snug break-words">
                        {p.name}
                      </div>
                      <div className="text-[13px] text-[var(--text)] mt-0.5 leading-snug">{detail}</div>
                      {subLine && (
                        <div className="text-[12px] text-[var(--text-2)] mt-0.5 leading-snug break-words">
                          {subLine}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={live}
                      aria-label={live ? `Pause ${p.name}` : `Activate ${p.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSchemeActive(p);
                      }}
                      className="hh-switch mt-0.5"
                    >
                      <span className="hh-switch__thumb" />
                    </button>
                  </div>
                  <div className="mt-2">
                    <span className={`rt-tag ${live ? 'rt-tag--paid' : ''}`}>{live ? 'Live' : 'Ended'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <button
          type="button"
          id="btn-sync-promotions-db"
          onClick={handleSyncDatabase}
          disabled={isSyncingSchemes}
          className="rt-link-btn text-xs"
        >
          <RefreshCw size={13} className={isSyncingSchemes ? 'animate-spin' : ''} aria-hidden="true" />
          {isSyncingSchemes ? 'Syncing…' : 'Sync schemes to cloud'}
        </button>
      </div>

      {showAddPromo && (
        <div className="rt-flow-phone" role="dialog" aria-modal="true" aria-label={editingPromoId ? 'Edit offer' : 'New offer'}>
          <header className="hh-sales-top">
            <div className="hh-sales-top__row">
              <button
                type="button"
                onClick={() => {
                  if (mobileStep === 3) setMobileStep(2);
                  else if (mobileStep === 2) setMobileStep(1);
                  else cancelEdit();
                }}
                className="rt-back-link"
              >
                <ChevronLeft size={22} strokeWidth={2.5} aria-hidden="true" />
                <span>{editingPromoId ? 'Edit offer' : 'New offer'}</span>
              </button>
            </div>
          </header>

          {mobileStep === 1 && (
            <>
              <div className="rt-flow-phone__body space-y-3">
                <div className="rt-in">
                  <label htmlFor="promo-name-phone" className="rt-in__label">
                    OFFER NAME
                  </label>
                  <input
                    id="promo-name-phone"
                    type="text"
                    value={draftPromo.name}
                    onChange={(e) => setDraftPromo({ ...draftPromo, name: e.target.value })}
                    placeholder="e.g. Diwali Deal"
                    className="rt-in__control"
                  />
                </div>

                <div>
                  <div className="hh-set-section-lbl">PROMOTION TYPE</div>
                  <div className="space-y-2" role="radiogroup" aria-label="Promotion type">
                    {promoTypeOptions.map((opt) => {
                      const checked = draftPromo.type === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          role="radio"
                          aria-checked={checked}
                          onClick={() =>
                            setDraftPromo((prev) => ({
                              ...prev,
                              type: opt.id,
                              freeItemRule: prev.freeItemRule || 'CHEAPEST_IN_GROUP',
                            }))
                          }
                          className="hh-set-radio"
                        >
                          <span className="hh-set-radio__dot" aria-hidden="true" />
                          <span className="text-[13.5px] font-semibold text-[var(--text)] leading-snug">
                            {opt.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {(draftPromo.type === 'bogo' ||
                  draftPromo.type === 'buy_x_get_different_free' ||
                  draftPromo.type === 'group_buy_n_get_m_free') && (
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="rt-in">
                      <label htmlFor="promo-buyqty-phone" className="rt-in__label">
                        BUY QTY
                      </label>
                      <input
                        id="promo-buyqty-phone"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        value={draftPromo.buyQty}
                        onChange={(e) => setDraftPromo({ ...draftPromo, buyQty: Number(e.target.value) })}
                        className="rt-in__control tabular-nums"
                      />
                    </div>
                    <div className="rt-in">
                      <label htmlFor="promo-freeqty-phone" className="rt-in__label">
                        FREE QTY
                      </label>
                      <input
                        id="promo-freeqty-phone"
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
                        className="rt-in__control tabular-nums"
                      />
                    </div>
                  </div>
                )}

                {draftPromo.type === 'group_buy_n_get_m_free' && (
                  <div className="rt-in">
                    <label htmlFor="promo-rule-phone" className="rt-in__label">
                      FREE ITEM RULE
                    </label>
                    <div className="rt-in__select-wrap">
                      <select
                        id="promo-rule-phone"
                        value={draftPromo.freeItemRule || 'CHEAPEST_IN_GROUP'}
                        onChange={(e) => setDraftPromo({ ...draftPromo, freeItemRule: e.target.value as any })}
                        className="rt-in__control"
                      >
                        <option value="CHEAPEST_IN_GROUP">Cheapest in group</option>
                        <option value="SAME_AS_LAST_ADDED">Last added item</option>
                        <option value="SPECIFIC_PRODUCT">Specific reward product</option>
                        <option value="CUSTOMER_CHOICE_FROM_GROUP">Customer choice at checkout</option>
                      </select>
                      <ChevronDown size={15} className="rt-in__select-chev" aria-hidden="true" />
                    </div>
                  </div>
                )}

                {(draftPromo.type === 'buy_x_get_different_free' ||
                  (draftPromo.type === 'group_buy_n_get_m_free' && draftPromo.freeItemRule === 'SPECIFIC_PRODUCT')) && (
                  <div className="rt-in">
                    <label htmlFor="promo-freeprod-phone" className="rt-in__label">
                      FREE REWARD PRODUCT
                    </label>
                    <div className="rt-in__select-wrap">
                      <select
                        id="promo-freeprod-phone"
                        value={draftPromo.freeProductId || ''}
                        onChange={(e) =>
                          setDraftPromo({
                            ...draftPromo,
                            freeProductId: e.target.value ? Number(e.target.value) : undefined,
                          })
                        }
                        className="rt-in__control"
                      >
                        <option value="">Choose free product…</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (₹{p.retail}/cs)
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={15} className="rt-in__select-chev" aria-hidden="true" />
                    </div>
                  </div>
                )}

                {draftPromo.type === 'bundle' && (
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="rt-in">
                        <label htmlFor="promo-dist-phone" className="rt-in__label">
                          DISTINCT TYPES REQ.
                        </label>
                        <input
                          id="promo-dist-phone"
                          type="number"
                          inputMode="numeric"
                          min={1}
                          value={draftPromo.requiredDistinctTypes || 2}
                          onChange={(e) =>
                            setDraftPromo({ ...draftPromo, requiredDistinctTypes: Number(e.target.value) })
                          }
                          className="rt-in__control tabular-nums"
                        />
                      </div>
                      <div className="rt-in">
                        <label htmlFor="promo-minqty-phone" className="rt-in__label">
                          MIN QTY PER TYPE
                        </label>
                        <input
                          id="promo-minqty-phone"
                          type="number"
                          inputMode="numeric"
                          min={1}
                          value={draftPromo.minQtyPerType || 1}
                          onChange={(e) => setDraftPromo({ ...draftPromo, minQtyPerType: Number(e.target.value) })}
                          className="rt-in__control tabular-nums"
                        />
                      </div>
                    </div>
                    <div className="rt-in">
                      <label htmlFor="promo-bfree-phone" className="rt-in__label">
                        FREE QTY AWARDED
                      </label>
                      <input
                        id="promo-bfree-phone"
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
                        className="rt-in__control tabular-nums"
                      />
                    </div>
                  </div>
                )}

                {draftPromo.type === 'percent' && (
                  <div className="rt-in">
                    <label htmlFor="promo-pct-phone" className="rt-in__label">
                      PERCENT OFF (%)
                    </label>
                    <input
                      id="promo-pct-phone"
                      type="number"
                      inputMode="decimal"
                      min={1}
                      max={100}
                      value={draftPromo.percent}
                      onChange={(e) => setDraftPromo({ ...draftPromo, percent: Number(e.target.value) })}
                      className="rt-in__control tabular-nums"
                    />
                  </div>
                )}

                {draftPromo.type === 'flat' && (
                  <div className="rt-in">
                    <label htmlFor="promo-flat-phone" className="rt-in__label">
                      FLAT OFF PER CASE (₹)
                    </label>
                    <input
                      id="promo-flat-phone"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={draftPromo.flatPerCase}
                      onChange={(e) => setDraftPromo({ ...draftPromo, flatPerCase: Number(e.target.value) })}
                      className="rt-in__control tabular-nums"
                    />
                  </div>
                )}
              </div>

              <footer className="rt-flow-phone__footer">
                <button type="button" onClick={goNextFromStep1} className="rt-btn w-full">
                  Next: products
                </button>
              </footer>
            </>
          )}

          {mobileStep === 2 && (
            <>
              <div className="rt-flow-phone__body space-y-3">
                <div>
                  <div className="hh-set-section-lbl">APPLIES TO</div>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { id: 'products', label: 'Products' },
                        { id: 'category', label: 'Category tag' },
                        { id: 'brand', label: 'Brand tag' },
                      ] as const
                    ).map((modeOpt) => (
                      <button
                        key={modeOpt.id}
                        type="button"
                        onClick={() => setMobileScopeMode(modeOpt.id)}
                        className={`hh-set-seg2__btn ${mobileScopeMode === modeOpt.id ? '' : ''}`}
                        aria-pressed={mobileScopeMode === modeOpt.id}
                        style={{
                          borderRadius: '999px',
                          minHeight: '38px',
                          padding: '0 16px',
                        }}
                      >
                        {modeOpt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {mobileScopeMode === 'products' && (
                  <>
                    <div className="rt-search-bar">
                      <Search size={17} style={{ color: 'var(--text-2)' }} aria-hidden="true" />
                      <input
                        enterKeyHint="search"
                        type="search"
                        value={mobileProdQuery}
                        onChange={(e) => setMobileProdQuery(e.target.value)}
                        placeholder="Search products"
                        aria-label="Search products"
                      />
                      {mobileProdQuery && (
                        <button
                          type="button"
                          onClick={() => setMobileProdQuery('')}
                          className="p-1 min-w-0 min-h-0 border-0 bg-transparent text-[var(--text-2)] cursor-pointer"
                          aria-label="Clear product search"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>

                    {selectedProductsList.length > 0 && (
                      <div className="hh-set-list">
                        {selectedProductsList.map((p) => (
                          <div
                            key={`sel-${p.id}`}
                            className="hh-set-row"
                            style={{ cursor: 'default' }}
                          >
                            <PackIcon pack={p.pack} name={p.name} size="sm" />
                            <span className="flex-1 min-w-0 text-[14px] font-bold text-[var(--text)] break-words">
                              {p.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleProduct(p.id)}
                              className="min-w-0 min-h-[36px] px-2 border-0 bg-transparent text-[13px] font-bold cursor-pointer shrink-0"
                              style={{ color: 'var(--due)' }}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {unselectedProductsList.length > 0 && (
                      <div className="hh-set-list">
                        {unselectedProductsList.map((p) => (
                          <button
                            key={`unsel-${p.id}`}
                            type="button"
                            onClick={() => toggleProduct(p.id)}
                            className="hh-set-row"
                          >
                            <PackIcon pack={p.pack} name={p.name} size="sm" />
                            <span className="flex-1 min-w-0 text-[14px] font-medium text-[var(--text)] break-words">
                              {p.name}
                            </span>
                            <span className="text-[12.5px] font-bold shrink-0" style={{ color: 'var(--primary)' }}>
                              + Add
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    <p className="text-[12px] text-[var(--text-2)] px-1">
                      {draftPromo.type === 'buy_x_get_different_free'
                        ? 'Select at least one trigger product (Product A).'
                        : 'Leave empty to apply to all products.'}
                    </p>
                  </>
                )}

                {mobileScopeMode === 'category' && (
                  <div className="space-y-2">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={!draftPromo.groupCategory}
                      onClick={() => applyCategoryTag('')}
                      className="hh-set-radio"
                    >
                      <span className="hh-set-radio__dot" aria-hidden="true" />
                      <span className="text-[13.5px] font-semibold text-[var(--text)]">All Categories</span>
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        role="radio"
                        aria-checked={draftPromo.groupCategory === cat}
                        onClick={() => applyCategoryTag(cat)}
                        className="hh-set-radio"
                      >
                        <span className="hh-set-radio__dot" aria-hidden="true" />
                        <span className="text-[13.5px] font-semibold text-[var(--text)]">{cat}</span>
                      </button>
                    ))}
                  </div>
                )}

                {mobileScopeMode === 'brand' && (
                  <div className="space-y-2">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={!draftPromo.groupBrand}
                      onClick={() => applyBrandTag('')}
                      className="hh-set-radio"
                    >
                      <span className="hh-set-radio__dot" aria-hidden="true" />
                      <span className="text-[13.5px] font-semibold text-[var(--text)]">All Brands</span>
                    </button>
                    {brands.map((brand) => (
                      <button
                        key={brand}
                        type="button"
                        role="radio"
                        aria-checked={draftPromo.groupBrand === brand}
                        onClick={() => applyBrandTag(brand)}
                        className="hh-set-radio"
                      >
                        <span className="hh-set-radio__dot" aria-hidden="true" />
                        <span className="text-[13.5px] font-semibold text-[var(--text)]">{brand}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <footer className="rt-flow-phone__footer">
                <button type="button" onClick={goNextFromStep2} className="rt-btn w-full">
                  Next: preview
                </button>
              </footer>
            </>
          )}

          {mobileStep === 3 && (
            <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0">
              <div className="rt-flow-phone__body space-y-3">
                <div className="rt-dashed-preview">
                  <div className="font-bold text-[14px] mb-1">Offer preview</div>
                  <div>{previewText}</div>
                </div>

                <div className="rt-card rt-card--divided">
                  <div className="rt-ln">
                    <span className="text-[var(--text-2)] font-medium">
                      {draftPromo.type === 'bogo' || draftPromo.type === 'bundle' ? 'Free qty awarded' : 'Offer rule'}
                    </span>
                    <span className="font-bold text-[var(--text)]">{ruleSummaryVal}</span>
                  </div>
                  <div className="rt-ln">
                    <span className="text-[var(--text-2)] font-medium">Applies to</span>
                    <span className="font-bold text-[var(--text)] text-right">{appliesSummaryVal}</span>
                  </div>
                </div>

                <div className="rt-card flex items-center justify-between gap-3">
                  <span className="text-[14px] font-bold text-[var(--text)]">Live now</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={draftPromo.isActive !== false}
                    aria-label="Live now"
                    onClick={() =>
                      setDraftPromo((prev) => ({
                        ...prev,
                        isActive: prev.isActive === false,
                      }))
                    }
                    className="hh-switch"
                  >
                    <span className="hh-switch__thumb" />
                  </button>
                </div>

                {editingPromoId && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = promotions.find((x) => x.id === editingPromoId);
                      if (target) setPromoToDelete(target);
                    }}
                    className="hh-set-btn-danger-outline w-full"
                  >
                    <Trash2 size={15} aria-hidden="true" />
                    Delete offer
                  </button>
                )}
              </div>

              <footer className="rt-flow-phone__footer">
                <button type="submit" className="rt-btn w-full">
                  Save offer
                </button>
              </footer>
            </form>
          )}
        </div>
      )}

      {promoToDelete && (
        <div className="rt-bsheet-scrim" role="dialog" aria-modal="true" aria-labelledby="del-promo-phone-title" onClick={() => setPromoToDelete(null)}>
          <div className="rt-bsheet rt-bsheet--white space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="hh-grab" />
            <div>
              <h3 id="del-promo-phone-title" className="text-[17px] font-extrabold" style={{ color: 'var(--due)' }}>
                Delete {promoToDelete.name}?
              </h3>
              <p className="text-[13px] text-[var(--text-2)] mt-1 leading-relaxed">
                It will be immediately removed from trade billing and synced across cloud.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-semibold text-slate-700 block">
                  Reason for deleting *
                </label>
                <span className={`text-xs font-medium tabular-nums ${delReasonOk ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {deleteReason.trim().length}/4 min chars
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {['Offer expired', 'Replaced by new scheme', 'Duplicate setup', 'Entered by mistake'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setDeleteReason(preset)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                      deleteReason.trim().toLowerCase() === preset.toLowerCase()
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
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
                placeholder="e.g. Offer expired, replaced by new scheme"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none font-sans"
              />
            </div>
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setPromoToDelete(null)}
                className="rt-btn-outline rt-btn-outline--primary"
              >
                Keep
              </button>
              <button
                type="button"
                disabled={!delReasonOk}
                onClick={() => {
                  deletePromotion(promoToDelete.id, deleteReason.trim());
                  setPromoToDelete(null);
                  cancelEdit();
                }}
                className="rt-btn rt-btn--due disabled:opacity-45 disabled:cursor-not-allowed"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
