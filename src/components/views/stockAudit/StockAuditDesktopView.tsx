import React from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Eye,
  EyeOff,
  Search,
  Warehouse as WarehouseIcon,
} from 'lucide-react';
import { InfoTip } from '../../common/InfoTip';
import type { Product, TabId, Warehouse } from '../../../types';
import { AuditOversoldCard, AuditProductCard } from './StockAuditCards';
import {
  expiryClass,
  fmtExp,
  signed,
  type AuditReviewData,
  type AuditStats,
  type Draft,
  type Filter,
  type OversoldItem,
  type OversoldState,
  type Row,
  type SavedAuditInfo,
  type Step,
} from './stockAuditTypes';

export interface StockAuditDesktopViewProps {
  step: Step;
  setStep: React.Dispatch<React.SetStateAction<Step>>;
  pendingDraft: Draft | null;
  resumeDraft: () => void;
  discardDraft: () => void;
  whId: string;
  whName: (id: string) => string;
  warehouses: Warehouse[];
  warehouseStock: (whId: string, productId?: number) => number;
  startCount: (id: string) => void;
  savedInfo: SavedAuditInfo | null;
  setSavedInfo: React.Dispatch<React.SetStateAction<SavedAuditInfo | null>>;
  stats: AuditStats;
  review: AuditReviewData;
  setCounts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  oversoldList: OversoldItem[];
  oversoldChoice: (pid: number) => OversoldState;
  oversoldUnresolved: OversoldItem[];
  setOversold: React.Dispatch<React.SetStateAction<Record<number, OversoldState>>>;
  note: string;
  setNote: React.Dispatch<React.SetStateAction<string>>;
  saveError: string;
  confirmSave: (explicitReason?: string) => void;
  nothingToSave: boolean;
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  q: string;
  filter: Filter;
  setFilter: React.Dispatch<React.SetStateAction<Filter>>;
  hiddenEmptyTotal: number;
  showEmpty: boolean;
  setShowEmpty: React.Dispatch<React.SetStateAction<boolean>>;
  openEmpty: Record<number, boolean>;
  setOpenEmpty: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  isAdmin: boolean;
  onGoInventoryTab?: (tab: 'consignments' | 'transfers') => void;
  setTab: (tab: TabId) => void;
  listRef: React.RefObject<HTMLDivElement | null>;
  productRows: { product: Product; rows: Row[] }[];
  counts: Record<string, string>;
  num: (key: string) => number | null;
  rowVisible: (product: Product, r: Row) => boolean;
  isEmptyRow: (r: Row) => boolean;
  collapsed: Record<number, boolean>;
  setCollapsed: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  oversoldIds: Set<number>;
  markProductMatch: (rows: Row[]) => void;
  stepCount: (r: Row, delta: number) => void;
  setCount: (key: string, value: string) => void;
  focusNext: (el: HTMLInputElement) => void;
  markMatch: (r: Row) => void;
  removeFound: (key: string) => void;
  foundFormFor: number | null;
  setFoundFormFor: React.Dispatch<React.SetStateAction<number | null>>;
  ffBatch: string;
  setFfBatch: React.Dispatch<React.SetStateAction<string>>;
  ffExp: string;
  setFfExp: React.Dispatch<React.SetStateAction<string>>;
  ffError: string;
  setFfError: React.Dispatch<React.SetStateAction<string>>;
  addFoundBatch: (productId: number) => void;
}

export const StockAuditDesktopView: React.FC<StockAuditDesktopViewProps> = ({
  step,
  setStep,
  pendingDraft,
  resumeDraft,
  discardDraft,
  whId,
  whName,
  warehouses,
  warehouseStock,
  startCount,
  savedInfo,
  setSavedInfo,
  stats,
  review,
  setCounts,
  oversoldList,
  oversoldChoice,
  oversoldUnresolved,
  setOversold,
  note,
  setNote,
  saveError,
  confirmSave,
  nothingToSave,
  search,
  setSearch,
  q,
  filter,
  setFilter,
  hiddenEmptyTotal,
  showEmpty,
  setShowEmpty,
  openEmpty,
  setOpenEmpty,
  isAdmin,
  onGoInventoryTab,
  setTab,
  listRef,
  productRows,
  counts,
  num,
  rowVisible,
  isEmptyRow,
  collapsed,
  setCollapsed,
  oversoldIds,
  markProductMatch,
  stepCount,
  setCount,
  focusNext,
  markMatch,
  removeFound,
  foundFormFor,
  setFoundFormFor,
  ffBatch,
  setFfBatch,
  ffExp,
  setFfExp,
  ffError,
  setFfError,
  addFoundBatch,
}) => {
  if (step === 'setup') {
    return (
      <div className="flex flex-col gap-3 w-full">
        {pendingDraft && (
          <div data-card-tone="warning" className="rounded-2xl border p-3.5 space-y-2.5 shadow-sm">
            <div className="flex items-center gap-2.5">
              <span className="hh-icon-badge hh-icon-badge--sm hh-icon-badge--amber">
                <ClipboardCheck size={16} />
              </span>
              <div className="min-w-0">
                <div className="text-[14px] font-bold text-slate-900">Unfinished count found</div>
                <div className="text-[12px] text-slate-600">
                  {whName(pendingDraft.whId)} · {Object.values(pendingDraft.counts).filter((v) => v !== '').length} counted ·{' '}
                  {new Date(pendingDraft.savedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={resumeDraft} className="h-11 px-4 rounded-xl bg-[var(--primary)] text-white text-sm font-semibold cursor-pointer">
                Continue count
              </button>
              <button type="button" onClick={discardDraft} className="h-11 px-4 rounded-xl border border-black/10 bg-white/85 text-sm font-semibold text-slate-700 cursor-pointer">
                Discard
              </button>
            </div>
          </div>
        )}
        <div data-card-tone="profit" className="rounded-2xl border shadow-sm p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <span className="hh-icon-badge hh-icon-badge--purple mt-0.5">
                <ClipboardCheck size={18} />
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-extrabold text-slate-900 leading-snug">
                  Which godown are you counting?
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Choose a godown to start a physical shelf count.
                </p>
              </div>
            </div>
            <div className="shrink-0 mt-0.5">
              <InfoTip title="How the stock audit works">
                <p>Count every batch on the shelf. Each difference is saved against its own batch and posted to live stock.</p>
                <p>A batch you do not count is not audited. Nothing is assumed to match.</p>
              </InfoTip>
            </div>
          </div>

          {warehouses.length === 0 ? (
            <div className="rounded-xl bg-white/80 border border-black/5 px-4 py-6 text-sm text-slate-500">
              Add a godown first (Settings → Godowns).
            </div>
          ) : (
            <div className="space-y-2.5">
              {warehouses.map((w) => {
                const qty = warehouseStock(w.id);
                const hasStock = qty > 0;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => startCount(w.id)}
                    data-card-tone={hasStock ? 'sales' : 'neutral'}
                    className="w-full flex items-center justify-between gap-3 px-3.5 py-3.5 rounded-2xl border shadow-xs text-left active:scale-[0.99] transition cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className={`hh-icon-badge ${
                          hasStock ? 'hh-icon-badge--blue' : 'hh-icon-badge--slate'
                        }`}
                      >
                        <WarehouseIcon size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-slate-900 leading-snug break-words">
                          {w.name}
                        </div>
                        <div className="mt-1">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold tabular-nums ${
                              hasStock
                                ? 'bg-blue-100/90 text-blue-800'
                                : 'bg-white/80 text-slate-500 border border-slate-200/80'
                            }`}
                          >
                            {qty.toLocaleString()} cs in stock
                          </span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-slate-500 shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (step === 'done' && savedInfo) {
    return (
      <div data-card-tone="received" className="rounded-2xl border p-4 space-y-3 shadow-sm">
        <div className="flex items-center gap-2.5 text-emerald-900 font-bold text-base">
          <span className="hh-icon-badge hh-icon-badge--sm hh-icon-badge--green">
            <CheckCircle2 size={17} />
          </span>
          <span>Audit #{savedInfo.id} saved</span>
        </div>
        <div className="text-sm text-slate-700">
          {savedInfo.counted} batch{savedInfo.counted === 1 ? '' : 'es'} counted ·{' '}
          {savedInfo.differ === 0 ? 'no differences' : `${savedInfo.differ} differ (${signed(savedInfo.net)} cs net)`}. Differences are
          posted to live stock for {whName(whId)}.
        </div>
        <button
          type="button"
          onClick={() => {
            setSavedInfo(null);
            setStep('setup');
          }}
          className="h-11 px-4 rounded-xl bg-[var(--primary)] text-white text-sm font-semibold cursor-pointer"
        >
          Start another count
        </button>
      </div>
    );
  }

  if (step === 'review') {
    return (
      <div className="flex flex-col gap-3 w-full">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setStep('count')}
            className="h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft size={16} /> Back to counting
          </button>
          <div className="text-[12px] font-semibold text-slate-500">{whName(whId)}</div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div data-card-tone="sales" className="rounded-2xl border py-2.5 shadow-2xs">
            <div className="text-lg font-extrabold text-slate-900 tabular-nums">{stats.counted}</div>
            <div className="text-xs font-bold uppercase text-blue-800/80">Counted</div>
          </div>
          <div data-card-tone={stats.differ ? 'warning' : 'received'} className="rounded-2xl border py-2.5 shadow-2xs">
            <div className={`text-lg font-extrabold tabular-nums ${stats.differ ? 'text-amber-700' : 'text-emerald-700'}`}>{stats.differ}</div>
            <div className="text-xs font-bold uppercase text-slate-600">Differ</div>
          </div>
          <div data-card-tone={stats.net < 0 ? 'due' : stats.net > 0 ? 'warning' : 'neutral'} className="rounded-2xl border py-2.5 shadow-2xs">
            <div className={`text-lg font-extrabold tabular-nums ${stats.net < 0 ? 'text-rose-700' : stats.net > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
              {signed(stats.net)}
            </div>
            <div className="text-xs font-bold uppercase text-slate-600">Net cs</div>
          </div>
        </div>

        {review.uncounted.length > 0 && (
          <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-3 space-y-2">
            <div className="text-[13px] font-bold text-slate-900">
              {review.uncounted.length} batch{review.uncounted.length === 1 ? '' : 'es'} with stock not counted
            </div>
            <div className="text-[12px] text-slate-600">They will not be audited. Count them, or mark them as matching the system.</div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setStep('count')} className="h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm font-semibold cursor-pointer">
                Go count them
              </button>
              <button
                type="button"
                onClick={() =>
                  setCounts((prev) => {
                    const next = { ...prev };
                    for (const r of review.uncounted) next[r.key] = String(r.systemQty);
                    return next;
                  })
                }
                className="h-10 px-3 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 text-sm font-semibold cursor-pointer"
              >
                Mark all as matching
              </button>
            </div>
          </div>
        )}

        {oversoldList.length > 0 && (
          <div className="rounded-2xl border border-rose-200 bg-white p-3 space-y-1.5">
            <div className="text-[13px] font-bold text-slate-900">Oversold products</div>
            {oversoldList.map((o) => {
              const st = oversoldChoice(o.product.id);
              return (
                <div key={o.product.id} className="text-[12px] flex items-start justify-between gap-2">
                  <span className="min-w-0 break-words text-slate-800">{o.product.name} ({o.raw} cs)</span>
                  <span className={`shrink-0 font-semibold ${st.choice === 'fix' ? 'text-amber-700' : 'text-emerald-700'}`}>
                    {st.choice === 'fix' ? 'Needs attention — not saved' : st.choice === 'open' ? 'Under investigation' : `Adjust +${Math.abs(o.raw)}`}
                  </span>
                </div>
              );
            })}
            {oversoldUnresolved.length > 0 && (
              <button type="button" onClick={() => setStep('count')} className="text-[12px] font-semibold text-sky-700 underline cursor-pointer">
                Choose what to do (back to counting)
              </button>
            )}
          </div>
        )}

        <div className="rounded-2xl border border-black/10 bg-white shadow-sm overflow-hidden">
          <div className="px-3 py-2 border-b border-black/5 text-[12px] font-bold uppercase tracking-wide text-slate-500">Differences</div>
          {review.diffs.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-emerald-700 font-semibold">Every counted batch matches the system.</div>
          ) : (
            <div className="divide-y divide-black/5">
              {review.diffs.map(({ product, rows, net }) => (
                <div key={product.id} className="px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[13px] font-bold text-slate-900 break-words min-w-0">{product.name}</div>
                    <div className={`text-[13px] font-extrabold tabular-nums shrink-0 ${net < 0 ? 'text-rose-700' : net > 0 ? 'text-amber-700' : 'text-slate-600'}`}>
                      {signed(net)} cs
                    </div>
                  </div>
                  {rows.map(({ r, c }) => (
                    <div key={r.key} className="mt-1 flex items-center justify-between text-[12px]">
                      <span className="text-slate-600 break-all min-w-0">
                        {r.noBatch ? 'No batch' : `Batch ${r.batchNumber}`}
                        {!r.noBatch && <span className={`ml-1 ${expiryClass(r.expiryStatus)}`}>· {fmtExp(r.expiryDate)}</span>}
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {r.systemQty} → <b>{c}</b>{' '}
                        <b className={c - r.systemQty < 0 ? 'text-rose-700' : 'text-amber-700'}>({signed(c - r.systemQty)})</b>
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {review.matches.length > 0 && (
          <details className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-[12px] text-slate-600">
            <summary className="cursor-pointer font-semibold text-slate-700">{review.matches.length} batches match</summary>
            <ul className="mt-2 space-y-1">
              {review.matches.map(({ product, r, c }) => (
                <li key={r.key} className="flex justify-between gap-2">
                  <span className="min-w-0 break-words">
                    {product.name}
                    {!r.noBatch && <span className="text-slate-400"> · {r.batchNumber}</span>}
                  </span>
                  <span className="shrink-0 tabular-nums">{c}</span>
                </li>
              ))}
            </ul>
          </details>
        )}

        <div className="rounded-2xl border border-black/10 bg-white p-3 space-y-2.5">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-sm"
          />
          {saveError && (
            <div className="text-[12px] font-semibold text-rose-700 flex items-start gap-1.5" role="alert">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {saveError}
            </div>
          )}
          <button
            type="button"
            onClick={() => confirmSave()}
            disabled={nothingToSave}
            className="w-full h-12 rounded-xl bg-[var(--primary)] text-white text-[15px] font-bold disabled:opacity-50 cursor-pointer"
          >
            Confirm &amp; Save
          </button>
          <div className="text-xs text-slate-500">
            Differences are posted to live stock for {whName(whId)}. A saved audit can only be undone by deleting it, which reverses the adjustment.
          </div>
        </div>
      </div>
    );
  }

  // step === 'count'
  const pct = stats.total > 0 ? Math.min(100, Math.round((stats.counted / stats.total) * 100)) : 0;
  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'pending', label: 'Pending' },
    { id: 'diff', label: 'Different' },
    { id: 'done', label: 'Done' },
  ];
  const cards = productRows
    .map(({ product, rows }) => {
      const visible = rows.filter((r) => rowVisible(product, r));
      if (visible.length === 0) return null;
      return (
        <AuditProductCard
          key={product.id}
          product={product}
          rows={rows}
          counts={counts}
          num={num}
          rowVisible={rowVisible}
          isEmptyRow={isEmptyRow}
          showEmpty={showEmpty}
          q={q}
          openEmpty={openEmpty}
          setOpenEmpty={setOpenEmpty}
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
    })
    .filter(Boolean);

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setStep('setup')}
          className="h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 inline-flex items-center gap-1.5 cursor-pointer min-w-0"
        >
          <ArrowLeft size={16} className="shrink-0" /> <span className="truncate">{whName(whId)}</span>
        </button>
        <button
          type="button"
          onClick={() => setStep('review')}
          className="h-10 px-4 rounded-xl bg-[var(--primary)] text-white text-sm font-bold shrink-0 cursor-pointer"
        >
          Review{stats.counted > 0 ? ` (${stats.counted})` : ''}
        </button>
      </div>

      <div data-card-tone="sales" className="rounded-2xl border px-3.5 py-3 shadow-2xs">
        <div className="flex items-center justify-between text-[12px] font-bold text-slate-700">
          <span>
            {stats.counted} of {stats.total} counted
          </span>
          {stats.differ > 0 && <span className="text-amber-700">{stats.differ} differ</span>}
        </div>
        <div className="mt-1.5 h-2 rounded-full bg-white/80 overflow-hidden">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="search"
          enterKeyHint="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search product or batch"
          className="w-full h-11 pl-9 pr-3 rounded-full border border-black/10 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/25"
        />
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`h-9 px-3.5 rounded-full text-[12.5px] font-semibold whitespace-nowrap cursor-pointer ${
              filter === f.id ? 'bg-slate-900 text-white' : 'bg-white border border-slate-300 text-slate-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {(hiddenEmptyTotal > 0 || showEmpty) && (
        <button
          type="button"
          onClick={() => {
            setShowEmpty((v) => !v);
            setOpenEmpty({});
          }}
          className="self-start text-[12px] font-semibold text-slate-600 inline-flex items-center gap-1.5 cursor-pointer"
        >
          {showEmpty ? <EyeOff size={14} /> : <Eye size={14} />}
          {showEmpty ? 'Hide empty batches' : `${hiddenEmptyTotal} empty batch${hiddenEmptyTotal === 1 ? '' : 'es'} hidden · Show`}
        </button>
      )}

      {oversoldList.length > 0 && (
        <div className="space-y-2">
          <div className="text-[12px] font-bold uppercase tracking-wide text-rose-700">
            Oversold — needs attention ({oversoldList.length})
          </div>
          {oversoldList.map((item) => (
            <AuditOversoldCard
              key={item.product.id}
              item={item}
              isAdmin={isAdmin}
              oversoldChoice={oversoldChoice}
              setOversold={setOversold}
              onGoInventoryTab={onGoInventoryTab}
              setTab={setTab}
            />
          ))}
        </div>
      )}

      <div ref={listRef} className="flex flex-col gap-2.5">
        {cards.length === 0 ? (
          <div className="rounded-2xl border border-black/10 bg-white px-4 py-8 text-center text-sm text-slate-500">
            {q || filter !== 'all' ? 'No batches match.' : 'No stock lines for this godown.'}
          </div>
        ) : (
          cards
        )}
      </div>

      <div id="audit-finish" className="rounded-2xl border border-black/10 bg-white p-3 space-y-2">
        <div className="text-[13px] text-slate-600">
          {stats.counted} of {stats.total} batches counted
          {stats.differ > 0 ? ` · ${stats.differ} differ` : ''}.
        </div>
        <button
          type="button"
          onClick={() => setStep('review')}
          className="w-full h-12 rounded-xl bg-[var(--primary)] text-white text-[15px] font-bold cursor-pointer"
        >
          Review &amp; save
        </button>
      </div>
    </div>
  );
};
