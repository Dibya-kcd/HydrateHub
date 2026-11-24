import { Trip, TripShortageReason } from '../../../types';

export const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export const num = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

export const cents = (n: number) => Math.round(n * 100);

export const PLAIN_REASONS: { id: TripShortageReason; label: string }[] = [
  { id: 'sold_not_billed', label: 'Sold but not billed' },
  { id: 'short_loaded', label: 'Short loaded' },
  { id: 'other', label: 'Other (add note)' },
];

/** What each reason does to book stock when the trip closes (shown under the reason chips). */
export const REASON_STOCK_NOTE: Record<string, string> = {
  sold_not_billed: 'These crates are taken out of stock (a loss is booked) because they left the godown.',
  short_loaded: 'Stock stays as it is: these crates never left the godown.',
  other: 'These crates are taken out of stock (a loss is booked). Add a note.',
};

export const REASON_LABEL: Record<string, string> = {
  sold_not_billed: 'Sold but not billed',
  short_loaded: 'Short loaded',
  other: 'Other',
  broken: 'Damaged / leakage',
};

export interface ReturnStockRow {
  pid: number;
  loaded: number;
  sold: number;
  expected: number;
  g: number;
  d: number;
  diff: number;
}

export interface ReturnMoneySummary {
  gross: number;
  credit: number;
  nonCash: number;
  oldDue: number;
  adjust: number;
  expectedCash: number;
}

/**
 * "Save draft" keeps the good counts on the trip (`draftReturned`), which is all the trip record has room for.
 * The damaged counts, the reasons, the expense and the remarks are kept here, on this device, so reopening the
 * draft shows everything that was typed. They are only used while the saved good counts still match, so a draft
 * changed on another phone is never mixed with stale numbers.
 */
export interface DraftExtras {
  good: Record<number, string>;
  damaged: Record<number, string>;
  reasons: Record<number, { reason: TripShortageReason | ''; note: string }>;
  expense: string;
  remarks: string;
  bookShort: boolean;
  /** The person confirmed the counts were checked against the van (see `counted` on the screen). */
  counted?: boolean;
}

const draftKey = (id: number | string) => `mrwater.closeTripDraft.${id}`;

export const readDraft = (id: number | string): DraftExtras | null => {
  try {
    const raw = window.localStorage.getItem(draftKey(id));
    return raw ? (JSON.parse(raw) as DraftExtras) : null;
  } catch {
    return null;
  }
};

export const writeDraft = (id: number | string, d: DraftExtras) => {
  try {
    window.localStorage.setItem(draftKey(id), JSON.stringify(d));
  } catch {
    /* storage full / blocked: the good counts are still saved on the trip */
  }
};

export const clearDraft = (id: number | string) => {
  try {
    window.localStorage.removeItem(draftKey(id));
  } catch {
    /* ignore */
  }
};

export const draftMatchesTrip = (d: DraftExtras | null, trip: Trip): d is DraftExtras => {
  const saved = trip.draftReturned || {};
  if (!d || Object.keys(saved).length === 0) return false;
  return Object.keys(saved).every((pid) => Number(d.good?.[Number(pid)]) === Number(saved[Number(pid)]));
};

export const inputCls =
  'w-full min-w-0 min-h-[44px] px-3 rounded-xl border border-gray-300 bg-white text-[15px] font-semibold text-slate-900 focus:outline-none focus:border-[var(--flow-accent)] disabled:bg-gray-100';
