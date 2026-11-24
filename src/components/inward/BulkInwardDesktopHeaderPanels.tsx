import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  Truck,
} from 'lucide-react';
import { Warehouse } from '../../types';
import { money } from '../../utils/billing';
import { KnownSupplier } from './bulkInwardTypes';

interface BulkInwardDesktopHeaderPanelsProps {
  paletteLine: string;
  warehouses: Warehouse[];
  knownSuppliers: KnownSupplier[];
  applySupplierAutofill: (nameVal: string, currentPhone?: string, currentGstin?: string) => void;
  supplierName: string;
  setSupplierName: React.Dispatch<React.SetStateAction<string>>;
  supplierPhone: string;
  setSupplierPhone: React.Dispatch<React.SetStateAction<string>>;
  supplierPhoneError: string | null;
  supplierGstin: string;
  setSupplierGstin: React.Dispatch<React.SetStateAction<string>>;
  supplierAddress: string;
  setSupplierAddress: React.Dispatch<React.SetStateAction<string>>;
  supplierEmail: string;
  setSupplierEmail: React.Dispatch<React.SetStateAction<string>>;
  invoiceNo: string;
  setInvoiceNo: React.Dispatch<React.SetStateAction<string>>;
  inwardDate: string;
  setInwardDate: React.Dispatch<React.SetStateAction<string>>;
  targetWarehouseId: string;
  setTargetWarehouseId: React.Dispatch<React.SetStateAction<string>>;
  overallDiscount: number;
  setOverallDiscount: React.Dispatch<React.SetStateAction<number>>;
  originalInvoiceTotal: number | null;
  setOriginalInvoiceTotal: React.Dispatch<React.SetStateAction<number | null>>;
  detectedSource: string;
  isUpperDetailsExpanded: boolean;
  setIsUpperDetailsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  showProviderDetails: boolean;
  setShowProviderDetails: React.Dispatch<React.SetStateAction<boolean>>;
  showInwardCostDetails: boolean;
  setShowInwardCostDetails: React.Dispatch<React.SetStateAction<boolean>>;
  freightCost: number;
  setFreightCost: React.Dispatch<React.SetStateAction<number>>;
  loadingLabourCost: number;
  setLoadingLabourCost: React.Dispatch<React.SetStateAction<number>>;
  unloadingLabourCost: number;
  setUnloadingLabourCost: React.Dispatch<React.SetStateAction<number>>;
  transportCost: number;
  setTransportCost: React.Dispatch<React.SetStateAction<number>>;
  otherInwardCost: number;
  setOtherInwardCost: React.Dispatch<React.SetStateAction<number>>;
  totalInwardCost: number;
  inwardCostPerCrate: number;
  rowsCount: number;
  totalReceivedQty: number;
  totalInvoicePrintedQty: number;
  printedTotalCases: number | null;
  hasCasesMismatch: boolean;
  casesDiff: number;
  totalSupplierSchemeBonusQty: number;
  showMismatchDetail: boolean;
  setShowMismatchDetail: React.Dispatch<React.SetStateAction<boolean>>;
  calculatedGrandTotal: number;
  amountDiff: number;
  hasAmountMismatch: boolean;
  totalTax: number;
  showAmountMismatchDetail: boolean;
  setShowAmountMismatchDetail: React.Dispatch<React.SetStateAction<boolean>>;
  handleBulkSetListPriceGst: (isIncluded: boolean) => void;
  attentionCount: number;
  missingExpiryCount: number;
  missingBatchCount: number;
  filterAttentionOnly: boolean;
  setFilterAttentionOnly: React.Dispatch<React.SetStateAction<boolean>>;
  setFilterNewOnly: React.Dispatch<React.SetStateAction<boolean>>;
  setFilterSchemeOnly: React.Dispatch<React.SetStateAction<boolean>>;
  aiWarnings: string[];
}

export const BulkInwardDesktopHeaderPanels: React.FC<BulkInwardDesktopHeaderPanelsProps> = ({
  paletteLine,
  warehouses,
  knownSuppliers,
  applySupplierAutofill,
  supplierName,
  setSupplierName,
  supplierPhone,
  setSupplierPhone,
  supplierPhoneError,
  supplierGstin,
  setSupplierGstin,
  supplierAddress,
  setSupplierAddress,
  supplierEmail,
  setSupplierEmail,
  invoiceNo,
  setInvoiceNo,
  inwardDate,
  setInwardDate,
  targetWarehouseId,
  setTargetWarehouseId,
  overallDiscount,
  setOverallDiscount,
  originalInvoiceTotal,
  setOriginalInvoiceTotal,
  detectedSource,
  isUpperDetailsExpanded,
  setIsUpperDetailsExpanded,
  showProviderDetails,
  setShowProviderDetails,
  showInwardCostDetails,
  setShowInwardCostDetails,
  freightCost,
  setFreightCost,
  loadingLabourCost,
  setLoadingLabourCost,
  unloadingLabourCost,
  setUnloadingLabourCost,
  transportCost,
  setTransportCost,
  otherInwardCost,
  setOtherInwardCost,
  totalInwardCost,
  inwardCostPerCrate,
  rowsCount,
  totalReceivedQty,
  totalInvoicePrintedQty,
  printedTotalCases,
  hasCasesMismatch,
  casesDiff,
  totalSupplierSchemeBonusQty,
  showMismatchDetail,
  setShowMismatchDetail,
  calculatedGrandTotal,
  amountDiff,
  hasAmountMismatch,
  totalTax,
  showAmountMismatchDetail,
  setShowAmountMismatchDetail,
  handleBulkSetListPriceGst,
  attentionCount,
  missingExpiryCount,
  missingBatchCount,
  filterAttentionOnly,
  setFilterAttentionOnly,
  setFilterNewOnly,
  setFilterSchemeOnly,
  aiWarnings,
}) => {
  return (
    <>
      {/* REVIEW STATUS BAR — identity + live discrepancy checks */}
      <div
        className="bg-slate-900 text-white px-3 sm:px-4 py-1.5 border-b flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs shrink-0"
        style={{ borderColor: paletteLine }}
      >
        {/* Identity (click to open bill details) */}
        <button
          type="button"
          onClick={() => setIsUpperDetailsExpanded((prev) => !prev)}
          className="flex items-center gap-2 min-w-0 text-left cursor-pointer hover:text-indigo-200 transition-colors"
          title="Click to edit supplier, invoice, vehicle, taxes & godown"
        >
          <Building2 size={14} className="text-indigo-400 shrink-0" />
          <span className="font-bold truncate max-w-[140px] sm:max-w-[220px]" title={supplierName}>
            {supplierName || 'Supplier'}
          </span>
          <span className="font-mono text-indigo-300 text-xs font-semibold shrink-0">#{invoiceNo || 'N/A'}</span>
          <span className="hidden md:inline text-slate-400 text-xs shrink-0">{inwardDate}</span>
          {isUpperDetailsExpanded ? (
            <ChevronUp size={12} className="text-slate-400 shrink-0" />
          ) : (
            <ChevronDown size={12} className="text-slate-400 shrink-0" />
          )}
        </button>

        <span
          className={`px-1.5 py-0.5 rounded text-xs font-semibold border shrink-0 ${
            targetWarehouseId
              ? 'bg-slate-800 text-indigo-200 border-slate-700'
              : 'bg-rose-600 text-white border-rose-400 animate-pulse'
          }`}
        >
          {targetWarehouseId
            ? warehouses.find((w) => w.id === targetWarehouseId)?.name || 'Godown'
            : 'Pick godown ▸ open bill details'}
        </span>

        <span className="hidden sm:block h-5 w-px bg-slate-700" />

        {/* Live discrepancy checks */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Cases check */}
          <button
            type="button"
            onClick={() => hasCasesMismatch && setShowMismatchDetail((v) => !v)}
            className={`px-2 py-0.5 rounded border font-semibold flex items-center gap-1 text-xs ${
              hasCasesMismatch
                ? 'bg-red-600 border-red-300 text-white cursor-pointer hover:bg-red-500'
                : 'bg-emerald-900/50 border-emerald-700 text-emerald-200 cursor-default'
            }`}
            title={
              hasCasesMismatch
                ? 'Click for details'
                : printedTotalCases !== null
                ? 'Table total matches the printed invoice case count'
                : 'No printed case count was detected on the invoice'
            }
          >
            {hasCasesMismatch ? <AlertTriangle size={12} className="text-amber-200" /> : <Check size={12} />}
            <span>
              Cases <strong className="font-mono">{totalInvoicePrintedQty.toLocaleString()}</strong>
              {printedTotalCases !== null && (
                <>
                  {' '}
                  {hasCasesMismatch ? 'vs printed' : '= printed'}{' '}
                  <strong className="font-mono">{printedTotalCases.toLocaleString()}</strong>
                </>
              )}
            </span>
            {hasCasesMismatch && (
              <span className="font-mono font-black bg-red-950 px-1 rounded">
                {casesDiff > 0 ? `+${casesDiff}` : casesDiff}
              </span>
            )}
            {totalSupplierSchemeBonusQty > 0 && (
              <span className="text-xs font-normal opacity-80">(+{totalSupplierSchemeBonusQty} bonus)</span>
            )}
          </button>

          {/* Amount check (informational only with interactive resolution helper) */}
          {originalInvoiceTotal !== null && (
            <button
              type="button"
              onClick={() => setShowAmountMismatchDetail((v) => !v)}
              className={`px-2 py-0.5 rounded border font-semibold flex items-center gap-1 text-xs cursor-pointer transition-colors ${
                hasAmountMismatch
                  ? 'bg-amber-500/20 border-amber-400 text-amber-200 hover:bg-amber-500/30'
                  : 'bg-emerald-900/50 border-emerald-700 text-emerald-200'
              }`}
              title={`Calculated ₹${money(calculatedGrandTotal)} vs party invoice ₹${money(originalInvoiceTotal)}. Click for breakdown & 1-click fix.`}
            >
              {hasAmountMismatch ? <AlertTriangle size={12} /> : <Check size={12} />}
              <span>
                Amount{' '}
                {hasAmountMismatch ? (
                  <>
                    <strong className="font-mono">{amountDiff > 0 ? '+' : '−'}₹{money(Math.abs(amountDiff))}</strong> vs party
                  </>
                ) : (
                  'matches party'
                )}
              </span>
            </button>
          )}

          {/* Needs attention (missing batch / missing expiry / zero rate) */}
          {attentionCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setFilterAttentionOnly((v) => !v);
                setFilterNewOnly(false);
                setFilterSchemeOnly(false);
              }}
              className={`px-2 py-0.5 rounded border font-semibold flex items-center gap-1 text-xs cursor-pointer ${
                filterAttentionOnly
                  ? 'bg-amber-400 border-amber-200 text-slate-900'
                  : 'bg-amber-500/20 border-amber-400 text-amber-200 hover:bg-amber-500/30'
              }`}
              title="Lines with a missing batch number, missing expiry date or a zero rate — click to show only these"
            >
              <AlertCircle size={12} />
              <span>
                {attentionCount} need{attentionCount === 1 ? 's' : ''} attention
                {missingExpiryCount > 0 && ` (${missingExpiryCount} no expiry)`}
                {missingBatchCount > 0 && ` (${missingBatchCount} no batch)`}
              </span>
            </button>
          )}
        </div>

        {/* Right side: totals + costs toggle */}
        <div className="flex items-center gap-2 sm:gap-3 ml-auto shrink-0">
          <span className="hidden md:inline text-slate-300 text-xs font-mono">
            <strong className="text-white">{rowsCount}</strong> items •{' '}
            <strong className="text-emerald-300">{totalReceivedQty.toLocaleString()}</strong> cs
          </span>

          <button
            type="button"
            onClick={() => setShowInwardCostDetails((v) => !v)}
            className={`px-2 py-0.5 rounded border text-xs font-semibold flex items-center gap-1 cursor-pointer ${
              showInwardCostDetails
                ? 'bg-amber-400 border-amber-200 text-slate-900'
                : 'bg-slate-800 border-slate-600 text-amber-200 hover:bg-slate-700'
            }`}
            title="Freight, labour & transport costs allocated to landed cost"
          >
            <Truck size={12} />
            <span className="font-mono">
              {totalInwardCost > 0 ? `₹${money(totalInwardCost)}` : 'Freight & Labour'}
            </span>
            {showInwardCostDetails ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>

          <div className="bg-indigo-950 px-2.5 py-0.5 rounded border border-indigo-700/60 flex items-center gap-1">
            <span className="text-indigo-300 text-xs uppercase font-bold">Total</span>
            <span className="font-extrabold text-amber-300 text-xs sm:text-sm font-mono">
              ₹{money(calculatedGrandTotal)}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Landing Costs Bar (Always accessible Freight & Labour inputs) */}
      {showInwardCostDetails && (
        <div className="bg-amber-50/90 border-b border-amber-200 px-3 sm:px-4 py-1.5 flex flex-wrap items-center gap-2 text-xs shrink-0">
          <span className="font-bold text-amber-950 flex items-center gap-1">
            <Truck size={13} /> Freight &amp; Labour (Auto-updates Landed/cr):
          </span>
          {(
            [
              ['Freight', freightCost, setFreightCost, 50],
              ['Labour', loadingLabourCost, setLoadingLabourCost, 25],
              ['Unloading', unloadingLabourCost, setUnloadingLabourCost, 25],
              ['Transport', transportCost, setTransportCost, 50],
              ['Other', otherInwardCost, setOtherInwardCost, 25],
            ] as [string, number, (n: number) => void, number][]
          ).map(([label, val, setter, step]) => (
            <label
              key={label}
              className="flex items-center gap-1 bg-white border border-amber-300 rounded px-1.5 py-0.5"
            >
              <span className="text-xs text-slate-600 font-medium">{label}</span>
              <span className="font-mono text-slate-500">₹</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step={step}
                value={val || ''}
                onChange={(e) => setter(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-16 font-mono text-xs font-bold text-slate-900 text-right bg-transparent focus:outline-hidden tabular-nums"
                placeholder="0"
              />
            </label>
          ))}
          <span className="ml-auto text-xs text-amber-900 font-semibold font-mono tabular-nums">
            Total ₹{money(totalInwardCost)}
            {totalReceivedQty > 0 ? ` (+₹${money(inwardCostPerCrate)}/cs over ${totalReceivedQty} cs)` : ''}
          </span>
        </div>
      )}

      {/* AI cross-check notes (row arithmetic, totals, GSTIN ...) */}
      {aiWarnings.length > 0 && (
        <details className="bg-amber-50 border-b border-amber-300 px-3 sm:px-4 py-1.5 text-xs text-amber-900 shrink-0 group">
          <summary className="flex items-center gap-2 cursor-pointer select-none font-semibold list-none">
            <AlertTriangle size={14} className="text-amber-600 shrink-0" />
            <span>
              AI read this invoice but {aiWarnings.length} point{aiWarnings.length === 1 ? '' : 's'} need
              {aiWarnings.length === 1 ? 's' : ''} a quick check
            </span>
            <span className="ml-auto text-amber-700 font-normal group-open:hidden">show</span>
            <span className="ml-auto text-amber-700 font-normal hidden group-open:inline">hide</span>
          </summary>
          <ul className="mt-1.5 mb-0.5 ml-6 list-disc space-y-0.5 leading-snug max-h-32 overflow-y-auto pr-2">
            {aiWarnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}

      {/* Cases mismatch detail (only when the red chip is clicked) */}
      {hasCasesMismatch && showMismatchDetail && (
        <div className="bg-red-50 border-b-2 border-red-400 px-3 sm:px-4 py-1.5 text-xs text-red-900 flex items-start gap-2 shrink-0">
          <AlertTriangle size={14} className="text-red-600 shrink-0 mt-0.5" />
          <p className="flex-1 leading-snug">
            <strong>Cases mismatch ({casesDiff > 0 ? `+${casesDiff}` : casesDiff}):</strong> the table's
            invoice-equivalent total is <strong>{totalInvoicePrintedQty.toLocaleString()} cs</strong> but the
            supplier invoice printed <strong>{printedTotalCases?.toLocaleString()} cs</strong>. The printed count
            is the total crates physically received, including free scheme crates already billed — verify line
            quantities and scheme free counts.
          </p>
          <button
            type="button"
            onClick={() => setShowMismatchDetail(false)}
            className="text-red-500 hover:text-red-800 font-bold px-1 cursor-pointer"
            title="Hide details"
          >
            ✕
          </button>
        </div>
      )}

      {/* Amount mismatch detail & 1-click resolution */}
      {hasAmountMismatch && showAmountMismatchDetail && originalInvoiceTotal !== null && (
        <div className="bg-amber-50 border-b-2 border-amber-400 px-3 sm:px-4 py-2 text-xs text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shrink-0">
          <div className="flex items-start gap-2">
            <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="leading-snug">
              <p className="font-bold">
                Amount Mismatch: Rows add up to ₹{money(calculatedGrandTotal)} but party invoice total is ₹{money(originalInvoiceTotal)} (difference ₹{money(Math.abs(amountDiff))}).
              </p>
              <p className="text-xs text-amber-800 mt-0.5">
                {Math.abs(amountDiff - totalTax) < 2 ? (
                  <span>
                    💡 <strong>Notice:</strong> The difference of <strong>₹{money(Math.abs(amountDiff))}</strong> matches <strong>Total GST (₹{money(totalTax)})</strong>. Party total ₹{money(originalInvoiceTotal)} was recorded as Taxable Base (before GST), whereas line totals include GST.
                  </span>
                ) : (
                  <span>
                    Check quantities, unit rates, discounts and whether list prices include or exclude GST.
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
            <button
              type="button"
              onClick={() => {
                setOriginalInvoiceTotal(calculatedGrandTotal);
                setShowAmountMismatchDetail(false);
              }}
              className="px-2 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer shadow-xs transition-colors"
              title="Set Party Invoice Total to calculated grand total with GST"
            >
              Sync Party Total to ₹{money(calculatedGrandTotal)}
            </button>
            <button
              type="button"
              onClick={() => {
                handleBulkSetListPriceGst(true);
                setShowAmountMismatchDetail(false);
              }}
              className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer shadow-xs transition-colors"
              title="Mark all line items as GST-Inclusive rates"
            >
              Switch to GST Incl
            </button>
            <button
              type="button"
              onClick={() => setShowAmountMismatchDetail(false)}
              className="text-slate-400 hover:text-slate-600 font-bold px-1.5 py-0.5 cursor-pointer"
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 2. EXPANDED VIEW (FULL INVOICE & TAX CONTROLS WITH QUICK COLLAPSE) */}
      {isUpperDetailsExpanded && (
        <div className="bg-slate-50 border-b shrink-0 transition-all shadow-inner max-h-[45vh] overflow-y-auto" style={{ borderColor: paletteLine }}>
          {/* Header Banner with Close/Contract action */}
          <div className="bg-indigo-950 text-white px-3 sm:px-6 py-1.5 flex items-center justify-between text-xs border-b border-indigo-800">
            <div className="flex items-center gap-2 min-w-0">
              <Building2 size={14} className="text-indigo-400 shrink-0" />
              <span className="font-bold text-xs uppercase tracking-wide truncate">
                Invoice Header & Dispatch Details
              </span>
              <span className="hidden sm:inline text-indigo-300 text-xs">
                (Modify supplier info, vehicle, taxes or godown below)
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsUpperDetailsExpanded(false)}
              className="px-2.5 py-0.5 bg-indigo-700 hover:bg-indigo-600 text-white font-bold rounded text-xs flex items-center gap-1 cursor-pointer shadow-sm shrink-0"
              title="Contract upper details to maximize product review workspace"
            >
              <ChevronUp size={13} />
              <span>Contract Upper Info ▲</span>
            </button>
          </div>

          {/* Editable Invoice Fields - Grid */}
          <div className="px-3 sm:px-6 py-2.5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-2.5 text-xs">
            <div>
              <label className="text-xs text-slate-500 font-semibold block mb-0.5">Supplier Name</label>
              <input
                list="bulk-inward-known-suppliers"
                type="text"
                value={supplierName}
                onChange={(e) => {
                  const v = e.target.value;
                  setSupplierName(v);
                  applySupplierAutofill(v);
                }}
                onBlur={(e) => applySupplierAutofill(e.target.value)}
                className="w-full font-bold text-slate-900 bg-white border border-slate-300 rounded px-2 py-1 text-xs focus:border-indigo-500"
              />
              <datalist id="bulk-inward-known-suppliers">
                {knownSuppliers.map((s) => (
                  <option key={s.name} value={s.name} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="text-xs text-slate-500 font-semibold block mb-0.5">Supplier Phone</label>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={supplierPhone}
                onChange={(e) => setSupplierPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className={`w-full font-mono bg-white border rounded px-2 py-1 text-xs focus:border-indigo-500 ${
                  supplierPhoneError ? 'border-rose-400 text-rose-800' : 'border-slate-300 text-slate-800'
                }`}
              />
              {supplierPhoneError && (
                <p className="text-xs text-rose-600 font-medium mt-0.5">{supplierPhoneError}</p>
              )}
            </div>

            <div>
              <label className="text-xs text-slate-500 font-semibold block mb-0.5">Supplier GSTIN</label>
              <input autoCapitalize="characters" autoComplete="off" autoCorrect="off" spellCheck={false}
                type="text"
                value={supplierGstin}
                onChange={(e) => setSupplierGstin(e.target.value)}
                className="w-full font-mono text-slate-800 bg-white border border-slate-300 rounded px-2 py-1 text-xs focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs text-slate-500 font-semibold block mb-0.5">Invoice #</label>
              <input
                type="text"
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                className="w-full font-mono font-bold text-indigo-700 bg-white border border-slate-300 rounded px-2 py-1 text-xs focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs text-slate-500 font-semibold block mb-0.5">Invoice Date</label>
              <input
                type="date"
                value={inwardDate}
                onChange={(e) => setInwardDate(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs text-slate-500 font-semibold block mb-0.5">
                Inward To Godown <span className="text-rose-600">*</span>
              </label>
              <select
                value={targetWarehouseId}
                onChange={(e) => setTargetWarehouseId(e.target.value)}
                required
                className={`w-full bg-white border rounded px-2 py-1 text-xs font-semibold focus:border-indigo-500 ${
                  !targetWarehouseId ? 'border-rose-400 bg-rose-50 text-rose-700' : 'border-slate-300 text-slate-800'
                }`}
              >
                <option value="">Select warehouse... (mandatory)</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </select>
              {!targetWarehouseId && (
                <p className="text-xs text-rose-600 font-semibold mt-0.5">
                  Required — no default warehouse. Pick where this invoice is being received.
                </p>
              )}
            </div>

            <div>
              <label className="text-xs text-slate-500 font-semibold block mb-0.5">Bill Discount (₹)</label>
              <input
                type="number" inputMode="decimal"
                min="0"
                step="0.01"
                value={overallDiscount}
                onChange={(e) => setOverallDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                placeholder="0.00"
                className="w-full font-mono font-bold text-rose-600 bg-white border border-slate-300 rounded px-2 py-1 text-xs focus:border-rose-500"
              />
            </div>

            <div>
              <label className="text-xs text-slate-500 font-semibold block mb-0.5">Party Invoice Total (₹)</label>
              <input
                type="number" inputMode="decimal"
                min="0"
                step="0.01"
                value={originalInvoiceTotal ?? ''}
                onChange={(e) => setOriginalInvoiceTotal(e.target.value === '' ? null : Math.max(0, parseFloat(e.target.value) || 0))}
                placeholder="e.g. 283340"
                className="w-full font-mono font-bold text-indigo-700 bg-white border border-slate-300 rounded px-2 py-1 text-xs focus:border-indigo-500"
                title="Printed Grand Total from supplier tax invoice"
              />
            </div>
          </div>

          {/* Additional Provider Details Bar */}
          <div className="px-3 sm:px-6 py-1.5 bg-slate-100/80 border-t border-slate-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowProviderDetails((prev) => !prev)}
                className="px-2 py-0.5 text-xs font-semibold text-indigo-700 bg-white hover:bg-indigo-50 rounded border border-indigo-200 flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Building2 size={12} />
                <span>{showProviderDetails ? 'Hide Provider Details' : 'Full Provider Address & Consignee'}</span>
                {showProviderDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              {detectedSource && (
                <span className="text-xs text-slate-500 hidden md:inline">
                  Source: {detectedSource}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsUpperDetailsExpanded(false)}
              className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 flex items-center gap-1 cursor-pointer"
            >
              <span>Done, Contract Info</span>
              <ChevronUp size={12} />
            </button>
          </div>

          {/* EXPANDABLE INVOICE PROVIDER & DISPATCH DETAILS PANEL */}
          {showProviderDetails && (
            <div className="bg-indigo-50/80 border-t border-indigo-100 px-3 sm:px-6 py-2.5 transition-all">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
                <div className="lg:col-span-3">
                  <label className="text-xs font-semibold text-slate-700 block mb-0.5">
                    Supplier Registered Address
                  </label>
                  <input
                    type="text"
                    value={supplierAddress}
                    onChange={(e) => setSupplierAddress(e.target.value)}
                    placeholder="e.g. Main Road, Kuchinda - 768222"
                    className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 focus:border-indigo-500 shadow-sm"
                  />
                </div>

                <div className="lg:col-span-3">
                  <label className="text-xs font-semibold text-slate-700 block mb-0.5">
                    Supplier Email
                  </label>
                  <input
                    type="text"
                    value={supplierEmail}
                    onChange={(e) => setSupplierEmail(e.target.value)}
                    placeholder="e.g. supplier@gmail.com"
                    className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 focus:border-indigo-500 shadow-sm"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};
