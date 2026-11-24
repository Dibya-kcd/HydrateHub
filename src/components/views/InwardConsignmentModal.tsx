import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Download, X } from 'lucide-react';
import { CATS } from '../../constants/initialData';
import { useLedger } from '../../context/LedgerContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import { CategoryKey, GRN, GrnLineItem, Taxability } from '../../types';
import {
  calculateLandedCostBreakdown,
  generateAutoSku,
  generateBatchNumber,
  normalizeTo8DigitHsn,
  resolveProductGstRate,
} from '../../utils/billing';
import { todayISO } from '../../utils/dateLocal';
import { downloadSingleGrnCsv } from '../../utils/grnCsvExport';
import { notify } from '../../utils/toast';
import { validatePhone } from '../../utils/validation';
import { InwardDesktopHeaderCard } from './inward/InwardDesktopHeaderCard';
import { InwardLineItemForm } from './inward/InwardLineItemForm';
import { InwardPhoneFlow } from './inward/InwardPhoneFlow';
import { InwardReviewTable } from './inward/InwardReviewTable';
import {
  createDraftFromProduct,
  defaultLineState,
  DraftLineState,
  InwardConsignmentModalProps,
  KnownSupplier,
} from './inward/inwardTypes';

export const InwardConsignmentModal: React.FC<InwardConsignmentModalProps> = ({
  isOpen,
  onClose,
  preselectedWarehouseId,
  preselectedProductId,
  initialGrnToEdit,
  onOpenBulkImport,
  onSaved,
}) => {
  const isPhone = useIsMobile(1023);
  const {
    products,
    warehouses,
    grns,
    postGrn,
    updateGrn,
    palette,
    fz,
    supplierSchemes,
    addSupplierSchemeApplication,
    addSupplierCreditNote,
  } = useLedger();

  // Header State
  const [supplierName, setSupplierName] = useState(initialGrnToEdit?.supplierName || '');
  const [supplierGstin, setSupplierGstin] = useState(initialGrnToEdit?.supplierGstin || '');
  const [supplierAddress, setSupplierAddress] = useState(initialGrnToEdit?.supplierAddress || '');
  const [supplierPhone, setSupplierPhone] = useState(initialGrnToEdit?.supplierPhone || '');
  const [supplierEmail, setSupplierEmail] = useState(initialGrnToEdit?.supplierEmail || '');
  const [invoiceNo, setInvoiceNo] = useState(initialGrnToEdit?.invoiceNo || '');
  const [inwardDate, setInwardDate] = useState(initialGrnToEdit?.inwardDate || todayISO());
  const [vehicleNo, setVehicleNo] = useState(initialGrnToEdit?.vehicleNo || '');
  const [placeOfSupply, setPlaceOfSupply] = useState(initialGrnToEdit?.placeOfSupply || 'Odisha (21)');
  const [billedTo, setBilledTo] = useState(initialGrnToEdit?.billedTo || '');
  const [shippedTo, setShippedTo] = useState(initialGrnToEdit?.shippedTo || '');
  const [showProviderFields, setShowProviderFields] = useState(false);

  // Manual Inward Costs (Freight, Labour, Other) — automatically distributed across landed cost
  const [freightCost, setFreightCost] = useState<number>(initialGrnToEdit?.inwardCosts?.freight || 0);
  const [labourCost, setLabourCost] = useState<number>(
    (initialGrnToEdit?.inwardCosts?.loadingLabour || 0) +
      (initialGrnToEdit?.inwardCosts?.unloadingLabour || 0)
  );
  const [otherInwardCost, setOtherInwardCost] = useState<number>(
    (initialGrnToEdit?.inwardCosts?.transport || 0) +
      (initialGrnToEdit?.inwardCosts?.otherInwardCosts || 0)
  );
  const [showMoreInwardCosts, setShowMoreInwardCosts] = useState(false);

  const [targetWarehouseId, setTargetWarehouseId] = useState(
    initialGrnToEdit?.warehouseId || preselectedWarehouseId || ''
  );
  const [notes, setNotes] = useState(initialGrnToEdit?.notes || '');

  // Review Table state: Nothing touches stock until confirmed
  const [reviewItems, setReviewItems] = useState<GrnLineItem[]>(initialGrnToEdit?.items || []);

  // Known suppliers lookup (from past GRNs + supplier directory cache)
  const knownSuppliers = useMemo(() => {
    const map = new Map<string, KnownSupplier>();
    try {
      const raw = localStorage.getItem('mrwater_cache_suppliers_master');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const s of parsed) {
            const key = String(s?.name || '').trim().toLowerCase();
            if (key) {
              map.set(key, {
                name: String(s.name).trim(),
                phone: s.phone || '',
                gstin: s.gstin || '',
                address: s.address || '',
                email: s.email || '',
              });
            }
          }
        }
      }
    } catch { /* ignore storage errors */ }
    for (const g of grns || []) {
      const key = String(g.supplierName || '').trim().toLowerCase();
      if (!key) continue;
      const existing = map.get(key);
      map.set(key, {
        name: existing?.name || g.supplierName.trim(),
        phone: existing?.phone || g.supplierPhone || '',
        gstin: existing?.gstin || g.supplierGstin || '',
        address: existing?.address || g.supplierAddress || '',
        email: existing?.email || g.supplierEmail || '',
      });
    }
    return Array.from(map.values());
  }, [grns]);

  const applySupplierAutofill = (nameVal: string) => {
    const clean = nameVal.trim().toLowerCase();
    if (!clean) return;
    const match = knownSuppliers.find((s) => s.name.toLowerCase() === clean);
    if (!match) return;
    if (!supplierPhone.trim() && match.phone) setSupplierPhone(match.phone);
    if (!supplierGstin.trim() && match.gstin) setSupplierGstin(match.gstin);
    if (!supplierAddress.trim() && match.address) setSupplierAddress(match.address);
    if (!supplierEmail.trim() && match.email) setSupplierEmail(match.email);
  };

  // Draft entry line
  const [draftLine, setDraftLine] = useState<DraftLineState>(() => {
    if (preselectedProductId) {
      const p = products.find((x) => x.id === preselectedProductId);
      if (p) return createDraftFromProduct(p);
    }
    return defaultLineState('energy');
  });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(!initialGrnToEdit);
  const lineFormRef = useRef<HTMLDivElement>(null);
  const [phoneStep, setPhoneStep] = useState<1 | 2 | 3>(1);
  const [phoneStepError, setPhoneStepError] = useState<string | null>(null);
  const [showPhoneCatalogSheet, setShowPhoneCatalogSheet] = useState(false);
  const [phoneCatalogSearch, setPhoneCatalogSearch] = useState('');
  const [phonePrintedTotal, setPhonePrintedTotal] = useState<string>('');
  const [phoneNewProductMode, setPhoneNewProductMode] = useState(false);

  // Sync state when the GRN being edited (or the preselected product) changes.
  const productsRef = useRef(products);
  productsRef.current = products;
  const grnSyncKey = `${isOpen ? 'open' : 'closed'}|${initialGrnToEdit?.id ?? ''}|${preselectedProductId ?? ''}`;
  const lastGrnSyncKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isOpen) {
      lastGrnSyncKeyRef.current = null;
      return;
    }
    if (lastGrnSyncKeyRef.current === grnSyncKey) return;
    lastGrnSyncKeyRef.current = grnSyncKey;
    setPhoneStep(1);
    setPhoneStepError(null);
    setPhonePrintedTotal('');
    const prods = productsRef.current;
    if (initialGrnToEdit) {
      setSupplierName(initialGrnToEdit.supplierName);
      setSupplierGstin(initialGrnToEdit.supplierGstin || '');
      setSupplierAddress(initialGrnToEdit.supplierAddress || '');
      setSupplierPhone(initialGrnToEdit.supplierPhone || '');
      setSupplierEmail(initialGrnToEdit.supplierEmail || '');
      setInvoiceNo(initialGrnToEdit.invoiceNo);
      setInwardDate(initialGrnToEdit.inwardDate);
      setVehicleNo(initialGrnToEdit.vehicleNo || '');
      setPlaceOfSupply(initialGrnToEdit.placeOfSupply || '');
      setBilledTo(initialGrnToEdit.billedTo || '');
      setShippedTo(initialGrnToEdit.shippedTo || '');
      setFreightCost(initialGrnToEdit.inwardCosts?.freight || 0);
      setLabourCost(
        (initialGrnToEdit.inwardCosts?.loadingLabour || 0) +
          (initialGrnToEdit.inwardCosts?.unloadingLabour || 0)
      );
      setOtherInwardCost(
        (initialGrnToEdit.inwardCosts?.transport || 0) +
          (initialGrnToEdit.inwardCosts?.otherInwardCosts || 0)
      );
      setTargetWarehouseId(initialGrnToEdit.warehouseId || (warehouses[0]?.id ?? ''));
      setNotes(initialGrnToEdit.notes || '');
      setReviewItems(initialGrnToEdit.items || []);
      setEditingIndex(null);
      setShowAddForm(false);
    } else if (preselectedProductId) {
      const p = prods.find((x) => x.id === preselectedProductId);
      if (p) setDraftLine(createDraftFromProduct(p));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grnSyncKey]);

  // Check matching existing product
  const matchingProduct = useMemo(() => {
    if (!draftLine.isNewProduct && draftLine.selectedProductId) {
      return products.find((p) => p.id === draftLine.selectedProductId);
    }
    if (draftLine.isNewProduct && draftLine.productName.trim()) {
      return products.find(
        (p) => p.name.trim().toLowerCase() === draftLine.productName.trim().toLowerCase()
      );
    }
    return undefined;
  }, [draftLine, products]);

  // Check similar existing product to prevent accidental duplicate additions
  const similarProduct = useMemo(() => {
    if (!draftLine.isNewProduct || !draftLine.productName.trim() || matchingProduct) {
      return undefined;
    }
    const cleanDraft = draftLine.productName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanDraft.length < 3) return undefined;

    return products.find((p) => {
      const cleanP = p.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      return cleanDraft.includes(cleanP) || cleanP.includes(cleanDraft);
    });
  }, [draftLine, products, matchingProduct]);

  const [lineValidationError, setLineValidationError] = useState<string | null>(null);

  // Live Auto SKU Preview
  const computedSku = useMemo(() => {
    if (!draftLine.isNewProduct && draftLine.selectedProductId) {
      const ep = products.find((p) => p.id === draftLine.selectedProductId);
      return ep?.sku || generateAutoSku(ep?.name || '', draftLine.category, ep?.id || 1);
    }
    if (matchingProduct) {
      return matchingProduct.sku;
    }
    const tentativeName = draftLine.productName.trim() || 'NEW BEVERAGE';
    return generateAutoSku(tentativeName, draftLine.category, products.length + 1);
  }, [draftLine, products, matchingProduct]);

  const totalInwardCost = useMemo(
    () =>
      Math.max(0, Number(freightCost) || 0) +
      Math.max(0, Number(labourCost) || 0) +
      Math.max(0, Number(otherInwardCost) || 0),
    [freightCost, labourCost, otherInwardCost]
  );

  // Raw draft breakdown without inward allocation first to get draft received qty
  const draftReceivedQty = useMemo(() => {
    const mode = draftLine.schemeMode || 'inclusive';
    let freeQty = 0;
    if (draftLine.schemeType === 'b2g1') {
      const buyQty = Math.max(1, draftLine.schemeBuyQty);
      const freePerBuy = Math.max(1, draftLine.schemeFreeQty);
      if (draftLine.freeQty !== undefined && draftLine.freeQty !== null && Number(draftLine.freeQty) >= 0) {
        freeQty = Math.max(0, Number(draftLine.freeQty));
      } else {
        const cycle = mode === 'inclusive' ? buyQty + freePerBuy : buyQty;
        freeQty = cycle > 0 ? Math.floor(draftLine.qty / cycle) * freePerBuy : 0;
      }
    } else if (draftLine.schemeType === 'free_cases') {
      freeQty = Math.max(0, Number(draftLine.freeQty ?? draftLine.schemeFreeQty) || 0);
    }
    return mode === 'additive' ? draftLine.qty + freeQty : draftLine.qty;
  }, [draftLine]);

  // Existing review cases
  const reviewCasesTotal = useMemo(
    () =>
      reviewItems.reduce(
        (s, item) =>
          s + (Number(item.totalReceivedQty) || (item.schemeMode === 'additive' ? (Number(item.qty) || 0) + (Number(item.freeQty) || 0) : Number(item.qty) || 0)),
        0
      ),
    [reviewItems]
  );

  // Per-case inward cost for live review items & draft preview
  const reviewInwardCostPerCrate = reviewCasesTotal > 0 ? totalInwardCost / reviewCasesTotal : 0;
  const draftPreviewCases = useMemo(() => {
    if (editingIndex !== null && reviewItems[editingIndex]) {
      const oldRec = Number(reviewItems[editingIndex].totalReceivedQty) || Number(reviewItems[editingIndex].qty) || 0;
      return Math.max(1, reviewCasesTotal - oldRec + draftReceivedQty);
    }
    return Math.max(1, reviewCasesTotal + draftReceivedQty);
  }, [editingIndex, reviewItems, reviewCasesTotal, draftReceivedQty]);
  const draftPreviewInwardPerCrate = draftPreviewCases > 0 ? totalInwardCost / draftPreviewCases : 0;

  // Line metrics calculation (supports Non-GST, GST Included/Excluded rate, and live Freight+Labour landed cost)
  const metrics = useMemo(() => {
    let freeQty = 0;
    const mode = draftLine.schemeMode || 'inclusive';
    const isNonGst = draftLine.taxability === 'non_gst';

    if (draftLine.schemeType === 'b2g1') {
      const buyQty = Math.max(1, draftLine.schemeBuyQty);
      const freePerBuy = Math.max(1, draftLine.schemeFreeQty);
      if (draftLine.freeQty !== undefined && draftLine.freeQty !== null && Number(draftLine.freeQty) >= 0) {
        freeQty = Math.max(0, Number(draftLine.freeQty));
      } else {
        const cycle = mode === 'inclusive' ? buyQty + freePerBuy : buyQty;
        freeQty = cycle > 0 ? Math.floor(draftLine.qty / cycle) * freePerBuy : 0;
      }
    } else if (draftLine.schemeType === 'free_cases') {
      freeQty = Math.max(0, Number(draftLine.freeQty ?? draftLine.schemeFreeQty) || 0);
    }

    const cg = isNonGst ? 0 : draftLine.cgstPercent;
    const sg = isNonGst ? 0 : draftLine.sgstPercent;
    const taxFrac = (cg + sg) / 100;
    const exGstRate =
      !isNonGst && draftLine.isGstIncluded && taxFrac > 0
        ? Math.round((draftLine.unitPrice / (1 + taxFrac)) * 100) / 100
        : draftLine.unitPrice;

    const breakdown = calculateLandedCostBreakdown({
      qty: draftLine.qty,
      unitPrice: exGstRate,
      unitsPerCrate: draftLine.unitsPerCrate || 24,
      pack: draftLine.pack,
      volume: draftLine.volume,
      cgstPercent: cg,
      sgstPercent: sg,
      schemeType: draftLine.schemeType,
      schemeMode: mode,
      schemeBuyQty: draftLine.schemeBuyQty,
      schemeFreeQty: draftLine.schemeFreeQty,
      freeQty,
      discountPercent: draftLine.schemeDiscountPercent,
      discountFlat: draftLine.schemeFlatDiscountPerCase,
      inwardCostPerCrate: draftPreviewInwardPerCrate,
    });

    return {
      exGstRate,
      discountAmount: breakdown.discountAmount,
      taxableAmount: breakdown.taxableAmount,
      cgstAmount: breakdown.cgstAmount,
      sgstAmount: breakdown.sgstAmount,
      taxAmount: breakdown.taxAmount,
      lineTotal: breakdown.lineTotal,
      paidQty: breakdown.paidQty,
      freeQty: breakdown.freeQty,
      totalReceivedQty: breakdown.totalReceivedQty,
      landedCostPerCrate: breakdown.landedCostPerCrate,
      landedCostPerCrateExGst: breakdown.landedCostPerCrateExGst,
      landedCostPerBottle: breakdown.landedCostPerUnit,
      effectiveCostPerCrateExGst: breakdown.effectiveCostPerCrateExGst,
      effectiveCostPerCrateInclGst: breakdown.effectiveCostPerCrateInclGst,
      effectiveCostPerUnit: breakdown.effectiveCostPerCrateExGst,
    };
  }, [draftLine, draftPreviewInwardPerCrate]);

  // Review items with live inward cost (Freight + Labour + Other) allocated across cases
  const resolvedReviewItems = useMemo(() => {
    const roundedInward = Math.round(reviewInwardCostPerCrate * 100) / 100;
    const labourPerCase = reviewCasesTotal > 0 ? Math.round((labourCost / reviewCasesTotal) * 100) / 100 : 0;
    const freightPerCase = reviewCasesTotal > 0 ? Math.round((freightCost / reviewCasesTotal) * 100) / 100 : 0;
    return reviewItems.map((item) => {
      const isNonGst = item.taxability === 'non_gst';
      const cg = isNonGst ? 0 : Number(item.cgstPercent) || 0;
      const sg = isNonGst ? 0 : Number(item.sgstPercent) || 0;
      const b = calculateLandedCostBreakdown({
        qty: item.qty,
        unitPrice: item.unitPrice,
        unitsPerCrate: item.unitsPerCrate || 24,
        pack: item.pack,
        volume: item.volume,
        cgstPercent: cg,
        sgstPercent: sg,
        schemeType: item.schemeType,
        schemeMode: item.schemeMode,
        schemeBuyQty: item.schemeBuyQty,
        schemeFreeQty: item.schemeFreeQty,
        freeQty: item.freeQty,
        paidQty: item.paidQty,
        discountPercent: item.discountPercent,
        discountFlat: item.discountFlat,
        discountAmount: item.discountAmount,
        inwardCostPerCrate: reviewInwardCostPerCrate,
      });
      return {
        ...item,
        taxability: (isNonGst ? 'non_gst' : item.taxability || 'taxable') as Taxability,
        cgstPercent: cg,
        sgstPercent: sg,
        hsn: isNonGst ? (item.hsn || '').trim() : item.hsn,
        inwardCostPerCrate: roundedInward,
        labourCost: labourPerCase,
        freightCost: freightPerCase,
        effectiveCostPerCrateExGst: b.effectiveCostPerCrateExGst,
        effectiveCostPerCrateInclGst: b.effectiveCostPerCrateInclGst,
        effectiveCostPerUnit: b.effectiveCostPerCrateExGst,
        landedCostPerCrate: b.landedCostPerCrate,
        landedCostPerCrateExGst: b.landedCostPerCrateExGst,
        landedCostPerUnit: b.landedCostPerUnit,
      };
    });
  }, [reviewItems, reviewInwardCostPerCrate, reviewCasesTotal, labourCost, freightCost]);

  // Totals for the review table
  const totals = useMemo(() => {
    let billed = 0;
    let free = 0;
    let paid = 0;
    let totalCases = 0;
    let taxable = 0;
    let cgst = 0;
    let sgst = 0;
    let savings = 0;
    let grand = 0;

    for (const item of resolvedReviewItems) {
      const bld = Number(item.qty) || 0;
      const fr = Number(item.freeQty) || 0;
      const rec = Number(item.totalReceivedQty) || (item.schemeMode === 'additive' ? bld + fr : bld);
      const pd = item.paidQty !== undefined ? Number(item.paidQty) : Math.max(0, bld - fr);

      billed += bld;
      free += fr;
      paid += pd;
      totalCases += rec;
      taxable += Number(item.taxableAmount) || 0;
      cgst += Number(item.cgstAmount) || 0;
      sgst += Number(item.sgstAmount) || 0;
      savings += Number(item.discountAmount) || 0;
      grand += Number(item.lineTotal) || 0;
    }

    return {
      billed,
      free,
      paid,
      totalCases,
      taxable,
      cgst,
      sgst,
      savings,
      grand,
    };
  }, [resolvedReviewItems]);

  const phoneError = useMemo(
    () => (supplierPhone.trim() ? validatePhone(supplierPhone, { label: 'Supplier phone' }) : null),
    [supplierPhone]
  );

  if (!isOpen) return null;

  const handleCategoryChange = (cat: CategoryKey) => {
    const catDef = CATS[cat];
    let half = 10;
    if (cat === 'joos') half = 2.5;
    else if (cat === 'water') half = 9;
    else if (catDef) half = Math.round(((catDef.gst * 100) / 2) * 10) / 10;

    setDraftLine((prev) => {
      const isNonGst = prev.taxability === 'non_gst';
      return {
        ...prev,
        category: cat,
        hsn: isNonGst ? prev.hsn : normalizeTo8DigitHsn(catDef?.hsn, cat, prev.productName, prev.taxability),
        cgstPercent: isNonGst ? 0 : half,
        sgstPercent: isNonGst ? 0 : half,
      };
    });
  };

  const handleSelectExisting = (prodId: number) => {
    const p = products.find((x) => x.id === prodId);
    if (!p) return;
    const isNonGst = p.taxability === 'non_gst';
    const frac = isNonGst ? 0 : resolveProductGstRate(p);
    const halfTax = isNonGst ? 0 : Math.round(((frac * 100) / 2) * 10) / 10;

    setDraftLine((prev) => ({
      ...prev,
      isNewProduct: false,
      selectedProductId: prodId,
      productName: p.name,
      category: p.category,
      taxability: isNonGst ? 'non_gst' : 'taxable',
      hsn: normalizeTo8DigitHsn(
        p.hsn || (isNonGst ? '' : CATS[p.category]?.hsn),
        p.category,
        p.name,
        p.taxability
      ),
      pack: p.pack || 'PET',
      volume: p.volume || 150,
      unitsPerCrate: p.unitsPerCrate || 24,
      unitPrice: p.cost,
      isGstIncluded: !isNonGst && !!p.ratesIncludeGst,
      wholesaleRate: p.wholesale,
      retailRate: p.retail,
      cgstPercent: halfTax,
      sgstPercent: halfTax,
      expiry: p.expiry || '',
    }));
  };

  const handleAddDraftToReview = () => {
    setLineValidationError(null);
    const effectiveName = (draftLine.isNewProduct
      ? draftLine.productName.trim()
      : draftLine.productName).toUpperCase();

    if (!effectiveName) {
      setLineValidationError('Please enter or select a beverage product description.');
      return;
    }
    if (draftLine.qty <= 0) {
      setLineValidationError('Billed quantity must be at least 1 case.');
      return;
    }

    let schemeLabelText = '';
    const isInc = draftLine.schemeMode === 'inclusive';
    if (draftLine.schemeType === 'b2g1') {
      schemeLabelText = isInc
        ? `Buy ${draftLine.schemeBuyQty} Get ${draftLine.schemeFreeQty} Free (${metrics.freeQty} Free of ${draftLine.qty} cs · ${metrics.paidQty} Paid · Incl.)`
        : `Buy ${draftLine.schemeBuyQty} Get ${draftLine.schemeFreeQty} Free (+${metrics.freeQty} Bonus · ${metrics.totalReceivedQty} cs Total)`;
    } else if (draftLine.schemeType === 'free_cases') {
      schemeLabelText = isInc
        ? `${metrics.freeQty} Free Crates included in ${draftLine.qty} cs (${metrics.paidQty} Paid)`
        : `+${metrics.freeQty} Extra Free Crates on top of ${draftLine.qty} cs (${metrics.totalReceivedQty} Total)`;
    } else if (draftLine.schemeType === 'discount_percent') {
      schemeLabelText = `${draftLine.schemeDiscountPercent}% Discount`;
    } else if (draftLine.schemeType === 'discount_flat') {
      schemeLabelText = `₹${draftLine.schemeFlatDiscountPerCase}/case Off`;
    }

    const freeCasesCalculated = metrics.freeQty;
    const isNonGst = draftLine.taxability === 'non_gst';

    const item: GrnLineItem = {
      id:
        editingIndex !== null && reviewItems[editingIndex]
          ? reviewItems[editingIndex].id
          : 'item_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      isNewProduct: draftLine.isNewProduct,
      productId: matchingProduct?.id || draftLine.selectedProductId,
      productName: effectiveName,
      category: draftLine.category,
      taxability: isNonGst ? 'non_gst' : 'taxable',
      sku: computedSku,
      hsn: isNonGst ? draftLine.hsn.trim() : draftLine.hsn,
      pack: draftLine.pack,
      volume: draftLine.volume,
      unitsPerCrate: draftLine.unitsPerCrate || 24,
      qty: draftLine.qty,
      paidQty: metrics.paidQty,
      freeQty: freeCasesCalculated,
      totalReceivedQty: metrics.totalReceivedQty,
      unitPrice: metrics.exGstRate,
      effectiveCostPerCrateExGst: metrics.effectiveCostPerCrateExGst,
      effectiveCostPerCrateInclGst: metrics.effectiveCostPerCrateInclGst,
      effectiveCostPerUnit: metrics.effectiveCostPerUnit,
      landedCostPerUnit: metrics.landedCostPerBottle,
      landedCostPerCrate: metrics.landedCostPerCrate,
      landedCostPerCrateExGst: metrics.landedCostPerCrateExGst,
      cgstPercent: isNonGst ? 0 : draftLine.cgstPercent,
      sgstPercent: isNonGst ? 0 : draftLine.sgstPercent,
      taxableAmount: metrics.taxableAmount,
      cgstAmount: metrics.cgstAmount,
      sgstAmount: metrics.sgstAmount,
      taxAmount: metrics.taxAmount,
      schemeType: draftLine.schemeType,
      schemeMode: draftLine.schemeMode,
      schemeBuyQty: draftLine.schemeBuyQty,
      schemeFreeQty: draftLine.schemeFreeQty,
      discountPercent: draftLine.schemeDiscountPercent,
      discountFlat: draftLine.schemeFlatDiscountPerCase,
      discountAmount: metrics.discountAmount,
      schemeText: schemeLabelText,
      lineTotal: metrics.lineTotal,
      expiry: draftLine.expiry,
      mfgDate: draftLine.mfgDate,
      batchNumber:
        draftLine.batchNumber.trim() ||
        generateBatchNumber(effectiveName, draftLine.schemeType !== 'none' ? 'SCH' : undefined),
      wholesaleRate: draftLine.wholesaleRate,
      retailRate: draftLine.retailRate,
      supplierSchemeId: draftLine.supplierSchemeId,
      supplierSchemeFreeQty: draftLine.supplierSchemeId ? draftLine.supplierSchemeFreeQty || 0 : undefined,
      pendingCreditSchemeId: draftLine.pendingCreditSchemeId,
      pendingCreditEligibleQty: draftLine.pendingCreditSchemeId ? draftLine.qty : undefined,
      pendingCreditExpectedAmount: draftLine.pendingCreditSchemeId ? draftLine.pendingCreditExpectedAmount || 0 : undefined,
    };

    if (editingIndex !== null) {
      setReviewItems((prev) => prev.map((it, i) => (i === editingIndex ? item : it)));
      setEditingIndex(null);
      if (initialGrnToEdit) {
        setShowAddForm(false);
      }
    } else {
      setReviewItems((prev) => [...prev, item]);
    }

    setDraftLine(defaultLineState(draftLine.category));
  };

  const handleEditRow = (idx: number) => {
    const it = resolvedReviewItems[idx];
    if (!it) return;
    const isNonGst = it.taxability === 'non_gst';
    setDraftLine({
      id: it.id,
      isNewProduct: !it.productId,
      selectedProductId: it.productId,
      productName: it.productName,
      category: it.category,
      taxability: isNonGst ? 'non_gst' : 'taxable',
      hsn: it.hsn,
      pack: it.pack || 'PET',
      volume: it.volume || 150,
      unitsPerCrate: it.unitsPerCrate || 24,
      qty: it.qty,
      unitPrice: it.unitPrice,
      isGstIncluded: false,
      cgstPercent: isNonGst ? 0 : it.cgstPercent,
      sgstPercent: isNonGst ? 0 : it.sgstPercent,
      schemeType: it.schemeType || 'none',
      schemeMode: it.schemeMode || 'inclusive',
      schemeBuyQty: it.schemeBuyQty || 2,
      schemeFreeQty: it.schemeFreeQty || 1,
      freeQty: it.freeQty || 0,
      schemeDiscountPercent: it.discountPercent || 0,
      schemeFlatDiscountPerCase: it.discountFlat || 0,
      expiry: it.expiry,
      mfgDate: it.mfgDate || todayISO(),
      batchNumber: it.batchNumber,
      wholesaleRate: it.wholesaleRate || Math.round(it.unitPrice * 1.1),
      retailRate: it.retailRate || Math.round(it.unitPrice * 1.25),
      supplierSchemeId: it.supplierSchemeId,
      supplierSchemeFreeQty: it.supplierSchemeFreeQty,
      pendingCreditSchemeId: it.pendingCreditSchemeId,
      pendingCreditExpectedAmount: it.pendingCreditExpectedAmount,
    });
    setEditingIndex(idx);
    setShowAddForm(true);
    setTimeout(() => {
      lineFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  const handleDeleteRow = (idx: number) => {
    setReviewItems((prev) => prev.filter((_, i) => i !== idx));
    if (editingIndex === idx) {
      setEditingIndex(null);
      setDraftLine(defaultLineState());
    }
  };

  const handleConfirmAndPost = () => {
    if (!supplierName.trim()) {
      notify('Please specify Supplier / Party Name.');
      return;
    }
    if (supplierPhone.trim() && phoneError) {
      notify(phoneError);
      return;
    }
    if (!invoiceNo.trim()) {
      notify('Please specify Invoice Number.');
      return;
    }
    if (resolvedReviewItems.length === 0) {
      notify('Please add at least one line item into the review table.');
      return;
    }
    if (!targetWarehouseId) {
      notify('Select the warehouse this invoice is being received into before confirming — there is no default.');
      return;
    }

    const roundedInwardPerCase = Math.round(reviewInwardCostPerCrate * 100) / 100;
    const inwardCostsPayload =
      totalInwardCost > 0
        ? {
            transport: 0,
            freight: Math.max(0, Number(freightCost) || 0),
            loadingLabour: Math.max(0, Number(labourCost) || 0),
            unloadingLabour: 0,
            otherInwardCosts: Math.max(0, Number(otherInwardCost) || 0),
            totalInwardCost,
            inwardCostPerCrate: roundedInwardPerCase,
          }
        : undefined;

    try {
      if (initialGrnToEdit) {
        updateGrn(initialGrnToEdit.id, {
          supplierName: supplierName.trim(),
          supplierGstin: supplierGstin.trim(),
          supplierAddress: supplierAddress.trim(),
          supplierPhone: supplierPhone.trim(),
          supplierEmail: supplierEmail.trim(),
          invoiceNo: invoiceNo.trim(),
          inwardDate,
          vehicleNo: vehicleNo.trim(),
          placeOfSupply: placeOfSupply.trim(),
          billedTo: billedTo.trim(),
          shippedTo: shippedTo.trim(),
          warehouseId: targetWarehouseId,
          notes: notes.trim(),
          inwardCosts: inwardCostsPayload,
          totalInwardCost,
          inwardCostPerCrate: roundedInwardPerCase,
          items: resolvedReviewItems,
          totalBilledQty: totals.billed,
          totalFreeQty: totals.free,
          totalPaidQty: totals.paid,
          totalReceivedQty: totals.totalCases,
          totalTaxable: totals.taxable,
          totalCgst: totals.cgst,
          totalSgst: totals.sgst,
          totalTax: totals.cgst + totals.sgst,
          grandTotal: totals.grand,
        });

        setSuccessMessage(
          `Successfully updated ${initialGrnToEdit.grnNumber}! Stock recalculated across inventory & products.`
        );
        const whName = warehouses.find((w) => w.id === targetWarehouseId)?.name || 'godown';
        onSaved?.({
          grnId: initialGrnToEdit.id,
          grnNumber: initialGrnToEdit.grnNumber,
          cases: totals.totalCases,
          warehouseName: whName,
          isEdit: true,
        });
      } else {
        const posted = postGrn({
          supplierName: supplierName.trim(),
          supplierGstin: supplierGstin.trim(),
          supplierAddress: supplierAddress.trim(),
          supplierPhone: supplierPhone.trim(),
          supplierEmail: supplierEmail.trim(),
          invoiceNo: invoiceNo.trim(),
          inwardDate,
          vehicleNo: vehicleNo.trim(),
          placeOfSupply: placeOfSupply.trim(),
          billedTo: billedTo.trim(),
          shippedTo: shippedTo.trim(),
          warehouseId: targetWarehouseId,
          notes: notes.trim(),
          inwardCosts: inwardCostsPayload,
          totalInwardCost,
          inwardCostPerCrate: roundedInwardPerCase,
          items: resolvedReviewItems,
          totalBilledQty: totals.billed,
          totalFreeQty: totals.free,
          totalPaidQty: totals.paid,
          totalReceivedQty: totals.totalCases,
          totalTaxable: totals.taxable,
          totalCgst: totals.cgst,
          totalSgst: totals.sgst,
          totalTax: totals.cgst + totals.sgst,
          grandTotal: totals.grand,
        });

        setSuccessMessage(
          `Successfully confirmed & posted ${posted.grnNumber}! Real-time stock updated in all godowns.`
        );

        // Supplier Scheme traceability (mirrors BulkInwardModal — see there for full notes)
        posted.items.forEach((item) => {
          if (item.supplierSchemeId && item.supplierSchemeFreeQty && item.supplierSchemeFreeQty > 0) {
            addSupplierSchemeApplication({
              schemeId: item.supplierSchemeId,
              schemeType: 'free_goods',
              grnId: posted.id,
              grnLineId: item.id,
              productId: item.productId || 0,
              supplierName: posted.supplierName,
              supplierInvoiceNo: posted.invoiceNo,
              eligibleQuantity: item.qty - item.freeQty,
              freeQuantity: item.supplierSchemeFreeQty,
              expectedBenefit: 0,
              warehouseId: posted.warehouseId,
            });
          }
          if (item.pendingCreditSchemeId && item.pendingCreditExpectedAmount && item.pendingCreditExpectedAmount > 0) {
            addSupplierSchemeApplication({
              schemeId: item.pendingCreditSchemeId,
              schemeType: 'pending_credit',
              grnId: posted.id,
              grnLineId: item.id,
              productId: item.productId || 0,
              supplierName: posted.supplierName,
              supplierInvoiceNo: posted.invoiceNo,
              eligibleQuantity: item.pendingCreditEligibleQty || 0,
              freeQuantity: 0,
              expectedBenefit: item.pendingCreditExpectedAmount,
              warehouseId: posted.warehouseId,
            });
            addSupplierCreditNote({
              supplierName: posted.supplierName,
              schemeId: item.pendingCreditSchemeId,
              grnId: posted.id,
              productId: item.productId,
              expectedAmount: item.pendingCreditExpectedAmount,
              actualAmount: 0,
              notes: `Auto-created from GRN ${posted.grnNumber} · ${item.productName}`,
            });
          }
        });
        const whName = warehouses.find((w) => w.id === targetWarehouseId)?.name || 'Main godown';
        onSaved?.({
          grnId: posted.id,
          grnNumber: posted.grnNumber,
          cases: totals.totalCases,
          warehouseName: whName,
          isEdit: false,
        });
      }
    } catch (err: any) {
      const issues = err?.issues as { message: string }[] | undefined;
      notify(
        issues && issues.length > 0
          ? `Could not post this invoice:\n${issues.map((i) => `• ${i.message}`).join('\n')}`
          : err?.message || 'Failed to post GRN.'
      );
      return;
    }

    if (isPhone) {
      onClose();
      return;
    }

    setTimeout(() => {
      onClose();
    }, 1200);
  };

  const labelStyle = fz(12, {
    fontWeight: 700,
    color: palette.muted,
    textTransform: 'uppercase' as const,
    marginBottom: '0.25rem',
    display: 'block',
  });

  const fieldCls =
    'w-full px-3 py-2.5 rounded-xl border border-black/10 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/25';
  const labelCls = 'block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1';

  if (isPhone) {
    return (
      <InwardPhoneFlow
        initialGrnToEdit={initialGrnToEdit}
        onOpenBulkImport={onOpenBulkImport}
        onClose={onClose}
        phoneStep={phoneStep}
        setPhoneStep={setPhoneStep}
        phoneStepError={phoneStepError}
        setPhoneStepError={setPhoneStepError}
        supplierName={supplierName}
        setSupplierName={setSupplierName}
        applySupplierAutofill={applySupplierAutofill}
        knownSuppliers={knownSuppliers}
        supplierGstin={supplierGstin}
        setSupplierGstin={setSupplierGstin}
        invoiceNo={invoiceNo}
        setInvoiceNo={setInvoiceNo}
        inwardDate={inwardDate}
        setInwardDate={setInwardDate}
        vehicleNo={vehicleNo}
        setVehicleNo={setVehicleNo}
        targetWarehouseId={targetWarehouseId}
        setTargetWarehouseId={setTargetWarehouseId}
        warehouses={warehouses}
        showProviderFields={showProviderFields}
        setShowProviderFields={setShowProviderFields}
        supplierPhone={supplierPhone}
        setSupplierPhone={setSupplierPhone}
        supplierEmail={supplierEmail}
        setSupplierEmail={setSupplierEmail}
        placeOfSupply={placeOfSupply}
        setPlaceOfSupply={setPlaceOfSupply}
        supplierAddress={supplierAddress}
        setSupplierAddress={setSupplierAddress}
        phoneError={phoneError}
        resolvedReviewItems={resolvedReviewItems}
        handleEditRow={handleEditRow}
        handleDeleteRow={handleDeleteRow}
        showAddForm={showAddForm}
        setShowAddForm={setShowAddForm}
        setEditingIndex={setEditingIndex}
        draftLine={draftLine}
        setDraftLine={setDraftLine}
        metrics={metrics}
        totals={totals}
        phoneNewProductMode={phoneNewProductMode}
        setPhoneNewProductMode={setPhoneNewProductMode}
        showPhoneCatalogSheet={showPhoneCatalogSheet}
        setShowPhoneCatalogSheet={setShowPhoneCatalogSheet}
        phoneCatalogSearch={phoneCatalogSearch}
        setPhoneCatalogSearch={setPhoneCatalogSearch}
        phonePrintedTotal={phonePrintedTotal}
        setPhonePrintedTotal={setPhonePrintedTotal}
        products={products}
        handleSelectExisting={handleSelectExisting}
        handleAddDraftToReview={handleAddDraftToReview}
        handleConfirmAndPost={handleConfirmAndPost}
      />
    );
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Inward consignment" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 overflow-y-auto">
      <div className="w-full max-w-3xl bg-[#faf8f5] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col my-0 sm:my-6 max-h-[94vh] overflow-hidden border border-black/5">
        {/* Modal Header — matches Purchases / New purchase UI */}
        <div className="px-4 sm:px-5 py-3 flex items-center justify-between gap-3 border-b border-black/5 bg-[#faf8f5] sticky top-0 z-10">
          <div className="min-w-0 flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="size-9 rounded-full hover:bg-black/5 flex items-center justify-center cursor-pointer text-slate-600 shrink-0"
              aria-label="Back"
            >
              <X size={18} className="sm:hidden" />
              <span className="hidden sm:inline text-lg leading-none">←</span>
            </button>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-900 leading-tight truncate">
                {initialGrnToEdit
                  ? `Edit purchase (${initialGrnToEdit.grnNumber})`
                  : 'New purchase'}
              </h2>
              <p className="hidden sm:block text-xs text-slate-500 mt-0.5 leading-tight truncate">
                Supplier invoice with batch, expiry &amp; scheme
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {!initialGrnToEdit && onOpenBulkImport && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenBulkImport();
                }}
                className="hidden sm:inline-flex px-3 py-1.5 rounded-full text-xs font-semibold border border-black/10 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Bulk import
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="size-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-black/5 cursor-pointer"
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        {!initialGrnToEdit && onOpenBulkImport && (
          <div className="sm:hidden px-4 pt-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenBulkImport();
              }}
              className="w-full py-2 rounded-xl text-xs font-semibold border border-dashed border-black/15 bg-white text-slate-600 cursor-pointer"
            >
              Or bulk import CSV / Excel / PDF
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {successMessage && (
            <div className="p-3 rounded-2xl border border-emerald-200 bg-emerald-50 flex items-center gap-3 text-emerald-800 text-sm font-semibold">
              <CheckCircle2 size={20} />
              <div>{successMessage}</div>
            </div>
          )}

          {/* 1. Invoice Header — Crate card */}
          <InwardDesktopHeaderCard
            labelCls={labelCls}
            fieldCls={fieldCls}
            labelStyle={labelStyle}
            palette={palette}
            supplierName={supplierName}
            setSupplierName={setSupplierName}
            applySupplierAutofill={applySupplierAutofill}
            knownSuppliers={knownSuppliers}
            supplierPhone={supplierPhone}
            setSupplierPhone={setSupplierPhone}
            phoneError={phoneError}
            invoiceNo={invoiceNo}
            setInvoiceNo={setInvoiceNo}
            inwardDate={inwardDate}
            setInwardDate={setInwardDate}
            targetWarehouseId={targetWarehouseId}
            setTargetWarehouseId={setTargetWarehouseId}
            warehouses={warehouses}
            supplierGstin={supplierGstin}
            setSupplierGstin={setSupplierGstin}
            vehicleNo={vehicleNo}
            setVehicleNo={setVehicleNo}
            showProviderFields={showProviderFields}
            setShowProviderFields={setShowProviderFields}
            supplierAddress={supplierAddress}
            setSupplierAddress={setSupplierAddress}
            supplierEmail={supplierEmail}
            setSupplierEmail={setSupplierEmail}
            placeOfSupply={placeOfSupply}
            setPlaceOfSupply={setPlaceOfSupply}
            billedTo={billedTo}
            setBilledTo={setBilledTo}
            totalInwardCost={totalInwardCost}
            reviewCasesTotal={reviewCasesTotal}
            reviewInwardCostPerCrate={reviewInwardCostPerCrate}
            showMoreInwardCosts={showMoreInwardCosts}
            setShowMoreInwardCosts={setShowMoreInwardCosts}
            freightCost={freightCost}
            setFreightCost={setFreightCost}
            labourCost={labourCost}
            setLabourCost={setLabourCost}
            otherInwardCost={otherInwardCost}
            setOtherInwardCost={setOtherInwardCost}
          />

          {/* Saved GRN Edit Notice / Expand Toggle */}
          {initialGrnToEdit && !showAddForm && editingIndex === null && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-xs text-emerald-950 font-bold flex items-center gap-1.5">
                  <CheckCircle2 size={16} className="text-emerald-700" />
                  <span>Editing Saved Purchase {initialGrnToEdit.grnNumber} ({reviewItems.length} items loaded)</span>
                </div>
                <div className="text-xs text-emerald-800 mt-0.5">
                  Click the <strong>Edit (✏️)</strong> button on any row in the table below to edit its quantity, price, scheme, or batch.
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingIndex(null);
                  setDraftLine(defaultLineState());
                  setShowAddForm(true);
                }}
                className="shrink-0 px-3.5 py-2 rounded-xl bg-[var(--primary)] text-white text-xs font-bold hover:bg-[var(--primary-hover)] cursor-pointer shadow-sm"
              >
                + Add Another Product
              </button>
            </div>
          )}

          {/* 2. Line Entry Form */}
          {(!initialGrnToEdit || showAddForm || editingIndex !== null) && (
            <InwardLineItemForm
              lineFormRef={lineFormRef}
              editingIndex={editingIndex}
              setEditingIndex={setEditingIndex}
              initialGrnToEdit={initialGrnToEdit}
              setShowAddForm={setShowAddForm}
              draftLine={draftLine}
              setDraftLine={setDraftLine}
              palette={palette}
              labelStyle={labelStyle}
              products={products}
              matchingProduct={matchingProduct}
              similarProduct={similarProduct}
              computedSku={computedSku}
              handleSelectExisting={handleSelectExisting}
              handleCategoryChange={handleCategoryChange}
              metrics={metrics}
              draftPreviewInwardPerCrate={draftPreviewInwardPerCrate}
              supplierSchemes={supplierSchemes}
              lineValidationError={lineValidationError}
              setLineValidationError={setLineValidationError}
              handleAddDraftToReview={handleAddDraftToReview}
            />
          )}

          {/* 3. Review-before-confirm Table */}
          <InwardReviewTable
            palette={palette}
            reviewItemsCount={reviewItems.length}
            resolvedReviewItems={resolvedReviewItems}
            editingIndex={editingIndex}
            handleEditRow={handleEditRow}
            handleDeleteRow={handleDeleteRow}
            totals={totals}
            totalInwardCost={totalInwardCost}
          />
        </div>

        {/* Modal Footer — Save purchase */}
        <div className="px-4 sm:px-5 py-3 border-t border-black/5 bg-white flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-full text-sm font-semibold text-slate-600 hover:bg-black/5 cursor-pointer"
            >
              Cancel
            </button>
            {resolvedReviewItems.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const grnObj: GRN = {
                    id: initialGrnToEdit?.id || `grn_${Date.now()}`,
                    grnNumber: initialGrnToEdit?.grnNumber || 'DRAFT-GRN',
                    supplierName: supplierName || 'Supplier',
                    supplierGstin,
                    supplierAddress,
                    supplierPhone,
                    supplierEmail,
                    invoiceNo: invoiceNo || 'INV',
                    inwardDate,
                    vehicleNo,
                    placeOfSupply,
                    billedTo,
                    shippedTo,
                    warehouseId: targetWarehouseId,
                    inwardCosts: totalInwardCost > 0 ? {
                      transport: 0,
                      freight: Math.max(0, Number(freightCost) || 0),
                      loadingLabour: Math.max(0, Number(labourCost) || 0),
                      unloadingLabour: 0,
                      otherInwardCosts: Math.max(0, Number(otherInwardCost) || 0),
                      totalInwardCost,
                      inwardCostPerCrate: Math.round(reviewInwardCostPerCrate * 100) / 100,
                    } : undefined,
                    totalInwardCost,
                    inwardCostPerCrate: Math.round(reviewInwardCostPerCrate * 100) / 100,
                    items: resolvedReviewItems,
                    totalBilledQty: totals.billed,
                    totalFreeQty: totals.free,
                    totalPaidQty: totals.paid,
                    totalReceivedQty: totals.totalCases,
                    totalTaxable: totals.taxable,
                    totalCgst: totals.cgst,
                    totalSgst: totals.sgst,
                    totalTax: totals.cgst + totals.sgst,
                    grandTotal: totals.grand,
                    createdAt: initialGrnToEdit?.createdAt || new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  };
                  downloadSingleGrnCsv(grnObj, warehouses);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-full text-sm font-semibold border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 cursor-pointer shadow-xs"
                title="Download this inward GRN with all items as CSV file"
              >
                <Download size={14} />
                <span>Download CSV</span>
              </button>
            )}
          </div>
          <button
            type="button"
            disabled={reviewItems.length === 0 || !targetWarehouseId}
            onClick={handleConfirmAndPost}
            title={!targetWarehouseId ? 'Select a warehouse first — there is no default' : undefined}
            className="px-5 py-2.5 rounded-full bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-sm font-semibold shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
          >
            {!targetWarehouseId ? 'Select godown' : 'Save purchase'}
          </button>
        </div>
      </div>
    </div>
  );
};
