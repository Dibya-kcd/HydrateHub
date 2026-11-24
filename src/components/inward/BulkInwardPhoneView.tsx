import React from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { GrnSchemeType, Product, Warehouse } from '../../types';
import { money } from '../../utils/billing';
import { UploadStep } from './UploadStep';
import { calcInwardRowBreakdown, EditableInwardRow, KnownSupplier } from './bulkInwardTypes';
import { BulkInwardPhoneConfirmStep } from './phone/BulkInwardPhoneConfirmStep';
import {
  BulkInwardPhoneBillSubView,
  BulkInwardPhoneCostsSubView,
  BulkInwardPhoneEditLineSubView,
} from './phone/BulkInwardPhoneSubViews';
import { BulkInwardPhoneSheets } from './phone/BulkInwardPhoneSheets';

interface BulkInwardPhoneViewProps {
  onClose: () => void;
  step: 'upload' | 'review';
  setStep: React.Dispatch<React.SetStateAction<'upload' | 'review'>>;
  mobileSubView: 'overview' | 'bill' | 'costs' | 'edit_line';
  setMobileSubView: React.Dispatch<React.SetStateAction<'overview' | 'bill' | 'costs' | 'edit_line'>>;
  editingRowId: string | null;
  setEditingRowId: React.Dispatch<React.SetStateAction<string | null>>;
  showConfirmStep: boolean;
  setShowConfirmStep: React.Dispatch<React.SetStateAction<boolean>>;
  confirmQuery: string;
  setConfirmQuery: React.Dispatch<React.SetStateAction<string>>;
  rows: EditableInwardRow[];
  setRows: React.Dispatch<React.SetStateAction<EditableInwardRow[]>>;
  filteredRows: EditableInwardRow[];
  products: Product[];
  warehouses: Warehouse[];
  knownSuppliers: KnownSupplier[];
  applySupplierAutofill: (nameVal: string, currentPhone?: string, currentGstin?: string) => void;
  // Invoice fields
  supplierName: string;
  setSupplierName: React.Dispatch<React.SetStateAction<string>>;
  supplierPhone: string;
  setSupplierPhone: React.Dispatch<React.SetStateAction<string>>;
  supplierPhoneError: string | null;
  supplierGstin: string;
  setSupplierGstin: React.Dispatch<React.SetStateAction<string>>;
  invoiceNo: string;
  setInvoiceNo: React.Dispatch<React.SetStateAction<string>>;
  inwardDate: string;
  setInwardDate: React.Dispatch<React.SetStateAction<string>>;
  targetWarehouseId: string;
  setTargetWarehouseId: React.Dispatch<React.SetStateAction<string>>;
  vehicleNo: string;
  setVehicleNo: React.Dispatch<React.SetStateAction<string>>;
  overallDiscount: number;
  setOverallDiscount: React.Dispatch<React.SetStateAction<number>>;
  originalInvoiceTotal: number | null;
  setOriginalInvoiceTotal: React.Dispatch<React.SetStateAction<number | null>>;
  // Inward costs
  transportCost: number;
  setTransportCost: React.Dispatch<React.SetStateAction<number>>;
  freightCost: number;
  setFreightCost: React.Dispatch<React.SetStateAction<number>>;
  loadingLabourCost: number;
  setLoadingLabourCost: React.Dispatch<React.SetStateAction<number>>;
  unloadingLabourCost: number;
  setUnloadingLabourCost: React.Dispatch<React.SetStateAction<number>>;
  otherInwardCost: number;
  setOtherInwardCost: React.Dispatch<React.SetStateAction<number>>;
  invoiceRoundOff: number;
  setInvoiceRoundOff: React.Dispatch<React.SetStateAction<number>>;
  invoiceOtherCharges: number;
  setInvoiceOtherCharges: React.Dispatch<React.SetStateAction<number>>;
  totalInwardCost: number;
  inwardCostPerCrate: number;
  // Totals & checks
  printedTotalCases: number | null;
  totalInvoicePrintedQty: number;
  totalFreeQty: number;
  totalSupplierSchemeBonusQty: number;
  totalReceivedQty: number;
  hasCasesMismatch: boolean;
  casesDiff: number;
  calculatedGrandTotal: number;
  totalLandedInventoryValue: number;
  totalTax: number;
  amountDiff: number;
  hasAmountMismatch: boolean;
  attentionCount: number;
  // Filters & view mode
  filterAttentionOnly: boolean;
  setFilterAttentionOnly: React.Dispatch<React.SetStateAction<boolean>>;
  viewMode: 'table' | 'cards';
  setViewMode: React.Dispatch<React.SetStateAction<'table' | 'cards'>>;
  // Dialogs & sheets
  parseError: string | null;
  setParseError: React.Dispatch<React.SetStateAction<string | null>>;
  aiWarnings: string[];
  phoneDismissWarning: boolean;
  setPhoneDismissWarning: React.Dispatch<React.SetStateAction<boolean>>;
  showMismatchDetail: boolean;
  setShowMismatchDetail: React.Dispatch<React.SetStateAction<boolean>>;
  showAmountMismatchDetail: boolean;
  setShowAmountMismatchDetail: React.Dispatch<React.SetStateAction<boolean>>;
  showWarningDialog: boolean;
  setShowWarningDialog: React.Dispatch<React.SetStateAction<boolean>>;
  warningNote: string;
  setWarningNote: React.Dispatch<React.SetStateAction<string>>;
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
  // Upload props
  isDragging: boolean;
  setIsDragging: React.Dispatch<React.SetStateAction<boolean>>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  processUploadedFile: (file: File) => void;
  isParsing: boolean;
  parsingStatus: string;
  handleDownloadCsvSample: () => void;
  handleDownloadSample: () => void;
  handleStartBlankConsignment: () => void;
  lastUploadedFile: File | null;
  fileName: string | null;
  // Actions
  updateRowField: (id: string, field: keyof EditableInwardRow, val: any) => void;
  handleCatalogMappingChange: (rowId: string, targetValue: string) => void;
  handleDeleteRow: (rowId: string) => void;
  handleAddNewRow: () => void;
  handleAutoGenerateAllBatches: () => void;
  handleApplyBulkScheme: () => void;
  handleConfirmAndPostGrn: () => void;
  handleImportWithWarning: () => void;
}

export const BulkInwardPhoneView: React.FC<BulkInwardPhoneViewProps> = ({
  onClose,
  step,
  setStep,
  mobileSubView,
  setMobileSubView,
  editingRowId,
  setEditingRowId,
  showConfirmStep,
  setShowConfirmStep,
  confirmQuery,
  setConfirmQuery,
  rows,
  setRows,
  filteredRows,
  products,
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
  invoiceNo,
  setInvoiceNo,
  inwardDate,
  setInwardDate,
  targetWarehouseId,
  setTargetWarehouseId,
  vehicleNo,
  setVehicleNo,
  overallDiscount,
  setOverallDiscount,
  originalInvoiceTotal,
  setOriginalInvoiceTotal,
  transportCost,
  setTransportCost,
  freightCost,
  setFreightCost,
  loadingLabourCost,
  setLoadingLabourCost,
  unloadingLabourCost,
  setUnloadingLabourCost,
  otherInwardCost,
  setOtherInwardCost,
  invoiceRoundOff,
  setInvoiceRoundOff,
  invoiceOtherCharges,
  setInvoiceOtherCharges,
  totalInwardCost,
  inwardCostPerCrate,
  printedTotalCases,
  totalInvoicePrintedQty,
  totalFreeQty,
  totalSupplierSchemeBonusQty,
  totalReceivedQty,
  hasCasesMismatch,
  casesDiff,
  calculatedGrandTotal,
  totalLandedInventoryValue,
  totalTax,
  amountDiff,
  hasAmountMismatch,
  attentionCount,
  filterAttentionOnly,
  setFilterAttentionOnly,
  viewMode,
  setViewMode,
  parseError,
  setParseError,
  aiWarnings,
  phoneDismissWarning,
  setPhoneDismissWarning,
  showMismatchDetail,
  setShowMismatchDetail,
  showAmountMismatchDetail,
  setShowAmountMismatchDetail,
  showWarningDialog,
  setShowWarningDialog,
  warningNote,
  setWarningNote,
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
  isDragging,
  setIsDragging,
  fileInputRef,
  processUploadedFile,
  isParsing,
  parsingStatus,
  handleDownloadCsvSample,
  handleDownloadSample,
  handleStartBlankConsignment,
  lastUploadedFile,
  fileName,
  updateRowField,
  handleCatalogMappingChange,
  handleDeleteRow,
  handleAddNewRow,
  handleAutoGenerateAllBatches,
  handleApplyBulkScheme,
  handleConfirmAndPostGrn,
  handleImportWithWarning,
}) => {
  const whObj = warehouses.find((w) => w.id === targetWarehouseId);
  const activeEditRow = rows.find((r) => r.id === editingRowId) || null;
  const lineBreakdown = (r: EditableInwardRow) => calcInwardRowBreakdown(r, inwardCostPerCrate);

  const compactMoney = (val: number) => {
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)}L`;
    return `₹${money(val)}`;
  };

  if (showConfirmStep) {
    return (
      <BulkInwardPhoneConfirmStep
        rows={rows}
        confirmQuery={confirmQuery}
        setConfirmQuery={setConfirmQuery}
        parseError={parseError}
        invoiceNo={invoiceNo}
        targetWarehouseId={targetWarehouseId}
        whObj={whObj}
        inwardCostPerCrate={inwardCostPerCrate}
        printedTotalCases={printedTotalCases}
        totalReceivedQty={totalReceivedQty}
        casesDiff={casesDiff}
        hasCasesMismatch={hasCasesMismatch}
        calculatedGrandTotal={calculatedGrandTotal}
        setShowConfirmStep={setShowConfirmStep}
        handleConfirmAndPostGrn={handleConfirmAndPostGrn}
        showWarningDialog={showWarningDialog}
        setShowWarningDialog={setShowWarningDialog}
        warningNote={warningNote}
        setWarningNote={setWarningNote}
        handleImportWithWarning={handleImportWithWarning}
      />
    );
  }

  return (
    <>
      <div role="dialog" aria-modal="true" aria-label="Bulk inward" className="rt-flow-phone">
        <div className="hh-sales-top hh-sales-top--flush hh-inv-top--flow">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                if (step === 'review' && mobileSubView !== 'overview') {
                  setMobileSubView('overview');
                } else if (step === 'review') {
                  setStep('upload');
                } else {
                  onClose();
                }
              }}
              className="hh-inv-backbtn"
            >
              <ArrowLeft size={19} />
              <span>{step === 'upload' ? 'Bulk purchase import' : 'Review purchase'}</span>
            </button>
            {step === 'review' && (
              <button
                type="button"
                onClick={() => {
                  setMobileSubView('overview');
                  setStep('upload');
                }}
                className="hh-inv-glass-pill"
              >
                Change file
              </button>
            )}
          </div>

          <div className="hh-inv-seg">
            <div className="hh-inv-seg__bar hh-inv-seg__bar--on" />
            <div className={`hh-inv-seg__bar ${step === 'review' ? 'hh-inv-seg__bar--on' : ''}`} />
          </div>

          <div className="text-[12px] font-semibold text-white/90">
            {step === 'upload' ? 'Step 1 of 2 · Upload / Scan' : 'Step 2 of 2 · Review lines'}
          </div>
        </div>

        {step === 'upload' ? (
          <UploadStep
            isDragging={isDragging}
            setIsDragging={setIsDragging}
            fileInputRef={fileInputRef}
            processUploadedFile={processUploadedFile}
            isParsing={isParsing}
            parsingStatus={parsingStatus}
            handleDownloadCsvSample={handleDownloadCsvSample}
            handleDownloadSample={handleDownloadSample}
            handleStartBlankConsignment={handleStartBlankConsignment}
            parseError={parseError}
            lastUploadedFile={lastUploadedFile}
            uploadedFileName={fileName}
            onClearError={() => setParseError(null)}
          />
        ) : mobileSubView === 'bill' ? (
          <BulkInwardPhoneBillSubView
            knownSuppliers={knownSuppliers}
            applySupplierAutofill={applySupplierAutofill}
            supplierName={supplierName}
            setSupplierName={setSupplierName}
            supplierPhone={supplierPhone}
            setSupplierPhone={setSupplierPhone}
            supplierPhoneError={supplierPhoneError}
            supplierGstin={supplierGstin}
            setSupplierGstin={setSupplierGstin}
            invoiceNo={invoiceNo}
            setInvoiceNo={setInvoiceNo}
            inwardDate={inwardDate}
            setInwardDate={setInwardDate}
            targetWarehouseId={targetWarehouseId}
            setTargetWarehouseId={setTargetWarehouseId}
            warehouses={warehouses}
            vehicleNo={vehicleNo}
            setVehicleNo={setVehicleNo}
            overallDiscount={overallDiscount}
            setOverallDiscount={setOverallDiscount}
            originalInvoiceTotal={originalInvoiceTotal}
            setOriginalInvoiceTotal={setOriginalInvoiceTotal}
            totalInwardCost={totalInwardCost}
            setMobileSubView={setMobileSubView}
          />
        ) : mobileSubView === 'costs' ? (
          <BulkInwardPhoneCostsSubView
            transportCost={transportCost}
            setTransportCost={setTransportCost}
            freightCost={freightCost}
            setFreightCost={setFreightCost}
            loadingLabourCost={loadingLabourCost}
            setLoadingLabourCost={setLoadingLabourCost}
            unloadingLabourCost={unloadingLabourCost}
            setUnloadingLabourCost={setUnloadingLabourCost}
            otherInwardCost={otherInwardCost}
            setOtherInwardCost={setOtherInwardCost}
            invoiceRoundOff={invoiceRoundOff}
            setInvoiceRoundOff={setInvoiceRoundOff}
            invoiceOtherCharges={invoiceOtherCharges}
            setInvoiceOtherCharges={setInvoiceOtherCharges}
            totalInwardCost={totalInwardCost}
            totalReceivedQty={totalReceivedQty}
            totalLandedInventoryValue={totalLandedInventoryValue}
            setMobileSubView={setMobileSubView}
          />
        ) : mobileSubView === 'edit_line' && activeEditRow ? (
          <BulkInwardPhoneEditLineSubView
            row={activeEditRow}
            rows={rows}
            inwardCostPerCrate={inwardCostPerCrate}
            updateRowField={updateRowField}
            setPhoneCatalogSizeFilter={setPhoneCatalogSizeFilter}
            setCatalogPickerSearch={setCatalogPickerSearch}
            setCatalogPickerRowId={setCatalogPickerRowId}
            setPhoneDeleteConfirmId={setPhoneDeleteConfirmId}
            setMobileSubView={setMobileSubView}
          />
        ) : (
          /* Review Overview */
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-2.5">
              {parseError && (
                <div className="hh-inv-card hh-inv-card--alert-red text-[12px] font-semibold text-rose-700">
                  {parseError}
                </div>
              )}

              {aiWarnings.length > 0 && !phoneDismissWarning && (
                <div className="hh-inv-card bg-[#fef9e7] border-amber-300 flex items-start justify-between gap-2 py-2.5">
                  <div className="text-[12.5px] font-semibold text-slate-800 leading-snug">
                    <strong>Read invoice.</strong> {aiWarnings[0]}
                  </div>
                  <button
                    type="button"
                    aria-label="Dismiss note"
                    onClick={() => setPhoneDismissWarning(true)}
                    className="text-slate-400 hover:text-slate-700 p-0.5 min-w-0 min-h-0 shrink-0 cursor-pointer"
                  >
                    <X size={15} />
                  </button>
                </div>
              )}

              <div className="hh-inv-card flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[14.5px] font-extrabold text-slate-900 truncate">
                    {supplierName || 'Select supplier'}
                  </div>
                  <div className="text-[12px] text-slate-500 mt-0.5 leading-snug">
                    {invoiceNo ? `Inv ${invoiceNo}` : 'No invoice no.'} · {inwardDate} ·{' '}
                    <span className={!targetWarehouseId ? 'text-rose-600 font-bold' : ''}>
                      {whObj?.name || 'Pick godown'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileSubView('costs')}
                    className="text-xs font-bold text-[#2864d9] mt-1 min-h-0 cursor-pointer"
                  >
                    Freight &amp; Labour: ₹{money(totalInwardCost)}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileSubView('bill')}
                  className="text-[12.5px] font-bold text-[#2864d9] shrink-0 py-1 px-1 min-w-0 min-h-0 cursor-pointer"
                >
                  Edit ▾
                </button>
              </div>

              {/* Discrepancy & Action chips */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                  <button
                    type="button"
                    onClick={() => hasCasesMismatch && setShowMismatchDetail(true)}
                    className={`hh-inv-chip-compact inline-flex items-center gap-1 shrink-0 cursor-pointer border ${
                      hasCasesMismatch
                        ? 'bg-amber-50 border-amber-300 text-amber-900'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    }`}
                  >
                    <span>
                      Cases {totalInvoicePrintedQty}
                      {printedTotalCases !== null ? ` vs ${printedTotalCases}` : ''}
                    </span>
                  </button>

                  {originalInvoiceTotal !== null && (
                    <button
                      type="button"
                      onClick={() => hasAmountMismatch && setShowAmountMismatchDetail(true)}
                      className={`hh-inv-chip-compact inline-flex items-center gap-1 shrink-0 cursor-pointer border ${
                        hasAmountMismatch
                          ? 'bg-amber-50 border-amber-300 text-amber-900'
                          : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      }`}
                    >
                      <span>
                        Amount {compactMoney(calculatedGrandTotal)} vs {compactMoney(originalInvoiceTotal)}
                      </span>
                    </button>
                  )}

                  {attentionCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setFilterAttentionOnly((v) => !v)}
                      className={`hh-inv-chip-compact inline-flex items-center gap-1 shrink-0 cursor-pointer border ${
                        filterAttentionOnly
                          ? 'bg-amber-100 border-amber-400 text-amber-950'
                          : 'bg-amber-50 border-amber-300 text-amber-900'
                      }`}
                    >
                      <span>{attentionCount} need attention</span>
                      {filterAttentionOnly && <span>×</span>}
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                  <button
                    type="button"
                    onClick={() => setShowAutoBatchSheet(true)}
                    className="hh-inv-chip-compact bg-white border border-[#2864d9] text-[#2864d9] shrink-0 cursor-pointer"
                  >
                    Auto batch/tag
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBulkSchemeModal(true)}
                    className="hh-inv-chip-compact bg-white border border-[#2864d9] text-[#2864d9] shrink-0 cursor-pointer"
                  >
                    Scheme to all
                  </button>
                  <button
                    type="button"
                    onClick={handleAddNewRow}
                    className="hh-inv-chip-compact bg-white border border-[#2864d9] text-[#2864d9] shrink-0 cursor-pointer"
                  >
                    + Add
                  </button>
                </div>
              </div>

              {/* Count + Cards | Table toggle */}
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <span className="text-[12.5px] font-medium text-slate-500">
                  {filteredRows.length} line{filteredRows.length === 1 ? '' : 's'}
                  {viewMode === 'table' ? ' · swipe sideways' : ''}
                </span>
                <div className="inline-flex rounded-full bg-slate-200/80 p-0.5">
                  <button
                    type="button"
                    onClick={() => setViewMode('cards')}
                    className={`px-3 py-1 rounded-full text-[12px] font-bold min-w-0 min-h-0 cursor-pointer ${
                      viewMode === 'cards' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    Cards
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('table')}
                    className={`px-3 py-1 rounded-full text-[12px] font-bold min-w-0 min-h-0 cursor-pointer ${
                      viewMode === 'table' ? 'bg-white text-[#2864d9] shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    Table
                  </button>
                </div>
              </div>

              {viewMode === 'cards' ? (
                <div className="space-y-2.5">
                  {filteredRows.map((r) => {
                    const bd = lineBreakdown(r);
                    const isMissing = !r.batchNumber?.trim() || !r.expiry;
                    const leftAccent = isMissing
                      ? '#eab308'
                      : r.isNewProduct
                        ? '#eab308'
                        : '#16a34a';
                    return (
                      <div
                        key={r.id}
                        onClick={() => {
                          setEditingRowId(r.id);
                          setMobileSubView('edit_line');
                        }}
                        style={{ borderLeft: `3.5px solid ${leftAccent}` }}
                        className="hh-inv-card space-y-1 cursor-pointer active:scale-[0.99]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-[14.5px] font-extrabold text-slate-900 min-w-0">
                            {r.productName || r.rawName}
                          </div>
                          {isMissing ? (
                            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-xs font-bold shrink-0">
                              Batch or expiry missing
                            </span>
                          ) : r.isNewProduct ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold shrink-0">
                              New product
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold shrink-0">
                              OK
                            </span>
                          )}
                        </div>

                        <div className="flex items-start justify-between gap-2 text-[12px] text-slate-500">
                          <div className="min-w-0 leading-snug">
                            {r.qty} cs{r.freeQty > 0 ? ` + ${r.freeQty} free` : ''}
                            {isMissing ? (
                              <>
                                {' · '}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowAutoBatchSheet(true);
                                  }}
                                  className="font-bold text-[#2864d9] min-w-0 min-h-0 cursor-pointer"
                                >
                                  Auto batch / tag
                                </button>
                                {' or enter'}
                              </>
                            ) : r.isNewProduct ? (
                              <>
                                {' · '}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingRowId(r.id);
                                    setMobileSubView('edit_line');
                                  }}
                                  className="font-bold text-[#2864d9] min-w-0 min-h-0 cursor-pointer"
                                >
                                  Create as new product
                                </button>
                              </>
                            ) : (
                              <>
                                {' · '}
                                {r.batchNumber} · exp {r.expiry}
                              </>
                            )}
                          </div>
                          <span className="text-slate-400 shrink-0 text-xs">line total</span>
                        </div>

                        <div className="text-[14px] font-extrabold text-slate-900 tabular-nums pt-0.5">
                          ₹{money(bd.lineTotal)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="hh-inv-card p-0 overflow-x-auto">
                    <table className="w-full text-left text-[12px] min-w-[540px]">
                      <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                        <tr>
                          <th className="px-2.5 py-2">Product</th>
                          <th className="px-2 py-2 text-right">Qty</th>
                          <th className="px-2 py-2">Scheme</th>
                          <th className="px-2 py-2 text-right">Rate</th>
                          <th className="px-2 py-2">Batch</th>
                          <th className="px-2 py-2">Expiry</th>
                          <th className="px-2.5 py-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredRows.map((r) => {
                          const bd = lineBreakdown(r);
                          return (
                            <tr
                              key={r.id}
                              onClick={() => {
                                setEditingRowId(r.id);
                                setMobileSubView('edit_line');
                              }}
                              className="cursor-pointer active:bg-slate-50"
                            >
                              <td className="px-2.5 py-2.5 font-bold text-slate-900">{r.productName || r.rawName}</td>
                              <td className="px-2 py-2.5 text-right font-semibold tabular-nums">{r.qty}</td>
                              <td className="px-2 py-2.5 text-slate-500">{r.freeQty > 0 ? `+${r.freeQty}` : r.discountPercent > 0 ? `${r.discountPercent}%` : '—'}</td>
                              <td className="px-2 py-2.5 text-right font-semibold tabular-nums">{Math.round(r.unitPrice)}</td>
                              <td className={`px-2 py-2.5 font-semibold ${r.batchNumber?.trim() ? 'text-slate-700' : 'text-rose-600'}`}>
                                {r.batchNumber?.trim() || 'missing'}
                              </td>
                              <td className={`px-2 py-2.5 font-semibold ${r.expiry ? 'text-slate-700' : 'text-rose-600'}`}>
                                {r.expiry || 'missing'}
                              </td>
                              <td className="px-2.5 py-2.5 text-right font-bold tabular-nums text-slate-900">
                                ₹{money(bd.lineTotal)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[12px] text-slate-500 px-0.5">
                    Density: compact. Cards is the default on phones.
                  </p>
                </div>
              )}
            </div>

            <div className="px-3.5 py-2.5 bg-[#f3f5f9] border-t border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (!targetWarehouseId) {
                    setMobileSubView('bill');
                    return;
                  }
                  setShowConfirmStep(true);
                }}
                className="hh-inv-btn-primary w-full"
              >
                {targetWarehouseId ? 'Review & confirm' : 'Pick godown first'}
              </button>
            </div>
          </div>
        )}
      </div>

      <BulkInwardPhoneSheets
        rows={rows}
        setRows={setRows}
        products={products}
        inwardCostPerCrate={inwardCostPerCrate}
        printedTotalCases={printedTotalCases}
        totalInvoicePrintedQty={totalInvoicePrintedQty}
        totalFreeQty={totalFreeQty}
        totalSupplierSchemeBonusQty={totalSupplierSchemeBonusQty}
        hasCasesMismatch={hasCasesMismatch}
        casesDiff={casesDiff}
        calculatedGrandTotal={calculatedGrandTotal}
        totalTax={totalTax}
        originalInvoiceTotal={originalInvoiceTotal}
        setOriginalInvoiceTotal={setOriginalInvoiceTotal}
        amountDiff={amountDiff}
        hasAmountMismatch={hasAmountMismatch}
        attentionCount={attentionCount}
        showMismatchDetail={showMismatchDetail}
        setShowMismatchDetail={setShowMismatchDetail}
        showAmountMismatchDetail={showAmountMismatchDetail}
        setShowAmountMismatchDetail={setShowAmountMismatchDetail}
        catalogPickerRowId={catalogPickerRowId}
        setCatalogPickerRowId={setCatalogPickerRowId}
        catalogPickerSearch={catalogPickerSearch}
        setCatalogPickerSearch={setCatalogPickerSearch}
        phoneCatalogSizeFilter={phoneCatalogSizeFilter}
        setPhoneCatalogSizeFilter={setPhoneCatalogSizeFilter}
        showBulkSchemeModal={showBulkSchemeModal}
        setShowBulkSchemeModal={setShowBulkSchemeModal}
        bulkSchemeType={bulkSchemeType}
        setBulkSchemeType={setBulkSchemeType}
        bulkSchemeName={bulkSchemeName}
        setBulkSchemeName={setBulkSchemeName}
        bulkSchemeValue={bulkSchemeValue}
        setBulkSchemeValue={setBulkSchemeValue}
        showAutoBatchSheet={showAutoBatchSheet}
        setShowAutoBatchSheet={setShowAutoBatchSheet}
        bulkExpiryDate={bulkExpiryDate}
        setBulkExpiryDate={setBulkExpiryDate}
        phoneDeleteConfirmId={phoneDeleteConfirmId}
        setPhoneDeleteConfirmId={setPhoneDeleteConfirmId}
        handleCatalogMappingChange={handleCatalogMappingChange}
        handleDeleteRow={handleDeleteRow}
        handleAutoGenerateAllBatches={handleAutoGenerateAllBatches}
        handleApplyBulkScheme={handleApplyBulkScheme}
        setEditingRowId={setEditingRowId}
        setMobileSubView={setMobileSubView}
      />
    </>
  );
};
