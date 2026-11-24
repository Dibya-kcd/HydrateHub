import React from 'react';
import {
  AlertCircle,
  Download,
  LayoutGrid,
  Percent,
  Plus,
  Search,
  Sparkles,
  Table,
  Tag,
} from 'lucide-react';
import { Warehouse } from '../../types';
import { downloadBulkInwardRowsCsv } from '../../utils/grnCsvExport';
import type { EditableInwardRow } from './bulkInwardTypes';

interface BulkInwardDesktopToolbarProps {
  paletteLine: string;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  filterNewOnly: boolean;
  setFilterNewOnly: (v: boolean) => void;
  filterSchemeOnly: boolean;
  setFilterSchemeOnly: (v: boolean) => void;
  filterAttentionOnly: boolean;
  setFilterAttentionOnly: (v: boolean) => void;
  rows: EditableInwardRow[];
  newProductsCount: number;
  itemsWithSchemeCount: number;
  attentionCount: number;
  bulkExpiryDate: string;
  setBulkExpiryDate: (v: string) => void;
  missingExpiryCount: number;
  handleFillEmptyExpiry: () => void;
  viewMode: 'table' | 'cards';
  setViewMode: (v: 'table' | 'cards') => void;
  density: 'comfortable' | 'compact';
  setDensity: (v: 'comfortable' | 'compact') => void;
  handleBulkSetListPriceGst: (isIncluded: boolean) => void;
  handleAutoGenerateAllBatches: () => void;
  onOpenBulkSchemeModal: () => void;
  handleAddNewRow: () => void;
  supplierName: string;
  invoiceNo: string;
  inwardDate: string;
  targetWarehouseId: string;
  warehouses: Warehouse[];
}

export const BulkInwardDesktopToolbar: React.FC<BulkInwardDesktopToolbarProps> = ({
  paletteLine,
  searchQuery,
  setSearchQuery,
  filterNewOnly,
  setFilterNewOnly,
  filterSchemeOnly,
  setFilterSchemeOnly,
  filterAttentionOnly,
  setFilterAttentionOnly,
  rows,
  newProductsCount,
  itemsWithSchemeCount,
  attentionCount,
  bulkExpiryDate,
  setBulkExpiryDate,
  missingExpiryCount,
  handleFillEmptyExpiry,
  viewMode,
  setViewMode,
  density,
  setDensity,
  handleBulkSetListPriceGst,
  handleAutoGenerateAllBatches,
  onOpenBulkSchemeModal,
  handleAddNewRow,
  supplierName,
  invoiceNo,
  inwardDate,
  targetWarehouseId,
  warehouses,
}) => (
  <div
    className="px-3 sm:px-4 py-1.5 border-b bg-white flex flex-wrap items-center gap-2 text-xs shrink-0"
    style={{ borderColor: paletteLine }}
  >
    <div className="relative w-full sm:w-52 lg:w-60">
      <Search size={14} className="absolute left-2.5 top-2 text-slate-400" />
      <input
        enterKeyHint="search"
        type="text"
        placeholder="Search product, HSN, category, scheme..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full pl-8 pr-7 py-1 border border-slate-300 rounded text-xs focus:border-indigo-500 focus:outline-hidden"
      />
      {searchQuery && (
        <button
          aria-label="Clear search"
          onClick={() => setSearchQuery('')}
          className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
        >
          ✕
        </button>
      )}
    </div>

    {/* Filter pills */}
    <div className="flex items-center gap-1 flex-wrap">
      <button
        onClick={() => {
          setFilterNewOnly(false);
          setFilterSchemeOnly(false);
          setFilterAttentionOnly(false);
        }}
        className={`px-2 py-0.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
          !filterNewOnly && !filterSchemeOnly && !filterAttentionOnly
            ? 'bg-slate-900 text-white'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        }`}
      >
        All ({rows.length})
      </button>
      <button
        onClick={() => {
          setFilterNewOnly(!filterNewOnly);
          if (!filterNewOnly) {
            setFilterSchemeOnly(false);
            setFilterAttentionOnly(false);
          }
        }}
        className={`px-2 py-0.5 rounded text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
          filterNewOnly
            ? 'bg-blue-600 text-white'
            : 'bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200'
        }`}
      >
        <Sparkles size={11} />
        New ({newProductsCount})
      </button>
      <button
        onClick={() => {
          setFilterSchemeOnly(!filterSchemeOnly);
          if (!filterSchemeOnly) {
            setFilterNewOnly(false);
            setFilterAttentionOnly(false);
          }
        }}
        className={`px-2 py-0.5 rounded text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
          filterSchemeOnly
            ? 'bg-purple-600 text-white'
            : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
        }`}
      >
        <Tag size={11} />
        Schemes ({itemsWithSchemeCount})
      </button>
      <button
        onClick={() => {
          setFilterAttentionOnly(!filterAttentionOnly);
          if (!filterAttentionOnly) {
            setFilterNewOnly(false);
            setFilterSchemeOnly(false);
          }
        }}
        className={`px-2 py-0.5 rounded text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
          filterAttentionOnly
            ? 'bg-amber-500 text-white'
            : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
        }`}
        title="Missing expiry date or zero rate"
      >
        <AlertCircle size={11} />
        Attention ({attentionCount})
      </button>
    </div>

    <div className="flex items-center gap-1.5 ml-auto flex-wrap">
      {/* Bulk expiry: fill only the EMPTY expiry cells (never overwrites what you typed) */}
      <div
        className="hidden lg:flex items-center gap-1 border border-slate-300 rounded px-1.5 py-0.5 bg-slate-50"
        title="Set one expiry date for every line that has none yet"
      >
        <span className="text-xs text-slate-500 font-medium">Expiry</span>
        <input
          type="date"
          value={bulkExpiryDate}
          onChange={(e) => setBulkExpiryDate(e.target.value)}
          className="text-xs bg-white border border-slate-300 rounded px-1 py-0.5 text-slate-800"
        />
        <button
          type="button"
          onClick={handleFillEmptyExpiry}
          disabled={missingExpiryCount === 0 || !bulkExpiryDate}
          className="px-1.5 py-0.5 rounded text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed cursor-pointer"
        >
          Fill empty ({missingExpiryCount})
        </button>
      </div>

      {/* View Mode Toggle: Cards vs Table */}
      <div className="flex items-center border border-slate-300 rounded-md p-0.5 bg-slate-100 text-xs shrink-0">
        <button
          type="button"
          onClick={() => setViewMode('cards')}
          className={`px-2 py-0.5 rounded flex items-center gap-1 font-semibold transition-colors cursor-pointer ${
            viewMode === 'cards' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
          title="Card View"
          aria-label="Card View"
        >
          <LayoutGrid size={13} />
          <span className="text-xs hidden sm:inline">Cards</span>
        </button>
        <button
          type="button"
          onClick={() => setViewMode('table')}
          className={`px-2 py-0.5 rounded flex items-center gap-1 font-semibold transition-colors cursor-pointer ${
            viewMode === 'table' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
          title="Table View"
          aria-label="Table View"
        >
          <Table size={13} />
          <span className="text-xs hidden sm:inline">Table</span>
        </button>
      </div>

      {viewMode === 'table' && (
        <div className="hidden lg:flex items-center border border-slate-300 rounded p-0.5 bg-slate-50 text-xs">
          <button
            onClick={() => setDensity('comfortable')}
            className={`px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
              density === 'comfortable' ? 'bg-white shadow-sm text-indigo-700 font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Comfortable row height"
          >
            Spacious
          </button>
          <button
            onClick={() => setDensity('compact')}
            className={`px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
              density === 'compact' ? 'bg-white shadow-sm text-indigo-700 font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Compact row height"
          >
            Compact
          </button>
        </div>
      )}

      {/* List Price GST Global Check & Toggle */}
      <div className="flex items-center gap-1 border border-indigo-200 rounded p-0.5 bg-indigo-50/70 text-xs shrink-0">
        <span className="text-xs font-bold text-indigo-900 px-1 flex items-center gap-1" title="Check if list prices include GST. If not, GST is calculated and added.">
          <Percent size={11} className="text-indigo-600" />
          List Price GST:
        </span>
        <button
          type="button"
          onClick={() => handleBulkSetListPriceGst(false)}
          className={`px-1.5 py-0.5 rounded text-xs font-bold transition-colors cursor-pointer ${
            rows.length > 0 && rows.every((r) => !r.isGstIncluded)
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-indigo-800 hover:bg-indigo-100'
          }`}
          title="List prices exclude GST: calculate & add GST to all lines"
        >
          +Calc GST
        </button>
        <button
          type="button"
          onClick={() => handleBulkSetListPriceGst(true)}
          className={`px-1.5 py-0.5 rounded text-xs font-bold transition-colors cursor-pointer ${
            rows.length > 0 && rows.every((r) => r.isGstIncluded)
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-indigo-800 hover:bg-indigo-100'
          }`}
          title="List prices include GST: extract base taxable value"
        >
          GST Incl
        </button>
      </div>

      {/* Auto Batch / Tag All button */}
      <button
        type="button"
        onClick={handleAutoGenerateAllBatches}
        className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold rounded cursor-pointer flex items-center gap-1 transition-colors text-xs shrink-0"
        title="Auto-generate fresh unique batch/tag numbers for all products inwards (never use old catalog batches)"
      >
        <Sparkles size={12} className="text-amber-600" />
        <span className="hidden sm:inline">Auto Batch/Tag</span>
        <span className="sm:hidden">Batches</span>
      </button>

      <button
        onClick={onOpenBulkSchemeModal}
        className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-300 font-bold rounded cursor-pointer flex items-center gap-1.5 transition-colors text-xs"
      >
        <Tag size={13} />
        <span className="hidden sm:inline">Scheme to All</span>
        <span className="sm:hidden">Scheme</span>
      </button>

      <button
        onClick={handleAddNewRow}
        className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded cursor-pointer flex items-center gap-1.5 shadow-sm transition-colors text-xs"
      >
        <Plus size={13} />
        <span className="hidden sm:inline">Add Product</span>
        <span className="sm:hidden">Add</span>
      </button>

      <button
        type="button"
        onClick={() =>
          downloadBulkInwardRowsCsv(rows, {
            supplierName,
            invoiceNo,
            inwardDate,
            warehouseName: warehouses.find((w) => w.id === targetWarehouseId)?.name,
          })
        }
        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold rounded cursor-pointer flex items-center gap-1.5 transition-colors text-xs shrink-0"
        title="Download current inward items as CSV file"
      >
        <Download size={13} className="text-emerald-700" />
        <span className="hidden sm:inline">Export CSV</span>
        <span className="sm:hidden">CSV</span>
      </button>
    </div>
  </div>
);
