import React from 'react';
import { Check, ChevronLeft, Pencil, Receipt, Share2, Trash2 } from 'lucide-react';
import { Bill, Product, Trip } from '../../../types';
import { money, whatsappLink } from '../../../utils/billing';
import { AssignBillsModal } from '../AssignBillsModal';
import { TripDeleteConfirmModal } from './TripConfirmModals';

export interface ClosedTripViewData {
  id: number;
  trip: Trip | null;
  sales: number;
  cashIn: number;
  owed: number;
  salesman: string;
  phone?: string;
  route: string;
  date: string;
  vehicle: string;
  fromHistory: boolean;
}

interface TripPhoneClosedViewProps {
  closedViewData: ClosedTripViewData;
  t: (key: string, params?: Record<string, string | number>) => string;
  trips: Trip[];
  bills: Bill[];
  products: Product[];
  palette: any;
  fz: any;
  scale: any;
  recoveryOpen: boolean;
  setRecoveryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  recoveryInput: string;
  setRecoveryInput: (v: string) => void;
  recordTripCashRecovery: (tripId: number, amount: number) => boolean;
  showToast: (msg: string) => void;
  setDetailTripId: (id: number | null) => void;
  setClosedSummary: (val: any) => void;
  setTripsTab: (tab: 'active' | 'history') => void;
  handleReopenTrip: (target: Trip | number) => void;
  openEdit: (t: Trip) => void;
  managingBillsTrip: Trip | null;
  setManagingBillsTrip: (t: Trip | null) => void;
  toggleBillAssignment: (tripId: number, billId: number) => void;
  autoAssignTripBills: (tripId: number) => void;
  tripToDelete: Trip | null;
  setTripToDelete: (t: Trip | null) => void;
  deleteTrip: (id: number, reason?: string) => void;
}

export const TripPhoneClosedView: React.FC<TripPhoneClosedViewProps> = ({
  closedViewData,
  t,
  trips,
  bills,
  products,
  palette,
  fz,
  scale,
  recoveryOpen,
  setRecoveryOpen,
  recoveryInput,
  setRecoveryInput,
  recordTripCashRecovery,
  showToast,
  setDetailTripId,
  setClosedSummary,
  setTripsTab,
  handleReopenTrip,
  openEdit,
  managingBillsTrip,
  setManagingBillsTrip,
  toggleBillAssignment,
  autoAssignTripBills,
  tripToDelete,
  setTripToDelete,
  deleteTrip,
}) => {
  const shareText = [
    `Trip #${closedViewData.id} (${closedViewData.vehicle || '-'})`,
    closedViewData.route ? `Route: ${closedViewData.route}` : '',
    closedViewData.salesman ? `Salesman: ${closedViewData.salesman}` : '',
    `Date: ${closedViewData.date}`,
    `Sales: ₹${money(closedViewData.sales)}`,
    `Cash in: ₹${money(closedViewData.cashIn)}`,
    closedViewData.owed > 0 ? `Owed: ₹${money(closedViewData.owed)}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <div id="view-trips" className="mw-workspace w-full min-w-0 pb-8 space-y-4">
      <div className="hh-sales-top">
        <div className="hh-sales-top__row">
          <div className="flex items-center gap-1 min-w-0">
            {closedViewData.fromHistory && (
              <button
                type="button"
                onClick={() => setDetailTripId(null)}
                className="hh-sales-top__iconbtn"
                aria-label={t('common.back')}
              >
                <ChevronLeft size={24} strokeWidth={2.2} />
              </button>
            )}
            <h1 className="hh-sales-top__title truncate">{t('trips.tripClosedHeader', { id: closedViewData.id })}</h1>
          </div>
          <span className="hh-sales-top__pill shrink-0">{t('trips.closedTag')}</span>
        </div>
      </div>

      <div className="rt-card space-y-4 text-center py-6">
        <div className="mx-auto rt-success-check">
          <Check size={28} strokeWidth={2.6} />
        </div>
        <div>
          <h2 className="text-[22px] font-extrabold tracking-tight" style={{ color: 'var(--text)' }}>
            {t('trips.tripCompleted')}
          </h2>
          <p className="text-[13px] font-medium mt-1 break-words" style={{ color: 'var(--text-2)' }}>
            {[closedViewData.salesman, closedViewData.route, closedViewData.date].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="rt-three pt-2 border-t text-left" style={{ borderColor: 'var(--divider)' }}>
          <div className="rt-three__col">
            <span className="rt-three__label">{t('trips.sales')}</span>
            <span className="rt-three__val">₹{money(closedViewData.sales)}</span>
          </div>
          <div className="rt-three__col">
            <span className="rt-three__label">{t('trips.cashIn')}</span>
            <span className="rt-three__val" style={{ color: 'var(--paid)' }}>₹{money(closedViewData.cashIn)}</span>
          </div>
          <div className="rt-three__col">
            <span className="rt-three__label">{t('trips.owed')}</span>
            <span className="rt-three__val" style={{ color: closedViewData.owed > 0 ? 'var(--due)' : 'var(--text)' }}>
              ₹{money(closedViewData.owed)}
            </span>
          </div>
        </div>
      </div>

      {closedViewData.owed > 0 && (
        <div className="hh-hist-card hh-hist-card--due space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[13.5px] font-extrabold break-words" style={{ color: 'var(--text)' }}>
                {t('trips.salesmanOwes', {
                  name: closedViewData.salesman || t('trips.salesman'),
                  amt: money(closedViewData.owed),
                })}
              </div>
              <div className="text-[12px] font-medium" style={{ color: 'var(--text-2)' }}>
                {t('trips.cashShortfall')}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setRecoveryInput(String(closedViewData.owed));
                setRecoveryOpen((v) => !v);
              }}
              className="text-[13px] font-bold bg-transparent border-0 cursor-pointer shrink-0"
              style={{ color: 'var(--primary)', minHeight: '44px' }}
            >
              {t('trips.recordRecovery')}
            </button>
          </div>
          {recoveryOpen && (
            <div className="flex items-center gap-2 pt-1 border-t" style={{ borderColor: 'var(--divider)' }}>
              <input
                type="number"
                inputMode="decimal"
                value={recoveryInput}
                onChange={(e) => setRecoveryInput(e.target.value)}
                className="flex-1 min-h-[44px] px-3 rounded-full border text-sm font-bold"
                style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
              />
              <button
                type="button"
                onClick={() => {
                  const amt = Number(recoveryInput);
                  if (amt > 0 && amt <= closedViewData.owed + 0.005) {
                    if (recordTripCashRecovery(closedViewData.id, amt)) {
                      setRecoveryOpen(false);
                      showToast(`₹${money(amt)} recovered.`);
                    }
                  }
                }}
                className="rt-btn shrink-0"
              >
                {t('common.save')}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2.5">
        <a
          href={whatsappLink(closedViewData.phone || '', shareText)}
          target="_blank"
          rel="noopener noreferrer"
          className="rt-btn-outline rt-btn-outline--primary w-full no-underline"
        >
          <Share2 size={16} /> {t('trips.shareTripReport')}
        </a>
        <button
          type="button"
          onClick={() => {
            handleReopenTrip(closedViewData.id);
            setClosedSummary(null);
            setDetailTripId(null);
          }}
          className="rt-btn-outline rt-btn-outline--primary w-full"
        >
          {t('trips.reopenTrip')}
        </button>
        <button
          type="button"
          onClick={() => {
            setClosedSummary(null);
            setDetailTripId(null);
            setTripsTab('history');
          }}
          className="rt-link-btn"
        >
          {t('trips.backToTrips')}
        </button>
      </div>

      {closedViewData.trip && (
        <div className="flex items-center justify-center gap-4 pt-1">
          <button
            type="button"
            onClick={() => setManagingBillsTrip(closedViewData.trip)}
            className="inline-flex items-center gap-1.5 text-[13px] font-bold bg-transparent border-0 cursor-pointer"
            style={{ color: 'var(--primary)', minHeight: '44px' }}
          >
            <Receipt size={14} /> {t('trips.billsOnTrip')}
          </button>
          <button
            type="button"
            onClick={() => openEdit(closedViewData.trip!)}
            className="inline-flex items-center gap-1.5 text-[13px] font-bold bg-transparent border-0 cursor-pointer"
            style={{ color: 'var(--primary)', minHeight: '44px' }}
          >
            <Pencil size={14} /> {t('common.edit')}
          </button>
          <button
            type="button"
            onClick={() => setTripToDelete(closedViewData.trip)}
            className="inline-flex items-center gap-1.5 text-[13px] font-bold bg-transparent border-0 cursor-pointer"
            style={{ color: 'var(--due)', minHeight: '44px' }}
          >
            <Trash2 size={14} /> {t('common.delete')}
          </button>
        </div>
      )}

      {managingBillsTrip && (
        <AssignBillsModal
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

      <TripDeleteConfirmModal
        trip={tripToDelete}
        bills={bills}
        isPhone={true}
        onClose={() => setTripToDelete(null)}
        onConfirm={(tr, reason) => {
          const { id, vehicle } = tr;
          deleteTrip(id, reason);
          setTripToDelete(null);
          setClosedSummary(null);
          setDetailTripId(null);
          showToast(`Trip #${id} (${vehicle}) deleted.`);
        }}
      />
    </div>
  );
};
