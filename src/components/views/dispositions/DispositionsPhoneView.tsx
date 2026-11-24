import React from 'react';
import { ArrowLeft, CheckCircle2, ChevronDown, Printer } from 'lucide-react';
import { GRN, InventoryBatch, InventoryDisposition, InventoryDispositionType, Warehouse } from '../../../types';
import { money } from '../../../utils/billing';
import { printDispositionClaimVoucher } from '../../../utils/dispositionCn';
import { writeOffNetForPeriod } from '../../../utils/pnlBridge';
import { CustomerReturnLauncher } from '../../common/CustomerReturnLauncher';
import { ConfirmModal } from '../../ui/ConfirmModal';
import { CustomerReturnsList } from '../CustomerReturnsList';
import { ExpiryReturnsTracker, trackedStage } from '../ExpiryReturnsTracker';
import {
  ClaimSchemeChoice,
  fmtPhoneRupees,
  isFreeIssue,
  needsCompensation,
  today,
  TYPE_OPTIONS,
} from './dispositionConstants';

interface DispositionsPhoneViewProps {
  msg: string | null;
  filtered: InventoryDisposition[];
  inventoryDispositions: InventoryDisposition[];
  warehouses: Warehouse[];
  warehouseFilter: string;
  setWhFilter: (whId: string) => void;
  typeFilter: string;
  setTypeFilter: (t: string) => void;
  showPhoneWhSheet: boolean;
  setShowPhoneWhSheet: React.Dispatch<React.SetStateAction<boolean>>;
  showPhoneTypeSheet: boolean;
  setShowPhoneTypeSheet: React.Dispatch<React.SetStateAction<boolean>>;
  expandedPhoneLedgerId: string | null;
  setExpandedPhoneLedgerId: React.Dispatch<React.SetStateAction<string | null>>;
  decideTarget: InventoryDisposition | null;
  setDecideTarget: React.Dispatch<React.SetStateAction<InventoryDisposition | null>>;
  decideChoice: 'company' | 'scrap' | 'discard' | 'later';
  setDecideChoice: React.Dispatch<React.SetStateAction<'company' | 'scrap' | 'discard' | 'later'>>;
  decideHandedDate: string;
  setDecideHandedDate: React.Dispatch<React.SetStateAction<string>>;
  setDecideRef: React.Dispatch<React.SetStateAction<string>>;
  confirmPhoneDecide: () => void;
  openCnPanel: (r: InventoryDisposition) => void;
  orgProfile: any;
  deleteTarget: { id: any; settled: boolean; stockApplied: boolean } | null;
  setDeleteTarget: React.Dispatch<React.SetStateAction<{ id: any; settled: boolean; stockApplied: boolean } | null>>;
  deleteInventoryDisposition: (id: any, opts?: { restoreStock?: boolean }) => void;
  showForm: boolean;
  setShowForm: React.Dispatch<React.SetStateAction<boolean>>;
  warehouseId: string;
  setWarehouseId: React.Dispatch<React.SetStateAction<string>>;
  productId: number | '';
  setProductId: React.Dispatch<React.SetStateAction<number | ''>>;
  batchId: string;
  setBatchId: React.Dispatch<React.SetStateAction<string>>;
  productsInWarehouse: { id: number; name: string; stock: number }[];
  batchesForSelection: InventoryBatch[];
  quantity: number | '';
  setQuantity: React.Dispatch<React.SetStateAction<number | ''>>;
  eventDate: string;
  setEventDate: React.Dispatch<React.SetStateAction<string>>;
  dispositionType: InventoryDispositionType;
  setDispositionType: React.Dispatch<React.SetStateAction<InventoryDispositionType>>;
  reduceStock: boolean;
  setReduceStock: React.Dispatch<React.SetStateAction<boolean>>;
  supplierName: string;
  setSupplierName: React.Dispatch<React.SetStateAction<string>>;
  setSupplierInvoiceNo: React.Dispatch<React.SetStateAction<string>>;
  grnId: string;
  setGrnId: React.Dispatch<React.SetStateAction<string>>;
  grns: GRN[];
  distributedToName: string;
  setDistributedToName: React.Dispatch<React.SetStateAction<string>>;
  notes: string;
  setNotes: React.Dispatch<React.SetStateAction<string>>;
  phoneAttachment: string;
  setPhoneAttachment: React.Dispatch<React.SetStateAction<string>>;
  referenceDocNo: string;
  setReferenceDocNo: React.Dispatch<React.SetStateAction<string>>;
  handleSubmit: (e: React.FormEvent) => void;
  compId: string | null;
  setCompId: React.Dispatch<React.SetStateAction<string | null>>;
  cnNo: string;
  setCnNo: React.Dispatch<React.SetStateAction<string>>;
  cnDate: string;
  setCnDate: React.Dispatch<React.SetStateAction<string>>;
  cnLinkGrnId: string;
  setCnLinkGrnId: React.Dispatch<React.SetStateAction<string>>;
  cnScheme: ClaimSchemeChoice;
  setCnScheme: React.Dispatch<React.SetStateAction<ClaimSchemeChoice>>;
  cnTaxable: number | '';
  setCnTaxable: React.Dispatch<React.SetStateAction<number | ''>>;
  cnCgst: number | '';
  cnSgst: number | '';
  cnIgst: number | '';
  compAmt: number | '';
  setCompAmt: React.Dispatch<React.SetStateAction<number | ''>>;
  submitCompensation: () => void;
}

export const DispositionsPhoneView: React.FC<DispositionsPhoneViewProps> = ({
  msg,
  filtered,
  inventoryDispositions,
  warehouses,
  warehouseFilter,
  setWhFilter,
  typeFilter,
  setTypeFilter,
  showPhoneWhSheet,
  setShowPhoneWhSheet,
  showPhoneTypeSheet,
  setShowPhoneTypeSheet,
  expandedPhoneLedgerId,
  setExpandedPhoneLedgerId,
  decideTarget,
  setDecideTarget,
  decideChoice,
  setDecideChoice,
  decideHandedDate,
  setDecideHandedDate,
  setDecideRef,
  confirmPhoneDecide,
  openCnPanel,
  orgProfile,
  deleteTarget,
  setDeleteTarget,
  deleteInventoryDisposition,
  showForm,
  setShowForm,
  warehouseId,
  setWarehouseId,
  productId,
  setProductId,
  batchId,
  setBatchId,
  productsInWarehouse,
  batchesForSelection,
  quantity,
  setQuantity,
  eventDate,
  setEventDate,
  dispositionType,
  setDispositionType,
  reduceStock,
  setReduceStock,
  supplierName,
  setSupplierName,
  setSupplierInvoiceNo,
  grnId,
  setGrnId,
  grns,
  distributedToName,
  setDistributedToName,
  notes,
  setNotes,
  phoneAttachment,
  setPhoneAttachment,
  referenceDocNo,
  setReferenceDocNo,
  handleSubmit,
  compId,
  setCompId,
  cnNo,
  setCnNo,
  cnDate,
  setCnDate,
  cnLinkGrnId,
  setCnLinkGrnId,
  cnScheme,
  setCnScheme,
  cnTaxable,
  setCnTaxable,
  cnCgst,
  cnSgst,
  cnIgst,
  compAmt,
  setCompAmt,
  submitCompensation,
}) => {
  const whLabel =
    warehouseFilter === 'all'
      ? 'All godowns'
      : warehouses.find((w) => w.id === warehouseFilter)?.name || 'Godown';
  const typeLabel =
    typeFilter === 'all'
      ? 'All types'
      : TYPE_OPTIONS.find((t) => t.id === typeFilter)?.label || typeFilter;

  const phonePendingCustomerReturns = filtered.filter(
    (r) => !!r.returnTracking && trackedStage(r) === 'held'
  );
  const phoneLedgerRows = filtered.filter(
    (r) => !(!!r.returnTracking && trackedStage(r) === 'held')
  );

  const phoneNetStats = writeOffNetForPeriod(filtered);
  const phoneCasesCount = filtered.reduce((s, r) => s + (Number(r.quantity) || 0), 0);

  const targetCompRow = compId ? inventoryDispositions.find((d) => d.id === compId) : undefined;
  const compComputed = (Number(cnTaxable) || 0) + (Number(cnCgst) || 0) + (Number(cnSgst) || 0) + (Number(cnIgst) || 0);
  const compFinalTotal = Number(compAmt) || compComputed || Number(targetCompRow?.costValue || 0);

  return (
    <div className="space-y-3 hh-inv-pb">
      {msg && (
        <div className="hh-inv-card hh-inv-card--alert-blue flex items-center gap-2 text-[13px] font-bold text-[#101D3A]">
          <CheckCircle2 size={16} className="text-[#16A34A] shrink-0" />
          <span className="flex-1">{msg}</span>
        </div>
      )}

      {/* Filter chips row */}
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
        <button
          type="button"
          onClick={() => setShowPhoneWhSheet(true)}
          className={`shrink-0 h-9 px-4 rounded-full text-[12.5px] font-bold cursor-pointer inline-flex items-center gap-1.5 ${
            warehouseFilter === 'all'
              ? 'bg-[#101D3A] text-white'
              : 'bg-[#2864D9] text-white'
          }`}
        >
          <span>{whLabel}</span>
        </button>
        <button
          type="button"
          onClick={() => setShowPhoneTypeSheet(true)}
          className={`shrink-0 h-9 px-3.5 rounded-full text-[12.5px] font-bold border cursor-pointer inline-flex items-center gap-1 ${
            typeFilter !== 'all'
              ? 'bg-[#EBF2FE] border-[#2864D9] text-[#2864D9]'
              : 'bg-white border-slate-200 text-[#101D3A]'
          }`}
        >
          <span>{typeLabel}</span>
          <ChevronDown size={13} />
        </button>
        <CustomerReturnLauncher className="shrink-0 h-9 px-3.5 rounded-full border border-amber-300 bg-amber-50 text-amber-900 text-[12px] font-bold inline-flex items-center gap-1 cursor-pointer ml-auto" />
      </div>

      {/* 3-metric Summary Card */}
      <div className="hh-inv-card grid grid-cols-3 gap-2">
        <div>
          <div className="text-xs font-semibold text-slate-500">Entries</div>
          <div className="text-[19px] font-extrabold text-[#101D3A] tabular-nums mt-0.5">
            {filtered.length}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-500">Cases</div>
          <div className="text-[19px] font-extrabold text-[#101D3A] tabular-nums mt-0.5">
            {phoneCasesCount}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-500">Net loss</div>
          <div className="text-[19px] font-extrabold text-[#DC2626] tabular-nums mt-0.5">
            {fmtPhoneRupees(phoneNetStats.net)}
          </div>
        </div>
      </div>

      {/* Pending Customer Expired / Damaged Returns */}
      {phonePendingCustomerReturns.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 px-0.5">
            CUSTOMER EXPIRED / DAMAGED RETURNS · {phonePendingCustomerReturns.length} PENDING
          </div>
          {phonePendingCustomerReturns.map((d) => {
            const rt = d.returnTracking!;
            return (
              <div key={d.id} className="hh-inv-card flex items-center justify-between gap-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-[14.5px] font-extrabold text-[#101D3A] truncate">
                    {rt.customerName}
                  </div>
                  <div className="text-[12px] text-slate-500 mt-0.5 truncate">
                    {d.productName || `Product #${d.productId}`} · {d.quantity} cs ·{' '}
                    {d.reason || 'expired'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDecideTarget(d);
                    setDecideChoice(rt.decision === 'discard' ? 'discard' : 'company');
                    setDecideHandedDate(rt.sentOn || today());
                    setDecideRef(rt.sentRef || '');
                  }}
                  className="shrink-0 px-3.5 py-1.5 rounded-full bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] text-[12px] font-extrabold cursor-pointer"
                >
                  Decide
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Disposals & Claims Ledger List */}
      <div className="space-y-2 hh-tgrid-2">
        {phoneLedgerRows.length === 0 && phonePendingCustomerReturns.length === 0 ? (
          <div className="hh-inv-card text-center py-6 space-y-1.5">
            <div className="text-[13.5px] font-bold text-[#101D3A]">No returns or disposals yet</div>
            <p className="text-[12px] text-slate-500">
              Record supplier claims, customer returns, or stock write-offs below.
            </p>
          </div>
        ) : (
          phoneLedgerRows.map((r) => {
            const typeShort =
              r.dispositionType.includes('writeoff')
                ? 'Write-off'
                : r.dispositionType.includes('free')
                  ? 'Free issue'
                  : 'Claim';
            const isOpen = expandedPhoneLedgerId === r.id;
            const isClaimPending =
              r.compensationStatus === 'pending' || r.compensationStatus === 'partial';
            const isSettled = r.compensationStatus === 'settled';
            return (
              <div key={r.id} className="hh-inv-card space-y-2">
                <button
                  type="button"
                  onClick={() => setExpandedPhoneLedgerId(isOpen ? null : r.id)}
                  className="w-full text-left flex items-start justify-between gap-2.5 cursor-pointer"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-extrabold text-[#101D3A] leading-snug">
                      {typeShort} · {r.productName || `#${r.productId}`}
                    </div>
                    <div className="text-[12px] text-slate-500 mt-0.5 leading-snug">
                      {r.batchNumber ? `${r.batchNumber} · ` : ''}
                      {r.quantity} cs · {r.reason || r.eventDate}
                      {r.supplierName ? ` · ${r.supplierName}` : ''}
                    </div>
                    {r.creditNoteNumber && (
                      <div className="text-xs font-bold text-[#15803D] mt-0.5">
                        CN {r.creditNoteNumber}
                        {r.compensatedAmount ? ` · ₹${money(r.compensatedAmount)} recovered` : ''}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <div
                      className={`text-[14.5px] font-extrabold tabular-nums ${
                        isSettled ? 'text-[#15803D]' : 'text-[#DC2626]'
                      }`}
                    >
                      ₹{money(r.costValue)}
                    </div>
                    {isClaimPending && (
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        {r.compensationStatus === 'partial' ? 'Partial CN' : 'Claim open'}
                      </span>
                    )}
                  </div>
                </button>

                {isOpen && (
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2">
                    {isClaimPending && (
                      <button
                        type="button"
                        onClick={() => openCnPanel(r)}
                        className="px-3 py-1.5 rounded-full bg-[#2864D9] text-white text-[12px] font-bold cursor-pointer"
                      >
                        Record CN
                      </button>
                    )}
                    {isSettled && (
                      <button
                        type="button"
                        onClick={() => openCnPanel(r)}
                        className="px-3 py-1.5 rounded-full border border-slate-300 bg-white text-[#101D3A] text-[12px] font-bold cursor-pointer"
                      >
                        Edit CN
                      </button>
                    )}
                    {(isClaimPending || isSettled) && (
                      <button
                        type="button"
                        onClick={() => printDispositionClaimVoucher([r], orgProfile)}
                        className="px-3 py-1.5 rounded-full border border-slate-300 bg-white text-slate-700 text-[12px] font-bold cursor-pointer inline-flex items-center gap-1"
                      >
                        <Printer size={12} /> Print
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteTarget({
                          id: r.id,
                          settled: r.compensationStatus === 'settled',
                          stockApplied: r.stockApplied !== false,
                        })
                      }
                      className="px-3 py-1.5 rounded-full bg-rose-50 text-[#E11D48] text-[12px] font-bold cursor-pointer ml-auto"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Collapsible full customer return history so nothing is lost */}
      <details className="hh-inv-card">
        <summary className="cursor-pointer text-[13px] font-bold text-[#101D3A]">
          All customer returns &amp; detailed tracker
        </summary>
        <div className="mt-3 space-y-3">
          <CustomerReturnsList />
          <ExpiryReturnsTracker onRecordCn={openCnPanel} />
        </div>
      </details>

      {/* Bottom CTA */}
      <div className="hh-inv-cta-dock">
        <button
          type="button"
          onClick={() => {
            setShowForm(true);
            if (!warehouseId) {
              setWarehouseId(
                warehouseFilter !== 'all' ? warehouseFilter : warehouses[0]?.id || ''
              );
            }
          }}
          className="hh-inv-btn-primary w-full"
        >
          New return / disposal
        </button>
      </div>

      {/* Decide Customer Return Bottom Sheet */}
      {decideTarget && decideTarget.returnTracking && (
        <div
          className="rt-bsheet-scrim"
          role="presentation"
          onClick={() => setDecideTarget(null)}
        >
          <div
            className="rt-bsheet"
            role="dialog"
            aria-modal="true"
            aria-label="Customer return decision"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="hh-grab" />
            <div className="space-y-3 pb-1">
              <div>
                <h3 className="text-[18px] font-extrabold text-[#101D3A]">
                  Customer return
                </h3>
                <p className="text-[12.5px] text-slate-500 mt-0.5">
                  {decideTarget.returnTracking.customerName} · {decideTarget.productName} ·{' '}
                  {decideTarget.quantity} cs {decideTarget.reason || 'expired'}
                </p>
              </div>

              <div className="space-y-2">
                {[
                  {
                    id: 'company' as const,
                    title: 'Send to company',
                    sub: 'Creates a supplier claim; handed over on a date',
                  },
                  {
                    id: 'scrap' as const,
                    title: 'Scrap',
                    sub: 'Write off the stock',
                  },
                  {
                    id: 'discard' as const,
                    title: 'Throw out',
                    sub: 'Dispose, no claim',
                  },
                  {
                    id: 'later' as const,
                    title: 'Decide later',
                    sub: 'Keep it pending',
                  },
                ].map((opt) => {
                  const active = decideChoice === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setDecideChoice(opt.id)}
                      className={`w-full text-left rounded-xl border px-3.5 py-2.5 cursor-pointer transition ${
                        active
                          ? 'border-2 border-[#2864D9] bg-white'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="text-[13.5px] font-extrabold text-[#101D3A]">
                        {opt.title}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {opt.sub}
                      </div>
                    </button>
                  );
                })}
              </div>

              {decideChoice === 'company' && (
                <div className="grid grid-cols-1 gap-2">
                  <div className="hh-inv-field">
                    <span className="hh-inv-field__label">Handed over on</span>
                    <input
                      type="date"
                      value={decideHandedDate}
                      max={today()}
                      onChange={(e) => setDecideHandedDate(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={confirmPhoneDecide}
                className="hh-inv-btn-primary w-full"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phone Godown Picker Sheet */}
      {showPhoneWhSheet && (
        <div
          className="rt-bsheet-scrim"
          role="presentation"
          onClick={() => setShowPhoneWhSheet(false)}
        >
          <div
            className="rt-bsheet"
            role="dialog"
            aria-modal="true"
            aria-label="Filter godown"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="hh-grab" />
            <div className="space-y-2 pb-2">
              <h3 className="text-[16px] font-extrabold text-[#101D3A] mb-2">
                Filter by godown
              </h3>
              <button
                type="button"
                onClick={() => {
                  setWhFilter('all');
                  setShowPhoneWhSheet(false);
                }}
                className={`w-full text-left rounded-xl border px-3.5 py-2.5 text-[13.5px] font-bold ${
                  warehouseFilter === 'all'
                    ? 'border-2 border-[#2864D9] text-[#2864D9]'
                    : 'border-slate-200 text-[#101D3A]'
                }`}
              >
                All godowns
              </button>
              {warehouses.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => {
                    setWhFilter(w.id);
                    setShowPhoneWhSheet(false);
                  }}
                  className={`w-full text-left rounded-xl border px-3.5 py-2.5 text-[13.5px] font-bold ${
                    warehouseFilter === w.id
                      ? 'border-2 border-[#2864D9] text-[#2864D9]'
                      : 'border-slate-200 text-[#101D3A]'
                  }`}
                >
                  {w.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Phone Type Picker Sheet */}
      {showPhoneTypeSheet && (
        <div
          className="rt-bsheet-scrim"
          role="presentation"
          onClick={() => setShowPhoneTypeSheet(false)}
        >
          <div
            className="rt-bsheet"
            role="dialog"
            aria-modal="true"
            aria-label="Filter type"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="hh-grab" />
            <div className="space-y-1.5 max-h-[65vh] overflow-y-auto pb-2">
              <h3 className="text-[16px] font-extrabold text-[#101D3A] mb-2">
                Filter by type
              </h3>
              <button
                type="button"
                onClick={() => {
                  setTypeFilter('all');
                  setShowPhoneTypeSheet(false);
                }}
                className={`w-full text-left rounded-xl border px-3.5 py-2.5 text-[13.5px] font-bold ${
                  typeFilter === 'all'
                    ? 'border-2 border-[#2864D9] text-[#2864D9]'
                    : 'border-slate-200 text-[#101D3A]'
                }`}
              >
                All types
              </button>
              {TYPE_OPTIONS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTypeFilter(t.id);
                    setShowPhoneTypeSheet(false);
                  }}
                  className={`w-full text-left rounded-xl border px-3.5 py-2.5 text-[13px] font-bold ${
                    typeFilter === t.id
                      ? 'border-2 border-[#2864D9] text-[#2864D9]'
                      : 'border-slate-200 text-[#101D3A]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Phone New Return / Disposal Full-screen Form */}
      {showForm && (
        <div className="rt-flow-phone">
          <div className="hh-sales-top hh-sales-top--flush hh-inv-top hh-inv-top--flow">
            <div className="hh-sales-top__row">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="hh-inv-backbtn"
              >
                <ArrowLeft size={20} strokeWidth={2.3} />
                <span>New return / disposal</span>
              </button>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              if (phoneAttachment.trim() && !referenceDocNo) {
                setReferenceDocNo(phoneAttachment.trim());
              }
              handleSubmit(e);
            }}
            className="rt-flow-phone__body space-y-2.5"
            style={{ paddingBottom: '120px' }}
          >
            {msg && (
              <div className="hh-inv-card hh-inv-card--alert-amber text-[12.5px] font-bold text-[#101D3A]">
                {msg}
              </div>
            )}
            <div className="hh-inv-field hh-inv-field--focus">
              <span className="hh-inv-field__label">Product / batch</span>
              <select
                value={productId}
                onChange={(e) => {
                  setProductId(e.target.value ? Number(e.target.value) : '');
                  setBatchId('');
                }}
                required
              >
                <option value="">
                  {!warehouseId
                    ? 'Select godown below first...'
                    : productsInWarehouse.length === 0
                      ? 'No stocked products in godown'
                      : 'Select product...'}
                </option>
                {productsInWarehouse.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.stock} cs)
                  </option>
                ))}
              </select>
            </div>

            {productId && batchesForSelection.length > 0 && (
              <div className="hh-inv-field">
                <span className="hh-inv-field__label">Batch / lot (FEFO)</span>
                <select
                  value={batchId}
                  onChange={(e) => {
                    setBatchId(e.target.value);
                    const b = batchesForSelection.find((x) => x.id === e.target.value);
                    if (b?.supplierName) setSupplierName(b.supplierName);
                    if (b?.supplierInvoiceNo) setSupplierInvoiceNo(b.supplierInvoiceNo);
                  }}
                >
                  <option value="">Auto FEFO (earliest expiry)</option>
                  {batchesForSelection.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.batchNumber || b.id} · {b.quantity} cs · exp {b.expiryDate || '—'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <div className="hh-inv-field">
                <span className="hh-inv-field__label">Qty (cases)</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0.01}
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value ? Number(e.target.value) : '')}
                  placeholder="0"
                  required
                />
              </div>
              <div className="hh-inv-field">
                <span className="hh-inv-field__label">Event date</span>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="hh-inv-field">
              <span className="hh-inv-field__label">Type / reason</span>
              <select
                value={dispositionType}
                onChange={(e) => setDispositionType(e.target.value as InventoryDispositionType)}
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="hh-inv-field">
              <span className="hh-inv-field__label">Warehouse / godown</span>
              <select
                value={warehouseId}
                onChange={(e) => {
                  setWarehouseId(e.target.value);
                  setProductId('');
                  setBatchId('');
                }}
                required
              >
                <option value="">Select godown...</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5 pt-0.5">
              <div className="text-[12px] font-bold text-[#101D3A]">Stock impact</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setReduceStock(true)}
                  className={`rounded-xl border px-3 py-2.5 text-[12.5px] font-extrabold text-center cursor-pointer ${
                    reduceStock
                      ? 'border-2 border-[#2864D9] bg-[#EBF2FE] text-[#101D3A]'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  Reduce stock
                </button>
                <button
                  type="button"
                  onClick={() => setReduceStock(false)}
                  className={`rounded-xl border px-3 py-2.5 text-[12px] font-bold text-center cursor-pointer leading-tight ${
                    !reduceStock
                      ? 'border-2 border-[#2864D9] bg-[#EBF2FE] text-[#101D3A]'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  Save only (document / claim)
                </button>
              </div>
            </div>

            {needsCompensation(dispositionType) && (
              <div className="hh-inv-card space-y-2">
                <div className="hh-inv-field">
                  <span className="hh-inv-field__label">Supplier name</span>
                  <input
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div className="hh-inv-field">
                  <span className="hh-inv-field__label">Link GRN (optional)</span>
                  <select value={grnId} onChange={(e) => setGrnId(e.target.value)}>
                    <option value="">None</option>
                    {grns.slice(0, 60).map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.grnNumber || g.id} · {g.supplierName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {isFreeIssue(dispositionType) && (
              <div className="hh-inv-card space-y-2">
                <div className="hh-inv-field">
                  <span className="hh-inv-field__label">Distributed to</span>
                  <input
                    value={distributedToName}
                    onChange={(e) => setDistributedToName(e.target.value)}
                    placeholder="Customer / route"
                  />
                </div>
              </div>
            )}

            <div className="hh-inv-field">
              <span className="hh-inv-field__label">Notes</span>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional"
              />
            </div>

            <div className="hh-inv-field">
              <span className="hh-inv-field__label">Attachment / scan</span>
              <input
                value={phoneAttachment || referenceDocNo}
                onChange={(e) => {
                  setPhoneAttachment(e.target.value);
                  setReferenceDocNo(e.target.value);
                }}
                placeholder="Drive link or photo path"
              />
            </div>

            <button type="submit" className="hh-inv-btn-primary w-full mt-2">
              Save
            </button>
          </form>
        </div>
      )}

      {/* Phone Record / Edit Credit Note Full-screen Flow */}
      {compId && targetCompRow && (
        <div className="rt-flow-phone">
          <div className="hh-sales-top hh-sales-top--flush hh-inv-top hh-inv-top--flow">
            <div className="hh-sales-top__row">
              <button
                type="button"
                onClick={() => setCompId(null)}
                className="hh-inv-backbtn"
              >
                <ArrowLeft size={20} strokeWidth={2.3} />
                <span>
                  {targetCompRow.compensationStatus === 'settled'
                    ? 'Edit credit note'
                    : 'Record credit note'}
                </span>
              </button>
            </div>
          </div>

          <div className="rt-flow-phone__body space-y-2.5" style={{ paddingBottom: '120px' }}>
            {msg && (
              <div className="hh-inv-card hh-inv-card--alert-amber text-[12.5px] font-bold text-[#101D3A]">
                {msg}
              </div>
            )}
            <div className="hh-inv-field hh-inv-field--focus">
              <span className="hh-inv-field__label">Credit note number</span>
              <input
                value={cnNo}
                onChange={(e) => setCnNo(e.target.value)}
                placeholder="CN-FZ-221"
              />
            </div>

            <div className="hh-inv-field">
              <span className="hh-inv-field__label">Credit note date</span>
              <input
                type="date"
                value={cnDate}
                onChange={(e) => setCnDate(e.target.value)}
              />
            </div>

            <div className="hh-inv-field">
              <span className="hh-inv-field__label">Link GRN (optional)</span>
              <select value={cnLinkGrnId} onChange={(e) => setCnLinkGrnId(e.target.value)}>
                <option value="">None</option>
                {grns.slice(0, 60).map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.grnNumber || g.id} · {g.supplierName}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5 pt-0.5">
              <div className="text-[12px] font-bold text-[#101D3A]">Credit type</div>
              <div className="space-y-1.5">
                {[
                  { id: 'value_credit' as const, label: 'Full value credit' },
                  { id: 'free_bogo' as const, label: 'Free goods (B1G1 / Buy X Get Y)' },
                  { id: 'near_expiry_swap' as const, label: 'Near-expiry free swap' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setCnScheme(opt.id)}
                    className={`w-full rounded-xl border px-3.5 py-2.5 text-[13px] font-extrabold text-left cursor-pointer ${
                      cnScheme === opt.id
                        ? 'border-2 border-[#2864D9] bg-white text-[#101D3A]'
                        : 'border-slate-200 bg-white text-[#101D3A]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="hh-inv-field">
                <span className="hh-inv-field__label">Taxable (₹)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={cnTaxable}
                  onChange={(e) => setCnTaxable(e.target.value ? Number(e.target.value) : '')}
                  placeholder="0"
                />
              </div>
              <div className="hh-inv-field">
                <span className="hh-inv-field__label">Total CN (₹)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={compAmt}
                  onChange={(e) => setCompAmt(e.target.value ? Number(e.target.value) : '')}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="hh-inv-card space-y-2">
              <div className="flex justify-between text-[13px] text-slate-700">
                <span>
                  {targetCompRow.productName || `#${targetCompRow.productId}`} ·{' '}
                  {targetCompRow.quantity} cs
                </span>
                <span className="font-bold tabular-nums">
                  ₹{money(targetCompRow.costValue)}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-100 flex justify-between items-baseline">
                <span className="text-[14px] font-extrabold text-[#101D3A]">Credit total</span>
                <span className="text-[17px] font-extrabold text-[#101D3A] tabular-nums">
                  ₹{money(compFinalTotal)}
                </span>
              </div>
            </div>
          </div>

          <div className="rt-flow-phone__footer flex gap-2.5">
            <button
              type="button"
              onClick={() => setCompId(null)}
              className="hh-inv-btn-outline flex-1"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitCompensation}
              className="hh-inv-btn-primary flex-1"
            >
              {targetCompRow.compensationStatus === 'settled' ? 'Update CN' : 'Record CN'}
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget)
            deleteInventoryDisposition(deleteTarget.id, { restoreStock: deleteTarget.stockApplied });
          setDeleteTarget(null);
        }}
        title="Delete this disposition?"
        message={
          deleteTarget?.settled
            ? deleteTarget.stockApplied
              ? 'This claim is SETTLED with a credit note. Deleting removes the disposal, its linked supplier CN and returns the stock.'
              : 'This claim is SETTLED with a credit note. Deleting removes the record and its linked supplier CN (godown stock is unchanged).'
            : deleteTarget?.stockApplied
              ? 'The stock will return to inventory.'
              : 'This removes the document / customer-return tracking record without changing godown stock.'
        }
        confirmButtonLabel="Delete"
      />
    </div>
  );
};
