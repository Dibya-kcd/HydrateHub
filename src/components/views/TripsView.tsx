import React, { useEffect, useMemo, useState } from 'react';
import { Check, CheckCircle2, Plus, Truck, X } from 'lucide-react';
import { useLedger } from '../../context/LedgerContext';
import { CanonicalActionIntent, Trip } from '../../types';
import { billNetTotal } from '../../utils/salesReturns';
import { billBelongsToTrip, tripCashDue } from '../../utils/billing';
import { todayISO, toLocalISODate } from '../../utils/dateLocal';
import { formatTripGroupDay } from '../../utils/tripLoads';
import { AssignBillsModal } from './AssignBillsModal';
import { TripEditScreen } from './TripEditScreen';
import { TripRecordReturnScreen } from './TripRecordReturnScreen';
import { NewTripSheet, NewTripPayload } from './trips/NewTripSheet';
import { useCreateTrip } from './trips/useCreateTrip';
import { useCloseTrip } from './trips/useCloseTrip';
import { useLoadValidator } from './trips/useLoadValidator';
import { TripListCard } from './trips/TripListCard';
import { TripPhoneClosedView } from './trips/TripPhoneClosedView';
import { TripPhoneDetailView } from './trips/TripPhoneDetailView';
import { TripHistorySection } from './trips/TripHistorySection';
import { TripDeleteConfirmModal, TripReopenConfirmModal } from './trips/TripConfirmModals';
import { CanonicalReturnBanner } from '../common/CanonicalReturnBanner';
import { useBeats } from '../../hooks/useBeats';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useLanguage } from '../../i18n/LanguageContext';

interface TripsViewProps {
  initialSubTab?: 'active' | 'history';
}

const HISTORY_PAGE = 30;
const MOBILE_HISTORY_PAGE = 10;

const fmtDay = (d?: string) => {
  if (!d) return 'Undated';
  const dt = new Date(d.length === 10 ? `${d}T12:00:00` : d);
  return isNaN(dt.getTime())
    ? d
    : dt.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtShortDate = (d?: string) => {
  if (!d) return 'Undated';
  const dt = new Date(d.length === 10 ? `${d}T12:00:00` : d);
  return isNaN(dt.getTime())
    ? d
    : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtTripGroupDay = (d?: string) => {
  const today = todayISO();
  const yestDt = new Date();
  yestDt.setDate(yestDt.getDate() - 1);
  return formatTripGroupDay(d, today, toLocalISODate(yestDt));
};

export const TripsView: React.FC<TripsViewProps> = ({ initialSubTab = 'active' }) => {
  const { activeBeats } = useBeats();
  const createTrip = useCreateTrip();
  const { closeTrip: closeTripAndPost } = useCloseTrip();
  const validateLoad = useLoadValidator();
  const {
    trips,
    bills,
    products,
    salesmen,
    customers,
    warehouses,
    defaultWarehouse,
    warehouseStock,
    reopenTrip,
    toggleBillAssignment,
    autoAssignTripBills,
    saveReturnDraft,
    recordTripCashRecovery,
    writeOffTripCashShort,
    payments,
    updateTrip,
    deleteTrip,
    tripBreakdown,
    setTab,
    palette,
    fz,
    scale,
    pendingCanonicalAction,
    clearPendingCanonicalAction,
    returnFromCanonicalAction,
  } = useLedger();

  const isPhone = useIsMobile(1023);
  const { t } = useLanguage();
  const pageSize = isPhone ? MOBILE_HISTORY_PAGE : HISTORY_PAGE;

  // Active is the default; closed trips live under History.
  const [tripsTab, setTripsTab] = useState<'active' | 'history'>(initialSubTab);
  const [showNewTrip, setShowNewTrip] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historyLimit, setHistoryLimit] = useState(() => (typeof window !== 'undefined' && window.innerWidth <= 1023 ? MOBILE_HISTORY_PAGE : HISTORY_PAGE));
  const [histFrom, setHistFrom] = useState('');
  const [histTo, setHistTo] = useState('');
  const [histSalesman, setHistSalesman] = useState('');
  const [activeRange, setActiveRange] = useState<'7' | '30' | 'month' | 'all' | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<'list' | 'edit-trip' | 'record-return'>('list');
  const [tripForEdit, setTripForEdit] = useState<Trip | null>(null);
  const [editReopens, setEditReopens] = useState(false);
  const [tripForReturn, setTripForReturn] = useState<Trip | null>(null);
  const [managingBillsTrip, setManagingBillsTrip] = useState<Trip | null>(null);
  const [tripToReopen, setTripToReopen] = useState<Trip | null>(null);
  const [tripToDelete, setTripToDelete] = useState<Trip | null>(null);
  const [detailTripId, setDetailTripId] = useState<number | null>(null);
  const [closedSummary, setClosedSummary] = useState<{
    id: number;
    sales: number;
    cashIn: number;
    owed: number;
    salesman: string;
    phone?: string;
    route: string;
    date: string;
    vehicle: string;
  } | null>(null);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryInput, setRecoveryInput] = useState('');
  const [activeReturnIntent, setActiveReturnIntent] = useState<CanonicalActionIntent | null>(null);

  useEffect(() => {
    if (!pendingCanonicalAction || pendingCanonicalAction.entityType !== 'trip') return;
    const targetTrip = trips.find((tr) => String(tr.id) === String(pendingCanonicalAction.entityId));
    const intent = pendingCanonicalAction;
    clearPendingCanonicalAction();
    if (intent.returnTab) setActiveReturnIntent(intent);
    if (!targetTrip) return;
    setTripsTab(targetTrip.status === 'closed' ? 'history' : 'active');
    if (intent.action === 'edit') {
      const closed = targetTrip.status === 'closed';
      setEditReopens(closed);
      setTripForEdit(closed ? { ...targetTrip, status: 'out' } : targetTrip);
      setViewMode('edit-trip');
    } else if (intent.action === 'delete') {
      setTripToDelete(targetTrip);
    } else if (intent.action === 'view') {
      setDetailTripId(targetTrip.id);
    }
  }, [pendingCanonicalAction, trips, clearPendingCanonicalAction]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4500);
  };

  const handleReopenTrip = (target: Trip | number) => {
    const tripId = typeof target === 'number' ? target : Number(target.id);
    reopenTrip(tripId);
    setTripsTab('active');
    setDetailTripId(null);
    setClosedSummary(null);
    showToast(`Trip #${tripId} reopened and moved back to Active trips.`);
  };

  // Editing a completed trip reopens it: the edit form opens as an active trip and is only
  // reopened if the user saves. Going back leaves the trip completed.
  const openEdit = (t: Trip) => {
    const closed = t.status === 'closed';
    setEditReopens(closed);
    setTripForEdit(closed ? { ...t, status: 'out' } : t);
    setViewMode('edit-trip');
  };
  const openSettle = (t: Trip) => {
    setTripForReturn(t);
    setViewMode('record-return');
  };

  const sortedTrips = useMemo(
    () =>
      [...trips].sort((a, b) => {
        const da = a.date || '';
        const db = b.date || '';
        if (db !== da) return db.localeCompare(da);
        return Number(b.id) - Number(a.id);
      }),
    [trips],
  );
  const activeTrips = useMemo(() => sortedTrips.filter((t) => t.status !== 'closed'), [sortedTrips]);
  const closedTrips = useMemo(() => sortedTrips.filter((t) => t.status === 'closed'), [sortedTrips]);

  const vehicleOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...trips.map((t) => t.vehicle),
          ...salesmen.map((s) => s.defaultVehicle || ''),
        ].map((v) => (v || '').trim()).filter(Boolean)),
      ),
    [trips, salesmen],
  );
  const routeOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...activeBeats.map((b) => b.name),
          ...trips.map((t) => t.route || ''),
          ...(customers || []).map((c) => c.route || ''),
        ].map((v) => (v || '').trim()).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b)),
    [trips, customers, activeBeats],
  );

  const godownLabel = (t: Trip) => {
    const ids = t.warehouseLoads ? Object.keys(t.warehouseLoads) : [];
    const names = (ids.length ? ids : [t.warehouseId || '']).map(
      (id) => warehouses.find((w) => w.id === id)?.name || 'Main Godown',
    );
    return Array.from(new Set(names)).join(' + ');
  };

  const tripBillStats = (t: Trip) => {
    const ids = new Set((t.billIds || []).map(Number));
    const tb = bills.filter((b) => Number(b.tripId) === Number(t.id) || ids.has(Number(b.id)));
    return { count: tb.length, value: tb.reduce((s, b) => s + billNetTotal(b), 0) };
  };

  const resolveTripContacts = (tr: Trip) => {
    const matchedSm = salesmen.find(
      (s) =>
        (tr.salesmanId && s.id === tr.salesmanId) ||
        (tr.salesman && s.name.trim().toLowerCase() === tr.salesman.trim().toLowerCase()),
    );
    const driverName = (tr.driver || '').trim();
    const driverPhone = (tr.driverPhone || '').trim();
    const salesmanName = (tr.salesman || matchedSm?.name || '').trim();
    const salesmanPhone = (tr.salesmanPhone || matchedSm?.phone || '').trim();
    return {
      driverName,
      driverPhone,
      salesmanName,
      salesmanPhone,
      primaryPhone: driverPhone || salesmanPhone,
    };
  };

  const renderCard = (t: Trip, mode: 'active' | 'history') => {
    const rows = tripBreakdown(t).rows.map((r) => ({
      ...r,
      reason: t.shortageReasons?.[r.productId]?.reason,
      reasonNote: t.shortageReasons?.[r.productId]?.note,
      damagedQty: t.shortageReasons?.[r.productId]?.missing ? t.shortageReasons?.[r.productId]?.qty : undefined,
      missing: t.shortageReasons?.[r.productId]?.missing,
    }));
    const stats = tripBillStats(t);
    const contacts = resolveTripContacts(t);
    return (
      <TripListCard
        key={t.id}
        trip={t}
        mode={mode}
        rows={rows}
        billsCount={stats.count}
        soldValue={stats.value}
        godownLabel={godownLabel(t)}
        personLabel={contacts.driverName || contacts.salesmanName || undefined}
        driverPhone={contacts.driverPhone || undefined}
        salesmanPhone={contacts.salesmanPhone || undefined}
        onSettle={openSettle}
        onReopen={isPhone ? (tr) => setTripToReopen(tr) : handleReopenTrip}
        onEdit={openEdit}
        onBills={setManagingBillsTrip}
        onDelete={setTripToDelete}
        onOpenDetail={(tr) => setDetailTripId(tr.id)}
      />
    );
  };

  const handleCreate = (p: NewTripPayload): string | null => {
    const res = createTrip.create(p);
    if (res.ok === false) return res.error;
    setShowNewTrip(false);
    setTripsTab('active');
    showToast(`${p.vehicle} loaded with ${res.total} cs${res.godowns > 1 ? ` from ${res.godowns} godowns` : ''}.`);
    return null;
  };

  const detailTrip = useMemo(
    () => (detailTripId != null ? trips.find((x) => Number(x.id) === Number(detailTripId)) || null : null),
    [detailTripId, trips],
  );

  const closedViewData = useMemo(() => {
    if (!isPhone) return null;
    const sumBillsPaid = (tr: Trip) =>
      bills
        .filter((b) => b.status !== 'cancelled' && billBelongsToTrip(tr, b))
        .reduce((s, b) => s + (Number(b.amountPaid) || 0), 0);
    if (closedSummary) {
      const liveClosed = trips.find((x) => Number(x.id) === Number(closedSummary.id));
      const liveDue = liveClosed ? tripCashDue(liveClosed) : closedSummary.owed;
      const liveStats = liveClosed ? tripBillStats(liveClosed) : null;
      const liveCashIn = liveClosed
        ? Number(liveClosed.cashHandedIn ?? closedSummary.cashIn)
        : closedSummary.cashIn;
      return {
        id: closedSummary.id,
        trip: liveClosed || null,
        sales: liveStats ? liveStats.value : closedSummary.sales,
        cashIn: liveCashIn,
        owed: liveDue,
        salesman: closedSummary.salesman,
        phone: closedSummary.phone,
        route: closedSummary.route,
        date: closedSummary.date,
        vehicle: closedSummary.vehicle,
        fromHistory: false,
      };
    }
    if (detailTrip && detailTrip.status === 'closed') {
      const contacts = resolveTripContacts(detailTrip);
      const st = tripBillStats(detailTrip);
      return {
        id: detailTrip.id,
        trip: detailTrip,
        sales: st.value,
        cashIn: Number(detailTrip.cashHandedIn ?? sumBillsPaid(detailTrip)),
        owed: tripCashDue(detailTrip),
        salesman: contacts.driverName || contacts.salesmanName || '',
        phone: contacts.primaryPhone || undefined,
        route: detailTrip.route || '',
        date: fmtShortDate(detailTrip.date),
        vehicle: detailTrip.vehicle || '',
        fromHistory: true,
      };
    }
    return null;
  }, [isPhone, closedSummary, detailTrip, trips, bills, salesmen]);

  /* ---------- Full-screen sub-views ---------- */
  if (viewMode === 'edit-trip' && tripForEdit) {
    return (
      <TripEditScreen
        trip={tripForEdit}
        products={products}
        bills={bills}
        salesmen={salesmen}
        warehouses={warehouses}
        warehouseStock={warehouseStock}
        allTrips={trips}
        validateLoad={validateLoad}
        reopensOnSave={editReopens}
        onReopenTripNow={(id) => {
          reopenTrip(id);
          setEditReopens(false);
          setTripsTab('active');
          showToast(`Trip #${id} reopened and moved back to Active trips.`);
        }}
        onBack={() => {
          setViewMode('list');
          setTripForEdit(null);
        }}
        onSave={(updated, reason) => {
          updateTrip(updated, reason);
          setViewMode('list');
          setTripForEdit(null);
          if (editReopens && updated.status !== 'closed') setTripsTab('active');
          showToast(
            editReopens && updated.status !== 'closed'
              ? `Trip #${updated.id} (${updated.vehicle}) updated and moved back to Active.`
              : `Trip #${updated.id} (${updated.vehicle}) updated.`,
          );
        }}
        onRecordReturn={openSettle}
        onManageBills={(t) => setManagingBillsTrip(t)}
      />
    );
  }

  if (viewMode === 'record-return' && tripForReturn) {
    return (
      <TripRecordReturnScreen
        trip={tripForReturn}
        products={products}
        bills={bills}
        warehouses={warehouses}
        onBack={() => {
          setViewMode('list');
          setTripForReturn(null);
        }}
        payments={payments}
        onSaveReturn={(tripId, finalReturn, closeTrip, shortageReasons, cashHandedIn, cashShortBooked, tripExpense) => {
          // A draft is kept apart from the recorded returns and never closes the trip.
          if (closeTrip) {
            const refused = closeTripAndPost({ tripId, returned: finalReturn, shortageReasons, cashHandedIn, cashShortBooked, tripExpense });
            if (refused) return refused; // stay on the screen and show why
          } else saveReturnDraft(tripId, finalReturn, cashHandedIn);
          setViewMode('list');
          setTripForReturn(null);
          if (closeTrip) {
            setDetailTripId(null);
            setClosedSummary(null);
            setRecoveryOpen(false);
            setRecoveryInput('');
            setTripsTab('history');
          }
          showToast(
            closeTrip ? `Trip #${tripId} settled and moved to History.` : `Trip #${tripId} settlement draft saved.`,
          );
        }}
        onEditTrip={openEdit}
      />
    );
  }

  /* ---------- History filtering ---------- */
  const q = historySearch.trim().toLowerCase();
  const qDigits = q.replace(/\D/g, '');
  const historySalesmen = Array.from(new Set(closedTrips.map((t) => (t.salesman || '').trim()).filter(Boolean))).sort(
    (a, b) => a.localeCompare(b),
  );
  const filteredHistory = closedTrips.filter((t) => {
    const day = (t.date || '').slice(0, 10);
    if (histFrom && (!day || day < histFrom)) return false;
    if (histTo && (!day || day > histTo)) return false;
    if (histSalesman && (t.salesman || '').trim() !== histSalesman) return false;
    if (!q) return true;
    const contacts = resolveTripContacts(t);
    const phoneHaystack = `${contacts.driverPhone} ${contacts.salesmanPhone}`.toLowerCase();
    const phoneDigits = phoneHaystack.replace(/\D/g, '');
    return (
      (t.vehicle || '').toLowerCase().includes(q) ||
      String(t.id).includes(q) ||
      (t.date || '').includes(q) ||
      (t.route || '').toLowerCase().includes(q) ||
      (t.salesman || '').toLowerCase().includes(q) ||
      (t.driver || '').toLowerCase().includes(q) ||
      phoneHaystack.includes(q) ||
      (qDigits.length >= 3 && phoneDigits.includes(qDigits))
    );
  });
  const historyFiltered = Boolean(q || histFrom || histTo || histSalesman);
  const setQuickRange = (days: number | 'month' | 'all', key?: '7' | '30' | 'month' | 'all') => {
    setHistoryLimit(pageSize);
    setActiveRange(key ?? null);
    if (days === 'all') {
      setHistFrom('');
      setHistTo('');
      return;
    }
    const now = new Date();
    if (days === 'month') {
      setHistFrom(toLocalISODate(new Date(now.getFullYear(), now.getMonth(), 1)));
    } else {
      const start = new Date(now);
      start.setDate(start.getDate() - (days - 1));
      setHistFrom(toLocalISODate(start));
    }
    setHistTo(todayISO());
  };
  const clearHistoryFilters = () => {
    setHistFrom('');
    setHistTo('');
    setHistSalesman('');
    setHistorySearch('');
    setActiveRange(null);
    setHistoryLimit(pageSize);
  };
  const shownHistory = filteredHistory.slice(0, historyLimit);
  const historyGroups: { day: string; trips: Trip[] }[] = [];
  for (const t of shownHistory) {
    const day = isPhone ? fmtTripGroupDay(t.date) : fmtDay(t.date);
    const last = historyGroups[historyGroups.length - 1];
    if (last && last.day === day) last.trips.push(t);
    else historyGroups.push({ day, trips: [t] });
  }

  if (isPhone && closedViewData) {
    return (
      <TripPhoneClosedView
        closedViewData={closedViewData}
        t={t}
        trips={trips}
        bills={bills}
        products={products}
        palette={palette}
        fz={fz}
        scale={scale}
        recoveryOpen={recoveryOpen}
        setRecoveryOpen={setRecoveryOpen}
        recoveryInput={recoveryInput}
        setRecoveryInput={setRecoveryInput}
        recordTripCashRecovery={recordTripCashRecovery}
        showToast={showToast}
        setDetailTripId={setDetailTripId}
        setClosedSummary={setClosedSummary}
        setTripsTab={setTripsTab}
        handleReopenTrip={handleReopenTrip}
        openEdit={openEdit}
        managingBillsTrip={managingBillsTrip}
        setManagingBillsTrip={setManagingBillsTrip}
        toggleBillAssignment={toggleBillAssignment}
        autoAssignTripBills={autoAssignTripBills}
        tripToDelete={tripToDelete}
        setTripToDelete={setTripToDelete}
        deleteTrip={deleteTrip}
      />
    );
  }

  if (isPhone && detailTrip) {
    return (
      <TripPhoneDetailView
        detailTrip={detailTrip}
        t={t}
        trips={trips}
        bills={bills}
        products={products}
        palette={palette}
        fz={fz}
        scale={scale}
        tripBreakdown={tripBreakdown}
        resolveTripContacts={resolveTripContacts}
        godownLabel={godownLabel}
        setDetailTripId={setDetailTripId}
        setTab={setTab}
        openSettle={openSettle}
        openEdit={openEdit}
        handleReopenTrip={handleReopenTrip}
        managingBillsTrip={managingBillsTrip}
        setManagingBillsTrip={setManagingBillsTrip}
        toggleBillAssignment={toggleBillAssignment}
        autoAssignTripBills={autoAssignTripBills}
        tripToDelete={tripToDelete}
        setTripToDelete={setTripToDelete}
        deleteTrip={deleteTrip}
        showToast={showToast}
      />
    );
  }

  return (
    <div id="view-trips" className="mw-workspace w-full min-w-0 max-w-none mx-auto space-y-4 pb-24">
      {/* Header */}
      {isPhone ? (
        <div className="hh-sales-top hh-sales-top--flush">
          <div className="hh-sales-top__row">
            <h1 className="hh-sales-top__title">Trips</h1>
            <button
              type="button"
              id="btn-dispatch-trip"
              onClick={() => setShowNewTrip(true)}
              className="hh-sales-top__iconbtn"
              aria-label={t('trips.newTrip')}
            >
              <Plus size={22} strokeWidth={2.4} />
            </button>
          </div>
          <div className="rt-utabs" role="tablist" aria-label="Trip lists">
            <button
              type="button"
              role="tab"
              aria-selected={tripsTab === 'active'}
              id="tab-active-trips"
              onClick={() => setTripsTab('active')}
              className="rt-utab"
            >
              Active {activeTrips.length}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tripsTab === 'history'}
              id="tab-trip-history"
              onClick={() => setTripsTab('history')}
              className="rt-utab"
            >
              History {closedTrips.length}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Trips</h1>
          <button
            type="button"
            id="btn-dispatch-trip"
            onClick={() => setShowNewTrip(true)}
            className="inline-flex items-center gap-1.5 min-h-11 px-4 rounded-full bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-sm font-semibold shadow-sm cursor-pointer active:scale-[0.98]"
          >
            <Plus size={17} /> New trip
          </button>
        </div>
      )}

      {activeReturnIntent && (
        <CanonicalReturnBanner
          intent={activeReturnIntent}
          onReturn={() => {
            const intent = activeReturnIntent;
            setActiveReturnIntent(null);
            returnFromCanonicalAction(intent);
          }}
          onDismiss={() => setActiveReturnIntent(null)}
        />
      )}

      {toast && !isPhone && (
        <div role="status" className="flex items-center justify-between gap-2 p-3 rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm font-semibold">
          <span className="flex items-center gap-2 min-w-0">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>{toast}</span>
          </span>
          <button type="button" onClick={() => setToast(null)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer" aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}

      {toast && isPhone && (
        <div role="status" className="rt-toast-float">
          <span className="flex items-center gap-2.5 min-w-0">
            <Check size={17} strokeWidth={2.8} className="shrink-0" style={{ color: '#22c55e' }} />
            <span className="break-words">{toast}</span>
          </span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="p-1 text-white/70 hover:text-white bg-transparent border-0 cursor-pointer shrink-0"
            style={{ minWidth: '32px', minHeight: '32px' }}
            aria-label="Dismiss"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Active / History (desktop pill switcher; mobile uses header underline tabs) */}
      {!isPhone && (
        <div className="flex bg-[#ebe8e1] rounded-full p-1 gap-0.5" role="tablist">
          {([
            { id: 'active' as const, label: 'Active', n: activeTrips.length },
            { id: 'history' as const, label: 'History', n: closedTrips.length },
          ]).map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tripsTab === t.id}
              id={`tab-${t.id === 'active' ? 'active-trips' : 'trip-history'}`}
              onClick={() => setTripsTab(t.id)}
              className={`flex-1 min-h-10 px-4 rounded-full text-sm font-semibold cursor-pointer transition-all ${
                tripsTab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              {t.label} · {t.n}
            </button>
          ))}
        </div>
      )}

      {/* ACTIVE */}
      {tripsTab === 'active' && (
        <div className="space-y-3">
          {activeTrips.length === 0 ? (
            isPhone ? (
              <div className="rt-card px-5 py-10 text-center space-y-2">
                <div className="mx-auto rt-ico">
                  <Truck size={18} />
                </div>
                <h2 className="text-base font-bold m-0" style={{ color: 'var(--text)' }}>{t('trips.noActiveTrips')}</h2>
                <p className="text-[13px] m-0" style={{ color: 'var(--text-2)' }}>{t('trips.noActiveTripsSub')}</p>
                <div className="pt-2">
                  <button type="button" onClick={() => setShowNewTrip(true)} className="rt-btn">
                    <Plus size={16} /> {t('trips.newTrip')}
                  </button>
                </div>
              </div>
            ) : (
              <div data-card-tone="sales" className="rounded-2xl border shadow-xs px-6 py-12 text-center">
                <div className="mx-auto hh-icon-badge hh-icon-badge--blue mb-3">
                  <Truck size={22} />
                </div>
                <h2 className="text-base font-bold text-slate-900">No active trips</h2>
                <p className="text-sm text-slate-500 mt-1">Load a vehicle to start a trip.</p>
                <button
                  type="button"
                  onClick={() => setShowNewTrip(true)}
                  className="mt-4 inline-flex items-center gap-1.5 min-h-11 px-5 rounded-full bg-[var(--primary)] text-white text-sm font-semibold cursor-pointer"
                >
                  <Plus size={16} /> New trip
                </button>
              </div>
            )
          ) : (
            <div className={isPhone ? 'space-y-3 hh-tgrid-2' : 'space-y-3'}>
              {activeTrips.map((tr) => renderCard(tr, 'active'))}
            </div>
          )}
        </div>
      )}

      {/* HISTORY */}
      {tripsTab === 'history' && (
        <TripHistorySection
          isPhone={isPhone}
          trips={trips}
          salesmen={salesmen}
          closedTrips={closedTrips}
          filteredHistory={filteredHistory}
          shownHistory={shownHistory}
          historyGroups={historyGroups}
          historySearch={historySearch}
          setHistorySearch={setHistorySearch}
          histFrom={histFrom}
          setHistFrom={setHistFrom}
          histTo={histTo}
          setHistTo={setHistTo}
          histSalesman={histSalesman}
          setHistSalesman={setHistSalesman}
          historySalesmen={historySalesmen}
          activeRange={activeRange}
          setActiveRange={setActiveRange}
          historyFiltered={historyFiltered}
          pageSize={pageSize}
          historyPageSizeDesktop={HISTORY_PAGE}
          setHistoryLimit={setHistoryLimit}
          setQuickRange={setQuickRange}
          clearHistoryFilters={clearHistoryFilters}
          recordTripCashRecovery={recordTripCashRecovery}
          writeOffTripCashShort={writeOffTripCashShort}
          renderCard={renderCard}
        />
      )}

      {/* New trip */}
      {showNewTrip && (
        <NewTripSheet
          products={products}
          warehouses={warehouses}
          salesmen={salesmen}
          vehicles={vehicleOptions}
          routes={routeOptions}
          defaultWarehouseId={defaultWarehouse?.id || warehouses[0]?.id || ''}
          warehouseStock={warehouseStock}
          attachableBills={createTrip.attachable}
          onSubmit={handleCreate}
          onClose={() => setShowNewTrip(false)}
        />
      )}

      {/* Bills on trip */}
      {managingBillsTrip && (
        <AssignBillsModal
          // Always the live trip, so ticks update as bills are attached or detached.
          trip={trips.find((x) => Number(x.id) === Number(managingBillsTrip.id)) || managingBillsTrip}
          allTrips={trips}
          isOpen={Boolean(managingBillsTrip)}
          bills={bills}
          products={products}
          palette={palette}
          fz={fz}
          scale={scale}
          onClose={() => setManagingBillsTrip(null)}
          onToggleBill={toggleBillAssignment}
          onAutoAssignDate={autoAssignTripBills}
          onReopenTrip={handleReopenTrip}
        />
      )}

      {/* Reopen confirmation (mobile bottom sheet) */}
      {isPhone && (
        <TripReopenConfirmModal
          trip={tripToReopen}
          onClose={() => setTripToReopen(null)}
          onConfirm={(target) => {
            setTripToReopen(null);
            handleReopenTrip(target);
          }}
        />
      )}

      {/* Delete confirmation */}
      <TripDeleteConfirmModal
        trip={tripToDelete}
        bills={bills}
        isPhone={isPhone}
        fmtDay={fmtDay}
        onClose={() => setTripToDelete(null)}
        onConfirm={(tr, reason) => {
          const { id, vehicle } = tr;
          deleteTrip(id, reason);
          setTripToDelete(null);
          showToast(`Trip #${id} (${vehicle}) deleted.`);
        }}
      />
    </div>
  );
};

export default TripsView;
