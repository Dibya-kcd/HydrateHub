import React from 'react';
import { ArrowDownToLine, Download, Edit2, Trash2 } from 'lucide-react';
import { GRN, Product, Warehouse } from '../../../types';
import { money } from '../../../utils/billing';
import { todayISO } from '../../../utils/dateLocal';
import { downloadAllGrnsCsv, downloadSingleGrnCsv } from '../../../utils/grnCsvExport';
import { PackIcon } from '../../common/PackIcon';
import { SizeChip } from '../../common/SizeChip';

interface InventoryConsignmentsTabProps {
  isPhone: boolean;
  grns: GRN[];
  products: Product[];
  warehouses: Warehouse[];
  lastNewGrnId: string | null;
  expandedGrnIds: Record<string, boolean>;
  setExpandedGrnIds: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setSelectedGrnToEdit: React.Dispatch<React.SetStateAction<GRN | null>>;
  setIsInwardModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsBulkModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setGrnToDelete: React.Dispatch<React.SetStateAction<GRN | null>>;
}

export const InventoryConsignmentsTab: React.FC<InventoryConsignmentsTabProps> = ({
  isPhone,
  grns,
  products,
  warehouses,
  lastNewGrnId,
  expandedGrnIds,
  setExpandedGrnIds,
  setSelectedGrnToEdit,
  setIsInwardModalOpen,
  setIsBulkModalOpen,
  setGrnToDelete,
}) => {
  const formatInvDate = (d?: string) => {
    if (!d) return '—';
    const dt = new Date(d.length === 10 ? d + 'T12:00:00' : d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const sortedGrns = [...(grns || [])].sort((a, b) => {
    const da = a.inwardDate || a.invoiceDate || '';
    const db = b.inwardDate || b.invoiceDate || '';
    if (da !== db) return db.localeCompare(da);
    return String(b.id).localeCompare(String(a.id));
  });

  if (isPhone) {
    return (
      <div className="flex flex-col gap-3 w-full hh-inv-pb">
        {sortedGrns.length === 0 ? (
          <div className="hh-inv-card py-10 text-center">
            <p className="text-sm font-bold text-slate-800">No purchases yet</p>
            <p className="text-xs text-slate-500 mt-1">Record an inward bill or import an invoice.</p>
          </div>
        ) : (
          <>
            <div className="text-[13px] font-bold text-slate-700 px-0.5">
              {sortedGrns.length} inward purchase record{sortedGrns.length === 1 ? '' : 's'}
            </div>
            <div className="space-y-2.5 hh-tgrid-2">
              {sortedGrns.map((g, idx) => {
                const isNew = g.id === lastNewGrnId;
                const expanded = !!expandedGrnIds[g.id];
                const total = Number(g.grandTotal) || 0;
                const invLabel = g.invoiceNo || '—';
                const grnLabel = g.grnNumber || `GRN-${g.id}`;
                const dateLabel = isNew && (g.inwardDate === todayISO() || g.invoiceDate === todayISO())
                  ? 'today'
                  : formatInvDate(g.inwardDate || g.invoiceDate);
                const whName = warehouses.find((w) => w.id === g.warehouseId)?.name || g.warehouseId || 'Main';
                const totalCs =
                  Number(g.totalReceivedQty) ||
                  (g.items || []).reduce(
                    (s, it) => s + (Number((it as any).totalReceivedQty) || Number((it as any).qty) || 0),
                    0
                  );
                const taxable = Number(g.totalTaxable) || 0;

                return (
                  <div
                    key={g.id}
                    className={`hh-inv-card p-0 overflow-hidden ${isNew ? 'hh-inv-card--alert-blue' : ''}`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedGrnIds((prev) => ({
                          ...prev,
                          [g.id]: !prev[g.id],
                        }))
                      }
                      aria-expanded={expanded}
                      className="w-full px-3.5 py-3 text-left cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="min-w-0">
                          <div className="text-[13.5px] font-extrabold text-slate-900 uppercase leading-snug break-words">
                            {(g.supplierName || 'Supplier').toUpperCase()}
                          </div>
                          <div className="text-xs font-medium text-slate-500 mt-0.5 leading-snug">
                            {grnLabel} · Inv {invLabel} · {dateLabel}
                          </div>
                          {isNew && (
                            <span className="inline-block mt-1.5 px-2.5 py-0.5 rounded-full bg-sky-50 text-[#2864d9] text-xs font-bold">
                              New
                            </span>
                          )}
                        </div>
                        <div className="text-[14px] font-extrabold text-slate-900 tabular-nums shrink-0">
                          ₹{money(total)}
                        </div>
                      </div>
                      {idx === 0 && !isNew && !expanded && (
                        <div className="grid grid-cols-3 gap-2 pt-2.5 mt-2.5 border-t border-slate-100">
                          <div>
                            <div className="text-xs text-slate-400 font-medium">Cases</div>
                            <div className="text-[13px] font-bold text-slate-900 tabular-nums">{totalCs}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-400 font-medium">Godown</div>
                            <div className="text-[13px] font-bold text-slate-900 truncate">{whName}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-400 font-medium">Taxable</div>
                            <div className="text-[13px] font-bold text-slate-900 tabular-nums">₹{money(taxable)}</div>
                          </div>
                        </div>
                      )}
                    </button>

                    {expanded && (
                      <div className="px-3.5 pb-3.5 pt-2.5 border-t border-slate-100 space-y-2.5">
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <div className="text-xs text-slate-400 font-medium">Cases</div>
                            <div className="text-[13px] font-bold text-slate-900 tabular-nums">{totalCs}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-400 font-medium">Godown</div>
                            <div className="text-[13px] font-bold text-slate-900 truncate">{whName}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-400 font-medium">Taxable</div>
                            <div className="text-[13px] font-bold text-slate-900 tabular-nums">₹{money(taxable)}</div>
                          </div>
                        </div>

                        {(g.items || []).length > 0 && (
                          <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                            {(g.items || []).map((item, lineIdx) => (
                              <div key={item.id || lineIdx} className="px-3 py-2 flex items-center justify-between gap-2 text-[12.5px]">
                                <div className="min-w-0">
                                  <div className="font-bold text-slate-800 truncate">{item.productName}</div>
                                  <div className="text-xs text-slate-500">
                                    {item.qty} cs{item.freeQty ? ` + ${item.freeQty} free` : ''}
                                    {item.unitPrice != null ? ` · ₹${money(item.unitPrice)}/cs` : ''}
                                  </div>
                                </div>
                                <div className="font-bold text-slate-900 tabular-nums shrink-0">
                                  ₹{money(Number(item.lineTotal) || 0)}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="grid grid-cols-3 gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => downloadSingleGrnCsv(g, warehouses)}
                            className="min-h-[38px] rounded-full border border-slate-200 bg-white text-slate-700 text-[12px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Download size={13} /> CSV
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedGrnToEdit(g);
                              setIsInwardModalOpen(true);
                            }}
                            className="min-h-[38px] rounded-full border border-[#2864d9] bg-white text-[#2864d9] text-[12px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Edit2 size={13} /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setGrnToDelete(g)}
                            className="min-h-[38px] rounded-full border border-rose-200 bg-rose-50 text-rose-700 text-[12px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Trash2 size={13} /> Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="hh-inv-cta-dock">
          <button
            type="button"
            onClick={() => setIsBulkModalOpen(true)}
            className="hh-inv-btn-outline flex-1"
          >
            Bulk import
          </button>
          <button
            type="button"
            id="btn-add-inward"
            onClick={() => {
              setSelectedGrnToEdit(null);
              setIsInwardModalOpen(true);
            }}
            className="hh-inv-btn-primary flex-1"
          >
            + New purchase
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 max-w-none mx-auto w-full">
      {sortedGrns.length === 0 ? (
        <div data-card-tone="neutral" className="rounded-2xl border shadow-sm px-6 py-12 text-center">
          <p className="text-sm font-semibold text-slate-800">No purchases yet</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedGrnToEdit(null);
                setIsInwardModalOpen(true);
              }}
              className="px-4 py-2 rounded-full bg-[var(--primary)] text-white text-sm font-semibold cursor-pointer"
            >
              New purchase
            </button>
            <button
              type="button"
              onClick={() => setIsBulkModalOpen(true)}
              className="px-4 py-2 rounded-full bg-white border border-black/10 text-slate-700 text-sm font-semibold cursor-pointer"
            >
              Bulk import
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="text-xs font-bold text-slate-700">
              {sortedGrns.length} Inward Purchase Record{sortedGrns.length === 1 ? '' : 's'}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => downloadAllGrnsCsv(sortedGrns, warehouses)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs transition-colors"
                title="Download all inward GRNs with full line items and tax breakdown as CSV"
                aria-label="Download all GRNs as CSV"
              >
                <Download size={13} className="text-emerald-700" />
                <span>CSV<span className="hidden sm:inline"> · all GRNs</span></span>
              </button>
            </div>
          </div>
          <ul className="space-y-2.5">
            {sortedGrns.map((g) => {
              const expanded = !!expandedGrnIds[g.id];
              const total = Number(g.grandTotal) || 0;
              const invLabel = g.invoiceNo || '—';
              const grnLabel = g.grnNumber || `GRN-${g.id}`;
              const dateLabel = formatInvDate(g.inwardDate || g.invoiceDate);
              return (
                <li
                  key={g.id}
                  data-card-tone="received"
                  className="rounded-2xl border shadow-sm overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedGrnIds((prev) => ({
                        ...prev,
                        [g.id]: !prev[g.id],
                      }))
                    }
                    className="w-full flex items-center justify-between gap-3 px-3 sm:px-4 py-3 sm:py-3.5 text-left cursor-pointer transition-colors"
                    aria-expanded={expanded}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="hh-icon-badge hh-icon-badge--green">
                        <ArrowDownToLine size={18} />
                      </span>
                      <div className="min-w-0">
                        <div className="text-[13px] sm:text-sm font-bold text-slate-900 leading-snug break-words">
                          {(g.supplierName || 'Supplier').toUpperCase()}
                        </div>
                        <div className="text-xs sm:text-[12px] text-slate-600 mt-0.5 break-words">
                          {grnLabel} · Inv {invLabel} · {dateLabel}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm font-extrabold text-emerald-900 tabular-nums shrink-0">
                      ₹{money(total)}
                    </div>
                  </button>

                  {expanded && (
                    <div className="px-3 sm:px-4 pb-4 pt-3 border-t border-black/5 bg-white/85 space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div>
                          <div className="text-slate-500 font-medium">Godown</div>
                          <div className="font-semibold text-slate-800">
                            {warehouses.find((w) => w.id === g.warehouseId)?.name ||
                              g.warehouseId ||
                              '—'}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500 font-medium">Cases</div>
                          <div className="font-semibold text-slate-800 tabular-nums">
                            {Number(g.totalReceivedQty) ||
                              (g.items || []).reduce(
                                (s, it) =>
                                  s +
                                  (Number((it as any).totalReceivedQty) ||
                                    Number((it as any).qty) ||
                                    0),
                                0,
                              )}{' '}
                            cs
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500 font-medium">Taxable</div>
                          <div className="font-semibold text-slate-800 tabular-nums">
                            ₹{money(Number(g.totalTaxable) || 0)}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500 font-medium">GST</div>
                          <div className="font-semibold text-slate-800 tabular-nums">
                            ₹
                            {money(
                              Number(g.totalTax) ||
                                (Number(g.totalCgst) || 0) + (Number(g.totalSgst) || 0),
                            )}
                          </div>
                        </div>
                      </div>

                      {(g.items || []).length > 0 && (
                        <ul className="rounded-xl border border-black/5 bg-white divide-y divide-black/5 overflow-hidden">
                          {(g.items || []).map((item, idx) => {
                            const prod = products.find((p) => p.id === item.productId);
                            return (
                              <li
                                key={item.id || idx}
                                className="px-3 py-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-sm"
                              >
                                <div className="flex items-start gap-2 min-w-0">
                                  <PackIcon size="sm" pack={prod?.pack} name={item.productName} className="mt-0.5" />
                                  <div className="min-w-0">
                                    <span className="font-semibold text-slate-800">
                                      {item.productName}
                                    </span>{' '}
                                    <SizeChip
                                      volume={prod?.volume}
                                      pack={prod?.pack}
                                      name={item.productName}
                                    />
                                    {item.schemeText && (
                                      <span className="ml-1.5 text-xs text-purple-700">
                                        {item.schemeText}
                                      </span>
                                    )}
                                    <div className="text-xs text-slate-500">
                                      {item.qty} cs
                                      {item.freeQty ? ` + ${item.freeQty} free` : ''}
                                      {item.unitPrice != null
                                        ? ` · ₹${money(item.unitPrice)}/cs`
                                        : ''}
                                    </div>
                                  </div>
                                </div>
                                <span className="font-bold tabular-nums text-slate-900 shrink-0">
                                  ₹{money(Number(item.lineTotal) || 0)}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}

                      <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => downloadSingleGrnCsv(g, warehouses)}
                          className="inline-flex items-center justify-center gap-1.5 px-2 sm:px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs sm:text-sm font-semibold text-emerald-800 cursor-pointer hover:bg-emerald-100"
                          title="Download this GRN and its line items as CSV"
                        >
                          <Download size={14} />
                          CSV
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedGrnToEdit(g);
                            setIsInwardModalOpen(true);
                          }}
                          className="inline-flex items-center justify-center gap-1.5 px-2 sm:px-3 py-2 rounded-xl bg-white border border-black/10 text-xs sm:text-sm font-semibold text-[var(--primary)] cursor-pointer hover:bg-[var(--primary)]/5"
                        >
                          <Edit2 size={14} />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setGrnToDelete(g)}
                          className="inline-flex items-center justify-center gap-1.5 px-2 sm:px-3 py-2 rounded-xl bg-rose-50 border border-rose-100 text-xs sm:text-sm font-semibold text-rose-700 cursor-pointer hover:bg-rose-100"
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
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
