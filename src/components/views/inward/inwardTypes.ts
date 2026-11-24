import { CATS } from '../../../constants/initialData';
import { CategoryKey, GRN, GrnSchemeMode, GrnSchemeType, Product, Taxability } from '../../../types';
import {
  generateBatchNumber,
  resolveProductGstRate,
  resolveProductHsn,
} from '../../../utils/billing';
import { todayISO } from '../../../utils/dateLocal';

export interface InwardConsignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedWarehouseId?: string;
  preselectedProductId?: number;
  initialGrnToEdit?: GRN | null;
  /** Opens bulk CSV/Excel import from the New purchase screen */
  onOpenBulkImport?: () => void;
  onSaved?: (info: {
    grnId?: string;
    grnNumber?: string;
    cases: number;
    warehouseName: string;
    isEdit?: boolean;
  }) => void;
}

export interface KnownSupplier {
  name: string;
  phone?: string;
  gstin?: string;
  address?: string;
  email?: string;
}

export interface DraftLineState {
  id: string;
  isNewProduct: boolean;
  selectedProductId?: number;
  productName: string;
  category: CategoryKey;
  taxability: Taxability;
  hsn: string;
  pack: string;
  volume: number;
  unitsPerCrate: number;
  qty: number;
  unitPrice: number;
  isGstIncluded: boolean;
  cgstPercent: number;
  sgstPercent: number;
  schemeType: GrnSchemeType;
  schemeMode: GrnSchemeMode;
  schemeBuyQty: number;
  schemeFreeQty: number;
  freeQty?: number;
  schemeDiscountPercent: number;
  schemeFlatDiscountPerCase: number;
  expiry: string;
  mfgDate: string;
  batchNumber: string;
  wholesaleRate: number;
  retailRate: number;
  supplierSchemeId?: string;
  supplierSchemeFreeQty?: number;
  pendingCreditSchemeId?: string;
  pendingCreditExpectedAmount?: number;
}

export interface DraftMetrics {
  exGstRate: number;
  discountAmount: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  taxAmount: number;
  lineTotal: number;
  paidQty: number;
  freeQty: number;
  totalReceivedQty: number;
  landedCostPerCrate: number;
  landedCostPerCrateExGst: number;
  landedCostPerBottle: number;
  effectiveCostPerCrateExGst: number;
  effectiveCostPerCrateInclGst: number;
  effectiveCostPerUnit: number;
}

export interface InwardTotals {
  billed: number;
  free: number;
  paid: number;
  totalCases: number;
  taxable: number;
  cgst: number;
  sgst: number;
  savings: number;
  grand: number;
}

export const defaultLineState = (category: CategoryKey = 'energy'): DraftLineState => {
  const catDef = CATS[category] || { name: 'Energy & Boost', hsn: '22021090', gst: 0.4 };
  const halfTax = Math.round(((catDef.gst * 100) / 2) * 10) / 10;

  return {
    id: 'draft_' + Math.random().toString(36).slice(2, 8),
    isNewProduct: true,
    selectedProductId: undefined,
    productName: '',
    category,
    taxability: 'taxable',
    hsn: catDef.hsn,
    pack: 'PET',
    volume: 150,
    unitsPerCrate: 24,
    qty: 50,
    unitPrice: 158.57,
    isGstIncluded: false,
    cgstPercent: halfTax,
    sgstPercent: halfTax,
    schemeType: 'none',
    schemeMode: 'inclusive',
    schemeBuyQty: 2,
    schemeFreeQty: 1,
    freeQty: 0,
    schemeDiscountPercent: 0,
    schemeFlatDiscountPerCase: 0,
    expiry: '2026-10-31',
    mfgDate: todayISO(),
    batchNumber: '',
    wholesaleRate: 175,
    retailRate: 190,
  };
};

export const createDraftFromProduct = (p: Product): DraftLineState => {
  const isNonGst = p.taxability === 'non_gst';
  const halfTax = isNonGst ? 0 : Math.round(((resolveProductGstRate(p) * 100) / 2) * 10) / 10;
  return {
    id: `line-${Date.now()}`,
    isNewProduct: false,
    selectedProductId: p.id,
    productName: p.name,
    category: p.category,
    taxability: isNonGst ? 'non_gst' : 'taxable',
    hsn: resolveProductHsn(p),
    pack: p.pack || 'PET',
    volume: p.volume || 150,
    unitsPerCrate: p.unitsPerCrate || 24,
    qty: 24,
    unitPrice: p.cost || 210,
    isGstIncluded: !isNonGst && !!p.ratesIncludeGst,
    cgstPercent: halfTax,
    sgstPercent: halfTax,
    schemeType: 'none',
    schemeMode: 'inclusive',
    schemeBuyQty: 2,
    schemeFreeQty: 1,
    schemeDiscountPercent: 0,
    schemeFlatDiscountPerCase: 0,
    expiry: p.expiry || '',
    mfgDate: p.mfgDate || todayISO(),
    batchNumber: generateBatchNumber(p.name),
    wholesaleRate: p.wholesale || 235,
    retailRate: p.retail || 240,
  };
};
