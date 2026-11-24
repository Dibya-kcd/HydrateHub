import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import type { InventoryBatch, PaletteTokens, Product, Warehouse } from '../../../types';
import { ConfirmDeleteModal } from '../../common/ConfirmDeleteModal';
import {
  getTransferAvailable,
  type BatchFormState,
  type TransferFormState,
  type WarehouseFormState,
} from './warehouseUtils';

export interface WarehouseModalsProps {
  showWarehouseModal: boolean;
  setShowWarehouseModal: (v: boolean) => void;
  isPhone: boolean;
  embedded: boolean;
  editingWarehouseId: string | null;
  whForm: WarehouseFormState;
  setWhForm: React.Dispatch<React.SetStateAction<WarehouseFormState>>;
  handleSaveWarehouse: (e: React.FormEvent) => void;

  showBatchModal: boolean;
  setShowBatchModal: (v: boolean) => void;
  editingBatchId: string | null;
  batchForm: BatchFormState;
  setBatchForm: React.Dispatch<React.SetStateAction<BatchFormState>>;
  handleSaveBatch: (e: React.FormEvent) => void;

  showTransferModal: boolean;
  setShowTransferModal: (v: boolean) => void;
  transferForm: TransferFormState;
  setTransferForm: React.Dispatch<React.SetStateAction<TransferFormState>>;
  handleSaveTransfer: (e: React.FormEvent) => void;

  warehouseToDelete: Warehouse | null;
  setWarehouseToDelete: (w: Warehouse | null) => void;
  deleteWarehouse: (id: string, reason?: string) => void;
  cannotDeleteWarehouse: { name: string; cases: number } | null;
  setCannotDeleteWarehouse: (v: { name: string; cases: number } | null) => void;
  batchToDelete: InventoryBatch | null;
  setBatchToDelete: (b: InventoryBatch | null) => void;
  deleteBatch: (id: string, reason?: string) => void;

  warehouses: Warehouse[];
  products: Product[];
  inventoryBatches: InventoryBatch[];
  warehouseStock: (warehouseId: string, productId?: number) => number;
  palette: PaletteTokens;
  fz: (base: number, extra?: React.CSSProperties) => React.CSSProperties;
  inputStyle: React.CSSProperties;
  labelStyle: React.CSSProperties;
}

export const WarehouseModals: React.FC<WarehouseModalsProps> = ({
  showWarehouseModal,
  setShowWarehouseModal,
  isPhone,
  embedded,
  editingWarehouseId,
  whForm,
  setWhForm,
  handleSaveWarehouse,
  showBatchModal,
  setShowBatchModal,
  editingBatchId,
  batchForm,
  setBatchForm,
  handleSaveBatch,
  showTransferModal,
  setShowTransferModal,
  transferForm,
  setTransferForm,
  handleSaveTransfer,
  warehouseToDelete,
  setWarehouseToDelete,
  deleteWarehouse,
  cannotDeleteWarehouse,
  setCannotDeleteWarehouse,
  batchToDelete,
  setBatchToDelete,
  deleteBatch,
  warehouses,
  products,
  inventoryBatches,
  warehouseStock,
  palette,
  fz,
  inputStyle,
  labelStyle,
}) => {
  return (
    <>
      {/* MODAL: ADD / EDIT WAREHOUSE (Desktop & embedded only; phone uses full-screen form) */}
      {showWarehouseModal && !(isPhone && !embedded) && (
        <div role="dialog" aria-modal="true" aria-label="Warehouse details" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div
            className="w-full max-w-lg border-2 p-6 shadow-xl"
            style={{ backgroundColor: palette.panel, borderColor: palette.line }}
          >
            <div className="flex items-center justify-between pb-3 border-b-2 mb-4" style={{ borderColor: palette.line }}>
              <h2 style={fz(18, { fontWeight: 700, color: palette.ink })}>
                {editingWarehouseId ? 'Edit Warehouse Facility' : 'Add New Warehouse / Godown'}
              </h2>
              <button aria-label="Close"
                id="btn-close-wh-modal"
                onClick={() => setShowWarehouseModal(false)}
                className="p-1 cursor-pointer"
              >
                <X size={20} color={palette.muted} />
              </button>
            </div>

            <form onSubmit={handleSaveWarehouse} className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label style={labelStyle}>Warehouse Name *</label>
                  <input
                    id="input-wh-name"
                    type="text"
                    required
                    placeholder="e.g. Central Depot - Hadapsar"
                    value={whForm.name}
                    onChange={(e) => setWhForm({ ...whForm, name: e.target.value })}
                    className="w-full px-3 py-2 border-2 focus-ring"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Code *</label>
                  <input
                    id="input-wh-code"
                    type="text"
                    required
                    placeholder="WH-01"
                    value={whForm.code}
                    onChange={(e) => setWhForm({ ...whForm, code: e.target.value })}
                    className="w-full px-3 py-2 border-2 focus-ring uppercase"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Location / Address</label>
                <input
                  id="input-wh-location"
                  type="text"
                  placeholder="Plot 45, MIDC Industrial Area"
                  value={whForm.location}
                  onChange={(e) => setWhForm({ ...whForm, location: e.target.value })}
                  className="w-full px-3 py-2 border-2 focus-ring"
                  style={inputStyle}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={labelStyle}>Facility Manager</label>
                  <input
                    id="input-wh-manager"
                    type="text"
                    placeholder="Manager Name"
                    value={whForm.manager}
                    onChange={(e) => setWhForm({ ...whForm, manager: e.target.value })}
                    className="w-full px-3 py-2 border-2 focus-ring"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Contact Phone</label>
                  <input inputMode="tel" autoComplete="tel"
                    id="input-wh-phone"
                    type="text"
                    placeholder="9876543210"
                    value={whForm.phone}
                    onChange={(e) => setWhForm({ ...whForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border-2 focus-ring"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={labelStyle}>Capacity (Cases)</label>
                  <input
                    id="input-wh-capacity"
                    type="number" inputMode="numeric"
                    min="0"
                    value={whForm.capacityCases}
                    onChange={(e) => setWhForm({ ...whForm, capacityCases: Number(e.target.value) })}
                    className="w-full px-3 py-2 border-2 focus-ring"
                    style={inputStyle}
                  />
                </div>
                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      id="checkbox-wh-default"
                      type="checkbox"
                      checked={whForm.isDefault}
                      onChange={(e) => setWhForm({ ...whForm, isDefault: e.target.checked })}
                      className="w-4 h-4 cursor-pointer"
                    />
                    <span style={fz(13, { fontWeight: 600, color: palette.ink })}>Set as Default Facility</span>
                  </label>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Notes</label>
                <textarea
                  id="textarea-wh-notes"
                  rows={2}
                  placeholder="Storage conditions, temperature controls, keyholder..."
                  value={whForm.notes}
                  onChange={(e) => setWhForm({ ...whForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border-2 focus-ring"
                  style={inputStyle}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t-2" style={{ borderColor: palette.line }}>
                <button
                  id="btn-cancel-wh"
                  type="button"
                  onClick={() => setShowWarehouseModal(false)}
                  className="px-4 py-2 border-2 cursor-pointer font-semibold"
                  style={{ borderColor: palette.line, color: palette.ink }}
                >
                  Cancel
                </button>
                <button
                  id="btn-submit-wh"
                  type="submit"
                  className="px-5 py-2 font-bold cursor-pointer"
                  style={{ backgroundColor: palette.navy, color: '#FFFFFF' }}
                >
                  {editingWarehouseId ? 'Update Warehouse' : 'Save Warehouse'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT BATCH */}
      {showBatchModal && (
        <div role="dialog" aria-modal="true" aria-label="Product batch" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div
            className="w-full max-w-lg border-2 p-6 shadow-xl"
            style={{ backgroundColor: palette.panel, borderColor: palette.line }}
          >
            <div className="flex items-center justify-between pb-3 border-b-2 mb-4" style={{ borderColor: palette.line }}>
              <h2 style={fz(18, { fontWeight: 700, color: palette.ink })}>
                {editingBatchId ? 'Edit Batch Registration' : 'Register Product Batch'}
              </h2>
              <button aria-label="Close"
                id="btn-close-batch-modal"
                onClick={() => setShowBatchModal(false)}
                className="p-1 cursor-pointer"
              >
                <X size={20} color={palette.muted} />
              </button>
            </div>

            <form onSubmit={handleSaveBatch} className="space-y-3">
              <div>
                <label style={labelStyle}>Product *</label>
                <select
                  id="select-batch-product"
                  required
                  value={batchForm.productId}
                  onChange={(e) => {
                    const pid = Number(e.target.value);
                    const prod = products.find((p) => p.id === pid);
                    setBatchForm({
                      ...batchForm,
                      productId: pid,
                      costPrice: prod?.cost || batchForm.costPrice,
                      mrp: prod?.retail || batchForm.mrp,
                      expiryDate: prod?.expiry || batchForm.expiryDate,
                    });
                  }}
                  className="w-full px-3 py-2 border-2 focus-ring cursor-pointer"
                  style={inputStyle}
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.pack})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={labelStyle}>Batch / Lot Number *</label>
                  <input
                    id="input-batch-number"
                    type="text"
                    required
                    placeholder="e.g. B-2026-99"
                    value={batchForm.batchNumber}
                    onChange={(e) => setBatchForm({ ...batchForm, batchNumber: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border-2 focus-ring font-mono font-bold uppercase"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Target Godown / Warehouse</label>
                  <select
                    id="select-batch-wh-target"
                    value={batchForm.warehouseId}
                    onChange={(e) => setBatchForm({ ...batchForm, warehouseId: e.target.value })}
                    className="w-full px-3 py-2 border-2 focus-ring cursor-pointer"
                    style={inputStyle}
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} {w.isDefault ? '(Default)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={labelStyle}>Manufacturing (MFG) Date</label>
                  <input
                    id="input-batch-mfg"
                    type="date"
                    value={batchForm.mfgDate}
                    onChange={(e) => setBatchForm({ ...batchForm, mfgDate: e.target.value })}
                    className="w-full px-3 py-2 border-2 focus-ring"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Expiry (EXP) Date *</label>
                  <input
                    id="input-batch-expiry"
                    type="date"
                    required
                    value={batchForm.expiryDate}
                    onChange={(e) => setBatchForm({ ...batchForm, expiryDate: e.target.value })}
                    className="w-full px-3 py-2 border-2 focus-ring font-bold"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label style={labelStyle}>Quantity (Cases) *</label>
                  <input
                    id="input-batch-qty"
                    type="number" inputMode="numeric"
                    min="0"
                    required
                    value={batchForm.quantity}
                    onChange={(e) => setBatchForm({ ...batchForm, quantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 border-2 focus-ring font-bold"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Cost / Case (₹)</label>
                  <input
                    id="input-batch-cost"
                    type="number" inputMode="decimal"
                    step="0.01"
                    value={batchForm.costPrice}
                    onChange={(e) => setBatchForm({ ...batchForm, costPrice: Number(e.target.value) })}
                    className="w-full px-3 py-2 border-2 focus-ring"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>MRP / Case (₹)</label>
                  <input
                    id="input-batch-mrp"
                    type="number" inputMode="decimal"
                    step="0.01"
                    value={batchForm.mrp}
                    onChange={(e) => setBatchForm({ ...batchForm, mrp: Number(e.target.value) })}
                    className="w-full px-3 py-2 border-2 focus-ring"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Notes / Quality Remarks</label>
                <textarea
                  id="textarea-batch-notes"
                  rows={2}
                  placeholder="Supplier batch code, QA inspection passed, delivery invoice ref..."
                  value={batchForm.notes}
                  onChange={(e) => setBatchForm({ ...batchForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border-2 focus-ring"
                  style={inputStyle}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t-2" style={{ borderColor: palette.line }}>
                <button
                  id="btn-cancel-batch"
                  type="button"
                  onClick={() => setShowBatchModal(false)}
                  className="px-4 py-2 border-2 cursor-pointer font-semibold"
                  style={{ borderColor: palette.line, color: palette.ink }}
                >
                  Cancel
                </button>
                <button
                  id="btn-submit-batch"
                  type="submit"
                  className="px-5 py-2 font-bold cursor-pointer"
                  style={{ backgroundColor: palette.navy, color: '#FFFFFF' }}
                >
                  {editingBatchId ? 'Update Batch' : 'Save Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: STOCK TRANSFER */}
      {showTransferModal && (() => {
        const availInfo = getTransferAvailable(
          inventoryBatches,
          warehouseStock,
          transferForm.fromWarehouseId,
          Number(transferForm.productId),
          transferForm.batchNumber,
        );
        const available = availInfo.available;
        const overQty =
          Number(transferForm.quantity) > 0 &&
          Number(transferForm.quantity) > available;
        const fromName =
          warehouses.find((w) => w.id === transferForm.fromWarehouseId)?.name ||
          'Source';
        const productOptions = [...products].sort((a, b) => {
          const qa = warehouseStock(transferForm.fromWarehouseId, a.id);
          const qb = warehouseStock(transferForm.fromWarehouseId, b.id);
          if (qa > 0 && qb <= 0) return -1;
          if (qb > 0 && qa <= 0) return 1;
          return a.name.localeCompare(b.name);
        });
        const batchesForProduct = inventoryBatches.filter(
          (b) =>
            b.productId === Number(transferForm.productId) &&
            b.warehouseId === transferForm.fromWarehouseId &&
            (Number(b.quantity) || 0) > 0,
        );

        return (
          <div role="dialog" aria-modal="true" aria-label="Stock transfer" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
            <div
              className="w-full sm:max-w-lg max-h-[95dvh] overflow-y-auto border-0 sm:border-2 p-4 sm:p-6 shadow-xl rounded-t-2xl sm:rounded-none"
              style={{ backgroundColor: palette.panel, borderColor: palette.line }}
            >
              <div
                className="flex items-center justify-between pb-3 border-b-2 mb-4"
                style={{ borderColor: palette.line }}
              >
                <h2 style={fz(18, { fontWeight: 700, color: palette.ink })}>
                  Inter-Warehouse Stock Transfer
                </h2>
                <button
                  id="btn-close-transfer-modal"
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="p-1 cursor-pointer"
                  aria-label="Close"
                >
                  <X size={20} color={palette.muted} />
                </button>
              </div>

              <form onSubmit={handleSaveTransfer} className="space-y-3">
                <div>
                  <label style={labelStyle}>Transfer Date *</label>
                  <input
                    id="input-transfer-date"
                    type="date"
                    required
                    value={transferForm.date}
                    onChange={(e) =>
                      setTransferForm({ ...transferForm, date: e.target.value })
                    }
                    className="w-full px-3 py-2 border-2 focus-ring"
                    style={inputStyle}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label style={labelStyle}>From Warehouse (Source) *</label>
                    <select
                      id="select-transfer-from"
                      required
                      value={transferForm.fromWarehouseId}
                      onChange={(e) => {
                        const fromId = e.target.value;
                        const pid = Number(transferForm.productId);
                        const matching = inventoryBatches.filter(
                          (b) =>
                            b.productId === pid &&
                            b.warehouseId === fromId &&
                            (Number(b.quantity) || 0) > 0,
                        );
                        const bn =
                          matching.find(
                            (b) =>
                              (b.batchNumber || '').toUpperCase() ===
                              (transferForm.batchNumber || '').toUpperCase(),
                          )?.batchNumber ||
                          matching[0]?.batchNumber ||
                          '';
                        const { available: av } = getTransferAvailable(
                          inventoryBatches,
                          warehouseStock,
                          fromId,
                          pid,
                          bn,
                        );
                        setTransferForm({
                          ...transferForm,
                          fromWarehouseId: fromId,
                          batchNumber: bn,
                          quantity: Math.min(
                            Math.max(1, transferForm.quantity),
                            av > 0 ? av : 1,
                          ),
                        });
                      }}
                      className="w-full px-3 py-2 border-2 focus-ring cursor-pointer"
                      style={inputStyle}
                    >
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>To Warehouse (Destination) *</label>
                    <select
                      id="select-transfer-to"
                      required
                      value={transferForm.toWarehouseId}
                      onChange={(e) =>
                        setTransferForm({
                          ...transferForm,
                          toWarehouseId: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border-2 focus-ring cursor-pointer"
                      style={inputStyle}
                    >
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Product *</label>
                  <select
                    id="select-transfer-prod"
                    required
                    value={transferForm.productId}
                    onChange={(e) => {
                      const pid = Number(e.target.value);
                      const matchingBatches = inventoryBatches.filter(
                        (b) =>
                          b.productId === pid &&
                          b.warehouseId === transferForm.fromWarehouseId &&
                          (Number(b.quantity) || 0) > 0,
                      );
                      const bn = matchingBatches[0]?.batchNumber || '';
                      const { available: av } = getTransferAvailable(
                        inventoryBatches,
                        warehouseStock,
                        transferForm.fromWarehouseId,
                        pid,
                        bn,
                      );
                      setTransferForm({
                        ...transferForm,
                        productId: pid,
                        batchNumber: bn,
                        quantity: Math.min(Math.max(1, av), av > 0 ? av : 1),
                      });
                    }}
                    className="w-full px-3 py-2 border-2 focus-ring cursor-pointer"
                    style={inputStyle}
                  >
                    {productOptions.map((p) => {
                      const qty = warehouseStock(
                        transferForm.fromWarehouseId,
                        p.id,
                      );
                      return (
                        <option key={p.id} value={p.id}>
                          {p.name} — {qty} cases @ {fromName}
                        </option>
                      );
                    })}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">
                    Quantities shown are available stock in the selected source
                    warehouse.
                  </p>
                </div>

                {/* Live availability banner */}
                <div
                  className={`rounded-xl border-2 px-3 py-2.5 text-sm ${
                    available <= 0
                      ? 'border-rose-200 bg-rose-50 text-rose-800'
                      : overQty
                        ? 'border-amber-200 bg-amber-50 text-amber-900'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  }`}
                >
                  <div className="font-bold flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span>Available at {fromName}:</span>
                    <span className="tabular-nums text-base">
                      {available} cases
                    </span>
                  </div>
                  <div className="text-xs mt-0.5 opacity-90">
                    {availInfo.label}
                    {available <= 0 &&
                      ' — transfer not allowed (would create negative stock).'}
                    {overQty &&
                      available > 0 &&
                      ` — reduce quantity to ${available} or less.`}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label style={labelStyle}>Batch / Lot</label>
                    {batchesForProduct.length > 0 ? (
                      <select
                        id="select-transfer-batch"
                        value={transferForm.batchNumber}
                        onChange={(e) => {
                          const bn = e.target.value;
                          const { available: av } = getTransferAvailable(
                            inventoryBatches,
                            warehouseStock,
                            transferForm.fromWarehouseId,
                            Number(transferForm.productId),
                            bn,
                          );
                          setTransferForm({
                            ...transferForm,
                            batchNumber: bn,
                            quantity: Math.min(
                              Math.max(1, transferForm.quantity),
                              av > 0 ? av : 1,
                            ),
                          });
                        }}
                        className="w-full px-3 py-2 border-2 focus-ring cursor-pointer font-mono"
                        style={inputStyle}
                      >
                        <option value="">All lots (auto FEFO)</option>
                        {batchesForProduct.map((b) => (
                          <option key={b.id} value={b.batchNumber}>
                            {b.batchNumber} — {b.quantity} cases
                            {b.expiryDate ? ` · exp ${b.expiryDate}` : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id="input-transfer-batch"
                        type="text"
                        placeholder="No lots in source (optional)"
                        value={transferForm.batchNumber}
                        onChange={(e) =>
                          setTransferForm({
                            ...transferForm,
                            batchNumber: e.target.value.toUpperCase(),
                          })
                        }
                        className="w-full px-3 py-2 border-2 focus-ring font-mono font-bold uppercase"
                        style={inputStyle}
                      />
                    )}
                  </div>

                  <div>
                    <label style={labelStyle}>
                      Quantity to Transfer (Cases) *
                    </label>
                    <input
                      id="input-transfer-qty"
                      type="number" inputMode="numeric"
                      min={1}
                      max={available > 0 ? available : undefined}
                      required
                      value={transferForm.quantity}
                      onChange={(e) =>
                        setTransferForm({
                          ...transferForm,
                          quantity: Number(e.target.value),
                        })
                      }
                      className={`w-full px-3 py-2 border-2 focus-ring font-bold ${
                        overQty ? 'border-rose-400' : ''
                      }`}
                      style={inputStyle}
                    />
                    {available > 0 && (
                      <button
                        type="button"
                        className="mt-1 text-xs font-semibold text-sky-700 hover:underline cursor-pointer"
                        onClick={() =>
                          setTransferForm({
                            ...transferForm,
                            quantity: available,
                          })
                        }
                      >
                        Use max ({available})
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>
                    Delivery Challan / Reference Note
                  </label>
                  <input
                    id="input-transfer-note"
                    type="text"
                    placeholder="e.g. Challan #CH-882, vehicle tempo MH-12-AB-1234"
                    value={transferForm.referenceNote}
                    onChange={(e) =>
                      setTransferForm({
                        ...transferForm,
                        referenceNote: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border-2 focus-ring"
                    style={inputStyle}
                  />
                </div>

                <div
                  className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4 border-t-2"
                  style={{ borderColor: palette.line }}
                >
                  <button
                    id="btn-cancel-transfer"
                    type="button"
                    onClick={() => setShowTransferModal(false)}
                    className="px-4 py-2.5 border-2 cursor-pointer font-semibold rounded-lg"
                    style={{ borderColor: palette.line, color: palette.ink }}
                  >
                    Cancel
                  </button>
                  <button
                    id="btn-submit-transfer"
                    type="submit"
                    disabled={available <= 0 || overQty}
                    className="px-5 py-2.5 font-bold cursor-pointer rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: palette.navy, color: '#FFFFFF' }}
                  >
                    Execute Transfer
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Delete Warehouse Confirmation Modal */}
      {warehouseToDelete && (
        <ConfirmDeleteModal
          isOpen={!!warehouseToDelete}
          onClose={() => setWarehouseToDelete(null)}
          onConfirm={() => {}}
          onConfirmWithComment={(reason) => {
            deleteWarehouse(warehouseToDelete.id, reason);
            setWarehouseToDelete(null);
          }}
          rectificationPrompt="Reason for deleting godown *"
          rectificationPlaceholder="e.g. Closed facility, merged godowns, duplicate entry"
          reasonPresets={['Closed facility', 'Merged godowns', 'Duplicate entry', 'Test location']}
          commentMinLength={4}
          title="Delete Godown Location"
          subtitle={`${warehouseToDelete.name} (${warehouseToDelete.code})`}
          warningNote="This will remove this warehouse from your godown registry. (Verified: 0 cases currently stored)."
          confirmationPrompt={`I confirm that I want to remove godown "${warehouseToDelete.name}".`}
          confirmButtonLabel="Permanently Delete Godown"
          impactItems={[
            { label: 'Godown Name', detail: warehouseToDelete.name },
            { label: 'Facility Code', detail: warehouseToDelete.code },
            { label: 'Location', detail: warehouseToDelete.location || 'Not specified' },
          ]}
        />
      )}

      {/* Cannot Delete Warehouse Alert Modal */}
      {cannotDeleteWarehouse && (
        <div role="dialog" aria-modal="true" aria-label="Cannot delete warehouse with stock" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white border-2 border-amber-500 rounded p-5 shadow-xl">
            <div className="flex items-center gap-2 text-amber-700 font-bold mb-2">
              <AlertTriangle size={20} />
              <span>Cannot Delete Godown With Stock</span>
            </div>
            <p className="text-sm text-slate-700 mb-4">
              Godown <strong>"{cannotDeleteWarehouse.name}"</strong> currently holds{' '}
              <strong>{cannotDeleteWarehouse.cases} active cases</strong>. Before deleting this godown, please transfer the inventory to another godown or dispatch it in sales trips.
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setCannotDeleteWarehouse(null)}
                className="px-4 py-2 bg-slate-800 text-white font-bold text-xs rounded cursor-pointer"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Batch Confirmation Modal */}
      {batchToDelete && (
        <ConfirmDeleteModal
          isOpen={!!batchToDelete}
          onClose={() => setBatchToDelete(null)}
          onConfirm={() => {}}
          onConfirmWithComment={(reason) => {
            deleteBatch(batchToDelete.id, reason);
            setBatchToDelete(null);
          }}
          rectificationPrompt="Reason for deleting batch *"
          rectificationPlaceholder="e.g. Expired/damaged lot, wrong entry, merged batch"
          reasonPresets={['Expired/damaged lot', 'Wrong entry', 'Duplicate batch', 'Test entry']}
          commentMinLength={4}
          title="Delete Inventory Batch Lot"
          subtitle={`Lot #${batchToDelete.batchNumber}`}
          warningNote={`This will permanently remove this batch lot from inventory and deduct ${batchToDelete.quantity} cases from available stock.`}
          confirmationPrompt={`I confirm that I want to delete batch ${batchToDelete.batchNumber} and deduct ${batchToDelete.quantity} cases.`}
          confirmButtonLabel="Permanently Delete Batch"
          impactItems={[
            {
              label: 'Stock Deduction',
              detail: `Will reverse from ${warehouses.find((w) => w.id === batchToDelete.warehouseId)?.name || 'Godown'}`,
              qtyChange: `-${batchToDelete.quantity} cs`,
            },
            {
              label: 'Associated Product',
              detail: products.find((p) => p.id === batchToDelete.productId)?.name || `Product #${batchToDelete.productId}`,
            },
            {
              label: 'Expiry Date',
              detail: batchToDelete.expiryDate || 'N/A',
            },
          ]}
        />
      )}
    </>
  );
};
