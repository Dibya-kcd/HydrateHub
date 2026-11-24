import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ArrowLeft, CheckCircle2, Plus, RotateCcw, Save, X } from 'lucide-react';
import { ActionBar, AddProductsSheet, DiscardSheet, ReviewSheet } from './trips/LoadSheetParts';
import { FlowBadge, FlowHeader } from '../common/FlowKit';
import { ConfirmModal } from '../ui';
import { Bill, Product, Trip, TripStatus, Warehouse, Salesman } from '../../types';
import { rebalanceWarehouseLoads, tripPrimaryWarehouseId } from '../../utils/tripLoads';
import { billBelongsToTrip, attachableBillsForTrip } from '../../utils/billing';
import { todayISO, toLocalISODate } from "../../utils/dateLocal";
import { compareProductsInSequence } from '../../utils/sizeColor';
import { validatePhone } from '../../utils/validation';
import { useIsMobile } from '../../hooks/useIsMobile';
import { TripEditPhoneCompletedView } from './trips/TripEditPhoneCompletedView';
import { TripEditDesktopBody } from './trips/TripEditDesktopBody';

interface TripEditScreenProps {
  trip: Trip;
  products: Product[];
  bills: Bill[];
  salesmen?: Salesman[];
  warehouses?: Warehouse[];
  warehouseStock?: (warehouseId: string, productId?: number) => number;
  /** All trips, so auto-attach can skip bills that already belong to another trip. */
  allTrips?: Trip[];
  /** Extra check on the edited load (e.g. free stock). Return an error message to block the save. */
  validateLoad?: (
    trip: Trip,
    newLoaded: Record<number, number>,
    billedAfterSave: Record<number, number>,
    /** The per-godown split the trip will have after saving, so each godown is checked on its own. */
    newSplit?: Record<string, Record<number, number>>,
  ) => string | null;
  onBack: () => void;
  onSave: (updated: Trip, reason?: string) => void;
  onRecordReturn?: (trip: Trip) => void;
  onManageBills?: (trip: Trip) => void;
  /** Trip was completed: saving this edit reopens it (moves it back to Active). */
  reopensOnSave?: boolean;
  /** Instant 1-click reopen of a completed trip directly from the edit banner. */
  onReopenTripNow?: (tripId: number) => void;
  /**
   * View-only: same screen, fields and steppers locked, no add / save. Used for the salesman, because
   * only the owner may change a trip once it is saved. Return & settle stays available.
   */
  readOnly?: boolean;
}

/**
 * Keeps a trip's per-godown split (warehouseLoads) in step with the edited total load
 */
function toStandardIsoDate(input?: string): string {
  if (!input) return todayISO();
  const trimmed = String(input).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parts = trimmed.split(/[-/]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      const y = parts[0];
      const m = parts[1].padStart(2, '0');
      const d = parts[2].padStart(2, '0');
      return `${y}-${m}-${d}`;
    } else if (parts[2].length === 4) {
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      const y = parts[2];
      return `${y}-${m}-${d}`;
    }
  }
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return toLocalISODate(parsed);
  }
  return todayISO();
}

export const TripEditScreen: React.FC<TripEditScreenProps> = ({
  trip,
  products,
  bills,
  salesmen = [],
  warehouses = [],
  warehouseStock,
  allTrips = [],
  validateLoad,
  onBack,
  onSave,
  onRecordReturn,
  onManageBills,
  reopensOnSave = false,
  onReopenTripNow,
  readOnly = false,
}) => {
  const isPhone = useIsMobile(767);
  const [vehicle, setVehicle] = useState(trip.vehicle || '');
  const [warehouseId, setWarehouseId] = useState(tripPrimaryWarehouseId(trip) || (warehouses[0]?.id ?? ''));
  const [date, setDate] = useState(() => toStandardIsoDate(trip.date));
  const [autoAttachBills, setAutoAttachBills] = useState(true);
  const [salesmanId, setSalesmanId] = useState(trip.salesmanId || '');
  const [salesmanPhone, setSalesmanPhone] = useState(
    trip.salesmanPhone || salesmen.find((s) => s.id === trip.salesmanId)?.phone || '',
  );
  const [driver, setDriver] = useState(trip.driver || '');
  const [driverPhone, setDriverPhone] = useState(trip.driverPhone || '');
  const [status, setStatus] = useState<TripStatus>(trip.status || 'out');
  const [loaded, setLoaded] = useState<Record<number, string>>({});
  const [returned, setReturned] = useState<Record<number, string>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'billed' | 'unbilled' | 'low'>('all');
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [reviewTrip, setReviewTrip] = useState<Trip | null>(null);
  const [pendingConfirmTrip, setPendingConfirmTrip] = useState<Trip | null>(null);
  const [askDiscard, setAskDiscard] = useState(false);
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [editingProdId, setEditingProdId] = useState<number | null>(null);

  // What the screen looked like when it opened, to know whether Cancel needs a "lose changes?" question.
  const snapshot = (
    v: string,
    w: string,
    d: string,
    sm: string,
    smp: string,
    dr: string,
    drp: string,
    st: string,
    l: Record<number, string>,
  ) =>
    JSON.stringify([
      v.trim(),
      w,
      d,
      sm,
      smp.trim(),
      dr.trim(),
      drp.trim(),
      st,
      Object.entries(l).filter(([, q]) => Number(q) > 0).sort(([a], [b]) => Number(a) - Number(b)).map(([k, q]) => [k, Number(q)]),
    ]);
  const baseSnap = useRef<string>('');

  // Initialize from trip props ONLY when a different trip is opened.
  // Previously this depended on [trip, warehouses]; the background cloud sync (every ~25s, on
  // focus, after any save) hands down a new `warehouses`/`trip` object reference, which re-ran
  // this and wiped every unsaved edit (e.g. a product just added to the load sheet).
  const initializedTripId = useRef<number | string | null>(null);
  useEffect(() => {
    if (initializedTripId.current === trip.id) return;
    initializedTripId.current = trip.id;
    const wh = tripPrimaryWarehouseId(trip) || (warehouses[0]?.id ?? '');
    const dt = toStandardIsoDate(trip.date);
    const initSmPhone = trip.salesmanPhone || salesmen.find((s) => s.id === trip.salesmanId)?.phone || '';
    const initDriver = trip.driver || '';
    const initDriverPhone = trip.driverPhone || '';
    setVehicle(trip.vehicle || '');
    setWarehouseId(wh);
    setDate(dt);
    setSalesmanId(trip.salesmanId || '');
    setSalesmanPhone(initSmPhone);
    setDriver(initDriver);
    setDriverPhone(initDriverPhone);
    setStatus(trip.status || 'out');

    const initLoaded: Record<number, string> = {};
    for (const [pid, qty] of Object.entries(trip.loaded || {})) {
      initLoaded[Number(pid)] = String(qty);
    }
    setLoaded(initLoaded);

    const initReturned: Record<number, string> = {};
    for (const [pid, qty] of Object.entries(trip.returned || {})) {
      initReturned[Number(pid)] = String(qty);
    }
    setReturned(initReturned);
    setError(null);
    baseSnap.current = snapshot(
      trip.vehicle || '',
      wh,
      dt,
      trip.salesmanId || '',
      initSmPhone,
      initDriver,
      initDriverPhone,
      trip.status || 'out',
      initLoaded,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.id]);

  // Warehouses may load after the screen opens: only fill in a default, never overwrite a choice.
  useEffect(() => {
    if (!warehouseId && warehouses[0]?.id) setWarehouseId(warehouses[0].id);
  }, [warehouses, warehouseId]);

  const dirty =
    !readOnly &&
    baseSnap.current !== '' &&
    snapshot(vehicle, warehouseId, date, salesmanId, salesmanPhone, driver, driverPhone, status, loaded) !== baseSnap.current;

  // Bills that will be attached when this edit is saved (same date / salesman / van, not on any
  // other trip). Computed once so the Billed column, the load check and the save all agree.
  const pendingBills = useMemo(() => {
    if (!autoAttachBills) return [] as Bill[];
    return attachableBillsForTrip(
      { id: trip.id, date, salesmanId: salesmanId || undefined, vehicle: vehicle.trim() },
      bills,
      allTrips,
    ).filter((b) => !billBelongsToTrip(trip, b));
  }, [autoAttachBills, trip, date, salesmanId, vehicle, bills, allTrips]);

  const sumByProduct = (list: Bill[]) => {
    const res: Record<number, number> = {};
    for (const bill of list) {
      for (const item of bill.items || []) {
        const pid = Number(item.productId);
        res[pid] = (res[pid] || 0) + (Number(item.qty) || 0);
      }
    }
    return res;
  };

  // Already on this trip. Uses the same ownership rule as van stock and the return screen
  // (bill.tripId wins, else trip.billIds), so the numbers here match the discrepancy later.
  const soldByProduct = useMemo(
    () => sumByProduct(bills.filter((b) => billBelongsToTrip(trip, b))),
    [trip, bills],
  );
  const pendingByProduct = useMemo(() => sumByProduct(pendingBills), [pendingBills]);
  const billedAfterSave = useMemo(() => {
    const res: Record<number, number> = { ...soldByProduct };
    for (const [pid, q] of Object.entries(pendingByProduct)) res[Number(pid)] = (res[Number(pid)] || 0) + q;
    return res;
  }, [soldByProduct, pendingByProduct]);

  const activeProductIds = useMemo(() => Object.keys(loaded).map(Number), [loaded]);

  // One definition of stock, used by the add sheet, the cards and the add check, so the numbers
  // always agree: stock in the selected godown, and stock in all godowns (same rule as New Trip).
  const stockHere = useCallback(
    (pid: number) => (typeof warehouseStock === 'function' && warehouseId ? warehouseStock(warehouseId, pid) : 0),
    [warehouseStock, warehouseId],
  );
  const stockAll = useCallback(
    (pid: number) =>
      typeof warehouseStock === 'function'
        ? warehouses.reduce((sum, w) => sum + warehouseStock(w.id, pid), 0)
        : 0,
    [warehouseStock, warehouses],
  );

  const nameOf = (pid: number) => products.find((x) => x.id === pid)?.name || `Product #${pid}`;

  // Same free-stock rule that Save applies, run at the moment a load goes up, so a bad quantity
  // is caught on Add / "+" instead of only after the whole sheet is filled in.
  const checkLoadChange = (pid: number, newQty: number, base: Record<number, string> = loaded): string | null => {
    const before = Number(trip.loaded?.[pid]) || 0;
    if (newQty <= before) return null;
    const next: Record<number, number> = {};
    for (const [k, v] of Object.entries(base)) {
      const n = Number(v);
      if (n > 0) next[Number(k)] = n;
    }
    next[pid] = newQty;
    if (validateLoad) return validateLoad(trip, next, billedAfterSave, rebalanceWarehouseLoads(trip.warehouseLoads, next, warehouseId, billedAfterSave));
    const avail = stockAll(pid);
    return newQty - before > avail ? `${nameOf(pid)}: only ${avail} in stock.` : null;
  };

  const handleUpdateQty = (pid: number, delta: number) => {
    if (readOnly) return;
    if (delta < 0) {
      const billed = billedAfterSave[pid] || 0;
      if ((Number(loaded[pid]) || 0) + delta < billed) {
        setError(`${nameOf(pid)}: ${billed} already billed on this trip, so the load cannot go below ${billed}.`);
        return;
      }
      setError(null);
    }
    if (delta > 0) {
      const problem = checkLoadChange(pid, (Number(loaded[pid]) || 0) + delta);
      if (problem) {
        setError(problem);
        return;
      }
      setError(null);
    }
    setLoaded((prev) => {
      const current = Number(prev[pid]) || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const copy = { ...prev };
        delete copy[pid];
        return copy;
      }
      return { ...prev, [pid]: String(next) };
    });
  };

  const handleSetQtyDirect = (pid: number, val: string) => {
    if (readOnly) return;
    // Whole cases only: no minus sign, decimal point or letters (the New trip screen enforces the same).
    const digits = val.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
    setLoaded((prev) => ({ ...prev, [pid]: digits }));
  };

  const handleRemoveProduct = (pid: number) => {
    const billed = billedAfterSave[pid] || 0;
    if (billed > 0) {
      setError(`${nameOf(pid)}: ${billed} already billed on this trip, so it cannot be removed from the load sheet.`);
      return;
    }
    setLoaded((prev) => {
      const next = { ...prev };
      delete next[pid];
      return next;
    });
    setReturned((prev) => {
      const next = { ...prev };
      delete next[pid];
      return next;
    });
  };

  // Add several products at once from the sheet. Each is checked with the same rule as "+".
  const handleAddPicks = (picks: Record<number, number>): string | null => {
    const merged: Record<number, string> = { ...loaded };
    for (const [pidStr, qty] of Object.entries(picks)) {
      const pid = Number(pidStr);
      if (qty <= 0) continue;
      const problem = checkLoadChange(pid, qty, merged);
      if (problem) return problem;
      merged[pid] = String(qty);
    }
    setLoaded(merged);
    setError(null);
    setShowAdd(false);
    return null;
  };

  // Totals calculations
  const totalLoaded = useMemo(() => Object.values(loaded).reduce((acc, q) => acc + (Number(q) || 0), 0), [loaded]);
  const totalSold = useMemo(() => Object.values(billedAfterSave).reduce((acc, q) => acc + q, 0), [billedAfterSave]);
  const totalValue = useMemo(() => {
    let sum = 0;
    for (const [pidStr, qStr] of Object.entries(loaded)) {
      const prod = products.find((p) => p.id === Number(pidStr));
      if (prod) sum += (Number(qStr) || 0) * (prod.wholesale || prod.retail || 0);
    }
    return sum;
  }, [loaded, products]);

  const shortValue = (n: number) => (n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : n >= 1000 ? `₹${(n / 1000).toFixed(1)}k` : `₹${Math.round(n)}`);

  // Changing the source godown moves the van's unsold crates to it (billed crates stay where they were drawn from),
  // so the same per-godown stock check as on Save runs right away instead of only when the sheet is saved.
  const handleGodownChange = (id: string) => {
    setWarehouseId(id);
    if (readOnly || !validateLoad) return;
    const current: Record<number, number> = {};
    for (const [k, v] of Object.entries(loaded)) {
      const n = Number(v);
      if (n > 0) current[Number(k)] = n;
    }
    const problem = validateLoad(trip, current, billedAfterSave, rebalanceWarehouseLoads(trip.warehouseLoads, current, id, billedAfterSave));
    setError(problem);
  };

  const godownMoveHint = (() => {
    const ids = Object.keys(trip.warehouseLoads || {});
    if (readOnly || ids.length !== 1 || !warehouseId || warehouseId === ids[0]) return null;
    const nm = (id: string) => warehouses.find((w) => w.id === id)?.name || 'Main Godown';
    return `Unsold crates on this van will come from ${nm(warehouseId)} instead of ${nm(ids[0])}. Crates already billed stay with ${nm(ids[0])}.`;
  })();

  /** Runs every save check. Returns an error message, or the trip ready to save. */
  const buildUpdatedTrip = (): { error: string } | { trip: Trip } => {
    if (!vehicle.trim()) return { error: 'Please enter a vehicle name or registration number.' };
    // Closing here would skip the stock return and cash check that Close Trip does, leaving the cash and
    // any missing crates unrecorded. An open trip is closed from Return & Settle only.
    if (trip.status !== 'closed' && status === 'closed') {
      return { error: 'To complete this trip use “Day-end settlement” on the Trips list. It records the returned crates and the cash handed over.' };
    }
    if (!date) return { error: 'Please select a valid trip date.' };
    if (salesmanPhone.trim()) {
      const spErr = validatePhone(salesmanPhone, { label: 'Salesman phone' });
      if (spErr) return { error: spErr };
    }
    if (driverPhone.trim()) {
      const dpErr = validatePhone(driverPhone, { label: 'Driver phone' });
      if (dpErr) return { error: dpErr };
    }

    const cleanLoaded: Record<number, number> = {};
    for (const [pid, val] of Object.entries(loaded)) {
      const num = Number(val);
      if (num > 0) cleanLoaded[Number(pid)] = num;
    }
    if (Object.keys(cleanLoaded).length === 0) {
      return { error: 'Load sheet must contain at least one beverage with quantity > 0.' };
    }

    // The load can never be cut below what is billed on this trip, counting the bills this save
    // is about to attach too; otherwise the trip would show crates sold that were never loaded.
    for (const [pidStr, billed] of Object.entries(billedAfterSave)) {
      const pid = Number(pidStr);
      if (billed > (cleanLoaded[pid] || 0)) {
        return { error: `${nameOf(pid)}: ${billed} billed on this trip, so the load cannot be less than ${billed}.` };
      }
    }

    const newSplit = rebalanceWarehouseLoads(trip.warehouseLoads, cleanLoaded, warehouseId, billedAfterSave);
    const stockError = validateLoad ? validateLoad(trip, cleanLoaded, billedAfterSave, newSplit) : null;
    if (stockError) return { error: stockError };

    // Clean returned map, preserving existing counts
    const cleanReturned: Record<number, number> = {};
    for (const pid of Object.keys(cleanLoaded)) {
      const numPid = Number(pid);
      if (returned[numPid] !== undefined && Number(returned[numPid]) >= 0) {
        cleanReturned[numPid] = Number(returned[numPid]);
      } else if (trip.returned && trip.returned[numPid] !== undefined) {
        cleanReturned[numPid] = Number(trip.returned[numPid]);
      }
    }
    for (const [pidStr, r] of Object.entries(cleanReturned)) {
      const pid = Number(pidStr);
      if (r > (cleanLoaded[pid] || 0)) {
        return { error: `${nameOf(pid)}: ${r} returned is more than the ${cleanLoaded[pid] || 0} loaded.` };
      }
    }

    const matchedSalesman = salesmen.find((s) => s.id === salesmanId);
    const finalBillIds = Array.from(
      new Set([...(trip.billIds || []).map(Number), ...pendingBills.map((b) => Number(b.id))]),
    );

    return {
      trip: {
        ...trip,
        vehicle: vehicle.trim(),
        date,
        status,
        salesmanId: salesmanId || undefined,
        salesman: matchedSalesman ? matchedSalesman.name : trip.salesman,
        salesmanPhone: salesmanPhone.trim() || undefined,
        driver: driver.trim() || undefined,
        driverPhone: driverPhone.trim() || undefined,
        warehouseId: warehouseId || undefined,
        warehouseLoads: newSplit,
        loaded: cleanLoaded,
        returned: cleanReturned,
        billIds: finalBillIds,
      },
    };
  };

  const openReview = () => {
    setError(null);
    const res = buildUpdatedTrip();
    if ('error' in res) {
      setError(res.error);
      document.getElementById('trip-edit-scroll')?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setReviewTrip(res.trip);
  };

  const handleCancel = () => (dirty ? setAskDiscard(true) : onBack());

  const selectedWarehouse = warehouses.find((w) => w.id === warehouseId);
  const salesmanName = salesmen.find((s) => s.id === salesmanId)?.name || trip.salesman || '';

  // ---- list filtering ----
  const q = searchTerm.trim().toLowerCase();
  const counts = {
    billed: activeProductIds.filter((pid) => (billedAfterSave[pid] || 0) > 0).length,
    unbilled: activeProductIds.filter((pid) => !(billedAfterSave[pid] > 0)).length,
    low: activeProductIds.filter((pid) => (billedAfterSave[pid] || 0) > (Number(loaded[pid]) || 0)).length,
  };
  const shownIds = activeProductIds
    .filter((pid) => {
      if (q && !nameOf(pid).toLowerCase().includes(q)) return false;
      const billed = billedAfterSave[pid] || 0;
      if (filter === 'billed') return billed > 0;
      if (filter === 'unbilled') return billed <= 0;
      if (filter === 'low') return billed > (Number(loaded[pid]) || 0);
      return true;
    })
    .sort((a, b) =>
      compareProductsInSequence(
        products.find((p) => p.id === a) || { name: nameOf(a) },
        products.find((p) => p.id === b) || { name: nameOf(b) },
      ),
    );

  const reviewRows = reviewTrip
    ? Object.entries(reviewTrip.loaded || {})
        .map(([pidStr, qty]) => {
          const pid = Number(pidStr);
          const before = Number(trip.loaded?.[pid]) || 0;
          const billed = billedAfterSave[pid] || 0;
          const changed = before !== qty;
          return {
            key: pidStr,
            name: nameOf(pid),
            product: products.find((p) => p.id === pid),
            qty,
            note: changed ? (before === 0 ? 'New on this trip' : `was ${before} → now ${qty}`) : billed > 0 ? `Billed ${billed} cs` : undefined,
            noteTone: changed ? ('changed' as const) : ('normal' as const),
          };
        })
        .sort((a, b) =>
          compareProductsInSequence(
            a.product || { name: a.name },
            b.product || { name: b.name },
          ),
        )
    : [];

  const isCompletedEdit = reopensOnSave || status === 'closed' || trip.status === 'closed';

  const sharedModals = (
    <>
      {showAdd && !readOnly && (
        <AddProductsSheet
          products={products}
          added={Object.fromEntries(Object.entries(loaded).filter(([, v]) => Number(v) > 0).map(([k, v]) => [Number(k), Number(v)]))}
          stockOf={(pid) => stockAll(pid)}
          stockText={(pid) => {
            const here = stockHere(pid);
            const other = stockAll(pid) - here;
            return `${here} cs in ${selectedWarehouse?.name || 'godown'}${other > 0 ? ` (+${other} other)` : ''}`;
          }}
          onConfirm={handleAddPicks}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {reviewTrip && (
        <ReviewSheet
          title={`Review trip #${trip.id}`}
          facts={[
            { label: 'Vehicle', value: reviewTrip.vehicle },
            { label: 'Date', value: reviewTrip.date },
            { label: 'Salesman', value: [salesmanName, reviewTrip.salesmanPhone].filter(Boolean).join(' · ') || 'Unassigned' },
            ...(reviewTrip.driver || reviewTrip.driverPhone
              ? [{ label: 'Driver', value: [reviewTrip.driver, reviewTrip.driverPhone].filter(Boolean).join(' · ') }]
              : []),
            { label: 'Godown', value: selectedWarehouse?.name || 'Main Godown' },
            { label: 'Bills attaching', value: pendingBills.length > 0 ? `${pendingBills.length} new` : 'none new' },
            { label: 'Status', value: status === 'closed' ? 'Completed' : 'Active' },
          ]}
          rows={reviewRows}
          totalCases={Object.values(reviewTrip.loaded || {}).reduce((s, n) => s + n, 0)}
          confirmLabel={isCompletedEdit ? 'Save and reopen' : 'Confirm & Save'}
          onBack={() => setReviewTrip(null)}
          onCancel={() => {
            setReviewTrip(null);
            handleCancel();
          }}
          onConfirm={() => {
            setPendingConfirmTrip(reviewTrip);
            setReviewTrip(null);
          }}
        />
      )}

      {pendingConfirmTrip && (
        <ConfirmModal
          isOpen={true}
          onClose={() => {
            setReviewTrip(pendingConfirmTrip);
            setPendingConfirmTrip(null);
          }}
          variant="warning"
          title={`Confirm Edit to Trip #${trip.id}`}
          subtitle={`${pendingConfirmTrip.vehicle} · ${pendingConfirmTrip.date}`}
          message={
            isCompletedEdit
              ? 'Saving will update this trip and move it back to Active until re-settled.'
              : 'Review the summary and enter a reason. This edit is recorded in the global Activity Log.'
          }
          impactItems={[
            {
              label: 'Loaded Cases',
              detail: `${Object.values(trip.loaded || {}).reduce((s, n) => s + (Number(n) || 0), 0)} cs → ${Object.values(
                pendingConfirmTrip.loaded || {},
              ).reduce((s, n) => s + (Number(n) || 0), 0)} cs`,
              qtyChange: (() => {
                const diff =
                  Object.values(pendingConfirmTrip.loaded || {}).reduce((s, n) => s + (Number(n) || 0), 0) -
                  Object.values(trip.loaded || {}).reduce((s, n) => s + (Number(n) || 0), 0);
                return diff === 0 ? 'Unchanged' : `${diff > 0 ? '+' : ''}${diff} cs`;
              })(),
            },
            {
              label: 'Vehicle & Salesman',
              detail: `${trip.vehicle} (${trip.salesman || 'Unassigned'}) → ${pendingConfirmTrip.vehicle} (${
                pendingConfirmTrip.salesman || 'Unassigned'
              })`,
            },
            ...(pendingBills.length > 0
              ? [{ label: 'New Bills Attached', detail: `${pendingBills.length} bill(s) linked to this trip` }]
              : []),
          ]}
          rectificationPrompt="Reason for editing trip *"
          rectificationPlaceholder="e.g. Adjusted van load, changed vehicle/crew, attached bills"
          reasonPresets={['Adjusted van load', 'Changed vehicle/crew', 'Attached/fixed bills', 'Reopened for correction']}
          commentMinLength={4}
          confirmButtonLabel={isCompletedEdit ? 'Save & Reopen Trip' : 'Save Trip Changes'}
          confirmIcon={<Save className="w-3.5 h-3.5" />}
          onConfirm={() => {}}
          onConfirmWithComment={(reason) => {
            const target = pendingConfirmTrip;
            setPendingConfirmTrip(null);
            onSave(target, reason);
          }}
        />
      )}

      {askDiscard && <DiscardSheet onKeep={() => setAskDiscard(false)} onDiscard={onBack} />}
    </>
  );

  if (isPhone && !readOnly && isCompletedEdit) {
    return (
      <TripEditPhoneCompletedView
        trip={trip}
        products={products}
        salesmen={salesmen}
        warehouses={warehouses}
        error={error}
        vehicle={vehicle}
        setVehicle={setVehicle}
        salesmanId={salesmanId}
        setSalesmanId={setSalesmanId}
        salesmanName={salesmanName}
        salesmanPhone={salesmanPhone}
        setSalesmanPhone={setSalesmanPhone}
        warehouseId={warehouseId}
        handleGodownChange={handleGodownChange}
        godownMoveHint={godownMoveHint}
        activeProductIds={activeProductIds}
        loaded={loaded}
        soldByProduct={soldByProduct}
        pendingByProduct={pendingByProduct}
        editingProdId={editingProdId}
        setEditingProdId={setEditingProdId}
        showMoreDetails={showMoreDetails}
        setShowMoreDetails={setShowMoreDetails}
        date={date}
        setDate={setDate}
        driver={driver}
        setDriver={setDriver}
        driverPhone={driverPhone}
        setDriverPhone={setDriverPhone}
        autoAttachBills={autoAttachBills}
        setAutoAttachBills={setAutoAttachBills}
        pendingBills={pendingBills}
        stockHere={stockHere}
        stockAll={stockAll}
        nameOf={nameOf}
        setShowAdd={setShowAdd}
        handleSetQtyDirect={handleSetQtyDirect}
        handleUpdateQty={handleUpdateQty}
        handleRemoveProduct={handleRemoveProduct}
        handleCancel={handleCancel}
        openReview={openReview}
        onReopenTripNow={onReopenTripNow}
        onBack={onBack}
        sharedModals={sharedModals}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--flow-canvas)] animate-in fade-in duration-150" id="trip-edit-screen">
      <FlowHeader
        title={readOnly ? 'Load sheet' : 'Edit load sheet'}
        subtitle={`Trip #${trip.id} · ${vehicle || trip.vehicle}`}
        onBack={readOnly ? onBack : handleCancel}
        right={<FlowBadge>{status === 'closed' ? 'Completed' : 'Active'}</FlowBadge>}
      />

      <TripEditDesktopBody
        trip={trip}
        products={products}
        bills={bills}
        salesmen={salesmen}
        warehouses={warehouses}
        readOnly={readOnly}
        reopensOnSave={reopensOnSave}
        onReopenTripNow={onReopenTripNow}
        onManageBills={onManageBills}
        error={error}
        vehicle={vehicle}
        setVehicle={setVehicle}
        date={date}
        setDate={setDate}
        salesmanId={salesmanId}
        setSalesmanId={setSalesmanId}
        salesmanName={salesmanName}
        salesmanPhone={salesmanPhone}
        setSalesmanPhone={setSalesmanPhone}
        driver={driver}
        setDriver={setDriver}
        driverPhone={driverPhone}
        setDriverPhone={setDriverPhone}
        warehouseId={warehouseId}
        handleGodownChange={handleGodownChange}
        godownMoveHint={godownMoveHint}
        status={status}
        setStatus={setStatus}
        autoAttachBills={autoAttachBills}
        setAutoAttachBills={setAutoAttachBills}
        pendingBills={pendingBills}
        totalLoaded={totalLoaded}
        totalSold={totalSold}
        totalValue={totalValue}
        shortValue={shortValue}
        activeProductIds={activeProductIds}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        filter={filter}
        setFilter={setFilter}
        counts={counts}
        shownIds={shownIds}
        loaded={loaded}
        soldByProduct={soldByProduct}
        pendingByProduct={pendingByProduct}
        stockHere={stockHere}
        stockAll={stockAll}
        setShowAdd={setShowAdd}
        handleSetQtyDirect={handleSetQtyDirect}
        handleUpdateQty={handleUpdateQty}
        handleRemoveProduct={handleRemoveProduct}
      />

      {/* Bottom bar */}
      {readOnly ? (
        <ActionBar
          actions={[
            { key: 'back', label: 'Back', icon: <ArrowLeft size={20} />, tone: 'neutral', onClick: onBack, id: 'btn-trip-view-back' },
            ...(onRecordReturn
              ? [{ key: 'settle', label: 'Return & Settle', icon: <RotateCcw size={20} />, tone: 'primary' as const, onClick: () => onRecordReturn(trip), grow: 2, id: 'btn-trip-view-settle' }]
              : []),
          ]}
        />
      ) : (
        <ActionBar
          actions={[
            { key: 'cancel', label: 'Cancel', icon: <X size={20} />, tone: 'cancel', onClick: handleCancel, id: 'btn-trip-edit-cancel' },
            { key: 'add', label: 'Add products', icon: <Plus size={20} />, tone: 'add', onClick: () => setShowAdd(true), grow: 1.3, id: 'btn-trip-edit-add' },
            { key: 'review', label: `Review · ${totalLoaded} cs`, icon: <CheckCircle2 size={20} />, tone: 'primary', onClick: openReview, grow: 1.5, id: 'btn-trip-edit-review' },
          ]}
        />
      )}

      {sharedModals}
    </div>
  );
};
