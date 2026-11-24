import React, { useMemo, useState } from 'react';
import { CheckCircle2, Pencil, Save } from 'lucide-react';
import { Bill, PaymentRecord, Product, Trip, TripShortageInput, TripShortageReason, Warehouse } from '../../types';
import { useLedger } from '../../context/LedgerContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import { billBelongsToTrip } from '../../utils/billing';
import { billBalance } from '../../utils/salesReturns';
import { describeOverReturn, findOverReturns } from '../../utils/tripReturns';
import { compareProductsInSequence } from '../../utils/sizeColor';
import {
  FlowBadge,
  FlowFooter,
  FlowHeader,
  flowBtn,
  flowFooterPrimary,
  flowFooterSecondary,
} from '../common/FlowKit';
import { useCloseTrip } from './trips/useCloseTrip';
import {
  cents,
  clearDraft,
  DraftExtras,
  draftMatchesTrip,
  inr,
  num,
  readDraft,
  writeDraft,
} from './trips/tripReturnDraft';
import { TripRecordReturnPhoneView } from './trips/TripRecordReturnPhoneView';
import { TripReturnDesktopStep1, TripReturnDesktopStep2 } from './trips/TripRecordReturnDesktopSteps';

interface TripRecordReturnScreenProps {
  trip: Trip;
  products: Product[];
  bills: Bill[];
  warehouses?: Warehouse[];
  payments?: PaymentRecord[];
  onBack: () => void;
  /**
   * Called with what the person entered. For a close, `tripExpense` is the fuel / toll / loading paid out of
   * the trip cash; the caller closes the trip with `useCloseTrip().closeTrip` so it also reaches the ledger.
   * A text result = the save was refused; it is shown to the person.
   */
  onSaveReturn: (
    tripId: number,
    finalReturn: Record<number, number>,
    closeTrip: boolean,
    shortageReasons?: Record<number, TripShortageInput>,
    cashHandedIn?: number | null,
    cashShortBooked?: number | null,
    tripExpense?: { amount: number; note?: string },
  ) => string | null | void;
  onEditTrip?: (trip: Trip) => void;
}

/**
 * Close Trip, in two steps.
 *   Step 1 – unsold & damaged stock return (good → godown, damaged → spoilage write-off)
 *   Step 2 – cash & ledger reconciliation (expected cash, trip expenses, cash handed over)
 * Stock and money are saved through the existing saveReturn path, so godown stock, spoilage, dues and
 * salesman cash-short tracking all keep working on the same data as before.
 */
export const TripRecordReturnScreen: React.FC<TripRecordReturnScreenProps> = ({
  trip,
  products,
  bills,
  payments = [],
  onBack,
  onSaveReturn,
  onEditTrip,
}) => {
  const { trips } = useLedger();
  const isPhone = useIsMobile(767);
  const { postedTripExpense } = useCloseTrip();
  const closed = trip.status === 'closed';

  const [step, setStep] = useState<1 | 2>(1);
  const [phoneStep, setPhoneStep] = useState<1 | 2 | 3 | 'finalise'>(1);
  const [draftBadge, setDraftBadge] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Typed-but-not-closed values from this device (see DraftExtras); only for an open trip whose saved counts match.
  const [savedDraft] = useState<DraftExtras | null>(() => {
    if (trip.status === 'closed') return null;
    const d = readDraft(trip.id);
    return draftMatchesTrip(d, trip) ? d : null;
  });

  /* ------------------------------ stock ------------------------------ */
  const soldMap = useMemo(() => {
    const res: Record<number, number> = {};
    for (const b of bills) {
      if (b.status === 'cancelled' || !billBelongsToTrip(trip, b)) continue;
      for (const it of b.items || []) res[Number(it.productId)] = (res[Number(it.productId)] || 0) + (Number(it.qty) || 0);
    }
    return res;
  }, [bills, trip]);

  const pids = useMemo(() => {
    const byId = new Map(products.map((p) => [p.id, p]));
    return Object.keys(trip.loaded || {})
      .map(Number)
      .sort((a, b) =>
        compareProductsInSequence(byId.get(a) || { name: `Product #${a}` }, byId.get(b) || { name: `Product #${b}` }),
      );
  }, [trip.loaded, products]);

  // Start from what is on record: a closed trip shows its recorded counts, an open one its saved draft, else "all came back good".
  const [good, setGood] = useState<Record<number, string>>(() => {
    const src = closed ? trip.returned || {} : trip.draftReturned || {};
    const init: Record<number, string> = {};
    for (const pid of Object.keys(trip.loaded || {}).map(Number)) {
      const e = Math.max(0, (Number(trip.loaded[pid]) || 0) - (soldMap[pid] || 0));
      init[pid] = String(src[pid] !== undefined ? src[pid] : closed ? 0 : e);
    }
    return init;
  });
  const [damaged, setDamaged] = useState<Record<number, string>>(() => {
    const init: Record<number, string> = {};
    for (const pid of Object.keys(trip.loaded || {}).map(Number)) {
      const s = trip.shortageReasons?.[pid];
      init[pid] = closed && s?.reason === 'broken' ? String(s.qty || 0) : savedDraft?.damaged?.[pid] ?? '0';
    }
    return init;
  });
  const [reasons, setReasons] = useState<Record<number, { reason: TripShortageReason | ''; note: string }>>(() => {
    const init: Record<number, { reason: TripShortageReason | ''; note: string }> = {};
    for (const [pid, e] of Object.entries(trip.shortageReasons || {})) {
      if (e.reason !== 'broken') init[Number(pid)] = { reason: e.reason, note: e.note || '' };
      else if (e.missing) init[Number(pid)] = { reason: e.missing.reason, note: e.missing.note || '' };
    }
    if (!closed && savedDraft?.reasons) for (const [pid, e] of Object.entries(savedDraft.reasons)) init[Number(pid)] = e;
    return init;
  });

  // The good counts start as "everything came back". Until the person changes a count or ticks the confirmation,
  // Next is blocked, so a screen that was never counted cannot close the trip with a clean result by accident.
  const [counted, setCounted] = useState<boolean>(() => closed || savedDraft?.counted === true);

  const rows = useMemo(
    () =>
      pids.map((pid) => {
        const loaded = Number(trip.loaded?.[pid]) || 0;
        const sold = soldMap[pid] || 0;
        const expected = Math.max(0, loaded - sold);
        const g = num(good[pid] ?? '0');
        const d = num(damaged[pid] ?? '0');
        const diff = expected - g - d; // > 0 missing, < 0 counted more than expected
        return { pid, loaded, sold, expected, g, d, diff };
      }),
    [pids, trip.loaded, soldMap, good, damaged],
  );

  const nameOf = (pid: number) => products.find((p) => p.id === pid)?.name || `Product #${pid}`;

  /** Why step 1 cannot move on yet (null = fine). */
  const stockProblem = (): string | null => {
    const goodMap: Record<number, number> = {};
    rows.forEach((r) => (goodMap[r.pid] = r.g));
    const over = findOverReturns(trip, bills, goodMap);
    if (over.length) return over.map((o) => describeOverReturn(o, nameOf(o.productId))).join(' ');
    for (const r of rows) {
      if (r.diff < 0) return `${nameOf(r.pid)}: good + damaged is ${-r.diff} more than the ${r.expected} cases that should be back.`;
      if (r.diff > 0) {
        const why = reasons[r.pid];
        if (!why?.reason) return `${nameOf(r.pid)}: choose why ${r.diff} cases are missing.`;
        if (why.reason === 'other' && !why.note.trim()) return `${nameOf(r.pid)}: add a short note for the missing cases.`;
      }
    }
    if (!closed && !counted && rows.some((r) => r.expected > 0))
      return 'The counts still say "everything came back". Count the crates in the van, then change a count or tick "I counted the crates".';
    return null;
  };

  const totals = rows.reduce(
    (t, r) => ({ loaded: t.loaded + r.loaded, sold: t.sold + r.sold, good: t.good + r.g, damaged: t.damaged + r.d }),
    { loaded: 0, sold: 0, good: 0, damaged: 0 },
  );

  /* ------------------------------ money ------------------------------ */
  const money = useMemo(() => {
    const mine = bills.filter((b) => b.status !== 'cancelled' && billBelongsToTrip(trip, b));
    const ids = new Set(mine.map((b) => b.id));
    let gross = 0;
    let collected = 0;
    let credit = 0;
    for (const b of mine) {
      gross += Number(b.total) || 0;
      collected += Number(b.amountPaid) || 0;
      credit += Math.max(0, billBalance(b));
    }
    // Cash on the trip's bills: individual receipts collected on/before the trip date (not later office collections or advance adjustments).
    const tripCutoff = String(trip.date || '').slice(0, 10);
    const receipts = payments.filter((p) => {
      if (p.billId == null || !ids.has(p.billId) || p.isAdvance || p.isRefund) return false;
      if ((Number(p.amount) || 0) <= 0) return false;
      if (p.entryKind === 'advance_adjustment' || (p.referenceNote || '').startsWith('Advance / credit adjusted')) {
        return false;
      }
      const pDate = String(p.paymentDate || p.createdAt || '').slice(0, 10);
      if (tripCutoff && pDate && pDate > tripCutoff) return false;
      return true;
    });
    const cashOnBills = receipts.length
      ? receipts.filter((p) => p.mode === 'cash').reduce((s, p) => s + (Number(p.amount) || 0), 0)
      : mine.filter((b) => b.paymentMode === 'cash').reduce((s, b) => s + (Number(b.amountPaid) || 0), 0);
    const nonCash = Math.max(0, collected - cashOnBills);

    // Old dues: cash this salesman collected on the trip date that is not on this trip's bills. If he ran two trips
    // that day it is counted on the first one only, so it can never be asked for twice.
    const sameDay = trips
      .filter(
        (t) =>
          (t.date || '').slice(0, 10) === (trip.date || '').slice(0, 10) &&
          ((trip.salesmanId && t.salesmanId === trip.salesmanId) || (!trip.salesmanId && t.salesman === trip.salesman)),
      )
      .sort((a, b) => Number(a.id) - Number(b.id));
    const isFirstOfDay = !sameDay.length || Number(sameDay[0].id) === Number(trip.id);
    const oldDue = isFirstOfDay
      ? payments
          .filter(
            (p) =>
              p.mode === 'cash' &&
              (p.paymentDate || '').slice(0, 10) === (trip.date || '').slice(0, 10) &&
              !(p.billId != null && ids.has(p.billId)) &&
              ((trip.salesmanId && p.salesmanId === trip.salesmanId) ||
                (!p.salesmanId && !!trip.salesman && p.recordedBy === trip.salesman)),
          )
          .reduce((s, p) => s + (Number(p.amount) || 0), 0)
      : 0;
    const adjust = gross - credit - nonCash - cashOnBills; // returns / discounts etc. that are neither cash nor credit
    return { gross, credit, nonCash, oldDue, adjust, expectedCash: cashOnBills + oldDue };
  }, [bills, payments, trip, trips]);

  const [expenseText, setExpenseText] = useState(() =>
    closed ? String(postedTripExpense(trip.id) || '') : savedDraft?.expense ?? '',
  );
  const [actualText, setActualText] = useState(() => (trip.cashHandedIn != null ? String(trip.cashHandedIn) : ''));
  const [remarks, setRemarks] = useState(() => savedDraft?.remarks ?? '');
  const [bookShort, setBookShort] = useState(() => savedDraft?.bookShort ?? true);

  const expense = num(expenseText);
  const netExpected = money.expectedCash - expense;
  const hasActual = actualText.trim() !== '';
  const actual = num(actualText);
  const diff = cents(actual) - cents(netExpected); // < 0 short, > 0 excess

  /* ------------------------------ save ------------------------------ */
  const buildReturn = () => {
    const finalReturn: Record<number, number> = {};
    rows.forEach((r) => (finalReturn[r.pid] = r.g));
    return finalReturn;
  };

  const saveDraft = () => {
    setError(null);
    writeDraft(trip.id, { good, damaged, reasons, expense: expenseText, remarks, bookShort, counted });
    const refused = onSaveReturn(trip.id, buildReturn(), false, undefined, hasActual ? actual : null);
    if (typeof refused === 'string' && refused) setError(refused);
  };

  const goStep2 = () => {
    const p = stockProblem();
    if (p) {
      setError(p);
      // Take the person to the first product that needs attention.
      const first = rows.find((r) => r.diff !== 0);
      const target = first ? `close-row-${first.pid}` : 'close-counted-check';
      document.getElementById(target)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    setError(null);
    setStep(2);
    document.getElementById('close-trip-scroll')?.scrollTo({ top: 0 });
  };

  const closeTrip = () => {
    const p = stockProblem();
    if (p) {
      setStep(1);
      setError(p);
      return;
    }
    if (!hasActual) {
      setError('Enter the cash handed over (enter 0 if none).');
      return;
    }
    const picked: Record<number, { reason: TripShortageReason; note?: string }> = {};
    for (const r of rows) {
      if (r.diff > 0 && reasons[r.pid]?.reason) {
        // Damaged crates (if any) and the missing ones each get their own stock write-off.
        picked[r.pid] = {
          reason: reasons[r.pid].reason as TripShortageReason,
          note: reasons[r.pid].note.trim() || undefined,
          ...(r.d > 0 ? { damaged: r.d } : {}),
        };
      } else if (r.d > 0 && r.diff === 0) {
        picked[r.pid] = { reason: 'broken', note: `Trip #${trip.id}: ${r.d} damaged / leakage` };
      }
    }
    const booked = diff < 0 && bookShort ? Math.round(-diff) / 100 : null;
    const note = [remarks.trim(), diff < 0 ? `cash short ${inr(-diff / 100)}` : ''].filter(Boolean).join('; ') || undefined;
    setError(null);
    const refused = onSaveReturn(trip.id, buildReturn(), true, picked, actual, booked, { amount: expense, note });
    if (typeof refused === 'string' && refused) setError(refused);
    else clearDraft(trip.id);
  };

  /* ------------------------------ render ------------------------------ */
  const salesman = trip.salesman || 'Unassigned';
  const issues = rows.filter((r) => r.diff !== 0).length;

  if (isPhone) {
    return (
      <TripRecordReturnPhoneView
        trip={trip}
        products={products}
        bills={bills}
        closed={closed}
        phoneStep={phoneStep}
        setPhoneStep={setPhoneStep}
        draftBadge={draftBadge}
        setDraftBadge={setDraftBadge}
        error={error}
        setError={setError}
        rows={rows}
        good={good}
        setGood={setGood}
        damaged={damaged}
        setDamaged={setDamaged}
        reasons={reasons}
        setReasons={setReasons}
        counted={counted}
        setCounted={setCounted}
        totals={totals}
        money={money}
        actualText={actualText}
        setActualText={setActualText}
        expenseText={expenseText}
        setExpenseText={setExpenseText}
        remarks={remarks}
        setRemarks={setRemarks}
        bookShort={bookShort}
        setBookShort={setBookShort}
        expense={expense}
        actual={actual}
        diff={diff}
        hasActual={hasActual}
        nameOf={nameOf}
        stockProblem={stockProblem}
        saveDraft={saveDraft}
        closeTrip={closeTrip}
        onBack={onBack}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--flow-canvas)]" id="trip-return-screen">
      <FlowHeader
        title={`Close Trip — #TRP-${trip.id}`}
        subtitle={`${[trip.vehicle, salesman, trip.date].filter(Boolean).join(' • ')}${trip.driver ? ` • Driver ${trip.driver}` : ''}`}
        onBack={step === 2 ? () => setStep(1) : onBack}
        backLabel={step === 2 ? 'Back to stock return' : 'Back to trips'}
        right={<FlowBadge>{closed ? 'Closed' : step === 1 ? 'Stock Return' : 'Cash & Ledger'}</FlowBadge>}
        progress={{ step, total: 2 }}
      />

      <div id="close-trip-scroll" className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain">
        <div className="mx-auto w-full max-w-6xl px-3 pt-3 pb-6 space-y-3">
          {closed && (
            <p className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-[13px] text-gray-600">
              This trip is closed. The figures below are what was recorded.
            </p>
          )}
          <h2 className="text-sm font-black text-slate-900 px-0.5">
            {step === 1 ? `Unsold & damaged stock return · ${rows.length} ${rows.length === 1 ? 'product' : 'products'}` : 'Cash & ledger reconciliation'}
          </h2>
          {step === 1 ? (
            <TripReturnDesktopStep1
              closed={closed}
              counted={counted}
              setCounted={setCounted}
              rows={rows}
              products={products}
              good={good}
              setGood={setGood}
              damaged={damaged}
              setDamaged={setDamaged}
              reasons={reasons}
              setReasons={setReasons}
              totals={totals}
              nameOf={nameOf}
            />
          ) : (
            <TripReturnDesktopStep2
              trip={trip}
              closed={closed}
              salesman={salesman}
              money={money}
              expenseText={expenseText}
              setExpenseText={setExpenseText}
              netExpected={netExpected}
              actualText={actualText}
              setActualText={setActualText}
              hasActual={hasActual}
              diff={diff}
              remarks={remarks}
              setRemarks={setRemarks}
              bookShort={bookShort}
              setBookShort={setBookShort}
            />
          )}
        </div>
      </div>

      {/* The message sits right above the buttons so it is never hidden below a long list. */}
      {error && (
        <div className="shrink-0 border-t border-red-200 bg-red-50 px-3 py-2">
          <p role="alert" className="mx-auto w-full max-w-6xl text-[13px] font-bold text-red-700 break-words">
            {error}
          </p>
        </div>
      )}

      <FlowFooter>
        {closed ? (
          <button
            type="button"
            onClick={step === 1 ? () => setStep(2) : onBack}
            className={`${flowBtn.primary} basis-full`}
          >
            {step === 1 ? 'Next: Cash & Ledger →' : 'Back to Trips'}
          </button>
        ) : step === 1 ? (
          <button type="button" onClick={goStep2} className={`${flowBtn.primary} ${flowFooterPrimary}`}>
            <span className="truncate">Next: Cash &amp; Ledger →</span>
            {issues > 0 && (
              <span
                aria-label={`${issues} to check`}
                className="shrink-0 rounded-full bg-white/25 px-2 py-0.5 text-xs font-black tabular-nums"
              >
                {issues} to check
              </span>
            )}
          </button>
        ) : (
          <button type="button" onClick={closeTrip} className={`${flowBtn.primary} ${flowFooterPrimary}`}>
            <CheckCircle2 size={18} className="shrink-0" />
            <span className="truncate">Close Trip &amp; Post to Ledger</span>
          </button>
        )}
        {!closed && (
          <button type="button" onClick={saveDraft} className={`${flowBtn.secondary} ${flowFooterSecondary}`}>
            <Save size={16} className="shrink-0" /> Save draft
          </button>
        )}
        {onEditTrip && !closed && step === 1 && (
          <button type="button" onClick={() => onEditTrip(trip)} className={`${flowBtn.secondary} ${flowFooterSecondary}`}>
            <Pencil size={16} className="shrink-0" /> Edit load
          </button>
        )}
      </FlowFooter>
    </div>
  );
};
