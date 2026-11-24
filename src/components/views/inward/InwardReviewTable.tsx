import React from 'react';
import { Edit2, FileCheck2, Trash2 } from 'lucide-react';
import { GrnLineItem } from '../../../types';
import { money } from '../../../utils/billing';
import { InwardTotals } from './inwardTypes';

interface InwardReviewTableProps {
  palette: { line: string; navy: string };
  reviewItemsCount: number;
  resolvedReviewItems: GrnLineItem[];
  editingIndex: number | null;
  handleEditRow: (idx: number) => void;
  handleDeleteRow: (idx: number) => void;
  totals: InwardTotals;
  totalInwardCost: number;
}

export const InwardReviewTable: React.FC<InwardReviewTableProps> = ({
  palette,
  reviewItemsCount,
  resolvedReviewItems,
  editingIndex,
  handleEditRow,
  handleDeleteRow,
  totals,
  totalInwardCost,
}) => {
  return (
    <div className="border-2 p-4" style={{ borderColor: palette.line }}>
      <div className="flex items-center justify-between mb-3 pb-2 border-b">
        <div className="font-bold text-sm flex items-center gap-2">
          <FileCheck2 size={16} style={{ color: palette.navy }} />
          <span>Invoice Items ({reviewItemsCount})</span>
        </div>
      </div>

      {reviewItemsCount === 0 ? (
        <div className="py-6 text-center text-xs text-gray-500">
          No items added yet. Add items using the form above.
        </div>
      ) : (
        <div className="overflow-x-auto overscroll-x-contain rounded-2xl border border-slate-200 bg-white shadow-sm border mb-3">
          <table className="w-full min-w-[780px] text-left data-table text-xs">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="p-2 whitespace-nowrap">SKU</th>
                <th className="p-2 min-w-[150px]">Description</th>
                <th className="p-2 text-right whitespace-nowrap">Billed</th>
                <th className="p-2 text-right whitespace-nowrap">Free</th>
                <th className="p-2 text-right whitespace-nowrap">Paid</th>
                <th className="p-2 text-right whitespace-nowrap">Inward Qty</th>
                <th className="p-2 text-right whitespace-nowrap">Landed Cost</th>
                <th className="p-2 text-right whitespace-nowrap">Tax</th>
                <th className="p-2 text-right whitespace-nowrap">Total</th>
                <th className="p-2 text-center whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {resolvedReviewItems.map((it, idx) => (
                <tr
                  key={it.id || idx}
                  className={`border-b transition-colors ${
                    idx === editingIndex
                      ? 'bg-amber-100/70 ring-2 ring-amber-400 font-semibold'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="p-2 font-mono font-bold text-sky-700">{it.sku}</td>
                  <td className="p-2 font-semibold">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span>{it.productName}</span>
                      {it.taxability === 'non_gst' && (
                        <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          Non-GST
                        </span>
                      )}
                    </div>
                    {idx === editingIndex && (
                      <span className="text-xs text-amber-700 font-bold bg-amber-200/60 px-1.5 py-0.5 rounded">
                        Editing in form above ⬆
                      </span>
                    )}
                  </td>
                  <td className="p-2 text-right font-bold">{it.qty}</td>
                  <td className="p-2 text-right font-bold text-amber-600">
                    {it.freeQty > 0 ? (
                      <span>
                        +{it.freeQty}{' '}
                        <span className="text-xs text-slate-500 font-normal">
                          ({it.schemeMode === 'additive' ? 'bonus' : 'incl.'})
                        </span>
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="p-2 text-right font-bold text-slate-700">
                    {it.paidQty !== undefined ? it.paidQty : Math.max(0, it.qty - (it.freeQty || 0))}
                  </td>
                  <td className="p-2 text-right font-extrabold text-emerald-800">
                    {it.totalReceivedQty || it.qty}
                  </td>
                  <td className="p-2 text-right font-mono tabular-nums">
                    <div>₹{money(it.landedCostPerCrate || it.landedCostPerUnit || it.unitPrice)}/cs</div>
                    {Number(it.landedCostPerUnit) > 0 && Number(it.landedCostPerCrate) > Number(it.landedCostPerUnit) && (
                      <div className="text-xs text-slate-500">₹{money(it.landedCostPerUnit)}/u</div>
                    )}
                  </td>
                  <td className="p-2 text-right font-mono tabular-nums">
                    {it.taxability === 'non_gst' ? 'Non-GST' : `₹${money((it.cgstAmount || 0) + (it.sgstAmount || 0))}`}
                  </td>
                  <td className="p-2 text-right font-mono font-bold text-green-700 tabular-nums">
                    ₹{money(it.lineTotal)}
                  </td>
                  <td className="p-2 text-center whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleEditRow(idx)}
                      className={`p-1 px-2.5 rounded-lg text-xs font-semibold cursor-pointer inline-flex items-center gap-1 transition-colors ${
                        idx === editingIndex
                          ? 'bg-amber-500 text-white shadow-sm'
                          : 'text-sky-600 hover:text-sky-800 hover:bg-sky-50'
                      }`}
                      title="Edit this item"
                    >
                      <Edit2 size={13} />
                      <span>{idx === editingIndex ? 'Editing' : 'Edit'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteRow(idx)}
                      className="p-1 px-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg cursor-pointer ml-1 inline-flex items-center gap-1"
                      title="Delete this row"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {resolvedReviewItems.length > 0 && (
        <div className="mt-3 p-4 rounded-2xl bg-white border border-black/5 shadow-sm space-y-1.5">
          <div className="flex justify-between text-sm text-slate-600">
            <span>Taxable</span>
            <span className="font-semibold tabular-nums text-slate-800">₹{money(totals.taxable)}</span>
          </div>
          <div className="flex justify-between text-sm text-slate-500">
            <span>GST</span>
            <span className="font-semibold tabular-nums">₹{money(totals.cgst + totals.sgst)}</span>
          </div>
          {totalInwardCost > 0 && (
            <div className="flex justify-between text-sm text-emerald-700">
              <span>Freight &amp; Labour (allocated to landed cost)</span>
              <span className="font-semibold tabular-nums">₹{money(totalInwardCost)}</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-1">
            <span className="text-lg font-bold text-slate-900 tabular-nums">₹{money(totals.grand)}</span>
            <span className="text-xs text-slate-500">{totals.totalCases} cases</span>
          </div>
        </div>
      )}
    </div>
  );
};
