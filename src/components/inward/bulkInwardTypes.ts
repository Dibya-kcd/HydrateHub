import { CATS } from '../../constants/initialData';
import { CategoryKey, GrnLineItem, GrnSchemeMode, GrnSchemeType, Product, Taxability } from '../../types';
import {
  calculateLandedCostBreakdown,
  generateAutoSku,
  generateBatchNumber,
  gstRateFromHsn,
  inferUnitsPerCase,
  normalizeTo8DigitHsn,
} from '../../utils/billing';
import {
  detectCategory,
  detectPackAndVolume,
  matchProductCatalog,
  ParsedInvoiceItem,
} from '../../utils/invoiceParser';
import { todayISO } from '../../utils/dateLocal';

export interface EditableInwardRow {
  id: string;
  rawName: string;
  productName: string;
  category: CategoryKey;
  taxability?: Taxability;
  pack: string;
  volume: number;
  packSize?: string;
  unitsPerCrate?: number;
  hsn: string;
  qty: number;
  freeQty: number;
  paidQty?: number;
  unitPrice: number;
  listPrice?: number;
  isGstIncluded?: boolean;
  calculatedGstAmount?: number;
  priceInclGst?: number;

  // Scheme & Discount
  schemeType: GrnSchemeType;
  schemeMode?: GrnSchemeMode;
  schemeBuyQty?: number;
  schemeFreeQty?: number;
  discountPercent: number;
  discountFlat: number;
  discountAmount: number;
  schemeText: string;

  // Supplier Scheme (additive layer — separate from schemeType/freeQty above)
  supplierSchemeId?: string;
  supplierSchemeFreeQty?: number;
  pendingCreditSchemeId?: string;
  pendingCreditExpectedAmount?: number;

  // Taxes
  cgstPercent: number;
  sgstPercent: number;

  // Pricing & Batches
  wholesaleRate: number;
  retailRate: number;
  batchNumber: string;
  expiry: string;
  mfgDate: string;

  // Catalog Matching
  isNewProduct: boolean;
  matchedProductId?: number;
  matchedProductName?: string;
  existingStock?: number;
}

export interface KnownSupplier {
  name: string;
  phone?: string;
  gstin?: string;
  address?: string;
  email?: string;
}

export function calcInwardRowBreakdown(r: EditableInwardRow, inwardCostPerCrate: number) {
  const isNonGst = r.taxability === 'non_gst';
  return calculateLandedCostBreakdown({
    qty: r.qty,
    unitPrice: r.unitPrice,
    unitsPerCrate: r.unitsPerCrate || inferUnitsPerCase(`${r.productName || ''} ${r.rawName || ''} ${r.pack || ''}`, r.volume),
    pack: r.pack,
    volume: r.volume,
    packSize: r.packSize,
    cgstPercent: isNonGst ? 0 : r.cgstPercent,
    sgstPercent: isNonGst ? 0 : r.sgstPercent,
    schemeType: r.schemeType,
    schemeMode: r.schemeMode || 'inclusive',
    schemeBuyQty: r.schemeBuyQty,
    schemeFreeQty: r.schemeFreeQty,
    freeQty: r.freeQty,
    paidQty: r.paidQty,
    discountPercent: r.discountPercent,
    discountFlat: r.discountFlat,
    discountAmount: r.discountAmount,
    inwardCostPerCrate,
  });
}

export function mapParsedInvoiceItemsToRows(
  items: ParsedInvoiceItem[],
  products: Product[],
  remainingStock: (id: number) => number,
  batchRefDate: string,
): EditableInwardRow[] {
  return items.map((item, idx) => {
    // Re-verify against live catalog to be 100% accurate (checking rawName first, then productName fallback)
    let matchRes = matchProductCatalog(item.rawName || '', products);
    if (!matchRes.matchedProduct && item.productName && item.productName.trim() !== (item.rawName || '').trim()) {
      const alt = matchProductCatalog(item.productName, products);
      if (alt.matchedProduct) matchRes = alt;
    }
    const { isNewProduct, matchedProduct } = matchRes;

    const isNonGst = matchedProduct?.taxability === 'non_gst' || item.taxability === 'non_gst';
    const qty = Math.max(1, item.qty || 1);
    const unitPrice = Math.max(0, item.unitPrice || 0);
    const volume = matchedProduct?.volume || item.volume || 150;
    const pack = matchedProduct?.pack || item.pack || 'PET';
    const unitsPerCrate = item.unitsPerCrate || inferUnitsPerCase(`${item.rawName || ''} ${item.pack || ''}`, volume);
    const packSize = item.packSize || `${volume}ml ${pack}`;
    const cgstPercent = isNonGst ? 0 : (item.cgstPercent ?? 20);
    const sgstPercent = isNonGst ? 0 : (item.sgstPercent ?? 20);

    let schemeType: GrnSchemeType = item.schemeType || 'none';
    const schemeMode: GrnSchemeMode = 'inclusive';
    let schemeBuyQty = item.schemeBuyQty ?? (schemeType === 'b2g1' ? 2 : undefined);
    let schemeFreeQty = item.schemeFreeQty ?? (schemeType === 'b2g1' ? 1 : undefined);
    const freeQty = item.freeQty !== undefined ? Math.max(0, item.freeQty) : undefined;

    if (schemeType === 'b2g1') {
      schemeBuyQty = schemeBuyQty || 2;
      schemeFreeQty = schemeFreeQty || 1;
    } else if (freeQty !== undefined && freeQty > 0 && schemeType === 'none') {
      schemeType = 'free_cases';
    } else if (item.discountPercent > 0 && schemeType === 'none') {
      schemeType = 'discount_percent';
    }

    const breakdown = calculateLandedCostBreakdown({
      qty,
      unitPrice,
      unitsPerCrate,
      pack,
      volume,
      packSize,
      cgstPercent,
      sgstPercent,
      schemeType,
      schemeMode,
      schemeBuyQty,
      schemeFreeQty,
      freeQty,
      discountPercent: item.discountPercent || 0,
      discountFlat: item.discountFlat || 0,
      discountAmount: item.discountAmount || 0,
    });

    return {
      id: `row_${Date.now()}_${idx}`,
      rawName: item.rawName,
      productName: (matchedProduct ? matchedProduct.name : item.productName || item.rawName).trim().toUpperCase(),
      category: matchedProduct?.category || item.category || detectCategory(item.rawName),
      taxability: isNonGst ? 'non_gst' : 'taxable',
      pack,
      volume,
      packSize,
      unitsPerCrate,
      hsn: normalizeTo8DigitHsn(
        matchedProduct?.hsn || item.hsn,
        matchedProduct?.category || item.category,
        item.rawName,
        isNonGst ? 'non_gst' : 'taxable'
      ),
      qty,
      freeQty: breakdown.freeQty,
      paidQty: breakdown.paidQty,
      unitPrice,
      schemeType,
      schemeMode,
      schemeBuyQty,
      schemeFreeQty,
      discountPercent: item.discountPercent || 0,
      discountFlat: item.discountFlat || 0,
      discountAmount: breakdown.discountAmount,
      schemeText: item.schemeDescription || breakdown.schemeLabel,
      cgstPercent,
      sgstPercent,
      wholesaleRate: matchedProduct?.wholesale || Math.round(breakdown.effectiveCostPerCrateInclGst * 1.15) || Math.round(unitPrice * 1.15),
      retailRate: matchedProduct?.retail || Math.round(breakdown.effectiveCostPerCrateInclGst * 1.25) || Math.round(unitPrice * 1.25),
      listPrice: item.listPrice !== undefined ? item.listPrice : item.unitPrice,
      isGstIncluded: isNonGst ? false : (item.isGstIncluded ?? true),
      calculatedGstAmount: isNonGst ? 0 : (item.calculatedGstAmount !== undefined ? item.calculatedGstAmount : (item.unitPrice * (cgstPercent + sgstPercent) / 100)),
      priceInclGst: isNonGst ? unitPrice : (item.priceInclGst !== undefined ? item.priceInclGst : (item.unitPrice * (1 + (cgstPercent + sgstPercent) / 100))),
      batchNumber: (() => {
        const existingBatches = products.map((p) => p.batchNumber).filter(Boolean) as string[];
        const isOldBatch = item.batchNumber ? existingBatches.includes(item.batchNumber) : false;
        return (!item.batchNumber || isOldBatch)
          ? generateBatchNumber(matchedProduct ? matchedProduct.name : item.productName || item.rawName, undefined, existingBatches, idx, batchRefDate)
          : item.batchNumber;
      })(),
      expiry: item.expiryDate || '',
      mfgDate: item.mfgDate || todayISO(),
      isNewProduct,
      matchedProductId: matchedProduct?.id,
      matchedProductName: matchedProduct?.name,
      existingStock: matchedProduct ? remainingStock(matchedProduct.id) : undefined,
    };
  });
}

export function computeUpdatedInwardRow(
  r: EditableInwardRow,
  field: keyof EditableInwardRow,
  val: any,
  products: Product[],
  remainingStock: (id: number) => number,
  inwardCostPerCrate: number,
): EditableInwardRow {
  const updated = { ...r, [field]: val };

  if (field === 'taxability') {
    if (val === 'non_gst') {
      updated.cgstPercent = 0;
      updated.sgstPercent = 0;
      updated.isGstIncluded = false;
    } else {
      const inferred = updated.hsn?.length === 8 ? gstRateFromHsn(updated.hsn) : null;
      const catFrac = inferred ?? CATS[updated.category]?.gst ?? 0.18;
      const half = Math.round((catFrac * 100) / 2 * 10) / 10;
      if ((updated.cgstPercent || 0) === 0 && (updated.sgstPercent || 0) === 0) {
        updated.cgstPercent = half;
        updated.sgstPercent = half;
      }
    }
  }

  const isNonGst = updated.taxability === 'non_gst';

  // Auto-recalculate line financial values
  const qty = Math.max(1, Number(field === 'qty' ? val : updated.qty) || 1);
  let unitPrice = Math.max(0, Number(field === 'unitPrice' ? val : updated.unitPrice) || 0);
  let listPrice = updated.listPrice !== undefined ? Number(updated.listPrice) : Number(updated.unitPrice) || 0;
  let isGstIncluded = isNonGst
    ? false
    : updated.isGstIncluded !== undefined
    ? Boolean(updated.isGstIncluded)
    : false;
  const cgstPercent = isNonGst ? 0 : (Number(field === 'cgstPercent' ? val : updated.cgstPercent) || 0);
  const sgstPercent = isNonGst ? 0 : (Number(field === 'sgstPercent' ? val : updated.sgstPercent) || 0);
  const schemeType = (field === 'schemeType' ? val : updated.schemeType) as GrnSchemeType;
  const schemeMode: GrnSchemeMode = 'inclusive';

  let schemeBuyQty = Number(field === 'schemeBuyQty' ? val : updated.schemeBuyQty) || 2;
  let schemeFreeQty = Number(field === 'schemeFreeQty' ? val : updated.schemeFreeQty) || 1;

  if (field === 'schemeType') {
    if (val === 'b2g1') {
      schemeBuyQty = 2;
      schemeFreeQty = 1;
      updated.schemeBuyQty = 2;
      updated.schemeFreeQty = 1;
      updated.discountPercent = 0;
      updated.discountFlat = 0;
    } else if (val === 'none') {
      updated.freeQty = 0;
      updated.schemeBuyQty = undefined;
      updated.schemeFreeQty = undefined;
      updated.schemeText = '';
      updated.discountPercent = 0;
      updated.discountFlat = 0;
    } else if (val === 'free_cases') {
      updated.discountPercent = 0;
      updated.discountFlat = 0;
    }
  }

  if (field === 'volume') {
    const vol = Math.max(50, Number(val) || 250);
    updated.volume = vol;
    updated.packSize = `${vol}ml ${updated.pack || 'PET'}`;
    updated.unitsPerCrate = inferUnitsPerCase(`${updated.productName} ${updated.pack || ''}`, vol);
  } else if (field === 'pack') {
    const pk = String(val);
    updated.pack = pk;
    updated.packSize = `${updated.volume || 250}ml ${pk}`;
    updated.unitsPerCrate = inferUnitsPerCase(`${updated.productName} ${pk}`, updated.volume);
  } else if (field === 'productName') {
    const newName = String(val).toUpperCase();
    updated.productName = newName;
    const matchRes = matchProductCatalog(newName, products);
    if (matchRes.matchedProduct) {
      const mp = matchRes.matchedProduct;
      updated.matchedProductId = mp.id;
      updated.matchedProductName = mp.name;
      updated.isNewProduct = false;
      updated.volume = mp.volume || updated.volume;
      updated.pack = mp.pack || updated.pack;
      updated.category = mp.category || updated.category;
      updated.taxability = mp.taxability === 'non_gst' ? 'non_gst' : updated.taxability;
      updated.hsn = mp.taxability === 'non_gst' ? (mp.hsn || '') : (mp.hsn || updated.hsn);
      if (mp.taxability === 'non_gst') {
        updated.cgstPercent = 0;
        updated.sgstPercent = 0;
        isGstIncluded = false;
      }
      updated.unitsPerCrate = mp.unitsPerCrate || inferUnitsPerCase(mp.name, mp.volume);
      updated.packSize = mp.packSize || `${mp.volume}ml ${mp.pack}`;
      updated.existingStock = remainingStock(mp.id);
      if (mp.wholesale) updated.wholesaleRate = mp.wholesale;
      if (mp.retail) updated.retailRate = mp.retail;
    } else {
      const detectedPackVol = detectPackAndVolume(newName);
      if (detectedPackVol.volume) {
        updated.volume = detectedPackVol.volume;
        updated.pack = detectedPackVol.pack;
        updated.packSize = `${detectedPackVol.volume}ml ${detectedPackVol.pack}`;
        updated.unitsPerCrate = inferUnitsPerCase(newName, detectedPackVol.volume);
      }
    }
  }

  if (field === 'listPrice') {
    listPrice = Math.max(0, Number(val) || 0);
    updated.listPrice = listPrice;
  } else if (field === 'isGstIncluded') {
    isGstIncluded = isNonGst ? false : Boolean(val);
    updated.isGstIncluded = isGstIncluded;
  }

  const totalTaxRate = isNonGst ? 0 : (cgstPercent + sgstPercent) / 100;
  let calculatedGst = 0;
  let priceInclGst = listPrice;

  if (isNonGst || !isGstIncluded) {
    calculatedGst = listPrice * totalTaxRate;
    priceInclGst = listPrice + calculatedGst;
    unitPrice = listPrice;
  } else {
    unitPrice = totalTaxRate > 0 ? listPrice / (1 + totalTaxRate) : listPrice;
    calculatedGst = listPrice - unitPrice;
    priceInclGst = listPrice;
  }

  updated.cgstPercent = cgstPercent;
  updated.sgstPercent = sgstPercent;
  updated.listPrice = listPrice;
  updated.isGstIncluded = isGstIncluded;
  updated.calculatedGstAmount = calculatedGst;
  updated.priceInclGst = priceInclGst;
  updated.unitPrice = unitPrice;

  const b = calculateLandedCostBreakdown({
    qty,
    unitPrice,
    unitsPerCrate: updated.unitsPerCrate || 24,
    pack: updated.pack,
    volume: updated.volume,
    packSize: updated.packSize,
    cgstPercent,
    sgstPercent,
    schemeType,
    schemeMode,
    schemeBuyQty,
    schemeFreeQty,
    freeQty: field === 'freeQty' ? Number(val) : (field === 'schemeType' && val === 'none' ? 0 : undefined),
    paidQty: field === 'paidQty' ? Number(val) : undefined,
    discountPercent: Number(field === 'discountPercent' ? val : updated.discountPercent) || 0,
    discountFlat: Number(field === 'discountFlat' ? val : updated.discountFlat) || 0,
    discountAmount: field === 'discountAmount' ? Number(val) : undefined,
    inwardCostPerCrate,
  });

  updated.qty = qty;
  updated.schemeType = schemeType;
  updated.schemeMode = schemeMode;
  updated.freeQty = b.freeQty;
  updated.paidQty = b.paidQty;
  updated.discountAmount = b.discountAmount;
  updated.schemeText = b.schemeLabel;

  const landedCost = b.landedCostPerCrate;

  if (
    field === 'unitPrice' ||
    field === 'listPrice' ||
    field === 'isGstIncluded' ||
    field === 'taxability' ||
    field === 'qty' ||
    field === 'freeQty' ||
    field === 'discountPercent' ||
    field === 'discountFlat' ||
    field === 'schemeType' ||
    field === 'schemeMode' ||
    field === 'schemeBuyQty' ||
    field === 'schemeFreeQty'
  ) {
    if (!updated.wholesaleRate || updated.wholesaleRate < landedCost) {
      updated.wholesaleRate = Math.round(landedCost * 1.15);
    }
    if (!updated.retailRate || updated.retailRate < updated.wholesaleRate) {
      updated.retailRate = Math.round(landedCost * 1.25);
    }
  }

  return updated;
}

export function buildGrnLineItemsFromRows(
  rows: EditableInwardRow[],
  inwardCostPerCrate: number,
  perCaseFreight: number,
  perCaseLabour: number,
): GrnLineItem[] {
  return rows.map((r, idx) => {
    const isNonGst = r.taxability === 'non_gst';
    const unitsPerCrate = r.unitsPerCrate || inferUnitsPerCase(`${r.productName || ''} ${r.rawName || ''} ${r.pack || ''}`, r.volume);
    const cg = isNonGst ? 0 : r.cgstPercent;
    const sg = isNonGst ? 0 : r.sgstPercent;
    const breakdown = calculateLandedCostBreakdown({
      qty: r.qty,
      unitPrice: r.unitPrice,
      unitsPerCrate,
      pack: r.pack,
      volume: r.volume,
      packSize: r.packSize,
      cgstPercent: cg,
      sgstPercent: sg,
      schemeType: r.schemeType,
      schemeMode: r.schemeMode || 'inclusive',
      schemeBuyQty: r.schemeBuyQty,
      schemeFreeQty: r.schemeFreeQty,
      freeQty: r.freeQty,
      paidQty: r.paidQty,
      discountPercent: r.discountPercent,
      discountFlat: r.discountFlat,
      discountAmount: r.discountAmount,
      inwardCostPerCrate,
    });

    return {
      id: `grn_item_${Date.now()}_${idx}`,
      isNewProduct: r.isNewProduct,
      productId: r.isNewProduct ? undefined : r.matchedProductId,
      productName: r.productName.trim().toUpperCase(),
      category: r.category,
      taxability: isNonGst ? 'non_gst' : 'taxable',
      sku: generateAutoSku(r.productName, r.category, idx + 100),
      hsn: normalizeTo8DigitHsn(r.hsn, r.category, r.productName, isNonGst ? 'non_gst' : 'taxable'),
      pack: r.pack,
      volume: r.volume,
      packSize: r.packSize || `${r.volume}ml ${r.pack}`,
      unitsPerCrate,
      qty: r.qty,
      unitPrice: r.unitPrice,
      schemeType: r.schemeType,
      schemeMode: r.schemeMode || 'inclusive',
      schemeBuyQty: r.schemeBuyQty,
      schemeFreeQty: r.schemeFreeQty,
      freeQty: breakdown.freeQty,
      paidQty: breakdown.paidQty,
      discountPercent: r.discountPercent,
      discountFlat: r.discountFlat,
      discountAmount: breakdown.discountAmount,
      schemeText:
        r.schemeText ||
        (r.schemeType === 'b2g1'
          ? `Buy ${r.schemeBuyQty || 2} Get ${r.schemeFreeQty || 1} Free`
          : r.freeQty > 0
          ? `+${r.freeQty} Free Crates`
          : ''),
      taxableAmount: breakdown.taxableAmount,
      cgstPercent: cg,
      sgstPercent: sg,
      cgstAmount: breakdown.cgstAmount,
      sgstAmount: breakdown.sgstAmount,
      taxAmount: breakdown.taxAmount,
      lineTotal: breakdown.lineTotal,
      totalReceivedQty: breakdown.totalReceivedQty,
      invoiceRateExGst: breakdown.invoiceRateExGst,
      invoiceRateInclGst: breakdown.invoiceRateInclGst,
      gstPercent: breakdown.gstPercent,
      gstAmountPerCrate: breakdown.gstAmountPerCrate,
      effectiveCostPerCrateExGst: breakdown.effectiveCostPerCrateExGst,
      effectiveCostPerCrateInclGst: breakdown.effectiveCostPerCrateInclGst,
      effectiveUnitRateExGst: breakdown.effectiveUnitRateExGst,
      effectiveUnitRateInclGst: breakdown.effectiveUnitRateInclGst,
      landedCostPerCrate: breakdown.landedCostPerCrate,
      landedCostPerCrateExGst: breakdown.landedCostPerCrateExGst,
      landedCostPerUnit: breakdown.landedCostPerUnit,
      effectiveCostPerUnit: breakdown.effectiveCostPerCrateExGst,
      inwardCostPerCrate: breakdown.inwardCostPerCrate,
      freightCost: perCaseFreight,
      labourCost: perCaseLabour,
      finalLandedCostPerUnit: breakdown.landedCostPerUnit,
      expiry: r.expiry,
      mfgDate: r.mfgDate,
      batchNumber: r.batchNumber,
      wholesaleRate: r.wholesaleRate,
      retailRate: r.retailRate,
      notes: r.isNewProduct ? 'Auto-created new product line from inward bill' : undefined,
      supplierSchemeId: r.supplierSchemeId,
      supplierSchemeFreeQty: r.supplierSchemeId ? r.supplierSchemeFreeQty || 0 : undefined,
      pendingCreditSchemeId: r.pendingCreditSchemeId,
      pendingCreditEligibleQty: r.pendingCreditSchemeId ? breakdown.paidQty : undefined,
      pendingCreditExpectedAmount: r.pendingCreditSchemeId ? r.pendingCreditExpectedAmount || 0 : undefined,
    };
  });
}
