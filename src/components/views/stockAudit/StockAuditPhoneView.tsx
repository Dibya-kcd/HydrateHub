import React from 'react';
import { ArrowLeft, Check, CheckCircle2, Search, X } from 'lucide-react';
import { PackIcon } from '../../common/PackIcon';
import type { Product, Warehouse } from '../../../types';
import {
  expiryClass,
  fmtExp,
  signed,
  type AuditReviewData,
  type AuditStats,
  type Draft,
  type OversoldItem,
  type OversoldState,
  type Row,
  type SavedAuditInfo,
  type Step,
} from './stockAuditTypes';

export interface StockAuditPhoneViewProps {
  step: Step;
  setStep: React.Dispatch<React.SetStateAction<Step>>;
  savedInfo: SavedAuditInfo | null;
  setSavedInfo: React.Dispatch<React.SetStateAction<SavedAuditInfo | null>>;
  whId: string;
  whName: (id: string) => string;
  warehouses: Warehouse[];
  stats: AuditStats;
  review: AuditReviewData;
  oversoldList: OversoldItem[];
  oversoldChoice: (pid: number) => OversoldState;
  counts: Record<string, string>;
  setCounts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  batchNotes: Record<string, string>;
  setBatchNotes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  nothingToSave: boolean;
  setSaveError: React.Dispatch<React.SetStateAction<string>>;
  saveError: string;
  note: string;
  setNote: React.Dispatch<React.SetStateAction<string>>;
  showPostSheet: boolean;
  setShowPostSheet: React.Dispatch<React.SetStateAction<boolean>>;
  postReason: string;
  setPostReason: React.Dispatch<React.SetStateAction<string>>;
  isAdmin: boolean;
  confirmSave: (explicitReason?: string) => void;
  pendingDraft: Draft | null;
  resumeDraft: () => void;
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  q: string;
  listRef: React.RefObject<HTMLDivElement | null>;
  productRows: { product: Product; rows: Row[] }[];
  rowVisible: (product: Product, r: Row) => boolean;
  markProductMatch: (rows: Row[]) => void;
  num: (key: string) => number | null;
  setCount: (key: string, value: string) => void;
  focusNext: (el: HTMLInputElement) => void;
  markMatch: (r: Row) => void;
  hiddenEmptyTotal: number;
  showEmpty: boolean;
  setShowEmpty: React.Dispatch<React.SetStateAction<boolean>>;
  setOpenEmpty: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
}

export const StockAuditPhoneView: React.FC<StockAuditPhoneViewProps> = ({
  step,
  setStep,
  savedInfo,
  setSavedInfo,
  whId,
  whName,
  warehouses,
  stats,
  review,
  oversoldList,
  oversoldChoice,
  counts,
  setCounts,
  batchNotes,
  setBatchNotes,
  nothingToSave,
  setSaveError,
  saveError,
  note,
  setNote,
  showPostSheet,
  setShowPostSheet,
  postReason,
  setPostReason,
  isAdmin,
  confirmSave,
  pendingDraft,
  resumeDraft,
  search,
  setSearch,
  q,
  listRef,
  productRows,
  rowVisible,
  markProductMatch,
  num,
  setCount,
  focusNext,
  markMatch,
  hiddenEmptyTotal,
  showEmpty,
  setShowEmpty,
  setOpenEmpty,
}) => {
  // ── PHONE: Done confirmation ─────────────────────────────────────────────────────────────
  if (step === 'done' && savedInfo) {
    return (
      <div className="space-y-3 hh-inv-pb">
        <div className="hh-inv-card hh-inv-card--alert-blue space-y-2.5">
          <div className="flex items-center gap-2 text-[#101D3A] font-extrabold text-[15px]">
            <CheckCircle2 size={18} className="text-[#16A34A] shrink-0" />
            <span>Audit #{savedInfo.id} posted</span>
          </div>
          <p className="text-[13px] text-slate-600 leading-relaxed">
            {savedInfo.counted} batch{savedInfo.counted === 1 ? '' : 'es'} counted ·{' '}
            {savedInfo.differ === 0
              ? 'every counted batch matched the system'
              : `${savedInfo.differ} differ (${signed(savedInfo.net)} cs net)`}
            . Live stock for {whName(whId)} has been updated.
          </p>
          <button
            type="button"
            onClick={() => {
              setSavedInfo(null);
              setStep('count');
            }}
            className="hh-inv-btn-primary w-full"
          >
            Start another count
          </button>
        </div>
      </div>
    );
  }

  // ── PHONE: Differences Review & Post Sheet (Full-screen overlay) ─────────────────────────
  if (step === 'review') {
    return (
      <div className="rt-flow-phone">
        <div className="hh-sales-top hh-sales-top--flush hh-inv-top hh-inv-top--flow">
          <div className="hh-sales-top__row">
            <button
              type="button"
              onClick={() => setStep('count')}
              className="hh-inv-backbtn"
            >
              <ArrowLeft size={20} strokeWidth={2.3} />
              <span>Differences</span>
            </button>
            {stats.differ > 0 && (
              <span className="hh-inv-danger-pill">{stats.differ} differ</span>
            )}
          </div>
        </div>

        <div className="rt-flow-phone__body space-y-2.5" style={{ paddingBottom: '120px' }}>
          {review.diffs.length === 0 ? (
            <div className="hh-inv-card text-center py-6 space-y-1.5">
              <div className="text-[14px] font-extrabold text-[#16A34A]">
                Every counted batch matches the system.
              </div>
              <p className="text-[12px] text-slate-500">
                {stats.counted} batch{stats.counted === 1 ? '' : 'es'} verified in {whName(whId)}.
              </p>
            </div>
          ) : (
            review.diffs.map(({ product, rows }) =>
              rows.map(({ r, c }) => {
                const d = c - r.systemQty;
                return (
                  <div key={r.key} className="hh-inv-card space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 text-[14px] font-extrabold text-[#101D3A] leading-snug">
                        {product.name}
                        {!r.noBatch ? ` · ${r.batchNumber}` : ' · No batch'}
                      </div>
                      <span
                        className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-extrabold tabular-nums ${
                          d < 0 ? 'bg-rose-50 text-[#DC2626]' : 'bg-amber-50 text-amber-800'
                        }`}
                      >
                        {signed(d)} cs
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-0.5">
                      <div>
                        <div className="text-xs text-slate-500 font-semibold">System</div>
                        <div className="text-[16px] font-extrabold text-[#101D3A] tabular-nums mt-0.5">
                          {r.systemQty}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 font-semibold">Counted</div>
                        <div className="text-[16px] font-extrabold text-[#101D3A] tabular-nums mt-0.5">
                          {c}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 font-semibold">Diff</div>
                        <div
                          className={`text-[16px] font-extrabold tabular-nums mt-0.5 ${
                            d < 0 ? 'text-[#DC2626]' : 'text-amber-700'
                          }`}
                        >
                          {signed(d)}
                        </div>
                      </div>
                    </div>

                    <input
                      type="text"
                      value={batchNotes[r.key] ?? ''}
                      onChange={(e) =>
                        setBatchNotes((prev) => ({ ...prev, [r.key]: e.target.value }))
                      }
                      placeholder="Note (optional)"
                      className="w-full text-[12px] text-slate-700 placeholder:text-slate-400 bg-transparent border-0 border-t border-slate-100 pt-2 focus:outline-none"
                    />
                  </div>
                );
              })
            )
          )}

          {oversoldList.length > 0 && (
            <div className="hh-inv-card hh-inv-card--alert-amber space-y-1.5" style={{ background: '#FFFBEB' }}>
              <div className="text-[13px] font-bold text-amber-950">
                Oversold products ({oversoldList.length}): fix these first from the Stock tab.
              </div>
              {oversoldList.map((o) => {
                const st = oversoldChoice(o.product.id);
                return (
                  <div key={o.product.id} className="text-xs text-amber-900 flex justify-between gap-2">
                    <span>{o.product.name} ({o.raw} cs)</span>
                    <span className="font-bold">
                      {st.choice === 'fix' ? 'Fix on Stock tab' : st.choice === 'open' ? 'Under investigation' : `Adjust +${Math.abs(o.raw)}`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {review.uncounted.length > 0 && (
            <div className="hh-inv-card hh-inv-card--alert-amber space-y-2">
              <div className="text-[12.5px] font-bold text-slate-900">
                {review.uncounted.length} batch{review.uncounted.length === 1 ? '' : 'es'} with stock not counted
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setStep('count')}
                  className="px-3 py-1.5 rounded-full border border-slate-300 bg-white text-[12px] font-bold text-slate-700"
                >
                  Go count
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
                  className="px-3 py-1.5 rounded-full border border-emerald-300 bg-emerald-50 text-[12px] font-bold text-emerald-800"
                >
                  Mark all matching
                </button>
              </div>
            </div>
          )}

          {review.matches.length > 0 && review.diffs.length > 0 && (
            <details className="hh-inv-card text-[12px] text-slate-600">
              <summary className="cursor-pointer font-bold text-slate-700">
                {review.matches.length} batch{review.matches.length === 1 ? '' : 'es'} match system
              </summary>
              <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2">
                {review.matches.map(({ product, r, c }) => (
                  <li key={r.key} className="flex justify-between gap-2">
                    <span className="truncate">{product.name}{!r.noBatch ? ` · ${r.batchNumber}` : ''}</span>
                    <span className="font-bold tabular-nums">{c} cs</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>

        <div className="rt-flow-phone__footer flex gap-2.5">
          <button
            type="button"
            onClick={() => setStep('count')}
            className="hh-inv-btn-outline flex-1"
          >
            Save count
          </button>
          <button
            type="button"
            disabled={nothingToSave}
            onClick={() => {
              setSaveError('');
              setPostReason((prev) => prev || note);
              setShowPostSheet(true);
            }}
            className="hh-inv-btn-primary flex-1"
          >
            Post adjustment
          </button>
        </div>

        {showPostSheet && (
          <div
            className="rt-bsheet-scrim"
            role="presentation"
            onClick={() => setShowPostSheet(false)}
          >
            <div
              className="rt-bsheet"
              role="dialog"
              aria-modal="true"
              aria-label="Post adjustment"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="hh-grab" />
              <div className="space-y-3 pb-1">
                <div>
                  <h3 className="text-[18px] font-extrabold text-[#101D3A] leading-tight">
                    Post adjustment
                  </h3>
                  <p className="text-[12.5px] text-slate-500 mt-0.5">
                    Stock will change by {signed(stats.net)} cs in {whName(whId)} godown
                  </p>
                </div>

                <div className="rounded-xl border-2 border-[#2864D9] bg-white px-3.5 py-2.5">
                  <div className="text-[14px] font-extrabold text-[#101D3A]">
                    Post adjustment {signed(stats.net)} cs
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Owner only · needs a reason
                  </div>
                </div>

                {!isAdmin && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-900">
                    Owner login required to post stock adjustments.
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[12px] font-bold text-[#101D3A] block">
                    Reason {stats.differ > 0 ? '(required)' : '(optional)'}
                  </label>
                  <textarea
                    rows={2}
                    value={postReason}
                    onChange={(e) => {
                      setPostReason(e.target.value);
                      setNote(e.target.value);
                    }}
                    placeholder="Breakage found during count..."
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-[13px] font-semibold text-[#101D3A] focus:outline-none focus:border-[#2864D9]"
                  />
                </div>

                {saveError && (
                  <div className="text-[12px] font-bold text-[#DC2626]" role="alert">
                    {saveError}
                  </div>
                )}

                <div className="flex gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowPostSheet(false)}
                    className="hh-inv-btn-outline flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => confirmSave(postReason)}
                    className="hh-inv-btn-primary flex-1"
                  >
                    Post
                  </button>
                </div>

                <p className="text-center text-xs text-slate-500">
                  If everything matches: &ldquo;Every counted batch matches the system.&rdquo;
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── PHONE: Audit Count Screen ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-2.5 w-full hh-inv-pb">
      {pendingDraft && (
        <div className="hh-inv-card hh-inv-card--alert-amber flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[13.5px] font-extrabold text-[#101D3A]">
              Unfinished count found
            </div>
            <div className="text-xs text-slate-500 mt-0.5 truncate">
              {whName(pendingDraft.whId)} · {Object.values(pendingDraft.counts).filter((v) => v !== '').length} batches counted ·{' '}
              {new Date(pendingDraft.savedAt).toLocaleString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>
          <button
            type="button"
            onClick={resumeDraft}
            className="shrink-0 text-[13px] font-extrabold text-[#2864D9] px-2 py-1.5 cursor-pointer"
          >
            Resume
          </button>
        </div>
      )}

      <div className="hh-inv-card grid grid-cols-3 gap-2">
        <div>
          <div className="text-xs font-semibold text-slate-500">Counted</div>
          <div className="text-[19px] font-extrabold text-[#101D3A] tabular-nums mt-0.5">
            {stats.counted}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-500">Differ</div>
          <div
            className={`text-[19px] font-extrabold tabular-nums mt-0.5 ${
              stats.differ > 0 ? 'text-[#DC2626]' : 'text-[#101D3A]'
            }`}
          >
            {stats.differ}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-500">Net cs</div>
          <div
            className={`text-[19px] font-extrabold tabular-nums mt-0.5 ${
              stats.net < 0 ? 'text-[#DC2626]' : stats.net > 0 ? 'text-amber-700' : 'text-[#101D3A]'
            }`}
          >
            {signed(stats.net)}
          </div>
        </div>
      </div>

      <div className="rt-search-bar">
        <Search size={16} className="text-slate-400 shrink-0" />
        <input
          type="search"
          enterKeyHint="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search product or batch"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            aria-label="Clear search"
            className="text-slate-400 p-1"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {oversoldList.length > 0 && (
        <div className="hh-inv-card hh-inv-card--alert-red flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[13px] font-extrabold text-[#DC2626]">
              {oversoldList.length} oversold in {whName(whId)}
            </div>
            <div className="text-xs text-slate-500">
              Book balance below zero before counting
            </div>
          </div>
        </div>
      )}

      <div ref={listRef} className="flex flex-col gap-2.5">
        {warehouses.length === 0 ? (
          <div className="hh-inv-card text-center py-6 text-[13px] text-slate-500">
            Add a godown first in Settings → Godowns.
          </div>
        ) : (
          (() => {
            const phoneCards = productRows
              .map(({ product, rows }) => {
                const visible = rows.filter((r) => rowVisible(product, r));
                if (visible.length === 0) return null;
                return (
                  <div key={product.id} className="hh-inv-card space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <PackIcon size="sm" pack={product.pack} name={product.name} />
                        <span className="text-[14.5px] font-extrabold text-[#101D3A] truncate">
                          {product.name}
                        </span>
                      </div>
                      {visible.length > 1 && (
                        <button
                          type="button"
                          onClick={() => markProductMatch(visible)}
                          className="shrink-0 text-xs font-bold text-[#2864D9] px-2 py-1 rounded-full bg-blue-50 cursor-pointer"
                        >
                          All match
                        </button>
                      )}
                    </div>

                    <div className="divide-y divide-dashed divide-slate-200">
                      {visible.map((r, idx) => {
                        const c = num(r.key);
                        const diff = c === null ? null : c - r.systemQty;
                        return (
                          <div
                            key={r.key}
                            className={`flex items-center justify-between gap-2.5 ${
                              idx > 0 ? 'pt-2.5 mt-2.5' : 'pt-0.5'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-[13px] text-slate-700 leading-snug">
                                <strong className="font-extrabold text-[#101D3A]">
                                  {r.noBatch ? 'Book' : r.batchNumber || '—'}
                                </strong>{' '}
                                <span className="text-slate-500 font-medium">
                                  · system {r.systemQty} cs
                                </span>
                              </div>
                              {!r.noBatch && r.expiryDate && (
                                <div className={`text-xs mt-0.5 ${expiryClass(r.expiryStatus)}`}>
                                  {r.expiryStatus === 'expired' ? 'EXPIRED · ' : 'Exp '}
                                  {fmtExp(r.expiryDate)}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
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
                                className={`w-[74px] h-[42px] rounded-xl border-2 text-center text-[15px] font-extrabold tabular-nums focus:outline-none ${
                                  diff === null
                                    ? 'border-slate-300 bg-white text-[#101D3A]'
                                    : diff === 0
                                      ? 'border-[#16A34A] bg-white text-[#15803D]'
                                      : 'border-[#DC2626] bg-white text-[#DC2626]'
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() => markMatch(r)}
                                aria-label="Matches system"
                                title="Matches system"
                                className={`w-9 h-[42px] rounded-xl border flex items-center justify-center cursor-pointer ${
                                  diff === 0
                                    ? 'border-[#16A34A] bg-emerald-50 text-[#16A34A]'
                                    : 'border-slate-200 bg-slate-50 text-slate-500'
                                }`}
                              >
                                <Check size={16} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
              .filter(Boolean);

            if (phoneCards.length === 0) {
              return (
                <div className="hh-inv-card text-center py-6 text-[13px] text-slate-500">
                  {q ? 'No batches match your search.' : `No stock lines in ${whName(whId)}.`}
                </div>
              );
            }
            return phoneCards;
          })()
        )}
      </div>

      {(hiddenEmptyTotal > 0 || showEmpty) && (
        <button
          type="button"
          onClick={() => {
            setShowEmpty((v) => !v);
            setOpenEmpty({});
          }}
          className="self-center text-[12px] font-bold text-[#2864D9] py-1 cursor-pointer"
        >
          {showEmpty
            ? 'Hide empty batches'
            : `Show ${hiddenEmptyTotal} empty batch${hiddenEmptyTotal === 1 ? '' : 'es'}`}
        </button>
      )}

      <div className="hh-inv-cta-dock">
        <button
          type="button"
          onClick={() => setStep('review')}
          className="hh-inv-btn-primary w-full"
        >
          Review differences{stats.counted > 0 ? ` (${stats.counted})` : ''}
        </button>
      </div>
    </div>
  );
};
