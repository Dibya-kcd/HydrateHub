import React from 'react';
import {
  ArrowRight,
  IndianRupee,
  Package,
  Receipt,
  Share2,
  ShoppingCart,
  Sparkles,
  Truck,
  UserPlus,
  Zap,
} from 'lucide-react';
import { Bill, OrganizationProfile } from '../../../types';
import { useLanguage } from '../../../i18n/LanguageContext';
import { OdiaName } from '../../common/OdiaName';
import { money } from '../../../utils/billing';
import { billBalance } from '../../../utils/salesReturns';

export type SalesmanTab = 'home' | 'sell' | 'vanStock' | 'bills' | 'customerDue' | 'trips';

export interface SalesmanHomeTabProps {
  isLowVision: boolean;
  todayCash: number;
  todayUpi: number;
  todaySales: number;
  todayBills: Bill[];
  todayDeliveredCrates: number;
  totalLoadedItems: number;
  todayStr: string;
  orgProfile?: OrganizationProfile;
  setSalesmanTab: (tab: SalesmanTab) => void;
  onOpenAddCustomerModal: () => void;
  onViewInvoiceModal: (bill: Bill) => void;
}

export const SalesmanHomeTab: React.FC<SalesmanHomeTabProps> = ({
  isLowVision,
  todayCash,
  todayUpi,
  todaySales,
  todayBills,
  todayDeliveredCrates,
  totalLoadedItems,
  todayStr,
  orgProfile,
  setSalesmanTab,
  onOpenAddCustomerModal,
  onViewInvoiceModal,
}) => {
  const { t } = useLanguage();

  return (
    <section id="salesman-home-dashboard" className={`space-y-6 ${!isLowVision ? 'hh-salesman-flat' : ''}`}>
      {/* 4 Summary KPI Cards (2x2 Grid) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {/* Card 1: Cash in Hand */}
        <div
          data-card-tone="received"
          onClick={() => setSalesmanTab('customerDue')}
          className="p-3.5 sm:p-4 rounded-2xl border shadow-sm transition-transform active:scale-[0.98] hover:scale-[1.01] cursor-pointer"
        >
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <span className="text-xs font-bold text-emerald-800">
              Cash in Hand
            </span>
            <div className="hh-icon-badge hh-icon-badge--sm hh-icon-badge--green">
              <IndianRupee size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono tabular-nums text-emerald-950">
            ₹{money(todayCash)}
          </div>
          <div className="text-xs font-semibold text-emerald-700 mt-1">
            Collected today
          </div>
        </div>

        {/* Card 2: UPI / Online */}
        <div
          data-card-tone="sales"
          onClick={() => setSalesmanTab('customerDue')}
          className="p-3.5 sm:p-4 rounded-2xl border shadow-sm transition-transform active:scale-[0.98] hover:scale-[1.01] cursor-pointer"
        >
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <span className="text-xs font-bold text-blue-800">
              UPI / Online
            </span>
            <div className="hh-icon-badge hh-icon-badge--sm hh-icon-badge--blue">
              <Zap size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono tabular-nums text-blue-950">
            ₹{money(todayUpi)}
          </div>
          <div className="text-xs font-semibold text-blue-700 mt-1">
            Direct transfers
          </div>
        </div>

        {/* Card 3: Total Sales */}
        <div
          data-card-tone="warning"
          onClick={() => setSalesmanTab('bills')}
          className="p-3.5 sm:p-4 rounded-2xl border shadow-sm transition-transform active:scale-[0.98] hover:scale-[1.01] cursor-pointer"
        >
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <span className="text-xs font-bold text-amber-800">
              Total Sales
            </span>
            <div className="hh-icon-badge hh-icon-badge--sm hh-icon-badge--amber">
              <Receipt size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono tabular-nums text-amber-950">
            ₹{money(todaySales)}
          </div>
          <div className="text-xs font-semibold text-amber-700 mt-1">
            {todayBills.length} invoice{todayBills.length === 1 ? '' : 's'} cut
          </div>
        </div>

        {/* Card 4: Crates Delivered */}
        <div
          data-card-tone="profit"
          onClick={() => setSalesmanTab('vanStock')}
          className="p-3.5 sm:p-4 rounded-2xl border shadow-sm transition-transform active:scale-[0.98] hover:scale-[1.01] cursor-pointer"
        >
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <span className="text-xs font-bold text-violet-800">
              Crates Delivered
            </span>
            <div className="hh-icon-badge hh-icon-badge--sm hh-icon-badge--purple">
              <Package size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono tabular-nums text-violet-950">
            {todayDeliveredCrates}
          </div>
          <div className="text-xs font-semibold text-violet-700 mt-1">
            {totalLoadedItems} items loaded
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS SECTION (2x2 Grid) */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-500">
          <Sparkles size={14} className="text-amber-500" />
          <span>Quick Actions</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Action 1: New Bill / Sale */}
          <button
            type="button"
            id="home-action-sale"
            data-card-tone="sales"
            onClick={() => setSalesmanTab('sell')}
            className="group p-4 rounded-2xl border flex items-center justify-between gap-3 text-left transition-all hover:shadow-md active:scale-[0.99] cursor-pointer"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="hh-icon-badge hh-icon-badge--navy group-hover:scale-105 transition-transform">
                <ShoppingCart size={20} />
              </div>
              <div className="min-w-0">
                <div className="font-black text-sm sm:text-base text-slate-900 group-hover:text-blue-700 transition-colors">
                  {t('salesman.newSale')}
                </div>
                <div className="text-xs text-slate-600 truncate mt-0.5">
                  Create bill for retailer
                </div>
              </div>
            </div>
            <ArrowRight size={20} className="text-slate-400 group-hover:translate-x-1 group-hover:text-slate-700 transition-all shrink-0" />
          </button>

          {/* Action 2: Payments */}
          <button
            type="button"
            id="home-action-payment"
            data-card-tone="received"
            onClick={() => setSalesmanTab('customerDue')}
            className="group p-4 rounded-2xl border flex items-center justify-between gap-3 text-left transition-all hover:shadow-md active:scale-[0.99] cursor-pointer"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="hh-icon-badge hh-icon-badge--green group-hover:scale-105 transition-transform">
                <IndianRupee size={20} />
              </div>
              <div className="min-w-0">
                <div className="font-black text-sm sm:text-base text-slate-900 group-hover:text-emerald-700 transition-colors">
                  2. Payments
                </div>
                <div className="text-xs text-slate-600 truncate mt-0.5">
                  Collect dues & receipts
                </div>
              </div>
            </div>
            <ArrowRight size={20} className="text-slate-400 group-hover:translate-x-1 group-hover:text-slate-700 transition-all shrink-0" />
          </button>

          {/* Action 3: Trips */}
          <button
            type="button"
            id="home-action-trip"
            data-card-tone="warning"
            onClick={() => setSalesmanTab('trips')}
            className="group p-4 rounded-2xl border flex items-center justify-between gap-3 text-left transition-all hover:shadow-md active:scale-[0.99] cursor-pointer"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="hh-icon-badge hh-icon-badge--amber group-hover:scale-105 transition-transform">
                <Truck size={20} />
              </div>
              <div className="min-w-0">
                <div className="font-black text-sm sm:text-base text-slate-900 group-hover:text-amber-700 transition-colors">
                  3. Trips
                </div>
                <div className="text-xs text-slate-600 truncate mt-0.5">
                  Manage vehicle runs & loads
                </div>
              </div>
            </div>
            <ArrowRight size={20} className="text-slate-400 group-hover:translate-x-1 group-hover:text-slate-700 transition-all shrink-0" />
          </button>

          {/* Action 4: Van Stock */}
          <button
            type="button"
            id="home-action-stock"
            data-card-tone="profit"
            onClick={() => setSalesmanTab('vanStock')}
            className="group p-4 rounded-2xl border flex items-center justify-between gap-3 text-left transition-all hover:shadow-md active:scale-[0.99] cursor-pointer"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="hh-icon-badge hh-icon-badge--purple group-hover:scale-105 transition-transform">
                <Package size={20} />
              </div>
              <div className="min-w-0">
                <div className="font-black text-sm sm:text-base text-slate-900 group-hover:text-violet-700 transition-colors">
                  {t('salesman.tab.vanStock')}
                </div>
                <div className="text-xs text-slate-600 truncate mt-0.5">
                  Check remaining stock & crates
                </div>
              </div>
            </div>
            <ArrowRight size={20} className="text-slate-400 group-hover:translate-x-1 group-hover:text-slate-700 transition-all shrink-0" />
          </button>

          {/* Action 5: Add Customer */}
          <button
            type="button"
            id="home-action-add-customer"
            data-card-tone="received"
            onClick={onOpenAddCustomerModal}
            className="group p-4 rounded-2xl border flex items-center justify-between gap-3 text-left transition-all hover:shadow-md active:scale-[0.99] cursor-pointer sm:col-span-2"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="hh-icon-badge hh-icon-badge--green group-hover:scale-105 transition-transform">
                <UserPlus size={20} />
              </div>
              <div className="min-w-0">
                <div className="font-black text-sm sm:text-base text-slate-900 group-hover:text-emerald-700 transition-colors flex items-center gap-2">
                  <span>5. Add Customer</span>
                </div>
                <div className="text-xs text-slate-600 truncate mt-0.5">
                  Register new retailer on route
                </div>
              </div>
            </div>
            <ArrowRight size={20} className="text-slate-400 group-hover:translate-x-1 group-hover:text-slate-700 transition-all shrink-0" />
          </button>
        </div>
      </div>

      {/* TODAY'S INVOICES SECTION */}
      <div
        data-card-tone="neutral"
        className="p-4 sm:p-5 rounded-2xl border shadow-sm space-y-4"
      >
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
          <div className="flex items-center gap-2">
            <Receipt size={20} className="text-emerald-700 shrink-0" />
            <h2 className="font-black text-base sm:text-lg text-slate-900">
              Today's Invoices ({todayBills.length})
            </h2>
          </div>
          {todayBills.length > 0 && (
            <span className="font-mono font-black text-xs px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
              Total: ₹{money(todaySales)}
            </span>
          )}
        </div>

        {todayBills.length === 0 ? (
          <div className="text-center py-10 px-4 rounded-xl border-2 border-dashed border-slate-200 space-y-3 bg-slate-50/50">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <ShoppingCart size={28} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-700">
                No invoices generated yet today.
              </p>
              <p className="text-xs text-slate-500">
                Tap '1. New Bill / Sale' to start billing a retailer.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSalesmanTab('sell')}
              className="mt-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs cursor-pointer shadow-sm transition-colors"
            >
              + Create First Bill Today
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {todayBills.map((bill) => {
              const total = Number(bill.total) || 0;
              const paid = Number(bill.amountPaid) || 0;
              const due = billBalance(bill);
              const isFullyPaid = due <= 0;
              const isPartial = paid > 0 && due > 0;
              const itemCount = (bill.items || []).reduce((s, i) => s + (Number(i.qty) || 0), 0);

              return (
                <div
                  key={bill.id}
                  data-card-tone={isFullyPaid ? 'received' : isPartial ? 'warning' : 'due'}
                  className="p-3.5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-sm text-slate-900">
                        <OdiaName name={bill.retailer} kind="person" />
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-500">
                        #{bill.id}
                      </span>
                      <span
                        className={`text-xs font-black px-2 py-0.5 rounded-full uppercase ${
                          isFullyPaid
                            ? 'bg-emerald-100 text-emerald-800'
                            : isPartial
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {isFullyPaid ? 'PAID' : isPartial ? 'PARTIAL' : 'UNPAID'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 font-semibold mt-1 flex items-center gap-2 flex-wrap">
                      <span>{itemCount} crate{itemCount === 1 ? '' : 's'}</span>
                      <span>•</span>
                      <span>{bill.date || todayStr}</span>
                      {bill.vehicle && (
                        <>
                          <span>•</span>
                          <span>{bill.vehicle}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <div className="text-left sm:text-right">
                      <div className="font-mono font-black text-sm text-slate-900">
                        ₹{money(total)}
                      </div>
                      {due > 0 ? (
                        <div className="text-xs font-bold text-rose-600">
                          Due: ₹{money(due)}
                        </div>
                      ) : (
                        <div className="text-xs font-bold text-emerald-600">
                          Fully Paid
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onViewInvoiceModal(bill)}
                        className="hh-salesman-bill-btn px-2.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700 cursor-pointer"
                        title="View Invoice Details"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const text = `Invoice #${bill.id} from ${orgProfile?.name || 'MrWater Distribution'}: ₹${bill.total} for ${bill.retailer}. Thank you!`;
                          window.open(`https://wa.me/${bill.phone ? '91' + bill.phone.replace(/\D/g, '') : ''}?text=${encodeURIComponent(text)}`, '_blank');
                        }}
                        className="hh-salesman-bill-btn p-1.5 rounded-lg border border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer inline-flex items-center justify-center"
                        title="Share via WhatsApp"
                      >
                        <Share2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
