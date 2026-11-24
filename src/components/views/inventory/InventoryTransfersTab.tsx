import React from 'react';
import { ArrowRight, ArrowRightLeft, Minus, Plus, Trash2, Truck } from 'lucide-react';
import { Product, StockTransfer, Warehouse } from '../../../types';
import { todayISO } from '../../../utils/dateLocal';
import { InfoTip } from '../../common/InfoTip';
import { PackIcon } from '../../common/PackIcon';
import { SizeChip } from '../../common/SizeChip';

export type TransferLine = { key: string; productId: number; qty: number };

interface InventoryTransfersTabProps {
  isPhone: boolean;
  products: Product[];
  warehouses: Warehouse[];
  stockTransfers: StockTransfer[];
  xferFromId: string;
  setXferFromId: React.Dispatch<React.SetStateAction<string>>;
  xferToId: string;
  setXferToId: React.Dispatch<React.SetStateAction<string>>;
  xferLines: TransferLine[];
  setXferLines: React.Dispatch<React.SetStateAction<TransferLine[]>>;
  xferNote: string;
  setXferNote: React.Dispatch<React.SetStateAction<string>>;
  xferBusy: boolean;
  setXferBusy: React.Dispatch<React.SetStateAction<boolean>>;
  xferJustDone: {
    fromName: string;
    toName: string;
    totalCases: number;
    summary: string;
    timeLabel: string;
    count: number;
  } | null;
  setXferJustDone: React.Dispatch<
    React.SetStateAction<{
      fromName: string;
      toName: string;
      totalCases: number;
      summary: string;
      timeLabel: string;
      count: number;
    } | null>
  >;
  showTransferPicker: boolean;
  setShowTransferPicker: React.Dispatch<React.SetStateAction<boolean>>;
  warehouseStock: (whId: string, productId: number) => number;
  addStockTransfer: (t: Omit<StockTransfer, 'id' | 'createdAt'>) => boolean | void;
  showToast: (msg: string) => void;
  showPhoneToast: (msg: string) => void;
}

export const InventoryTransfersTab: React.FC<InventoryTransfersTabProps> = ({
  isPhone,
  products,
  warehouses,
  stockTransfers,
  xferFromId,
  setXferFromId,
  xferToId,
  setXferToId,
  xferLines,
  setXferLines,
  xferNote,
  setXferNote,
  xferBusy,
  setXferBusy,
  xferJustDone,
  setXferJustDone,
  showTransferPicker,
  setShowTransferPicker,
  warehouseStock,
  addStockTransfer,
  showToast,
  showPhoneToast,
}) => {
  const fromId = xferFromId || warehouses[0]?.id || '';
  const toId = xferToId || warehouses[1]?.id || warehouses[0]?.id || '';
  const availableFor = (productId: number) =>
    fromId ? Math.max(0, warehouseStock(fromId, productId)) : 0;

  const addProductLine = (productId: number) => {
    if (!productId) return;
    if (xferLines.some((l) => l.productId === productId)) {
      showToast('Product already on the transfer list.');
      return;
    }
    const avail = availableFor(productId);
    setXferLines((prev) => [
      ...prev,
      {
        key: `line_${productId}_${Date.now()}`,
        productId,
        qty: avail > 0 ? 1 : 0,
      },
    ]);
  };

  const executeTransfer = () => {
    if (!fromId || !toId || fromId === toId) {
      showToast('Choose two different warehouses.');
      return;
    }
    if (xferLines.length === 0) {
      showToast('Add at least one product.');
      return;
    }
    setXferBusy(true);
    let okCount = 0;
    let failCount = 0;
    let movedTotal = 0;
    const movedParts: string[] = [];
    for (const line of xferLines) {
      const qty = Math.floor(Number(line.qty) || 0);
      if (qty <= 0) continue;
      const avail = availableFor(line.productId);
      const prodName = products.find((p) => p.id === line.productId)?.name || `Product #${line.productId}`;
      if (qty > avail) {
        showToast(`Cannot transfer ${qty} of ${prodName} — only ${avail} available at source.`);
        failCount++;
        continue;
      }
      const result = addStockTransfer({
        date: todayISO(),
        fromWarehouseId: fromId,
        toWarehouseId: toId,
        productId: line.productId,
        batchNumber: '',
        quantity: qty,
        referenceNote: xferNote.trim() || undefined,
      });
      if (result === false) failCount++;
      else {
        okCount++;
        movedTotal += qty;
        movedParts.push(`${prodName} ${qty} cs`);
      }
    }
    setXferBusy(false);
    if (okCount > 0) {
      const fromName = warehouses.find((w) => w.id === fromId)?.name || 'Source';
      const toName = warehouses.find((w) => w.id === toId)?.name || 'Destination';
      const nowStr = new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
      if (isPhone) {
        setXferJustDone({
          fromName,
          toName,
          totalCases: movedTotal,
          summary: movedParts.join(' · '),
          timeLabel: `Today ${nowStr}`,
          count: okCount,
        });
        showPhoneToast(`${movedTotal} cs moved from ${fromName} to ${toName}.`);
      } else {
        showToast(
          `Transferred ${okCount} product line${okCount === 1 ? '' : 's'}${failCount ? ` (${failCount} failed)` : ''}.`,
        );
      }
      setXferLines([]);
      setXferNote('');
    } else if (failCount === 0) {
      showToast('Enter quantities greater than zero.');
    }
  };

  const productsNotOnList = products.filter(
    (p) => !xferLines.some((l) => l.productId === p.id),
  );

  if (isPhone) {
    const fromWhName = warehouses.find((w) => w.id === fromId)?.name || 'Main';
    const totalMovingCases = xferLines.reduce((s, l) => s + Math.max(0, Math.floor(Number(l.qty) || 0)), 0);

    if (xferJustDone) {
      return (
        <div className="flex flex-col gap-3 w-full">
          <div className="hh-inv-card hh-inv-card--alert-blue">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[14.5px] font-extrabold text-slate-900 flex items-center gap-1.5">
                  <span>{xferJustDone.fromName}</span>
                  <ArrowRight size={14} className="text-slate-400" />
                  <span>{xferJustDone.toName}</span>
                </div>
                <div className="text-[12px] text-slate-500 mt-0.5">
                  {xferJustDone.timeLabel} · {xferJustDone.count} product{xferJustDone.count === 1 ? '' : 's'}
                </div>
                <div className="text-[12px] font-medium text-slate-700 mt-1">
                  {xferJustDone.summary}
                </div>
              </div>
              <div className="text-[14.5px] font-extrabold text-slate-900 tabular-nums shrink-0">
                {xferJustDone.totalCases} cs
              </div>
            </div>
          </div>

          <div className="space-y-2.5 hh-tgrid-2">
          {stockTransfers.slice(xferJustDone.count, xferJustDone.count + 8).map((st) => {
            const from = warehouses.find((w) => w.id === st.fromWarehouseId);
            const to = warehouses.find((w) => w.id === st.toWarehouseId);
            const prod = products.find((p) => p.id === st.productId);
            return (
              <div key={st.id} className="hh-inv-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[14px] font-bold text-slate-900 flex items-center gap-1.5">
                      <span>{from?.name || '?'}</span>
                      <ArrowRight size={13} className="text-slate-400" />
                      <span>{to?.name || '?'}</span>
                    </div>
                    <div className="text-[12px] text-slate-500 mt-0.5">
                      {st.date} · {prod?.name || `Product #${st.productId}`}
                    </div>
                  </div>
                  <div className="text-[14px] font-extrabold text-slate-900 tabular-nums shrink-0">
                    {st.quantity} cs
                  </div>
                </div>
              </div>
            );
          })}
          </div>

          <button
            type="button"
            onClick={() => setXferJustDone(null)}
            className="hh-inv-btn-outline w-full mt-1"
          >
            + New transfer
          </button>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-3 w-full">
        {/* FROM -> TO godown card */}
        <div className="hh-inv-card flex items-center gap-2.5">
          <label className="hh-inv-field flex-1">
            <span className="hh-inv-field__label">From</span>
            <select
              value={fromId}
              onChange={(e) => setXferFromId(e.target.value)}
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
          <ArrowRight size={18} className="text-[#2864d9] shrink-0" />
          <label className="hh-inv-field flex-1">
            <span className="hh-inv-field__label">To</span>
            <select
              value={toId}
              onChange={(e) => setXferToId(e.target.value)}
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Products card */}
        <div className="hh-inv-card space-y-2.5">
          {xferLines.length === 0 ? (
            <p className="text-[12.5px] text-slate-500 py-1">
              No products selected yet. Add beverages below to move stock.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {xferLines.map((line) => {
                const prod = products.find((p) => p.id === line.productId);
                const avail = availableFor(line.productId);
                const over = line.qty > avail;
                return (
                  <div key={line.key} className="py-2.5 first:pt-0 flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <PackIcon pack={prod?.pack} name={prod?.name} />
                      <div className="min-w-0">
                        <div className="text-[13.5px] font-bold text-slate-900 leading-snug truncate">
                          {prod?.name || `Product #${line.productId}`}
                        </div>
                        <div className={`text-xs font-medium mt-0.5 ${avail <= 0 || over ? 'text-rose-600' : 'text-slate-500'}`}>
                          Available in {fromWhName}: {avail} cs
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="inline-flex items-center rounded-full border border-[#2864d9] bg-white overflow-hidden">
                        <button
                          type="button"
                          aria-label="Decrease quantity"
                          onClick={() => {
                            if (line.qty <= 1) {
                              setXferLines((prev) => prev.filter((l) => l.key !== line.key));
                            } else {
                              setXferLines((prev) =>
                                prev.map((l) => (l.key === line.key ? { ...l, qty: l.qty - 1 } : l))
                              );
                            }
                          }}
                          className="w-8 h-8 min-w-0 min-h-0 flex items-center justify-center text-[#2864d9] font-bold cursor-pointer"
                        >
                          <Minus size={14} />
                        </button>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={avail > 0 ? avail : undefined}
                          value={line.qty}
                          onChange={(e) => {
                            const v = Math.max(0, Number(e.target.value) || 0);
                            setXferLines((prev) =>
                              prev.map((l) => (l.key === line.key ? { ...l, qty: v } : l))
                            );
                          }}
                          className="w-10 text-center text-[13.5px] font-extrabold text-slate-900 tabular-nums border-0 bg-transparent p-0 focus:outline-none"
                        />
                        <button
                          type="button"
                          aria-label="Increase quantity"
                          onClick={() =>
                            setXferLines((prev) =>
                              prev.map((l) => (l.key === line.key ? { ...l, qty: l.qty + 1 } : l))
                            )
                          }
                          className="w-8 h-8 min-w-0 min-h-0 flex items-center justify-center text-[#2864d9] font-bold cursor-pointer"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <button
            type="button"
            disabled={!fromId}
            onClick={() => setShowTransferPicker(true)}
            className="text-[13px] font-bold text-[#2864d9] py-1 min-h-0 cursor-pointer disabled:opacity-40"
          >
            + Add product
          </button>
        </div>

        <div className="flex items-center justify-between px-1 py-1 text-[13.5px]">
          <span className="font-medium text-slate-500">Total moving</span>
          <span className="font-extrabold text-slate-900 tabular-nums">{totalMovingCases} cs</span>
        </div>

        <button
          type="button"
          disabled={xferBusy || xferLines.length === 0 || !fromId || !toId || totalMovingCases <= 0}
          onClick={executeTransfer}
          className="hh-inv-btn-primary w-full"
        >
          Transfer stock
        </button>

        {stockTransfers.length > 0 && (
          <div className="space-y-2 pt-2">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 px-0.5">
              Recent transfers
            </div>
            <div className="space-y-2 hh-tgrid-2">
            {stockTransfers.slice(0, 8).map((st) => {
              const from = warehouses.find((w) => w.id === st.fromWarehouseId);
              const to = warehouses.find((w) => w.id === st.toWarehouseId);
              const prod = products.find((p) => p.id === st.productId);
              return (
                <div key={st.id} className="hh-inv-card flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-bold text-slate-900 flex items-center gap-1.5">
                      <span>{from?.name || '?'}</span>
                      <ArrowRight size={13} className="text-slate-400" />
                      <span>{to?.name || '?'}</span>
                    </div>
                    <div className="text-[12px] text-slate-500 mt-0.5">
                      {st.date} · {prod?.name || `Product #${st.productId}`}
                    </div>
                  </div>
                  <div className="text-[13.5px] font-extrabold text-slate-900 tabular-nums shrink-0">
                    {st.quantity} cs
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        )}

        {showTransferPicker && (
          <div className="rt-bsheet-scrim" onClick={() => setShowTransferPicker(false)}>
            <div className="rt-bsheet" onClick={(e) => e.stopPropagation()}>
              <div className="hh-grab" />
              <h3 className="text-[17px] font-extrabold text-slate-900">Select product</h3>
              <div className="divide-y divide-slate-100 max-h-[55vh] overflow-y-auto bg-white rounded-2xl border border-slate-200">
                {[...productsNotOnList]
                  .sort((a, b) => availableFor(b.id) - availableFor(a.id) || a.name.localeCompare(b.name))
                  .map((p) => {
                    const q = availableFor(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          addProductLine(p.id);
                          setShowTransferPicker(false);
                        }}
                        className="w-full px-3.5 py-3 flex items-center justify-between gap-2 text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <PackIcon size="sm" pack={p.pack} name={p.name} />
                          <div className="min-w-0">
                            <div className="text-[13.5px] font-bold text-slate-900 truncate">{p.name}</div>
                            <div className="text-xs text-slate-500">Available in {fromWhName}: {q} cs</div>
                          </div>
                        </div>
                        <span className="text-[12.5px] font-bold text-[#2864d9] shrink-0">Add</span>
                      </button>
                    );
                  })}
                {productsNotOnList.length === 0 && (
                  <div className="px-4 py-6 text-center text-xs text-slate-500">
                    All products are already added.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 max-w-none mx-auto w-full">
      <div data-card-tone="warning" className="rounded-2xl border shadow-sm p-3.5 sm:p-5 space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="hh-icon-badge hh-icon-badge--sm hh-icon-badge--amber">
              <ArrowRightLeft size={15} />
            </span>
            <h2 className="text-sm font-bold text-slate-900">Move stock between godowns</h2>
          </div>
          <InfoTip title="How transfers work" size="sm">
            <p>Earliest-expiry batches move first, so the oldest stock leaves the source godown first.</p>
          </InfoTip>
        </div>

        <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-2 sm:gap-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">
              From
            </label>
            <select
              value={fromId}
              onChange={(e) => setXferFromId(e.target.value)}
              className="w-full px-2.5 sm:px-3 py-2.5 rounded-xl border border-black/10 bg-white text-sm font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
            >
              <option value="">Choose…</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">
              To
            </label>
            <select
              value={toId}
              onChange={(e) => setXferToId(e.target.value)}
              className="w-full px-2.5 sm:px-3 py-2.5 rounded-xl border border-black/10 bg-white text-sm font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
            >
              <option value="">Choose…</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Product lines */}
        <div className="space-y-1">
          {xferLines.length === 0 && (
            <p className="text-xs text-slate-400 py-1">
              No products yet — add one below.
            </p>
          )}
          {xferLines.map((line) => {
            const prod = products.find((p) => p.id === line.productId);
            const avail = availableFor(line.productId);
            const over = line.qty > avail;
            return (
              <div
                key={line.key}
                className="flex items-center gap-2 sm:gap-3 py-2.5 px-2.5 rounded-xl bg-white/80 border border-black/5"
              >
                <PackIcon size="sm" pack={prod?.pack} name={prod?.name} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] sm:text-sm font-semibold text-slate-900 leading-snug break-words">
                    {prod?.name || `Product #${line.productId}`}{' '}
                    <SizeChip volume={prod?.volume} pack={prod?.pack} name={prod?.name} />
                  </div>
                  <div
                    className={`text-xs font-medium ${
                      avail <= 0
                        ? 'text-rose-600'
                        : over
                          ? 'text-amber-700'
                          : 'text-slate-500'
                    }`}
                  >
                    Available {avail}
                    {!fromId && ' (select From)'}
                    {over && avail > 0 && ` · max ${avail}`}
                  </div>
                </div>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={avail > 0 ? avail : undefined}
                  value={line.qty}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setXferLines((prev) =>
                      prev.map((l) =>
                        l.key === line.key
                          ? { ...l, qty: isNaN(v) ? 0 : v }
                          : l,
                      ),
                    );
                  }}
                  className={`w-16 sm:w-20 shrink-0 px-2 py-1.5 rounded-lg border text-sm text-right font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 ${
                    over ? 'border-rose-400 bg-rose-50' : 'border-black/10'
                  }`}
                />
                <button
                  type="button"
                  aria-label="Remove product"
                  onClick={() =>
                    setXferLines((prev) =>
                      prev.filter((l) => l.key !== line.key),
                    )
                  }
                  className="shrink-0 p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>

        <select
          value=""
          onChange={(e) => {
            const pid = Number(e.target.value);
            if (pid) addProductLine(pid);
          }}
          disabled={!fromId}
          className="w-full px-3 py-2.5 rounded-xl border border-dashed border-black/15 bg-slate-50/80 text-sm text-slate-600 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 disabled:opacity-50"
        >
          <option value="">
            {fromId ? '+ Add product…' : 'Select From warehouse first…'}
          </option>
          {[...productsNotOnList]
            .sort((a, b) => {
              const qa = availableFor(a.id);
              const qb = availableFor(b.id);
              if (qa > 0 && qb <= 0) return -1;
              if (qb > 0 && qa <= 0) return 1;
              return a.name.localeCompare(b.name);
            })
            .map((p) => {
              const q = availableFor(p.id);
              return (
                <option key={p.id} value={p.id}>
                  {p.name} — {q} available
                </option>
              );
            })}
        </select>

        <input
          type="text"
          value={xferNote}
          onChange={(e) => setXferNote(e.target.value)}
          placeholder="Note (optional) — e.g. Shift to Chakan godown"
          aria-label="Transfer note"
          className="w-full px-3 py-2.5 rounded-xl border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
        />

        <button
          type="button"
          disabled={xferBusy || xferLines.length === 0 || !fromId || !toId}
          onClick={executeTransfer}
          className="w-full py-3 rounded-xl bg-[var(--primary)] text-white font-bold text-sm cursor-pointer hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Transfer stock
        </button>
      </div>

      {/* Recent transfers */}
      {stockTransfers.length > 0 && (
        <div data-card-tone="sales" className="rounded-2xl border shadow-sm overflow-hidden">
          <div className="px-3.5 sm:px-4 py-3 border-b border-black/5 flex items-center gap-2.5">
            <span className="hh-icon-badge hh-icon-badge--sm hh-icon-badge--blue">
              <Truck size={15} />
            </span>
            <span className="text-sm font-bold text-slate-900">Recent transfers</span>
          </div>
          <ul className="bg-white/80 divide-y divide-black/5 sm:max-h-64 sm:overflow-y-auto">
            {stockTransfers.slice(0, 12).map((st) => {
              const from = warehouses.find((w) => w.id === st.fromWarehouseId);
              const to = warehouses.find((w) => w.id === st.toWarehouseId);
              const prod = products.find((p) => p.id === st.productId);
              return (
                <li
                  key={st.id}
                  className="px-3.5 sm:px-4 py-2.5 text-xs sm:text-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex items-start gap-2 min-w-0">
                      <PackIcon size="sm" pack={prod?.pack} name={prod?.name} className="mt-0.5" />
                      <span className="font-semibold text-slate-800 leading-snug break-words min-w-0">
                        {prod?.name || `Product #${st.productId}`}{' '}
                        <SizeChip volume={prod?.volume} pack={prod?.pack} name={prod?.name} />
                      </span>
                    </span>
                    <span className="font-bold tabular-nums text-slate-800 shrink-0">{st.quantity} cs</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-xs text-slate-500 mt-0.5">
                    <span className="min-w-0 break-words">{from?.name || '?'} → {to?.name || '?'}</span>
                    <span className="text-slate-400 shrink-0">{st.date}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};
