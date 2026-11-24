import React from 'react';
import { ChevronLeft, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { Bill, MonthlyIncentiveRow, Product, SupplierCreditNote, SupplierScheme, TabId } from '../../../types';
import { computeEligibleMonthlySales, isClaimLinkedNote } from '../../../utils/supplierSchemes';
import { formatCompactInr } from '../../../utils/crateTimeline';
import { CnFilter, inr, SchemeFormState, TabKey, todayIso } from './supplierSchemesShared';

interface SupplierSchemesPhoneViewProps {
  tab: TabKey;
  setTab: React.Dispatch<React.SetStateAction<TabKey>>;
  cnFilter: CnFilter;
  setCnFilter: React.Dispatch<React.SetStateAction<CnFilter>>;
  phoneSchemeFilter: 'all' | 'ab' | 'c';
  setPhoneSchemeFilter: React.Dispatch<React.SetStateAction<'all' | 'ab' | 'c'>>;
  phoneVolumeStep: boolean;
  setPhoneVolumeStep: React.Dispatch<React.SetStateAction<boolean>>;
  supplierSchemes: SupplierScheme[];
  supplierCreditNotes: SupplierCreditNote[];
  schemeNotes: SupplierCreditNote[];
  claimNotes: SupplierCreditNote[];
  visibleNotes: SupplierCreditNote[];
  schemeById: Map<string, SupplierScheme>;
  usageByScheme: Map<string, { lines: number; freeCases: number; expected: number }>;
  monthlyReport: MonthlyIncentiveRow[];
  bills: Bill[];
  supplierNames: string[];
  filteredProducts: Product[];
  activeSchemesCount: number;
  openNotesCount: number;
  monthlyToRaise: number;
  totalOutstanding: number;
  schemeModalOpen: boolean;
  setSchemeModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  editingSchemeId: string | null;
  form: SchemeFormState;
  setForm: React.Dispatch<React.SetStateAction<SchemeFormState>>;
  formError: string;
  setFormError: React.Dispatch<React.SetStateAction<string>>;
  productSearch: string;
  setProductSearch: React.Dispatch<React.SetStateAction<string>>;
  deleteConfirm: { id: string; name: string; used: number } | null;
  setDeleteConfirm: React.Dispatch<React.SetStateAction<{ id: string; name: string; used: number } | null>>;
  receiptNote: SupplierCreditNote | null;
  setReceiptNote: React.Dispatch<React.SetStateAction<SupplierCreditNote | null>>;
  receiptAmount: string;
  setReceiptAmount: React.Dispatch<React.SetStateAction<string>>;
  receiptNumber: string;
  setReceiptNumber: React.Dispatch<React.SetStateAction<string>>;
  receiptDate: string;
  setReceiptDate: React.Dispatch<React.SetStateAction<string>>;
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
  deleteNoteConfirm: SupplierCreditNote | null;
  setDeleteNoteConfirm: React.Dispatch<React.SetStateAction<SupplierCreditNote | null>>;
  goToTab: (t: TabId) => void;
  openCreate: () => void;
  openEdit: (s: SupplierScheme) => void;
  saveScheme: () => void;
  openReceipt: (n: SupplierCreditNote) => void;
  submitReceipt: () => void;
  openEditNote: (n: SupplierCreditNote) => void;
  saveEditedNote: () => void;
  openClaim: () => void;
  raiseMonthlyNote: (r: MonthlyIncentiveRow) => void;
  noteForRow: (r: MonthlyIncentiveRow) => SupplierCreditNote | undefined;
  toggleProduct: (id: number) => void;
  updateSupplierScheme: (id: string, updates: Partial<SupplierScheme>) => void;
  deleteSupplierScheme: (id: string, reason?: string) => void;
  updateSupplierCreditNote: (id: string, updates: Partial<SupplierCreditNote>) => void;
  deleteSupplierCreditNote: (id: string, reason?: string) => void;
}

export const SupplierSchemesPhoneView: React.FC<SupplierSchemesPhoneViewProps> = ({
  tab,
  setTab,
  cnFilter,
  setCnFilter,
  phoneSchemeFilter,
  setPhoneSchemeFilter,
  phoneVolumeStep,
  setPhoneVolumeStep,
  supplierSchemes,
  supplierCreditNotes,
  schemeNotes,
  claimNotes,
  visibleNotes,
  schemeById,
  usageByScheme,
  monthlyReport,
  bills,
  supplierNames,
  filteredProducts,
  activeSchemesCount,
  openNotesCount,
  monthlyToRaise,
  totalOutstanding,
  schemeModalOpen,
  setSchemeModalOpen,
  editingSchemeId,
  form,
  setForm,
  formError,
  setFormError,
  productSearch,
  setProductSearch,
  deleteConfirm,
  setDeleteConfirm,
  receiptNote,
  setReceiptNote,
  receiptAmount,
  setReceiptAmount,
  receiptNumber,
  setReceiptNumber,
  receiptDate,
  setReceiptDate,
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
  deleteNoteConfirm,
  setDeleteNoteConfirm,
  goToTab,
  openCreate,
  openEdit,
  saveScheme,
  openReceipt,
  submitReceipt,
  openEditNote,
  saveEditedNote,
  openClaim,
  raiseMonthlyNote,
  noteForRow,
  toggleProduct,
  updateSupplierScheme,
  deleteSupplierScheme,
  updateSupplierCreditNote,
  deleteSupplierCreditNote,
}) => {
  const [delSchemeReason, setDelSchemeReason] = React.useState('');
  const [delNoteReason, setDelNoteReason] = React.useState('');
  React.useEffect(() => {
    setDelSchemeReason('');
  }, [deleteConfirm?.id]);
  React.useEffect(() => {
    setDelNoteReason('');
  }, [deleteNoteConfirm?.id]);
  const delSchemeReasonOk = delSchemeReason.trim().length >= 4;
  const delNoteReasonOk = delNoteReason.trim().length >= 4;

  const filteredSchemesPhone = supplierSchemes.filter((s) => {
    if (phoneSchemeFilter === 'ab') return s.schemeType === 'free_goods' || s.schemeType === 'pending_credit';
    if (phoneSchemeFilter === 'c') return s.schemeType === 'volume_incentive';
    return true;
  });

  const unraisedMonthlyRows = monthlyReport.filter((r) => r.achieved && !noteForRow(r));
  const selectedProductsPhone = filteredProducts.filter((p) => form.productIds.includes(p.id));
  const unselectedProductsPhone = filteredProducts.filter((p) => !form.productIds.includes(p.id));

  const formatMonthDisplay = (yyyyMm: string) => {
    const [y, m] = yyyyMm.split('-').map(Number);
    if (!y || !m) return yyyyMm;
    return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  };

  const formPeriod = (form.startDate || todayIso()).slice(0, 7);
  const liveEligibleQty =
    form.schemeType === 'volume_incentive'
      ? computeEligibleMonthlySales({
          scheme: {
            id: editingSchemeId || 'draft',
            supplierName: form.supplierName,
            name: form.name,
            schemeType: 'volume_incentive',
            productIds: form.productIds,
            startDate: form.startDate,
            endDate: form.endDate,
            targetQuantity: form.targetQuantity,
            incentiveRate: form.incentiveRate,
            calculationMethod: form.calculationMethod,
            active: form.active,
          } as SupplierScheme,
          period: formPeriod,
          bills,
        })
      : 0;

  const previewTarget = Math.max(0, Number(form.targetQuantity) || 0);
  const previewRate = Math.max(0, Number(form.incentiveRate) || 0);
  const previewSold = liveEligibleQty > 0 ? liveEligibleQty : previewTarget > 0 ? Math.round(previewTarget * 1.24) : 0;
  const isExcess = form.calculationMethod === 'excess_only';
  const previewCasesPaid = isExcess ? Math.max(0, previewSold - previewTarget) : previewSold >= previewTarget ? previewSold : 0;
  const previewPayout = previewCasesPaid * previewRate;

  const schemeStatusMeta = (s: SupplierScheme) => {
    const relatedNotes = schemeNotes.filter((n) => n.schemeId === s.id);
    const latestNote = relatedNotes[0];
    if (!s.active) {
      return { label: 'Inactive', tagClass: '', accentClass: 'rt-offer-card--muted' };
    }
    if (s.schemeType === 'volume_incentive') {
      const latestMonthly = monthlyReport.find((r) => r.schemeId === s.id);
      if (latestMonthly && !latestMonthly.achieved) {
        return { label: 'Target not met', tagClass: 'rt-tag--due', accentClass: 'rt-offer-card--due' };
      }
      if (latestNote?.status === 'partially_credited') {
        return { label: 'Part received', tagClass: 'rt-tag--soon', accentClass: 'rt-offer-card--primary' };
      }
      if (latestNote?.status === 'settled') {
        return { label: 'Settled', tagClass: 'rt-tag--paid', accentClass: 'rt-offer-card--paid' };
      }
      if (latestNote?.status === 'pending' || latestMonthly?.achieved) {
        return { label: 'Awaiting CN', tagClass: 'rt-tag--soon', accentClass: 'rt-offer-card--primary' };
      }
      return { label: 'Active', tagClass: 'rt-tag--paid', accentClass: 'rt-offer-card--primary' };
    }
    if (latestNote) {
      if (latestNote.status === 'partially_credited') {
        return { label: 'Part received', tagClass: 'rt-tag--soon', accentClass: '' };
      }
      if (latestNote.status === 'settled') {
        return { label: 'Settled', tagClass: 'rt-tag--paid', accentClass: 'rt-offer-card--paid' };
      }
      return { label: 'Awaiting CN', tagClass: 'rt-tag--soon', accentClass: '' };
    }
    return { label: 'Active', tagClass: 'rt-tag--paid', accentClass: '' };
  };

  const windowCompact = (s: SupplierScheme) => {
    const sd = s.startDate ? formatMonthDisplay(s.startDate.slice(0, 7)) : '';
    const ed = s.endDate ? formatMonthDisplay(s.endDate.slice(0, 7)) : '';
    if (sd && ed && sd !== ed) return `${sd.split(' ')[0]}–${ed.split(' ')[0]}`;
    return sd || 'Open';
  };

  return (
    <div id="view-supplier-schemes" className="hh-view min-w-0 max-w-full pb-24">
      {/* Top Blue Header matching Mockup Screens 1 & 4 */}
      <header className="hh-sales-top hh-sales-top--flush">
        <div className="hh-sales-top__row">
          <h1 className="hh-sales-top__title">Supplier credits</h1>
          <button
            type="button"
            onClick={openCreate}
            className="hh-sales-top__iconbtn"
            aria-label="New scheme"
          >
            <Plus size={22} strokeWidth={2.5} aria-hidden="true" />
          </button>
        </div>
        <div className="rt-utabs" role="tablist" aria-label="Supplier credits sections">
          <button type="button" role="tab" aria-selected="true" className="rt-utab">
            Supplier credits
          </button>
          <button
            type="button"
            role="tab"
            aria-selected="false"
            onClick={() => goToTab('promotions')}
            className="rt-utab"
          >
            Promotions
          </button>
        </div>
      </header>

      <div className="space-y-3">
        {/* 3 KPI tiles on Overview */}
        {tab === 'schemes' && (
          <div className="grid grid-cols-3 gap-2">
            <div className="rt-kv">
              <div className="rt-kv__label">Active</div>
              <div className="rt-kv__val">{activeSchemesCount}</div>
            </div>
            <div
              role="button"
              tabIndex={0}
              onClick={() => setTab('credit_notes')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setTab('credit_notes');
                }
              }}
              className="rt-kv cursor-pointer"
            >
              <div className="rt-kv__label">Open CNs</div>
              <div className="rt-kv__val">{openNotesCount}</div>
            </div>
            <div
              role="button"
              tabIndex={0}
              onClick={() => setTab('credit_notes')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setTab('credit_notes');
                }
              }}
              className="rt-kv cursor-pointer"
            >
              <div className="rt-kv__label">To receive</div>
              <div className="rt-kv__val" style={{ color: totalOutstanding > 0 ? 'var(--due)' : 'var(--text)' }}>
                {formatCompactInr(totalOutstanding)}
              </div>
            </div>
          </div>
        )}

        {/* Filter Pills */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 py-0.5" role="group" aria-label="Filter supplier credits">
          <button
            type="button"
            aria-pressed={tab === 'schemes' && phoneSchemeFilter === 'all'}
            onClick={() => {
              setTab('schemes');
              setPhoneSchemeFilter('all');
            }}
            className="rt-chip"
          >
            All
          </button>
          <button
            type="button"
            aria-pressed={tab === 'schemes' && phoneSchemeFilter === 'ab'}
            onClick={() => {
              setTab('schemes');
              setPhoneSchemeFilter('ab');
            }}
            className="rt-chip"
          >
            Type A / B
          </button>
          <button
            type="button"
            aria-pressed={tab === 'schemes' && phoneSchemeFilter === 'c'}
            onClick={() => {
              setTab('schemes');
              setPhoneSchemeFilter('c');
            }}
            className="rt-chip"
          >
            Type C
          </button>
          <button
            type="button"
            aria-pressed={tab === 'credit_notes'}
            onClick={() => setTab('credit_notes')}
            className="rt-chip"
          >
            Credit notes
            {openNotesCount > 0 && <span className="rt-chip__count">{openNotesCount}</span>}
          </button>
          <button
            type="button"
            aria-pressed={tab === 'monthly_report'}
            onClick={() => setTab('monthly_report')}
            className="rt-chip"
          >
            Monthly
            {monthlyToRaise > 0 && <span className="rt-chip__count">{monthlyToRaise}</span>}
          </button>
        </div>

        {/* Screen 1: Schemes List */}
        {tab === 'schemes' && (
          <>
            {filteredSchemesPhone.length === 0 ? (
              <div className="rt-card text-center py-8 space-y-2">
                <p className="text-sm font-bold text-[var(--text)]">
                  {supplierSchemes.length === 0 ? 'No supplier schemes yet' : 'No schemes in this filter'}
                </p>
                <button type="button" onClick={openCreate} className="rt-btn-outline rt-btn-outline--primary mt-2">
                  <Plus size={16} aria-hidden="true" />
                  New scheme
                </button>
              </div>
            ) : (
              <div className="space-y-2.5 hh-tgrid-2">
                {filteredSchemesPhone.map((s) => {
                  const meta = schemeStatusMeta(s);
                  return (
                    <div
                      key={s.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openEdit(s)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openEdit(s);
                        }
                      }}
                      className={`rt-offer-card cursor-pointer ${meta.accentClass}`}
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="text-[14.5px] font-bold text-[var(--text)] leading-snug break-words">
                            {s.name}
                          </div>
                          <div className="text-[12px] text-[var(--text-2)] mt-0.5 leading-snug break-words">
                            {s.supplierName} · {windowCompact(s)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateSupplierScheme(s.id, { active: !s.active });
                          }}
                          aria-label={`Toggle ${s.name} status`}
                          className={`rt-tag shrink-0 min-h-[28px] min-w-0 cursor-pointer ${meta.tagClass}`}
                        >
                          {meta.label}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Screen 4: Supplier Credit Notes (+ Pending Monthly "Not raised yet") */}
        {tab === 'credit_notes' && (
          <div className="space-y-2.5">
            {claimNotes.length > 0 && (
              <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1" role="group" aria-label="Credit note source">
                {(
                  [
                    ['all', `All (${supplierCreditNotes.length})`],
                    ['scheme', `Schemes (${schemeNotes.length})`],
                    ['claims', `Claims (${claimNotes.length})`],
                  ] as [CnFilter, string][]
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setCnFilter(k)}
                    aria-pressed={cnFilter === k}
                    className="rt-chip"
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {visibleNotes.length === 0 && unraisedMonthlyRows.length === 0 ? (
              <div className="rt-card text-center py-8 text-sm text-[var(--text-2)]">
                No supplier credit notes yet. They appear when a GRN line uses a Type B scheme or when a monthly incentive is raised.
              </div>
            ) : (
              <div className="space-y-2.5 hh-tgrid-2">
                {visibleNotes.map((n) => {
                  const claim = isClaimLinkedNote(n);
                  const scheme = n.schemeId ? schemeById.get(n.schemeId) : undefined;
                  const outstanding = Math.max(0, n.expectedAmount - n.actualAmount);
                  const source = claim
                    ? 'Expiry / damage claim'
                    : scheme
                      ? `${scheme.name}${n.period ? ` · ${n.period}` : ''}`
                      : n.period
                        ? `Incentive ${n.period}`
                        : n.grnId
                          ? `GRN ${n.grnId}`
                          : 'Credit note';
                  const tagInfo =
                    n.status === 'settled'
                      ? { text: 'Settled', cls: 'rt-tag--paid' }
                      : n.status === 'partially_credited'
                        ? { text: 'Part received', cls: 'rt-tag--soon' }
                        : { text: 'Awaiting CN', cls: 'rt-tag--soon' };

                  return (
                    <div key={n.id} className="rt-card space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-[15px] font-bold text-[var(--text)] leading-snug break-words">
                            {n.creditNoteNumber || 'Pending CN'}
                          </div>
                          <div className="text-[12px] text-[var(--text-2)] mt-0.5 leading-snug break-words">
                            {n.supplierName} · {source}
                          </div>
                        </div>
                        <span className={`rt-tag shrink-0 ${tagInfo.cls}`}>{tagInfo.text}</span>
                      </div>

                      <div className="rt-three">
                        <div className="rt-three__item">
                          <span className="rt-three__label">Expected</span>
                          <span className="rt-three__val">{inr(n.expectedAmount)}</span>
                        </div>
                        <div className="rt-three__item">
                          <span className="rt-three__label">Received</span>
                          <span className="rt-three__val" style={{ color: 'var(--received)' }}>
                            {inr(n.actualAmount)}
                          </span>
                        </div>
                        <div className="rt-three__item">
                          <span className="rt-three__label">Outstanding</span>
                          <span className="rt-three__val rt-three__val--due">{inr(outstanding)}</span>
                        </div>
                      </div>

                      {claim ? (
                        <button type="button" onClick={openClaim} className="rt-btn-outline rt-btn-outline--primary w-full">
                          Open claim in Returns &amp; Disposals
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          {n.status !== 'settled' ? (
                            <button type="button" onClick={() => openReceipt(n)} className="rt-btn flex-1 min-w-0">
                              Record receipt
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openEditNote(n)}
                              className="rt-btn-outline rt-btn-outline--primary flex-1 min-w-0"
                            >
                              Edit credit note
                            </button>
                          )}
                          {n.status !== 'settled' && (
                            <button
                              type="button"
                              onClick={() => openEditNote(n)}
                              aria-label="Edit credit note"
                              className="rt-trip-act-icon"
                            >
                              <Pencil size={16} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setDeleteNoteConfirm(n)}
                            aria-label="Delete credit note"
                            className="rt-trip-act-icon rt-trip-act-icon--danger"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Unraised achieved monthly incentives match Screen 4 "Not raised yet" card */}
                {unraisedMonthlyRows.map((r) => (
                  <div key={`unraised-${r.schemeId}_${r.period}`} className="rt-card space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-[15px] font-bold text-[var(--text)] leading-snug">Not raised yet</div>
                        <div className="text-[12px] text-[var(--text-2)] mt-0.5 leading-snug break-words">
                          {r.supplierName} · Monthly volume incentive ({r.period}) · {inr(r.expectedCredit)}
                        </div>
                      </div>
                      <span className="rt-tag rt-tag--soon shrink-0">Awaiting CN</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => raiseMonthlyNote(r)}
                      className="rt-btn-outline rt-btn-outline--primary w-full"
                    >
                      Raise credit note
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Monthly Volume Incentives */}
        {tab === 'monthly_report' && (
          <div className="space-y-2.5">
            {monthlyReport.length === 0 ? (
              <div className="rt-card text-center py-8 text-sm text-[var(--text-2)]">
                No monthly volume-incentive schemes yet. Create a Type C scheme to see it here.
              </div>
            ) : (
              <div className="space-y-2.5 hh-tgrid-2">
              {monthlyReport.map((r) => {
                const note = noteForRow(r);
                const drift = note && Math.abs(note.expectedAmount - r.expectedCredit) > 0.5;
                const pct = r.targetQuantity > 0 ? Math.min(100, Math.round((r.actualEligibleQty / r.targetQuantity) * 100)) : 0;
                const tagCls =
                  r.status === 'settled'
                    ? 'rt-tag--paid'
                    : r.status === 'partially_credited' || r.status === 'pending'
                      ? 'rt-tag--soon'
                      : '';
                const tagLbl =
                  r.status === 'settled'
                    ? 'Settled'
                    : r.status === 'partially_credited'
                      ? 'Part received'
                      : r.status === 'pending'
                        ? 'Awaiting CN'
                        : 'Target not met';

                return (
                  <div key={`${r.schemeId}_${r.period}`} className="rt-card space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-[15px] font-bold text-[var(--text)] break-words">{r.productName}</div>
                        <div className="text-[12px] text-[var(--text-2)] mt-0.5">
                          {r.supplierName} · {formatMonthDisplay(r.period)}
                        </div>
                      </div>
                      <span className={`rt-tag shrink-0 ${tagCls}`}>{tagLbl}</span>
                    </div>

                    <div>
                      <div className="flex justify-between text-[12px] text-[var(--text-2)] mb-1">
                        <span>
                          Sold{' '}
                          <strong style={{ color: r.achieved ? 'var(--received)' : 'var(--text)' }}>
                            {r.actualEligibleQty.toLocaleString('en-IN')} cs
                          </strong>
                        </span>
                        <span>Target {r.targetQuantity.toLocaleString('en-IN')} cs</span>
                      </div>
                      <div className="rt-meter">
                        <div
                          className="rt-meter__fill"
                          style={{ width: `${pct}%`, background: r.achieved ? 'var(--received)' : 'var(--primary)' }}
                        />
                      </div>
                    </div>

                    <div className="rt-three">
                      <div className="rt-three__item">
                        <span className="rt-three__label">@ {inr(r.incentiveRate)}/cs</span>
                        <span className="rt-three__val">{inr(r.expectedCredit)}</span>
                      </div>
                      <div className="rt-three__item">
                        <span className="rt-three__label">Received</span>
                        <span className="rt-three__val" style={{ color: 'var(--received)' }}>
                          {inr(r.creditReceived)}
                        </span>
                      </div>
                      <div className="rt-three__item">
                        <span className="rt-three__label">Outstanding</span>
                        <span className={`rt-three__val ${r.outstandingCredit > 0 ? 'rt-three__val--due' : ''}`}>
                          {inr(r.outstandingCredit)}
                        </span>
                      </div>
                    </div>

                    {drift && note && (
                      <div className="rt-noti flex items-center justify-between gap-2">
                        <span className="flex-1 min-w-0">
                          Sales changed: expected is now {inr(r.expectedCredit)} (note {inr(note.expectedAmount)}).
                        </span>
                        <button
                          type="button"
                          onClick={() => updateSupplierCreditNote(note.id, { expectedAmount: r.expectedCredit })}
                          className="rt-chip shrink-0"
                          style={{ minHeight: '34px' }}
                        >
                          Update
                        </button>
                      </div>
                    )}

                    {r.achieved && !note && (
                      <button
                        type="button"
                        onClick={() => raiseMonthlyNote(r)}
                        className="rt-btn-outline rt-btn-outline--primary w-full"
                      >
                        Raise credit note
                      </button>
                    )}
                    {note && note.status !== 'settled' && (
                      <button type="button" onClick={() => openReceipt(note)} className="rt-btn w-full">
                        Record receipt
                      </button>
                    )}
                  </div>
                );
              })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Screen 2 & Screen 3: New / Edit Supplier Scheme Flow */}
      {schemeModalOpen && (
        <div
          className="rt-flow-phone"
          role="dialog"
          aria-modal="true"
          aria-label={phoneVolumeStep ? 'Volume incentive' : editingSchemeId ? 'Edit supplier scheme' : 'New supplier scheme'}
        >
          <header className="hh-sales-top">
            <div className="hh-sales-top__row">
              <button
                type="button"
                onClick={() => {
                  if (phoneVolumeStep) setPhoneVolumeStep(false);
                  else setSchemeModalOpen(false);
                }}
                className="rt-back-link"
              >
                <ChevronLeft size={22} strokeWidth={2.5} aria-hidden="true" />
                <span>
                  {phoneVolumeStep
                    ? 'Volume incentive'
                    : editingSchemeId
                      ? 'Edit supplier scheme'
                      : 'New supplier scheme'}
                </span>
              </button>
            </div>
          </header>

          {!phoneVolumeStep ? (
            <>
              <div className="rt-flow-phone__body space-y-3">
                <div className="rt-in">
                  <label htmlFor="ss-supplier-phone" className="rt-in__label">
                    SUPPLIER
                  </label>
                  <input
                    id="ss-supplier-phone"
                    list="supplier-names"
                    type="text"
                    value={form.supplierName}
                    onChange={(e) => setForm({ ...form, supplierName: e.target.value })}
                    placeholder="e.g. Campa Distributors"
                    autoComplete="off"
                    className="rt-in__control"
                  />
                  <datalist id="supplier-names">
                    {supplierNames.map((n) => (
                      <option key={n} value={n} />
                    ))}
                  </datalist>
                </div>

                <div className="rt-in">
                  <label htmlFor="ss-name-phone" className="rt-in__label">
                    SCHEME
                  </label>
                  <input
                    id="ss-name-phone"
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. 10+1 Free — Power Up 150ml"
                    className="rt-in__control"
                  />
                </div>

                {/* Type A / B vs Type C toggle matching Screen 2 */}
                <div className="hh-set-seg2">
                  <button
                    type="button"
                    aria-pressed={form.schemeType !== 'volume_incentive'}
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        schemeType: f.schemeType === 'volume_incentive' ? 'free_goods' : f.schemeType,
                      }))
                    }
                    className="hh-set-seg2__btn"
                  >
                    Type A / B
                  </button>
                  <button
                    type="button"
                    aria-pressed={form.schemeType === 'volume_incentive'}
                    onClick={() => setForm((f) => ({ ...f, schemeType: 'volume_incentive' }))}
                    className="hh-set-seg2__btn"
                  >
                    Type C
                  </button>
                </div>

                {form.schemeType !== 'volume_incentive' ? (
                  <div className="hh-set-seg2">
                    <button
                      type="button"
                      aria-pressed={form.schemeType === 'free_goods'}
                      onClick={() => setForm((f) => ({ ...f, schemeType: 'free_goods' }))}
                      className="hh-set-seg2__btn text-[12px]"
                      style={{ minHeight: '38px' }}
                    >
                      Type A · Free goods
                    </button>
                    <button
                      type="button"
                      aria-pressed={form.schemeType === 'pending_credit'}
                      onClick={() => setForm((f) => ({ ...f, schemeType: 'pending_credit' }))}
                      className="hh-set-seg2__btn text-[12px]"
                      style={{ minHeight: '38px' }}
                    >
                      Type B · Pending CN
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPhoneVolumeStep(true)}
                    className="rt-card w-full text-left flex items-center justify-between gap-2 cursor-pointer"
                    style={{ borderColor: 'var(--primary)' }}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--primary)' }}>
                        MONTHLY VOLUME INCENTIVE
                      </div>
                      <div className="text-[13.5px] font-bold text-[var(--text)] mt-0.5">
                        {Number(form.targetQuantity) > 0 && Number(form.incentiveRate) > 0
                          ? `Target ${form.targetQuantity} cs · ₹${form.incentiveRate}/cs · ${form.calculationMethod === 'excess_only' ? 'Excess only' : 'All cases'}`
                          : 'Tap to set monthly target and ₹/cs rate'}
                      </div>
                    </div>
                    <span className="text-[12.5px] font-bold shrink-0" style={{ color: 'var(--primary)' }}>
                      Configure →
                    </span>
                  </button>
                )}

                {/* From / To Dates */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rt-in">
                    <label htmlFor="ss-start-phone" className="rt-in__label">
                      FROM
                    </label>
                    <input
                      id="ss-start-phone"
                      type="date"
                      value={form.startDate}
                      onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                      className="rt-in__control"
                    />
                  </div>
                  <div className="rt-in">
                    <label htmlFor="ss-end-phone" className="rt-in__label">
                      TO
                    </label>
                    <input
                      id="ss-end-phone"
                      type="date"
                      value={form.endDate || ''}
                      onChange={(e) => setForm({ ...form, endDate: e.target.value || undefined })}
                      className="rt-in__control"
                    />
                  </div>
                </div>

                {/* Product Search & Selected / Available list matching Screen 2 */}
                <div className="rt-search-bar">
                  <Search size={17} style={{ color: 'var(--text-2)' }} aria-hidden="true" />
                  <input
                    enterKeyHint="search"
                    type="search"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Search products"
                    aria-label="Search products"
                  />
                  {productSearch && (
                    <button
                      type="button"
                      onClick={() => setProductSearch('')}
                      className="p-1 min-w-0 min-h-0 border-0 bg-transparent text-[var(--text-2)] cursor-pointer"
                      aria-label="Clear product search"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                {selectedProductsPhone.length > 0 && (
                  <div className="hh-set-list">
                    {selectedProductsPhone.map((p) => (
                      <div key={`ss-sel-${p.id}`} className="hh-set-row" style={{ cursor: 'default' }}>
                        <span className="flex-1 min-w-0 text-[14px] font-bold text-[var(--text)] break-words">
                          {p.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleProduct(p.id)}
                          className="min-w-0 min-h-[36px] px-2 border-0 bg-transparent text-[13px] font-bold cursor-pointer shrink-0"
                          style={{ color: 'var(--due)' }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {unselectedProductsPhone.length > 0 && (
                  <div className="hh-set-list">
                    {unselectedProductsPhone.map((p) => (
                      <button
                        key={`ss-unsel-${p.id}`}
                        type="button"
                        onClick={() => toggleProduct(p.id)}
                        className="hh-set-row"
                      >
                        <span className="flex-1 min-w-0 text-[14px] font-medium text-[var(--text)] break-words">
                          {p.name}
                        </span>
                        <span className="text-[12.5px] font-bold shrink-0" style={{ color: 'var(--primary)' }}>
                          + Add
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="rt-card flex items-center justify-between gap-3">
                  <span className="text-[14px] font-bold text-[var(--text)]">Active scheme</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.active}
                    aria-label="Active scheme"
                    onClick={() => setForm((f) => ({ ...f, active: !f.active }))}
                    className="hh-switch"
                  >
                    <span className="hh-switch__thumb" />
                  </button>
                </div>

                {editingSchemeId && (
                  <button
                    type="button"
                    onClick={() => {
                      const u = usageByScheme.get(editingSchemeId);
                      setDeleteConfirm({ id: editingSchemeId, name: form.name, used: u?.lines || 0 });
                    }}
                    className="hh-set-btn-danger-outline w-full"
                  >
                    <Trash2 size={15} aria-hidden="true" />
                    Delete scheme
                  </button>
                )}

                {formError && (
                  <div role="alert" className="rt-notice rt-notice--due">
                    {formError}
                  </div>
                )}
              </div>

              <footer className="rt-flow-phone__footer">
                <button
                  type="button"
                  onClick={() => {
                    if (
                      form.schemeType === 'volume_incentive' &&
                      (!(Number(form.targetQuantity) > 0) || !(Number(form.incentiveRate) > 0))
                    ) {
                      setFormError('');
                      setPhoneVolumeStep(true);
                      return;
                    }
                    saveScheme();
                  }}
                  className="rt-btn w-full"
                >
                  {form.schemeType === 'volume_incentive' &&
                  (!(Number(form.targetQuantity) > 0) || !(Number(form.incentiveRate) > 0))
                    ? 'Next: volume incentive'
                    : 'Save scheme'}
                </button>
              </footer>
            </>
          ) : (
            /* Screen 3: Volume incentive configuration */
            <>
              <div className="rt-flow-phone__body space-y-3">
                <div className="rt-card">
                  <div className="text-[15px] font-bold text-[var(--text)]">
                    {form.supplierName.trim() || 'Supplier'} · {formatMonthDisplay(formPeriod)}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rt-in">
                    <label htmlFor="ss-month-phone" className="rt-in__label">
                      MONTH
                    </label>
                    <input
                      id="ss-month-phone"
                      type="month"
                      value={formPeriod}
                      onChange={(e) => {
                        if (!e.target.value) return;
                        setForm({ ...form, startDate: `${e.target.value}-01` });
                      }}
                      className="rt-in__control"
                    />
                  </div>
                  <div className="rt-in">
                    <label htmlFor="ss-target-phone" className="rt-in__label">
                      TARGET (CS)
                    </label>
                    <input
                      id="ss-target-phone"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      placeholder="500"
                      value={form.targetQuantity ?? ''}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          targetQuantity: e.target.value === '' ? undefined : Number(e.target.value),
                        })
                      }
                      className="rt-in__control tabular-nums"
                    />
                  </div>
                </div>

                <div className="rt-in">
                  <label htmlFor="ss-rate-phone" className="rt-in__label">
                    RATE (₹ / CS)
                  </label>
                  <input
                    id="ss-rate-phone"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    placeholder="12"
                    value={form.incentiveRate ?? ''}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        incentiveRate: e.target.value === '' ? undefined : Number(e.target.value),
                      })
                    }
                    className="rt-in__control tabular-nums"
                  />
                </div>

                <div>
                  <div className="text-[12.5px] font-medium text-[var(--text-2)] mb-1.5">Pays on</div>
                  <div className="hh-set-seg2">
                    <button
                      type="button"
                      aria-pressed={form.calculationMethod === 'all_eligible'}
                      onClick={() => setForm({ ...form, calculationMethod: 'all_eligible' })}
                      className="hh-set-seg2__btn"
                    >
                      All cases
                    </button>
                    <button
                      type="button"
                      aria-pressed={form.calculationMethod === 'excess_only'}
                      onClick={() => setForm({ ...form, calculationMethod: 'excess_only' })}
                      className="hh-set-seg2__btn"
                    >
                      Excess only
                    </button>
                  </div>
                </div>

                <div className="rt-dashed-preview">
                  {isExcess ? (
                    <>
                      <strong>Excess cases only:</strong> {previewSold} sold − {previewTarget} target ={' '}
                      {Math.max(0, previewSold - previewTarget)} cs × ₹{previewRate} ={' '}
                      <strong>{inr(previewPayout)}</strong>
                      {liveEligibleQty === 0 && previewTarget > 0 ? ' (sample preview)' : ''}
                    </>
                  ) : (
                    <>
                      <strong>All eligible cases:</strong> {previewSold} sold × ₹{previewRate} ={' '}
                      <strong>{inr(previewPayout)}</strong>
                      {liveEligibleQty === 0 && previewTarget > 0 ? ' (sample preview)' : ''}
                    </>
                  )}
                </div>

                {formError && (
                  <div role="alert" className="rt-notice rt-notice--due">
                    {formError}
                  </div>
                )}
              </div>

              <footer className="rt-flow-phone__footer">
                <button type="button" onClick={saveScheme} className="rt-btn w-full">
                  Save incentive
                </button>
              </footer>
            </>
          )}
        </div>
      )}

      {/* Screen 5: Record Receipt Flow */}
      {receiptNote && (
        <div className="rt-flow-phone" role="dialog" aria-modal="true" aria-label="Record receipt">
          <header className="hh-sales-top">
            <div className="hh-sales-top__row">
              <button type="button" onClick={() => setReceiptNote(null)} className="rt-back-link">
                <ChevronLeft size={22} strokeWidth={2.5} aria-hidden="true" />
                <span>Record receipt</span>
              </button>
            </div>
          </header>

          <div className="rt-flow-phone__body space-y-3">
            <div className="rt-card rt-card--divided">
              <div className="rt-ln">
                <span className="text-[var(--text-2)] font-medium">CN no.</span>
                <span className="font-bold text-[var(--text)]">{receiptNote.creditNoteNumber || 'Not assigned'}</span>
              </div>
              <div className="rt-ln">
                <span className="text-[var(--text-2)] font-medium">Outstanding</span>
                <span className="font-bold tabular-nums" style={{ color: 'var(--due)' }}>
                  {inr(Math.max(0, receiptNote.expectedAmount - receiptNote.actualAmount))}
                </span>
              </div>
            </div>

            <div className="rt-fld">
              <label htmlFor="cn-amt-phone" className="rt-fld__label">
                Amount received
              </label>
              <div className="rt-fld__row">
                <span className="rt-fld__curr">₹</span>
                <input
                  id="cn-amt-phone"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={receiptAmount}
                  onChange={(e) => setReceiptAmount(e.target.value)}
                  className="rt-fld__input"
                />
              </div>
            </div>

            <div className="rt-in">
              <label htmlFor="cn-no-phone" className="rt-in__label">
                CN NO.
              </label>
              <input
                id="cn-no-phone"
                type="text"
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                placeholder="e.g. CN-2026-001"
                className="rt-in__control"
              />
            </div>

            <div className="rt-in">
              <label htmlFor="cn-date-phone" className="rt-in__label">
                DATE
              </label>
              <input
                id="cn-date-phone"
                type="date"
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
                className="rt-in__control"
              />
            </div>

            <p className="text-[12px] text-[var(--text-2)] px-1 leading-relaxed">
              If a credit note needs to be re-opened, use{' '}
              <button
                type="button"
                onClick={() => {
                  const target = receiptNote;
                  setReceiptNote(null);
                  openEditNote(target);
                }}
                className="inline p-0 m-0 min-w-0 min-h-0 border-0 bg-transparent underline font-bold cursor-pointer"
                style={{ color: 'var(--primary)' }}
              >
                &ldquo;Need to re-open this credit note?&rdquo;
              </button>
              .
            </p>
          </div>

          <footer className="rt-flow-phone__footer">
            <button
              type="button"
              onClick={submitReceipt}
              disabled={!(Number(receiptAmount) > 0)}
              className="rt-btn w-full"
            >
              Save receipt
            </button>
          </footer>
        </div>
      )}

      {/* Edit / Re-open Credit Note Flow */}
      {editingNote && (
        <div className="rt-flow-phone" role="dialog" aria-modal="true" aria-label="Edit supplier credit note">
          <header className="hh-sales-top">
            <div className="hh-sales-top__row">
              <button type="button" onClick={() => setEditingNote(null)} className="rt-back-link">
                <ChevronLeft size={22} strokeWidth={2.5} aria-hidden="true" />
                <span>Edit credit note</span>
              </button>
            </div>
          </header>

          <div className="rt-flow-phone__body space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rt-in">
                <label htmlFor="ecn-exp-phone" className="rt-in__label">
                  EXPECTED (₹)
                </label>
                <input
                  id="ecn-exp-phone"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={editExpectedAmount}
                  onChange={(e) => setEditExpectedAmount(e.target.value)}
                  className="rt-in__control tabular-nums"
                />
              </div>
              <div className="rt-in">
                <label htmlFor="ecn-rec-phone" className="rt-in__label">
                  RECEIVED (₹)
                </label>
                <input
                  id="ecn-rec-phone"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={editActualAmount}
                  onChange={(e) => setEditActualAmount(e.target.value)}
                  className="rt-in__control tabular-nums"
                  style={{ color: 'var(--received)' }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="rt-in">
                <label htmlFor="ecn-no-phone" className="rt-in__label">
                  CN NO.
                </label>
                <input
                  id="ecn-no-phone"
                  type="text"
                  value={editCnNumber}
                  onChange={(e) => setEditCnNumber(e.target.value)}
                  placeholder="e.g. CN-2026-001"
                  className="rt-in__control"
                />
              </div>
              <div className="rt-in">
                <label htmlFor="ecn-date-phone" className="rt-in__label">
                  DATE
                </label>
                <input
                  id="ecn-date-phone"
                  type="date"
                  value={editCnDate}
                  onChange={(e) => setEditCnDate(e.target.value)}
                  className="rt-in__control"
                />
              </div>
            </div>

            {Number(editActualAmount) > 0 && (
              <div className="rt-noti flex flex-col gap-2">
                <span>Need to re-open this credit note?</span>
                <button
                  type="button"
                  onClick={() => setEditActualAmount('0')}
                  className="rt-btn-outline w-full"
                  style={{ borderColor: 'var(--soon-edge)', color: 'var(--soon-text)' }}
                >
                  Reset received to ₹0
                </button>
              </div>
            )}

            <div className="rt-in">
              <label htmlFor="ecn-notes-phone" className="rt-in__label">
                NOTES
              </label>
              <input
                id="ecn-notes-phone"
                type="text"
                value={editCnNotes}
                onChange={(e) => setEditCnNotes(e.target.value)}
                className="rt-in__control"
              />
            </div>
          </div>

          <footer className="rt-flow-phone__footer">
            <button type="button" onClick={saveEditedNote} className="rt-btn w-full">
              Save changes
            </button>
          </footer>
        </div>
      )}

      {/* Mobile delete scheme bottom sheet */}
      {deleteConfirm && (
        <div className="rt-bsheet-scrim" role="dialog" aria-modal="true" aria-labelledby="del-ss-phone-title" onClick={() => setDeleteConfirm(null)}>
          <div className="rt-bsheet rt-bsheet--white space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="hh-grab" />
            <div>
              <h3 id="del-ss-phone-title" className="text-[17px] font-extrabold" style={{ color: 'var(--due)' }}>
                Delete {deleteConfirm.name}?
              </h3>
              <p className="text-[13px] text-[var(--text-2)] mt-1 leading-relaxed">
                {deleteConfirm.used > 0 ? `Used on ${deleteConfirm.used} GRN line(s). ` : ''}
                Existing GRNs and credit notes keep their recorded amounts.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-semibold text-slate-700 block">
                  Reason for deleting *
                </label>
                <span className={`text-xs font-medium tabular-nums ${delSchemeReasonOk ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {delSchemeReason.trim().length}/4 min chars
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {['Scheme discontinued', 'Duplicate setup', 'Wrong terms', 'Test entry'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setDelSchemeReason(preset)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                      delSchemeReason.trim().toLowerCase() === preset.toLowerCase()
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <textarea
                rows={2}
                value={delSchemeReason}
                onChange={(e) => setDelSchemeReason(e.target.value)}
                placeholder="e.g. Scheme discontinued, duplicate setup"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none font-sans"
              />
            </div>
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="rt-btn-outline rt-btn-outline--primary"
              >
                Keep
              </button>
              <button
                type="button"
                disabled={!delSchemeReasonOk}
                onClick={() => {
                  deleteSupplierScheme(deleteConfirm.id, delSchemeReason.trim());
                  setDeleteConfirm(null);
                  setSchemeModalOpen(false);
                }}
                className="rt-btn rt-btn--due disabled:opacity-45 disabled:cursor-not-allowed"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile delete credit note bottom sheet */}
      {deleteNoteConfirm && (
        <div className="rt-bsheet-scrim" role="dialog" aria-modal="true" aria-labelledby="del-cn-phone-title" onClick={() => setDeleteNoteConfirm(null)}>
          <div className="rt-bsheet rt-bsheet--white space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="hh-grab" />
            <div>
              <h3 id="del-cn-phone-title" className="text-[17px] font-extrabold" style={{ color: 'var(--due)' }}>
                Delete credit note {deleteNoteConfirm.creditNoteNumber || ''}?
              </h3>
              <p className="text-[13px] text-[var(--text-2)] mt-1 leading-relaxed">
                {deleteNoteConfirm.supplierName} · Expected {inr(deleteNoteConfirm.expectedAmount)}. This permanently removes the credit note record.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-semibold text-slate-700 block">
                  Reason for deleting *
                </label>
                <span className={`text-xs font-medium tabular-nums ${delNoteReasonOk ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {delNoteReason.trim().length}/4 min chars
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {['Duplicate credit note', 'Settled separately', 'Wrong amount/party', 'Test entry'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setDelNoteReason(preset)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                      delNoteReason.trim().toLowerCase() === preset.toLowerCase()
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <textarea
                rows={2}
                value={delNoteReason}
                onChange={(e) => setDelNoteReason(e.target.value)}
                placeholder="e.g. Duplicate credit note, wrong amount/party"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none font-sans"
              />
            </div>
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setDeleteNoteConfirm(null)}
                className="rt-btn-outline rt-btn-outline--primary"
              >
                Keep
              </button>
              <button
                type="button"
                disabled={!delNoteReasonOk}
                onClick={() => {
                  deleteSupplierCreditNote(deleteNoteConfirm.id, delNoteReason.trim());
                  setDeleteNoteConfirm(null);
                }}
                className="rt-btn rt-btn--due disabled:opacity-45 disabled:cursor-not-allowed"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
