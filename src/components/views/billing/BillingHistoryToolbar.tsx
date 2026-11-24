import React from 'react';
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  LayoutList,
  Receipt,
  Route,
  Search,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { Bill } from '../../../types';
import type { BeatRoute } from '../../../constants/beats';
import { money } from '../../../utils/billing';

export type HistoryGrouping = 'table' | 'date' | 'customer';
export type PaymentFilter = 'all' | 'pending' | 'paid';

interface BillingHistoryToolbarProps {
  isPhone: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
  grouping: HistoryGrouping;
  setGrouping: React.Dispatch<React.SetStateAction<HistoryGrouping>>;
  paymentFilter: PaymentFilter;
  setPaymentFilter: React.Dispatch<React.SetStateAction<PaymentFilter>>;
  dateWindow: 'all' | 'today' | '7d';
  setDateWindow: React.Dispatch<React.SetStateAction<'all' | 'today' | '7d'>>;
  beatFilter: string;
  setBeatFilter: React.Dispatch<React.SetStateAction<string>>;
  beatMenuOpen: boolean;
  setBeatMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  beatMenuRef: React.RefObject<HTMLDivElement | null>;
  activeBeats: BeatRoute[];
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  bills: Bill[];
  filteredBills: Bill[];
  stats: {
    totalCount: number;
    totalBilled: number;
    totalPaid: number;
    totalDue: number;
    pendingCount: number;
    paidCount: number;
  };
  statusCounts: { all: number; pending: number; paid: number };
  onNewInvoiceClick?: () => void;
}

export const BillingHistoryToolbar: React.FC<BillingHistoryToolbarProps> = ({
  isPhone,
  t,
  grouping,
  setGrouping,
  paymentFilter,
  setPaymentFilter,
  dateWindow,
  setDateWindow,
  beatFilter,
  setBeatFilter,
  beatMenuOpen,
  setBeatMenuOpen,
  beatMenuRef,
  activeBeats,
  searchQuery,
  setSearchQuery,
  bills,
  filteredBills,
  stats,
  statusCounts,
  onNewInvoiceClick,
}) => {
  if (isPhone) {
    return (
      <>
        {/* 1. Search Pill + Beat Filter */}
        <div className="space-y-2.5 pt-1">
          <div ref={beatMenuRef} className="relative">
            <div className="rt-sale-search border border-[var(--border)]">
              <Search size={16} className="rt-sale-search__icon" aria-hidden="true" />
              <input
                enterKeyHint="search"
                id="history-search-input"
                type="text"
                placeholder={t('sell.billNoOrCustomer')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="rt-sale-search__input"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="rt-sale-search__btn"
                  aria-label="Clear search"
                >
                  <X size={15} />
                </button>
              )}
              {activeBeats.length > 0 && (
                <button
                  type="button"
                  onClick={() => setBeatMenuOpen((v) => !v)}
                  aria-label="Filter by beat"
                  aria-expanded={beatMenuOpen}
                  className={`rt-sale-search__btn ${beatFilter !== 'all' ? 'rt-sale-search__btn--active' : ''}`}
                  title="Filter by beat"
                >
                  <Route size={16} />
                </button>
              )}
            </div>

            {beatMenuOpen && activeBeats.length > 0 && (
              <div
                role="listbox"
                aria-label="Choose beat"
                className="rt-card !p-2 absolute left-0 right-0 top-full mt-1.5 z-40 space-y-1 max-h-72 overflow-y-auto"
              >
                <div className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-[var(--text-2)]">
                  {t('sell.beat')}
                </div>
                <button
                  type="button"
                  role="option"
                  aria-selected={beatFilter === 'all'}
                  onClick={() => {
                    setBeatFilter('all');
                    setBeatMenuOpen(false);
                  }}
                  className={`w-full min-h-[44px] px-3 py-2 rounded-[var(--r-card)] text-left text-xs font-semibold flex items-center justify-between gap-2 cursor-pointer ${
                    beatFilter === 'all'
                      ? 'bg-[var(--primary-soft)] text-[var(--primary)]'
                      : 'text-[var(--text)] hover:bg-[var(--bg)]'
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <Route className="w-3.5 h-3.5 shrink-0" />
                    <span>All beats</span>
                  </span>
                  {beatFilter === 'all' && <Check className="w-4 h-4 shrink-0" />}
                </button>
                {activeBeats.map((b) => {
                  const selected = beatFilter.toLowerCase() === b.name.toLowerCase();
                  return (
                    <button
                      key={b.id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        setBeatFilter(b.name);
                        setBeatMenuOpen(false);
                      }}
                      className={`w-full min-h-[44px] px-3 py-2 rounded-[var(--r-card)] text-left text-xs font-semibold flex items-center justify-between gap-2 cursor-pointer ${
                        selected
                          ? 'bg-[var(--primary-soft)] text-[var(--primary)]'
                          : 'text-[var(--text)] hover:bg-[var(--bg)]'
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <Route className="w-3.5 h-3.5 shrink-0" />
                        <span className="break-words">{b.name}</span>
                      </span>
                      {selected && <Check className="w-4 h-4 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. Quick Date/Status & Grouping Filter Chips */}
          <div className="rt-chips !px-0 !py-0" role="group" aria-label="Filter and group sales history">
            <button
              type="button"
              aria-pressed={dateWindow === 'today'}
              onClick={() => setDateWindow((w) => (w === 'today' ? 'all' : 'today'))}
              className="rt-chip"
            >
              {t('sell.today')}
            </button>
            <button
              type="button"
              aria-pressed={dateWindow === '7d'}
              onClick={() => setDateWindow((w) => (w === '7d' ? 'all' : '7d'))}
              className="rt-chip"
            >
              {t('sell.sevenDays')}
            </button>
            <button
              type="button"
              id="filter-pending-bills"
              aria-pressed={paymentFilter === 'pending'}
              onClick={() => setPaymentFilter((p) => (p === 'pending' ? 'all' : 'pending'))}
              className="rt-chip"
            >
              {t('sell.unpaid')}
            </button>
            <button
              type="button"
              id="filter-all-bills"
              aria-pressed={dateWindow === 'all' && paymentFilter === 'all' && grouping === 'table'}
              onClick={() => {
                setDateWindow('all');
                setPaymentFilter('all');
                setBeatFilter('all');
                setGrouping('table');
              }}
              className="rt-chip"
            >
              {t('sell.sizeAll')}
            </button>
            <button
              type="button"
              id="tab-view-date"
              aria-pressed={grouping === 'date'}
              onClick={() => setGrouping((g) => (g === 'date' ? 'table' : 'date'))}
              className="rt-chip"
            >
              <Calendar size={14} className="shrink-0" />
              <span>{t('sell.dates')}</span>
            </button>
            <button
              type="button"
              id="tab-view-customer"
              aria-pressed={grouping === 'customer'}
              onClick={() => setGrouping((g) => (g === 'customer' ? 'table' : 'customer'))}
              className="rt-chip"
            >
              <Users size={14} className="shrink-0" />
              <span>{t('sell.customer')}</span>
            </button>
          </div>
        </div>

        {/* Empty State (Phone) */}
        {filteredBills.length === 0 && (
          <div className="rt-card text-center py-8 space-y-3">
            <h3 className="text-base font-bold text-[var(--text)]">No invoices found</h3>
            <p className="text-sm text-[var(--text-2)]">
              {beatFilter !== 'all'
                ? `No invoices match Beat "${beatFilter}".`
                : 'Create your first sale to see it here.'}
            </p>
            {onNewInvoiceClick && (
              <button
                type="button"
                onClick={onNewInvoiceClick}
                className="rt-btn"
              >
                {t('shortcut.newSale')}
              </button>
            )}
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {/* 1. Interactive KPI Summary Cards (Tablet/Desktop) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
        {/* All Invoices Card */}
        <button
          type="button"
          id="filter-all-bills"
          onClick={() => setPaymentFilter('all')}
          data-card-tone="sales"
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden group select-none ${
            paymentFilter === 'all'
              ? 'ring-2 ring-blue-600/35 shadow-md'
              : 'shadow-xs hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="hh-icon-badge hh-icon-badge--sm hh-icon-badge--blue">
                <Receipt size={15} />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-900/80">
                All Invoices
              </span>
            </div>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full font-mono transition-colors ${
                paymentFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-white/80 text-blue-800 border border-blue-200/80'
              }`}
            >
              {statusCounts.all}
            </span>
          </div>
          <div className="font-mono text-lg font-black text-slate-900 tabular-nums">
            ₹{money(stats.totalBilled)}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            Total sales value ({bills.length} total bills)
          </div>
        </button>

        {/* Pending Due Card (Red) */}
        <button
          type="button"
          id="filter-pending-bills"
          onClick={() => setPaymentFilter('pending')}
          data-card-tone="due"
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden group select-none ${
            paymentFilter === 'pending'
              ? 'ring-2 ring-rose-600/35 shadow-md'
              : 'shadow-xs hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="hh-icon-badge hh-icon-badge--sm hh-icon-badge--rose">
                <AlertCircle size={15} />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-rose-800">
                Pending Due
              </span>
            </div>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full font-mono transition-colors ${
                paymentFilter === 'pending' ? 'bg-rose-600 text-white' : 'bg-white/80 text-rose-700 border border-rose-200/80'
              }`}
            >
              {statusCounts.pending}
            </span>
          </div>
          <div className="font-mono text-lg font-black text-rose-600 tabular-nums">
            ₹{money(stats.totalDue)}
          </div>
          <div className="text-xs text-rose-700/80 mt-0.5">
            Pending customer collections
          </div>
        </button>

        {/* Settled / Paid Card (Green) */}
        <button
          type="button"
          id="filter-paid-bills"
          onClick={() => setPaymentFilter('paid')}
          data-card-tone="received"
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden group select-none ${
            paymentFilter === 'paid'
              ? 'ring-2 ring-emerald-600/35 shadow-md'
              : 'shadow-xs hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="hh-icon-badge hh-icon-badge--sm hh-icon-badge--green">
                <CheckCircle2 size={15} />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                Settled
              </span>
            </div>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full font-mono transition-colors ${
                paymentFilter === 'paid' ? 'bg-emerald-600 text-white' : 'bg-white/80 text-emerald-800 border border-emerald-200/80'
              }`}
            >
              {statusCounts.paid}
            </span>
          </div>
          <div className="font-mono text-lg font-black text-emerald-700 tabular-nums">
            ₹{money(stats.totalPaid)}
          </div>
          <div className="text-xs text-emerald-800/80 mt-0.5">
            Settled collections
          </div>
        </button>
      </div>

      {/* 2. Unified Toolbar (Tablet/Desktop) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-3.5 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Main View Mode Tabs */}
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 shrink-0 shadow-2xs overflow-x-auto self-start sm:self-auto">
            <button
              type="button"
              id="tab-view-table"
              onClick={() => setGrouping('table')}
              className={`inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer select-none whitespace-nowrap shrink-0 ${
                grouping === 'table'
                  ? 'bg-[var(--primary)] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <LayoutList size={14} className="shrink-0" />
              <span>Invoices</span>
            </button>

            <button
              type="button"
              id="tab-view-date"
              onClick={() => setGrouping('date')}
              className={`inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer select-none whitespace-nowrap shrink-0 ${
                grouping === 'date'
                  ? 'bg-[var(--primary)] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Calendar size={14} className="shrink-0" />
              <span>Dates</span>
            </button>

            <button
              type="button"
              id="tab-view-customer"
              onClick={() => setGrouping('customer')}
              className={`inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer select-none whitespace-nowrap shrink-0 ${
                grouping === 'customer'
                  ? 'bg-[var(--primary)] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Users size={14} className="shrink-0" />
              <span>Customer</span>
            </button>
          </div>

          {/* Full-width Search Bar */}
          <div ref={beatMenuRef} className="relative flex-1 min-w-[220px] max-w-xl">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              enterKeyHint="search"
              id="history-search-input"
              type="text"
              placeholder="Search invoices, customer, item, beat..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-10 py-2 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] focus:bg-white transition-all shadow-2xs ${
                activeBeats.length > 0
                  ? searchQuery
                    ? 'pr-20 md:pr-9'
                    : 'pr-12 md:pr-3'
                  : searchQuery
                    ? 'pr-9'
                    : 'pr-3'
              }`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className={`absolute top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer ${
                  activeBeats.length > 0 ? 'right-11 md:right-2.5' : 'right-2.5'
                }`}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Beat Route Filter Strip (desktop) */}
        {activeBeats.length > 0 && (
          <div className="hidden lg:flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2 border-t border-slate-100 text-xs">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1 mr-1">
              <Truck size={13} className="text-indigo-600 shrink-0" />
              <span>Beat:</span>
            </span>
            <button
              type="button"
              onClick={() => setBeatFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                beatFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              All Beats
            </button>
            {activeBeats.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBeatFilter(b.name)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                  beatFilter.toLowerCase() === b.name.toLowerCase()
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {b.name}
              </button>
            ))}
            {beatFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setBeatFilter('all')}
                className="text-xs text-rose-600 hover:underline shrink-0 ml-1 font-semibold cursor-pointer"
              >
                Clear Beat Filter
              </button>
            )}
          </div>
        )}

        {/* Live Filter Feedback Strip */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium flex-wrap gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-slate-800">
              Showing {filteredBills.length}
            </span>
            <span className="text-slate-400">of</span>
            <span className="text-slate-600">{bills.length} total bills</span>
            {beatFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                Beat: {beatFilter}
                <button
                  aria-label="Remove beat filter"
                  type="button"
                  onClick={() => setBeatFilter('all')}
                  className="text-indigo-400 hover:text-indigo-700 cursor-pointer ml-0.5"
                >
                  ✕
                </button>
              </span>
            )}
            {paymentFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-700">
                Filter: {paymentFilter.toUpperCase()}
                <button
                  aria-label="Remove payment filter"
                  type="button"
                  onClick={() => setPaymentFilter('all')}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer ml-0.5"
                >
                  ✕
                </button>
              </span>
            )}
          </div>

          <div className="text-right">
            <span>Filtered Total: </span>
            <span className="font-mono font-bold text-slate-900 whitespace-nowrap">
              ₹{money(filteredBills.reduce((s, b) => s + b.total, 0))}
            </span>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {filteredBills.length === 0 && (
        <div data-card-tone="neutral" className="rounded-2xl border shadow-xs px-6 py-12 text-center">
          <h3 className="text-base font-bold text-slate-900">No invoices found</h3>
          <p className="text-sm text-slate-500 mt-1.5">
            {beatFilter !== 'all'
              ? `No invoices match Beat "${beatFilter}".`
              : 'Create your first sale to see it here.'}
          </p>
          {onNewInvoiceClick && (
            <button
              type="button"
              onClick={onNewInvoiceClick}
              className="mt-5 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-[var(--primary)] text-white text-sm font-semibold shadow-xs cursor-pointer active:scale-[0.99]"
            >
              New sale
            </button>
          )}
        </div>
      )}
    </>
  );
};
