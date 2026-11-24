import React from 'react';
import { Building2, Calendar, Phone, Truck, UserCheck } from 'lucide-react';
import type { Bill, PaletteTokens, Trip, Warehouse } from '../../../types';
import type { BillEditPreview } from '../../../context/LedgerContext';
import { ToggleSwitch } from '../../ui/ToggleSwitch';

interface EditBillCustomerSectionProps {
  bill: Bill;
  retailer: string;
  setRetailer: (val: string) => void;
  phone: string;
  setPhone: (val: string) => void;
  date: string;
  setDate: (val: string) => void;
  validWarehouseSelectValue: string;
  setWarehouseId: (val: string) => void;
  warehouses: Warehouse[];
  existingCustomerCount: number;
  onOpenCustomerPicker: () => void;
  isTripBill: boolean;
  tripGodownLabel: string;
  preview: BillEditPreview | null;
  resolvedSourceTrip: Trip | undefined;
  formatLocked: boolean;
  effectiveFormat: 'gst' | 'non_gst';
  setInvoiceFormat: (fmt: 'gst' | 'non_gst') => void;
  customerGstin: string;
  setCustomerGstin: (val: string) => void;
  ewayBillNo: string;
  setEwayBillNo: (val: string) => void;
  transporterName: string;
  setTransporterName: (val: string) => void;
  irn: string;
  setIrn: (val: string) => void;
  transportDistanceKm: string;
  setTransportDistanceKm: (val: string) => void;
  palette: PaletteTokens;
}

export const EditBillCustomerSection: React.FC<EditBillCustomerSectionProps> = ({
  bill,
  retailer,
  setRetailer,
  phone,
  setPhone,
  date,
  setDate,
  validWarehouseSelectValue,
  setWarehouseId,
  warehouses,
  existingCustomerCount,
  onOpenCustomerPicker,
  isTripBill,
  tripGodownLabel,
  preview,
  resolvedSourceTrip,
  formatLocked,
  effectiveFormat,
  setInvoiceFormat,
  customerGstin,
  setCustomerGstin,
  ewayBillNo,
  setEwayBillNo,
  transporterName,
  setTransporterName,
  irn,
  setIrn,
  transportDistanceKm,
  setTransportDistanceKm,
  palette,
}) => {
  return (
    <div
      className="p-4 rounded-xl border space-y-3"
      style={{ borderColor: palette.line, backgroundColor: palette.cream }}
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs font-bold uppercase tracking-wider opacity-75 flex items-center gap-1.5">
          <UserCheck size={14} /> Customer &amp; Dispatch Information
        </span>
        <button
          type="button"
          onClick={onOpenCustomerPicker}
          className="text-xs font-bold px-2.5 py-1 rounded-md border flex items-center gap-1.5 shadow-sm hover:shadow-sm transition-all"
          style={{
            borderColor: palette.focus,
            color: palette.focus,
            backgroundColor: `${palette.focus}12`,
          }}
          id="edit-modal-pick-customer-btn"
        >
          <UserCheck size={13} />
          <span>Select Existing Customer ({existingCustomerCount})</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Retailer Name */}
        <div>
          <label className="block text-xs font-bold mb-1 opacity-80">
            Retailer / Party Name *
          </label>
          <input
            type="text"
            placeholder="e.g. Ramesh Kirana"
            value={retailer}
            onChange={(e) => setRetailer(e.target.value)}
            className="w-full px-3 py-2 text-sm border-2 rounded-lg font-medium focus:outline-none focus:ring-1"
            style={{
              borderColor: palette.line,
              backgroundColor: palette.panel || '#ffffff',
              color: palette.ink,
            }}
            id="edit-modal-retailer-input"
          />
        </div>

        {/* Phone */}
        <div>
          <label className="block text-xs font-bold mb-1 opacity-80 flex items-center gap-1">
            <Phone size={12} /> WhatsApp Phone
          </label>
          <input
            type="tel"
            placeholder="e.g. 9876543210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-3 py-2 text-sm border-2 rounded-lg font-mono focus:outline-none focus:ring-1"
            style={{
              borderColor: palette.line,
              backgroundColor: palette.panel || '#ffffff',
              color: palette.ink,
            }}
            id="edit-modal-phone-input"
          />
        </div>

        {/* Date */}
        <div>
          <label className="block text-xs font-bold mb-1 opacity-80 flex items-center gap-1">
            <Calendar size={12} /> Invoice Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 text-sm border-2 rounded-lg focus:outline-none focus:ring-1"
            style={{
              borderColor: palette.line,
              backgroundColor: palette.panel || '#ffffff',
              color: palette.ink,
            }}
            id="edit-modal-date-input"
          />
        </div>

        {/* Warehouse */}
        <div>
          <label className="block text-xs font-bold mb-1 opacity-80 flex items-center gap-1">
            <Building2 size={12} /> Dispatch Godown
          </label>
          {isTripBill ? (
            <div>
              <div
                id="edit-modal-warehouse-select"
                title="This bill was sold from a trip. Dispatch godown follows the trip load."
                className="w-full min-h-[40px] px-3 py-2 text-sm border-2 rounded-lg font-medium flex items-center justify-between gap-2 bg-stone-100/80"
                style={{
                  borderColor: palette.line,
                  color: palette.ink,
                }}
              >
                <span className="truncate">
                  {tripGodownLabel || 'Trip Godown'}
                </span>
                <Truck size={14} className="shrink-0 opacity-60" />
              </div>
              <p className="text-xs opacity-70 mt-1 flex items-center gap-1 truncate">
                From Trip #{preview?.source.tripId ?? resolvedSourceTrip?.id ?? bill.tripId} load
              </p>
            </div>
          ) : (
            <select
              value={validWarehouseSelectValue}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="w-full px-3 py-2 text-sm border-2 rounded-lg focus:outline-none focus:ring-1"
              style={{
                borderColor: palette.line,
                backgroundColor: palette.panel || '#ffffff',
                color: palette.ink,
              }}
              id="edit-modal-warehouse-select"
            >
              <option value="">Default Godown</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} {w.location ? `(${w.location})` : ''}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Document Format Option - Compact GST / Non-GST Toggle (locked for Composition / Unregistered bills) */}
      <div
        className="p-3 rounded-xl border bg-stone-50/80 space-y-2.5"
        style={{ borderColor: palette.line }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`px-1.5 min-w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shrink-0 border ${
                effectiveFormat === 'gst'
                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                  : 'bg-emerald-100 text-emerald-800 border-emerald-300'
              }`}
            >
              {effectiveFormat === 'gst' ? 'GST' : formatLocked ? 'BOS' : 'CASH'}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-black text-stone-900 truncate">
                {effectiveFormat === 'gst'
                  ? 'GST Tax Invoice'
                  : formatLocked
                    ? 'Bill of Supply (No Output GST)'
                    : 'Non-GST Retail Bill'}
              </div>
              <div className="text-xs text-stone-500 font-semibold truncate">
                {effectiveFormat === 'gst'
                  ? 'Official tax invoice with B2B GSTIN'
                  : formatLocked
                    ? `Locked by ${bill.taxStamp?.registrationType === 'composition' ? 'Composition' : 'Unregistered'} tax regime`
                    : 'Standard retail cash memo'}
              </div>
            </div>
          </div>

          {formatLocked ? (
            <span className="px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wide bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
              Locked
            </span>
          ) : (
            <ToggleSwitch
              id="edit-modal-gst-toggle"
              size="lg"
              tone="gst"
              checked={effectiveFormat === 'gst'}
              onChange={(next) => setInvoiceFormat(next ? 'gst' : 'non_gst')}
              title={`Toggle between Non-GST and GST (Currently: ${effectiveFormat === 'gst' ? 'GST' : 'Non-GST'})`}
              ariaLabel="Toggle GST Tax Invoice format"
            />
          )}
        </div>

        {effectiveFormat === 'gst' && (
          <div className="pt-2 border-t border-stone-200">
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
              Buyer GSTIN (15 Digits)
            </label>
            <input
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              type="text"
              value={customerGstin}
              onChange={(e) => setCustomerGstin(e.target.value.toUpperCase())}
              placeholder="e.g. 21AAAAA0000A1Z5"
              maxLength={15}
              className="w-full px-3 py-2 text-xs font-mono font-bold uppercase border rounded-xl bg-white focus:outline-none focus:ring-1 focus:border-amber-600"
              style={{ borderColor: palette.line }}
            />
          </div>
        )}

        {/* Optional Collapsible E-Way & Transport Details to save mobile space */}
        <details className="pt-1 text-xs text-stone-500">
          <summary className="cursor-pointer font-bold text-xs uppercase tracking-wider hover:text-stone-700 flex items-center gap-1">
            <Truck size={12} className="text-stone-400" />
            <span>Optional: E-Way Bill &amp; Transport Details</span>
          </summary>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 pt-2 border-t border-stone-200">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-0.5">
                E-way bill no.
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={ewayBillNo}
                onChange={(e) => setEwayBillNo(e.target.value.replace(/\D/g, '').slice(0, 12))}
                placeholder="12 digits"
                className="w-full px-2 py-1 text-xs font-mono font-bold border rounded-lg bg-white focus:outline-none"
                style={{ borderColor: palette.line }}
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-0.5">
                Transporter
              </label>
              <input
                type="text"
                value={transporterName}
                onChange={(e) => setTransporterName(e.target.value)}
                placeholder="Vehicle / Name"
                className="w-full px-2 py-1 text-xs font-bold border rounded-lg bg-white focus:outline-none"
                style={{ borderColor: palette.line }}
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-0.5">
                IRN (e-invoice)
              </label>
              <input
                type="text"
                value={irn}
                onChange={(e) => setIrn(e.target.value.trim().slice(0, 64))}
                placeholder="64-char IRN"
                className="w-full px-2 py-1 text-xs font-mono font-bold border rounded-lg bg-white focus:outline-none"
                style={{ borderColor: palette.line }}
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-0.5">
                Distance (km)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={transportDistanceKm}
                onChange={(e) => setTransportDistanceKm(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="km"
                className="w-full px-2 py-1 text-xs font-bold border rounded-lg bg-white focus:outline-none"
                style={{ borderColor: palette.line }}
              />
            </div>
          </div>
        </details>
      </div>
    </div>
  );
};
