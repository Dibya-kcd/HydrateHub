import { billEditLockReason } from '../../../utils/billEditLock';
import { todayISO } from '../../../utils/dateLocal';
import React from 'react';
import { Ban, Calendar, ChevronDown, ChevronUp, Pencil, Share2 } from 'lucide-react';
import { Bill, BillingSettings, Product } from '../../../types';
import { money } from '../../../utils/billing';
import { billBalance } from '../../../utils/salesReturns';
import { formatBillNumber, isGstExcludedBill } from '../../../utils/invoiceCommon';
import { getInitials } from '../../ui/HomeKit';

export interface DateGroupItem {
  key: string;
  label: string;
  bills: Bill[];
  totalItems: number;
  totalBilled: number;
  totalPaid: number;
  totalDue: number;
}

export interface CustomerGroupItem {
  key: string;
  name: string;
  latestDate: string;
  bills: Bill[];
  totalItems: number;
  totalBilled: number;
  totalPaid: number;
  totalDue: number;
}

interface GroupedBillRowProps {
  bill: Bill;
  products: Product[];
  billingSettings: BillingSettings;
  showRetailerLabel: boolean;
  onViewInvoice: (bill: Bill, defaultFormat?: 'gst' | 'non_gst') => void;
  onEditBill: (bill: Bill) => void;
  onDeleteBill: (bill: Bill) => void;
}

const GroupedBillRow: React.FC<GroupedBillRowProps> = ({
  bill,
  products,
  billingSettings,
  showRetailerLabel,
  onViewInvoice,
  onEditBill,
  onDeleteBill,
}) => {
  const due = billBalance(bill);
  const isPaid = due <= 0.01;
  const itemLabel = formatBillNumber(bill, billingSettings);
  const isNg = isGstExcludedBill(bill, products);
  const totalCases = (bill.items || []).reduce((s, i) => s + (Number(i.qty) || 0), 0);
  const itemCount = (bill.items || []).length;

  return (
    <div className="p-3.5 hover:bg-slate-50/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => onViewInvoice(bill)}
            className="font-bold font-mono text-xs text-[var(--primary)] hover:underline cursor-pointer"
            title="View Invoice"
          >
            #{itemLabel}
          </button>
          {isNg && (
            <span className="text-xs font-bold px-1.5 py-0.2 rounded border border-teal-300 bg-teal-50 text-teal-800 uppercase tracking-wider">
              Non-GST
            </span>
          )}
          {bill.customerGstin && !isNg && (
            <span className="text-xs font-bold px-1.5 py-0.2 rounded border border-amber-300 bg-amber-50 text-amber-900 uppercase tracking-wider">
              B2B
            </span>
          )}
          {showRetailerLabel ? (
            <span className="text-xs text-slate-800 font-semibold min-w-0 break-words lg:truncate">
              {bill.retailer || 'Cash customer'}
            </span>
          ) : (
            <span className="text-xs text-slate-600 font-medium">
              {bill.date}
            </span>
          )}
        </div>
        <div className="text-xs text-slate-500 mt-0.5">
          {totalCases} cases · {itemCount} {itemCount === 1 ? 'item' : 'items'}
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0 pt-1 sm:pt-0 border-t border-slate-100 sm:border-0">
        <div className="text-left sm:text-right">
          <div className="text-xs sm:text-sm font-bold text-slate-900 font-mono">
            ₹{money(bill.total)}
          </div>
          <div className="text-xs">
            {isPaid ? (
              <span className="text-emerald-600 font-bold">Paid</span>
            ) : (
              <span className="text-red-600 font-bold">Due: ₹{money(due)}</span>
            )}
          </div>
        </div>

        {/* Actions: Edit, Share, Delete */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onEditBill(bill)}
            disabled={(bill.returns || []).length > 0 || Boolean(billEditLockReason(bill, todayISO()))}
            className="hh-history-action inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer disabled:opacity-40"
            title={billEditLockReason(bill, todayISO()) || "Edit this invoice"}
          >
            <Pencil size={12} />
            <span>Edit</span>
          </button>

          <button
            type="button"
            onClick={() => onViewInvoice(bill)}
            className="hh-history-action inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer"
            title="Share or View this invoice"
          >
            <Share2 size={12} />
            <span>Share</span>
          </button>

          <button
            type="button"
            onClick={() => onDeleteBill(bill)}
            className="hh-history-delete p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
            title="Cancel this invoice (its number is kept, a credit note is issued)"
          >
            <Ban size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

interface BillingHistoryGroupedListsProps {
  mode: 'date' | 'customer';
  isPhone: boolean;
  dateGroups: DateGroupItem[];
  customerGroups: CustomerGroupItem[];
  products: Product[];
  billingSettings: BillingSettings;
  isExpanded: (key: string, isFirst: boolean) => boolean;
  toggleExpand: (key: string) => void;
  onViewInvoice: (bill: Bill, defaultFormat?: 'gst' | 'non_gst') => void;
  onEditBill: (bill: Bill) => void;
  onDeleteBill: (bill: Bill) => void;
}

export const BillingHistoryGroupedLists: React.FC<BillingHistoryGroupedListsProps> = ({
  mode,
  isPhone,
  dateGroups,
  customerGroups,
  products,
  billingSettings,
  isExpanded,
  toggleExpand,
  onViewInvoice,
  onEditBill,
  onDeleteBill,
}) => {
  if (mode === 'date') {
    return (
      <div className={isPhone ? 'hh-history-phone space-y-2.5 hh-tgrid-2' : 'space-y-3'}>
        {dateGroups.map((group, idx) => {
          const expanded = isExpanded(group.key, idx === 0);
          return (
            <div
              key={group.key}
              data-card-tone={group.totalDue > 0 ? 'warning' : 'received'}
              className="rounded-2xl border shadow-xs overflow-hidden"
            >
              {/* Date Card Header: Line 1 Date, Line 2 Total & Due, Line 3 Bills & Items */}
              <button
                type="button"
                onClick={() => toggleExpand(group.key)}
                className="w-full p-3.5 sm:px-4 sm:py-3.5 text-left transition-colors cursor-pointer select-none border-b border-black/5 space-y-1.5"
              >
                {/* Line 1: Date & Chevron */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`hh-icon-badge hh-icon-badge--sm ${
                        group.totalDue > 0 ? 'hh-icon-badge--amber' : 'hh-icon-badge--green'
                      }`}
                    >
                      <Calendar size={15} />
                    </span>
                    <span className="font-bold text-sm sm:text-base text-slate-900">{group.label}</span>
                  </div>
                  {expanded ? (
                    <ChevronUp size={16} className="text-slate-500 shrink-0" />
                  ) : (
                    <ChevronDown size={16} className="text-slate-500 shrink-0" />
                  )}
                </div>

                {/* Line 2: Total & Due (below Date, before Bills & Items) */}
                <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap text-xs sm:text-sm font-bold">
                  <span className="text-slate-900 font-mono tabular-nums">
                    Total: ₹{money(group.totalBilled)}
                  </span>
                  {group.totalDue > 0 ? (
                    <span className="text-rose-700 bg-white/85 border border-rose-200 px-2 py-0.5 rounded-full text-xs font-bold tabular-nums">
                      Due: ₹{money(group.totalDue)}
                    </span>
                  ) : (
                    <span className="text-emerald-700 bg-white/85 border border-emerald-200 px-2 py-0.5 rounded-full text-xs font-bold">
                      Paid
                    </span>
                  )}
                </div>

                {/* Line 3: Bills and Items Count */}
                <div className="flex items-center gap-2 pt-0.5">
                  <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-white/75 text-slate-700 border border-black/5">
                    {group.bills.length} {group.bills.length === 1 ? 'bill' : 'bills'}
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-white/75 text-slate-600 border border-black/5">
                    {group.totalItems} {group.totalItems === 1 ? 'item' : 'items'}
                  </span>
                </div>
              </button>

              {/* Expanded Invoices List */}
              {expanded && (
                <div className="bg-white/85 divide-y divide-black/5">
                  {group.bills.map((bill) => (
                    <GroupedBillRow
                      key={bill.id}
                      bill={bill}
                      products={products}
                      billingSettings={billingSettings}
                      showRetailerLabel={true}
                      onViewInvoice={onViewInvoice}
                      onEditBill={onEditBill}
                      onDeleteBill={onDeleteBill}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={isPhone ? 'hh-history-phone space-y-2.5 hh-tgrid-2' : 'space-y-3'}>
      {customerGroups.map((group, idx) => {
        const expanded = isExpanded(group.key, idx === 0);
        return (
          <div
            key={group.key}
            data-card-tone={group.totalDue > 0 ? 'due' : 'received'}
            className="rounded-2xl border shadow-xs overflow-hidden"
          >
            {/* Customer Card Header: Line 1 Name, Line 2 Total & Due, Line 3 Invoices */}
            <button
              type="button"
              onClick={() => toggleExpand(group.key)}
              className="w-full p-3.5 sm:px-4 sm:py-3.5 text-left transition-colors cursor-pointer select-none border-b border-black/5 space-y-1.5"
            >
              {/* Line 1: Customer Name & Chevron */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`hh-avatar hh-avatar--sm ${
                      group.totalDue > 0 ? 'hh-avatar--rose' : 'hh-avatar--green'
                    }`}
                  >
                    {getInitials(group.name, 'C')}
                  </span>
                  <span className="font-bold text-sm sm:text-base text-slate-900 break-words">
                    {group.name}
                  </span>
                </div>
                {expanded ? (
                  <ChevronUp size={16} className="text-slate-500 shrink-0" />
                ) : (
                  <ChevronDown size={16} className="text-slate-500 shrink-0" />
                )}
              </div>

              {/* Line 2: Total & Due (below Name, before Invoices count) */}
              <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap text-xs sm:text-sm font-bold">
                <span className="text-slate-900 font-mono tabular-nums">
                  Total: ₹{money(group.totalBilled)}
                </span>
                {group.totalDue > 0 ? (
                  <span className="text-rose-700 bg-white/85 border border-rose-200 px-2 py-0.5 rounded-full text-xs font-bold tabular-nums">
                    Due: ₹{money(group.totalDue)}
                  </span>
                ) : (
                  <span className="text-emerald-700 bg-white/85 border border-emerald-200 px-2 py-0.5 rounded-full text-xs font-bold">
                    Paid
                  </span>
                )}
              </div>

              {/* Line 3: Invoices Count */}
              <div className="flex items-center gap-2 pt-0.5">
                <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-white/75 text-slate-700 border border-black/5">
                  {group.bills.length} {group.bills.length === 1 ? 'invoice' : 'invoices'}
                </span>
              </div>
            </button>

            {/* Expanded Invoices List */}
            {expanded && (
              <div className="bg-white/85 divide-y divide-black/5">
                {group.bills.map((bill) => (
                  <GroupedBillRow
                    key={bill.id}
                    bill={bill}
                    products={products}
                    billingSettings={billingSettings}
                    showRetailerLabel={false}
                    onViewInvoice={onViewInvoice}
                    onEditBill={onEditBill}
                    onDeleteBill={onDeleteBill}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
