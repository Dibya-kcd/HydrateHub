import { GrnSchemeType, Product } from '../../types';
import {
  calculateLandedCostBreakdown,
  generateBatchNumber,
  inferUnitsPerCase,
  normalizeTo8DigitHsn,
} from '../../utils/billing';
import { todayISO } from '../../utils/dateLocal';
import type { EditableInwardRow } from './bulkInwardTypes';

export function mapRowCatalogChange(
  rows: EditableInwardRow[],
  rowId: string,
  targetValue: string,
  products: Product[],
  remainingStock: (productId: number) => number,
): EditableInwardRow[] {
  return rows.map((r) => {
    if (r.id !== rowId) return r;
    if (targetValue === 'new_product') {
      return {
        ...r,
        isNewProduct: true,
        matchedProductId: undefined,
        matchedProductName: undefined,
        existingStock: undefined,
      };
    }

    const prodId = parseInt(targetValue, 10);
    const matched = products.find((p) => p.id === prodId);
    if (matched) {
      const isNonGst = matched.taxability === 'non_gst';
      return {
        ...r,
        productName: matched.name.toUpperCase(),
        isNewProduct: false,
        matchedProductId: matched.id,
        matchedProductName: matched.name.toUpperCase(),
        existingStock: remainingStock(matched.id),
        category: matched.category,
        taxability: isNonGst ? 'non_gst' : 'taxable',
        cgstPercent: isNonGst ? 0 : r.cgstPercent,
        sgstPercent: isNonGst ? 0 : r.sgstPercent,
        isGstIncluded: isNonGst ? false : r.isGstIncluded,
        pack: matched.pack,
        volume: matched.volume,
        packSize: matched.packSize || `${matched.volume}ml ${matched.pack}`,
        unitsPerCrate: matched.unitsPerCrate || inferUnitsPerCase(matched.name, matched.volume),
        hsn: normalizeTo8DigitHsn(matched.hsn || r.hsn, matched.category, matched.name, matched.taxability),
        wholesaleRate: matched.wholesale || r.wholesaleRate,
        retailRate: matched.retail || r.retailRate,
      };
    }
    return r;
  });
}

export function duplicateInwardRow(
  rows: EditableInwardRow[],
  rowId: string,
  products: Product[],
  inwardDate: string,
): EditableInwardRow[] {
  const target = rows.find((r) => r.id === rowId);
  if (!target) return rows;
  const existingBatches = [
    ...products.map((p) => p.batchNumber).filter(Boolean),
    ...rows.map((r) => r.batchNumber).filter(Boolean),
  ] as string[];
  const duplicated: EditableInwardRow = {
    ...target,
    id: `row_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    batchNumber: generateBatchNumber(target.productName, undefined, existingBatches, undefined, inwardDate),
  };
  const targetIndex = rows.findIndex((r) => r.id === rowId);
  const updated = [...rows];
  updated.splice(targetIndex + 1, 0, duplicated);
  return updated;
}

export function buildBlankConsignmentRow(
  products: Product[],
  remainingStock: (productId: number) => number,
  inwardDate: string,
): EditableInwardRow {
  const existingBatches = products.map((p) => p.batchNumber).filter(Boolean) as string[];
  const firstProd = products[0];
  const isNonGst = firstProd?.taxability === 'non_gst';
  const unitPrice = firstProd?.cost || 158.57;
  const cgstPercent = isNonGst ? 0 : 20;
  const sgstPercent = isNonGst ? 0 : 20;
  const totalTaxRate = (cgstPercent + sgstPercent) / 100;
  const calculatedGst = unitPrice * totalTaxRate;

  return {
    id: `manual_row_${Date.now()}`,
    rawName: firstProd ? firstProd.name : 'CAMPA POWER UP 150ML PET',
    productName: firstProd ? firstProd.name : 'CAMPA POWER UP 150ML PET',
    category: firstProd?.category || 'energy',
    taxability: isNonGst ? 'non_gst' : 'taxable',
    pack: firstProd?.pack || 'PET',
    volume: firstProd?.volume || 150,
    unitsPerCrate: firstProd?.unitsPerCrate || 24,
    hsn: normalizeTo8DigitHsn(firstProd?.hsn, firstProd?.category, firstProd?.name, firstProd?.taxability),
    qty: 50,
    freeQty: 0,
    unitPrice,
    listPrice: unitPrice,
    isGstIncluded: !isNonGst,
    calculatedGstAmount: calculatedGst,
    priceInclGst: unitPrice + calculatedGst,
    schemeType: 'none',
    discountPercent: 0,
    discountFlat: 0,
    discountAmount: 0,
    schemeText: '',
    cgstPercent,
    sgstPercent,
    wholesaleRate: firstProd?.wholesale || 180,
    retailRate: firstProd?.retail || 200,
    batchNumber: generateBatchNumber(firstProd ? firstProd.name : 'CAMPA', undefined, existingBatches, 0, inwardDate),
    expiry: '',
    mfgDate: todayISO(),
    isNewProduct: !firstProd,
    matchedProductId: firstProd?.id,
    matchedProductName: firstProd?.name,
    existingStock: firstProd ? remainingStock(firstProd.id) : undefined,
  };
}

export function buildNewInwardRow(
  products: Product[],
  rows: EditableInwardRow[],
  inwardDate: string,
): EditableInwardRow {
  const existingBatches = [
    ...products.map((p) => p.batchNumber).filter(Boolean),
    ...rows.map((r) => r.batchNumber).filter(Boolean),
  ] as string[];
  const newId = `manual_row_${Date.now()}`;
  const unitPrice = 158.57;
  const cgstPercent = 20;
  const sgstPercent = 20;
  const totalTaxRate = (cgstPercent + sgstPercent) / 100;
  const calculatedGst = unitPrice * totalTaxRate;

  return {
    id: newId,
    rawName: 'NEW BEVERAGE 150ML PET',
    productName: 'New Beverage 150ml PET',
    category: 'energy',
    taxability: 'taxable',
    pack: 'PET',
    volume: 150,
    unitsPerCrate: 24,
    hsn: '22021090',
    qty: 50,
    freeQty: 0,
    unitPrice,
    listPrice: unitPrice,
    isGstIncluded: true,
    calculatedGstAmount: calculatedGst,
    priceInclGst: unitPrice + calculatedGst,
    schemeType: 'none',
    discountPercent: 0,
    discountFlat: 0,
    discountAmount: 0,
    schemeText: '',
    cgstPercent,
    sgstPercent,
    wholesaleRate: 180,
    retailRate: 200,
    batchNumber: generateBatchNumber('NEW BEVERAGE', undefined, existingBatches, rows.length, inwardDate),
    expiry: '',
    mfgDate: todayISO(),
    isNewProduct: true,
  };
}

export function applyAutoBatchesToRows(
  rows: EditableInwardRow[],
  products: Product[],
  inwardDate: string,
): EditableInwardRow[] {
  const existingBatches = products.map((p) => p.batchNumber).filter(Boolean) as string[];
  const usedInConsignment: string[] = [];
  return rows.map((r, i) => {
    const fresh = generateBatchNumber(
      r.productName || r.rawName,
      undefined,
      [...existingBatches, ...usedInConsignment],
      i,
      inwardDate,
    );
    usedInConsignment.push(fresh);
    return { ...r, batchNumber: fresh };
  });
}

export function applyBulkListPriceGstToRows(
  rows: EditableInwardRow[],
  isIncluded: boolean,
  inwardCostPerCrate: number,
): EditableInwardRow[] {
  return rows.map((r) => {
    const isNonGst = r.taxability === 'non_gst';
    const effectiveIncluded = isNonGst ? false : isIncluded;
    const listP = r.listPrice !== undefined ? r.listPrice : r.unitPrice;
    const totalGstRate = isNonGst ? 0 : (r.cgstPercent + r.sgstPercent) / 100;
    let unitPrice = listP;
    let calculatedGst = 0;
    let priceInclGst = listP;

    if (!effectiveIncluded) {
      calculatedGst = listP * totalGstRate;
      priceInclGst = listP + calculatedGst;
      unitPrice = listP;
    } else {
      unitPrice = totalGstRate > 0 ? listP / (1 + totalGstRate) : listP;
      calculatedGst = listP - unitPrice;
      priceInclGst = listP;
    }

    const b = calculateLandedCostBreakdown({
      qty: r.qty,
      unitPrice,
      unitsPerCrate: r.unitsPerCrate || 24,
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

    return {
      ...r,
      listPrice: listP,
      isGstIncluded: effectiveIncluded,
      calculatedGstAmount: calculatedGst,
      priceInclGst,
      unitPrice,
      freeQty: b.freeQty,
      paidQty: b.paidQty,
      discountAmount: b.discountAmount,
      schemeText: b.schemeLabel,
    };
  });
}

export function applyBulkSchemeToRows(
  rows: EditableInwardRow[],
  bulkSchemeType: GrnSchemeType,
  bulkSchemeValue: number,
  bulkSchemeName: string,
): EditableInwardRow[] {
  return rows.map((r) => {
    let discountPercent = r.discountPercent;
    let discountFlat = r.discountFlat;
    let freeQty = r.freeQty;

    if (bulkSchemeType === 'discount_percent') {
      discountPercent = bulkSchemeValue;
    } else if (bulkSchemeType === 'discount_flat') {
      discountFlat = bulkSchemeValue;
    } else if (bulkSchemeType === 'free_cases') {
      freeQty = Math.floor(r.qty / 10) * Math.max(1, bulkSchemeValue);
    }

    const qty = r.qty;
    const unitPrice = r.unitPrice;
    let discountAmount = 0;
    if (bulkSchemeType === 'discount_percent') {
      discountAmount = (qty * unitPrice * discountPercent) / 100;
    } else if (bulkSchemeType === 'discount_flat') {
      discountAmount = qty * discountFlat;
    }

    return {
      ...r,
      schemeType: bulkSchemeType,
      discountPercent,
      discountFlat,
      freeQty,
      discountAmount,
      schemeText: bulkSchemeName,
    };
  });
}
