import React from 'react';
import {
  Search,
  Mic,
  MicOff,
  Zap,
  AlertCircle,
  Plus,
  Minus,
  X,
  ChevronRight,
  Calendar,
  Package,
  Truck,
  UserPlus,
} from 'lucide-react';
import { BillItem, ExistingCustomer, Product, Trip } from '../../../types';
import { money } from '../../../utils/billing';
import { normCustName } from '../../../context/ledgerHelpers';
import { rawLast10Phone as last10 } from '../../../utils/customerDedupe';
import { AddCustomerModal } from '../../common/AddCustomerModal';
import { useLanguage } from '../../../i18n/LanguageContext';
import { shortCategoryLabel } from '../../../utils/categoryLabel';
import { getCustomerOdiaName } from '../../../utils/displayName';
import { nameFromMap } from '../../../hooks/useAutoOdiaName';
import { BeatFilterBar } from '../../common/BeatFilterBar';
import { sizeTheme, packTheme } from '../../../utils/sizeColor';
import { SalesmanProductMedia, SalesmanSaleSmartHint } from './salesmanSaleShared';

interface SalesmanSalePhoneFlowProps {
  cart: { items: BillItem[]; date?: string };
  activeTrip: Trip | null;
  customers: ExistingCustomer[];
  ledgerCustomers: any[];
  selectedRetailer: string;
  setSelectedRetailer: (name: string) => void;
  retailerPhone: string;
  setRetailerPhone: (phone: string) => void;
  setRetailerCustomerId?: (id: string) => void;
  isLowVision: boolean;
  finalCartTotal: number;
  cartItemCount: number;
  getVehicleStock: (trip: Trip | null, productId: number) => { loaded: number; sold: number; available: number };
  getProductCartQty: (productId: number) => number;
  onQuickProductCartChange: (productId: number, delta: number) => boolean | void;
  onOpenCart: () => void;
  onCancelSaleSequence: () => void;
  onVoiceSearchCustomer: () => void;
  isVoiceSearching: boolean;
  speakAssistiveText: (text: string) => void;
  onSetSalesmanTab: (tab: 'home' | 'sell' | 'vanStock' | 'bills' | 'customerDue' | 'trips') => void;
  saleDate: string;
  setSaleDate?: (d: string) => void;
  availableTrips: Trip[];
  onSelectTripId?: (id: number) => void;
  onOpenNewVanModal?: () => void;
  productNameMap: Map<string, string>;
  customerNameMap: Map<string, string>;
  activePromoFor?: (productId: number) => any;
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  selectedCategory: string;
  setSelectedCategory: (c: string) => void;
  productAlphaFilter: string;
  setProductAlphaFilter: (a: string) => void;
  categories: string[];
  filteredProducts: Product[];
  beatFilter: {
    value: string;
    setValue: (v: string) => void;
    options: any[];
    active: boolean;
  };
  customerSearchQuery: string;
  setCustomerSearchQuery: (q: string) => void;
  showCustomerDropdown: boolean;
  setShowCustomerDropdown: (b: boolean) => void;
  filteredCustomerSuggestions: ExistingCustomer[];
  showCancelConfirm: boolean;
  setShowCancelConfirm: (b: boolean) => void;
  showAddCustomerModal: boolean;
  setShowAddCustomerModal: (b: boolean) => void;
  isProductVoiceActive: boolean;
  handleStartProductVoiceSearch: () => void;
  voiceActionResult: { text: string; type: 'success' | 'warn' } | null;
  setVoiceActionResult: (v: { text: string; type: 'success' | 'warn' } | null) => void;
  salesmanSmartHints: SalesmanSaleSmartHint[];
}

export const SalesmanSalePhoneFlow: React.FC<SalesmanSalePhoneFlowProps> = ({
  cart,
  activeTrip,
  customers,
  ledgerCustomers,
  selectedRetailer,
  setSelectedRetailer,
  retailerPhone,
  setRetailerPhone,
  setRetailerCustomerId,
  isLowVision,
  finalCartTotal,
  cartItemCount,
  getVehicleStock,
  getProductCartQty,
  onQuickProductCartChange,
  onOpenCart,
  onCancelSaleSequence,
  onVoiceSearchCustomer,
  isVoiceSearching,
  speakAssistiveText,
  onSetSalesmanTab,
  saleDate,
  setSaleDate,
  availableTrips,
  onSelectTripId,
  onOpenNewVanModal,
  productNameMap,
  customerNameMap,
  activePromoFor,
  searchTerm,
  setSearchTerm,
  selectedCategory,
  setSelectedCategory,
  productAlphaFilter,
  setProductAlphaFilter,
  categories,
  filteredProducts,
  beatFilter,
  customerSearchQuery,
  setCustomerSearchQuery,
  showCustomerDropdown,
  setShowCustomerDropdown,
  filteredCustomerSuggestions,
  showCancelConfirm,
  setShowCancelConfirm,
  showAddCustomerModal,
  setShowAddCustomerModal,
  isProductVoiceActive,
  handleStartProductVoiceSearch,
  voiceActionResult,
  setVoiceActionResult,
  salesmanSmartHints,
}) => {
  const { t, isOdia, language } = useLanguage();

  const selectedCustomerDue = (() => {
    if (!selectedRetailer) return 0;
    const sameName = (customers || []).filter((c) => c.name === selectedRetailer);
    const sel =
      sameName.find((c) => retailerPhone && last10(c.phone) === last10(retailerPhone)) ||
      (sameName.length === 1 ? sameName[0] : undefined);
    return sel ? Math.max(0, Number(sel.balanceDue) || 0) : 0;
  })();

  const tripLoadedCases = activeTrip
    ? Object.values(activeTrip.loaded || {}).reduce((a, b) => a + (Number(b) || 0), 0)
    : 0;
  const tripRemainingCases = activeTrip
    ? Array.from(
        new Set([
          ...Object.keys(activeTrip.loaded || {}).map(Number),
          ...cart.items.map((it) => it.productId),
        ]),
      ).reduce((sum, pid) => sum + Math.max(0, getVehicleStock(activeTrip, pid).available), 0)
    : 0;
  const showTripSelect = Boolean(
    onSelectTripId &&
      availableTrips &&
      (availableTrips.length > 1 || (!activeTrip && availableTrips.length > 0)),
  );

  return (
    <div id="salesman-sale-flow" className="space-y-2.5 pb-28">
      {/* Header (--primary): customer name + due tag + search products pill */}
      <header className="rt-sale-header rounded-[var(--r-card)]">
        <div className="rt-sale-header__row">
          <h2 className="rt-sale-header__title">
            {selectedRetailer || t('salesman.newSale')}
          </h2>
          <div className="rt-sale-header__right">
            {selectedRetailer && (
              <span className={`rt-tag ${selectedCustomerDue > 0.004 ? 'rt-tag--soon' : 'rt-tag--paid'}`}>
                {selectedCustomerDue > 0.004 ? `Due ₹${money(selectedCustomerDue)}` : t('sell.paid')}
              </span>
            )}
          </div>
        </div>

        <div className="rt-sale-search">
          <Search size={16} className="rt-sale-search__icon" />
          <input
            enterKeyHint="search"
            type="text"
            id="input-beverage-search"
            placeholder={t('sell.searchProducts')}
            aria-label={t('sell.searchProducts')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="rt-sale-search__input"
          />
          {searchTerm && (
            <button
              aria-label="Clear search"
              type="button"
              onClick={() => setSearchTerm('')}
              className="rt-sale-search__btn"
            >
              <X size={16} />
            </button>
          )}
          {!isOdia && (
            <button
              type="button"
              id="btn-voice-product-search"
              onClick={handleStartProductVoiceSearch}
              aria-label={t('salesman.speakItem')}
              className={`rt-sale-search__btn ${isProductVoiceActive ? 'rt-sale-search__btn--active' : ''}`}
            >
              {isProductVoiceActive ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
          )}
        </div>
      </header>

      {/* Voice feedback & smart assist notices with coloured left edge */}
      {voiceActionResult && (
        <div
          role="alert"
          className={`rt-notice ${voiceActionResult.type === 'success' ? 'rt-notice--paid' : 'rt-notice--soon'} flex items-center justify-between gap-2`}
        >
          <span>{voiceActionResult.text}</span>
          <button
            aria-label="Dismiss message"
            type="button"
            onClick={() => setVoiceActionResult(null)}
            className="min-h-[36px] min-w-[36px] flex items-center justify-center text-[var(--text-2)] cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {salesmanSmartHints.length > 0 && (
        <div id="salesman-smart-assist" role="status" aria-live="polite" className="space-y-1.5">
          {salesmanSmartHints.map((h) => (
            <div
              key={h.id}
              className={`rt-notice ${
                h.tone === 'rose'
                  ? 'rt-notice--due'
                  : h.tone === 'amber'
                    ? 'rt-notice--soon'
                    : h.tone === 'emerald'
                      ? 'rt-notice--paid'
                      : 'rt-notice--info'
              }`}
            >
              {h.text}
            </div>
          ))}
        </div>
      )}

      {/* Vehicle & customer compact white card */}
      <div id="section-stock-source-salesman" className="rt-card space-y-2.5">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2.5">
            <div className="min-w-0 flex-1 flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center shrink-0">
                <Truck size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-[var(--text)] leading-snug break-words">
                  {activeTrip ? `${activeTrip.vehicle} (#${activeTrip.id})` : t('salesman.vehicleNotDispatched')}
                </div>
                {activeTrip && (
                  <div className="text-xs text-[var(--text-2)] mt-0.5 tabular-nums">
                    {activeTrip.route || t('salesman.cityBeat')} · {tripRemainingCases}/{tripLoadedCases} cs {t('salesman.inVan')}
                  </div>
                )}
              </div>
            </div>
            {onOpenNewVanModal && (
              <button
                type="button"
                onClick={onOpenNewVanModal}
                className="rt-btn-outline min-h-[38px]! px-3! text-xs! shrink-0 whitespace-nowrap"
              >
                <Plus size={14} />
                <span>{activeTrip ? t('salesman.loadVan') : t('salesman.startLoadVanRun')}</span>
              </button>
            )}
          </div>
          {showTripSelect && (
            <select
              value={activeTrip?.id || ''}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (val && onSelectTripId) onSelectTripId(val);
              }}
              aria-label={t('salesman.selectVehicle')}
              className="w-full min-h-[40px] px-3 text-xs font-semibold rounded-[var(--r-control)] border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
            >
              {!activeTrip && <option value="">{t('salesman.selectDispatchedVan')}</option>}
              {availableTrips.map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {tr.vehicle} (#{tr.id}){tr.route ? ` · ${tr.route}` : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        <div id="section-customer-details" className="pt-2.5 border-t border-[var(--border)] space-y-2.5">
          {selectedRetailer ? (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[var(--text-2)]">{t('salesman.billedTo')}</div>
                <div className="text-sm font-bold text-[var(--text)] break-words">
                  {selectedRetailer}
                  {isOdia && (
                    <span className="block text-xs font-semibold text-[var(--primary)] font-odia mt-0.5">
                      {getCustomerOdiaName(selectedRetailer, customers || ledgerCustomers || [])}
                    </span>
                  )}
                </div>
                {retailerPhone && (
                  <div className="text-xs text-[var(--text-2)]">{retailerPhone}</div>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  id="btn-change-customer"
                  onClick={() => {
                    setSelectedRetailer('');
                    setRetailerPhone('');
                    setRetailerCustomerId?.('');
                    speakAssistiveText('Customer deselected.');
                  }}
                  className="rt-btn-outline min-h-[38px]! px-3! text-xs!"
                >
                  {t('sell.change')}
                </button>
                {(selectedRetailer || cart.items.length > 0) && (
                  <button
                    type="button"
                    id="btn-cancel-sale-sequence"
                    onClick={() => {
                      if (cart.items.length > 0) {
                        setShowCancelConfirm(true);
                      } else {
                        onCancelSaleSequence();
                      }
                    }}
                    aria-label={t('salesman.cancelSale')}
                    className="min-h-[38px] px-2.5 rounded-full border border-[var(--due)]/35 bg-[var(--due-bg)] text-[var(--due)] text-xs font-bold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    <X size={14} strokeWidth={2.5} aria-hidden="true" />
                    <span>{t('common.cancel')}</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {cart.items.length > 0 && (
                <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-[var(--border)]">
                  <span className="text-xs font-bold text-[var(--text)]">
                    {t('sell.itemsCount', { n: cartItemCount })} · ₹{money(finalCartTotal)}
                  </span>
                  <button
                    type="button"
                    id="btn-cancel-sale-sequence"
                    onClick={() => setShowCancelConfirm(true)}
                    className="min-h-[36px] px-3 rounded-full border border-[var(--due)]/35 bg-[var(--due-bg)] text-[var(--due)] text-xs font-bold inline-flex items-center gap-1 cursor-pointer shrink-0 whitespace-nowrap"
                  >
                    <X size={13} strokeWidth={2.5} aria-hidden="true" />
                    <span>{t('salesman.cancelSale')}</span>
                  </button>
                </div>
              )}
              <BeatFilterBar value={beatFilter.value} onChange={beatFilter.setValue} options={beatFilter.options} />
              <div className="relative">
                <div className="relative flex items-center">
                  <Search size={16} className="absolute left-3 text-[var(--text-2)] pointer-events-none" />
                  <input
                    enterKeyHint="search"
                    type="text"
                    id="input-customer-search-direct"
                    placeholder={t('salesman.searchCustomer')}
                    value={customerSearchQuery}
                    onChange={(e) => {
                      setCustomerSearchQuery(e.target.value);
                      setShowCustomerDropdown(true);
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    className="w-full pl-9 pr-14 min-h-[44px] rounded-[var(--r-pill)] border border-[var(--border)] bg-[var(--bg)] text-sm font-medium text-[var(--text)] focus:outline-none focus:bg-[var(--surface)] focus:border-[var(--primary)]"
                  />
                  {customerSearchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerSearchQuery('');
                        setShowCustomerDropdown(false);
                      }}
                      className="absolute right-3 min-h-[36px] px-2 text-xs font-bold text-[var(--text-2)] cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {showCustomerDropdown && filteredCustomerSuggestions.length > 0 && (
                  <div className="rt-card absolute top-full left-0 right-0 z-30 mt-1.5 p-0! overflow-hidden divide-y divide-[var(--border)] max-h-64 overflow-y-auto">
                    {filteredCustomerSuggestions.map((cust) => (
                      <button
                        key={`${cust.id || ''}|${cust.phone || ''}|${cust.name}`}
                        type="button"
                        onClick={() => {
                          setSelectedRetailer(cust.name);
                          setRetailerPhone(cust.phone || '');
                          setRetailerCustomerId?.(cust.id || '');
                          setShowCustomerDropdown(false);
                          setCustomerSearchQuery('');
                          speakAssistiveText(`Selected ${cust.name}`);
                        }}
                        className="w-full min-h-[48px] p-3 text-left flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold text-[var(--text)] break-words">
                            {cust.name}
                            {isOdia && (cust.nameOr || nameFromMap(customerNameMap, cust, language)) && (
                              <span className="block text-xs font-semibold text-[var(--primary)] font-odia mt-0.5">
                                {cust.nameOr || nameFromMap(customerNameMap, cust, language)}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-[var(--text-2)] flex items-center gap-2 flex-wrap mt-0.5">
                            {cust.phone && <span>Ph: {cust.phone}</span>}
                            {cust.balanceDue > 0 && (
                              <span className="text-[var(--due)] font-bold">Due: ₹{money(cust.balanceDue)}</span>
                            )}
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-[var(--text-2)] shrink-0" />
                      </button>
                    ))}
                    {customerSearchQuery.trim() && (
                      <button
                        type="button"
                        onClick={() => setShowAddCustomerModal(true)}
                        className="w-full p-3 text-xs font-bold text-[var(--primary)] flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <UserPlus size={15} />
                        <span>Register "{customerSearchQuery.trim()}"</span>
                      </button>
                    )}
                  </div>
                )}

                {showCustomerDropdown && customerSearchQuery.trim() && filteredCustomerSuggestions.length === 0 && (
                  <div className="rt-card absolute top-full left-0 right-0 z-30 mt-1.5 text-center space-y-2.5">
                    <p className="text-xs font-semibold text-[var(--text-2)]">
                      No registered shop found matching "{customerSearchQuery}".
                    </p>
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          setShowCustomerDropdown(false);
                          setShowAddCustomerModal(true);
                        }}
                        className="rt-btn text-xs!"
                      >
                        <UserPlus size={14} />
                        <span>Register Customer</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const typed = customerSearchQuery.trim();
                          const key = normCustName(typed);
                          const same = key ? (customers || []).filter((c) => normCustName(c.name) === key) : [];
                          if (same.length === 1) {
                            setSelectedRetailer(same[0].name);
                            setRetailerPhone(same[0].phone || '');
                            setRetailerCustomerId?.(same[0].id || '');
                            speakAssistiveText(`Selected ${same[0].name}`);
                          } else {
                            setSelectedRetailer(typed);
                            setRetailerPhone('');
                            setRetailerCustomerId?.('');
                            speakAssistiveText(`Selected ${typed}`);
                          }
                          setShowCustomerDropdown(false);
                          setCustomerSearchQuery('');
                        }}
                        className="rt-btn-outline text-xs!"
                      >
                        Use once
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  id="btn-salesman-add-new-customer"
                  onClick={() => setShowAddCustomerModal(true)}
                  className="rt-btn flex-1 min-w-0 text-xs!"
                >
                  <UserPlus size={15} />
                  <span>{t('salesman.addCustomer')}</span>
                </button>
                {!isOdia && (
                  <button
                    type="button"
                    id="btn-voice-search-customer"
                    onClick={onVoiceSearchCustomer}
                    className="rt-btn-outline text-xs!"
                  >
                    {isVoiceSearching ? <MicOff size={15} /> : <Mic size={15} />}
                    <span>{isVoiceSearching ? t('salesman.listening') : t('salesman.speakName')}</span>
                  </button>
                )}
                <button
                  type="button"
                  id="btn-spot-cash-sale"
                  onClick={() => {
                    setSelectedRetailer(t('salesman.spotCashCustomer'));
                    setRetailerPhone('');
                    setRetailerCustomerId?.('');
                    speakAssistiveText('Spot cash customer selected.');
                  }}
                  className="rt-btn-outline flex-1 min-w-0 text-xs!"
                >
                  <Zap size={15} />
                  <span>{t('salesman.spotCashSale')}</span>
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 text-xs">
            <label htmlFor="salesman-sale-date-input" className="font-semibold text-[var(--text-2)] flex items-center gap-1">
              <Calendar size={13} />
              <span>{t('salesman.saleDate')}</span>
            </label>
            <input
              id="salesman-sale-date-input"
              type="date"
              value={saleDate}
              onChange={(e) => {
                if (setSaleDate) setSaleDate(e.target.value);
              }}
              className="px-2.5 py-1 rounded-[var(--r-control)] border border-[var(--border)] font-semibold text-[var(--text)] bg-[var(--surface)]"
            />
          </div>
        </div>
      </div>

      {/* Category chips (horizontal swipe, no scrollbar, dark selected fill) */}
      <div className="rt-chips px-0!" role="group" aria-label="Product categories">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            aria-pressed={selectedCategory === cat}
            onClick={() => setSelectedCategory(cat)}
            className="rt-chip"
          >
            {cat === 'ALL' ? t('sell.categoryAll') : shortCategoryLabel(cat)}
          </button>
        ))}
      </div>

      {/* 2-column product grid */}
      <div id="section-beverage-selection">
        {filteredProducts.length === 0 ? (
          <div className="rt-card text-center space-y-2.5 py-6">
            <Package size={32} className="mx-auto text-[var(--text-2)]" />
            <div className="text-sm font-bold text-[var(--text)]">
              {searchTerm || selectedCategory !== 'ALL' || productAlphaFilter !== 'ALL'
                ? 'No loaded beverages match the selected filter.'
                : t('salesman.noProductsLoaded')}
            </div>
            {searchTerm || selectedCategory !== 'ALL' || productAlphaFilter !== 'ALL' ? (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('ALL');
                  setProductAlphaFilter('ALL');
                }}
                className="rt-btn-outline"
              >
                Reset Filters
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onSetSalesmanTab('trips')}
                className="rt-btn"
              >
                <Truck size={15} />
                <span>{t('salesman.goToTripsLoadVan')}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="rt-prod-grid">
            {filteredProducts.map((prod) => {
              const { available } = getVehicleStock(activeTrip, prod.id);
              const inCartQty = getProductCartQty(prod.id);
              const isOutOfStock = available <= 0;
              const price = prod.retail || prod.wholesale;
              const sTheme = sizeTheme(prod.volume, prod.name);
              const pTheme = packTheme(prod.pack, prod.name);
              const activePromo = activePromoFor ? activePromoFor(prod.id) : null;
              const packParts = [
                sTheme.label,
                pTheme.label,
                prod.unitsPerCrate ? t('sell.packInfo', { pcs: prod.unitsPerCrate }) : '',
              ].filter(Boolean);
              const leftAfterCart = Math.max(0, available - inCartQty);
              const stockTone = isOutOfStock
                ? 'rt-prod-stock--oos'
                : leftAfterCart <= 3
                  ? 'rt-prod-stock--low'
                  : 'rt-prod-stock--ok';
              const stockText = isOutOfStock
                ? t('salesman.empty')
                : inCartQty > 0
                  ? `${available} ${t('salesman.inVan')} · ${t('sell.leftCount', { n: leftAfterCart })}`
                  : `${available} ${t('salesman.inVan')}`;

              return (
                <div
                  key={prod.id}
                  id={`beverage-card-${prod.id}`}
                  className={`rt-card rt-prod-card ${inCartQty > 0 ? 'rt-prod-card--in-cart' : ''} ${isOutOfStock ? 'rt-prod-card--oos' : ''}`}
                >
                  <div className="rt-prod-media">
                    {activePromo && (
                      <span className="rt-prod-scheme">{t('sell.scheme')}</span>
                    )}
                    <SalesmanProductMedia product={prod} />
                  </div>

                  <div className="rt-prod-info">
                    <h3 className="rt-prod-name">
                      {prod.name}
                      {isOdia && (prod.nameOr || nameFromMap(productNameMap, prod, language)) && (
                        <span className="block text-xs font-semibold font-odia text-[var(--text-2)] mt-0.5">
                          {prod.nameOr || nameFromMap(productNameMap, prod, language)}
                        </span>
                      )}
                    </h3>
                    {packParts.length > 0 && (
                      <p className="rt-prod-pack">{packParts.join(' · ')}</p>
                    )}
                    <p className="rt-prod-price">₹{money(price)}</p>
                    <div className={`rt-prod-stock ${stockTone}`} aria-label={`Van stock: ${stockText}`}>
                      <Truck size={11} className="shrink-0" aria-hidden="true" />
                      <span>{stockText}</span>
                    </div>
                  </div>

                  {isOutOfStock && inCartQty === 0 ? (
                    <button type="button" disabled className="rt-prod-oos">
                      {t('sell.outOfStock')}
                    </button>
                  ) : inCartQty === 0 ? (
                    <button
                      type="button"
                      id={`btn-add-beverage-${prod.id}`}
                      onClick={() => onQuickProductCartChange(prod.id, 1)}
                      className="rt-prod-add"
                    >
                      <Plus size={16} />
                      <span>{t('sell.add')}</span>
                    </button>
                  ) : (
                    <div className="rt-prod-stepper">
                      <button
                        type="button"
                        id={`btn-minus-beverage-${prod.id}`}
                        onClick={() => onQuickProductCartChange(prod.id, -1)}
                        aria-label={`Decrease ${prod.name}`}
                        className="rt-prod-stepper__btn"
                      >
                        <Minus size={16} />
                      </button>
                      <div className="rt-prod-stepper__qty" aria-label={`${inCartQty} in cart`}>
                        {inCartQty}
                      </div>
                      <button
                        type="button"
                        id={`btn-plus-beverage-${prod.id}`}
                        disabled={inCartQty >= available}
                        onClick={() => onQuickProductCartChange(prod.id, 1)}
                        aria-label={`Increase ${prod.name}`}
                        className="rt-prod-stepper__btn"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sticky cart bar 12px above bottom nav (hide when empty) */}
      {cart.items.length > 0 && (
        <div
          id="salesman-cart-bottom-bar"
          className="rt-cartbar"
          role="region"
          aria-label={t('salesman.runningCartTotal')}
        >
          <div className="rt-cartbar__info">
            <span className="rt-cartbar__count">
              {t('sell.itemsCount', { n: cartItemCount })}
            </span>
            <span className="rt-cartbar__total" aria-live="polite" aria-atomic="true">
              ₹{money(finalCartTotal)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowCancelConfirm(true)}
              aria-label={t('salesman.cancelSale')}
              className="min-h-[44px] px-3 rounded-full border border-white/25 bg-white/15 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer shrink-0 whitespace-nowrap"
            >
              <X size={14} strokeWidth={2.5} aria-hidden="true" />
              <span>{t('common.cancel')}</span>
            </button>
            <button
              type="button"
              id="btn-bottom-review-cart"
              onClick={onOpenCart}
              aria-label={`Review cart, ${cart.items.length} items, total rupees ${money(finalCartTotal)}`}
              className="rt-cartbar__cta"
            >
              <span>{t('sell.checkout')}</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {showCancelConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        >
          <div className="rt-card w-full max-w-sm space-y-4">
            <div className="flex items-center gap-2 text-[var(--due)] font-bold text-base">
              <AlertCircle size={20} />
              <span>{t('salesman.cancelCurrentSale')}</span>
            </div>
            <p className="text-sm text-[var(--text-2)]">
              You have <strong className="text-[var(--text)]">{cart.items.length} beverage item{cart.items.length !== 1 ? 's' : ''}</strong> in this cart.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setShowCancelConfirm(false)}
                className="rt-btn-outline"
              >
                Keep Cart
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCancelConfirm(false);
                  onCancelSaleSequence();
                }}
                className="rt-btn bg-[var(--due)]! border-[var(--due)]!"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}

      <AddCustomerModal
        isOpen={showAddCustomerModal}
        onClose={() => setShowAddCustomerModal(false)}
        initialName={customerSearchQuery.trim()}
        defaultRoute={activeTrip?.route || ''}
        isLowVision={isLowVision}
        onCustomerCreated={(newCust) => {
          setSelectedRetailer(newCust.name);
          setRetailerPhone(newCust.phone || '');
          setRetailerCustomerId?.(newCust.id);
          setShowCustomerDropdown(false);
          setCustomerSearchQuery('');
          speakAssistiveText(`Selected ${newCust.name}`);
        }}
      />
    </div>
  );
};
