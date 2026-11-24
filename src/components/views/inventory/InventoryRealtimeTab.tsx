import React from 'react';
import { Search } from 'lucide-react';
import { BillingSettings, Product, Warehouse } from '../../../types';
import { PackIcon } from '../../common/PackIcon';
import { SizeChip } from '../../common/SizeChip';
import type { OversoldItem } from '../../../utils/oversoldDiagnostic';

interface BatchLineView {
  key: string;
  warehouseId: string;
  warehouseName: string;
  batchNumber: string;
  expiryDate?: string;
  availableQty: number;
  receivedQty: number;
}

interface InventoryRealtimeTabProps {
  isPhone: boolean;
  todayStr: string;
  filteredProducts: Product[];
  warehouses: Warehouse[];
  selectedWarehouse: string;
  setSelectedWarehouse: React.Dispatch<React.SetStateAction<string>>;
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  billingSettings?: BillingSettings;
  oversoldReport: OversoldItem[];
  setOversoldInspect: React.Dispatch<React.SetStateAction<{ open: boolean; productId?: number; warehouseId?: string }>>;
  expandedBatchProductIds: Record<number, boolean>;
  setExpandedBatchProductIds: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  totalStockCases: number;
  fmtCompactInr: (val: number) => string;
  remainingStock: (id: number) => number;
  warehouseStock: (whId: string, productId: number) => number;
  productWarehouseStock: (id: number) => { warehouseId: string; warehouseName: string; crates: number }[];
  productBatchLines: (id: number) => BatchLineView[];
}

export const InventoryRealtimeTab: React.FC<InventoryRealtimeTabProps> = ({
  isPhone,
  todayStr,
  filteredProducts,
  warehouses,
  selectedWarehouse,
  setSelectedWarehouse,
  searchTerm,
  setSearchTerm,
  billingSettings,
  oversoldReport,
  setOversoldInspect,
  expandedBatchProductIds,
  setExpandedBatchProductIds,
  totalStockCases,
  fmtCompactInr,
  remainingStock,
  warehouseStock,
  productWarehouseStock,
  productBatchLines,
}) => {
  const today = todayStr;
  const daysUntil = (exp?: string) => {
    if (!exp) return null;
    const d = new Date(exp.length === 10 ? exp + 'T12:00:00' : exp);
    if (isNaN(d.getTime())) return null;
    const t = new Date(today + 'T12:00:00');
    return Math.round((d.getTime() - t.getTime()) / 86400000);
  };
  const formatExp = (exp?: string) => {
    if (!exp) return 'Exp —';
    const d = new Date(exp.length === 10 ? exp + 'T12:00:00' : exp);
    if (isNaN(d.getTime())) return `Exp ${exp}`;
    return `Exp ${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  };
  const expBadge = (days: number | null) => {
    if (days === null) return null;
    if (days < 0) {
      return (
        <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700">
          Expired
        </span>
      );
    }
    if (days <= 30) {
      return (
        <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
          {days}d
        </span>
      );
    }
    if (days <= 90) {
      return (
        <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-700">
          {days}d
        </span>
      );
    }
    return (
      <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
        {days}d
      </span>
    );
  };

  // Products to show: filtered, with optional location filter applied to live warehouse stock
  const stockProducts = filteredProducts
    .map((p) => {
      const batchLines = productBatchLines(p.id);
      const batches =
        selectedWarehouse === 'all'
          ? batchLines
          : batchLines.filter((b) => b.warehouseId === selectedWarehouse);

      const liveStock =
        selectedWarehouse === 'all'
          ? remainingStock(p.id)
          : warehouseStock(selectedWarehouse, p.id);

      const headerQty = Math.max(0, liveStock);
      return { p, batches, rem: liveStock, headerQty };
    })
    .filter(({ batches, headerQty }) => {
      if (selectedWarehouse !== 'all') {
        // Show product if it has available live stock at this warehouse or matching batches
        return headerQty > 0 || batches.some((b) => b.availableQty > 0);
      }
      return true;
    })
    .sort((a, b) => a.p.name.localeCompare(b.p.name));

  if (isPhone) {
    const lowThreshold = billingSettings?.lowStockThreshold ?? 10;
    const phoneTotalCases = stockProducts.reduce((s, r) => s + Math.max(0, r.headerQty), 0);
    const phoneTotalValue = stockProducts.reduce((s, r) => s + Math.max(0, r.headerQty) * (Number(r.p.wholesale) || 0), 0);
    const oversoldProductCount = new Set(oversoldReport.map((o) => o.productId)).size;

    return (
      <div className="flex flex-col gap-3 w-full">
        <div className="rt-search-bar">
          <Search size={16} className="text-slate-400 shrink-0" />
          <input
            enterKeyHint="search"
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search product"
          />
        </div>

        <div className="hh-inv-card flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[12px] font-medium text-slate-500">Total stock</div>
            <div className="text-[22px] font-extrabold text-slate-900 leading-tight tabular-nums mt-0.5">
              {phoneTotalCases.toLocaleString()} cs
            </div>
          </div>
          <div className="text-right min-w-0">
            <div className="text-[12px] font-medium text-slate-500">Value</div>
            <div className="text-[20px] font-extrabold text-slate-900 leading-tight tabular-nums mt-0.5">
              {fmtCompactInr(phoneTotalValue)}
            </div>
          </div>
        </div>

        {oversoldReport.length > 0 && (
          <div className="hh-inv-card hh-inv-card--alert-red flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[13.5px] font-bold text-rose-600 leading-snug">
                {oversoldProductCount} product{oversoldProductCount === 1 ? '' : 's'} oversold
              </div>
              <div className="text-[12px] text-slate-500 leading-snug mt-0.5">
                Book stock is below zero in a godown
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOversoldInspect({ open: true })}
              className="text-[13px] font-bold text-[#2864d9] px-2 py-1 min-w-0 shrink-0 cursor-pointer"
            >
              Fix
            </button>
          </div>
        )}

        {stockProducts.length === 0 ? (
          <div className="hh-inv-card py-10 text-center">
            <p className="text-sm font-semibold text-slate-700">No stock to show</p>
            <p className="text-xs text-slate-500 mt-1">
              Adjust search or location, or receive inward stock.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5 hh-tgrid-2">
            {stockProducts.map(({ p, batches, headerQty }) => {
              const expanded = !!expandedBatchProductIds[p.id];
              const whNames = Array.from(
                new Set(
                  productWarehouseStock(p.id)
                    .filter((r) => r.crates > 0 && (selectedWarehouse === 'all' || r.warehouseId === selectedWarehouse))
                    .map((r) => r.warehouseName)
                )
              );
              if (whNames.length === 0) {
                const batchWh = Array.from(
                  new Set(
                    batches.map((b) => warehouses.find((w) => w.id === b.warehouseId)?.name || b.warehouseName).filter(Boolean)
                  )
                );
                whNames.push(...(batchWh as string[]));
              }
              const hasExpiredOrSoon = batches.some((b) => {
                const d = daysUntil(b.expiryDate);
                return b.availableQty > 0 && d !== null && d <= 30;
              });
              const isLow = headerQty > 0 && headerQty <= lowThreshold;
              const batchCount = batches.filter((b) => b.availableQty !== 0).length || batches.length;

              let statusPill: React.ReactNode = null;
              if (hasExpiredOrSoon) {
                statusPill = (
                  <span className="inline-block px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-xs font-bold">
                    Expiring
                  </span>
                );
              } else if (isLow) {
                statusPill = (
                  <span className="inline-block px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
                    Low
                  </span>
                );
              } else if (batchCount > 0) {
                statusPill = (
                  <span className="inline-block px-2 py-0.5 rounded-full bg-sky-50 text-[#2864d9] text-xs font-bold">
                    {batchCount} batch{batchCount === 1 ? '' : 'es'}
                  </span>
                );
              } else {
                statusPill = (
                  <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs font-bold">
                    {headerQty === 0 ? 'Out' : 'Book'}
                  </span>
                );
              }

              return (
                <div key={p.id} className="hh-inv-card p-0 overflow-hidden">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedBatchProductIds((prev) => ({
                        ...prev,
                        [p.id]: !prev[p.id],
                      }))
                    }
                    aria-expanded={expanded}
                    className="w-full flex items-center justify-between gap-2.5 px-3.5 py-3 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <PackIcon pack={p.pack} name={p.name} />
                      <div className="min-w-0">
                        <div className="text-[14px] font-bold text-slate-900 leading-snug truncate">
                          {p.name}
                        </div>
                        <div className="text-[12px] font-medium text-slate-500 truncate mt-0.5">
                          {whNames.length > 0 ? whNames.join(' · ') : warehouses[0]?.name || 'Main'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 space-y-0.5">
                      <div className="text-[14.5px] font-extrabold text-slate-900 tabular-nums leading-tight">
                        {headerQty} cs
                      </div>
                      <div>{statusPill}</div>
                    </div>
                  </button>

                  {expanded && (
                    <div className="border-t border-slate-100 px-3.5 pb-3 pt-2">
                      {productWarehouseStock(p.id)
                        .filter((r) => r.crates < 0 && (selectedWarehouse === 'all' || r.warehouseId === selectedWarehouse))
                        .map((r) => (
                          <div key={`neg_${r.warehouseId}`} className="mb-2 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 flex items-center justify-between gap-2 text-xs">
                            <span className="font-semibold text-rose-800">
                              {r.warehouseName}: book balance {r.crates} cs
                            </span>
                            <button
                              type="button"
                              onClick={() => setOversoldInspect({ open: true, productId: p.id, warehouseId: r.warehouseId })}
                              className="font-bold text-[#2864d9] shrink-0 cursor-pointer"
                            >
                              Fix
                            </button>
                          </div>
                        ))}
                      {batches.length > 0 ? (
                        <>
                          <div className="flex items-center justify-between text-xs font-medium text-slate-400 pb-1.5">
                            <span>Batch · expiry · godown</span>
                            <span>Cases</span>
                          </div>
                          <div className="divide-y divide-slate-100">
                            {batches.map((b) => {
                              const wh = warehouses.find((w) => w.id === b.warehouseId);
                              const days = daysUntil(b.expiryDate);
                              const qty = b.availableQty;
                              return (
                                <div key={b.key} className="py-2 flex items-center justify-between gap-2 text-[12.5px]">
                                  <div className="min-w-0 truncate text-slate-700">
                                    <strong className="font-bold text-slate-900">{b.batchNumber || '—'}</strong>
                                    <span> · {formatExp(b.expiryDate)} · {wh?.name || b.warehouseName || 'Main'}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className={`font-bold tabular-nums ${qty < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                                      {qty} cs
                                    </span>
                                    {expBadge(days)}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      ) : (
                        <div className="py-1.5 text-[12px] text-slate-500">
                          Book stock: <strong className="text-slate-800">{headerQty} cs</strong>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 max-w-none mx-auto w-full">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input enterKeyHint="search"
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search product"
            className="w-full pl-9 pr-3 py-2 sm:py-2.5 rounded-full border border-black/10 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/25"
          />
        </div>
        <select
          value={selectedWarehouse}
          onChange={(e) => setSelectedWarehouse(e.target.value)}
          className="w-full sm:w-48 px-3 py-2.5 rounded-full border border-black/10 bg-white text-sm font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/25"
        >
          <option value="all">All locations</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </div>

      {stockProducts.length === 0 ? (
        <div data-card-tone="neutral" className="rounded-2xl border shadow-sm px-6 py-12 text-center">
          <p className="text-sm font-semibold text-slate-700">No stock to show</p>
          <p className="text-xs text-slate-500 mt-1">
            Adjust search or location, or receive inward stock.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <div className="px-1 text-xs font-semibold text-slate-500 tabular-nums">
            {totalStockCases.toLocaleString()} units on hand · {stockProducts.length} product{stockProducts.length === 1 ? '' : 's'}
          </div>
          <ul className="space-y-2.5">
            {stockProducts.map(({ p, batches, headerQty }) => {
              const expanded = !!expandedBatchProductIds[p.id];
              const hasDetail = batches.length > 0;
              const stockTone =
                headerQty < 0
                  ? 'due'
                  : headerQty === 0
                    ? 'neutral'
                    : headerQty <= 5
                      ? 'warning'
                      : 'received';
              return (
                <li
                  key={p.id}
                  data-card-tone={stockTone}
                  className="rounded-2xl border shadow-sm overflow-hidden transition-shadow"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedBatchProductIds((prev) => ({
                        ...prev,
                        [p.id]: !prev[p.id],
                      }))
                    }
                    className="w-full flex items-center justify-between gap-3 px-3 sm:px-4 py-3 sm:py-3.5 text-left cursor-pointer transition-colors"
                    aria-expanded={expanded}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <PackIcon pack={p.pack} name={p.name} />
                      <span className="text-[13px] sm:text-sm font-bold text-slate-900 leading-snug break-words min-w-0">
                        {p.name}{' '}
                        <SizeChip volume={p.volume} pack={p.pack} name={p.name} />
                      </span>
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-xl text-xs sm:text-sm font-extrabold tabular-nums shrink-0 border ${
                        headerQty < 0
                          ? 'bg-rose-100/90 text-rose-700 border-rose-200'
                          : headerQty === 0
                            ? 'bg-white/80 text-slate-500 border-slate-200/80'
                            : headerQty <= 5
                              ? 'bg-amber-100/90 text-amber-800 border-amber-200'
                              : 'bg-white/85 text-emerald-800 border-emerald-200/80'
                      }`}
                    >
                      {headerQty} cs
                    </span>
                  </button>

                  {expanded && (
                    <div className="border-t border-black/5 bg-white/85">
                      {productWarehouseStock(p.id)
                        .filter((r) => r.crates < 0 && (selectedWarehouse === 'all' || r.warehouseId === selectedWarehouse))
                        .map((r) => (
                          <div key={`neg_${r.warehouseId}`} className="px-3 sm:px-4 py-2 text-xs font-semibold text-rose-700 bg-rose-50 border-b border-rose-100">
                            Oversold in {r.warehouseName}: book balance {r.crates} cs. Check the godown on those bills or run a stock audit.{' '}
                            <button
                              type="button"
                              onClick={() => setOversoldInspect({ open: true, productId: p.id, warehouseId: r.warehouseId })}
                              className="ml-1 rounded-md bg-rose-700 px-2 py-0.5 text-xs font-bold text-white hover:bg-rose-800 cursor-pointer"
                            >
                              Inspect Bills
                            </button>
                          </div>
                        ))}
                      {hasDetail ? (
                        <ul className="divide-y divide-black/5">
                          {batches.map((b) => {
                            const wh = warehouses.find((w) => w.id === b.warehouseId);
                            const days = daysUntil(b.expiryDate);
                            const qty = b.availableQty;
                            const inward = b.receivedQty;
                            return (
                              <li
                                key={b.key}
                                className="px-3 sm:px-4 py-2.5 flex items-start gap-2 sm:gap-3"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="text-[13px] text-slate-700 leading-snug">
                                    <span className="font-medium">
                                      Batch {b.batchNumber ? b.batchNumber : '·'}
                                    </span>
                                    <span className="text-slate-400"> · </span>
                                    <span>{wh?.name || b.warehouseName || b.warehouseId || 'Unknown godown'}</span>
                                  </div>
                                  <div className="text-xs text-slate-500 mt-0.5">
                                    {formatExp(b.expiryDate)}
                                    {inward > 0 && inward !== qty && (
                                      <span className="text-slate-400 ml-1.5 font-normal">
                                        (inward: {inward} cs)
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 pt-0.5">
                                  {expBadge(days)}
                                  <span
                                    className={`text-sm font-bold tabular-nums min-w-[2rem] text-right ${
                                      qty < 0 ? 'text-rose-600' : qty === 0 ? 'text-slate-400' : 'text-slate-800'
                                    }`}
                                  >
                                    {qty} cs
                                  </span>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <div className="px-4 py-3 text-xs text-slate-500">
                          No batch rows
                          {selectedWarehouse !== 'all' ? ' at this location' : ''}.
                          Book stock:{' '}
                          <span className="font-semibold text-slate-700">
                            {selectedWarehouse === 'all'
                              ? remainingStock(p.id)
                              : warehouseStock(selectedWarehouse, p.id)}{' '}
                            cs
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};
