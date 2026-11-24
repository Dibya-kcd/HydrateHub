import React from 'react';
import {
  ArrowLeft,
  Banknote,
  Calendar,
  ChevronDown,
  CreditCard,
  Gift,
  Minus,
  Pencil,
  Phone,
  Plus,
  QrCode,
  Trash2,
  Truck,
  Wallet,
  X,
} from 'lucide-react';
import { BillItem, PaymentMode, Product } from '../../types';
import { PackIcon } from '../common/PackIcon';
import { money } from '../../utils/billing';
import { ProductCardMedia } from './newSaleHelpers';
import { SaleSource } from './OrderContextBar';

export interface NewSaleReviewModalProps {
  isPhone: boolean;
  isCompact: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
  inr: (n: number) => string;
  selectedCustomerId: string;
  customerName: string;
  customerPhone: string;
  setCustomerPhone: (v: string) => void;
  customerGstin: string;
  customerPhoneError: string | null;
  phoneReviewStage: 'cart' | 'checkout';
  setPhoneReviewStage: (s: 'cart' | 'checkout') => void;
  goBackToStep1: () => void;
  backToCatalog: () => void;
  requestCancelSale: () => void;
  lineItems: BillItem[];
  products: Product[];
  totalCartQty: number;
  totalFreeQty: number;
  totalDiscount: number;
  totalSavings: number;
  subtotalBeforeSavings: number;
  totalTax: number;
  grandTotal: number;
  creditInfo: { limit: number; due: number; available: number | null };
  creditExceeded: boolean;
  collectedAmountPreview: number;
  balanceDuePreview: number;
  payChoice: 'credit' | 'cash' | 'upi' | 'partial';
  setPayChoice: (c: 'credit' | 'cash' | 'upi' | 'partial') => void;
  selectPayChoice: (c: 'credit' | 'cash' | 'upi' | 'partial') => void;
  paymentMode: PaymentMode;
  setPaymentMode: (m: PaymentMode) => void;
  paymentAmount: string;
  setPaymentAmount: (v: string) => void;
  billType: 'tax_invoice' | 'bill_of_supply' | 'estimate';
  setBillType: (b: 'tax_invoice' | 'bill_of_supply' | 'estimate') => void;
  compositionLocked: boolean;
  cartTaxStatus: { allNonGst: boolean; hasMixedTax: boolean };
  splitPreview: {
    gstLines: BillItem[];
    nonGstLines: BillItem[];
    gstTotal: number;
    gstTax: number;
    nonGstTotal: number;
    gstPaid: number;
    nonGstPaid: number;
  };
  saleSource: SaleSource;
  selectedTripId: number | undefined;
  formattedSaleDate: string;
  setItemQty: (productId: number, qty: number) => void;
  openQuickEntry: (prod: Product) => void;
  handleSaveBill: () => void;
}

export const NewSaleReviewModal: React.FC<NewSaleReviewModalProps> = ({
  isPhone,
  isCompact,
  t,
  inr,
  selectedCustomerId,
  customerName,
  customerPhone,
  setCustomerPhone,
  customerGstin,
  customerPhoneError,
  phoneReviewStage,
  setPhoneReviewStage,
  goBackToStep1,
  backToCatalog,
  requestCancelSale,
  lineItems,
  products,
  totalCartQty,
  totalFreeQty,
  totalDiscount,
  totalSavings,
  subtotalBeforeSavings,
  totalTax,
  grandTotal,
  creditInfo,
  creditExceeded,
  collectedAmountPreview,
  balanceDuePreview,
  payChoice,
  setPayChoice,
  selectPayChoice,
  paymentMode,
  setPaymentMode,
  paymentAmount,
  setPaymentAmount,
  billType,
  setBillType,
  compositionLocked,
  cartTaxStatus,
  splitPreview,
  saleSource,
  selectedTripId,
  formattedSaleDate,
  setItemQty,
  openQuickEntry,
  handleSaveBill,
}) => {
  if (isPhone) {
    const isWalkIn = selectedCustomerId === '__walkin__';
    const activePhonePay: 'cash' | 'upi' | 'credit' =
      payChoice === 'credit' || (payChoice === 'partial' && (Number(paymentAmount) || 0) <= 0)
        ? 'credit'
        : paymentMode === 'upi'
          ? 'upi'
          : 'cash';

    if (phoneReviewStage === 'cart') {
      return (
        <div
          data-esc-close
          role="dialog"
          aria-modal="true"
          aria-label={t('sell.cart')}
          className="rt-sale-sheet"
        >
          <header className="rt-sale-header">
            <div className="rt-sale-header__row">
              <button
                type="button"
                aria-label="Back to catalog"
                onClick={backToCatalog}
                className="rt-sale-header__back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className="rt-sale-header__title">{t('sell.cart')}</h2>
              <div className="rt-sale-header__right">
                <span className="rt-tag rt-tag--ghost">
                  {totalCartQty === 1 ? t('sell.caseSingle') : t('sell.casesCount', { n: totalCartQty })}
                </span>
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
              <span className="rt-seg__bar rt-seg__bar--on" />
              <span className="rt-seg__bar" />
            </div>
            <p className="rt-stp">{t('sell.step3QuantitiesOffers')}</p>
          </header>

          <div className="rt-sale-body !pt-3">
            {lineItems.length === 0 ? (
              <div className="rt-card py-6 text-center space-y-2.5">
                <p className="text-sm font-semibold text-[var(--text-2)]">{t('sell.emptyBill')}</p>
                <button
                  type="button"
                  onClick={backToCatalog}
                  className="rt-btn-outline rt-btn-outline--primary"
                >
                  {t('sell.add')}
                </button>
              </div>
            ) : (
              <section className="rt-card !py-1 !px-3.5">
                {lineItems.map((item, idx) => {
                  const prod = products.find((p) => p.id === item.productId);
                  return (
                    <div key={item.key || `cart_item_${item.productId}_${idx}`} className="rt-cartrow">
                      <div className="rt-cartrow__thumb">
                        {prod ? (
                          <ProductCardMedia product={prod} />
                        ) : (
                          <PackIcon pack={prod?.pack} name={item.productName} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] font-bold text-[var(--text)] leading-snug break-words m-0">
                          {item.productName}
                        </p>
                        <p className="text-xs font-semibold text-[var(--text-2)] tabular-nums mt-0.5 m-0">
                          {item.rate === 0 ? 'Free' : `₹${Number(item.rate).toLocaleString('en-IN')} × ${item.qty}`}
                          {item.freeQty > 0 && (
                            <span className="text-[var(--paid)] font-bold"> · +{item.freeQty} free</span>
                          )}
                        </p>
                      </div>
                      {!item.isBundleFreeItem ? (
                        <div className="rt-st2">
                          <button
                            type="button"
                            aria-label={`Decrease ${item.productName}`}
                            onClick={() => setItemQty(item.productId, item.qty - 1)}
                            className="rt-st2__btn"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => prod && openQuickEntry(prod)}
                            title="Tap to edit qty, rate or scheme"
                            className="rt-st2__qty"
                          >
                            {item.qty}
                          </button>
                          <button
                            type="button"
                            aria-label={`Increase ${item.productName}`}
                            onClick={() => setItemQty(item.productId, item.qty + 1)}
                            className="rt-st2__btn"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="rt-tag rt-tag--paid shrink-0">+{item.qty} free</span>
                      )}
                    </div>
                  );
                })}
              </section>
            )}

            {(totalDiscount > 0 || totalFreeQty > 0) && (
              <div className="rt-noti !justify-between !items-center" role="status">
                <span className="flex items-center gap-1.5 min-w-0">
                  <Gift className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span className="font-bold text-[var(--text)] break-words">
                    {t('sell.offerApplied')}
                    {totalFreeQty > 0 ? ` · +${t('sell.freeCases', { n: totalFreeQty })}` : ''}
                    {totalDiscount > 0 ? ` · −${inr(totalDiscount)}` : ''}
                  </span>
                </span>
                <span className="rt-tag rt-tag--paid shrink-0">{t('sell.applied')}</span>
              </div>
            )}
          </div>

          {totalCartQty > 0 && (
            <div className="rt-cartbar" role="region" aria-label={t('sell.total')}>
              <div className="rt-cartbar__info">
                <span className="rt-cartbar__count">{t('sell.total')}</span>
                <span className="rt-cartbar__total">{inr(grandTotal)}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (isWalkIn && payChoice === 'credit') {
                    selectPayChoice('cash');
                  }
                  setPhoneReviewStage('checkout');
                }}
                className="rt-cartbar__cta"
              >
                <span>{t('sell.reviewOrder')}</span>
              </button>
            </div>
          )}
        </div>
      );
    }

    const combinedTotal = isWalkIn
      ? grandTotal
      : Math.round((grandTotal + creditInfo.due) * 100) / 100;
    const balanceAfterBill = Math.max(
      0,
      Math.round((combinedTotal - collectedAmountPreview) * 100) / 100,
    );

    return (
      <div
        data-esc-close
        role="dialog"
        aria-modal="true"
        aria-label={t('sell.reviewOrder')}
        className="rt-sale-checkout-sheet"
      >
        <header className="rt-sale-header">
          <div className="rt-sale-header__row">
            <button
              type="button"
              aria-label="Back to cart"
              onClick={() => setPhoneReviewStage('cart')}
              className="rt-sale-header__back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="rt-sale-header__title">{t('sell.reviewOrder')}</h2>
            <div className="rt-sale-header__right">
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
            <span className="rt-seg__bar rt-seg__bar--on" />
            <span className="rt-seg__bar rt-seg__bar--on" />
          </div>
          <p className="rt-stp">{t('sell.step4Checkout')}</p>
        </header>

        <div className="rt-checkout-body">
          {customerPhoneError && (
            <div role="alert" className="rt-notice rt-notice--due">
              {customerPhoneError}
            </div>
          )}
          {creditExceeded && (payChoice === 'credit' || payChoice === 'partial') && (
            <div role="alert" className="rt-notice rt-notice--due">
              This order ({inr(grandTotal)}) is more than the available credit ({inr(creditInfo.available ?? 0)}). Collect part of it now or pick another method.
            </div>
          )}
          {creditInfo.available !== null && balanceDuePreview > creditInfo.available && (
            <div role="alert" className="rt-notice rt-notice--due">
              Remaining {inr(balanceDuePreview)} is above available credit {inr(creditInfo.available)}.
            </div>
          )}
          {cartTaxStatus.hasMixedTax && (
            <div role="status" className="rt-notice rt-notice--soon">
              Mixed cart: auto-splits into 1 GST Invoice + 1 Non-GST Cash Memo (NG-...).
            </div>
          )}

          {/* Card 1: Bill to & Totals */}
          <section className="rt-card space-y-1">
            <div className="flex items-start justify-between gap-2 pb-1">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[var(--text-2)]">{t('sell.billTo')}</div>
                <div className="text-[14px] font-extrabold text-[var(--text)] break-words">
                  {isWalkIn ? t('sell.walkInSale') : (customerName || t('sell.walkInSale'))}
                </div>
              </div>
              {isWalkIn ? (
                <span className="rt-tag rt-tag--ghost shrink-0">{t('sell.counter')}</span>
              ) : (
                <button
                  type="button"
                  onClick={goBackToStep1}
                  className="text-xs font-bold text-[var(--primary)] cursor-pointer shrink-0 min-h-[44px] inline-flex items-center px-1"
                >
                  {t('common.edit')}
                </button>
              )}
            </div>

            {!isWalkIn ? (
              <>
                <div className="rt-ln">
                  <span className="text-[var(--text-2)] font-semibold">
                    {t('sell.items')} ({totalCartQty}
                    {totalFreeQty > 0 ? ` + ${totalFreeQty} free` : ''})
                  </span>
                  <b className="tabular-nums">{inr(grandTotal)}</b>
                </div>
                <div className="rt-ln">
                  <span className="text-[var(--text-2)] font-semibold">{t('sell.previousDue')}</span>
                  <b className={`tabular-nums ${creditInfo.due > 0.004 ? 'text-[var(--due)]' : 'text-[var(--text)]'}`}>
                    {inr(creditInfo.due)}
                  </b>
                </div>
                <div className="rt-ln rt-ln--total">
                  <span>{t('sell.grandTotal')}</span>
                  <span className="tabular-nums">{inr(combinedTotal)}</span>
                </div>
              </>
            ) : (
              <div className="rt-ln rt-ln--total">
                <span>{t('sell.grandTotal')}</span>
                <span className="tabular-nums">{inr(grandTotal)}</span>
              </div>
            )}
          </section>

          {/* Card 2: Payment method + large Amount received + Balance after bill */}
          <section className="rt-card space-y-2.5">
            <div className="text-xs font-semibold text-[var(--text-2)]">{t('sell.payment')}</div>

            <div className="rt-pay-pills" role="group" aria-label={t('sell.payment')}>
              <button
                type="button"
                aria-pressed={activePhonePay === 'cash'}
                onClick={() => selectPayChoice('cash')}
                className="rt-pay-pill"
              >
                <span>{t('sell.cash')}</span>
              </button>
              <button
                type="button"
                aria-pressed={activePhonePay === 'upi'}
                onClick={() => selectPayChoice('upi')}
                className="rt-pay-pill"
              >
                <span>{t('sell.upi')}</span>
              </button>
              <button
                type="button"
                aria-pressed={!isWalkIn && activePhonePay === 'credit'}
                disabled={isWalkIn}
                onClick={() => {
                  if (!isWalkIn) selectPayChoice('credit');
                }}
                className={`rt-pay-pill ${isWalkIn ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <span>{t('sell.credit')}</span>
              </button>
            </div>

            <div className="rt-fld">
              <label htmlFor="partial-amount" className="rt-fld__label">
                {t('sell.amountCollected')}
              </label>
              <div className="rt-fld__row">
                <span className="rt-fld__curr">₹</span>
                <input
                  id="partial-amount"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  placeholder="0"
                  value={paymentAmount}
                  onChange={(e) => {
                    setPayChoice('partial');
                    if (paymentMode === 'credit') setPaymentMode('cash');
                    setPaymentAmount(e.target.value);
                  }}
                  className="rt-fld__input"
                />
              </div>
            </div>

            {payChoice === 'partial' && collectedAmountPreview > 0 && (
              <div className="flex items-center gap-1.5">
                {(['cash', 'upi'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={paymentMode === m}
                    onClick={() => setPaymentMode(m)}
                    className="rt-chip min-h-[34px]! px-3!"
                  >
                    {m === 'cash' ? t('sell.cash') : t('sell.upi')}
                  </button>
                ))}
              </div>
            )}

            <div className="rt-ln !pt-0.5">
              <span className="text-[var(--text-2)] font-semibold">
                {isWalkIn ? t('sell.balance') : t('sell.balanceAfterBill')}
              </span>
              <b className={`tabular-nums ${balanceAfterBill > 0.005 ? 'text-[var(--due)]' : 'text-[var(--paid)]'}`}>
                {inr(balanceAfterBill)}
              </b>
            </div>
          </section>

          {/* Collapsible Phone & Bill Type details */}
          <details className="rt-card">
            <summary className="list-none flex items-center justify-between gap-2 cursor-pointer text-[12px] font-bold text-[var(--text-2)]">
              <span>{t('sell.orderSetup')} · {formattedSaleDate}</span>
              <ChevronDown className="w-4 h-4 shrink-0" aria-hidden="true" />
            </summary>
            <div className="mt-3 space-y-2.5">
              <div className="relative">
                <Phone className="w-3.5 h-3.5 text-[var(--text-2)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="tel"
                  inputMode="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Phone / WhatsApp (optional)"
                  aria-label="Retailer phone number"
                  className="w-full min-h-[44px] pl-9 pr-3 rounded-[var(--r-control)] border border-[var(--border)] bg-[var(--bg)] text-sm font-medium text-[var(--text)] focus:outline-none focus:bg-[var(--surface)] focus:border-[var(--primary)]"
                />
              </div>
              <select
                id="review-bill-type"
                value={billType}
                onChange={(e) => setBillType(e.target.value as 'tax_invoice' | 'bill_of_supply' | 'estimate')}
                aria-label="Bill type"
                className="w-full min-h-[44px] px-3 rounded-[var(--r-control)] border border-[var(--border)] bg-[var(--surface)] text-sm font-semibold text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
              >
                <option value="tax_invoice" disabled={compositionLocked || cartTaxStatus.allNonGst}>
                  Tax invoice (GST inclusive)
                  {compositionLocked
                    ? ' - not allowed for composition'
                    : cartTaxStatus.allNonGst
                      ? ' - disabled (all items Non-GST)'
                      : ''}
                </option>
                <option value="bill_of_supply">Bill of supply (non-GST)</option>
                <option value="estimate">Estimate / quotation</option>
              </select>
            </div>
          </details>
        </div>

        <div className="rt-checkout-footer">
          <button
            type="button"
            id="btn-finalize-save-bill-mobile"
            onClick={handleSaveBill}
            disabled={lineItems.length === 0}
            className="rt-btn rt-btn--accent w-full"
          >
            {cartTaxStatus.hasMixedTax
              ? `${t('sell.confirmGenerateBill')} (2)`
              : t('sell.confirmGenerateBill')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      data-esc-close
      role="dialog"
      aria-modal="true"
      aria-label="Order Review & Checkout"
      className="fixed inset-0 z-50 bg-[#F8F9FA] flex flex-col"
    >
      <header className="bg-[#0A1F44] text-white px-3 py-2.5 flex items-center gap-3 shrink-0 pt-[max(0.625rem,env(safe-area-inset-top))]">
        <button
          type="button"
          aria-label="Back to catalog"
          onClick={backToCatalog}
          className="size-11 shrink-0 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
          <h2 className="text-[17px] sm:text-lg font-extrabold text-white leading-none truncate">
            Order Review
          </h2>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-bold text-white/85 whitespace-nowrap">
              {totalCartQty} cs{totalFreeQty > 0 ? ` · ${totalFreeQty} free` : ''}
            </span>
            <button
              type="button"
              onClick={requestCancelSale}
              className="min-h-[38px] px-3 rounded-xl border border-white/25 bg-white/10 hover:bg-white/20 text-xs font-bold text-white inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t('salesman.cancelSale')}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-3 lg:px-4 pt-3 pb-28 lg:pb-6 lg:grid lg:grid-cols-12 lg:gap-6 space-y-4 lg:space-y-0">
          {/* LEFT: retailer info + editable items */}
          <div className="lg:col-span-7 min-w-0 space-y-4">
            <section className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Retailer</p>
                  <h3 className="text-lg font-bold text-[#0A1F44] break-words">{customerName || 'Apt / Walk-in sale'}</h3>
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                    <div className="relative flex-1 min-w-[180px] max-w-xs">
                      <Phone className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="tel"
                        inputMode="tel"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="Phone / WhatsApp (optional)"
                        aria-label="Retailer phone number"
                        className={`w-full min-h-[38px] pl-8 pr-2.5 rounded-lg border bg-gray-50 focus:bg-white text-xs font-medium text-[#0A1F44] focus:outline-none focus:ring-2 ${
                          customerPhoneError
                            ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-200'
                            : 'border-gray-200 focus:border-[#1B8A5A] focus:ring-[#1B8A5A]/20'
                        }`}
                      />
                    </div>
                    {customerGstin && (
                      <span className="text-xs text-gray-600 font-mono">{customerGstin}</span>
                    )}
                  </div>
                  {customerPhoneError && (
                    <p className="mt-1 text-xs font-medium text-rose-600">{customerPhoneError}</p>
                  )}
                </div>
                <span
                  className={`font-semibold rounded-full px-2.5 py-0.5 text-xs whitespace-nowrap ${
                    creditInfo.due > 0.004 ? 'bg-red-100 text-red-700' : 'bg-emerald-50 text-[#1B8A5A]'
                  }`}
                >
                  Due {inr(creditInfo.due)}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] text-[#1B8A5A] text-xs font-semibold px-2.5 py-1">
                  <Truck className="w-3.5 h-3.5" />
                  {saleSource === 'trip' ? `Source: Trip (${selectedTripId ?? '—'})` : 'Source: Warehouse'}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold px-2.5 py-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Invoice Date: {formattedSaleDate}
                </span>
                <button
                  type="button"
                  onClick={goBackToStep1}
                  className="min-h-[44px] px-2 text-xs font-semibold text-[#1B8A5A] hover:underline cursor-pointer"
                >
                  Change retailer
                </button>
              </div>
            </section>

            <section className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600 tabular-nums">
                  Order Items ({lineItems.length})
                </h4>
                <button
                  type="button"
                  onClick={backToCatalog}
                  className="min-h-[44px] px-2 inline-flex items-center gap-1 text-xs font-semibold text-[#1B8A5A] hover:underline cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add more items
                </button>
              </div>

              {lineItems.length === 0 ? (
                <div className="bg-white rounded-xl border border-dashed border-gray-300 p-6 text-center space-y-3">
                  <p className="text-sm font-semibold text-gray-600">Your cart is empty. Add beverages to review.</p>
                  <button
                    type="button"
                    onClick={backToCatalog}
                    className="min-h-[44px] px-4 rounded-xl bg-[#1B8A5A] hover:bg-[#157048] text-white text-sm font-semibold cursor-pointer"
                  >
                    + Select Beverages
                  </button>
                </div>
              ) : (
                lineItems.map((item, idx) => {
                  const prod = products.find((p) => p.id === item.productId);
                  const cost = Number(prod?.effectiveCost ?? prod?.cost) || 0;
                  const cases = Number(item.qty) || 0;
                  const perCase = cases > 0 ? (Number(item.taxable) || 0) / cases : 0;
                  const profit = cost > 0 && cases > 0 && !item.isFree && !item.isBundleFreeItem ? perCase - cost : null;
                  return (
                    <div
                      key={item.key || `cart_item_${item.productId}_${idx}`}
                      className="bg-white rounded-xl border border-gray-200 p-3.5 space-y-2.5"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-11 h-11 rounded-xl bg-[#F8F9FA] border border-gray-200 flex items-center justify-center shrink-0">
                          <PackIcon pack={prod?.pack} name={item.productName} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-[#0A1F44] text-sm leading-snug break-words">{item.productName}</p>
                          <p className="mt-0.5 text-xs text-gray-600 tabular-nums">
                            {item.rate === 0 ? 'Free' : `₹${Number(item.rate).toLocaleString('en-IN')} / case`}
                            {item.taxability === 'non_gst' ? (
                              <span className="ml-1 font-semibold text-slate-600">· Non-GST (0%)</span>
                            ) : item.cgstRate > 0 ? (
                              <span> · GST {item.cgstRate * 2}%</span>
                            ) : null}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            {item.freeQty > 0 && (
                              <span className="bg-emerald-100 text-emerald-800 text-xs font-medium px-2 py-0.5 rounded-full">
                                +{item.freeQty} Free Case{item.freeQty === 1 ? '' : 's'}
                              </span>
                            )}
                            {item.appliedPromo && (
                              <span className="bg-emerald-50 text-[#1B8A5A] text-xs font-medium px-2 py-0.5 rounded-full max-w-full truncate">
                                {item.promoLabel || 'Scheme'}
                              </span>
                            )}
                            {profit !== null && profit < 0 && (
                              <span className="bg-red-100 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full">
                                Below cost (−₹{money(-profit)}/cs)
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-[#0A1F44] tabular-nums">{inr(item.gross)}</p>
                          <p className="text-xs text-gray-500 tabular-nums">{item.qty} case{item.qty === 1 ? '' : 's'}</p>
                        </div>
                      </div>

                      {!item.isBundleFreeItem && (
                        <div className="pt-2.5 border-t border-gray-100 flex items-center justify-between gap-2">
                          <div className="inline-flex items-center rounded-xl border border-gray-300 overflow-hidden">
                            <button
                              type="button"
                              aria-label={`Decrease ${item.productName}`}
                              onClick={() => setItemQty(item.productId, item.qty - 1)}
                              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-700 hover:bg-gray-100 cursor-pointer"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="min-w-[40px] px-2 text-center font-bold text-[#0A1F44] tabular-nums">{item.qty}</span>
                            <button
                              type="button"
                              aria-label={`Increase ${item.productName}`}
                              onClick={() => setItemQty(item.productId, item.qty + 1)}
                              className="min-h-[44px] min-w-[44px] flex items-center justify-center bg-[#1B8A5A] text-white hover:bg-[#157048] cursor-pointer"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            {prod && (
                              <button
                                type="button"
                                onClick={() => openQuickEntry(prod)}
                                aria-label={`Edit scheme or price for ${item.productName}`}
                                title="Scheme / Custom Price"
                                className="min-h-[44px] px-3 rounded-xl border border-gray-200 bg-[#F8F9FA] hover:bg-gray-100 text-xs font-semibold text-[#0A1F44] inline-flex items-center gap-1.5 cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5 text-[#1B8A5A]" /> Edit
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setItemQty(item.productId, 0)}
                              aria-label={`Remove ${item.productName}`}
                              title="Remove item"
                              className="min-h-[44px] min-w-[44px] rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </section>
          </div>

          {/* RIGHT: financial summary + payment + CTA */}
          <div className="lg:col-span-5 min-w-0 space-y-4">
            {isCompact && (
              <section className="bg-white rounded-xl border border-gray-200 p-4">
                <label htmlFor="review-bill-type" className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">
                  Bill type
                </label>
                <select
                  id="review-bill-type"
                  value={billType}
                  onChange={(e) => setBillType(e.target.value as 'tax_invoice' | 'bill_of_supply' | 'estimate')}
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-gray-300 bg-white text-sm font-medium text-[#0A1F44] cursor-pointer focus:outline-none focus:border-[#1B8A5A] focus:ring-2 focus:ring-[#1B8A5A]/20"
                >
                  <option value="tax_invoice" disabled={compositionLocked || cartTaxStatus.allNonGst}>
                    Tax invoice (GST inclusive)
                    {compositionLocked
                      ? ' - not allowed for composition'
                      : cartTaxStatus.allNonGst
                        ? ' - disabled (all items Non-GST)'
                        : ''}
                  </option>
                  <option value="bill_of_supply">Bill of supply (non-GST)</option>
                  <option value="estimate">Estimate / quotation</option>
                </select>
                {cartTaxStatus.allNonGst && (
                  <p className="mt-1.5 text-xs font-medium text-emerald-700">
                    All items are Non-GST (0% tax) — GST does not apply.
                  </p>
                )}
                {cartTaxStatus.hasMixedTax && billType === 'tax_invoice' && (
                  <p className="mt-1.5 text-xs font-medium text-gray-500">
                    Mixed cart: Non-GST items stay at 0% GST; GST applies only to taxable items.
                  </p>
                )}
              </section>
            )}

            <section className="bg-white rounded-xl border border-gray-200 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600 mb-3">Financial Summary</h4>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-600">Subtotal</dt>
                  <dd className="font-medium text-[#0A1F44] tabular-nums">{inr(subtotalBeforeSavings)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-600">Scheme &amp; Custom Price Savings</dt>
                  <dd className="text-[#1B8A5A] font-medium tabular-nums">
                    {totalSavings > 0 ? `− ${inr(totalSavings)}` : inr(0)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-600">{billType === 'tax_invoice' ? 'GST (included)' : 'GST'}</dt>
                  <dd className="font-medium text-[#0A1F44] tabular-nums">{inr(totalTax)}</dd>
                </div>
                <div className="flex justify-between gap-3 pt-3 border-t border-gray-200">
                  <dt className="font-bold text-[#0A1F44]">GRAND TOTAL</dt>
                  <dd className="font-bold text-lg text-[#0A1F44] tabular-nums">{inr(grandTotal)}</dd>
                </div>
              </dl>
              {cartTaxStatus.hasMixedTax && (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/75 p-3 space-y-1.5 text-xs">
                  <div className="font-bold text-amber-950 flex items-center justify-between">
                    <span>Auto-Split Checkout · 2 Separate Bills</span>
                    <span className="px-1.5 py-0.5 rounded bg-amber-200/70 text-xs uppercase tracking-wider">GST Safe</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-700 tabular-nums">
                    <span>1. GST Bill ({splitPreview.gstLines.length} item{splitPreview.gstLines.length === 1 ? '' : 's'})</span>
                    <span className="font-bold text-slate-900">{inr(splitPreview.gstTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-700 tabular-nums">
                    <span>2. Non-GST Cash Memo · NG-... ({splitPreview.nonGstLines.length} item{splitPreview.nonGstLines.length === 1 ? '' : 's'})</span>
                    <span className="font-bold text-amber-900">{inr(splitPreview.nonGstTotal)} (0% GST)</span>
                  </div>
                  {collectedAmountPreview > 0 && collectedAmountPreview < grandTotal - 0.01 && (
                    <div className="pt-1 border-t border-amber-200/80 text-xs text-amber-900 tabular-nums">
                      Payment split: {inr(splitPreview.gstPaid)} → GST bill · {inr(splitPreview.nonGstPaid)} → Non-GST memo
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="bg-white rounded-xl border border-gray-200 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600 mb-3">Payment Method</h4>
              <div className="grid grid-cols-2 gap-3">
                {/* Net 30 Credit */}
                <button
                  type="button"
                  aria-pressed={payChoice === 'credit'}
                  onClick={() => selectPayChoice('credit')}
                  className={`text-left rounded-xl min-h-[44px] cursor-pointer ${
                    payChoice === 'credit' ? 'border-2 border-[#1B8A5A] bg-[#ECFDF5] p-[11px]' : 'border border-gray-200 bg-white hover:border-gray-300 p-3'
                  }`}
                >
                  <CreditCard className="w-5 h-5 text-[#0A1F44]" />
                  <p className="mt-1.5 text-sm font-semibold text-[#0A1F44]">Net 30 Credit</p>
                  {creditInfo.available === null ? (
                    <p className="text-xs text-gray-500">No credit limit set</p>
                  ) : creditExceeded ? (
                    <p className="text-xs font-semibold text-red-700">
                      Over limit by {inr(grandTotal - creditInfo.available)}
                    </p>
                  ) : (
                    <p className="text-xs font-medium text-[#1B8A5A]">Remaining {inr(creditInfo.available)}</p>
                  )}
                </button>

                <button
                  type="button"
                  aria-pressed={payChoice === 'cash'}
                  onClick={() => selectPayChoice('cash')}
                  className={`text-left rounded-xl min-h-[44px] cursor-pointer ${
                    payChoice === 'cash' ? 'border-2 border-[#1B8A5A] bg-[#ECFDF5] p-[11px]' : 'border border-gray-200 bg-white hover:border-gray-300 p-3'
                  }`}
                >
                  <Banknote className="w-5 h-5 text-[#0A1F44]" />
                  <p className="mt-1.5 text-sm font-semibold text-[#0A1F44]">Cash / Delivery</p>
                  <p className="text-xs text-gray-500">Collect full amount</p>
                </button>

                <button
                  type="button"
                  aria-pressed={payChoice === 'upi'}
                  onClick={() => selectPayChoice('upi')}
                  className={`text-left rounded-xl min-h-[44px] cursor-pointer ${
                    payChoice === 'upi' ? 'border-2 border-[#1B8A5A] bg-[#ECFDF5] p-[11px]' : 'border border-gray-200 bg-white hover:border-gray-300 p-3'
                  }`}
                >
                  <QrCode className="w-5 h-5 text-[#0A1F44]" />
                  <p className="mt-1.5 text-sm font-semibold text-[#0A1F44]">UPI / QR Code</p>
                  <p className="text-xs text-gray-500">GPay · PhonePe · Paytm</p>
                </button>

                <button
                  type="button"
                  aria-pressed={payChoice === 'partial'}
                  onClick={() => selectPayChoice('partial')}
                  className={`text-left rounded-xl min-h-[44px] cursor-pointer ${
                    payChoice === 'partial' ? 'border-2 border-[#1B8A5A] bg-[#ECFDF5] p-[11px]' : 'border border-gray-200 bg-white hover:border-gray-300 p-3'
                  }`}
                >
                  <Wallet className="w-5 h-5 text-[#0A1F44]" />
                  <p className="mt-1.5 text-sm font-semibold text-[#0A1F44]">Partial / Split Payment</p>
                  <p className="text-xs text-gray-500">Part now, rest on credit</p>
                </button>
              </div>

              {creditExceeded && (payChoice === 'credit' || payChoice === 'partial') && (
                <p className="mt-3 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">
                  This order ({inr(grandTotal)}) is more than the available credit ({inr(creditInfo.available ?? 0)}).
                  {' '}Collect part of it now or pick another method.
                </p>
              )}

              {payChoice === 'partial' && (
                <div className="mt-3 space-y-2">
                  <label htmlFor="partial-amount" className="block text-xs font-semibold text-gray-600">
                    Amount Collected Now
                  </label>
                  <input
                    id="partial-amount"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    placeholder="0"
                    value={paymentAmount}
                    onChange={(e) => {
                      setPaymentAmount(e.target.value);
                      if (paymentMode === 'credit') setPaymentMode('cash');
                    }}
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-gray-300 bg-white text-base font-semibold text-[#0A1F44] tabular-nums focus:outline-none focus:border-[#1B8A5A] focus:ring-2 focus:ring-[#1B8A5A]/20"
                  />
                  <div className="flex gap-2">
                    {(['cash', 'upi'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPaymentMode(m)}
                        className={`min-h-[44px] px-4 rounded-xl text-sm font-semibold cursor-pointer ${
                          paymentMode === m ? 'bg-[#1B8A5A] text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {m === 'cash' ? 'Cash' : 'UPI'}
                      </button>
                    ))}
                  </div>
                  <p
                    className={`text-xs font-semibold ${balanceDuePreview > 0.005 ? 'text-amber-700' : 'text-[#1B8A5A]'}`}
                  >
                    {collectedAmountPreview <= 0
                      ? `Nothing collected · ${inr(grandTotal)} goes on credit`
                      : balanceDuePreview > 0.005
                        ? `Remaining credit balance: ${inr(balanceDuePreview)}`
                        : 'Paid in full · Due ₹0'}
                  </p>
                  {creditInfo.available !== null && balanceDuePreview > creditInfo.available && (
                    <p className="text-xs font-semibold text-red-700">
                      Remaining {inr(balanceDuePreview)} is above available credit {inr(creditInfo.available)}.
                    </p>
                  )}
                </div>
              )}
            </section>

            {/* Desktop: sticky CTA inside the right column */}
            <div className="hidden lg:block sticky bottom-0 bg-[#F8F9FA] pt-2 pb-1">
              <button
                type="button"
                id="btn-finalize-save-bill"
                onClick={handleSaveBill}
                disabled={lineItems.length === 0}
                className="w-full min-h-[48px] bg-[#1B8A5A] hover:bg-[#157048] text-white font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {cartTaxStatus.hasMixedTax
                  ? `Confirm & Issue 2 Split Bills • ${inr(grandTotal)}`
                  : `Confirm & Complete Sale • ${inr(grandTotal)}`}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile & Tablet: sticky bottom CTA */}
      <div className="lg:hidden shrink-0 bg-white border-t border-gray-200 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          id="btn-finalize-save-bill-mobile"
          onClick={handleSaveBill}
          disabled={lineItems.length === 0}
          className="w-full min-h-[48px] bg-[#1B8A5A] hover:bg-[#157048] text-white font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {cartTaxStatus.hasMixedTax
            ? `Confirm & Issue 2 Split Bills • ${inr(grandTotal)}`
            : `Confirm & Complete Sale • ${inr(grandTotal)}`}
        </button>
      </div>
    </div>
  );
};
