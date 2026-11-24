import React, { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Bill, Trip } from '../../../types';
import { billBelongsToTrip } from '../../../utils/billing';

interface TripReopenConfirmModalProps {
  trip: Trip | null;
  onClose: () => void;
  onConfirm: (trip: Trip) => void;
}

export const TripReopenConfirmModal: React.FC<TripReopenConfirmModalProps> = ({
  trip,
  onClose,
  onConfirm,
}) => {
  if (!trip) return null;
  return (
    <div
      className="rt-bsheet-scrim"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-reopen-trip-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="rt-bsheet rt-bsheet--white space-y-3">
        <div className="hh-grab" />
        <div className="text-[17px] font-extrabold leading-tight" style={{ color: 'var(--text)' }} id="modal-reopen-trip-title">
          Reopen trip #{trip.id}?
        </div>
        <p className="text-[13.5px] leading-relaxed m-0" style={{ color: 'var(--text-2)' }}>
          Reopen trip back to Active to edit load, return, or bill stock. Settle it again when you are done.
        </p>
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rt-btn-outline rt-btn-outline--primary"
          >
            Cancel
          </button>
          <button
            type="button"
            id="btn-confirm-reopen-trip"
            onClick={() => onConfirm(trip)}
            className="rt-btn"
          >
            Reopen
          </button>
        </div>
      </div>
    </div>
  );
};

interface TripDeleteConfirmModalProps {
  trip: Trip | null;
  bills?: Bill[];
  isPhone: boolean;
  fmtDay?: (d?: string) => string;
  onClose: () => void;
  onConfirm: (trip: Trip, reason: string) => void;
}

const TRIP_DELETE_PRESETS = ['Test trip', 'Duplicate dispatch', 'Wrong vehicle/date', 'Cancelled load'];

export const TripDeleteConfirmModal: React.FC<TripDeleteConfirmModalProps> = ({
  trip,
  bills = [],
  isPhone,
  fmtDay,
  onClose,
  onConfirm,
}) => {
  const [reason, setReason] = useState('');

  useEffect(() => {
    setReason('');
  }, [trip?.id]);

  if (!trip) return null;

  const totalLoadedCases = Object.values(trip.loaded || {}).reduce((s, n) => s + (Number(n) || 0), 0);
  const linkedBillsCount = bills.length > 0
    ? bills.filter((b) => b.status !== 'cancelled' && billBelongsToTrip(trip, b)).length
    : (trip.billIds?.length ?? 0);
  const trimmedLen = reason.trim().length;
  const reasonOk = trimmedLen >= 4;

  const impactSummary = (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 divide-y divide-slate-100 text-xs">
      <div className="px-3 py-2 flex items-center justify-between gap-2">
        <span className="text-slate-600 font-medium">Vehicle &amp; Date</span>
        <span className="font-bold text-slate-900">{trip.vehicle || '—'} · {fmtDay ? fmtDay(trip.date) : trip.date}</span>
      </div>
      <div className="px-3 py-2 flex items-center justify-between gap-2">
        <span className="text-slate-600 font-medium">Load &amp; Status</span>
        <span className="font-bold text-slate-900 tabular-nums">{totalLoadedCases} cs · {trip.status === 'closed' ? 'Completed' : 'Active'}</span>
      </div>
      <div className="px-3 py-2 flex items-center justify-between gap-2">
        <span className="text-slate-600 font-medium">Linked Bills</span>
        <span className="font-bold text-slate-900 tabular-nums">{linkedBillsCount} unassigned (kept in Sales)</span>
      </div>
    </div>
  );

  const reasonSection = (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-semibold text-slate-700 block">
          Reason for deleting trip *
        </label>
        <span className={`text-xs font-medium tabular-nums ${reasonOk ? 'text-emerald-700' : 'text-amber-700'}`}>
          {trimmedLen}/4 min chars
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {TRIP_DELETE_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setReason(preset)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
              reason.trim().toLowerCase() === preset.toLowerCase()
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
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="e.g. Test trip, duplicate dispatch, wrong vehicle/date..."
        className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none font-sans"
      />
    </div>
  );

  if (isPhone) {
    return (
      <div
        className="rt-bsheet-scrim"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-delete-trip-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="rt-bsheet rt-bsheet--white space-y-3" onClick={(e) => e.stopPropagation()}>
          <div className="hh-grab" />
          <div className="text-[17px] font-extrabold leading-tight" style={{ color: 'var(--due)' }} id="modal-delete-trip-title">
            Delete trip #{trip.id}?
          </div>
          <p className="text-[13px] leading-relaxed m-0" style={{ color: 'var(--text-2)' }}>
            This removes the trip record and returns van load to stock. Bills stay in Sales history.
          </p>
          {impactSummary}
          {reasonSection}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rt-btn-outline rt-btn-outline--primary"
            >
              Keep
            </button>
            <button
              type="button"
              id="btn-confirm-delete-trip"
              disabled={!reasonOk}
              onClick={() => onConfirm(trip, reason.trim())}
              className="rt-btn rt-btn--due disabled:opacity-45 disabled:cursor-not-allowed"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-delete-trip-title"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 text-rose-700 font-bold text-base" id="modal-delete-trip-title">
          <Trash2 size={20} /> Delete trip #{trip.id}?
        </div>
        <p className="text-sm text-slate-700 leading-relaxed">
          <strong>Trip #{trip.id} ({trip.vehicle})</strong> from {fmtDay ? fmtDay(trip.date) : trip.date} will be removed and its
          bills unassigned. This action is logged in the Activity Log.
        </p>
        {impactSummary}
        {reasonSection}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-xl border border-black/10 text-sm font-semibold text-slate-700 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            id="btn-confirm-delete-trip"
            disabled={!reasonOk}
            onClick={() => onConfirm(trip, reason.trim())}
            className="min-h-11 rounded-xl bg-rose-600 text-white text-sm font-semibold cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
          >
            Delete Trip
          </button>
        </div>
      </div>
    </div>
  );
};
