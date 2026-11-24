import React from 'react';
import { AlertTriangle, ChevronDown, ChevronLeft, ChevronUp, Plus } from 'lucide-react';
import { Bill, Product, Salesman, Trip, Warehouse } from '../../../types';
import { compareProductsInSequence } from '../../../utils/sizeColor';
import { PackIcon } from '../../common/PackIcon';
import { OdiaName } from '../../common/OdiaName';
import { LoadLineCard, fieldBox, fieldLabel } from './LoadSheetParts';

interface TripEditPhoneCompletedViewProps {
  trip: Trip;
  products: Product[];
  salesmen: Salesman[];
  warehouses: Warehouse[];
  error: string | null;
  vehicle: string;
  setVehicle: (v: string) => void;
  salesmanId: string;
  setSalesmanId: (v: string) => void;
  salesmanName: string;
  salesmanPhone: string;
  setSalesmanPhone: (v: string) => void;
  warehouseId: string;
  handleGodownChange: (id: string) => void;
  godownMoveHint: string | null;
  activeProductIds: number[];
  loaded: Record<number, string>;
  soldByProduct: Record<number, number>;
  pendingByProduct: Record<number, number>;
  editingProdId: number | null;
  setEditingProdId: React.Dispatch<React.SetStateAction<number | null>>;
  showMoreDetails: boolean;
  setShowMoreDetails: React.Dispatch<React.SetStateAction<boolean>>;
  date: string;
  setDate: (v: string) => void;
  driver: string;
  setDriver: (v: string) => void;
  driverPhone: string;
  setDriverPhone: (v: string) => void;
  autoAttachBills: boolean;
  setAutoAttachBills: (v: boolean) => void;
  pendingBills: Bill[];
  stockHere: (pid: number) => number;
  stockAll: (pid: number) => number;
  nameOf: (pid: number) => string;
  setShowAdd: (v: boolean) => void;
  handleSetQtyDirect: (pid: number, val: string) => void;
  handleUpdateQty: (pid: number, delta: number) => void;
  handleRemoveProduct: (pid: number) => void;
  handleCancel: () => void;
  openReview: () => void;
  onReopenTripNow?: (tripId: number) => void;
  onBack: () => void;
  sharedModals: React.ReactNode;
}

export const TripEditPhoneCompletedView: React.FC<TripEditPhoneCompletedViewProps> = ({
  trip,
  products,
  salesmen,
  warehouses,
  error,
  vehicle,
  setVehicle,
  salesmanId,
  setSalesmanId,
  salesmanName,
  salesmanPhone,
  setSalesmanPhone,
  warehouseId,
  handleGodownChange,
  godownMoveHint,
  activeProductIds,
  loaded,
  soldByProduct,
  pendingByProduct,
  editingProdId,
  setEditingProdId,
  showMoreDetails,
  setShowMoreDetails,
  date,
  setDate,
  driver,
  setDriver,
  driverPhone,
  setDriverPhone,
  autoAttachBills,
  setAutoAttachBills,
  pendingBills,
  stockHere,
  stockAll,
  nameOf,
  setShowAdd,
  handleSetQtyDirect,
  handleUpdateQty,
  handleRemoveProduct,
  handleCancel,
  openReview,
  onReopenTripNow,
  onBack,
  sharedModals,
}) => {
  const mobileSortedIds = [...activeProductIds].sort((a, b) =>
    compareProductsInSequence(
      products.find((p) => p.id === a) || { name: nameOf(a) },
      products.find((p) => p.id === b) || { name: nameOf(b) },
    ),
  );

  return (
    <div className="rt-flow-phone" id="trip-edit-screen">
      <div className="hh-sales-top">
        <div className="hh-sales-top__row">
          <div className="flex items-center gap-1 min-w-0">
            <button
              type="button"
              onClick={handleCancel}
              className="hh-sales-top__iconbtn"
              aria-label="Back"
            >
              <ChevronLeft size={24} strokeWidth={2.2} />
            </button>
            <h1 className="hh-sales-top__title truncate">Edit trip #{trip.id}</h1>
          </div>
          <span className="rt-trip-badge-completed shrink-0">Completed</span>
        </div>
      </div>

      <div id="trip-edit-scroll" className="rt-flow-phone__body space-y-2.5">
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-[12.5px] font-medium text-amber-950 leading-snug">
          This trip is completed. Saving your changes reopens it so you can settle it again.
        </div>

        {error && (
          <div role="alert" className="flex items-start gap-2 p-3 rounded-2xl border border-rose-200 bg-rose-50 text-rose-800 text-[13px] font-bold">
            <AlertTriangle size={17} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <label className="rt-in" style={{ borderRadius: '16px' }}>
          <span className="rt-in__label uppercase">Vehicle</span>
          <input
            id="edit-vehicle"
            type="text"
            value={vehicle}
            onChange={(e) => setVehicle(e.target.value)}
            placeholder="e.g. OD-02-AB-4471"
            className="rt-in__control font-extrabold"
          />
        </label>

        <label className="rt-in" style={{ borderRadius: '16px' }}>
          <span className="rt-in__label uppercase">Salesman</span>
          <div className="rt-in__select-wrap">
            <select
              id="edit-salesman"
              value={salesmanId}
              onChange={(e) => {
                const nextId = e.target.value;
                setSalesmanId(nextId);
                const sm = salesmen.find((s) => s.id === nextId);
                if (sm?.phone) setSalesmanPhone(sm.phone);
              }}
              className="rt-in__control font-extrabold"
            >
              <option value="">{salesmanName && !salesmanId ? salesmanName : 'Choose…'}</option>
              {salesmen.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="rt-in__select-chev" aria-hidden="true" />
          </div>
        </label>

        <div className="space-y-1">
          <label className="rt-in" style={{ borderRadius: '16px' }}>
            <span className="rt-in__label uppercase">Loaded from</span>
            <div className="rt-in__select-wrap">
              <select
                id="edit-warehouse"
                value={warehouseId}
                onChange={(e) => handleGodownChange(e.target.value)}
                className="rt-in__control font-extrabold"
              >
                {warehouses.length === 0 && <option value="">Main Godown</option>}
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="rt-in__select-chev" aria-hidden="true" />
            </div>
          </label>
          {godownMoveHint && <p className="px-1 text-xs m-0" style={{ color: 'var(--text-2)' }}>{godownMoveHint}</p>}
        </div>

        <div className="rt-card space-y-2">
          {mobileSortedIds.length === 0 ? (
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="w-full py-4 text-center text-[13px] font-bold bg-transparent border-0 cursor-pointer"
              style={{ color: 'var(--primary)' }}
            >
              + Add products to load
            </button>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--divider)' }}>
              {mobileSortedIds.map((pid) => {
                const prod = products.find((p) => p.id === pid);
                const curQty = Number(loaded[pid]) || 0;
                const sold = soldByProduct[pid] || 0;
                const pending = pendingByProduct[pid] || 0;
                const tooLow = sold + pending > curQty;
                const here = stockHere(pid);
                const other = stockAll(pid) - here;
                const isEditingThis = editingProdId === pid;

                return (
                  <div key={pid} className="py-2 first:pt-0.5 last:pb-0.5">
                    <button
                      type="button"
                      onClick={() => setEditingProdId((cur) => (cur === pid ? null : pid))}
                      aria-expanded={isEditingThis}
                      className="w-full flex items-center justify-between gap-2.5 text-left bg-transparent border-0 p-0 cursor-pointer min-h-[36px]"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <PackIcon size="sm" pack={prod?.pack} name={nameOf(pid)} />
                        <span className="text-[13.5px] font-bold truncate" style={{ color: 'var(--text)' }}>
                          <OdiaName name={nameOf(pid)} />
                        </span>
                      </div>
                      <span
                        className="shrink-0 text-[13.5px] font-extrabold tabular-nums whitespace-nowrap"
                        style={{ color: tooLow ? 'var(--due)' : 'var(--text)' }}
                      >
                        {curQty} cs
                      </span>
                    </button>

                    {isEditingThis && (
                      <div className="pt-2.5">
                        <LoadLineCard
                          product={prod}
                          fallbackName={`Product #${pid}`}
                          qty={loaded[pid] ?? ''}
                          onQty={(v) => handleSetQtyDirect(pid, v)}
                          onMinus={() => handleUpdateQty(pid, -1)}
                          onPlus={() => handleUpdateQty(pid, 1)}
                          onRemove={() => handleRemoveProduct(pid)}
                          problem={tooLow}
                          facts={[
                            { label: 'Godown', value: `${here} cs${other > 0 ? ` (+${other} other)` : ''}` },
                            { label: 'Billed', value: `${sold + pending} cs`, bad: tooLow },
                          ]}
                          warning={tooLow ? 'Load is less than billed' : undefined}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-1.5 border-t flex items-center justify-between gap-2" style={{ borderColor: 'var(--divider)' }}>
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-1 text-[12.5px] font-bold bg-transparent border-0 cursor-pointer px-1"
              style={{ color: 'var(--primary)', minHeight: '36px' }}
            >
              <Plus size={14} /> Add product
            </button>
            <button
              type="button"
              onClick={() => setShowMoreDetails((v) => !v)}
              aria-expanded={showMoreDetails}
              className="inline-flex items-center gap-1 text-[12px] font-semibold bg-transparent border-0 cursor-pointer px-1"
              style={{ color: 'var(--text-2)', minHeight: '36px' }}
            >
              Date, crew &amp; bills {showMoreDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>

        {showMoreDetails && (
          <div className="rt-card space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="edit-trip-date" className={fieldLabel}>Trip date *</label>
                <input
                  id="edit-trip-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={fieldBox}
                />
              </div>
              <div>
                <label htmlFor="edit-salesman-phone" className={fieldLabel}>Salesman phone</label>
                <input
                  id="edit-salesman-phone"
                  type="tel"
                  inputMode="tel"
                  value={salesmanPhone}
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
                  onChange={(e) => setDriver(e.target.value)}
                  placeholder="Driver name"
                  className={fieldBox}
                />
              </div>
              <div>
                <label htmlFor="edit-driver-phone" className={fieldLabel}>Driver phone</label>
                <input
                  id="edit-driver-phone"
                  type="tel"
                  inputMode="tel"
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  placeholder="10-digit mobile"
                  className={fieldBox}
                />
              </div>
            </div>

            <label className="flex items-center gap-2.5 text-[12.5px] font-semibold cursor-pointer" style={{ color: 'var(--text)' }}>
              <input
                type="checkbox"
                checked={autoAttachBills}
                onChange={(e) => setAutoAttachBills(e.target.checked)}
                className="size-4 rounded"
              />
              <span>Attach bills of this date</span>
              {pendingBills.length > 0 && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}>
                  {pendingBills.length} ready
                </span>
              )}
            </label>
          </div>
        )}

        <p className="text-[12px] font-medium px-0.5 m-0" style={{ color: 'var(--text-2)' }}>
          Or use &lsquo;Reopen now&rsquo; to move it back without editing.
        </p>
      </div>

      <div className="rt-flow-phone__footer">
        <div className="grid grid-cols-2 gap-2.5">
          {onReopenTripNow ? (
            <button
              type="button"
              id="btn-instant-reopen-trip-screen"
              onClick={() => {
                onReopenTripNow(Number(trip.id));
                onBack();
              }}
              className="rt-btn-outline rt-btn-outline--primary"
            >
              Reopen now
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCancel}
              className="rt-btn-outline rt-btn-outline--primary"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            id="btn-trip-edit-review"
            onClick={openReview}
            className="rt-btn"
          >
            Save and reopen
          </button>
        </div>
      </div>

      {sharedModals}
    </div>
  );
};
