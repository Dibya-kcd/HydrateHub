import React, { useEffect, useRef, useState } from 'react';
import { notify } from "../../utils/toast";
import {
  ArrowRightLeft,
  Building2,
  Clock,
  Layers,
  Plus,
  Warehouse as WarehouseIcon,
} from 'lucide-react';
import { useLedger } from '../../context/LedgerContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import type { InventoryBatch, Warehouse } from '../../types';
import { generateBatchNumber } from '../../utils/billing';
import { todayISO } from "../../utils/dateLocal";
import {
  getBatchExpiryStatus,
  getTransferAvailable,
  type BatchFormState,
  type TransferFormState,
  type WarehouseFormState,
} from './warehouses/warehouseUtils';
import { PhoneWarehousesFlow } from './warehouses/PhoneWarehousesFlow';
import { WarehouseSubTabs } from './warehouses/WarehouseSubTabs';
import { WarehouseModals } from './warehouses/WarehouseModals';

export interface WarehousesViewProps {
  embedded?: boolean;
  initialSubTab?: 'warehouses' | 'batches' | 'transfers';
}

export const WarehousesView: React.FC<WarehousesViewProps> = ({
  embedded = false,
  initialSubTab = 'warehouses',
}) => {
  const {
    warehouses,
    addWarehouse,
    updateWarehouse,
    deleteWarehouse,
    defaultWarehouse,
    inventoryBatches,
    addBatch,
    updateBatch,
    deleteBatch,
    products,
    stockTransfers,
    addStockTransfer,
    warehouseStock,
    palette,
    fz,
    scale,
    setTab,
  } = useLedger();
  const isPhone = useIsMobile(1023);

  const [activeSubTab, setActiveSubTab] = useState<'warehouses' | 'batches' | 'transfers'>(initialSubTab);
  const [mobileWhView, setMobileWhView] = useState<'list' | 'detail' | 'movements'>(
    initialSubTab === 'transfers' ? 'movements' : 'list',
  );
  const [selectedMobileWhId, setSelectedMobileWhId] = useState<string | null>(null);
  const [mobileLotFilter, setMobileLotFilter] = useState<'all' | 'expiring'>('all');
  const [mobileBatchSheet, setMobileBatchSheet] = useState<InventoryBatch | null>(null);

  // Deletion modals state
  const [warehouseToDelete, setWarehouseToDelete] = useState<Warehouse | null>(null);
  const [cannotDeleteWarehouse, setCannotDeleteWarehouse] = useState<{ name: string; cases: number } | null>(null);
  const [batchToDelete, setBatchToDelete] = useState<InventoryBatch | null>(null);

  // Warehouse Modal State
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [editingWarehouseId, setEditingWarehouseId] = useState<string | null>(null);
  const [whForm, setWhForm] = useState<WarehouseFormState>({
    name: '',
    code: '',
    location: '',
    manager: '',
    phone: '',
    capacityCases: 1000,
    isDefault: false,
    notes: '',
  });

  // Batch Modal State
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [batchForm, setBatchForm] = useState<BatchFormState>({
    productId: products[0]?.id || 0,
    batchNumber: '',
    mfgDate: '',
    expiryDate: '',
    warehouseId: warehouses[0]?.id || '',
    quantity: 50,
    costPrice: 0,
    mrp: 0,
    notes: '',
  });

  // Transfer Modal State
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferForm, setTransferForm] = useState<TransferFormState>({
    date: todayISO(),
    fromWarehouseId: warehouses[0]?.id || '',
    toWarehouseId: warehouses[1]?.id || warehouses[0]?.id || '',
    productId: products[0]?.id || 0,
    batchNumber: '',
    quantity: 10,
    referenceNote: '',
  });

  // Search & Filters
  const [batchSearch, setBatchSearch] = useState('');
  const [batchWarehouseFilter, setBatchWarehouseFilter] = useState('all');
  const [batchProductFilter, setBatchProductFilter] = useState('all');
  const [showBatchFilterDropdown, setShowBatchFilterDropdown] = useState(false);
  const batchFilterDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (batchFilterDropdownRef.current && !batchFilterDropdownRef.current.contains(e.target as Node)) {
        setShowBatchFilterDropdown(false);
      }
    };
    if (showBatchFilterDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showBatchFilterDropdown]);

  const activeBatchFiltersCount =
    (batchWarehouseFilter !== 'all' ? 1 : 0) +
    (batchProductFilter !== 'all' ? 1 : 0);

  const clearBatchFilters = () => {
    setBatchWarehouseFilter('all');
    setBatchProductFilter('all');
    setBatchSearch('');
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: palette.panel,
    borderColor: palette.line,
    borderWidth: 2,
  };

  const inputStyle: React.CSSProperties = {
    backgroundColor: palette.panel,
    color: palette.ink,
    borderColor: palette.line,
    borderWidth: 2,
    ...fz(14),
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    color: palette.ink,
    fontWeight: 600,
    marginBottom: '0.25em',
    ...fz(13),
  };



  // Warehouse Actions
  const handleOpenAddWarehouse = () => {
    setEditingWarehouseId(null);
    setWhForm({
      name: '',
      code: `WH-${warehouses.length + 1}`,
      location: '',
      manager: '',
      phone: '',
      capacityCases: 1000,
      isDefault: warehouses.length === 0,
      notes: '',
    });
    setShowWarehouseModal(true);
  };

  const handleOpenEditWarehouse = (wh: Warehouse) => {
    setEditingWarehouseId(wh.id);
    setWhForm({
      name: wh.name,
      code: wh.code,
      location: wh.location,
      manager: wh.manager,
      phone: wh.phone,
      capacityCases: wh.capacityCases || 1000,
      isDefault: Boolean(wh.isDefault),
      notes: wh.notes || '',
    });
    setShowWarehouseModal(true);
  };

  const handleSaveWarehouse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!whForm.name.trim()) return;

    if (editingWarehouseId) {
      updateWarehouse(editingWarehouseId, {
        name: whForm.name.trim(),
        code: whForm.code.trim(),
        location: whForm.location.trim(),
        manager: whForm.manager.trim(),
        phone: whForm.phone.trim(),
        capacityCases: Number(whForm.capacityCases) || 0,
        isDefault: whForm.isDefault,
        notes: whForm.notes.trim(),
      });
    } else {
      addWarehouse({
        name: whForm.name.trim(),
        code: whForm.code.trim() || `WH-${warehouses.length + 1}`,
        location: whForm.location.trim(),
        manager: whForm.manager.trim(),
        phone: whForm.phone.trim(),
        capacityCases: Number(whForm.capacityCases) || 0,
        isDefault: whForm.isDefault,
        notes: whForm.notes.trim(),
      });
    }
    setShowWarehouseModal(false);
  };

  // Batch Actions
  const handleOpenAddBatch = (preselectedProductId?: number) => {
    setEditingBatchId(null);
    const prod = products.find((p) => p.id === preselectedProductId) || products[0];
    setBatchForm({
      productId: prod?.id || 0,
      batchNumber: generateBatchNumber(prod?.name),
      mfgDate: todayISO(),
      expiryDate: prod?.expiry || '2026-12-31',
      warehouseId: defaultWarehouse?.id || warehouses[0]?.id || '',
      quantity: 50,
      costPrice: prod?.cost || 0,
      mrp: prod?.retail || 0,
      notes: '',
    });
    setShowBatchModal(true);
  };

  const handleOpenEditBatch = (b: InventoryBatch) => {
    setEditingBatchId(b.id);
    setBatchForm({
      productId: b.productId,
      batchNumber: b.batchNumber,
      mfgDate: b.mfgDate || '',
      expiryDate: b.expiryDate || '',
      warehouseId: b.warehouseId,
      quantity: b.quantity,
      costPrice: b.costPrice || 0,
      mrp: b.mrp || 0,
      notes: b.notes || '',
    });
    setShowBatchModal(true);
  };

  const handleSaveBatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchForm.batchNumber.trim() || !batchForm.productId) return;

    if (editingBatchId) {
      updateBatch(editingBatchId, {
        productId: Number(batchForm.productId),
        batchNumber: batchForm.batchNumber.trim().toUpperCase(),
        mfgDate: batchForm.mfgDate,
        expiryDate: batchForm.expiryDate,
        warehouseId: batchForm.warehouseId,
        quantity: Number(batchForm.quantity) || 0,
        costPrice: Number(batchForm.costPrice) || 0,
        mrp: Number(batchForm.mrp) || 0,
        notes: batchForm.notes.trim(),
      });
    } else {
      addBatch({
        productId: Number(batchForm.productId),
        batchNumber: batchForm.batchNumber.trim().toUpperCase(),
        mfgDate: batchForm.mfgDate,
        expiryDate: batchForm.expiryDate,
        warehouseId: batchForm.warehouseId,
        quantity: Number(batchForm.quantity) || 0,
        costPrice: Number(batchForm.costPrice) || 0,
        mrp: Number(batchForm.mrp) || 0,
        notes: batchForm.notes.trim(),
      });
    }
    setShowBatchModal(false);
  };

  // Stock Transfer Actions
  const handleOpenTransfer = (preselectedBatch?: InventoryBatch) => {
    const fromWh = preselectedBatch?.warehouseId || warehouses[0]?.id || '';
    const otherWh = warehouses.find((w) => w.id !== fromWh)?.id || fromWh;
    const pid = preselectedBatch?.productId || products[0]?.id || 0;
    const bn = preselectedBatch?.batchNumber || '';
    const { available } = getTransferAvailable(inventoryBatches, warehouseStock, fromWh, pid, bn);
    setTransferForm({
      date: todayISO(),
      fromWarehouseId: fromWh,
      toWarehouseId: otherWh,
      productId: pid,
      batchNumber: bn,
      quantity: Math.min(Math.max(1, available), available > 0 ? available : 1),
      referenceNote: '',
    });
    setShowTransferModal(true);
  };

  const handleSaveTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !transferForm.fromWarehouseId ||
      !transferForm.toWarehouseId ||
      transferForm.fromWarehouseId === transferForm.toWarehouseId ||
      transferForm.quantity <= 0
    ) {
      notify('Please select two distinct warehouses and enter a valid quantity.');
      return;
    }

    const qty = Number(transferForm.quantity) || 0;
    const { available, label } = getTransferAvailable(
      inventoryBatches,
      warehouseStock,
      transferForm.fromWarehouseId,
      Number(transferForm.productId),
      transferForm.batchNumber,
    );

    if (available <= 0) {
      notify(
        `No stock available at the source warehouse for this product.\n(${label})`,
      );
      return;
    }
    if (qty > available) {
      notify(
        `Cannot transfer ${qty} cases — only ${available} available at source.\n(${label})\n\nNegative stock is not allowed.`,
      );
      return;
    }

    const ok = addStockTransfer({
      date: transferForm.date,
      fromWarehouseId: transferForm.fromWarehouseId,
      toWarehouseId: transferForm.toWarehouseId,
      productId: Number(transferForm.productId),
      batchNumber: transferForm.batchNumber.trim().toUpperCase(),
      quantity: qty,
      referenceNote: transferForm.referenceNote.trim(),
    });
    if (ok === false) {
      notify(
        'Transfer failed — insufficient stock at source. Negative stock is not allowed.',
      );
      return;
    }
    setShowTransferModal(false);
  };

  // Filtered Batches
  const filteredBatches = inventoryBatches.filter((b) => {
    const prod = products.find((p) => p.id === b.productId);
    const prodName = prod ? prod.name.toLowerCase() : '';
    const matchSearch =
      b.batchNumber.toLowerCase().includes(batchSearch.toLowerCase()) ||
      prodName.includes(batchSearch.toLowerCase());
    const matchWh = batchWarehouseFilter === 'all' || b.warehouseId === batchWarehouseFilter;
    const matchProd = batchProductFilter === 'all' || String(b.productId) === batchProductFilter;
    return matchSearch && matchWh && matchProd;
  });

  const totalCasesInWarehouses = warehouses.reduce((sum, w) => sum + warehouseStock(w.id), 0);
  const expiringSoonCount = inventoryBatches.filter((b) => {
    const st = getBatchExpiryStatus(b.expiryDate, palette.muted);
    return st.label.includes('Expiring') || st.label === 'Expired';
  }).length;

  return (
    <div id="view-warehouses" className={embedded ? 'w-full' : 'py-1 lg:p-6 max-w-none lg:max-w-7xl mx-auto'}>
      {isPhone && !embedded ? (
        <PhoneWarehousesFlow
          showWarehouseModal={showWarehouseModal}
          setShowWarehouseModal={setShowWarehouseModal}
          editingWarehouseId={editingWarehouseId}
          whForm={whForm}
          setWhForm={setWhForm}
          handleSaveWarehouse={handleSaveWarehouse}
          warehouses={warehouses}
          warehouseStock={warehouseStock}
          setCannotDeleteWarehouse={setCannotDeleteWarehouse}
          setWarehouseToDelete={setWarehouseToDelete}
          mobileWhView={mobileWhView}
          setMobileWhView={setMobileWhView}
          selectedMobileWhId={selectedMobileWhId}
          setSelectedMobileWhId={setSelectedMobileWhId}
          products={products}
          stockTransfers={stockTransfers}
          inventoryBatches={inventoryBatches}
          batchSearch={batchSearch}
          setBatchSearch={setBatchSearch}
          mobileLotFilter={mobileLotFilter}
          setMobileLotFilter={setMobileLotFilter}
          mobileBatchSheet={mobileBatchSheet}
          setMobileBatchSheet={setMobileBatchSheet}
          setBatchToDelete={setBatchToDelete}
          setBatchForm={setBatchForm}
          handleOpenAddWarehouse={handleOpenAddWarehouse}
          handleOpenEditWarehouse={handleOpenEditWarehouse}
          handleOpenAddBatch={handleOpenAddBatch}
          handleOpenEditBatch={handleOpenEditBatch}
          handleOpenTransfer={handleOpenTransfer}
          onBackToSettings={() => setTab('settings')}
          palette={palette}
        />
      ) : (
        <>
      {/* Header (hidden when embedded inside unified Inventory View) */}
      {!embedded && (
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-md shadow-sky-600/20 shrink-0">
                <WarehouseIcon className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                    Warehouse & Batch Management
                  </h1>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              id="btn-add-warehouse"
              onClick={handleOpenAddWarehouse}
              className="flex items-center gap-2 border-2 px-3.5 py-2 cursor-pointer focus-ring font-semibold"
              style={{
                backgroundColor: palette.panel,
                borderColor: palette.line,
                color: palette.navy,
                ...fz(14),
              }}
            >
              <Building2 size={Math.round(16 * scale)} />
              Add Warehouse
            </button>
            <button
              id="btn-add-batch"
              onClick={() => handleOpenAddBatch()}
              disabled={products.length === 0}
              className="flex items-center gap-2 border-2 px-3.5 py-2 cursor-pointer focus-ring font-semibold"
              style={{
                backgroundColor: palette.navy,
                borderColor: palette.navy,
                color: '#FFFFFF',
                opacity: products.length === 0 ? 0.5 : 1,
                ...fz(14),
              }}
            >
              <Plus size={Math.round(16 * scale)} />
              Add Batch
            </button>
            <button
              id="btn-transfer-stock"
              onClick={() => handleOpenTransfer()}
              disabled={warehouses.length < 2 || products.length === 0}
              className="flex items-center gap-2 border-2 px-3.5 py-2 cursor-pointer focus-ring font-semibold"
              style={{
                backgroundColor: palette.panel,
                borderColor: palette.navy,
                color: palette.navy,
                opacity: warehouses.length < 2 || products.length === 0 ? 0.5 : 1,
                ...fz(14),
              }}
            >
              <ArrowRightLeft size={Math.round(16 * scale)} />
              Transfer Stock
            </button>
          </div>
        </div>
      )}

      {/* Embedded Action Bar */}
      {embedded && (
        <div
          data-card-tone="neutral"
          className="flex flex-wrap items-center justify-between gap-3 mb-4 p-3.5 border rounded-2xl shadow-xs"
        >
          <div className="text-xs font-bold text-slate-600">
            {activeSubTab === 'warehouses' && `Managing ${warehouses.length} physical godown locations`}
            {activeSubTab === 'batches' && `Tracking ${inventoryBatches.length} batch lots and expiry dates`}
            {activeSubTab === 'transfers' && `History of ${stockTransfers.length} inter-godown transfers`}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {activeSubTab === 'warehouses' && (
              <button
                type="button"
                onClick={handleOpenAddWarehouse}
                className="flex items-center gap-1.5 px-3.5 py-2 font-semibold rounded-full text-xs text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] cursor-pointer shadow-sm"
              >
                <Plus size={14} />
                Add Godown
              </button>
            )}
            {activeSubTab === 'batches' && (
              <button
                type="button"
                onClick={() => handleOpenAddBatch()}
                className="flex items-center gap-1.5 px-3.5 py-2 font-semibold rounded-full text-xs text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] cursor-pointer shadow-sm"
              >
                <Plus size={14} />
                Add Batch Lot
              </button>
            )}
            <button
              onClick={() => handleOpenTransfer()}
              disabled={warehouses.length < 2 || products.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 font-bold rounded text-xs border-2 cursor-pointer"
              style={{
                borderColor: palette.navy,
                color: palette.navy,
                backgroundColor: 'transparent',
                opacity: warehouses.length < 2 || products.length === 0 ? 0.5 : 1,
              }}
            >
              <ArrowRightLeft size={14} />
              Inter-Godown Transfer
            </button>
          </div>
        </div>
      )}

      {/* KPI Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div data-card-tone="sales" className="p-4 rounded-2xl border shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <span style={fz(12, { color: palette.muted, textTransform: 'uppercase', fontWeight: 700 })}>
              Warehouses / Godowns
            </span>
            <span className="hh-icon-badge hh-icon-badge--sm hh-icon-badge--blue shrink-0">
              <Building2 size={15} />
            </span>
          </div>
          <div className="mt-2 tabular-nums" style={fz(24, { fontWeight: 800, color: palette.navy })}>
            {warehouses.length}
          </div>
          <div className="text-xs mt-1 truncate" style={{ color: palette.muted }}>
            Default: {defaultWarehouse ? defaultWarehouse.name : 'None assigned'}
          </div>
        </div>

        <div data-card-tone="received" className="p-4 rounded-2xl border shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <span style={fz(12, { color: palette.muted, textTransform: 'uppercase', fontWeight: 700 })}>
              Total Tracked Cases
            </span>
            <span className="hh-icon-badge hh-icon-badge--sm hh-icon-badge--green shrink-0">
              <Layers size={15} />
            </span>
          </div>
          <div className="mt-2 tabular-nums" style={fz(24, { fontWeight: 800, color: palette.good })}>
            {totalCasesInWarehouses}
          </div>
          <div className="text-xs mt-1" style={{ color: palette.muted }}>
            Across all active batches
          </div>
        </div>

        <div data-card-tone="profit" className="p-4 rounded-2xl border shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <span style={fz(12, { color: palette.muted, textTransform: 'uppercase', fontWeight: 700 })}>
              Active Batches
            </span>
            <span className="hh-icon-badge hh-icon-badge--sm hh-icon-badge--purple shrink-0">
              <WarehouseIcon size={15} />
            </span>
          </div>
          <div className="mt-2 tabular-nums" style={fz(24, { fontWeight: 800, color: palette.navy })}>
            {inventoryBatches.length}
          </div>
          <div className="text-xs mt-1" style={{ color: palette.muted }}>
            Lot numbers registered
          </div>
        </div>

        <div
          data-card-tone={expiringSoonCount > 0 ? 'due' : 'received'}
          className="p-4 rounded-2xl border shadow-xs"
        >
          <div className="flex items-center justify-between gap-2">
            <span style={fz(12, { color: palette.muted, textTransform: 'uppercase', fontWeight: 700 })}>
              Expiry Attention
            </span>
            <span
              className={`hh-icon-badge hh-icon-badge--sm shrink-0 ${
                expiringSoonCount > 0 ? 'hh-icon-badge--rose' : 'hh-icon-badge--green'
              }`}
            >
              <Clock size={15} />
            </span>
          </div>
          <div
            className="mt-2 tabular-nums"
            style={fz(24, {
              fontWeight: 800,
              color: expiringSoonCount > 0 ? palette.bad : palette.good,
            })}
          >
            {expiringSoonCount}
          </div>
          <div className="text-xs mt-1" style={{ color: palette.muted }}>
            {expiringSoonCount > 0 ? 'Batches need priority dispatch' : 'All batches fresh'}
          </div>
        </div>
      </div>

      {/* Navigation Subtabs — pill bar, scrollable on mobile */}
      <div className="w-full overflow-x-auto no-scrollbar mb-5">
        <div className="inline-flex min-w-full sm:min-w-0 sm:w-full bg-[#ebe8e1] rounded-full p-1 gap-0.5">
          {(
            [
              { id: 'warehouses' as const, label: 'Godowns', count: warehouses.length },
              { id: 'batches' as const, label: 'Batches', count: inventoryBatches.length },
              { id: 'transfers' as const, label: 'Transfers', count: stockTransfers.length },
            ] as const
          ).map((t) => {
            const active = activeSubTab === t.id;
            return (
              <button
                key={t.id}
                id={`tab-btn-${t.id}`}
                type="button"
                onClick={() => setActiveSubTab(t.id)}
                className={`flex-1 min-w-[6rem] flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>{t.label}</span>
                <span
                  className={`text-xs font-bold px-1.5 py-0.5 rounded-full tabular-nums ${
                    active ? 'bg-[#ebe8e1] text-[var(--primary)]' : 'bg-black/5 text-slate-500'
                  }`}
                >
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <WarehouseSubTabs
        activeSubTab={activeSubTab}
        warehouses={warehouses}
        inventoryBatches={inventoryBatches}
        filteredBatches={filteredBatches}
        products={products}
        stockTransfers={stockTransfers}
        warehouseStock={warehouseStock}
        updateWarehouse={updateWarehouse}
        setCannotDeleteWarehouse={setCannotDeleteWarehouse}
        setWarehouseToDelete={setWarehouseToDelete}
        setBatchToDelete={setBatchToDelete}
        batchSearch={batchSearch}
        setBatchSearch={setBatchSearch}
        batchWarehouseFilter={batchWarehouseFilter}
        setBatchWarehouseFilter={setBatchWarehouseFilter}
        batchProductFilter={batchProductFilter}
        setBatchProductFilter={setBatchProductFilter}
        showBatchFilterDropdown={showBatchFilterDropdown}
        setShowBatchFilterDropdown={setShowBatchFilterDropdown}
        batchFilterDropdownRef={batchFilterDropdownRef}
        activeBatchFiltersCount={activeBatchFiltersCount}
        clearBatchFilters={clearBatchFilters}
        handleOpenAddWarehouse={handleOpenAddWarehouse}
        handleOpenEditWarehouse={handleOpenEditWarehouse}
        handleOpenAddBatch={handleOpenAddBatch}
        handleOpenEditBatch={handleOpenEditBatch}
        handleOpenTransfer={handleOpenTransfer}
        palette={palette}
        fz={fz}
        cardStyle={cardStyle}
      />
        </>
      )}

      <WarehouseModals
        showWarehouseModal={showWarehouseModal}
        setShowWarehouseModal={setShowWarehouseModal}
        isPhone={isPhone}
        embedded={embedded}
        editingWarehouseId={editingWarehouseId}
        whForm={whForm}
        setWhForm={setWhForm}
        handleSaveWarehouse={handleSaveWarehouse}
        showBatchModal={showBatchModal}
        setShowBatchModal={setShowBatchModal}
        editingBatchId={editingBatchId}
        batchForm={batchForm}
        setBatchForm={setBatchForm}
        handleSaveBatch={handleSaveBatch}
        showTransferModal={showTransferModal}
        setShowTransferModal={setShowTransferModal}
        transferForm={transferForm}
        setTransferForm={setTransferForm}
        handleSaveTransfer={handleSaveTransfer}
        warehouseToDelete={warehouseToDelete}
        setWarehouseToDelete={setWarehouseToDelete}
        deleteWarehouse={deleteWarehouse}
        cannotDeleteWarehouse={cannotDeleteWarehouse}
        setCannotDeleteWarehouse={setCannotDeleteWarehouse}
        batchToDelete={batchToDelete}
        setBatchToDelete={setBatchToDelete}
        deleteBatch={deleteBatch}
        warehouses={warehouses}
        products={products}
        inventoryBatches={inventoryBatches}
        warehouseStock={warehouseStock}
        palette={palette}
        fz={fz}
        inputStyle={inputStyle}
        labelStyle={labelStyle}
      />
    </div>
  );
};
