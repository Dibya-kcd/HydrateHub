import React from 'react';
import type { Bill } from '../../../types';
import { freeStockInvoiceDisplay, money, normalizeTo8DigitHsn } from '../../../utils/billing';
import { billTaxBreakdown } from '../../../utils/gstReports';

interface TaxInvoiceItemsSectionProps {
  bill: Bill;
  isGst: boolean;
  taxBreakdown: ReturnType<typeof billTaxBreakdown> | null;
}

export const TaxInvoiceItemsSection: React.FC<TaxInvoiceItemsSectionProps> = ({
  bill,
  isGst,
  taxBreakdown,
}) => {
  return (
    <>
      {/* Desktop Table (Visible on sm+ and when printing) */}
      <div className="hidden sm:block print:block py-3 sm:py-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[840px] text-left data-table border-collapse border text-xs sm:text-sm">
          <thead>
            <tr className="bg-slate-900 text-white font-bold text-xs uppercase tracking-wider">
              <th className="p-2 border text-center w-8 whitespace-nowrap">#</th>
              <th className="p-2 border min-w-[180px] whitespace-normal">Description of Goods</th>
              {isGst && <th className="p-2 border text-center w-14 whitespace-nowrap">HSN</th>}
              <th className="p-2 border text-center w-16 whitespace-nowrap">Total Crates</th>
              <th className="p-2 border text-center w-16 whitespace-nowrap">Free (Incl.)</th>
              <th className="p-2 border text-right w-18 whitespace-nowrap">Rate (₹)</th>
              <th className="p-2 border text-right w-20 whitespace-nowrap">Gross (₹)</th>
              <th className="p-2 border text-right w-18 whitespace-nowrap">{isGst ? 'Scheme (₹)' : 'Discount (₹)'}</th>
              {isGst && <th className="p-2 border text-center w-14 whitespace-nowrap">GST %</th>}
              {isGst && <th className="p-2 border text-right w-20 whitespace-nowrap">GST (₹)</th>}
              <th className="p-2 border text-right w-22 whitespace-nowrap">{isGst ? 'Total (₹)' : 'Net Total (₹)'}</th>
            </tr>
          </thead>
          <tbody>
            {bill.items.map((it, idx) => {
              const d = freeStockInvoiceDisplay(it);
              return (
                <tr
                  key={it.key || `item_row_${idx}`}
                  className={`border-b hover:bg-slate-50 ${d.isFreeStock ? 'bg-emerald-50/60' : ''}`}
                >
                  <td className="p-2 border text-center text-slate-500 font-mono whitespace-nowrap">{idx + 1}</td>
                  <td className="p-2 border font-semibold text-slate-900 min-w-[180px]">
                    {it.productName}
                    {d.isFreeStock ? (
                      <div className="mt-0.5">
                        <span className="inline-block px-1.5 py-0.5 rounded text-xs font-black uppercase tracking-wide bg-emerald-600 text-white">
                          Free stock · 100% discount
                        </span>
                        {d.schemeNote && (
                          <div className="text-xs font-bold text-emerald-800 mt-0.5">{d.schemeNote}</div>
                        )}
                      </div>
                    ) : it.freeQty > 0 ? (
                      <div className="mt-0.5">
                        <span className="inline-block px-1.5 py-0.5 rounded text-xs font-black uppercase tracking-wide bg-emerald-700 text-white">
                          Includes {it.freeQty} free of {it.qty} crates ({it.chargeableQty} billed + {it.freeQty} free)
                        </span>
                      </div>
                    ) : it.promoLabel && it.discount > 0 ? (
                      <div className="text-xs font-semibold text-amber-700 mt-0.5">
                        ★ {it.promoLabel} (scheme discount)
                      </div>
                    ) : null}
                  </td>
                  {isGst && (
                    <td className="p-2 border text-center text-slate-600 font-mono font-semibold whitespace-nowrap">
                      {it.taxability === 'non_gst'
                        ? (it.hsn || 'Non-GST')
                        : normalizeTo8DigitHsn(it.hsn || taxBreakdown?.lines[idx]?.hsn, it.category, it.productName, it.taxability)}
                    </td>
                  )}
                  <td className="p-2 border text-center font-bold text-slate-900 font-mono whitespace-nowrap">{it.qty}</td>
                  <td className="p-2 border text-center font-mono font-bold text-emerald-800 whitespace-nowrap">
                    {d.isFreeStock ? d.freeLabel : it.freeQty > 0 ? `${it.freeQty} incl.` : '—'}
                  </td>
                  <td className="p-2 border text-right font-mono whitespace-nowrap">₹{money(d.rate)}</td>
                  <td className="p-2 border text-right font-mono whitespace-nowrap">₹{money(d.gross)}</td>
                  <td className="p-2 border text-right font-mono text-amber-800 font-bold whitespace-nowrap">
                    {d.isFreeStock
                      ? `100% (−₹${money(d.discount)})`
                      : d.discount > 0
                        ? `−₹${money(d.discount)}`
                        : '—'}
                  </td>
                  {isGst && (
                    <td className="p-2 border text-center font-mono text-slate-600 whitespace-nowrap">
                      {it.taxability === 'non_gst'
                        ? 'Non-GST'
                        : !d.isFreeStock && (taxBreakdown?.lines[idx]?.ratePct || 0) > 0
                          ? `${taxBreakdown!.lines[idx].ratePct}%`
                          : '—'}
                    </td>
                  )}
                  {isGst && (
                    <td className="p-2 border text-right font-mono text-slate-700 whitespace-nowrap">
                      {it.taxability !== 'non_gst' && !d.isFreeStock && (taxBreakdown?.lines[idx]?.tax || 0) > 0
                        ? `₹${money(taxBreakdown!.lines[idx].tax)}`
                        : '—'}
                    </td>
                  )}
                  <td className={`p-2 border text-right font-bold font-mono whitespace-nowrap ${d.isFreeStock ? 'text-emerald-700' : 'text-slate-900'}`}>
                    {d.isFreeStock ? '₹0.00 FREE' : `₹${money(d.amount)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-xs sm:text-sm">
              <td colSpan={isGst ? 3 : 2} className="p-2 border text-right font-black text-slate-800 uppercase tracking-wide whitespace-nowrap">
                Total Crates Delivered:
              </td>
              <td className="p-2 border text-center font-mono font-black text-slate-900 bg-emerald-50 whitespace-nowrap">
                {bill.items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0)} cs
              </td>
              <td className="p-2 border text-center font-mono font-bold text-emerald-800 bg-emerald-50/70 whitespace-nowrap">
                {(() => {
                  const freeSum = bill.items.reduce((sum, it) => sum + (Number(it.freeQty) || 0), 0);
                  return freeSum > 0 ? `${freeSum} incl.` : '—';
                })()}
              </td>
              <td colSpan={isGst ? 5 : 2} className="p-2 border"></td>
              <td className="p-2 border text-right font-mono font-black text-slate-900 whitespace-nowrap">
                ₹{money(bill.total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Mobile-Fitted Items View (Visible on mobile screens, hidden in print & desktop) */}
      <div className="block sm:hidden print:hidden py-3 space-y-2">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 pb-1 border-b">
          Items ({bill.items.length}) · Total {bill.items.reduce((s, i) => s + (Number(i.qty) || 0), 0)} Crates
        </div>

        {bill.items.map((it, idx) => {
          const d = freeStockInvoiceDisplay(it);
          const lineTax = taxBreakdown?.lines[idx];
          return (
            <div
              key={it.key || `m_item_${idx}`}
              className={`p-2.5 rounded-xl border text-xs space-y-1.5 ${
                d.isFreeStock ? 'bg-emerald-50/70 border-emerald-200' : 'bg-slate-50/80 border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <span className="font-bold text-slate-900 block leading-tight">
                    {idx + 1}. {it.productName}
                  </span>
                  {d.isFreeStock ? (
                    <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-xs font-black bg-emerald-600 text-white uppercase">
                      Free Stock (100% off)
                    </span>
                  ) : it.freeQty > 0 ? (
                    <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-xs font-bold bg-emerald-100 text-emerald-800">
                      {it.freeQty} free of {it.qty} cs ({it.chargeableQty} paid)
                    </span>
                  ) : it.promoLabel && it.discount > 0 ? (
                    <span className="text-xs font-semibold text-amber-700 block">
                      ★ {it.promoLabel}
                    </span>
                  ) : null}
                </div>

                <div className="text-right shrink-0">
                  <span className="font-mono font-black text-xs text-slate-900 block">
                    {d.isFreeStock ? '₹0.00 FREE' : `₹${money(d.amount)}`}
                  </span>
                  {d.discount > 0 && !d.isFreeStock && (
                    <span className="text-xs font-mono text-emerald-700 font-bold block">
                      −₹{money(d.discount)}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-200/60 font-mono">
                <span>
                  {it.qty} cs × ₹{money(d.rate)}
                </span>
                {it.taxability === 'non_gst' ? (
                  <span className="text-slate-600 font-semibold">Non-GST · 0%</span>
                ) : isGst && lineTax && lineTax.ratePct > 0 ? (
                  <span>
                    GST {lineTax.ratePct}% (₹{money(lineTax.tax)})
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. GST Tax Breakdown Table by HSN (Situated at bottom of invoice) */}
      {taxBreakdown && taxBreakdown.isTaxed && taxBreakdown.summary.length > 0 && (
        <div className="mt-3.5 rounded-xl border border-slate-300 bg-white overflow-hidden shadow-2xs">
          <div className="px-3 py-1.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
            <span className="uppercase tracking-wider">GST Tax Breakdown (by HSN / SAC)</span>
            <span className="text-xs text-slate-500 font-normal hidden sm:inline">Values rounded as per GST Rule 46</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left border-collapse text-xs" aria-label="GST summary by HSN and rate">
              <thead>
                <tr className="bg-slate-800 text-white font-bold uppercase tracking-wider text-xs">
                  <th className="px-3 py-2 border-r border-slate-700 whitespace-nowrap">HSN / SAC</th>
                  <th className="px-3 py-2 border-r border-slate-700 text-center whitespace-nowrap">Rate</th>
                  <th className="px-3 py-2 border-r border-slate-700 text-center whitespace-nowrap">Cases</th>
                  <th className="px-3 py-2 border-r border-slate-700 text-right whitespace-nowrap">Taxable (₹)</th>
                  <th className="px-3 py-2 border-r border-slate-700 text-right whitespace-nowrap">CGST (₹)</th>
                  <th className="px-3 py-2 border-r border-slate-700 text-right whitespace-nowrap">SGST (₹)</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">Total GST (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {taxBreakdown.summary.map((r) => (
                  <tr key={`${r.hsn}|${r.ratePct}`} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-3 py-2 border-r border-slate-200 font-mono font-bold text-slate-800 whitespace-nowrap">
                      {r.hsn}
                    </td>
                    <td className="px-3 py-2 border-r border-slate-200 text-center font-mono font-semibold text-slate-700 whitespace-nowrap">
                      {r.ratePct > 0 ? `${r.ratePct}%` : '0%'}
                    </td>
                    <td className="px-3 py-2 border-r border-slate-200 text-center font-mono font-bold text-slate-900 whitespace-nowrap">
                      {r.qty}
                    </td>
                    <td className="px-3 py-2 border-r border-slate-200 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap">
                      ₹{money(r.taxable)}
                    </td>
                    <td className="px-3 py-2 border-r border-slate-200 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                      ₹{money(r.cgst)}
                    </td>
                    <td className="px-3 py-2 border-r border-slate-200 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                      ₹{money(r.sgst)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums font-bold text-emerald-800 bg-emerald-50/40 whitespace-nowrap">
                      ₹{money(r.tax)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
                  <td className="px-3 py-2.5 border-r border-slate-300 uppercase tracking-wide text-xs whitespace-nowrap" colSpan={2}>
                    Total Taxable &amp; Tax:
                  </td>
                  <td className="px-3 py-2.5 border-r border-slate-300 text-center font-mono font-black whitespace-nowrap">
                    {taxBreakdown.summary.reduce((a, r) => a + r.qty, 0)}
                  </td>
                  <td className="px-3 py-2.5 border-r border-slate-300 text-right font-mono tabular-nums font-black whitespace-nowrap">
                    ₹{money(taxBreakdown.summary.reduce((a, r) => a + r.taxable, 0))}
                  </td>
                  <td className="px-3 py-2.5 border-r border-slate-300 text-right font-mono tabular-nums font-black whitespace-nowrap">
                    ₹{money(taxBreakdown.summary.reduce((a, r) => a + r.cgst, 0))}
                  </td>
                  <td className="px-3 py-2.5 border-r border-slate-300 text-right font-mono tabular-nums font-black whitespace-nowrap">
                    ₹{money(taxBreakdown.summary.reduce((a, r) => a + r.sgst, 0))}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums font-black text-emerald-900 bg-emerald-100/60 whitespace-nowrap">
                    ₹{money(taxBreakdown.summary.reduce((a, r) => a + r.tax, 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
};
