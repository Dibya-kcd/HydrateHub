import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Product, Trip, TripShortageReason } from '../../../types';
import { PackIcon } from '../../common/PackIcon';
import { SizeChip } from '../../common/SizeChip';
import { OdiaName } from '../../common/OdiaName';
import { FlowMetric, FlowStepper } from '../../common/FlowKit';
import {
  inr,
  inputCls,
  PLAIN_REASONS,
  REASON_LABEL,
  REASON_STOCK_NOTE,
  ReturnMoneySummary,
  ReturnStockRow,
} from './tripReturnDraft';

const cardShape = 'min-w-0 rounded-[var(--r-card)] shadow-[var(--shadow)]';
const card = `${cardShape} bg-white border border-[var(--border)] p-4`;

interface TripReturnDesktopStep1Props {
  closed: boolean;
  counted: boolean;
  setCounted: (v: boolean) => void;
  rows: ReturnStockRow[];
  products: Product[];
  good: Record<number, string>;
  setGood: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  damaged: Record<number, string>;
  setDamaged: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  reasons: Record<number, { reason: TripShortageReason | ''; note: string }>;
  setReasons: React.Dispatch<React.SetStateAction<Record<number, { reason: TripShortageReason | ''; note: string }>>>;
  totals: { loaded: number; sold: number; good: number; damaged: number };
  nameOf: (pid: number) => string;
}

export const TripReturnDesktopStep1: React.FC<TripReturnDesktopStep1Props> = ({
  closed,
  counted,
  setCounted,
  rows,
  products,
  good,
  setGood,
  damaged,
  setDamaged,
  reasons,
  setReasons,
  totals,
  nameOf,
}) => (
  <div className="space-y-3">
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <FlowMetric label="Loaded" value={totals.loaded} />
      <FlowMetric label="Sold" value={totals.sold} tone="good" />
      <FlowMetric label="Good" value={totals.good} tone="good" />
      <FlowMetric label="Damaged" value={totals.damaged} tone={totals.damaged ? 'bad' : 'ink'} />
    </div>
    {!closed && rows.some((r) => r.expected > 0) && (
      <label
        id="close-counted-check"
        className={`${cardShape} sticky top-0 z-10 flex items-start gap-3 border p-3 min-h-[44px] cursor-pointer text-[13px] ${
          counted ? 'border-[var(--border)] bg-white text-slate-700' : 'border-amber-300 bg-amber-50 text-amber-900'
        }`}
      >
        <input
          type="checkbox"
          checked={counted}
          onChange={(e) => setCounted(e.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-[var(--flow-accent)]"
        />
        <span className="min-w-0">
          <strong className="block">I counted the crates in the van</strong>
          {counted
            ? 'The counts below are confirmed.'
            : 'The counts below start as “everything came back”. Tick this if they are right, or change a count.'}
        </span>
      </label>
    )}
    {rows.length === 0 && (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white py-10 text-center text-sm text-gray-500">
        Nothing was loaded on this trip.
      </div>
    )}
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 items-start">
      {rows.map((r) => {
        const p = products.find((x) => x.id === r.pid);
        const bad = r.diff !== 0;
        const why = reasons[r.pid] || { reason: '' as const, note: '' };
        return (
          <div
            key={r.pid}
            id={`close-row-${r.pid}`}
            className={`${cardShape} p-3 space-y-3 border ${
              bad ? 'border-red-400 ring-1 ring-red-400 bg-red-50' : 'border-[var(--border)] bg-white'
            }`}
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <PackIcon size="sm" pack={p?.pack} name={p?.name} className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-bold text-slate-900 leading-snug break-words">
                  {p ? <OdiaName name={p.name} nameOr={p.nameOr} /> : nameOf(r.pid)}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <SizeChip volume={p?.volume} name={p?.name} pack={p?.pack} />
                  {p?.unitsPerCrate ? (
                    <span className="text-xs font-bold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">{p.unitsPerCrate} pcs/cs</span>
                  ) : null}
                </div>
              </div>
            </div>

            {bad && (
              <div className="flex items-center gap-1.5 rounded-lg bg-red-100 px-2.5 py-1.5 text-xs font-black text-red-700">
                <AlertTriangle size={14} className="shrink-0" />
                <span className="min-w-0">
                  Stock variance: {Math.abs(r.diff)} {Math.abs(r.diff) === 1 ? 'case' : 'cases'}
                </span>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <FlowMetric label="Loaded" value={r.loaded} />
              <FlowMetric label="Sold" value={r.sold} tone="good" />
              <FlowMetric label="Due back" value={r.expected} />
            </div>

            {/* Phones narrower than 400px stack the two counters, so each keeps full-size buttons. */}
            <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
              <FlowStepper
                label="Good to godown"
                name={nameOf(r.pid)}
                value={good[r.pid] ?? '0'}
                disabled={closed}
                onChange={(v) => {
                  setCounted(true);
                  setGood((s) => ({ ...s, [r.pid]: v }));
                }}
              />
              <FlowStepper
                label="Damaged / leakage"
                name={nameOf(r.pid)}
                value={damaged[r.pid] ?? '0'}
                disabled={closed}
                onChange={(v) => {
                  setCounted(true);
                  setDamaged((s) => ({ ...s, [r.pid]: v }));
                }}
              />
            </div>

            {!closed && r.diff > 0 && (
              <div className="space-y-2 border-t border-red-200 pt-2.5">
                <div className="text-xs font-bold text-red-700">
                  {r.diff} {r.diff === 1 ? 'case is' : 'cases are'} missing{r.d > 0 ? ` (besides the ${r.d} damaged)` : ''}. Why?
                </div>
                <div className="flex flex-wrap gap-2">
                  {PLAIN_REASONS.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setReasons((s) => ({ ...s, [r.pid]: { reason: o.id, note: s[r.pid]?.note || '' } }))}
                      aria-pressed={why.reason === o.id}
                      className={`min-h-[44px] max-w-full px-3 rounded-full border text-xs font-bold cursor-pointer ${
                        why.reason === o.id
                          ? 'bg-[var(--flow-accent)] text-white border-[var(--flow-accent)]'
                          : 'bg-white text-slate-700 border-gray-300'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setDamaged((s) => ({ ...s, [r.pid]: String(r.d + r.diff) }))}
                    className="min-h-[44px] max-w-full px-3 rounded-full border border-red-300 bg-white text-red-700 text-xs font-bold cursor-pointer"
                  >
                    Mark {r.diff} as damaged
                  </button>
                </div>
                {why.reason && REASON_STOCK_NOTE[why.reason] && (
                  <p className="text-xs text-slate-600">{REASON_STOCK_NOTE[why.reason]}</p>
                )}
                {why.reason === 'other' && (
                  <input
                    value={why.note}
                    onChange={(e) => setReasons((s) => ({ ...s, [r.pid]: { reason: 'other', note: e.target.value } }))}
                    placeholder="Short note"
                    className={`${inputCls} text-sm`}
                  />
                )}
              </div>
            )}
            {r.diff < 0 && <p className="text-xs font-bold text-red-700">Good + damaged is {-r.diff} more than expected.</p>}
            {closed && r.diff > 0 && reasons[r.pid]?.reason && (
              <p className="text-xs font-bold text-red-700 break-words">
                Reason recorded: {REASON_LABEL[reasons[r.pid].reason as string] || reasons[r.pid].reason}
                {reasons[r.pid].note ? ` — ${reasons[r.pid].note}` : ''}
              </p>
            )}
          </div>
        );
      })}
    </div>
  </div>
);

interface TripReturnDesktopStep2Props {
  trip: Trip;
  closed: boolean;
  salesman: string;
  money: ReturnMoneySummary;
  expenseText: string;
  setExpenseText: (v: string) => void;
  netExpected: number;
  actualText: string;
  setActualText: (v: string) => void;
  hasActual: boolean;
  diff: number;
  remarks: string;
  setRemarks: (v: string) => void;
  bookShort: boolean;
  setBookShort: (v: boolean) => void;
}

const row = (label: string, value: string, tone = 'text-slate-700') => (
  <div className="flex items-baseline justify-between gap-3 text-sm">
    <span className="min-w-0 text-slate-600">{label}</span>
    <span className={`shrink-0 font-bold tabular-nums ${tone}`}>{value}</span>
  </div>
);

const fieldLabelCls = 'block mb-1 text-xs font-bold text-slate-600';

export const TripReturnDesktopStep2: React.FC<TripReturnDesktopStep2Props> = ({
  trip,
  closed,
  salesman,
  money,
  expenseText,
  setExpenseText,
  netExpected,
  actualText,
  setActualText,
  hasActual,
  diff,
  remarks,
  setRemarks,
  bookShort,
  setBookShort,
}) => {
  const pill = !hasActual
    ? { cls: 'bg-gray-100 text-gray-600', text: 'Enter the cash handed over' }
    : diff === 0
      ? { cls: 'bg-[var(--flow-accent-soft)] text-[var(--flow-accent-hover)] border border-[var(--flow-accent)]', text: '✓ Balanced (₹0 difference)' }
      : diff < 0
        ? { cls: 'bg-red-100 text-red-700', text: `⚠ Cash short by ${inr(-diff / 100)}` }
        : { cls: 'bg-amber-100 text-amber-800', text: `+ Excess cash: ${inr(diff / 100)}` };

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 items-start">
      <section className={`${card} space-y-2.5`}>
        <h3 className="text-[15px] font-black text-slate-900">Trip financial breakdown</h3>
        {row('Gross trip sales', inr(money.gross))}
        {row('Less: Credit sales', `-${inr(money.credit)}`, 'text-red-700')}
        {row('Less: UPI / Bank payments', `-${inr(money.nonCash)}`, 'text-red-700')}
        {Math.abs(money.adjust) >= 1 &&
          row(
            money.adjust > 0 ? 'Less: Returns / other adjustments' : 'Plus: Other adjustments',
            `${money.adjust > 0 ? '-' : '+'}${inr(Math.abs(money.adjust))}`,
            money.adjust > 0 ? 'text-red-700' : 'text-[var(--flow-accent)]',
          )}
        {row('Plus: Old due cash collected', `+${inr(money.oldDue)}`, 'text-[var(--flow-accent)]')}
        <div className="border-t border-gray-200 pt-2.5 flex items-baseline justify-between gap-3">
          <strong className="min-w-0 text-[15px] text-slate-900">Expected cash in hand</strong>
          <strong className="shrink-0 text-[17px] tabular-nums text-slate-900">{inr(money.expectedCash)}</strong>
        </div>
      </section>

      <section className={`${card} space-y-3`}>
        <h3 className="text-[15px] font-black text-slate-900">Cash handover &amp; expense settlement</h3>
        <div>
          <label htmlFor="trip-expenses" className={fieldLabelCls}>
            Trip expenses (fuel / toll / loading)
          </label>
          <input
            id="trip-expenses"
            inputMode="decimal"
            value={expenseText}
            disabled={closed}
            onChange={(e) => setExpenseText(e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="0"
            className={inputCls}
          />
        </div>
        {row('Net expected cash', inr(netExpected), 'text-slate-900')}
        <div>
          <label htmlFor="trip-actual-cash" className={fieldLabelCls}>
            Actual cash handed over
          </label>
          <input
            id="trip-actual-cash"
            inputMode="decimal"
            value={actualText}
            disabled={closed}
            onChange={(e) => setActualText(e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="₹0"
            className="w-full min-w-0 min-h-[48px] px-3 rounded-xl border-2 border-[var(--flow-accent)]/50 bg-white text-lg font-bold text-slate-900 focus:outline-none focus:border-[var(--flow-accent)] disabled:bg-gray-100"
          />
        </div>
        <div role="status" className={`rounded-xl px-3 py-2.5 text-sm font-black break-words ${pill.cls}`}>
          {pill.text}
        </div>
        {!closed && hasActual && diff < 0 && (
          <div className="space-y-2">
            <input
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Remarks (optional)"
              className={`${inputCls} text-sm`}
            />
            <label className="flex items-start gap-3 min-h-[44px] cursor-pointer text-[13px] text-slate-700">
              <input
                type="checkbox"
                checked={bookShort}
                onChange={(e) => setBookShort(e.target.checked)}
                className="mt-0.5 size-5 shrink-0 accent-[var(--flow-accent)]"
              />
              <span className="min-w-0">
                Book the {inr(-diff / 100)} shortfall as owed by {salesman}
                {(trip.driverPhone || trip.salesmanPhone) ? ` (${trip.driverPhone || trip.salesmanPhone})` : ''}. It is then tracked under Trips → History until repaid.
              </span>
            </label>
          </div>
        )}
      </section>
    </div>
  );
};
