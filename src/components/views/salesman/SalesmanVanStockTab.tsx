import React from 'react';
import { Package, Plus, Search, Truck, X } from 'lucide-react';
import { PaletteTokens, Product, Trip, Warehouse } from '../../../types';
import { useLanguage } from '../../../i18n/LanguageContext';
import { OdiaName } from '../../common/OdiaName';
import { SizeChip } from '../../common/SizeChip';
import { money } from '../../../utils/billing';
import { resolveTripGodownDisplay } from '../../../utils/tripLoads';
import type { SalesmanTab } from './SalesmanHomeTab';

export type VehicleProductItem = Product & {
  vanLoaded: number;
  vanSold: number;
  vanAvailable: number;
  isLoadedOnVan: boolean;
};

export interface SalesmanVanStockTabProps {
  activeTrip: Trip | null;
  warehouses: Warehouse[];
  tripTotalBilled: number;
  tripTotalCollected: number;
  vanStockCounts: {
    totalLoadedCases: number;
    totalSoldCases: number;
    totalAvailableCases: number;
  };
  vanStockSearch: string;
  setVanStockSearch: (val: string) => void;
  filteredVehicleProducts: VehicleProductItem[];
  palette: PaletteTokens;
  fz: (base: number, extra?: React.CSSProperties) => React.CSSProperties;
  setSalesmanTab: (tab: SalesmanTab) => void;
  onQuickAddToSale: (productId: number, productName: string) => void;
}

export const SalesmanVanStockTab: React.FC<SalesmanVanStockTabProps> = ({
  activeTrip,
  warehouses,
  tripTotalBilled,
  tripTotalCollected,
  vanStockCounts,
  vanStockSearch,
  setVanStockSearch,
  filteredVehicleProducts,
  palette,
  fz,
  setSalesmanTab,
  onQuickAddToSale,
}) => {
  const { t } = useLanguage();

  return (
    <section id="salesman-van-stock-view" className="space-y-4">
      <div
        data-card-tone="neutral"
        className="p-3.5 sm:p-4 rounded-2xl border shadow-sm"
      >
        {/* Header with Title & Live Van Run Metrics */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-200/80">
          <div className="flex items-center gap-2.5">
            <div className="hh-icon-badge hh-icon-badge--blue">
              <Truck size={20} />
            </div>
            <div>
              <h2 style={fz(18, { fontWeight: 900 })} className="text-slate-900">
                {activeTrip ? `Van Stock · ${activeTrip.vehicle}` : t('salesman.tab.vanStock')}
              </h2>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                {activeTrip
                  ? `${activeTrip.route || 'Route'} · ${resolveTripGodownDisplay({ trip: activeTrip, warehouses }).label || 'Main Godown'}`
                  : 'No vehicle currently assigned.'}
              </p>
            </div>
          </div>
          {activeTrip && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-bold tabular-nums text-emerald-800">
                Invoiced: ₹{money(tripTotalBilled)}
              </div>
              <div className="px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-xs font-bold tabular-nums text-blue-800">
                Collected: ₹{money(tripTotalCollected)}
              </div>
            </div>
          )}
        </div>

        {/* High-Level On-Board Cases Summary Bar */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
          <div data-card-tone="neutral" className="border rounded-2xl p-2.5 sm:p-3 text-center">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Loaded</div>
            <div className="text-lg sm:text-2xl font-black tabular-nums text-slate-900 mt-0.5">{vanStockCounts.totalLoadedCases} cs</div>
            <div className="text-xs text-slate-500 font-medium hidden sm:block">Departed on van</div>
          </div>
          <div data-card-tone="sales" className="border rounded-2xl p-2.5 sm:p-3 text-center">
            <div className="text-xs font-bold text-blue-700 uppercase tracking-wider">Total Sold</div>
            <div className="text-lg sm:text-2xl font-black tabular-nums text-blue-800 mt-0.5">{vanStockCounts.totalSoldCases} cs</div>
            <div className="text-xs text-blue-600 font-medium hidden sm:block">Delivered on route</div>
          </div>
          <div data-card-tone="received" className="border rounded-2xl p-2.5 sm:p-3 text-center">
            <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Remaining</div>
            <div className="text-lg sm:text-2xl font-black tabular-nums text-emerald-800 mt-0.5">{vanStockCounts.totalAvailableCases} cs</div>
            <div className="text-xs text-emerald-600 font-medium hidden sm:block">Ready to bill now</div>
          </div>
        </div>

        {/* Controls Toolbar: Search Only (No crossed-out filter chips or table toggle) */}
        <div className="mb-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={vanStockSearch}
              onChange={(e) => setVanStockSearch(e.target.value)}
              placeholder="Search loaded beverage by name or SKU..."
              className="w-full pl-9 pr-8 py-2.5 text-xs sm:text-sm font-semibold border-2 rounded-xl focus-ring bg-white"
              style={{ borderColor: palette.line }}
            />
            {vanStockSearch && (
              <button aria-label="Clear search"
                type="button"
                onClick={() => setVanStockSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        {/* EMPTY SEARCH / FILTER RESULTS */}
        {filteredVehicleProducts.length === 0 ? (
          <div className="text-center py-10 px-4 border-2 border-dashed rounded-2xl bg-slate-50 text-slate-500 space-y-3" style={{ borderColor: palette.line }}>
            <Package size={40} className="mx-auto text-slate-400" />
            <div>
              <p className="font-extrabold text-sm sm:text-base text-slate-800">
                {vanStockSearch
                  ? 'No loaded beverage items match your search.'
                  : 'No beverages currently loaded on this vehicle run.'}
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                {vanStockSearch
                  ? 'Try clearing your search term to see all loaded van products.'
                  : 'Load beverage stock onto your vehicle in the Trips menu before heading out on route.'}
              </p>
            </div>
            {vanStockSearch ? (
              <button
                type="button"
                onClick={() => setVanStockSearch('')}
                className="px-4 py-2 text-xs font-bold bg-sky-600 text-white rounded-xl cursor-pointer hover:bg-sky-500 shadow-sm"
              >
                Clear Search
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setSalesmanTab('trips')}
                className="px-4 py-2.5 text-xs font-black bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl cursor-pointer shadow-sm inline-flex items-center gap-1.5"
              >
                <Truck size={15} />
                <span>Go to Trips to Load Stock</span>
              </button>
            )}
          </div>
        ) : (
          /* CARD-BASED LAYOUT ONLY (ALL SHOULD BE CARD OPTION) */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredVehicleProducts.map((p) => {
              const isOutOfStock = p.vanAvailable <= 0;
              const isLoaded = p.vanLoaded > 0;
              const percentSold = isLoaded ? Math.min(100, Math.round((p.vanSold / p.vanLoaded) * 100)) : 0;

              return (
                <div
                  key={p.id}
                  data-card-tone={isOutOfStock ? 'due' : 'received'}
                  className="border rounded-2xl p-3.5 shadow-sm hover:shadow transition-shadow flex flex-col justify-between"
                >
                  <div>
                    {/* Card Header: Name, SKU, and Status Badge */}
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-extrabold text-sm text-slate-900 break-words leading-snug" title={p.name}>
                          <OdiaName name={p.name} nameOr={p.nameOr} />
                        </h3>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {p.sku && (
                            <span className="text-xs font-bold px-1.5 py-0.2 rounded bg-white/80 text-slate-600 border border-slate-200">
                              {p.sku}
                            </span>
                          )}
                          <SizeChip volume={p.volume} pack={p.pack} name={p.name} />
                        </div>
                      </div>

                      {/* Van Status Badge: Loaded items are either AVAILABLE or VAN EMPTY */}
                      {isOutOfStock ? (
                        <span className="px-2 py-0.5 rounded-md text-xs font-extrabold bg-rose-100 text-rose-800 border border-rose-200 shrink-0">
                          VAN EMPTY
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                          AVAILABLE
                        </span>
                      )}
                    </div>

                    {/* 3-Column Reconciliation Metrics Box */}
                    <div className="grid grid-cols-3 gap-1.5 my-2.5 p-2 bg-white/80 rounded-xl border border-black/5 text-center tabular-nums">
                      <div>
                        <div className="text-xs font-bold text-slate-500 uppercase">Loaded</div>
                        <div className="text-sm font-extrabold text-slate-800">{p.vanLoaded} cs</div>
                      </div>
                      <div className="border-x border-slate-200">
                        <div className="text-xs font-bold text-sky-600 uppercase">Sold</div>
                        <div className="text-sm font-extrabold text-sky-800">{p.vanSold} cs</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-500 uppercase">Remaining</div>
                        <div
                          className="text-sm font-black"
                          style={{ color: isOutOfStock ? palette.bad : palette.good }}
                        >
                          {p.vanAvailable} cs
                        </div>
                      </div>
                    </div>

                    {/* Route Sales Progress Bar */}
                    {isLoaded && (
                      <div className="mb-2">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
                          <span>Sold Progress</span>
                          <span>{percentSold}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              percentSold >= 100 ? 'bg-rose-500' : percentSold > 50 ? 'bg-blue-600' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${percentSold}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Footer: Rates & Quick Add Action */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 mt-2">
                    <div className="text-xs font-semibold text-slate-600">
                      <div>Retail: <strong className="text-slate-900">₹{p.retail}</strong></div>
                      <div>Wholesale: <strong className="text-slate-900">₹{p.wholesale}</strong></div>
                    </div>

                    {p.vanAvailable > 0 ? (
                      <button
                        type="button"
                        onClick={() => onQuickAddToSale(p.id, p.name)}
                        className="px-3 py-1.5 text-xs font-bold bg-sky-600 text-white rounded-md hover:bg-sky-500 transition-colors flex items-center gap-1 cursor-pointer shadow-sm"
                        title="Add 1 case of this product to current sale"
                      >
                        <Plus size={13} />
                        <span>Add to Sale</span>
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded border border-rose-200">
                        Sold Out
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
