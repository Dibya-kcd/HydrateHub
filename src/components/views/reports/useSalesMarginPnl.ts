import { useCallback, useMemo } from 'react';
import { Bill, BillItem, InventoryBatch, Product } from '../../../types';
import { useLedger } from '../../../context/LedgerContext';
import {
  normalizeGstFraction,
  resolveProductGstRate,
  scaledTaxSplit,
  inwardFreightAlreadyInCost,
} from '../../../utils/billing';
import {
  billBalance,
  billNetTotal,
  returnedQtyByProduct,
  returnedCreditByProduct,
} from '../../../utils/salesReturns';
import { writeOffNetForPeriod, schemeCreditsForPeriod } from '../../../utils/pnlBridge';
import { billTaxBasis } from '../../../utils/billTaxBasis';
import { resolveTaxRegime, noOutputTax } from '../../../tax/appRegime';

export type MarginSubTab = 'products' | 'customers' | 'days' | 'netProfit';
export type ProfitViewBasis = 'exGst' | 'inclGst';

export interface SalesMarginPnLReportProps {
  filteredBills: Bill[];
  products: Product[];
  periodLabel: string;
  /** Open on a specific sub-tab (e.g. products when deep-linked from old Product profit). */
  initialSubTab?: MarginSubTab;
  /** True when a yyyy-mm-dd date falls inside the selected report period (used for write-offs). */
  dateInPeriod?: (date: string) => boolean;
  gstTaxSummary?: {
    outputTaxable: number;
    outputCgst: number;
    outputSgst: number;
    outputCess: number;
    totalOutputGst: number;
    inputGstCredit: number;
    netGstPayable: number;
  };
  purchaseStats?: {
    grossPurchaseVal: number;
    netPurchaseVal: number;
    totalGstPaid: number;
    totalCessPaid: number;
  };
}

export interface ProductMarginRow {
  productId: number;
  productName: string;
  category: string;
  casesSold: number; // Net billed cases
  freeCases: number; // Free promotional scheme cases
  totalDispatched: number; // casesSold + freeCases
  grossSales: number;
  discounts: number;
  netSales: number; // Billed net (Incl-GST)
  taxableSales: number; // Taxable turnover (Ex-GST)
  gstAmount: number; // Output GST collected
  cogs: number; // Inward cost * totalDispatched
  grossProfit: number; // Active profit based on viewBasis
  marginPct: number; // Active margin % based on viewBasis
  operatingProfit: number; // True Ex-GST operating profit (taxableSales - cogs)
  operatingMarginPct: number;
  costPerCase: number; // Active purchase cost based on viewBasis
  exGstCostPerCase: number; // Inward cost Ex-GST (used for true operating profit)
  landedCostPerCase: number; // Inward cost Incl-GST (original bill rate + landed freight/labour)
  avgSellRate: number; // Method 2: activeRev / casesSold
  avgBilledSellRate: number; // Method 2: netSales / casesSold (Incl-GST)
  avgTaxableSellRate: number; // Method 2: taxableSales / casesSold (Ex-GST)
  effectiveSellRate: number; // netSales / totalDispatched (Incl-GST blended)
  effectiveTaxableRate: number; // taxableSales / totalDispatched (Ex-GST blended)
  profitPerCase: number; // operatingProfit / casesSold
}

export interface CustomerMarginRow {
  customerKey: string;
  customerName: string;
  invoices: number;
  casesSold: number;
  netSales: number;
  taxableSales: number;
  gstAmount: number;
  cogs: number;
  grossProfit: number;
  marginPct: number;
  outstanding: number;
}

export interface DayMarginRow {
  date: string;
  invoices: number;
  netSales: number;
  taxableSales: number;
  gstAmount: number;
  cogs: number;
  grossProfit: number;
  marginPct: number;
  discounts: number;
}

/** One row per stock batch (or "Unallocated" fallback) that contributed cases to period sales. */
export interface BatchMarginRow {
  batchKey: string;
  batchNumber: string;
  productId: number;
  productName: string;
  category: string;
  supplierName: string;
  inwardDate: string;
  expiryDate: string;
  casesSold: number;
  freeCases: number;
  totalDispatched: number;
  costPerCase: number;
  netSales: number;
  taxableSales: number;
  gstAmount: number;
  cogs: number;
  grossProfit: number;
  marginPct: number;
  operatingProfit: number;
  operatingMarginPct: number;
  profitPerCase: number;
  avgSellRate: number;
}

export function resolveExGstProductCost(product: Product | undefined): number {
  if (!product) return 0;
  let eff = Number(product.effectiveCost ?? product.cost ?? 0) || 0;
  const cost = Number(product.cost ?? 0) || eff;
  // Guard against any single bottle rate accidentally stored (< 30) for multi-unit beverage crates
  if (eff > 0 && cost > 0 && eff < cost * 0.35 && (product.unitsPerCrate || 30) > 1) {
    eff = cost;
  }
  return eff;
}

export function resolveLandedProductCost(product: Product | undefined): number {
  if (!product) return 0;
  const landed = Number(product.landedCostPerCrate);
  if (landed && landed > 0) return landed;
  const ex = resolveExGstProductCost(product);
  const g = resolveProductGstRate(product);
  return Math.round(ex * (1 + g) * 100) / 100;
}

/**
 * The one gross-profit engine. Used by the Sales, Margin & P&L report and by the Net Profit report,
 * so both always show the same revenue, cost and write-off numbers.
 */
export function useSalesMarginPnl(args: {
  filteredBills: Bill[];
  products: Product[];
  dateInPeriod?: (date: string) => boolean;
  gstTaxSummary?: SalesMarginPnLReportProps['gstTaxSummary'];
  purchaseStats?: SalesMarginPnLReportProps['purchaseStats'];
  viewBasis: ProfitViewBasis;
}) {
  const { filteredBills, products, dateInPeriod, gstTaxSummary, purchaseStats, viewBasis } = args;
  const productMap = useMemo(() => {
    const m = new Map<number, Product>();
    products.forEach((p) => m.set(p.id, p));
    return m;
  }, [products]);

  const { inventoryBatches, inventoryDispositions, supplierCreditNotes, grns, orgProfile } = useLedger();

  /**
   * Revenue ex-GST and GST for ONE bill, the same way on every screen. A regular taxpayer's non-GST bill still
   * contains GST in its price; that GST is owed to the government and is not revenue (see utils/billTaxBasis).
   */
  const taxBasisOf = useCallback(
    (b: Bill) => {
      const carve = !noOutputTax(resolveTaxRegime(orgProfile, String(b.date || '').slice(0, 10)));
      return billTaxBasis(b, {
        carveGstFromPrices: carve,
        rateFor: (item) => {
          const prod = productMap.get(item.productId);
          if (item.taxability === 'non_gst' || prod?.taxability === 'non_gst') return 0;
          return item.gst !== undefined && item.gst !== null
            ? (item.gst as number)
            : resolveProductGstRate(prod, item.category);
        },
      });
    },
    [orgProfile, productMap]
  );
  const batchMap = useMemo(() => {
    const m = new Map<string, InventoryBatch>();
    (inventoryBatches || []).forEach((b) => m.set(b.id, b));
    return m;
  }, [inventoryBatches]);

  /**
   * Inward freight / transport / unloading labour per crate, by stock batch (from the GRN it came in on).
   * This is a real cost of the stock, so it is part of COGS. Before this, it was entered on the GRN but
   * never reached any profit figure.
   */
  const { inwardByBatch, inwardExtraByBatch } = useMemo(() => {
    // inwardByBatch: ALL freight per crate carried in the cost of a batch (used for the "includes freight" figure).
    // inwardExtraByBatch: only the freight NOT already inside the batch's stored cost, i.e. what must still be added
    // on top of the batch cost. Invoice-upload GRNs store a landed cost that already holds the freight; adding it
    // again counted it twice and understated every margin.
    const all = new Map<string, number>();
    const extra = new Map<string, number>();
    (grns || []).forEach((g: any) => {
      const grnLevel = Number(g?.inwardCostPerCrate) || 0;
      (g?.items || []).forEach((it: any) => {
        const per = Number(it?.inwardCostPerCrate) || grnLevel;
        if (per <= 0) return;
        const key = `batch_${g.id}_${it.id}`;
        all.set(key, per);
        if (!inwardFreightAlreadyInCost(it, per)) extra.set(key, per);
      });
    });
    return { inwardByBatch: all, inwardExtraByBatch: extra };
  }, [grns]);

  /** Freight per crate of ONE bill line, weighted by the batches the cases were taken from. */
  const weightedInward = useCallback(
    (item: BillItem, source: Map<string, number>): number => {
      let q = 0;
      let c = 0;
      for (const a of item.batchAllocations || []) {
        const aq = Number(a.qty) || 0;
        if (aq <= 0) continue;
        q += aq;
        c += aq * (source.get(a.batchId) || 0);
      }
      return q > 0 ? c / q : 0;
    },
    []
  );

  /** Total freight per crate carried in the cost of ONE bill line (informational). */
  const lineInwardPerCrate = useCallback((item: BillItem): number => weightedInward(item, inwardByBatch), [weightedInward, inwardByBatch]);

  /** Freight per crate still to be ADDED on top of the batch cost for ONE bill line (not already inside it). */
  const lineInwardExtraPerCrate = useCallback((item: BillItem): number => weightedInward(item, inwardExtraByBatch), [weightedInward, inwardExtraByBatch]);

  /** How trustworthy the cost used for ONE bill line is (feeds the "Check my numbers" panel). */
  const lineCostQuality = useCallback(
    (item: BillItem): 'frozen' | 'batch' | 'estimated' | 'none' => {
      if ((Number(item.costExGst) || 0) > 0) return 'frozen';
      const prod = productMap.get(item.productId);
      const exFallback = resolveExGstProductCost(prod);
      for (const a of item.batchAllocations || []) {
        const b = batchMap.get(a.batchId);
        const raw = Number(b?.effectiveCostPrice) || Number(b?.costPrice) || 0;
        if ((Number(a.qty) || 0) > 0 && raw > 0 && !(exFallback > 0 && raw < exFallback * 0.35)) return 'batch';
      }
      return exFallback > 0 ? 'estimated' : 'none';
    },
    [productMap, batchMap]
  );

  /**
   * Cost of goods for the physical cases of ONE bill line.
   * - Uses the cost of the stock batch(es) the invoice was actually issued from (FEFO allocation
   *   saved on the bill), so an old invoice keeps the cost it really had even after newer, dearer
   *   or cheaper stock arrives.
   * - Falls back to the product's blended average cost for older bills without batch allocation.
   * - `physicalQty` is the case count that left the godown (it already includes free scheme cases).
   */
  const lineCogs = useCallback(
    (item: BillItem, physicalQty: number, basis: ProfitViewBasis): number => {
      if (physicalQty <= 0) return 0;
      const prod = productMap.get(item.productId);
      const exFallback = resolveExGstProductCost(prod);
      const landedFallback = resolveLandedProductCost(prod);

      // Cost frozen on the bill when it was saved wins over anything recalculated today.
      const frozen = Number(item.costExGst) || 0;
      let allocQty = 0;
      let allocEx = 0;
      for (const a of item.batchAllocations || []) {
        const q = Number(a.qty) || 0;
        if (q <= 0) continue;
        const b = batchMap.get(a.batchId);
        const raw = Number(b?.effectiveCostPrice) || Number(b?.costPrice) || 0;
        // ignore a stray per-bottle rate stored instead of a per-crate rate
        const sane = raw > 0 && !(exFallback > 0 && raw < exFallback * 0.35);
        allocQty += q;
        allocEx += q * (sane ? raw : exFallback);
      }
      const avgEx = frozen > 0 ? frozen : allocQty > 0 ? allocEx / allocQty : exFallback;
      // Ex-GST profit carries the inward freight / labour of the batches too. (The incl-GST view already
      // scales by the product's landed cost, which contains it.)
      if (basis === 'exGst') return (avgEx + lineInwardExtraPerCrate(item)) * physicalQty;
      const landedRatio = exFallback > 0 ? landedFallback / exFallback : 1;
      return avgEx * landedRatio * physicalQty;
    },
    [productMap, batchMap, lineInwardExtraPerCrate]
  );

  const pnl = useMemo(() => {
    let grossSales = 0;
    let lineDiscounts = 0;
    let billDiscounts = 0;
    let billedSalesNet = 0;
    let taxableSalesNet = 0;
    let totalOutputGstNet = 0;
    let gstCarvedFromPrices = 0;
    let cogs = 0;
    let casesSold = 0;
    let freeCases = 0;
    const invoiceCount = filteredBills.length;
    let collected = 0;
    let outstanding = 0;
    let inwardInCogs = 0;
    let estimatedCostLines = 0;
    let estimatedCostCases = 0;
    let zeroCostLines = 0;
    let zeroCostCases = 0;
    const zeroCostProducts = new Set<string>();
    const noBatchBills = new Set<number | string>();

    filteredBills.forEach((b) => {
      if (b.status === 'cancelled') return;

      const billNet = billNetTotal(b);
      billedSalesNet += billNet;
      collected += Number(b.amountPaid) || 0;
      outstanding += Math.max(0, billBalance(b));

      const extraDisc = Math.max(0, Number(b.additionalDiscount) || 0);
      billDiscounts += extraDisc;

      const basis = taxBasisOf(b);
      totalOutputGstNet += basis.gst;
      taxableSalesNet += basis.taxable;
      if (basis.carved) gstCarvedFromPrices += basis.gst;

      const backByProd = returnedQtyByProduct(b);

      b.items.forEach((item) => {
        const gross = Number(item.gross) || (Number(item.qty) || 0) * (Number(item.rate) || 0);
        const disc = Number(item.discount) || 0;
        const qty = Number(item.qty) || 0;
        const free = Number(item.freeQty) || 0;

        grossSales += gross;
        lineDiscounts += disc;

        const retQty = backByProd[item.productId] || 0;
        const netQty = Math.max(0, qty - retQty);
        const freeNet = Math.min(free, netQty);
        freeCases += freeNet;
        casesSold += netQty - freeNet;

        cogs += lineCogs(item, netQty, viewBasis);

        if (netQty > 0) {
          inwardInCogs += lineInwardPerCrate(item) * netQty;
          const quality = lineCostQuality(item);
          if (quality === 'estimated') {
            estimatedCostLines += 1;
            estimatedCostCases += netQty;
            noBatchBills.add(b.id);
          } else if (quality === 'none') {
            zeroCostLines += 1;
            zeroCostCases += netQty;
            zeroCostProducts.add(String(item.productName || productMap.get(item.productId)?.name || `#${item.productId}`));
            noBatchBills.add(b.id);
          }
        }
      });
    });

    if (grossSales <= 0 && billedSalesNet > 0) {
      grossSales = billedSalesNet + lineDiscounts + billDiscounts;
    }

    const totalDiscounts = lineDiscounts + billDiscounts;
    const totalDispatchedCases = casesSold + freeCases;

    const wo = writeOffNetForPeriod(inventoryDispositions, dateInPeriod);
    const writeOffLoss = wo.loss;
    const writeOffRecovered = wo.recovered;
    const writeOffNet = wo.net;
    const supplierCredits = schemeCreditsForPeriod(supplierCreditNotes, dateInPeriod);

    const grossProfitBeforeLosses = taxableSalesNet - cogs;
    const operatingGrossProfit = grossProfitBeforeLosses - writeOffNet + supplierCredits;
    const operatingMarginPct = taxableSalesNet > 0 ? (operatingGrossProfit / taxableSalesNet) * 100 : 0;

    const billedGrossProfit = billedSalesNet - cogs;
    const billedMarginPct = billedSalesNet > 0 ? (billedGrossProfit / billedSalesNet) * 100 : 0;

    const activeNetSales = viewBasis === 'exGst' ? taxableSalesNet : billedSalesNet;
    const activeGrossProfit = viewBasis === 'exGst' ? operatingGrossProfit : billedGrossProfit;
    const activeMarginPct = viewBasis === 'exGst' ? operatingMarginPct : billedMarginPct;

    const avgBilledSellPerCase = casesSold > 0 ? billedSalesNet / casesSold : 0;
    const avgTaxableSellPerCase = casesSold > 0 ? taxableSalesNet / casesSold : 0;
    const avgSellPerCase = viewBasis === 'exGst' ? avgTaxableSellPerCase : avgBilledSellPerCase;

    const avgEffectiveSellPerCase = totalDispatchedCases > 0 ? billedSalesNet / totalDispatchedCases : 0;

    const avgProfitPerCase = casesSold > 0 ? operatingGrossProfit / casesSold : 0;
    const avgCostPerCase = totalDispatchedCases > 0 ? cogs / totalDispatchedCases : (casesSold > 0 ? cogs / casesSold : 0);

    const itc = purchaseStats?.totalGstPaid
      ? purchaseStats.totalGstPaid + (purchaseStats.totalCessPaid || 0)
      : (gstTaxSummary?.inputGstCredit || 0);
    const netGstPayable = Math.max(0, totalOutputGstNet - itc);

    return {
      grossSales,
      totalDiscounts,
      lineDiscounts,
      billDiscounts,
      billedSalesNet,
      taxableSalesNet,
      totalOutputGstNet,
      gstCarvedFromPrices: Math.round(gstCarvedFromPrices * 100) / 100,
      netGstPayable,
      itc,
      cogs,
      inwardInCogs: Math.round(inwardInCogs * 100) / 100,
      costChecks: {
        estimatedCostLines,
        estimatedCostCases,
        zeroCostLines,
        zeroCostCases,
        zeroCostProducts: Array.from(zeroCostProducts).sort(),
        billsWithEstimatedCost: noBatchBills.size,
      },
      operatingGrossProfit,
      grossProfitBeforeLosses,
      writeOffLoss,
      writeOffRecovered,
      writeOffNet,
      supplierCredits,
      operatingMarginPct,
      billedGrossProfit,
      billedMarginPct,
      activeNetSales,
      activeGrossProfit,
      activeMarginPct,
      casesSold,
      freeCases,
      totalDispatchedCases,
      invoiceCount,
      collected,
      outstanding,
      avgProfitPerCase,
      avgSellPerCase,
      avgBilledSellPerCase,
      avgTaxableSellPerCase,
      avgEffectiveSellPerCase,
      avgCostPerCase,
    };
  }, [filteredBills, productMap, viewBasis, gstTaxSummary, purchaseStats, lineCogs, inventoryDispositions, supplierCreditNotes, dateInPeriod, lineInwardPerCrate, lineCostQuality, taxBasisOf]);
  return { pnl, productMap, batchMap, lineCogs, inwardExtraByBatch, taxBasisOf };
}

export function useSalesMarginBreakdowns(args: {
  filteredBills: Bill[];
  productMap: Map<number, Product>;
  search: string;
  sortBy: 'profit' | 'margin' | 'sales' | 'cases';
  viewBasis: ProfitViewBasis;
  lineCogs: (item: BillItem, physicalQty: number, basis: ProfitViewBasis) => number;
  taxBasisOf: (b: Bill) => { taxable: number; gst: number; carved: boolean };
}) {
  const { filteredBills, productMap, search, sortBy, viewBasis, lineCogs, taxBasisOf } = args;

  const productRows = useMemo(() => {
    interface ProductAcc {
      row: ProductMarginRow;
      exCogs: number;
      landedCogs: number;
    }
    const map = new Map<number, ProductAcc>();

    filteredBills.forEach((b) => {
      if (b.status === 'cancelled') return;
      const backByProd = returnedQtyByProduct(b);

      b.items.forEach((item) => {
        const prod = productMap.get(item.productId);
        const qty = Number(item.qty) || 0;
        const free = Number(item.freeQty) || 0;
        const gross = Number(item.gross) || qty * (Number(item.rate) || 0);
        const disc = Number(item.discount) || 0;
        const billedNet = Number(item.amount) || gross - disc;

        const retQty = backByProd[item.productId] || 0;
        const netCases = Math.max(0, qty - retQty);
        const freeNet = Math.min(free, netCases);
        const paidCases = netCases - freeNet;

        const isNonGstLine =
          b.gstExclude === true ||
          b.docSeries === 'non_gst' ||
          item.taxability === 'non_gst' ||
          prod?.taxability === 'non_gst';
        const g = isNonGstLine
          ? 0
          : item.gst !== undefined && item.gst !== null
            ? normalizeGstFraction(item.gst)
            : resolveProductGstRate(prod, item.category);
        const split = scaledTaxSplit(item, billedNet, g);
        const taxable = split.taxable;
        const gst = split.tax;

        let acc = map.get(item.productId);
        if (!acc) {
          acc = {
            exCogs: 0,
            landedCogs: 0,
            row: {
              productId: item.productId,
              productName: item.productName || prod?.name || `Product #${item.productId}`,
              category: String(item.category || prod?.category || 'general'),
              casesSold: 0,
              freeCases: 0,
              totalDispatched: 0,
              grossSales: 0,
              discounts: 0,
              netSales: 0,
              taxableSales: 0,
              gstAmount: 0,
              cogs: 0,
              grossProfit: 0,
              marginPct: 0,
              operatingProfit: 0,
              operatingMarginPct: 0,
              costPerCase: 0,
              exGstCostPerCase: 0,
              landedCostPerCase: 0,
              avgSellRate: 0,
              avgBilledSellRate: 0,
              avgTaxableSellRate: 0,
              effectiveSellRate: 0,
              effectiveTaxableRate: 0,
              profitPerCase: 0,
            },
          };
          map.set(item.productId, acc);
        }

        const creditBackByProd = returnedCreditByProduct(b);
        const retCredit = creditBackByProd[item.productId] || 0;
        const netBilled = Math.max(0, billedNet - retCredit);
        const retRatio = billedNet > 0 ? Math.min(1, retCredit / billedNet) : 0;
        const netGross = Math.max(0, gross * (1 - retRatio));
        const netDisc = Math.max(0, disc * (1 - retRatio));
        const netTaxable = Math.max(0, taxable * (1 - retRatio));
        const netGst = Math.max(0, gst * (1 - retRatio));

        const r = acc.row;
        r.casesSold += paidCases;
        r.freeCases += freeNet;
        r.totalDispatched += netCases;
        r.grossSales += netGross;
        r.discounts += netDisc;
        r.netSales += netBilled;
        r.taxableSales += netTaxable;
        r.gstAmount += netGst;
        acc.exCogs += lineCogs(item, netCases, 'exGst');
        acc.landedCogs += lineCogs(item, netCases, 'inclGst');
      });
    });

    let rows: ProductMarginRow[] = Array.from(map.values()).map(({ row: r, exCogs, landedCogs }) => {
      const prod = productMap.get(r.productId);
      const opProfit = r.taxableSales - exCogs;
      const billedProfit = r.netSales - landedCogs;
      const activeProfit = viewBasis === 'exGst' ? opProfit : billedProfit;
      const activeRev = viewBasis === 'exGst' ? r.taxableSales : r.netSales;
      const activeCogs = viewBasis === 'exGst' ? exCogs : landedCogs;
      const disp = r.totalDispatched;
      const exPerCase = disp > 0 ? exCogs / disp : resolveExGstProductCost(prod);
      const landedPerCase = disp > 0 ? landedCogs / disp : resolveLandedProductCost(prod);

      return {
        ...r,
        cogs: activeCogs,
        grossProfit: activeProfit,
        marginPct: activeRev > 0 ? (activeProfit / activeRev) * 100 : 0,
        operatingProfit: opProfit,
        operatingMarginPct: r.taxableSales > 0 ? (opProfit / r.taxableSales) * 100 : 0,
        costPerCase: viewBasis === 'exGst' ? exPerCase : landedPerCase,
        exGstCostPerCase: exPerCase,
        landedCostPerCase: landedPerCase,
        avgSellRate: r.casesSold > 0 ? activeRev / r.casesSold : 0,
        avgBilledSellRate: r.casesSold > 0 ? r.netSales / r.casesSold : 0,
        avgTaxableSellRate: r.casesSold > 0 ? r.taxableSales / r.casesSold : 0,
        effectiveSellRate: disp > 0 ? r.netSales / disp : 0,
        effectiveTaxableRate: disp > 0 ? r.taxableSales / disp : 0,
        profitPerCase: r.casesSold > 0 ? opProfit / r.casesSold : 0,
      };
    });

    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (r) =>
          r.productName.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          String(r.productId).includes(q)
      );
    }

    rows.sort((a, b) => {
      if (sortBy === 'margin') return b.marginPct - a.marginPct;
      if (sortBy === 'sales')
        return (viewBasis === 'exGst' ? b.taxableSales : b.netSales) -
          (viewBasis === 'exGst' ? a.taxableSales : a.netSales);
      if (sortBy === 'cases') return b.casesSold - a.casesSold;
      return b.grossProfit - a.grossProfit;
    });

    return rows;
  }, [filteredBills, productMap, search, sortBy, viewBasis, lineCogs]);

  const customerRows = useMemo(() => {
    const map = new Map<string, CustomerMarginRow>();

    filteredBills.forEach((b) => {
      if (b.status === 'cancelled') return;
      const name = (b.retailer || 'Cash / Walk-in').trim() || 'Cash / Walk-in';
      const key = name.toLowerCase();
      const backByProd = returnedQtyByProduct(b);

      let billCogs = 0;
      let billCases = 0;
      b.items.forEach((item) => {
        const retQty = backByProd[item.productId] || 0;
        const netQty = Math.max(0, (Number(item.qty) || 0) - retQty);
        billCogs += lineCogs(item, netQty, viewBasis);
        billCases += netQty;
      });

      const netBilled = billNetTotal(b);
      const { taxable, gst: bGst } = taxBasisOf(b);

      const opProfit = taxable - billCogs;
      const billedProfit = netBilled - billCogs;
      const activeProfit = viewBasis === 'exGst' ? opProfit : billedProfit;
      const activeRev = viewBasis === 'exGst' ? taxable : netBilled;
      const due = Math.max(0, billBalance(b));

      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          customerKey: key,
          customerName: name,
          invoices: 1,
          casesSold: billCases,
          netSales: netBilled,
          taxableSales: taxable,
          gstAmount: bGst,
          cogs: billCogs,
          grossProfit: activeProfit,
          marginPct: activeRev > 0 ? (activeProfit / activeRev) * 100 : 0,
          outstanding: due,
        });
      } else {
        existing.invoices += 1;
        existing.casesSold += billCases;
        existing.netSales += netBilled;
        existing.taxableSales += taxable;
        existing.gstAmount += bGst;
        existing.cogs += billCogs;

        const cumProfit =
          viewBasis === 'exGst'
            ? existing.taxableSales - existing.cogs
            : existing.netSales - existing.cogs;
        const cumRev = viewBasis === 'exGst' ? existing.taxableSales : existing.netSales;
        existing.grossProfit = cumProfit;
        existing.marginPct = cumRev > 0 ? (cumProfit / cumRev) * 100 : 0;
        existing.outstanding += due;
      }
    });

    let rows = Array.from(map.values());
    const q = search.trim().toLowerCase();
    if (q) rows = rows.filter((r) => r.customerName.toLowerCase().includes(q));

    rows.sort((a, b) => {
      if (sortBy === 'margin') return b.marginPct - a.marginPct;
      if (sortBy === 'sales')
        return (viewBasis === 'exGst' ? b.taxableSales : b.netSales) -
          (viewBasis === 'exGst' ? a.taxableSales : a.netSales);
      if (sortBy === 'cases') return b.casesSold - a.casesSold;
      return b.grossProfit - a.grossProfit;
    });

    return rows;
  }, [filteredBills, productMap, search, sortBy, viewBasis, lineCogs, taxBasisOf]);

  const dayRows = useMemo(() => {
    const map = new Map<string, DayMarginRow>();

    filteredBills.forEach((b) => {
      if (b.status === 'cancelled') return;
      const d = (b.date || '').slice(0, 10) || 'Unknown';
      const backByProd = returnedQtyByProduct(b);

      let billCogs = 0;
      let billDisc = Math.max(0, Number(b.additionalDiscount) || 0);

      b.items.forEach((item) => {
        const retQty = backByProd[item.productId] || 0;
        const netQty = Math.max(0, (Number(item.qty) || 0) - retQty);
        billCogs += lineCogs(item, netQty, viewBasis);
        billDisc += Number(item.discount) || 0;
      });

      const netBilled = billNetTotal(b);
      const { taxable, gst: bGst } = taxBasisOf(b);

      const opProfit = taxable - billCogs;
      const billedProfit = netBilled - billCogs;
      const activeProfit = viewBasis === 'exGst' ? opProfit : billedProfit;
      const activeRev = viewBasis === 'exGst' ? taxable : netBilled;

      const existing = map.get(d);
      if (!existing) {
        map.set(d, {
          date: d,
          invoices: 1,
          netSales: netBilled,
          taxableSales: taxable,
          gstAmount: bGst,
          cogs: billCogs,
          grossProfit: activeProfit,
          marginPct: activeRev > 0 ? (activeProfit / activeRev) * 100 : 0,
          discounts: billDisc,
        });
      } else {
        existing.invoices += 1;
        existing.netSales += netBilled;
        existing.taxableSales += taxable;
        existing.gstAmount += bGst;
        existing.cogs += billCogs;
        existing.discounts += billDisc;

        const cumProfit =
          viewBasis === 'exGst'
            ? existing.taxableSales - existing.cogs
            : existing.netSales - existing.cogs;
        const cumRev = viewBasis === 'exGst' ? existing.taxableSales : existing.netSales;
        existing.grossProfit = cumProfit;
        existing.marginPct = cumRev > 0 ? (cumProfit / cumRev) * 100 : 0;
      }
    });

    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredBills, productMap, viewBasis, lineCogs, taxBasisOf]);

  return { productRows, customerRows, dayRows };
}
