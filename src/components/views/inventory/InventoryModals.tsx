import React, { Suspense, lazy } from 'react';
import { Check } from 'lucide-react';
import { GRN, Warehouse } from '../../../types';
import { money } from '../../../utils/billing';
import type { OversoldItem } from '../../../utils/oversoldDiagnostic';
import { ConfirmDeleteModal } from '../../common/ConfirmDeleteModal';
import { TransferLine } from './InventoryTransfersTab';

const BulkInwardModal = lazy(() =>
  import('../BulkInwardModal').then((m) => ({ default: m.BulkInwardModal })),
);
const InwardConsignmentModal = lazy(() =>
  import('../InwardConsignmentModal').then((m) => ({ default: m.InwardConsignmentModal })),
);
const OversoldInspectorModal = lazy(() =>
  import('../OversoldInspectorModal').then((m) => ({ default: m.OversoldInspectorModal })),
);

interface InventoryModalsProps {
  isPhone: boolean;
  activeTab: 'realtime' | 'consignments' | 'audit' | 'transfers' | 'dispositions';
  setActiveTab: React.Dispatch<React.SetStateAction<'realtime' | 'consignments' | 'audit' | 'transfers' | 'dispositions'>>;
  warehouses: Warehouse[];
  selectedWarehouse: string;
  setSelectedWarehouse: React.Dispatch<React.SetStateAction<string>>;
  auditWhId: string;
  setAuditWhId: React.Dispatch<React.SetStateAction<string>>;
  showWhSheet: boolean;
  setShowWhSheet: React.Dispatch<React.SetStateAction<boolean>>;
  darkToast: string | null;
  isInwardModalOpen: boolean;
  setIsInwardModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  selectedProductForInward: number | undefined;
  setSelectedProductForInward: React.Dispatch<React.SetStateAction<number | undefined>>;
  selectedGrnToEdit: GRN | null;
  setSelectedGrnToEdit: React.Dispatch<React.SetStateAction<GRN | null>>;
  isBulkModalOpen: boolean;
  setIsBulkModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setLastNewGrnId: React.Dispatch<React.SetStateAction<string | null>>;
  showToast: (msg: string) => void;
  showPhoneToast: (msg: string) => void;
  grnToDelete: GRN | null;
  setGrnToDelete: React.Dispatch<React.SetStateAction<GRN | null>>;
  deleteGrn: (id: string, reason?: string) => void;
  oversoldInspect: { open: boolean; productId?: number; warehouseId?: string };
  setOversoldInspect: React.Dispatch<React.SetStateAction<{ open: boolean; productId?: number; warehouseId?: string }>>;
  oversoldReport: OversoldItem[];
  currentRole: string;
  clearOversoldDeficits: (items: OversoldItem[], reason: string) => void;
  reassignBillsProductWarehouse: (args: any) => any;
  undoLastOversoldReassign: () => any;
  hasOversoldReassignUndo: boolean;
  setXferFromId: React.Dispatch<React.SetStateAction<string>>;
  setXferToId: React.Dispatch<React.SetStateAction<string>>;
  setXferLines: React.Dispatch<React.SetStateAction<TransferLine[]>>;
  setXferJustDone: React.Dispatch<
    React.SetStateAction<{
      fromName: string;
      toName: string;
      totalCases: number;
      summary: string;
      timeLabel: string;
      count: number;
    } | null>
  >;
}

export const InventoryModals: React.FC<InventoryModalsProps> = ({
  isPhone,
  activeTab,
  setActiveTab,
  warehouses,
  selectedWarehouse,
  setSelectedWarehouse,
  auditWhId,
  setAuditWhId,
  showWhSheet,
  setShowWhSheet,
  darkToast,
  isInwardModalOpen,
  setIsInwardModalOpen,
  selectedProductForInward,
  setSelectedProductForInward,
  selectedGrnToEdit,
  setSelectedGrnToEdit,
  isBulkModalOpen,
  setIsBulkModalOpen,
  setLastNewGrnId,
  showToast,
  showPhoneToast,
  grnToDelete,
  setGrnToDelete,
  deleteGrn,
  oversoldInspect,
  setOversoldInspect,
  oversoldReport,
  currentRole,
  clearOversoldDeficits,
  reassignBillsProductWarehouse,
  undoLastOversoldReassign,
  hasOversoldReassignUndo,
  setXferFromId,
  setXferToId,
  setXferLines,
  setXferJustDone,
}) => {
  return (
    <>
      {/* Shared Phone Warehouse Selector Sheet (Stock, Returns & Audit) */}
      {isPhone && showWhSheet && (
        <div className="rt-bsheet-scrim" onClick={() => setShowWhSheet(false)}>
          <div className="rt-bsheet" onClick={(e) => e.stopPropagation()}>
            <div className="hh-grab" />
            <h3 className="text-[17px] font-extrabold text-slate-900">
              {activeTab === 'audit' ? 'Select audit godown' : 'Select godown'}
            </h3>
            <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100">
              {activeTab !== 'audit' && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedWarehouse('all');
                    setShowWhSheet(false);
                  }}
                  className="w-full px-3.5 py-3 flex items-center justify-between text-left text-[14px] font-bold text-slate-900 cursor-pointer"
                >
                  <span>All locations</span>
                  {selectedWarehouse === 'all' && <Check size={16} className="text-[#2864d9]" />}
                </button>
              )}
              {warehouses.map((w) => {
                const isSel = activeTab === 'audit' ? auditWhId === w.id : selectedWarehouse === w.id;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => {
                      if (activeTab === 'audit') setAuditWhId(w.id);
                      else setSelectedWarehouse(w.id);
                      setShowWhSheet(false);
                    }}
                    className="w-full px-3.5 py-3 flex items-center justify-between text-left text-[14px] font-bold text-slate-900 cursor-pointer"
                  >
                    <span>{w.name}</span>
                    {isSel && <Check size={16} className="text-[#2864d9]" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Dark Bottom Toast (phone) */}
      {isPhone && darkToast && (
        <div className="hh-inv-toast" role="status" aria-live="polite">
          <Check size={16} className="text-emerald-400 shrink-0" />
          <span className="leading-snug">{darkToast}</span>
        </div>
      )}

      {/* Inward Consignment Modal */}
      {isInwardModalOpen && (
        <Suspense fallback={null}>
          <InwardConsignmentModal
            isOpen={isInwardModalOpen}
            onClose={() => {
              setIsInwardModalOpen(false);
              setSelectedProductForInward(undefined);
              setSelectedGrnToEdit(null);
            }}
            preselectedWarehouseId={selectedWarehouse !== 'all' ? selectedWarehouse : undefined}
            preselectedProductId={selectedProductForInward}
            initialGrnToEdit={selectedGrnToEdit}
            onOpenBulkImport={() => {
              setIsInwardModalOpen(false);
              setIsBulkModalOpen(true);
            }}
            onSaved={(info) => {
              if (info.grnId) setLastNewGrnId(info.grnId);
              setActiveTab('consignments');
              if (isPhone) {
                showPhoneToast(
                  info.isEdit
                    ? `Purchase updated. Stock ${info.cases} cs in ${info.warehouseName}.`
                    : `Purchase saved. Stock +${info.cases} cs in ${info.warehouseName}.`
                );
              }
            }}
          />
        </Suspense>
      )}

      {/* Bulk Inward Modal */}
      {isBulkModalOpen && (
        <Suspense fallback={null}>
          <BulkInwardModal
            isOpen={isBulkModalOpen}
            onClose={() => setIsBulkModalOpen(false)}
            onSuccess={(grnNumber, itemCount, extra) => {
              if (extra?.grnId) setLastNewGrnId(extra.grnId);
              setIsBulkModalOpen(false);
              setActiveTab('consignments');
              if (isPhone && extra?.totalCases !== undefined && extra?.warehouseName) {
                showPhoneToast(`Imported ${itemCount} lines as ${grnNumber}. Stock +${extra.totalCases} cs in ${extra.warehouseName}.`);
              } else {
                showToast(`Recorded inward consignment ${grnNumber} with ${itemCount} items. Stock and products updated!`);
              }
            }}
          />
        </Suspense>
      )}

      {/* Double-Confirmation Delete Consignment Modal */}
      {grnToDelete && (
        <ConfirmDeleteModal
          isOpen={!!grnToDelete}
          onClose={() => setGrnToDelete(null)}
          onConfirm={() => {}}
          onConfirmWithComment={(reason) => {
            const grnNum = grnToDelete.grnNumber;
            const cases = grnToDelete.totalReceivedQty;
            deleteGrn(grnToDelete.id, reason);
            showToast(`Deleted ${grnNum}. Reversed ${cases} crates from inventory.`);
            setGrnToDelete(null);
          }}
          rectificationPrompt="Reason for deleting consignment *"
          rectificationPlaceholder="e.g. Duplicate GRN, wrong supplier invoice, test entry"
          reasonPresets={['Duplicate GRN', 'Wrong invoice/supplier', 'Cancelled consignment', 'Test entry']}
          commentMinLength={4}
          title="Delete Inward Consignment & Reverse Stock"
          subtitle={`${grnToDelete.grnNumber} • ${grnToDelete.supplierName} • Inv #${grnToDelete.invoiceNo}`}
          warningNote={`Deleting this inward invoice will permanently remove the record and automatically reverse all ${grnToDelete.totalReceivedQty} received crates from godown stock.`}
          confirmationPrompt={`I confirm that I want to reverse invoice ${grnToDelete.invoiceNo} and deduct ${grnToDelete.totalReceivedQty} cases.`}
          confirmButtonLabel="Permanently Delete & Reverse Stock"
          impactItems={[
            {
              label: 'Stock Deduction',
              detail: `Reversal from ${warehouses.find((w) => w.id === grnToDelete.warehouseId)?.name || 'Godowns'}`,
              qtyChange: `-${grnToDelete.totalReceivedQty} cs`,
            },
            {
              label: 'Invoice Grand Total',
              detail: `Reversal of ₹${money(grnToDelete.grandTotal)}`,
            },
            {
              label: 'Supplier & Invoice',
              detail: `${grnToDelete.supplierName} (Inv: ${grnToDelete.invoiceNo}, Dated: ${grnToDelete.inwardDate})`,
            },
            {
              label: 'Affected Line Items',
              detail:
                grnToDelete.items
                  .map((it) => `${it.productName}: -${it.totalReceivedQty} cs`)
                  .slice(0, 4)
                  .join(', ') + (grnToDelete.items.length > 4 ? ` + ${grnToDelete.items.length - 4} more` : ''),
            },
          ]}
        />
      )}

      {oversoldInspect.open && (
        <Suspense fallback={null}>
          <OversoldInspectorModal
            items={oversoldReport}
            initialProductId={oversoldInspect.productId}
            initialWarehouseId={oversoldInspect.warehouseId}
            onClose={() => setOversoldInspect({ open: false })}
            isAdmin={currentRole === 'admin'}
            onClearDeficits={clearOversoldDeficits}
            onReassign={reassignBillsProductWarehouse}
            onUndoReassign={undoLastOversoldReassign}
            hasUndo={hasOversoldReassignUndo}
            onStartAudit={(whId) => {
              if (whId) setAuditWhId(whId);
              setActiveTab('audit');
            }}
            onGoTransfer={(pid, fromWh, toWh) => {
              if (fromWh) setXferFromId(fromWh);
              if (toWh) setXferToId(toWh);
              setXferJustDone(null);
              setXferLines([{ key: `line_${pid}_${Date.now()}`, productId: pid, qty: 1 }]);
              setActiveTab('transfers');
            }}
          />
        </Suspense>
      )}
    </>
  );
};
