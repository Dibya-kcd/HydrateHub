import React from 'react';
import { Warehouse } from '../../../types';
import { money } from '../../../utils/billing';
import { KnownSupplier } from './inwardTypes';

interface InwardDesktopHeaderCardProps {
  labelCls: string;
  fieldCls: string;
  labelStyle: React.CSSProperties;
  palette: { line: string };
  supplierName: string;
  setSupplierName: (v: string) => void;
  applySupplierAutofill: (nameVal: string) => void;
  knownSuppliers: KnownSupplier[];
  supplierPhone: string;
  setSupplierPhone: (v: string) => void;
  phoneError: string | null;
  invoiceNo: string;
  setInvoiceNo: (v: string) => void;
  inwardDate: string;
  setInwardDate: (v: string) => void;
  targetWarehouseId: string;
  setTargetWarehouseId: (v: string) => void;
  warehouses: Warehouse[];
  supplierGstin: string;
  setSupplierGstin: (v: string) => void;
  vehicleNo: string;
  setVehicleNo: (v: string) => void;
  showProviderFields: boolean;
  setShowProviderFields: React.Dispatch<React.SetStateAction<boolean>>;
  supplierAddress: string;
  setSupplierAddress: (v: string) => void;
  supplierEmail: string;
  setSupplierEmail: (v: string) => void;
  placeOfSupply: string;
  setPlaceOfSupply: (v: string) => void;
  billedTo: string;
  setBilledTo: (v: string) => void;
  totalInwardCost: number;
  reviewCasesTotal: number;
  reviewInwardCostPerCrate: number;
  showMoreInwardCosts: boolean;
  setShowMoreInwardCosts: React.Dispatch<React.SetStateAction<boolean>>;
  freightCost: number;
  setFreightCost: (v: number) => void;
  labourCost: number;
  setLabourCost: (v: number) => void;
  otherInwardCost: number;
  setOtherInwardCost: (v: number) => void;
}

export const InwardDesktopHeaderCard: React.FC<InwardDesktopHeaderCardProps> = ({
  labelCls,
  fieldCls,
  labelStyle,
  palette,
  supplierName,
  setSupplierName,
  applySupplierAutofill,
  knownSuppliers,
  supplierPhone,
  setSupplierPhone,
  phoneError,
  invoiceNo,
  setInvoiceNo,
  inwardDate,
  setInwardDate,
  targetWarehouseId,
  setTargetWarehouseId,
  warehouses,
  supplierGstin,
  setSupplierGstin,
  vehicleNo,
  setVehicleNo,
  showProviderFields,
  setShowProviderFields,
  supplierAddress,
  setSupplierAddress,
  supplierEmail,
  setSupplierEmail,
  placeOfSupply,
  setPlaceOfSupply,
  billedTo,
  setBilledTo,
  totalInwardCost,
  reviewCasesTotal,
  reviewInwardCostPerCrate,
  showMoreInwardCosts,
  setShowMoreInwardCosts,
  freightCost,
  setFreightCost,
  labourCost,
  setLabourCost,
  otherInwardCost,
  setOtherInwardCost,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Supplier</label>
          <input
            list="inward-known-suppliers"
            value={supplierName}
            onChange={(e) => {
              const val = e.target.value;
              setSupplierName(val);
              applySupplierAutofill(val);
            }}
            onBlur={(e) => applySupplierAutofill(e.target.value)}
            placeholder="Supplier / Party name…"
            className={fieldCls}
          />
          <datalist id="inward-known-suppliers">
            {knownSuppliers.map((s) => (
              <option key={s.name} value={s.name} />
            ))}
          </datalist>
        </div>
        <div>
          <label className={labelCls}>Supplier Phone</label>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={supplierPhone}
            onChange={(e) => setSupplierPhone(e.target.value)}
            placeholder="+91 98765 43210"
            className={`${fieldCls} font-mono ${phoneError ? 'border-rose-300' : ''}`}
          />
          {phoneError && (
            <p className="text-xs text-rose-600 font-medium mt-1">{phoneError}</p>
          )}
        </div>
        <div>
          <label className={labelCls}>Supplier invoice no.</label>
          <input
            value={invoiceNo}
            onChange={(e) => setInvoiceNo(e.target.value)}
            className={fieldCls}
          />
        </div>
        <div>
          <label className={labelCls}>Invoice date</label>
          <input
            type="date"
            value={inwardDate}
            onChange={(e) => setInwardDate(e.target.value)}
            className={fieldCls}
          />
        </div>
        <div>
          <label className={labelCls}>Receive into</label>
          <select
            value={targetWarehouseId}
            onChange={(e) => setTargetWarehouseId(e.target.value)}
            required
            className={`${fieldCls} cursor-pointer ${!targetWarehouseId ? 'border-rose-300' : ''}`}
          >
            <option value="">Choose godown…</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.code})
              </option>
            ))}
          </select>
          {!targetWarehouseId && (
            <p className="text-xs text-rose-600 font-semibold mt-1">
              Required — this invoice cannot be posted until a warehouse is chosen.
            </p>
          )}
        </div>
        <div>
          <label className={labelCls}>Supplier GSTIN</label>
          <input autoCapitalize="characters" autoComplete="off" autoCorrect="off" spellCheck={false}
            value={supplierGstin}
            onChange={(e) => setSupplierGstin(e.target.value)}
            placeholder="Optional (leave blank for Non-GST)"
            className={`${fieldCls} font-mono uppercase`}
          />
        </div>
        <div>
          <label className={labelCls}>Vehicle no.</label>
          <input
            value={vehicleNo}
            onChange={(e) => setVehicleNo(e.target.value)}
            placeholder="Optional"
            className={`${fieldCls} font-mono uppercase`}
          />
        </div>
        <div className="flex items-end pb-1">
          <button
            type="button"
            onClick={() => setShowProviderFields((prev) => !prev)}
            className="text-xs font-semibold text-[var(--primary)] hover:underline cursor-pointer"
          >
            {showProviderFields ? 'Hide address & POS' : '+ More details (address, email, POS)'}
          </button>
        </div>
      </div>

      {showProviderFields && (
        <div className="mt-3 pt-3 border-t-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs" style={{ borderColor: palette.line }}>
          <div className="md:col-span-2">
            <label style={labelStyle}>Supplier Registered Address</label>
            <input
              value={supplierAddress}
              onChange={(e) => setSupplierAddress(e.target.value)}
              placeholder="Main Road, Near Bus Stand, Kuchinda - 768222"
              className="w-full border-2 px-3 py-1 text-xs"
              style={{ borderColor: palette.line }}
            />
          </div>
          <div>
            <label style={labelStyle}>Supplier Email</label>
            <input
              value={supplierEmail}
              onChange={(e) => setSupplierEmail(e.target.value)}
              placeholder="supplier@example.com"
              className="w-full border-2 px-3 py-1 text-xs"
              style={{ borderColor: palette.line }}
            />
          </div>
          <div>
            <label style={labelStyle}>Place of Supply (POS)</label>
            <input
              value={placeOfSupply}
              onChange={(e) => setPlaceOfSupply(e.target.value)}
              placeholder="Odisha (21)"
              className="w-full border-2 px-3 py-1 text-xs"
              style={{ borderColor: palette.line }}
            />
          </div>
          <div>
            <label style={labelStyle}>Billed To (Consignee)</label>
            <input
              value={billedTo}
              onChange={(e) => setBilledTo(e.target.value)}
              placeholder="NEW BIJAYA PUSTAK BHANDRA"
              className="w-full border-2 px-3 py-1 text-xs"
              style={{ borderColor: palette.line }}
            />
          </div>
        </div>
      )}

      {/* Manual Freight & Labour Inward Costs */}
      <div className="pt-3 border-t border-black/5 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className={labelCls + ' mb-0'}>
            Manual Handling / Landing Costs (Auto-added to Landed Price)
          </span>
          <div className="flex items-center gap-3 text-xs tabular-nums">
            {totalInwardCost > 0 && (
              <span className="font-semibold text-emerald-700">
                Total: ₹{money(totalInwardCost)}
                {reviewCasesTotal > 0 ? ` (+₹${money(reviewInwardCostPerCrate)}/case)` : ''}
              </span>
            )}
            <button
              type="button"
              onClick={() => setShowMoreInwardCosts((v) => !v)}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              {showMoreInwardCosts ? 'Hide other' : '+ Transport/Other'}
            </button>
          </div>
        </div>
        <div className={`grid grid-cols-1 ${showMoreInwardCosts ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-3`}>
          <div>
            <label className={labelCls}>Freight (₹ total bill)</label>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={freightCost || ''}
              onChange={(e) => setFreightCost(Math.max(0, Number(e.target.value) || 0))}
              placeholder="0"
              className={`${fieldCls} tabular-nums font-mono`}
            />
          </div>
          <div>
            <label className={labelCls}>Labour (₹ total bill)</label>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={labourCost || ''}
              onChange={(e) => setLabourCost(Math.max(0, Number(e.target.value) || 0))}
              placeholder="0"
              className={`${fieldCls} tabular-nums font-mono`}
            />
          </div>
          {showMoreInwardCosts && (
            <div>
              <label className={labelCls}>Transport / Other (₹)</label>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={otherInwardCost || ''}
                onChange={(e) => setOtherInwardCost(Math.max(0, Number(e.target.value) || 0))}
                placeholder="0"
                className={`${fieldCls} tabular-nums font-mono`}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
