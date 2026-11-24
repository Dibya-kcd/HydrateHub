import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileWarning,
  Gift,
  Plus,
  Printer,
} from 'lucide-react';
import { useLedger } from '../../context/LedgerContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import { InventoryDisposition, InventoryDispositionType } from '../../types';
import { money } from '../../utils/billing';
import { daysOpen, printDispositionClaimVoucher } from '../../utils/dispositionCn';
import { sortBatchesFefo } from '../../utils/fefo';
import { writeOffNetForPeriod } from '../../utils/pnlBridge';
import { CustomerReturnLauncher } from '../common/CustomerReturnLauncher';
import { InfoTip } from '../common/InfoTip';
import { ConfirmModal } from '../ui/ConfirmModal';
import { CustomerReturnsList } from './CustomerReturnsList';
import { ExpiryReturnsTracker } from './ExpiryReturnsTracker';
import {
  ClaimSchemeChoice,
  isFreeIssue,
  needsCompensation,
  today,
  TYPE_OPTIONS,
} from './dispositions/dispositionConstants';
import { DispositionsDesktopLedger } from './dispositions/DispositionsDesktopLedger';
import { DispositionsModals } from './dispositions/DispositionsModals';
import { DispositionsPhoneView } from './dispositions/DispositionsPhoneView';

export interface DispositionsViewProps {
  selectedWarehouseFilter?: string;
  onChangeWarehouseFilter?: (whId: string) => void;
}

export const DispositionsView: React.FC<DispositionsViewProps> = ({
  selectedWarehouseFilter,
  onChangeWarehouseFilter,
}) => {
  const isPhone = useIsMobile(1023);
  const {
    products,
    warehouses,
    inventoryBatches,
    grns,
    inventoryDispositions,
    addInventoryDisposition,
    deleteInventoryDisposition,
    updateInventoryDisposition,
    recordDispositionCompensation,
    supplierCreditNotes,
    deleteSupplierCreditNote,
    warehouseStock,
    setTab,
    orgProfile,
    notify,
  } = useLedger();

  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open_claims' | 'settled' | 'writeoff'>('all');
  const [warehouseFilter, setWarehouseFilter] = useState<string>(selectedWarehouseFilter || 'all');
  const [msg, setMsg] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: any; settled: boolean; stockApplied: boolean } | null>(null);

  // Phone UI sheet / expansion state
  const [showPhoneTypeSheet, setShowPhoneTypeSheet] = useState(false);
  const [showPhoneWhSheet, setShowPhoneWhSheet] = useState(false);
  const [expandedPhoneLedgerId, setExpandedPhoneLedgerId] = useState<string | null>(null);
  const [decideTarget, setDecideTarget] = useState<InventoryDisposition | null>(null);
  const [decideChoice, setDecideChoice] = useState<'company' | 'scrap' | 'discard' | 'later'>('company');
  const [decideHandedDate, setDecideHandedDate] = useState(today());
  const [decideRef, setDecideRef] = useState('');
  const [phoneAttachment, setPhoneAttachment] = useState('');
  const [cnLinkGrnId, setCnLinkGrnId] = useState('');

  useEffect(() => {
    if (selectedWarehouseFilter !== undefined && selectedWarehouseFilter !== warehouseFilter) {
      setWarehouseFilter(selectedWarehouseFilter);
    }
  }, [selectedWarehouseFilter, warehouseFilter]);

  const setWhFilter = (whId: string) => {
    setWarehouseFilter(whId);
    onChangeWarehouseFilter?.(whId);
  };

  // Form state
  const [dispositionType, setDispositionType] = useState<InventoryDispositionType>('expiry_return');
  const [productId, setProductId] = useState<number | ''>('');
  const [warehouseId, setWarehouseId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [eventDate, setEventDate] = useState(today());
  const [reason, setReason] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState('');
  const [grnId, setGrnId] = useState('');
  const [distributedToName, setDistributedToName] = useState('');
  const [distributedToPhone, setDistributedToPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [referenceDocNo, setReferenceDocNo] = useState('');
  /** When false: document/claim only — does NOT reduce godown stock. */
  const [reduceStock, setReduceStock] = useState(true);
  /** Supplier compensation scheme asked for on the claim / CN */
  const [claimScheme, setClaimScheme] = useState<ClaimSchemeChoice>('none');
  const [schemeBuyQty, setSchemeBuyQty] = useState<number | ''>(1);
  const [schemeFreeQty, setSchemeFreeQty] = useState<number | ''>(1);
  const [schemeDiscountPct, setSchemeDiscountPct] = useState<number | ''>('');
  const [cnScheme, setCnScheme] = useState<ClaimSchemeChoice>('none');
  const [cnSchemeNote, setCnSchemeNote] = useState('');
  const [cnAttachment, setCnAttachment] = useState('');
  const [appendPayment, setAppendPayment] = useState(false);
  const [selectedClaimIds, setSelectedClaimIds] = useState<string[]>([]);
  const [showMultiCn, setShowMultiCn] = useState(false);
  const [multiCnNo, setMultiCnNo] = useState('');
  const [multiCnDate, setMultiCnDate] = useState(today());
  const [multiCnTotal, setMultiCnTotal] = useState<number | ''>('');
  const [requireApproval, setRequireApproval] = useState(false);
  const [freeGoodsPrompt, setFreeGoodsPrompt] = useState<{ productName?: string; note?: string } | null>(null);

  // Compensation modal
  const [compId, setCompId] = useState<string | null>(null);
  const [cnNo, setCnNo] = useState('');
  const [cnDate, setCnDate] = useState(today());
  const [cnTaxable, setCnTaxable] = useState<number | ''>('');
  const [cnCgst, setCnCgst] = useState<number | ''>('');
  const [cnSgst, setCnSgst] = useState<number | ''>('');
  const [cnIgst, setCnIgst] = useState<number | ''>('');
  const [compAmt, setCompAmt] = useState<number | ''>('');
  const [claimVal, setClaimVal] = useState<number | ''>('');

  const batchesForSelection = useMemo(() => {
    if (!productId || !warehouseId) return [];
    return sortBatchesFefo(inventoryBatches, {
      productId: Number(productId),
      warehouseId,
    });
  }, [inventoryBatches, productId, warehouseId]);

  /** Products that still have remaining cases in the selected godown (warehouse → product). */
  const productsInWarehouse = useMemo(() => {
    if (!warehouseId) return [] as { id: number; name: string; stock: number }[];
    return products
      .map((p) => ({
        id: p.id,
        name: p.name,
        stock: Math.max(0, Number(warehouseStock(warehouseId, p.id)) || 0),
      }))
      .filter((row) => row.stock > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [warehouseId, products, warehouseStock, inventoryBatches, inventoryDispositions]);

  const selectedBatch = batchesForSelection.find((b) => b.id === batchId);
  const selectedProduct = products.find((p) => p.id === productId);
  const costPer =
    selectedBatch?.effectiveCostPrice ??
    selectedBatch?.costPrice ??
    selectedProduct?.effectiveCost ??
    selectedProduct?.cost ??
    0;

  const resetForm = () => {
    setDispositionType('expiry_return');
    setProductId('');
    setWarehouseId('');
    setBatchId('');
    setQuantity('');
    setEventDate(today());
    setReason('');
    setSupplierName('');
    setSupplierInvoiceNo('');
    setGrnId('');
    setDistributedToName('');
    setDistributedToPhone('');
    setNotes('');
    setReferenceDocNo('');
    setReduceStock(true);
    setClaimScheme('none');
    setSchemeBuyQty(1);
    setSchemeFreeQty(1);
    setSchemeDiscountPct('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId || !warehouseId || !quantity) {
      setMsg('Product, warehouse and quantity are required');
      return;
    }
    const wh = warehouses.find((w) => w.id === warehouseId);
    const qty = Number(quantity);
    const result = addInventoryDisposition({
      dispositionType,
      productId: Number(productId),
      productName: selectedProduct?.name,
      warehouseId,
      warehouseName: wh?.name,
      batchId: batchId || undefined,
      batchNumber: selectedBatch?.batchNumber,
      expiryDate: selectedBatch?.expiryDate,
      quantity: qty,
      unit: 'case',
      costPerUnit: Number(costPer) || 0,
      supplierName: supplierName || selectedBatch?.supplierName || undefined,
      grnId: grnId || undefined,
      supplierInvoiceNo: supplierInvoiceNo || selectedBatch?.supplierInvoiceNo || undefined,
      compensationStatus: needsCompensation(dispositionType) ? 'pending' : 'not_applicable',
      distributedToName: isFreeIssue(dispositionType) ? distributedToName || undefined : undefined,
      distributedToPhone: isFreeIssue(dispositionType) ? distributedToPhone || undefined : undefined,
      reason: reason || TYPE_OPTIONS.find((t) => t.id === dispositionType)?.label || '',
      notes: (() => {
        const bits: string[] = [];
        if (notes) bits.push(notes);
        if (claimScheme === 'free_bogo') {
          bits.push(`Supplier scheme: Buy ${schemeBuyQty || 1} Get ${schemeFreeQty || 1} free (claim)`);
        } else if (claimScheme === 'discount_pct') {
          bits.push(`Supplier scheme: ${schemeDiscountPct || 0}% value credit on CN`);
        } else if (claimScheme === 'near_expiry_swap') {
          bits.push('Supplier scheme: free near-expiry replacement / swap requested');
        } else if (claimScheme === 'value_credit') {
          bits.push('Supplier scheme: full value credit note requested');
        }
        if (!reduceStock) bits.push('Document only — stock not reduced');
        return bits.length ? bits.join(' · ') : undefined;
      })(),
      referenceDocNo: referenceDocNo || undefined,
      eventDate,
      stockApplied: reduceStock,
      approvalStatus: requireApproval ? 'pending_approval' : 'not_required',
      claimScheme: claimScheme !== 'none' ? claimScheme : undefined,
    } as any);
    if (!result.ok) {
      setMsg('error' in result ? result.error : 'Failed to record disposition');
      return;
    }
    setMsg(
      reduceStock
        ? `Saved. Stock reduced by ${qty} case(s).`
        : `Saved as document only — stock NOT reduced (${qty} case(s) recorded).`
    );

    if (claimScheme === 'free_bogo' || claimScheme === 'near_expiry_swap') {
      setFreeGoodsPrompt({
        productName: selectedProduct?.name,
        note: claimScheme === 'free_bogo' ? `Buy ${schemeBuyQty || 1} Get ${schemeFreeQty || 1}` : 'near-expiry swap',
      });
    }
    setShowForm(false);
    resetForm();
    setTimeout(() => setMsg(null), 4000);
  };

  const filtered = useMemo(() => {
    let rows = inventoryDispositions;
    if (typeFilter !== 'all') rows = rows.filter((r) => r.dispositionType === typeFilter);
    if (warehouseFilter !== 'all') rows = rows.filter((r) => r.warehouseId === warehouseFilter);
    if (statusFilter === 'open_claims') {
      rows = rows.filter((r) => r.compensationStatus === 'pending' || r.compensationStatus === 'partial');
    } else if (statusFilter === 'settled') {
      rows = rows.filter((r) => r.compensationStatus === 'settled');
    } else if (statusFilter === 'writeoff') {
      rows = rows.filter((r) => r.compensationStatus === 'not_applicable' || r.compensationStatus === 'rejected');
    }
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (r) =>
          (r.productName || '').toLowerCase().includes(q) ||
          (r.supplierName || '').toLowerCase().includes(q) ||
          (r.batchNumber || '').toLowerCase().includes(q) ||
          (r.creditNoteNumber || '').toLowerCase().includes(q) ||
          (r.distributedToName || '').toLowerCase().includes(q) ||
          (r.warehouseName || '').toLowerCase().includes(q)
      );
    }
    return rows;
  }, [inventoryDispositions, typeFilter, warehouseFilter, statusFilter, search]);

  const ledgerStats = useMemo(() => {
    const open = inventoryDispositions.filter(
      (r) => r.compensationStatus === 'pending' || r.compensationStatus === 'partial',
    );
    const openValue = open.reduce(
      (s, r) => s + Math.max(0, (Number(r.costValue) || 0) - (Number(r.compensatedAmount) || 0)),
      0,
    );
    const settledRows = inventoryDispositions.filter((r) => r.compensationStatus === 'settled');
    const net = writeOffNetForPeriod(inventoryDispositions);
    const totalCases = inventoryDispositions.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
    const hasCnExport = inventoryDispositions.some((r) => r.creditNoteNumber || Number(r.compensatedAmount) > 0);
    return {
      count: inventoryDispositions.length,
      totalCases,
      openCount: open.length,
      openValue,
      settledCount: settledRows.length,
      recovered: net.recovered,
      netLoss: net.net,
      hasCnExport,
    };
  }, [inventoryDispositions]);

  const openClaims = inventoryDispositions.filter((r) =>
    r.compensationStatus === 'pending' || r.compensationStatus === 'partial'
  );

  const agedClaims = useMemo(() => {
    return openClaims
      .map((r) => ({ row: r, days: daysOpen(r.eventDate) }))
      .filter((x) => x.days >= 30)
      .sort((a, b) => b.days - a.days);
  }, [openClaims]);

  const selectedClaims = useMemo(
    () => inventoryDispositions.filter((r) => selectedClaimIds.includes(r.id)),
    [inventoryDispositions, selectedClaimIds]
  );

  const toggleClaimSelect = (id: string) => {
    setSelectedClaimIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const submitMultiCn = () => {
    if (selectedClaims.length === 0) {
      setMsg('Select at least one open claim');
      return;
    }
    const suppliers = new Set(selectedClaims.map((r) => (r.supplierName || '').trim().toLowerCase()).filter(Boolean));
    if (suppliers.size > 1) {
      setMsg('Multi-line CN requires all selected claims to share the same supplier');
      return;
    }
    if (!multiCnNo.trim()) {
      setMsg('Enter credit note number');
      return;
    }
    const claimSum = selectedClaims.reduce((s, r) => s + (Number(r.costValue) || 0), 0);
    const total = Number(multiCnTotal) > 0 ? Number(multiCnTotal) : claimSum;
    if (total <= 0) {
      setMsg('CN total must be greater than zero');
      return;
    }
    // Allocate proportionally by claim value
    let allocated = 0;
    selectedClaims.forEach((r, idx) => {
      const share =
        idx === selectedClaims.length - 1
          ? Math.max(0, total - allocated)
          : claimSum > 0
            ? Math.round(((Number(r.costValue) || 0) / claimSum) * total * 100) / 100
            : Math.round((total / selectedClaims.length) * 100) / 100;
      allocated += share;
      const taxable = share;
      recordDispositionCompensation(r.id, {
        compensatedAmount: share,
        creditNoteNumber: multiCnNo.trim(),
        creditNoteDate: multiCnDate || undefined,
        cnTaxableValue: taxable,
        cnTotal: share,
        notes: `Multi-line CN ${multiCnNo.trim()} (${selectedClaims.length} lines)`,
        appendPayment: false,
      });
    });
    setShowMultiCn(false);
    setSelectedClaimIds([]);
    setMultiCnNo('');
    setMultiCnTotal('');
    setMsg(`Multi-line CN ${multiCnNo.trim()} applied to ${selectedClaims.length} claim(s)`);
    setTimeout(() => setMsg(null), 4000);
  };

  const submitCompensation = () => {
    if (!compId) return;
    const taxable = Number(cnTaxable) || 0;
    const cgst = Number(cnCgst) || 0;
    const sgst = Number(cnSgst) || 0;
    const igst = Number(cnIgst) || 0;
    const computed = taxable + cgst + sgst + igst;
    const total = Number(compAmt) || computed;
    if (!cnNo.trim()) {
      setMsg('Enter the supplier credit note number');
      return;
    }
    if (total <= 0) {
      setMsg('Credit note amount must be greater than zero');
      return;
    }
    if (igst > 0 && (cgst > 0 || sgst > 0)) {
      setMsg('Use either IGST or CGST+SGST on a credit note, not both');
      return;
    }
    if (computed > 0 && Math.abs(computed - total) > 1) {
      setMsg(`Taxable + GST (₹${money(computed)}) does not match CN total (₹${money(total)})`);
      return;
    }
    const dup = supplierCreditNotes.find(
      (n) =>
        (n.creditNoteNumber || '').trim().toLowerCase() === cnNo.trim().toLowerCase() &&
        !(n.notes || '').includes(`Linked disposition ${compId}`) &&
        (n.supplierName || '').trim().toLowerCase() === (inventoryDispositions.find((d) => d.id === compId)?.supplierName || '').trim().toLowerCase()
    );
    if (dup) {
      setMsg(`CN ${cnNo.trim()} is already recorded for this supplier`);
      return;
    }
    const schemeBits: string[] = [];
    if (cnScheme === 'free_bogo') schemeBits.push('CN scheme: free goods / BOGO');
    if (cnScheme === 'discount_pct') schemeBits.push('CN scheme: discount %');
    if (cnScheme === 'near_expiry_swap') schemeBits.push('CN scheme: near-expiry swap');
    if (cnScheme === 'value_credit') schemeBits.push('CN scheme: full value credit');
    if (cnSchemeNote.trim()) schemeBits.push(cnSchemeNote.trim());
    const target = inventoryDispositions.find((d) => d.id === compId);
    recordDispositionCompensation(compId, {
      compensatedAmount: total,
      creditNoteNumber: cnNo.trim(),
      creditNoteDate: cnDate || undefined,
      cnTaxableValue: taxable,
      cnCgst: cgst,
      cnSgst: sgst,
      cnIgst: igst,
      cnTotal: total,
      costValue: Number(claimVal) > 0 ? Number(claimVal) : undefined,
      notes: schemeBits.length ? schemeBits.join(' · ') : undefined,
      appendPayment: appendPayment,
      paymentNote: appendPayment ? `Partial receipt ${cnNo.trim()}` : undefined,
      attachmentRef: cnAttachment.trim() || undefined,
    });
    if (cnLinkGrnId && cnLinkGrnId !== target?.grnId) {
      updateInventoryDisposition(compId, { grnId: cnLinkGrnId });
    }
    if (cnScheme === 'free_bogo' || cnScheme === 'near_expiry_swap') {
      setFreeGoodsPrompt({
        productName: target?.productName,
        note: cnSchemeNote || cnScheme,
      });
    }
    setCompId(null);
    setAppendPayment(false);
    setCnAttachment('');
    setMsg(appendPayment ? 'Partial CN payment logged' : 'Credit note / compensation recorded');
    setTimeout(() => setMsg(null), 3000);
  };

  const openCnPanel = (r: InventoryDisposition) => {
    setCompId(r.id);
    setCnNo(r.creditNoteNumber || '');
    setCnDate(r.creditNoteDate || today());
    setCnTaxable(r.cnTaxableValue || '');
    setCnCgst(r.cnCgst || '');
    setCnSgst(r.cnSgst || '');
    setCnIgst(r.cnIgst || '');
    setCompAmt(r.compensationStatus === 'partial' ? '' : (r.compensatedAmount || r.costValue || ''));
    setClaimVal(r.costValue || '');
    setAppendPayment(r.compensationStatus === 'partial');
    setCnAttachment(r.attachmentRef || '');
    const validSchemes: Array<ClaimSchemeChoice> = ['none', 'value_credit', 'discount_pct', 'free_bogo', 'near_expiry_swap'];
    setCnScheme(validSchemes.includes(r.claimScheme as ClaimSchemeChoice) ? (r.claimScheme as ClaimSchemeChoice) : 'value_credit');
    setCnLinkGrnId(r.grnId || '');
  };

  const reopenClaim = (id: string) => {
    // Remove the mirrored supplier CN first so "CN received" stops counting it.
    supplierCreditNotes
      .filter((n) => (n.notes || '').includes(`Linked disposition ${id}`))
      .forEach((n) => deleteSupplierCreditNote(n.id));
    updateInventoryDisposition(id, {
      compensationStatus: 'pending',
      compensatedAmount: 0,
      compensatedAt: undefined,
      creditNoteNumber: undefined,
      creditNoteDate: undefined,
      cnTaxableValue: 0,
      cnCgst: 0,
      cnSgst: 0,
      cnIgst: 0,
      cnTotal: 0,
      compensationPayments: [],
    });
    setCompId(null);
    setMsg('Claim reopened and reset to pending');
    setTimeout(() => setMsg(null), 3000);
  };

  const confirmPhoneDecide = () => {
    if (!decideTarget || !decideTarget.returnTracking) return;
    const rt = decideTarget.returnTracking;
    if (decideChoice === 'company') {
      const sentDate = decideHandedDate || today();
      updateInventoryDisposition(decideTarget.id, {
        dispositionType: 'expiry_return',
        compensationStatus: decideTarget.compensationStatus === 'partial' ? 'partial' : 'pending',
        returnTracking: {
          ...rt,
          decision: 'company',
          stage: 'sent',
          sentOn: sentDate,
          sentRef: decideRef.trim() || rt.sentRef,
          log: [
            ...rt.log,
            {
              date: today(),
              stage: 'sent',
              note: `Handed to company on ${sentDate}${decideRef.trim() ? ` (${decideRef.trim()})` : ''}`,
            },
          ],
        },
      });
      notify('Sent to company claim created. Record credit note once received.');
    } else if (decideChoice === 'scrap') {
      updateInventoryDisposition(decideTarget.id, {
        dispositionType: 'expired_writeoff',
        compensationStatus: 'not_applicable',
        returnTracking: {
          ...rt,
          decision: 'discard',
          stage: 'discarded',
          discardedOn: today(),
          discardMethod: 'Scrapped — stock written off',
          log: [...rt.log, { date: today(), stage: 'discarded', note: 'Scrapped (stock written off)' }],
        },
      });
      notify(`Scrapped. ₹${money(decideTarget.costValue)} recorded as write-off.`);
    } else if (decideChoice === 'discard') {
      updateInventoryDisposition(decideTarget.id, {
        dispositionType: 'expired_writeoff',
        compensationStatus: 'not_applicable',
        returnTracking: {
          ...rt,
          decision: 'discard',
          stage: 'discarded',
          discardedOn: today(),
          discardMethod: 'Thrown out — disposed, no claim',
          log: [...rt.log, { date: today(), stage: 'discarded', note: 'Thrown out — no claim' }],
        },
      });
      notify(`Thrown out. ₹${money(decideTarget.costValue)} recorded as loss.`);
    } else {
      updateInventoryDisposition(decideTarget.id, {
        compensationStatus: 'not_applicable',
        returnTracking: {
          ...rt,
          decision: 'undecided',
          stage: 'held',
          log: [...rt.log, { date: today(), stage: 'held', note: 'Kept pending to decide later' }],
        },
      });
      notify('Kept pending under customer returns.');
    }
    setDecideTarget(null);
    setDecideRef('');
  };

  if (isPhone) {
    return (
      <DispositionsPhoneView
        msg={msg}
        filtered={filtered}
        inventoryDispositions={inventoryDispositions}
        warehouses={warehouses}
        warehouseFilter={warehouseFilter}
        setWhFilter={setWhFilter}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        showPhoneWhSheet={showPhoneWhSheet}
        setShowPhoneWhSheet={setShowPhoneWhSheet}
        showPhoneTypeSheet={showPhoneTypeSheet}
        setShowPhoneTypeSheet={setShowPhoneTypeSheet}
        expandedPhoneLedgerId={expandedPhoneLedgerId}
        setExpandedPhoneLedgerId={setExpandedPhoneLedgerId}
        decideTarget={decideTarget}
        setDecideTarget={setDecideTarget}
        decideChoice={decideChoice}
        setDecideChoice={setDecideChoice}
        decideHandedDate={decideHandedDate}
        setDecideHandedDate={setDecideHandedDate}
        setDecideRef={setDecideRef}
        confirmPhoneDecide={confirmPhoneDecide}
        openCnPanel={openCnPanel}
        orgProfile={orgProfile}
        deleteTarget={deleteTarget}
        setDeleteTarget={setDeleteTarget}
        deleteInventoryDisposition={deleteInventoryDisposition}
        showForm={showForm}
        setShowForm={setShowForm}
        warehouseId={warehouseId}
        setWarehouseId={setWarehouseId}
        productId={productId}
        setProductId={setProductId}
        batchId={batchId}
        setBatchId={setBatchId}
        productsInWarehouse={productsInWarehouse}
        batchesForSelection={batchesForSelection}
        quantity={quantity}
        setQuantity={setQuantity}
        eventDate={eventDate}
        setEventDate={setEventDate}
        dispositionType={dispositionType}
        setDispositionType={setDispositionType}
        reduceStock={reduceStock}
        setReduceStock={setReduceStock}
        supplierName={supplierName}
        setSupplierName={setSupplierName}
        setSupplierInvoiceNo={setSupplierInvoiceNo}
        grnId={grnId}
        setGrnId={setGrnId}
        grns={grns}
        distributedToName={distributedToName}
        setDistributedToName={setDistributedToName}
        notes={notes}
        setNotes={setNotes}
        phoneAttachment={phoneAttachment}
        setPhoneAttachment={setPhoneAttachment}
        referenceDocNo={referenceDocNo}
        setReferenceDocNo={setReferenceDocNo}
        handleSubmit={handleSubmit}
        compId={compId}
        setCompId={setCompId}
        cnNo={cnNo}
        setCnNo={setCnNo}
        cnDate={cnDate}
        setCnDate={setCnDate}
        cnLinkGrnId={cnLinkGrnId}
        setCnLinkGrnId={setCnLinkGrnId}
        cnScheme={cnScheme}
        setCnScheme={setCnScheme}
        cnTaxable={cnTaxable}
        setCnTaxable={setCnTaxable}
        cnCgst={cnCgst}
        cnSgst={cnSgst}
        cnIgst={cnIgst}
        compAmt={compAmt}
        setCompAmt={setCompAmt}
        submitCompensation={submitCompensation}
      />
    );
  }

  return (
    <div className="space-y-4">
      {msg && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm font-semibold">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {msg}
        </div>
      )}

      <div
        data-card-tone="warning"
        className="rounded-2xl border shadow-xs p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="hh-icon-badge hh-icon-badge--amber shrink-0">
            <FileWarning className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <h2 className="text-lg sm:text-2xl font-bold text-[#0A1F44] tracking-tight">Returns & Disposals</h2>
              <InfoTip title="Returns & disposals">
                <p>Everything that leaves stock without a normal customer sale: supplier returns, free near-expiry issues, expiry / damage write-offs and customer-returned crates sent back to the company.</p>
                <p>Each claim stays <strong>pending</strong> until you record the supplier’s credit note. Recorded credit notes also appear under Supplier credits → Claims, and always edit here, where the GST split and partial receipts are kept.</p>
              </InfoTip>
            </div>
            <p className="text-xs text-slate-500">
              Customer returns, company claims, credit notes & write-offs
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2 w-full sm:w-auto">
          <CustomerReturnLauncher className="w-full sm:w-auto min-h-[44px] justify-center px-3.5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-[0.99]" />
          <button
            type="button"
            onClick={() => {
              setShowForm(true);
              if (!warehouseId && warehouses[0]) setWarehouseId(warehouses[0].id);
            }}
            className="w-full sm:w-auto min-h-[44px] justify-center px-3.5 py-2.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-[0.99]"
          >
            <Plus className="w-4 h-4" /> New disposition
          </button>
        </div>
      </div>

      <CustomerReturnsList />

      <ExpiryReturnsTracker onRecordCn={openCnPanel} />

      {openClaims.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-950 space-y-2">
          <div>
            <strong className="font-black">{openClaims.length} open supplier claim(s)</strong>
            {' '}waiting for credit note or settlement. Select rows for multi-line CN or record per line.
          </div>
          {agedClaims.length > 0 && (
            <div className="flex items-start gap-2 text-rose-900 bg-rose-50 border border-rose-200 rounded-xl px-2.5 py-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                <strong>{agedClaims.length} claim(s) aged ≥ 30 days</strong>
                {agedClaims.slice(0, 3).map((x) => (
                  <span key={x.row.id} className="block">
                    · {x.row.productName || x.row.productId} · {x.days}d · {x.row.supplierName || '—'}
                  </span>
                ))}
                {agedClaims.length > 3 && <span className="block">· +{agedClaims.length - 3} more</span>}
              </span>
            </div>
          )}
          {selectedClaimIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold">{selectedClaimIds.length} selected</span>
              <button
                type="button"
                onClick={() => {
                  const sum = selectedClaims.reduce((s, r) => s + (Number(r.costValue) || 0), 0);
                  setMultiCnTotal(sum || '');
                  setShowMultiCn(true);
                }}
                className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-black text-xs cursor-pointer"
              >
                Record multi-line CN
              </button>
              <button
                type="button"
                onClick={() => printDispositionClaimVoucher(selectedClaims, orgProfile)}
                className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 font-bold text-xs cursor-pointer inline-flex items-center gap-1"
              >
                <Printer className="w-3 h-3" /> Print claim
              </button>
              <button
                type="button"
                onClick={() => setSelectedClaimIds([])}
                className="px-2.5 py-1 rounded-lg text-xs font-bold text-slate-600 cursor-pointer"
              >
                Clear selection
              </button>
            </div>
          )}
        </div>
      )}

      {freeGoodsPrompt && (
        <div className="rounded-2xl border border-sky-300 bg-sky-50 p-3.5 text-xs text-sky-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-start gap-2">
            <Gift className="w-4 h-4 shrink-0 text-sky-700" />
            <div>
              <strong className="font-black">Free goods / near-expiry swap on CN</strong>
              <p className="mt-0.5 font-medium">
                CN does not add stock. Receive free cases via Inward for{' '}
                {freeGoodsPrompt.productName || 'the product'}
                {freeGoodsPrompt.note ? ` (${freeGoodsPrompt.note})` : ''}.
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setFreeGoodsPrompt(null);
                setTab('inventory');
              }}
              className="px-3 py-1.5 rounded-lg bg-sky-600 text-white font-black text-xs cursor-pointer"
            >
              Open Inventory / Inward
            </button>
            <button
              type="button"
              onClick={() => setFreeGoodsPrompt(null)}
              className="px-3 py-1.5 rounded-lg border border-sky-300 font-bold text-xs cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Stock Disposals & Supplier Claims Ledger */}
      <DispositionsDesktopLedger
        inventoryDispositions={inventoryDispositions}
        ledgerStats={ledgerStats}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        search={search}
        setSearch={setSearch}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        warehouseFilter={warehouseFilter}
        setWarehouseFilter={setWarehouseFilter}
        warehouses={warehouses}
        filtered={filtered}
        products={products}
        selectedClaimIds={selectedClaimIds}
        toggleClaimSelect={toggleClaimSelect}
        setCompId={setCompId}
        setCnNo={setCnNo}
        setCnDate={setCnDate}
        setCnTaxable={setCnTaxable}
        setCnCgst={setCnCgst}
        setCnSgst={setCnSgst}
        setCnIgst={setCnIgst}
        setCompAmt={setCompAmt}
        setClaimVal={setClaimVal}
        setAppendPayment={setAppendPayment}
        setCnAttachment={setCnAttachment}
        openCnPanel={openCnPanel}
        updateInventoryDisposition={updateInventoryDisposition}
        setMsg={setMsg}
        orgProfile={orgProfile}
        setDeleteTarget={setDeleteTarget}
      />

      <DispositionsModals
        showForm={showForm}
        setShowForm={setShowForm}
        handleSubmit={handleSubmit}
        dispositionType={dispositionType}
        setDispositionType={setDispositionType}
        warehouseId={warehouseId}
        setWarehouseId={setWarehouseId}
        warehouses={warehouses}
        productId={productId}
        setProductId={setProductId}
        productsInWarehouse={productsInWarehouse}
        batchId={batchId}
        setBatchId={setBatchId}
        batchesForSelection={batchesForSelection}
        grns={grns}
        setGrnId={setGrnId}
        grnId={grnId}
        quantity={quantity}
        setQuantity={setQuantity}
        costPer={costPer}
        reduceStock={reduceStock}
        setReduceStock={setReduceStock}
        claimScheme={claimScheme}
        setClaimScheme={setClaimScheme}
        schemeBuyQty={schemeBuyQty}
        setSchemeBuyQty={setSchemeBuyQty}
        schemeFreeQty={schemeFreeQty}
        setSchemeFreeQty={setSchemeFreeQty}
        schemeDiscountPct={schemeDiscountPct}
        setSchemeDiscountPct={setSchemeDiscountPct}
        eventDate={eventDate}
        setEventDate={setEventDate}
        referenceDocNo={referenceDocNo}
        setReferenceDocNo={setReferenceDocNo}
        supplierName={supplierName}
        setSupplierName={setSupplierName}
        supplierInvoiceNo={supplierInvoiceNo}
        setSupplierInvoiceNo={setSupplierInvoiceNo}
        distributedToName={distributedToName}
        setDistributedToName={setDistributedToName}
        distributedToPhone={distributedToPhone}
        setDistributedToPhone={setDistributedToPhone}
        reason={reason}
        setReason={setReason}
        notes={notes}
        setNotes={setNotes}
        requireApproval={requireApproval}
        setRequireApproval={setRequireApproval}
        compId={compId}
        setCompId={setCompId}
        inventoryDispositions={inventoryDispositions}
        reopenClaim={reopenClaim}
        claimVal={claimVal}
        setClaimVal={setClaimVal}
        cnNo={cnNo}
        setCnNo={setCnNo}
        cnDate={cnDate}
        setCnDate={setCnDate}
        cnTaxable={cnTaxable}
        setCnTaxable={setCnTaxable}
        compAmt={compAmt}
        setCompAmt={setCompAmt}
        cnCgst={cnCgst}
        setCnCgst={setCnCgst}
        cnSgst={cnSgst}
        setCnSgst={setCnSgst}
        cnIgst={cnIgst}
        setCnIgst={setCnIgst}
        appendPayment={appendPayment}
        setAppendPayment={setAppendPayment}
        cnAttachment={cnAttachment}
        setCnAttachment={setCnAttachment}
        cnScheme={cnScheme}
        setCnScheme={setCnScheme}
        cnSchemeNote={cnSchemeNote}
        setCnSchemeNote={setCnSchemeNote}
        submitCompensation={submitCompensation}
        showMultiCn={showMultiCn}
        setShowMultiCn={setShowMultiCn}
        selectedClaims={selectedClaims}
        multiCnNo={multiCnNo}
        setMultiCnNo={setMultiCnNo}
        multiCnDate={multiCnDate}
        setMultiCnDate={setMultiCnDate}
        multiCnTotal={multiCnTotal}
        setMultiCnTotal={setMultiCnTotal}
        submitMultiCn={submitMultiCn}
      />

      <ConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteInventoryDisposition(deleteTarget.id, { restoreStock: deleteTarget.stockApplied });
          setDeleteTarget(null);
        }}
        title="Delete this disposition?"
        message={
          deleteTarget?.settled
            ? deleteTarget.stockApplied
              ? 'This claim is SETTLED with a credit note. Deleting removes the disposal, its linked supplier CN and returns the stock.'
              : 'This claim is SETTLED with a credit note. Deleting removes the record and its linked supplier CN (godown stock is unchanged).'
            : deleteTarget?.stockApplied
              ? 'The stock will return to inventory.'
              : 'This removes the document / customer-return tracking record without changing godown stock.'
        }
        confirmButtonLabel="Delete"
      />
    </div>
  );
};
