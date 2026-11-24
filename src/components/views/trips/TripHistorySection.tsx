import React from 'react';
import { ChevronDown, Search, Truck, X } from 'lucide-react';
import { Salesman, Trip } from '../../../types';
import { SalesmanDuesPanel } from './SalesmanDuesPanel';

interface TripHistorySectionProps {
  isPhone: boolean;
  trips: Trip[];
  salesmen: Salesman[];
  closedTrips: Trip[];
  filteredHistory: Trip[];
  shownHistory: Trip[];
  historyGroups: { day: string; trips: Trip[] }[];
  historySearch: string;
  setHistorySearch: (val: string) => void;
  histFrom: string;
  setHistFrom: (val: string) => void;
  histTo: string;
  setHistTo: (val: string) => void;
  histSalesman: string;
  setHistSalesman: (val: string) => void;
  historySalesmen: string[];
  activeRange: '7' | '30' | 'month' | 'all' | null;
  setActiveRange: (val: '7' | '30' | 'month' | 'all' | null) => void;
  historyFiltered: boolean;
  pageSize: number;
  historyPageSizeDesktop: number;
  setHistoryLimit: React.Dispatch<React.SetStateAction<number>>;
  setQuickRange: (days: number | 'month' | 'all', key?: '7' | '30' | 'month' | 'all') => void;
  clearHistoryFilters: () => void;
  recordTripCashRecovery: (tripId: number, amount: number) => boolean;
  writeOffTripCashShort: (tripId: number) => void;
  renderCard: (t: Trip, mode: 'active' | 'history') => React.ReactNode;
}

export const TripHistorySection: React.FC<TripHistorySectionProps> = ({
  isPhone,
  trips,
  salesmen,
  closedTrips,
  filteredHistory,
  shownHistory,
  historyGroups,
  historySearch,
  setHistorySearch,
  histFrom,
  setHistFrom,
  histTo,
  setHistTo,
  histSalesman,
  setHistSalesman,
  historySalesmen,
  activeRange,
  setActiveRange,
  historyFiltered,
  pageSize,
  historyPageSizeDesktop,
  setHistoryLimit,
  setQuickRange,
  clearHistoryFilters,
  recordTripCashRecovery,
  writeOffTripCashShort,
  renderCard,
}) => (
  <div className="space-y-3">
    <SalesmanDuesPanel
      trips={trips}
      salesmen={salesmen}
      onRecover={recordTripCashRecovery}
      onWriteOff={writeOffTripCashShort}
    />
    {isPhone ? (
      <>
        <div className="rt-card space-y-2.5">
          <div className="rt-search-bar" style={{ borderRadius: '18px' }}>
            <Search size={16} style={{ color: 'var(--text-2)', flexShrink: 0 }} />
            <input
              type="search"
              value={historySearch}
              onChange={(e) => {
                setHistorySearch(e.target.value);
                setHistoryLimit(pageSize);
              }}
              placeholder="Search vehicle, beat, date, trip no."
              className="text-[13px]"
            />
            {historySearch && (
              <button
                type="button"
                onClick={() => {
                  setHistorySearch('');
                  setHistoryLimit(pageSize);
                }}
                aria-label="Clear"
                className="p-1 bg-transparent border-0 cursor-pointer"
                style={{ color: 'var(--text-2)' }}
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {([
              ['Last 7 days', 7, '7'],
              ['Last 30 days', 30, '30'],
              ['This month', 'month', 'month'],
              ['All', 'all', 'all'],
            ] as const).map(([label, v, key]) => (
              <button
                key={label}
                type="button"
                aria-pressed={activeRange === key}
                onClick={() => setQuickRange(v as number | 'month' | 'all', key)}
                className="rt-chip shrink-0"
                style={{ minHeight: '38px' }}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="rt-in">
              <span className="rt-in__label uppercase">From</span>
              <input
                type="date"
                value={histFrom}
                onChange={(e) => {
                  setHistFrom(e.target.value);
                  setActiveRange(null);
                  setHistoryLimit(pageSize);
                }}
                className="rt-in__control"
              />
            </label>
            <label className="rt-in">
              <span className="rt-in__label uppercase">To</span>
              <input
                type="date"
                value={histTo}
                onChange={(e) => {
                  setHistTo(e.target.value);
                  setActiveRange(null);
                  setHistoryLimit(pageSize);
                }}
                className="rt-in__control"
              />
            </label>
          </div>

          <label className="rt-in">
            <span className="rt-in__label uppercase">Salesman</span>
            <div className="rt-in__select-wrap">
              <select
                value={histSalesman}
                onChange={(e) => {
                  setHistSalesman(e.target.value);
                  setHistoryLimit(pageSize);
                }}
                className="rt-in__control"
              >
                <option value="">All salesmen</option>
                {historySalesmen.map((n) => (
                  <option key={n} value={n}>
                    {n} ({closedTrips.filter((t) => (t.salesman || '').trim() === n).length})
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="rt-in__select-chev" aria-hidden="true" />
            </div>
          </label>
        </div>

        <div className="flex items-center justify-between gap-2 px-1 text-[12px] font-medium" style={{ color: 'var(--text-2)' }}>
          <span>
            Showing {shownHistory.length} of {filteredHistory.length}
            {historyFiltered ? ` (${closedTrips.length} completed trips in total)` : ' completed trips'}
          </span>
          {historyFiltered && (
            <button
              type="button"
              onClick={clearHistoryFilters}
              className="text-[12.5px] font-bold bg-transparent border-0 cursor-pointer shrink-0"
              style={{ color: 'var(--primary)', minHeight: '36px' }}
            >
              Clear filters
            </button>
          )}
        </div>
      </>
    ) : (
      <>
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="search"
            value={historySearch}
            onChange={(e) => {
              setHistorySearch(e.target.value);
              setHistoryLimit(historyPageSizeDesktop);
            }}
            placeholder="Search vehicle, beat, person, phone, trip #"
            className="w-full pl-10 pr-3 py-3 rounded-full border border-black/10 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/25"
          />
        </div>
        <div data-card-tone="neutral" className="rounded-2xl border shadow-xs p-3 space-y-2.5">
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
            {([
              ['Last 7 days', 7, '7'],
              ['Last 30 days', 30, '30'],
              ['This month', 'month', 'month'],
              ['All', 'all', 'all'],
            ] as const).map(([label, v, key]) => (
              <button
                key={label}
                type="button"
                onClick={() => setQuickRange(v as number | 'month' | 'all', key)}
                className={`shrink-0 min-h-9 px-3.5 rounded-full border text-xs font-bold cursor-pointer ${
                  activeRange === key
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-black/10 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <label className="text-xs font-bold text-slate-500">
              From
              <input
                type="date"
                value={histFrom}
                onChange={(e) => {
                  setHistFrom(e.target.value);
                  setActiveRange(null);
                  setHistoryLimit(historyPageSizeDesktop);
                }}
                className="mt-0.5 w-full px-2.5 py-2 rounded-xl border border-black/10 bg-white text-sm"
              />
            </label>
            <label className="text-xs font-bold text-slate-500">
              To
              <input
                type="date"
                value={histTo}
                onChange={(e) => {
                  setHistTo(e.target.value);
                  setActiveRange(null);
                  setHistoryLimit(historyPageSizeDesktop);
                }}
                className="mt-0.5 w-full px-2.5 py-2 rounded-xl border border-black/10 bg-white text-sm"
              />
            </label>
            <label className="col-span-2 sm:col-span-1 text-xs font-bold text-slate-500">
              Salesman
              <select
                value={histSalesman}
                onChange={(e) => {
                  setHistSalesman(e.target.value);
                  setHistoryLimit(historyPageSizeDesktop);
                }}
                className="mt-0.5 w-full px-2.5 py-2 rounded-xl border border-black/10 bg-white text-sm"
              >
                <option value="">All salesmen</option>
                {historySalesmen.map((n) => (
                  <option key={n} value={n}>
                    {n} ({closedTrips.filter((t) => (t.salesman || '').trim() === n).length})
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-500">
            <span>
              Showing {shownHistory.length} of {filteredHistory.length}
              {historyFiltered ? ` (${closedTrips.length} completed trips in total)` : ' completed trips'}
            </span>
            {historyFiltered && (
              <button
                type="button"
                onClick={clearHistoryFilters}
                className="font-bold text-rose-600 hover:text-rose-800 cursor-pointer"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      </>
    )}

    {filteredHistory.length === 0 ? (
      isPhone ? (
        historyFiltered ? (
          <div className="rt-card px-5 py-8 text-center space-y-3">
            <div className="mx-auto rt-trip-icon-badge" style={{ width: 48, height: 48 }}>
              <Truck size={22} />
            </div>
            <p className="text-[14.5px] font-bold m-0" style={{ color: 'var(--text)' }}>
              No completed trips match these filters.
            </p>
            <button
              type="button"
              onClick={clearHistoryFilters}
              className="rt-btn-outline rt-btn-outline--primary w-full"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="rt-card px-5 py-7 text-center">
            <p className="text-[14px] font-bold m-0" style={{ color: 'var(--text)' }}>
              Completed trips will appear here after day-end settlement.
            </p>
          </div>
        )
      ) : (
        <div data-card-tone="neutral" className="rounded-2xl border shadow-xs px-6 py-10 text-center text-sm text-slate-500">
          {historyFiltered ? 'No completed trips match these filters.' : 'Completed trips will appear here after day-end settlement.'}
        </div>
      )
    ) : (
      <>
        {historyGroups.map((g) => (
          <section key={g.day} className="space-y-2">
            <h2 className="px-1 pt-1 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>{g.day}</h2>
            <div className={isPhone ? 'space-y-2 hh-tgrid-2' : 'space-y-2'}>
              {g.trips.map((t) => renderCard(t, 'history'))}
            </div>
          </section>
        ))}
        {filteredHistory.length > shownHistory.length && (
          <button
            type="button"
            onClick={() => setHistoryLimit((n) => n + pageSize)}
            className={isPhone ? 'rt-btn-outline rt-btn-outline--primary w-full font-bold' : 'w-full min-h-11 rounded-full border border-black/10 bg-white text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-50'}
          >
            Show more ({filteredHistory.length - shownHistory.length} older)
          </button>
        )}
        {!isPhone && filteredHistory.length > shownHistory.length && (
          <button
            type="button"
            onClick={() => setHistoryLimit(filteredHistory.length)}
            className="w-full min-h-10 text-xs font-bold bg-transparent border-0 cursor-pointer"
            style={{ color: 'var(--text-2)' }}
          >
            Show all {filteredHistory.length} trips
          </button>
        )}
      </>
    )}
  </div>
);
