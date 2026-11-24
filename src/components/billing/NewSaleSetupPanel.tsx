import React from 'react';
import {
  Building2,
  Calendar,
  ChevronDown,
  ChevronRight,
  Pencil,
  Phone,
  Plus,
  Truck,
  X,
} from 'lucide-react';
import { BeatRoute } from '../../constants/beats';
import { Customer, ExistingCustomer, Trip, Warehouse } from '../../types';
import { ContextTrip, ContextWarehouse, OrderContextBar, SaleSource } from './OrderContextBar';
import { CustomerPredictiveSearch, RichCustomerOption } from './CustomerPredictiveSearch';

export interface NewSaleSetupPanelProps {
  isPhone: boolean;
  isCompact: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
  inr: (n: number) => string;
  customerName: string;
  customerPhone: string;
  setCustomerPhone: (v: string) => void;
  customerGstin: string;
  customerPhoneError: string | null;
  creditDue: number;
  goBackToStep1: () => void;
  requestCancelSale: () => void;
  saleSource: SaleSource;
  selectedStockLabel: string;
  formattedSaleDate: string;
  saleDate: string;
  setSaleDate: (d: string) => void;
  todayStr: string;
  editSetup: boolean;
  setEditSetup: React.Dispatch<React.SetStateAction<boolean>>;
  handleSaleSourceChange: (next: SaleSource) => void;
  tripOptions: ContextTrip[];
  selectedTripId: number | undefined;
  setStockSource: (s: string) => void;
  warehouseOptions: ContextWarehouse[];
  stockSource: string;
  defaultWarehouseId: string;
  billType: 'tax_invoice' | 'bill_of_supply' | 'estimate';
  setBillType: (v: 'tax_invoice' | 'bill_of_supply' | 'estimate') => void;
  compositionLocked: boolean;
  cartTaxStatus: { allNonGst: boolean; hasMixedTax: boolean };
  invoicePrefix?: string;
  activeBeats: BeatRoute[];
  selectedBeatFilter: string;
  setSelectedBeatFilter: (b: string) => void;
  selectedCustomerId: string;
  filteredCustomersForPredictive: Customer[];
  filteredExistingCustomersForPredictive: ExistingCustomer[];
  onSelectPredictiveCustomer: (c: RichCustomerOption) => void;
  onSelectSpotSale: () => void;
  onOpenCreateCustomerFromDesktop: (prefill: { name?: string; phone?: string; gstin?: string }) => void;
  handleStockSourceChange: (val: string) => void;
  warehouses: Warehouse[];
  activeTripsForUser: Trip[];
  onOpenProductSelector: () => void;
  totalCartQty: number;
  grandTotal: number;
  onOpenCartReview: () => void;
}

export const NewSaleSetupPanel: React.FC<NewSaleSetupPanelProps> = ({
  isPhone,
  isCompact,
  t,
  inr,
  customerName,
  customerPhone,
  setCustomerPhone,
  customerGstin,
  customerPhoneError,
  creditDue,
  goBackToStep1,
  requestCancelSale,
  saleSource,
  selectedStockLabel,
  formattedSaleDate,
  saleDate,
  setSaleDate,
  todayStr,
  editSetup,
  setEditSetup,
  handleSaleSourceChange,
  tripOptions,
  selectedTripId,
  setStockSource,
  warehouseOptions,
  stockSource,
  defaultWarehouseId,
  billType,
  setBillType,
  compositionLocked,
  cartTaxStatus,
  invoicePrefix,
  activeBeats,
  selectedBeatFilter,
  setSelectedBeatFilter,
  selectedCustomerId,
  filteredCustomersForPredictive,
  filteredExistingCustomersForPredictive,
  onSelectPredictiveCustomer,
  onSelectSpotSale,
  onOpenCreateCustomerFromDesktop,
  handleStockSourceChange,
  warehouses,
  activeTripsForUser,
  onOpenProductSelector,
  totalCartQty,
  grandTotal,
  onOpenCartReview,
}) => {
  return (
    <>
      {/* Main Configuration Card */}
      {isPhone ? (
        <section
          className="rt-card hh-order-setup-card space-y-3.5"
          aria-label={t('sell.orderSetup')}
        >
          {/* Retailer Summary Header */}
          <div className="flex items-start justify-between gap-2.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-2)]">
                  {t('sell.customer')}
                </p>
                <span className={`rt-tag ${creditDue > 0.004 ? 'rt-tag--due' : 'rt-tag--paid'}`}>
                  {creditDue > 0.004 ? `${t('home.dueLabel')} ${inr(creditDue)}` : t('sell.paid')}
                </span>
              </div>
              <h3 className="mt-1 text-[17px] font-extrabold text-[var(--text)] leading-snug break-words">
                {customerName || 'Walk-in sale'}
              </h3>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={goBackToStep1}
                className="rt-btn-outline min-h-[44px] px-3 text-xs font-bold"
              >
                {t('sell.change')}
              </button>
              <button
                type="button"
                id="btn-reset-new-customer"
                onClick={requestCancelSale}
                aria-label={t('salesman.cancelSale')}
                title="Cancel order & select a new customer"
                className="min-h-[44px] px-3 rounded-full border border-[var(--due)]/30 bg-[var(--due-bg)] text-[var(--due)] text-xs font-bold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{t('common.cancel')}</span>
              </button>
            </div>
          </div>

          <div className="relative">
            <Phone className="w-4 h-4 text-[var(--primary)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="tel"
              inputMode="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="Customer phone / WhatsApp (optional)"
              aria-label="Customer phone number"
              className={`w-full min-h-[44px] pl-10 pr-3.5 rounded-full border bg-[var(--bg)] text-sm font-medium text-[var(--text)] focus:outline-none focus:bg-[var(--surface)] ${
                customerPhoneError
                  ? 'border-[var(--due)]'
                  : 'border-[var(--border)] focus:border-[var(--primary)]'
              }`}
            />
          </div>
          {customerGstin && (
            <span className="inline-block text-xs font-mono font-semibold text-[var(--text-2)]">
              GSTIN: {customerGstin}
            </span>
          )}
          {customerPhoneError && (
            <p className="text-xs font-medium text-[var(--due)]">{customerPhoneError}</p>
          )}

          {/* Stock Source & Bill Date Strip */}
          <div className="rounded-[var(--r-card)] bg-[var(--bg)] border border-[var(--border)] p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-2)] m-0">
                  {t('sell.stockSource')}
                </p>
                <div className="flex items-start gap-1.5 text-[13px] font-bold text-[var(--text)] min-w-0">
                  {saleSource === 'trip' ? (
                    <Truck className="w-4 h-4 text-[var(--primary)] shrink-0 mt-0.5" />
                  ) : (
                    <Building2 className="w-4 h-4 text-[var(--primary)] shrink-0 mt-0.5" />
                  )}
                  <span className="leading-snug break-words">
                    {saleSource === 'trip' ? `Van: ${selectedStockLabel}` : selectedStockLabel}
                  </span>
                </div>
                <div
                  className={`flex items-center gap-1.5 text-xs font-semibold tabular-nums ${
                    saleDate < todayStr ? 'text-[var(--soon-text)]' : 'text-[var(--text-2)]'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  <span>{formattedSaleDate}</span>
                  {saleDate < todayStr && (
                    <span className="rt-tag rt-tag--soon">Back-dated</span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditSetup((v) => !v)}
                aria-expanded={editSetup}
                className={`min-h-[44px] px-3.5 rounded-full border text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors ${
                  editSetup
                    ? 'bg-[var(--text)] border-[var(--text)] text-[var(--surface)]'
                    : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text)]'
                }`}
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>{editSetup ? t('sell.done') : 'Edit'}</span>
              </button>
            </div>

            {editSetup && (
              <div className="pt-2 border-t border-[var(--border)]">
                <OrderContextBar
                  saleSource={saleSource}
                  onSaleSourceChange={handleSaleSourceChange}
                  trips={tripOptions}
                  selectedTripId={selectedTripId}
                  onTripChange={(id) => setStockSource(`trip_${id}`)}
                  warehouses={warehouseOptions}
                  selectedWarehouseId={!stockSource.startsWith('trip_') ? stockSource : defaultWarehouseId}
                  onWarehouseChange={(id) => setStockSource(id)}
                  saleDate={saleDate}
                  onSaleDateChange={setSaleDate}
                  todayIso={todayStr}
                />
              </div>
            )}
          </div>

          {/* Bill Type */}
          <div>
            <label htmlFor="select-bill-type" className="block text-xs font-bold uppercase tracking-wider text-[var(--text-2)] mb-1.5">
              Bill Type
            </label>
            <div className="relative">
              <select
                id="select-bill-type"
                value={billType}
                onChange={(e) => setBillType(e.target.value as 'tax_invoice' | 'bill_of_supply' | 'estimate')}
                className="w-full min-h-[44px] appearance-none px-4 rounded-full border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text)] font-semibold focus:outline-none focus:border-[var(--primary)] pr-10 cursor-pointer"
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
              <ChevronDown className="w-4 h-4 text-[var(--text-2)] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            {compositionLocked && (
              <p className="mt-1.5 text-xs text-[var(--text-2)]">
                Composition taxpayer: a Bill of Supply is issued and no GST is charged to the customer.
              </p>
            )}
            {cartTaxStatus.allNonGst && (
              <p className="mt-2 rt-notice rt-notice--soon">
                All items are Non-GST / Trading — issues a separate Cash Memo (NG-...) excluded from GST filings.
              </p>
            )}
            {cartTaxStatus.hasMixedTax && (
              <p className="mt-2 rt-notice rt-notice--soon">
                Mixed cart: checkout will auto-split into 1 GST Invoice ({invoicePrefix || 'INV'}-...) + 1 Non-GST Cash Memo (NG-...).
              </p>
            )}
          </div>
        </section>
      ) : isCompact ? (
        <section
          data-card-tone="sales"
          className="rounded-2xl border shadow-sm p-4 space-y-3.5"
          aria-label="Order setup"
        >
          {/* Retailer Summary Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold uppercase tracking-wider text-[#5A7198]">
                  Retailer
                </p>
                {creditDue > 0.004 ? (
                  <span className="bg-red-50 text-red-700 font-bold rounded-md px-2 py-0.5 text-xs whitespace-nowrap tabular-nums">
                    Due {inr(creditDue)}
                  </span>
                ) : (
                  <span className="text-[#15803D] font-bold text-xs whitespace-nowrap tabular-nums">
                    Due ₹0
                  </span>
                )}
              </div>
              <h3 className="mt-1 text-[18px] font-extrabold text-[#0A1F44] leading-snug break-words">
                {customerName || 'Walk-in sale'}
              </h3>
              <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[180px]">
                  <Phone className="w-3.5 h-3.5 text-[#1A63DB] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="tel"
                    inputMode="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Customer phone / WhatsApp (optional)"
                    aria-label="Customer phone number"
                    className={`w-full min-h-[38px] pl-8 pr-2.5 rounded-xl border bg-[#F5F8FD] text-xs font-semibold text-[#0A1F44] focus:outline-none focus:bg-white focus:ring-2 ${
                      customerPhoneError
                        ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-200'
                        : 'border-[#DCE5F2] focus:border-[#1A63DB] focus:ring-[#1A63DB]/15'
                    }`}
                  />
                </div>
                {customerGstin && (
                  <span className="text-xs font-mono font-semibold text-[#5A7198]">
                    GSTIN: {customerGstin}
                  </span>
                )}
              </div>
              {customerPhoneError && (
                <p className="mt-1 text-xs font-medium text-rose-600">{customerPhoneError}</p>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={goBackToStep1}
                className="min-h-[36px] px-2.5 rounded-xl border border-[#DCE5F2] bg-[#F5F8FD] hover:bg-[#EAF1FB] text-xs font-bold text-[#1A63DB] cursor-pointer transition-colors whitespace-nowrap"
              >
                Change
              </button>
              <button
                type="button"
                id="btn-reset-new-customer"
                onClick={requestCancelSale}
                aria-label={t('salesman.cancelSale')}
                title="Cancel order & select a new customer"
                className="min-h-[36px] px-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{t('common.cancel')}</span>
              </button>
            </div>
          </div>

          {/* Stock Source & Bill Date Strip */}
          <div className="rounded-xl bg-white/80 border border-black/5 p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 space-y-1">
                <div className="flex items-start gap-1.5 text-[13px] font-bold text-[#0A1F44] min-w-0">
                  {saleSource === 'trip' ? (
                    <Truck className="w-4 h-4 text-[#1A63DB] shrink-0 mt-0.5" />
                  ) : (
                    <Building2 className="w-4 h-4 text-[#1A63DB] shrink-0 mt-0.5" />
                  )}
                  <span className="leading-snug break-words">
                    {saleSource === 'trip' ? `Van: ${selectedStockLabel}` : selectedStockLabel}
                  </span>
                </div>
                <div
                  className={`flex items-center gap-1.5 text-xs font-semibold tabular-nums ${
                    saleDate < todayStr ? 'text-amber-800' : 'text-[#4A638D]'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  <span>{formattedSaleDate}</span>
                  {saleDate < todayStr && (
                    <span className="text-xs font-bold text-amber-700">· Back-dated</span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditSetup((v) => !v)}
                aria-expanded={editSetup}
                className={`min-h-[38px] px-3 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors ${
                  editSetup
                    ? 'bg-[#0A1F44] border-[#0A1F44] text-white'
                    : 'bg-white border-[#DCE5F2] text-[#0A1F44] hover:bg-slate-50'
                }`}
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>{editSetup ? 'Done' : 'Edit'}</span>
              </button>
            </div>

            {editSetup && (
              <div className="pt-2 border-t border-[#DCE5F2]">
                <OrderContextBar
                  saleSource={saleSource}
                  onSaleSourceChange={handleSaleSourceChange}
                  trips={tripOptions}
                  selectedTripId={selectedTripId}
                  onTripChange={(id) => setStockSource(`trip_${id}`)}
                  warehouses={warehouseOptions}
                  selectedWarehouseId={!stockSource.startsWith('trip_') ? stockSource : defaultWarehouseId}
                  onWarehouseChange={(id) => setStockSource(id)}
                  saleDate={saleDate}
                  onSaleDateChange={setSaleDate}
                  todayIso={todayStr}
                />
              </div>
            )}
          </div>

          {/* Bill Type */}
          <div>
            <label htmlFor="select-bill-type" className="block text-xs font-bold uppercase tracking-wider text-[#5A7198] mb-1.5">
              Bill Type
            </label>
            <div className="relative">
              <select
                id="select-bill-type"
                value={billType}
                onChange={(e) => setBillType(e.target.value as 'tax_invoice' | 'bill_of_supply' | 'estimate')}
                className="w-full min-h-[46px] appearance-none px-3.5 rounded-xl border border-[#DCE5F2] bg-white text-sm text-[#0A1F44] font-semibold focus:outline-none focus:border-[#1A63DB] focus:ring-2 focus:ring-[#1A63DB]/15 pr-10 cursor-pointer"
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
              <ChevronDown className="w-4 h-4 text-[#5A7198] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            {compositionLocked && (
              <p className="mt-1.5 text-xs text-[#5A7198]">
                Composition taxpayer: a Bill of Supply is issued and no GST is charged to the customer.
              </p>
            )}
            {cartTaxStatus.allNonGst && (
              <p className="mt-1.5 text-xs font-medium text-amber-800">
                All items are Non-GST / Trading — issues a separate Cash Memo (NG-...) excluded from GST filings.
              </p>
            )}
            {cartTaxStatus.hasMixedTax && (
              <p className="mt-1.5 text-xs font-medium text-amber-800">
                Mixed cart: checkout will auto-split into 1 GST Invoice ({invoicePrefix || 'INV'}-...) + 1 Non-GST Cash Memo (NG-...).
              </p>
            )}
          </div>
        </section>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-4 shadow-xs space-y-4">
          {/* Route / Beat Filter on Sale Page */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0 flex items-center gap-1 mr-1">
              <Truck size={13} className="text-indigo-600 shrink-0" />
              <span>Route / Beat:</span>
            </span>
            <button
              type="button"
              onClick={() => setSelectedBeatFilter('all')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                selectedBeatFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              All Beats
            </button>
            {activeBeats.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setSelectedBeatFilter(b.name)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                  selectedBeatFilter.toLowerCase() === b.name.toLowerCase()
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {b.name}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {/* 1. CUSTOMER (Smart Responsive Predictive Search) */}
            <CustomerPredictiveSearch
              id="select-customer"
              label="CUSTOMER"
              placeholder={
                selectedBeatFilter !== 'all'
                  ? `Search customers in Beat "${selectedBeatFilter}"...`
                  : 'Search by name, mobile, customer ID, or email...'
              }
              selectedCustomerId={selectedCustomerId}
              selectedCustomerName={customerName}
              selectedCustomerPhone={customerPhone}
              customers={filteredCustomersForPredictive}
              existingCustomers={filteredExistingCustomersForPredictive}
              onSelectCustomer={onSelectPredictiveCustomer}
              onSelectSpotSale={onSelectSpotSale}
              onOpenCreateCustomer={onOpenCreateCustomerFromDesktop}
            />

            {/* 2. BILL TYPE */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                BILL TYPE
              </label>
              <div className="relative">
                <select
                  id="select-bill-type"
                  value={billType}
                  onChange={(e) => setBillType(e.target.value as 'tax_invoice' | 'bill_of_supply' | 'estimate')}
                  className="w-full appearance-none px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 pr-10 cursor-pointer"
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
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              {compositionLocked && (
                <p className="mt-1.5 text-xs text-slate-500">
                  Composition taxpayer: a Bill of Supply is issued and no GST is charged to the customer.
                </p>
              )}
              {cartTaxStatus.allNonGst && (
                <p className="mt-1.5 text-xs font-medium text-amber-700">
                  All items are Non-GST / Trading — issues a separate Cash Memo (NG-...) excluded from GST filings.
                </p>
              )}
              {cartTaxStatus.hasMixedTax && (
                <p className="mt-1.5 text-xs font-medium text-amber-700">
                  Mixed cart: checkout will auto-split into 1 GST Invoice ({invoicePrefix || 'INV'}-...) + 1 Non-GST Cash Memo (NG-...).
                </p>
              )}
            </div>

            {/* 2b. CUSTOMER PHONE (Editable inline for SMS/WhatsApp & records) */}
            <div>
              <label htmlFor="newsale-desktop-phone" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                CUSTOMER PHONE (OPTIONAL)
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="newsale-desktop-phone"
                  type="tel"
                  inputMode="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="10-digit WhatsApp / mobile"
                  className={`w-full pl-9 pr-3 py-2.5 rounded-xl border bg-white text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 ${
                    customerPhoneError
                      ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-200'
                      : 'border-slate-200 focus:border-emerald-700 focus:ring-emerald-700/20'
                  }`}
                />
              </div>
              {customerPhoneError && (
                <p className="mt-1 text-xs font-medium text-rose-600">{customerPhoneError}</p>
              )}
            </div>

            {/* 3. STOCK FROM (Godowns & Delivery Vans / Van Trip Stock) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  STOCK FROM
                </label>
                {stockSource.startsWith('trip_') && (
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                    Van Trip Stock
                  </span>
                )}
              </div>
              <div className="relative">
                <select
                  id="select-stock-from"
                  value={stockSource}
                  onChange={(e) => handleStockSourceChange(e.target.value)}
                  className="w-full appearance-none px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 pr-10 cursor-pointer"
                >
                  <optgroup label="🏢 Godowns & Warehouses">
                    {warehouses.map((w, idx) => (
                      <option key={w.id || `wh_${idx}`} value={w.id}>
                        {w.name} ({w.code || 'Godown'})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="🚚 Active Delivery Vans / Trips">
                    {activeTripsForUser.length > 0 ? (
                      activeTripsForUser.map((tr, idx) => {
                        const loadedCount = Object.values(tr.loaded || {}).reduce((a, b) => a + (Number(b) || 0), 0);
                        return (
                          <option key={tr.id !== undefined ? `trip_${tr.id}` : `trip_idx_${idx}`} value={`trip_${tr.id}`}>
                            {tr.vehicle} (Trip #{tr.id}{tr.salesman ? ` · ${tr.salesman}` : ''}) — {loadedCount} cs loaded
                          </option>
                        );
                      })
                    ) : (
                      <option value="" disabled>
                        (No active van trips out on route)
                      </option>
                    )}
                    <option value="__new_van_trip__">+ Dispatch / Add New Van Trip...</option>
                  </optgroup>
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              {stockSource.startsWith('trip_') && (
                <p className="text-xs text-emerald-700 font-medium mt-1 truncate">
                  Sourcing inventory from {selectedStockLabel}
                </p>
              )}
            </div>

            {/* 4. DATE */}
            <div>
              <label htmlFor="newsale-date-input" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                DATE
              </label>
              <div className="relative">
                <input
                  id="newsale-date-input"
                  type="date"
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 cursor-pointer shadow-2xs"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Button to Open "Select Beverages & Crates" Screen */}
      <button
        type="button"
        id="btn-add-product"
        onClick={onOpenProductSelector}
        className={`w-full flex items-center justify-between px-4 min-h-[52px] rounded-full font-bold text-[14.5px] transition-all cursor-pointer group ${
          isPhone
            ? 'hh-order-select-cta'
            : isCompact
              ? 'bg-gradient-to-r from-[#19A84B] to-[#0D8A38] hover:from-[#159642] hover:to-[#0A752E] text-white shadow-sm'
              : 'bg-gradient-to-r from-emerald-50/70 via-white to-slate-50 hover:from-emerald-100/70 hover:to-emerald-50/30 rounded-2xl border-2 border-emerald-600/30 hover:border-emerald-600 shadow-2xs text-slate-800 py-3.5'
        }`}
      >
        <span className="flex items-center gap-2.5">
          <span
            className={`size-7 rounded-full flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
              isPhone
                ? 'bg-white/20 text-white'
                : isCompact
                  ? 'bg-white text-[#0D8A38]'
                  : 'bg-emerald-700 text-white rounded-lg'
            }`}
          >
            <Plus className="w-4 h-4 stroke-[3]" />
          </span>
          <span>Select Beverages &amp; Crates</span>
        </span>
        <ChevronRight
          className={`w-4 h-4 shrink-0 ${isCompact ? 'text-white/90' : 'text-slate-400 group-hover:text-emerald-700'}`}
        />
      </button>

      {isPhone && totalCartQty > 0 && (
        <button
          type="button"
          id="btn-floating-cart"
          onClick={onOpenCartReview}
          className="rt-btn w-full justify-between"
        >
          <span className="tabular-nums">
            {t('sell.itemsCount', { n: totalCartQty })} · {inr(grandTotal)}
          </span>
          <span>{t('sell.checkout')} →</span>
        </button>
      )}
    </>
  );
};
