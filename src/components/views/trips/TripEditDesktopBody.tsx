import React from 'react';
import { AlertTriangle, FileCheck, Phone, Plus, Receipt, RotateCcw, Search, X } from 'lucide-react';
import { Bill, Product, Salesman, Trip, TripStatus, Warehouse } from '../../../types';
import { todayISO, toLocalISODate } from '../../../utils/dateLocal';
import { LoadLineCard, LockedBanner, StatsStrip, fieldBox, fieldLabel } from './LoadSheetParts';

interface TripEditDesktopBodyProps {
  trip: Trip;
  products: Product[];
  bills: Bill[];
  salesmen: Salesman[];
  warehouses: Warehouse[];
  readOnly: boolean;
  reopensOnSave: boolean;
  onReopenTripNow?: (tripId: number) => void;
  onManageBills?: (trip: Trip) => void;
  error: string | null;
  vehicle: string;
  setVehicle: (v: string) => void;
  date: string;
  setDate: (v: string) => void;
  salesmanId: string;
  setSalesmanId: (v: string) => void;
  salesmanName: string;
  salesmanPhone: string;
  setSalesmanPhone: (v: string) => void;
  driver: string;
  setDriver: (v: string) => void;
  driverPhone: string;
  setDriverPhone: (v: string) => void;
  warehouseId: string;
  handleGodownChange: (id: string) => void;
  godownMoveHint: string | null;
  status: TripStatus;
  setStatus: (s: TripStatus) => void;
  autoAttachBills: boolean;
  setAutoAttachBills: (v: boolean) => void;
  pendingBills: Bill[];
  totalLoaded: number;
  totalSold: number;
  totalValue: number;
  shortValue: (n: number) => string;
  activeProductIds: number[];
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  filter: 'all' | 'billed' | 'unbilled' | 'low';
  setFilter: (f: 'all' | 'billed' | 'unbilled' | 'low') => void;
  counts: { billed: number; unbilled: number; low: number };
  shownIds: number[];
  loaded: Record<number, string>;
  soldByProduct: Record<number, number>;
  pendingByProduct: Record<number, number>;
  stockHere: (pid: number) => number;
  stockAll: (pid: number) => number;
  setShowAdd: (v: boolean) => void;
  handleSetQtyDirect: (pid: number, val: string) => void;
  handleUpdateQty: (pid: number, delta: number) => void;
  handleRemoveProduct: (pid: number) => void;
}

const chip = (on: boolean) =>
  `shrink-0 min-h-[36px] px-3 rounded-full border text-[12px] font-bold whitespace-nowrap cursor-pointer ${
    on ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-black/15'
  }`;

export const TripEditDesktopBody: React.FC<TripEditDesktopBodyProps> = ({
  trip,
  products,
  bills,
  salesmen,
  warehouses,
  readOnly,
  reopensOnSave,
  onReopenTripNow,
  onManageBills,
  error,
  vehicle,
  setVehicle,
  date,
  setDate,
  salesmanId,
  setSalesmanId,
  salesmanName,
  salesmanPhone,
  setSalesmanPhone,
  driver,
  setDriver,
  driverPhone,
  setDriverPhone,
  warehouseId,
  handleGodownChange,
  godownMoveHint,
  status,
  setStatus,
  autoAttachBills,
  setAutoAttachBills,
  pendingBills,
  totalLoaded,
  totalSold,
  totalValue,
  shortValue,
  activeProductIds,
  searchTerm,
  setSearchTerm,
  filter,
  setFilter,
  counts,
  shownIds,
  loaded,
  soldByProduct,
  pendingByProduct,
  stockHere,
  stockAll,
  setShowAdd,
  handleSetQtyDirect,
  handleUpdateQty,
  handleRemoveProduct,
}) => (
  <div id="trip-edit-scroll" className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain">
    <div className="mx-auto w-full max-w-xl px-3 pt-3 pb-6 space-y-3">
      {(reopensOnSave || status === 'closed' || trip.status === 'closed') && !readOnly && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3.5 flex items-center justify-between flex-wrap gap-2 text-[13px] text-amber-950 shadow-xs">
          <div className="min-w-0 flex-1">
            <div className="font-extrabold flex items-center gap-1.5 text-amber-900">
              <RotateCcw size={15} /> Completed / Closed Trip
            </div>
            <div className="text-xs text-amber-800 mt-0.5 leading-relaxed">
              {status === 'out'
                ? 'Reopen pending: saving this trip will reactivate it so vehicle stock and attached bills can be edited.'
                : 'This trip is completed and reconciled. Reopen it to Active to allow modifying crates or attached bills.'}
            </div>
          </div>
          {status === 'closed' && onReopenTripNow && (
            <button
              type="button"
              id="btn-instant-reopen-trip-screen"
              onClick={() => {
                onReopenTripNow(Number(trip.id));
                setStatus('out');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--flow-accent)] hover:bg-[var(--flow-accent-hover)] text-white font-bold text-xs cursor-pointer shadow-sm active:scale-95 transition-all"
            >
              <RotateCcw size={14} /> Reopen Trip Now
            </button>
          )}
        </div>
      )}
      {readOnly && <LockedBanner>Only the owner can change this load once it is saved. You can look at it and record returns.</LockedBanner>}

      {error && (
        <div role="alert" className="flex items-start gap-2 p-3 rounded-2xl border border-rose-200 bg-rose-50 text-rose-800 text-[13px] font-bold">
          <AlertTriangle size={17} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Trip details: every field in one place */}
      <section className="rounded-2xl border border-black/10 bg-white p-3">
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label htmlFor="edit-vehicle" className={fieldLabel}>Vehicle *</label>
            <input
              id="edit-vehicle"
              type="text"
              value={vehicle}
              disabled={readOnly}
              onChange={(e) => setVehicle(e.target.value)}
              placeholder="e.g. EV"
              className={fieldBox}
            />
          </div>
          <div>
            <label htmlFor="edit-trip-date" className={fieldLabel}>Trip date *</label>
            <input
              id="edit-trip-date"
              type="date"
              value={date}
              disabled={readOnly}
              onChange={(e) => setDate(e.target.value)}
              className={fieldBox}
            />
          </div>
          <div>
            <label htmlFor="edit-salesman" className={fieldLabel}>Salesman</label>
            <select
              id="edit-salesman"
              value={salesmanId}
              disabled={readOnly}
              onChange={(e) => {
                const nextId = e.target.value;
                setSalesmanId(nextId);
                const sm = salesmen.find((s) => s.id === nextId);
                if (sm?.phone) setSalesmanPhone(sm.phone);
              }}
              className={fieldBox}
            >
              <option value="">{salesmanName && !salesmanId ? salesmanName : 'Choose…'}</option>
              {salesmen.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="edit-salesman-phone" className={fieldLabel}>Salesman phone</label>
              {salesmanPhone.trim() && (
                <a
                  href={`tel:${salesmanPhone.trim().replace(/\s+/g, '')}`}
                  className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 mb-1 no-underline"
                >
                  <Phone size={11} /> Call
                </a>
              )}
            </div>
            <input
              id="edit-salesman-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={salesmanPhone}
              disabled={readOnly}
              onChange={(e) => setSalesmanPhone(e.target.value)}
              placeholder="10-digit mobile"
              className={fieldBox}
            />
          </div>
          <div>
            <label htmlFor="edit-driver" className={fieldLabel}>Driver</label>
            <input
              id="edit-driver"
              type="text"
              value={driver}
              disabled={readOnly}
              onChange={(e) => setDriver(e.target.value)}
              placeholder="Driver name"
              className={fieldBox}
            />
          </div>
          <div>
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="edit-driver-phone" className={fieldLabel}>Driver phone</label>
              {driverPhone.trim() && (
                <a
                  href={`tel:${driverPhone.trim().replace(/\s+/g, '')}`}
                  className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 mb-1 no-underline"
                >
                  <Phone size={11} /> Call
                </a>
              )}
            </div>
            <input
              id="edit-driver-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={driverPhone}
              disabled={readOnly}
              onChange={(e) => setDriverPhone(e.target.value)}
              placeholder="10-digit mobile"
              className={fieldBox}
            />
          </div>
          <div className="col-span-2">
            <label htmlFor="edit-warehouse" className={fieldLabel}>Source godown *</label>
            <select id="edit-warehouse" value={warehouseId} disabled={readOnly} onChange={(e) => handleGodownChange(e.target.value)} className={fieldBox}>
              {warehouses.length === 0 && <option value="">Main Godown</option>}
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
            {godownMoveHint && <p className="mt-1 text-xs text-slate-600">{godownMoveHint}</p>}
          </div>
        </div>

        {!readOnly && (
          <div className="mt-3 pt-3 border-t border-black/5 flex items-center justify-between flex-wrap gap-2.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">Date:</span>
              <button type="button" onClick={() => setDate(todayISO())} className={chip(date === todayISO())}>Today</button>
              <button type="button" onClick={() => setDate(toLocalISODate(new Date(Date.now() - 86400000)))} className={chip(date === toLocalISODate(new Date(Date.now() - 86400000)))}>
                Yesterday
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status:</span>
              <div className="inline-flex max-w-full rounded-full p-0.5 bg-slate-100 border border-slate-200 text-xs font-bold">
                <button
                  type="button"
                  id="btn-edit-status-out"
                  onClick={() => setStatus('out')}
                  className={`px-3 py-1.5 rounded-full cursor-pointer transition-all ${
                    status === 'out' ? 'bg-[var(--flow-accent)] text-white shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Set trip to Active / Out on road"
                >
                  Active
                </button>
                <button
                  type="button"
                  id="btn-edit-status-closed"
                  onClick={() => setStatus('closed')}
                  disabled={trip.status !== 'closed'}
                  className={`px-3 py-1.5 rounded-full transition-all ${
                    status === 'closed' ? 'bg-slate-800 text-white shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
                  } ${trip.status !== 'closed' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  title={trip.status !== 'closed' ? 'Close a trip with Day-end settlement' : 'Set trip to Completed / Closed'}
                >
                  Completed
                </button>
              </div>
            </div>
          </div>
        )}

        <label className={`mt-3 flex items-center gap-2.5 text-[13px] font-semibold text-slate-700 select-none ${readOnly ? 'opacity-60' : 'cursor-pointer'}`}>
          <input
            type="checkbox"
            checked={autoAttachBills}
            disabled={readOnly}
            onChange={(e) => setAutoAttachBills(e.target.checked)}
            className="size-5 rounded accent-[var(--flow-accent)]"
          />
          <span>Attach bills of this date</span>
          {pendingBills.length > 0 && (
            <span className="text-xs font-black text-[var(--flow-accent)] bg-[var(--flow-accent-soft)] px-2 py-0.5 rounded-full">{pendingBills.length} ready</span>
          )}
        </label>
      </section>

      <StatsStrip
        items={[
          { label: 'Loaded', value: String(totalLoaded), tone: 'green' },
          { label: 'Billed', value: String(totalSold) },
          { label: 'On van', value: String(Math.max(0, totalLoaded - totalSold)), tone: 'amber' },
          { label: 'Value', value: shortValue(totalValue) },
        ]}
      />

      {/* Search + filters */}
      {activeProductIds.length > 4 && (
        <div className="space-y-2">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              enterKeyHint="search"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search loaded items…"
              className="w-full min-h-[46px] pl-9 pr-9 rounded-xl border border-black/15 bg-white text-[15px] focus:outline-none focus:ring-2 focus:ring-[var(--flow-accent)]/30"
            />
            {searchTerm && (
              <button type="button" onClick={() => setSearchTerm('')} aria-label="Clear search" className="absolute right-1.5 top-1/2 -translate-y-1/2 size-9 flex items-center justify-center text-slate-400 cursor-pointer">
                <X size={16} />
              </button>
            )}
          </div>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            <button type="button" onClick={() => setFilter('all')} className={chip(filter === 'all')}>All {activeProductIds.length}</button>
            <button type="button" onClick={() => setFilter('billed')} className={chip(filter === 'billed')}>Billed {counts.billed}</button>
            <button type="button" onClick={() => setFilter('unbilled')} className={chip(filter === 'unbilled')}>Not billed {counts.unbilled}</button>
            {counts.low > 0 && (
              <button type="button" onClick={() => setFilter('low')} className={chip(filter === 'low')}>Low ⚠ {counts.low}</button>
            )}
          </div>
        </div>
      )}

      {/* Product cards */}
      <section className="space-y-2" aria-label="Loaded beverages">
        {!readOnly && activeProductIds.length > 0 && (
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">
              Loaded products · {activeProductIds.length}
            </span>
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-1 rounded-xl border border-[var(--flow-accent)]/40 bg-white px-3 py-1.5 text-xs font-black text-[var(--flow-accent)] hover:bg-emerald-50 cursor-pointer"
            >
              <Plus size={14} /> Add product
            </button>
          </div>
        )}
        {activeProductIds.length === 0 && (
          <button
            type="button"
            disabled={readOnly}
            onClick={() => !readOnly && setShowAdd(true)}
            className="w-full rounded-2xl border-2 border-dashed border-black/20 bg-white px-4 py-8 text-center text-sm text-slate-500 cursor-pointer disabled:cursor-default hover:border-[var(--flow-accent)]/50"
          >
            Nothing loaded yet. {readOnly ? '' : 'Tap here or “Add products” below.'}
          </button>
        )}
        {activeProductIds.length > 0 && shownIds.length === 0 && (
          <div className="rounded-2xl border border-black/10 bg-white px-4 py-6 text-center text-sm text-slate-500">No items match.</div>
        )}
        {shownIds.map((pid) => {
          const prod = products.find((p) => p.id === pid);
          const cur = Number(loaded[pid]) || 0;
          const sold = soldByProduct[pid] || 0;
          const pending = pendingByProduct[pid] || 0;
          const tooLow = sold + pending > cur;
          const here = stockHere(pid);
          const other = stockAll(pid) - here;
          return (
            <LoadLineCard
              key={pid}
              product={prod}
              fallbackName={`Product #${pid}`}
              qty={loaded[pid] ?? ''}
              onQty={(v) => handleSetQtyDirect(pid, v)}
              onMinus={() => handleUpdateQty(pid, -1)}
              onPlus={() => handleUpdateQty(pid, 1)}
              onRemove={() => handleRemoveProduct(pid)}
              readOnly={readOnly}
              problem={tooLow}
              facts={[
                { label: 'Godown', value: `${here} cs${other > 0 ? ` (+${other} other)` : ''}` },
                { label: 'Billed', value: `${sold + pending} cs`, bad: tooLow },
              ]}
              warning={tooLow ? 'Load is less than billed' : undefined}
            />
          );
        })}
      </section>

      {/* Bills on this trip */}
      <section className="rounded-2xl border border-black/10 bg-white p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[13px] font-black text-slate-900">
            <Receipt size={16} className="text-[var(--flow-accent)]" />
            Bills on this trip ({trip.billIds?.length || 0})
          </div>
          {onManageBills && !readOnly && (
            <button type="button" onClick={() => onManageBills(trip)} className="min-h-[40px] px-2 text-xs font-black text-[var(--flow-accent)] underline cursor-pointer">
              Manage →
            </button>
          )}
        </div>
        {trip.billIds && trip.billIds.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {trip.billIds.map((bid) => {
              const bill = bills.find((b) => b.id === bid);
              return (
                <span key={bid} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 font-semibold text-xs">
                  <FileCheck size={13} className="text-[var(--flow-accent)]" />
                  #{bid} {bill ? `· ${bill.retailer}` : ''} ({bill?.items?.reduce((s, i) => s + i.qty, 0) || 0} cs)
                </span>
              );
            })}
          </div>
        ) : (
          <p className="mt-1.5 text-xs text-slate-400 italic">No bills attached yet.</p>
        )}
      </section>
    </div>
  </div>
);
