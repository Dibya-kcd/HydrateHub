import React from 'react';
import { Search } from 'lucide-react';
import { Warehouse } from '../../../types';
import { money } from '../../../utils/billing';
import { calcInwardRowBreakdown, EditableInwardRow } from '../bulkInwardTypes';

interface BulkInwardPhoneConfirmStepProps {
  rows: EditableInwardRow[];
  confirmQuery: string;
  setConfirmQuery: React.Dispatch<React.SetStateAction<string>>;
  parseError: string | null;
  invoiceNo: string;
  targetWarehouseId: string;
  whObj: Warehouse | undefined;
  inwardCostPerCrate: number;
  printedTotalCases: number | null;
  totalReceivedQty: number;
  casesDiff: number;
  hasCasesMismatch: boolean;
  calculatedGrandTotal: number;
  setShowConfirmStep: React.Dispatch<React.SetStateAction<boolean>>;
  handleConfirmAndPostGrn: () => void;
  showWarningDialog: boolean;
  setShowWarningDialog: React.Dispatch<React.SetStateAction<boolean>>;
  warningNote: string;
  setWarningNote: React.Dispatch<React.SetStateAction<string>>;
  handleImportWithWarning: () => void;
}

export const BulkInwardPhoneConfirmStep: React.FC<BulkInwardPhoneConfirmStepProps> = ({
  rows,
  confirmQuery,
  setConfirmQuery,
  parseError,
  invoiceNo,
  targetWarehouseId,
  whObj,
  inwardCostPerCrate,
  printedTotalCases,
  totalReceivedQty,
  casesDiff,
  hasCasesMismatch,
  calculatedGrandTotal,
  setShowConfirmStep,
  handleConfirmAndPostGrn,
  showWarningDialog,
  setShowWarningDialog,
  warningNote,
  setWarningNote,
  handleImportWithWarning,
}) => {
  const lineBreakdown = (r: EditableInwardRow) => calcInwardRowBreakdown(r, inwardCostPerCrate);
  const q = confirmQuery.trim().toLowerCase();
  const list = rows.filter((r) => !q || `${r.productName || ''} ${r.rawName || ''} ${r.batchNumber || ''}`.toLowerCase().includes(q));
  const discountText = (r: EditableInwardRow) =>
    r.schemeType === 'discount_percent' ? `${r.discountPercent}%`
    : r.schemeType === 'discount_flat' ? `₹${r.discountFlat}/cs`
    : r.schemeType === 'b2g1' ? `B${r.schemeBuyQty ?? 2}G${r.schemeFreeQty ?? 1}`
    : r.freeQty > 0 ? `${r.freeQty} free` : '0%';
  const missingCount = rows.filter((r) => !r.batchNumber?.trim() || !r.expiry).length;
  const blockers = [
    !invoiceNo.trim() ? 'enter the invoice no.' : '',
    !targetWarehouseId ? 'pick a warehouse' : '',
    missingCount > 0 ? `add batch or expiry on ${missingCount} line${missingCount > 1 ? 's' : ''}` : '',
  ].filter(Boolean);

  return (
    <>
      <div role="dialog" aria-modal="true" aria-label="Confirm purchase" className="rt-flow-phone">
        <div className="hh-sales-top hh-sales-top--flush hh-inv-top--flow">
          <div>
            <div className="text-[20px] font-extrabold text-white tracking-tight leading-tight">
              Confirm purchase
            </div>
            <div className="text-[12px] text-white/85 font-medium mt-0.5">
              Check every line before saving
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-2.5">
          {parseError && (
            <div className="hh-inv-card hh-inv-card--alert-red text-[12px] font-semibold text-rose-700 whitespace-pre-line">
              {parseError}
            </div>
          )}

          <div className="rt-search-bar">
            <Search size={16} className="text-slate-400 shrink-0" />
            <input
              type="search"
              enterKeyHint="search"
              value={confirmQuery}
              onChange={(e) => setConfirmQuery(e.target.value)}
              placeholder="Search lines"
            />
          </div>

          {list.map((r) => {
            const bd = lineBreakdown(r);
            const rateIncl = r.priceInclGst ?? (r.unitPrice * (1 + ((r.taxability === 'non_gst' ? 0 : (r.cgstPercent + r.sgstPercent)) / 100)));
            return (
              <div key={r.id} className="hh-inv-card space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-[14px] font-bold text-slate-900 min-w-0">
                    {rows.indexOf(r) + 1} · {r.productName || r.rawName}
                  </div>
                  <div className="text-[14px] font-extrabold text-slate-900 tabular-nums shrink-0">
                    ₹{money(bd.lineTotal)}
                  </div>
                </div>
                <div className="text-[12px] text-slate-500 leading-snug">
                  Rate ₹{money(rateIncl)} incl. GST · Disc {discountText(r)} · Exp {r.expiry || 'missing'} · Landed ₹{money(bd.landedCostPerCrate)}/cs
                </div>
              </div>
            );
          })}

          <div className="hh-inv-card space-y-2">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-slate-500">Invoice printed total</span>
              <span className="font-bold text-slate-900 tabular-nums">
                {printedTotalCases !== null ? `${printedTotalCases.toLocaleString()} cs` : `${totalReceivedQty.toLocaleString()} cs`}
              </span>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-slate-500">Imported (working table)</span>
              <span className="font-bold text-slate-900 tabular-nums">{totalReceivedQty.toLocaleString()} cs</span>
            </div>
            <div className="flex items-center justify-between text-[13px] pt-1.5 border-t border-slate-100">
              <span className="text-slate-500">Difference</span>
              <span className={`font-extrabold tabular-nums ${casesDiff !== 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {casesDiff > 0 ? `+${casesDiff}` : casesDiff} cs
              </span>
            </div>
            <div className="flex items-center justify-between text-[13px] pt-1.5 border-t border-slate-100">
              <span className="text-slate-500">Grand total ({whObj?.name || 'Godown'})</span>
              <span className="font-extrabold text-slate-900 tabular-nums">₹{money(calculatedGrandTotal)}</span>
            </div>
          </div>

          {blockers.length > 0 && (
            <div className="hh-inv-card hh-inv-card--alert-amber text-[12px] font-semibold text-amber-800">
              To save: {blockers.join(', ')}.
            </div>
          )}
        </div>

        <div className="px-3.5 py-2.5 bg-[#f3f5f9] border-t border-slate-200 grid grid-cols-2 gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowConfirmStep(false)}
            className="hh-inv-btn-outline w-full"
          >
            Back to edit
          </button>
          <button
            type="button"
            disabled={blockers.length > 0}
            onClick={handleConfirmAndPostGrn}
            className="hh-inv-btn-accent w-full leading-tight text-center"
          >
            Confirm purchase
          </button>
        </div>
      </div>

      {showWarningDialog && hasCasesMismatch && (
        <div className="rt-bsheet-scrim" onClick={() => setShowWarningDialog(false)}>
          <div className="rt-bsheet" onClick={(e) => e.stopPropagation()}>
            <div className="hh-grab" />
            <h3 className="text-[17px] font-extrabold text-slate-900">Import with warning?</h3>
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-[12.5px] text-amber-950 space-y-1">
              <div>Invoice printed total: <strong>{printedTotalCases?.toLocaleString()} cs</strong></div>
              <div>Imported (working table): <strong>{totalReceivedQty.toLocaleString()} cs</strong></div>
              <div>Difference: <strong>{casesDiff > 0 ? `+${casesDiff}` : casesDiff} cs</strong></div>
            </div>
            <div className="hh-inv-field">
              <span className="hh-inv-field__label">OPTIONAL NOTE</span>
              <input
                value={warningNote}
                onChange={(e) => setWarningNote(e.target.value)}
                placeholder="e.g. 2 crates short, claim raised"
              />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button type="button" onClick={() => setShowWarningDialog(false)} className="hh-inv-btn-outline w-full">
                Go back &amp; fix
              </button>
              <button type="button" onClick={handleImportWithWarning} className="hh-inv-btn-primary w-full">
                Import anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
