import React from 'react';
import { AlertTriangle, Tag } from 'lucide-react';
import { GrnSchemeType, Warehouse } from '../../types';
import { money } from '../../utils/billing';
import { calcInwardRowBreakdown, EditableInwardRow } from './bulkInwardTypes';

interface BulkInwardDesktopModalsProps {
  rows: EditableInwardRow[];
  warehouses: Warehouse[];
  supplierName: string;
  supplierPhone: string;
  invoiceNo: string;
  inwardDate: string;
  targetWarehouseId: string;
  totalReceivedQty: number;
  calculatedGrandTotal: number;
  totalInwardCost: number;
  totalLandedInventoryValue: number;
  inwardCostPerCrate: number;
  printedTotalCases: number | null;
  hasCasesMismatch: boolean;
  casesDiff: number;
  showConfirmStep: boolean;
  setShowConfirmStep: React.Dispatch<React.SetStateAction<boolean>>;
  confirmQuery: string;
  setConfirmQuery: React.Dispatch<React.SetStateAction<string>>;
  confirmDeleteId: string | null;
  setConfirmDeleteId: React.Dispatch<React.SetStateAction<string | null>>;
  setExpandedRowId: React.Dispatch<React.SetStateAction<string | null>>;
  setExpandedCardId: React.Dispatch<React.SetStateAction<string | null>>;
  handleDeleteRow: (rowId: string) => void;
  handleConfirmAndPostGrn: () => void;
  showWarningDialog: boolean;
  setShowWarningDialog: React.Dispatch<React.SetStateAction<boolean>>;
  warningNote: string;
  setWarningNote: React.Dispatch<React.SetStateAction<string>>;
  handleImportWithWarning: () => void;
  showBulkSchemeModal: boolean;
  setShowBulkSchemeModal: React.Dispatch<React.SetStateAction<boolean>>;
  bulkSchemeType: GrnSchemeType;
  setBulkSchemeType: React.Dispatch<React.SetStateAction<GrnSchemeType>>;
  bulkSchemeValue: number;
  setBulkSchemeValue: React.Dispatch<React.SetStateAction<number>>;
  bulkSchemeName: string;
  setBulkSchemeName: React.Dispatch<React.SetStateAction<string>>;
  handleApplyBulkScheme: () => void;
}

export const BulkInwardDesktopModals: React.FC<BulkInwardDesktopModalsProps> = ({
  rows,
  warehouses,
  supplierName,
  supplierPhone,
  invoiceNo,
  inwardDate,
  targetWarehouseId,
  totalReceivedQty,
  calculatedGrandTotal,
  totalInwardCost,
  totalLandedInventoryValue,
  inwardCostPerCrate,
  printedTotalCases,
  hasCasesMismatch,
  casesDiff,
  showConfirmStep,
  setShowConfirmStep,
  confirmQuery,
  setConfirmQuery,
  confirmDeleteId,
  setConfirmDeleteId,
  setExpandedRowId,
  setExpandedCardId,
  handleDeleteRow,
  handleConfirmAndPostGrn,
  showWarningDialog,
  setShowWarningDialog,
  warningNote,
  setWarningNote,
  handleImportWithWarning,
  showBulkSchemeModal,
  setShowBulkSchemeModal,
  bulkSchemeType,
  setBulkSchemeType,
  bulkSchemeValue,
  setBulkSchemeValue,
  bulkSchemeName,
  setBulkSchemeName,
  handleApplyBulkScheme,
}) => {
  return (
    <>
      {/* CONFIRM STEP: last check, line by line, before anything is saved */}
      {showConfirmStep && (() => {
        const q = confirmQuery.trim().toLowerCase();
        const list = rows.filter((r) => !q || `${r.productName || ''} ${r.rawName || ''} ${r.batchNumber || ''}`.toLowerCase().includes(q));
        const bdOf = (r: EditableInwardRow) => calcInwardRowBreakdown(r, inwardCostPerCrate);
        const discountText = (r: EditableInwardRow) =>
          r.schemeType === 'discount_percent' ? `${r.discountPercent}%`
          : r.schemeType === 'discount_flat' ? `₹${r.discountFlat}/cs`
          : r.schemeType === 'b2g1' ? `B${r.schemeBuyQty ?? 2}G${r.schemeFreeQty ?? 1}`
          : r.freeQty > 0 ? `${r.freeQty} free` : 'None';
        const missing = (r: EditableInwardRow) => !r.batchNumber?.trim() || !r.expiry;
        const missingCount = rows.filter(missing).length;
        const expectedCredit = rows.reduce((sum, r) => sum + (r.pendingCreditSchemeId ? Number(r.pendingCreditExpectedAmount) || 0 : 0), 0);
        const whName = warehouses.find((w) => w.id === targetWarehouseId)?.name || '';
        const blockers = [
          !invoiceNo.trim() ? 'enter the invoice no.' : '',
          !targetWarehouseId ? 'pick a warehouse' : '',
          missingCount > 0 ? `add batch or expiry on ${missingCount} line${missingCount > 1 ? 's' : ''}` : '',
        ].filter(Boolean);
        const summary: [string, string][] = [
          ['Supplier', supplierName || '—'],
          ['Phone', supplierPhone || '—'],
          ['Invoice no.', invoiceNo || '—'],
          ['Date', inwardDate || '—'],
          ['Warehouse', whName || '—'],
          ['Cases', totalReceivedQty.toLocaleString()],
          ['Invoice total', `₹${money(calculatedGrandTotal)}`],
          ['Freight & Labour', `₹${money(totalInwardCost)}`],
          ['Landed total', `₹${money(totalLandedInventoryValue)}`],
        ];
        const rowActions = (r: EditableInwardRow) =>
          confirmDeleteId === r.id ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-rose-700">Delete this line?</span>
              <button type="button" className="min-h-[40px] px-3 rounded-xl bg-rose-600 text-white text-sm font-bold cursor-pointer"
                onClick={() => { handleDeleteRow(r.id); setConfirmDeleteId(null); if (rows.length <= 1) setShowConfirmStep(false); }}>Yes</button>
              <button type="button" className="min-h-[40px] px-3 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-bold cursor-pointer"
                onClick={() => setConfirmDeleteId(null)}>No</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button type="button" className="min-h-[44px] px-4 rounded-xl border border-slate-300 bg-white text-[#0A1F44] text-sm font-bold cursor-pointer"
                onClick={() => { setShowConfirmStep(false); setExpandedRowId(r.id); setExpandedCardId(r.id); }}>Edit</button>
              <button type="button" className="min-h-[44px] px-4 rounded-xl border border-rose-300 bg-white text-rose-700 text-sm font-bold cursor-pointer"
                onClick={() => setConfirmDeleteId(r.id)}>Delete</button>
            </div>
          );
        const chipsOf = (r: EditableInwardRow) => (
          <div className="flex flex-wrap gap-1.5">
            {r.taxability === 'non_gst' && <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-bold">Non-GST · 0%</span>}
            {r.isNewProduct && <span className="px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 text-xs font-bold">New product, will be created</span>}
            {r.pendingCreditSchemeId && Number(r.pendingCreditExpectedAmount) > 0 && <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-bold">Credit note ₹{money(Number(r.pendingCreditExpectedAmount))} expected</span>}
            {missing(r) && <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-bold">Batch or expiry missing</span>}
          </div>
        );
        return (
          <div role="dialog" aria-modal="true" aria-label="Confirm purchase" className="fixed inset-0 z-50 bg-slate-50 flex flex-col">
            <div className="bg-[#0A1F44] text-white px-4 py-3 flex items-center justify-between shrink-0">
              <div>
                <div className="text-base font-bold">Confirm purchase</div>
                <div className="text-xs opacity-75">Check every line before saving</div>
              </div>
              <button type="button" onClick={() => setShowConfirmStep(false)} className="min-h-[40px] px-4 rounded-full bg-white text-[#0A1F44] text-sm font-bold cursor-pointer">Back to edit</button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
              <div className="bg-white border border-slate-200 rounded-xl p-3.5 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
                {summary.map(([k, v]) => (
                  <div key={k} className="min-w-0">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500">{k}</div>
                    <div className={`text-sm font-bold truncate ${k === 'Landed total' ? 'text-[#1B8A5A]' : 'text-[#0A1F44]'}`}>{v}</div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <input type="search" value={confirmQuery} onChange={(e) => setConfirmQuery(e.target.value)} placeholder="Search product or batch"
                  className="min-h-[44px] flex-1 min-w-[180px] px-3.5 rounded-xl border border-slate-300 bg-white text-sm" />
                <span className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold">All lines ({rows.length})</span>
                <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${missingCount ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>Needs attention ({missingCount})</span>
              </div>
              {/* Phone + tablet: one card per line */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:hidden">
                {list.map((r) => {
                  const bd = bdOf(r);
                  return (
                    <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
                      <div className="flex justify-between gap-2 text-[15px] font-bold text-[#0A1F44]">
                        <span>{rows.indexOf(r) + 1}. {r.productName || r.rawName}</span>
                        <span className="font-mono shrink-0">₹{money(bd.lineTotal)}</span>
                      </div>
                      {chipsOf(r)}
                      <div className="text-[13px] font-semibold text-slate-700">{r.qty} cs × ₹{money(r.priceInclGst ?? r.unitPrice)} incl. GST · Discount {discountText(r)}</div>
                      <div className="text-[13px] font-semibold text-slate-700">Batch {r.batchNumber || '—'} · Expiry {r.expiry || '—'} · <span className="text-[#1B8A5A] font-extrabold">Landed ₹{money(bd.landedCostPerCrate)}/cs</span></div>
                      {rowActions(r)}
                    </div>
                  );
                })}
              </div>
              {/* Desktop: table */}
              <div className="hidden lg:block bg-white border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="text-left px-3 py-2.5">#</th><th className="text-left px-3 py-2.5">Product</th><th className="text-left px-3 py-2.5">Qty (cs)</th>
                      <th className="text-left px-3 py-2.5">Rate incl. GST</th><th className="text-left px-3 py-2.5">Discount</th><th className="text-left px-3 py-2.5">Batch</th>
                      <th className="text-left px-3 py-2.5">Expiry</th><th className="text-right px-3 py-2.5">Landed ₹/cs</th><th className="text-right px-3 py-2.5">Total</th><th className="px-3 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((r) => {
                      const bd = bdOf(r);
                      return (
                        <tr key={r.id} className="border-t border-slate-200 align-top">
                          <td className="px-3 py-2.5 font-semibold">{rows.indexOf(r) + 1}</td>
                          <td className="px-3 py-2.5"><div className="font-bold text-[#0A1F44] mb-1">{r.productName || r.rawName}</div>{chipsOf(r)}</td>
                          <td className="px-3 py-2.5 font-semibold">{r.qty}</td>
                          <td className="px-3 py-2.5 font-mono font-semibold">₹{money(r.priceInclGst ?? r.unitPrice)}</td>
                          <td className="px-3 py-2.5 font-semibold">{discountText(r)}</td>
                          <td className={`px-3 py-2.5 font-semibold ${r.batchNumber ? '' : 'text-rose-700'}`}>{r.batchNumber || 'Missing'}</td>
                          <td className={`px-3 py-2.5 font-semibold ${r.expiry ? '' : 'text-rose-700'}`}>{r.expiry || 'Missing'}</td>
                          <td className="px-3 py-2.5 text-right font-mono font-extrabold text-[#1B8A5A]">₹{money(bd.landedCostPerCrate)}</td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-[#0A1F44]">₹{money(bd.lineTotal)}</td>
                          <td className="px-3 py-2.5">{rowActions(r)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {list.length === 0 && <div className="text-center text-sm text-slate-500 py-6">No lines match your search.</div>}
            </div>
            <div className="bg-white border-t border-slate-200 px-3 sm:px-4 py-3 flex flex-col gap-2 shrink-0">
              {expectedCredit > 0 && <div className="text-xs font-semibold text-amber-700">Expected credit note ₹{money(expectedCredit)} (not deducted from cost).</div>}
              <div className="text-xs text-slate-600">Saving adds {totalReceivedQty.toLocaleString()} cases to {whName || 'the selected warehouse'}{expectedCredit > 0 ? ' and creates the pending credit note' : ''}.</div>
              {blockers.length > 0 && <div className="text-xs font-semibold text-rose-700">To save: {blockers.join(', ')}.</div>}
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowConfirmStep(false)} className="min-h-[48px] px-5 rounded-xl border border-slate-300 bg-white text-[#0A1F44] text-sm font-bold cursor-pointer">Back to edit</button>
                <button type="button" disabled={blockers.length > 0} onClick={handleConfirmAndPostGrn}
                  className={`min-h-[48px] px-6 rounded-xl text-sm font-bold ${blockers.length > 0 ? 'bg-slate-300 text-slate-600 cursor-not-allowed' : 'bg-[#1B8A5A] text-white cursor-pointer'}`}>
                  Confirm &amp; save purchase
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* IMPORT-WITH-WARNING DIALOG */}
      {showWarningDialog && hasCasesMismatch && (
        <div role="dialog" aria-modal="true" aria-label="Import with warning" className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-lg p-5 max-w-md w-full border-2 border-amber-500 shadow-xl flex flex-col gap-3">
            <h3 className="font-bold text-amber-900 text-sm flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-600" />
              Import with warning?
            </h3>
            <div className="text-xs text-slate-700 space-y-1 bg-amber-50 border border-amber-200 rounded p-3">
              <div>Invoice printed total: <strong>{printedTotalCases?.toLocaleString()} cs</strong></div>
              <div>Imported (working table): <strong>{totalReceivedQty.toLocaleString()} cs</strong></div>
              <div>Difference: <strong>{casesDiff > 0 ? `+${casesDiff}` : casesDiff} cs</strong></div>
            </div>
            <p className="text-xs text-slate-600 leading-snug">
              You can import now and correct the count later from the GRN list (Edit). This warning will be saved
              in the GRN history so it can be tracked.
            </p>
            <textarea
              value={warningNote}
              onChange={(e) => setWarningNote(e.target.value)}
              rows={2}
              placeholder="Optional note (e.g. 2 crates short, claim raised with supplier)"
              className="w-full border border-slate-300 rounded p-2 text-xs"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowWarningDialog(false)}
                className="px-3 py-1.5 border border-slate-300 hover:bg-slate-100 font-semibold text-slate-700 rounded text-xs cursor-pointer"
              >
                Go back & fix
              </button>
              <button
                type="button"
                onClick={handleImportWithWarning}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded text-xs cursor-pointer flex items-center gap-1.5"
              >
                <AlertTriangle size={14} /> Import with warning
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK SCHEME / DISCOUNT SUB-MODAL */}
      {showBulkSchemeModal && (
        <div role="dialog" aria-modal="true" aria-label="Apply scheme or discount to all items" className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-lg p-5 max-w-md w-full border shadow-xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Tag size={16} className="text-purple-600" />
                Apply Scheme / Discount to All Items
              </h3>
              <button aria-label="Close"
                onClick={() => setShowBulkSchemeModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Scheme Type</label>
                <select
                  value={bulkSchemeType}
                  onChange={(e) => setBulkSchemeType(e.target.value as GrnSchemeType)}
                  className="w-full border rounded px-2.5 py-1.5 bg-white font-medium"
                >
                  <option value="discount_percent">Percentage Discount (% Off each item)</option>
                  <option value="discount_flat">Flat Cash Discount (₹ Off per crate)</option>
                  <option value="free_cases">Free Bonus Crates (e.g. +1 per 10 cases)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  {bulkSchemeType === 'discount_percent'
                    ? 'Discount Percentage (%)'
                    : bulkSchemeType === 'discount_flat'
                    ? 'Flat Amount (₹/case)'
                    : 'Free Crates per 10 Billed'}
                </label>
                <input
                  type="number" inputMode="numeric"
                  min="0"
                  step={bulkSchemeType === 'discount_percent' ? '0.5' : '1'}
                  value={bulkSchemeValue}
                  onChange={(e) => setBulkSchemeValue(parseFloat(e.target.value) || 0)}
                  className="w-full border rounded px-2.5 py-1.5 font-bold"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Scheme Name / Label</label>
                <input
                  type="text"
                  value={bulkSchemeName}
                  onChange={(e) => setBulkSchemeName(e.target.value)}
                  placeholder="e.g. Summer Promo, Dealer Incentive"
                  className="w-full border rounded px-2.5 py-1.5"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t text-xs">
              <button
                onClick={() => setShowBulkSchemeModal(false)}
                className="px-3 py-1.5 border rounded text-slate-700 hover:bg-slate-100 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyBulkScheme}
                className="px-4 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded font-bold"
              >
                Apply to All {rows.length} Items
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
