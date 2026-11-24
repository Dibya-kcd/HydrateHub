import React from 'react';
import { Download, Edit2, Printer, Search, Trash2 } from 'lucide-react';
import { InventoryDisposition, Product, Warehouse } from '../../../types';
import { money } from '../../../utils/billing';
import { daysOpen, exportGstrCnCsv, printDispositionClaimVoucher } from '../../../utils/dispositionCn';
import { SizeChip } from '../../common/SizeChip';
import { DispositionLedgerStats, statusBadge, today, TYPE_OPTIONS } from './dispositionConstants';

interface DispositionsDesktopLedgerProps {
  inventoryDispositions: InventoryDisposition[];
  ledgerStats: DispositionLedgerStats;
  statusFilter: 'all' | 'open_claims' | 'settled' | 'writeoff';
  setStatusFilter: React.Dispatch<React.SetStateAction<'all' | 'open_claims' | 'settled' | 'writeoff'>>;
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  typeFilter: string;
  setTypeFilter: React.Dispatch<React.SetStateAction<string>>;
  warehouseFilter: string;
  setWarehouseFilter: React.Dispatch<React.SetStateAction<string>>;
  warehouses: Warehouse[];
  filtered: InventoryDisposition[];
  products: Product[];
  selectedClaimIds: string[];
  toggleClaimSelect: (id: string) => void;
  setCompId: React.Dispatch<React.SetStateAction<string | null>>;
  setCnNo: React.Dispatch<React.SetStateAction<string>>;
  setCnDate: React.Dispatch<React.SetStateAction<string>>;
  setCnTaxable: React.Dispatch<React.SetStateAction<number | ''>>;
  setCnCgst: React.Dispatch<React.SetStateAction<number | ''>>;
  setCnSgst: React.Dispatch<React.SetStateAction<number | ''>>;
  setCnIgst: React.Dispatch<React.SetStateAction<number | ''>>;
  setCompAmt: React.Dispatch<React.SetStateAction<number | ''>>;
  setClaimVal: React.Dispatch<React.SetStateAction<number | ''>>;
  setAppendPayment: React.Dispatch<React.SetStateAction<boolean>>;
  setCnAttachment: React.Dispatch<React.SetStateAction<string>>;
  openCnPanel: (r: InventoryDisposition) => void;
  updateInventoryDisposition: (id: string, updates: Partial<InventoryDisposition>) => void;
  setMsg: React.Dispatch<React.SetStateAction<string | null>>;
  orgProfile: any;
  setDeleteTarget: React.Dispatch<React.SetStateAction<{ id: any; settled: boolean; stockApplied: boolean } | null>>;
}

export const DispositionsDesktopLedger: React.FC<DispositionsDesktopLedgerProps> = ({
  inventoryDispositions,
  ledgerStats,
  statusFilter,
  setStatusFilter,
  search,
  setSearch,
  typeFilter,
  setTypeFilter,
  warehouseFilter,
  setWarehouseFilter,
  warehouses,
  filtered,
  products,
  selectedClaimIds,
  toggleClaimSelect,
  setCompId,
  setCnNo,
  setCnDate,
  setCnTaxable,
  setCnCgst,
  setCnSgst,
  setCnIgst,
  setCompAmt,
  setClaimVal,
  setAppendPayment,
  setCnAttachment,
  openCnPanel,
  updateInventoryDisposition,
  setMsg,
  orgProfile,
  setDeleteTarget,
}) => {
  return (
    <section
      data-card-tone="neutral"
      className="rounded-2xl border shadow-xs p-3.5 sm:p-4 space-y-3"
      aria-label="Dispositions and claims ledger"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-[#0A1F44]">Stock disposals & supplier claims ledger</h3>
          <p className="text-xs text-slate-500">
            All warehouse write-offs, free near-expiry issues, and customer-return company claims ({ledgerStats.count} entries · {ledgerStats.totalCases} cs)
          </p>
        </div>
        {ledgerStats.hasCnExport && (
          <button
            type="button"
            onClick={() => exportGstrCnCsv(inventoryDispositions)}
            className="px-3 py-2 rounded-xl border border-[#DCE5F2] bg-white/80 hover:bg-white text-xs font-bold text-[#0A1F44] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Export CN CSV
          </button>
        )}
      </div>

      {ledgerStats.count > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div data-card-tone="sales" className="rounded-xl border px-3 py-2.5 shadow-2xs">
            <div className="text-xs font-semibold text-blue-900/75">Entries / Cases</div>
            <div className="text-base font-extrabold text-[#0A1F44] tabular-nums mt-0.5">
              {ledgerStats.count} <span className="text-xs font-semibold text-slate-500">({ledgerStats.totalCases} cs)</span>
            </div>
          </div>
          <div data-card-tone="warning" className="rounded-xl border px-3 py-2.5 shadow-2xs">
            <div className="text-xs font-semibold text-amber-800">Open claims ({ledgerStats.openCount})</div>
            <div className="text-base font-extrabold text-amber-950 tabular-nums mt-0.5">₹{money(ledgerStats.openValue)}</div>
          </div>
          <div data-card-tone="received" className="rounded-xl border px-3 py-2.5 shadow-2xs">
            <div className="text-xs font-semibold text-emerald-800">Recovered ({ledgerStats.settledCount})</div>
            <div className="text-base font-extrabold text-emerald-950 tabular-nums mt-0.5">₹{money(ledgerStats.recovered)}</div>
          </div>
          <div data-card-tone="due" className="rounded-xl border px-3 py-2.5 shadow-2xs">
            <div className="text-xs font-semibold text-rose-800">Net loss</div>
            <div className="text-base font-extrabold text-rose-950 tabular-nums mt-0.5">₹{money(ledgerStats.netLoss)}</div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter ledger by claim status">
        {[
          { id: 'all' as const, label: 'All', count: ledgerStats.count },
          { id: 'open_claims' as const, label: 'Open claims', count: ledgerStats.openCount },
          { id: 'settled' as const, label: 'CN settled', count: ledgerStats.settledCount },
          {
            id: 'writeoff' as const,
            label: 'Write-offs / Refused',
            count: ledgerStats.count - ledgerStats.openCount - ledgerStats.settledCount,
          },
        ].map((tab) => {
          const active = statusFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer inline-flex items-center gap-1.5 ${
                active
                  ? 'bg-[#0A1F44] text-white border-[#0A1F44]'
                  : 'bg-white text-slate-700 border-[#DCE5F2] hover:bg-slate-50'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.5 rounded-md text-xs font-bold tabular-nums ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'}`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            enterKeyHint="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search product, supplier, batch, CN, godown…"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#DCE5F2] bg-slate-50/70 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/25"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-[#DCE5F2] text-sm font-semibold bg-white"
        >
          <option value="all">All types</option>
          {TYPE_OPTIONS.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
        {warehouses.length > 1 && (
          <select
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-[#DCE5F2] text-sm font-semibold bg-white"
          >
            <option value="all">All godowns</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto overscroll-x-contain rounded-2xl border border-[#DCE5F2] bg-white">
        <table className="w-full text-left data-table min-w-[680px]">
          <thead>
            <tr className="border-b border-[#DCE5F2] bg-slate-50">
              <th className="w-8 px-2 py-2.5 text-center" aria-label="Select claim">
                <span className="sr-only">Select</span>
              </th>
              <th className="px-2.5 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-500">Date</th>
              <th className="px-2.5 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-500">Type</th>
              <th className="px-2.5 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-500">Product / Batch</th>
              <th className="px-2.5 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Qty</th>
              <th className="px-2.5 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Cost</th>
              <th className="px-2.5 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-500">Claim</th>
              <th className="px-2.5 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-10 text-slate-500 text-sm">
                  No dispositions match the current filters. Record returns, free issues or write-offs above.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="hover:bg-sky-50/40">
                  <td className="px-2 py-2.5 text-center">
                    {(r.compensationStatus === 'pending' || r.compensationStatus === 'partial') && (
                      <input
                        type="checkbox"
                        checked={selectedClaimIds.includes(r.id)}
                        onChange={() => toggleClaimSelect(r.id)}
                        className="rounded border-slate-300 cursor-pointer"
                        title="Select for multi-line CN"
                      />
                    )}
                  </td>
                  <td className="px-2.5 py-2.5 font-mono text-xs whitespace-nowrap">
                    {r.eventDate}
                    {(r.compensationStatus === 'pending' || r.compensationStatus === 'partial') && daysOpen(r.eventDate) >= 30 && (
                      <span className="block text-xs font-black text-rose-700">{daysOpen(r.eventDate)}d open</span>
                    )}
                  </td>
                  <td className="px-2.5 py-2.5 text-xs font-semibold text-slate-700">
                    {TYPE_OPTIONS.find((t) => t.id === r.dispositionType)?.label || r.dispositionType}
                  </td>
                  <td className="px-2.5 py-2.5">
                    <div className="font-bold text-xs text-slate-900">{r.productName || `#${r.productId}`}</div>
                    {r.stockApplied === false && (
                      <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-xs font-black uppercase bg-slate-100 text-slate-600 border border-slate-200">
                        {r.returnTracking ? 'Customer return · stock already out' : 'Doc only · stock kept'}
                      </span>
                    )}
                    <div className="text-xs text-slate-500">
                      {r.warehouseName || r.warehouseId}
                      {r.batchNumber ? ` · Lot ${r.batchNumber}` : ''}
                      {r.expiryDate ? ` · Exp ${r.expiryDate}` : ''}
                      {r.distributedToName ? ` · To ${r.distributedToName}` : ''}
                      {r.supplierName ? ` · ${r.supplierName}` : ''}
                    </div>
                  </td>
                  <td className="px-2.5 py-2.5 text-right font-mono font-bold text-xs">{r.quantity}</td>
                  <td className="px-2.5 py-2.5 text-right font-mono text-xs text-amber-900 whitespace-nowrap">
                    <div className="font-bold">₹{money(r.costValue)}</div>
                    <div className="text-xs text-slate-500 font-normal">
                      ₹{money(r.costPerUnit)}/cs × {r.quantity}
                    </div>
                    {Math.abs((r.costPerUnit || 0) * (r.quantity || 0) - (r.costValue || 0)) > 0.5 && (
                      <div className="text-xs font-bold text-rose-600" title="Stored total differs from rate × quantity. Check the batch cost.">
                        ⚠ expected ₹{money((r.costPerUnit || 0) * (r.quantity || 0))}
                      </div>
                    )}
                  </td>
                  <td className="px-2.5 py-2.5">
                    <span className={`text-xs font-black px-2 py-0.5 rounded-md border ${statusBadge(r.compensationStatus)}`}>
                      {r.compensationStatus.replace('_', ' ')}
                    </span>
                    {r.creditNoteNumber && (
                      <div className="text-xs text-slate-500 mt-0.5 font-mono">CN {r.creditNoteNumber}</div>
                    )}
                  </td>
                  <td className="px-2.5 py-2.5 text-center">
                    <div className="inline-flex items-center gap-1 flex-wrap justify-center">
                      {(r.compensationStatus === 'pending' || r.compensationStatus === 'partial') && (
                        <button
                          type="button"
                          onClick={() => {
                            setCompId(r.id);
                            setCnNo(r.creditNoteNumber || '');
                            setCnDate(r.creditNoteDate || today());
                            setCnTaxable(r.cnTaxableValue || '');
                            setCnCgst(r.cnCgst || '');
                            setCnSgst(r.cnSgst || '');
                            setCnIgst(r.cnIgst || '');
                            setCompAmt(r.compensationStatus === 'partial' ? '' : (r.compensatedAmount || r.costValue || ''));
                            setClaimVal(r.costValue || '');
                            setAppendPayment(r.compensationStatus === 'partial');
                            setCnAttachment(r.attachmentRef || '');
                          }}
                          className="px-2 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 cursor-pointer hover:bg-emerald-100"
                        >
                          Record CN
                        </button>
                      )}
                      {(r.compensationStatus === 'pending' || r.compensationStatus === 'partial' || r.compensationStatus === 'settled') && (
                        <button
                          type="button"
                          onClick={() => printDispositionClaimVoucher([r], orgProfile)}
                          className="px-2 py-1 rounded-lg text-xs font-bold bg-white text-slate-700 border border-slate-200 cursor-pointer hover:bg-slate-50 inline-flex items-center gap-0.5"
                          title="Print claim / CN voucher"
                        >
                          <Printer className="w-3 h-3" /> Print
                        </button>
                      )}
                      {r.approvalStatus === 'pending_approval' && (
                        <button
                          type="button"
                          onClick={() => {
                            updateInventoryDisposition(r.id, {
                              approvalStatus: 'approved',
                              approvedBy: 'Admin',
                            });
                            setMsg('Claim approved');
                            setTimeout(() => setMsg(null), 2500);
                          }}
                          className="px-2 py-1 rounded-lg text-xs font-bold bg-violet-50 text-violet-800 border border-violet-200 cursor-pointer"
                        >
                          Approve
                        </button>
                      )}
                      {r.compensationStatus === 'settled' && (
                        <button
                          type="button"
                          onClick={() => {
                            setCompId(r.id);
                            setCnNo(r.creditNoteNumber || '');
                            setCnDate(r.creditNoteDate || today());
                            setCnTaxable(r.cnTaxableValue || '');
                            setCnCgst(r.cnCgst || '');
                            setCnSgst(r.cnSgst || '');
                            setCnIgst(r.cnIgst || '');
                            setCompAmt(r.compensatedAmount || r.costValue || '');
                            setClaimVal(r.costValue || '');
                          }}
                          className="px-2 py-1 rounded-lg text-xs font-bold bg-sky-50 text-sky-800 border border-sky-200 cursor-pointer hover:bg-sky-100 inline-flex items-center gap-1"
                          title="Edit settled credit note details"
                        >
                          <Edit2 className="w-3 h-3" /> Edit CN
                        </button>
                      )}
                      <button
                        type="button"
                        title={r.stockApplied === false ? 'Delete record' : 'Delete disposal (stock returns to inventory)'}
                        onClick={() => {
                          setDeleteTarget({ id: r.id, settled: r.compensationStatus === 'settled', stockApplied: r.stockApplied !== false });
                        }}
                        className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile / tablet cards */}
      <div className="block md:hidden space-y-2.5">
        {filtered.length === 0 ? (
          <div className="bg-slate-50 rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
            No dispositions match the current filters.
          </div>
        ) : (
          filtered.map((r) => {
            const prod = products.find((p) => p.id === r.productId);
            const openDays =
              (r.compensationStatus === 'pending' || r.compensationStatus === 'partial')
                ? daysOpen(r.eventDate)
                : 0;
            const cardTone =
              r.compensationStatus === 'settled'
                ? 'received'
                : r.compensationStatus === 'rejected'
                  ? 'due'
                  : r.compensationStatus === 'pending' || r.compensationStatus === 'partial'
                    ? 'warning'
                    : 'neutral';
            return (
              <div key={r.id} data-card-tone={cardTone} className="rounded-2xl border shadow-xs p-3.5 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(r.compensationStatus === 'pending' || r.compensationStatus === 'partial') && (
                        <input
                          type="checkbox"
                          checked={selectedClaimIds.includes(r.id)}
                          onChange={() => toggleClaimSelect(r.id)}
                          className="rounded border-slate-300 cursor-pointer"
                          aria-label={`Select ${r.productName || 'claim'}`}
                        />
                      )}
                      <span className="font-mono text-xs font-bold text-slate-500">{r.eventDate}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-[#e9edfb] text-[#0A1F44]">
                        {TYPE_OPTIONS.find((t) => t.id === r.dispositionType)?.label || r.dispositionType}
                      </span>
                      {openDays >= 30 && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">
                          {openDays}d open
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-bold text-sm text-[#0A1F44] break-words">
                        {r.productName || `#${r.productId}`}
                      </span>
                      <SizeChip volume={prod?.volume} pack={prod?.pack} name={r.productName} />
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-xs font-bold tabular-nums">
                        {r.quantity} cs
                      </span>
                    </div>
                    {r.stockApplied === false && (
                      <span className="inline-block px-2 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        {r.returnTracking ? 'Customer return · stock already out' : 'Doc only · stock kept'}
                      </span>
                    )}
                    <div className="text-xs text-slate-500 leading-snug break-words">
                      <strong className="font-bold text-amber-900">₹{money(r.costValue)}</strong>
                      <span className="text-slate-400"> (₹{money(r.costPerUnit)}/cs)</span>
                      {r.warehouseName ? ` · ${r.warehouseName}` : ''}
                      {r.batchNumber ? ` · Lot ${r.batchNumber}` : ''}
                      {r.expiryDate ? ` · Exp ${r.expiryDate}` : ''}
                      {r.distributedToName ? ` · To ${r.distributedToName}` : ''}
                      {r.supplierName ? ` · ${r.supplierName}` : ''}
                    </div>
                    {r.creditNoteNumber && (
                      <div className="text-xs font-mono font-semibold text-emerald-800">
                        CN {r.creditNoteNumber}
                        {r.compensatedAmount ? ` · ₹${money(r.compensatedAmount)}` : ''}
                      </div>
                    )}
                  </div>
                  <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-lg border ${statusBadge(r.compensationStatus)}`}>
                    {r.compensationStatus.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
                  {(r.compensationStatus === 'pending' || r.compensationStatus === 'partial') && (
                    <button
                      type="button"
                      onClick={() => openCnPanel(r)}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 cursor-pointer"
                    >
                      Record CN
                    </button>
                  )}
                  {r.compensationStatus === 'settled' && (
                    <button
                      type="button"
                      onClick={() => openCnPanel(r)}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold bg-sky-50 text-sky-800 border border-sky-200 cursor-pointer inline-flex items-center gap-1"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Edit CN
                    </button>
                  )}
                  {r.approvalStatus === 'pending_approval' && (
                    <button
                      type="button"
                      onClick={() => {
                        updateInventoryDisposition(r.id, {
                          approvalStatus: 'approved',
                          approvedBy: 'Admin',
                        });
                        setMsg('Claim approved');
                        setTimeout(() => setMsg(null), 2500);
                      }}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold bg-violet-50 text-violet-800 border border-violet-200 cursor-pointer"
                    >
                      Approve
                    </button>
                  )}
                  {(r.compensationStatus === 'pending' || r.compensationStatus === 'partial' || r.compensationStatus === 'settled') && (
                    <button
                      type="button"
                      onClick={() => printDispositionClaimVoucher([r], orgProfile)}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold bg-white text-slate-700 border border-slate-200 cursor-pointer inline-flex items-center gap-1"
                    >
                      <Printer className="w-3.5 h-3.5" /> Print
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteTarget({ id: r.id, settled: r.compensationStatus === 'settled', stockApplied: r.stockApplied !== false });
                    }}
                    className="min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 border border-rose-200 hover:bg-rose-50 cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};
