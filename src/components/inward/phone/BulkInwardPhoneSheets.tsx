import React from 'react';
import { Search } from 'lucide-react';
import { GrnSchemeType, Product } from '../../../types';
import { money } from '../../../utils/billing';
import { PackIcon } from '../../common/PackIcon';
import { calcInwardRowBreakdown, EditableInwardRow } from '../bulkInwardTypes';

interface BulkInwardPhoneSheetsProps {
  rows: EditableInwardRow[];
  setRows: React.Dispatch<React.SetStateAction<EditableInwardRow[]>>;
  products: Product[];
  inwardCostPerCrate: number;
  printedTotalCases: number | null;
  totalInvoicePrintedQty: number;
  totalFreeQty: number;
  totalSupplierSchemeBonusQty: number;
  hasCasesMismatch: boolean;
  casesDiff: number;
  calculatedGrandTotal: number;
  totalTax: number;
  originalInvoiceTotal: number | null;
  setOriginalInvoiceTotal: React.Dispatch<React.SetStateAction<number | null>>;
  amountDiff: number;
  hasAmountMismatch: boolean;
  attentionCount: number;
  showMismatchDetail: boolean;
  setShowMismatchDetail: React.Dispatch<React.SetStateAction<boolean>>;
  showAmountMismatchDetail: boolean;
  setShowAmountMismatchDetail: React.Dispatch<React.SetStateAction<boolean>>;
  catalogPickerRowId: string | null;
  setCatalogPickerRowId: React.Dispatch<React.SetStateAction<string | null>>;
  catalogPickerSearch: string;
  setCatalogPickerSearch: React.Dispatch<React.SetStateAction<string>>;
  phoneCatalogSizeFilter: 'all' | '200' | '600' | '1000';
  setPhoneCatalogSizeFilter: React.Dispatch<React.SetStateAction<'all' | '200' | '600' | '1000'>>;
  showBulkSchemeModal: boolean;
  setShowBulkSchemeModal: React.Dispatch<React.SetStateAction<boolean>>;
  bulkSchemeType: GrnSchemeType;
  setBulkSchemeType: React.Dispatch<React.SetStateAction<GrnSchemeType>>;
  bulkSchemeName: string;
  setBulkSchemeName: React.Dispatch<React.SetStateAction<string>>;
  bulkSchemeValue: number;
  setBulkSchemeValue: React.Dispatch<React.SetStateAction<number>>;
  showAutoBatchSheet: boolean;
  setShowAutoBatchSheet: React.Dispatch<React.SetStateAction<boolean>>;
  bulkExpiryDate: string;
  setBulkExpiryDate: React.Dispatch<React.SetStateAction<string>>;
  phoneDeleteConfirmId: string | null;
  setPhoneDeleteConfirmId: React.Dispatch<React.SetStateAction<string | null>>;
  handleCatalogMappingChange: (rowId: string, targetValue: string) => void;
  handleDeleteRow: (rowId: string) => void;
  handleAutoGenerateAllBatches: () => void;
  handleApplyBulkScheme: () => void;
  setEditingRowId: React.Dispatch<React.SetStateAction<string | null>>;
  setMobileSubView: React.Dispatch<React.SetStateAction<'overview' | 'bill' | 'costs' | 'edit_line'>>;
}

export const BulkInwardPhoneSheets: React.FC<BulkInwardPhoneSheetsProps> = ({
  rows,
  setRows,
  products,
  inwardCostPerCrate,
  printedTotalCases,
  totalInvoicePrintedQty,
  totalFreeQty,
  totalSupplierSchemeBonusQty,
  hasCasesMismatch,
  casesDiff,
  calculatedGrandTotal,
  totalTax,
  originalInvoiceTotal,
  setOriginalInvoiceTotal,
  amountDiff,
  hasAmountMismatch,
  attentionCount,
  showMismatchDetail,
  setShowMismatchDetail,
  showAmountMismatchDetail,
  setShowAmountMismatchDetail,
  catalogPickerRowId,
  setCatalogPickerRowId,
  catalogPickerSearch,
  setCatalogPickerSearch,
  phoneCatalogSizeFilter,
  setPhoneCatalogSizeFilter,
  showBulkSchemeModal,
  setShowBulkSchemeModal,
  bulkSchemeType,
  setBulkSchemeType,
  bulkSchemeName,
  setBulkSchemeName,
  bulkSchemeValue,
  setBulkSchemeValue,
  showAutoBatchSheet,
  setShowAutoBatchSheet,
  bulkExpiryDate,
  setBulkExpiryDate,
  phoneDeleteConfirmId,
  setPhoneDeleteConfirmId,
  handleCatalogMappingChange,
  handleDeleteRow,
  handleAutoGenerateAllBatches,
  handleApplyBulkScheme,
  setEditingRowId,
  setMobileSubView,
}) => {
  const lineBreakdown = (r: EditableInwardRow) => calcInwardRowBreakdown(r, inwardCostPerCrate);

  return (
    <>
      {hasCasesMismatch && showMismatchDetail && (
        <div className="rt-bsheet-scrim" onClick={() => setShowMismatchDetail(false)}>
          <div className="rt-bsheet" onClick={(e) => e.stopPropagation()}>
            <div className="hh-grab" />
            <h3 className="text-[18px] font-extrabold text-slate-900">Cases check</h3>
            <div className="grid grid-cols-3 gap-2 py-1">
              <div>
                <div className="text-xs text-slate-500">Printed</div>
                <div className="text-[17px] font-extrabold text-slate-900 tabular-nums">{printedTotalCases?.toLocaleString()} cs</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Table</div>
                <div className="text-[17px] font-extrabold text-slate-900 tabular-nums">{totalInvoicePrintedQty.toLocaleString()} cs</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Difference</div>
                <div className="text-[17px] font-extrabold text-rose-600 tabular-nums">{casesDiff > 0 ? `+${casesDiff}` : casesDiff} cs</div>
              </div>
            </div>
            <p className="text-[12.5px] text-slate-500 leading-relaxed">
              Includes {totalFreeQty + totalSupplierSchemeBonusQty} cs of free bonus from supplier schemes.
            </p>
            <button
              type="button"
              onClick={() => setShowMismatchDetail(false)}
              className="hh-inv-card w-full text-left cursor-pointer"
            >
              <div className="text-[14px] font-bold text-slate-900">Review lines</div>
              <div className="text-[12px] text-slate-500 mt-0.5">Check quantities against the paper invoice</div>
            </button>
            <button
              type="button"
              onClick={() => setShowMismatchDetail(false)}
              className="hh-inv-btn-outline w-full"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {hasAmountMismatch && showAmountMismatchDetail && originalInvoiceTotal !== null && (
        <div className="rt-bsheet-scrim" onClick={() => setShowAmountMismatchDetail(false)}>
          <div className="rt-bsheet" onClick={(e) => e.stopPropagation()}>
            <div className="hh-grab" />
            <h3 className="text-[18px] font-extrabold text-slate-900">Amount mismatch</h3>
            <p className="text-[13px] text-slate-600 leading-relaxed">
              Rows add up to <strong>₹{money(calculatedGrandTotal)}</strong> but the party invoice total is{' '}
              <strong>₹{money(originalInvoiceTotal)}</strong>. Difference ₹{money(Math.abs(amountDiff))}.
            </p>
            <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3 text-[12.5px] text-[#0A1F44] leading-relaxed">
              {Math.abs(amountDiff - totalTax) < 2
                ? `The difference equals the total GST (₹${money(Math.abs(amountDiff))}). The party total was probably recorded as the taxable base (before GST), while line totals include GST.`
                : 'Check quantities, unit rates, discounts and whether list prices include or exclude GST.'}
            </div>
            <button
              type="button"
              onClick={() => {
                setOriginalInvoiceTotal(calculatedGrandTotal);
                setShowAmountMismatchDetail(false);
              }}
              className="hh-inv-btn-primary w-full"
            >
              Use party total as before-GST
            </button>
            <p className="text-[12px] text-slate-500 leading-snug">
              Or check quantities, unit rates, discounts and whether list prices include GST.
            </p>
          </div>
        </div>
      )}

      {catalogPickerRowId && (
        <div className="rt-bsheet-scrim" onClick={() => setCatalogPickerRowId(null)}>
          <div className="rt-bsheet" onClick={(e) => e.stopPropagation()}>
            <div className="hh-grab" />
            <h3 className="text-[18px] font-extrabold text-slate-900">Select catalog beverage</h3>
            <div className="rt-search-bar">
              <Search size={16} className="text-slate-400 shrink-0" />
              <input
                type="search"
                enterKeyHint="search"
                value={catalogPickerSearch}
                onChange={(e) => setCatalogPickerSearch(e.target.value)}
                placeholder="Search catalog"
              />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">SELECT SIZE</div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {(
                  [
                    ['all', 'All'],
                    ['200', '200ml'],
                    ['600', '600ml'],
                    ['1000', '1L'],
                  ] as const
                ).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setPhoneCatalogSizeFilter(val)}
                    className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-bold min-w-0 min-h-0 cursor-pointer border ${
                      phoneCatalogSizeFilter === val
                        ? 'bg-[#101d3a] text-white border-[#101d3a]'
                        : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 max-h-[42vh] overflow-y-auto">
              {products
                .filter((p) => {
                  if (phoneCatalogSizeFilter !== 'all' && String(p.volume) !== phoneCatalogSizeFilter) return false;
                  const q = catalogPickerSearch.trim().toLowerCase();
                  return !q || p.name.toLowerCase().includes(q);
                })
                .map((p) => (
                  <div key={p.id} className="px-3 py-2.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <PackIcon size="sm" pack={p.pack} name={p.name} />
                      <div className="min-w-0">
                        <div className="text-[13.5px] font-bold text-slate-900 truncate">{p.name}</div>
                        <div className="text-xs text-slate-500">{p.unitsPerCrate || 24} pcs / case</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        handleCatalogMappingChange(catalogPickerRowId, String(p.id));
                        setCatalogPickerRowId(null);
                      }}
                      className="text-[13px] font-bold text-[#2864d9] px-2 py-1 min-w-0 min-h-0 cursor-pointer shrink-0"
                    >
                      Select
                    </button>
                  </div>
                ))}
            </div>
            <button
              type="button"
              onClick={() => {
                handleCatalogMappingChange(catalogPickerRowId, 'new_product');
                setCatalogPickerRowId(null);
              }}
              className="hh-inv-btn-outline w-full"
            >
              Create as new product
            </button>
          </div>
        </div>
      )}

      {showBulkSchemeModal && (
        <div className="rt-bsheet-scrim" onClick={() => setShowBulkSchemeModal(false)}>
          <div className="rt-bsheet" onClick={(e) => e.stopPropagation()}>
            <div className="hh-grab" />
            <h3 className="text-[18px] font-extrabold text-slate-900">Scheme to all lines</h3>
            <div className="hh-inv-field">
              <span className="hh-inv-field__label">SCHEME TYPE</span>
              <select
                value={bulkSchemeType}
                onChange={(e) => setBulkSchemeType(e.target.value as GrnSchemeType)}
              >
                <option value="discount_percent">Discount %</option>
                <option value="discount_flat">Flat Cash Discount (₹/cs)</option>
                <option value="free_cases">Free Bonus Crates (+1 per 10 cs)</option>
              </select>
            </div>
            <p className="text-xs text-slate-500 -mt-1">
              Other types: Flat, Free Bonus Crates (e.g. +1 per 10 cases)
            </p>
            <div className="hh-inv-field">
              <span className="hh-inv-field__label">SCHEME NAME / LABEL</span>
              <input
                value={bulkSchemeName}
                onChange={(e) => setBulkSchemeName(e.target.value)}
                placeholder="Dealer Scheme"
              />
            </div>
            <div className="hh-inv-field">
              <span className="hh-inv-field__label">
                {bulkSchemeType === 'discount_percent' ? 'VALUE (%)' : bulkSchemeType === 'discount_flat' ? 'VALUE (₹/CS)' : 'FREE CRATES / 10'}
              </span>
              <input
                type="number"
                inputMode="decimal"
                value={bulkSchemeValue}
                onChange={(e) => setBulkSchemeValue(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="hh-inv-card bg-[#fef9e7] border-amber-300 text-[12px] font-medium text-slate-700 py-2.5">
              Applies to all {rows.length} lines. You can still change a single line afterwards.
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button type="button" onClick={() => setShowBulkSchemeModal(false)} className="hh-inv-btn-outline w-full">
                Cancel
              </button>
              <button type="button" onClick={handleApplyBulkScheme} className="hh-inv-btn-primary w-full">
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {showAutoBatchSheet && (
        <div className="rt-bsheet-scrim" onClick={() => setShowAutoBatchSheet(false)}>
          <div className="rt-bsheet" onClick={(e) => e.stopPropagation()}>
            <div className="hh-grab" />
            <h3 className="text-[18px] font-extrabold text-slate-900">Auto batch / tag</h3>
            <p className="text-[12.5px] text-slate-500 -mt-1">
              Fill the missing values for {Math.max(1, attentionCount)} line{Math.max(1, attentionCount) === 1 ? '' : 's'}
            </p>
            <div className="hh-inv-field">
              <span className="hh-inv-field__label">BATCH / TAG NO</span>
              <div className="text-[13.5px] font-bold text-slate-900 pt-0.5 truncate">
                Auto: fresh unique batch numbers
              </div>
            </div>
            <div className="hh-inv-field">
              <span className="hh-inv-field__label">EXPIRY (FOR ALL MISSING)</span>
              <input
                type="date"
                value={bulkExpiryDate}
                onChange={(e) => setBulkExpiryDate(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button type="button" onClick={() => setShowAutoBatchSheet(false)} className="hh-inv-btn-outline w-full">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  handleAutoGenerateAllBatches();
                  if (bulkExpiryDate) {
                    setRows((prev) => prev.map((r) => (r.expiry ? r : { ...r, expiry: bulkExpiryDate })));
                  }
                  setShowAutoBatchSheet(false);
                }}
                className="hh-inv-btn-primary w-full"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {phoneDeleteConfirmId && (() => {
        const target = rows.find((r) => r.id === phoneDeleteConfirmId);
        if (!target) return null;
        const bd = lineBreakdown(target);
        return (
          <div className="rt-bsheet-scrim" onClick={() => setPhoneDeleteConfirmId(null)}>
            <div className="rt-bsheet" onClick={(e) => e.stopPropagation()}>
              <div className="hh-grab" />
              <h3 className="text-[18px] font-extrabold text-rose-600">Delete this line?</h3>
              <p className="text-[13px] text-slate-600">
                {target.productName || target.rawName} · {target.qty} cs · ₹{money(bd.lineTotal)}
              </p>
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setPhoneDeleteConfirmId(null)}
                  className="hh-inv-btn-outline w-full"
                >
                  Keep
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleDeleteRow(target.id);
                    setPhoneDeleteConfirmId(null);
                    setEditingRowId(null);
                    setMobileSubView('overview');
                  }}
                  className="hh-inv-btn-danger w-full"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
};
