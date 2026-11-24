import React from 'react';
import {
  ArrowRightLeft,
  Building2,
  ChevronDown,
  Filter,
  Layers,
  MapPin,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import type { InventoryBatch, PaletteTokens, Product, StockTransfer, Warehouse } from '../../../types';
import { money } from '../../../utils/billing';
import { IconButton } from '../../common/IconButton';
import { getBatchExpiryStatus } from './warehouseUtils';

export interface WarehouseSubTabsProps {
  activeSubTab: 'warehouses' | 'batches' | 'transfers';
  warehouses: Warehouse[];
  inventoryBatches: InventoryBatch[];
  filteredBatches: InventoryBatch[];
  products: Product[];
  stockTransfers: StockTransfer[];
  warehouseStock: (warehouseId: string, productId?: number) => number;
  updateWarehouse: (id: string, patch: Partial<Warehouse>) => void;
  setCannotDeleteWarehouse: (v: { name: string; cases: number } | null) => void;
  setWarehouseToDelete: (w: Warehouse | null) => void;
  setBatchToDelete: (b: InventoryBatch | null) => void;
  batchSearch: string;
  setBatchSearch: (v: string) => void;
  batchWarehouseFilter: string;
  setBatchWarehouseFilter: (v: string) => void;
  batchProductFilter: string;
  setBatchProductFilter: (v: string) => void;
  showBatchFilterDropdown: boolean;
  setShowBatchFilterDropdown: React.Dispatch<React.SetStateAction<boolean>>;
  batchFilterDropdownRef: React.RefObject<HTMLDivElement | null>;
  activeBatchFiltersCount: number;
  clearBatchFilters: () => void;
  handleOpenAddWarehouse: () => void;
  handleOpenEditWarehouse: (wh: Warehouse) => void;
  handleOpenAddBatch: (preselectedProductId?: number) => void;
  handleOpenEditBatch: (b: InventoryBatch) => void;
  handleOpenTransfer: (preselectedBatch?: InventoryBatch) => void;
  palette: PaletteTokens;
  fz: (base: number, extra?: React.CSSProperties) => React.CSSProperties;
  cardStyle: React.CSSProperties;
}

export const WarehouseSubTabs: React.FC<WarehouseSubTabsProps> = ({
  activeSubTab,
  warehouses,
  inventoryBatches,
  filteredBatches,
  products,
  stockTransfers,
  warehouseStock,
  updateWarehouse,
  setCannotDeleteWarehouse,
  setWarehouseToDelete,
  setBatchToDelete,
  batchSearch,
  setBatchSearch,
  batchWarehouseFilter,
  setBatchWarehouseFilter,
  batchProductFilter,
  setBatchProductFilter,
  showBatchFilterDropdown,
  setShowBatchFilterDropdown,
  batchFilterDropdownRef,
  activeBatchFiltersCount,
  clearBatchFilters,
  handleOpenAddWarehouse,
  handleOpenEditWarehouse,
  handleOpenAddBatch,
  handleOpenEditBatch,
  handleOpenTransfer,
  palette,
  fz,
  cardStyle,
}) => {
  return (
    <>
      {/* 1. SUB-TAB: WAREHOUSES */}
      {activeSubTab === 'warehouses' && (
        <div>
          {warehouses.length === 0 ? (
            <div className="p-8 text-center border-2" style={cardStyle}>
              <Building2 size={48} className="mx-auto mb-3" color={palette.muted} />
              <h3 style={fz(18, { fontWeight: 700, color: palette.ink })}>No Warehouses Configured</h3>
              <p style={fz(14, { color: palette.muted, maxWidth: '400px', margin: '0.5rem auto 1.5rem' })}>
                Set up your central godown, secondary depots, or cold storages to organize stock by physical facility.
              </p>
              <button
                id="btn-create-first-warehouse"
                onClick={handleOpenAddWarehouse}
                className="inline-flex items-center gap-2 px-5 py-2.5 font-bold cursor-pointer focus-ring"
                style={{
                  backgroundColor: palette.navy,
                  color: '#FFFFFF',
                  ...fz(14),
                }}
              >
                <Plus size={16} />
                Add First Warehouse
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {warehouses.map((wh) => {
                const cases = warehouseStock(wh.id);
                const batchCount = inventoryBatches.filter((b) => b.warehouseId === wh.id).length;
                const percentCap = wh.capacityCases ? Math.min(100, Math.round((cases / wh.capacityCases) * 100)) : 0;

                return (
                  <div
                    key={wh.id}
                    data-card-tone={wh.isDefault ? 'sales' : 'neutral'}
                    className="p-5 rounded-2xl border shadow-xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 style={fz(17, { fontWeight: 700, color: palette.ink })}>{wh.name}</h3>
                            {wh.isDefault && (
                              <span
                                className="px-2 py-0.5 rounded text-xs font-bold"
                                style={{ backgroundColor: '#dbeafe', color: '#1e40af' }}
                              >
                                Default
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-mono mt-0.5" style={{ color: palette.muted }}>
                            Code: {wh.code}
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <IconButton
                            id={`btn-edit-wh-${wh.id}`}
                            icon={Pencil}
                            tooltip="Edit Warehouse"
                            onClick={() => handleOpenEditWarehouse(wh)}
                          />
                          <IconButton
                            id={`btn-delete-wh-${wh.id}`}
                            icon={Trash2}
                            variant="danger"
                            tooltip="Delete Warehouse"
                            onClick={() => {
                              if (cases > 0) {
                                setCannotDeleteWarehouse({ name: wh.name, cases });
                                return;
                              }
                              setWarehouseToDelete(wh);
                            }}
                          />
                        </div>
                      </div>

                      <div className="mt-4 space-y-2 text-sm">
                        {wh.location && (
                          <div className="flex items-center gap-2" style={{ color: palette.ink }}>
                            <MapPin size={14} color={palette.muted} />
                            <span>{wh.location}</span>
                          </div>
                        )}
                        {(wh.manager || wh.phone) && (
                          <div className="flex items-center gap-2" style={{ color: palette.ink }}>
                            <Phone size={14} color={palette.muted} />
                            <span>
                              {wh.manager} {wh.phone ? `(${wh.phone})` : ''}
                            </span>
                          </div>
                        )}
                        {wh.notes && (
                          <p className="text-xs italic mt-2" style={{ color: palette.muted }}>
                            "{wh.notes}"
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 pt-4 border-t-2" style={{ borderColor: palette.line }}>
                      <div className="flex items-center justify-between mb-1">
                        <span style={fz(13, { color: palette.muted })}>Stock in Godown:</span>
                        <span style={fz(15, { fontWeight: 700, color: palette.navy })}>
                          {cases} cases ({batchCount} batches)
                        </span>
                      </div>

                      {wh.capacityCases && wh.capacityCases > 0 ? (
                        <div className="mt-2">
                          <div className="flex justify-between text-xs mb-1" style={{ color: palette.muted }}>
                            <span>Capacity Usage</span>
                            <span>
                              {cases} / {wh.capacityCases} ({percentCap}%)
                            </span>
                          </div>
                          <div className="w-full bg-slate-200 h-2 rounded overflow-hidden">
                            <div
                              className="h-full transition-all"
                              style={{
                                width: `${percentCap}%`,
                                backgroundColor: percentCap > 90 ? palette.bad : palette.navy,
                              }}
                            />
                          </div>
                        </div>
                      ) : null}

                      {!wh.isDefault && (
                        <button
                          id={`btn-set-default-${wh.id}`}
                          onClick={() => updateWarehouse(wh.id, { isDefault: true })}
                          className="mt-3 w-full py-1 text-xs border font-semibold cursor-pointer"
                          style={{
                            borderColor: palette.line,
                            color: palette.navy,
                            backgroundColor: palette.panel,
                          }}
                        >
                          Set as Default Warehouse
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 2. SUB-TAB: BATCHES & EXPIRY TRACKER */}
      {activeSubTab === 'batches' && (
        <div>
          {/* Smart Space-Saving Filter Bar */}
          <div className="mb-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-2 flex-1 max-w-xl">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  />
                  <input
                    id="input-batch-search"
                    type="text"
                    placeholder="Search batch number or product..."
                    value={batchSearch}
                    onChange={(e) => setBatchSearch(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 border-2 rounded focus-ring bg-white text-xs sm:text-sm"
                    style={{ borderColor: palette.line, color: palette.ink }}
                  />
                  {batchSearch && (
                    <button
                      type="button"
                      onClick={() => setBatchSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer p-0.5"
                      title="Clear search"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Filter Options Popover Trigger */}
                <div className="relative" ref={batchFilterDropdownRef}>
                  <button
                    type="button"
                    id="btn-batch-filters-toggle"
                    onClick={() => setShowBatchFilterDropdown((prev) => !prev)}
                    className={`flex items-center gap-2 px-3 py-2 border-2 rounded text-xs sm:text-sm font-bold cursor-pointer transition-colors focus-ring ${
                      showBatchFilterDropdown || activeBatchFiltersCount > 0
                        ? 'bg-sky-600 text-white border-sky-600'
                        : 'bg-white hover:bg-slate-50 text-slate-800'
                    }`}
                    style={{
                      borderColor: showBatchFilterDropdown || activeBatchFiltersCount > 0 ? palette.navy : palette.line,
                    }}
                  >
                    <Filter size={14} />
                    <span>Filter Options</span>
                    {activeBatchFiltersCount > 0 && (
                      <span className="w-4 h-4 rounded-full bg-amber-400 text-slate-900 text-xs font-black flex items-center justify-center">
                        {activeBatchFiltersCount}
                      </span>
                    )}
                    <ChevronDown
                      size={13}
                      className={`transition-transform duration-200 ${showBatchFilterDropdown ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {/* Smart Filter Popover */}
                  {showBatchFilterDropdown && (
                    <div
                      id="popover-batch-filters"
                      className="absolute left-0 sm:right-0 sm:left-auto top-full mt-2 w-72 sm:w-80 max-w-[calc(100vw-1.5rem)] bg-white border-2 rounded-xl shadow-2xl z-50 p-4 space-y-3.5 animate-in fade-in duration-150"
                      style={{ borderColor: palette.navy }}
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <SlidersHorizontal size={15} className="text-sky-700" />
                          <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                            Batch Filter Options
                          </span>
                        </div>
                        {activeBatchFiltersCount > 0 && (
                          <button
                            type="button"
                            onClick={clearBatchFilters}
                            className="text-xs font-bold text-red-600 hover:text-red-800 flex items-center gap-1 cursor-pointer"
                          >
                            <RotateCcw size={11} />
                            Reset
                          </button>
                        )}
                      </div>

                      {/* Warehouse Option */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-600 flex items-center gap-1">
                          <Building2 size={12} /> Godown / Warehouse:
                        </label>
                        <select
                          id="select-batch-wh"
                          value={batchWarehouseFilter}
                          onChange={(e) => setBatchWarehouseFilter(e.target.value)}
                          className="w-full border-2 px-2.5 py-1.5 text-xs font-semibold rounded bg-white focus:outline-none focus:border-sky-600"
                          style={{ borderColor: palette.line, color: palette.ink }}
                        >
                          <option value="all">All Warehouses ({warehouses.length})</option>
                          {warehouses.map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Product Option */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-600 flex items-center gap-1">
                          <Layers size={12} /> Product Line:
                        </label>
                        <select
                          id="select-batch-prod"
                          value={batchProductFilter}
                          onChange={(e) => setBatchProductFilter(e.target.value)}
                          className="w-full border-2 px-2.5 py-1.5 text-xs font-semibold rounded bg-white focus:outline-none focus:border-sky-600"
                          style={{ borderColor: palette.line, color: palette.ink }}
                        >
                          <option value="all">All Products ({products.length})</option>
                          {products.map((p) => (
                            <option key={p.id} value={String(p.id)}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Popover Footer */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-xs text-slate-500 font-medium">
                          {filteredBatches.length} batches found
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowBatchFilterDropdown(false)}
                          className="px-3.5 py-1.5 text-xs font-bold rounded bg-sky-600 text-white hover:bg-sky-700 cursor-pointer shadow-sm"
                        >
                          Apply Filters
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <button
                id="btn-add-batch-tab"
                onClick={() => handleOpenAddBatch()}
                disabled={products.length === 0}
                className="flex items-center gap-2 px-3.5 py-2 font-bold cursor-pointer focus-ring rounded"
                style={{
                  backgroundColor: palette.navy,
                  color: '#FFFFFF',
                  opacity: products.length === 0 ? 0.5 : 1,
                  ...fz(14),
                }}
              >
                <Plus size={16} />
                Register New Batch
              </button>
            </div>

            {/* Active Batch Filter Chips */}
            {activeBatchFiltersCount > 0 && (
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Filters:</span>
                {batchWarehouseFilter !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold bg-blue-100 text-sky-700 border border-sky-200">
                    Godown: {warehouses.find((w) => w.id === batchWarehouseFilter)?.name || batchWarehouseFilter}
                    <button
                      type="button"
                      onClick={() => setBatchWarehouseFilter('all')}
                      className="hover:text-blue-950 cursor-pointer"
                      title="Remove warehouse filter"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}
                {batchProductFilter !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-900 border border-emerald-200">
                    Product: {products.find((p) => String(p.id) === batchProductFilter)?.name || batchProductFilter}
                    <button
                      type="button"
                      onClick={() => setBatchProductFilter('all')}
                      className="hover:text-emerald-950 cursor-pointer"
                      title="Remove product filter"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}
                <button
                  type="button"
                  onClick={clearBatchFilters}
                  className="text-xs text-sky-700 hover:underline font-bold cursor-pointer ml-1"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>

          {products.length === 0 ? (
            <div className="p-8 text-center border-2" style={cardStyle}>
              <Layers size={48} className="mx-auto mb-3" color={palette.muted} />
              <h3 style={fz(18, { fontWeight: 700, color: palette.ink })}>No Products Added Yet</h3>
              <p style={fz(14, { color: palette.muted, maxWidth: '400px', margin: '0.5rem auto' })}>
                Please add products in the Products catalog first, then assign batches with manufacturing and expiry dates.
              </p>
            </div>
          ) : filteredBatches.length === 0 ? (
            <div className="p-8 text-center border-2" style={cardStyle}>
              <Layers size={48} className="mx-auto mb-3" color={palette.muted} />
              <h3 style={fz(18, { fontWeight: 700, color: palette.ink })}>No Batches Found</h3>
              <p style={fz(14, { color: palette.muted, maxWidth: '400px', margin: '0.5rem auto 1.5rem' })}>
                Register lot numbers, production dates, and expiry dates to maintain FIFO dispatch and strict quality compliance.
              </p>
              <button
                id="btn-register-first-batch"
                onClick={() => handleOpenAddBatch()}
                className="inline-flex items-center gap-2 px-5 py-2.5 font-bold cursor-pointer focus-ring"
                style={{
                  backgroundColor: palette.navy,
                  color: '#FFFFFF',
                  ...fz(14),
                }}
              >
                <Plus size={16} />
                Register First Batch
              </button>
            </div>
          ) : (
            <>
              <div className="hidden lg:block overflow-x-auto overscroll-x-contain rounded-2xl border border-slate-200 shadow-sm" style={cardStyle}>
                <table className="w-full text-left data-table border-collapse min-w-[640px]">
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: `2px solid ${palette.line}` }}>
                    <th className="p-3" style={fz(13, { fontWeight: 700, color: palette.ink })}>
                      Batch Number
                    </th>
                    <th className="p-3" style={fz(13, { fontWeight: 700, color: palette.ink })}>
                      Product Name
                    </th>
                    <th className="p-3" style={fz(13, { fontWeight: 700, color: palette.ink })}>
                      Godown / Warehouse
                    </th>
                    <th className="p-3" style={fz(13, { fontWeight: 700, color: palette.ink })}>
                      Mfg. Date
                    </th>
                    <th className="p-3" style={fz(13, { fontWeight: 700, color: palette.ink })}>
                      Expiry Date & Health
                    </th>
                    <th className="p-3 text-right" style={fz(13, { fontWeight: 700, color: palette.ink })}>
                      Quantity (Cases)
                    </th>
                    <th className="p-3 text-right" style={fz(13, { fontWeight: 700, color: palette.ink })}>
                      Cost / Case
                    </th>
                    <th className="p-3 text-center" style={fz(13, { fontWeight: 700, color: palette.ink })}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBatches.map((b) => {
                    const prod = products.find((p) => p.id === b.productId);
                    const wh = warehouses.find((w) => w.id === b.warehouseId);
                    const expStatus = getBatchExpiryStatus(b.expiryDate, palette.muted);

                    return (
                      <tr
                        key={b.id}
                        className="hover:bg-slate-50 transition-colors"
                        style={{ borderBottom: `1px solid ${palette.line}` }}
                      >
                        <td className="p-3">
                          <div className="flex flex-col gap-1">
                            <span
                              className="inline-block px-2 py-0.5 rounded font-mono font-bold text-xs w-fit"
                              style={{ backgroundColor: '#e2e8f0', color: palette.ink }}
                            >
                              {b.batchNumber}
                            </span>
                            {b.scheme && (
                              <span className="inline-block px-1.5 py-0.5 rounded text-xs font-semibold bg-purple-50 text-purple-800 border border-purple-200 w-fit">
                                {b.scheme}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 font-semibold" style={{ color: palette.ink }}>
                          {prod ? prod.name : `Product #${b.productId}`}
                        </td>
                        <td className="p-3 text-sm" style={{ color: palette.ink }}>
                          {wh ? wh.name : 'Unassigned'}
                        </td>
                        <td className="p-3 text-sm font-mono" style={{ color: palette.muted }}>
                          {b.mfgDate || '—'}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm">{b.expiryDate}</span>
                            <span
                              className="px-2 py-0.5 rounded text-xs font-bold"
                              style={{ backgroundColor: expStatus.bg, color: expStatus.color }}
                            >
                              {expStatus.label}
                            </span>
                          </div>
                        </td>
                        <td className="p-3 text-right font-bold text-base" style={{ color: palette.navy }}>
                          {b.quantity}
                        </td>
                        <td className="p-3 text-right text-sm font-mono" style={{ color: palette.ink }}>
                          {b.costPrice ? money(b.costPrice) : '—'}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <IconButton
                              id={`btn-edit-batch-${b.id}`}
                              icon={Pencil}
                              tooltip="Edit Batch"
                              onClick={() => handleOpenEditBatch(b)}
                            />
                            {warehouses.length > 1 && (
                              <IconButton
                                id={`btn-transfer-batch-${b.id}`}
                                icon={ArrowRightLeft}
                                tooltip="Transfer to another warehouse"
                                onClick={() => handleOpenTransfer(b)}
                              />
                            )}
                            <IconButton
                              id={`btn-delete-batch-${b.id}`}
                              icon={Trash2}
                              variant="danger"
                              tooltip="Delete Batch"
                              onClick={() => {
                                setBatchToDelete(b);
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile & Tablet Card Layout (Matches Dashboard Cards) */}
            <div className="block lg:hidden grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredBatches.map((b) => {
                const prod = products.find((p) => p.id === b.productId);
                const wh = warehouses.find((w) => w.id === b.warehouseId);
                const expStatus = getBatchExpiryStatus(b.expiryDate, palette.muted);

                const batchTone =
                  expStatus.label === 'Expired'
                    ? 'due'
                    : expStatus.label.includes('Expiring')
                      ? 'warning'
                      : 'received';

                return (
                  <div
                    key={b.id}
                    data-card-tone={batchTone}
                    className="border rounded-2xl p-3.5 sm:p-4 shadow-xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-mono text-xs font-bold text-slate-600 bg-white/80 px-1.5 py-0.5 rounded border border-black/8">
                            {b.batchNumber}
                          </span>
                          <h4 className="font-bold text-slate-900 mt-1.5" style={fz(15)}>
                            {prod ? prod.name : `Product #${b.productId}`}
                          </h4>
                          <div className="text-xs text-slate-600 mt-0.5 font-medium">
                            Warehouse: <strong className="text-slate-800">{wh ? wh.name : b.warehouseId}</strong>
                          </div>
                        </div>

                        <span
                          className="px-2 py-0.5 rounded-lg text-xs font-bold shrink-0"
                          style={{ backgroundColor: expStatus.bg, color: expStatus.color }}
                        >
                          {expStatus.label}
                        </span>
                      </div>

                      {/* 2-Column Metrics */}
                      <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-black/8 text-xs">
                        <div className="bg-white/80 p-2 rounded-xl border border-black/5">
                          <div className="text-xs text-slate-500 font-medium">Stock (Cases)</div>
                          <div className="font-extrabold text-base text-slate-900 tabular-nums">{b.quantity}</div>
                        </div>
                        <div className="bg-white/80 p-2 rounded-xl border border-black/5">
                          <div className="text-xs text-slate-500 font-medium">Cost / Case</div>
                          <div className="font-bold text-base text-slate-900 tabular-nums">
                            {b.costPrice ? `₹${money(b.costPrice)}` : '—'}
                          </div>
                        </div>
                        <div className="text-slate-500 text-xs">
                          Mfg: <span className="font-mono font-medium text-slate-700">{b.mfgDate || '—'}</span>
                        </div>
                        <div className="text-slate-500 text-xs">
                          Exp: <span className="font-mono font-medium text-slate-700">{b.expiryDate}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-1.5 mt-3 pt-2 border-t border-slate-100">
                      <IconButton
                        id={`btn-mob-edit-batch-${b.id}`}
                        icon={Pencil}
                        tooltip="Edit Batch"
                        onClick={() => handleOpenEditBatch(b)}
                      />
                      {warehouses.length > 1 && (
                        <IconButton
                          id={`btn-mob-transfer-batch-${b.id}`}
                          icon={ArrowRightLeft}
                          tooltip="Transfer to another warehouse"
                          onClick={() => handleOpenTransfer(b)}
                        />
                      )}
                      <IconButton
                        id={`btn-mob-delete-batch-${b.id}`}
                        icon={Trash2}
                        variant="danger"
                        tooltip="Delete Batch"
                        onClick={() => {
                          setBatchToDelete(b);
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            </>
          )}
        </div>
      )}

      {/* 3. SUB-TAB: STOCK TRANSFERS */}
      {activeSubTab === 'transfers' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 style={fz(18, { fontWeight: 700, color: palette.ink })}>Inter-Warehouse Movement Log</h3>
              <p className="hidden sm:block" style={fz(14, { color: palette.muted })}>
                Audit record of case transfers between central depots and local distributing godowns.
              </p>
            </div>
            <button
              id="btn-transfer-new"
              onClick={() => handleOpenTransfer()}
              disabled={warehouses.length < 2 || products.length === 0}
              className="flex items-center gap-2 px-3.5 py-2 font-bold cursor-pointer focus-ring"
              style={{
                backgroundColor: palette.navy,
                color: '#FFFFFF',
                opacity: warehouses.length < 2 || products.length === 0 ? 0.5 : 1,
                ...fz(14),
              }}
            >
              <ArrowRightLeft size={16} />
              New Stock Transfer
            </button>
          </div>

          {stockTransfers.length === 0 ? (
            <div className="p-8 text-center border-2" style={cardStyle}>
              <ArrowRightLeft size={48} className="mx-auto mb-3" color={palette.muted} />
              <h4 style={fz(16, { fontWeight: 700, color: palette.ink })}>No Stock Transfers Recorded</h4>
              <p style={fz(14, { color: palette.muted, maxWidth: '420px', margin: '0.5rem auto' })}>
                When you relocate cases between godowns, each transaction is logged here for inventory reconciliation.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto overscroll-x-contain rounded-2xl border border-slate-200 shadow-sm" style={cardStyle}>
                <table className="w-full text-left data-table border-collapse min-w-[640px]">
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: `2px solid ${palette.line}` }}>
                      <th className="p-3" style={fz(13, { fontWeight: 700, color: palette.ink })}>
                        Date
                      </th>
                      <th className="p-3" style={fz(13, { fontWeight: 700, color: palette.ink })}>
                        Source Warehouse
                      </th>
                      <th className="p-3" style={fz(13, { fontWeight: 700, color: palette.ink })}>
                        Destination Warehouse
                      </th>
                      <th className="p-3" style={fz(13, { fontWeight: 700, color: palette.ink })}>
                        Product & Batch
                      </th>
                      <th className="p-3 text-right" style={fz(13, { fontWeight: 700, color: palette.ink })}>
                        Transferred Cases
                      </th>
                      <th className="p-3" style={fz(13, { fontWeight: 700, color: palette.ink })}>
                        Challan / Notes
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockTransfers.map((st) => {
                      const fromWh = warehouses.find((w) => w.id === st.fromWarehouseId);
                      const toWh = warehouses.find((w) => w.id === st.toWarehouseId);
                      const prod = products.find((p) => p.id === st.productId);

                      return (
                        <tr
                          key={st.id}
                          className="hover:bg-slate-50 transition-colors"
                          style={{ borderBottom: `1px solid ${palette.line}` }}
                        >
                          <td className="p-3 text-sm font-mono">{st.date}</td>
                          <td className="p-3 font-semibold text-sm" style={{ color: palette.bad }}>
                            {fromWh ? fromWh.name : st.fromWarehouseId}
                          </td>
                          <td className="p-3 font-semibold text-sm" style={{ color: palette.good }}>
                            {toWh ? toWh.name : st.toWarehouseId}
                          </td>
                          <td className="p-3 text-sm">
                            <div className="font-semibold">{prod ? prod.name : `Product #${st.productId}`}</div>
                            {st.batchNumber && (
                              <span className="text-xs font-mono px-1.5 py-0.2 bg-slate-100 rounded">
                                Batch: {st.batchNumber}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right font-bold text-base" style={{ color: palette.navy }}>
                            {st.quantity}
                          </td>
                          <td className="p-3 text-sm italic" style={{ color: palette.muted }}>
                            {st.referenceNote || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile & Tablet Card Layout */}
              <div className="block md:hidden space-y-3">
                {stockTransfers.map((st) => {
                  const fromWh = warehouses.find((w) => w.id === st.fromWarehouseId);
                  const toWh = warehouses.find((w) => w.id === st.toWarehouseId);
                  const prod = products.find((p) => p.id === st.productId);

                  return (
                    <div
                      key={st.id}
                      data-card-tone="sales"
                      className="border rounded-2xl p-3.5 shadow-xs"
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-black/8 pb-2 mb-2">
                        <span className="text-xs font-mono text-slate-500 font-bold">{st.date}</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200">
                          {st.quantity} Cases
                        </span>
                      </div>

                      <div className="font-bold text-slate-900 text-sm">
                        {prod ? prod.name : `Product #${st.productId}`}
                      </div>
                      {st.batchNumber && (
                        <div className="text-xs font-mono text-slate-500 mt-0.5">
                          Batch: <strong className="text-slate-700">{st.batchNumber}</strong>
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100 text-xs flex-wrap">
                        <span className="font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          From: {fromWh ? fromWh.name : st.fromWarehouseId}
                        </span>
                        <span className="text-slate-400">→</span>
                        <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          To: {toWh ? toWh.name : st.toWarehouseId}
                        </span>
                      </div>

                      {st.referenceNote && (
                        <div className="text-xs text-slate-500 italic mt-2 bg-slate-50 p-1.5 rounded border border-slate-200">
                          Note: {st.referenceNote}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};
