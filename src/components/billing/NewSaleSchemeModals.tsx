import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Bill, Product, Promotion } from '../../types';
import { computeLine, schemeLabel } from '../../utils/billing';
import { InvoiceSuccessCard } from './InvoiceSuccessCard';
import { SchemeSelectorModal } from './SchemeSelectorModal';
import { SchemeCustomPriceModal } from '../modals/SchemeCustomPriceModal';
import { getProductDefaultPrice } from './newSaleHelpers';

interface CancelSaleConfirmModalProps {
  open: boolean;
  totalCartQty: number;
  t: (key: string, params?: Record<string, string | number>) => string;
  onKeepCart: () => void;
  onConfirmCancel: () => void;
}

export const CancelSaleConfirmModal: React.FC<CancelSaleConfirmModalProps> = ({
  open,
  totalCartQty,
  t,
  onKeepCart,
  onConfirmCancel,
}) => {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('salesman.cancelCurrentSale')}
      className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="rt-card w-full max-w-sm space-y-4 shadow-2xl">
        <div className="flex items-center gap-2 text-[var(--due)] font-bold text-base">
          <AlertCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
          <span>{t('salesman.cancelCurrentSale')}</span>
        </div>
        <p className="text-sm text-[var(--text-2)] leading-relaxed">
          You have{' '}
          <strong className="text-[var(--text)]">
            {totalCartQty} {totalCartQty === 1 ? 'case' : 'cases'}
          </strong>{' '}
          in this cart. Cancelling will clear the cart and start fresh.
        </p>
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={onKeepCart}
            className="rt-btn-outline min-h-[44px]"
          >
            Keep Cart
          </button>
          <button
            type="button"
            onClick={onConfirmCancel}
            className="rt-btn min-h-[44px] bg-[var(--due)]! border-[var(--due)]!"
          >
            {t('salesman.cancelSale')}
          </button>
        </div>
      </div>
    </div>
  );
};

interface PhoneBillSavedScreenProps {
  bill: Bill;
  t: (key: string, params?: Record<string, string | number>) => string;
  onOpenInvoiceModal: (bill: Bill, defaultFormat?: 'gst' | 'non_gst') => void;
  onCreateNextBill: () => void;
  onOpenHistory: () => void;
}

export const PhoneBillSavedScreen: React.FC<PhoneBillSavedScreenProps> = ({
  bill,
  t,
  onOpenInvoiceModal,
  onCreateNextBill,
  onOpenHistory,
}) => (
  <div className="hh-view w-full min-w-0 overflow-x-hidden">
    <div
      data-esc-close
      role="dialog"
      aria-modal="true"
      aria-label={t('sell.billSavedTitle')}
      className="rt-sale-sheet"
    >
      <header className="rt-sale-header">
        <div className="rt-sale-header__row">
          <h2 className="rt-sale-header__title">{t('sell.billSavedTitle')}</h2>
        </div>
      </header>
      <div className="rt-sale-body !pt-3">
        <InvoiceSuccessCard
          bill={bill}
          onOpenInvoiceModal={onOpenInvoiceModal}
          onCreateNextBill={onCreateNextBill}
          onOpenHistory={onOpenHistory}
        />
      </div>
    </div>
  </div>
);

interface NewSaleSchemeModalsProps {
  quickEntryProduct: Product | null;
  quickEntryQty: string;
  setQuickEntryQty: (qty: string) => void;
  quickEntryRate: string;
  setQuickEntryRate: (rate: string) => void;
  quickEntryQtyRef: React.RefObject<HTMLInputElement | null>;
  setQuickEntryProduct: (p: Product | null) => void;
  schemeModalProduct: Product | null;
  setSchemeModalProduct: (p: Product | null) => void;
  products: Product[];
  promotions: Promotion[];
  selectedItems: Record<number, number>;
  customRates: Record<number, number>;
  customSchemes: Record<number, Promotion | null>;
  setCustomSchemes: React.Dispatch<React.SetStateAction<Record<number, Promotion | null>>>;
  schemeMode: 'auto' | 'none' | 'manual';
  schemesEnabled?: boolean;
  autoApplyPromotions?: boolean;
  activePromoFor?: (productId: number) => Promotion | null;
  stockSource: string;
  getProductStock: (productId: number) => number;
  handleSetProductRate: (productId: number, rate: number) => void;
  setItemQty: (productId: number, qty: number) => void;
}

export const NewSaleSchemeModals: React.FC<NewSaleSchemeModalsProps> = ({
  quickEntryProduct,
  quickEntryQty,
  setQuickEntryQty,
  quickEntryRate,
  setQuickEntryRate,
  quickEntryQtyRef,
  setQuickEntryProduct,
  schemeModalProduct,
  setSchemeModalProduct,
  products,
  promotions,
  selectedItems,
  customRates,
  customSchemes,
  setCustomSchemes,
  schemeMode,
  schemesEnabled,
  autoApplyPromotions,
  activePromoFor,
  stockSource,
  getProductStock,
  handleSetProductRate,
  setItemQty,
}) => (
  <>
    {/* QUICK ENTRY POPUP: Quantity, Rate & Scheme (UI lives in SchemeCustomPriceModal) */}
    {quickEntryProduct &&
      (() => {
        const prod = quickEntryProduct;
        const available = getProductStock(prod.id);
        const defaultRate = getProductDefaultPrice(prod);
        const parsedQty = Math.max(0, parseInt(quickEntryQty, 10) || 0);
        const parsedRate = quickEntryRate.trim() === '' ? 0 : Math.max(0, parseFloat(quickEntryRate) || 0);

        const userChoice = customSchemes[prod.id];
        let activePromo: Promotion | null = null;
        if (userChoice !== undefined) {
          activePromo = userChoice;
        } else if (schemeMode !== 'none' && schemesEnabled !== false && autoApplyPromotions !== false) {
          activePromo = activePromoFor ? activePromoFor(prod.id) : null;
        }
        const promoLabel = activePromo ? schemeLabel(activePromo, products) : null;
        const previewComp = parsedQty > 0 ? computeLine(prod, 'Retail', parsedQty, activePromo, parsedRate, 0) : null;

        const commitPopup = () => {
          if (parsedRate !== (customRates[prod.id] !== undefined ? customRates[prod.id] : defaultRate)) {
            handleSetProductRate(prod.id, parsedRate);
          }
          setItemQty(prod.id, parsedQty);
          setQuickEntryProduct(null);
        };

        return (
          <SchemeCustomPriceModal
            product={prod}
            basePrice={defaultRate}
            available={available}
            isVanStock={stockSource.startsWith('trip_')}
            qty={quickEntryQty}
            parsedQty={parsedQty}
            onQtyChange={setQuickEntryQty}
            qtyInputRef={quickEntryQtyRef}
            rate={quickEntryRate}
            parsedRate={parsedRate}
            onRateChange={setQuickEntryRate}
            schemeActive={!!activePromo}
            promoLabel={promoLabel}
            freeQty={previewComp ? previewComp.freeQty : 0}
            onToggleScheme={(next) => {
              if (!next) {
                setCustomSchemes((prev) => ({ ...prev, [prod.id]: null }));
                return;
              }
              const candidate = activePromoFor ? activePromoFor(prod.id) : null;
              if (candidate) setCustomSchemes((prev) => ({ ...prev, [prod.id]: candidate }));
              else setSchemeModalProduct(prod);
            }}
            onChangeScheme={() => setSchemeModalProduct(prod)}
            lineTotal={Math.round(((previewComp ? previewComp.gross : parsedQty * parsedRate) + Number.EPSILON) * 100) / 100}
            isEditing={(selectedItems[prod.id] || 0) > 0}
            onSubmit={commitPopup}
            onRemove={() => {
              setItemQty(prod.id, 0);
              setQuickEntryProduct(null);
            }}
            onClose={() => setQuickEntryProduct(null)}
          />
        );
      })()}

    {/* SCHEME SELECTOR MODAL (Full Promotions & BOGO Support) */}
    {schemeModalProduct && (
      <SchemeSelectorModal
        product={schemeModalProduct}
        currentRate={
          customRates[schemeModalProduct.id] !== undefined
            ? customRates[schemeModalProduct.id]
            : getProductDefaultPrice(schemeModalProduct)
        }
        currentScheme={
          customSchemes[schemeModalProduct.id] !== undefined
            ? customSchemes[schemeModalProduct.id]
            : schemeMode === 'none' || schemesEnabled === false || autoApplyPromotions === false
              ? null
              : activePromoFor
                ? activePromoFor(schemeModalProduct.id)
                : null
        }
        currentPromoLabel={
          customSchemes[schemeModalProduct.id] ? schemeLabel(customSchemes[schemeModalProduct.id]!, products) : null
        }
        availablePromotions={promotions}
        products={products}
        onSelectScheme={(promo) => {
          setCustomSchemes((prev) => ({ ...prev, [schemeModalProduct.id]: promo }));
          setSchemeModalProduct(null);
        }}
        onClose={() => setSchemeModalProduct(null)}
      />
    )}
  </>
);
