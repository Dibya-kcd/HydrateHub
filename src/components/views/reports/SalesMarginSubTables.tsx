import React from 'react';
import { Calculator, Calendar, Package } from 'lucide-react';
import { money } from '../../../utils/billing';
import type {
  CustomerMarginRow,
  DayMarginRow,
  ProductMarginRow,
  ProfitViewBasis,
} from './useSalesMarginPnl';

export const marginBg = (pct: number) =>
  pct >= 25
    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
    : pct >= 12
      ? 'bg-sky-50 border-sky-200 text-sky-800'
      : pct >= 0
        ? 'bg-amber-50 border-amber-200 text-amber-900'
        : 'bg-rose-50 border-rose-200 text-rose-800';

export const statusPill = (pct: number) => {
  if (pct < 0) return { label: 'Loss', cls: 'bg-[var(--due-bg)] text-[var(--due)]' };
  if (pct < 6) return { label: 'Low', cls: 'bg-[var(--soon-bg)] text-[var(--soon)]' };
  return { label: 'Good', cls: 'bg-[var(--paid-bg)] text-[var(--paid)]' };
};

export const initialsOf = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'P';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

export const fmtShortDate = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

export const ProductMarginSection: React.FC<{
  productRows: ProductMarginRow[];
  viewBasis: ProfitViewBasis;
  costIncludesGst: boolean;
  onInspectProduct: (row: ProductMarginRow) => void;
}> = ({ productRows, viewBasis, costIncludesGst, onInspectProduct }) => (
  <div className="space-y-2">
    {/* Table Description Note (desktop) */}
    <div className="hidden md:flex items-center justify-between flex-wrap gap-2 text-xs text-slate-500 px-1">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-slate-700">
          {productRows.length} Product SKUs Sold
        </span>
        <span>·</span>
        <span>
          <strong>Method 2 Selling Price</strong> = Dividing by Billed Cases only
        </span>
        <span>·</span>
        <span className="text-emerald-700 font-semibold">
          Ex-GST True Operating Profit is primary
        </span>
      </div>
      <span className="text-xs text-slate-400">
        Click any row or &ldquo;Inspect&rdquo; to view custom rates &amp; profit formula
      </span>
    </div>

    <div className="md:hidden" id="margin-product-cards">
      {productRows.length === 0 ? (
        <div className="rt-rep-card px-4 py-10 text-center text-[13px] font-semibold text-[var(--text-2)]">
          No product sales matching this period or filter.
        </div>
      ) : (
        <section className="rt-rep-card divide-y divide-[var(--divider)] overflow-hidden">
          {productRows.map((r) => {
            const pill = statusPill(r.operatingMarginPct);
            const neg = r.operatingProfit < 0;
            return (
              <button
                key={r.productId}
                type="button"
                onClick={() => onInspectProduct(r)}
                className="w-full px-3.5 py-3 flex items-center gap-3 text-left active:bg-[#f8fafc] transition-colors cursor-pointer"
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    neg
                      ? 'bg-[var(--due-bg)] text-[var(--due)]'
                      : r.operatingMarginPct < 6
                        ? 'bg-[var(--soon-bg)] text-[var(--soon)]'
                        : 'bg-[#eaf3fd] text-[var(--primary)]'
                  }`}
                >
                  <Package size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-bold text-[var(--text)] leading-snug truncate">
                    {r.productName}
                  </div>
                  <div className="text-xs text-[var(--text-2)] mt-0.5 truncate">
                    {neg
                      ? 'Sold below cost'
                      : `Margin ${r.operatingMarginPct.toFixed(1)}%${r.freeCases > 0 ? ` · +${r.freeCases} free` : ''}`}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-[13.5px] font-extrabold tabular-nums ${neg ? 'text-[var(--due)]' : 'text-[var(--text)]'}`}>
                    {neg ? `−₹${money(Math.abs(r.operatingProfit))}` : `₹${money(r.operatingProfit)}`}
                  </div>
                  <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-xs font-bold ${pill.cls}`}>
                    {pill.label}
                  </span>
                </div>
              </button>
            );
          })}
        </section>
      )}
    </div>
    <div className="hidden md:block overflow-x-auto overscroll-x-contain rounded-2xl border border-black/10 bg-white">
      <table className="w-full text-left data-table min-w-[980px] text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-[#faf8f5] text-xs sm:text-xs font-bold uppercase tracking-wider text-slate-500">
            <th className="px-3 py-2.5">Product SKU</th>
            <th className="px-2 py-2.5 text-right">Billed cs</th>
            <th className="px-2 py-2.5 text-right">Free cs</th>
            <th className="px-2 py-2.5 text-right">Total cs</th>
            <th className="px-2 py-2.5 text-right">Inward Cost</th>
            <th className="px-3 py-2.5 text-right font-black text-sky-900">
              Avg Sell (Method 2)
            </th>
            <th className="px-3 py-2.5 text-right">Taxable (Ex-GST)</th>
            <th className="px-3 py-2.5 text-right font-semibold text-slate-700">
              GST (Output)
            </th>
            <th className="px-3 py-2.5 text-right">Billed Net</th>
            <th className="px-2 py-2.5 text-right">COGS</th>
            <th className="px-3 py-2.5 text-right font-black text-emerald-800">
              Operating Profit
            </th>
            <th className="px-2 py-2.5 text-right">Margin %</th>
            <th className="px-2 py-2.5 text-center no-print">Inspect</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {productRows.length === 0 ? (
            <tr>
              <td colSpan={13} className="text-center py-10 text-slate-500 text-sm">
                No product sales matching this period or filter.
              </td>
            </tr>
          ) : (
            productRows.map((r) => (
              <tr
                key={r.productId}
                onClick={() => onInspectProduct(r)}
                className="hover:bg-sky-50/50 transition-colors cursor-pointer"
              >
                <td className="px-3 py-2.5">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span>{r.productName}</span>
                    {r.freeCases > 0 && (
                      <span className="px-1.5 py-0.2 rounded text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        Scheme
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">
                    {r.category}
                  </div>
                </td>
                <td className="px-2 py-2.5 text-right font-mono font-bold tabular-nums text-slate-900">
                  {r.casesSold}
                </td>
                <td className="px-2 py-2.5 text-right font-mono tabular-nums text-amber-700">
                  {r.freeCases > 0 ? `+${r.freeCases}` : '—'}
                </td>
                <td className="px-2 py-2.5 text-right font-mono font-bold tabular-nums text-slate-700">
                  {r.totalDispatched}
                </td>
                <td className="px-2 py-2.5 text-right font-mono tabular-nums text-slate-600">
                  <div className="font-bold text-slate-900">₹{money(r.costPerCase)}</div>
                  <div className="text-xs text-slate-400 font-normal">
                    {viewBasis === 'exGst' ? (
                      <span title="Original Inward Bill Landed Rate (Inclusive of GST + Landing Cost)">
                        Landed: ₹{money(r.landedCostPerCase)}
                      </span>
                    ) : (
                      <span title={costIncludesGst ? 'Inward purchase cost including the GST paid (no input credit under composition)' : 'Pre-tax Inward Purchase Rate (Ex-GST)'}>
                        {costIncludesGst ? 'Cost incl. GST' : 'Ex-GST'}: ₹{money(r.exGstCostPerCase)}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <div className="font-mono font-black tabular-nums text-sky-950">
                    ₹{money(r.avgBilledSellRate)}
                  </div>
                  <div className="text-xs text-slate-400 font-mono">
                    Ex-GST: ₹{money(r.avgTaxableSellRate)}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right font-mono font-bold tabular-nums text-slate-800">
                  ₹{money(r.taxableSales)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-500">
                  ₹{money(r.gstAmount)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono font-semibold tabular-nums text-sky-900">
                  ₹{money(r.netSales)}
                </td>
                <td className="px-2 py-2.5 text-right font-mono tabular-nums text-amber-800">
                  ₹{money(r.cogs)}
                </td>
                <td
                  className={`px-3 py-2.5 text-right font-mono font-black tabular-nums ${
                    r.operatingProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  <div>₹{money(r.operatingProfit)}</div>
                  <div className="text-xs font-normal text-emerald-800">
                    +₹{money(r.profitPerCase)} / cs
                  </div>
                </td>
                <td className="px-2 py-2.5 text-right">
                  <span
                    className={`inline-flex text-xs font-black px-2 py-0.5 rounded-md border ${marginBg(
                      r.operatingMarginPct
                    )}`}
                  >
                    {r.operatingMarginPct.toFixed(1)}%
                  </span>
                </td>
                <td className="px-2 py-2.5 text-center no-print" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => onInspectProduct(r)}
                    className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-sky-100 text-slate-700 hover:text-sky-800 text-xs font-bold flex items-center gap-1 mx-auto transition-colors cursor-pointer"
                    title="Inspect custom rates, selling price and profit calculation"
                  >
                    <Calculator className="w-3.5 h-3.5" />
                    <span>Guide</span>
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>
);

export const CustomerMarginSection: React.FC<{ customerRows: CustomerMarginRow[] }> = ({
  customerRows,
}) => (
  <div className="space-y-2">
    <div className="hidden md:block overflow-x-auto overscroll-x-contain rounded-2xl border border-black/10 bg-white">
      <table className="w-full text-left data-table min-w-[760px] text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-[#faf8f5] text-xs sm:text-xs font-bold uppercase tracking-wider text-slate-500">
            <th className="px-3 py-2.5">Customer Party</th>
            <th className="px-3 py-2.5 text-right">Invoices</th>
            <th className="px-3 py-2.5 text-right">Cases Sold</th>
            <th className="px-3 py-2.5 text-right">You got</th>
            <th className="px-3 py-2.5 text-right">GST</th>
            <th className="px-3 py-2.5 text-right">Billed Net</th>
            <th className="px-3 py-2.5 text-right">You spent</th>
            <th className="px-3 py-2.5 text-right font-black">Profit</th>
            <th className="px-3 py-2.5 text-right">Margin %</th>
            <th className="px-3 py-2.5 text-right">Balance Due</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {customerRows.length === 0 ? (
            <tr>
              <td colSpan={10} className="text-center py-10 text-slate-500 text-sm">
                No customer sales matching this period.
              </td>
            </tr>
          ) : (
            customerRows.map((r) => (
              <tr key={r.customerKey} className="hover:bg-slate-50/60 transition-colors">
                <td className="px-3 py-2.5 font-bold text-slate-900">
                  {r.customerName}
                </td>
                <td className="px-3 py-2.5 text-right font-mono">{r.invoices}</td>
                <td className="px-3 py-2.5 text-right font-mono font-bold">{r.casesSold}</td>
                <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-700">
                  ₹{money(r.taxableSales)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-500">
                  ₹{money(r.gstAmount)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono font-bold text-sky-800">
                  ₹{money(r.netSales)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-amber-800">
                  ₹{money(r.cogs)}
                </td>
                <td
                  className={`px-3 py-2.5 text-right font-mono font-black ${
                    r.grossProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  ₹{money(r.grossProfit)}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className={`inline-flex text-xs font-black px-2 py-0.5 rounded-md border ${marginBg(r.marginPct)}`}>
                    {r.marginPct.toFixed(1)}%
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right font-mono font-bold text-rose-700">
                  {r.outstanding > 0 ? `₹${money(r.outstanding)}` : '—'}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>

    {/* Mobile cards */}
    <div className="block md:hidden" id="margin-customer-cards">
      {customerRows.length === 0 ? (
        <div className="rt-rep-card px-4 py-10 text-center text-[13px] font-semibold text-[var(--text-2)]">
          No customer sales matching this period.
        </div>
      ) : (
        <section className="rt-rep-card divide-y divide-[var(--divider)] overflow-hidden">
          {customerRows.map((r) => {
            const pill = statusPill(r.marginPct);
            const neg = r.grossProfit < 0;
            return (
              <div key={r.customerKey} className="px-3.5 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#eaf3fd] text-[var(--primary)] text-[12px] font-extrabold flex items-center justify-center shrink-0">
                  {initialsOf(r.customerName)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-bold text-[var(--text)] leading-snug truncate">
                    {r.customerName}
                  </div>
                  <div className="text-xs text-[var(--text-2)] mt-0.5 truncate">
                    {r.invoices} {r.invoices === 1 ? 'bill' : 'bills'} · Margin {r.marginPct.toFixed(1)}%
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-[13.5px] font-extrabold tabular-nums ${neg ? 'text-[var(--due)]' : 'text-[var(--text)]'}`}>
                    {neg ? `−₹${money(Math.abs(r.grossProfit))}` : `₹${money(r.grossProfit)}`}
                  </div>
                  <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-xs font-bold ${pill.cls}`}>
                    {pill.label}
                  </span>
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  </div>
);

export const DayMarginSection: React.FC<{ dayRows: DayMarginRow[] }> = ({ dayRows }) => (
  <div className="space-y-2">
    <div className="hidden md:block overflow-x-auto overscroll-x-contain rounded-2xl border border-black/10 bg-white">
      <table className="w-full text-left data-table min-w-[650px] text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-[#faf8f5] text-xs sm:text-xs font-bold uppercase tracking-wider text-slate-500">
            <th className="px-3 py-2.5">Date</th>
            <th className="px-3 py-2.5 text-right">Invoices</th>
            <th className="px-3 py-2.5 text-right">You got</th>
            <th className="px-3 py-2.5 text-right">GST</th>
            <th className="px-3 py-2.5 text-right">Billed Net</th>
            <th className="px-3 py-2.5 text-right">You spent</th>
            <th className="px-3 py-2.5 text-right font-black">Profit</th>
            <th className="px-3 py-2.5 text-right">Margin %</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {dayRows.length === 0 ? (
            <tr>
              <td colSpan={8} className="text-center py-10 text-slate-500 text-sm">
                No sales days recorded in this period.
              </td>
            </tr>
          ) : (
            dayRows.map((r) => (
              <tr key={r.date} className="hover:bg-slate-50/60 transition-colors">
                <td className="px-3 py-2.5 font-mono font-bold text-slate-800 whitespace-nowrap">
                  {r.date}
                </td>
                <td className="px-3 py-2.5 text-right font-mono">{r.invoices}</td>
                <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-700">
                  ₹{money(r.taxableSales)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-500">
                  ₹{money(r.gstAmount)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono font-bold text-sky-800">
                  ₹{money(r.netSales)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-amber-800">
                  ₹{money(r.cogs)}
                </td>
                <td
                  className={`px-3 py-2.5 text-right font-mono font-black ${
                    r.grossProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  ₹{money(r.grossProfit)}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className={`inline-flex text-xs font-black px-2 py-0.5 rounded-md border ${marginBg(r.marginPct)}`}>
                    {r.marginPct.toFixed(1)}%
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>

    {/* Mobile cards */}
    <div className="block md:hidden" id="margin-day-cards">
      {dayRows.length === 0 ? (
        <div className="rt-rep-card px-4 py-10 text-center text-[13px] font-semibold text-[var(--text-2)]">
          No sales days recorded in this period.
        </div>
      ) : (
        <section className="rt-rep-card divide-y divide-[var(--divider)] overflow-hidden">
          {dayRows.map((r) => {
            const pill = statusPill(r.marginPct);
            const neg = r.grossProfit < 0;
            return (
              <div key={r.date} className="px-3.5 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#f1f5f9] text-[var(--text-2)] flex items-center justify-center shrink-0">
                  <Calendar size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-bold text-[var(--text)] leading-snug">
                    {fmtShortDate(r.date)}
                  </div>
                  <div className="text-xs text-[var(--text-2)] mt-0.5">
                    {r.invoices} {r.invoices === 1 ? 'bill' : 'bills'} · Margin {r.marginPct.toFixed(1)}%
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-[13.5px] font-extrabold tabular-nums ${neg ? 'text-[var(--due)]' : 'text-[var(--text)]'}`}>
                    {neg ? `−₹${money(Math.abs(r.grossProfit))}` : `₹${money(r.grossProfit)}`}
                  </div>
                  <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-xs font-bold ${pill.cls}`}>
                    {pill.label}
                  </span>
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  </div>
);
