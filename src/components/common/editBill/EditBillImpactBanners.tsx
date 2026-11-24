import React from 'react';
import { AlertCircle, RotateCcw, Split } from 'lucide-react';
import type { BillItem, PaletteTokens, Trip } from '../../../types';
import type { BillEditPreview } from '../../../context/LedgerContext';
import { money } from '../../../utils/billing';
import { notify } from '../../../utils/toast';

interface EditBillImpactBannersProps {
  preview: BillEditPreview | null;
  blockedByStock: boolean;
  resolvedSourceTrip: Trip | undefined;
  onReopenTrip?: (tripId: number) => void;
  setSaveError: (msg: string) => void;
  draftTaxMix: {
    hasMixed: boolean;
    taxable: BillItem[];
    nonGst: BillItem[];
  };
  canSplitMixed: boolean;
  hasReturns: boolean;
  onRequestSplit: () => void;
  palette: PaletteTokens;
}

export const EditBillImpactBanners: React.FC<EditBillImpactBannersProps> = ({
  preview,
  blockedByStock,
  resolvedSourceTrip,
  onReopenTrip,
  setSaveError,
  draftTaxMix,
  canSplitMixed,
  hasReturns,
  onRequestSplit,
  palette,
}) => {
  return (
    <>
      {/* Where this bill's stock came from + what this edit does to stock */}
      {preview && (
        <div
          className="p-4 rounded-xl border space-y-2.5"
          style={{ borderColor: palette.line, backgroundColor: palette.cream }}
          id="edit-modal-source-panel"
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-xs">
              <span className="font-bold uppercase tracking-wider opacity-75">Sold from: </span>
              <span className="font-bold">
                {preview.source.kind === 'trip' ? '🚚 ' : '🏭 '}
                {preview.source.label}
              </span>
              {preview.source.kind === 'trip' && (
                <span
                  className={`ml-2 px-2 py-0.5 rounded-full text-xs font-bold uppercase text-white ${
                    preview.source.tripStatus === 'closed' ? 'bg-stone-600' : 'bg-emerald-600'
                  }`}
                >
                  {preview.source.tripStatus === 'closed' ? 'Closed' : 'Open'}
                </span>
              )}
            </div>
            {preview.source.kind === 'trip' && preview.source.tripStatus === 'closed' && onReopenTrip && preview.source.tripId != null && (
              <button
                type="button"
                onClick={() => {
                  onReopenTrip(preview.source.tripId as number);
                  setSaveError('');
                  notify(`Trip #${preview.source.tripId} reopened to Active. You can now adjust crate quantities.`);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border shadow-sm bg-white hover:bg-slate-50 text-emerald-800 border-emerald-300 cursor-pointer active:scale-95 transition-transform"
                id="edit-modal-reopen-trip-btn"
                title="Reopen trip to active status to allow stock adjustments"
              >
                <RotateCcw size={13} className="shrink-0" />
                <span>Reopen trip #{preview.source.tripId} to edit stock</span>
              </button>
            )}
          </div>

          {blockedByStock ? (
            <div className="text-xs rounded-lg p-3 bg-red-50 text-red-900 border border-red-200 space-y-2">
              <div className="font-bold flex items-center gap-1.5 text-rose-800">
                <AlertCircle size={15} className="shrink-0" />
                <span>This edit changes crates / products, which moves live stock, and cannot be saved yet:</span>
              </div>
              <div className="pl-5 text-slate-700 whitespace-pre-line leading-relaxed font-medium">
                {preview.problems.map((m) => `• ${m}`).join('\n')}
              </div>
              {preview.source.kind === 'trip' && preview.source.tripStatus === 'closed' && onReopenTrip && preview.source.tripId != null && (
                <div className="pt-1 pl-5">
                  <button
                    type="button"
                    onClick={() => {
                      onReopenTrip(preview.source.tripId as number);
                      setSaveError('');
                      notify(`Trip #${preview.source.tripId} reopened to Active. You can now adjust crate quantities.`);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs cursor-pointer shadow-sm active:scale-95 transition-all"
                  >
                    <RotateCcw size={14} className="shrink-0" />
                    Reopen Trip #{preview.source.tripId} to Active Now
                  </button>
                </div>
              )}
              <div className="text-xs text-slate-500 pl-5 pt-0.5">
                Tip: You can still save price, customer, or payment edits without reopening by keeping crates at original quantities.
              </div>
            </div>
          ) : preview.stockChanged ? (
            <div className="text-xs rounded-lg px-3 py-2 bg-amber-50 text-amber-900 border border-amber-200">
              ℹ This edit changes crates / products, so live stock will be adjusted only for the products whose crates changed.
            </div>
          ) : null}

          {(preview.payment.keptAsAdvance > 0 || preview.payment.removedAsCorrection > 0 || preview.payment.movedToCustomer) && (
            <div className="text-xs rounded-lg px-3 py-2 bg-sky-50 text-sky-900 border border-sky-200">
              {preview.payment.keptAsAdvance > 0 && (
                <div>💰 ₹{money(preview.payment.keptAsAdvance)} already received is more than the new total, so it will be kept as an advance on the customer's account.</div>
              )}
              {preview.payment.removedAsCorrection > 0 && (
                <div>💰 ₹{money(preview.payment.removedAsCorrection)} of receipts will be removed because the paid amount was lowered (a correction, not a refund).</div>
              )}
              {preview.payment.movedToCustomer && (
                <div>💰 Receipts on this bill will move to {preview.payment.movedToCustomer}.</div>
              )}
            </div>
          )}

          {preview.changes.length > 0 && (
            <ul className="text-xs opacity-80 list-disc pl-5 space-y-0.5">
              {preview.changes.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          )}
          {resolvedSourceTrip && preview.source.tripStatus !== 'closed' && (
            <p className="text-xs opacity-60">
              Trip is open: you can also adjust the van load from Trips if you need more crates on this vehicle.
            </p>
          )}
        </div>
      )}

      {/* Mixed GST + Non-GST notice & one-click split */}
      {draftTaxMix.hasMixed && (() => {
        const gstSum = draftTaxMix.taxable.reduce((s, it) => s + (Number(it.amount) || 0), 0);
        const nonGstSum = draftTaxMix.nonGst.reduce((s, it) => s + (Number(it.amount) || 0), 0);
        const nonGstNames = Array.from(new Set(draftTaxMix.nonGst.map((it) => it.productName).filter(Boolean))).join(', ');
        return (
          <div
            id="edit-modal-mixed-tax-banner"
            className="p-3.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-950 space-y-2"
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="space-y-1 min-w-0 flex-1">
                <div className="text-xs font-extrabold flex items-center gap-1.5 text-amber-900">
                  <Split size={14} className="shrink-0" />
                  <span>Mixed GST &amp; Non-GST items on this bill</span>
                </div>
                <p className="text-xs text-amber-900/90 leading-relaxed">
                  <strong>{draftTaxMix.taxable.length} GST item{draftTaxMix.taxable.length === 1 ? '' : 's'}</strong> (₹{money(gstSum)}) and{' '}
                  <strong>{draftTaxMix.nonGst.length} Non-GST item{draftTaxMix.nonGst.length === 1 ? '' : 's'}</strong> ({nonGstNames} · ₹{money(nonGstSum)}) are on the same invoice, so the Non-GST amount is counted under GST invoices instead of <strong>Non-GST memos (NG-)</strong>.
                </p>
              </div>
              {canSplitMixed && (
                <button
                  type="button"
                  onClick={onRequestSplit}
                  disabled={blockedByStock}
                  id="edit-modal-split-btn"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-700 hover:bg-amber-800 disabled:opacity-40 text-white text-xs font-bold shadow-xs cursor-pointer shrink-0"
                >
                  <Split size={13} />
                  <span>Split into INV + NG- Memo</span>
                </button>
              )}
            </div>
            {hasReturns && (
              <p className="text-xs text-amber-800">
                This bill already has sales returns against it, so it cannot be auto-split.
              </p>
            )}
          </div>
        );
      })()}
    </>
  );
};
