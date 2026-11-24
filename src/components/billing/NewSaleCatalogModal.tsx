import React from 'react';
import {
  ArrowLeft,
  Citrus,
  CupSoda,
  Droplets,
  Gift,
  LayoutGrid,
  Minus,
  Package,
  Plus,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Tag,
  Truck,
  Warehouse as WarehouseIcon,
  X,
  Zap,
} from 'lucide-react';
import { BillItem, Product, Promotion } from '../../types';
import { sizeTheme, packTheme } from '../../utils/sizeColor';
import { PackIcon, packTextColor } from '../common/PackIcon';
import { computeLine, schemeLabel } from '../../utils/billing';
import { CATS } from '../../constants/initialData';
import { shortCategoryLabel } from '../../utils/categoryLabel';
import { getProductDefaultPrice, ProductCardMedia } from './newSaleHelpers';
import { SaleSource } from './OrderContextBar';

export interface NewSaleCatalogModalProps {
  isPhone: boolean;
  isOdia: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
  inr: (n: number) => string;
  selectedCustomerId: string;
  customerName: string;
  creditInfo: { limit: number; due: number; available: number | null };
  selectedStockLabel: string;
  saleSource: SaleSource;
  goBackToStep1: () => void;
  requestCancelSale: () => void;
  onCloseSelector: () => void;
  onProceedToReview: () => void;
  onProceedToPhoneCart: () => void;
  catalogFilterRef: React.RefObject<HTMLDivElement | null>;
  catalogFilterOpen: boolean;
  setCatalogFilterOpen: React.Dispatch<React.SetStateAction<boolean>>;
  beverageSearch: string;
  setBeverageSearch: (v: string) => void;
  selectedCategory: string;
  setSelectedCategory: React.Dispatch<React.SetStateAction<string>>;
  selectedPackFilter: 'all' | 'can' | 'pet' | 'glass' | 'tetra';
  setSelectedPackFilter: (v: 'all' | 'can' | 'pet' | 'glass' | 'tetra') => void;
  selectedSize: string;
  setSelectedSize: (v: string) => void;
  schemesOnly: boolean;
  setSchemesOnly: React.Dispatch<React.SetStateAction<boolean>>;
  inCartOnly: boolean;
  setInCartOnly: React.Dispatch<React.SetStateAction<boolean>>;
  sizeOptions: { id: string; label: string }[];
  categories: string[];
  categoryCounts: Map<string, number>;
  baseFilteredProducts: Product[];
  filteredProducts: Product[];
  categorySections: { key: string; label: string; items: Product[] }[];
  inStockCount: number;
  schemeMatchCount: number;
  cartMatchCount: number;
  hasActiveSchemeForProduct: (prod: Product) => boolean;
  getProductStock: (id: number) => number;
  selectedItems: Record<number, number>;
  customRates: Record<number, number>;
  customSchemes: Record<number, Promotion | null>;
  schemeMode: 'auto' | 'none' | 'manual';
  schemesEnabled?: boolean;
  autoApplyPromotions?: boolean;
  activePromoFor?: (id: number) => Promotion | null;
  products: Product[];
  lineItems: BillItem[];
  lowStockLimit: number;
  nameCounts: Map<string, number>;
  setItemQty: (productId: number, qty: number) => void;
  openQuickEntry: (prod: Product) => void;
  totalCartQty: number;
  totalFreeQty: number;
  totalDiscount: number;
  grandTotal: number;
}

export const NewSaleCatalogModal: React.FC<NewSaleCatalogModalProps> = ({
  isPhone,
  isOdia,
  t,
  inr,
  selectedCustomerId,
  customerName,
  creditInfo,
  selectedStockLabel,
  saleSource,
  goBackToStep1,
  requestCancelSale,
  onCloseSelector,
  onProceedToReview,
  onProceedToPhoneCart,
  catalogFilterRef,
  catalogFilterOpen,
  setCatalogFilterOpen,
  beverageSearch,
  setBeverageSearch,
  selectedCategory,
  setSelectedCategory,
  selectedPackFilter,
  setSelectedPackFilter,
  selectedSize,
  setSelectedSize,
  schemesOnly,
  setSchemesOnly,
  inCartOnly,
  setInCartOnly,
  sizeOptions,
  categories,
  categoryCounts,
  baseFilteredProducts,
  filteredProducts,
  categorySections,
  inStockCount,
  schemeMatchCount,
  cartMatchCount,
  hasActiveSchemeForProduct,
  getProductStock,
  selectedItems,
  customRates,
  customSchemes,
  schemeMode,
  schemesEnabled,
  autoApplyPromotions,
  activePromoFor,
  products,
  lineItems,
  lowStockLimit,
  nameCounts,
  setItemQty,
  openQuickEntry,
  totalCartQty,
  totalFreeQty,
  totalDiscount,
  grandTotal,
}) => {
  if (isPhone) {
    const isWalkIn = selectedCustomerId === '__walkin__';
    const activeFilterCount =
      (selectedPackFilter !== 'all' ? 1 : 0) +
      (selectedSize !== 'all' ? 1 : 0) +
      (schemesOnly ? 1 : 0) +
      (inCartOnly ? 1 : 0);
    const packChoices: { id: 'all' | 'pet' | 'can' | 'glass' | 'tetra'; label: string; shortLabel: string }[] = [
      { id: 'all', label: 'All packs', shortLabel: 'All' },
      { id: 'pet', label: 'PET Bottle', shortLabel: 'PET' },
      { id: 'can', label: 'Can / Tin', shortLabel: 'Can' },
      { id: 'glass', label: 'Glass RGB', shortLabel: 'Glass' },
      { id: 'tetra', label: 'Tetra / Pouch', shortLabel: 'Tetra' },
    ];
    const activePackShort =
      selectedPackFilter !== 'all'
        ? packChoices.find((pk) => pk.id === selectedPackFilter)?.shortLabel
        : undefined;
    const activeSizeLabel =
      selectedSize !== 'all'
        ? selectedSize === 'soda'
          ? t('sell.sizeSoda') || 'Soda'
          : sizeOptions.find((sz) => sz.id === selectedSize)?.label
        : undefined;
    const orderedPhoneProducts = categorySections.flatMap((s) => s.items);

    const toggleSchemesOnly = () => {
      setSchemesOnly((prev) => {
        const next = !prev;
        if (next && selectedCategory !== 'all') {
          const catHasScheme = baseFilteredProducts.some(
            (p) => (p.category || 'other') === selectedCategory && hasActiveSchemeForProduct(p),
          );
          if (!catHasScheme) setSelectedCategory('all');
        }
        return next;
      });
    };

    const toggleInCartOnly = () => {
      setInCartOnly((prev) => {
        const next = !prev;
        if (next && selectedCategory !== 'all') {
          const catHasCart = baseFilteredProducts.some(
            (p) => (p.category || 'other') === selectedCategory && (selectedItems[p.id] || 0) > 0,
          );
          if (!catHasCart) setSelectedCategory('all');
        }
        return next;
      });
    };

    return (
      <div
        data-esc-close
        role="dialog"
        aria-modal="true"
        aria-label="Beverage Catalog"
        className="rt-sale-sheet"
      >
        {/* 1. Header (--primary): back + customer/walk-in, right = due/no-customer tag, 4-bar progress, search */}
        <header className="rt-sale-header">
          <div className="rt-sale-header__row">
            <button
              type="button"
              onClick={goBackToStep1}
              aria-label="Back to customer selection"
              className="rt-sale-header__back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="rt-sale-header__title">
              {isWalkIn ? t('sell.walkInSale') : (customerName || t('sell.walkInSale'))}
            </h2>
            <div className="rt-sale-header__right">
              {isWalkIn ? (
                <span className="rt-tag rt-tag--ghost">{t('sell.noCustomer')}</span>
              ) : (
                <span className={`rt-tag ${creditInfo.due > 0.004 ? 'rt-tag--soon' : 'rt-tag--paid'}`}>
                  {creditInfo.due > 0.004 ? `${t('sell.currentDue')} ${inr(creditInfo.due)}` : t('sell.paid')}
                </span>
              )}
              <button
                type="button"
                onClick={requestCancelSale}
                aria-label={t('salesman.cancelSale')}
                className="rt-sale-header__cancel"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{t('common.cancel')}</span>
              </button>
            </div>
          </div>

          <div className="rt-seg" aria-hidden="true">
            <span className="rt-seg__bar rt-seg__bar--on" />
            <span className="rt-seg__bar rt-seg__bar--on" />
            <span className="rt-seg__bar" />
            <span className="rt-seg__bar" />
          </div>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="rt-stp m-0">{t('sell.step2PickProducts')}</p>
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15 text-white text-xs font-semibold max-w-[60%] truncate"
              title={selectedStockLabel}
            >
              {saleSource === 'trip' ? (
                <Truck className="w-3 h-3 shrink-0" aria-hidden="true" />
              ) : (
                <WarehouseIcon className="w-3 h-3 shrink-0" aria-hidden="true" />
              )}
              <span className="truncate">
                {saleSource === 'trip' ? `Van: ${selectedStockLabel}` : selectedStockLabel}
              </span>
            </span>
          </div>

          <div ref={catalogFilterRef} className="relative">
            <div className="rt-sale-search">
              <Search className="w-4 h-4 rt-sale-search__icon" />
              <input
                type="text"
                enterKeyHint="search"
                placeholder={t('sell.searchProducts')}
                aria-label={t('sell.searchProducts')}
                value={beverageSearch}
                onChange={(e) => setBeverageSearch(e.target.value)}
                className="rt-sale-search__input"
              />
              {beverageSearch && (
                <button
                  type="button"
                  onClick={() => setBeverageSearch('')}
                  aria-label="Clear search"
                  className="rt-sale-search__btn"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setCatalogFilterOpen((v) => !v)}
                aria-label="Filter beverages"
                aria-expanded={catalogFilterOpen}
                className={`rt-sale-search__btn ${activeFilterCount > 0 || catalogFilterOpen ? 'rt-sale-search__btn--active' : ''}`}
              >
                <SlidersHorizontal className="w-4 h-4" />
                {activeFilterCount > 0 && (
                  <span className="rt-sale-search__badge">{activeFilterCount}</span>
                )}
              </button>
            </div>

            {catalogFilterOpen && (
              <div
                role="dialog"
                aria-label="Beverage filters"
                className="rt-card absolute left-0 right-0 top-full mt-2 z-50 space-y-3 max-h-[60vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-bold text-[var(--text-2)]">
                    {t('sell.sizeFilter')}
                  </span>
                  <div className="flex items-center gap-2">
                    {activeFilterCount > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPackFilter('all');
                          setSelectedSize('all');
                          setSchemesOnly(false);
                          setInCartOnly(false);
                        }}
                        className="text-xs font-bold text-[var(--primary)] cursor-pointer"
                      >
                        Reset
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setCatalogFilterOpen(false)}
                      className="rt-tag cursor-pointer"
                    >
                      {t('sell.done')}
                    </button>
                  </div>
                </div>

                {(schemeMatchCount > 0 || schemesOnly || cartMatchCount > 0 || inCartOnly) && (
                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold text-[var(--text-2)]">Quick Filters</div>
                    <div className="flex flex-wrap gap-1.5">
                      {(schemeMatchCount > 0 || schemesOnly) && (
                        <button
                          type="button"
                          aria-pressed={schemesOnly}
                          onClick={toggleSchemesOnly}
                          className="rt-chip rt-chip--offer"
                        >
                          <Tag className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Offers</span>
                          <span className="rt-chip__count">{schemeMatchCount}</span>
                        </button>
                      )}
                      {(cartMatchCount > 0 || inCartOnly) && (
                        <button
                          type="button"
                          aria-pressed={inCartOnly}
                          onClick={toggleInCartOnly}
                          className="rt-chip"
                        >
                          <ShoppingCart className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>In cart</span>
                          <span className="rt-chip__count">{cartMatchCount}</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className={`space-y-1.5 ${(schemeMatchCount > 0 || cartMatchCount > 0) ? 'pt-2 border-t border-[var(--border)]' : ''}`}>
                  <div className="text-xs font-semibold text-[var(--text-2)]">Pack Type</div>
                  <div className="flex flex-wrap gap-1.5">
                    {packChoices.map((pk) => (
                      <button
                        key={pk.id}
                        type="button"
                        aria-pressed={selectedPackFilter === pk.id}
                        onClick={() => setSelectedPackFilter(pk.id)}
                        className="rt-chip"
                      >
                        {pk.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-[var(--border)]">
                  <div className="text-xs font-semibold text-[var(--text-2)]">Size</div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { id: 'all', label: t('sell.sizeAll') || 'All' },
                      ...sizeOptions,
                      { id: 'soda', label: t('sell.sizeSoda') || 'Soda' },
                    ].map((sz) => (
                      <button
                        key={sz.id}
                        type="button"
                        aria-pressed={selectedSize === sz.id}
                        onClick={() => setSelectedSize(sz.id)}
                        className="rt-chip"
                      >
                        {sz.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* 2. Smart filter chips row */}
        <div className="rt-chips" role="group" aria-label="Product filters">
          <button
            type="button"
            aria-pressed={
              selectedCategory === 'all' &&
              !schemesOnly &&
              !inCartOnly &&
              selectedPackFilter === 'all' &&
              selectedSize === 'all'
            }
            onClick={() => {
              setSelectedCategory('all');
              setSelectedPackFilter('all');
              setSelectedSize('all');
              setSchemesOnly(false);
              setInCartOnly(false);
            }}
            className="rt-chip"
          >
            <span>{t('sell.categoryAll')}</span>
            <span className="rt-chip__count">{baseFilteredProducts.length}</span>
          </button>

          {activePackShort && (
            <button
              type="button"
              aria-pressed="true"
              onClick={() => setSelectedPackFilter('all')}
              aria-label={`Remove ${activePackShort} pack filter`}
              className="rt-chip"
            >
              <span>{activePackShort}</span>
              <X className="w-3.5 h-3.5 opacity-80" aria-hidden="true" />
            </button>
          )}

          {activeSizeLabel && (
            <button
              type="button"
              aria-pressed="true"
              onClick={() => setSelectedSize('all')}
              aria-label={`Remove ${activeSizeLabel} size filter`}
              className="rt-chip"
            >
              <span>{activeSizeLabel}</span>
              <X className="w-3.5 h-3.5 opacity-80" aria-hidden="true" />
            </button>
          )}

          {(schemeMatchCount > 0 || schemesOnly) && (
            <button
              type="button"
              aria-pressed={schemesOnly}
              onClick={toggleSchemesOnly}
              className="rt-chip rt-chip--offer"
            >
              <Tag className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Offers</span>
              <span className="rt-chip__count">{schemeMatchCount}</span>
            </button>
          )}

          {(cartMatchCount > 0 || inCartOnly) && (
            <button
              type="button"
              aria-pressed={inCartOnly}
              onClick={toggleInCartOnly}
              className="rt-chip"
            >
              <ShoppingCart className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>In cart</span>
              <span className="rt-chip__count">{cartMatchCount}</span>
            </button>
          )}

          {categories
            .filter((cat) => cat !== 'all')
            .map((cat, idx) => {
              const count = categoryCounts.get(cat) || 0;
              if (count === 0 && selectedCategory !== cat) return null;
              const label = shortCategoryLabel(cat);
              return (
                <button
                  key={cat || `cat_${idx}`}
                  type="button"
                  aria-pressed={selectedCategory === cat}
                  onClick={() =>
                    setSelectedCategory((prev) => (prev === cat ? 'all' : cat))
                  }
                  className="rt-chip"
                >
                  <span>{label}</span>
                  <span className="rt-chip__count">{count}</span>
                </button>
              );
            })}
        </div>

        {/* 3 & 4. Scrollable product grid + Walk-in notice + Offer banner */}
        <div className="rt-sale-body">
          {isWalkIn && (
            <div className="rt-noti" role="status">
              <Zap className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{t('sell.walkInNotice')}</span>
            </div>
          )}

          {(totalDiscount > 0 || totalFreeQty > 0) && (
            <div className="rt-offer-banner" role="status">
              <Tag className="w-4 h-4 shrink-0" />
              <span className="rt-offer-banner__text">
                {t('sell.offerApplied')}
                {totalDiscount > 0 ? ` · −${inr(totalDiscount)}` : ''}
                {totalFreeQty > 0 ? ` · +${t('sell.freeCases', { n: totalFreeQty })}` : ''}
              </span>
              <span className="rt-tag rt-tag--soon shrink-0">{t('sell.applied')}</span>
            </div>
          )}

          {orderedPhoneProducts.length === 0 ? (
            <div className="rt-card text-center space-y-3 py-8">
              <Package className="w-8 h-8 mx-auto text-[var(--text-2)]" />
              <p className="text-sm font-semibold text-[var(--text)]">
                {inStockCount === 0
                  ? `No beverages with stock available in ${selectedStockLabel}`
                  : `No beverages match your filters in ${selectedStockLabel}`}
              </p>
              {(selectedCategory !== 'all' || selectedPackFilter !== 'all' || selectedSize !== 'all' || schemesOnly || inCartOnly || beverageSearch.trim() !== '') && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('all');
                    setSelectedPackFilter('all');
                    setSelectedSize('all');
                    setSchemesOnly(false);
                    setInCartOnly(false);
                    setBeverageSearch('');
                  }}
                  className="rt-btn-outline"
                >
                  Reset Filters
                </button>
              )}
            </div>
          ) : (
            <div className="rt-prod-grid">
              {orderedPhoneProducts.map((prod, idx) => {
                const available = getProductStock(prod.id);
                const inCartQty = selectedItems[prod.id] || 0;
                const defaultRate = getProductDefaultPrice(prod);
                const customRate = customRates[prod.id];
                const currentRate = customRate !== undefined ? customRate : defaultRate;
                const sTheme = sizeTheme(prod.volume, prod.name);
                const pTheme = packTheme(prod.pack, prod.name);

                const userChoice = customSchemes[prod.id];
                let activePromo: Promotion | null = null;
                if (userChoice !== undefined) {
                  activePromo = userChoice;
                } else if (schemeMode === 'none' || schemesEnabled === false || autoApplyPromotions === false) {
                  activePromo = null;
                } else {
                  activePromo = activePromoFor ? activePromoFor(prod.id) : null;
                }
                const promoLabel = activePromo ? schemeLabel(activePromo, products) : null;
                const isOos = available <= 0;
                const packParts = [
                  sTheme.label,
                  pTheme.label,
                  prod.unitsPerCrate ? t('sell.packInfo', { pcs: prod.unitsPerCrate }) : '',
                ].filter(Boolean);
                const leftAfterCart = Math.max(0, available - inCartQty);
                const stockTone = isOos
                  ? 'rt-prod-stock--oos'
                  : leftAfterCart <= lowStockLimit
                    ? 'rt-prod-stock--low'
                    : 'rt-prod-stock--ok';
                const stockText = isOos
                  ? (saleSource === 'trip' ? t('salesman.empty') : t('sell.outOfStock'))
                  : saleSource === 'trip'
                    ? (inCartQty > 0
                        ? `${available} ${t('salesman.inVan')} · ${t('sell.leftCount', { n: leftAfterCart })}`
                        : `${available} ${t('salesman.inVan')}`)
                    : t('sell.leftCount', { n: leftAfterCart });

                return (
                  <div
                    key={prod.id !== undefined ? `prod_${prod.id}` : `prod_idx_${idx}`}
                    className={`rt-card rt-prod-card ${inCartQty > 0 ? 'rt-prod-card--in-cart' : ''} ${isOos ? 'rt-prod-card--oos' : ''}`}
                  >
                    <div className="rt-prod-media">
                      {promoLabel && (
                        <span className="rt-prod-scheme" title={promoLabel}>
                          {t('sell.scheme')}
                        </span>
                      )}
                      <ProductCardMedia product={prod} />
                    </div>

                    <div className="rt-prod-info">
                      <h3 className="rt-prod-name">
                        {prod.name}
                        {isOdia && prod.nameOr ? (
                          <span className="block text-xs font-semibold font-odia text-[var(--text-2)] mt-0.5">
                            {prod.nameOr}
                          </span>
                        ) : null}
                      </h3>
                      {packParts.length > 0 && (
                        <p className="rt-prod-pack">{packParts.join(' · ')}</p>
                      )}
                      <p className="rt-prod-price">
                        {currentRate === 0 ? '₹0' : `₹${currentRate.toLocaleString('en-IN')}`}
                      </p>
                      <div
                        className={`rt-prod-stock ${stockTone}`}
                        aria-label={saleSource === 'trip' ? `Van stock: ${stockText}` : `Stock: ${stockText}`}
                      >
                        {saleSource === 'trip' && (
                          <Truck className="w-3 h-3 shrink-0" aria-hidden="true" />
                        )}
                        <span>{stockText}</span>
                      </div>
                    </div>

                    {isOos && inCartQty === 0 ? (
                      <button type="button" disabled className="rt-prod-oos">
                        {t('sell.unavailable')}
                      </button>
                    ) : inCartQty === 0 ? (
                      <button
                        type="button"
                        id={`btn-add-beverage-${prod.id}`}
                        onClick={() => setItemQty(prod.id, 1)}
                        className="rt-prod-add"
                      >
                        <Plus className="w-4 h-4" />
                        <span>{t('sell.add')}</span>
                      </button>
                    ) : (
                      <div className="rt-prod-stepper">
                        <button
                          type="button"
                          onClick={() => setItemQty(prod.id, inCartQty - 1)}
                          aria-label={`Decrease ${prod.name}`}
                          className="rt-prod-stepper__btn"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openQuickEntry(prod)}
                          title="Tap to edit qty, rate or scheme"
                          className="rt-prod-stepper__qty"
                        >
                          {inCartQty}
                        </button>
                        <button
                          type="button"
                          disabled={saleSource === 'trip' && inCartQty >= available}
                          onClick={() => setItemQty(prod.id, inCartQty + 1)}
                          aria-label={`Increase ${prod.name}`}
                          className="rt-prod-stepper__btn"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 5. Sticky cart bar 12px above bottom nav (hide when empty) */}
        {totalCartQty > 0 && (
          <div className="rt-cartbar" role="region" aria-label={t('sell.yourBill')}>
            <div className="rt-cartbar__info">
              <span className="rt-cartbar__count">
                {totalCartQty === 1 ? t('sell.caseSingle') : t('sell.casesCount', { n: totalCartQty })}
                {totalFreeQty > 0 ? ` · +${totalFreeQty}` : ''}
              </span>
              <span className="rt-cartbar__total">{inr(grandTotal)}</span>
            </div>
            <button
              type="button"
              onClick={onProceedToPhoneCart}
              className="rt-cartbar__cta"
            >
              <span>{isWalkIn ? t('sell.reviewOrder') : t('sell.viewCart')}</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  const activeFilterCount =
    (selectedCategory !== 'all' ? 1 : 0) +
    (selectedPackFilter !== 'all' ? 1 : 0) +
    (selectedSize !== 'all' ? 1 : 0);

  const renderCategoryIcon = (cat: string, isActive: boolean) => {
    const cls = `w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-[#1B8A5A]'}`;
    switch (cat) {
      case 'all':
        return <LayoutGrid className={cls} />;
      case 'energy':
        return <Zap className={cls} />;
      case 'vibe':
        return <CupSoda className={cls} />;
      case 'joos':
        return <Citrus className={cls} />;
      case 'water':
        return <Droplets className={cls} />;
      default:
        return <Package className={cls} />;
    }
  };

  const packChoices: { id: 'all' | 'pet' | 'can' | 'glass' | 'tetra'; label: string }[] = [
    { id: 'all', label: 'All packs' },
    { id: 'pet', label: 'PET Bottle' },
    { id: 'can', label: 'Can / Tin' },
    { id: 'glass', label: 'Glass RGB' },
    { id: 'tetra', label: 'Tetra / Pouch' },
  ];

  return (
    <div
      data-esc-close
      role="dialog"
      aria-modal="true"
      aria-label="Beverage Catalog"
      className="fixed inset-0 z-50 bg-[#F8F9FA] flex flex-col"
    >
      {/* Header */}
      <header className="bg-[#0A1F44] text-white px-3 py-2.5 flex items-center gap-3 shrink-0 pt-[max(0.625rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onCloseSelector}
          aria-label="Close beverage catalog"
          className="size-11 shrink-0 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="min-w-0 flex-1 text-[17px] sm:text-lg font-extrabold text-white leading-none truncate">
          Beverage Catalog
        </h2>
        <button
          type="button"
          onClick={requestCancelSale}
          className="min-h-[44px] px-3 rounded-xl border border-white/25 bg-white/10 hover:bg-white/20 text-xs font-bold text-white inline-flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors"
          title="Cancel order & select a new customer"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{t('salesman.cancelSale')}</span>
        </button>
      </header>

      {/* Sticky customer context strip */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 shrink-0">
        <p className="text-sm font-semibold text-[#0A1F44] min-w-0 break-words">
          {customerName || 'Walk-in sale'} •{' '}
          <span className="font-medium text-gray-600">
            Available Credit:{' '}
            {creditInfo.available === null ? 'No limit' : inr(creditInfo.available)}
          </span>
        </p>
        <span
          className={`text-xs font-semibold rounded-full px-2.5 py-0.5 whitespace-nowrap ${
            saleSource === 'trip' ? 'bg-[#ECFDF5] text-[#1B8A5A]' : 'bg-slate-100 text-slate-600'
          }`}
          title={selectedStockLabel}
        >
          {saleSource === 'trip' ? 'Van Stock' : 'Warehouse Stock'}
        </span>
      </div>

      {/* Search + unified Filter icon dropdown */}
      <div className="bg-[#F8F9FA] border-b border-gray-200 px-3 md:px-4 py-2.5 shrink-0">
        <div ref={catalogFilterRef} className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            enterKeyHint="search"
            placeholder="Search name, size or pack"
            value={beverageSearch}
            onChange={(e) => setBeverageSearch(e.target.value)}
            className={`w-full min-h-[44px] pl-10 rounded-xl border border-gray-300 bg-white text-base text-[#0A1F44] focus:outline-none focus:border-[#1B8A5A] focus:ring-2 focus:ring-[#1B8A5A]/20 ${
              beverageSearch ? 'pr-24' : 'pr-14'
            }`}
          />
          {beverageSearch && (
            <button
              type="button"
              onClick={() => setBeverageSearch('')}
              aria-label="Clear search"
              className="absolute right-12 top-1/2 -translate-y-1/2 min-h-[38px] min-w-[38px] flex items-center justify-center text-gray-400 hover:text-gray-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Unified Filter Icon Button */}
          <button
            type="button"
            onClick={() => setCatalogFilterOpen((v) => !v)}
            aria-label="Filter beverages"
            aria-expanded={catalogFilterOpen}
            title="Filter category, pack & size"
            className={`absolute right-1.5 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] px-2 rounded-lg inline-flex items-center justify-center gap-1 text-xs font-bold transition-colors cursor-pointer ${
              activeFilterCount > 0 || catalogFilterOpen
                ? 'bg-[#1B8A5A] text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4 shrink-0" />
            {activeFilterCount > 0 && (
              <span className="tabular-nums text-xs font-extrabold leading-none">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Unified Filter Dropdown */}
          {catalogFilterOpen && (
            <div
              role="dialog"
              aria-label="Beverage filters"
              className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-2xl border border-[#DCE5F2] bg-white shadow-xl p-3 space-y-3 max-h-[70vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Filter catalog
                </span>
                <div className="flex items-center gap-2">
                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory('all');
                        setSelectedPackFilter('all');
                        setSelectedSize('all');
                      }}
                      className="text-xs font-bold text-[#1B8A5A] hover:underline cursor-pointer"
                    >
                      Reset to All
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setCatalogFilterOpen(false)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>

              {/* Category with icons (default: All) */}
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-slate-500">Category</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {categories.map((cat, idx) => {
                    const count = cat === 'all' ? baseFilteredProducts.length : categoryCounts.get(cat) || 0;
                    if (cat !== 'all' && count === 0 && selectedCategory !== cat) return null;
                    const label =
                      cat === 'all'
                        ? 'All'
                        : (CATS as Record<string, { name: string }>)[cat]?.name || cat;
                    const active = selectedCategory === cat;
                    return (
                      <button
                        key={cat || `cat_${idx}`}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`min-h-[40px] px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-between gap-1.5 cursor-pointer transition-colors border ${
                          active
                            ? 'bg-[#1B8A5A] border-[#1B8A5A] text-white shadow-xs'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span className="flex items-center gap-1.5 min-w-0">
                          {renderCategoryIcon(cat, active)}
                          <span className="truncate">{label}</span>
                        </span>
                        <span
                          className={`text-xs font-bold tabular-nums shrink-0 ${
                            active ? 'text-white/85' : 'text-slate-400'
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Pack Type (default: All packs) */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <div className="text-xs font-bold text-slate-500">Pack Type</div>
                <div className="flex flex-wrap gap-1.5">
                  {packChoices.map((pk) => {
                    const active = selectedPackFilter === pk.id;
                    return (
                      <button
                        key={pk.id}
                        type="button"
                        onClick={() => setSelectedPackFilter(pk.id)}
                        className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors border ${
                          active
                            ? 'bg-[#1B8A5A] border-[#1B8A5A] text-white'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {pk.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Size (default: All) */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <div className="text-xs font-bold text-slate-500">Size</div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'all', label: t('sell.sizeAll') || 'All' },
                    ...sizeOptions,
                    { id: 'soda', label: t('sell.sizeSoda') || 'Soda' },
                  ].map((sz) => {
                    const active = selectedSize === sz.id;
                    return (
                      <button
                        key={sz.id}
                        type="button"
                        onClick={() => setSelectedSize(sz.id)}
                        className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors border ${
                          active
                            ? 'bg-[#1B8A5A] border-[#1B8A5A] text-white'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {sz.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Body: product list (+ live mini-cart on tablets) */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-3 lg:px-4 pt-3 pb-28 lg:pb-6 lg:grid lg:grid-cols-12 lg:gap-6">
          <div className="lg:col-span-8 min-w-0 space-y-4">
            {(selectedCategory !== 'all' || selectedPackFilter !== 'all' || selectedSize !== 'all' || beverageSearch.trim() !== '') && (
              <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-gray-500">
                <div className="flex items-center flex-wrap gap-1.5">
                  <span className="tabular-nums font-medium">
                    Showing {filteredProducts.length} beverage{filteredProducts.length === 1 ? '' : 's'}
                  </span>
                  {selectedCategory !== 'all' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#1B8A5A] font-semibold">
                      {(CATS as Record<string, { name: string }>)[selectedCategory]?.name || selectedCategory}
                      <button
                        type="button"
                        onClick={() => setSelectedCategory('all')}
                        aria-label="Clear category filter"
                        className="cursor-pointer hover:text-[#0A1F44]"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {selectedPackFilter !== 'all' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#1B8A5A] font-semibold uppercase">
                      {selectedPackFilter}
                      <button
                        type="button"
                        onClick={() => setSelectedPackFilter('all')}
                        aria-label="Clear pack filter"
                        className="cursor-pointer hover:text-[#0A1F44]"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {selectedSize !== 'all' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#1B8A5A] font-semibold">
                      {sizeOptions.find((s) => s.id === selectedSize)?.label || selectedSize}
                      <button
                        type="button"
                        onClick={() => setSelectedSize('all')}
                        aria-label="Clear size filter"
                        className="cursor-pointer hover:text-[#0A1F44]"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('all');
                    setSelectedPackFilter('all');
                    setSelectedSize('all');
                    setBeverageSearch('');
                  }}
                  className="font-semibold text-[#1B8A5A] hover:underline cursor-pointer px-1.5 py-1"
                >
                  Clear filters
                </button>
              </div>
            )}

            {filteredProducts.length === 0 ? (
              <div data-card-tone="neutral" className="rounded-2xl border p-6 text-center space-y-3">
                <Package className="w-8 h-8 text-gray-300 mx-auto" />
                <p className="text-sm font-semibold text-[#0A1F44]">
                  {inStockCount === 0
                    ? `No beverages with stock available in ${selectedStockLabel}`
                    : `No beverages match your filters in ${selectedStockLabel}`}
                </p>
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  {(selectedCategory !== 'all' || selectedPackFilter !== 'all' || selectedSize !== 'all' || beverageSearch.trim() !== '') && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory('all');
                        setSelectedPackFilter('all');
                        setSelectedSize('all');
                        setBeverageSearch('');
                      }}
                      className="min-h-[44px] px-4 rounded-xl border border-gray-300 bg-white text-sm font-semibold text-[#0A1F44] hover:bg-gray-50 cursor-pointer"
                    >
                      Reset Filters
                    </button>
                  )}
                </div>
              </div>
            ) : (
              categorySections.map((section) => (
                <section key={section.key} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600">{section.label}</h4>
                    <span className="text-xs font-semibold text-gray-400 tabular-nums">
                      {section.items.length} SKU{section.items.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {section.items.map((prod, idx) => {
                      const available = getProductStock(prod.id);
                      const inCartQty = selectedItems[prod.id] || 0;
                      const defaultRate = getProductDefaultPrice(prod);
                      const customRate = customRates[prod.id];
                      const currentRate = customRate !== undefined ? customRate : defaultRate;
                      const isCustom = customRate !== undefined && customRate !== defaultRate;

                      const sTheme = sizeTheme(prod.volume, prod.name);
                      const pTheme = packTheme(prod.pack, prod.name);

                      const userChoice = customSchemes[prod.id];
                      let activePromo: Promotion | null = null;
                      if (userChoice !== undefined) {
                        activePromo = userChoice;
                      } else if (schemeMode === 'none' || schemesEnabled === false || autoApplyPromotions === false) {
                        activePromo = null;
                      } else {
                        activePromo = activePromoFor ? activePromoFor(prod.id) : null;
                      }
                      const promoLabel = activePromo ? schemeLabel(activePromo, products) : null;

                      const cartLine = lineItems.find((li) => li.productId === prod.id);
                      const comp = cartLine || (inCartQty > 0 ? computeLine(prod, 'Retail', inCartQty, activePromo, currentRate, 0) : null);
                      const itemGross = cartLine ? cartLine.gross : comp ? comp.gross : inCartQty * currentRate;

                      const stockBadge =
                        available <= 0
                          ? { text: 'Out of Stock', cls: 'bg-red-100 text-red-700' }
                          : available <= lowStockLimit
                            ? { text: 'Low Stock', cls: 'bg-amber-100 text-amber-800' }
                            : { text: 'In Stock', cls: 'bg-[#ECFDF5] text-[#1B8A5A]' };

                      const cardTone =
                        inCartQty > 0
                          ? 'received'
                          : available <= 0
                            ? 'due'
                            : available <= lowStockLimit
                              ? 'warning'
                              : 'sales';

                      return (
                        <div
                          key={prod.id !== undefined ? `prod_${prod.id}` : `prod_idx_${idx}`}
                          data-card-tone={cardTone}
                          className={`rounded-2xl border p-3.5 shadow-xs flex flex-col gap-3 transition-all ${
                            inCartQty > 0 ? 'ring-2 ring-emerald-500/40 shadow-sm' : ''
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <PackIcon pack={prod.pack} name={prod.name} className="mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-[#0A1F44] text-sm leading-snug break-words">
                                {prod.name}
                                {(nameCounts.get(prod.name.trim().toLowerCase()) || 0) > 1 && (
                                  <span className="ml-1.5 text-xs font-semibold text-amber-800">(Check size/pack)</span>
                                )}
                              </p>
                              <p className="mt-0.5 text-xs text-gray-600 tabular-nums">
                                {sTheme.label && (
                                  <span className="font-semibold" style={{ color: sTheme.hex }}>{sTheme.label}</span>
                                )}
                                {pTheme.label && (
                                  <span className={`font-semibold ${packTextColor(prod.pack, prod.name)}`}>
                                    {sTheme.label ? ' · ' : ''}{pTheme.label}
                                  </span>
                                )}
                                {prod.unitsPerCrate ? <span> · {prod.unitsPerCrate} pcs</span> : null}
                              </p>
                              <p className="mt-1 text-sm font-bold tabular-nums text-[#0A1F44]">
                                {currentRate === 0 ? '₹0 Free' : `₹${currentRate.toLocaleString('en-IN')} / case`}
                                {isCustom && currentRate > 0 && (
                                  <span className="ml-1.5 text-xs font-semibold text-amber-700">Custom</span>
                                )}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${stockBadge.cls}`}>
                              {stockBadge.text} · {available}
                            </span>
                            {prod.taxability === 'non_gst' && (
                              <span className="bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold px-2 py-0.5 rounded-full">
                                Non-GST · 0%
                              </span>
                            )}
                            {promoLabel && (
                              <span className="bg-emerald-100 text-emerald-800 text-xs font-medium px-2 py-0.5 rounded-full max-w-full truncate">
                                {promoLabel}
                              </span>
                            )}
                          </div>

                          {inCartQty === 0 ? (
                            <button
                              type="button"
                              id={`btn-add-beverage-${prod.id}`}
                              disabled={saleSource === 'trip' && available <= 0}
                              onClick={() => setItemQty(prod.id, 1)}
                              className="w-full min-h-[44px] rounded-xl border border-[#1B8A5A] text-[#1B8A5A] hover:bg-[#ECFDF5] font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                            >
                              <Plus className="w-4 h-4" /> {saleSource === 'trip' && available <= 0 ? 'Out of Van Stock' : 'Add'}
                            </button>
                          ) : (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="inline-flex items-center rounded-xl border border-[#1B8A5A] overflow-hidden">
                                  <button
                                    type="button"
                                    onClick={() => setItemQty(prod.id, inCartQty - 1)}
                                    aria-label={`Decrease ${prod.name}`}
                                    className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#1B8A5A] hover:bg-[#ECFDF5] cursor-pointer"
                                  >
                                    <Minus className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openQuickEntry(prod)}
                                    title="Tap to type an exact quantity"
                                    className="min-h-[44px] min-w-[44px] px-2 font-bold text-[#0A1F44] tabular-nums hover:bg-[#ECFDF5] cursor-pointer"
                                  >
                                    {inCartQty}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={saleSource === 'trip' && inCartQty >= available}
                                    onClick={() => setItemQty(prod.id, inCartQty + 1)}
                                    aria-label={`Increase ${prod.name}`}
                                    className="min-h-[44px] min-w-[44px] flex items-center justify-center bg-[#1B8A5A] text-white hover:bg-[#157048] cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </button>
                                </div>
                                <div className="text-right min-w-0">
                                  <p className="font-bold text-[#0A1F44] tabular-nums">{inr(itemGross)}</p>
                                  {comp && comp.freeQty > 0 && (
                                    <p className="text-xs font-semibold text-[#1B8A5A]">+{comp.freeQty} Free Case{comp.freeQty === 1 ? '' : 's'}</p>
                                  )}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => openQuickEntry(prod)}
                                className="w-full min-h-[44px] rounded-xl border border-gray-200 bg-[#F8F9FA] hover:bg-gray-100 text-sm font-semibold text-[#0A1F44] inline-flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Gift className="w-4 h-4 text-[#1B8A5A]" /> Scheme / Custom Price
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))
            )}
          </div>

          {/* Desktop: sticky live mini-cart */}
          <aside className="hidden lg:block lg:col-span-4 min-w-0" aria-label="Live cart">
            <div className="sticky top-0 bg-white rounded-xl border border-gray-200 p-5 max-h-[calc(100vh-14rem)] overflow-y-auto flex flex-col">
              <h3 className="text-sm font-bold text-[#0A1F44]">Your Order</h3>
              {lineItems.length === 0 ? (
                <p className="mt-3 text-sm text-gray-500">No items yet. Tap Add on a product.</p>
              ) : (
                <ul className="mt-3 divide-y divide-gray-100">
                  {lineItems.map((it) => (
                    <li key={String(it.key ?? it.productId)} className="flex items-start justify-between gap-2 py-2 text-sm">
                      <span className="min-w-0 break-words text-[#0A1F44]">
                        {it.productName} <span className="text-gray-500">× {it.qty}</span>
                      </span>
                      <span className="font-semibold tabular-nums text-[#0A1F44] shrink-0">{inr(it.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 pt-3 border-t border-gray-200 flex items-center justify-between">
                <span className="text-sm text-gray-600">{totalCartQty} Cases{totalFreeQty > 0 ? ` (${totalFreeQty} free)` : ''}</span>
                <span className="text-lg font-bold text-[#0A1F44] tabular-nums">{inr(grandTotal)}</span>
              </div>
              <button
                type="button"
                disabled={totalCartQty === 0}
                onClick={onProceedToReview}
                className="mt-4 w-full min-h-[48px] rounded-xl bg-[#1B8A5A] hover:bg-[#157048] text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Proceed to Review →
              </button>
            </div>
          </aside>
        </div>
      </div>

      {/* Mobile & Tablet: floating cart bar */}
      {totalCartQty > 0 && (
        <div className="lg:hidden hh-new-sale-cartbar fixed bottom-4 inset-x-4 bg-[#0A1F44] text-white rounded-2xl p-4 shadow-lg flex items-center justify-between gap-3 mb-[env(safe-area-inset-bottom)]">
          <span className="font-semibold text-sm tabular-nums">
            {totalCartQty} Cases • {inr(grandTotal)}
          </span>
          <button
            type="button"
            onClick={onProceedToReview}
            className="min-h-[44px] px-4 rounded-xl bg-[#1B8A5A] hover:bg-[#157048] text-white text-sm font-semibold whitespace-nowrap cursor-pointer"
          >
            Review Order →
          </button>
        </div>
      )}
    </div>
  );
};
