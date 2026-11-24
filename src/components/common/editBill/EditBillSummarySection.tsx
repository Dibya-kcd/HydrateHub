import React from 'react';
import type { PaletteTokens } from '../../../types';
import { money, statusOf } from '../../../utils/billing';

interface EditBillSummarySectionProps {
  totals: {
    subtotal: number;
    discount: number;
    cgst: number;
    sgst: number;
    total: number;
  };
  keptExtraDiscount: number;
  editGstMode: 'inclusive' | 'exclusive' | 'off';
  amountPaid: number;
  setAmountPaid: (val: number) => void;
  dueBalance: number;
  status: ReturnType<typeof statusOf>;
  palette: PaletteTokens;
}

export const EditBillSummarySection: React.FC<EditBillSummarySectionProps> = ({
  totals,
  keptExtraDiscount,
  editGstMode,
  amountPaid,
  setAmountPaid,
  dueBalance,
  status,
  palette,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Bill Summary Breakdown */}
      <div
        className="p-4 rounded-xl border text-xs space-y-2"
        style={{ borderColor: palette.line, backgroundColor: palette.cream }}
      >
        <h4 className="font-bold text-xs uppercase tracking-wider opacity-75">
          Financial Breakdown
        </h4>
        <div className="flex justify-between">
          <span className="opacity-70">Gross Line Subtotal:</span>
          <span className="font-semibold">₹{money(totals.subtotal)}</span>
        </div>
        {totals.discount > 0 && (
          <div className="flex justify-between text-green-700 font-semibold">
            <span>Trade Schemes Discount:</span>
            <span>-₹{money(totals.discount)}</span>
          </div>
        )}
        {keptExtraDiscount > 0 && (
          <div className="flex justify-between text-stone-600">
            <span>Invoice discount (kept from the original bill):</span>
            <span>-₹{money(keptExtraDiscount)}</span>
          </div>
        )}
        {editGstMode !== 'off' && (
          <>
            <div className="flex justify-between text-stone-600">
              <span>CGST (Central Tax):</span>
              <span>₹{money(totals.cgst)}</span>
            </div>
            <div className="flex justify-between text-stone-600">
              <span>SGST (State Tax):</span>
              <span>₹{money(totals.sgst)}</span>
            </div>
          </>
        )}
        <div
          className="pt-2 border-t flex justify-between text-sm font-bold"
          style={{ borderColor: palette.line }}
        >
          <span>Net Total Bill Amount:</span>
          <span className="text-base" style={{ color: palette.navy }}>
            ₹{money(totals.total)}
          </span>
        </div>
      </div>

      {/* Payment & Due Settlement */}
      <div
        className="p-4 rounded-xl border space-y-3"
        style={{ borderColor: palette.line, backgroundColor: palette.cream }}
      >
        <h4 className="font-bold text-xs uppercase tracking-wider opacity-75 flex items-center justify-between">
          <span>Payment Settlement</span>
          <span
            className="px-2 py-0.5 rounded text-xs font-bold text-white uppercase"
            style={{ backgroundColor: palette[status.balanceKey] }}
          >
            {status.label}
          </span>
        </h4>

        <div>
          <label className="block text-xs font-semibold mb-1 opacity-80">
            Amount Received / Collected (₹)
          </label>
          <input
            type="number" inputMode="decimal"
            step="0.01"
            min="0"
            max={totals.total}
            value={amountPaid}
            onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 text-sm font-bold border-2 rounded-lg focus:outline-none focus:ring-1"
            style={{
              borderColor: palette.line,
              backgroundColor: palette.panel || '#ffffff',
              color: palette.ink,
            }}
            id="edit-modal-amount-paid-input"
          />
        </div>

        {/* Payment Quick Shortcuts */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAmountPaid(totals.total)}
            className="px-2 py-1 text-xs rounded border font-medium bg-white hover:bg-stone-100 transition-colors"
            style={{ borderColor: palette.line }}
          >
            Full Paid (₹{money(totals.total)})
          </button>
          <button
            type="button"
            onClick={() => setAmountPaid(0)}
            className="px-2 py-1 text-xs rounded border font-medium bg-white hover:bg-stone-100 transition-colors"
            style={{ borderColor: palette.line }}
          >
            Credit (₹0)
          </button>
          <button
            type="button"
            onClick={() => setAmountPaid(Math.round(totals.total / 2))}
            className="px-2 py-1 text-xs rounded border font-medium bg-white hover:bg-stone-100 transition-colors"
            style={{ borderColor: palette.line }}
          >
            50% (₹{money(Math.round(totals.total / 2))})
          </button>
        </div>

        <div
          className="pt-2 border-t flex items-center justify-between text-xs font-bold"
          style={{ borderColor: palette.line }}
        >
          <span>Outstanding Balance Due:</span>
          <span
            className="text-sm font-bold"
            style={{ color: dueBalance > 0 ? palette.bad : palette.good }}
          >
            ₹{money(dueBalance)}
          </span>
        </div>
      </div>
    </div>
  );
};
