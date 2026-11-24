import React, { useEffect, useMemo, useState } from 'react';
import { FileClock, HandCoins, PackagePlus, Plus, TrendingUp } from 'lucide-react';
import { useLedger } from '../../context/LedgerContext';
import { Badge, Button, Card, CardContent } from '../ui';
import { InfoTip } from '../common/InfoTip';
import { SupplierCreditNote, SupplierScheme } from '../../types';
import { buildMonthlyIncentiveReport, isClaimLinkedNote } from '../../utils/supplierSchemes';
import { useIsMobile } from '../../hooks/useIsMobile';
import {
  CnFilter,
  emptySchemeForm,
  inr,
  TabKey,
  todayIso,
} from './supplierSchemes/supplierSchemesShared';
import { SupplierSchemesPhoneView } from './supplierSchemes/SupplierSchemesPhoneView';
import { SupplierSchemesTabsSection } from './supplierSchemes/SupplierSchemesTabsSection';
import { SupplierSchemesModals } from './supplierSchemes/SupplierSchemesModals';

export const SupplierSchemesView: React.FC = () => {
  const {
    products,
    bills,
    grns,
    setTab: goToTab,
    supplierSchemes,
    supplierSchemeApplications,
    addSupplierScheme,
    updateSupplierScheme,
    deleteSupplierScheme,
    supplierCreditNotes,
    addSupplierCreditNote,
    updateSupplierCreditNote,
    deleteSupplierCreditNote,
    recordSupplierCreditNoteReceipt,
  } = useLedger();

  const [tab, setTab] = useState<TabKey>('schemes');
  const [cnFilter, setCnFilter] = useState<CnFilter>('all');

  // Dashboard "credit notes not settled" lands straight on the Credit notes tab.
  useEffect(() => {
    try {
      if (sessionStorage.getItem('mrwater_open_supplier_cn') === 'pending') {
        sessionStorage.removeItem('mrwater_open_supplier_cn');
        setTab('credit_notes');
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Scheme form
  const [schemeModalOpen, setSchemeModalOpen] = useState(false);
  const [editingSchemeId, setEditingSchemeId] = useState<string | null>(null);
  const [form, setForm] = useState(emptySchemeForm());
  const [formError, setFormError] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string; used: number } | null>(null);

  // Receipt
  const [receiptNote, setReceiptNote] = useState<SupplierCreditNote | null>(null);
  const [receiptAmount, setReceiptAmount] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [receiptDate, setReceiptDate] = useState(todayIso());

  // Phone navigation states (does not alter desktop/tablet layout or core logic)
  const isPhone = useIsMobile(1023);
  const [phoneSchemeFilter, setPhoneSchemeFilter] = useState<'all' | 'ab' | 'c'>('all');
  const [phoneVolumeStep, setPhoneVolumeStep] = useState(false);

  // Edit / delete credit note
  const [editingNote, setEditingNote] = useState<SupplierCreditNote | null>(null);
  const [editExpectedAmount, setEditExpectedAmount] = useState('');
  const [editActualAmount, setEditActualAmount] = useState('');
  const [editCnNumber, setEditCnNumber] = useState('');
  const [editCnDate, setEditCnDate] = useState('');
  const [editCnNotes, setEditCnNotes] = useState('');
  const [deleteNoteConfirm, setDeleteNoteConfirm] = useState<SupplierCreditNote | null>(null);

  // ---- derived data -------------------------------------------------------

  const schemeById = useMemo(() => new Map(supplierSchemes.map((s) => [s.id, s])), [supplierSchemes]);

  /** How many GRN lines / free cases / expected ₹ each scheme has actually been attached to. */
  const usageByScheme = useMemo(() => {
    const m = new Map<string, { lines: number; freeCases: number; expected: number }>();
    for (const a of supplierSchemeApplications || []) {
      const u = m.get(a.schemeId) || { lines: 0, freeCases: 0, expected: 0 };
      u.lines += 1;
      u.freeCases += Number(a.freeQuantity) || 0;
      u.expected += Number(a.expectedBenefit) || 0;
      m.set(a.schemeId, u);
    }
    return m;
  }, [supplierSchemeApplications]);

  const supplierNames = useMemo(() => {
    const set = new Set<string>();
    supplierSchemes.forEach((s) => s.supplierName && set.add(s.supplierName));
    (grns || []).forEach((g: any) => g?.supplierName && set.add(g.supplierName));
    return Array.from(set).sort();
  }, [supplierSchemes, grns]);

  const monthlyPeriods = useMemo(() => {
    // Current month plus the two before it, newest first.
    const now = new Date();
    const out: string[] = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return out;
  }, []);

  const monthlyReport = useMemo(
    () =>
      buildMonthlyIncentiveReport({
        schemes: supplierSchemes,
        bills,
        creditNotes: supplierCreditNotes,
        products,
        periods: monthlyPeriods,
      }),
    [supplierSchemes, bills, supplierCreditNotes, products, monthlyPeriods]
  );

  // Scheme / incentive notes vs expiry-damage claim notes (those belong to Returns & Disposals).
  const schemeNotes = useMemo(() => supplierCreditNotes.filter((n) => !isClaimLinkedNote(n)), [supplierCreditNotes]);
  const claimNotes = useMemo(() => supplierCreditNotes.filter((n) => isClaimLinkedNote(n)), [supplierCreditNotes]);
  const visibleNotes = cnFilter === 'scheme' ? schemeNotes : cnFilter === 'claims' ? claimNotes : supplierCreditNotes;

  const totalOutstanding = schemeNotes.reduce((s, n) => s + Math.max(0, n.expectedAmount - n.actualAmount), 0);
  const activeSchemesCount = supplierSchemes.filter((s) => s.active).length;
  const openNotesCount = schemeNotes.filter((n) => n.status !== 'settled').length;
  const monthlyToRaise = monthlyReport.filter((r) => r.achieved && r.status === 'pending').length;

  // ---- actions ------------------------------------------------------------

  const openCreate = () => {
    setEditingSchemeId(null);
    setForm(emptySchemeForm());
    setFormError('');
    setProductSearch('');
    setPhoneVolumeStep(false);
    setSchemeModalOpen(true);
  };

  const openEdit = (s: SupplierScheme) => {
    setEditingSchemeId(s.id);
    setForm({
      supplierName: s.supplierName,
      name: s.name,
      schemeType: s.schemeType,
      productIds: Array.isArray(s.productIds) ? s.productIds : [],
      warehouseId: s.warehouseId,
      startDate: s.startDate,
      endDate: s.endDate,
      targetQuantity: s.targetQuantity,
      incentiveRate: s.incentiveRate,
      calculationMethod: s.calculationMethod,
      active: s.active,
      notes: s.notes,
    });
    setFormError('');
    setProductSearch('');
    setPhoneVolumeStep(false);
    setSchemeModalOpen(true);
  };

  const saveScheme = () => {
    if (!form.supplierName.trim()) return setFormError('Enter the supplier name.');
    if (!form.name.trim()) return setFormError('Enter a scheme name.');
    if (form.productIds.length === 0) return setFormError('Select at least one product.');
    if (form.endDate && form.endDate < form.startDate) return setFormError('End date cannot be before the start date.');
    if (form.schemeType === 'volume_incentive') {
      if (!(Number(form.targetQuantity) > 0)) return setFormError('Enter the monthly target in cases.');
      if (!(Number(form.incentiveRate) > 0)) return setFormError('Enter the incentive rate (₹ per case).');
    }
    const payload = { ...form, supplierName: form.supplierName.trim(), name: form.name.trim() };
    if (editingSchemeId) updateSupplierScheme(editingSchemeId, payload);
    else addSupplierScheme(payload);
    setSchemeModalOpen(false);
  };

  const openReceipt = (n: SupplierCreditNote) => {
    setReceiptNote(n);
    setReceiptAmount(String(Math.max(0, n.expectedAmount - n.actualAmount)));
    setReceiptNumber(n.creditNoteNumber || '');
    setReceiptDate(n.creditNoteDate || todayIso());
  };

  /**
   * The amount typed here is what has been received IN THIS CREDIT NOTE, added to what was
   * already received. (The old screen asked for a running total, which was easy to get wrong.)
   */
  const submitReceipt = () => {
    if (!receiptNote) return;
    const add = Math.max(0, Number(receiptAmount) || 0);
    if (add <= 0) return;
    recordSupplierCreditNoteReceipt(receiptNote.id, {
      actualAmount: receiptNote.actualAmount + add,
      creditNoteNumber: receiptNumber.trim() || receiptNote.creditNoteNumber,
      creditNoteDate: receiptDate || todayIso(),
      attachmentRef: receiptNote.attachmentRef,
      notes: receiptNote.notes,
    });
    setReceiptNote(null);
  };

  const openEditNote = (n: SupplierCreditNote) => {
    setEditingNote(n);
    setEditExpectedAmount(String(n.expectedAmount ?? 0));
    setEditActualAmount(String(n.actualAmount ?? 0));
    setEditCnNumber(n.creditNoteNumber || '');
    setEditCnDate(n.creditNoteDate || todayIso());
    setEditCnNotes(n.notes || '');
  };

  const saveEditedNote = () => {
    if (!editingNote) return;
    updateSupplierCreditNote(editingNote.id, {
      expectedAmount: Math.max(0, Number(editExpectedAmount) || 0),
      actualAmount: Math.max(0, Number(editActualAmount) || 0),
      creditNoteNumber: editCnNumber.trim() || undefined,
      creditNoteDate: editCnDate || undefined,
      notes: editCnNotes.trim() || undefined,
    });
    setEditingNote(null);
  };

  const openClaim = () => {
    try {
      sessionStorage.setItem('mrwater_open_dispositions', 'claims');
    } catch {
      /* ignore */
    }
    goToTab('inventory');
  };

  /** Type C has no GRN, so the credit note is raised here once the month's target is met. */
  const raiseMonthlyNote = (r: (typeof monthlyReport)[number]) => {
    addSupplierCreditNote({
      supplierName: r.supplierName,
      schemeId: r.schemeId,
      period: r.period,
      expectedAmount: r.expectedCredit,
      actualAmount: 0,
      notes: `Monthly incentive ${r.period} · ${r.actualEligibleQty} cs sold vs target ${r.targetQuantity} cs`,
    });
  };

  const noteForRow = (r: (typeof monthlyReport)[number]) =>
    supplierCreditNotes.find((n) => n.schemeId === r.schemeId && n.period === r.period);

  const statusBadge = (status: string) => {
    switch (status) {
      case 'settled':
        return <Badge variant="success" className="shrink-0 whitespace-nowrap">Settled</Badge>;
      case 'partially_credited':
        return <Badge variant="warning" className="shrink-0 whitespace-nowrap">Part received</Badge>;
      case 'pending':
        return <Badge variant="accent" className="shrink-0 whitespace-nowrap">Awaiting CN</Badge>;
      default:
        return <Badge variant="neutral" className="shrink-0 whitespace-nowrap">Target not met</Badge>;
    }
  };

  const productNames = (ids: number[]) =>
    (Array.isArray(ids) ? ids : []).map((pid) => products.find((p) => p.id === pid)?.name || `#${pid}`).join(', ') || '—';

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return products.filter((p) => !q || p.name.toLowerCase().includes(q));
  }, [products, productSearch]);

  const toggleProduct = (id: number) =>
    setForm((f) => ({
      ...f,
      productIds: f.productIds.includes(id) ? f.productIds.filter((x) => x !== id) : [...f.productIds, id],
    }));

  // ---- render -------------------------------------------------------------

  const tabs: { key: TabKey; label: string; badge?: number }[] = [
    { key: 'schemes', label: 'Schemes' },
    { key: 'credit_notes', label: 'Credit notes', badge: openNotesCount },
    { key: 'monthly_report', label: 'Monthly', badge: monthlyToRaise },
  ];

  if (isPhone) {
    return (
      <SupplierSchemesPhoneView
        tab={tab}
        setTab={setTab}
        cnFilter={cnFilter}
        setCnFilter={setCnFilter}
        phoneSchemeFilter={phoneSchemeFilter}
        setPhoneSchemeFilter={setPhoneSchemeFilter}
        phoneVolumeStep={phoneVolumeStep}
        setPhoneVolumeStep={setPhoneVolumeStep}
        supplierSchemes={supplierSchemes}
        supplierCreditNotes={supplierCreditNotes}
        schemeNotes={schemeNotes}
        claimNotes={claimNotes}
        visibleNotes={visibleNotes}
        schemeById={schemeById}
        usageByScheme={usageByScheme}
        monthlyReport={monthlyReport}
        bills={bills}
        supplierNames={supplierNames}
        filteredProducts={filteredProducts}
        activeSchemesCount={activeSchemesCount}
        openNotesCount={openNotesCount}
        monthlyToRaise={monthlyToRaise}
        totalOutstanding={totalOutstanding}
        schemeModalOpen={schemeModalOpen}
        setSchemeModalOpen={setSchemeModalOpen}
        editingSchemeId={editingSchemeId}
        form={form}
        setForm={setForm}
        formError={formError}
        setFormError={setFormError}
        productSearch={productSearch}
        setProductSearch={setProductSearch}
        deleteConfirm={deleteConfirm}
        setDeleteConfirm={setDeleteConfirm}
        receiptNote={receiptNote}
        setReceiptNote={setReceiptNote}
        receiptAmount={receiptAmount}
        setReceiptAmount={setReceiptAmount}
        receiptNumber={receiptNumber}
        setReceiptNumber={setReceiptNumber}
        receiptDate={receiptDate}
        setReceiptDate={setReceiptDate}
        editingNote={editingNote}
        setEditingNote={setEditingNote}
        editExpectedAmount={editExpectedAmount}
        setEditExpectedAmount={setEditExpectedAmount}
        editActualAmount={editActualAmount}
        setEditActualAmount={setEditActualAmount}
        editCnNumber={editCnNumber}
        setEditCnNumber={setEditCnNumber}
        editCnDate={editCnDate}
        setEditCnDate={setEditCnDate}
        editCnNotes={editCnNotes}
        setEditCnNotes={setEditCnNotes}
        deleteNoteConfirm={deleteNoteConfirm}
        setDeleteNoteConfirm={setDeleteNoteConfirm}
        goToTab={goToTab}
        openCreate={openCreate}
        openEdit={openEdit}
        saveScheme={saveScheme}
        openReceipt={openReceipt}
        submitReceipt={submitReceipt}
        openEditNote={openEditNote}
        saveEditedNote={saveEditedNote}
        openClaim={openClaim}
        raiseMonthlyNote={raiseMonthlyNote}
        noteForRow={noteForRow}
        toggleProduct={toggleProduct}
        updateSupplierScheme={updateSupplierScheme}
        deleteSupplierScheme={deleteSupplierScheme}
        updateSupplierCreditNote={updateSupplierCreditNote}
        deleteSupplierCreditNote={deleteSupplierCreditNote}
      />
    );
  }

  return (
    <div id="view-supplier-schemes" className="hh-view space-y-4 min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 min-w-0">
          <HandCoins className="w-5 h-5 text-slate-700 shrink-0" aria-hidden="true" />
          <h1 className="truncate">Supplier credits</h1>
          <InfoTip title="Supplier credits">
            <p>
              Purchase-side benefits from your suppliers. This is separate from customer <strong>Promotions</strong>,
              which change what a customer pays on a bill. Nothing here ever changes a customer invoice.
            </p>
            <ul>
              <li>
                <strong>Type A – Free goods:</strong> extra free cases that come on top of what you were invoiced for.
                Attach the scheme to a GRN line in Inventory → Add stock; the free cases go into stock and lower your
                effective cost per case.
              </li>
              <li>
                <strong>Type B – Pending credit note:</strong> the supplier promises a ₹ credit later. Attach it to a GRN
                line and a credit note is created automatically for you to track.
              </li>
              <li>
                <strong>Type C – Monthly volume incentive:</strong> the supplier pays ₹ per case when your sales of the
                product group reach the monthly target. It is worked out live from your bills — see the Monthly tab.
              </li>
            </ul>
            <p>Every benefit stays traceable to the GRN or sales that earned it. The original GRN/invoice is never edited.</p>
          </InfoTip>
        </div>
        <Button size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={openCreate} className="shrink-0 h-10 px-3.5">
          New scheme
        </Button>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-3 gap-2 md:gap-4">
        <Card tone="sales">
          <CardContent className="relative flex flex-col md:flex-row md:items-center gap-1.5 md:gap-3.5 py-3 px-2.5 md:py-4 md:px-5">
            <div className="hh-icon-badge hh-icon-badge--sm hh-icon-badge--blue shrink-0">
              <PackagePlus className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-xs md:text-xs font-semibold text-slate-600 leading-tight">Active schemes</p>
              <p className="text-lg md:text-2xl font-extrabold tabular-nums text-slate-900 leading-tight mt-0.5">{activeSchemesCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card tone="warning">
          <CardContent className="relative flex flex-col md:flex-row md:items-center gap-1.5 md:gap-3.5 py-3 px-2.5 md:py-4 md:px-5">
            <div className="hh-icon-badge hh-icon-badge--sm hh-icon-badge--amber shrink-0">
              <FileClock className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-xs md:text-xs font-semibold text-slate-600 leading-tight">Open credit notes</p>
              <p className="text-lg md:text-2xl font-extrabold tabular-nums text-slate-900 leading-tight mt-0.5">{openNotesCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card tone="received">
          <CardContent className="relative flex flex-col md:flex-row md:items-center gap-1.5 md:gap-3.5 py-3 px-2.5 md:py-4 md:px-5">
            <div className="hh-icon-badge hh-icon-badge--sm hh-icon-badge--green shrink-0">
              <TrendingUp className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-xs md:text-xs font-semibold text-slate-600 leading-tight">Still to receive</p>
              <p className="text-lg md:text-2xl font-extrabold tabular-nums text-slate-900 leading-tight mt-0.5 truncate">{inr(totalOutstanding)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs — equal-width segmented control, balanced on tablet/desktop */}
      <div role="tablist" className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl md:max-w-lg">
        {tabs.map(({ key, label, badge }) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`h-10 px-1.5 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-w-0 whitespace-nowrap ${
              tab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className="truncate">{label}</span>
            {!!badge && badge > 0 && (
              <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-xs font-bold leading-[18px] text-center">
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <SupplierSchemesTabsSection
        tab={tab}
        cnFilter={cnFilter}
        setCnFilter={setCnFilter}
        supplierSchemes={supplierSchemes}
        supplierCreditNotes={supplierCreditNotes}
        schemeNotes={schemeNotes}
        claimNotes={claimNotes}
        visibleNotes={visibleNotes}
        schemeById={schemeById}
        usageByScheme={usageByScheme}
        monthlyReport={monthlyReport}
        openCreate={openCreate}
        openEdit={openEdit}
        openReceipt={openReceipt}
        openEditNote={openEditNote}
        openClaim={openClaim}
        raiseMonthlyNote={raiseMonthlyNote}
        noteForRow={noteForRow}
        statusBadge={statusBadge}
        productNames={productNames}
        setDeleteConfirm={setDeleteConfirm}
        setDeleteNoteConfirm={setDeleteNoteConfirm}
        updateSupplierScheme={updateSupplierScheme}
        updateSupplierCreditNote={updateSupplierCreditNote}
      />

      <SupplierSchemesModals
        schemeModalOpen={schemeModalOpen}
        setSchemeModalOpen={setSchemeModalOpen}
        editingSchemeId={editingSchemeId}
        form={form}
        setForm={setForm}
        formError={formError}
        productSearch={productSearch}
        setProductSearch={setProductSearch}
        supplierNames={supplierNames}
        filteredProducts={filteredProducts}
        saveScheme={saveScheme}
        toggleProduct={toggleProduct}
        receiptNote={receiptNote}
        setReceiptNote={setReceiptNote}
        receiptAmount={receiptAmount}
        setReceiptAmount={setReceiptAmount}
        receiptNumber={receiptNumber}
        setReceiptNumber={setReceiptNumber}
        receiptDate={receiptDate}
        setReceiptDate={setReceiptDate}
        submitReceipt={submitReceipt}
        editingNote={editingNote}
        setEditingNote={setEditingNote}
        editExpectedAmount={editExpectedAmount}
        setEditExpectedAmount={setEditExpectedAmount}
        editActualAmount={editActualAmount}
        setEditActualAmount={setEditActualAmount}
        editCnNumber={editCnNumber}
        setEditCnNumber={setEditCnNumber}
        editCnDate={editCnDate}
        setEditCnDate={setEditCnDate}
        editCnNotes={editCnNotes}
        setEditCnNotes={setEditCnNotes}
        saveEditedNote={saveEditedNote}
        deleteConfirm={deleteConfirm}
        setDeleteConfirm={setDeleteConfirm}
        deleteSupplierScheme={deleteSupplierScheme}
        deleteNoteConfirm={deleteNoteConfirm}
        setDeleteNoteConfirm={setDeleteNoteConfirm}
        deleteSupplierCreditNote={deleteSupplierCreditNote}
      />
    </div>
  );
};
