import React from 'react';
import {
  ArrowRight,
  History as HistoryIcon,
  Phone,
  Plus,
  ShoppingCart,
  Truck,
} from 'lucide-react';
import { Bill, PaletteTokens, Trip, Warehouse } from '../../../types';
import { money } from '../../../utils/billing';
import { resolveTripGodownDisplay } from '../../../utils/tripLoads';
import type { SalesmanTripScreenMode } from '../trips/SalesmanTripScreens';

export interface SalesmanTripsTabProps {
  anyOutTrips: Trip[];
  olderOrClosedTrips: Trip[];
  activeTrip: Trip | null;
  otherOutTrips: Trip[];
  warehouses: Warehouse[];
  bills: Bill[];
  todayStr: string;
  totalLoadedItems: number;
  vanStockCounts: {
    totalSoldCases: number;
    totalAvailableCases: number;
  };
  tripTotalBilled: number;
  tripBillsCount: number;
  showTripHistory: boolean;
  setShowTripHistory: (v: boolean) => void;
  tripSearch: string;
  setTripSearch: (v: string) => void;
  shownHistoryTrips: Trip[];
  matchedHistoryTripsCount: number;
  setTripLimit: React.Dispatch<React.SetStateAction<number>>;
  palette: PaletteTokens;
  fz: (base: number, extra?: React.CSSProperties) => React.CSSProperties;
  onOpenVanModal: () => void;
  onStartSelling: () => void;
  onOpenTripScreen: (mode: SalesmanTripScreenMode, trip: Trip) => void;
  onSwitchActiveTrip: (trip: Trip) => void;
}

export const SalesmanTripsTab: React.FC<SalesmanTripsTabProps> = ({
  anyOutTrips,
  olderOrClosedTrips,
  activeTrip,
  otherOutTrips,
  warehouses,
  bills,
  todayStr,
  totalLoadedItems,
  vanStockCounts,
  tripTotalBilled,
  tripBillsCount,
  showTripHistory,
  setShowTripHistory,
  tripSearch,
  setTripSearch,
  shownHistoryTrips,
  matchedHistoryTripsCount,
  setTripLimit,
  palette,
  fz,
  onOpenVanModal,
  onStartSelling,
  onOpenTripScreen,
  onSwitchActiveTrip,
}) => {
  return (
    <section id="salesman-trips-view" className="space-y-4">
      <div
        data-card-tone="neutral"
        className="p-4 sm:p-5 rounded-2xl border shadow-sm space-y-4"
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
          <div>
            <h2 style={fz(18, { fontWeight: 900 })} className="text-slate-900 flex items-center gap-2.5">
              <span className="hh-icon-badge hh-icon-badge--sm hh-icon-badge--blue">
                <Truck size={16} />
              </span>
              <span>Trips</span>
            </h2>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              {anyOutTrips.length > 0
                ? `${anyOutTrips.length} active run${anyOutTrips.length === 1 ? '' : 's'} • ${olderOrClosedTrips.length} past`
                : `${olderOrClosedTrips.length} past trip${olderOrClosedTrips.length === 1 ? '' : 's'}`}
            </p>
          </div>

          <button
            type="button"
            id="btn-load-new-van-run"
            onClick={onOpenVanModal}
            className="min-h-[40px] px-4 py-2 rounded-xl border-2 border-sky-600 bg-sky-600 hover:bg-sky-700 text-white font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-colors shrink-0"
          >
            <Plus size={15} />
            <span>Load Trip</span>
          </button>
        </div>

        {/* Merged Active Trip Card (single authoritative card for the current Out-on-Run trip) */}
        {activeTrip ? (
          <div
            id={`salesman-trip-item-${activeTrip.id}`}
            data-card-tone="sales"
            className="p-4 rounded-2xl border shadow-sm space-y-3.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded bg-blue-600 text-white text-xs font-black uppercase tracking-wider">
                  Active Trip
                </span>
                <span className="text-xs font-black uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  ● Out on Run
                </span>
                <span className="font-mono text-xs font-bold text-sky-700">
                  {activeTrip.date}
                </span>
              </div>
              <span className="text-xs font-bold text-sky-700 bg-white/80 px-2 py-0.5 rounded border border-sky-200">
                {resolveTripGodownDisplay({ trip: activeTrip, warehouses }).label || 'Main Godown'}
              </span>
            </div>

            <div>
              <div className="font-black text-lg text-slate-900 leading-tight">
                {activeTrip.vehicle}
              </div>
              <div className="text-xs font-bold text-slate-600 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span>Route: {activeTrip.route || 'Standard Route'} • Driver/Sales: {activeTrip.driver || activeTrip.salesman || 'Assigned'} • Trip #{activeTrip.id}</span>
                {(activeTrip.driverPhone || activeTrip.salesmanPhone) && (
                  <a
                    href={`tel:${(activeTrip.driverPhone || activeTrip.salesmanPhone || '').replace(/\s+/g, '')}`}
                    className="inline-flex items-center gap-1 text-sky-700 hover:text-sky-900 no-underline"
                  >
                    <Phone size={11} /> {activeTrip.driverPhone || activeTrip.salesmanPhone}
                  </a>
                )}
              </div>
            </div>

            {/* Unified Trip Summary Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-lg bg-white/90 border border-sky-200/80 px-2.5 py-2">
                <div className="text-xs font-bold uppercase text-slate-500">Loaded</div>
                <div className="font-mono font-black text-sm text-slate-900">{totalLoadedItems} cs</div>
              </div>
              <div className="rounded-lg bg-white/90 border border-sky-200/80 px-2.5 py-2">
                <div className="text-xs font-bold uppercase text-slate-500">Sold</div>
                <div className="font-mono font-black text-sm text-emerald-700">{vanStockCounts.totalSoldCases} cs</div>
              </div>
              <div className="rounded-lg bg-white/90 border border-sky-200/80 px-2.5 py-2">
                <div className="text-xs font-bold uppercase text-slate-500">On Van</div>
                <div className="font-mono font-black text-sm text-sky-800">{vanStockCounts.totalAvailableCases} cs</div>
              </div>
              <div className="rounded-lg bg-white/90 border border-sky-200/80 px-2.5 py-2">
                <div className="text-xs font-bold uppercase text-slate-500">Trip Sales</div>
                <div className="font-mono font-black text-sm text-slate-900">
                  ₹{money(tripTotalBilled)}
                  <span className="text-xs font-bold text-emerald-700 ml-1">({tripBillsCount})</span>
                </div>
              </div>
            </div>

            {/* Systematic Trip Actions */}
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={onStartSelling}
                className="flex-1 sm:flex-none min-h-[40px] px-4 py-2 rounded-xl bg-sky-600 text-white font-black text-xs flex items-center justify-center gap-1.5 hover:bg-sky-700 cursor-pointer shadow-sm"
              >
                <ShoppingCart size={14} />
                <span>Start Selling</span>
              </button>
              <button
                type="button"
                id={`btn-salesman-edit-trip-${activeTrip.id}`}
                onClick={() => onOpenTripScreen('edit', activeTrip)}
                className="min-h-[40px] px-3.5 py-2 rounded-xl border-2 border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-black text-xs flex items-center justify-center cursor-pointer"
              >
                <span>View Load</span>
              </button>
              <button
                type="button"
                id="btn-salesman-end-trip"
                onClick={() => onOpenTripScreen('settle', activeTrip)}
                className="min-h-[40px] px-3.5 py-2 rounded-xl border-2 border-amber-500 bg-amber-100 text-amber-900 font-black text-xs flex items-center justify-center gap-1 hover:bg-amber-200 cursor-pointer"
              >
                <span>Close &amp; Settle</span>
              </button>
            </div>
          </div>
        ) : (
          <div
            data-card-tone="neutral"
            className="p-4 rounded-2xl border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <div className="hh-icon-badge hh-icon-badge--slate">
                <Truck size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-xs font-black uppercase tracking-wider">
                    No Active Run
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-500">
                    {todayStr}
                  </span>
                </div>
                <div className="text-xs font-semibold text-slate-600 mt-1">
                  No delivery vehicle is currently out on route. Tap “Load Trip” above to start a new run.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Other Open Active Dispatches (only shown when >1 active trips exist, never duplicates activeTrip) */}
        {otherOutTrips.length > 0 && (
          <div className="space-y-2.5 pt-1">
            <div className="text-xs font-black uppercase tracking-wider text-slate-500">
              Other Active Dispatches ({otherOutTrips.length})
            </div>
            {otherOutTrips.map((trip) => {
              const tripLoadTotal = Object.values(trip.loaded || {}).reduce((sum, q) => sum + (Number(q) || 0), 0);
              const billsForTrip = bills.filter((b) => b.tripId === trip.id || trip.billIds.includes(b.id));
              const totalTripBilled = billsForTrip.reduce((sum, b) => sum + (Number(b.total) || 0), 0);

              return (
                <div
                  key={trip.id}
                  id={`salesman-trip-item-${trip.id}`}
                  data-card-tone="sales"
                  className="p-3.5 sm:p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-base text-slate-900">
                        {trip.vehicle}
                      </span>
                      <span className="text-xs font-black uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        ● Out on Run
                      </span>
                      <span className="text-xs font-bold text-slate-500 font-mono">
                        {trip.date}
                      </span>
                      <span className="text-xs font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                        {resolveTripGodownDisplay({ trip, warehouses }).label || 'Main Godown'}
                      </span>
                    </div>

                    <div className="text-xs font-semibold text-slate-600 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span>Route: {trip.route || 'Delivery Route'} • Loaded: {tripLoadTotal} cases • Bills: {billsForTrip.length} (₹{money(totalTripBilled)})</span>
                      {(trip.driverPhone || trip.salesmanPhone) && (
                        <a
                          href={`tel:${(trip.driverPhone || trip.salesmanPhone || '').replace(/\s+/g, '')}`}
                          className="inline-flex items-center gap-1 text-sky-700 hover:text-sky-900 no-underline"
                        >
                          <Phone size={11} /> {trip.driverPhone || trip.salesmanPhone}
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center flex-wrap justify-end">
                    <button
                      type="button"
                      id={`btn-salesman-edit-trip-${trip.id}`}
                      onClick={() => onOpenTripScreen('edit', trip)}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl border-2 border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-black text-xs cursor-pointer"
                    >
                      View Load
                    </button>
                    <button
                      type="button"
                      id={`btn-salesman-settle-trip-${trip.id}`}
                      onClick={() => onOpenTripScreen('settle', trip)}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl border-2 border-amber-500 bg-amber-100 hover:bg-amber-200 text-amber-900 font-black text-xs cursor-pointer"
                    >
                      Close &amp; Settle
                    </button>
                    <button
                      type="button"
                      onClick={() => onSwitchActiveTrip(trip)}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-xl border-2 border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-black text-xs flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <span>Switch to this Run</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Past / Closed Trip History (separate from Active Run — never duplicates Out on Run) */}
        {olderOrClosedTrips.length > 0 && (
          <div className="space-y-2.5 pt-1 border-t border-slate-200/80">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="text-xs font-black uppercase tracking-wider text-slate-500">
                {showTripHistory ? `Trip History (${olderOrClosedTrips.length})` : 'Past Runs'}
              </div>
              <button
                type="button"
                id="btn-trips-view-toggle-history"
                onClick={() => setShowTripHistory(!showTripHistory)}
                className="text-xs font-black text-sky-700 hover:text-blue-900 underline flex items-center gap-1 cursor-pointer"
              >
                <HistoryIcon size={14} />
                <span>{showTripHistory ? 'Hide Trip History' : `Trip History (${olderOrClosedTrips.length} past runs)`}</span>
              </button>
            </div>

            {showTripHistory && (
              <>
                <input
                  type="search"
                  value={tripSearch}
                  onChange={(e) => {
                    setTripSearch(e.target.value);
                    setTripLimit(30);
                  }}
                  enterKeyHint="search"
                  placeholder="Search vehicle, route, date or trip no."
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border-2 text-sm font-semibold focus:outline-none focus:border-sky-600"
                  style={{ borderColor: palette.line }}
                />

                {shownHistoryTrips.length === 0 ? (
                  <div className="p-6 text-center rounded-xl border border-dashed text-xs font-semibold text-slate-500" style={{ borderColor: palette.line }}>
                    No past trips match "{tripSearch}".
                  </div>
                ) : (
                  shownHistoryTrips.map((trip) => {
                    const tripLoadTotal = Object.values(trip.loaded || {}).reduce((sum, q) => sum + (Number(q) || 0), 0);
                    const billsForTrip = bills.filter((b) => b.tripId === trip.id || trip.billIds.includes(b.id));
                    const totalTripBilled = billsForTrip.reduce((sum, b) => sum + (Number(b.total) || 0), 0);

                    return (
                      <div
                        key={trip.id}
                        id={`salesman-trip-item-${trip.id}`}
                        data-card-tone="neutral"
                        className="p-3.5 sm:p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                      >
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-base text-slate-900">
                              {trip.vehicle}
                            </span>
                            <span className="text-xs font-black uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                              Closed
                            </span>
                            <span className="text-xs font-bold text-slate-500 font-mono">
                              {trip.date}
                            </span>
                            <span className="text-xs font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                              {resolveTripGodownDisplay({ trip, warehouses }).label || 'Main Godown'}
                            </span>
                          </div>

                          <div className="text-xs font-semibold text-slate-600 mt-1">
                            Route: {trip.route || 'Delivery Route'} • Loaded: {tripLoadTotal} cases • Bills: {billsForTrip.length} (₹{money(totalTripBilled)})
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center flex-wrap justify-end">
                          <button
                            type="button"
                            id={`btn-salesman-edit-trip-${trip.id}`}
                            onClick={() => onOpenTripScreen('edit', trip)}
                            className="min-h-[36px] px-3 py-1 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer"
                          >
                            View Load
                          </button>
                          <span className="px-3 py-1 text-xs font-bold text-slate-500 bg-slate-100 rounded-lg">
                            Completed Run
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}

                {matchedHistoryTripsCount > shownHistoryTrips.length && (
                  <button
                    type="button"
                    onClick={() => setTripLimit((n) => n + 30)}
                    className="w-full min-h-[44px] rounded-xl border-2 border-slate-300 bg-white text-sm font-black text-slate-700 cursor-pointer hover:bg-slate-50"
                  >
                    Show more ({matchedHistoryTripsCount - shownHistoryTrips.length} older)
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
