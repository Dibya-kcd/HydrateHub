import React, { useState, useRef, useEffect } from 'react';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useLedger } from '../../context/LedgerContext';
import { GrnImportWarning, GrnSchemeType } from '../../types';
import { money } from '../../utils/billing';
import {
  ParsedInvoiceData,
  parseSpreadsheetInvoice,
  recognizeInvoiceWithAi,
} from '../../utils/invoiceParser';
import {
  downloadImportTemplate,
  downloadImportTemplateXlsx,
} from '../../utils/importExport';
import { InwardProductCard } from '../inward/InwardProductCard';
import { UploadStep } from '../inward/UploadStep';
import { todayISO } from "../../utils/dateLocal";
import { validatePhone } from "../../utils/validation";
import {
  buildGrnLineItemsFromRows,
  computeUpdatedInwardRow,
  EditableInwardRow,
  mapParsedInvoiceItemsToRows,
} from '../inward/bulkInwardTypes';
import {
  applyAutoBatchesToRows,
  applyBulkListPriceGstToRows,
  applyBulkSchemeToRows,
  buildBlankConsignmentRow,
  buildNewInwardRow,
  duplicateInwardRow,
  mapRowCatalogChange,
} from '../inward/bulkInwardRowHelpers';
import { BulkInwardPhoneView } from '../inward/BulkInwardPhoneView';
import { BulkInwardDesktopHeaderPanels } from '../inward/BulkInwardDesktopHeaderPanels';
import { BulkInwardDesktopToolbar } from '../inward/BulkInwardDesktopToolbar';
import { BulkInwardDesktopTable } from '../inward/BulkInwardDesktopTable';
import { BulkInwardDesktopModals } from '../inward/BulkInwardDesktopConfirmModal';
import {
  BulkInwardDesktopFooter,
  BulkInwardDesktopHeader,
  BulkInwardParseErrorBanner,
} from '../inward/BulkInwardDesktopShell';
import { useKnownSuppliers } from '../inward/useKnownSuppliers';

interface BulkInwardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (
    grnNumber: string,
    count: number,
    extra?: { grnId?: string; totalCases?: number; warehouseName?: string }
  ) => void;
}

export const BulkInwardModal: React.FC<BulkInwardModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const {
    products,
    warehouses,
    grns,
    remainingStock,
    postGrn,
    palette,
    supplierSchemes,
    addSupplierSchemeApplication,
    addSupplierCreditNote,
    currentUser,
  } = useLedger();

  // Wizard Step: 'upload' | 'review'
  const [step, setStep] = useState<'upload' | 'review'>('upload');

  // Invoice Header Information
  const [supplierName, setSupplierName] = useState('');
  const [supplierGstin, setSupplierGstin] = useState('');
  const [supplierAddress, setSupplierAddress] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [supplierEmail, setSupplierEmail] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [inwardDate, setInwardDate] = useState(todayISO());
  const [vehicleNo, setVehicleNo] = useState('');
  const [placeOfSupply, setPlaceOfSupply] = useState('');
  const [billedTo, setBilledTo] = useState('');
  const [shippedTo, setShippedTo] = useState('');
  const [showProviderDetails, setShowProviderDetails] = useState(false);
  const [targetWarehouseId, setTargetWarehouseId] = useState('');
  const [overallDiscount, setOverallDiscount] = useState<number>(0);
  const [originalInvoiceTotal, setOriginalInvoiceTotal] = useState<number | null>(null);
  const [printedTotalCases, setPrintedTotalCases] = useState<number | null>(null);
  const [showAmountMismatchDetail, setShowAmountMismatchDetail] = useState(false);
  const [catalogPickerRowId, setCatalogPickerRowId] = useState<string | null>(null);
  const [catalogPickerSearch, setCatalogPickerSearch] = useState<string>('');
  const [volumePickerRowId, setVolumePickerRowId] = useState<string | null>(null);
  // "Import with warning" acknowledgement (in-app dialog; window.confirm can be blocked in PWA/iframes)
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [warningNote, setWarningNote] = useState('');

  // Inward-to-Godown Direct Costs (Transport, Freight, Labour, Other)
  const [transportCost, setTransportCost] = useState<number>(0);
  const [freightCost, setFreightCost] = useState<number>(0);
  const [loadingLabourCost, setLoadingLabourCost] = useState<number>(0);
  const [unloadingLabourCost, setUnloadingLabourCost] = useState<number>(0);
  const [otherInwardCost, setOtherInwardCost] = useState<number>(0);
  const [showInwardCostDetails, setShowInwardCostDetails] = useState<boolean>(true);
  const [invoiceRoundOff, setInvoiceRoundOff] = useState<number>(0);
  const [invoiceOtherCharges, setInvoiceOtherCharges] = useState<number>(0);
  const isPhone = useIsMobile(1023);
  const [mobileSubView, setMobileSubView] = useState<'overview' | 'bill' | 'costs' | 'edit_line'>('overview');
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [phoneDismissWarning, setPhoneDismissWarning] = useState(false);
  const [showAutoBatchSheet, setShowAutoBatchSheet] = useState(false);
  const [phoneDeleteConfirmId, setPhoneDeleteConfirmId] = useState<string | null>(null);
  const [phoneCatalogSizeFilter, setPhoneCatalogSizeFilter] = useState<'all' | '200' | '600' | '1000'>('all');
  const [showConfirmStep, setShowConfirmStep] = useState<boolean>(false);
  const [confirmQuery, setConfirmQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  useEffect(() => {
    if (!isOpen) {
      setShowConfirmStep(false);
      setConfirmDeleteId(null);
      setConfirmQuery('');
      setMobileSubView('overview');
      setEditingRowId(null);
      setPhoneDismissWarning(false);
      setShowAutoBatchSheet(false);
      setPhoneDeleteConfirmId(null);
      setCatalogPickerRowId(null);
    }
  }, [isOpen]);

  // Parsing & File State
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parsingStatus, setParsingStatus] = useState<string>('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [lastUploadedFile, setLastUploadedFile] = useState<File | null>(null);
  const [detectedSource, setDetectedSource] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Layout & Sizing State
  const [isMaximized, setIsMaximized] = useState(true);
  const [isUpperDetailsExpanded, setIsUpperDetailsExpanded] = useState(false);
  const [density, setDensity] = useState<'comfortable' | 'compact'>('compact');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards');
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  // Auto-detect screen size: use Card view on mobile/small screens, Table view on wide screens
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth >= 1200) {
        setViewMode('table');
      } else {
        setViewMode('cards');
      }
    }
  }, []);

  // Editable Review Rows
  const [rows, setRows] = useState<EditableInwardRow[]>([]);

  // Bulk Apply Drawer / Dialog state
  const [showBulkSchemeModal, setShowBulkSchemeModal] = useState(false);
  const [bulkSchemeType, setBulkSchemeType] = useState<GrnSchemeType>('discount_percent');
  const [bulkSchemeValue, setBulkSchemeValue] = useState<number>(5);
  const [bulkSchemeName, setBulkSchemeName] = useState<string>('Dealer Scheme');

  const [bulkExpiryDate, setBulkExpiryDate] = useState<string>('');

  // Filter in review table
  const [searchQuery, setSearchQuery] = useState('');
  const [filterNewOnly, setFilterNewOnly] = useState(false);
  const [filterSchemeOnly, setFilterSchemeOnly] = useState(false);
  const [filterAttentionOnly, setFilterAttentionOnly] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [showMismatchDetail, setShowMismatchDetail] = useState(false);
  // Notes from the AI cross-checks (row arithmetic, totals, GSTIN ...) shown above the table
  const [aiWarnings, setAiWarnings] = useState<string[]>([]);

  const knownSuppliers = useKnownSuppliers(grns);

  const supplierPhoneError = React.useMemo(
    () => (supplierPhone.trim() ? validatePhone(supplierPhone, { label: 'Supplier phone' }) : null),
    [supplierPhone]
  );

  if (!isOpen) return null;

  const applySupplierAutofill = (nameVal: string, currentPhone?: string, currentGstin?: string) => {
    const clean = nameVal.trim().toLowerCase();
    if (!clean) return;
    const match = knownSuppliers.find((s) => s.name.toLowerCase() === clean);
    if (!match) return;
    if (!(currentPhone ?? supplierPhone).trim() && match.phone) setSupplierPhone(match.phone);
    if (!(currentGstin ?? supplierGstin).trim() && match.gstin) setSupplierGstin(match.gstin);
    if (!supplierAddress.trim() && match.address) setSupplierAddress(match.address);
    if (!supplierEmail.trim() && match.email) setSupplierEmail(match.email);
  };

  // Quantity & Inward-Cost totals declared early so callbacks never hit TDZ
  const totalBilledQty = rows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
  const totalFreeQty = rows.reduce((s, r) => s + (Number(r.freeQty) || 0), 0);
  const totalInvoicePrintedQty = totalBilledQty;
  const totalSupplierSchemeBonusQty = rows.reduce(
    (s, r) => s + (r.supplierSchemeId ? Number(r.supplierSchemeFreeQty) || 0 : 0),
    0
  );
  const totalReceivedQty = totalInvoicePrintedQty + totalSupplierSchemeBonusQty;
  const totalPaidQty = rows.reduce(
    (s, r) => s + Math.max(0, (Number(r.qty) || 0) - (Number(r.freeQty) || 0)),
    0
  );
  const hasCasesMismatch =
    printedTotalCases !== null && printedTotalCases > 0 && totalInvoicePrintedQty !== printedTotalCases;
  const casesDiff = printedTotalCases !== null ? totalInvoicePrintedQty - printedTotalCases : 0;

  const totalInwardCost =
    (Number(transportCost) || 0) +
    (Number(freightCost) || 0) +
    (Number(loadingLabourCost) || 0) +
    (Number(unloadingLabourCost) || 0) +
    (Number(otherInwardCost) || 0);
  const inwardCostPerCrate = totalReceivedQty > 0 ? totalInwardCost / totalReceivedQty : 0;

  // Convert ParsedInvoiceData into editable rows
  const loadInvoiceDataIntoReview = (data: ParsedInvoiceData, sourceName: string) => {
    const matchedSup = knownSuppliers.find(
      (s) => s.name.toLowerCase() === (data.supplierName || '').trim().toLowerCase()
    );
    setSupplierName(data.supplierName || '');
    setSupplierGstin(data.supplierGstin || matchedSup?.gstin || '');
    setSupplierAddress(data.supplierAddress || matchedSup?.address || '');
    setSupplierPhone(data.supplierPhone || matchedSup?.phone || '');
    setSupplierEmail(data.supplierEmail || matchedSup?.email || '');
    setInvoiceNo(data.invoiceNo || '');
    setInwardDate(data.invoiceDate || todayISO());
    setVehicleNo(data.vehicleNo || '');
    setPlaceOfSupply(data.placeOfSupply || '');
    setBilledTo(data.billedTo || '');
    setShippedTo(data.shippedTo || '');
    setOverallDiscount(data.overallDiscount || 0);
    setOriginalInvoiceTotal(data.grandTotal || null);
    setInvoiceRoundOff(data.roundOff || 0);
    setInvoiceOtherCharges(data.otherCharges || 0);
    const parsedFreightSum = data.items.reduce((s, it) => s + (Number(it.freightCost) || 0), 0);
    const parsedLabourSum = data.items.reduce((s, it) => s + (Number(it.labourCost) || 0), 0);
    if ((data.otherCharges || 0) > 0) setFreightCost(data.otherCharges || 0);
    else if (parsedFreightSum > 0) setFreightCost(parsedFreightSum);
    if (parsedLabourSum > 0) setLoadingLabourCost(parsedLabourSum);
    setPrintedTotalCases(
      data.totalCases && data.totalCases > 0
        ? data.totalCases
        : data.items.reduce((s, it) => s + (Number(it.qty) || 0), 0)
    );
    setDetectedSource(data.detectedSource);
    setAiWarnings(Array.isArray(data.warnings) ? data.warnings : []);
    setFileName(sourceName);

    const mappedRows = mapParsedInvoiceItemsToRows(
      data.items,
      products,
      remainingStock,
      data.invoiceDate || inwardDate,
    );

    setRows(mappedRows);
    setStep('review');
  };

  // Process uploaded files (Excel, CSV, PDF, Image)
  const processUploadedFile = async (file: File) => {
    setParseError(null);
    setAiWarnings([]);
    setLastUploadedFile(file);
    setIsParsing(true);
    setFileName(file.name);
    const extension = file.name.split('.').pop()?.toLowerCase() || '';

    try {
      if (['xlsx', 'xls', 'csv'].includes(extension)) {
        setParsingStatus('Parsing spreadsheet tables, column headers, and beverage rows...');
        const parsed = await parseSpreadsheetInvoice(file, products);
        loadInvoiceDataIntoReview(parsed, file.name);
      } else if (['pdf', 'jpg', 'jpeg', 'png', 'webp'].includes(extension)) {
        setParsingStatus(
          `Extracting details with AI OCR (${extension.toUpperCase()}). Analyzing items, quantities, taxes, schemes...`
        );
        try {
          const parsed = await recognizeInvoiceWithAi(file, products);
          loadInvoiceDataIntoReview(parsed, file.name);
        } catch (aiErr: any) {
          console.error('AI recognition failed:', aiErr);
          const isTemp =
            aiErr.isTemporary ||
            aiErr.status === 503 ||
            /high demand|unavailable|temporar/i.test(aiErr.message || '');
          throw new Error(
            isTemp
              ? `${aiErr.message || 'Google Gemini is temporarily unavailable.'} You can click "Retry AI Vision", or open the review table and enter the lines manually.`
              : `AI Vision recognition error: ${aiErr.message || 'Unable to recognize document'}. Please upload using our updated Excel/CSV template or proceed with manual entry.`
          );
        }
      } else {
        throw new Error('Unsupported format. Please upload an Excel (.xlsx, .xls), CSV (.csv), PDF (.pdf), or Image (.jpg, .png).');
      }
    } catch (err: any) {
      setParseError(err.message || 'Failed to parse invoice.');
    } finally {
      setIsParsing(false);
      setParsingStatus('');
    }
  };

  // Row update handlers
  const updateRowField = (id: string, field: keyof EditableInwardRow, val: any) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? computeUpdatedInwardRow(r, field, val, products, remainingStock, inwardCostPerCrate) : r))
    );
  };

  // Toggle or change product catalog mapping
  const handleCatalogMappingChange = (rowId: string, targetValue: string) => {
    setRows((prev) => mapRowCatalogChange(prev, rowId, targetValue, products, remainingStock));
  };

  // Delete row
  const handleDeleteRow = (rowId: string) => {
    setRows((prev) => prev.filter((r) => r.id !== rowId));
  };

  // Duplicate an existing row with auto-generated fresh unique batch
  const handleDuplicateRow = (rowId: string) => {
    setRows((prev) => duplicateInwardRow(prev, rowId, products, inwardDate));
  };

  // Start with manual blank consignment (with fresh batch)
  const handleStartBlankConsignment = () => {
    setAiWarnings([]);
    setFileName('Manual Inward Entry');
    setDetectedSource('manual');
    setRows([buildBlankConsignmentRow(products, remainingStock, inwardDate)]);
    setStep('review');
  };

  // Add new empty row with fresh auto-generated batch
  const handleAddNewRow = () => {
    setRows((prev) => [...prev, buildNewInwardRow(products, prev, inwardDate)]);
  };

  // Auto-generate fresh unique batch/tag numbers for all products inwards (never use old one)
  const handleAutoGenerateAllBatches = () => {
    setRows((prev) => applyAutoBatchesToRows(prev, products, inwardDate));
  };

  // Bulk toggle list price GST inclusion and recalculate (Non-GST rows stay 0%)
  const handleBulkSetListPriceGst = (isIncluded: boolean) => {
    setRows((prev) => applyBulkListPriceGstToRows(prev, isIncluded, inwardCostPerCrate));
  };

  // Apply Bulk Scheme to All Rows
  const handleApplyBulkScheme = () => {
    setRows((prev) => applyBulkSchemeToRows(prev, bulkSchemeType, bulkSchemeValue, bulkSchemeName));
    setShowBulkSchemeModal(false);
  };

  const totalGross = rows.reduce((s, r) => s + r.qty * r.unitPrice, 0);
  const totalItemDiscounts = rows.reduce((s, r) => s + r.discountAmount, 0);
  const totalTaxable = Math.max(0, totalGross - totalItemDiscounts);

  const totalCgst = rows.reduce((s, r) => {
    if (r.taxability === 'non_gst') return s;
    const gross = r.qty * r.unitPrice;
    const taxb = Math.max(0, gross - r.discountAmount);
    return s + (taxb * r.cgstPercent) / 100;
  }, 0);

  const totalSgst = rows.reduce((s, r) => {
    if (r.taxability === 'non_gst') return s;
    const gross = r.qty * r.unitPrice;
    const taxb = Math.max(0, gross - r.discountAmount);
    return s + (taxb * r.sgstPercent) / 100;
  }, 0);

  const totalTax = totalCgst + totalSgst;
  const calculatedGrandTotal = Math.max(0, totalTaxable + totalTax - overallDiscount);
  const totalLandedInventoryValue = calculatedGrandTotal + totalInwardCost;

  const newProductsCount = rows.filter((r) => r.isNewProduct).length;

  const handleConfirmAndPostGrn = () => {
    if (rows.length === 0) {
      setParseError('Please ensure there is there at least 1 product line to inward.');
      return;
    }
    if (supplierPhone.trim() && supplierPhoneError) {
      setParseError(supplierPhoneError);
      return;
    }
    if (!targetWarehouseId) {
      setParseError('Select the warehouse this invoice is being received into before confirming — there is no default.');
      return;
    }
    if (hasCasesMismatch) {
      setShowWarningDialog(true);
      return;
    }
    postConsignment([]);
  };

  const handleImportWithWarning = () => {
    const warnings: GrnImportWarning[] = [];
    if (hasCasesMismatch) {
      warnings.push({
        id: 'iw_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        type: 'cases_mismatch',
        message: `Total cases mismatch: invoice printed ${printedTotalCases} cs vs imported ${totalReceivedQty} cs (${casesDiff > 0 ? `+${casesDiff}` : casesDiff} cs)`,
        expected: printedTotalCases ?? undefined,
        actual: totalReceivedQty,
        difference: casesDiff,
        note: warningNote.trim() || undefined,
        acknowledgedAt: new Date().toISOString(),
        acknowledgedBy: currentUser?.name || 'Admin',
        resolved: false,
      });
    }
    setShowWarningDialog(false);
    setWarningNote('');
    postConsignment(warnings);
  };

  const postConsignment = (importWarnings: GrnImportWarning[]) => {
    const perCaseFreight =
      totalReceivedQty > 0
        ? Math.round((((Number(freightCost) || 0) + (Number(transportCost) || 0)) / totalReceivedQty) * 100) / 100
        : 0;
    const perCaseLabour =
      totalReceivedQty > 0
        ? Math.round((((Number(loadingLabourCost) || 0) + (Number(unloadingLabourCost) || 0)) / totalReceivedQty) * 100) / 100
        : 0;

    // Convert rows to GrnLineItem format using the unified landed cost engine
    const items = buildGrnLineItemsFromRows(rows, inwardCostPerCrate, perCaseFreight, perCaseLabour);

    const targetWhObj = warehouses.find((w) => w.id === targetWarehouseId);

    let createdGrn;
    try {
      createdGrn = postGrn({
      supplierName,
      supplierGstin,
      supplierAddress,
      supplierPhone,
      supplierEmail,
      invoiceNo,
      inwardDate,
      vehicleNo,
      placeOfSupply,
      billedTo,
      shippedTo,
      warehouseId: targetWarehouseId,
      warehouseName: targetWhObj?.name || 'Main Godown',
      items,
      importWarnings: importWarnings.length > 0 ? importWarnings : undefined,
      totalBilledQty,
      totalFreeQty,
      totalPaidQty,
      totalReceivedQty,
      totalTaxable,
      totalCgst,
      totalSgst,
      totalTax,
      grandTotal: calculatedGrandTotal,
      overallDiscount: overallDiscount || 0,
      totalLineDiscount: totalItemDiscounts || 0,
      subtotalBeforeDiscount: totalGross + totalTax,
      inwardCosts: {
        transport: Number(transportCost) || 0,
        freight: Number(freightCost) || 0,
        loadingLabour: Number(loadingLabourCost) || 0,
        unloadingLabour: Number(unloadingLabourCost) || 0,
        otherInwardCosts: Number(otherInwardCost) || 0,
        totalInwardCost,
        inwardCostPerCrate,
      },
      totalInwardCost,
      inwardCostPerCrate,
      notes: `Inward parsed from ${fileName || 'Invoice'}. Provider: ${supplierName} (GSTIN: ${supplierGstin}). Vehicle: ${vehicleNo}. Overall Discount: ₹${money(overallDiscount)}. Direct Inward Godown Cost: ₹${money(totalInwardCost)} (+₹${money(inwardCostPerCrate)}/crate).`,
      });
    } catch (err: any) {
      // GrnValidationError from postGrn (missing/invalid warehouse, missing batch
      // number or expiry on a line, duplicate invoice number, etc.) — surface every
      // issue to the user instead of silently failing or letting bad stock through.
      const issues = err?.issues as { message: string }[] | undefined;
      setParseError(
        issues && issues.length > 0
          ? `Could not post this invoice:\n${issues.map((i) => `• ${i.message}`).join('\n')}`
          : err?.message || 'Failed to post GRN.'
      );
      return;
    }

    // Supplier Scheme traceability: one application record per GRN line that was
    // attached to a Type A (free_goods) or Type B (pending_credit) scheme, plus an
    // auto-created "Pending Credit Note" for Type B, so it shows up immediately in the
    // Supplier Schemes view. The original GRN/invoice above is never touched by this.
    createdGrn.items.forEach((item) => {
      if (item.supplierSchemeId && item.supplierSchemeFreeQty && item.supplierSchemeFreeQty > 0) {
        addSupplierSchemeApplication({
          schemeId: item.supplierSchemeId,
          schemeType: 'free_goods',
          grnId: createdGrn.id,
          grnLineId: item.id,
          productId: item.productId || 0,
          supplierName: createdGrn.supplierName,
          supplierInvoiceNo: createdGrn.invoiceNo,
          eligibleQuantity: item.paidQty,
          freeQuantity: item.supplierSchemeFreeQty,
          expectedBenefit: 0,
          warehouseId: createdGrn.warehouseId,
        });
      }
      if (item.pendingCreditSchemeId && item.pendingCreditExpectedAmount && item.pendingCreditExpectedAmount > 0) {
        addSupplierSchemeApplication({
          schemeId: item.pendingCreditSchemeId,
          schemeType: 'pending_credit',
          grnId: createdGrn.id,
          grnLineId: item.id,
          productId: item.productId || 0,
          supplierName: createdGrn.supplierName,
          supplierInvoiceNo: createdGrn.invoiceNo,
          eligibleQuantity: item.pendingCreditEligibleQty || 0,
          freeQuantity: 0,
          expectedBenefit: item.pendingCreditExpectedAmount,
          warehouseId: createdGrn.warehouseId,
        });
        addSupplierCreditNote({
          supplierName: createdGrn.supplierName,
          schemeId: item.pendingCreditSchemeId,
          grnId: createdGrn.id,
          productId: item.productId,
          expectedAmount: item.pendingCreditExpectedAmount,
          actualAmount: 0,
          notes: `Auto-created from GRN ${createdGrn.grnNumber} · ${item.productName}`,
        });
      }
    });

    if (onSuccess) {
      onSuccess(createdGrn.grnNumber, items.length, {
        grnId: createdGrn.id,
        totalCases: totalReceivedQty,
        warehouseName: createdGrn.warehouseName || targetWhObj?.name || 'Main godown',
      });
    }
  };

  const itemsWithSchemeCount = rows.filter(
    (r) => r.schemeType !== 'none' || r.freeQty > 0 || r.discountAmount > 0
  ).length;

  // Review helpers: lines that still need a human look (no expiry date / zero rate)
  const needsAttention = (r: EditableInwardRow) =>
    !r.expiry || !(r.batchNumber || '').trim() || !(Number(r.unitPrice) > 0);
  const attentionCount = rows.filter(needsAttention).length;
  const missingExpiryCount = rows.filter((r) => !r.expiry).length;
  const missingBatchCount = rows.filter((r) => !(r.batchNumber || '').trim()).length;
  // Informational only — never blocks posting (the cases mismatch is the only warning flow)
  const amountDiff = originalInvoiceTotal !== null ? calculatedGrandTotal + invoiceRoundOff + invoiceOtherCharges - originalInvoiceTotal : 0;
  const hasAmountMismatch = originalInvoiceTotal !== null && Math.abs(amountDiff) >= 1;
  // Fill ONLY the empty expiry cells with the chosen date (never overwrites typed values)
  const handleFillEmptyExpiry = () => {
    if (!bulkExpiryDate) return;
    setRows((prev) => prev.map((r) => (r.expiry ? r : { ...r, expiry: bulkExpiryDate })));
  };

  // Filtered rows for review table
  const filteredRows = rows.filter((r) => {
    if (filterNewOnly && !r.isNewProduct) return false;
    if (filterSchemeOnly && r.schemeType === 'none' && r.freeQty === 0 && r.discountAmount === 0) return false;
    if (filterAttentionOnly && !needsAttention(r)) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        r.productName.toLowerCase().includes(q) ||
        r.rawName.toLowerCase().includes(q) ||
        r.hsn.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        (r.schemeText && r.schemeText.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Download Comprehensive Sample Excel Template (With Provider Details sheet, Items table & GST Guide)
  const handleDownloadSample = () => {
    downloadImportTemplateXlsx().catch((err) => console.error('Could not create the Excel template:', err));
  };

  // Download Comprehensive CSV Template (With Provider Details headers & columns)
  const handleDownloadCsvSample = () => {
    downloadImportTemplate();
  };

  if (isPhone) {
    return (
      <BulkInwardPhoneView
        onClose={onClose}
        step={step}
        setStep={setStep}
        mobileSubView={mobileSubView}
        setMobileSubView={setMobileSubView}
        editingRowId={editingRowId}
        setEditingRowId={setEditingRowId}
        showConfirmStep={showConfirmStep}
        setShowConfirmStep={setShowConfirmStep}
        confirmQuery={confirmQuery}
        setConfirmQuery={setConfirmQuery}
        rows={rows}
        setRows={setRows}
        filteredRows={filteredRows}
        products={products}
        warehouses={warehouses}
        knownSuppliers={knownSuppliers}
        applySupplierAutofill={applySupplierAutofill}
        supplierName={supplierName}
        setSupplierName={setSupplierName}
        supplierPhone={supplierPhone}
        setSupplierPhone={setSupplierPhone}
        supplierPhoneError={supplierPhoneError}
        supplierGstin={supplierGstin}
        setSupplierGstin={setSupplierGstin}
        invoiceNo={invoiceNo}
        setInvoiceNo={setInvoiceNo}
        inwardDate={inwardDate}
        setInwardDate={setInwardDate}
        targetWarehouseId={targetWarehouseId}
        setTargetWarehouseId={setTargetWarehouseId}
        vehicleNo={vehicleNo}
        setVehicleNo={setVehicleNo}
        overallDiscount={overallDiscount}
        setOverallDiscount={setOverallDiscount}
        originalInvoiceTotal={originalInvoiceTotal}
        setOriginalInvoiceTotal={setOriginalInvoiceTotal}
        transportCost={transportCost}
        setTransportCost={setTransportCost}
        freightCost={freightCost}
        setFreightCost={setFreightCost}
        loadingLabourCost={loadingLabourCost}
        setLoadingLabourCost={setLoadingLabourCost}
        unloadingLabourCost={unloadingLabourCost}
        setUnloadingLabourCost={setUnloadingLabourCost}
        otherInwardCost={otherInwardCost}
        setOtherInwardCost={setOtherInwardCost}
        invoiceRoundOff={invoiceRoundOff}
        setInvoiceRoundOff={setInvoiceRoundOff}
        invoiceOtherCharges={invoiceOtherCharges}
        setInvoiceOtherCharges={setInvoiceOtherCharges}
        totalInwardCost={totalInwardCost}
        inwardCostPerCrate={inwardCostPerCrate}
        printedTotalCases={printedTotalCases}
        totalInvoicePrintedQty={totalInvoicePrintedQty}
        totalFreeQty={totalFreeQty}
        totalSupplierSchemeBonusQty={totalSupplierSchemeBonusQty}
        totalReceivedQty={totalReceivedQty}
        hasCasesMismatch={hasCasesMismatch}
        casesDiff={casesDiff}
        calculatedGrandTotal={calculatedGrandTotal}
        totalLandedInventoryValue={totalLandedInventoryValue}
        totalTax={totalTax}
        amountDiff={amountDiff}
        hasAmountMismatch={hasAmountMismatch}
        attentionCount={attentionCount}
        filterAttentionOnly={filterAttentionOnly}
        setFilterAttentionOnly={setFilterAttentionOnly}
        viewMode={viewMode}
        setViewMode={setViewMode}
        parseError={parseError}
        setParseError={setParseError}
        aiWarnings={aiWarnings}
        phoneDismissWarning={phoneDismissWarning}
        setPhoneDismissWarning={setPhoneDismissWarning}
        showMismatchDetail={showMismatchDetail}
        setShowMismatchDetail={setShowMismatchDetail}
        showAmountMismatchDetail={showAmountMismatchDetail}
        setShowAmountMismatchDetail={setShowAmountMismatchDetail}
        showWarningDialog={showWarningDialog}
        setShowWarningDialog={setShowWarningDialog}
        warningNote={warningNote}
        setWarningNote={setWarningNote}
        catalogPickerRowId={catalogPickerRowId}
        setCatalogPickerRowId={setCatalogPickerRowId}
        catalogPickerSearch={catalogPickerSearch}
        setCatalogPickerSearch={setCatalogPickerSearch}
        phoneCatalogSizeFilter={phoneCatalogSizeFilter}
        setPhoneCatalogSizeFilter={setPhoneCatalogSizeFilter}
        showBulkSchemeModal={showBulkSchemeModal}
        setShowBulkSchemeModal={setShowBulkSchemeModal}
        bulkSchemeType={bulkSchemeType}
        setBulkSchemeType={setBulkSchemeType}
        bulkSchemeName={bulkSchemeName}
        setBulkSchemeName={setBulkSchemeName}
        bulkSchemeValue={bulkSchemeValue}
        setBulkSchemeValue={setBulkSchemeValue}
        showAutoBatchSheet={showAutoBatchSheet}
        setShowAutoBatchSheet={setShowAutoBatchSheet}
        bulkExpiryDate={bulkExpiryDate}
        setBulkExpiryDate={setBulkExpiryDate}
        phoneDeleteConfirmId={phoneDeleteConfirmId}
        setPhoneDeleteConfirmId={setPhoneDeleteConfirmId}
        isDragging={isDragging}
        setIsDragging={setIsDragging}
        fileInputRef={fileInputRef}
        processUploadedFile={processUploadedFile}
        isParsing={isParsing}
        parsingStatus={parsingStatus}
        handleDownloadCsvSample={handleDownloadCsvSample}
        handleDownloadSample={handleDownloadSample}
        handleStartBlankConsignment={handleStartBlankConsignment}
        lastUploadedFile={lastUploadedFile}
        fileName={fileName}
        updateRowField={updateRowField}
        handleCatalogMappingChange={handleCatalogMappingChange}
        handleDeleteRow={handleDeleteRow}
        handleAddNewRow={handleAddNewRow}
        handleAutoGenerateAllBatches={handleAutoGenerateAllBatches}
        handleApplyBulkScheme={handleApplyBulkScheme}
        handleConfirmAndPostGrn={handleConfirmAndPostGrn}
        handleImportWithWarning={handleImportWithWarning}
      />
    );
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Bulk inward"
      id="modal-bulk-inward"
      className={
        isMaximized
          ? 'fixed inset-0 z-50 flex flex-col bg-[#faf8f5] overflow-hidden'
          : 'fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-3 bg-slate-900/40 overflow-hidden'
      }
    >
      <div
        className={
          isMaximized
            ? 'w-full h-full flex flex-col overflow-hidden bg-[#faf8f5]'
            : 'bg-[#faf8f5] w-full max-w-[99vw] xl:max-w-[98vw] 2xl:max-w-[1850px] h-[96vh] sm:h-[96vh] max-h-[96vh] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-black/5 flex flex-col overflow-hidden'
        }
      >
        <BulkInwardDesktopHeader
          step={step}
          setStep={setStep}
          rowsCount={rows.length}
          totalReceivedQty={totalReceivedQty}
          fileName={fileName}
          isUpperDetailsExpanded={isUpperDetailsExpanded}
          setIsUpperDetailsExpanded={setIsUpperDetailsExpanded}
          isMaximized={isMaximized}
          setIsMaximized={setIsMaximized}
          onClose={onClose}
        />

        {parseError && (
          <BulkInwardParseErrorBanner
            parseError={parseError}
            setParseError={setParseError}
            lastUploadedFile={lastUploadedFile}
            isParsing={isParsing}
            processUploadedFile={processUploadedFile}
            handleStartBlankConsignment={handleStartBlankConsignment}
            handleDownloadSample={handleDownloadSample}
          />
        )}

        {/* ======================================================== */}
        {/* STEP 1: UPLOAD / DRAG & DROP / TEMPLATE DOWNLOAD         */}
        {/* ======================================================== */}
        {step === 'upload' && (
          <UploadStep
            isDragging={isDragging}
            setIsDragging={setIsDragging}
            fileInputRef={fileInputRef}
            processUploadedFile={processUploadedFile}
            isParsing={isParsing}
            parsingStatus={parsingStatus}
            handleDownloadCsvSample={handleDownloadCsvSample}
            handleDownloadSample={handleDownloadSample}
            handleStartBlankConsignment={handleStartBlankConsignment}
          />
        )}

        {/* ======================================================== */}
        {/* STEP 2: FULL REVIEW & EDIT WORKSPACE                      */}
        {/* ======================================================== */}
        {step === 'review' && (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* ======================================================== */}
            {/* UPPER DETAILS: CONTRACTED STRIP VS EXPANDED CONTROLS     */}
            {/* ======================================================== */}

            <BulkInwardDesktopHeaderPanels
              paletteLine={palette.line}
              warehouses={warehouses}
              knownSuppliers={knownSuppliers}
              applySupplierAutofill={applySupplierAutofill}
              supplierName={supplierName}
              setSupplierName={setSupplierName}
              supplierPhone={supplierPhone}
              setSupplierPhone={setSupplierPhone}
              supplierPhoneError={supplierPhoneError}
              supplierGstin={supplierGstin}
              setSupplierGstin={setSupplierGstin}
              supplierAddress={supplierAddress}
              setSupplierAddress={setSupplierAddress}
              supplierEmail={supplierEmail}
              setSupplierEmail={setSupplierEmail}
              invoiceNo={invoiceNo}
              setInvoiceNo={setInvoiceNo}
              inwardDate={inwardDate}
              setInwardDate={setInwardDate}
              targetWarehouseId={targetWarehouseId}
              setTargetWarehouseId={setTargetWarehouseId}
              overallDiscount={overallDiscount}
              setOverallDiscount={setOverallDiscount}
              originalInvoiceTotal={originalInvoiceTotal}
              setOriginalInvoiceTotal={setOriginalInvoiceTotal}
              detectedSource={detectedSource}
              isUpperDetailsExpanded={isUpperDetailsExpanded}
              setIsUpperDetailsExpanded={setIsUpperDetailsExpanded}
              showProviderDetails={showProviderDetails}
              setShowProviderDetails={setShowProviderDetails}
              showInwardCostDetails={showInwardCostDetails}
              setShowInwardCostDetails={setShowInwardCostDetails}
              freightCost={freightCost}
              setFreightCost={setFreightCost}
              loadingLabourCost={loadingLabourCost}
              setLoadingLabourCost={setLoadingLabourCost}
              unloadingLabourCost={unloadingLabourCost}
              setUnloadingLabourCost={setUnloadingLabourCost}
              transportCost={transportCost}
              setTransportCost={setTransportCost}
              otherInwardCost={otherInwardCost}
              setOtherInwardCost={setOtherInwardCost}
              totalInwardCost={totalInwardCost}
              inwardCostPerCrate={inwardCostPerCrate}
              rowsCount={rows.length}
              totalReceivedQty={totalReceivedQty}
              totalInvoicePrintedQty={totalInvoicePrintedQty}
              printedTotalCases={printedTotalCases}
              hasCasesMismatch={hasCasesMismatch}
              casesDiff={casesDiff}
              totalSupplierSchemeBonusQty={totalSupplierSchemeBonusQty}
              showMismatchDetail={showMismatchDetail}
              setShowMismatchDetail={setShowMismatchDetail}
              calculatedGrandTotal={calculatedGrandTotal}
              amountDiff={amountDiff}
              hasAmountMismatch={hasAmountMismatch}
              totalTax={totalTax}
              showAmountMismatchDetail={showAmountMismatchDetail}
              setShowAmountMismatchDetail={setShowAmountMismatchDetail}
              handleBulkSetListPriceGst={handleBulkSetListPriceGst}
              attentionCount={attentionCount}
              missingExpiryCount={missingExpiryCount}
              missingBatchCount={missingBatchCount}
              filterAttentionOnly={filterAttentionOnly}
              setFilterAttentionOnly={setFilterAttentionOnly}
              setFilterNewOnly={setFilterNewOnly}
              setFilterSchemeOnly={setFilterSchemeOnly}
              aiWarnings={aiWarnings}
            />

            {/* REVIEW TOOLBAR — one row: search • filters • bulk expiry • view • actions */}
            <BulkInwardDesktopToolbar
              paletteLine={palette.line}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              filterNewOnly={filterNewOnly}
              setFilterNewOnly={setFilterNewOnly}
              filterSchemeOnly={filterSchemeOnly}
              setFilterSchemeOnly={setFilterSchemeOnly}
              filterAttentionOnly={filterAttentionOnly}
              setFilterAttentionOnly={setFilterAttentionOnly}
              rows={rows}
              newProductsCount={newProductsCount}
              itemsWithSchemeCount={itemsWithSchemeCount}
              attentionCount={attentionCount}
              bulkExpiryDate={bulkExpiryDate}
              setBulkExpiryDate={setBulkExpiryDate}
              missingExpiryCount={missingExpiryCount}
              handleFillEmptyExpiry={handleFillEmptyExpiry}
              viewMode={viewMode}
              setViewMode={setViewMode}
              density={density}
              setDensity={setDensity}
              handleBulkSetListPriceGst={handleBulkSetListPriceGst}
              handleAutoGenerateAllBatches={handleAutoGenerateAllBatches}
              onOpenBulkSchemeModal={() => setShowBulkSchemeModal(true)}
              handleAddNewRow={handleAddNewRow}
              supplierName={supplierName}
              invoiceNo={invoiceNo}
              inwardDate={inwardDate}
              targetWarehouseId={targetWarehouseId}
              warehouses={warehouses}
            />

            {/* REVIEW ITEMS DISPLAY (RESPONSIVE CARDS OR SPREADSHEET TABLE) */}
            <div className={`flex-1 min-h-0 bg-slate-100/60 ${viewMode === 'table' ? 'overflow-hidden p-1.5 sm:p-2' : 'overflow-y-auto p-2 sm:p-3'}`}>
              {viewMode === 'cards' ? (
                <div className="space-y-3 min-w-0">
                  {filteredRows.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
                      <p className="text-sm font-semibold">No products match the active filters or search query.</p>
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          setFilterNewOnly(false);
                          setFilterSchemeOnly(false);
                        }}
                        className="mt-2 text-xs font-bold text-indigo-600 underline cursor-pointer"
                      >
                        Reset filters
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-2.5 sm:gap-3 min-w-0">
                      {filteredRows.map((r, idx) => (
                        <InwardProductCard
                          key={r.id}
                          row={r}
                          index={idx}
                          products={products}
                          inwardCostPerCrate={inwardCostPerCrate}
                          inwardDate={inwardDate}
                          isExpanded={expandedCardId === r.id}
                          onToggleExpand={() =>
                            setExpandedCardId(expandedCardId === r.id ? null : r.id)
                          }
                          onUpdateField={(field, val) => updateRowField(r.id, field as keyof EditableInwardRow, val)}
                          onCatalogMappingChange={(val) => handleCatalogMappingChange(r.id, val)}
                          onDuplicate={() => handleDuplicateRow(r.id)}
                          onDelete={() => handleDeleteRow(r.id)}
                          money={money}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <BulkInwardDesktopTable
                  paletteLine={palette.line}
                  filteredRows={filteredRows}
                  rows={rows}
                  products={products}
                  supplierSchemes={supplierSchemes}
                  inwardDate={inwardDate}
                  inwardCostPerCrate={inwardCostPerCrate}
                  density={density}
                  expandedRowId={expandedRowId}
                  setExpandedRowId={setExpandedRowId}
                  catalogPickerRowId={catalogPickerRowId}
                  setCatalogPickerRowId={setCatalogPickerRowId}
                  catalogPickerSearch={catalogPickerSearch}
                  setCatalogPickerSearch={setCatalogPickerSearch}
                  volumePickerRowId={volumePickerRowId}
                  setVolumePickerRowId={setVolumePickerRowId}
                  updateRowField={updateRowField}
                  handleCatalogMappingChange={handleCatalogMappingChange}
                  handleDuplicateRow={handleDuplicateRow}
                  handleDeleteRow={handleDeleteRow}
                  onResetFilters={() => {
                    setSearchQuery('');
                    setFilterNewOnly(false);
                    setFilterSchemeOnly(false);
                    setFilterAttentionOnly(false);
                  }}
                />
              )}
            </div>

            <BulkInwardDesktopFooter
              paletteLine={palette.line}
              hasCasesMismatch={hasCasesMismatch}
              totalInvoicePrintedQty={totalInvoicePrintedQty}
              printedTotalCases={printedTotalCases}
              casesDiff={casesDiff}
              warehouses={warehouses}
              targetWarehouseId={targetWarehouseId}
              rowsCount={rows.length}
              totalReceivedQty={totalReceivedQty}
              onClose={onClose}
              onOpenConfirm={() => setShowConfirmStep(true)}
            />
          </div>
        )}

        <BulkInwardDesktopModals
          rows={rows}
          warehouses={warehouses}
          supplierName={supplierName}
          supplierPhone={supplierPhone}
          invoiceNo={invoiceNo}
          inwardDate={inwardDate}
          targetWarehouseId={targetWarehouseId}
          totalReceivedQty={totalReceivedQty}
          calculatedGrandTotal={calculatedGrandTotal}
          totalInwardCost={totalInwardCost}
          totalLandedInventoryValue={totalLandedInventoryValue}
          inwardCostPerCrate={inwardCostPerCrate}
          printedTotalCases={printedTotalCases}
          hasCasesMismatch={hasCasesMismatch}
          casesDiff={casesDiff}
          showConfirmStep={showConfirmStep}
          setShowConfirmStep={setShowConfirmStep}
          confirmQuery={confirmQuery}
          setConfirmQuery={setConfirmQuery}
          confirmDeleteId={confirmDeleteId}
          setConfirmDeleteId={setConfirmDeleteId}
          setExpandedRowId={setExpandedRowId}
          setExpandedCardId={setExpandedCardId}
          handleDeleteRow={handleDeleteRow}
          handleConfirmAndPostGrn={handleConfirmAndPostGrn}
          showWarningDialog={showWarningDialog}
          setShowWarningDialog={setShowWarningDialog}
          warningNote={warningNote}
          setWarningNote={setWarningNote}
          handleImportWithWarning={handleImportWithWarning}
          showBulkSchemeModal={showBulkSchemeModal}
          setShowBulkSchemeModal={setShowBulkSchemeModal}
          bulkSchemeType={bulkSchemeType}
          setBulkSchemeType={setBulkSchemeType}
          bulkSchemeValue={bulkSchemeValue}
          setBulkSchemeValue={setBulkSchemeValue}
          bulkSchemeName={bulkSchemeName}
          setBulkSchemeName={setBulkSchemeName}
          handleApplyBulkScheme={handleApplyBulkScheme}
        />
      </div>
    </div>
  );
};
