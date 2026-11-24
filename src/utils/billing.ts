/**
 * Barrel module for billing calculations, GST/HSN rules, inward landed cost,
 * promotions engine, receipt text formatting, and trip normalization.
 * Implementations live in focused domain modules under ./billing/* with zero logic changes.
 */
export {
  formatDdMmYy,
  generateAutoSku,
  generateBatchNumber,
  generateSkuId,
  money,
  parseBillIds,
  parseJsonDict,
  whatsappLink,
} from './billing/formatAndSku';

export {
  CASE_PACK_SIZES,
  computeProductGstBreakdown,
  detectPack,
  detectPackAndVolume,
  formatProductVolPack,
  gstRateFromHsn,
  inferHsn8,
  inferUnitsPerCase,
  MULTIPACK_VOLUME_RE,
  normalizeGstFraction,
  normalizeProductTax,
  normalizeTo8DigitHsn,
  productTaxFields,
  resolveProductGstRate,
  resolveProductHsn,
  STANDARD_VOLUMES,
  VOLUME_UNIT_RE,
  volumeFromName,
  type GstBreakdown,
} from './billing/productMeta';

export {
  billGstHalfRatePercent,
  billTotals,
  breakEvenCustomRate,
  breakEvenInclPaidRate,
  breakEvenPaidRate,
  cgstSgstLabels,
  freeSchemeValue,
  getGstOnFreeCases,
  getRoundOffGrandTotal,
  issuedGstMode,
  isWholeRupee,
  lineTaxDetail,
  nonGstSummary,
  scaledTaxSplit,
  setGstOnFreeCases,
  setRoundOffGrandTotal,
  statusOf,
  type LineTaxDetail,
} from './billing/taxSettingsAndRules';

export {
  calculateGrnLineMetrics,
  calculateLandedCostBreakdown,
  inwardFreightAlreadyInCost,
  resolveItemCrateCost,
  resolveItemLandedCrateCost,
  type GrnLineMetrics,
  type LandedCostBreakdown,
} from './billing/inwardCost';

export {
  applyCartSchemes,
  computeLine,
  evaluateBundlePromotion,
  schemeLabel,
  type BundleQualificationResult,
  type CartSchemeInputItem,
  type CartSchemeResult,
} from './billing/promotionsEngine';

export {
  attachableBillsForTrip,
  billBelongsToTrip,
  buildBillText,
  freeStockInvoiceDisplay,
  normalizeTrip,
  tripCashDue,
} from './billing/receiptAndTrips';
