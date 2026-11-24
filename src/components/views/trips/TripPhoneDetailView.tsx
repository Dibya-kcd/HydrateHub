import React from 'react';
import { ChevronLeft, MessageCircle, Pencil, Phone, Receipt, Trash2 } from 'lucide-react';
import { Bill, Product, Trip } from '../../../types';
import { billBelongsToTrip, money, whatsappLink } from '../../../utils/billing';
import { billBalance, billNetTotal } from '../../../utils/salesReturns';
import { invoiceNo } from '../../../utils/beatReports';
import { AssignBillsModal } from '../AssignBillsModal';
import { TripDeleteConfirmModal } from './TripConfirmModals';
import { compareProductsInSequence } from '../../../utils/sizeColor';
import { PackIcon } from '../../common/PackIcon';
import { SizeChip } from '../../common/SizeChip';
import { OdiaName } from '../../common/OdiaName';

interface TripContacts {
  driverName: string;
  driverPhone: string;
  salesmanName: string;
  salesmanPhone: string;
  primaryPhone: string;
}

interface TripPhoneDetailViewProps {
  detailTrip: Trip;
  t: (key: string, params?: Record<string, string | number>) => string;
  trips: Trip[];
  bills: Bill[];
  products: Product[];
  palette: any;
  fz: any;
  scale: any;
  tripBreakdown: (tr: Trip) => { rows: { productId: number; loaded: number; sold: number }[] };
  resolveTripContacts: (tr: Trip) => TripContacts;
  godownLabel: (tr: Trip) => string;
  setDetailTripId: (id: number | null) => void;
  setTab: (tab: any) => void;
  openSettle: (tr: Trip) => void;
  openEdit: (tr: Trip) => void;
  handleReopenTrip: (target: Trip | number) => void;
  managingBillsTrip: Trip | null;
  setManagingBillsTrip: (tr: Trip | null) => void;
  toggleBillAssignment: (tripId: number, billId: number) => void;
  autoAssignTripBills: (tripId: number) => void;
  tripToDelete: Trip | null;
  setTripToDelete: (tr: Trip | null) => void;
  deleteTrip: (id: number, reason?: string) => void;
  showToast: (msg: string) => void;
}

export const TripPhoneDetailView: React.FC<TripPhoneDetailViewProps> = ({
  detailTrip,
  t,
  trips,
  bills,
  products,
  palette,
  fz,
  scale,
  tripBreakdown,
  resolveTripContacts,
  godownLabel,
  setDetailTripId,
  setTab,
  openSettle,
  openEdit,
  handleReopenTrip,
  managingBillsTrip,
  setManagingBillsTrip,
  toggleBillAssignment,
  autoAssignTripBills,
  tripToDelete,
  setTripToDelete,
  deleteTrip,
  showToast,
}) => {
  const bdRows = tripBreakdown(detailTrip).rows;
  const loadedTotal = bdRows.reduce((s, r) => s + r.loaded, 0);
  const soldTotal = bdRows.reduce((s, r) => s + r.sold, 0);
  const leftTotal = bdRows.reduce((s, r) => s + Math.max(0, r.loaded - r.sold), 0);
  const pct = loadedTotal > 0 ? Math.min(100, Math.round((soldTotal / loadedTotal) * 100)) : 0;
  const tripBills = bills
    .filter((b) => b.status !== 'cancelled' && billBelongsToTrip(detailTrip, b))
    .sort((a, b) => Number(b.id) - Number(a.id));
  const cashCollected = tripBills.reduce((s, b) => s + (Number(b.amountPaid) || 0), 0);
  const contacts = resolveTripContacts(detailTrip);
  const salesmanDisplay = contacts.driverName || contacts.salesmanName || '';
  const isDetailOpen = detailTrip.status !== 'closed';
  const sortedStockRows = [...bdRows]
    .filter((r) => r.loaded > 0 || r.sold > 0)
    .map((r) => ({
      ...r,
      product: products.find((p) => p.id === r.productId),
      onVan: Math.max(0, r.loaded - r.sold),
    }))
    .sort((a, b) =>
      compareProductsInSequence(
        a.product || { name: `Product #${a.productId}` },
        b.product || { name: `Product #${b.productId}` },
      ),
    );

  return (
    <div id="view-trips" className="mw-workspace w-full min-w-0 pb-8 space-y-3">
      <div className="hh-sales-top">
        <div className="hh-sales-top__row">
          <div className="flex items-center gap-1 min-w-0">
            <button
              type="button"
              onClick={() => setDetailTripId(null)}
              className="hh-sales-top__iconbtn"
              aria-label={t('common.back')}
            >
              <ChevronLeft size={24} strokeWidth={2.2} />
            </button>
            <h1 className="hh-sales-top__title truncate">Trip #{detailTrip.id}</h1>
          </div>
          <span className={`shrink-0 ${isDetailOpen ? 'rt-trip-pill-onroute' : 'rt-trip-pill-completed'}`}>
            {isDetailOpen ? 'On route' : 'Completed'}
          </span>
        </div>
        <p className="rt-stp m-0 pl-2 break-words" style={{ color: 'var(--surface)' }}>
          {[detailTrip.route || godownLabel(detailTrip), salesmanDisplay, detailTrip.vehicle].filter(Boolean).join(' · ')}
        </p>
      </div>

      <div className="rt-card space-y-3">
        <div>
          <div className="text-[12px] font-semibold" style={{ color: 'var(--text-2)' }}>
            {t('trips.cashCollectedSoFar')}
          </div>
          <div className="text-[28px] font-extrabold tracking-tight tabular-nums mt-0.5" style={{ color: 'var(--text)' }}>
            ₹{money(cashCollected)}
          </div>
        </div>
        <div className="border-t pt-2.5" style={{ borderColor: 'var(--divider)' }}>
          <div className="rt-three">
            <div className="rt-three__col">
              <span className="rt-three__label">{t('trips.loaded')}</span>
              <span className="rt-three__val">{loadedTotal}</span>
            </div>
            <div className="rt-three__col">
              <span className="rt-three__label">{t('trips.sold')}</span>
              <span className="rt-three__val">{soldTotal}</span>
            </div>
            <div className="rt-three__col">
              <span className="rt-three__label">{t('trips.left')}</span>
              <span className="rt-three__val">{leftTotal}</span>
            </div>
          </div>
        </div>
        <div className="rt-meter" aria-hidden="true">
          <div className="rt-meter__fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="rt-card space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-bold m-0" style={{ color: 'var(--text)' }}>
            Stock on Van
          </h2>
          <span className="text-[12px] font-bold tabular-nums" style={{ color: 'var(--primary)' }}>
            {t('trips.casesCount', { n: leftTotal })}
          </span>
        </div>
        {sortedStockRows.length === 0 ? (
          <p className="text-[13px] py-1 m-0" style={{ color: 'var(--text-2)' }}>
            No stock loaded on this trip yet.
          </p>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--divider)' }}>
            {sortedStockRows.map((r) => {
              const pName = r.product?.name || `Product #${r.productId}`;
              return (
                <div
                  key={r.productId}
                  className="py-2 first:pt-0.5 last:pb-0.5 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <PackIcon pack={r.product?.pack} name={pName} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-bold leading-snug break-words" style={{ color: 'var(--text)' }}>
                        <OdiaName name={pName} nameOr={r.product?.nameOr} />
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5 text-xs font-semibold tabular-nums" style={{ color: 'var(--text-2)' }}>
                        {r.product && (
                          <SizeChip volume={r.product.volume} pack={r.product.pack} name={pName} />
                        )}
                        <span>{t('trips.loaded')}: {r.loaded}</span>
                        <span>· {t('trips.sold')}: {r.sold}</span>
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right tabular-nums">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-extrabold ${
                        r.onVan > 0
                          ? 'bg-[var(--paid-bg)] text-[var(--paid)] border border-[var(--paid-edge)]'
                          : 'bg-[var(--due-bg)] text-[var(--due)] border border-[var(--due-edge)]'
                      }`}
                    >
                      {r.onVan} cs
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rt-card space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-bold m-0" style={{ color: 'var(--text)' }}>
            {t('trips.billsOnTrip')}
          </h2>
          <button
            type="button"
            onClick={() => setManagingBillsTrip(detailTrip)}
            className="text-[12.5px] font-bold bg-transparent border-0 cursor-pointer"
            style={{ color: 'var(--primary)', minHeight: '44px' }}
          >
            {t('trips.seeAll')}
          </button>
        </div>
        {tripBills.length === 0 ? (
          <p className="text-[13px] py-2 m-0" style={{ color: 'var(--text-2)' }}>
            {t('trips.noBillsYet')}
          </p>
        ) : (
          <div>
            {tripBills.slice(0, 6).map((b) => {
              const net = billNetTotal(b);
              const bal = billBalance(b);
              const paid = Number(b.amountPaid) || 0;
              const cases = (b.items || []).reduce((s, it) => s + (Number(it.qty) || 0), 0);
              const statusTag =
                bal <= 0.01 ? 'rt-tag--paid' : paid > 0 ? 'rt-tag--soon' : 'rt-tag--due';
              const statusLabel =
                bal <= 0.01 ? t('status.paid') : paid > 0 ? t('status.partial') : t('status.due');
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setManagingBillsTrip(detailTrip)}
                  className="rt-rowi"
                >
                  <span className="rt-ico rt-ico--muted">
                    <Receipt size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-bold break-words" style={{ color: 'var(--text)' }}>
                      {b.retailer}
                    </span>
                    <span className="block text-xs" style={{ color: 'var(--text-2)' }}>
                      {[invoiceNo(b), t('trips.casesCount', { n: cases }), b.phone].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="rt-amt space-y-0.5">
                    <span className="block text-[13.5px] font-bold" style={{ color: 'var(--text)' }}>
                      ₹{money(net)}
                    </span>
                    <span className={`rt-tag ${statusTag}`}>{statusLabel}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => {
            try {
              sessionStorage.setItem('mrwater_prefill_trip_id', String(detailTrip.id));
            } catch {
              // ignore storage quota / private mode
            }
            setDetailTripId(null);
            setTab('billing');
          }}
          className="rt-btn-outline rt-btn-outline--primary"
        >
          {t('trips.recordSale')}
        </button>
        {isDetailOpen ? (
          <button type="button" onClick={() => openSettle(detailTrip)} className="rt-btn">
            {t('trips.settleTrip')}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              handleReopenTrip(detailTrip);
              setDetailTripId(null);
            }}
            className="rt-btn"
          >
            {t('trips.reopenTrip')}
          </button>
        )}
      </div>

      {(contacts.driverName || contacts.driverPhone || contacts.salesmanName || contacts.salesmanPhone) && (
        <div className="rt-card space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[14px] font-bold m-0" style={{ color: 'var(--text)' }}>
              Crew &amp; Phone
            </h2>
            <button
              type="button"
              onClick={() => openEdit(detailTrip)}
              className="text-[12px] font-bold bg-transparent border-0 cursor-pointer"
              style={{ color: 'var(--primary)' }}
            >
              {t('common.edit')}
            </button>
          </div>
          {(contacts.driverName || contacts.driverPhone) && (
            <div className="flex items-center justify-between gap-2 pt-1 border-t" style={{ borderColor: 'var(--divider)' }}>
              <div className="min-w-0">
                <div className="text-xs font-bold uppercase" style={{ color: 'var(--text-2)' }}>{t('trips.driver')}</div>
                <div className="text-[13.5px] font-bold break-words" style={{ color: 'var(--text)' }}>
                  {contacts.driverName || '—'}
                  {contacts.driverPhone ? ` · ${contacts.driverPhone}` : ''}
                </div>
              </div>
              {contacts.driverPhone && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <a
                    href={`tel:${contacts.driverPhone.replace(/\s+/g, '')}`}
                    aria-label={`Call driver ${contacts.driverPhone}`}
                    className="size-10 rounded-full border flex items-center justify-center no-underline"
                    style={{ borderColor: 'var(--border)', color: 'var(--primary)' }}
                  >
                    <Phone size={15} />
                  </a>
                  <a
                    href={whatsappLink(contacts.driverPhone, `Trip #${detailTrip.id} (${detailTrip.vehicle || 'Van'}) · ${detailTrip.date}`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`WhatsApp driver ${contacts.driverPhone}`}
                    className="size-10 rounded-full border flex items-center justify-center no-underline"
                    style={{ borderColor: 'var(--border)', color: 'var(--paid)' }}
                  >
                    <MessageCircle size={15} />
                  </a>
                </div>
              )}
            </div>
          )}
          {(contacts.salesmanName || contacts.salesmanPhone) && (
            <div className="flex items-center justify-between gap-2 pt-1 border-t" style={{ borderColor: 'var(--divider)' }}>
              <div className="min-w-0">
                <div className="text-xs font-bold uppercase" style={{ color: 'var(--text-2)' }}>{t('trips.salesman')}</div>
                <div className="text-[13.5px] font-bold break-words" style={{ color: 'var(--text)' }}>
                  {contacts.salesmanName || '—'}
                  {contacts.salesmanPhone ? ` · ${contacts.salesmanPhone}` : ''}
                </div>
              </div>
              {contacts.salesmanPhone && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <a
                    href={`tel:${contacts.salesmanPhone.replace(/\s+/g, '')}`}
                    aria-label={`Call salesman ${contacts.salesmanPhone}`}
                    className="size-10 rounded-full border flex items-center justify-center no-underline"
                    style={{ borderColor: 'var(--border)', color: 'var(--primary)' }}
                  >
                    <Phone size={15} />
                  </a>
                  <a
                    href={whatsappLink(contacts.salesmanPhone, `Trip #${detailTrip.id} (${detailTrip.vehicle || 'Van'}) · ${detailTrip.date}`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`WhatsApp salesman ${contacts.salesmanPhone}`}
                    className="size-10 rounded-full border flex items-center justify-center no-underline"
                    style={{ borderColor: 'var(--border)', color: 'var(--paid)' }}
                  >
                    <MessageCircle size={15} />
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-center gap-4 pt-1">
        <button
          type="button"
          onClick={() => openEdit(detailTrip)}
          className="inline-flex items-center gap-1.5 text-[13px] font-bold bg-transparent border-0 cursor-pointer"
          style={{ color: 'var(--primary)', minHeight: '44px' }}
        >
          <Pencil size={14} /> {t('trips.editLoad')}
        </button>
        <button
          type="button"
          onClick={() => setTripToDelete(detailTrip)}
          className="inline-flex items-center gap-1.5 text-[13px] font-bold bg-transparent border-0 cursor-pointer"
          style={{ color: 'var(--due)', minHeight: '44px' }}
        >
          <Trash2 size={14} /> {t('common.delete')}
        </button>
      </div>

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
          setDetailTripId(null);
          showToast(`Trip #${id} (${vehicle}) deleted.`);
        }}
      />
    </div>
  );
};
