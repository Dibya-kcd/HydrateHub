import React from 'react';
import { Gift, RotateCcw, Truck, X } from 'lucide-react';
import { GRN, InventoryBatch, InventoryDisposition, InventoryDispositionType, Warehouse } from '../../../types';
import { money } from '../../../utils/billing';
import { ClaimSchemeChoice, isFreeIssue, needsCompensation, TYPE_OPTIONS } from './dispositionConstants';

interface DispositionsModalsProps {
  showForm: boolean;
  setShowForm: React.Dispatch<React.SetStateAction<boolean>>;
  handleSubmit: (e: React.FormEvent) => void;
  dispositionType: InventoryDispositionType;
  setDispositionType: React.Dispatch<React.SetStateAction<InventoryDispositionType>>;
  warehouseId: string;
  setWarehouseId: React.Dispatch<React.SetStateAction<string>>;
  warehouses: Warehouse[];
  productId: number | '';
  setProductId: React.Dispatch<React.SetStateAction<number | ''>>;
  productsInWarehouse: { id: number; name: string; stock: number }[];
  batchId: string;
  setBatchId: React.Dispatch<React.SetStateAction<string>>;
  batchesForSelection: InventoryBatch[];
  grns: GRN[];
  setGrnId: React.Dispatch<React.SetStateAction<string>>;
  grnId: string;
  quantity: number | '';
  setQuantity: React.Dispatch<React.SetStateAction<number | ''>>;
  costPer: number;
  reduceStock: boolean;
  setReduceStock: React.Dispatch<React.SetStateAction<boolean>>;
  claimScheme: ClaimSchemeChoice;
  setClaimScheme: React.Dispatch<React.SetStateAction<ClaimSchemeChoice>>;
  schemeBuyQty: number | '';
  setSchemeBuyQty: React.Dispatch<React.SetStateAction<number | ''>>;
  schemeFreeQty: number | '';
  setSchemeFreeQty: React.Dispatch<React.SetStateAction<number | ''>>;
  schemeDiscountPct: number | '';
  setSchemeDiscountPct: React.Dispatch<React.SetStateAction<number | ''>>;
  eventDate: string;
  setEventDate: React.Dispatch<React.SetStateAction<string>>;
  referenceDocNo: string;
  setReferenceDocNo: React.Dispatch<React.SetStateAction<string>>;
  supplierName: string;
  setSupplierName: React.Dispatch<React.SetStateAction<string>>;
  supplierInvoiceNo: string;
  setSupplierInvoiceNo: React.Dispatch<React.SetStateAction<string>>;
  distributedToName: string;
  setDistributedToName: React.Dispatch<React.SetStateAction<string>>;
  distributedToPhone: string;
  setDistributedToPhone: React.Dispatch<React.SetStateAction<string>>;
  reason: string;
  setReason: React.Dispatch<React.SetStateAction<string>>;
  notes: string;
  setNotes: React.Dispatch<React.SetStateAction<string>>;
  requireApproval: boolean;
  setRequireApproval: React.Dispatch<React.SetStateAction<boolean>>;
  compId: string | null;
  setCompId: React.Dispatch<React.SetStateAction<string | null>>;
  inventoryDispositions: InventoryDisposition[];
  reopenClaim: (id: string) => void;
  claimVal: number | '';
  setClaimVal: React.Dispatch<React.SetStateAction<number | ''>>;
  cnNo: string;
  setCnNo: React.Dispatch<React.SetStateAction<string>>;
  cnDate: string;
  setCnDate: React.Dispatch<React.SetStateAction<string>>;
  cnTaxable: number | '';
  setCnTaxable: React.Dispatch<React.SetStateAction<number | ''>>;
  compAmt: number | '';
  setCompAmt: React.Dispatch<React.SetStateAction<number | ''>>;
  cnCgst: number | '';
  setCnCgst: React.Dispatch<React.SetStateAction<number | ''>>;
  cnSgst: number | '';
  setCnSgst: React.Dispatch<React.SetStateAction<number | ''>>;
  cnIgst: number | '';
  setCnIgst: React.Dispatch<React.SetStateAction<number | ''>>;
  appendPayment: boolean;
  setAppendPayment: React.Dispatch<React.SetStateAction<boolean>>;
  cnAttachment: string;
  setCnAttachment: React.Dispatch<React.SetStateAction<string>>;
  cnScheme: ClaimSchemeChoice;
  setCnScheme: React.Dispatch<React.SetStateAction<ClaimSchemeChoice>>;
  cnSchemeNote: string;
  setCnSchemeNote: React.Dispatch<React.SetStateAction<string>>;
  submitCompensation: () => void;
  showMultiCn: boolean;
  setShowMultiCn: React.Dispatch<React.SetStateAction<boolean>>;
  selectedClaims: InventoryDisposition[];
  multiCnNo: string;
  setMultiCnNo: React.Dispatch<React.SetStateAction<string>>;
  multiCnDate: string;
  setMultiCnDate: React.Dispatch<React.SetStateAction<string>>;
  multiCnTotal: number | '';
  setMultiCnTotal: React.Dispatch<React.SetStateAction<number | ''>>;
  submitMultiCn: () => void;
}

export const DispositionsModals: React.FC<DispositionsModalsProps> = ({
  showForm,
  setShowForm,
  handleSubmit,
  dispositionType,
  setDispositionType,
  warehouseId,
  setWarehouseId,
  warehouses,
  productId,
  setProductId,
  productsInWarehouse,
  batchId,
  setBatchId,
  batchesForSelection,
  grns,
  setGrnId,
  grnId,
  quantity,
  setQuantity,
  costPer,
  reduceStock,
  setReduceStock,
  claimScheme,
  setClaimScheme,
  schemeBuyQty,
  setSchemeBuyQty,
  schemeFreeQty,
  setSchemeFreeQty,
  schemeDiscountPct,
  setSchemeDiscountPct,
  eventDate,
  setEventDate,
  referenceDocNo,
  setReferenceDocNo,
  supplierName,
  setSupplierName,
  supplierInvoiceNo,
  setSupplierInvoiceNo,
  distributedToName,
  setDistributedToName,
  distributedToPhone,
  setDistributedToPhone,
  reason,
  setReason,
  notes,
  setNotes,
  requireApproval,
  setRequireApproval,
  compId,
  setCompId,
  inventoryDispositions,
  reopenClaim,
  claimVal,
  setClaimVal,
  cnNo,
  setCnNo,
  cnDate,
  setCnDate,
  cnTaxable,
  setCnTaxable,
  compAmt,
  setCompAmt,
  cnCgst,
  setCnCgst,
  cnSgst,
  setCnSgst,
  cnIgst,
  setCnIgst,
  appendPayment,
  setAppendPayment,
  cnAttachment,
  setCnAttachment,
  cnScheme,
  setCnScheme,
  cnSchemeNote,
  setCnSchemeNote,
  submitCompensation,
  showMultiCn,
  setShowMultiCn,
  selectedClaims,
  multiCnNo,
  setMultiCnNo,
  multiCnDate,
  setMultiCnDate,
  multiCnTotal,
  setMultiCnTotal,
  submitMultiCn,
}) => {
  return (
    <>
      {/* New disposition modal */}
      {showForm && (
        <div aria-modal="true" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 p-0 sm:p-4" role="dialog">
          <div className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between">
              <h3 className="font-black text-slate-900 text-sm">New return / disposal</h3>
              <button aria-label="Close" type="button" onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Type</label>
                <select
                  value={dispositionType}
                  onChange={(e) => setDispositionType(e.target.value as InventoryDispositionType)}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-semibold"
                >
                  {TYPE_OPTIONS.map((t) => (
                    <option key={t.id} value={t.id}>{t.group}: {t.label}</option>
                  ))}
                </select>
              </div>

              {/* Flow: Warehouse → products with stock → batch → qty */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 space-y-3">
                <p className="text-xs font-bold text-slate-600">
                  1. Choose godown → 2. Product with remaining stock → 3. Batch (FEFO) → 4. Qty
                </p>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Warehouse / godown</label>
                  <select
                    value={warehouseId}
                    onChange={(e) => {
                      setWarehouseId(e.target.value);
                      setProductId('');
                      setBatchId('');
                    }}
                    className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                    required
                  >
                    <option value="">Select warehouse…</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Product (with stock in this godown)
                  </label>
                  <select
                    value={productId}
                    onChange={(e) => {
                      setProductId(e.target.value ? Number(e.target.value) : '');
                      setBatchId('');
                    }}
                    className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                    required
                    disabled={!warehouseId}
                  >
                    <option value="">
                      {!warehouseId
                        ? 'Select warehouse first…'
                        : productsInWarehouse.length === 0
                          ? 'No stocked products in this godown'
                          : 'Select product…'}
                    </option>
                    {productsInWarehouse.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {p.stock} cs remaining
                      </option>
                    ))}
                  </select>
                  {warehouseId && (
                    <p className="text-xs text-slate-500 mt-1 font-semibold">
                      {productsInWarehouse.length} product(s) with stock ·{' '}
                      {productsInWarehouse.reduce((s, p) => s + p.stock, 0)} cs total in godown
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Batch / lot (FEFO — earliest expiry first)
                  </label>
                  <select
                    value={batchId}
                    onChange={(e) => {
                      setBatchId(e.target.value);
                      const b = batchesForSelection.find((x) => x.id === e.target.value);
                      if (b?.supplierName) setSupplierName(b.supplierName);
                      if (b?.supplierInvoiceNo) {
                        setSupplierInvoiceNo(b.supplierInvoiceNo);
                        const match = grns.find(
                          (g) =>
                            (g.invoiceNo || '').trim().toLowerCase() === (b.supplierInvoiceNo || '').trim().toLowerCase() ||
                            (g.grnNumber || '').trim().toLowerCase() === (b.supplierInvoiceNo || '').trim().toLowerCase()
                        );
                        if (match) setGrnId(match.id);
                      }
                    }}
                    className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                    disabled={!productId || !warehouseId}
                  >
                    <option value="">Any lot in warehouse (auto FEFO)</option>
                    {batchesForSelection.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.batchNumber || b.id} · {b.quantity} cs · exp {b.expiryDate || '—'}
                        {b.supplierInvoiceNo ? ` · inv ${b.supplierInvoiceNo}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Qty (cases)</label>
                    <input
                      type="number" inputMode="numeric"
                      min={0.01}
                      step="any"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value ? Number(e.target.value) : '')}
                      className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono bg-white"
                      required
                    />
                  </div>
                  <div className="flex items-end">
                    {costPer > 0 && (
                      <p className="text-xs text-slate-600 font-semibold pb-2">
                        Cost ₹{money(costPer)}/cs · ≈ ₹{money(costPer * (Number(quantity) || 0))}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Stock impact */}
              <div className="rounded-xl border border-slate-200 p-3 space-y-2">
                <div className="text-xs font-black uppercase tracking-wider text-slate-500">Stock impact</div>
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="stockImpact"
                    checked={reduceStock}
                    onChange={() => setReduceStock(true)}
                    className="mt-1"
                  />
                  <span className="text-xs text-slate-800">
                    <strong className="font-black">Reduce stock</strong>
                    <span className="block text-slate-500 font-semibold">Cases leave the godown (return / write-off / free issue).</span>
                  </span>
                </label>
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="stockImpact"
                    checked={!reduceStock}
                    onChange={() => setReduceStock(false)}
                    className="mt-1"
                  />
                  <span className="text-xs text-slate-800">
                    <strong className="font-black">Save only (document / claim)</strong>
                    <span className="block text-slate-500 font-semibold">
                      No stock change — use when stock already moved or you only need a CN claim record.
                    </span>
                  </span>
                </label>
              </div>

              {/* Supplier scheme for CN / claim */}
              {needsCompensation(dispositionType) && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 space-y-2">
                  <div className="text-xs font-black uppercase tracking-wider text-amber-900">
                    Supplier compensation scheme (for credit note)
                  </div>
                  <select
                    value={claimScheme}
                    onChange={(e) => setClaimScheme(e.target.value as typeof claimScheme)}
                    className="w-full px-3 py-2 rounded-xl border border-amber-200 text-sm bg-white"
                  >
                    <option value="none">No special scheme — value CN later</option>
                    <option value="value_credit">Full value credit note (₹ claim)</option>
                    <option value="discount_pct">Discount % on CN (e.g. damaged goods)</option>
                    <option value="free_bogo">Free goods scheme (Buy X Get Y / B1G1)</option>
                    <option value="near_expiry_swap">Free near-expiry replacement / swap</option>
                  </select>
                  {claimScheme === 'free_bogo' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-bold text-slate-600">Buy qty</label>
                        <input
                          type="number" inputMode="numeric"
                          min={1}
                          value={schemeBuyQty}
                          onChange={(e) => setSchemeBuyQty(e.target.value ? Number(e.target.value) : '')}
                          className="mt-0.5 w-full px-2 py-1.5 rounded-lg border border-slate-300 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600">Free qty</label>
                        <input
                          type="number" inputMode="numeric"
                          min={1}
                          value={schemeFreeQty}
                          onChange={(e) => setSchemeFreeQty(e.target.value ? Number(e.target.value) : '')}
                          className="mt-0.5 w-full px-2 py-1.5 rounded-lg border border-slate-300 text-sm"
                        />
                      </div>
                    </div>
                  )}
                  {claimScheme === 'discount_pct' && (
                    <div>
                      <label className="text-xs font-bold text-slate-600">Discount %</label>
                      <input
                        type="number" inputMode="numeric"
                        min={0}
                        max={100}
                        value={schemeDiscountPct}
                        onChange={(e) => setSchemeDiscountPct(e.target.value ? Number(e.target.value) : '')}
                        className="mt-0.5 w-full px-2 py-1.5 rounded-lg border border-slate-300 text-sm"
                        placeholder="e.g. 50"
                      />
                    </div>
                  )}
                  <p className="text-xs text-amber-900/80 font-medium">
                    Saved on the claim notes. When the supplier issues the CN, use <strong>Record CN / Edit CN</strong> and confirm the scheme there.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Event date</label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Your ref no.</label>
                  <input
                    value={referenceDocNo}
                    onChange={(e) => setReferenceDocNo(e.target.value)}
                    placeholder="DN / RTN no."
                    className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>

              {needsCompensation(dispositionType) && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                  <div className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5" /> Supplier link
                  </div>
                  <input
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="Supplier name"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                  <input
                    value={supplierInvoiceNo}
                    onChange={(e) => setSupplierInvoiceNo(e.target.value)}
                    placeholder="Original supplier invoice no."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                  <select
                    value={grnId}
                    onChange={(e) => setGrnId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  >
                    <option value="">Link GRN (optional)</option>
                    {grns.slice(0, 80).map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.grnNumber || g.id} · {g.supplierName} · {g.invoiceNo}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-amber-800 font-medium">
                    Claim status starts as <strong>pending</strong>. After you receive the supplier credit note, use “Record CN”.
                  </p>
                </div>
              )}

              {isFreeIssue(dispositionType) && (
                <div className="rounded-xl border border-sky-200 bg-sky-50/80 p-3 space-y-2">
                  <div className="text-xs font-black uppercase tracking-wider text-sky-800 flex items-center gap-1">
                    <Gift className="w-3.5 h-3.5" /> Distributed to
                  </div>
                  <input
                    value={distributedToName}
                    onChange={(e) => setDistributedToName(e.target.value)}
                    placeholder="Customer / retailer / route"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                  <input inputMode="tel" autoComplete="tel"
                    value={distributedToPhone}
                    onChange={(e) => setDistributedToPhone(e.target.value)}
                    placeholder="Phone (optional)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Reason</label>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Short reason"
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requireApproval}
                  onChange={(e) => setRequireApproval(e.target.checked)}
                />
                Require approval before settling CN (maker–checker)
              </label>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-sky-600 text-white text-xs font-black cursor-pointer hover:bg-sky-500"
                >
                  {reduceStock ? 'Save & reduce stock' : 'Save document only'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Compensation / CN modal */}
      {compId && (() => {
        const targetRow = inventoryDispositions.find((d) => d.id === compId);
        const isSettled = targetRow?.compensationStatus === 'settled' || Number(targetRow?.compensatedAmount || 0) > 0;
        return (
          <div aria-modal="true" className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-900/50 p-0 sm:p-4" role="dialog">
            <div className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
              <div className="shrink-0 sticky top-0 z-10 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between">
                <div className="min-w-0 pr-2">
                  <h3 className="font-black text-slate-900 text-sm">
                    {isSettled ? 'Edit Supplier Credit Note' : 'Record Supplier Credit Note'}
                  </h3>
                  {targetRow && (
                    <p className="text-xs text-slate-500">
                      {targetRow.productName || `Product #${targetRow.productId}`} · Qty: {targetRow.quantity} cs · Claim Value: ₹{money(targetRow.costValue)}
                    </p>
                  )}
                </div>
                <button aria-label="Close" type="button" onClick={() => setCompId(null)} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {isSettled && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <span className="text-amber-900 font-medium">Claim is settled. Need to un-settle or re-open?</span>
                  <button
                    type="button"
                    onClick={() => reopenClaim(compId)}
                    className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-amber-900 font-bold hover:bg-amber-100 inline-flex items-center gap-1 cursor-pointer w-fit"
                  >
                    <RotateCcw className="w-3 h-3" /> Re-open (Pending)
                  </button>
                </div>
              )}

              {targetRow && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Claim value – cost of returned goods (₹, ex-GST)
                  </label>
                  <input
                    type="number" inputMode="decimal"
                    value={claimVal}
                    onChange={(e) => setClaimVal(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono bg-white"
                  />
                  <p className="text-xs text-slate-600 mt-1">
                    Saved at ₹{money(targetRow.costPerUnit)}/cs × {targetRow.quantity} cs = ₹{money((targetRow.costPerUnit || 0) * (targetRow.quantity || 0))}.
                    Change this if the stored value is wrong; the credit note status is judged against it.
                  </p>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Credit Note Number</label>
                <input
                  value={cnNo}
                  onChange={(e) => setCnNo(e.target.value)}
                  placeholder="e.g. CN-2026-001"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Credit Note Date</label>
                <input
                  type="date"
                  value={cnDate}
                  onChange={(e) => setCnDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Taxable Value (₹)</label>
                  <input
                    type="number" inputMode="decimal"
                    value={cnTaxable}
                    onChange={(e) => setCnTaxable(e.target.value ? Number(e.target.value) : '')}
                    placeholder="Taxable value"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Total CN Amount (₹)</label>
                  <input
                    type="number" inputMode="decimal"
                    value={compAmt}
                    onChange={(e) => setCompAmt(e.target.value ? Number(e.target.value) : '')}
                    placeholder="Total CN amount"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono font-bold text-emerald-800"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">CGST (₹)</label>
                  <input
                    type="number" inputMode="decimal"
                    value={cnCgst}
                    onChange={(e) => setCnCgst(e.target.value ? Number(e.target.value) : '')}
                    placeholder="CGST"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">SGST (₹)</label>
                  <input
                    type="number" inputMode="decimal"
                    value={cnSgst}
                    onChange={(e) => setCnSgst(e.target.value ? Number(e.target.value) : '')}
                    placeholder="SGST"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">IGST (₹, if inter-state)</label>
                <input
                  type="number" inputMode="decimal"
                  value={cnIgst}
                  onChange={(e) => setCnIgst(e.target.value ? Number(e.target.value) : '')}
                  placeholder="IGST"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono"
                />
              </div>
              <div className="rounded-xl border border-slate-200 p-3 space-y-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={appendPayment}
                    onChange={(e) => setAppendPayment(e.target.checked)}
                  />
                  Log as additional partial payment (add to amount already received)
                </label>
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Attachment / scan URL or file ref</label>
                  <input
                    value={cnAttachment}
                    onChange={(e) => setCnAttachment(e.target.value)}
                    placeholder="Drive link, photo path, or CN scan reference"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                {targetRow && Array.isArray(targetRow.compensationPayments) && targetRow.compensationPayments.length > 0 && (
                  <div className="text-xs text-slate-600 space-y-0.5">
                    <div className="font-black uppercase tracking-wider text-slate-500">Payment log</div>
                    {targetRow.compensationPayments.map((p) => (
                      <div key={p.id}>
                        {p.date}: ₹{money(p.amount)}
                        {p.cnNumber ? ` · ${p.cnNumber}` : ''}
                        {p.note ? ` · ${p.note}` : ''}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3 space-y-2">
                <div className="text-xs font-black uppercase tracking-wider text-sky-900">
                  Scheme on this credit note (optional)
                </div>
                <select
                  value={cnScheme}
                  onChange={(e) => setCnScheme(e.target.value as typeof cnScheme)}
                  className="w-full px-3 py-2 rounded-xl border border-sky-200 text-sm bg-white"
                >
                  <option value="none">Pure value CN (₹ only)</option>
                  <option value="value_credit">Full value credit</option>
                  <option value="discount_pct">Partial discount / damage %</option>
                  <option value="free_bogo">Free goods (B1G1 / Buy X Get Y)</option>
                  <option value="near_expiry_swap">Near-expiry free swap</option>
                </select>
                <input
                  value={cnSchemeNote}
                  onChange={(e) => setCnSchemeNote(e.target.value)}
                  placeholder="e.g. B2G1 free 10 cs near-expiry · or 50% damage discount"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              </div>

              <div className="shrink-0 sticky bottom-0 border-t border-slate-200 bg-white px-4 py-3 flex gap-2 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
                <button
                  type="button"
                  onClick={() => setCompId(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 cursor-pointer hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitCompensation}
                  className="flex-[1.4] py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-black cursor-pointer hover:bg-emerald-500 shadow-md shadow-emerald-600/20"
                >
                  {isSettled ? 'Update CN' : 'Save CN'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Multi-line supplier CN */}
      {showMultiCn && (
        <div aria-modal="true" className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-900/50 p-0 sm:p-4" role="dialog">
          <div className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-black text-sm text-slate-900">Multi-line Supplier Credit Note</h3>
                <p className="text-xs text-slate-500">{selectedClaims.length} claim line(s) · same CN number</p>
              </div>
              <button aria-label="Close" type="button" onClick={() => setShowMultiCn(false)} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-xs">
              <ul className="space-y-1.5">
                {selectedClaims.map((r) => (
                  <li key={r.id} className="flex justify-between gap-2 border border-slate-100 rounded-lg px-2.5 py-1.5">
                    <span className="font-semibold text-slate-800">{r.productName || r.productId} · {r.quantity} cs</span>
                    <span className="font-mono font-bold">₹{money(r.costValue || 0)}</span>
                  </li>
                ))}
              </ul>
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <label className="text-xs font-bold text-slate-600">CN Number</label>
                  <input value={multiCnNo} onChange={(e) => setMultiCnNo(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600">CN Date</label>
                  <input type="date" value={multiCnDate} onChange={(e) => setMultiCnDate(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600">Total CN ₹</label>
                  <input type="number" inputMode="decimal" value={multiCnTotal} onChange={(e) => setMultiCnTotal(e.target.value ? Number(e.target.value) : '')} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono" />
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Total is split across lines in proportion to each claim value. Adjust total if supplier paid a different amount.
              </p>
            </div>
            <div className="border-t border-slate-200 px-4 py-3 flex gap-2">
              <button type="button" onClick={() => setShowMultiCn(false)} className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-bold cursor-pointer">Cancel</button>
              <button type="button" onClick={submitMultiCn} className="flex-[1.4] py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-black cursor-pointer">Apply multi-line CN</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
