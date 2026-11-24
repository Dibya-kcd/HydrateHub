import React, { useEffect, useMemo, useState } from 'react';
import {
  Package,
  Search,
  TrendingUp,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { money } from '../../../utils/billing';
import { ProductProfitPricingModal } from './ProductProfitPricingModal';
import { NetProfitReport } from './NetProfitReport';
import { ReportDownloadButtons } from '../../common/ReportDownloadButtons';
import {
  ExplainBox,
  ReportBreakdownLine,
  ReportChipGroup,
  ReportExplainModal,
  ReportFilterPanel,
  ReportStat,
  ReportStatGrid,
  ReportTitleBar,
} from './ReportKit';
import { PhoneDownloadBar } from './mobile/PhoneKit';
import { MobileReportTopBar, useMobileReport } from './mobile/MobileReportContext';
import {
  type MarginSubTab,
  type ProfitViewBasis,
  type SalesMarginPnLReportProps,
  type ProductMarginRow,
  type CustomerMarginRow,
  type DayMarginRow,
  type BatchMarginRow,
  resolveExGstProductCost,
  resolveLandedProductCost,
  useSalesMarginPnl,
  useSalesMarginBreakdowns,
} from './useSalesMarginPnl';
import { exportSalesMarginExcel, exportSalesMarginPdf } from './salesMarginExport';
import {
  CustomerMarginSection,
  DayMarginSection,
  ProductMarginSection,
  fmtShortDate,
} from './SalesMarginSubTables';

export {
  type MarginSubTab,
  type ProfitViewBasis,
  type SalesMarginPnLReportProps,
  type ProductMarginRow,
  type CustomerMarginRow,
  type DayMarginRow,
  type BatchMarginRow,
  resolveExGstProductCost,
  resolveLandedProductCost,
  useSalesMarginPnl,
};

export const SalesMarginPnLReport: React.FC<SalesMarginPnLReportProps> = ({
  filteredBills,
  products,
  periodLabel,
  initialSubTab = 'products',
  dateInPeriod,
  gstTaxSummary,
  purchaseStats,
}) => {
  const mobileCtx = useMobileReport();
  const [subTab, setSubTab] = useState<MarginSubTab>(mobileCtx?.pnlTargetTab || initialSubTab || 'products');
  // Phone: a deep link (e.g. "Net Profit" from the Reports home) opens that page directly; otherwise start on the list.
  const [mobileActiveSubPage, setMobileActiveSubPage] = useState<MarginSubTab | null>(
    mobileCtx?.pnlTargetTab || initialSubTab || null,
  );
  useEffect(() => {
    if (mobileCtx?.pnlTargetTab) {
      setSubTab(mobileCtx.pnlTargetTab);
      setMobileActiveSubPage(mobileCtx.pnlTargetTab);
    }
  }, [mobileCtx?.pnlTargetTab]);
  const [viewBasis, setViewBasis] = useState<ProfitViewBasis>('exGst');
  const [search, setSearch] = useState('');
  // Composition / unregistered bills carry a taxStamp: stock cost then includes the purchase GST (no ITC).
  const costIncludesGst = filteredBills.some((b) => b.taxStamp && b.taxStamp.registrationType !== 'regular');
  const [sortBy, setSortBy] = useState<'profit' | 'margin' | 'sales' | 'cases'>('profit');
  const [explainOpen, setExplainOpen] = useState(false);

  // Modal inspection state
  const [selectedProductForModal, setSelectedProductForModal] = useState<ProductMarginRow | null>(null);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);

  const { pnl, productMap, lineCogs, taxBasisOf } = useSalesMarginPnl({
    filteredBills,
    products,
    dateInPeriod,
    gstTaxSummary,
    purchaseStats,
    viewBasis,
  });

  const { productRows, customerRows, dayRows } = useSalesMarginBreakdowns({
    filteredBills,
    productMap,
    search,
    sortBy,
    viewBasis,
    lineCogs,
    taxBasisOf,
  });

  const basisText = viewBasis === 'exGst' ? 'Ex-GST operating profit' : 'Incl-GST billed value';

  const exportExcel = () =>
    exportSalesMarginExcel({
      viewBasis,
      periodLabel,
      basisText,
      pnl,
      productRows,
      customerRows,
      dayRows,
    });

  const exportPdf = () =>
    exportSalesMarginPdf({
      viewBasis,
      periodLabel,
      basisText,
      pnl,
      productRows,
      customerRows,
      dayRows,
    });

  const tabs: { id: MarginSubTab; label: string; shortLabel: string; icon: React.ReactNode }[] = [
    { id: 'netProfit', label: 'Salary budget', shortLabel: 'Salary', icon: <Wallet className="w-3.5 h-3.5" /> },
    { id: 'products', label: 'Products', shortLabel: 'Products', icon: <Package className="w-3.5 h-3.5" /> },
    { id: 'customers', label: 'Customers', shortLabel: 'Customers', icon: <Users className="w-3.5 h-3.5" /> },
    { id: 'days', label: 'By day', shortLabel: 'Days', icon: <TrendingUp className="w-3.5 h-3.5" /> },
  ];

  const showControls = subTab !== 'netProfit';
  const showSearch = subTab === 'products' || subTab === 'customers';
  const searchHint =
    subTab === 'products' ? 'Search product…' : 'Search customer…';
  const tabOptions = tabs.map((t) => ({ id: t.id, label: t.label }));
  const basisOptions: { id: ProfitViewBasis; label: string }[] = [
    { id: 'exGst', label: 'Ex-GST (operating profit)' },
    { id: 'inclGst', label: 'Incl-GST (billed value)' },
  ];
  const sortOptions: { id: typeof sortBy; label: string }[] = [
    { id: 'profit', label: 'Profit' },
    { id: 'margin', label: 'Margin %' },
    { id: 'sales', label: 'Sales' },
    { id: 'cases', label: 'Cases' },
  ];
  const isFiltered = showSearch && search.trim().length > 0;
  const profitNeg = pnl.activeGrossProfit < 0;
  const paidPct = pnl.collected > 0 ? `${((pnl.collected / (pnl.billedSalesNet || 1)) * 100).toFixed(0)}% paid` : '0% paid';
  const rs = (n: number) => `₹${money(n)}`;

  const compactRs = (n: number) => {
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(1)}L`;
    if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`;
    return `${sign}₹${Math.round(abs)}`;
  };

  const activeMobileTabLabel = tabs.find((t) => t.id === (mobileActiveSubPage || subTab))?.label || 'Products';
  const shareProps = {
    reportTitle: `Profit & Loss - ${activeMobileTabLabel}`,
    summaryLines: [
      { label: 'Sales', value: rs(pnl.activeNetSales) },
      { label: 'Gross profit', value: rs(pnl.activeGrossProfit) },
      { label: 'Margin', value: `${pnl.activeMarginPct.toFixed(1)}%` },
    ],
    sheets: [
      {
        name: 'Products',
        header: ['Product', 'Cases', 'Sales', 'Profit', 'Margin %'],
        rows: productRows.map((r) => [r.productName, r.casesSold, r.taxableSales, r.operatingProfit, Number(r.operatingMarginPct.toFixed(2))]),
      },
    ],
    pdfSections: [
      {
        title: 'Products',
        header: ['Product', 'Cases', 'Profit', 'Margin %'],
        rows: productRows.map((r) => [r.productName, r.casesSold, money(r.operatingProfit), `${r.operatingMarginPct.toFixed(1)}%`]),
        rightAlign: [1, 2, 3],
      },
    ],
  };

  const barItems = useMemo(() => {
    if (subTab === 'products') {
      return productRows.slice(0, 5).map((r) => ({
        key: String(r.productId),
        label: r.productName,
        value: r.operatingProfit,
        display: compactRs(r.operatingProfit),
      }));
    }
    if (subTab === 'customers') {
      return customerRows.slice(0, 5).map((r) => ({
        key: r.customerKey,
        label: r.customerName,
        value: r.grossProfit,
        display: compactRs(r.grossProfit),
      }));
    }
    return dayRows.slice(0, 5).map((r) => ({
      key: r.date,
      label: fmtShortDate(r.date),
      value: r.grossProfit,
      display: compactRs(r.grossProfit),
    }));
  }, [subTab, productRows, customerRows, dayRows]);
  const maxBarAbs = Math.max(1, ...barItems.map((b) => Math.abs(b.value)));

  return (
    <div className="space-y-3 animate-in fade-in duration-200" id="report-sales-margin-pnl">
      {/* ============================ PHONE ============================ */}
      <div className="md:hidden space-y-3">
        <MobileReportTopBar
          title={activeMobileTabLabel}
          sub="Profit & Loss"
          doubleBack
          onBack={() => {
            if (mobileCtx) {
              mobileCtx.setPnlTargetTab(null);
            } else {
              setMobileActiveSubPage(null);
            }
          }}
          showPeriod
          shareProps={shareProps}
        />

        {showControls && (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              {([
                { id: 'profit', label: 'Profit' },
                { id: 'margin', label: 'Margin %' },
                { id: 'sales', label: 'Sold' },
              ] as const).map((opt) => {
                const active = sortBy === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSortBy(opt.id)}
                    className={`shrink-0 px-3.5 py-1.5 rounded-full text-[12px] font-bold border transition-colors cursor-pointer ${
                      active
                        ? 'bg-[var(--text)] text-white border-[var(--text)]'
                        : 'bg-white text-[var(--text)] border-[var(--border)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setViewBasis((b) => (b === 'exGst' ? 'inclGst' : 'exGst'))}
              className="shrink-0 px-2.5 py-1.5 rounded-full text-xs font-bold bg-white border border-[var(--border)] text-[var(--text-2)] cursor-pointer"
              title="Toggle Ex-GST / Incl-GST"
            >
              {viewBasis === 'exGst' ? 'Ex-GST' : 'Incl-GST'}
            </button>
          </div>
        )}

        {showControls && barItems.length > 0 && (
          <section className="rt-rep-card rt-rep-pad space-y-2.5">
            <div className="text-[13px] font-bold text-[var(--text)]">
              {subTab === 'products' ? 'Margin by product' : subTab === 'customers' ? 'Profit by customer' : 'Profit by day'}
            </div>
            <div className="space-y-2">
              {barItems.map((b) => {
                const isNeg = b.value < 0;
                const pct = Math.max(8, Math.round((Math.abs(b.value) / maxBarAbs) * 100));
                return (
                  <div key={b.key} className="grid grid-cols-[84px_1fr_54px] items-center gap-2.5 text-xs">
                    <span className="font-semibold text-[var(--text)] truncate">{b.label}</span>
                    <div className="rt-hbar-track">
                      <div
                        className="rt-hbar-fill"
                        style={{
                          width: `${pct}%`,
                          background: isNeg ? 'var(--due)' : 'var(--primary)',
                        }}
                      />
                    </div>
                    <span className={`text-right font-bold tabular-nums ${isNeg ? 'text-[var(--due)]' : 'text-[var(--text)]'}`}>
                      {b.display}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {showSearch && (
          <div className="rt-search-bar">
            <Search size={15} className="text-[var(--text-2)] shrink-0" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchHint}
            />
            {search.trim() && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-[var(--text-2)] p-1 cursor-pointer"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ======================= TABLET / DESKTOP ======================= */}
      <div className="hidden md:block space-y-3">
        <ReportTitleBar
          title="Sales, margin & P&L"
          sub={`${periodLabel} · revenue, cost and margin by product, batch, customer and day`}
          actions={showControls ? <ReportDownloadButtons onExcel={exportExcel} onPdf={exportPdf} disabled={pnl.invoiceCount === 0} reportTitle="Sales, margin and P&L" /> : undefined}
        />

        {showControls && (
          <>
            <ReportStatGrid>
              <ReportStat label="You got" value={rs(pnl.activeNetSales)} tone="sky" sub={viewBasis === 'exGst' ? `Taxable sales · GST ${rs(pnl.totalOutputGstNet)}` : `Net billed · GST ${rs(pnl.totalOutputGstNet)}`} />
              <ReportStat label="You spent" value={rs(pnl.cogs)} tone="amber" sub={`${pnl.totalDispatchedCases} cs (${pnl.freeCases} free) · ${rs(pnl.avgCostPerCase)} / cs`} />
              <ReportStat label={viewBasis === 'exGst' ? 'Operating profit' : 'Gross margin'} value={rs(pnl.activeGrossProfit)} tone={profitNeg ? 'red' : 'green'} sub={`${rs(pnl.avgProfitPerCase)} / cs profit`} />
              <ReportStat
                label="Margin"
                value={`${pnl.activeMarginPct.toFixed(1)}%`}
                tone={pnl.activeMarginPct >= 12 ? 'green' : pnl.activeMarginPct >= 0 ? 'amber' : 'red'}
                sub={`${pnl.invoiceCount} invoices · ${paidPct}`}
              />
            </ReportStatGrid>
            <ReportBreakdownLine onExplain={() => setExplainOpen(true)}>
              <span>
                {viewBasis === 'exGst'
                  ? `Ex-GST view · sales ${rs(pnl.taxableSalesNet)} + GST ${rs(pnl.totalOutputGstNet)} = billed ${rs(pnl.billedSalesNet)}`
                  : `Incl-GST view · billed ${rs(pnl.billedSalesNet)} includes GST ${rs(pnl.totalOutputGstNet)} owed to the government`}
              </span>
            </ReportBreakdownLine>
          </>
        )}

        <ReportFilterPanel
          search={showSearch ? { value: search, onChange: setSearch, placeholder: searchHint } : undefined}
          isFiltered={isFiltered}
          onReset={() => setSearch('')}
        >
          <ReportChipGroup<MarginSubTab> label="View" options={tabOptions} value={subTab} onChange={setSubTab} />
          {showControls && <ReportChipGroup<ProfitViewBasis> label="Basis" options={basisOptions} value={viewBasis} onChange={setViewBasis} />}
          {showSearch && <ReportChipGroup<typeof sortBy> label="Sort" options={sortOptions} value={sortBy} onChange={setSortBy} />}
        </ReportFilterPanel>
      </div>

      {/* Subtab views - on mobile only shown when a subpage card is selected */}
      <div className={mobileActiveSubPage === null ? 'hidden md:block' : ''}>
        {subTab === 'products' && (
          <ProductMarginSection
            productRows={productRows}
            viewBasis={viewBasis}
            costIncludesGst={costIncludesGst}
            onInspectProduct={(r) => {
              setSelectedProductForModal(r);
              setIsPricingModalOpen(true);
            }}
          />
        )}

        {subTab === 'customers' && <CustomerMarginSection customerRows={customerRows} />}

        {subTab === 'days' && <DayMarginSection dayRows={dayRows} />}

        {subTab === 'netProfit' && dateInPeriod && (
          <NetProfitReport
            dateInPeriod={dateInPeriod}
            filteredBills={filteredBills}
            products={products}
            gstTaxSummary={gstTaxSummary}
            purchaseStats={purchaseStats}
            periodLabel={periodLabel}
          />
        )}
      </div>

      {/* Interactive Product Profit & Pricing Modal */}
      <ProductProfitPricingModal
        isOpen={isPricingModalOpen}
        onClose={() => {
          setIsPricingModalOpen(false);
          setSelectedProductForModal(null);
        }}
        row={selectedProductForModal}
        bills={filteredBills}
      />

      {showControls && <PhoneDownloadBar onExcel={exportExcel} onPdf={exportPdf} disabled={pnl.invoiceCount === 0} />}

      {explainOpen && (
        <ReportExplainModal ariaLabel="How sales, margin and profit are calculated" onClose={() => setExplainOpen(false)}>
          <ExplainBox tone="emerald" title={viewBasis === 'exGst' ? `Ex-GST operating profit: ${rs(pnl.operatingGrossProfit)}` : `Incl-GST billed value: ${rs(pnl.billedSalesNet)}`}>
            {viewBasis === 'exGst' ? (
              <p>
                Revenue is taxable turnover ({rs(pnl.taxableSalesNet)}) with output GST ({rs(pnl.totalOutputGstNet)}) shown separately. Cost covers all {pnl.totalDispatchedCases} crates
                dispatched, including {pnl.freeCases} free scheme crates, from the batch each invoice was issued from plus inward freight and labour.
              </p>
            ) : (
              <p>
                Invoiced revenue of {rs(pnl.billedSalesNet)} includes {rs(pnl.totalOutputGstNet)} GST. That GST is owed to the government (less input credit) and is not profit you keep.
              </p>
            )}
          </ExplainBox>
          <ExplainBox tone="slate" title={`Average selling price`}>
            <p>Sales divided by billed cases only ({pnl.casesSold}). Free scheme crates add cost but no billed sales.</p>
          </ExplainBox>
        </ReportExplainModal>
      )}
    </div>
  );
};
