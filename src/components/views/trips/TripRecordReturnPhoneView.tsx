import React from 'react';
import { CheckCircle2, ChevronLeft } from 'lucide-react';
import { Bill, Product, Trip, TripShortageReason } from '../../../types';
import { useLanguage } from '../../../i18n/LanguageContext';
import { describeOverReturn, findOverReturns } from '../../../utils/tripReturns';
import { PackIcon } from '../../common/PackIcon';
import { OdiaName } from '../../common/OdiaName';
import { inr, ReturnMoneySummary, ReturnStockRow } from './tripReturnDraft';

interface TripRecordReturnPhoneViewProps {
  trip: Trip;
  products: Product[];
  bills: Bill[];
  closed: boolean;
  phoneStep: 1 | 2 | 3 | 'finalise';
  setPhoneStep: (s: 1 | 2 | 3 | 'finalise') => void;
  draftBadge: boolean;
  setDraftBadge: (v: boolean) => void;
  error: string | null;
  setError: (e: string | null) => void;
  rows: ReturnStockRow[];
  good: Record<number, string>;
  setGood: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  damaged: Record<number, string>;
  setDamaged: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  reasons: Record<number, { reason: TripShortageReason | ''; note: string }>;
  setReasons: React.Dispatch<React.SetStateAction<Record<number, { reason: TripShortageReason | ''; note: string }>>>;
  counted: boolean;
  setCounted: (v: boolean) => void;
  totals: { loaded: number; sold: number; good: number; damaged: number };
  money: ReturnMoneySummary;
  actualText: string;
  setActualText: (v: string) => void;
  expenseText: string;
  setExpenseText: (v: string) => void;
  remarks: string;
  setRemarks: (v: string) => void;
  bookShort: boolean;
  setBookShort: (v: boolean) => void;
  expense: number;
  actual: number;
  diff: number;
  hasActual: boolean;
  nameOf: (pid: number) => string;
  stockProblem: () => string | null;
  saveDraft: () => void;
  closeTrip: () => void;
  onBack: () => void;
}

export const TripRecordReturnPhoneView: React.FC<TripRecordReturnPhoneViewProps> = ({
  trip,
  products,
  bills,
  closed,
  phoneStep,
  setPhoneStep,
  draftBadge,
  setDraftBadge,
  error,
  setError,
  rows,
  good,
  setGood,
  damaged,
  setDamaged,
  reasons,
  setReasons,
  counted,
  setCounted,
  totals,
  money,
  actualText,
  setActualText,
  expenseText,
  setExpenseText,
  remarks,
  setRemarks,
  bookShort,
  setBookShort,
  expense,
  actual,
  diff,
  hasActual,
  nameOf,
  stockProblem,
  saveDraft,
  closeTrip,
  onBack,
}) => {
  const { t } = useLanguage();
  const issueRows = rows.filter((r) => r.expected - r.g !== 0 || r.d > 0);
  const totalUnbilled = rows.reduce((s, r) => s + Math.max(0, r.diff), 0);
  const stepNo = phoneStep === 'finalise' ? 3 : phoneStep;

  const handlePhoneSaveDraft = () => {
    saveDraft();
    setDraftBadge(true);
    window.setTimeout(() => setDraftBadge(false), 2500);
  };

  const goPhoneStep2 = () => {
    const goodMap: Record<number, number> = {};
    rows.forEach((r) => (goodMap[r.pid] = r.g));
    const over = findOverReturns(trip, bills, goodMap);
    if (over.length) {
      setError(over.map((o) => describeOverReturn(o, nameOf(o.productId))).join(' '));
      return;
    }
    for (const r of rows) {
      if (r.expected - r.g < 0) {
        setError(`${nameOf(r.pid)}: returned (${r.g}) is more than expected (${r.expected}).`);
        return;
      }
    }
    if (!closed && !counted && rows.some((r) => r.expected > 0)) {
      setError('Count the crates in the van, then change a count or tick "I counted the crates in the van".');
      return;
    }
    setError(null);
    setPhoneStep(2);
  };

  const goPhoneStep3 = () => {
    const p = stockProblem();
    if (p) {
      setError(p);
      return;
    }
    setError(null);
    setPhoneStep(3);
  };

  const goPhoneFinalise = () => {
    if (!closed && !hasActual) {
      setError('Enter the cash handed over (enter 0 if none).');
      return;
    }
    setError(null);
    setPhoneStep('finalise');
  };

  const handlePhoneBack = () => {
    setError(null);
    if (phoneStep === 1) onBack();
    else if (phoneStep === 2) setPhoneStep(1);
    else if (phoneStep === 3) setPhoneStep(2);
    else setPhoneStep(3);
  };

  return (
    <div className="rt-flow-phone" id="trip-return-screen">
      <div className="hh-sales-top">
        <div className="hh-sales-top__row">
          <div className="flex items-center gap-1 min-w-0">
            <button
              type="button"
              onClick={handlePhoneBack}
              className="hh-sales-top__iconbtn"
              aria-label={t('common.back')}
            >
              <ChevronLeft size={24} strokeWidth={2.2} />
            </button>
            <h1 className="hh-sales-top__title truncate">
              {phoneStep === 'finalise'
                ? t('trips.finaliseTitle', { id: trip.id })
                : t('trips.settleTitle', { id: trip.id })}
            </h1>
          </div>
          {phoneStep === 1 && !closed && (
            <button
              type="button"
              onClick={handlePhoneSaveDraft}
              className="hh-sales-top__pill border-0 cursor-pointer"
            >
              {draftBadge ? t('trips.draftSaved') : t('trips.saveDraft')}
            </button>
          )}
        </div>
        {phoneStep !== 'finalise' && (
          <>
            <div className="rt-seg" aria-hidden="true">
              <span className={`rt-seg__bar${stepNo >= 1 ? ' rt-seg__bar--on' : ''}`} />
              <span className={`rt-seg__bar${stepNo >= 2 ? ' rt-seg__bar--on' : ''}`} />
              <span className={`rt-seg__bar${stepNo >= 3 ? ' rt-seg__bar--on' : ''}`} />
            </div>
            <p className="rt-stp m-0">
              {phoneStep === 1
                ? t('trips.settleStep1Sub')
                : phoneStep === 2
                  ? t('trips.settleStep2Sub')
                  : t('trips.settleStep3Sub')}
            </p>
          </>
        )}
      </div>

      <div id="close-trip-scroll" className="rt-flow-phone__body space-y-3">
        {phoneStep === 1 && (
          <>
            {rows.map((r) => {
              const p = products.find((x) => x.id === r.pid);
              const unaccounted = r.expected - r.g;
              const matches = unaccounted === 0;
              return (
                <div key={r.pid} id={`close-row-${r.pid}`} className="rt-card space-y-2.5">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <PackIcon size="sm" pack={p?.pack} name={p?.name} className="mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1 text-[14.5px] font-extrabold leading-snug break-words" style={{ color: 'var(--text)' }}>
                      {p ? <OdiaName name={p.name} nameOr={p.nameOr} /> : nameOf(r.pid)}
                    </div>
                  </div>

                  <div className="rt-three">
                    <div className="rt-three__col">
                      <span className="rt-three__label">{t('trips.loaded')}</span>
                      <span className="rt-three__val">{r.loaded}</span>
                    </div>
                    <div className="rt-three__col">
                      <span className="rt-three__label">{t('trips.sold')}</span>
                      <span className="rt-three__val">{r.sold}</span>
                    </div>
                    <div className="rt-three__col">
                      <span className="rt-three__label">{t('trips.expected')}</span>
                      <span className="rt-three__val">{r.expected}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1 border-t" style={{ borderColor: 'var(--divider)' }}>
                    <span className="text-[13px] font-bold" style={{ color: 'var(--text)' }}>
                      {t('trips.returnedToGodown')}
                    </span>
                    <div className="rt-st2">
                      <button
                        type="button"
                        disabled={closed || r.g <= 0}
                        onClick={() => {
                          setCounted(true);
                          setGood((s) => ({ ...s, [r.pid]: String(Math.max(0, r.g - 1)) }));
                        }}
                        aria-label={`Less ${nameOf(r.pid)}`}
                        className="rt-st2__btn disabled:opacity-40"
                      >
                        −
                      </button>
                      <input
                        type="text"
                        inputMode="numeric"
                        disabled={closed}
                        value={good[r.pid] ?? '0'}
                        onChange={(e) => {
                          setCounted(true);
                          setGood((s) => ({ ...s, [r.pid]: e.target.value.replace(/[^0-9]/g, '') || '0' }));
                        }}
                        aria-label={`Good ${nameOf(r.pid)}`}
                        className="rt-st2__qty w-10 text-center"
                        style={{ borderRadius: 0 }}
                      />
                      <button
                        type="button"
                        disabled={closed}
                        onClick={() => {
                          setCounted(true);
                          setGood((s) => ({ ...s, [r.pid]: String(r.g + 1) }));
                        }}
                        aria-label={`More ${nameOf(r.pid)}`}
                        className="rt-st2__btn disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className={`rt-tag ${matches ? 'rt-tag--paid' : 'rt-tag--due'}`}>
                      {matches
                        ? t('trips.matchesCheck')
                        : unaccounted > 0
                          ? t('trips.cratesUnaccounted', { n: unaccounted })
                          : t('trips.extraCrates', { n: -unaccounted })}
                    </span>
                  </div>
                </div>
              );
            })}

            {!closed && rows.some((r) => r.expected > 0) && (
              <label
                id="close-counted-check"
                className={counted ? 'rt-card flex items-center gap-3 cursor-pointer' : 'rt-noti cursor-pointer'}
              >
                <input
                  type="checkbox"
                  checked={counted}
                  onChange={(e) => setCounted(e.target.checked)}
                  className="size-5 shrink-0 accent-[var(--primary)]"
                />
                <span className="text-[12.5px] font-bold" style={{ color: 'var(--text)' }}>
                  {t('trips.countConfirmLabel')}
                </span>
              </label>
            )}
          </>
        )}

        {phoneStep === 2 && (
          <>
            {issueRows.length === 0 ? (
              <div className="rt-card text-center py-6 space-y-2">
                <span className="rt-tag rt-tag--paid">{t('trips.matchesCheck')}</span>
                <p className="text-[13px] font-medium m-0" style={{ color: 'var(--text-2)' }}>
                  {t('trips.noShortagesFound')}
                </p>
              </div>
            ) : (
              issueRows.map((r) => {
                const p = products.find((x) => x.id === r.pid);
                const unaccounted = Math.max(0, r.expected - r.g);
                const why = reasons[r.pid] || { reason: '' as const, note: '' };
                const allBroken = unaccounted > 0 && r.d === unaccounted && !why.reason;
                return (
                  <div key={r.pid} className="rt-card space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <PackIcon size="sm" pack={p?.pack} name={p?.name} className="shrink-0" />
                        <div className="text-[14.5px] font-extrabold leading-snug break-words" style={{ color: 'var(--text)' }}>
                          {p ? <OdiaName name={p.name} nameOr={p.nameOr} /> : nameOf(r.pid)}
                        </div>
                      </div>
                      <span className="rt-tag rt-tag--due shrink-0">
                        {t('trips.nMissing', { n: unaccounted })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>
                        {t('trips.damagedLeakage')}
                      </span>
                      <div className="rt-st2">
                        <button
                          type="button"
                          disabled={closed || r.d <= 0}
                          onClick={() => {
                            setCounted(true);
                            setDamaged((s) => ({ ...s, [r.pid]: String(Math.max(0, r.d - 1)) }));
                          }}
                          aria-label={`Less damaged ${nameOf(r.pid)}`}
                          className="rt-st2__btn disabled:opacity-40"
                        >
                          −
                        </button>
                        <input
                          type="text"
                          inputMode="numeric"
                          disabled={closed}
                          value={damaged[r.pid] ?? '0'}
                          onChange={(e) => {
                            setCounted(true);
                            const v = Math.min(unaccounted, Number(e.target.value.replace(/[^0-9]/g, '')) || 0);
                            setDamaged((s) => ({ ...s, [r.pid]: String(v) }));
                          }}
                          aria-label={`Damaged ${nameOf(r.pid)}`}
                          className="rt-st2__qty w-10 text-center"
                          style={{ borderRadius: 0 }}
                        />
                        <button
                          type="button"
                          disabled={closed || r.d >= unaccounted}
                          onClick={() => {
                            setCounted(true);
                            setDamaged((s) => ({ ...s, [r.pid]: String(Math.min(unaccounted, r.d + 1)) }));
                          }}
                          aria-label={`More damaged ${nameOf(r.pid)}`}
                          className="rt-st2__btn disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {!closed && (r.diff > 0 || allBroken) && (
                      <>
                        <div className="text-[12px] font-semibold" style={{ color: 'var(--text-2)' }}>
                          {t('trips.reasonForOther', { n: Math.max(1, r.diff || unaccounted) })}
                        </div>
                        <div className="rt-reason-grid">
                          {([
                            { id: 'short_loaded' as const, label: t('trips.reasonShortLoaded') },
                            { id: 'sold_not_billed' as const, label: t('trips.reasonSoldNotBilled') },
                            { id: 'other' as const, label: t('trips.reasonOther') },
                          ]).map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              aria-pressed={why.reason === opt.id}
                              onClick={() =>
                                setReasons((s) => ({ ...s, [r.pid]: { reason: opt.id, note: s[r.pid]?.note || '' } }))
                              }
                              className="rt-reason-pill"
                            >
                              {opt.label}
                            </button>
                          ))}
                          <button
                            type="button"
                            aria-pressed={allBroken}
                            onClick={() => {
                              setDamaged((s) => ({ ...s, [r.pid]: String(unaccounted) }));
                              setReasons((s) => {
                                const copy = { ...s };
                                delete copy[r.pid];
                                return copy;
                              });
                            }}
                            className="rt-reason-pill"
                          >
                            {t('trips.reasonBroken')}
                          </button>
                        </div>

                        <div className="rt-in">
                          <label className="rt-in__label">{t('trips.noteOptional')}</label>
                          <input
                            value={why.note}
                            onChange={(e) =>
                              setReasons((s) => ({
                                ...s,
                                [r.pid]: { reason: s[r.pid]?.reason || 'other', note: e.target.value },
                              }))
                            }
                            placeholder={t('trips.addShortNote')}
                            className="rt-in__control"
                          />
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}

            <div className="rt-info-box">{t('trips.shortageStockRule')}</div>
          </>
        )}

        {phoneStep === 3 && (
          <>
            <div className="rt-card space-y-3">
              <div className="flex items-center justify-between gap-2 text-[13.5px]">
                <span style={{ color: 'var(--text-2)' }}>{t('trips.cashCollectedOnBills')}</span>
                <strong className="font-extrabold tabular-nums" style={{ color: 'var(--text)' }}>
                  {inr(money.expectedCash)}
                </strong>
              </div>

              <div className="rt-fld">
                <label htmlFor="trip-actual-cash" className="rt-fld__label">
                  {t('trips.cashHandedIn')}
                </label>
                <div className="rt-fld__row">
                  <span className="rt-fld__curr">₹</span>
                  <input
                    id="trip-actual-cash"
                    inputMode="decimal"
                    value={actualText}
                    disabled={closed}
                    onChange={(e) => setActualText(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder="0"
                    className="rt-fld__input"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 text-[13px]">
                <span style={{ color: 'var(--text-2)' }}>
                  {diff < 0 ? t('trips.shortfall') : diff > 0 ? t('trips.excess') : t('trips.balanced')}
                </span>
                <strong
                  className="font-extrabold tabular-nums"
                  style={{ color: diff < 0 ? 'var(--due)' : diff === 0 ? 'var(--paid)' : 'var(--soon-text)' }}
                >
                  {diff === 0 ? '₹0' : inr(Math.abs(diff) / 100)}
                </strong>
              </div>

              {!closed && (
                <label
                  className="flex items-center justify-between gap-3 pt-2 border-t cursor-pointer"
                  style={{ borderColor: 'var(--divider)' }}
                >
                  <span className="text-[13px] font-bold leading-snug" style={{ color: 'var(--text)' }}>
                    {t('trips.bookShortfallToggle')}
                  </span>
                  <input
                    type="checkbox"
                    checked={bookShort}
                    onChange={(e) => setBookShort(e.target.checked)}
                    className="hh-switch"
                  />
                </label>
              )}
            </div>

            <div className="rt-card space-y-2.5">
              <div>
                <div className="text-[14px] font-extrabold" style={{ color: 'var(--text)' }}>
                  {t('trips.tripExpense')}
                </div>
                <div className="text-[12px]" style={{ color: 'var(--text-2)' }}>
                  {t('trips.tripExpenseSub')}
                </div>
              </div>
              <div className="rt-in">
                <label htmlFor="trip-expenses" className="rt-in__label">{t('trips.amountLabel')}</label>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>₹</span>
                  <input
                    id="trip-expenses"
                    inputMode="decimal"
                    value={expenseText}
                    disabled={closed}
                    onChange={(e) => setExpenseText(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder="0"
                    className="rt-in__control"
                  />
                </div>
              </div>
              <div className="rt-in">
                <label htmlFor="trip-expense-note" className="rt-in__label">{t('trips.noteOptional')}</label>
                <input
                  id="trip-expense-note"
                  value={remarks}
                  disabled={closed}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder={t('trips.optional')}
                  className="rt-in__control"
                />
              </div>
            </div>
          </>
        )}

        {phoneStep === 'finalise' && (
          <>
            <div className="rt-card space-y-2.5">
              <div className="text-[14px] font-extrabold" style={{ color: 'var(--text)' }}>
                {t('trips.crates')}
              </div>
              <div className="border-t pt-2.5 rt-three" style={{ borderColor: 'var(--divider)' }}>
                <div className="rt-three__col">
                  <span className="rt-three__label">{t('trips.returned')}</span>
                  <span className="rt-three__val">{totals.good}</span>
                </div>
                <div className="rt-three__col">
                  <span className="rt-three__label">{t('trips.damaged')}</span>
                  <span className="rt-three__val" style={{ color: totals.damaged > 0 ? 'var(--due)' : 'var(--text)' }}>
                    {totals.damaged}
                  </span>
                </div>
                <div className="rt-three__col">
                  <span className="rt-three__label">{t('trips.unbilled')}</span>
                  <span className="rt-three__val" style={{ color: totalUnbilled > 0 ? 'var(--soon-text)' : 'var(--text)' }}>
                    {totalUnbilled}
                  </span>
                </div>
              </div>
            </div>

            <div className="rt-card space-y-2">
              <div className="text-[14px] font-extrabold" style={{ color: 'var(--text)' }}>
                {t('trips.cash')}
              </div>
              <div className="rt-ln">
                <span style={{ color: 'var(--text-2)' }}>{t('trips.collected')}</span>
                <strong className="tabular-nums">{inr(money.expectedCash)}</strong>
              </div>
              <div className="rt-ln">
                <span style={{ color: 'var(--text-2)' }}>{t('trips.handedIn')}</span>
                <strong className="tabular-nums">{inr(actual)}</strong>
              </div>
              <div className="rt-ln">
                <span style={{ color: 'var(--text-2)' }}>{t('trips.bookedAsOwed')}</span>
                <strong className="tabular-nums" style={{ color: diff < 0 && bookShort ? 'var(--due)' : 'var(--text)' }}>
                  {inr(diff < 0 && bookShort ? -diff / 100 : 0)}
                </strong>
              </div>
              <div className="rt-ln">
                <span style={{ color: 'var(--text-2)' }}>{t('trips.tripExpense')}</span>
                <strong className="tabular-nums">{inr(expense)}</strong>
              </div>
            </div>

            <div className="rt-card space-y-2.5">
              <div className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: 'var(--text)' }}>
                <CheckCircle2 size={16} style={{ color: 'var(--paid)' }} className="shrink-0" />
                <span>{t('trips.cratesCountedAll', { n: rows.length })}</span>
              </div>
              <div className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: 'var(--text)' }}>
                <CheckCircle2 size={16} style={{ color: 'var(--paid)' }} className="shrink-0" />
                <span>{t('trips.reasonsGivenAll')}</span>
              </div>
              <div className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: 'var(--text)' }}>
                <CheckCircle2 size={16} style={{ color: 'var(--paid)' }} className="shrink-0" />
                <span>{t('trips.cashExpenseEntered')}</span>
              </div>
            </div>

            <p className="text-[12px] px-1 m-0" style={{ color: 'var(--text-2)' }}>
              {t('trips.closingNotice')}
            </p>
          </>
        )}

        {error && (
          <div role="alert" className="hh-hist-card hh-hist-card--due text-[12.5px] font-bold" style={{ color: 'var(--due)' }}>
            {error}
          </div>
        )}
      </div>

      <footer className="rt-flow-phone__footer">
        {phoneStep === 1 && (
          <button type="button" onClick={goPhoneStep2} className="rt-btn w-full">
            {t('trips.nextShortages')}
          </button>
        )}
        {phoneStep === 2 && (
          <button type="button" onClick={goPhoneStep3} className="rt-btn w-full">
            {t('trips.nextCash')}
          </button>
        )}
        {phoneStep === 3 && (
          <button type="button" onClick={goPhoneFinalise} className="rt-btn w-full">
            {t('trips.reviewFinalise')}
          </button>
        )}
        {phoneStep === 'finalise' && (
          closed ? (
            <button type="button" onClick={onBack} className="rt-btn w-full">
              {t('trips.backToTrips')}
            </button>
          ) : (
            <button type="button" onClick={closeTrip} className="rt-btn rt-btn--accent w-full">
              {t('trips.finaliseCloseTrip')}
            </button>
          )
        )}
      </footer>
    </div>
  );
};
