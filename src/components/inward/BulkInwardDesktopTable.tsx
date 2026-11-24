import React from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Copy,
  Sparkles,
  Tag,
  Trash2,
} from 'lucide-react';
import { GrnSchemeType, Product, SupplierScheme } from '../../types';
import { generateBatchNumber, inferUnitsPerCase, money } from '../../utils/billing';
import { calcInwardRowBreakdown, EditableInwardRow } from './bulkInwardTypes';

interface BulkInwardDesktopTableProps {
  paletteLine: string;
  filteredRows: EditableInwardRow[];
  rows: EditableInwardRow[];
  products: Product[];
  supplierSchemes: SupplierScheme[];
  inwardDate: string;
  inwardCostPerCrate: number;
  density: 'comfortable' | 'compact';
  expandedRowId: string | null;
  setExpandedRowId: React.Dispatch<React.SetStateAction<string | null>>;
  catalogPickerRowId: string | null;
  setCatalogPickerRowId: React.Dispatch<React.SetStateAction<string | null>>;
  catalogPickerSearch: string;
  setCatalogPickerSearch: React.Dispatch<React.SetStateAction<string>>;
  volumePickerRowId: string | null;
  setVolumePickerRowId: React.Dispatch<React.SetStateAction<string | null>>;
  updateRowField: (id: string, field: keyof EditableInwardRow, val: any) => void;
  handleCatalogMappingChange: (rowId: string, targetValue: string) => void;
  handleDuplicateRow: (rowId: string) => void;
  handleDeleteRow: (rowId: string) => void;
  onResetFilters: () => void;
}

export const BulkInwardDesktopTable: React.FC<BulkInwardDesktopTableProps> = ({
  paletteLine,
  filteredRows,
  rows,
  products,
  supplierSchemes,
  inwardDate,
  inwardCostPerCrate,
  density,
  expandedRowId,
  setExpandedRowId,
  catalogPickerRowId,
  setCatalogPickerRowId,
  catalogPickerSearch,
  setCatalogPickerSearch,
  volumePickerRowId,
  setVolumePickerRowId,
  updateRowField,
  handleCatalogMappingChange,
  handleDuplicateRow,
  handleDeleteRow,
  onResetFilters,
}) => {
  return (
    <div
      className="h-full bg-white rounded-lg border shadow-sm overflow-auto"
      style={{ borderColor: paletteLine }}
    >
      <table className="w-full text-left data-table text-xs border-separate border-spacing-0 min-w-[1120px]">
        <thead className="sticky top-0 z-30 text-xs font-bold text-slate-600">
          <tr>
            <th className="sticky left-0 z-40 bg-slate-100 border-b border-slate-300 w-9 min-w-9 px-1 py-2 text-center">#</th>
            <th className="sticky left-9 z-40 bg-slate-100 border-b border-r border-slate-300 min-w-[250px] px-2 py-2">Product</th>
            <th className="bg-slate-100 border-b border-slate-300 w-20 px-2 py-2 text-right">Qty (cs)</th>
            <th className="bg-purple-100 text-purple-900 border-b border-slate-300 w-28 px-2 py-2">Scheme</th>
            <th className="bg-slate-100 border-b border-slate-300 w-28 px-2 py-2 text-right">List Price & GST</th>
            <th className="bg-slate-100 border-b border-slate-300 w-[76px] px-2 py-2">GST</th>
            <th className="bg-slate-100 border-b border-slate-300 w-36 px-2 py-2">Batch / Tag No</th>
            <th className="bg-amber-100 text-amber-900 border-b border-slate-300 w-[140px] px-2 py-2">Expiry</th>
            <th className="bg-slate-100 border-b border-slate-300 w-28 px-2 py-2 text-right">Line total</th>
            <th className="bg-emerald-100 text-emerald-900 border-b border-slate-300 w-28 px-2 py-2 text-right">Landed / cr</th>
            <th className="sticky right-0 z-40 bg-slate-100 border-b border-l border-slate-300 w-[92px] px-1 py-2 text-center">Actions</th>
          </tr>
        </thead>

        <tbody>
          {filteredRows.length === 0 ? (
            <tr>
              <td colSpan={11} className="py-12 text-center text-slate-500">
                <p className="text-sm font-semibold">No products match the active filters or search query.</p>
                <button
                  onClick={onResetFilters}
                  className="mt-2 text-xs font-bold text-indigo-600 underline cursor-pointer"
                >
                  Reset filters
                </button>
              </td>
            </tr>
          ) : (
            filteredRows.map((r, idx) => {
              const isNonGst = r.taxability === 'non_gst';
              const unitsPerCrate = r.unitsPerCrate || inferUnitsPerCase(`${r.productName || ''} ${r.rawName || ''} ${r.pack || ''}`, r.volume);
              const packSize = r.packSize || `${r.volume}ml ${r.pack}`;
              const breakdown = calcInwardRowBreakdown(r, inwardCostPerCrate);
              const isComfortable = density === 'comfortable';
              const cellPad = isComfortable ? 'py-2.5' : 'py-1.5';
              const isOpen = expandedRowId === r.id;
              const rowBg = isOpen ? 'bg-indigo-50' : r.isNewProduct ? 'bg-sky-50' : 'bg-white';
              const schemeLabel =
                r.schemeType === 'discount_percent'
                  ? `${r.discountPercent}% off`
                  : r.schemeType === 'discount_flat'
                  ? `₹${r.discountFlat}/cs off`
                  : r.schemeType === 'b2g1'
                  ? `B${r.schemeBuyQty ?? 2}G${r.schemeFreeQty ?? 1}`
                  : r.freeQty > 0
                  ? `${r.freeQty} free`
                  : '—';
              const hasScheme = schemeLabel !== '—' || !!r.supplierSchemeId;

              return (
                <React.Fragment key={r.id}>
                  <tr className="group">
                    {/* # (sticky) */}
                    <td className={`sticky left-0 z-20 ${rowBg} group-hover:bg-indigo-50 border-b border-slate-200 px-1 ${cellPad} text-center text-slate-400 font-mono text-xs`}>
                      {idx + 1}
                    </td>

                    {/* Product name (sticky — stays visible while scrolling sideways) */}
                    <td className={`sticky left-9 z-20 ${rowBg} group-hover:bg-indigo-50 border-b border-r border-slate-200 px-2 ${cellPad}`}>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setCatalogPickerRowId(catalogPickerRowId === r.id ? null : r.id);
                            setCatalogPickerSearch('');
                          }}
                          className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-black border transition-colors cursor-pointer ${
                            r.isNewProduct
                              ? 'bg-blue-100 text-sky-800 border-sky-200 hover:bg-sky-200'
                              : 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200'
                          }`}
                          title={r.isNewProduct ? "New product — click to map to existing catalog product" : `Catalog #${r.matchedProductId} • click to change mapping`}
                        >
                          {r.isNewProduct ? 'NEW ▾' : 'CAT ▾'}
                        </button>
                        <input
                          type="text"
                          value={r.productName}
                          onChange={(e) => updateRowField(r.id, 'productName', e.target.value)}
                          className="min-w-0 flex-1 font-bold text-slate-900 bg-white border border-slate-300 rounded px-2 py-1 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 focus:outline-hidden"
                          placeholder="Beverage Product Name"
                          title={r.productName}
                        />
                      </div>

                      {/* Catalog Match Popover */}
                      {catalogPickerRowId === r.id && (
                        <div className="absolute left-2 top-full mt-1 z-50 bg-white border border-slate-300 rounded-lg shadow-xl p-2 w-80 max-h-72 flex flex-col text-xs">
                          <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 mb-1.5">
                            <span className="font-bold text-slate-800 text-xs">Select Catalog Beverage</span>
                            <button aria-label="Close catalog picker"
                              type="button"
                              onClick={() => setCatalogPickerRowId(null)}
                              className="text-slate-400 hover:text-slate-600 font-bold px-1"
                            >
                              ✕
                            </button>
                          </div>
                          <input
                            type="text"
                            value={catalogPickerSearch}
                            onChange={(e) => setCatalogPickerSearch(e.target.value)}
                            placeholder="Search catalog by name, ml, pack..."
                            className="w-full border border-slate-300 rounded px-2 py-1 text-xs mb-1.5 focus:border-indigo-500 focus:outline-hidden"
                            autoFocus
                          />
                          <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                            <button
                              type="button"
                              onClick={() => {
                                handleCatalogMappingChange(r.id, 'new_product');
                                setCatalogPickerRowId(null);
                              }}
                              className={`w-full text-left p-1.5 rounded border text-xs transition-colors cursor-pointer ${
                                r.isNewProduct
                                  ? 'bg-blue-50 border-blue-300 text-blue-900 font-bold'
                                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              ✨ Create as New Catalog Product
                            </button>
                            {products
                              .filter((p) => {
                                if (!catalogPickerSearch.trim()) {
                                  const rawTokens = r.productName.toLowerCase().split(/[^a-z0-9]+/);
                                  return rawTokens.some((t) => t.length >= 3 && p.name.toLowerCase().includes(t));
                                }
                                const q = catalogPickerSearch.toLowerCase();
                                return (
                                  p.name.toLowerCase().includes(q) ||
                                  String(p.volume).includes(q) ||
                                  p.pack?.toLowerCase().includes(q)
                                );
                              })
                              .slice(0, 15)
                              .map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => {
                                    handleCatalogMappingChange(r.id, String(p.id));
                                    setCatalogPickerRowId(null);
                                  }}
                                  className={`w-full text-left p-1.5 rounded border text-xs flex items-center justify-between transition-colors cursor-pointer ${
                                    r.matchedProductId === p.id
                                      ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold'
                                      : 'bg-white border-slate-200 hover:bg-indigo-50 hover:border-indigo-200'
                                  }`}
                                >
                                  <div className="min-w-0 pr-1">
                                    <div className="font-bold text-slate-900 min-w-0 break-words lg:truncate">{p.name}</div>
                                    <div className="text-xs text-slate-500">
                                      {p.volume ? `${p.volume}ml` : ''} {p.pack} • {p.unitsPerCrate || 24}/cr • Stock: {p.opening ?? 0} cs
                                    </div>
                                  </div>
                                  <span className="shrink-0 text-xs text-slate-400 font-mono">#{p.id}</span>
                                </button>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Interactive Volume & Pack Controls */}
                      <div className="mt-1 pl-0.5 text-xs flex items-center gap-1.5 flex-wrap">
                        {/* Volume Pill / Quick Picker */}
                        <div className="relative inline-block">
                          <button
                            type="button"
                            onClick={() => setVolumePickerRowId(volumePickerRowId === r.id ? null : r.id)}
                            className="px-1.5 py-0.5 rounded border border-slate-300 bg-slate-50 hover:bg-slate-100 font-mono font-bold text-slate-700 cursor-pointer flex items-center gap-0.5"
                            title="Click to change bottle volume (ml)"
                          >
                            <span>{r.volume ? (r.volume >= 1000 && r.volume % 1000 === 0 ? `${r.volume / 1000}L` : `${r.volume}ml`) : '—'}</span>
                            <span className="text-xs text-slate-400">▾</span>
                          </button>
                          {volumePickerRowId === r.id && (
                            <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-slate-300 rounded-lg shadow-lg p-1.5 w-48 text-xs flex flex-col gap-1">
                              <span className="text-xs font-bold text-slate-500 uppercase px-1">Select Size</span>
                              <div className="grid grid-cols-3 gap-1">
                                {[150, 200, 250, 300, 500, 600, 750, 1000, 1250, 1500, 2000, 2250].map((v) => (
                                  <button
                                    key={v}
                                    type="button"
                                    onClick={() => {
                                      updateRowField(r.id, 'volume', v);
                                      setVolumePickerRowId(null);
                                    }}
                                    className={`px-1 py-0.5 rounded text-xs font-mono font-bold border transition-colors cursor-pointer ${
                                      r.volume === v
                                        ? 'bg-indigo-600 text-white border-indigo-600'
                                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                                    }`}
                                  >
                                    {v >= 1000 && v % 1000 === 0 ? `${v / 1000}L` : v === 2250 ? '2.25L' : v === 1250 ? '1.25L' : v === 1500 ? '1.5L' : `${v}ml`}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Pack Type Toggle */}
                        <button
                          type="button"
                          onClick={() => {
                            const packs = ['PET', 'CAN', 'RGB', 'TETRA'];
                            const nextIdx = (packs.indexOf((r.pack || 'PET').toUpperCase()) + 1) % packs.length;
                            updateRowField(r.id, 'pack', packs[nextIdx]);
                          }}
                          className="px-1.5 py-0.5 rounded border border-slate-300 bg-slate-50 hover:bg-slate-100 font-bold text-slate-700 cursor-pointer"
                          title="Click to toggle packaging: PET -> CAN -> RGB (Glass) -> TETRA"
                        >
                          {r.pack || 'PET'}
                        </button>

                        <span className="text-slate-400 font-mono">{unitsPerCrate}/cr</span>
                        {!r.isNewProduct && <span className="text-slate-400">· stock {r.existingStock ?? 0} cs</span>}
                      </div>
                    </td>

                    {/* Qty */}
                    <td className={`border-b border-slate-200 px-2 ${cellPad} text-right ${rowBg} group-hover:bg-indigo-50`}>
                      <input
                        type="number" inputMode="numeric"
                        min="1"
                        value={r.qty}
                        onChange={(e) => updateRowField(r.id, 'qty', Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="font-mono font-bold text-slate-900 bg-white border border-slate-300 rounded px-1.5 py-1 w-16 text-right text-xs focus:border-indigo-500 focus:outline-hidden"
                        title="Total crates printed on the invoice for this line (includes free scheme crates)"
                      />
                    </td>

                    {/* Scheme summary (click to open full scheme editor) */}
                    <td className={`border-b border-slate-200 px-2 ${cellPad} ${rowBg} group-hover:bg-indigo-50`}>
                      <button
                        type="button"
                        onClick={() => setExpandedRowId(isOpen ? null : r.id)}
                        className={`px-2 py-1 rounded border text-xs font-semibold w-full text-left truncate cursor-pointer ${
                          hasScheme
                            ? 'bg-purple-50 border-purple-300 text-purple-900 hover:bg-purple-100'
                            : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'
                        }`}
                        title={r.schemeText || 'Click to edit scheme / discount'}
                      >
                        {schemeLabel}
                        {r.supplierSchemeId && <span className="ml-1 text-xs font-black text-purple-700">+SUP</span>}
                      </button>
                    </td>

                    {/* Rate & GST check */}
                    <td className={`border-b border-slate-200 px-2 ${cellPad} text-right ${rowBg} group-hover:bg-indigo-50`}>
                      <div className="flex flex-col items-end gap-1">
                        <input
                          type="number" inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={r.listPrice !== undefined ? r.listPrice : r.unitPrice}
                          onChange={(e) => updateRowField(r.id, 'listPrice', Math.max(0, parseFloat(e.target.value) || 0))}
                          className={`font-mono font-bold text-slate-900 border rounded px-1.5 py-1 w-[84px] text-right text-xs focus:border-indigo-500 focus:outline-hidden ${
                            !(Number(r.unitPrice) > 0) ? 'border-amber-400 bg-amber-50' : 'border-slate-300 bg-white'
                          }`}
                          title={`List Price: ₹${money(r.listPrice !== undefined ? r.listPrice : r.unitPrice)}`}
                        />
                        {isNonGst ? (
                          <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            Non-GST
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => updateRowField(r.id, 'isGstIncluded', !r.isGstIncluded)}
                            className={`px-1.5 py-0.5 rounded text-xs font-bold border transition-colors cursor-pointer ${
                              r.isGstIncluded
                                ? 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100'
                                : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                            }`}
                            title={
                              r.isGstIncluded
                                ? 'List price INCLUDES GST (Base: ₹' + money(r.unitPrice) + '). Click to switch to Ex-GST.'
                                : 'List price EXCLUDES GST. +₹' + money(r.calculatedGstAmount || 0) + ' GST calculated. Click to switch.'
                            }
                          >
                            {r.isGstIncluded ? 'GST Incl' : '+Calc GST'}
                          </button>
                        )}
                      </div>
                    </td>

                    {/* GST / Non-GST toggle */}
                    <td className={`border-b border-slate-200 px-2 ${cellPad} ${rowBg} group-hover:bg-indigo-50`}>
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => updateRowField(r.id, 'taxability', isNonGst ? 'taxable' : 'non_gst')}
                          className={`px-1.5 py-0.5 rounded text-xs font-bold border text-center cursor-pointer transition-colors ${
                            isNonGst
                              ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                          }`}
                          title="Click to switch between GST taxable and Non-GST (0%)"
                        >
                          {isNonGst ? 'Non-GST' : 'GST'}
                        </button>
                        {!isNonGst && (
                          <select
                            value={`${r.cgstPercent},${r.sgstPercent}`}
                            onChange={(e) => {
                              const [cg, sg] = e.target.value.split(',').map(Number);
                              updateRowField(r.id, 'cgstPercent', cg);
                              updateRowField(r.id, 'sgstPercent', sg);
                            }}
                            className="font-mono text-xs bg-white border border-slate-300 rounded px-1 py-0.5 text-slate-800 w-full"
                          >
                            <option value="20,20">40%</option>
                            <option value="2.5,2.5">5%</option>
                            <option value="9,9">18%</option>
                            <option value="6,6">12%</option>
                            <option value="0,0">0%</option>
                          </select>
                        )}
                      </div>
                    </td>

                    {/* Batch / Tag */}
                    <td className={`border-b border-slate-200 px-2 ${cellPad} ${rowBg} group-hover:bg-indigo-50`}>
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={r.batchNumber}
                          onChange={(e) => updateRowField(r.id, 'batchNumber', e.target.value)}
                          className={`w-full px-1.5 py-1 border rounded font-mono text-xs text-slate-800 focus:border-indigo-500 focus:outline-hidden ${
                            !(r.batchNumber || '').trim() ? 'border-amber-400 bg-amber-50' : 'border-slate-300 bg-white'
                          }`}
                          title={!(r.batchNumber || '').trim() ? 'Batch number missing' : 'Batch/Tag number'}
                          placeholder="Batch No"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const existingBatches = [
                              ...products.map((p) => p.batchNumber).filter(Boolean),
                              ...rows.filter((x) => x.id !== r.id).map((x) => x.batchNumber).filter(Boolean),
                            ] as string[];
                            const fresh = generateBatchNumber(r.productName || r.rawName, undefined, existingBatches, undefined, inwardDate);
                            updateRowField(r.id, 'batchNumber', fresh);
                          }}
                          className="p-1 rounded bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-800 border border-slate-200 hover:border-amber-300 transition-colors shrink-0 cursor-pointer"
                          title="Auto-generate fresh unique batch/tag number (never reuse old one)"
                        >
                          <Sparkles size={11} />
                        </button>
                      </div>
                    </td>

                    {/* Expiry — always in view, highlighted when empty */}
                    <td className={`border-b border-slate-200 px-2 ${cellPad} ${rowBg} group-hover:bg-indigo-50`}>
                      <input
                        type="date"
                        value={r.expiry}
                        onChange={(e) => updateRowField(r.id, 'expiry', e.target.value)}
                        className={`w-full px-1 py-1 border rounded text-xs text-slate-800 focus:border-indigo-500 focus:outline-hidden ${
                          !r.expiry ? 'border-amber-400 bg-amber-50' : 'border-slate-300 bg-white'
                        }`}
                        title={!r.expiry ? 'Expiry date missing' : 'Expiry date'}
                      />
                    </td>

                    {/* Line total */}
                    <td className={`border-b border-slate-200 px-2 ${cellPad} text-right font-mono font-bold text-slate-900 ${rowBg} group-hover:bg-indigo-50`}>
                      ₹{money(breakdown.lineTotal)}
                    </td>

                    {/* Landed cost */}
                    <td className={`border-b border-slate-200 px-2 ${cellPad} text-right font-mono ${rowBg} group-hover:bg-indigo-50`}>
                      <div className="font-black text-emerald-800">₹{money(breakdown.landedCostPerCrate)}</div>
                      <div className="text-xs text-slate-500">₹{money(breakdown.landedCostPerUnit)}/unit</div>
                    </td>

                    {/* Actions (sticky right) */}
                    <td className={`sticky right-0 z-20 ${rowBg} group-hover:bg-indigo-50 border-b border-l border-slate-200 px-1 ${cellPad} text-center`}>
                      <div className="flex items-center justify-center gap-0.5">
                        <button
                          onClick={() => setExpandedRowId(isOpen ? null : r.id)}
                          className={`p-1 rounded cursor-pointer transition-colors ${
                            isOpen ? 'text-indigo-700 bg-indigo-100' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
                          }`}
                          title="Scheme, catalog mapping, pack size & cost breakdown"
                        >
                          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                        <button
                          onClick={() => handleDuplicateRow(r.id)}
                          className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded cursor-pointer transition-colors"
                          title="Duplicate row (useful to split into different batches or lots)"
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteRow(r.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer transition-colors"
                          title="Delete this item from inward consignment"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Row detail panel (only when opened) */}
                  {isOpen && (
                    <tr>
                      <td colSpan={11} className="bg-slate-50 border-b-2 border-indigo-300 p-0">
                        <div className="sticky left-0 w-[calc(100vw-3rem)] max-w-full px-3 py-2.5 grid gap-3 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)]">
                          {/* Catalog mapping & pack */}
                          <div className="flex flex-col gap-2 min-w-0">
                            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                              Catalog & pack
                            </span>
                            <select
                              value={r.isNewProduct ? 'new_product' : String(r.matchedProductId)}
                              onChange={(e) => handleCatalogMappingChange(r.id, e.target.value)}
                              className="text-xs font-medium bg-white border border-slate-300 rounded px-2 py-1 text-slate-700 cursor-pointer w-full"
                              title="Map to an existing product in your catalog or treat as a new item"
                            >
                              <option value="new_product">Create as New Product</option>
                              <optgroup label="Map to Existing Catalog Product:">
                                {products.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name} ({p.category.toUpperCase()})
                                  </option>
                                ))}
                              </optgroup>
                            </select>
                            <div className="flex items-center gap-2 flex-wrap text-xs text-slate-600">
                              <label className="flex items-center gap-1">
                                <span className="text-xs text-slate-500 font-medium">Pack</span>
                                <input
                                  type="text"
                                  value={packSize}
                                  onChange={(e) => updateRowField(r.id, 'packSize', e.target.value)}
                                  className="w-24 px-1.5 py-1 border border-slate-300 rounded text-xs text-slate-800 bg-white font-medium"
                                  placeholder="150ml PET"
                                />
                              </label>
                              <label className="flex items-center gap-1 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                <span className="text-xs text-amber-900 font-bold">Units/Cr</span>
                                <input
                                  type="number" inputMode="numeric"
                                  min="1"
                                  value={unitsPerCrate}
                                  onChange={(e) => updateRowField(r.id, 'unitsPerCrate', Math.max(1, parseInt(e.target.value, 10) || 1))}
                                  className="w-12 font-mono font-bold text-xs text-amber-950 bg-white border border-amber-300 rounded px-1 py-0.5 text-right"
                                />
                              </label>
                              <label className="flex items-center gap-1">
                                <span className="text-xs text-slate-500 font-medium">HSN</span>
                                <input
                                  type="text"
                                  value={r.hsn}
                                  onChange={(e) => updateRowField(r.id, 'hsn', e.target.value)}
                                  className="w-20 font-mono text-xs px-1.5 py-1 border border-slate-300 rounded bg-white text-slate-800"
                                />
                              </label>
                              <label className="flex items-center gap-1">
                                <span className="text-xs text-slate-500 font-medium">Wholesale ₹</span>
                                <input
                                  type="number" inputMode="decimal"
                                  value={r.wholesaleRate}
                                  onChange={(e) => updateRowField(r.id, 'wholesaleRate', parseFloat(e.target.value) || 0)}
                                  className="w-20 px-1.5 py-1 border border-slate-300 rounded text-right font-bold text-slate-800 bg-white text-xs"
                                />
                              </label>
                            </div>
                          </div>

                          {/* Scheme review */}
                          <div className="bg-purple-50/70 border border-purple-200 rounded-lg p-2.5 min-w-0">
                            <span className="text-xs font-bold uppercase tracking-wide text-purple-800 flex items-center gap-1 mb-1.5">
                              <Tag size={11} /> Scheme review & free qty
                            </span>
                            <div className="flex flex-col gap-1.5">
                              {/* Scheme Type Selector */}
                              <select
                                value={r.schemeType}
                                onChange={(e) => updateRowField(r.id, 'schemeType', e.target.value as GrnSchemeType)}
                                className="font-semibold text-purple-950 text-xs bg-white border border-purple-300 rounded-md px-2.5 py-1.5 w-full focus:border-purple-500 shadow-sm cursor-pointer"
                              >
                                <option value="b2g1">🎁 Buy 2 Get 1 Free (Ratio Scheme)</option>
                                <option value="free_cases">+ Free Cases (included in billed qty, not extra)</option>
                                <option value="discount_percent">% Percentage Discount</option>
                                <option value="discount_flat">₹ Flat Off / Case</option>
                                <option value="none">Standard (No Scheme)</option>
                              </select>

                              {/* b2g1 Ratio Scheme Inputs */}
                              {r.schemeType === 'b2g1' && (
                                <div className="p-2 bg-white border border-purple-200 rounded-md shadow-sm space-y-1.5">
                                  <div className="flex items-center gap-1 text-xs">
                                    <span className="text-purple-800 font-medium">Buy</span>
                                    <input
                                      type="number" inputMode="numeric"
                                      min="1"
                                      value={r.schemeBuyQty ?? 2}
                                      onChange={(e) => updateRowField(r.id, 'schemeBuyQty', Math.max(1, parseInt(e.target.value, 10) || 1))}
                                      className="w-9 font-mono font-bold text-center bg-purple-50 border border-purple-300 rounded px-1 py-0.5 text-xs"
                                    />
                                    <span className="text-purple-800 font-medium">Get</span>
                                    <input
                                      type="number" inputMode="numeric"
                                      min="1"
                                      value={r.schemeFreeQty ?? 1}
                                      onChange={(e) => updateRowField(r.id, 'schemeFreeQty', Math.max(1, parseInt(e.target.value, 10) || 1))}
                                      className="w-9 font-mono font-bold text-center bg-purple-50 border border-purple-300 rounded px-1 py-0.5 text-xs"
                                    />
                                    <span className="text-purple-800 font-medium">Free</span>

                                    <div className="ml-auto flex items-center gap-1">
                                      <span className="text-xs text-slate-500 font-medium">Free:</span>
                                      <input
                                        type="number" inputMode="numeric"
                                        min="0"
                                        value={r.freeQty}
                                        onChange={(e) => updateRowField(r.id, 'freeQty', Math.max(0, parseInt(e.target.value, 10) || 0))}
                                        className="w-12 font-mono font-bold text-right bg-emerald-50 border border-emerald-300 text-emerald-800 rounded px-1 py-0.5 text-xs"
                                        title="Free crates"
                                      />
                                    </div>
                                  </div>

                                  {/* Scheme Mode: Locked to Inclusive */}
                                  <div className="flex items-center justify-between gap-1 p-1 bg-purple-50/70 border border-purple-200 rounded text-xs">
                                    <span className="text-purple-900 font-semibold shrink-0">Mode:</span>
                                    <select
                                      value="inclusive"
                                      disabled
                                      className="font-bold text-purple-950 text-xs bg-white border border-purple-300 rounded px-1 py-0.5 w-full cursor-not-allowed"
                                      title="Inclusive: Free crates are included inside the invoiced case count"
                                    >
                                      <option value="inclusive">Inclusive (50 free out of 150)</option>
                                    </select>
                                  </div>

                                  <div className="flex items-center justify-between text-xs font-bold text-purple-900 border-t border-purple-100 pt-1">
                                    <span>Billed {r.qty} ({breakdown.paidQty} paid)</span>
                                    <span className="text-emerald-700 font-mono">Rec {breakdown.totalReceivedQty} cs</span>
                                  </div>
                                </div>
                              )}

                              {/* Free cases input */}
                              {r.schemeType === 'free_cases' && (
                                <div className="p-1.5 bg-white border border-purple-200 rounded-md shadow-sm space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs text-purple-800 font-bold">Free:</span>
                                    <input
                                      type="number" inputMode="numeric"
                                      min="0"
                                      value={r.freeQty}
                                      onChange={(e) => updateRowField(r.id, 'freeQty', Math.max(0, parseInt(e.target.value, 10) || 0))}
                                      className="font-mono font-bold text-purple-900 text-xs bg-purple-50 border border-purple-300 rounded px-2 py-0.5 w-16 text-right"
                                    />
                                    <span className="text-xs text-purple-700 font-semibold">crates</span>
                                  </div>
                                  <div className="flex items-center justify-between gap-1 pt-1 border-t border-purple-100 text-xs">
                                    <select
                                      value="inclusive"
                                      disabled
                                      className="font-semibold text-purple-950 text-xs bg-purple-50 border border-purple-300 rounded px-1 py-0.5 cursor-not-allowed"
                                      title="Inclusive: Free crates are within billed quantity"
                                    >
                                      <option value="inclusive">Within billed (Inclusive)</option>
                                    </select>
                                    <span className="text-emerald-700 font-bold font-mono">
                                      Rec: {breakdown.totalReceivedQty} cs
                                    </span>
                                  </div>
                                </div>
                              )}

                              {/* Discount percent */}
                              {r.schemeType === 'discount_percent' && (
                                <div className="flex items-center gap-1.5 p-1.5 bg-white border border-purple-200 rounded-md shadow-sm">
                                  <span className="text-xs text-purple-800 font-bold">Disc:</span>
                                  <input
                                    type="number" inputMode="decimal"
                                    min="0"
                                    max="100"
                                    step="0.1"
                                    value={r.discountPercent}
                                    onChange={(e) =>
                                      updateRowField(r.id, 'discountPercent', Math.max(0, parseFloat(e.target.value) || 0))
                                    }
                                    className="font-mono font-bold text-purple-900 text-xs bg-purple-50 border border-purple-300 rounded px-1.5 py-0.5 w-16 text-right"
                                  />
                                  <span className="text-xs text-purple-800 font-bold">%</span>
                                  <span className="text-xs font-mono font-bold text-rose-600 ml-auto">
                                    -₹{money(r.discountAmount)}
                                  </span>
                                </div>
                              )}

                              {/* Discount flat */}
                              {r.schemeType === 'discount_flat' && (
                                <div className="flex items-center gap-1.5 p-1.5 bg-white border border-purple-200 rounded-md shadow-sm">
                                  <span className="text-xs text-purple-800 font-bold">Flat:</span>
                                  <span className="text-xs text-purple-800 font-bold">₹</span>
                                  <input
                                    type="number" inputMode="decimal"
                                    min="0"
                                    step="0.5"
                                    value={r.discountFlat}
                                    onChange={(e) =>
                                      updateRowField(r.id, 'discountFlat', Math.max(0, parseFloat(e.target.value) || 0))
                                    }
                                    className="font-mono font-bold text-purple-900 text-xs bg-purple-50 border border-purple-300 rounded px-1.5 py-0.5 w-16 text-right"
                                  />
                                  <span className="text-xs text-purple-700">/case</span>
                                  <span className="text-xs font-mono font-bold text-rose-600 ml-auto">
                                    -₹{money(r.discountAmount)}
                                  </span>
                                </div>
                              )}

                              {/* Scheme Description Note */}
                              <input
                                type="text"
                                placeholder="Scheme note (e.g. Buy 2 Get 1 Free)"
                                value={r.schemeText}
                                onChange={(e) => updateRowField(r.id, 'schemeText', e.target.value)}
                                className="text-xs text-slate-700 bg-white border border-purple-200 rounded px-2 py-1 placeholder:text-purple-300"
                              />

                              {/* Supplier Scheme (additive layer, independent of the b2g1/free_cases scheme above) */}
                              <div className="p-1.5 bg-amber-50/60 border border-amber-200 rounded-md space-y-1">
                                <select
                                  value={r.supplierSchemeId || r.pendingCreditSchemeId || ''}
                                  onChange={(e) => {
                                    const scheme = supplierSchemes.find((s) => s.id === e.target.value);
                                    if (!scheme) {
                                      updateRowField(r.id, 'supplierSchemeId', undefined);
                                      updateRowField(r.id, 'supplierSchemeFreeQty', undefined);
                                      updateRowField(r.id, 'pendingCreditSchemeId', undefined);
                                      updateRowField(r.id, 'pendingCreditExpectedAmount', undefined);
                                      return;
                                    }
                                    if (scheme.schemeType === 'free_goods') {
                                      updateRowField(r.id, 'supplierSchemeId', scheme.id);
                                      updateRowField(r.id, 'pendingCreditSchemeId', undefined);
                                    } else if (scheme.schemeType === 'pending_credit') {
                                      updateRowField(r.id, 'pendingCreditSchemeId', scheme.id);
                                      updateRowField(r.id, 'supplierSchemeId', undefined);
                                    }
                                  }}
                                  className="font-medium text-amber-900 text-xs bg-white border border-amber-300 rounded px-1.5 py-1 w-full"
                                  title="Attach a named Supplier Scheme (additive free goods or pending credit) — separate from the invoice scheme above"
                                >
                                  <option value="">No Supplier Scheme</option>
                                  {supplierSchemes
                                    .filter((s) => s.active && s.schemeType !== 'volume_incentive')
                                    .map((s) => (
                                      <option key={s.id} value={s.id}>
                                        {s.schemeType === 'free_goods' ? '🎁' : '⏳'} {s.name}
                                      </option>
                                    ))}
                                </select>
                                {r.supplierSchemeId && (
                                  <div className="flex items-center gap-1.5 text-xs">
                                    <span className="text-amber-800 font-semibold">+Free (additive):</span>
                                    <input
                                      type="number" inputMode="numeric"
                                      min="0"
                                      value={r.supplierSchemeFreeQty ?? 0}
                                      onChange={(e) =>
                                        updateRowField(r.id, 'supplierSchemeFreeQty', Math.max(0, parseInt(e.target.value, 10) || 0))
                                      }
                                      className="w-14 font-mono font-bold text-right bg-amber-50 border border-amber-300 rounded px-1 py-0.5"
                                    />
                                    <span className="text-emerald-700 font-mono font-bold ml-auto">
                                      Total: {breakdown.totalReceivedQty + (r.supplierSchemeFreeQty || 0)} cs
                                    </span>
                                  </div>
                                )}
                                {r.supplierSchemeId && r.freeQty > 0 && (r.supplierSchemeFreeQty || 0) > 0 && (
                                  <div className="flex items-start gap-1 text-xs text-rose-700 bg-rose-50 border border-rose-300 rounded px-1.5 py-1 leading-snug">
                                    <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                                    <span>
                                      This line already has {r.freeQty} free crates included in the {r.qty} billed above
                                      (already a discount, not extra stock). Only add a Supplier Scheme qty here if the
                                      supplier is giving <strong>additional</strong> bonus stock beyond what's printed on
                                      this invoice — never re-enter the same free crates twice.
                                    </span>
                                  </div>
                                )}
                                {r.pendingCreditSchemeId && (
                                  <div className="flex items-center gap-1.5 text-xs">
                                    <span className="text-amber-800 font-semibold">Expected Credit ₹:</span>
                                    <input
                                      type="number" inputMode="decimal"
                                      min="0"
                                      value={r.pendingCreditExpectedAmount ?? 0}
                                      onChange={(e) =>
                                        updateRowField(r.id, 'pendingCreditExpectedAmount', Math.max(0, parseFloat(e.target.value) || 0))
                                      }
                                      className="w-20 font-mono font-bold text-right bg-amber-50 border border-amber-300 rounded px-1 py-0.5"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Cost breakdown (read-only) */}
                          <div className="flex flex-col gap-1.5 min-w-0">
                            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                              Cost breakdown
                            </span>
                            <div className="grid grid-cols-3 gap-1.5 font-mono text-xs">
                              <div className="bg-indigo-50 border border-indigo-200 rounded p-1.5">
                                <div className="font-sans text-xs font-semibold text-indigo-700">Effective</div>
                                <div className="font-bold text-indigo-950">₹{money(breakdown.effectiveCostPerCrateExGst)} ex</div>
                                <div className="font-bold text-indigo-900">₹{money(breakdown.effectiveCostPerCrateInclGst)} incl</div>
                                <div className="text-indigo-700">₹{money(breakdown.effectiveUnitRateInclGst)}/btl</div>
                              </div>
                              <div className="bg-amber-50 border border-amber-200 rounded p-1.5">
                                <div className="font-sans text-xs font-semibold text-amber-700">Inward share</div>
                                <div className="font-bold text-amber-900">+₹{money(breakdown.inwardCostPerCrate)}/cr</div>
                                <div className="text-amber-800">+₹{money(breakdown.inwardCostPerCrate / unitsPerCrate)}/btl</div>
                              </div>
                              <div className="bg-emerald-50 border border-emerald-200 rounded p-1.5">
                                <div className="font-sans text-xs font-semibold text-emerald-700">Landed</div>
                                <div className="font-black text-emerald-900">₹{money(breakdown.landedCostPerCrate)}/cr</div>
                                <div className="font-bold text-emerald-800">₹{money(breakdown.landedCostPerUnit)}/unit</div>
                                <div className="text-slate-500">pre-tax ₹{money(breakdown.landedCostPerUnitExGst)}</div>
                              </div>
                            </div>
                            <div className="text-xs text-slate-500 leading-snug">
                              Paid {breakdown.paidQty} cs ({r.qty} billed) → received {breakdown.totalReceivedQty} cs •
                              invoice rate incl. GST ₹{money(breakdown.invoiceRateInclGst)}/cr (₹
                              {money(breakdown.invoiceUnitRateBottleInclGst)}/btl)
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};
