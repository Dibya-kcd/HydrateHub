import React, { useState, useEffect, useMemo } from 'react';
import { notify } from "../../utils/toast";
import {
  X,
  Trash2,
  Save,
  FileText,
  Split,
} from 'lucide-react';
import { Bill, BillItem, ExistingCustomer, PaletteTokens, PriceType, Product, Promotion, Trip, Warehouse } from '../../types';
import type { BillEditPreview } from '../../context/LedgerContext';
import { billTotals, issuedGstMode, isWholeRupee, computeLine,
  money, schemeLabel, statusOf, resolveProductGstRate, resolveProductHsn } from '../../utils/billing';
import { CustomerSelector } from './CustomerSelector';
import { ConfirmModal } from '../ui/ConfirmModal';
import { isNoOutputTaxBill } from '../../tax/appRegime';
import { todayISO } from "../../utils/dateLocal";
import { cartTaxMix, formatBillNumber, isGstExcludedBill } from '../../utils/invoiceCommon';
import { resolveTripGodownDisplay } from '../../utils/tripLoads';
import { buildEditBillImpactItems, rupees } from './editBillHelpers';
import { EditBillCustomerSection } from './editBill/EditBillCustomerSection';
import { EditBillImpactBanners } from './editBill/EditBillImpactBanners';
import { EditBillItemsSection } from './editBill/EditBillItemsSection';
import { EditBillSummarySection } from './editBill/EditBillSummarySection';

interface EditBillModalProps {
  bill: Bill | null;
  onClose: () => void;
  /** Return true when saved. The modal stays open (nothing is lost) when this returns false. */
  onSave: (updatedBill: Bill, opts: { comment: string; requestedPaid?: number }) => boolean | void;
  /** Split a mixed GST + Non-GST draft into a linked GST invoice (INV-) and Non-GST memo (NG-). */
  onSplitMixedBill?: (
    draftBill: Bill,
    opts: { comment: string; requestedPaid?: number },
  ) => { gstBill: Bill; nonGstBill: Bill } | null;
  /** Dry run: what changed, does it touch stock, what would block it. */
  previewEdit?: (bill: Bill, requestedPaid?: number) => BillEditPreview;
  /** Reopen the trip this bill was sold from (stock changes on closed trips need this). */
  onReopenTrip?: (tripId: number) => void;
  trips?: Trip[];
  onRequestDelete: (bill: Bill) => void;
  products: Product[];
  promotions: Promotion[];
  warehouses: Warehouse[];
  existingCustomers: ExistingCustomer[];
  gstMode: 'inclusive' | 'exclusive' | 'off';
  palette: PaletteTokens;
  invoicePrefix?: string;
  remainingStock: (productId: number) => number;
}

export const EditBillModal: React.FC<EditBillModalProps> = ({
  bill,
  onClose,
  onSave,
  onSplitMixedBill,
  previewEdit,
  onReopenTrip,
  trips,
  onRequestDelete,
  products,
  promotions,
  warehouses,
  existingCustomers,
  gstMode,
  palette,
  invoicePrefix = '',
  remainingStock,
}) => {
  // Form State initialized from the clicked bill
  const [retailer, setRetailer] = useState('');
  const [phone, setPhone] = useState('');
  const [date, setDate] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [items, setItems] = useState<BillItem[]>([]);
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [invoiceFormat, setInvoiceFormat] = useState<'gst' | 'non_gst'>('non_gst');
  const [customerGstin, setCustomerGstin] = useState('');
  const [ewayBillNo, setEwayBillNo] = useState('');
  const [irn, setIrn] = useState('');
  const [transporterName, setTransporterName] = useState('');
  const [transportDistanceKm, setTransportDistanceKm] = useState('');
  const [editComment, setEditComment] = useState('');
  const [saveError, setSaveError] = useState('');
  // The finished edit waiting for the user's "yes, save" (stock and payment effects are shown first).
  const [pendingBill, setPendingBill] = useState<Bill | null>(null);
  const [pendingAction, setPendingAction] = useState<'save' | 'split'>('save');

  // New item draft inside the modal (collapsed link by default to save mobile space)
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<number>(products[0]?.id || 0);
  const [draftPriceType, setDraftPriceType] = useState<PriceType>('Retail');
  const [draftQty, setDraftQty] = useState<number>(1);
  const [draftCustomRate, setDraftCustomRate] = useState<string>('');

  // Customer Selector Popup
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);

  // Pre-fill draft rate with base price when selected product or price type changes
  // (Depends on the price itself, not on the products array, which is a new array after every
  // background sync and used to wipe the rate you were typing.)
  const draftProduct = products.find((p) => p.id === selectedProductId);
  const draftBasePrice = draftProduct
    ? draftPriceType === 'Retail'
      ? draftProduct.retail
      : draftProduct.wholesale
    : undefined;
  useEffect(() => {
    if (!selectedProductId || !draftProduct) return;
    setDraftCustomRate(draftBasePrice ? String(draftBasePrice) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProductId, draftPriceType, draftBasePrice]);

  useEffect(() => {
    if (bill) {
      setRetailer(bill.retailer || '');
      setPhone(bill.phone || '');
      setDate(bill.date || todayISO());
      setWarehouseId(bill.warehouseId || '');
      setItems(bill.items ? JSON.parse(JSON.stringify(bill.items)) : []);
      setAmountPaid(bill.amountPaid || 0);
      const lockedNoTax = isNoOutputTaxBill(bill) || isGstExcludedBill(bill, products);
      const isGst = lockedNoTax
        ? false
        : bill.invoiceType === 'tax_invoice' || bill.isGstInvoice === true
          ? true
          : bill.invoiceType === 'retail' || bill.invoiceType === 'bill_of_supply' || bill.isGstInvoice === false
            ? false
            : bill.supplyType === 'B2B' && Boolean(bill.customerGstin);
      setInvoiceFormat(isGst ? 'gst' : 'non_gst');
      setCustomerGstin(bill.customerGstin || '');
      setEwayBillNo(bill.ewayBillNo || '');
      setIrn(bill.irn || '');
      setTransporterName(bill.transporterName || '');
      setTransportDistanceKm(bill.transportDistanceKm ? String(bill.transportDistanceKm) : '');
      setEditComment('');
      setSaveError('');
      setIsAddingProduct(false);
    }
  }, [bill?.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showCustomerPicker) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, showCustomerPicker]);

  const activePromoForProduct = (productId: number): Promotion | null => {
    return (
      promotions.find(
        (promo) => promo.type !== 'bundle' && promo.productIds?.includes(productId)
      ) || null
    );
  };

  // Recalculate an item when qty or rate or priceType or scheme changes
  const updateLineItem = (
    index: number,
    updates: {
      qty?: number;
      rate?: number;
      priceType?: PriceType;
      toggleScheme?: boolean;
    }
  ) => {
    setItems((prevItems) => {
      const next = [...prevItems];
      const item = next[index];
      if (!item) return prevItems;

      const product = products.find((p) => p.id === item.productId);
      const promo = activePromoForProduct(item.productId);

      const newPriceType = updates.priceType || item.priceType || 'Retail';
      let newRate = updates.rate !== undefined ? updates.rate : item.rate;

      // If priceType changed and user didn't explicitly override rate, update default rate
      if (updates.priceType && updates.rate === undefined && product) {
        newRate = newPriceType === 'Retail' ? product.retail : product.wholesale;
      }

      const newQty = updates.qty !== undefined ? Math.max(1, updates.qty) : item.qty;

      let isSchemeActive = !item.schemeSkipped;
      if (updates.toggleScheme !== undefined) {
        isSchemeActive = updates.toggleScheme;
      }

      const appliedPromo = isSchemeActive ? promo : null;
      const computed = product
        ? computeLine(product, newPriceType, newQty, appliedPromo, newRate)
        : {
            rate: newRate,
            gross: newQty * newRate,
            freeQty: 0,
            chargeableQty: newQty,
            discount: 0,
            amount: newQty * newRate,
          };

      const isLineNonGst = product?.taxability === 'non_gst' || item.taxability === 'non_gst';
      next[index] = {
        ...item,
        taxability: isLineNonGst ? 'non_gst' : (item.taxability || product?.taxability || 'taxable'),
        gst: isLineNonGst ? 0 : item.gst,
        qty: newQty,
        rate: newRate,
        priceType: newPriceType,
        gross: computed.gross,
        freeQty: computed.freeQty,
        chargeableQty: computed.chargeableQty,
        discount: computed.discount,
        amount: computed.amount,
        promoLabel: appliedPromo ? schemeLabel(appliedPromo) : null,
        schemeSkipped: !isSchemeActive,
      };

      return next;
    });
  };

  const removeLineItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const addDraftItem = () => {
    const product = products.find((p) => p.id === selectedProductId);
    if (!product) return;

    const baseRate = draftPriceType === 'Retail' ? product.retail : product.wholesale;
    const rate = draftCustomRate !== '' 
      ? Math.max(0, Number(draftCustomRate)) 
      : baseRate;
    const qty = Math.max(1, draftQty);

    const promo = activePromoForProduct(product.id);
    const computed = computeLine(product, draftPriceType, qty, promo, rate);
    const isNonGstProd = product.taxability === 'non_gst';

    const newItem: BillItem = {
      key: `${product.id}-${Date.now()}-${Math.random()}`,
      productId: product.id,
      productName: product.name,
      category: product.category,
      priceType: draftPriceType,
      qty,
      rate,
      gross: computed.gross,
      freeQty: computed.freeQty,
      chargeableQty: computed.chargeableQty,
      discount: computed.discount,
      amount: computed.amount,
      taxability: isNonGstProd ? 'non_gst' : 'taxable',
      gst: isNonGstProd ? 0 : resolveProductGstRate(product),
      promoLabel: promo ? schemeLabel(promo) : null,
      schemeSkipped: false,
      batchNumber: product.batchNumber,
      hsn: isNonGstProd ? String(product.hsn || '').trim() : resolveProductHsn(product),
      expiryDate: product.expiry,
      warehouseId: product.warehouseId,
    };

    setItems((prev) => [...prev, newItem]);
    setDraftQty(1);
    setDraftCustomRate('');
  };

  // Live Recalculated Financials
  // An edit must never change the invoice's money just because it was opened and saved:
  //  - the invoice-level (trade) discount saved on the bill is kept, and
  //  - the bill keeps the GST treatment it was issued with (the app-wide GST switch may have changed since).
  const keptExtraDiscount = Math.max(0, Number(bill?.additionalDiscount) || 0);
  const editGstMode: 'inclusive' | 'exclusive' | 'off' = useMemo(
    () => (bill ? issuedGstMode(bill, gstMode) : gstMode),
    [bill, gstMode],
  );
  const totals = useMemo(() => {
    // A bill issued without round-off stays unrounded, so opening and saving it changes nothing.
    return billTotals(items, editGstMode, keptExtraDiscount, { round: bill ? isWholeRupee(bill.total) : undefined });
  }, [items, editGstMode, keptExtraDiscount, bill]);

  const dueBalance = Math.max(0, totals.total - amountPaid);
  const status = statusOf(totals.total, amountPaid);

  const sourceTrip = useMemo(() => {
    if (!trips || !bill) return undefined;
    if (bill.tripId != null) {
      const byId = trips.find((t) => Number(t.id) === Number(bill.tripId));
      if (byId) return byId;
    }
    return trips.find(
      (t) => Array.isArray(t.billIds) && t.billIds.some((id) => Number(id) === Number(bill.id)),
    );
  }, [trips, bill]);

  // Draft of the bill as currently edited (used for the live stock-impact preview and for saving).
  const draftBill: Bill | null = bill
    ? {
        ...bill,
        retailer: retailer.trim(),
        phone: phone.trim(),
        date,
        // A bill sold from a trip / specific godown keeps it: an empty selection must not silently
        // move the sale to the default godown.
        warehouseId: sourceTrip || bill.tripId != null ? bill.warehouseId : warehouseId || bill.warehouseId,
        items,
        subtotal: totals.subtotal,
        cgst: totals.cgst,
        sgst: totals.sgst,
        total: totals.total,
        discount: totals.discount,
        amountPaid: Math.min(totals.total, Math.max(0, amountPaid)),
      }
    : null;
  const preview: BillEditPreview | null = useMemo(
    () => (draftBill && previewEdit ? previewEdit(draftBill, Math.max(0, amountPaid)) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bill?.id, retailer, phone, date, warehouseId, items, amountPaid, totals.total, trips],
  );
  const resolvedSourceTrip =
    sourceTrip ||
    (preview?.source.kind === 'trip' && trips && preview.source.tripId != null
      ? trips.find((t) => Number(t.id) === Number(preview.source.tripId))
      : undefined);
  const isTripBill = preview?.source.kind === 'trip' || Boolean(resolvedSourceTrip) || bill?.tripId != null;
  const tripGodown = useMemo(() => {
    if (!isTripBill) return null;
    return resolveTripGodownDisplay({
      trip: resolvedSourceTrip,
      bill,
      warehouses,
      includeLocation: true,
    });
  }, [isTripBill, resolvedSourceTrip, bill, warehouses]);
  const tripGodownLabel =
    tripGodown?.label ||
    preview?.source.warehouseLabel ||
    warehouses.find((w) => w.id === preview?.source.warehouseId)?.name ||
    '';
  const validWarehouseSelectValue = warehouses.some((w) => w.id === warehouseId) ? warehouseId : '';
  const blockedByStock = !!preview && preview.problems.length > 0;
  const draftTaxMix = useMemo(() => cartTaxMix(items, products), [items, products]);
  const hasReturns = Array.isArray(bill?.returns) && bill.returns.length > 0;
  const canSplitMixed = Boolean(onSplitMixedBill) && draftTaxMix.hasMixed && !hasReturns;
  const formatLocked =
    isNoOutputTaxBill(bill) ||
    draftTaxMix.allNonGst ||
    (!draftTaxMix.hasMixed && isGstExcludedBill(bill, products));
  const effectiveFormat: 'gst' | 'non_gst' = formatLocked ? 'non_gst' : invoiceFormat;

  if (!bill) return null;

  const buildUpdatedDraft = (): Bill | null => {
    if (!retailer.trim()) {
      notify('Please enter or select a retailer name.');
      return null;
    }
    if (items.length === 0) {
      notify('The bill must contain at least one product line item.');
      return null;
    }

    if (preview && preview.problems.length > 0) {
      setSaveError(preview.problems.join('\n'));
      return null;
    }

    const isPureNonGst = draftTaxMix.allNonGst;
    return {
      ...bill,
      id: bill.id,
      retailer: retailer.trim(),
      phone: phone.trim(),
      date,
      warehouseId: isTripBill ? bill.warehouseId : warehouseId || bill.warehouseId,
      items,
      subtotal: totals.subtotal,
      cgst: totals.cgst,
      sgst: totals.sgst,
      total: totals.total,
      discount: totals.discount,
      amountPaid: Math.min(totals.total, Math.max(0, amountPaid)),
      supplyType: formatLocked
        ? isPureNonGst
          ? 'B2C'
          : bill.supplyType
        : effectiveFormat === 'gst' && customerGstin.trim()
          ? 'B2B'
          : 'B2C',
      customerGstin: formatLocked
        ? isPureNonGst
          ? undefined
          : bill.customerGstin
        : effectiveFormat === 'gst' && customerGstin.trim()
          ? customerGstin.trim().toUpperCase()
          : undefined,
      invoiceType: formatLocked
        ? isPureNonGst || bill.invoiceType === 'bill_of_supply'
          ? 'bill_of_supply'
          : 'retail'
        : effectiveFormat === 'gst'
          ? 'tax_invoice'
          : 'retail',
      isGstInvoice: effectiveFormat === 'gst',
      docSeries:
        isPureNonGst || formatLocked || (!draftTaxMix.hasMixed && (bill.docSeries === 'non_gst' || bill.gstExclude))
          ? 'non_gst'
          : 'gst',
      gstExclude: Boolean(
        isPureNonGst || formatLocked || (!draftTaxMix.hasMixed && (bill.gstExclude || bill.docSeries === 'non_gst')),
      ),
      ewayBillNo: ewayBillNo.replace(/\D/g, '').slice(0, 12) || undefined,
      irn: irn.trim() || undefined,
      transporterName: transporterName.trim() || undefined,
      transportDistanceKm: Number(transportDistanceKm) > 0 ? Math.round(Number(transportDistanceKm)) : undefined,
    };
  };

  const handleSave = () => {
    const updatedBill = buildUpdatedDraft();
    if (!updatedBill) return;
    setSaveError('');
    if (canSplitMixed) {
      if (!editComment.trim()) {
        setEditComment('Split Non-GST items into separate NG- Cash Memo');
      }
      setPendingAction('split');
    } else {
      setPendingAction('save');
    }
    setPendingBill(updatedBill);
  };

  const handleRequestSplit = () => {
    const updatedBill = buildUpdatedDraft();
    if (!updatedBill) return;
    setSaveError('');
    if (!editComment.trim()) {
      setEditComment('Split Non-GST items into separate NG- Cash Memo');
    }
    setPendingAction('split');
    setPendingBill(updatedBill);
  };

  const confirmSave = (reason: string) => {
    if (!pendingBill) return;
    const comment = reason.trim();
    if (comment.length < 3) return;
    setEditComment(comment); // kept, so it is still there if the save is refused
    const toSave = pendingBill;
    const action = pendingAction;
    setPendingBill(null);
    if (action === 'split' && onSplitMixedBill) {
      const res = onSplitMixedBill(toSave, { comment, requestedPaid: Math.max(0, amountPaid) });
      if (!res) {
        setSaveError('Not split. Read the message shown on screen, fix it and try again. Your changes are still here.');
        return;
      }
      notify(
        `Split saved: ${formatBillNumber(res.gstBill, invoicePrefix)} (₹${money(res.gstBill.total)}) + ${formatBillNumber(res.nonGstBill, invoicePrefix)} (₹${money(res.nonGstBill.total)}).`,
        'success',
      );
      onClose();
      return;
    }
    // `requestedPaid` is what was typed before it was capped at the new total, so money received
    // above a lowered total is kept as an advance instead of being dropped.
    // Close only when the save really happened; otherwise keep the form so no edit is lost.
    const ok = onSave(toSave, { comment, requestedPaid: Math.max(0, amountPaid) });
    if (ok === false) {
      setSaveError('Not saved. Read the message shown on screen, fix it and press Save again. Your changes are still here.');
      return;
    }
    onClose();
  };

  const confirmImpact = buildEditBillImpactItems(preview);

  return (
    <>
    <div role="dialog" aria-modal="true" aria-label="Edit bill"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/65 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-xl shadow-2xl border-2 overflow-hidden bg-white text-stone-900 animate-in zoom-in-95 duration-150 my-auto"
        style={{
          borderColor: palette.navy,
          backgroundColor: palette.panel || '#ffffff',
          color: palette.ink,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Clean & Non-Redundant for Mobile */}
        <div
          className="px-4 py-3 flex items-center justify-between border-b shrink-0 bg-stone-50"
          style={{ borderColor: palette.line }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={18} className="text-amber-600 shrink-0" />
            <h2 className="font-extrabold text-sm sm:text-base text-stone-900 truncate tracking-tight">
              Edit Bill #{formatBillNumber(bill, invoicePrefix)}
            </h2>
            <span
              className="text-xs sm:text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider text-white shrink-0"
              style={{ backgroundColor: palette[status.balanceKey] }}
            >
              {status.label}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg border border-stone-200 text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors cursor-pointer shrink-0"
            style={{ color: palette.muted }}
            title="Close"
            aria-label="Close dialog"
            id="edit-modal-close-x"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {/* Customer & Bill Details Bar */}
          <EditBillCustomerSection
            bill={bill}
            retailer={retailer}
            setRetailer={setRetailer}
            phone={phone}
            setPhone={setPhone}
            date={date}
            setDate={setDate}
            validWarehouseSelectValue={validWarehouseSelectValue}
            setWarehouseId={setWarehouseId}
            warehouses={warehouses}
            existingCustomerCount={existingCustomers.length}
            onOpenCustomerPicker={() => setShowCustomerPicker(true)}
            isTripBill={isTripBill}
            tripGodownLabel={tripGodownLabel}
            preview={preview}
            resolvedSourceTrip={resolvedSourceTrip}
            formatLocked={formatLocked}
            effectiveFormat={effectiveFormat}
            setInvoiceFormat={setInvoiceFormat}
            customerGstin={customerGstin}
            setCustomerGstin={setCustomerGstin}
            ewayBillNo={ewayBillNo}
            setEwayBillNo={setEwayBillNo}
            transporterName={transporterName}
            setTransporterName={setTransporterName}
            irn={irn}
            setIrn={setIrn}
            transportDistanceKm={transportDistanceKm}
            setTransportDistanceKm={setTransportDistanceKm}
            palette={palette}
          />

          {/* Where this bill's stock came from + Mixed GST notice */}
          <EditBillImpactBanners
            preview={preview}
            blockedByStock={blockedByStock}
            resolvedSourceTrip={resolvedSourceTrip}
            onReopenTrip={onReopenTrip}
            setSaveError={setSaveError}
            draftTaxMix={draftTaxMix}
            canSplitMixed={canSplitMixed}
            hasReturns={hasReturns}
            onRequestSplit={handleRequestSplit}
            palette={palette}
          />

          {/* Line Items Table with Inline Quantity & Price Editing */}
          <EditBillItemsSection
            items={items}
            products={products}
            palette={palette}
            activePromoForProduct={activePromoForProduct}
            updateLineItem={updateLineItem}
            removeLineItem={removeLineItem}
            isAddingProduct={isAddingProduct}
            setIsAddingProduct={setIsAddingProduct}
            selectedProductId={selectedProductId}
            setSelectedProductId={setSelectedProductId}
            draftPriceType={draftPriceType}
            setDraftPriceType={setDraftPriceType}
            draftQty={draftQty}
            setDraftQty={setDraftQty}
            draftCustomRate={draftCustomRate}
            setDraftCustomRate={setDraftCustomRate}
            draftProduct={draftProduct}
            addDraftItem={addDraftItem}
            remainingStock={remainingStock}
          />

          {/* Financial Summary & Payment Settlement */}
          <EditBillSummarySection
            totals={totals}
            keptExtraDiscount={keptExtraDiscount}
            editGstMode={editGstMode}
            amountPaid={amountPaid}
            setAmountPaid={setAmountPaid}
            dueBalance={dueBalance}
            status={status}
            palette={palette}
          />

          {/* Edit history (scrolls with the bill; the reason for a NEW edit is asked in the save popup) */}
          {bill.editHistory && bill.editHistory.length > 0 && (
            <details className="text-xs rounded-xl border px-3 py-2" style={{ borderColor: palette.line }}>
              <summary className="cursor-pointer font-bold opacity-75">
                Edit history ({bill.editHistory.length})
              </summary>
              <ul className="mt-2 space-y-1.5">
                {[...bill.editHistory].reverse().map((h, i) => (
                  <li key={i} className="border-l-2 pl-2" style={{ borderColor: palette.line }}>
                    <b>{new Date(h.at).toLocaleString('en-IN')}</b> · {h.by} · “{h.comment}”
                    {h.changes.length > 0 && <div className="opacity-70">{h.changes.join('; ')}</div>}
                    {h.stockChanged && <div className="text-amber-700">Stock was adjusted</div>}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>

        {saveError && (
          <p
            className="px-5 py-2 border-t shrink-0 text-xs text-red-600 font-semibold whitespace-pre-line max-h-24 overflow-y-auto"
            style={{ borderColor: palette.line }}
            id="edit-modal-save-error"
          >
            {saveError}
          </p>
        )}

        {/* Footer Actions - Cancel replaced with Delete Bill per mobile-first request */}
        <div
          className="px-4 sm:px-5 py-3 bg-stone-50 border-t flex items-center justify-between gap-2.5 shrink-0"
          style={{ borderColor: palette.line, backgroundColor: palette.cream }}
        >
          <button
            type="button"
            onClick={() => onRequestDelete(bill)}
            className="px-3.5 py-2.5 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs shrink-0"
            id="edit-modal-footer-delete-btn"
            title="Delete this bill"
          >
            <Trash2 size={16} className="text-rose-600" />
            <span>Delete</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={blockedByStock}
            className="flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-black text-white shadow-md hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            style={{ backgroundColor: canSplitMixed ? '#b45309' : palette.good }}
            id="edit-modal-save-btn"
          >
            {canSplitMixed ? <Split size={16} /> : <Save size={16} />}
            <span>{canSplitMixed ? 'Save & Split into INV + NG- Memo' : 'Save Changes & Update Bill'}</span>
          </button>
        </div>
      </div>

      {/* Customer Selector Modal (if triggered from within the edit modal) */}
      {showCustomerPicker && (
        <CustomerSelector
          customers={existingCustomers}
          currentRetailer={retailer}
          palette={palette}
          scale={1}
          onClose={() => setShowCustomerPicker(false)}
          onSelect={(c) => {
            setRetailer(c.name);
            if (c.phone) setPhone(c.phone);
            setShowCustomerPicker(false);
          }}
        />
      )}
    </div>
    {pendingBill && (
      <ConfirmModal
        isOpen
        title={
          pendingAction === 'split'
            ? `Split Bill #${formatBillNumber(bill, invoicePrefix)} into INV + NG- Memo?`
            : `Save changes to Bill #${formatBillNumber(bill, invoicePrefix)}?`
        }
        subtitle={
          pendingAction === 'split'
            ? 'GST items stay on the GST invoice; Non-GST items move to a linked NG- Cash Memo. Stock, trip, and total payments stay balanced.'
            : "Check the impact, then add a reason. It is saved in the bill's edit history."
        }
        warningNote={
          pendingAction === 'split'
            ? 'Non-GST items will appear under Non-GST memos (NG-) in Reports > Sales and stay excluded from GST returns.'
            : preview?.payment.keptAsAdvance || preview?.payment.removedAsCorrection || preview?.stockChanged
              ? 'This edit moves stock and/or money.'
              : undefined
        }
        impactItems={
          pendingAction === 'split'
            ? [
                {
                  label: `GST items (${draftTaxMix.taxable.length}) stay on GST invoice`,
                  detail: draftTaxMix.taxable.map((it) => it.productName).join(', '),
                  qtyChange: rupees(draftTaxMix.taxable.reduce((s, it) => s + (Number(it.amount) || 0), 0)),
                },
                {
                  label: `Non-GST items (${draftTaxMix.nonGst.length}) move to linked NG- Cash Memo`,
                  detail: draftTaxMix.nonGst.map((it) => it.productName).join(', '),
                  qtyChange: rupees(draftTaxMix.nonGst.reduce((s, it) => s + (Number(it.amount) || 0), 0)),
                },
                ...confirmImpact,
              ]
            : confirmImpact
        }
        confirmButtonLabel={pendingAction === 'split' ? 'Split & Save Bills' : 'Save Changes'}
        variant={pendingAction === 'split' ? 'primary' : 'warning'}
        confirmIcon={pendingAction === 'split' ? <Split className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
        rectificationPrompt="Reason / comment for this edit *"
        rectificationPlaceholder="e.g. Corrected rate/qty, customer change, or split Non-GST item"
        reasonPresets={['Corrected rate/qty', 'Split Non-GST memo', 'Customer change', 'Discount adjustment']}
        initialComment={editComment}
        commentMinLength={4}
        onConfirm={() => {}}
        onConfirmWithComment={confirmSave}
        onClose={() => setPendingBill(null)}
      />
    )}
    </>
  );
};
