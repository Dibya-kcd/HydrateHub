import { GrnSchemeMode, GrnSchemeType } from '../../types';
import { getGstOnFreeCases } from './taxSettingsAndRules';

export interface LandedCostBreakdown {
  // Packaging & quantities
  unitsPerCrate: number;
  packSize: string;
  qty: number; // Invoiced billed crates (e.g. 150)
  paidQty: number; // Charged/paid crates (e.g. 100 out of 150 in inclusive mode)
  freeQty: number; // Free crates (e.g. 50 out of 150 in inclusive mode)
  totalReceivedQty: number; // Total physical crates inwarded into godown
  schemeMode: GrnSchemeMode; // 'inclusive' (default FMCG) vs 'additive'

  // Invoice rates (Audit unchanged, ex-GST & incl-GST)
  invoiceRateExGst: number; // rate ex-GST per crate (unitPrice)
  gstPercent: number; // total GST % (cgst + sgst + igst)
  cgstPercent: number;
  sgstPercent: number;
  /** Inter-state purchase: IGST % instead of CGST + SGST. Optional; absent / 0 = legacy behaviour. */
  igstPercent?: number;
  gstAmountPerCrate: number; // GST ₹ per crate
  invoiceRateInclGst: number; // rate per crate including GST
  invoiceUnitRateBottleExGst: number; // ex-GST rate per individual bottle/unit
  invoiceUnitRateBottleInclGst: number; // rate per bottle/unit including GST

  // Scheme
  schemeType: GrnSchemeType;
  schemeBuyQty: number;
  schemeFreeQty: number;
  discountPercent: number;
  discountFlat: number;
  discountAmount: number;
  schemeLabel: string;

  // Invoice paid / tax totals for line
  taxableAmount: number; // paid base amount
  cgstAmount: number;
  sgstAmount: number;
  igstAmount?: number;
  taxAmount: number;
  lineTotal: number; // paid total amount incl. GST

  // Effective Scheme-Adjusted Purchase Cost (Pre-inward godown costs)
  effectiveCostPerCrateExGst: number; // taxableAmount / totalReceivedQty
  effectiveCostPerCrateInclGst: number; // lineTotal / totalReceivedQty
  effectiveUnitRateExGst: number; // effectiveCostPerCrateExGst / unitsPerCrate
  effectiveUnitRateInclGst: number; // effectiveCostPerCrateInclGst / unitsPerCrate

  // Inward godown cost allocation
  inwardCostPerCrate: number;

  // Final Landed Cost (including all costs into godown)
  landedCostPerCrate: number; // effectiveCostPerCrateInclGst + inwardCostPerCrate (incl-GST)
  landedCostPerCrateExGst: number; // effectiveCostPerCrateExGst + inwardCostPerCrate (ex-GST)
  landedCostPerUnit: number; // landedCostPerCrate / unitsPerCrate (bottle incl-GST)
  landedCostPerUnitExGst: number; // landedCostPerCrateExGst / unitsPerCrate (bottle ex-GST)
}

export function calculateLandedCostBreakdown(params: {
  qty: number;
  unitPrice: number; // Invoice Unit Rate (ex-GST)
  unitsPerCrate?: number;
  pack?: string;
  volume?: number;
  packSize?: string;
  cgstPercent: number;
  sgstPercent: number;
  igstPercent?: number;
  schemeType: GrnSchemeType;
  schemeMode?: GrnSchemeMode;
  schemeBuyQty?: number;
  schemeFreeQty?: number;
  freeQty?: number;
  paidQty?: number;
  discountPercent?: number;
  discountFlat?: number;
  discountAmount?: number;
  inwardCostPerCrate?: number;
}): LandedCostBreakdown {
  const qty = Math.max(0, Number(params.qty) || 0);
  const unitPrice = Math.max(0, Number(params.unitPrice) || 0);
  const unitsPerCrate = Math.max(1, Number(params.unitsPerCrate) || 24);

  const cgstPercent = Math.max(0, Number(params.cgstPercent) || 0);
  const sgstPercent = Math.max(0, Number(params.sgstPercent) || 0);
  const igstPercent = Math.max(0, Number(params.igstPercent) || 0);
  const gstPercent = cgstPercent + sgstPercent + igstPercent;

  // Base invoice rates
  const gstAmountPerCrate = (unitPrice * gstPercent) / 100;
  const invoiceRateExGst = unitPrice;
  const invoiceRateInclGst = unitPrice + gstAmountPerCrate;
  const invoiceUnitRateBottleExGst = unitsPerCrate > 0 ? invoiceRateExGst / unitsPerCrate : 0;
  const invoiceUnitRateBottleInclGst = unitsPerCrate > 0 ? invoiceRateInclGst / unitsPerCrate : 0;

  // Pack size description
  const packSize =
    params.packSize ||
    (params.pack && params.volume
      ? `${unitsPerCrate}x ${params.volume}ml ${params.pack}`
      : `${unitsPerCrate} units/case`);

  // Scheme calculations
  const schemeType = params.schemeType || 'none';
  // In FMCG beverage distribution, the printed invoice case count is typically inclusive of
  // free scheme items (e.g. 100 cases on invoice = 80 paid + 20 free).
  // Default mode is 'inclusive' (total physical received = billed quantity).
  // If 'additive' mode is selected, free crates are bonus crates on top (total = billed + free).
  const schemeMode: GrnSchemeMode = params.schemeMode || 'inclusive';
  const schemeBuyQty = Math.max(1, Number(params.schemeBuyQty) || 2);
  const schemeFreeQty = Math.max(1, Number(params.schemeFreeQty) || 1);
  const discountPercent = Math.max(0, Number(params.discountPercent) || 0);
  const discountFlat = Math.max(0, Number(params.discountFlat) || 0);

  let freeQty = 0;
  let paidQty = qty;
  let totalReceivedQty = qty;
  let discountAmount = 0;
  let schemeLabel = 'Standard (No Scheme)';

  const baseGross = qty * unitPrice;

  if (schemeType === 'b2g1') {
    // Buy X Get Y Free:
    // If 'inclusive' (Standard): Free items are included within the billed count.
    // e.g. Buy 2 Get 1 on 150 units -> group = 2 + 1 = 3 -> 50 free units, 100 paid units. Total received = 150.
    // If 'additive': Free items are added on top of billed quantity.
    // e.g. Buy 2 Get 1 on 150 units -> 150 / 2 = 75 free units. Total received = 150 + 75 = 225.
    if (params.freeQty !== undefined && params.freeQty !== null && Number(params.freeQty) >= 0) {
      freeQty = Math.max(0, Number(params.freeQty));
    } else {
      const cycle = schemeMode === 'inclusive' ? schemeBuyQty + schemeFreeQty : schemeBuyQty;
      freeQty = cycle > 0 ? Math.floor(qty / cycle) * schemeFreeQty : 0;
    }

    if (schemeMode === 'inclusive') {
      paidQty = Math.max(0, qty - freeQty);
      totalReceivedQty = qty; // Free items are inside billed quantity
    } else {
      paidQty = qty;
      totalReceivedQty = qty + freeQty; // Bonus on top
    }

    discountAmount =
      params.discountAmount !== undefined && params.discountAmount !== null && Number(params.discountAmount) >= 0
        ? Math.max(0, Number(params.discountAmount))
        : freeQty * unitPrice;
    schemeLabel =
      schemeMode === 'inclusive'
        ? `Buy ${schemeBuyQty} Get ${schemeFreeQty} Free (${freeQty} Free of ${qty} cs · ${paidQty} Paid · Incl.)`
        : `Buy ${schemeBuyQty} Get ${schemeFreeQty} Free (${freeQty} Free included in ${qty} cs)`;
  } else if (schemeType === 'free_cases') {
    freeQty = Math.max(0, Number(params.freeQty) || 0);
    paidQty = Math.max(0, qty - freeQty);
    totalReceivedQty = qty;
    schemeLabel = `${freeQty} Free Crates included in ${qty} cs (${paidQty} Paid · Scheme Discount)`;
    discountAmount =
      params.discountAmount !== undefined && params.discountAmount !== null
        ? Math.max(0, Number(params.discountAmount))
        : freeQty * unitPrice;
  } else if (schemeType === 'discount_percent') {
    freeQty = 0;
    paidQty = qty;
    totalReceivedQty = qty;
    discountAmount = (baseGross * discountPercent) / 100;
    schemeLabel = `${discountPercent}% Scheme Discount`;
  } else if (schemeType === 'discount_flat') {
    freeQty = 0;
    paidQty = qty;
    totalReceivedQty = qty;
    discountAmount = qty * discountFlat;
    schemeLabel = `₹${discountFlat}/cr Flat Scheme`;
  } else {
    freeQty = 0;
    paidQty = qty;
    totalReceivedQty = qty;
    discountAmount = 0;
    schemeLabel = 'None (Standard)';
  }

  discountAmount = Math.min(discountAmount, baseGross);

  // Invoice line totals (for supplier invoice audit)
  //
  // Supplier-invoice method (confirmed on real invoices 40/26-27 and 49/26-27): free scheme cases are listed in
  // the case count and invoiced at the full rate WITH GST. Their value (GST-inclusive) is then deducted from the
  // invoice total as a discount. Result:
  //   - the amount PAYABLE is only for the paid cases (paid cases x rate incl. GST),
  //   - GST is charged on the FULL value of paid + free cases (this is the tax on the invoice, claimable as ITC),
  //   - the TAXABLE VALUE shown is payable minus that GST (the discount lowers taxable value, not the tax).
  // Any other discount (percent / flat / extra trade discount) is before tax and lowers the tax as well.
  // This follows the same "GST on free cases" switch as sales (Settings > Billing); switch it off to charge
  // tax only on the net value.
  const isFreeGoodsScheme = schemeType === 'b2g1' || schemeType === 'free_cases';
  const freeGoodsValue = Math.min(freeQty * unitPrice, discountAmount);
  const otherDiscount = Math.max(0, discountAmount - freeGoodsValue);
  const netExGst = Math.max(0, baseGross - discountAmount);
  let taxableAmount: number;
  let cgstAmount: number;
  let sgstAmount: number;
  let igstAmount: number;
  let lineTotal: number;
  if (isFreeGoodsScheme && getGstOnFreeCases()) {
    const taxBase = Math.max(0, baseGross - otherDiscount);
    cgstAmount = (taxBase * cgstPercent) / 100;
    sgstAmount = (taxBase * sgstPercent) / 100;
    igstAmount = (taxBase * igstPercent) / 100;
    lineTotal = netExGst * (1 + gstPercent / 100); // payable: paid cases only, GST-inclusive
    taxableAmount = Math.max(0, lineTotal - (cgstAmount + sgstAmount + igstAmount));
  } else {
    taxableAmount = netExGst;
    cgstAmount = (taxableAmount * cgstPercent) / 100;
    sgstAmount = (taxableAmount * sgstPercent) / 100;
    igstAmount = (taxableAmount * igstPercent) / 100;
    lineTotal = taxableAmount + cgstAmount + sgstAmount + igstAmount;
  }
  const taxAmount = cgstAmount + sgstAmount + igstAmount;

  // Effective Scheme-Adjusted Purchase Cost (pre-inward godown expenses)
  // Stock cost uses the net ex-GST value actually paid for (paid cases only), whatever the GST rule is: it must not
  // swing with how the supplier splits taxable value and tax. The extra input tax credit that comes from GST on free
  // cases is a GST-report item, not a cost reduction (conservative: profit is not inflated by it).
  const effectiveCostPerCrateExGst =
    totalReceivedQty > 0 ? netExGst / totalReceivedQty : invoiceRateExGst;
  const effectiveCostPerCrateInclGst =
    totalReceivedQty > 0 ? lineTotal / totalReceivedQty : invoiceRateInclGst;
  const effectiveUnitRateExGst = unitsPerCrate > 0 ? effectiveCostPerCrateExGst / unitsPerCrate : 0;
  const effectiveUnitRateInclGst = unitsPerCrate > 0 ? effectiveCostPerCrateInclGst / unitsPerCrate : 0;

  // Inward Godown Cost Allocation
  const inwardCostPerCrate = Math.max(0, Number(params.inwardCostPerCrate) || 0);

  // Final Landed Cost = Effective Scheme-adjusted Purchase Cost + Inward Cost
  const landedCostPerCrate = effectiveCostPerCrateInclGst + inwardCostPerCrate;
  const landedCostPerCrateExGst = effectiveCostPerCrateExGst + inwardCostPerCrate;
  const landedCostPerUnit = unitsPerCrate > 0 ? landedCostPerCrate / unitsPerCrate : 0;
  const landedCostPerUnitExGst = unitsPerCrate > 0 ? landedCostPerCrateExGst / unitsPerCrate : 0;

  return {
    unitsPerCrate,
    packSize,
    qty,
    paidQty,
    freeQty,
    totalReceivedQty,
    schemeMode,
    invoiceRateExGst,
    gstPercent,
    cgstPercent,
    sgstPercent,
    igstPercent,
    gstAmountPerCrate,
    invoiceRateInclGst,
    invoiceUnitRateBottleExGst,
    invoiceUnitRateBottleInclGst,
    schemeType,
    schemeBuyQty,
    schemeFreeQty,
    discountPercent,
    discountFlat,
    discountAmount,
    schemeLabel,
    taxableAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    taxAmount,
    lineTotal,
    effectiveCostPerCrateExGst,
    effectiveCostPerCrateInclGst,
    effectiveUnitRateExGst,
    effectiveUnitRateInclGst,
    inwardCostPerCrate,
    landedCostPerCrate,
    landedCostPerCrateExGst,
    landedCostPerUnit,
    landedCostPerUnitExGst,
  };
}

export interface GrnLineMetrics {
  discountAmount: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount?: number;
  taxAmount: number;
  lineTotal: number;
  paidQty: number;
  freeQty: number;
  totalReceivedQty: number;
  landedCostPerUnit: number; // Post-tax landed price per received unit
  effectiveCostPerUnit: number; // Pre-tax landed cost per received unit
}

export function calculateGrnLineMetrics(params: {
  qty: number;
  unitPrice: number;
  schemeType: GrnSchemeType;
  schemeMode?: GrnSchemeMode;
  schemeBuyQty?: number;
  schemeFreeQty?: number;
  freeQty?: number;
  paidQty?: number;
  discountPercent?: number;
  discountFlat?: number;
  discountAmount?: number;
  cgstPercent: number;
  sgstPercent: number;
  igstPercent?: number;
  inwardCostPerCrate?: number;
}): GrnLineMetrics {
  const breakdown = calculateLandedCostBreakdown({
    qty: params.qty,
    unitPrice: params.unitPrice,
    schemeType: params.schemeType,
    schemeMode: params.schemeMode,
    schemeBuyQty: params.schemeBuyQty,
    schemeFreeQty: params.schemeFreeQty,
    freeQty: params.freeQty,
    discountPercent: params.discountPercent,
    discountFlat: params.discountFlat,
    discountAmount: params.discountAmount,
    cgstPercent: params.cgstPercent,
    sgstPercent: params.sgstPercent,
    igstPercent: params.igstPercent,
    inwardCostPerCrate: params.inwardCostPerCrate,
  });

  return {
    discountAmount: breakdown.discountAmount,
    taxableAmount: breakdown.taxableAmount,
    cgstAmount: breakdown.cgstAmount,
    sgstAmount: breakdown.sgstAmount,
    igstAmount: breakdown.igstAmount,
    taxAmount: breakdown.taxAmount,
    lineTotal: breakdown.lineTotal,
    paidQty: breakdown.paidQty,
    freeQty: breakdown.freeQty,
    totalReceivedQty: breakdown.totalReceivedQty,
    landedCostPerUnit: breakdown.landedCostPerCrate, // crate-level landed cost
    effectiveCostPerUnit: breakdown.effectiveCostPerCrateExGst, // pre-tax landed cost
  };
}

/**
 * Resolves the genuine pre-tax purchase cost per CRATE / CASE.
 * Safeguards against single-bottle / unit rates (e.g. rate / unitsPerCrate) being mistakenly treated as crate costs.
 */
export function resolveItemCrateCost(item: any): number {
  if (!item) return 0;
  const unitPrice = Number(item.unitPrice) || 0;
  const unitsPerCrate = Number(item.unitsPerCrate) || 1;

  // 1. Explicit crate-level landed or scheme-adjusted fields
  const crateLandedEx = Number(item.landedCostPerCrateExGst);
  if (Number.isFinite(crateLandedEx) && crateLandedEx > 0) return crateLandedEx;

  const crateEffEx = Number(item.effectiveCostPerCrateExGst);
  if (Number.isFinite(crateEffEx) && crateEffEx > 0) return crateEffEx;

  // 2. Check effectiveCostPerUnit — if it was erroneously divided by unitsPerCrate (bottle rate)
  const effUnit = Number(item.effectiveCostPerUnit);
  if (Number.isFinite(effUnit) && effUnit > 0) {
    if (unitPrice > 0 && effUnit < unitPrice * 0.35 && unitsPerCrate > 1) {
      return Math.round(effUnit * unitsPerCrate * 100) / 100;
    }
    if (effUnit >= 25 || unitPrice <= 0) return effUnit;
    if (unitsPerCrate > 1) return Math.round(effUnit * unitsPerCrate * 100) / 100;
  }

  // 3. Explicit post-tax crate landed rate if no ex-tax available
  const crateLanded = Number(item.landedCostPerCrate);
  const gstRate = ((Number(item.cgstPercent) || 0) + (Number(item.sgstPercent) || 0) + (Number(item.igstPercent) || 0)) / 100;
  if (Number.isFinite(crateLanded) && crateLanded > 0) {
    return gstRate > 0 ? Math.round((crateLanded / (1 + gstRate)) * 100) / 100 : crateLanded;
  }

  const crateEffIncl = Number(item.effectiveCostPerCrateInclGst);
  if (Number.isFinite(crateEffIncl) && crateEffIncl > 0) {
    return gstRate > 0 ? Math.round((crateEffIncl / (1 + gstRate)) * 100) / 100 : crateEffIncl;
  }

  // 4. Default to invoice line unitPrice (which is always per-crate on distributor inward invoices)
  return unitPrice;
}

/**
 * True when the cost stored for a GRN line (and so the stock batch's cost per case) ALREADY contains the
 * inward freight / transport / labour per case. That is the case for lines saved with a landed cost that is
 * higher than the scheme-adjusted purchase cost by the freight amount (both invoice-upload and manual inward
 * screens). Reports must then NOT add the freight again on top of the batch cost, or profit is understated.
 * Lines where this cannot be proven keep the old behaviour (freight added once on top).
 */
export function inwardFreightAlreadyInCost(item: any, inwardPerCrate: number): boolean {
  const per = Number(inwardPerCrate) || 0;
  if (per <= 0 || !item) return false;
  const landedEx = Number(item.landedCostPerCrateExGst);
  if (!(landedEx > 0)) return false;
  let effEx = Number(item.effectiveCostPerCrateExGst);
  if (!(effEx > 0)) {
    const effUnit = Number(item.effectiveCostPerUnit);
    const unitPrice = Number(item.unitPrice) || 0;
    const unitsPerCrate = Number(item.unitsPerCrate) || 1;
    if (Number.isFinite(effUnit) && effUnit > 0) {
      // Manual inward (InwardConsignmentModal) stores the scheme-adjusted ex-GST crate cost
      // in effectiveCostPerUnit. Guard against stray per-bottle values using the same rule as
      // resolveItemCrateCost so bottle rates cannot masquerade as crate costs.
      effEx =
        unitPrice > 0 && effUnit < unitPrice * 0.35 && unitsPerCrate > 1
          ? Math.round(effUnit * unitsPerCrate * 100) / 100
          : effUnit >= 25 || unitPrice <= 0
            ? effUnit
            : unitsPerCrate > 1
              ? Math.round(effUnit * unitsPerCrate * 100) / 100
              : effUnit;
    }
  }
  if (!(effEx > 0)) return false;
  return landedEx - effEx >= per - 0.02;
}

/**
 * Resolves the genuine inclusive-of-GST landed cost per CRATE / CASE.
 */
export function resolveItemLandedCrateCost(item: any): number {
  if (!item) return 0;
  const crateLanded = Number(item.landedCostPerCrate);
  if (Number.isFinite(crateLanded) && crateLanded > 0) return crateLanded;

  const crateEffIncl = Number(item.effectiveCostPerCrateInclGst);
  if (Number.isFinite(crateEffIncl) && crateEffIncl > 0) return crateEffIncl;

  const crateCostExGst = resolveItemCrateCost(item);
  const rawInward = Math.max(0, Number(item.inwardCostPerCrate) || 0);
  const alreadyHasInward = inwardFreightAlreadyInCost(item, rawInward);
  if (item.taxability === 'non_gst') {
    const inwardAddon = alreadyHasInward ? 0 : rawInward;
    return Math.round((crateCostExGst + inwardAddon) * 100) / 100;
  }
  const hasSplit = item.cgstPercent !== undefined && item.cgstPercent !== null && item.sgstPercent !== undefined && item.sgstPercent !== null;
  // a purchase line saved with 0% + 0% really is 0% GST; only a line with no tax split falls back to 18%
  const gstRate = hasSplit ? ((Number(item.cgstPercent) || 0) + (Number(item.sgstPercent) || 0) + (Number(item.igstPercent) || 0)) / 100 : 0.18;
  if (alreadyHasInward) {
    const baseEx = Math.max(0, crateCostExGst - rawInward);
    return Math.round((baseEx * (1 + gstRate) + rawInward) * 100) / 100;
  }
  return Math.round((crateCostExGst * (1 + gstRate) + rawInward) * 100) / 100;
}
