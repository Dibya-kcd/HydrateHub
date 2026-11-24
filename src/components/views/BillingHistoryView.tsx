import { billEditLockReason } from '../../utils/billEditLock';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Ban, Pencil, Share2 } from 'lucide-react';
import { Bill } from '../../types';
import { money } from '../../utils/billing';
import { useLedger } from '../../context/LedgerContext';
import { billBalance } from '../../utils/salesReturns';
import { findDuplicateBillNumbers, formatBillNumber, isGstExcludedBill } from '../../utils/invoiceCommon';
import { useBeats } from '../../hooks/useBeats';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useLanguage } from '../../i18n/LanguageContext';
import { todayISO } from '../../utils/dateLocal';
import { makeBeatResolver } from '../../utils/beatReports';
import { normBeat } from '../../utils/beats';
import {
  BillingHistoryToolbar,
  type HistoryGrouping,
  type PaymentFilter,
} from './billing/BillingHistoryToolbar';
import {
  BillingHistoryGroupedLists,
  type CustomerGroupItem,
  type DateGroupItem,
} from './billing/BillingHistoryGroupedLists';

interface BillingHistoryViewProps {
  onViewInvoice: (bill: Bill, defaultFormat?: 'gst' | 'non_gst') => void;
  onEditBill: (bill: Bill) => void;
  onDeleteBill: (bill: Bill) => void;
  onCancelBill: (bill: Bill) => void;
  onNewInvoiceClick?: () => void;
}

export const BillingHistoryView: React.FC<BillingHistoryViewProps> = ({
  onViewInvoice,
  onEditBill,
  onDeleteBill,
  onCancelBill: _onCancelBill,
  onNewInvoiceClick,
}) => {
  const {
    bills,
    products,
    salesmen,
    billingSettings,
    customers,
    reassignBillDocNumber,
  } = useLedger();

  const duplicateCheck = useMemo(
    () => findDuplicateBillNumbers(bills, billingSettings, products),
    [bills, billingSettings, products],
  );

  const { beats, activeBeats } = useBeats();
  const isPhone = useIsMobile(1023);
  const { t } = useLanguage();

  const [grouping, setGrouping] = useState<HistoryGrouping>('table');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [dateWindow, setDateWindow] = useState<'all' | 'today' | '7d'>('all');
  const [salesmanFilter] = useState<string>('');
  const [beatFilter, setBeatFilter] = useState<string>('all');
  const [beatMenuOpen, setBeatMenuOpen] = useState(false);
  const beatMenuRef = useRef<HTMLDivElement | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!beatMenuOpen) return;
    const onDocDown = (e: MouseEvent | TouchEvent) => {
      if (beatMenuRef.current && !beatMenuRef.current.contains(e.target as Node)) {
        setBeatMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('touchstart', onDocDown);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('touchstart', onDocDown);
    };
  }, [beatMenuOpen]);

  const beatResolver = useMemo(() => makeBeatResolver(customers || [], beats), [customers, beats]);

  const selectedBeatId = useMemo(() => {
    if (beatFilter === 'all') return 'all';
    const normSel = normBeat(beatFilter);
    return beats.find((x) => x.id === beatFilter || normBeat(x.name) === normSel)?.id || '';
  }, [beatFilter, beats]);

  const billMatchesBeat = (b: Bill, filterVal: string) => {
    if (filterVal === 'all') return true;
    if (!selectedBeatId) return false;
    return beatResolver.beatIdFor(b.retailer, b.phone, b.customerId) === selectedBeatId;
  };

  const todayStr = todayISO();
  const sevenDaysCutoff = useMemo(() => {
    const d = new Date(`${todayStr}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 6);
    return d.toISOString().slice(0, 10);
  }, [todayStr]);

  // Filter bills based on search, payment status, salesman, beat, and (on phone) date window
  const filteredBills = useMemo(() => {
    return bills.filter((b) => {
      if (isPhone && dateWindow !== 'all') {
        const bDate = String(b.date || '').slice(0, 10);
        if (dateWindow === 'today' && bDate !== todayStr) return false;
        if (dateWindow === '7d' && (!bDate || bDate < sevenDaysCutoff)) return false;
      }
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        b.retailer.toLowerCase().includes(q) ||
        (b.phone && b.phone.includes(q)) ||
        String(b.id).includes(q) ||
        (b.docNo || '').toLowerCase().includes(q) ||
        formatBillNumber(b, billingSettings).toLowerCase().includes(q) ||
        b.date.includes(q) ||
        b.items.some((i) => i.productName.toLowerCase().includes(q));

      const due = billBalance(b);
      let matchesPayment = true;
      if (paymentFilter === 'pending') matchesPayment = due > 0;
      if (paymentFilter === 'paid') matchesPayment = due === 0;

      let matchesSalesman = true;
      if (salesmanFilter) {
        matchesSalesman =
          b.salesmanId === salesmanFilter ||
          b.salesman === salesmanFilter ||
          salesmen.find((s) => s.id === salesmanFilter)?.name === b.salesman;
      }

      const matchesBeat = billMatchesBeat(b, beatFilter);

      return matchesSearch && matchesPayment && matchesSalesman && matchesBeat;
    });
  }, [bills, salesmen, beatResolver, selectedBeatId, billingSettings, searchQuery, paymentFilter, salesmanFilter, beatFilter, isPhone, dateWindow, todayStr, sevenDaysCutoff]);

  // Overall statistics (respecting beat filter if active)
  const stats = useMemo(() => {
    const relevantBills = beatFilter === 'all' ? bills : bills.filter((b) => billMatchesBeat(b, beatFilter));

    const totalCount = relevantBills.length;
    const totalBilled = relevantBills.reduce((sum, b) => sum + b.total, 0);
    const totalPaid = relevantBills.reduce((sum, b) => sum + b.amountPaid, 0);
    const totalDue = Math.max(0, totalBilled - totalPaid);
    const pendingCount = relevantBills.filter((b) => billBalance(b) > 0).length;
    const paidCount = relevantBills.filter((b) => billBalance(b) <= 0).length;
    return { totalCount, totalBilled, totalPaid, totalDue, pendingCount, paidCount };
  }, [bills, beatResolver, selectedBeatId, beatFilter]);

  // Status breakdown counts (respecting search, salesman, and beat filters)
  const statusCounts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const base = bills.filter((b) => {
      const matchesSearch =
        !q ||
        b.retailer.toLowerCase().includes(q) ||
        (b.phone && b.phone.includes(q)) ||
        String(b.id).includes(q) ||
        b.date.includes(q) ||
        b.items.some((i) => i.productName.toLowerCase().includes(q));

      let matchesSalesman = true;
      if (salesmanFilter) {
        matchesSalesman =
          b.salesmanId === salesmanFilter ||
          b.salesman === salesmanFilter ||
          salesmen.find((s) => s.id === salesmanFilter)?.name === b.salesman;
      }

      const matchesBeat = billMatchesBeat(b, beatFilter);

      return matchesSearch && matchesSalesman && matchesBeat;
    });

    const all = base.length;
    const pending = base.filter((b) => billBalance(b) > 0).length;
    const paid = base.filter((b) => billBalance(b) <= 0).length;
    return { all, pending, paid };
  }, [bills, salesmen, beatResolver, selectedBeatId, searchQuery, salesmanFilter, beatFilter]);

  // Group by Date (Latest date on top)
  const dateGroups: DateGroupItem[] = useMemo(() => {
    const map = new Map<string, Bill[]>();
    for (const b of filteredBills) {
      const dateKey = b.date || 'Unspecified Date';
      const arr = map.get(dateKey) || [];
      arr.push(b);
      map.set(dateKey, arr);
    }

    const sortedDates = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));

    return sortedDates.map((date) => {
      const groupBills = (map.get(date) || []).sort((a, b) => b.id - a.id);
      const totalBilled = groupBills.reduce((s, b) => s + b.total, 0);
      const totalPaid = groupBills.reduce((s, b) => s + b.amountPaid, 0);
      const totalDue = Math.max(0, totalBilled - totalPaid);
      const totalItems = groupBills.reduce(
        (sum, b) => sum + (b.items || []).reduce((s, i) => s + (Number(i.qty) || 0), 0),
        0
      );
      return {
        key: `date-${date}`,
        label: date,
        bills: groupBills,
        totalItems,
        totalBilled,
        totalPaid,
        totalDue,
      };
    });
  }, [filteredBills]);

  // Group by Customer (Latest activity on top)
  const customerGroups: CustomerGroupItem[] = useMemo(() => {
    const map = new Map<string, { name: string; bills: Bill[] }>();
    for (const b of filteredBills) {
      const norm = (b.retailer || 'Unknown Party').trim();
      const key = norm.toLowerCase();
      const existing = map.get(key);
      if (!existing) {
        map.set(key, { name: norm, bills: [b] });
      } else {
        existing.bills.push(b);
      }
    }

    const groups = Array.from(map.entries()).map(([key, data]) => {
      const sortedBills = data.bills.sort((a, b) => {
        if (b.date !== a.date) return b.date.localeCompare(a.date);
        return b.id - a.id;
      });
      const latestDate = sortedBills[0]?.date || '';
      const totalBilled = sortedBills.reduce((s, b) => s + b.total, 0);
      const totalPaid = sortedBills.reduce((s, b) => s + b.amountPaid, 0);
      const totalDue = Math.max(0, totalBilled - totalPaid);
      const totalItems = sortedBills.reduce(
        (sum, b) => sum + (b.items || []).reduce((s, i) => s + (Number(i.qty) || 0), 0),
        0
      );
      return {
        key: `cust-${key}`,
        name: data.name,
        latestDate,
        bills: sortedBills,
        totalItems,
        totalBilled,
        totalPaid,
        totalDue,
      };
    });

    return groups.sort((a, b) => b.latestDate.localeCompare(a.latestDate));
  }, [filteredBills]);

  // Toggle expansion for an accordion key
  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => ({
      ...prev,
      [key]: prev[key] === undefined ? false : !prev[key],
    }));
  };

  const isExpanded = (key: string, isFirst: boolean) => {
    if (expandedKeys[key] !== undefined) return expandedKeys[key];
    return isFirst;
  };

  return (
    <div id="view-billing-history" className="hh-view space-y-4">
      <BillingHistoryToolbar
        isPhone={isPhone}
        t={t}
        grouping={grouping}
        setGrouping={setGrouping}
        paymentFilter={paymentFilter}
        setPaymentFilter={setPaymentFilter}
        dateWindow={dateWindow}
        setDateWindow={setDateWindow}
        beatFilter={beatFilter}
        setBeatFilter={setBeatFilter}
        beatMenuOpen={beatMenuOpen}
        setBeatMenuOpen={setBeatMenuOpen}
        beatMenuRef={beatMenuRef}
        activeBeats={activeBeats}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        bills={bills}
        filteredBills={filteredBills}
        stats={stats}
        statusCounts={statusCounts}
        onNewInvoiceClick={onNewInvoiceClick}
      />

      {duplicateCheck.conflictCount > 0 && (
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/90 p-3.5 sm:p-4 space-y-2.5">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="text-sm font-bold text-amber-950">
                Duplicate invoice number detected ({duplicateCheck.groups.length}{' '}
                {duplicateCheck.groups.length === 1 ? 'number' : 'numbers'})
              </div>
              <div className="text-xs text-amber-900 leading-relaxed">
                Two offline devices issued the same invoice number. Both invoices were preserved safely without overwriting either party&apos;s bill. Assign a fresh unique number below so GST returns remain valid.
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            {duplicateCheck.groups.map((grp) => (
              <div
                key={grp.key}
                className="rounded-xl bg-white/85 border border-amber-200 px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="font-bold text-slate-900">
                    #{grp.docNo} · {grp.bills.length} invoice{grp.bills.length === 1 ? '' : 's'}
                  </div>
                  <div className="text-xs text-slate-600">
                    {grp.bills
                      .map((b) => `${b.retailer || 'Cash'} (₹${money(b.total)}, ${b.date}${b.collidedFromId ? ' · synced copy' : ''})`)
                      .join(' vs ')}
                  </div>
                </div>
                {grp.bills.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const pick = grp.bills.find((b) => b.collidedFromId) || grp.bills[grp.bills.length - 1];
                      reassignBillDocNumber(pick.id);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs whitespace-nowrap cursor-pointer transition-colors shrink-0"
                  >
                    Assign unique number
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW MODE 1: Invoices (Clean Table UI with Edit, Share, Delete)
          ========================================================================= */}
      {filteredBills.length > 0 && grouping === 'table' && (
        <>
          {/* Desktop Table View (Guaranteed min-width prevents columns from squeezing) */}
          <div className="hidden lg:block bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-x-auto">
            <table className="w-full min-w-[700px] text-left border-collapse table-auto">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  <th className="py-3.5 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap w-[130px] shrink-0">
                    ITEM
                  </th>
                  <th className="py-3.5 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500 min-w-[200px]">
                    DETAILS
                  </th>
                  <th className="py-3.5 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap w-[120px] shrink-0">
                    VALUE
                  </th>
                  <th className="py-3.5 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap w-[100px] shrink-0">
                    STATUS
                  </th>
                  <th className="py-3.5 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500 text-right whitespace-nowrap w-[170px] shrink-0">
                    ACTIONS
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBills.map((b) => {
                  const due = billBalance(b);
                  const isPaid = due <= 0.01;
                  const itemLabel = formatBillNumber(b, billingSettings);
                  const isNg = isGstExcludedBill(b, products);
                  const isDupNo = duplicateCheck.billIds.has(b.id);
                  const totalCases = (b.items || []).reduce((s, i) => s + (Number(i.qty) || 0), 0);
                  const itemCount = (b.items || []).length;
                  const cust = (customers || []).find(
                    (c) => c.id === b.customerId || c.name.toLowerCase() === b.retailer.toLowerCase()
                  );
                  const custBeat = cust?.route || cust?.city;

                  return (
                    <tr
                      key={b.id}
                      className={`hover:bg-slate-50/80 transition-colors group select-none ${isDupNo ? 'bg-amber-50/60' : ''}`}
                    >
                      <td className="py-3.5 px-4 text-sm font-semibold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
                          <button
                            type="button"
                            onClick={() => onViewInvoice(b)}
                            className="font-mono text-xs font-bold text-[var(--primary)] hover:underline cursor-pointer whitespace-nowrap shrink-0"
                            title={isNg ? 'Click to view Non-GST cash memo' : 'Click to view invoice'}
                          >
                            #{itemLabel}
                          </button>
                          {isDupNo && (
                            <button
                              type="button"
                              onClick={() => reassignBillDocNumber(b.id)}
                              className="text-xs font-bold px-1.5 py-0.5 rounded border border-amber-400 bg-amber-100 text-amber-900 hover:bg-amber-200 uppercase tracking-wider whitespace-nowrap shrink-0 cursor-pointer"
                              title={b.conflictNote || 'Duplicate invoice number — click to assign a unique number'}
                            >
                              Duplicate No. · Fix
                            </button>
                          )}
                          {isNg && (
                            <span
                              className="text-xs font-bold px-1.5 py-0.5 rounded border border-teal-300 bg-teal-50 text-teal-800 uppercase tracking-wider whitespace-nowrap shrink-0"
                              title="Non-GST Trading Memo (0% Tax · Excluded from GST Returns)"
                            >
                              Non-GST
                            </span>
                          )}
                          {b.customerGstin && !isNg && (
                            <span
                              className="text-xs font-bold px-1.5 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-900 uppercase tracking-wider whitespace-nowrap shrink-0"
                              title={`Registered GSTIN: ${b.customerGstin}`}
                            >
                              B2B
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-sm text-slate-600 font-normal">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900">{b.retailer || 'Cash customer'}</span>
                          {custBeat && (
                            <span className="text-xs font-bold px-1.5 py-0.2 rounded bg-sky-50 text-sky-800 border border-sky-200 whitespace-nowrap shrink-0">
                              {custBeat}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5 whitespace-nowrap">
                          {b.date} · {totalCases} cs · {itemCount} {itemCount === 1 ? 'item' : 'items'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-sm font-bold text-slate-900 font-mono tabular-nums whitespace-nowrap">
                        ₹{money(b.total)}
                      </td>
                      <td className="py-3.5 px-4 text-sm whitespace-nowrap">
                        <span className={`font-semibold text-xs whitespace-nowrap ${isPaid ? 'text-emerald-600' : 'text-red-600'}`}>
                          {isPaid ? 'Paid' : `Due: ₹${money(due)}`}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-sm text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5 whitespace-nowrap shrink-0">
                          <button
                            type="button"
                            onClick={() => onEditBill(b)}
                            disabled={(b.returns || []).length > 0 || Boolean(billEditLockReason(b, todayISO()))}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap shrink-0"
                            title={billEditLockReason(b, todayISO()) || "Edit this invoice"}
                          >
                            <Pencil size={12} className="shrink-0" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onViewInvoice(b)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
                            title="Share or View invoice"
                          >
                            <Share2 size={12} className="shrink-0" />
                            <span>Share</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteBill(b)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                            title="Cancel invoice (its number is kept, a credit note is issued)"
                          >
                            <Ban size={14} className="shrink-0" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile & Tablet Flat Token Cards View (<1024px) */}
          <div className="lg:hidden space-y-2.5 hh-tgrid-2">
            {filteredBills.map((b) => {
              const due = billBalance(b);
              const isPaid = due <= 0.01;
              const isPartial = !isPaid && due < b.total - 0.01 && (b.amountPaid || 0) > 0.01;
              const itemLabel = formatBillNumber(b, billingSettings);
              const isDupNo = duplicateCheck.billIds.has(b.id);
              const totalCases = (b.items || []).reduce((s, i) => s + (Number(i.qty) || 0), 0);
              const retailerName = b.retailer || t('sell.walkInSale');
              const modeLabel =
                b.paymentMode === 'upi'
                  ? t('sell.upi')
                  : b.paymentMode === 'credit'
                    ? t('sell.credit')
                    : t('sell.cash');

              return (
                <div
                  key={b.id}
                  className={`hh-hist-card ${
                    isPaid
                      ? 'hh-hist-card--paid'
                      : isPartial
                        ? 'hh-hist-card--partial'
                        : 'hh-hist-card--due'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onViewInvoice(b)}
                    className="w-full flex items-start justify-between gap-2.5 text-left cursor-pointer min-h-[44px]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-bold text-[var(--text)] break-words leading-snug">
                        #{itemLabel} · {retailerName}
                      </div>
                      <div className="text-xs text-[var(--text-2)] mt-0.5 tabular-nums flex items-center gap-1.5 flex-wrap">
                        <span>{b.date} · {modeLabel}</span>
                        {isDupNo && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-xs">
                            Duplicate No.
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-[14px] font-extrabold text-[var(--text)] tabular-nums shrink-0">
                      ₹{money(b.total)}
                    </div>
                  </button>
                  {isDupNo && (
                    <button
                      type="button"
                      onClick={() => reassignBillDocNumber(b.id)}
                      className="mt-2 w-full py-1.5 px-2.5 rounded-lg bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-950 font-bold text-xs cursor-pointer transition-colors"
                    >
                      Fix duplicate number (#{itemLabel})
                    </button>
                  )}

                  {isPartial ? (
                    <div className="rt-three mt-2.5 pt-2.5">
                      <div className="rt-three__item">
                        <span className="rt-three__label">{t('sell.paid')}</span>
                        <span className="rt-three__val text-[var(--paid)]">
                          ₹{money(b.amountPaid || 0)}
                        </span>
                      </div>
                      <div className="rt-three__item">
                        <span className="rt-three__label">{t('sell.balance')}</span>
                        <span className="rt-three__val rt-three__val--due">
                          ₹{money(due)}
                        </span>
                      </div>
                      <div className="rt-three__item">
                        <span className="rt-three__label">Cases</span>
                        <span className="rt-three__val">{totalCases}</span>
                      </div>
                    </div>
                  ) : isPaid ? (
                    <div className="mt-2">
                      <span className="rt-tag rt-tag--paid">{t('sell.paid')}</span>
                    </div>
                  ) : (
                    <div className="flex gap-1.5 mt-2.5">
                      <button
                        type="button"
                        onClick={() => onViewInvoice(b)}
                        className="rt-btn-outline flex-1 !px-2 text-xs"
                      >
                        {t('sell.view')}
                      </button>
                      <button
                        type="button"
                        onClick={() => onViewInvoice(b)}
                        className="rt-btn-outline flex-1 !px-2 text-xs"
                      >
                        {t('sell.share')}
                      </button>
                      <button
                        type="button"
                        onClick={() => _onCancelBill(b)}
                        className="rt-btn-outline rt-btn-outline--due flex-1 !px-2 text-xs"
                      >
                        {t('sell.cancel')}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {filteredBills.length > 0 && (grouping === 'date' || grouping === 'customer') && (
        <BillingHistoryGroupedLists
          mode={grouping}
          isPhone={isPhone}
          dateGroups={dateGroups}
          customerGroups={customerGroups}
          products={products}
          billingSettings={billingSettings}
          isExpanded={isExpanded}
          toggleExpand={toggleExpand}
          onViewInvoice={onViewInvoice}
          onEditBill={onEditBill}
          onDeleteBill={onDeleteBill}
        />
      )}
    </div>
  );
};
