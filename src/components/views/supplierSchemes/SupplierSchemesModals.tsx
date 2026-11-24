import React from 'react';
import { Search } from 'lucide-react';
import {
  Product,
  SupplierCreditNote,
  SupplierIncentiveCalcMethod,
  SupplierSchemeType,
} from '../../../types';
import { Button, ConfirmModal, Modal } from '../../ui';
import { InfoTip } from '../../common/InfoTip';
import {
  Field,
  inputCls,
  inr,
  SCHEME_TYPE_LABEL,
  SchemeFormState,
  Stat,
} from './supplierSchemesShared';

interface SupplierSchemesModalsProps {
  schemeModalOpen: boolean;
  setSchemeModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  editingSchemeId: string | null;
  form: SchemeFormState;
  setForm: React.Dispatch<React.SetStateAction<SchemeFormState>>;
  formError: string;
  productSearch: string;
  setProductSearch: React.Dispatch<React.SetStateAction<string>>;
  supplierNames: string[];
  filteredProducts: Product[];
  saveScheme: () => void;
  toggleProduct: (id: number) => void;
  receiptNote: SupplierCreditNote | null;
  setReceiptNote: React.Dispatch<React.SetStateAction<SupplierCreditNote | null>>;
  receiptAmount: string;
  setReceiptAmount: React.Dispatch<React.SetStateAction<string>>;
  receiptNumber: string;
  setReceiptNumber: React.Dispatch<React.SetStateAction<string>>;
  receiptDate: string;
  setReceiptDate: React.Dispatch<React.SetStateAction<string>>;
  submitReceipt: () => void;
  editingNote: SupplierCreditNote | null;
  setEditingNote: React.Dispatch<React.SetStateAction<SupplierCreditNote | null>>;
  editExpectedAmount: string;
  setEditExpectedAmount: React.Dispatch<React.SetStateAction<string>>;
  editActualAmount: string;
  setEditActualAmount: React.Dispatch<React.SetStateAction<string>>;
  editCnNumber: string;
  setEditCnNumber: React.Dispatch<React.SetStateAction<string>>;
  editCnDate: string;
  setEditCnDate: React.Dispatch<React.SetStateAction<string>>;
  editCnNotes: string;
  setEditCnNotes: React.Dispatch<React.SetStateAction<string>>;
  saveEditedNote: () => void;
  deleteConfirm: { id: string; name: string; used: number } | null;
  setDeleteConfirm: React.Dispatch<React.SetStateAction<{ id: string; name: string; used: number } | null>>;
  deleteSupplierScheme: (id: string, reason?: string) => void;
  deleteNoteConfirm: SupplierCreditNote | null;
  setDeleteNoteConfirm: React.Dispatch<React.SetStateAction<SupplierCreditNote | null>>;
  deleteSupplierCreditNote: (id: string, reason?: string) => void;
}

export const SupplierSchemesModals: React.FC<SupplierSchemesModalsProps> = ({
  schemeModalOpen,
  setSchemeModalOpen,
  editingSchemeId,
  form,
  setForm,
  formError,
  productSearch,
  setProductSearch,
  supplierNames,
  filteredProducts,
  saveScheme,
  toggleProduct,
  receiptNote,
  setReceiptNote,
  receiptAmount,
  setReceiptAmount,
  receiptNumber,
  setReceiptNumber,
  receiptDate,
  setReceiptDate,
  submitReceipt,
  editingNote,
  setEditingNote,
  editExpectedAmount,
  setEditExpectedAmount,
  editActualAmount,
  setEditActualAmount,
  editCnNumber,
  setEditCnNumber,
  editCnDate,
  setEditCnDate,
  editCnNotes,
  setEditCnNotes,
  saveEditedNote,
  deleteConfirm,
  setDeleteConfirm,
  deleteSupplierScheme,
  deleteNoteConfirm,
  setDeleteNoteConfirm,
  deleteSupplierCreditNote,
}) => {
  return (
    <>
      {/* Create / Edit Scheme */}
      <Modal
        isOpen={schemeModalOpen}
        onClose={() => setSchemeModalOpen(false)}
        title={editingSchemeId ? 'Edit supplier scheme' : 'New supplier scheme'}
        maxWidth="lg"
        footer={
          <div className="grid grid-cols-2 gap-2.5 w-full sm:flex sm:w-auto">
            <Button variant="secondary" className="h-11 sm:h-9" onClick={() => setSchemeModalOpen(false)}>
              Cancel
            </Button>
            <Button className="h-11 sm:h-9" onClick={saveScheme}>
              Save scheme
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field
            label="Scheme type"
            infoTitle="Scheme types"
            info={
              <>
                <p>
                  <strong>Type A – Free goods:</strong> attach to a GRN line during Add stock to record the extra free
                  cases received. They are added on top of the invoiced quantity and never overlap with the invoice’s own
                  scheme discount.
                </p>
                <p>
                  <strong>Type B – Pending credit note:</strong> attach to a GRN line to flag a future credit. The GRN stays
                  unchanged; a credit note is created for you to track and record when the supplier issues it.
                </p>
                <p>
                  <strong>Type C – Monthly volume incentive:</strong> not attached to a GRN. The supplier pays ₹ per case
                  when your monthly sales of the selected products reach the target.
                </p>
              </>
            }
          >
            <select
              className={inputCls}
              value={form.schemeType}
              onChange={(e) => setForm({ ...form, schemeType: e.target.value as SupplierSchemeType })}
            >
              <option value="free_goods">{SCHEME_TYPE_LABEL.free_goods}</option>
              <option value="pending_credit">{SCHEME_TYPE_LABEL.pending_credit}</option>
              <option value="volume_incentive">{SCHEME_TYPE_LABEL.volume_incentive}</option>
            </select>
          </Field>

          <Field label="Supplier name">
            <input
              className={inputCls}
              list="supplier-names"
              value={form.supplierName}
              onChange={(e) => setForm({ ...form, supplierName: e.target.value })}
              placeholder="e.g. Campa Distributors"
              autoComplete="off"
            />
            <datalist id="supplier-names">
              {supplierNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </Field>

          <Field label="Scheme name">
            <input
              className={inputCls}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. 10+1 Free — Power Up 150ml"
            />
          </Field>

          <Field
            label={`Products (${form.productIds.length} selected)`}
            infoTitle="Products"
            info="Pick every product this scheme covers. For a monthly incentive the target is counted across all the selected products together."
          >
            <div className="relative mb-2">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input
                className={`${inputCls} pl-9`}
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Search products"
              />
            </div>
            <div className="border border-slate-200 rounded-lg max-h-52 overflow-y-auto divide-y divide-slate-100">
              {filteredProducts.length === 0 ? (
                <p className="text-xs text-slate-500 p-3">No products match.</p>
              ) : (
                filteredProducts.map((p) => {
                  const checked = form.productIds.includes(p.id);
                  return (
                    <label key={p.id} className="flex items-center gap-3 px-3 min-h-[44px] cursor-pointer active:bg-slate-50">
                      <input
                        type="checkbox"
                        className="w-5 h-5 shrink-0 accent-slate-900"
                        checked={checked}
                        onChange={() => toggleProduct(p.id)}
                      />
                      <span className="text-sm text-slate-800 break-words min-w-0">{p.name}</span>
                    </label>
                  );
                })
              )}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date">
              <input type="date" className={inputCls} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </Field>
            <Field label="End date" info="Leave empty for an open-ended scheme." infoTitle="End date">
              <input
                type="date"
                className={inputCls}
                value={form.endDate || ''}
                onChange={(e) => setForm({ ...form, endDate: e.target.value || undefined })}
              />
            </Field>
          </div>

          {form.schemeType === 'volume_incentive' && (
            <div className="space-y-3 bg-slate-50 rounded-xl p-3 border border-slate-200">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Monthly target (cases)">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    className={inputCls}
                    value={form.targetQuantity ?? ''}
                    onChange={(e) => setForm({ ...form, targetQuantity: e.target.value === '' ? undefined : Number(e.target.value) })}
                  />
                </Field>
                <Field label="Rate (₹ per case)">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    className={inputCls}
                    value={form.incentiveRate ?? ''}
                    onChange={(e) => setForm({ ...form, incentiveRate: e.target.value === '' ? undefined : Number(e.target.value) })}
                  />
                </Field>
              </div>
              <Field
                label="Calculation method"
                infoTitle="Calculation method"
                info={
                  <>
                    <p>
                      <strong>All eligible cases:</strong> once the target is reached, the rate is paid on every case sold.
                      Example: target 1000, sold 1200, ₹10 → 1200 × 10 = ₹12,000.
                    </p>
                    <p>
                      <strong>Excess cases only:</strong> the rate is paid only on cases above the target. Same example →
                      (1200 − 1000) × 10 = ₹2,000.
                    </p>
                  </>
                }
              >
                <select
                  className={inputCls}
                  value={form.calculationMethod}
                  onChange={(e) => setForm({ ...form, calculationMethod: e.target.value as SupplierIncentiveCalcMethod })}
                >
                  <option value="all_eligible">All eligible cases</option>
                  <option value="excess_only">Excess cases only</option>
                </select>
              </Field>
            </div>
          )}

          <div className="flex items-center gap-3 min-h-[44px]">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="w-5 h-5 accent-slate-900"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              <span className="text-sm font-medium text-slate-700">Active</span>
            </label>
            <InfoTip size="sm" title="Active">
              Only active Type A / B schemes appear in the GRN “Supplier scheme” dropdown. Switch a scheme off when the
              offer ends — nothing already recorded is changed.
            </InfoTip>
          </div>

          <Field label="Notes">
            <textarea
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              rows={2}
              value={form.notes || ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>

          {formError && (
            <p role="alert" className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {formError}
            </p>
          )}
        </div>
      </Modal>

      {/* Record receipt */}
      <Modal
        isOpen={!!receiptNote}
        onClose={() => setReceiptNote(null)}
        title="Record credit note receipt"
        subtitle={receiptNote ? `${receiptNote.supplierName} · Expected ${inr(receiptNote.expectedAmount)}` : ''}
        footer={
          <div className="grid grid-cols-2 gap-2.5 w-full sm:flex sm:w-auto">
            <Button variant="secondary" className="h-11 sm:h-9" onClick={() => setReceiptNote(null)}>
              Cancel
            </Button>
            <Button className="h-11 sm:h-9" onClick={submitReceipt} disabled={!(Number(receiptAmount) > 0)}>
              Save receipt
            </Button>
          </div>
        }
      >
        {receiptNote && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-1.5">
              <Stat label="Expected" value={inr(receiptNote.expectedAmount)} />
              <Stat label="Received so far" value={inr(receiptNote.actualAmount)} tone="good" />
              <Stat
                label="Outstanding"
                value={inr(Math.max(0, receiptNote.expectedAmount - receiptNote.actualAmount))}
                tone="warn"
              />
            </div>
            <Field
              label="Credit note number"
              infoTitle="Receipt"
              info="Expected value is preserved permanently. This only records what the supplier actually credited, and it is added to anything already received."
            >
              <input className={inputCls} value={receiptNumber} onChange={(e) => setReceiptNumber(e.target.value)} placeholder="e.g. CN-2026-001" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount received now, without GST (₹)" info="Enter the credit note value WITHOUT GST (its taxable value). The GST on a credit note is not extra profit, so it must not be counted. Your profit reports add this amount to profit." infoTitle="Without GST">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  className={inputCls}
                  value={receiptAmount}
                  onChange={(e) => setReceiptAmount(e.target.value)}
                />
              </Field>
              <Field label="Credit note date">
                <input type="date" className={inputCls} value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} />
              </Field>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit credit note */}
      <Modal
        isOpen={!!editingNote}
        onClose={() => setEditingNote(null)}
        title="Edit supplier credit note"
        subtitle={editingNote ? editingNote.supplierName : ''}
        footer={
          <div className="grid grid-cols-2 gap-2.5 w-full sm:flex sm:w-auto">
            <Button variant="secondary" className="h-11 sm:h-9" onClick={() => setEditingNote(null)}>
              Cancel
            </Button>
            <Button className="h-11 sm:h-9" onClick={saveEditedNote}>
              Save changes
            </Button>
          </div>
        }
      >
        {editingNote && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Expected (₹)" info="Use only to correct a wrong expected value. Normal receipts go through “Record receipt”." infoTitle="Expected amount">
                <input type="number" inputMode="decimal" min="0" className={inputCls} value={editExpectedAmount} onChange={(e) => setEditExpectedAmount(e.target.value)} />
              </Field>
              <Field label="Received, without GST (₹)" info="Credit note value without GST. GST on a credit note is not profit." infoTitle="Without GST">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  className={`${inputCls} font-semibold text-emerald-800`}
                  value={editActualAmount}
                  onChange={(e) => setEditActualAmount(e.target.value)}
                />
              </Field>
              <Field label="Credit note no.">
                <input className={inputCls} value={editCnNumber} onChange={(e) => setEditCnNumber(e.target.value)} placeholder="e.g. CN-2026-001" />
              </Field>
              <Field label="Credit note date">
                <input type="date" className={inputCls} value={editCnDate} onChange={(e) => setEditCnDate(e.target.value)} />
              </Field>
            </div>

            {Number(editActualAmount) > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                <p className="text-xs text-amber-900">Need to re-open this credit note?</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-10 w-full border-amber-300 text-amber-900 bg-white"
                  onClick={() => setEditActualAmount('0')}
                >
                  Reset received to ₹0
                </Button>
              </div>
            )}

            <Field label="Notes">
              <textarea
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                rows={2}
                value={editCnNotes}
                onChange={(e) => setEditCnNotes(e.target.value)}
              />
            </Field>
          </div>
        )}
      </Modal>

      <ConfirmModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => {}}
        onConfirmWithComment={(reason) => {
          if (deleteConfirm) deleteSupplierScheme(deleteConfirm.id, reason);
          setDeleteConfirm(null);
        }}
        title="Delete supplier scheme"
        subtitle={deleteConfirm?.name}
        message={`Delete "${deleteConfirm?.name}"?${
          deleteConfirm && deleteConfirm.used > 0 ? ` It is used on ${deleteConfirm.used} GRN line(s).` : ''
        } GRN lines and credit notes already linked to it keep their recorded quantities and amounts — only the reusable scheme setup is removed.`}
        rectificationPrompt="Reason for deleting scheme *"
        rectificationPlaceholder="e.g. Scheme discontinued, duplicate setup, wrong terms"
        reasonPresets={['Scheme discontinued', 'Duplicate setup', 'Wrong terms', 'Test entry']}
        commentMinLength={4}
        confirmButtonLabel="Delete Scheme"
        variant="danger"
      />

      <ConfirmModal
        isOpen={!!deleteNoteConfirm}
        onClose={() => setDeleteNoteConfirm(null)}
        onConfirm={() => {}}
        onConfirmWithComment={(reason) => {
          if (deleteNoteConfirm) deleteSupplierCreditNote(deleteNoteConfirm.id, reason);
          setDeleteNoteConfirm(null);
        }}
        title="Delete supplier credit note"
        subtitle={deleteNoteConfirm ? `${deleteNoteConfirm.supplierName}` : undefined}
        message={
          deleteNoteConfirm
            ? `Permanently delete credit note "${deleteNoteConfirm.creditNoteNumber || deleteNoteConfirm.id}" from ${deleteNoteConfirm.supplierName} (expected ${inr(deleteNoteConfirm.expectedAmount)}, received ${inr(deleteNoteConfirm.actualAmount)})? This removes the record.`
            : 'Delete this credit note?'
        }
        rectificationPrompt="Reason for deleting credit note *"
        rectificationPlaceholder="e.g. Duplicate credit note, settled separately, wrong entry"
        reasonPresets={['Duplicate credit note', 'Settled separately', 'Wrong amount/party', 'Test entry']}
        commentMinLength={4}
        confirmButtonLabel="Delete Note"
        variant="danger"
      />
    </>
  );
};
