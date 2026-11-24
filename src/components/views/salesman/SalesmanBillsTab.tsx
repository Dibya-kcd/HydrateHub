import React from 'react';
import { FileText, Printer, Search, Share2 } from 'lucide-react';
import { Bill, OrganizationProfile, PaletteTokens } from '../../../types';
import { OdiaName } from '../../common/OdiaName';
import { money } from '../../../utils/billing';
import { billBalance } from '../../../utils/salesReturns';

export interface SalesmanBillsTabProps {
  isLowVision: boolean;
  displayedMyBills: Bill[];
  myBillsTotalBilled: number;
  myBillsTotalPaid: number;
  myBillsScope: 'currentTrip' | 'allMyBills';
  setMyBillsScope: (scope: 'currentTrip' | 'allMyBills') => void;
  tripBillsCount: number;
  myBillsCount: number;
  myBillsSearch: string;
  setMyBillsSearch: (val: string) => void;
  palette: PaletteTokens;
  fz: (base: number, extra?: React.CSSProperties) => React.CSSProperties;
  orgProfile?: OrganizationProfile;
  onViewInvoiceModal: (bill: Bill) => void;
}

export const SalesmanBillsTab: React.FC<SalesmanBillsTabProps> = ({
  isLowVision,
  displayedMyBills,
  myBillsTotalBilled,
  myBillsTotalPaid,
  myBillsScope,
  setMyBillsScope,
  tripBillsCount,
  myBillsCount,
  myBillsSearch,
  setMyBillsSearch,
  palette,
  fz,
  orgProfile,
  onViewInvoiceModal,
}) => {
  return (
    <section id="salesman-bills-view" className={`space-y-4 ${!isLowVision ? 'hh-salesman-flat' : ''}`}>
      <div
        data-card-tone="neutral"
        className="p-4 sm:p-5 rounded-2xl border shadow-sm space-y-4"
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
          <div>
            <h2 style={fz(18, { fontWeight: 900 })} className="text-slate-900 flex items-center gap-2.5">
              <span className="hh-icon-badge hh-icon-badge--sm hh-icon-badge--blue">
                <FileText size={16} />
              </span>
              <span>My Bills</span>
            </h2>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              {displayedMyBills.length} invoices on route
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="px-2.5 py-1 rounded-lg font-mono font-black bg-sky-50 text-sky-700 border border-sky-200">
              Billed: ₹{money(myBillsTotalBilled)}
            </span>
            <span className="px-2.5 py-1 rounded-lg font-mono font-black bg-emerald-50 text-emerald-800 border border-emerald-200">
              Collected: ₹{money(myBillsTotalPaid)}
            </span>
          </div>
        </div>

        {/* Scope toggle & search bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setMyBillsScope('currentTrip')}
              className={`min-h-[36px] px-3 rounded-lg text-xs font-black transition-colors cursor-pointer ${
                myBillsScope === 'currentTrip'
                  ? 'bg-white text-blue-950 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Current Trip ({tripBillsCount})
            </button>
            <button
              type="button"
              onClick={() => setMyBillsScope('allMyBills')}
              className={`min-h-[36px] px-3 rounded-lg text-xs font-black transition-colors cursor-pointer ${
                myBillsScope === 'allMyBills'
                  ? 'bg-white text-blue-950 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All My Bills ({myBillsCount})
            </button>
          </div>

          <div className="relative flex-1 sm:max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="search"
              value={myBillsSearch}
              onChange={(e) => setMyBillsSearch(e.target.value)}
              placeholder="Search invoice # or retailer..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 bg-white focus:outline-none focus:border-sky-600"
            />
          </div>
        </div>

        {/* Bills Listing */}
        {displayedMyBills.length === 0 ? (
          <div className="text-center py-12 rounded-xl border-2 border-dashed text-slate-500 space-y-1" style={{ borderColor: palette.line }}>
            <FileText size={32} className="mx-auto text-slate-400" />
            <div className="text-sm font-black text-slate-700">No invoices found</div>
            <div className="text-xs font-semibold">
              {myBillsSearch
                ? `No bills matching "${myBillsSearch}".`
                : myBillsScope === 'currentTrip'
                ? 'No sales recorded on the current active trip yet. Switch to "Sales" to create bills.'
                : 'No past bills found for your account.'}
            </div>
            {myBillsScope === 'currentTrip' && myBillsCount > 0 && (
              <button
                type="button"
                onClick={() => setMyBillsScope('allMyBills')}
                className="mt-2 text-xs font-black text-sky-700 underline cursor-pointer"
              >
                View All {myBillsCount} Past Invoices
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {displayedMyBills.map((bill) => {
              const total = Number(bill.total) || 0;
              const paid = Number(bill.amountPaid) || 0;
              const due = billBalance(bill);

              return (
                <div
                  key={bill.id}
                  id={`salesman-bill-row-${bill.id}`}
                  data-card-tone={due > 0 ? 'due' : 'received'}
                  className="p-3.5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-sm sm:text-base text-slate-900">
                        Invoice #{bill.id}
                      </span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-sky-700 font-mono">
                        {bill.date}
                      </span>
                      {due > 0 ? (
                        <span className="text-xs font-black px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300">
                          Due: ₹{money(due)}
                        </span>
                      ) : (
                        <span className="text-xs font-black px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                          Paid in Full
                        </span>
                      )}
                    </div>
                    <div className="font-black text-sm mt-0.5 text-slate-800"><OdiaName name={bill.retailer} kind="person" /></div>
                    <div className="text-xs font-semibold text-slate-500 mt-0.5">
                      {bill.items.reduce((sum, i) => sum + (i.qty || 0), 0)} cases • {bill.items.length} line items
                      {bill.phone ? ` • Tel: ${bill.phone}` : ''}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="text-right">
                      <div className="font-mono font-black text-base text-slate-900">₹{money(total)}</div>
                      <div className="text-xs font-bold text-emerald-700">Rec: ₹{money(paid)}</div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onViewInvoiceModal(bill)}
                        className="hh-salesman-bill-btn p-2 rounded-lg border-2 cursor-pointer bg-white hover:bg-slate-100 transition-colors inline-flex items-center justify-center"
                        style={{ borderColor: palette.line }}
                        title="View / Print Tax Invoice"
                        aria-label={`View invoice ${bill.id}`}
                      >
                        <Printer size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const text = `Invoice #${bill.id} from ${orgProfile?.name || 'MrWater Distribution'}: ₹${bill.total} for ${bill.retailer}. Thank you!`;
                          window.open(`https://wa.me/${bill.phone ? '91' + bill.phone.replace(/\D/g, '') : ''}?text=${encodeURIComponent(text)}`, '_blank');
                        }}
                        className="hh-salesman-bill-btn p-2 rounded-lg border-2 cursor-pointer bg-emerald-600 text-white hover:bg-emerald-700 transition-colors inline-flex items-center justify-center"
                        style={{ borderColor: '#047857' }}
                        title="Share via WhatsApp"
                        aria-label={`WhatsApp invoice ${bill.id}`}
                      >
                        <Share2 size={16} />
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
