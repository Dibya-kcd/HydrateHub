import React from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Minus,
  Plus,
  X,
} from 'lucide-react';
import { SizeChip } from '../../common/SizeChip';
import { PackIcon } from '../../common/PackIcon';
import { OVERSOLD_REASONS } from '../../../utils/oversoldDiagnostic';
import type { Product, TabId } from '../../../types';
import {
  expiryClass,
  fmtExp,
  signed,
  type OversoldChoice,
  type OversoldItem,
  type OversoldState,
  type Row,
} from './stockAuditTypes';

interface AuditRowControlsProps {
  r: Row;
  counts: Record<string, string>;
  num: (key: string) => number | null;
  stepCount: (r: Row, delta: number) => void;
  setCount: (key: string, value: string) => void;
  focusNext: (el: HTMLInputElement) => void;
  markMatch: (r: Row) => void;
}

export const AuditRowControls: React.FC<AuditRowControlsProps> = ({
  r,
  counts,
  num,
  stepCount,
  setCount,
  focusNext,
  markMatch,
}) => {
  const c = num(r.key);
  const diff = c === null ? null : c - r.systemQty;
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <button
        type="button"
        onClick={() => stepCount(r, -1)}
        aria-label="Decrease count"
        className="w-10 h-11 rounded-xl border border-slate-300 bg-white text-slate-700 flex items-center justify-center active:bg-slate-100 cursor-pointer"
      >
        <Minus size={16} />
      </button>
      <input
        data-audit-input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        enterKeyHint="next"
        value={counts[r.key] ?? ''}
        placeholder="—"
        aria-label={`Counted quantity, batch ${r.batchNumber || 'none'}`}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setCount(r.key, e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            focusNext(e.currentTarget);
          }
        }}
        className={`w-14 h-11 rounded-xl border-2 text-center text-base font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 ${
          diff === null
            ? 'border-slate-300 bg-white text-slate-900'
            : diff === 0
              ? 'border-emerald-400 bg-white text-emerald-700'
              : diff > 0
                ? 'border-amber-400 bg-white text-amber-700'
                : 'border-rose-400 bg-white text-rose-700'
        }`}
      />
      <button
        type="button"
        onClick={() => stepCount(r, 1)}
        aria-label="Increase count"
        className="w-10 h-11 rounded-xl border border-slate-300 bg-white text-slate-700 flex items-center justify-center active:bg-slate-100 cursor-pointer"
      >
        <Plus size={16} />
      </button>
      <button
        type="button"
        onClick={() => markMatch(r)}
        aria-label="Count matches the system"
        title="Matches the system"
        className="w-10 h-11 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-700 flex items-center justify-center active:bg-emerald-100 cursor-pointer"
      >
        <Check size={18} />
      </button>
    </div>
  );
};

interface AuditBatchRowProps {
  r: Row;
  title?: React.ReactNode;
  counts: Record<string, string>;
  num: (key: string) => number | null;
  stepCount: (r: Row, delta: number) => void;
  setCount: (key: string, value: string) => void;
  focusNext: (el: HTMLInputElement) => void;
  markMatch: (r: Row) => void;
  removeFound: (key: string) => void;
}

export const AuditBatchRow: React.FC<AuditBatchRowProps> = ({
  r,
  title,
  counts,
  num,
  stepCount,
  setCount,
  focusNext,
  markMatch,
  removeFound,
}) => {
  const c = num(r.key);
  const diff = c === null ? null : c - r.systemQty;
  const tint =
    diff === null ? '' : diff === 0 ? 'bg-emerald-50/60' : diff > 0 ? 'bg-amber-50/70' : 'bg-rose-50/70';
  return (
    <div key={r.key} className={`px-3 py-2.5 ${tint}`}>
      {title}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 leading-tight">
          <div className="text-[13px] font-semibold text-slate-900 break-all">
            {r.noBatch ? 'No batch · book stock' : `Batch ${r.batchNumber || '—'}`}
            {r.isFound && (
              <span className="ml-1.5 text-xs font-bold uppercase text-sky-700 bg-sky-50 border border-sky-200 rounded px-1 py-0.5">
                Found
              </span>
            )}
          </div>
          {!r.noBatch && (
            <div className={`text-xs mt-0.5 ${expiryClass(r.expiryStatus)}`}>
              {r.expiryStatus === 'expired' ? 'EXPIRED · ' : 'Exp '}
              {fmtExp(r.expiryDate)}
            </div>
          )}
          <div className="text-xs text-slate-500 mt-0.5">
            System <span className="font-bold text-slate-800 tabular-nums">{r.systemQty}</span>
            {diff !== null && diff !== 0 && (
              <span className={`ml-1.5 font-bold tabular-nums ${diff > 0 ? 'text-amber-700' : 'text-rose-700'}`}>
                {signed(diff)}
              </span>
            )}
            {diff === 0 && <span className="ml-1.5 font-bold text-emerald-700">✓</span>}
          </div>
        </div>
        <AuditRowControls
          r={r}
          counts={counts}
          num={num}
          stepCount={stepCount}
          setCount={setCount}
          focusNext={focusNext}
          markMatch={markMatch}
        />
      </div>
      {r.isFound && (
        <button
          type="button"
          onClick={() => removeFound(r.key)}
          className="mt-1 text-xs font-semibold text-slate-500 underline cursor-pointer inline-flex items-center gap-1"
        >
          <X size={11} /> Remove this found batch
        </button>
      )}
    </div>
  );
};

interface AuditProductCardProps {
  product: Product;
  rows: Row[];
  counts: Record<string, string>;
  num: (key: string) => number | null;
  rowVisible: (product: Product, r: Row) => boolean;
  isEmptyRow: (r: Row) => boolean;
  showEmpty: boolean;
  q: string;
  openEmpty: Record<number, boolean>;
  setOpenEmpty: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
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

export const AuditProductCard: React.FC<AuditProductCardProps> = ({
  product,
  rows,
  counts,
  num,
  rowVisible,
  isEmptyRow,
  showEmpty,
  q,
  openEmpty,
  setOpenEmpty,
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
  const visible = rows.filter((r) => rowVisible(product, r));
  if (visible.length === 0) return null;
  const emptyHere = rows.filter((r) => isEmptyRow(r)).length;
  const emptyHidden = !showEmpty && !q && !openEmpty[product.id] ? emptyHere : 0;
  const multi = visible.length > 1;
  const isCollapsed = multi && collapsed[product.id];
  const sysTotal = rows.reduce((s, r) => s + Math.max(0, r.systemQty), 0);
  const doneCount = rows.filter((r) => num(r.key) !== null).length;
  const titleNode = (
    <div className="flex items-start gap-2 mb-1.5">
      <PackIcon size="sm" pack={product.pack} name={product.name} className="mt-0.5" />
      <div className="min-w-0 flex-1 text-[14px] font-bold text-slate-900 leading-snug break-words">
        {product.name} <SizeChip volume={product.volume} pack={product.pack} name={product.name} />
        {oversoldIds.has(product.id) && (
          <span className="ml-1.5 text-xs font-bold uppercase text-rose-700 bg-rose-50 border border-rose-200 rounded px-1 py-0.5">
            Oversold
          </span>
        )}
      </div>
    </div>
  );
  return (
    <div
      data-card-tone={
        oversoldIds.has(product.id)
          ? 'due'
          : doneCount > 0
            ? 'received'
            : 'sales'
      }
      className="rounded-2xl border shadow-sm overflow-hidden"
    >
      {multi ? (
        <div className="px-3 pt-2.5 pb-2 flex items-start gap-2">
          <button
            type="button"
            onClick={() => setCollapsed((p) => ({ ...p, [product.id]: !p[product.id] }))}
            className="flex-1 min-w-0 text-left cursor-pointer"
            aria-expanded={!isCollapsed}
          >
            <div className="flex items-start gap-1.5">
              {isCollapsed ? <ChevronRight size={18} className="mt-0.5 shrink-0" /> : <ChevronDown size={18} className="mt-0.5 shrink-0" />}
              <div className="min-w-0 flex-1">{titleNode}</div>
            </div>
            <div className="pl-6 -mt-1 text-xs text-slate-500">
              {visible.length} batches · System {sysTotal} cs · {doneCount} counted
            </div>
          </button>
          <button
            type="button"
            onClick={() => markProductMatch(visible)}
            className="shrink-0 h-9 px-2.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-700 text-[12px] font-bold inline-flex items-center gap-1 cursor-pointer"
          >
            <Check size={14} /> All match
          </button>
        </div>
      ) : null}
      {!isCollapsed && (
        <div className="divide-y divide-black/5">
          {multi
            ? visible.map((r) => (
                <AuditBatchRow
                  key={r.key}
                  r={r}
                  counts={counts}
                  num={num}
                  stepCount={stepCount}
                  setCount={setCount}
                  focusNext={focusNext}
                  markMatch={markMatch}
                  removeFound={removeFound}
                />
              ))
            : (
                <AuditBatchRow
                  key={visible[0].key}
                  r={visible[0]}
                  title={<div className="pt-0.5">{titleNode}</div>}
                  counts={counts}
                  num={num}
                  stepCount={stepCount}
                  setCount={setCount}
                  focusNext={focusNext}
                  markMatch={markMatch}
                  removeFound={removeFound}
                />
              )}
        </div>
      )}
      <div className="px-3 py-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-black/5 bg-slate-50/60">
        {emptyHidden > 0 && (
          <button
            type="button"
            onClick={() => setOpenEmpty((p) => ({ ...p, [product.id]: true }))}
            className="text-xs font-semibold text-slate-500 underline cursor-pointer"
          >
            +{emptyHidden} empty batch{emptyHidden === 1 ? '' : 'es'}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setFoundFormFor(foundFormFor === product.id ? null : product.id);
            setFfBatch('');
            setFfExp('');
            setFfError('');
          }}
          className="text-xs font-semibold text-sky-700 underline cursor-pointer"
        >
          + Found stock (new batch)
        </button>
      </div>
      {foundFormFor === product.id && (
        <div className="px-3 py-2.5 border-t border-black/5 bg-sky-50/50 space-y-2">
          <div className="text-[12px] text-slate-600">
            Crates on the shelf that match no batch above. Type the batch and expiry printed on the crate, then count them.
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={ffBatch}
              onChange={(e) => setFfBatch(e.target.value)}
              placeholder="Batch no."
              className="h-11 px-3 rounded-xl border border-slate-300 bg-white text-sm"
            />
            <input
              type="date"
              value={ffExp}
              onChange={(e) => setFfExp(e.target.value)}
              aria-label="Expiry date"
              className="h-11 px-3 rounded-xl border border-slate-300 bg-white text-sm"
            />
          </div>
          {ffError && <div className="text-[12px] font-semibold text-rose-700">{ffError}</div>}
          <button
            type="button"
            onClick={() => addFoundBatch(product.id)}
            className="h-10 px-4 rounded-xl bg-[var(--primary)] text-white text-sm font-semibold cursor-pointer"
          >
            Add batch to count
          </button>
        </div>
      )}
    </div>
  );
};

interface AuditOversoldCardProps {
  item: OversoldItem;
  isAdmin: boolean;
  oversoldChoice: (pid: number) => OversoldState;
  setOversold: React.Dispatch<React.SetStateAction<Record<number, OversoldState>>>;
  onGoInventoryTab?: (tab: 'consignments' | 'transfers') => void;
  setTab: (tab: TabId) => void;
}

export const AuditOversoldCard: React.FC<AuditOversoldCardProps> = ({
  item: o,
  isAdmin,
  oversoldChoice,
  setOversold,
  onGoInventoryTab,
  setTab,
}) => {
  const st = oversoldChoice(o.product.id);
  const setSt = (patch: Partial<OversoldState>) =>
    setOversold((p) => ({ ...p, [o.product.id]: { ...oversoldChoice(o.product.id), ...patch } }));
  const choices: { id: OversoldChoice; label: string; sub: string }[] = [
    { id: 'fix', label: 'Fix the cause first', sub: 'Nothing is saved for this product' },
    { id: 'open', label: 'Under investigation', sub: 'Recorded, stock unchanged' },
    { id: 'adjust', label: `Post adjustment +${Math.abs(o.raw)}`, sub: isAdmin ? 'Owner only · needs a reason' : 'Owner login only' },
  ];
  return (
    <div data-card-tone="due" className="rounded-2xl border p-3.5 space-y-2.5 shadow-sm">
      <div className="flex items-start gap-2">
        <AlertTriangle size={18} className="text-rose-600 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <div className="text-[14px] font-bold text-slate-900 break-words">{o.product.name}</div>
          <div className="text-[12px] text-rose-700 font-semibold">
            Book balance here is {o.raw} cs — more was sold than received.
          </div>
          {o.others.length > 0 && (
            <div className="text-[12px] text-slate-600 mt-0.5">
              Other godowns hold: {o.others.map((x) => `${x.name} ${x.qty} cs`).join(', ')}. Check the godown on recent bills.
            </div>
          )}
        </div>
      </div>
      <div className="grid gap-1.5">
        {choices.map((c) => {
          const disabled = c.id === 'adjust' && !isAdmin;
          const on = st.choice === c.id;
          return (
            <button
              key={c.id}
              type="button"
              disabled={disabled}
              onClick={() => setSt({ choice: c.id })}
              className={`text-left rounded-xl border px-3 py-2 min-h-[44px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                on ? 'border-[var(--primary)] bg-white ring-2 ring-[var(--primary)]/20' : 'border-slate-300 bg-white'
              }`}
            >
              <div className="text-[13px] font-semibold text-slate-900">{c.label}</div>
              <div className="text-xs text-slate-500">{c.sub}</div>
            </button>
          );
        })}
      </div>
      {st.choice === 'fix' && onGoInventoryTab && (
        <div className="flex flex-wrap gap-2 text-[12px] font-semibold">
          <button type="button" onClick={() => onGoInventoryTab('transfers')} className="underline text-sky-700 cursor-pointer">
            Godown transfer
          </button>
          <button type="button" onClick={() => onGoInventoryTab('consignments')} className="underline text-sky-700 cursor-pointer">
            Stock receipts
          </button>
          <button type="button" onClick={() => setTab('billing')} className="underline text-sky-700 cursor-pointer">
            Bills
          </button>
          <span className="text-slate-400">· your count is kept as a draft</span>
        </div>
      )}
      {st.choice === 'adjust' && (
        <select
          value={st.reason}
          onChange={(e) => setSt({ reason: e.target.value })}
          aria-label="Reason for the adjustment"
          className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-sm"
        >
          <option value="">Choose the reason…</option>
          {OVERSOLD_REASONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      )}
    </div>
  );
};
