import { money } from '../../../utils/billing';
import { downloadPdf, downloadXlsx, fileStamp } from '../../../utils/reportDownload';
import type {
  CustomerMarginRow,
  DayMarginRow,
  ProductMarginRow,
  ProfitViewBasis,
} from './useSalesMarginPnl';

const pct2 = (n: number) => `${n.toFixed(2)}%`;

export interface SalesMarginExportPnlSummary {
  grossSales: number;
  totalDiscounts: number;
  taxableSalesNet: number;
  totalOutputGstNet: number;
  billedSalesNet: number;
  cogs: number;
  operatingGrossProfit: number;
  operatingMarginPct: number;
  casesSold: number;
  freeCases: number;
  totalDispatchedCases: number;
  invoiceCount: number;
}

export function exportSalesMarginExcel(args: {
  viewBasis: ProfitViewBasis;
  periodLabel: string;
  basisText: string;
  pnl: SalesMarginExportPnlSummary;
  productRows: ProductMarginRow[];
  customerRows: CustomerMarginRow[];
  dayRows: DayMarginRow[];
}) {
  const { viewBasis, periodLabel, basisText, pnl, productRows, customerRows, dayRows } = args;
  return downloadXlsx(`sales-margin-pnl-${viewBasis}-${fileStamp()}.xlsx`, [
    {
      name: 'Summary',
      header: ['Item', 'Value'],
      rows: [
        ['Period', periodLabel],
        ['Basis', basisText],
        ['Gross sales', pnl.grossSales],
        ['Discounts', pnl.totalDiscounts],
        ['Taxable sales (Ex-GST)', pnl.taxableSalesNet],
        ['Output GST', pnl.totalOutputGstNet],
        ['Net invoiced (Incl-GST)', pnl.billedSalesNet],
        ['Cost of goods (COGS)', pnl.cogs],
        ['Operating profit', pnl.operatingGrossProfit],
        ['Operating margin %', Number(pnl.operatingMarginPct.toFixed(2))],
        ['Billed cases', pnl.casesSold],
        ['Free cases', pnl.freeCases],
        ['Total dispatched', pnl.totalDispatchedCases],
        ['Invoices', pnl.invoiceCount],
      ],
    },
    {
      name: 'Products',
      header: [
        'Product',
        'Category',
        'Billed cs',
        'Free cs',
        'Dispatched',
        'Cost / cs',
        'Avg sell (Incl GST)',
        'Avg sell (Ex GST)',
        'Taxable sales',
        'Output GST',
        'Billed net',
        'COGS',
        'Operating profit',
        'Profit / cs',
        'Margin %',
      ],
      rows: productRows.map((r) => [
        r.productName,
        r.category,
        r.casesSold,
        r.freeCases,
        r.totalDispatched,
        r.costPerCase,
        r.avgBilledSellRate,
        r.avgTaxableSellRate,
        r.taxableSales,
        r.gstAmount,
        r.netSales,
        r.cogs,
        r.operatingProfit,
        r.profitPerCase,
        Number(r.operatingMarginPct.toFixed(2)),
      ]),
    },
    {
      name: 'Customers',
      header: [
        'Customer',
        'Invoices',
        'Cases',
        'Taxable sales',
        'GST',
        'Billed net',
        'COGS',
        'Profit',
        'Margin %',
        'Outstanding',
      ],
      rows: customerRows.map((r) => [
        r.customerName,
        r.invoices,
        r.casesSold,
        r.taxableSales,
        r.gstAmount,
        r.netSales,
        r.cogs,
        r.grossProfit,
        Number(r.marginPct.toFixed(2)),
        r.outstanding,
      ]),
    },
    {
      name: 'By day',
      header: [
        'Date',
        'Invoices',
        'Billed net',
        'Taxable sales',
        'GST',
        'COGS',
        'Profit',
        'Margin %',
        'Discounts',
      ],
      rows: dayRows.map((r) => [
        r.date,
        r.invoices,
        r.netSales,
        r.taxableSales,
        r.gstAmount,
        r.cogs,
        r.grossProfit,
        Number(r.marginPct.toFixed(2)),
        r.discounts,
      ]),
    },
  ]);
}

export function exportSalesMarginPdf(args: {
  viewBasis: ProfitViewBasis;
  periodLabel: string;
  basisText: string;
  pnl: SalesMarginExportPnlSummary;
  productRows: ProductMarginRow[];
  customerRows: CustomerMarginRow[];
  dayRows: DayMarginRow[];
}) {
  const { viewBasis, periodLabel, basisText, pnl, productRows, customerRows, dayRows } = args;
  return downloadPdf({
    filename: `sales-margin-pnl-${viewBasis}-${fileStamp()}.pdf`,
    title: 'Sales, margin & profit / loss',
    subtitle: ['MrWater Distribution', `Period: ${periodLabel}`, `Basis: ${basisText}`],
    landscape: true,
    sections: [
      {
        title: 'Summary',
        header: ['Item', 'Amount (Rs.)'],
        rows: [
          ['Taxable sales (Ex-GST)', money(pnl.taxableSalesNet)],
          ['Output GST', money(pnl.totalOutputGstNet)],
          ['Net invoiced (Incl-GST)', money(pnl.billedSalesNet)],
          ['Cost of goods (COGS)', money(pnl.cogs)],
          ['Operating profit', money(pnl.operatingGrossProfit)],
          ['Operating margin', pct2(pnl.operatingMarginPct)],
        ],
        rightAlign: [1],
      },
      {
        title: 'Products',
        header: ['Product', 'Billed cs', 'Free cs', 'Taxable sales', 'COGS', 'Profit', 'Margin'],
        rows: productRows.map((r) => [
          r.productName,
          r.casesSold,
          r.freeCases,
          money(r.taxableSales),
          money(r.cogs),
          money(r.operatingProfit),
          pct2(r.operatingMarginPct),
        ]),
        rightAlign: [1, 2, 3, 4, 5, 6],
      },
      {
        title: 'Customers',
        header: ['Customer', 'Invoices', 'Cases', 'Billed net', 'Profit', 'Margin', 'Outstanding'],
        rows: customerRows.map((r) => [
          r.customerName,
          r.invoices,
          r.casesSold,
          money(r.netSales),
          money(r.grossProfit),
          pct2(r.marginPct),
          money(r.outstanding),
        ]),
        rightAlign: [1, 2, 3, 4, 5, 6],
      },
      {
        title: 'By day',
        header: ['Date', 'Invoices', 'Billed net', 'Taxable sales', 'Profit', 'Margin'],
        rows: dayRows.map((r) => [
          r.date,
          r.invoices,
          money(r.netSales),
          money(r.taxableSales),
          money(r.grossProfit),
          pct2(r.marginPct),
        ]),
        rightAlign: [1, 2, 3, 4, 5],
      },
    ],
  });
}
