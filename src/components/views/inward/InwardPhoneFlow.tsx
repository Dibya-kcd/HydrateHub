import React from 'react';
import { Search } from 'lucide-react';
import { GRN, GrnLineItem, Product, Warehouse } from '../../../types';
import { generateBatchNumber, money } from '../../../utils/billing';
import { PackIcon } from '../../common/PackIcon';
import {
  defaultLineState,
  DraftLineState,
  DraftMetrics,
  InwardTotals,
  KnownSupplier,
} from './inwardTypes';

interface InwardPhoneFlowProps {
  initialGrnToEdit?: GRN | null;
  onOpenBulkImport?: () => void;
  onClose: () => void;
  phoneStep: 1 | 2 | 3;
  setPhoneStep: React.Dispatch<React.SetStateAction<1 | 2 | 3>>;
  phoneStepError: string | null;
  setPhoneStepError: React.Dispatch<React.SetStateAction<string | null>>;
  supplierName: string;
  setSupplierName: (v: string) => void;
  applySupplierAutofill: (nameVal: string) => void;
  knownSuppliers: KnownSupplier[];
  supplierGstin: string;
  setSupplierGstin: (v: string) => void;
  invoiceNo: string;
  setInvoiceNo: (v: string) => void;
  inwardDate: string;
  setInwardDate: (v: string) => void;
  vehicleNo: string;
  setVehicleNo: (v: string) => void;
  targetWarehouseId: string;
  setTargetWarehouseId: (v: string) => void;
  warehouses: Warehouse[];
  showProviderFields: boolean;
  setShowProviderFields: React.Dispatch<React.SetStateAction<boolean>>;
  supplierPhone: string;
  setSupplierPhone: (v: string) => void;
  supplierEmail: string;
  setSupplierEmail: (v: string) => void;
  placeOfSupply: string;
  setPlaceOfSupply: (v: string) => void;
  supplierAddress: string;
  setSupplierAddress: (v: string) => void;
  phoneError: string | null;
  resolvedReviewItems: GrnLineItem[];
  handleEditRow: (idx: number) => void;
  handleDeleteRow: (idx: number) => void;
  showAddForm: boolean;
  setShowAddForm: React.Dispatch<React.SetStateAction<boolean>>;
  setEditingIndex: React.Dispatch<React.SetStateAction<number | null>>;
  draftLine: DraftLineState;
  setDraftLine: React.Dispatch<React.SetStateAction<DraftLineState>>;
  metrics: DraftMetrics;
  totals: InwardTotals;
  phoneNewProductMode: boolean;
  setPhoneNewProductMode: React.Dispatch<React.SetStateAction<boolean>>;
  showPhoneCatalogSheet: boolean;
  setShowPhoneCatalogSheet: React.Dispatch<React.SetStateAction<boolean>>;
  phoneCatalogSearch: string;
  setPhoneCatalogSearch: React.Dispatch<React.SetStateAction<string>>;
  phonePrintedTotal: string;
  setPhonePrintedTotal: React.Dispatch<React.SetStateAction<string>>;
  products: Product[];
  handleSelectExisting: (prodId: number) => void;
  handleAddDraftToReview: () => void;
  handleConfirmAndPost: () => void;
}

export const InwardPhoneFlow: React.FC<InwardPhoneFlowProps> = ({
  initialGrnToEdit,
  onOpenBulkImport,
  onClose,
  phoneStep,
  setPhoneStep,
  phoneStepError,
  setPhoneStepError,
  supplierName,
  setSupplierName,
  applySupplierAutofill,
  knownSuppliers,
  supplierGstin,
  setSupplierGstin,
  invoiceNo,
  setInvoiceNo,
  inwardDate,
  setInwardDate,
  vehicleNo,
  setVehicleNo,
  targetWarehouseId,
  setTargetWarehouseId,
  warehouses,
  showProviderFields,
  setShowProviderFields,
  supplierPhone,
  setSupplierPhone,
  supplierEmail,
  setSupplierEmail,
  placeOfSupply,
  setPlaceOfSupply,
  supplierAddress,
  setSupplierAddress,
  phoneError,
  resolvedReviewItems,
  handleEditRow,
  handleDeleteRow,
  showAddForm,
  setShowAddForm,
  setEditingIndex,
  draftLine,
  setDraftLine,
  metrics,
  totals,
  phoneNewProductMode,
  setPhoneNewProductMode,
  showPhoneCatalogSheet,
  setShowPhoneCatalogSheet,
  phoneCatalogSearch,
  setPhoneCatalogSearch,
  phonePrintedTotal,
  setPhonePrintedTotal,
  products,
  handleSelectExisting,
  handleAddDraftToReview,
  handleConfirmAndPost,
}) => {
  const selectedWhName = warehouses.find((w) => w.id === targetWarehouseId)?.name || 'Main godown';
  const invDateFormatted = inwardDate
    ? new Date(inwardDate.length === 10 ? inwardDate + 'T12:00:00' : inwardDate).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—';
  const printedNum = phonePrintedTotal.trim() ? Number(phonePrintedTotal) : totals.grand;
  const printedDiff = Math.round((totals.grand - (isNaN(printedNum) ? totals.grand : printedNum)) * 100) / 100;

  const handlePhoneStep1Next = () => {
    setPhoneStepError(null);
    if (!supplierName.trim()) {
      setPhoneStepError('Enter the supplier / party name.');
      return;
    }
    if (supplierPhone.trim() && phoneError) {
      setPhoneStepError(phoneError);
      return;
    }
    if (!invoiceNo.trim()) {
      setPhoneStepError('Enter the supplier invoice number.');
      return;
    }
    if (!targetWarehouseId) {
      setPhoneStepError('Select the godown receiving this stock.');
      return;
    }
    setPhoneStep(2);
  };

  const handlePhoneStep2Next = () => {
    setPhoneStepError(null);
    if (showAddForm && draftLine.productName.trim()) {
      if (draftLine.qty <= 0) {
        setPhoneStepError('Quantity must be at least 1 case.');
        return;
      }
      handleAddDraftToReview();
      setShowAddForm(false);
      setPhoneStep(3);
      return;
    }
    if (resolvedReviewItems.length === 0) {
      setPhoneStepError('Add at least one beverage product first.');
      return;
    }
    setPhoneStep(3);
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="New purchase" className="rt-flow-phone">
      <div className="hh-sales-top hh-sales-top--flush hh-inv-top--flow">
        <div className="hh-sales-top__row">
          <button
            type="button"
            onClick={() => {
              setPhoneStepError(null);
              if (phoneStep === 1) onClose();
              else setPhoneStep((s) => (s === 3 ? 2 : 1));
            }}
            className="hh-inv-backbtn"
          >
            <span>‹</span>
            <span>{initialGrnToEdit ? `Edit ${initialGrnToEdit.grnNumber}` : 'New purchase'}</span>
          </button>
          {phoneStep === 1 && !initialGrnToEdit && onOpenBulkImport && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenBulkImport();
              }}
              className="hh-inv-glass-pill"
            >
              Bulk import
            </button>
          )}
        </div>
        <div className="hh-inv-seg" aria-hidden="true">
          <span className={`hh-inv-seg__bar ${phoneStep >= 1 ? 'hh-inv-seg__bar--on' : ''}`} />
          <span className={`hh-inv-seg__bar ${phoneStep >= 2 ? 'hh-inv-seg__bar--on' : ''}`} />
          <span className={`hh-inv-seg__bar ${phoneStep >= 3 ? 'hh-inv-seg__bar--on' : ''}`} />
        </div>
        <div className="rt-stp">
          {phoneStep === 1 && 'Step 1 of 3 · Supplier and invoice'}
          {phoneStep === 2 && 'Step 2 of 3 · Items'}
          {phoneStep === 3 && 'Step 3 of 3 · Review'}
        </div>
      </div>

      <div className="rt-flow-phone__body space-y-3">
        {phoneStepError && (
          <div className="hh-inv-card hh-inv-card--alert-red text-[12.5px] font-semibold text-rose-700">
            {phoneStepError}
          </div>
        )}

        {phoneStep === 1 && (
          <>
            <div className="hh-inv-card space-y-2.5">
              <label className="hh-inv-field hh-inv-field--focus">
                <span className="hh-inv-field__label">Supplier / Party *</span>
                <input
                  list="inward-known-suppliers"
                  value={supplierName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSupplierName(val);
                    applySupplierAutofill(val);
                  }}
                  onBlur={(e) => applySupplierAutofill(e.target.value)}
                  placeholder="Supplier / Party name…"
                />
                <datalist id="inward-known-suppliers">
                  {knownSuppliers.map((s) => (
                    <option key={s.name} value={s.name} />
                  ))}
                </datalist>
              </label>

              <label className="hh-inv-field">
                <span className="hh-inv-field__label">Supplier GSTIN (Optional)</span>
                <input
                  autoCapitalize="characters"
                  value={supplierGstin}
                  onChange={(e) => setSupplierGstin(e.target.value.toUpperCase())}
                  placeholder="Optional (leave blank for Non-GST)"
                />
              </label>

              <div className="grid grid-cols-2 gap-2.5">
                <label className="hh-inv-field">
                  <span className="hh-inv-field__label">Supplier Invoice No.</span>
                  <input
                    value={invoiceNo}
                    onChange={(e) => setInvoiceNo(e.target.value)}
                    placeholder="e.g. A-4471"
                  />
                </label>
                <label className="hh-inv-field">
                  <span className="hh-inv-field__label">Invoice Date</span>
                  <input
                    type="date"
                    value={inwardDate}
                    onChange={(e) => setInwardDate(e.target.value)}
                  />
                </label>
              </div>

              <label className="hh-inv-field">
                <span className="hh-inv-field__label">Vehicle No.</span>
                <input
                  value={vehicleNo}
                  onChange={(e) => setVehicleNo(e.target.value.toUpperCase())}
                  placeholder="e.g. OD-02-AB-4471"
                />
              </label>

              <label className="hh-inv-field">
                <span className="hh-inv-field__label">Receive Into</span>
                <select
                  value={targetWarehouseId}
                  onChange={(e) => setTargetWarehouseId(e.target.value)}
                >
                  <option value="">Choose godown…</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <button
              type="button"
              onClick={() => setShowProviderFields((p) => !p)}
              className="text-left px-1 text-[12px] font-medium text-slate-500 cursor-pointer min-h-0"
            >
              Phone, email, address and place of supply are optional and sit under{' '}
              <span className="font-bold text-[#2864d9]">&quot;More supplier details&quot;</span>.
            </button>

            {showProviderFields && (
              <div className="hh-inv-card space-y-2.5">
                <label className="hh-inv-field">
                  <span className="hh-inv-field__label">Supplier Phone</span>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={supplierPhone}
                    onChange={(e) => setSupplierPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                  />
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <label className="hh-inv-field">
                    <span className="hh-inv-field__label">Email</span>
                    <input
                      type="email"
                      value={supplierEmail}
                      onChange={(e) => setSupplierEmail(e.target.value)}
                      placeholder="Optional"
                    />
                  </label>
                  <label className="hh-inv-field">
                    <span className="hh-inv-field__label">Place of Supply</span>
                    <input
                      value={placeOfSupply}
                      onChange={(e) => setPlaceOfSupply(e.target.value)}
                      placeholder="Odisha (21)"
                    />
                  </label>
                </div>
                <label className="hh-inv-field">
                  <span className="hh-inv-field__label">Supplier Address</span>
                  <input
                    value={supplierAddress}
                    onChange={(e) => setSupplierAddress(e.target.value)}
                    placeholder="Optional"
                  />
                </label>
              </div>
            )}
          </>
        )}

        {phoneStep === 2 && (
          <>
            {resolvedReviewItems.map((it, idx) => (
              <div key={it.id || idx} className="hh-inv-card space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <PackIcon size="sm" pack={it.pack} name={it.productName} />
                    <div className="min-w-0">
                      <div className="text-[14px] font-bold text-slate-900 truncate">{it.productName}</div>
                      <div className="text-xs text-slate-500">
                        {it.qty} cs{it.freeQty ? ` + ${it.freeQty} free` : ''} · {it.batchNumber || 'Auto batch'} · ₹{money(it.lineTotal)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleEditRow(idx)}
                      className="text-[12px] font-bold text-[#2864d9] min-h-0 cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteRow(idx)}
                      className="text-[12px] font-bold text-rose-600 min-h-0 cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {(showAddForm || resolvedReviewItems.length === 0) && (
              <div className="hh-inv-card space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!phoneNewProductMode) setShowPhoneCatalogSheet(true);
                    }}
                    className="flex items-center gap-2 min-w-0 text-left min-h-0 cursor-pointer"
                  >
                    <PackIcon size="sm" pack={draftLine.pack} name={draftLine.productName || 'Water'} />
                    <span className="text-[14.5px] font-bold text-slate-900 truncate">
                      {draftLine.productName ? draftLine.productName : 'Pick beverage'}
                    </span>
                  </button>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowPhoneCatalogSheet(true)}
                      className="text-[12px] font-bold text-[#2864d9] min-h-0 cursor-pointer"
                    >
                      Catalog
                    </button>
                    {resolvedReviewItems.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setDraftLine(defaultLineState(draftLine.category));
                          setShowAddForm(false);
                          setEditingIndex(null);
                        }}
                        className="text-[12px] font-bold text-rose-600 min-h-0 cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                {phoneNewProductMode && (
                  <label className="hh-inv-field hh-inv-field--focus">
                    <span className="hh-inv-field__label">New beverage name *</span>
                    <input
                      value={draftLine.productName}
                      onChange={(e) => setDraftLine((p) => ({ ...p, isNewProduct: true, selectedProductId: undefined, productName: e.target.value }))}
                      placeholder="e.g. Water 1L PET"
                    />
                  </label>
                )}

                <div className="grid grid-cols-3 gap-2">
                  <label className="hh-inv-field">
                    <span className="hh-inv-field__label">Billed</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={draftLine.qty}
                      onChange={(e) => setDraftLine((p) => ({ ...p, qty: Math.max(1, Number(e.target.value) || 1) }))}
                    />
                  </label>
                  <div className="hh-inv-field">
                    <span className="hh-inv-field__label">Inward</span>
                    <div className="text-[14px] font-bold text-slate-900 leading-[24px] tabular-nums">
                      {metrics.totalReceivedQty}
                    </div>
                  </div>
                  <label className="hh-inv-field">
                    <span className="hh-inv-field__label">Units/case</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={draftLine.unitsPerCrate}
                      onChange={(e) => setDraftLine((p) => ({ ...p, unitsPerCrate: Math.max(1, Number(e.target.value) || 1) }))}
                    />
                  </label>
                </div>

                <label className="hh-inv-field">
                  <span className="hh-inv-field__label">Batch / Lot No.</span>
                  <input
                    value={draftLine.batchNumber}
                    onChange={(e) => setDraftLine((p) => ({ ...p, batchNumber: e.target.value }))}
                    placeholder={generateBatchNumber(draftLine.productName || 'B2311')}
                  />
                </label>

                <label className="hh-inv-field">
                  <span className="hh-inv-field__label">Expiry Date</span>
                  <input
                    type="date"
                    value={draftLine.expiry}
                    onChange={(e) => setDraftLine((p) => ({ ...p, expiry: e.target.value }))}
                  />
                </label>

                <div className="grid grid-cols-2 gap-2.5">
                  <label className="hh-inv-field">
                    <span className="hh-inv-field__label">Landed Cost (₹/cs)</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      value={draftLine.unitPrice}
                      onChange={(e) => setDraftLine((p) => ({ ...p, unitPrice: Math.max(0, Number(e.target.value) || 0) }))}
                    />
                  </label>
                  <label className="hh-inv-field">
                    <span className="hh-inv-field__label">Free Crates</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={draftLine.freeQty || 0}
                      onChange={(e) => {
                        const fq = Math.max(0, Math.floor(Number(e.target.value) || 0));
                        setDraftLine((p) => ({
                          ...p,
                          freeQty: fq,
                          schemeType: fq > 0 ? 'free_cases' : 'none',
                          schemeMode: fq > 0 ? 'additive' : 'inclusive',
                        }));
                      }}
                    />
                  </label>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setPhoneStepError(null);
                if (showAddForm && draftLine.productName.trim()) {
                  handleAddDraftToReview();
                }
                setShowAddForm(true);
                setPhoneNewProductMode(false);
                if (!showAddForm || !draftLine.productName.trim()) {
                  setShowPhoneCatalogSheet(true);
                }
              }}
              className="hh-inv-btn-outline w-full"
            >
              + Add another beverage
            </button>

            <p className="text-[12px] text-slate-500 px-1 leading-snug">
              Pick an existing beverage or create a new one. Supplier scheme is optional.
            </p>
          </>
        )}

        {phoneStep === 3 && (
          <>
            <div className="hh-inv-card space-y-2.5">
              <div className="border-b border-slate-100 pb-2">
                <div className="text-[15px] font-extrabold text-slate-900">{supplierName}</div>
                <div className="text-[12px] text-slate-500 mt-0.5">
                  Inv {invoiceNo} · {invDateFormatted} · into {selectedWhName}
                </div>
              </div>

              <div className="space-y-1.5 text-[13px]">
                {resolvedReviewItems.map((it, idx) => (
                  <div key={it.id || idx} className="flex items-center justify-between gap-2">
                    <span className="text-slate-700 font-medium truncate">
                      {it.productName} · {it.qty} cs{it.freeQty ? ` + ${it.freeQty} free` : ''}
                    </span>
                    <span className="font-bold text-slate-900 tabular-nums shrink-0">
                      ₹{money(Number(it.lineTotal) || 0)}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-2 text-slate-500 pt-1">
                  <span>Taxable</span>
                  <span className="font-semibold text-slate-800 tabular-nums">₹{money(totals.taxable)}</span>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-2.5 flex items-center justify-between">
                <span className="text-[15px] font-bold text-slate-900">Total</span>
                <span className="text-[17px] font-extrabold text-slate-900 tabular-nums">
                  ₹{money(totals.grand)}
                </span>
              </div>
            </div>

            <div className="hh-inv-card space-y-2">
              <div className="flex items-center justify-between gap-2 text-[13px]">
                <span className="text-slate-500 font-medium">Invoice printed total</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={phonePrintedTotal === '' ? String(Math.round(totals.grand * 100) / 100) : phonePrintedTotal}
                  onChange={(e) => setPhonePrintedTotal(e.target.value)}
                  aria-label="Invoice printed total"
                  className="w-28 text-right font-bold text-slate-900 border-b border-slate-200 bg-transparent py-0.5 tabular-nums focus:outline-none focus:border-[#2864d9]"
                />
              </div>
              <div className="flex items-center justify-between gap-2 text-[13px]">
                <span className="text-slate-500 font-medium">Difference</span>
                <span className={`font-bold tabular-nums ${Math.abs(printedDiff) < 1 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {printedDiff < 0 ? '-' : ''}₹{money(Math.abs(printedDiff))}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-[12.5px] font-semibold text-amber-950 leading-snug">
              Stock goes up by {totals.totalCases} cs in {selectedWhName} when you save.
            </div>
          </>
        )}
      </div>

      <div className="rt-flow-phone__footer">
        {phoneStep === 1 && (
          <button type="button" onClick={handlePhoneStep1Next} className="hh-inv-btn-primary w-full">
            Next: items
          </button>
        )}
        {phoneStep === 2 && (
          <button type="button" onClick={handlePhoneStep2Next} className="hh-inv-btn-primary w-full">
            Next: review
          </button>
        )}
        {phoneStep === 3 && (
          <div className="grid grid-cols-2 gap-2.5">
            <button type="button" onClick={() => setPhoneStep(2)} className="hh-inv-btn-outline">
              Back
            </button>
            <button
              type="button"
              disabled={resolvedReviewItems.length === 0 || !targetWarehouseId}
              onClick={handleConfirmAndPost}
              className="hh-inv-btn-accent"
            >
              Save purchase
            </button>
          </div>
        )}
      </div>

      {showPhoneCatalogSheet && (
        <div className="rt-bsheet-scrim" onClick={() => setShowPhoneCatalogSheet(false)}>
          <div className="rt-bsheet" onClick={(e) => e.stopPropagation()}>
            <div className="hh-grab" />
            <h3 className="text-[17px] font-extrabold text-slate-900">Select catalog beverage</h3>
            <div className="rt-search-bar">
              <Search size={16} className="text-slate-400 shrink-0" />
              <input
                type="search"
                value={phoneCatalogSearch}
                onChange={(e) => setPhoneCatalogSearch(e.target.value)}
                placeholder="Search catalog"
              />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 max-h-[45vh] overflow-y-auto">
              {products
                .filter((p) => !phoneCatalogSearch.trim() || p.name.toLowerCase().includes(phoneCatalogSearch.toLowerCase()))
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setPhoneNewProductMode(false);
                      handleSelectExisting(p.id);
                      setShowPhoneCatalogSheet(false);
                    }}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <PackIcon size="sm" pack={p.pack} name={p.name} />
                      <div className="min-w-0">
                        <div className="text-[13.5px] font-bold text-slate-900 truncate">{p.name}</div>
                        <div className="text-xs text-slate-500">{p.unitsPerCrate || 24} pcs / case</div>
                      </div>
                    </div>
                    <span className="text-[12.5px] font-bold text-[#2864d9] shrink-0">Select</span>
                  </button>
                ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setPhoneNewProductMode(true);
                setDraftLine((p) => ({ ...p, isNewProduct: true, selectedProductId: undefined, productName: '' }));
                setShowPhoneCatalogSheet(false);
              }}
              className="hh-inv-btn-outline w-full"
            >
              Create as new product
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
