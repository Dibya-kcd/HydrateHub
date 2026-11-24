import React from 'react';
import { ChevronRight } from 'lucide-react';
import { CATS } from '../../../constants/initialData';
import { Warehouse } from '../../../types';
import { generateAutoSku, money } from '../../../utils/billing';
import { calcInwardRowBreakdown, EditableInwardRow, KnownSupplier } from '../bulkInwardTypes';

interface BulkInwardPhoneBillSubViewProps {
  knownSuppliers: KnownSupplier[];
  applySupplierAutofill: (nameVal: string, currentPhone?: string, currentGstin?: string) => void;
  supplierName: string;
  setSupplierName: React.Dispatch<React.SetStateAction<string>>;
  supplierPhone: string;
  setSupplierPhone: React.Dispatch<React.SetStateAction<string>>;
  supplierPhoneError: string | null;
  supplierGstin: string;
  setSupplierGstin: React.Dispatch<React.SetStateAction<string>>;
  invoiceNo: string;
  setInvoiceNo: React.Dispatch<React.SetStateAction<string>>;
  inwardDate: string;
  setInwardDate: React.Dispatch<React.SetStateAction<string>>;
  targetWarehouseId: string;
  setTargetWarehouseId: React.Dispatch<React.SetStateAction<string>>;
  warehouses: Warehouse[];
  vehicleNo: string;
  setVehicleNo: React.Dispatch<React.SetStateAction<string>>;
  overallDiscount: number;
  setOverallDiscount: React.Dispatch<React.SetStateAction<number>>;
  originalInvoiceTotal: number | null;
  setOriginalInvoiceTotal: React.Dispatch<React.SetStateAction<number | null>>;
  totalInwardCost: number;
  setMobileSubView: React.Dispatch<React.SetStateAction<'overview' | 'bill' | 'costs' | 'edit_line'>>;
}

export const BulkInwardPhoneBillSubView: React.FC<BulkInwardPhoneBillSubViewProps> = ({
  knownSuppliers,
  applySupplierAutofill,
  supplierName,
  setSupplierName,
  supplierPhone,
  setSupplierPhone,
  supplierPhoneError,
  supplierGstin,
  setSupplierGstin,
  invoiceNo,
  setInvoiceNo,
  inwardDate,
  setInwardDate,
  targetWarehouseId,
  setTargetWarehouseId,
  warehouses,
  vehicleNo,
  setVehicleNo,
  overallDiscount,
  setOverallDiscount,
  originalInvoiceTotal,
  setOriginalInvoiceTotal,
  totalInwardCost,
  setMobileSubView,
}) => (
  <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-2.5">
    <div className="hh-inv-field hh-inv-field--focus">
      <span className="hh-inv-field__label">SUPPLIER NAME</span>
      <input
        list="bulk-inward-known-suppliers"
        type="text"
        value={supplierName}
        onChange={(e) => {
          const v = e.target.value;
          setSupplierName(v);
          applySupplierAutofill(v);
        }}
        onBlur={(e) => applySupplierAutofill(e.target.value)}
        placeholder="Supplier name"
      />
      <datalist id="bulk-inward-known-suppliers">
        {knownSuppliers.map((s) => (
          <option key={s.name} value={s.name} />
        ))}
      </datalist>
    </div>

    <div className="grid grid-cols-2 gap-2.5">
      <div className="hh-inv-field">
        <span className="hh-inv-field__label">SUPPLIER PHONE</span>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={supplierPhone}
          onChange={(e) => setSupplierPhone(e.target.value)}
          placeholder="+91 98765 43210"
        />
      </div>
      <div className="hh-inv-field">
        <span className="hh-inv-field__label">INVOICE DATE</span>
        <input
          type="date"
          value={inwardDate}
          onChange={(e) => setInwardDate(e.target.value)}
        />
      </div>
    </div>
    {supplierPhoneError && (
      <div className="text-xs font-semibold text-rose-600 px-1">{supplierPhoneError}</div>
    )}

    <div className="hh-inv-field">
      <span className="hh-inv-field__label">INVOICE NO.</span>
      <input
        type="text"
        value={invoiceNo}
        onChange={(e) => setInvoiceNo(e.target.value)}
        placeholder="e.g. A-4471"
      />
    </div>

    <div className="hh-inv-field">
      <span className="hh-inv-field__label">SUPPLIER GSTIN</span>
      <input
        type="text"
        autoCapitalize="characters"
        value={supplierGstin}
        onChange={(e) => setSupplierGstin(e.target.value)}
        placeholder="Optional"
      />
    </div>

    <div className="hh-inv-field">
      <span className="hh-inv-field__label">RECEIVE INTO GODOWN *</span>
      <select
        value={targetWarehouseId}
        onChange={(e) => setTargetWarehouseId(e.target.value)}
      >
        <option value="">Select godown…</option>
        {warehouses.map((w) => (
          <option key={w.id} value={w.id}>{w.name}</option>
        ))}
      </select>
    </div>

    <div className="hh-inv-field">
      <span className="hh-inv-field__label">VEHICLE NO.</span>
      <input
        type="text"
        value={vehicleNo}
        onChange={(e) => setVehicleNo(e.target.value)}
        placeholder="e.g. OD-02-AB-4471"
      />
    </div>

    <div className="grid grid-cols-2 gap-2.5">
      <div className="hh-inv-field">
        <span className="hh-inv-field__label">BILL DISCOUNT (₹)</span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          value={overallDiscount || ''}
          onChange={(e) => setOverallDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
          placeholder="0"
        />
      </div>
      <div className="hh-inv-field">
        <span className="hh-inv-field__label">PARTY INVOICE TOTAL (₹)</span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          value={originalInvoiceTotal ?? ''}
          onChange={(e) => setOriginalInvoiceTotal(e.target.value === '' ? null : Math.max(0, parseFloat(e.target.value) || 0))}
          placeholder="0"
        />
      </div>
    </div>

    <button
      type="button"
      onClick={() => setMobileSubView('costs')}
      className="hh-inv-card w-full flex items-center justify-between text-left cursor-pointer"
    >
      <div>
        <div className="text-[13px] font-bold text-slate-900">Inward costs (Freight &amp; Labour)</div>
        <div className="text-xs text-slate-500">Total ₹{money(totalInwardCost)}</div>
      </div>
      <ChevronRight size={16} className="text-slate-400" />
    </button>

    <button
      type="button"
      onClick={() => setMobileSubView('overview')}
      className="hh-inv-btn-primary w-full"
    >
      Done, contract info
    </button>
  </div>
);

interface BulkInwardPhoneCostsSubViewProps {
  transportCost: number;
  setTransportCost: React.Dispatch<React.SetStateAction<number>>;
  freightCost: number;
  setFreightCost: React.Dispatch<React.SetStateAction<number>>;
  loadingLabourCost: number;
  setLoadingLabourCost: React.Dispatch<React.SetStateAction<number>>;
  unloadingLabourCost: number;
  setUnloadingLabourCost: React.Dispatch<React.SetStateAction<number>>;
  otherInwardCost: number;
  setOtherInwardCost: React.Dispatch<React.SetStateAction<number>>;
  invoiceRoundOff: number;
  setInvoiceRoundOff: React.Dispatch<React.SetStateAction<number>>;
  invoiceOtherCharges: number;
  setInvoiceOtherCharges: React.Dispatch<React.SetStateAction<number>>;
  totalInwardCost: number;
  totalReceivedQty: number;
  totalLandedInventoryValue: number;
  setMobileSubView: React.Dispatch<React.SetStateAction<'overview' | 'bill' | 'costs' | 'edit_line'>>;
}

export const BulkInwardPhoneCostsSubView: React.FC<BulkInwardPhoneCostsSubViewProps> = ({
  transportCost,
  setTransportCost,
  freightCost,
  setFreightCost,
  loadingLabourCost,
  setLoadingLabourCost,
  unloadingLabourCost,
  setUnloadingLabourCost,
  otherInwardCost,
  setOtherInwardCost,
  invoiceRoundOff,
  setInvoiceRoundOff,
  invoiceOtherCharges,
  setInvoiceOtherCharges,
  totalInwardCost,
  totalReceivedQty,
  totalLandedInventoryValue,
  setMobileSubView,
}) => (
  <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-2.5">
    <div className="hh-inv-card space-y-2.5">
      <div className="text-[13.5px] font-extrabold text-slate-900">
        Inward costs (added to landed cost)
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="hh-inv-field">
          <span className="hh-inv-field__label">TRANSPORT (₹)</span>
          <input
            type="number"
            inputMode="decimal"
            value={transportCost || ''}
            onChange={(e) => setTransportCost(Math.max(0, parseFloat(e.target.value) || 0))}
            placeholder="0"
          />
        </div>
        <div className="hh-inv-field">
          <span className="hh-inv-field__label">FREIGHT (₹)</span>
          <input
            type="number"
            inputMode="decimal"
            value={freightCost || ''}
            onChange={(e) => setFreightCost(Math.max(0, parseFloat(e.target.value) || 0))}
            placeholder="0"
          />
        </div>
        <div className="hh-inv-field">
          <span className="hh-inv-field__label">LOADING LABOUR (₹)</span>
          <input
            type="number"
            inputMode="decimal"
            value={loadingLabourCost || ''}
            onChange={(e) => setLoadingLabourCost(Math.max(0, parseFloat(e.target.value) || 0))}
            placeholder="0"
          />
        </div>
        <div className="hh-inv-field">
          <span className="hh-inv-field__label">UNLOADING LABOUR (₹)</span>
          <input
            type="number"
            inputMode="decimal"
            value={unloadingLabourCost || ''}
            onChange={(e) => setUnloadingLabourCost(Math.max(0, parseFloat(e.target.value) || 0))}
            placeholder="0"
          />
        </div>
      </div>
      <div className="hh-inv-field">
        <span className="hh-inv-field__label">OTHER INWARD COST (₹)</span>
        <input
          type="number"
          inputMode="decimal"
          value={otherInwardCost || ''}
          onChange={(e) => setOtherInwardCost(Math.max(0, parseFloat(e.target.value) || 0))}
          placeholder="0"
        />
      </div>
    </div>

    <div className="hh-inv-card space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        <div className="hh-inv-field">
          <span className="hh-inv-field__label">INVOICE ROUND-OFF (₹)</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={invoiceRoundOff}
            onChange={(e) => setInvoiceRoundOff(parseFloat(e.target.value) || 0)}
          />
        </div>
        <div className="hh-inv-field">
          <span className="hh-inv-field__label">OTHER CHARGES (₹)</span>
          <input
            type="number"
            inputMode="decimal"
            value={invoiceOtherCharges || ''}
            onChange={(e) => setInvoiceOtherCharges(Math.max(0, parseFloat(e.target.value) || 0))}
            placeholder="0"
          />
        </div>
      </div>
      <div className="flex items-center justify-between text-[13px] pt-1">
        <span className="text-slate-500">Total inward cost</span>
        <span className="font-extrabold text-slate-900 tabular-nums">₹{money(totalInwardCost)}</span>
      </div>
      <div className="flex items-center justify-between text-[13px]">
        <span className="text-slate-500">Avg landed ₹ / case</span>
        <span className="font-extrabold text-slate-900 tabular-nums">
          ₹{totalReceivedQty > 0 ? money(totalLandedInventoryValue / totalReceivedQty) : '0'}
        </span>
      </div>
    </div>

    <button
      type="button"
      onClick={() => setMobileSubView('overview')}
      className="hh-inv-btn-primary w-full"
    >
      Done
    </button>
  </div>
);

interface BulkInwardPhoneEditLineSubViewProps {
  row: EditableInwardRow;
  rows: EditableInwardRow[];
  inwardCostPerCrate: number;
  updateRowField: (id: string, field: keyof EditableInwardRow, val: any) => void;
  setPhoneCatalogSizeFilter: React.Dispatch<React.SetStateAction<'all' | '200' | '600' | '1000'>>;
  setCatalogPickerSearch: React.Dispatch<React.SetStateAction<string>>;
  setCatalogPickerRowId: React.Dispatch<React.SetStateAction<string | null>>;
  setPhoneDeleteConfirmId: React.Dispatch<React.SetStateAction<string | null>>;
  setMobileSubView: React.Dispatch<React.SetStateAction<'overview' | 'bill' | 'costs' | 'edit_line'>>;
}

export const BulkInwardPhoneEditLineSubView: React.FC<BulkInwardPhoneEditLineSubViewProps> = ({
  row: r,
  rows,
  inwardCostPerCrate,
  updateRowField,
  setPhoneCatalogSizeFilter,
  setCatalogPickerSearch,
  setCatalogPickerRowId,
  setPhoneDeleteConfirmId,
  setMobileSubView,
}) => {
  const bd = calcInwardRowBreakdown(r, inwardCostPerCrate);
  const openCatalogPicker = () => {
    setPhoneCatalogSizeFilter('all');
    setCatalogPickerSearch('');
    setCatalogPickerRowId(r.id);
  };

  return (
    <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-2.5">
      <div className={`hh-inv-card space-y-2.5 ${r.isNewProduct ? 'border-[#2864d9] border-[1.5px]' : ''}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="text-[15px] font-extrabold text-slate-900 truncate">{r.productName || r.rawName}</div>
          {r.isNewProduct ? (
            <button
              type="button"
              onClick={openCatalogPicker}
              className="hh-inv-chip-compact bg-sky-50 text-[#2864d9] border border-sky-200 cursor-pointer shrink-0"
            >
              New product
            </button>
          ) : (
            <button
              type="button"
              onClick={openCatalogPicker}
              className="hh-inv-chip-compact bg-sky-50 text-[#2864d9] border border-sky-200 cursor-pointer shrink-0"
            >
              Catalog ▾
            </button>
          )}
        </div>

        {r.isNewProduct ? (
          <>
            <div className="hh-inv-field">
              <span className="hh-inv-field__label">PRODUCT NAME</span>
              <input
                value={r.productName}
                onChange={(e) => updateRowField(r.id, 'productName', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="hh-inv-field">
                <span className="hh-inv-field__label">CATEGORY</span>
                <select
                  value={r.category}
                  onChange={(e) => updateRowField(r.id, 'category', e.target.value)}
                >
                  {Object.entries(CATS).map(([k, v]) => (
                    <option key={k} value={k}>{v.name}</option>
                  ))}
                </select>
              </div>
              <div className="hh-inv-field">
                <span className="hh-inv-field__label">ML / UNITS</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={r.volume}
                  onChange={(e) => updateRowField(r.id, 'volume', e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="hh-inv-field">
                <span className="hh-inv-field__label">UNITS / CASE</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={r.unitsPerCrate || 24}
                  onChange={(e) => updateRowField(r.id, 'unitsPerCrate', Number(e.target.value) || 24)}
                />
              </div>
              <div className="hh-inv-field">
                <span className="hh-inv-field__label">AUTO SKU PREVIEW</span>
                <div className="text-[13.5px] font-bold text-slate-900 pt-0.5 truncate">
                  {generateAutoSku(r.productName, r.category, rows.indexOf(r) + 100)}
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              The product is added to your catalog when you confirm the purchase.
            </p>
          </>
        ) : (
          <button
            type="button"
            onClick={openCatalogPicker}
            className="text-[12px] font-bold text-[#2864d9] underline cursor-pointer"
          >
            Change matched catalog beverage
          </button>
        )}

        <div className="grid grid-cols-3 gap-2">
          <div className="hh-inv-field">
            <span className="hh-inv-field__label">QTY (CS)</span>
            <input
              type="number"
              inputMode="numeric"
              value={r.qty}
              onChange={(e) => updateRowField(r.id, 'qty', e.target.value)}
            />
          </div>
          <div className="hh-inv-field">
            <span className="hh-inv-field__label">FREE CS</span>
            <input
              type="number"
              inputMode="numeric"
              value={r.freeQty}
              onChange={(e) => updateRowField(r.id, 'freeQty', e.target.value)}
            />
          </div>
          <div className="hh-inv-field">
            <span className="hh-inv-field__label">RATE (₹)</span>
            <input
              type="number"
              inputMode="decimal"
              value={r.listPrice ?? r.unitPrice}
              onChange={(e) => updateRowField(r.id, 'listPrice', e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="hh-inv-field">
            <span className="hh-inv-field__label">BATCH / TAG NO</span>
            <input
              value={r.batchNumber}
              onChange={(e) => updateRowField(r.id, 'batchNumber', e.target.value)}
            />
          </div>
          <div className="hh-inv-field">
            <span className="hh-inv-field__label">EXPIRY DATE</span>
            <input
              type="date"
              value={r.expiry}
              onChange={(e) => updateRowField(r.id, 'expiry', e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="hh-inv-field">
            <span className="hh-inv-field__label">GST MODE</span>
            <select
              value={r.taxability === 'non_gst' ? 'non_gst' : (r.isGstIncluded ? 'incl' : 'excl')}
              onChange={(e) => {
                if (e.target.value === 'non_gst') {
                  updateRowField(r.id, 'taxability', 'non_gst');
                } else {
                  if (r.taxability === 'non_gst') updateRowField(r.id, 'taxability', 'taxable');
                  updateRowField(r.id, 'isGstIncluded', e.target.value === 'incl');
                }
              }}
            >
              <option value="incl">Incl. GST ({r.cgstPercent + r.sgstPercent}%)</option>
              <option value="excl">+Calc GST ({r.cgstPercent + r.sgstPercent}%)</option>
              <option value="non_gst">Non-GST (0%)</option>
            </select>
          </div>
          <div className="hh-inv-field">
            <span className="hh-inv-field__label">LINE TOTAL</span>
            <div className="text-[14px] font-extrabold text-slate-900 pt-0.5 tabular-nums">
              ₹{money(bd.lineTotal)}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 pt-1">
        <button
          type="button"
          onClick={() => setPhoneDeleteConfirmId(r.id)}
          className="hh-inv-btn-danger w-full"
        >
          Delete line
        </button>
        <button
          type="button"
          onClick={() => setMobileSubView('overview')}
          className="hh-inv-btn-primary w-full"
        >
          Done
        </button>
      </div>
    </div>
  );
};
