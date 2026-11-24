import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Info,
  Maximize2,
  Minimize2,
  RefreshCw,
  X,
} from 'lucide-react';
import { Warehouse } from '../../types';
import { InwardStepIndicator } from './InwardStepIndicator';

interface BulkInwardDesktopHeaderProps {
  step: 'upload' | 'review';
  setStep: (s: 'upload' | 'review') => void;
  rowsCount: number;
  totalReceivedQty: number;
  fileName: string | null;
  isUpperDetailsExpanded: boolean;
  setIsUpperDetailsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  isMaximized: boolean;
  setIsMaximized: (v: boolean) => void;
  onClose: () => void;
}

export const BulkInwardDesktopHeader: React.FC<BulkInwardDesktopHeaderProps> = ({
  step,
  setStep,
  rowsCount,
  totalReceivedQty,
  fileName,
  isUpperDetailsExpanded,
  setIsUpperDetailsExpanded,
  isMaximized,
  setIsMaximized,
  onClose,
}) => (
  <div
    className={`flex items-center justify-between px-3 sm:px-5 border-b border-black/5 bg-[#faf8f5] shrink-0 ${
      step === 'review' ? 'py-2.5 sm:py-3' : 'py-3'
    }`}
  >
    <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
      <div className="p-1.5 bg-[#ebe8e1] text-[var(--primary)] rounded-xl shrink-0">
        <Boxes size={18} className="sm:w-5 sm:h-5" />
      </div>
      <div className="min-w-0">
        <InwardStepIndicator step={step} />
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate">
            {step === 'upload' ? 'Bulk purchase import' : 'Review purchase'}
          </h2>
          {step === 'upload' ? (
            <span className="hidden sm:inline-block px-2 py-0.5 text-xs font-semibold rounded-full bg-white border border-black/8 text-slate-600">
              Excel · CSV · PDF · Image
            </span>
          ) : (
            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-[#ebe8e1] text-[var(--primary)] shrink-0">
              {rowsCount} {rowsCount === 1 ? 'product' : 'products'} · {totalReceivedQty} cs
            </span>
          )}
          {step === 'review' && fileName && (
            <span className="hidden lg:inline-block text-xs text-slate-500 font-medium truncate max-w-[180px]">
              from {fileName}
            </span>
          )}
        </div>
        {step === 'upload' && (
          <p className="text-xs sm:text-xs text-slate-500 truncate mt-0.5">
            Upload supplier invoice — products, qty, schemes & taxes extracted
          </p>
        )}
      </div>
    </div>

    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
      {step === 'review' && (
        <>
          <button
            type="button"
            onClick={() => setIsUpperDetailsExpanded((prev) => !prev)}
            className={`px-2 sm:px-2.5 py-1 text-xs font-semibold rounded border flex items-center gap-1 cursor-pointer transition-colors ${
              isUpperDetailsExpanded
                ? 'bg-indigo-100 text-indigo-800 border-indigo-300'
                : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'
            }`}
            title={
              isUpperDetailsExpanded
                ? 'Contract upper details to maximize product review workspace'
                : 'Expand upper details to edit supplier info, vehicle, taxes & godown'
            }
          >
            {isUpperDetailsExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            <span className="hidden sm:inline">{isUpperDetailsExpanded ? 'Contract Details' : 'Bill Details'}</span>
            <span className="sm:hidden">{isUpperDetailsExpanded ? 'Contract' : 'Bill'}</span>
          </button>

          <button
            type="button"
            onClick={() => setStep('upload')}
            className="px-2 sm:px-2.5 py-1 text-xs font-semibold rounded border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer flex items-center gap-1 transition-colors"
            title="Upload a different invoice"
            aria-label="Upload a different invoice"
          >
            <RefreshCw size={12} />
            <span className="hidden sm:inline">Change File</span>
          </button>
        </>
      )}

      <button
        type="button"
        onClick={() => setIsMaximized(!isMaximized)}
        className="p-1 sm:p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-md cursor-pointer transition-colors"
        title={isMaximized ? 'Restore windowed view' : 'Maximize full screen view'}
        aria-label={isMaximized ? 'Restore windowed view' : 'Maximize full screen view'}
      >
        {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
      </button>

      <button
        type="button"
        onClick={onClose}
        className="p-1 sm:p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-md cursor-pointer transition-colors"
        title="Close modal"
        aria-label="Close modal"
      >
        <X size={18} />
      </button>
    </div>
  </div>
);

interface BulkInwardParseErrorBannerProps {
  parseError: string;
  setParseError: (v: string | null) => void;
  lastUploadedFile: File | null;
  isParsing: boolean;
  processUploadedFile: (file: File) => void;
  handleStartBlankConsignment: () => void;
  handleDownloadSample: () => void;
}

export const BulkInwardParseErrorBanner: React.FC<BulkInwardParseErrorBannerProps> = ({
  parseError,
  setParseError,
  lastUploadedFile,
  isParsing,
  processUploadedFile,
  handleStartBlankConsignment,
  handleDownloadSample,
}) => (
  <div className="mx-3 sm:mx-6 mt-3 sm:mt-4 p-3.5 sm:p-4 bg-rose-50 border border-rose-200 text-rose-900 rounded-lg flex items-start gap-3 text-xs shadow-sm">
    <AlertCircle size={18} className="text-rose-600 mt-0.5 shrink-0" />
    <div className="flex-1 min-w-0">
      <span className="font-semibold block text-xs sm:text-sm text-rose-900">{parseError}</span>
      <div className="mt-2.5 flex items-center gap-2 flex-wrap">
        {lastUploadedFile && (
          <button
            onClick={() => processUploadedFile(lastUploadedFile)}
            disabled={isParsing}
            className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-md text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={isParsing ? 'animate-spin' : ''} />
            Retry AI Vision ({lastUploadedFile.name})
          </button>
        )}
        <button
          onClick={handleStartBlankConsignment}
          className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-white hover:bg-slate-100 text-slate-800 font-semibold rounded-md text-xs flex items-center gap-1.5 cursor-pointer border border-slate-300 shadow-sm transition-colors"
        >
          <ArrowRight size={13} />
          Open Review (Manual Entry)
        </button>
        <button
          onClick={handleDownloadSample}
          className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold rounded-md text-xs flex items-center gap-1.5 cursor-pointer border border-emerald-300 transition-colors"
        >
          <Download size={13} />
          Use Excel Template
        </button>
      </div>
    </div>
    <button
      onClick={() => setParseError(null)}
      className="text-rose-400 hover:text-rose-700 font-bold p-1 rounded hover:bg-rose-100 transition-colors cursor-pointer shrink-0"
      title="Dismiss alert"
    >
      ✕
    </button>
  </div>
);

interface BulkInwardDesktopFooterProps {
  paletteLine: string;
  hasCasesMismatch: boolean;
  totalInvoicePrintedQty: number;
  printedTotalCases: number | null;
  casesDiff: number;
  warehouses: Warehouse[];
  targetWarehouseId: string;
  rowsCount: number;
  totalReceivedQty: number;
  onClose: () => void;
  onOpenConfirm: () => void;
}

export const BulkInwardDesktopFooter: React.FC<BulkInwardDesktopFooterProps> = ({
  paletteLine,
  hasCasesMismatch,
  totalInvoicePrintedQty,
  printedTotalCases,
  casesDiff,
  warehouses,
  targetWarehouseId,
  rowsCount,
  totalReceivedQty,
  onClose,
  onOpenConfirm,
}) => (
  <div className="bg-slate-50 px-3 sm:px-6 py-2 sm:py-2.5 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 shrink-0" style={{ borderColor: paletteLine }}>
    <div className="flex items-center gap-2 text-xs text-slate-500">
      {hasCasesMismatch ? (
        <div className="flex items-center gap-1.5 text-xs text-red-700 font-bold bg-red-100 border border-red-300 px-2.5 py-1 rounded">
          <AlertTriangle size={15} className="text-red-600 shrink-0" />
          <span>Warning: Total cases mismatch ({totalInvoicePrintedQty} vs invoice's {printedTotalCases} printed, {casesDiff > 0 ? `+${casesDiff}` : casesDiff} cs)</span>
        </div>
      ) : (
        <>
          <Info size={14} className="text-indigo-600 shrink-0" />
          <span className="text-xs sm:text-xs leading-tight">
            Confirming updates stock in <strong>{warehouses.find((w) => w.id === targetWarehouseId)?.name || 'Godown'}</strong>, logs lots, and registers new lines.
          </span>
        </>
      )}
    </div>

    <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-end shrink-0">
      <button
        type="button"
        onClick={onClose}
        className="px-4 py-2.5 rounded-full text-sm font-semibold text-slate-600 hover:bg-black/5 cursor-pointer"
      >
        Cancel
      </button>

      <button
        type="button"
        id="btn-confirm-bulk-inward"
        onClick={onOpenConfirm}
        disabled={!targetWarehouseId}
        title={!targetWarehouseId ? 'Select a warehouse first — there is no default' : undefined}
        className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-full text-sm font-semibold shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-[0.99] ${
          !targetWarehouseId
            ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
            : hasCasesMismatch
            ? 'bg-amber-600 hover:bg-amber-700 text-white cursor-pointer'
            : 'bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white cursor-pointer'
        }`}
      >
        {hasCasesMismatch ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
        <span>
          {!targetWarehouseId
            ? 'Select godown'
            : hasCasesMismatch
            ? 'Review (cases mismatch)'
            : 'Review & confirm'}{' '}
          · {rowsCount} items · {totalReceivedQty.toLocaleString()} cs
        </span>
      </button>
    </div>
  </div>
);
