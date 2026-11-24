import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLedger } from '../../context/LedgerContext';
import { batchLineKey } from '../../utils/stockLocations';
import { todayISO } from '../../utils/dateLocal';
import { confirmDialog } from '../../utils/dialogs';
import { useIsMobile } from '../../hooks/useIsMobile';
import type { Product } from '../../types';
import {
  readDraft,
  writeDraft,
  type AuditReviewData,
  type AuditStats,
  type Draft,
  type Filter,
  type FoundLine,
  type OversoldItem,
  type OversoldState,
  type Row,
  type SavedAuditInfo,
  type Step,
  type StockAuditScreenProps,
} from './stockAudit/stockAuditTypes';
import { StockAuditPhoneView } from './stockAudit/StockAuditPhoneView';
import { StockAuditDesktopView } from './stockAudit/StockAuditDesktopView';

export type { StockAuditScreenProps };

/**
 * Phone-first batch-level stock audit.
 *
 *  setup  -> pick the godown (and resume an unfinished count, if any)
 *  count  -> one card per product, one compact line per batch; no floating bars
 *  review -> only the differences, one line per batch, then Confirm & Save
 *
 * Every difference is saved against its own batch (see saveBatchAudit), so a shortage in a
 * new batch is never taken off an old one. Nothing is assumed: a batch that is not counted is
 * simply not audited (it is listed on the review screen so it can be counted or marked as matching).
 */
export const StockAuditScreen: React.FC<StockAuditScreenProps> = ({
  onGoInventoryTab,
  selectedWhId,
  onChangeWhId,
}) => {
  const isPhone = useIsMobile(1023);
  const {
    products,
    warehouses,
    productBatchLines,
    productWarehouseStock,
    warehouseStock,
    bookStock,
    inventoryBatches,
    bills,
    audits,
    stockLedgerEntries,
    inventoryDispositions,
    addBatch,
    saveBatchAudit,
    currentRole,
    setTab,
  } = useLedger();

  const isAdmin = currentRole === 'admin';

  const [step, setStep] = useState<Step>(() => (typeof window !== 'undefined' && window.innerWidth <= 1023 ? 'count' : 'setup'));
  const [whId, setWhId] = useState<string>(selectedWhId || warehouses[0]?.id || '');
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [found, setFound] = useState<FoundLine[]>([]);
  const [note, setNote] = useState('');
  const [batchNotes, setBatchNotes] = useState<Record<string, string>>({});
  const [showPostSheet, setShowPostSheet] = useState(false);
  const [postReason, setPostReason] = useState('');
  const [oversold, setOversold] = useState<Record<number, OversoldState>>({});
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [showEmpty, setShowEmpty] = useState(false);
  const [openEmpty, setOpenEmpty] = useState<Record<number, boolean>>({});
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [foundFormFor, setFoundFormFor] = useState<number | null>(null);
  const [ffBatch, setFfBatch] = useState('');
  const [ffExp, setFfExp] = useState('');
  const [ffError, setFfError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [savedInfo, setSavedInfo] = useState<SavedAuditInfo | null>(null);
  const [pendingDraft, setPendingDraft] = useState<Draft | null>(() => readDraft());

  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!whId && (selectedWhId || warehouses[0]?.id)) {
      setWhId(selectedWhId || warehouses[0].id);
    }
  }, [warehouses, whId, selectedWhId]);

  useEffect(() => {
    if (isPhone && selectedWhId && selectedWhId !== whId) {
      setWhId(selectedWhId);
      setCounts({});
      setFound([]);
      setBatchNotes({});
      setSaveError('');
      if (step === 'setup' || step === 'done') setStep('count');
    }
  }, [isPhone, selectedWhId, whId, step]);

  useEffect(() => {
    if (isPhone && step === 'setup' && (whId || warehouses[0]?.id)) {
      setStep('count');
    }
  }, [isPhone, step, whId, warehouses]);

  // Keep the count on the phone while the person works, so a closed tab or a phone call loses nothing.
  useEffect(() => {
    if (step !== 'count' && step !== 'review') return;
    const hasWork =
      Object.values(counts).some((v) => v !== '') || found.length > 0 || Object.keys(oversold).length > 0 || note.trim() !== '';
    const t = setTimeout(() => {
      writeDraft(hasWork ? { whId, counts, found, note, oversold, savedAt: Date.now() } : null);
    }, 400);
    return () => clearTimeout(t);
  }, [step, whId, counts, found, note, oversold]);

  const whName = (id: string) => warehouses.find((w) => w.id === id)?.name || 'Godown';

  // ── Rows: one per batch (system = live quantity of that batch at this godown) ───────────────
  const productRows = useMemo(() => {
    const out: { product: Product; rows: Row[] }[] = [];
    for (const product of products) {
      const lines = productBatchLines(product.id).filter((l) => !whId || l.warehouseId === whId);
      const rows: Row[] = lines.map((l) => ({
        key: l.key,
        productId: product.id,
        batchNumber: l.batchNumber,
        expiryDate: l.expiryDate,
        expiryStatus: l.expiryStatus,
        systemQty: l.availableQty,
      }));
      for (const f of found) {
        if (f.productId !== product.id) continue;
        rows.push({
          key: f.key,
          productId: product.id,
          batchNumber: f.batchNumber,
          expiryDate: f.expiryDate,
          expiryStatus: 'unknown',
          systemQty: 0,
          isFound: true,
        });
      }
      if (rows.length === 0) {
        const sys = whId ? warehouseStock(whId, product.id) : bookStock(product.id);
        if (sys !== 0) {
          rows.push({
            key: `prod_${product.id}`,
            productId: product.id,
            batchNumber: '',
            expiryDate: '',
            expiryStatus: 'unknown',
            systemQty: sys,
            noBatch: true,
          });
        }
      }
      if (rows.length > 0) out.push({ product, rows });
    }
    return out.sort((a, b) => a.product.name.localeCompare(b.product.name));
    // The stock functions are re-created every render; the state below is what actually changes them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, inventoryBatches, bills, audits, stockLedgerEntries, inventoryDispositions, warehouses, whId, found, step]);

  // Oversold products: the real (negative) book balance of this godown, which every other screen shows as 0.
  const oversoldList = useMemo(() => {
    if (!whId) return [] as OversoldItem[];
    const out: OversoldItem[] = [];
    for (const product of products) {
      const rows = productWarehouseStock(product.id);
      const here = rows.find((r) => r.warehouseId === whId);
      if (!here || here.crates >= 0) continue;
      out.push({
        product,
        raw: here.crates,
        others: rows
          .filter((r) => r.warehouseId !== whId && r.crates > 0)
          .map((r) => ({ name: r.warehouseName, qty: r.crates })),
      });
    }
    return out.sort((a, b) => a.product.name.localeCompare(b.product.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, inventoryBatches, bills, audits, stockLedgerEntries, inventoryDispositions, warehouses, whId, step]);

  const oversoldIds = useMemo(() => new Set(oversoldList.map((o) => o.product.id)), [oversoldList]);

  const num = (key: string): number | null => {
    const v = counts[key];
    if (v === undefined || v.trim() === '') return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
  };

  const allRows = useMemo(() => productRows.flatMap((p) => p.rows), [productRows]);

  const stats: AuditStats = useMemo(() => {
    let total = 0;
    let counted = 0;
    let differ = 0;
    let net = 0;
    for (const r of allRows) {
      const c = num(r.key);
      if (r.systemQty > 0 || c !== null) total++;
      if (c !== null) {
        counted++;
        if (c !== r.systemQty) {
          differ++;
          net += c - r.systemQty;
        }
      }
    }
    return { total, counted, differ, net };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRows, counts]);

  const q = search.trim().toLowerCase();
  const isEmptyRow = (r: Row) => r.systemQty <= 0 && num(r.key) === null && !r.isFound;

  const rowVisible = (product: Product, r: Row) => {
    if (q && !product.name.toLowerCase().includes(q) && !(r.batchNumber || '').toLowerCase().includes(q)) return false;
    const c = num(r.key);
    if (isEmptyRow(r) && !(showEmpty || openEmpty[product.id] || q)) return false;
    if (filter === 'pending' && c !== null) return false;
    if (filter === 'done' && c === null) return false;
    if (filter === 'diff' && !(c !== null && c !== r.systemQty)) return false;
    return true;
  };

  const hiddenEmptyTotal = useMemo(() => {
    if (showEmpty || q) return 0;
    let n = 0;
    for (const { product, rows } of productRows) {
      if (openEmpty[product.id]) continue;
      n += rows.filter((r) => isEmptyRow(r)).length;
    }
    return n;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productRows, counts, showEmpty, q, openEmpty]);

  // ── Actions ─────────────────────────────────────────────────────────────────────────────────
  const setCount = (key: string, value: string) =>
    setCounts((prev) => ({ ...prev, [key]: value.replace(/[^0-9]/g, '').slice(0, 6) }));

  const stepCount = (r: Row, delta: number) => {
    const cur = num(r.key);
    const base = cur === null ? r.systemQty : cur;
    setCounts((prev) => ({ ...prev, [r.key]: String(Math.max(0, base + delta)) }));
  };

  const markMatch = (r: Row) => setCounts((prev) => ({ ...prev, [r.key]: String(Math.max(0, r.systemQty)) }));

  const markProductMatch = (rows: Row[]) =>
    setCounts((prev) => {
      const next = { ...prev };
      for (const r of rows) if (!isEmptyRow(r) || next[r.key] !== undefined) next[r.key] = String(Math.max(0, r.systemQty));
      return next;
    });

  const focusNext = (el: HTMLInputElement) => {
    const inputs = Array.from(listRef.current?.querySelectorAll<HTMLInputElement>('input[data-audit-input]') || []);
    const nxt = inputs[inputs.indexOf(el) + 1];
    if (nxt) {
      nxt.focus();
      nxt.select();
      window.setTimeout(() => nxt.scrollIntoView({ block: 'center', behavior: 'smooth' }), 60);
    } else {
      el.blur();
      window.setTimeout(() => document.getElementById('audit-finish')?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 60);
    }
  };

  const startCount = async (id: string) => {
    const hasWork = Object.values(counts).some((v) => v !== '') || found.length > 0;
    // Coming back to the same godown keeps the count in progress; only a different godown starts clean.
    if (hasWork && id === whId) {
      setStep('count');
      return;
    }
    if (hasWork) {
      const ok = await confirmDialog({
        title: 'Start another godown?',
        message: 'Starting another godown discards the count in progress.',
        confirmLabel: 'Discard & Switch',
        cancelLabel: 'Keep Current',
        tone: 'danger',
      });
      if (!ok) return;
    }
    if (id !== whId) {
      setWhId(id);
      onChangeWhId?.(id);
    }
    setCounts({});
    setFound([]);
    setNote('');
    setBatchNotes({});
    setOversold({});
    setSearch('');
    setFilter('all');
    setShowEmpty(false);
    setOpenEmpty({});
    setSaveError('');
    writeDraft(null);
    setPendingDraft(null);
    setStep('count');
  };

  const resumeDraft = () => {
    if (!pendingDraft) return;
    setWhId(pendingDraft.whId);
    onChangeWhId?.(pendingDraft.whId);
    setCounts(pendingDraft.counts);
    setFound(pendingDraft.found);
    setNote(pendingDraft.note);
    setOversold(pendingDraft.oversold);
    setSaveError('');
    setPendingDraft(null);
    setStep('count');
  };

  const discardDraft = () => {
    writeDraft(null);
    setPendingDraft(null);
  };

  const addFoundBatch = (productId: number) => {
    const bn = ffBatch.trim();
    if (!bn) {
      setFfError('Type the batch number printed on the crate.');
      return;
    }
    const key = batchLineKey(whId, bn, ffExp);
    if (allRows.some((r) => r.key === key)) {
      setFfError('This batch already exists for the product — count it directly.');
      setOpenEmpty((p) => ({ ...p, [productId]: true }));
      return;
    }
    setFound((prev) => [...prev, { key, productId, batchNumber: bn, expiryDate: ffExp }]);
    setFoundFormFor(null);
    setFfBatch('');
    setFfExp('');
    setFfError('');
  };

  const removeFound = (key: string) => {
    setFound((prev) => prev.filter((f) => f.key !== key));
    setCounts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // ── Review data ─────────────────────────────────────────────────────────────────────────────
  const review: AuditReviewData = useMemo(() => {
    const diffs: { product: Product; rows: { r: Row; c: number }[]; net: number }[] = [];
    const matches: { product: Product; r: Row; c: number }[] = [];
    const uncounted: Row[] = [];
    for (const { product, rows } of productRows) {
      const d: { r: Row; c: number }[] = [];
      for (const r of rows) {
        const c = num(r.key);
        if (c === null) {
          if (r.systemQty > 0) uncounted.push(r);
          continue;
        }
        if (c !== r.systemQty) d.push({ r, c });
        else matches.push({ product, r, c });
      }
      if (d.length) diffs.push({ product, rows: d, net: d.reduce((s, x) => s + x.c - x.r.systemQty, 0) });
    }
    return { diffs, matches, uncounted };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productRows, counts]);

  const oversoldChoice = (pid: number): OversoldState => oversold[pid] || { choice: 'fix', reason: '' };
  const oversoldToSave = oversoldList.filter((o) => oversoldChoice(o.product.id).choice !== 'fix');
  const oversoldUnresolved = oversoldList.filter((o) => oversoldChoice(o.product.id).choice === 'fix');
  const nothingToSave = stats.counted === 0 && oversoldToSave.length === 0;

  const confirmSave = (explicitReason?: string) => {
    setSaveError('');
    for (const o of oversoldToSave) {
      const st = oversoldChoice(o.product.id);
      if (st.choice === 'adjust' && !isAdmin) {
        setSaveError('Only the owner login can post an oversold adjustment.');
        return;
      }
      if (st.choice === 'adjust' && !st.reason) {
        setSaveError(`Choose a reason for the ${o.product.name} adjustment.`);
        return;
      }
    }
    if (isPhone && stats.differ > 0 && !isAdmin) {
      setSaveError('Owner login required to post stock adjustments.');
      return;
    }
    const reasonText = (explicitReason ?? postReason ?? '').trim();
    if (isPhone && stats.differ > 0 && !reasonText) {
      setSaveError('Enter a reason for the stock adjustment.');
      return;
    }
    const lines: Parameters<typeof saveBatchAudit>[0]['lines'] = [];
    for (const r of allRows) {
      const c = num(r.key);
      if (c === null) continue;
      if (r.isFound && c === 0) continue; // nothing was found
      lines.push({
        productId: r.productId,
        batchKey: r.noBatch ? undefined : r.key,
        batchNumber: r.noBatch ? undefined : r.batchNumber,
        expiryDate: r.noBatch ? undefined : r.expiryDate,
        system: r.systemQty,
        counted: c,
      });
    }
    for (const o of oversoldToSave) {
      const st = oversoldChoice(o.product.id);
      lines.push({
        productId: o.product.id,
        system: o.raw,
        counted: st.choice === 'adjust' ? 0 : o.raw,
        kind: st.choice === 'adjust' ? 'oversold_adjust' : 'oversold_open',
        reason: st.reason || (st.choice === 'open' ? 'Under investigation' : undefined),
      });
    }
    if (lines.length === 0) {
      setSaveError('Count at least one batch first.');
      return;
    }
    // Batches typed in as "found" are created (quantity 0) now; the audit difference then fills them.
    for (const f of found) {
      const c = num(f.key);
      if (c === null || c === 0) continue;
      addBatch({
        productId: f.productId,
        batchNumber: f.batchNumber,
        expiryDate: f.expiryDate,
        warehouseId: whId,
        quantity: 0,
        inwardDate: todayISO(),
        notes: 'Found during stock audit',
      });
    }
    const extraLineNotes = Object.entries(batchNotes)
      .filter(([, val]) => val.trim().length > 0)
      .map(([, val]) => val.trim());
    const combinedNote = [reasonText, note.trim(), ...extraLineNotes].filter(Boolean).join(' · ');
    const id = saveBatchAudit({ date: todayISO(), warehouseId: whId, referenceNote: combinedNote, lines });
    if (id === null) {
      setSaveError('Nothing could be saved. Count at least one batch.');
      return;
    }
    setSavedInfo({ id, counted: stats.counted, differ: stats.differ, net: stats.net });
    writeDraft(null);
    setCounts({});
    setFound([]);
    setNote('');
    setBatchNotes({});
    setPostReason('');
    setShowPostSheet(false);
    setOversold({});
    setStep('done');
  };

  // ── Screens ─────────────────────────────────────────────────────────────────────────────────
  if (isPhone) {
    return (
      <StockAuditPhoneView
        step={step}
        setStep={setStep}
        savedInfo={savedInfo}
        setSavedInfo={setSavedInfo}
        whId={whId}
        whName={whName}
        warehouses={warehouses}
        stats={stats}
        review={review}
        oversoldList={oversoldList}
        oversoldChoice={oversoldChoice}
        counts={counts}
        setCounts={setCounts}
        batchNotes={batchNotes}
        setBatchNotes={setBatchNotes}
        nothingToSave={nothingToSave}
        setSaveError={setSaveError}
        saveError={saveError}
        note={note}
        setNote={setNote}
        showPostSheet={showPostSheet}
        setShowPostSheet={setShowPostSheet}
        postReason={postReason}
        setPostReason={setPostReason}
        isAdmin={isAdmin}
        confirmSave={confirmSave}
        pendingDraft={pendingDraft}
        resumeDraft={resumeDraft}
        search={search}
        setSearch={setSearch}
        q={q}
        listRef={listRef}
        productRows={productRows}
        rowVisible={rowVisible}
        markProductMatch={markProductMatch}
        num={num}
        setCount={setCount}
        focusNext={focusNext}
        markMatch={markMatch}
        hiddenEmptyTotal={hiddenEmptyTotal}
        showEmpty={showEmpty}
        setShowEmpty={setShowEmpty}
        setOpenEmpty={setOpenEmpty}
      />
    );
  }

  return (
    <StockAuditDesktopView
      step={step}
      setStep={setStep}
      pendingDraft={pendingDraft}
      resumeDraft={resumeDraft}
      discardDraft={discardDraft}
      whId={whId}
      whName={whName}
      warehouses={warehouses}
      warehouseStock={warehouseStock}
      startCount={startCount}
      savedInfo={savedInfo}
      setSavedInfo={setSavedInfo}
      stats={stats}
      review={review}
      setCounts={setCounts}
      oversoldList={oversoldList}
      oversoldChoice={oversoldChoice}
      oversoldUnresolved={oversoldUnresolved}
      setOversold={setOversold}
      note={note}
      setNote={setNote}
      saveError={saveError}
      confirmSave={confirmSave}
      nothingToSave={nothingToSave}
      search={search}
      setSearch={setSearch}
      q={q}
      filter={filter}
      setFilter={setFilter}
      hiddenEmptyTotal={hiddenEmptyTotal}
      showEmpty={showEmpty}
      setShowEmpty={setShowEmpty}
      openEmpty={openEmpty}
      setOpenEmpty={setOpenEmpty}
      isAdmin={isAdmin}
      onGoInventoryTab={onGoInventoryTab}
      setTab={setTab}
      listRef={listRef}
      productRows={productRows}
      counts={counts}
      num={num}
      rowVisible={rowVisible}
      isEmptyRow={isEmptyRow}
      collapsed={collapsed}
      setCollapsed={setCollapsed}
      oversoldIds={oversoldIds}
      markProductMatch={markProductMatch}
      stepCount={stepCount}
      setCount={setCount}
      focusNext={focusNext}
      markMatch={markMatch}
      removeFound={removeFound}
      foundFormFor={foundFormFor}
      setFoundFormFor={setFoundFormFor}
      ffBatch={ffBatch}
      setFfBatch={setFfBatch}
      ffExp={ffExp}
      setFfExp={setFfExp}
      ffError={ffError}
      setFfError={setFfError}
      addFoundBatch={addFoundBatch}
    />
  );
};
