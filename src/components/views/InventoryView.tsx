import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Download, Plus, RotateCcw } from 'lucide-react';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useLedger } from '../../context/LedgerContext';
import { CanonicalActionIntent, GRN } from '../../types';
import { CanonicalReturnBanner } from '../common/CanonicalReturnBanner';
import { generateSkuId } from '../../utils/billing';
import { AuditView } from './AuditView';
import { buildOversoldClearAudits, type OversoldItem } from '../../utils/oversoldDiagnostic';
import { StockAuditScreen } from './StockAuditScreen';
import { DispositionsView } from './DispositionsView';
import { trackedStage } from './ExpiryReturnsTracker';
import { todayISO } from '../../utils/dateLocal';
import { downloadAllGrnsCsv } from '../../utils/grnCsvExport';
import { buildCrossWarehouseShiftPlan } from '../../utils/billCostRepair';
import { InventoryRealtimeTab } from './inventory/InventoryRealtimeTab';
import { InventoryConsignmentsTab } from './inventory/InventoryConsignmentsTab';
import { InventoryTransfersTab, type TransferLine } from './inventory/InventoryTransfersTab';
import { InventoryModals } from './inventory/InventoryModals';

export type InventorySubTab = 'realtime' | 'consignments' | 'audit' | 'transfers' | 'warehouses' | 'batches' | 'dispositions';

interface InventoryViewProps {
  initialSubTab?: InventorySubTab;
}

export const InventoryView: React.FC<InventoryViewProps> = ({ initialSubTab = 'realtime' }) => {
  const {
    products,
    grns,
    deleteGrn,
    remainingStock,
    productWarehouseStock,
    warehouses,
    inventoryBatches,
    stockTransfers,
    billingSettings,
    addStockTransfer,
    warehouseStock,
    productBatchLines,
    inventoryDispositions,
    bills,
    restoreCrossWarehouseAllocations,
    oversoldReport,
    saveBatchAudit,
    currentRole,
    reassignBillsProductWarehouse,
    undoLastOversoldReassign,
    hasOversoldReassignUndo,
    pendingCanonicalAction,
    clearPendingCanonicalAction,
    returnFromCanonicalAction,
  } = useLedger();

  const clearOversoldDeficits = (items: OversoldItem[], reason: string) => {
    if (currentRole !== 'admin') return;
    for (const a of buildOversoldClearAudits(items, reason)) {
      saveBatchAudit({
        warehouseId: a.warehouseId,
        referenceNote: 'Oversold deficit cleared from the oversold inspector',
        lines: a.lines,
      });
    }
  };

  const [oversoldInspect, setOversoldInspect] = useState<{ open: boolean; productId?: number; warehouseId?: string }>({ open: false });

  const crossWhPlan = useMemo(
    () =>
      buildCrossWarehouseShiftPlan({
        bills: bills || [],
        products,
        inventoryBatches,
        warehouses,
      }),
    [bills, products, inventoryBatches, warehouses],
  );

  // Customer expired returns still waiting for a decision / handover (badge on the Returns tab).
  const pendingExpiryReturns = (inventoryDispositions || []).filter(
    (d) => !!d.returnTracking && trackedStage(d) === 'held',
  ).length;

  const resolveTab = (tabName?: InventorySubTab): 'realtime' | 'consignments' | 'audit' | 'transfers' | 'dispositions' => {
    if (tabName === 'audit') return 'audit';
    if (tabName === 'transfers' || tabName === 'warehouses' || tabName === 'batches') return 'transfers';
    if (tabName === 'consignments') return 'consignments';
    if (tabName === 'dispositions') return 'dispositions';
    return 'realtime';
  };

  const [activeTab, setActiveTab] = useState<'realtime' | 'consignments' | 'audit' | 'transfers' | 'dispositions'>(
    resolveTab(initialSubTab)
  );
  const todayStr = todayISO();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all');

  const [isInwardModalOpen, setIsInwardModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [selectedProductForInward, setSelectedProductForInward] = useState<number | undefined>(undefined);
  const [selectedGrnToEdit, setSelectedGrnToEdit] = useState<GRN | null>(null);
  const [grnToDelete, setGrnToDelete] = useState<GRN | null>(null);
  const [expandedGrnIds, setExpandedGrnIds] = useState<Record<string, boolean>>({});
  const [expandedBatchProductIds, setExpandedBatchProductIds] = useState<Record<number, boolean>>({});
  const [notification, setNotification] = useState<string | null>(null);

  const isPhone = useIsMobile(1023);
  const [auditWhId, setAuditWhId] = useState<string>('');
  const [showWhSheet, setShowWhSheet] = useState(false);
  const [lastNewGrnId, setLastNewGrnId] = useState<string | null>(null);
  const [darkToast, setDarkToast] = useState<string | null>(null);
  const [showTransferPicker, setShowTransferPicker] = useState(false);
  const [activeReturnIntent, setActiveReturnIntent] = useState<CanonicalActionIntent | null>(null);
  const [xferJustDone, setXferJustDone] = useState<{
    fromName: string;
    toName: string;
    totalCases: number;
    summary: string;
    timeLabel: string;
    count: number;
  } | null>(null);

  useEffect(() => {
    if (!auditWhId && warehouses[0]?.id) {
      setAuditWhId(warehouses[0].id);
    }
  }, [warehouses, auditWhId]);

  const showPhoneToast = (msg: string) => {
    setDarkToast(msg);
    setTimeout(() => setDarkToast(null), 4500);
  };

  // ── Multi-line inter-godown transfer (Inventory control → Transfer) ──
  const [xferFromId, setXferFromId] = useState('');
  const [xferToId, setXferToId] = useState('');
  const [xferLines, setXferLines] = useState<TransferLine[]>([]);
  const [xferNote, setXferNote] = useState('');
  const [xferBusy, setXferBusy] = useState(false);

  useEffect(() => {
    if (initialSubTab) {
      setActiveTab(resolveTab(initialSubTab));
    }
  }, [initialSubTab]);

  useEffect(() => {
    if (!xferFromId && warehouses[0]?.id) setXferFromId(warehouses[0].id);
    if (!xferToId && (warehouses[1]?.id || warehouses[0]?.id)) {
      setXferToId(warehouses[1]?.id || warehouses[0].id);
    }
  }, [warehouses, xferFromId, xferToId]);

  React.useEffect(() => {
    try {
      if (sessionStorage.getItem('mrwater_open_dispositions') === 'claims') {
        sessionStorage.removeItem('mrwater_open_dispositions');
        setActiveTab('dispositions');
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!pendingCanonicalAction) return;
    if (
      pendingCanonicalAction.entityType !== 'grn' &&
      pendingCanonicalAction.entityType !== 'audit' &&
      pendingCanonicalAction.entityType !== 'batch'
    ) {
      return;
    }
    const intent = pendingCanonicalAction;
    clearPendingCanonicalAction();
    if (intent.returnTab) setActiveReturnIntent(intent);
    if (intent.entityType === 'grn') {
      setActiveTab('consignments');
      const targetGrn = (grns || []).find((g) => String(g.id) === String(intent.entityId));
      if (!targetGrn) return;
      if (intent.action === 'edit' || intent.action === 'view') {
        setSelectedGrnToEdit(targetGrn);
        setIsInwardModalOpen(true);
      } else if (intent.action === 'delete') {
        setGrnToDelete(targetGrn);
      }
    } else if (intent.entityType === 'audit') {
      setActiveTab('audit');
    } else if (intent.entityType === 'batch') {
      setActiveTab('realtime');
    }
  }, [pendingCanonicalAction, grns, clearPendingCanonicalAction]);

  const showToast = (msg: string) => {
    if (isPhone) {
      showPhoneToast(msg);
      return;
    }
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const filteredProducts = products.filter((p) => {
    const sku = p.sku || generateSkuId(p.name, p.category, p.id);
    const matchName =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sku.toLowerCase().includes(searchTerm.toLowerCase());
    // Location filter: product has batch or book stock at that godown
    const matchWh =
      selectedWarehouse === 'all' ||
      inventoryBatches.some(
        (b) => b.productId === p.id && b.warehouseId === selectedWarehouse,
      ) ||
      warehouseStock(selectedWarehouse, p.id) !== 0 ||
      p.warehouseId === selectedWarehouse;
    return matchName && matchWh;
  });

  const totalStockCases = Math.max(
    0,
    filteredProducts.reduce((s, p) => s + Math.max(0, remainingStock(p.id)), 0),
  );

  const fmtCompactInr = (val: number) => {
    const abs = Math.abs(val);
    const sign = val < 0 ? '-' : '';
    if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2).replace(/\.00$/, '')}L`;
    if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1).replace(/\.0$/, '')}k`;
    return `${sign}₹${Math.round(abs).toLocaleString('en-IN')}`;
  };

  const selectedWhObj = warehouses.find((w) => w.id === selectedWarehouse);
  const auditWhObj = warehouses.find((w) => w.id === auditWhId) || warehouses[0];
  const sortedGrnsForHeader = [...(grns || [])].sort((a, b) => {
    const da = a.inwardDate || a.invoiceDate || '';
    const db = b.inwardDate || b.invoiceDate || '';
    if (da !== db) return db.localeCompare(da);
    return String(b.id).localeCompare(String(a.id));
  });

  return (
    <div id="view-inventory" className={`hh-view mw-workspace flex flex-col gap-4 w-full min-w-0 max-w-full ${isPhone ? 'pb-24' : 'pb-24'}`}>
      {/* Desktop Toast Notification */}
      {!isPhone && notification && (
        <div className="flex items-center gap-2 p-3 bg-[var(--primary)] text-white rounded-2xl shadow-md animate-fade-in text-sm font-semibold">
          <CheckCircle2 size={18} />
          <span>{notification}</span>
        </div>
      )}

      {isPhone ? (
        <div className="hh-sales-top hh-sales-top--flush hh-inv-top">
          <div className="hh-sales-top__row">
            <h1 className="hh-sales-top__title">Inventory</h1>
            {(activeTab === 'realtime' || activeTab === 'dispositions') && (
              <button
                type="button"
                onClick={() => setShowWhSheet(true)}
                className="hh-inv-glass-pill"
              >
                <span>{selectedWhObj ? selectedWhObj.name : 'All locations'}</span>
                <ChevronDown size={13} aria-hidden="true" />
              </button>
            )}
            {activeTab === 'consignments' && (
              <button
                type="button"
                onClick={() => downloadAllGrnsCsv(sortedGrnsForHeader, warehouses)}
                className="hh-inv-glass-pill"
                aria-label="Download all GRNs as CSV"
              >
                <Download size={12} aria-hidden="true" />
                <span>CSV</span>
              </button>
            )}
            {activeTab === 'audit' && auditWhObj && (
              <button
                type="button"
                onClick={() => setShowWhSheet(true)}
                className="hh-inv-glass-pill"
              >
                <span>{auditWhObj.name}</span>
                <ChevronDown size={13} aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="rt-utabs" role="tablist" aria-label="Inventory sections">
            {(
              [
                { id: 'realtime' as const, label: 'Stock', alertCount: 0 },
                { id: 'consignments' as const, label: 'Inward', alertCount: 0 },
                { id: 'audit' as const, label: 'Audit', alertCount: 0 },
                { id: 'dispositions' as const, label: 'Returns', alertCount: pendingExpiryReturns || 0 },
                { id: 'transfers' as const, label: 'Transfer', alertCount: 0 },
              ] as const
            ).map((t) => {
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  id={`tab-${t.id}`}
                  onClick={() => {
                    setActiveTab(t.id);
                    if (t.id === 'transfers') setXferJustDone(null);
                  }}
                  className="hh-inv-utab"
                >
                  <span>{t.label}</span>
                  {t.alertCount > 0 && (
                    <span className="hh-inv-tab-badge">{t.alertCount}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          {/* Consistent Page Header (Desktop / Tablet) */}
          <div className="flex items-center justify-between gap-3 min-h-10 sm:min-h-11">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Inventory
            </h1>
            {activeTab === 'consignments' && (
              <button
                type="button"
                id="btn-add-inward"
                onClick={() => {
                  setSelectedGrnToEdit(null);
                  setIsInwardModalOpen(true);
                }}
                className="size-10 sm:size-11 rounded-full bg-[var(--primary)] text-white flex items-center justify-center shadow-md cursor-pointer active:scale-95 transition-transform shrink-0"
                aria-label="New inward purchase"
                title="New inward purchase"
              >
                <Plus className="w-5 h-5" strokeWidth={2.5} />
              </button>
            )}
          </div>
        </>
      )}

      {activeReturnIntent && (
        <CanonicalReturnBanner
          intent={activeReturnIntent}
          onReturn={() => {
            const intent = activeReturnIntent;
            setActiveReturnIntent(null);
            returnFromCanonicalAction(intent);
          }}
          onDismiss={() => setActiveReturnIntent(null)}
        />
      )}

      {crossWhPlan.affectedBillCount > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600" />
            <div className="space-y-1">
              <div>
                <b>Stock shifted across godowns on {crossWhPlan.affectedBillCount} bill(s) ({crossWhPlan.totalShiftedCases} cases):</b>{' '}
                Bills without a godown tag were linked to batches in another godown, which can make available units look higher. Restore them to their original godown while keeping saved costs frozen.
              </div>
              <div className="flex flex-col gap-0.5 text-xs text-amber-950/90">
                {crossWhPlan.lines.slice(0, 5).map((l) => {
                  const matchedBill = (bills || []).find((b) => b.id === l.billId);
                  const billLabel = matchedBill?.docNo || `#${l.billId}`;
                  return (
                    <div key={`${l.billId}-${l.itemIndex}`}>
                      • <b>{l.productName}</b> ({l.qty} cs) on Bill {billLabel} ({l.retailer} · {l.billDate}) — batch in{' '}
                      <b>{l.allocatedWarehouseNames.join(', ')}</b> instead of <b>{l.expectedWarehouseName}</b>
                    </div>
                  );
                })}
                {crossWhPlan.lines.length > 5 && (
                  <div className="text-amber-800 font-semibold">+{crossWhPlan.lines.length - 5} more item(s)</div>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => restoreCrossWarehouseAllocations(crossWhPlan)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-950 cursor-pointer shrink-0"
          >
            <RotateCcw size={13} />
            Restore Exact Inventory ({crossWhPlan.totalShiftedCases} cs)
          </button>
        </div>
      )}

      {!isPhone && oversoldReport.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-2xl border border-rose-200 bg-rose-50/90 px-3.5 py-3">
          <div className="flex items-start sm:items-center gap-2 text-xs font-semibold text-rose-900 min-w-0">
            <AlertTriangle size={15} className="shrink-0 text-rose-600 mt-0.5 sm:mt-0" />
            <span>
              {oversoldReport.length} product godown{oversoldReport.length === 1 ? ' is' : 's are'} oversold (negative book balance).
            </span>
          </div>
          <button
            type="button"
            onClick={() => setOversoldInspect({ open: true })}
            className="self-start sm:self-auto shrink-0 h-8 px-3.5 rounded-full bg-rose-700 text-xs font-semibold text-white hover:bg-rose-800 cursor-pointer whitespace-nowrap transition-colors"
          >
            Inspect &amp; clear ({oversoldReport.length})
          </button>
        </div>
      )}

      {!isPhone && (
        /* Consistent Segmented Tabs (Desktop / Tablet) */
        <div
          className="grid grid-cols-5 w-full bg-[#ebe8e1] rounded-full p-1"
          role="tablist"
          aria-label="Inventory sections"
        >
          {(
            [
              { id: 'realtime' as const, label: 'Stock', alertCount: 0 },
              { id: 'consignments' as const, label: 'Inward', alertCount: 0 },
              { id: 'audit' as const, label: 'Audit', alertCount: 0 },
              { id: 'dispositions' as const, label: 'Returns', alertCount: pendingExpiryReturns || 0 },
              { id: 'transfers' as const, label: 'Transfer', alertCount: 0 },
            ] as const
          ).map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                id={`tab-${t.id}`}
                onClick={() => setActiveTab(t.id)}
                className={`min-w-0 py-2.5 px-1 sm:px-3 rounded-full text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap truncate ${
                  active
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {t.label}
                {t.alertCount > 0 && (
                  <span className="ml-1 text-xs font-bold text-amber-700 tabular-nums">
                    {t.alertCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* TAB 1: REAL-TIME CRATE COUNTS */}
      {activeTab === 'realtime' && (
        <InventoryRealtimeTab
          isPhone={isPhone}
          todayStr={todayStr}
          filteredProducts={filteredProducts}
          warehouses={warehouses}
          selectedWarehouse={selectedWarehouse}
          setSelectedWarehouse={setSelectedWarehouse}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          billingSettings={billingSettings}
          oversoldReport={oversoldReport}
          setOversoldInspect={setOversoldInspect}
          expandedBatchProductIds={expandedBatchProductIds}
          setExpandedBatchProductIds={setExpandedBatchProductIds}
          totalStockCases={totalStockCases}
          fmtCompactInr={fmtCompactInr}
          remainingStock={remainingStock}
          warehouseStock={warehouseStock}
          productWarehouseStock={productWarehouseStock}
          productBatchLines={productBatchLines}
        />
      )}

      {/* TAB 2: PURCHASES (inward supplier invoices) */}
      {activeTab === 'consignments' && (
        <InventoryConsignmentsTab
          isPhone={isPhone}
          grns={grns}
          products={products}
          warehouses={warehouses}
          lastNewGrnId={lastNewGrnId}
          expandedGrnIds={expandedGrnIds}
          setExpandedGrnIds={setExpandedGrnIds}
          setSelectedGrnToEdit={setSelectedGrnToEdit}
          setIsInwardModalOpen={setIsInwardModalOpen}
          setIsBulkModalOpen={setIsBulkModalOpen}
          setGrnToDelete={setGrnToDelete}
        />
      )}

      {activeTab === 'dispositions' && (
        <DispositionsView
          selectedWarehouseFilter={isPhone ? selectedWarehouse : undefined}
          onChangeWarehouseFilter={isPhone ? setSelectedWarehouse : undefined}
        />
      )}

      {activeTab === 'audit' && (
        <div className="flex flex-col gap-3 max-w-none mx-auto w-full">
          {/* Phone-first batch-level count. No fixed/floating bars: the keyboard never covers a row. */}
          <StockAuditScreen
            onGoInventoryTab={(t) => setActiveTab(t)}
            selectedWhId={isPhone ? auditWhId : undefined}
            onChangeWhId={isPhone ? setAuditWhId : undefined}
          />
          {!isPhone && (
            <details className="text-xs text-slate-500 my-2">
              <summary className="cursor-pointer font-semibold text-slate-600 py-1 hover:text-slate-900">
                Audit history &amp; reconciliation
              </summary>
              <div className="mt-3">
                <AuditView embedded />
              </div>
            </details>
          )}
        </div>
      )}

      {/* TAB 4: GODOWN TRANSFERS — multi-line form matching Inventory control UI */}
      {activeTab === 'transfers' && (
        <InventoryTransfersTab
          isPhone={isPhone}
          products={products}
          warehouses={warehouses}
          stockTransfers={stockTransfers}
          xferFromId={xferFromId}
          setXferFromId={setXferFromId}
          xferToId={xferToId}
          setXferToId={setXferToId}
          xferLines={xferLines}
          setXferLines={setXferLines}
          xferNote={xferNote}
          setXferNote={setXferNote}
          xferBusy={xferBusy}
          setXferBusy={setXferBusy}
          xferJustDone={xferJustDone}
          setXferJustDone={setXferJustDone}
          showTransferPicker={showTransferPicker}
          setShowTransferPicker={setShowTransferPicker}
          warehouseStock={warehouseStock}
          addStockTransfer={addStockTransfer}
          showToast={showToast}
          showPhoneToast={showPhoneToast}
        />
      )}

      <InventoryModals
        isPhone={isPhone}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        warehouses={warehouses}
        selectedWarehouse={selectedWarehouse}
        setSelectedWarehouse={setSelectedWarehouse}
        auditWhId={auditWhId}
        setAuditWhId={setAuditWhId}
        showWhSheet={showWhSheet}
        setShowWhSheet={setShowWhSheet}
        darkToast={darkToast}
        isInwardModalOpen={isInwardModalOpen}
        setIsInwardModalOpen={setIsInwardModalOpen}
        selectedProductForInward={selectedProductForInward}
        setSelectedProductForInward={setSelectedProductForInward}
        selectedGrnToEdit={selectedGrnToEdit}
        setSelectedGrnToEdit={setSelectedGrnToEdit}
        isBulkModalOpen={isBulkModalOpen}
        setIsBulkModalOpen={setIsBulkModalOpen}
        setLastNewGrnId={setLastNewGrnId}
        showToast={showToast}
        showPhoneToast={showPhoneToast}
        grnToDelete={grnToDelete}
        setGrnToDelete={setGrnToDelete}
        deleteGrn={deleteGrn}
        oversoldInspect={oversoldInspect}
        setOversoldInspect={setOversoldInspect}
        oversoldReport={oversoldReport}
        currentRole={currentRole}
        clearOversoldDeficits={clearOversoldDeficits}
        reassignBillsProductWarehouse={reassignBillsProductWarehouse}
        undoLastOversoldReassign={undoLastOversoldReassign}
        hasOversoldReassignUndo={hasOversoldReassignUndo}
        setXferFromId={setXferFromId}
        setXferToId={setXferToId}
        setXferLines={setXferLines}
        setXferJustDone={setXferJustDone}
      />
    </div>
  );
};
