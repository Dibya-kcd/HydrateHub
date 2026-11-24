import React from 'react';
import {
  ArrowRightLeft,
  Building2,
  ChevronLeft,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { InventoryBatch, PaletteTokens, Product, StockTransfer, Warehouse } from '../../../types';
import { PackIcon } from '../../common/PackIcon';
import { ToggleSwitch } from '../../ui/ToggleSwitch';
import { formatExpShort, getBatchExpiryStatus, type BatchFormState, type WarehouseFormState } from './warehouseUtils';

export interface PhoneWarehousesFlowProps {
  showWarehouseModal: boolean;
  setShowWarehouseModal: (v: boolean) => void;
  editingWarehouseId: string | null;
  whForm: WarehouseFormState;
  setWhForm: React.Dispatch<React.SetStateAction<WarehouseFormState>>;
  handleSaveWarehouse: (e: React.FormEvent) => void;
  warehouses: Warehouse[];
  warehouseStock: (warehouseId: string, productId?: number) => number;
  setCannotDeleteWarehouse: (v: { name: string; cases: number } | null) => void;
  setWarehouseToDelete: (w: Warehouse | null) => void;
  mobileWhView: 'list' | 'detail' | 'movements';
  setMobileWhView: (v: 'list' | 'detail' | 'movements') => void;
  selectedMobileWhId: string | null;
  setSelectedMobileWhId: (id: string | null) => void;
  products: Product[];
  stockTransfers: StockTransfer[];
  inventoryBatches: InventoryBatch[];
  batchSearch: string;
  setBatchSearch: (v: string) => void;
  mobileLotFilter: 'all' | 'expiring';
  setMobileLotFilter: (v: 'all' | 'expiring') => void;
  mobileBatchSheet: InventoryBatch | null;
  setMobileBatchSheet: (b: InventoryBatch | null) => void;
  setBatchToDelete: (b: InventoryBatch | null) => void;
  setBatchForm: React.Dispatch<React.SetStateAction<BatchFormState>>;
  handleOpenAddWarehouse: () => void;
  handleOpenEditWarehouse: (wh: Warehouse) => void;
  handleOpenAddBatch: (preselectedProductId?: number) => void;
  handleOpenEditBatch: (b: InventoryBatch) => void;
  handleOpenTransfer: (preselectedBatch?: InventoryBatch) => void;
  onBackToSettings: () => void;
  palette: PaletteTokens;
}

export const PhoneWarehousesFlow: React.FC<PhoneWarehousesFlowProps> = ({
  showWarehouseModal,
  setShowWarehouseModal,
  editingWarehouseId,
  whForm,
  setWhForm,
  handleSaveWarehouse,
  warehouses,
  warehouseStock,
  setCannotDeleteWarehouse,
  setWarehouseToDelete,
  mobileWhView,
  setMobileWhView,
  selectedMobileWhId,
  setSelectedMobileWhId,
  products,
  stockTransfers,
  inventoryBatches,
  batchSearch,
  setBatchSearch,
  mobileLotFilter,
  setMobileLotFilter,
  mobileBatchSheet,
  setMobileBatchSheet,
  setBatchToDelete,
  setBatchForm,
  handleOpenAddWarehouse,
  handleOpenEditWarehouse,
  handleOpenAddBatch,
  handleOpenEditBatch,
  handleOpenTransfer,
  onBackToSettings,
  palette,
}) => {
  if (showWarehouseModal) {
    return (
      <div className="rt-flow-phone">
        <div className="hh-sales-top hh-sales-top--flush hh-inv-top hh-inv-top--flow">
          <div className="hh-sales-top__row">
            <button
              type="button"
              className="hh-inv-backbtn"
              onClick={() => setShowWarehouseModal(false)}
            >
              <ChevronLeft size={20} strokeWidth={2.4} aria-hidden="true" />
              <span>{editingWarehouseId ? 'Edit godown' : 'New godown'}</span>
            </button>
            {editingWarehouseId && (() => {
              const whObj = warehouses.find((w) => w.id === editingWarehouseId);
              if (!whObj || whObj.isDefault) return null;
              const cases = warehouseStock(whObj.id);
              return (
                <button
                  type="button"
                  className="hh-sales-top__iconbtn"
                  aria-label={`Delete ${whObj.name}`}
                  onClick={() => {
                    if (cases > 0) {
                      setCannotDeleteWarehouse({ name: whObj.name, cases });
                    } else {
                      setShowWarehouseModal(false);
                      setWarehouseToDelete(whObj);
                    }
                  }}
                >
                  <Trash2 size={18} aria-hidden="true" />
                </button>
              );
            })()}
          </div>
        </div>

        <form onSubmit={handleSaveWarehouse} className="flex flex-col flex-1 min-h-0">
          <div className="rt-flow-phone__body space-y-2.5">
            <label className="hh-inv-field hh-inv-field--focus">
              <span className="hh-inv-field__label">NAME</span>
              <input
                type="text"
                required
                value={whForm.name}
                onChange={(e) => setWhForm({ ...whForm, name: e.target.value })}
                placeholder="Central Depot - Hadapsar"
              />
            </label>

            <div className="grid grid-cols-2 gap-2.5">
              <label className="hh-inv-field">
                <span className="hh-inv-field__label">CODE</span>
                <input
                  type="text"
                  required
                  value={whForm.code}
                  onChange={(e) => setWhForm({ ...whForm, code: e.target.value })}
                  placeholder="WH-03"
                  className="uppercase"
                />
              </label>
              <label className="hh-inv-field">
                <span className="hh-inv-field__label">CAPACITY (CASES)</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={whForm.capacityCases}
                  onChange={(e) => setWhForm({ ...whForm, capacityCases: Number(e.target.value) })}
                  placeholder="1,500"
                />
              </label>
            </div>

            <label className="hh-inv-field">
              <span className="hh-inv-field__label">LOCATION / ADDRESS</span>
              <input
                type="text"
                value={whForm.location}
                onChange={(e) => setWhForm({ ...whForm, location: e.target.value })}
                placeholder="Plot 45, MIDC Industrial Area"
              />
            </label>

            <div className="grid grid-cols-2 gap-2.5">
              <label className="hh-inv-field">
                <span className="hh-inv-field__label">FACILITY MANAGER</span>
                <input
                  type="text"
                  value={whForm.manager}
                  onChange={(e) => setWhForm({ ...whForm, manager: e.target.value })}
                  placeholder="Manager name"
                />
              </label>
              <label className="hh-inv-field">
                <span className="hh-inv-field__label">CONTACT PHONE</span>
                <input
                  type="text"
                  inputMode="tel"
                  value={whForm.phone}
                  onChange={(e) => setWhForm({ ...whForm, phone: e.target.value })}
                  placeholder="9876543210"
                />
              </label>
            </div>

            <div className="flex items-center justify-between gap-3 py-1 px-0.5">
              <span
                id="m-wh-default-lbl"
                onClick={() => setWhForm({ ...whForm, isDefault: !whForm.isDefault })}
                className="text-sm font-bold text-slate-900 cursor-pointer select-none"
              >
                Set as default facility
              </span>
              <ToggleSwitch
                id="m-wh-default-toggle"
                checked={whForm.isDefault}
                onChange={(v) => setWhForm({ ...whForm, isDefault: v })}
                ariaLabelledBy="m-wh-default-lbl"
              />
            </div>

            <label className="hh-inv-field">
              <span className="hh-inv-field__label">NOTES</span>
              <textarea
                rows={2}
                value={whForm.notes}
                onChange={(e) => setWhForm({ ...whForm, notes: e.target.value })}
                placeholder="Storage conditions, keyholder..."
                className="!font-medium"
              />
            </label>
          </div>

          <div className="hh-set-footer">
            <button type="submit" className="hh-inv-btn-primary w-full">
              {editingWarehouseId ? 'Update godown' : 'Save godown'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (mobileWhView === 'movements') {
    return (
      <div className="rt-flow-phone">
        <div className="hh-sales-top hh-sales-top--flush hh-inv-top hh-inv-top--flow">
          <div className="hh-sales-top__row">
            <button type="button" className="hh-inv-backbtn" onClick={() => setMobileWhView('list')}>
              <ChevronLeft size={20} strokeWidth={2.4} aria-hidden="true" />
              <span>Godown movements</span>
            </button>
            {warehouses.length >= 2 && products.length > 0 && (
              <button
                type="button"
                className="hh-inv-glass-pill"
                onClick={() => handleOpenTransfer()}
              >
                <ArrowRightLeft size={13} aria-hidden="true" />
                <span>Transfer</span>
              </button>
            )}
          </div>
        </div>

        <div className="rt-flow-phone__body space-y-2.5 hh-inv-pb">
          {stockTransfers.length === 0 ? (
            <div className="hh-inv-card text-center py-6 space-y-2">
              <ArrowRightLeft size={32} className="mx-auto text-slate-400" />
              <p className="text-sm font-bold text-slate-800">No transfers recorded</p>
              <p className="text-xs text-slate-500">Inter-warehouse transfers appear here.</p>
            </div>
          ) : (
            stockTransfers.map((st, idx) => {
              const fromWh = warehouses.find((w) => w.id === st.fromWarehouseId);
              const toWh = warehouses.find((w) => w.id === st.toWarehouseId);
              const prod = products.find((p) => p.id === st.productId);
              return (
                <div
                  key={st.id}
                  className={`hh-inv-card space-y-1 ${idx === 0 ? 'hh-inv-card--alert-blue' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-extrabold text-slate-900 truncate">
                      {(fromWh?.name || st.fromWarehouseId)} → {(toWh?.name || st.toWarehouseId)}
                    </span>
                    <span className="text-sm font-extrabold text-slate-900 tabular-nums shrink-0">
                      {st.quantity} cs
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {st.date}{st.referenceNote ? ` · ${st.referenceNote}` : ''}
                  </div>
                  <div className="text-xs text-slate-700 font-medium truncate">
                    {prod ? prod.name : `Product #${st.productId}`} {st.quantity}
                    {st.batchNumber ? ` · ${st.batchNumber}` : ''}
                  </div>
                </div>
              );
            })
          )}

          <p className="text-xs text-slate-500 px-0.5 pt-1 leading-snug">
            A godown that still holds stock cannot be deleted.
          </p>
        </div>
      </div>
    );
  }

  if (mobileWhView === 'detail' && selectedMobileWhId) {
    const wh = warehouses.find((w) => w.id === selectedMobileWhId);
    if (wh) {
      const whBatches = inventoryBatches.filter((b) => {
        if (b.warehouseId !== wh.id) return false;
        const prod = products.find((p) => p.id === b.productId);
        const prodName = prod ? prod.name.toLowerCase() : '';
        const matchQ =
          !batchSearch.trim() ||
          b.batchNumber.toLowerCase().includes(batchSearch.toLowerCase()) ||
          prodName.includes(batchSearch.toLowerCase());
        if (!matchQ) return false;
        if (mobileLotFilter === 'expiring') {
          const st = getBatchExpiryStatus(b.expiryDate, palette.muted);
          return st.label.includes('Expiring') || st.label === 'Expired';
        }
        return true;
      });

      const grouped = new Map<number, InventoryBatch[]>();
      for (const b of whBatches) {
        const list = grouped.get(b.productId) || [];
        list.push(b);
        grouped.set(b.productId, list);
      }

      return (
        <div className="rt-flow-phone">
          <div className="hh-sales-top hh-sales-top--flush hh-inv-top hh-inv-top--flow">
            <div className="hh-sales-top__row">
              <button
                type="button"
                className="hh-inv-backbtn min-w-0"
                onClick={() => {
                  setMobileWhView('list');
                  setBatchSearch('');
                }}
              >
                <ChevronLeft size={20} strokeWidth={2.4} aria-hidden="true" className="shrink-0" />
                <span className="truncate">{wh.name}</span>
              </button>
              <button
                type="button"
                onClick={() => handleOpenEditWarehouse(wh)}
                className="hh-inv-glass-pill shrink-0"
              >
                Edit
              </button>
            </div>
          </div>

          <div className="rt-flow-phone__body space-y-3 hh-inv-pb">
            <div className="rt-search-bar">
              <Search size={16} className="text-slate-400 shrink-0" aria-hidden="true" />
              <input
                type="text"
                placeholder="Search batch number or product..."
                value={batchSearch}
                onChange={(e) => setBatchSearch(e.target.value)}
              />
              {batchSearch && (
                <button type="button" onClick={() => setBatchSearch('')} aria-label="Clear search" className="p-1 text-slate-400">
                  <X size={15} />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMobileLotFilter('all')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-colors ${
                    mobileLotFilter === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white border border-slate-200 text-slate-700'
                  }`}
                >
                  All lots (auto FEFO)
                </button>
                <button
                  type="button"
                  onClick={() => setMobileLotFilter('expiring')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-colors ${
                    mobileLotFilter === 'expiring'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white border border-slate-200 text-slate-700'
                  }`}
                >
                  Expiring
                </button>
              </div>

              {products.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    handleOpenAddBatch();
                    setBatchForm((prev) => ({ ...prev, warehouseId: wh.id }));
                  }}
                  className="text-xs font-bold text-[#2864d9] cursor-pointer shrink-0"
                >
                  + Batch
                </button>
              )}
            </div>

            {grouped.size === 0 ? (
              <div className="hh-inv-card text-center py-6 space-y-1.5">
                <p className="text-sm font-bold text-slate-800">No batches found</p>
                <p className="text-xs text-slate-500">
                  {mobileLotFilter === 'expiring'
                    ? 'No expiring or expired lots in this godown.'
                    : 'Stock lots in this godown appear here.'}
                </p>
              </div>
            ) : (
              Array.from(grouped.entries()).map(([pid, list]) => {
                const prod = products.find((p) => p.id === pid);
                return (
                  <div key={pid} className="hh-inv-card space-y-1.5">
                    <div className="flex items-center gap-2 pb-1">
                      <PackIcon size="sm" pack={prod?.pack} name={prod?.name} />
                      <span className="text-sm font-extrabold text-slate-900 truncate">
                        {prod ? prod.name : `Product #${pid}`}
                      </span>
                    </div>
                    <div className="divide-y divide-dashed divide-slate-200">
                      {list.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setMobileBatchSheet(b)}
                          className="w-full py-2 flex items-center justify-between gap-2 text-left cursor-pointer"
                        >
                          <div className="min-w-0 text-xs">
                            <span className="font-extrabold text-slate-900 font-mono">{b.batchNumber}</span>
                            <span className="text-slate-500"> · exp {formatExpShort(b.expiryDate)}</span>
                          </div>
                          <div className="text-xs font-extrabold text-slate-900 tabular-nums shrink-0">
                            {b.quantity} cs{b.costPrice ? ` · ₹${b.costPrice}` : ''}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })
            )}

            <p className="text-xs text-slate-500 px-0.5 leading-snug">
              Columns: Batch / Lot, Stock (cases), Cost / case.
            </p>
          </div>

          {mobileBatchSheet && (
            <div className="rt-bsheet-scrim" role="dialog" aria-modal="true" onClick={() => setMobileBatchSheet(null)}>
              <div className="rt-bsheet" onClick={(e) => e.stopPropagation()}>
                <div className="hh-grab" aria-hidden="true" />
                <div>
                  <div className="text-base font-extrabold text-slate-900 font-mono">{mobileBatchSheet.batchNumber}</div>
                  <div className="text-xs text-slate-500">
                    {products.find((p) => p.id === mobileBatchSheet.productId)?.name || 'Batch'} · {mobileBatchSheet.quantity} cs · exp {formatExpShort(mobileBatchSheet.expiryDate)}
                  </div>
                </div>
                <div className="space-y-2">
                  <button
                    type="button"
                    className="hh-inv-btn-primary w-full"
                    onClick={() => {
                      const b = mobileBatchSheet;
                      setMobileBatchSheet(null);
                      handleOpenEditBatch(b);
                    }}
                  >
                    Edit batch
                  </button>
                  {warehouses.length > 1 && (
                    <button
                      type="button"
                      className="hh-inv-btn-outline w-full"
                      onClick={() => {
                        const b = mobileBatchSheet;
                        setMobileBatchSheet(null);
                        handleOpenTransfer(b);
                      }}
                    >
                      Transfer to another godown
                    </button>
                  )}
                  <button
                    type="button"
                    className="hh-set-btn-danger-outline w-full"
                    onClick={() => {
                      const b = mobileBatchSheet;
                      setMobileBatchSheet(null);
                      setBatchToDelete(b);
                    }}
                  >
                    Delete batch
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }
  }

  // Mobile Godowns List view
  return (
    <div className="rt-flow-phone">
      <div className="hh-sales-top hh-sales-top--flush hh-inv-top hh-inv-top--flow">
        <div className="hh-sales-top__row">
          <button type="button" className="hh-inv-backbtn" onClick={onBackToSettings}>
            <ChevronLeft size={20} strokeWidth={2.4} aria-hidden="true" />
            <span>Godowns</span>
          </button>
          <button
            type="button"
            className="hh-sales-top__iconbtn"
            aria-label="New godown"
            onClick={handleOpenAddWarehouse}
          >
            <Plus size={20} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="rt-flow-phone__body space-y-3 hh-inv-pb">
        {warehouses.length === 0 ? (
          <div className="hh-inv-card text-center py-6 space-y-2.5">
            <Building2 size={36} className="mx-auto text-slate-400" />
            <div className="text-sm font-extrabold text-slate-900">No godowns configured</div>
            <p className="text-xs text-slate-500">Add your main godown or storage facility.</p>
            <button type="button" onClick={handleOpenAddWarehouse} className="hh-inv-btn-primary w-full">
              Add first godown
            </button>
          </div>
        ) : (
          <div className="space-y-3 hh-tgrid-2">
          {warehouses.map((wh) => {
            const cases = warehouseStock(wh.id);
            const cap = wh.capacityCases || 0;
            const pct = cap > 0 ? Math.min(100, Math.round((cases / cap) * 100)) : 0;
            return (
              <button
                key={wh.id}
                type="button"
                onClick={() => {
                  setSelectedMobileWhId(wh.id);
                  setBatchSearch('');
                  setMobileLotFilter('all');
                  setMobileWhView('detail');
                }}
                className="hh-inv-card w-full text-left space-y-2 cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-slate-900 truncate">{wh.name}</div>
                    <div className="text-xs text-slate-500 truncate mt-0.5">
                      {wh.code}{wh.location ? ` · ${wh.location}` : ''}
                    </div>
                  </div>
                  {wh.isDefault && <span className="hh-set-badge-green shrink-0">Default</span>}
                </div>

                <div className="text-xs font-extrabold text-slate-900 tabular-nums">
                  Stock in godown: {cases.toLocaleString('en-IN')} cs
                </div>

                {cap > 0 && (
                  <div className="space-y-1">
                    <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: pct > 90 ? '#dc2626' : '#2864d9',
                        }}
                      />
                    </div>
                    <div className="text-xs text-slate-500 tabular-nums">
                      Capacity usage {pct}% of {cap.toLocaleString('en-IN')} cs
                    </div>
                  </div>
                )}
              </button>
            );
          })}
          </div>
        )}

        <button
          type="button"
          onClick={() => setMobileWhView('movements')}
          className="hh-inv-card w-full flex items-center justify-between gap-2 text-left cursor-pointer"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="hh-set-icon bg-blue-50 text-[#2864d9]">
              <ArrowRightLeft size={16} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-extrabold text-slate-900">Godown movements</div>
              <div className="text-xs text-slate-500">{stockTransfers.length} inter-warehouse transfers</div>
            </div>
          </div>
          <span className="text-xs font-bold text-[#2864d9] shrink-0">View →</span>
        </button>
      </div>
    </div>
  );
};
